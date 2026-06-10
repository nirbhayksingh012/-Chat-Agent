import { Router, Request, Response } from "express";
import { z } from "zod";
import { Database } from "sql.js";
import {
  getOrCreateConversation,
  saveMessage,
  getConversationHistory,
  getConversation,
  buildLlmHistory,
} from "../services/conversation";
import { generateReply } from "../services/llm";

const MAX_MESSAGE_LENGTH = 4000;

const SendMessageSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(MAX_MESSAGE_LENGTH, `Message must be under ${MAX_MESSAGE_LENGTH} characters`),
  sessionId: z.string().uuid().optional(),
});

export function createChatRouter(db: Database): Router {
  const router = Router();

  router.post("/message", async (req: Request, res: Response) => {
    const parsed = SendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => e.message).join(", ");
      res.status(400).json({ error: errors });
      return;
    }

    const { message, sessionId } = parsed.data;
    const conversation = getOrCreateConversation(db, sessionId);
    const history = getConversationHistory(db, conversation.id);
    const llmHistory = buildLlmHistory(history);
    saveMessage(db, conversation.id, "user", message);

    let reply: string;
    try {
      reply = await generateReply(llmHistory, message);
    } catch (err: unknown) {
      console.error("[LLM Error]", err);
      const friendlyMessage =
        "Our AI agent is temporarily unavailable. Please try again in a moment or contact support@novastore.example.";
      saveMessage(db, conversation.id, "ai", friendlyMessage);
      res.status(200).json({ reply: friendlyMessage, sessionId: conversation.id });
      return;
    }

    saveMessage(db, conversation.id, "ai", reply);
    res.json({ reply, sessionId: conversation.id });
  });

  router.get("/history/:sessionId", (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      res.status(400).json({ error: "Invalid session ID" });
      return;
    }
    const conversation = getConversation(db, sessionId);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const messages = getConversationHistory(db, sessionId);
    res.json({ sessionId, messages });
  });

  return router;
}
