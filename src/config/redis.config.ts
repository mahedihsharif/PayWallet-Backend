import Redis from "ioredis";
import env from "./env.config";
import logger from "./logger.config";

// ─── Single Redis client (reused across the entire app) ───────────
// ioredis handles reconnection automatically

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error("Redis: Max reconnection attempts reached.");
      return null; // Stop retrying
    }
    // Exponential backoff: 100ms, 200ms, 400ms...
    return Math.min(times * 100, 3000);
  },
});

redis.on("connect", () => logger.info("✅ Redis connected."));
redis.on("error", (err) => logger.error("Redis error:", err));
redis.on("close", () => logger.warn("Redis connection closed."));

// ─── Typed helper wrappers (optional but nice) ────────────────────

export const redisGet = async (key: string): Promise<string | null> => {
  return redis.get(key);
};

export const redisSet = async (
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<void> => {
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, value);
  } else {
    await redis.set(key, value);
  }
};

export const redisDel = async (...keys: string[]): Promise<void> => {
  if (keys.length) await redis.del(...keys);
};

export const redisExists = async (key: string): Promise<boolean> => {
  const result = await redis.exists(key);
  return result === 1;
};

export default redis;
