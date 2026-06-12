# Chat Agent — AI Support Agent

A full-stack, AI-powered live chat widget built with React, Node.js, PostgreSQL, Redis, and Google Gemini.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite + Tailwind CSS v4 |
| **Backend** | Node.js + TypeScript + Express |
| **Database** | PostgreSQL (managed via Drizzle ORM) |
| **Caching** | Redis (Cache-Aside pattern via Upstash) |
| **LLM** | Google Gemini (`gemini-2.5-flash` / `gemini-3.5-flash`) |

---

## Running Locally

### Prerequisites

- Node.js ≥ 18
- A PostgreSQL database
- A Redis server (via [Upstash](https://upstash.com))
- A Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))

---

### Step 1 — Clone the Repository

```bash
git clone <repo-url>
cd Chat-Agent
```

---

### Step 2 — Set Up the Backend

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in your credentials:

```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/spurchat
REDIS_URL=redis://localhost:6379
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

Then install dependencies and start the dev server:

```bash
npm install
npm run dev
```

> The server runs **database migrations automatically** on startup — no manual migration step needed.
> Backend listens on **http://localhost:3001**.

---

### Step 3 — Set Up the Frontend

In a new terminal tab:

```bash
cd frontend
npm install
npm run dev
```

> Frontend starts at **http://localhost:5173**. Open it in your browser.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | — | Google Gemini developer API key |
| `DATABASE_URL` | ✅ | `postgresql://postgres:postgres@localhost:5432/spurchat` | PostgreSQL connection string |
| `REDIS_URL` | ✅ | `redis://localhost:6379` | Redis connection string (use `rediss://` for TLS) |
| `PORT` | No | `3001` | Port the Express server listens on |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origin for CORS |

---

## Database Setup

Migrations run **automatically at server startup** via `backend/src/db/migrate.ts`. No manual steps required.

If you want to run migrations manually:

```bash
cd backend
npx drizzle-kit migrate
```

To seed the store knowledge base (FAQ + policy prompts used by the LLM):

```bash
npx ts-node src/db/seed.ts
```

The seed file (`seed.ts`) populates the `STORE_KNOWLEDGE` constant with store policies: shipping fees, return window, accepted payment methods, support hours, and tone guidelines.

---

## Architecture Overview

```
Chat-Agent/
├── backend/
│   ├── src/
│   │   ├── index.ts                  # Server entry point, Redis connect, graceful shutdown
│   │   ├── db/
│   │   │   ├── migrate.ts            # PostgreSQL pool, Drizzle db export, startup migrations
│   │   │   ├── schema.ts             # Table & index definitions (conversations, messages)
│   │   │   ├── redis.ts              # Redis client setup and connection logs
│   │   │   └── seed.ts               # STORE_KNOWLEDGE FAQ constant for LLM system prompts
│   │   ├── routes/
│   │   │   └── chat.ts               # POST /chat/message · GET /chat/history/:id
│   │   └── services/
│   │       ├── conversation.ts       # Cache-aside logic: Redis reads, DB fallback, invalidation
│   │       └── llm.ts                # generateReply() — Gemini SDK integration & prompt builder
│   ├── tsconfig.json
│   └── drizzle.config.ts
└── frontend/
    ├── src/
    │   ├── main.jsx                  # React entry point
    │   ├── App.jsx                   # Chat UI (Tailwind CSS v4)
    │   ├── index.css                 # Tailwind v4 import, CSS brand variables, animations
    │   └── lib/
    │       └── api.js                # sendMessage() and loadHistory() fetch helpers
    └── vite.config.js
```

### Layer Breakdown

**Controller Layer (`routes/chat.ts`)**
Receives HTTP requests from the client. Validates all inputs using **Zod** — enforcing correct types, required fields, and message length limits — before delegating to the service layer. This keeps validation centralized and out of business logic.

**Service Layer (`conversation.ts` + `llm.ts`)**
`conversation.ts` handles all data operations: reading from Redis first, falling back to PostgreSQL on cache miss, and invalidating the cache on new writes. `llm.ts` constructs the system prompt from `STORE_KNOWLEDGE`, attaches the last 20 messages as conversation history, and calls the Gemini SDK.

