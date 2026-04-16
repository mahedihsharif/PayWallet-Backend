import env from "@config/env.config";

export const CONSTANTS = {
  // Token TTLs (in seconds)
  ACCESS_TOKEN_TTL: 15 * 60, // 15 minutes
  REFRESH_TOKEN_TTL: 7 * 24 * 60 * 60, // 7 days
  OTP_TTL: 10 * 60, // 10 minutes
  IDEMPOTENCY_TTL: 24 * 60 * 60, // 24 hours

  // Rate limits
  GLOBAL_RATE_LIMIT: 100, // requests per 15 min
  AUTH_RATE_LIMIT: 5, // requests per 15 min
  TRANSACTION_RATE_LIMIT: 20, // requests per hour
  OTP_MAX_ATTEMPTS: 5,

  // Wallet limits (in paisa)
  DEFAULT_DAILY_LIMIT: 500_000, // ৳5,000 (unverified)
  VERIFIED_DAILY_LIMIT: 5_000_000, // ৳50,000 (KYC verified)
  MIN_TRANSACTION: 100, // ৳1
  MAX_SINGLE_TRANSACTION: 5_000_000, // ৳50,000

  // Pagination
  DEFAULT_PAGE_LIMIT: 20,
  MAX_PAGE_LIMIT: 50,

  // Cookie settings
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: env.NODE_ENV === "PRODUCTION",
    sameSite: "strict" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  },

  // Transaction fees (in paisa)
  P2P_FEE: 0, // Free for portfolio (add later)
  TOPUP_FEE: 0,
  WITHDRAW_FEE: 0,

  // Redis key prefixes
  REDIS_KEYS: {
    REFRESH_TOKEN: (userId: string, hash: string) => `rt:${userId}:${hash}`,
    WALLET_BALANCE: (walletId: string) => `wb:${walletId}`,
    IDEMPOTENCY: (userId: string, key: string) => `idem:${userId}:${key}`,
    RATE_LIMIT_IP: (ip: string) => `rl:ip:${ip}`,
    RATE_LIMIT_USER: (userId: string) => `rl:user:${userId}`,
    OTP: (userId: string, purpose: string) => `otp:${userId}:${purpose}`,
    BLACKLIST: (tokenHash: string) => `bl:${tokenHash}`,
  },
} as const;
