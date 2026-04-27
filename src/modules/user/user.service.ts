import { deleteImageFromCLoudinary } from "@config/cloudinary.config";
import logger from "@config/logger.config";
import { emailQueue } from "@jobs/queue.config";
import { Wallet } from "@modules/wallet/wallet.model";
import httpStatus from "http-status-codes";
import { HydratedDocument } from "mongoose";
import AppError from "src/errorHelpers/AppError";
import { User } from "../auth/auth.model";
import {
  ChangePinDTO,
  IUser,
  SetPinDTO,
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

export const UserServices = {
  getProfile,
  updateProfile,
  uploadAvatar,
  requestAccountDeletion,
  setPin,
  changePin,
};
