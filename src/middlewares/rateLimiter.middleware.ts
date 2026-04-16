// src/middlewares/rateLimiter.middleware.ts
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import redis from "../config/redis.config";
import { CONSTANTS } from "../utils/constants";

const createRateLimiter = (max: number, windowMs: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      // @ts-expect-error — known type mismatch between packages
      sendCommand: (...args: string[]) => redis.call(...args),
      prefix: "rl:",
    }),
    // ✅ Use ipKeyGenerator helper for IPv6 safety
    keyGenerator: (req) => {
      if (req.user) {
        return `user:${String((req.user as { _id: string })._id)}`;
      }
      // ipKeyGenerator handles IPv4, IPv6, and mapped addresses correctly
      return ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown");
    },
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message,
        data: null,
        meta: null,
      });
    },
  });

export const globalLimiter = createRateLimiter(
  CONSTANTS.GLOBAL_RATE_LIMIT,
  15 * 60 * 1000,
  "Too many requests. Please try again in 15 minutes.",
);
export const authLimiter = createRateLimiter(
  CONSTANTS.AUTH_RATE_LIMIT,
  15 * 60 * 1000,
  "Too many login attempts. Please wait 15 minutes.",
);
export const transactionLimiter = createRateLimiter(
  CONSTANTS.TRANSACTION_RATE_LIMIT,
  60 * 60 * 1000,
  "Transaction rate limit reached. Please try again later.",
);
