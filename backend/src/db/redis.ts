import { createClient, RedisClientType } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
export const redisClient: RedisClientType = createClient({ url: redisUrl });

redisClient.on("error", (err) => console.error("[Redis Client Error]", err));

export async function connectRedis(): Promise<void> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("🚀 Connected to Redis successfully.");
  }
}
