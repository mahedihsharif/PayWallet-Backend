import mongoose, { Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { IWallet, WalletStatus } from "./wallet.types";

const walletSchema = new Schema<IWallet>(
  {
    walletId: {
      type: String,
      unique: true,
      default: () => `WLT-${uuidv4().slice(0, 8).toUpperCase()}`,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One wallet per user (v1)
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, "Balance cannot be negative"], // DB-level guard
    },
    currency: {
      type: String,
      default: "BDT",
      uppercase: true,
      enum: ["BDT", "USD", "EUR"], // Extend as needed
    },
    status: {
      type: String,
      enum: Object.values(WalletStatus),
      default: WalletStatus.ACTIVE,
    },
    limits: {
      dailyDebit: { type: Number, default: 5_000_000 }, // ৳50,000
      weeklyDebit: { type: Number, default: 15_000_000 }, // ৳150,000
      monthlyDebit: { type: Number, default: 50_000_000 }, // ৳500,000
      singleTransactionMax: { type: Number, default: 5_000_000 }, // ৳50,000
      singleTransactionMin: { type: Number, default: 100 }, // ৳1
    },
    usage: {
      daily: { type: Number, default: 0 },
      weekly: { type: Number, default: 0 },
      monthly: { type: Number, default: 0 },
      lastResetDaily: { type: Date, default: Date.now },
      lastResetWeekly: { type: Date, default: Date.now },
      lastResetMonthly: { type: Date, default: Date.now },
    },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const obj = ret as Record<string, any>;
        delete obj.__v;
        // Convert paisa to taka for API responses
        obj.balanceFormatted = `৳${(obj.balance / 100).toFixed(2)}`;
        return obj;
      },
    },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────

walletSchema.index({ status: 1 }); // Admin: filter by status

export const Wallet = mongoose.model<IWallet>("Wallet", walletSchema);
