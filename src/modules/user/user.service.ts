import { deleteImageFromCLoudinary } from "@config/cloudinary.config";
import logger from "@config/logger.config";
import httpStatus from "http-status-codes";
import { HydratedDocument } from "mongoose";
import AppError from "src/errorHelpers/AppError";
import { User } from "../auth/auth.model";
import { IUser, UpdateProfileDTO, UserProfileResponse } from "./user.types";

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

export const UserServices = { getProfile, updateProfile, uploadAvatar };
