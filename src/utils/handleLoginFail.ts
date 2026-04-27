import redis from "@config/redis.config";

export const handleLoginFail = async (key: string) => {
  const newCount = await redis.incr(key);
  if (newCount === 1) {
    await redis.expire(key, 15 * 60); // 15 minutes
  }
};
