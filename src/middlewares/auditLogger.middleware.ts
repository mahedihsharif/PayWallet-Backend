import { AuditAction, AuditLog } from "@modules/auditLog/auditLog.model";
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status-codes";
import mongoose from "mongoose";
import logger from "../config/logger.config";

// ─── The sensitive actions that ALWAYS get logged ─────────────────
const AUDITED_ROUTES: Array<{
  method: string;
  pathPattern: RegExp;
  action: AuditAction;
  targetType: "User" | "Wallet" | "Transaction" | "System";
}> = [
  {
    method: "POST",
    pathPattern: /\/auth\/login/,
    action: "USER_LOGIN",
    targetType: "User",
  },
  {
    method: "POST",
    pathPattern: /\/auth\/logout/,
    action: "USER_LOGOUT",
    targetType: "User",
  },
  {
    method: "POST",
    pathPattern: /\/auth\/reset-password/,
    action: "PASSWORD_RESET",
    targetType: "User",
  },
  {
    method: "POST",
    pathPattern: /\/transactions\/send/,
    action: "TRANSACTION_CREATED",
    targetType: "Transaction",
  },
  {
    method: "POST",
    pathPattern: /\/wallets\/topup/,
    action: "WALLET_TOPUP",
    targetType: "Wallet",
  },
  {
    method: "POST",
    pathPattern: /\/wallets\/withdraw/,
    action: "WALLET_WITHDRAW",
    targetType: "Wallet",
  },
  {
    method: "PATCH",
    pathPattern: /\/admin\/users.*\/ban/,
    action: "USER_BANNED",
    targetType: "User",
  },
  {
    method: "PATCH",
    pathPattern: /\/admin\/kyc.*\/approve/,
    action: "KYC_APPROVED",
    targetType: "User",
  },
  {
    method: "PATCH",
    pathPattern: /\/admin\/kyc.*\/reject/,
    action: "KYC_REJECTED",
    targetType: "User",
  },
  {
    method: "PATCH",
    pathPattern: /\/users\/pin/,
    action: "PIN_CHANGED",
    targetType: "User",
  },
  {
    method: "POST",
    pathPattern: /\/auth\/2fa\/enable/,
    action: "TWO_FACTOR_ENABLED",
    targetType: "User",
  },
];

// ─── Middleware factory ───────────────────────────────────────────

export const auditLog = (
  action: AuditAction,
  targetType: "User" | "Wallet" | "Transaction" | "System",
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Run after the response is sent (non-blocking)
    res.on("finish", async () => {
      // Only log successful operations
      if (
        res.statusCode >= httpStatus.OK &&
        res.statusCode < httpStatus.MULTIPLE_CHOICES
      ) {
        const rawTargetId = req.params.id ?? res.locals.targetId;
        let targetId: mongoose.Types.ObjectId | undefined;

        if (typeof rawTargetId === "string") {
          targetId = new mongoose.Types.ObjectId(rawTargetId);
        } else if (Array.isArray(rawTargetId)) {
          targetId = new mongoose.Types.ObjectId(rawTargetId[0]);
        }
        try {
          await AuditLog.create({
            actorId: req.user!._id,
            actorRole: req.user!.role,
            action,
            targetType,
            targetId,
            description: `${req.user!.email} performed ${action}`,
            ipAddress: req.ip ?? "unknown",
            userAgent: req.headers["user-agent"] ?? "unknown",
            metadata: {
              requestId: req.requestId,
              path: req.path,
              method: req.method,
            },
          });
        } catch (err) {
          // Audit log failure should NOT affect the main operation
          // Log the failure but do not throw
          logger.error("Audit log creation failed:", err);
        }
      }
    });

    next();
  };
};
