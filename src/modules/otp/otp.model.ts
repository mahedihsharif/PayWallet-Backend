import mongoose, { Schema } from "mongoose";
import { IOtp, OtpPurpose } from "./otp.types";

const otpSchema = new Schema<IOtp>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    code: {
      type: String,
      required: true,
      select: false, // Never return OTP hash in queries
    },
    purpose: {
      type: String,
      enum: Object.values(OtpPurpose),
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      max: [5, "Maximum OTP attempts exceeded"],
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  },
  { timestamps: true },
);

// ─── TTL Index — MongoDB auto-deletes expired OTPs ───────────────
// This is more reliable than a cron job. MongoDB checks every 60 seconds.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ userId: 1, purpose: 1 });

export const Otp = mongoose.model<IOtp>("Otp", otpSchema);
