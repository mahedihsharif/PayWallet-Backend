import mongoose, { Document, Schema } from "mongoose";

export type NotifType =
  | "TRANSACTION_SENT"
  | "TRANSACTION_RECEIVED"
  | "TOPUP_SUCCESS"
  | "TOPUP_FAILED"
  | "WITHDRAWAL_SUCCESS"
  | "LOGIN_NEW_DEVICE"
  | "KYC_APPROVED"
  | "KYC_REJECTED"
  | "ACCOUNT_SUSPENDED"
  | "SYSTEM";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotifType;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: Date;
  data?: Record<string, unknown>; // e.g., { transactionId: 'TXN-XXXX', amount: 5000 }
  isDeleted: boolean;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "TRANSACTION_SENT",
        "TRANSACTION_RECEIVED",
        "TOPUP_SUCCESS",
        "TOPUP_FAILED",
        "WITHDRAWAL_SUCCESS",
        "LOGIN_NEW_DEVICE",
        "KYC_APPROVED",
        "KYC_REJECTED",
        "ACCOUNT_SUSPENDED",
        "SYSTEM",
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 100 },
    message: { type: String, required: true, maxlength: 500 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    data: { type: Schema.Types.Mixed, default: {} },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────

// Notification bell: unread count for a user
notificationSchema.index({ userId: 1, isRead: 1 });

// Notification list: user's notifications, newest first
notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema,
);
