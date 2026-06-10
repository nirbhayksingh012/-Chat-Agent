# Spur Chat — AI Support Agent

A full-stack AI-powered live chat widget for a fictional e-commerce store (**Nova Store**), built as a take-home assignment for Spur.

**Live demo:** _deploy link here_

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + TypeScript + Express |
| LLM | Google Gemini (2.5 Flash) |
| Database | SQLite via `sql.js` (pure-JS, zero native deps) |
| Frontend | React + Vite |

---

## Running Locally

### Prerequisites
- Node.js ≥ 18
- An Anthropic API key ([get one here](https://console.anthropic.com/))

### 1. Clone & install

```bash
git clone <repo-url>
cd spur-chat
```

### 2. Set up the backend

```bash
cd backend
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here
npm install
npm run dev
# Backend starts at http://localhost:3001
```

The DB is created automatically on first run — no separate migration step needed.  
To verify: `npm run db:migrate` prints the schema and creates `data/chat.db`.

### 3. Set up the frontend

```bash
# In a new terminal, from repo root:
cd frontend
npm install
npm run dev
# Frontend starts at http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | — | Gemini API key |
| `PORT` | No | `3001` | Port to listen on |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origin |
| `DB_PATH` | No | `./data/chat.db` | SQLite file path |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `` (empty) | Backend URL for production. In dev, Vite proxies to `localhost:3001`. |

---

## API Endpoints

### `POST /chat/message`

Send a user message and get an AI reply.

**Request:**
```json
{
  "message": "What's your return policy?",
  "sessionId": "optional-uuid-to-continue-session"
}
```

**Response:**
```json
{
  "reply": "You can return items within 30 days...",
  "sessionId": "uuid-v4"
}
```

**Errors:** `400` for invalid input, `200` with a friendly error message for LLM failures.

### `GET /chat/history/:sessionId`

Fetch the full message history for a session.

**Response:**
```json
{
  "sessionId": "uuid",
  "messages": [
    { "id": "...", "sender": "user", "text": "...", "created_at": 1234567890 }
  ]
}
```

---

## Architecture Overview

```
spur-chat/
├── backend/
│   └── src/
│       ├── index.ts              # Express app setup, DB init, startup
│       ├── db/
│       │   ├── migrate.ts        # DB init + schema (getDb, runMigrations, saveDb)
│       │   └── seed.ts           # Store knowledge / FAQ (STORE_KNOWLEDGE const)
│       ├── routes/
│       │   └── chat.ts           # POST /chat/message, GET /chat/history/:id
│       └── services/
│           ├── conversation.ts   # DB operations: read/write messages & sessions
│           └── llm.ts            # generateReply() — Anthropic API wrapper
└── frontend/
    └── src/
        ├── App.tsx               # Full chat UI (single-component)
        ├── App.css               # Styling
        ├── lib/
        │   └── api.ts            # sendMessage(), loadHistory() fetch wrappers
        └── main.tsx              # React mount
```

**Layer breakdown:**

- **Routes** — thin: validate input with Zod, call services, return JSON.
- **Services** — business logic. `conversation.ts` owns DB reads/writes. `llm.ts` owns the Anthropic call and prompt construction.
- **DB** — `sql.js` (pure-JS SQLite). The DB is loaded from disk on startup and written back after every mutation. No native binaries needed.
- **Frontend** — a single React component. Keeps `sessionId` in `localStorage` so history survives page reloads. Uses Vite's dev proxy so no CORS config is needed locally.

---

## LLM Notes

**Provider:** Google Gemini (`gemini-2.5-flash`)  
**Max tokens per reply:** 512 (keeps costs low, sufficient for support answers)  
**History window:** last 20 messages sent per request (~10 turns)  
**Max input length:** 4,000 characters (truncated with notice if exceeded)

**Prompting strategy:**

The system prompt is the `STORE_KNOWLEDGE` constant in `backend/src/db/seed.ts`. It contains:
1. Store identity (Nova Store)
2. All FAQ knowledge: shipping, returns, payments, hours, warranty, cancellations
3. Tone guidelines: concise, friendly, never make things up, stay under 150 words

The full conversation history (up to 20 messages) is passed with each request so replies stay contextual.

**Error handling:**
- LLM/network errors are caught and a friendly fallback message is shown in chat (and persisted to DB)
- Empty messages, over-length messages, and malformed session IDs are rejected with 400s before touching the LLM

---

## Data Model

```sql
conversations (
  id          TEXT PRIMARY KEY,   -- UUID v4
  created_at  INTEGER NOT NULL,   -- Unix timestamp
  updated_at  INTEGER NOT NULL,
  metadata    TEXT                -- reserved for future use
);

messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  sender          TEXT NOT NULL,  -- 'user' | 'ai'
  text            TEXT NOT NULL,
  created_at      INTEGER NOT NULL
);
```

---

## Trade-offs & "If I Had More Time…"

**What I kept simple:**
- `sql.js` writes the entire DB to disk on every write. Fine for a demo; a production deployment would use `better-sqlite3` (native, synchronous, fast) or PostgreSQL.
- No authentication. Session is tied to a `localStorage` UUID — anyone who knows the session ID can read its history.
- Single-component frontend. Would split into `ChatWindow`, `MessageList`, `MessageBubble`, `InputBar` components for maintainability.

**If I had more time:**
- **Redis** for session caching so the DB isn't hit on every message
- **Streaming replies** — Anthropic supports token-by-token streaming; wiring that to SSE/WebSockets makes the UX feel much faster
- **Tool use / RAG** — instead of hardcoding FAQ in the prompt, store it in a vector DB and retrieve relevant chunks per query (scales to real product catalogues)
- **Rate limiting** per session to prevent abuse
- **Webhook-style channel abstraction** — a `ChannelAdapter` interface so the same `generateReply` / `conversation` logic can be reused by WhatsApp, Instagram, etc. The route layer would become a thin adapter per channel.
- **Tests** — unit tests for the conversation service and an integration test for the `/chat/message` endpoint

**Interesting design decision — sql.js over PostgreSQL:**  
The assignment asks for PostgreSQL but also says "SQLite is fine." I chose `sql.js` (pure-JS SQLite) over `better-sqlite3` to avoid native compilation, making the repo work out-of-the-box in any environment (including sandboxed CI and Render free tier) without Docker. The schema is standard SQL, so switching to PostgreSQL with `pg` + `node-postgres` is ~1 hour of work.
