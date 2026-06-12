import React, { useState, useEffect, useRef } from "react";
import { sendMessage, loadHistory } from "./lib/api";

const SESSION_KEY = "chat_agent_session_id";
const MAX_LENGTH = 4000;
const SUGGESTED = [
  "What's your return policy?",
  "Do you ship to the USA?",
  "How long does delivery take?",
  "What payment methods do you accept?",
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesElRef = useRef(null);
  const textareaRef = useRef(null);

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

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, historyLoaded]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [inputText]);

  const handleSend = async (textToSend) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || loading || overLimit) return;

    setError("");
    setInputText("");

    const userMsg = {
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
      const aiMsg = {
        id: crypto.randomUUID(),
        sender: "ai",
        text: result.reply,
        created_at: Math.floor(Date.now() / 1000),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewChat = () => {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setMessages([]);
    setInputText("");
    setError("");
  };

  const formatTime = (ts) => {
    return new Date(ts * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex h-screen w-full bg-white text-gray-900 font-sans overflow-hidden">
      {/* Chat panel */}
      <main className="flex-1 flex flex-col h-full bg-white relative">

        {/* Header */}
        <header className="h-14 border-b border-gray-200 flex items-center justify-between px-5 bg-white z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 leading-tight">Chat Agent</div>
            </div>
          </div>

          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-all text-xs font-medium cursor-pointer"
            onClick={startNewChat}
            title="Start new chat"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New chat
          </button>
        </header>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth"
          ref={messagesElRef}
          style={{ scrollbarWidth: "thin", scrollbarColor: "#e5e7eb transparent" }}
        >
          {!historyLoaded ? (
            <div className="text-center text-gray-400 text-sm py-16">Loading conversation…</div>
          ) : messages.length === 0 ? (
            <div className="max-w-sm mx-auto text-center py-16 flex flex-col items-center justify-center h-full">
              <div className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <p className="text-base font-semibold text-gray-900 mb-1">How can I help you today?</p>
              <p className="text-xs text-gray-400 mb-6">Ask about shipping, returns, orders, or anything else.</p>

              <div className="flex flex-col gap-2 w-full">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    className="text-left text-xs text-gray-500 bg-white border border-gray-200 p-3 rounded-xl hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-150 cursor-pointer"
                    onClick={() => handleSend(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2.5 max-w-[80%] ${
                    msg.sender === "user"
                      ? "ml-auto flex-row-reverse"
                      : "mr-auto"
                  }`}
                >
                  {msg.sender === "ai" && (
                    <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center shrink-0 mb-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                    </div>
                  )}
                  <div className={`flex flex-col gap-1 ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`px-4 py-2.5 text-sm leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-black text-white rounded-2xl rounded-br-sm"
                          : "bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-gray-400 px-1">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-end gap-2.5 max-w-[80%] mr-auto">
                  <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center shrink-0 mb-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-5 mb-2 p-3 bg-red-50 border border-red-100 text-red-500 text-xs rounded-xl flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx={12} cy={12} r={10} />
              <line x1={12} y1={8} x2={12} y2={12} />
              <line x1={12} y1={16} x2={12.01} y2={16} />
            </svg>
            {error}
          </div>
        )}

        {/* Input area */}
        <div className="p-4 border-t border-gray-200 bg-white shrink-0">
          <div
            className={`relative flex items-end border rounded-2xl bg-gray-50 transition-all pr-12 pl-1 ${
              overLimit
                ? "border-amber-400"
                : "border-gray-200 focus-within:border-gray-400"
            }`}
          >
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeydown}
              placeholder="Type a message…"
              rows={1}
              maxLength={MAX_LENGTH + 200}
              disabled={loading}
              className="w-full bg-transparent text-gray-900 text-sm placeholder-gray-400 focus:outline-none resize-none py-3 px-3 min-h-[44px] max-h-[160px] leading-relaxed"
            />
            {charCount > MAX_LENGTH * 0.8 && (
              <span
                className={`absolute right-12 bottom-3 text-[10px] ${
                  overLimit ? "text-amber-500 font-semibold" : "text-gray-400"
                }`}
              >
                {charCount}/{MAX_LENGTH}
              </span>
            )}
            <button
              className="absolute right-2 bottom-2 w-8 h-8 rounded-xl bg-black hover:bg-gray-800 text-white flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
              onClick={() => handleSend()}
              disabled={!canSend}
              aria-label="Send message"
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1={22} y1={2} x2={11} y2={13} />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
          <div className="text-[10px] text-gray-400 text-center mt-2">
            Press Enter to send · Shift+Enter for new line
          </div>
        </div>
      </main>
    </div>
  );
}