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

// ─── Request DTOs ─────────────────────────────────────────────────
export interface TopUpInitiateDTO {
  amount: number; // Paisa (integer)
  currency?: string; // Default: 'BDT'
}

export interface WithdrawDTO {
  amount: number; // Paisa
  bankAccountName: string;
  bankAccountNo: string;
  bankName: string;
  routingNumber?: string;
  pin: string; // Transaction PIN confirmation
}

export interface UpdateLimitsDTO {
  dailyDebit?: number;
  weeklyDebit?: number;
  monthlyDebit?: number;
  singleTransactionMax?: number;
}

// ─── SSLCommerz webhook payload ───────────────────────────────────

export interface SSLCommerzWebhookDTO {
  status: string; // 'VALID' | 'VALIDATED' | 'INVALID' | 'FAILED'
  tran_id: string; // Our transaction ID stored as reference
  val_id: string; // SSLCommerz validation ID
  amount: string; // String from gateway
  currency: string;
  store_id: string;
  store_passwd: string;
  verify_sign: string;
  verify_key: string;
  card_type?: string;
  card_no?: string;
  [key: string]: unknown; // Gateway sends many extra fields
}

// ─── Response shapes ──────────────────────────────────────────────

export interface WalletResponse {
  _id: string;
  walletId: string;
  userId: string;
  balance: number; // Raw paisa
  balanceFormatted: string; // '৳500.00'
  currency: string;
  status: string;
  limits: WalletLimits;
  usage: WalletUsage;
  createdAt: Date;
}

export interface WalletLimits {
  dailyDebit: number;
  weeklyDebit: number;
  monthlyDebit: number;
  singleTransactionMax: number;
  singleTransactionMin: number;
}

export interface WalletUsage {
  daily: number;
  weekly: number;
  monthly: number;
}

export interface TopUpInitiateResponse {
  paymentUrl: string; // Redirect user to this URL
  transactionId: string; // Our pending transaction ID
  amount: number;
  currency: string;
}

export interface BalanceResponse {
  balance: number;
  balanceFormatted: string;
  currency: string;
  lastUpdated: string;
  fromCache: boolean; // Useful for debugging
}
