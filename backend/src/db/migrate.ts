import initSqlJs, { Database } from "sql.js";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "chat.db");

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;

  const SQL = await initSqlJs();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }

  return _db;
}

export function saveDb(db: Database): void {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id          TEXT PRIMARY KEY,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      metadata    TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender          TEXT NOT NULL,
      text            TEXT NOT NULL,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conv
      ON messages(conversation_id, created_at);
  `);
  saveDb(db);
  console.log("✅ Migrations complete.");
}
