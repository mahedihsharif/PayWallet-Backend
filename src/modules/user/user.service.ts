import { deleteImageFromCLoudinary } from "@config/cloudinary.config";
import logger from "@config/logger.config";
import eventBus from "@events/eventBus";
import { emailQueue } from "@jobs/queue.config";
import { AuditLog } from "@modules/auditLog/auditLog.model";
import { Wallet } from "@modules/wallet/wallet.model";
import { CONSTANTS } from "@utils/constants";
import { decrypt, encrypt } from "@utils/crypto";
import httpStatus from "http-status-codes";
import { HydratedDocument } from "mongoose";
import qrcode from "qrcode";
import speakeasy from "speakeasy";
import AppError from "src/errorHelpers/AppError";
import { User } from "../auth/auth.model";
import {
  ChangePinDTO,
  DeviceResponse,
  IUser,
  SetPinDTO,
  Setup2FAResponse,
  SubmitKycDTO,
  UpdateProfileDTO,
  UserProfileResponse,
  UserStatus,
} from "./user.types";

// ─── Helper: format user for API response ─────────────────────────
const formatUser = (user: HydratedDocument<IUser>): UserProfileResponse => {
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  return {
    _id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl ?? null,
    isEmailVerified: user.isEmailVerified,
    isTwoFactorEnabled: user.isTwoFactorEnabled,
    kyc: {
      status: user.kyc.status,
      documentType: user.kyc.documentType,
      submittedAt: user.kyc.submittedAt,
      reviewedAt: user.kyc.reviewedAt,
      rejectionReason: user.kyc.rejectionReason,
      // Note: documentUrl and selfieUrl are NEVER returned to the client
      // They are only accessible by admins through the admin service
    },
    limits: {
      dailyLimit: user.limits.dailyLimit,
      monthlyLimit: user.limits.monthlyLimit,
    },
    lastLoginAt: user.lastLoginAt,
    lastLoginIp: user.lastLoginIp,
    createdAt: user.createdAt,
  };
};

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// PROFILE
// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───

const getProfile = async (userId: string): Promise<UserProfileResponse> => {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  }
  return formatUser(user);
};

const updateProfile = async (
  userId: string,
  dto: UpdateProfileDTO,
): Promise<UserProfileResponse> => {
  const { fullName, phone } = dto;

  // Check phone uniqueness before updating
  if (phone) {
    const existing = await User.findOne({ phone, _id: { $ne: userId } });
    if (existing) {
      throw new AppError(
        httpStatus.CONFLICT,
        "This phone number is already linked to another account.",
      );
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { ...(fullName && { fullName }), ...(phone && { phone }) } },
    { new: true, runValidators: true },
  );

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  return formatUser(user);
};

