# Chat Agent — AI Support Agent

A full-stack, AI-powered live chat widget built with React, Node.js, Neon PostgreSQL, Redis, and Google Gemini.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite + Tailwind CSS v4 |
| **Backend** | Node.js + TypeScript + Express |
| **Database** | Neon PostgreSQL (serverless, managed via Drizzle ORM) |
| **Caching** | Redis (Cache-Aside pattern via Upstash) |
| **LLM** | Google Gemini (`gemini-2.5-flash` / `gemini-3.5-flash`) |
| **Frontend Hosting** | Vercel |
| **Backend Hosting** | Render |

---

## Live Deployment

The project is deployed across two platforms, each optimized for its role:

- **Frontend** → [Vercel](https://vercel.com) — optimized for React/Vite static frontends, zero-config deploys, edge CDN out of the box.
- **Backend** → [Render](https://render.com) — optimized for Node.js/Express servers, handles long-lived connections and background processes cleanly.
- **Database** → [Neon](https://neon.tech) — serverless PostgreSQL, connects seamlessly from both Render (production) and local dev without any extra config.

> **Why split platforms?** Vercel's serverless model isn't ideal for a persistent Express API, and Render isn't built for serving frontend assets. Letting each platform do what it's good at gives better performance and simpler configuration for both.

---

## Running Locally

### Prerequisites

- Node.js ≥ 18
- A PostgreSQL database (local or [Neon](https://neon.tech) free tier)
- A Redis server (local or [Upstash](https://upstash.com) free tier)
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

> Using Neon? Paste your Neon connection string directly into `DATABASE_URL`. It works the same as local PostgreSQL.

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
| `DATABASE_URL` | ✅ | `postgresql://postgres:postgres@localhost:5432/spurchat` | PostgreSQL connection string (local or Neon) |
| `REDIS_URL` | ✅ | `redis://localhost:6379` | Redis connection string (use `rediss://` for TLS/Upstash) |
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
│   │   │   ├── migrate.ts            # Neon/PostgreSQL pool, Drizzle db export, startup migrations
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
`conversation.ts` handles all data operations: reading from Redis first, falling back to Neon PostgreSQL on cache miss, and invalidating the cache on new writes. `llm.ts` constructs the system prompt from `STORE_KNOWLEDGE`, attaches the last 20 messages as conversation history, and calls the Gemini SDK.

**Database & Cache Layer (`migrate.ts` + `redis.ts`)**
Manages Neon PostgreSQL and Redis connections. Runs startup migrations to ensure the `conversations` and `messages` tables exist before the first request is served.

---

## Key Design Decisions

**Neon PostgreSQL over local/self-hosted**
Neon is serverless PostgreSQL — it connects instantly from both Render (production) and local dev with the same connection string, no infrastructure to manage. It also scales to zero when idle, which keeps costs low for a project like this.

**Drizzle ORM over raw SQL**
Drizzle provides a fully type-safe query interface, which eliminates a whole class of runtime SQL errors. Schema changes are explicit and version-controlled via migration files rather than ad-hoc SQL scripts.

**Fail-Safe Redis Caching (Cache-Aside)**
All Redis calls are wrapped in `try/catch`. If Redis goes offline, the app silently falls back to PostgreSQL for every read — users experience no downtime or errors, just slightly slower history loads. Cache entries are invalidated on every new message write to prevent stale reads.

**Zod Input Validation**
Every API endpoint validates its inputs against a Zod schema at the boundary. This prevents malformed payloads from ever reaching the database or the LLM.

**Split Deployment (Vercel + Render)**
Rather than forcing everything onto one platform, the frontend lives on Vercel (optimized for static/React builds with edge CDN) and the backend on Render (optimized for persistent Node.js services). Each platform does what it's built for.

**Tailwind CSS v4 with CSS Variables**
Custom theme tokens (colors, spacing, animations) are declared directly in `index.css` using CSS custom properties. This avoids a separate `tailwind.config.js` and makes the build faster via the Vite compiler plugin.

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

**No streaming responses**
Gemini supports streaming (`generateContentStream`), but the current implementation waits for the full reply before sending it to the client. Streaming would make the UI feel significantly faster for longer replies — it's the most impactful UX improvement still on the table.

**Fixed history window of 20 messages**
The LLM receives the last 20 messages regardless of their length. For very long conversations, this could push against Gemini's context limit. A smarter approach would be token-counting the history and trimming from the oldest end to stay within a safe budget — using fewer tokens and reducing cost per request.

**Session management is localStorage-only**
Sessions are keyed by a UUID stored in `localStorage`. Simple and stateless, but sessions don't survive clearing browser storage or switching devices. A proper auth layer (even anonymous tokens via cookies) would fix this.

**No rate limiting on the API**
The `/chat/message` endpoint has no per-IP or per-session rate limiting. In production this would need `express-rate-limit` + Redis to prevent abuse and protect the Gemini quota.

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
