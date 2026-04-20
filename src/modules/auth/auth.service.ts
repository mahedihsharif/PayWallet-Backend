import logger from "@config/logger.config";
import redis from "@config/redis.config";
import eventBus from "@events/eventBus";
import { emailQueue } from "@jobs/queue.config";
import { generateAndStoreOtp, verifyOtpCode } from "@modules/otp/otp.service";
import { OtpPurpose } from "@modules/otp/otp.types";
import { UserStatus } from "@modules/user/user.types";
import { CONSTANTS } from "@utils/constants";
import {
  createNewAccessTokenWithRefreshToken,
  createUserTokens,
} from "@utils/userTokens";
import bcrypt from "bcrypt";
import crypto from "crypto";
import httpStatus from "http-status-codes";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import env from "../../config/env.config";
import AppError from "../../errorHelpers/AppError";
import { Wallet } from "../wallet/wallet.model";
import { User } from "./auth.model";
import {
  IAuthProvider,
  LoginDTO,
  LoginResponse,
  RegisterDTO,
} from "./auth.types";

const register = async (payload: RegisterDTO) => {
  const { fullName, email, phone, password } = payload;
  const existingUser = await User.findOne({
    $or: [{ email }, { phone }],
  }).lean();
  if (existingUser) {
    if (existingUser.email === email) {
      throw new AppError(
        httpStatus.CONFLICT,
        "An account with this email already exists.",
      );
    }
    throw new AppError(
      httpStatus.CONFLICT,
      "An account with this phone number already exists.",
    );
  }
  // 2. Use a MongoDB session for atomic User + Wallet creation
  //    If wallet creation fails, the user document is rolled back.
  //    No orphaned user without a wallet.
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const authProvider: IAuthProvider = {
      provider: "credentials",
      providerId: email as string,
    };
    // 3. Create user (password hashed by pre-save hook in user.model.ts)
    const [user] = await User.create(
      [{ fullName, email, phone, password, auths: [authProvider] }],
      {
        session,
      },
    );
    // 4. Create wallet atomically with user creation
    await Wallet.create(
      [
        {
          userId: user._id,
          currency: "BDT",
          // New users get unverified limits until KYC
          limits: {
            dailyDebit: CONSTANTS.DEFAULT_DAILY_LIMIT,
            weeklyDebit: CONSTANTS.DEFAULT_DAILY_LIMIT * 5,
            monthlyDebit: CONSTANTS.DEFAULT_DAILY_LIMIT * 15,
            singleTransactionMax: CONSTANTS.DEFAULT_DAILY_LIMIT,
            singleTransactionMin: CONSTANTS.MIN_TRANSACTION,
          },
        },
      ],
      { session },
    );

    await session.commitTransaction();
    // 5. Generate and send OTP (OUTSIDE the session — email is not transactional)
    const otpCode = await generateAndStoreOtp(
      String(user._id),
      user.email,
      OtpPurpose.EMAIL_VERIFY,
    );
    // 6. Queue the verification email asynchronously
    //    Do NOT await — let it run in the background

    emailQueue.add(
      "sendVerificationEmail",
      {
        to: user.email,
        fullName: user.fullName,
        otpCode,
      },
      {
        attempts: env.EMAIL_JOB_ATTEMPTS,
        backoff: { type: "exponential", delay: env.EMAIL_JOB_BACKOFF_DELAY },
      },
    );

    // 7. Emit event (other listeners may react — analytics, onboarding, etc.)
    eventBus.emit("user_registered", {
      userId: String(user._id),
      email: user.email,
      fullName: user.fullName,
    });

    logger.info(`New user registered: ${email}`);
    return user;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// ─── VERIFY EMAIL ─────────────────────────────────────────────────

const verifyEmail = async (email: string, code: string) => {
  // 1. Find user first — give generic error if not found
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid email or OTP.");
  }

  if (user.isEmailVerified) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Email is already verified. Please log in.",
    );
  }

  // 2. Verify the OTP
  await verifyOtpCode(email, code, OtpPurpose.EMAIL_VERIFY);

  // 3. Mark user as verified
  user.isEmailVerified = true;
  await user.save();

  // 4. Send welcome email (async, non-blocking)
  await emailQueue.add("sendWelcomeEmail", {
    to: user.email,
    fullName: user.fullName,
  });

  logger.info(`Email verified: ${email}`);

  return { message: "Email verified successfully. You can now log in." };
};

// ─── LOGIN ────────────────────────────────────────────────────────

