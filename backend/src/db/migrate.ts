import { Pool } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/spurchat";

let _pool: Pool | null = null;
export let db: NodePgDatabase<typeof schema>;

export async function getDb(): Promise<Pool> {
  if (_pool) return _pool;

  _pool = new Pool({ connectionString });
  db = drizzle(_pool, { schema });

  return _pool;
}

export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id          UUID PRIMARY KEY,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      metadata    TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              UUID PRIMARY KEY,
      conversation_id UUID NOT NULL,
      sender          TEXT NOT NULL,
      text            TEXT NOT NULL,
      created_at      INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conv
      ON messages(conversation_id, created_at);
  `);
  console.log("✅ PostgreSQL Migrations complete.");
}
