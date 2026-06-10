import { GoogleGenAI } from "@google/genai";
import { STORE_KNOWLEDGE } from "../db/seed";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY_MESSAGES = 20; // last 10 turns
const MAX_INPUT_CHARS = 4000;    // ~1000 tokens; truncate user messages beyond this

let ai: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export async function generateReply(
  history: ChatMessage[],
  userMessage: string
): Promise<string> {
  const truncatedMessage =
    userMessage.length > MAX_INPUT_CHARS
      ? userMessage.slice(0, MAX_INPUT_CHARS) + "… [message truncated]"
      : userMessage;

  // Keep only the last N messages to control token usage
  const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES);

  const contents = [
    ...trimmedHistory.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: truncatedMessage }] },
  ];

  try {
    // Attempt with primary model (gemini-2.5-flash)
    const response = await getAiClient().models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: STORE_KNOWLEDGE,
        maxOutputTokens: 512,
      },
    });

    const reply = response.text;
    if (reply) return reply.trim();
  } catch (err: any) {
    console.warn(
      `[LLM Warning] gemini-2.5-flash failed (attempting fallback to gemini-3.5-flash). Error: ${err?.message || err}`
    );

    // Fallback with stable model (gemini-3.5-flash)
    const response = await getAiClient().models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: STORE_KNOWLEDGE,
        maxOutputTokens: 512,
      },
    });

    const reply = response.text;
    if (reply) return reply.trim();
  }

  throw new Error("Unexpected response format from Gemini: No text returned");
}