// ─── AVATAR UPLOAD ────────────────────────────────────────────────
const uploadAvatar = async (
  userId: string,
  file: Express.Multer.File,
): Promise<{ avatarUrl: string }> => {
  // Delete existing avatar from Cloudinary if present
  const user = await User.findById(userId).select("avatarUrl");
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "user not found!");

  // 1. Delete old avatar (if exists)
  if (user.avatarUrl) {
    try {
      await deleteImageFromCLoudinary(user.avatarUrl);
    } catch {
      logger.warn(`Failed to delete old avatar for user ${userId}`);
    }
  }

  // Upload new avatar
  const avatarUrl = file.path;
  await User.findByIdAndUpdate(userId, { avatarUrl });
  logger.info(`Avatar updated for user ${userId}`);

  return { avatarUrl };
};

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// ACCOUNT MANAGEMENT
// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
const requestAccountDeletion = async (
  userId: string,
  password: string,
): Promise<{ message: string }> => {
  const user = await User.findById(userId).select("+password");
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found.");

  const passwordValid = await user.comparePassword(password);
  if (!passwordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Incorrect password.");
  }

  // Check for non-zero wallet balance
  const wallet = await Wallet.findOne({ userId });
  if (wallet && wallet.balance > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Please withdraw your remaining balance of ৳${(wallet.balance / 100).toFixed(2)} before deleting your account.`,
    );
  }

  // Soft delete — data retained for regulatory compliance (2 years)
  user.isDeleted = true;
  user.deletedAt = new Date();
  user.status = UserStatus.SUSPENDED;
  await user.save();

  if (wallet) {
    wallet.isDeleted = true;
    await wallet.save();
  }

  logger.info(`Account deletion requested and processed for user ${userId}`);
  return {
    message:
      "Your account has been scheduled for deletion. Data will be retained for 2 years per regulatory requirements.",
  };
};

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// PIN MANAGEMENT
// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
const setPin = async (
  userId: string,
  dto: SetPinDTO,
): Promise<{ message: string }> => {
  const { pin, password } = dto;

  // Require password confirmation — proves the real owner is setting the PIN
  const user = await User.findById(userId).select("+password +pin");
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found.");

  const passwordValid = await user.comparePassword(password);
  if (!passwordValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Incorrect account password.");
  }

  if (user.pin) {
    // PIN already set — use changePin endpoint instead
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A PIN is already set. Use the change PIN endpoint to update it.",
    );
  }

  // Prevent obvious PINs
  const obviousPins = [
    "123456",
    "654321",
    "111111",
    "000000",
    "999999",
    "123123",
  ];
  if (obviousPins.includes(pin)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This PIN is too common. Please choose a more secure PIN.",
    );
  }

  // The pre-save hook in user.model.ts hashes the PIN via bcrypt
  user.pin = pin;
  await user.save();

  logger.info(`Transaction PIN set for user ${userId}`);
  return { message: "Transaction PIN set successfully." };
};

const changePin = async (
  userId: string,
  dto: ChangePinDTO,
): Promise<{ message: string }> => {
  const { currentPin, newPin } = dto;

  const user = await User.findById(userId).select("+pin");
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found.");

  if (!user.pin) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "No PIN is set. Use the set PIN endpoint first.",
    );
  }

  const currentPinValid = await user.comparePin(currentPin);
  if (!currentPinValid) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Current PIN is incorrect.");
  }

  if (currentPin === newPin) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "New PIN must be different from your current PIN.",
    );
  }

  const obviousPins = [
    "123456",
    "654321",
    "111111",
    "000000",
    "999999",
    "123123",
  ];
  if (obviousPins.includes(newPin)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This PIN is too common. Please choose a more secure PIN.",
    );
  }

  user.pin = newPin;
  await user.save();

  // Notify user of PIN change
  await emailQueue.add("sendPinChangedEmail", {
    to: user.email,
    fullName: user.fullName,
  });

  logger.info(`Transaction PIN changed for user ${userId}`);
  return { message: "Transaction PIN changed successfully." };
};

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// KYC
// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
const submitKyc = async (
  userId: string,
  dto: SubmitKycDTO,
): Promise<{ message: string; status: string }> => {
  const { documentType, documentUrl, selfieUrl } = dto;

  const user = await User.findById(userId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found.");

  // Only allow submission if unverified or rejected
  if (user.kyc.status === UserStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Your KYC is already under review. Please wait for the outcome.",
    );
  }

  if (user.kyc.status === UserStatus.VERIFIED) {
    throw new AppError(httpStatus.BAD_REQUEST, "Your KYC is already verified.");
  }

  // Update KYC fields
  user.kyc.status = UserStatus.PENDING;
  user.kyc.documentType = documentType;
  user.kyc.documentUrl = documentUrl;
  user.kyc.selfieUrl = selfieUrl;
  user.kyc.submittedAt = new Date();
  user.kyc.rejectionReason = undefined; // Clear any previous rejection
  await user.save();

  // Notify admin team (email to admin)
  await emailQueue.add("sendKycSubmittedAdminAlert", {
    userId: String(user._id),
    fullName: user.fullName,
    email: user.email,
    documentType,
    submittedAt: new Date().toISOString(),
  });

  // Notify user that submission was received
  await emailQueue.add("sendKycSubmittedUserConfirmation", {
    to: user.email,
    fullName: user.fullName,
  });

  eventBus.emit("kyc_submitted", {
    userId: String(user._id),
    email: user.email,
  });

  logger.info(`KYC submitted by user ${userId}`);
  return {
    message:
      "KYC documents submitted successfully. Review typically takes 1-2 business days.",
    status: UserStatus.PENDING,
  };
};

// ─── Admin: approve or reject KYC ────────────────────────────────
const reviewKyc = async (
  targetUserId: string,
  action: UserStatus.APPROVED | UserStatus.REJECTED,
  adminId: string,
  rejectionReason?: string,
): Promise<{ message: string }> => {
  const user = await User.findById(targetUserId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  if (user.kyc.status !== UserStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot review KYC that is in '${user.kyc.status}' status. Only 'pending' submissions can be reviewed.`,
    );
  }

  if (action === UserStatus.APPROVED) {
    user.kyc.status = UserStatus.VERIFIED;
    user.kyc.reviewedAt = new Date();
    user.kyc.reviewedBy = adminId as unknown as typeof user.kyc.reviewedBy;

    // Upgrade wallet limits on KYC approval
    await Wallet.findOneAndUpdate(
      { userId: targetUserId },
      {
        $set: {
          "limits.dailyDebit": CONSTANTS.VERIFIED_DAILY_LIMIT,
          "limits.weeklyDebit": CONSTANTS.VERIFIED_DAILY_LIMIT * 5,
          "limits.monthlyDebit": CONSTANTS.VERIFIED_DAILY_LIMIT * 15,
          "limits.singleTransactionMax": CONSTANTS.VERIFIED_DAILY_LIMIT,
        },
      },
    );

    // Also update user-level limits
    user.limits.dailyLimit = CONSTANTS.VERIFIED_DAILY_LIMIT;
    user.limits.monthlyLimit = CONSTANTS.VERIFIED_DAILY_LIMIT * 15;

    await emailQueue.add("sendKycApprovedEmail", {
      to: user.email,
      fullName: user.fullName,
    });
  } else {
    if (!rejectionReason) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Rejection reason is required.",
      );
    }
    user.kyc.status = UserStatus.REJECTED;
    user.kyc.reviewedAt = new Date();
    user.kyc.reviewedBy = adminId as unknown as typeof user.kyc.reviewedBy;
    user.kyc.rejectionReason = rejectionReason;

    await emailQueue.add("sendKycRejectedEmail", {
      to: user.email,
      fullName: user.fullName,
      rejectionReason,
    });
  }

  await user.save();

  // Audit log
  await AuditLog.create({
    actorId: adminId,
    actorRole: "ADMIN",
    action: action === UserStatus.APPROVED ? "KYC_APPROVED" : "KYC_REJECTED",
    targetType: "User",
    targetId: targetUserId,
    description: `KYC ${action}d for user ${user.email}`,
    ipAddress: "admin-action",
    userAgent: "admin-panel",
    after: { kycStatus: user.kyc.status, rejectionReason },
  });

  logger.info(`KYC ${action}d for user ${targetUserId} by admin ${adminId}`);
  return { message: `KYC ${action}d successfully.` };
};

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// TWO-FACTOR AUTHENTICATION
// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
const setup2FA = async (userId: string): Promise<Setup2FAResponse> => {
  const user = await User.findById(userId).select("email isTwoFactorEnabled");
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  if (user.isTwoFactorEnabled) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "2FA is already enabled on your account.",
    );
  }

  // Generate a TOTP secret
  const secret = speakeasy.generateSecret({
    name: `PayWallet (${user.email})`,
    issuer: "PayWallet",
    length: 20,
  });

  // Generate QR code as base64 data URL
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

  // Generate one-time backup codes
  const backupCodes = Array.from(
    { length: 8 },
    () =>
      `${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  );

  // Store encrypted secret temporarily (user must verify before enabling)
  // We store it but set isTwoFactorEnabled = false until verified
  await User.findByIdAndUpdate(userId, {
    twoFactorSecret: encrypt(secret.base32),
    isTwoFactorEnabled: false,
  });

  return {
    secret: secret.base32,
    qrCodeUrl,
    backupCodes,
  };
};

const enable2FA = async (
  userId: string,
  token: string,
): Promise<{ message: string }> => {
  const user = await User.findById(userId).select(
    "+twoFactorSecret isTwoFactorEnabled",
  );
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  if (user.isTwoFactorEnabled) {
    throw new AppError(httpStatus.BAD_REQUEST, "2FA is already enabled.");
  }

  if (!user.twoFactorSecret) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Please call /2fa/setup first to generate a secret.",
    );
  }

  // Decrypt and verify the TOTP token
  const secret = decrypt(user.twoFactorSecret).trim();
  const isValid = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1, // ±30 seconds clock drift
  });

  if (!isValid) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid verification code. Please check your authenticator app and try again.",
    );
  }

  await User.findByIdAndUpdate(userId, { isTwoFactorEnabled: true });

  await emailQueue.add("send2FAEnabledEmail", {
    to: user.email,
    fullName: user.fullName,
  });

  logger.info(`2FA enabled for user ${userId}`);
  return {
    message: "2FA has been enabled successfully. Keep your backup codes safe.",
  };
};

const disable2FA = async (
  userId: string,
  token: string,
): Promise<{ message: string }> => {
  const user = await User.findById(userId).select(
    "+twoFactorSecret isTwoFactorEnabled",
  );
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  if (!user.isTwoFactorEnabled) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "2FA is not enabled on your account.",
    );
  }

  const secret = decrypt(user.twoFactorSecret!).trim();
  const isValid = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1,
  });

  if (!isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid verification code.");
  }

  await User.findByIdAndUpdate(userId, {
    isTwoFactorEnabled: false,
    $unset: { twoFactorSecret: 1 },
  });

  await emailQueue.add("send2FADisabledEmail", {
    to: user.email,
    fullName: user.fullName,
  });

  logger.info(`2FA disabled for user ${userId}`);
  return { message: "2FA has been disabled." };
};

// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
// DEVICE MANAGEMENT
// ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ─── ───
const getDevices = async (userId: string): Promise<DeviceResponse[]> => {
  const user = await User.findById(userId).select("devices");
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  return user.devices.map((d) => ({
    deviceId: d.deviceId,
    deviceName: d.deviceName,
    ipAddress: d.ipAddress,
    lastUsed: d.lastUsed,
    isTrusted: d.isTrusted,
  }));
};

const removeDevice = async (
  userId: string,
  deviceId: string,
): Promise<{ message: string }> => {
  const user = await User.findById(userId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const deviceIndex = user.devices.findIndex((d) => d.deviceId === deviceId);
  if (deviceIndex === -1)
    throw new AppError(httpStatus.NOT_FOUND, "Device not found");

  user.devices.splice(deviceIndex, 1);
  await user.save();

  return { message: "Device removed successfully." };
};

const trustDevice = async (
  userId: string,
  deviceId: string,
): Promise<{ message: string }> => {
  const result = await User.findOneAndUpdate(
    { _id: userId, "devices.deviceId": deviceId },
    { $set: { "devices.$.isTrusted": true } },
  );

  if (!result) throw new AppError(httpStatus.NOT_FOUND, "Device not found");
  return { message: "Device marked as trusted." };
};

// ─── Admin: get all users ─────────────────────────────────────────
const getAllUsers = async (filters: {
  page: number;
  limit: number;
  status?: string;
  kycStatus?: string;
  role?: string;
  search?: string;
}): Promise<{ users: UserProfileResponse[]; total: number }> => {
  const { page, limit, status, kycStatus, role, search } = filters;

  const query: Record<string, unknown> = { isDeleted: false };
  if (status) query.status = status;
  if (kycStatus) query["kyc.status"] = kycStatus;
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    users: users.map((u) => ({
      _id: String(u._id),
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      avatarUrl: u.avatarUrl ?? null,
      isEmailVerified: u.isEmailVerified,
      isTwoFactorEnabled: u.isTwoFactorEnabled,
      kyc: {
        status: u.kyc.status,
        documentType: u.kyc.documentType,
        submittedAt: u.kyc.submittedAt,
        reviewedAt: u.kyc.reviewedAt,
        rejectionReason: u.kyc.rejectionReason,
      },
      limits: u.limits,
      lastLoginAt: u.lastLoginAt,
      lastLoginIp: u.lastLoginIp,
      createdAt: u.createdAt,
    })),
    total,
  };
};

// ─── Admin: ban / unban user ──────────────────────────────────────
const setUserStatus = async (
  targetUserId: string,
  status: UserStatus.ACTIVE | UserStatus.SUSPENDED | UserStatus.BANNED,
  adminId: string,
): Promise<{ message: string }> => {
  const user = await User.findByIdAndUpdate(
    targetUserId,
    { status },
    { new: true },
  );

  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  await AuditLog.create({
    actorId: adminId,
    actorRole: "ADMIN",
    action: status === UserStatus.BANNED ? "USER_BANNED" : "USER_UNBANNED",
    targetType: "User",
    targetId: targetUserId,
    description: `User ${user.email} ${status}`,
    ipAddress: "admin-action",
    userAgent: "admin-panel",
  });

  if (status === UserStatus.BANNED) {
    await emailQueue.add("sendAccountBannedEmail", {
      to: user.email,
      fullName: user.fullName,
    });
  }

  logger.info(
    `User ${targetUserId} status set to ${status} by admin ${adminId}`,
  );
  return { message: `User account ${status} successfully.` };
};

export const UserServices = {
  getProfile,
  updateProfile,
  uploadAvatar,
  requestAccountDeletion,
  setPin,
  changePin,
  submitKyc,
  setup2FA,
  enable2FA,
  disable2FA,
  getDevices,
  removeDevice,
  trustDevice,
  getAllUsers,
  setUserStatus,
  reviewKyc,
};
