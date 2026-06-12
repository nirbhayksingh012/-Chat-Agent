import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { getDb, runMigrations } from "./db/migrate";
import { connectRedis, redisClient } from "./db/redis";
import { createChatRouter } from "./routes/chat";

const PORT = parseInt(process.env.PORT || "3001", 10);

async function main() {
  const pool = await getDb();
  await runMigrations(pool);
  
  try {
    await connectRedis();
  } catch (err: any) {
    console.warn("⚠️ Failed to connect to Redis on startup. Running in DB-only mode.", err.message || err);
  }

  const app = express();

  app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  }));
  app.use(express.json({ limit: "50kb" }));
  app.use("/chat", createChatRouter());
  app.get("/health", (_req: Request, res: Response) => res.json({ status: "ok" }));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Error]", err);
    res.status(500).json({ error: "Internal server error" });
  });

  const server = app.listen(PORT, () => {
    console.log(`🚀 Spur Chat backend running on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    console.log("\nShutting down server gracefully...");
    server.close(async () => {
      await pool.end();
      try {
        if (redisClient.isOpen) {
          await redisClient.quit();
          console.log("Redis client closed.");
        }
      } catch (err) {
        console.error("Error closing Redis client:", err);
      }
      console.log("Database pool closed. Exit.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(err => {
  console.error("Failed to start:", err);
  process.exit(1);
});
