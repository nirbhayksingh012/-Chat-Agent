export interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  created_at: number;
}

const BASE = import.meta.env.VITE_API_URL || "";

export async function sendMessage(
  message: string,
  sessionId: string | null
): Promise<{ reply: string; sessionId: string }> {
  const res = await fetch(`${BASE}/chat/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, ...(sessionId ? { sessionId } : {}) }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error || "Request failed");
  }

  return res.json();
}

export async function loadHistory(
  sessionId: string
): Promise<{ sessionId: string; messages: Message[] }> {
  const res = await fetch(`${BASE}/chat/history/${sessionId}`);
  if (!res.ok) throw new Error("Could not load history");
  return res.json();
}