const login = async (
  dto: LoginDTO,
  ipAddress: string,
): Promise<LoginResponse> => {
  const { email, password, deviceId, deviceName } = dto;

  // 1. Check if account is temporarily locked (from failed attempts)
  const failKey = `login:fail:${email}`;
  const failCount = parseInt((await redis.get(failKey)) ?? "0");

  if (failCount >= 5) {
    const ttl = await redis.ttl(failKey);
    throw new AppError(
      httpStatus.CONFLICT,
      `Account temporarily locked. Try again in ${Math.ceil(ttl / 60)} minute(s).`,
    );
  }

  // 2. Fetch user WITH password (select: false normally excludes it)
  const user = await User.findOne({ email, isDeleted: false }).select(
    "+password",
  );

  // 3. Verify credentials — SAME error for wrong email or wrong password
  //    (prevents account enumeration)
  const passwordValid = user ? await user.comparePassword(password) : false;

  if (!user || !passwordValid) {
    // Increment fail counter
    const newCount = await redis.incr(failKey);
    if (newCount === 1) await redis.expire(failKey, 15 * 60); // 15-min window

    // Warn when getting close to lockout
    const remaining = 15 - newCount;
    if (remaining > 0 && remaining <= 2) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        `Invalid email or password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.`,
      );
    }
    // MUST THROW (important)
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  // 4. Check account status
  if (!user.isEmailVerified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Email not verified. Please verify your email first.",
    );
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Your account is ${user.status}. Please contact support.`,
    );
  }

  // 5. Clear failure counter on successful login
  await redis.del(failKey);

  // 6. Device management — detect new devices and alert user
  const knownDevice = user
    ? user.devices.find((d) => d.deviceId === deviceId)
    : undefined;

  if (!knownDevice) {
    // New device — add to list and send security alert

    user.devices.push({
      deviceId,
      deviceName,
      ipAddress,
      lastUsed: new Date(),
      isTrusted: false,
    });

    // Cap device list at 10
    if (user.devices.length > 10) {
      user.devices.shift(); // Remove oldest
    }

    // Non-blocking security alert email
    emailQueue.add("sendNewDeviceAlert", {
      to: user.email,
      fullName: user.fullName,
      deviceName,
      ipAddress,
      timestamp: new Date().toISOString(),
    });

    eventBus.emit("login_newDevice", {
      userId: String(user._id),
      email: user.email,
      deviceName,
      ipAddress,
    });
  } else {
    // Update last used timestamp
    knownDevice.lastUsed = new Date();
    knownDevice.ipAddress = ipAddress;
  }

  // 7. Update last login metadata
  user.lastLoginAt = new Date();
  user.lastLoginIp = ipAddress;
  await user.save();

  // 8. Generate token pair
  const userObj = user.toObject();
  const userTokens = await createUserTokens({
    ...userObj,
    _id: String(userObj._id),
  });
  const { password: pass, ...rest } = userObj;

  logger.info(`User logged in: ${email} from ${ipAddress}`);

  return {
    tokens: {
      accessToken: userTokens.accessToken,
      refreshToken: userTokens.refreshToken,
    },
    user: {
      _id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      kycStatus: user.kyc.status,
    },
  };
};

const refreshToken = async (refreshToken: string) => {
  const newAccessToken =
    await createNewAccessTokenWithRefreshToken(refreshToken);

  return {
    accessToken: newAccessToken,
  };
};

const setPassword = async (userId: string, plainPassword: string) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (
    user.password &&
    user.auths.some((providerObject) => providerObject.provider === "google")
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You have already set you password. Now you can change the password from your profile password update",
    );
  }

  const credentialProvider: IAuthProvider = {
    provider: "credentials",
    providerId: user.email,
  };

  // Password hashing is handled by the User model pre-save hook.
  user.password = plainPassword;

  const hasCredentialAuth = user.auths.some(
    (providerObject) => providerObject.provider === "credentials",
  );

  if (!hasCredentialAuth) {
    user.auths = [...user.auths, credentialProvider] as any;
  }

  await user.save();
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────

const forgotPassword = async (email: string): Promise<{ message: string }> => {
  const user = await User.findOne({ email, isDeleted: false });

  // ALWAYS return the same message — prevents email enumeration
  // (attacker cannot determine whether an email is registered)
  const genericMessage =
    "If an account with that email exists, a password reset code has been sent.";

  if (!user) {
    // Simulate processing delay to prevent timing attacks
    await new Promise((r) => setTimeout(r, 500));
    return { message: genericMessage };
  }

  // Generate OTP and queue email
  const otpCode = await generateAndStoreOtp(
    String(user._id),
    user.email,
    OtpPurpose.PASSWORD_RESET,
  );

  await emailQueue.add(
    "sendPasswordResetEmail",
    {
      to: user.email,
      fullName: user.fullName,
      otpCode,
    },
    { attempts: 3, backoff: { type: "exponential", delay: 2_000 } },
  );

  logger.info(`Password reset OTP sent to: ${email}`);
  return { message: genericMessage };
};

// ─── RESET PASSWORD ───────────────────────────────────────────────
export const resetPassword = async (
  email: string,
  code: string,
  newPassword: string,
): Promise<{ message: string }> => {
  // 1. Find user
  const user = await User.findOne({ email, isDeleted: false }).select(
    "+password",
  );
  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid email or OTP.");
  }

  // 2. Verify OTP
  await verifyOtpCode(email, code, OtpPurpose.PASSWORD_RESET);

  // 3. Prevent reuse of the same password
  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "New password must be different from your current password.",
    );
  }

  // 4. Update password (pre-save hook in user.model.ts will hash it)
  user.password = newPassword;
  await user.save();

  // 5. Revoke ALL active sessions — force re-login with new password
  const pattern = `rt:${String(user._id)}:*`;
  const allKeys = await redis.keys(pattern);
  if (allKeys.length > 0) await redis.del(...allKeys);

  // 6. Notify user of the password change
  await emailQueue.add("sendPasswordChangedEmail", {
    to: user.email,
    fullName: user.fullName,
  });

  logger.info(`Password reset completed for: ${email}`);
  return {
    message:
      "Password reset successfully. Please log in with your new password.",
  };
};

// ─── RESEND OTP ───────────────────────────────────────────────────
const resendOtp = async (
  email: string,
  purpose: OtpPurpose.EMAIL_VERIFY | OtpPurpose.PASSWORD_RESET,
): Promise<{ message: string }> => {
  const user = await User.findOne({ email, isDeleted: false });

  if (!user) {
    // Generic message — no enumeration
    return {
      message: "If that email is registered, a new OTP has been sent.",
    };
  }

  if (purpose === OtpPurpose.EMAIL_VERIFY && user.isEmailVerified) {
    return { message: "Email is already verified." };
  }

  const otpCode = await generateAndStoreOtp(
    String(user._id),
    user.email,
    purpose,
  );

  const jobName =
    purpose === OtpPurpose.EMAIL_VERIFY
      ? "sendVerificationEmail"
      : "sendPasswordResetEmail";

  await emailQueue.add(
    jobName,
    { to: user.email, fullName: user.fullName, otpCode },
    { attempts: 3 },
  );

  return { message: "A new OTP has been sent to your email." };
};

const logout = async (
  accessToken: string,
  refreshToken: string | undefined,
  userId: string,
): Promise<void> => {
  // 1. Blacklist the access token for its remaining TTL
  //    Prevents using the access token after logout until it naturally expires
  const tokenHash = crypto
    .createHash("sha256")
    .update(accessToken)
    .digest("hex");

  const decoded = jwt.decode(accessToken) as { exp: number } | null;
  if (decoded?.exp) {
    const remainingTTL = decoded.exp - Math.floor(Date.now() / 1000);
    if (remainingTTL > 0) {
      await redis.setex(
        CONSTANTS.REDIS_KEYS.BLACKLIST(tokenHash),
        remainingTTL,
        "1",
      );
    }
  }

  // 2. Revoke the refresh token (if provided)
  if (refreshToken) {
    try {
      const decodedRefresh = jwt.decode(refreshToken) as {
        sub: string;
        jti: string;
      } | null;

      if (decodedRefresh?.jti) {
        await redis.del(
          CONSTANTS.REDIS_KEYS.REFRESH_TOKEN(userId, decodedRefresh.jti),
        );
      }
    } catch {
      // If refresh token is malformed — still proceed with logout
      logger.warn(
        `Could not decode refresh token during logout for user ${userId}`,
      );
    }
  }

  logger.info(`User logged out: ${userId}`);
};

// ─── LOGOUT ALL DEVICES ───────────────────────────────────────────
const logoutAllDevices = async (
  accessToken: string,
  userId: string,
): Promise<void> => {
  // Blacklist current access token
  const tokenHash = crypto
    .createHash("sha256")
    .update(accessToken)
    .digest("hex");
  const decoded = jwt.decode(accessToken) as { exp: number } | null;

  if (decoded?.exp) {
    const remainingTTL = decoded.exp - Math.floor(Date.now() / 1000);
    if (remainingTTL > 0) {
      await redis.setex(
        CONSTANTS.REDIS_KEYS.BLACKLIST(tokenHash),
        remainingTTL,
        "1",
      );
    }
  }

  // Delete ALL refresh tokens for this user
  const pattern = `rt:${userId}:*`;
  const allKeys = await redis.keys(pattern);
  if (allKeys.length > 0) {
    await redis.del(...allKeys);
  }

  logger.info(`All sessions revoked for user: ${userId}`);
};

export const AuthServices = {
  register,
  login,
  forgotPassword,
  resetPassword,
  resendOtp,
  refreshToken,
  setPassword,
  verifyEmail,
  logout,
  logoutAllDevices,
};
