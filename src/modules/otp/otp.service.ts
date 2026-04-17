import env from "@config/env.config";
import { CONSTANTS } from "@utils/constants";
import bcrypt from "bcrypt";
import crypto from "crypto";
import httpStatus from "http-status-codes";
import AppError from "src/errorHelpers/AppError";
import { Otp } from "./otp.model";
import { IOtp, OtpPurpose } from "./otp.types";

// Generate, hash, and store a 6-digit OTP
export const generateAndStoreOtp = async (
  userId: string,
  email: string,
  purpose:
    | OtpPurpose.EMAIL_VERIFY
    | OtpPurpose.PASSWORD_RESET
    | OtpPurpose.TWO_FACTOR,
): Promise<string> => {
  // Delete any existing OTP for this user+purpose (only one active at a time)
  await Otp.deleteMany({ userId, purpose });

  // Generate cryptographically secure 6-digit OTP
  // crypto.randomInt is safer than Math.random() for security-sensitive values
  const plainCode = String(crypto.randomInt(100_000, 999_999));

  // Hash the OTP before storing (same principle as passwords)
  const hashedCode = await bcrypt.hash(plainCode, env.BCRYPT_SALT_ROUND);
  // Note: rounds=10 for OTP (not 12) — OTPs expire in 10 min and have
  // attempt limits, so the extra cost of 12 rounds isn't worth the UX hit.

  await Otp.create({
    userId,
    email,
    code: hashedCode,
    purpose,
    expiresAt: new Date(Date.now() + CONSTANTS.OTP_TTL * 1000),
  });

  return plainCode; // Return plaintext — this goes into the email
};

// Verify an OTP code
export const verifyOtpCode = async (
  email: string,
  candidateCode: string,
  purpose:
    | OtpPurpose.EMAIL_VERIFY
    | OtpPurpose.PASSWORD_RESET
    | OtpPurpose.TWO_FACTOR,
): Promise<IOtp> => {
  // Fetch OTP with code field (select: false by default)
  const otp = await Otp.findOne({ email, purpose, isUsed: false })
    .sort({ createdAt: -1 }) // Most recent OTP if multiple exist
    .select("+code");

  if (!otp) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "OTP not found or has already been used.",
    );
  }

  if (new Date() > otp.expiresAt) {
    await otp.deleteOne();
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "OTP has expired. Please request a new one.",
    );
  }

  if (otp.attempts >= CONSTANTS.OTP_MAX_ATTEMPTS) {
    await otp.deleteOne();
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Maximum OTP attempts exceeded. Please request a new OTP.",
    );
  }

  const isMatch = await bcrypt.compare(candidateCode, otp.code);

  if (!isMatch) {
    // Increment attempt counter — do NOT delete the OTP yet
    otp.attempts += 1;
    await otp.save();
    const remaining = CONSTANTS.OTP_MAX_ATTEMPTS - otp.attempts;
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
    );
  }

  // Mark as used — prevents replay attacks
  otp.isUsed = true;
  await otp.save();

  return otp;
};
