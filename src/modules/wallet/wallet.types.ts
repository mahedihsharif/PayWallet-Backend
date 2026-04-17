import mongoose, { Document } from "mongoose";

export enum WalletStatus {
  ACTIVE = "ACTIVE",
  FROZEN = "FROZEN",
}

interface ISpendingLimitUsage {
  daily: number; // Paisa spent today
  weekly: number; // Paisa spent this week
  monthly: number; // Paisa spent this month
  lastResetDaily: Date;
  lastResetWeekly: Date;
  lastResetMonthly: Date;
}

export interface IWallet extends Document {
  walletId: string; // Human-readable: WLT-XXXXXXXX (not the MongoDB _id)
  userId: mongoose.Types.ObjectId;
  balance: number; // In paisa (NEVER float)
  currency: string; // 'BDT', 'USD', etc.
  status: WalletStatus;
  limits: {
    dailyDebit: number; // Max paisa per day
    weeklyDebit: number;
    monthlyDebit: number;
    singleTransactionMax: number;
    singleTransactionMin: number;
  };
  usage: ISpendingLimitUsage;
  isDeleted: boolean;
}
