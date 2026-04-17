import logger from "@config/logger.config";
import redis from "@config/redis.config";
import eventBus from "@events/eventBus";
import { emailQueue } from "@jobs/queue.config";
import { generateAndStoreOtp, verifyOtpCode } from "@modules/otp/otp.service";
import { OtpPurpose } from "@modules/otp/otp.types";
import { UserStatus } from "@modules/user/user.types";
import { CONSTANTS } from "@utils/constants";
import { createUserTokens } from "@utils/userTokens";
import bcrypt from "bcrypt";
import httpStatus from "http-status-codes";
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
    const remaining = 5 - newCount;
    if (remaining > 0 && remaining <= 2) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        `Invalid email or password. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lockout.`,
      );
    }

    throw unauthorized("Invalid email or password.");
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
  const knownDevice = user.devices.find((d) => d.deviceId === deviceId);

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

  const hashedPassword = await bcrypt.hash(
    plainPassword,
    Number(env.BCRYPT_SALT_ROUND),
  );

  const credentialProvider: IAuthProvider = {
    provider: "credentials",
    providerId: user.email,
  };

  user.password = hashedPassword;
  user.auths = [...user.auths, credentialProvider] as any;
  await user.save();
};

export const AuthServices = { register, login, setPassword, verifyEmail };
function unauthorized(arg0: string) {
  throw new Error("Function not implemented.");
}
