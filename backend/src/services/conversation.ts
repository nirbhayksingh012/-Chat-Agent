import { Database } from "sql.js";
import { v4 as uuidv4 } from "uuid";
import { saveDb } from "../db/migrate";
import type { ChatMessage } from "./llm";

export interface Message {
  id: string;
  conversation_id: string;
  sender: "user" | "ai";
  text: string;
  created_at: number;
}

export interface Conversation {
  id: string;
  created_at: number;
  updated_at: number;
  metadata: string | null;
}

function queryFirst<T>(db: Database, sql: string, params: (string | number | null)[]): T | undefined {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as T;
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

function queryAll<T>(db: Database, sql: string, params: (string | number | null)[]): T[] {
  const result = db.exec(sql.replace(/\?/g, () => {
    const p = params.shift();
    if (p === null) return "NULL";
    if (typeof p === "number") return String(p);
    return `'${String(p).replace(/'/g, "''")}'`;
  }));
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj as unknown as T;
  });
}

export function getOrCreateConversation(db: Database, sessionId?: string): Conversation {
  if (sessionId) {
    const existing = queryFirst<Conversation>(
      db,
      "SELECT id, created_at, updated_at, metadata FROM conversations WHERE id = ?",
      [sessionId]
    );
    if (existing) return existing;
  }

  const id = sessionId || uuidv4();
  const now = Math.floor(Date.now() / 1000);
  db.run("INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)", [id, now, now]);
  saveDb(db);
  return { id, created_at: now, updated_at: now, metadata: null };
}

export function saveMessage(db: Database, conversationId: string, sender: "user" | "ai", text: string): Message {
  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  db.run("INSERT INTO messages (id, conversation_id, sender, text, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, conversationId, sender, text, now]);
  db.run("UPDATE conversations SET updated_at = ? WHERE id = ?", [now, conversationId]);
  saveDb(db);
  return { id, conversation_id: conversationId, sender, text, created_at: now };
}

export function getConversationHistory(db: Database, conversationId: string): Message[] {
  return queryAll<Message>(
    db,
    "SELECT id, conversation_id, sender, text, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    [conversationId]
  );
}

export function getConversation(db: Database, id: string): Conversation | undefined {
  return queryFirst<Conversation>(
    db,
    "SELECT id, created_at, updated_at, metadata FROM conversations WHERE id = ?",
    [id]
  );
}

export function buildLlmHistory(messages: Message[]): ChatMessage[] {
  return messages.map(m => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.text,
  }));
}
