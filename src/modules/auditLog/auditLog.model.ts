import mongoose, { Document, Schema } from "mongoose";

export type AuditAction =
  // Auth actions
  | "USER_REGISTER"
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "PASSWORD_RESET"
  | "PIN_CHANGED"
  | "TWO_FACTOR_ENABLED"
  // Transaction actions
  | "TRANSACTION_CREATED"
  | "TRANSACTION_COMPLETED"
  | "TRANSACTION_FAILED"
  | "TRANSACTION_REVERSED"
  // Wallet actions
  | "WALLET_TOPUP"
  | "WALLET_WITHDRAW"
  | "WALLET_FROZEN"
  // Admin actions
  | "USER_BANNED"
  | "USER_UNBANNED"
  | "KYC_APPROVED"
  | "KYC_REJECTED"
  | "TRANSACTION_FLAGGED";

export interface IAuditLog extends Document {
  actorId: mongoose.Types.ObjectId; // Who did it
  actorRole: string;
  action: AuditAction;
  targetType: "User" | "Wallet" | "Transaction" | "System";
  targetId?: mongoose.Types.ObjectId;
  description: string; // Human-readable summary
  ipAddress: string;
  userAgent: string;
  before?: Record<string, unknown>; // State before action
  after?: Record<string, unknown>; // State after action
  metadata?: Record<string, unknown>;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true },
    targetType: {
      type: String,
      enum: ["User", "Wallet", "Transaction", "System"],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId },
    description: { type: String, required: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    // ← No updatedAt needed. Audit logs are write-once.
    // Enforce at DB level with MongoDB change streams or app-level convention.
  },
);

// ─── Indexes ──────────────────────────────────────────────────────

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, createdAt: -1 });
// TTL index: auto-delete logs older than 2 years (regulatory minimum)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63_072_000 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
