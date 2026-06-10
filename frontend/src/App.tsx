import React, { useState, useEffect, useRef } from "react";
import { sendMessage, loadHistory } from "./lib/api";
import type { Message } from "./lib/api";
import "./App.css";

const SESSION_KEY = "spur_session_id";
const MAX_LENGTH = 4000;
const SUGGESTED = [
  "What's your return policy?",
  "Do you ship to the USA?",
  "How long does delivery take?",
  "What payment methods do you accept?",
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesElRef = useRef<HTMLDivElement>(null);

  const charCount = inputText.length;
  const overLimit = charCount > MAX_LENGTH;
  const canSend = inputText.trim().length > 0 && !loading && !overLimit;

  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        setSessionId(stored);
        try {
          const data = await loadHistory(stored);
          setMessages(data.messages);
        } catch {
          // Session expired or gone — start fresh
          localStorage.removeItem(SESSION_KEY);
          setSessionId(null);
        }
      }
      setHistoryLoaded(true);
    };
    init();
  }, []);

  const scrollToBottom = () => {
    if (messagesElRef.current) {
      messagesElRef.current.scrollTop = messagesElRef.current.scrollHeight;
    }
  };

  // Automatically scroll to bottom when messages or loading changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, historyLoaded]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || loading || overLimit) return;

    setError("");
    setInputText("");

    // Optimistic user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      sender: "user",
      text,
      created_at: Math.floor(Date.now() / 1000),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await sendMessage(text, sessionId);
      if (!sessionId) {
        setSessionId(result.sessionId);
        localStorage.setItem(SESSION_KEY, result.sessionId);
      }
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        sender: "ai",
        text: result.reply,
        created_at: Math.floor(Date.now() / 1000),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeydown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const useSuggested = (s: string) => {
    handleSend(s);
  };

  const startNewChat = () => {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setMessages([]);
    setInputText("");
    setError("");
  };

  const formatTime = (ts: number): string => {
    return new Date(ts * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="shell">
      {/* Left brand panel */}
      <aside className="brand-panel">
        <div className="brand-inner">
          <div className="brand-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx={8} fill="#6C63FF" />
              <path d="M8 10h16M8 16h10M8 22h13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="brand-name">Nova Store</span>
          </div>
          <div className="brand-tagline">
            <p>Smart support,<br /><em>always here.</em></p>
          </div>
          <ul className="brand-features">
            <li>
              <span className="feat-icon">📦</span>
              <span>Fast India & international shipping</span>
            </li>
            <li>
              <span className="feat-icon">↩️</span>
              <span>30-day hassle-free returns</span>
            </li>
            <li>
              <span className="feat-icon">🛡️</span>
              <span>1-year warranty on all electronics</span>
            </li>
            <li>
              <span className="feat-icon">💬</span>
              <span>Support: Mon–Sat, 9 AM–7 PM IST</span>
            </li>
          </ul>
        </div>
      </aside>

      {/* Chat panel */}
      <main className="chat-panel">
        <header className="chat-header">
          <div className="agent-info">
            <div className="agent-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx={12} cy={8} r={4} fill="white" opacity={0.9} />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="white" strokeWidth={2} strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="agent-name">Nova Support</div>
              <div className="agent-status">
                <span className="status-dot"></span>
                Online
              </div>
            </div>
          </div>
          <button className="new-chat-btn" onClick={startNewChat} title="Start new chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New chat
          </button>
        </header>

        <div className="messages-area" ref={messagesElRef}>
          {!historyLoaded ? (
            <div className="loading-history">Loading conversation…</div>
          ) : messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6C63FF" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <p className="empty-title">How can I help you today?</p>
              <p className="empty-sub">Ask about shipping, returns, orders, or anything else.</p>
              <div className="suggestions">
                {SUGGESTED.map((s) => (
                  <button key={s} className="suggestion-chip" onClick={() => useSuggested(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`message-row ${msg.sender}`}>
                  {msg.sender === "ai" && (
                    <div className="msg-avatar ai-avatar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="bubble-wrap">
                    <div className="bubble">{msg.text}</div>
                    <span className="msg-time">{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="message-row ai">
                  <div className="msg-avatar ai-avatar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <div className="bubble-wrap">
                    <div className="bubble typing-bubble">
                      <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="error-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx={12} cy={12} r={10} /><line x1={12} y1={8} x2={12} y2={12} /><line x1={12} y1={16} x2={12.01} y2={16} />
            </svg>
            {error}
          </div>
        )}

        <div className="input-area">
          <div className={`input-wrap ${overLimit ? "over-limit" : ""}`}>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeydown}
              placeholder="Type a message…"
              rows={1}
              maxLength={MAX_LENGTH + 200}
              disabled={loading}
              className="chat-input"
            ></textarea>
            {charCount > MAX_LENGTH * 0.8 && (
              <span className={`char-count ${overLimit ? "warn" : ""}`}>
                {charCount}/{MAX_LENGTH}
              </span>
            )}
          </div>
          <button
            className="send-btn"
            onClick={() => handleSend()}
            disabled={!canSend}
            aria-label="Send message"
          >
            {loading ? (
              <span className="spin"></span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1={22} y1={2} x2={11} y2={13} /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <div className="input-hint">Press Enter to send · Shift+Enter for new line</div>
      </main>
    </div>
  );
}
