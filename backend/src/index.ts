import "dotenv/config";
import express from "express";
import cors from "cors";
import { getDb, runMigrations } from "./db/migrate";
import { createChatRouter } from "./routes/chat";

const PORT = parseInt(process.env.PORT || "3001", 10);

async function main() {
  const db = await getDb();
  runMigrations(db);

  const app = express();

  app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  }));
  app.use(express.json({ limit: "50kb" }));
  app.use("/chat", createChatRouter(db));
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[Error]", err);
    res.status(500).json({ error: "Internal server error" });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Spur Chat backend running on http://localhost:${PORT}`);
  });

  process.on("SIGINT", () => {
    db.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error("Failed to start:", err);
  process.exit(1);
});
