import { IAuthProvider } from "@modules/auth/auth.types";
import mongoose, { Document } from "mongoose";

export interface IKyc {
  status: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  documentType?: "NID" | "PASSPORT" | "DRIVING_LICENSE";
  documentUrl?: string; // Cloudinary/S3 URL — never the file itself
  selfieUrl?: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId; // Admin user ID
  rejectionReason?: string;
}

export interface IDevice {
  deviceId: string; // UUID generated on client
  deviceName: string; // "Chrome on Windows", "iPhone 14"
  ipAddress: string;
  lastUsed: Date;
  isTrusted: boolean;
}

export interface ILimits {
  dailyLimit: number; // In paisa
  monthlyLimit: number; // In paisa
}

export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  BANNED = "BANNED",
}
// ─── Main document type ───────────────────────────────────────────

export interface IUser extends Document {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  pin?: string; // Hashed 4-6 digit transaction PIN
  role: Role;
  auths: IAuthProvider[];
  status: UserStatus;
  isEmailVerified: boolean;
  avatarUrl?: string;
  kyc: IKyc;
  devices: IDevice[];
  limits: ILimits;
  twoFactorSecret?: string; // TOTP secret (encrypted at rest)
  isTwoFactorEnabled: boolean;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Methods
  comparePassword(candidate: string): Promise<boolean>;
  comparePin(candidate: string): Promise<boolean>;
}

// ─── Request DTOs ─────────────────────────────────────────────────

export interface UpdateProfileDTO {
  fullName?: string;
  phone?: string;
}

export interface SetPinDTO {
  pin: string;
  confirmPin: string;
  password: string; // Require password confirmation to set/change PIN
}

export interface ChangePinDTO {
  currentPin: string;
  newPin: string;
  confirmPin: string;
}

export interface SubmitKycDTO {
  documentType: "NID" | "PASSPORT" | "DRIVING_LICENSE";
  documentUrl: string; // Cloudinary URL — uploaded by frontend first
  selfieUrl: string; // Cloudinary URL
}

export interface Enable2FADTO {
  token: string; // 6-digit TOTP token from authenticator app
}

export interface Verify2FADTO {
  token: string;
}

export interface UpdatePreferencesDTO {
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  transactionAlerts?: boolean;
  loginAlerts?: boolean;
  marketingCommunications?: boolean;
}

// ─── Response shapes ──────────────────────────────────────────────

export interface UserProfileResponse {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  isTwoFactorEnabled: boolean;
  kyc: {
    status: string;
    documentType?: string;
    submittedAt?: Date;
    reviewedAt?: Date;
    rejectionReason?: string;
  };
  limits: {
    dailyLimit: number;
    monthlyLimit: number;
  };
  lastLoginAt?: Date;
  lastLoginIp?: string;
  createdAt: Date;
}

export interface DeviceResponse {
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  lastUsed: Date;
  isTrusted: boolean;
}

export interface Setup2FAResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}
