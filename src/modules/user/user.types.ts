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
  // Methods
  comparePassword(candidate: string): Promise<boolean>;
  comparePin(candidate: string): Promise<boolean>;
}
