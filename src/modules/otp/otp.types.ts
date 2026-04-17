import mongoose, { Document } from "mongoose";

export enum OtpPurpose {
  EMAIL_VERIFY = "EMAIL_VERIFY",
  PASSWORD_RESET = "PASSWORD_RESET",
  TWO_FACTOR = "TWO_FACTOR",
}

export interface IOtp extends Document {
  userId: mongoose.Types.ObjectId;
  email: string;
  code: string; // bcrypt hash of the 6-digit code
  purpose: OtpPurpose;
  attempts: number; // Wrong guess counter
  isUsed: boolean;
  expiresAt: Date;
  // Instance methods
  compareCode(candidate: string): Promise<boolean>;
}
