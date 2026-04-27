import { IUser, Role, UserStatus } from "@modules/user/user.types";
import bcrypt from "bcrypt";
import mongoose, { Schema } from "mongoose";
import { env } from "node:process";
import { IAuthProvider } from "./auth.types";

const authProviderSchema = new Schema<IAuthProvider>(
  {
    provider: { type: String, required: true },
    providerId: { type: String, required: true },
  },
  { versionKey: false, _id: false },
);

// ─── Schema definition ────────────────────────────────────────────

const userSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    phone: {
      type: String,
      required: function (this: any) {
        return !this.auths?.some((a: IAuthProvider) => a.provider === "google");
      },
      unique: true,
      trim: true,
      // Bangladesh phone: 01XXXXXXXXX (11 digits)
      match: [/^01[3-9]\d{8}$/, "Please provide a valid BD phone number"],
    },
    password: {
      type: String,
      required: function (this: any) {
        return !this.auths?.some((a: IAuthProvider) => a.provider === "google");
      },
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // ← CRITICAL: never returned in queries by default
    },
    pin: {
      type: String,
      select: false, // ← Never returned in queries
    },
    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.USER,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },
    auths: [authProviderSchema],
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    kyc: {
      status: {
        type: String,
        enum: ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"],
        default: "UNVERIFIED",
      },
      documentType: {
        type: String,
        enum: ["NID", "PASSPORT", "DRIVING_LICENSE"],
      },
      documentUrl: String,
      selfieUrl: String,
      submittedAt: Date,
      reviewedAt: Date,
      reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
      rejectionReason: String,
    },
    devices: [
      {
        deviceId: { type: String },
        deviceName: { type: String },
        ipAddress: { type: String, required: true },
        lastUsed: { type: Date, default: Date.now },
        isTrusted: { type: Boolean, default: false },
      },
    ],
    limits: {
      // Unverified users: ৳5,000/day = 500,000 paisa
      // Verified users:  ৳50,000/day = 5,000,000 paisa
      dailyLimit: { type: Number, default: 500_000 },
      monthlyLimit: { type: Number, default: 5_000_000 },
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    isTwoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true, // auto-adds createdAt, updatedAt
    // When converting to JSON (API responses), remove sensitive fields
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as Partial<IUser>).password;
        delete (ret as Partial<IUser>).pin;
        delete (ret as Partial<IUser>).twoFactorSecret;
        delete (ret as any).__v;
        return ret;
      },
    },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────
// email and phone are already indexed via unique: true
// Additional indexes for common query patterns:

userSchema.index({ "kyc.status": 1 }); // Admin KYC queue
userSchema.index({ role: 1, status: 1 }); // Admin user management
userSchema.index({ isDeleted: 1 }); // Filter soft-deleted
userSchema.index({ createdAt: -1 }); // Sort newest first

// ─── Instance methods ─────────────────────────────────────────────
userSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.comparePin = async function (
  candidate: string,
): Promise<boolean> {
  if (!this.pin) return false;
  return bcrypt.compare(candidate, this.pin);
};

// ─── Pre-save hook — hash password before saving ──────────────────

userSchema.pre("save", async function () {
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(
      this.password,
      parseInt(env.BCRYPT_SALT_ROUNDS || "12"),
    );
  }

  if (this.isModified("pin") && this.pin) {
    this.pin = await bcrypt.hash(
      this.pin,
      parseInt(env.BCRYPT_SALT_ROUNDS || "12"),
    );
  }
});

export const User = mongoose.model<IUser>("User", userSchema);