**Database & Cache Layer (`migrate.ts` + `redis.ts`)**
Manages PostgreSQL and Redis connections. Runs startup migrations to ensure the `conversations` and `messages` tables exist before the first request is served.

---

## Key Design Decisions

**Drizzle ORM over raw SQL**
Drizzle provides a fully type-safe query interface, which eliminates a whole class of runtime SQL errors. It also makes schema changes explicit and version-controlled via migration files, rather than relying on ad-hoc SQL scripts.

**Fail-Safe Redis Caching (Cache-Aside)**
All Redis calls are wrapped in `try/catch`. If Redis goes offline, the app silently falls back to PostgreSQL for every read — users experience no downtime or errors, just slightly slower history loads. Cache entries are invalidated on every new message write to prevent stale reads.

**Zod Input Validation**
Rather than relying on implicit trust of client data, every API endpoint validates its inputs against a Zod schema at the boundary. This prevents malformed payloads from ever reaching the database or the LLM.

**Tailwind CSS v4 with CSS Variables**
Custom theme tokens (colors, spacing, animations) are declared directly in `index.css` using CSS custom properties. This keeps the design system co-located with the component styles, avoids a separate `tailwind.config.js`, and makes the build faster via the Vite compiler plugin.

---

## LLM Notes

**Provider:** Google Gemini via the `@google/genai` SDK.
- Primary model: `gemini-2.5-flash`
- Fallback model: `gemini-3.5-flash` (used if the primary is rate-limited or unavailable)

**Prompting Strategy**

The system prompt is built from the `STORE_KNOWLEDGE` constant in `seed.ts`. It explicitly tells the model:
- The store's shipping fees, return window (30 days), supported payment methods, and support hours
- Tone expectations: friendly, concise, under 150 words per reply
- How to handle out-of-scope questions (politely redirect)

Each request to Gemini includes the last **20 messages (~10 conversation turns)** from the database, giving the model full context for follow-up questions without sending unbounded history.

**Error Handling**

If Gemini throws an exception (expired key, quota exceeded, network timeout), a friendly fallback message is returned to the client *and* saved to PostgreSQL. This keeps the session's chat history intact and consistent, even when the LLM is unavailable.

---

## Trade-offs & If I Had More Time

**Session management is localStorage-only**
Sessions are keyed by a UUID stored in `localStorage`. This is simple and stateless, but means sessions don't survive clearing browser storage or switching devices. A proper auth layer (even anonymous tokens via cookies) would fix this.

**No streaming responses**
Gemini supports streaming (`generateContentStream`), but the current implementation waits for the full reply before sending it to the client. Streaming would make the UI feel significantly faster for longer replies, and is the most impactful UX improvement left on the table.

**Fixed history window of 20 messages**
The LLM receives the last 20 messages regardless of their length. For very long conversations, this could push against Gemini's context limit. A smarter approach would be token-counting the history and trimming from the oldest end to fit within a safe budget.

**No rate limiting on the API**
The `/chat/message` endpoint has no per-IP or per-session rate limiting. In production, this would need to be added (e.g. via `express-rate-limit` + Redis) to prevent abuse and protect the Gemini quota.

**Single-region deployment assumption**
Redis and PostgreSQL are assumed to be co-located with the backend. A multi-region setup would require thinking about cache invalidation across regions and read replicas for PostgreSQL.

---

## API Reference

### `POST /chat/message`

Send a new message and receive an AI reply.

**Request body:**
```json
{
  "message": "What is your return policy?",
  "sessionId": "optional-existing-session-uuid"
}
```

**Response:**
```json
{
  "reply": "We offer a 30-day hassle-free return policy...",
  "sessionId": "uuid-of-the-session"
}
```

---

### `GET /chat/history/:sessionId`

Retrieve the full message history for a session.

**Response:**
```json
{
  "messages": [
    { "id": "uuid", "sender": "user", "text": "Hello", "created_at": 1718000000 },
    { "id": "uuid", "sender": "ai", "text": "Hi! How can I help?", "created_at": 1718000001 }
  ]
}
```
