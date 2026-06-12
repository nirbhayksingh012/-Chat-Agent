import { db } from "../db/migrate";
import { conversations, messages } from "../db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { redisClient } from "../db/redis";
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

export async function getOrCreateConversation(sessionId?: string): Promise<Conversation> {
  if (sessionId) {
    const existing = await getConversation(sessionId);
    if (existing) return existing;
  }

  const id = sessionId || uuidv4();
  const now = Math.floor(Date.now() / 1000);
  
  await db.insert(conversations).values({
    id,
    createdAt: now,
    updatedAt: now,
    metadata: null
  });

  const conversation = { id, created_at: now, updated_at: now, metadata: null };

  if (redisClient.isOpen) {
    try {
      await redisClient.setEx(`chat:session:${id}`, 3600, JSON.stringify(conversation));
    } catch (err) {
      console.warn("[Redis Cache Error] Failed to set conversation cache:", err);
    }
  }

  return conversation;
}

export async function saveMessage(conversationId: string, sender: "user" | "ai", text: string): Promise<Message> {
  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(messages).values({
    id,
    conversationId,
    sender,
    text,
    createdAt: now
  });

  await db.update(conversations)
    .set({ updatedAt: now })
    .where(eq(conversations.id, conversationId));

  // Invalidate Redis caches
  if (redisClient.isOpen) {
    try {
      await redisClient.del(`chat:history:${conversationId}`);
      await redisClient.del(`chat:session:${conversationId}`);
    } catch (err) {
      console.warn("[Redis Cache Error] Failed to invalidate cache:", err);
    }
  }

  return { id, conversation_id: conversationId, sender, text, created_at: now };
}

export async function getConversationHistory(conversationId: string): Promise<Message[]> {
  const cacheKey = `chat:history:${conversationId}`;

  if (redisClient.isOpen) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn("[Redis Cache Error] Failed to read conversation history cache:", err);
    }
  }

  const rows = await db.select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  const history = rows.map(r => ({
    id: r.id,
    conversation_id: r.conversationId,
    sender: r.sender as "user" | "ai",
    text: r.text,
    created_at: r.createdAt
  }));

  if (redisClient.isOpen) {
    try {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(history));
    } catch (err) {
      console.warn("[Redis Cache Error] Failed to cache conversation history:", err);
    }
  }

  return history;
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const cacheKey = `chat:session:${id}`;

  if (redisClient.isOpen) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn("[Redis Cache Error] Failed to read conversation cache:", err);
    }
  }

  const rows = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (rows.length === 0) return undefined;

  const conversation = {
    id: rows[0].id,
    created_at: rows[0].createdAt,
    updated_at: rows[0].updatedAt,
    metadata: rows[0].metadata
  };

  if (redisClient.isOpen) {
    try {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(conversation));
    } catch (err) {
      console.warn("[Redis Cache Error] Failed to cache conversation session:", err);
    }
  }

  return conversation;
}

export function buildLlmHistory(messages: Message[]): ChatMessage[] {
  return messages.map(m => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.text,
  }));
}
