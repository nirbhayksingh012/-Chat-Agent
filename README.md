# Spur Chat — AI Support Agent

A full-stack, AI-powered live chat widget for a fictional e-commerce store (**Nova Store**), built as a take-home assignment for Spur.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite + Tailwind CSS v4 |
| **Backend** | Node.js + TypeScript + Express |
| **Database** | PostgreSQL (managed via Drizzle ORM) |
| **Caching** | Redis (using Cache-Aside reads & invalidation writes) |
| **LLM** | Google Gemini (2.5 Flash / 3.5 Flash) via `@google/genai` |

---

## Running Locally

### Prerequisites
- Node.js ≥ 18
- A PostgreSQL database instance (running locally, via Docker, or hosted in the cloud)
- A Redis server instance (running locally, via Docker, or hosted in the cloud)
- A Google Gemini API key ([get one here](https://aistudio.google.com/))

### Step-by-Step Setup

#### 1. Clone the repository
```bash
git clone <repo-url>
cd spur-chat
```

#### 2. Set up the Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
3. Open `backend/.env` and configure your variables:
   * Paste your Gemini API key in `GEMINI_API_KEY`.
   * Set your PostgreSQL connection URL in `DATABASE_URL`.
   * Set your Redis connection URL in `REDIS_URL`.
4. Install packages:
   ```bash
   npm install
   ```
5. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The server runs migrations automatically to create tables at startup. The backend will list on **http://localhost:3001**.*

#### 3. Set up the Frontend
1. In a new terminal tab, navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   *The frontend starts at **http://localhost:5173**.*
4. Open **http://localhost:5173** in your browser.

---

## Environment Variables Configuration

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | — | Google Gemini developer API key |
| `DATABASE_URL` | ✅ | `postgresql://postgres:postgres@localhost:5432/spurchat` | PostgreSQL database connection string |
| `REDIS_URL` | ✅ | `redis://localhost:6379` (or `rediss://` for TLS) | Redis server connection string |
| `PORT` | No | `3001` | Port Express server listens on |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origin |

---

## Architecture Overview

```
spur-chat/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Server boot coordinator, Redis connect, graceful shutdown
│   │   ├── db/
│   │   │   ├── migrate.ts        # PG connection Pool, Drizzle db export, startup migrations
│   │   │   ├── schema.ts         # Tables & indexes definitions (conversations, messages)
│   │   │   ├── redis.ts          # Redis client client connections and logs
│   │   │   └── seed.ts           # Store policy prompts (STORE_KNOWLEDGE FAQ constant)
│   │   ├── routes/
│   │   │   └── chat.ts           # POST /chat/message, GET /chat/history/:id endpoints
│   │   └── services/
│   │       ├── conversation.ts   # Caching layer, reads from Redis first, deletes on writes
│   │       └── llm.ts            # generateReply() — Google Gemini SDK integration
│   ├── tsconfig.json             # TypeScript compiler settings
│   └── drizzle.config.ts         # Drizzle kit configuration file
└── frontend/
    ├── src/
    │   ├── main.jsx              # Mounts React and imports index.css
    │   ├── App.jsx               # Styled React chat window UI (Tailwind CSS v4 classes)
    │   ├── index.css             # Tailwind v4 import, custom brand variables, micro-animations
    │   ├── vite-env.d.ts         # Global Vite client type declarations
    │   └── lib/
    │       └── api.js            # sendMessage(), loadHistory() Fetch API helpers
    └── vite.config.js            # Vite configurations with tailwindcss() Vite plugin
```

### Module Breakdown:
* **Controller Layer ([chat.ts](file:///d:/nirbhay/spur-chat/backend/src/routes/chat.ts)):** Receives client requests. Validates inputs using **Zod** (ensuring correct parameters and message length) before passing data to the services layer.
* **Service Layer ([conversation.ts](file:///d:/nirbhay/spur-chat/backend/src/services/conversation.ts) & [llm.ts](file:///d:/nirbhay/spur-chat/backend/src/services/llm.ts)):** Contains core logic. `conversation` manages DB operations and cache lookups. `llm` coordinates prompt construction and triggers AI model requests.
* **Database & Caching Configuration ([migrate.ts](file:///d:/nirbhay/spur-chat/backend/src/db/migrate.ts) & [redis.ts](file:///d:/nirbhay/spur-chat/backend/src/db/redis.ts)):** Coordinates connections to PostgreSQL and Redis. Runs startup migrations automatically to build DB tables and indexes.

### Key Design Decisions:
* **Drizzle ORM & PostgreSQL:** Relies on PostgreSQL for production-ready relational data persistence. Drizzle ORM provides a type-safe interface for tables, preventing runtime SQL errors.
* **Fail-Safe Redis Caching (Cache-Aside):** Speeds up history reads by saving serialized message arrays in Redis. All Redis calls are protected by try-catch blocks; if Redis goes offline, the app automatically falls back to fetching directly from PostgreSQL, guaranteeing zero downtime.
* **Tailwind CSS v4 Integration:** Styled with Tailwind CSS v4 using its compiler plugin for Vite. Custom theme colors and bounce keyframes are declared inside [index.css](file:///d:/nirbhay/spur-chat/frontend/src/index.css) using CSS variables, keeping compilation fast.

---

## LLM Notes

* **Provider:** **Google Gemini** (`gemini-2.5-flash` as primary, falling back to `gemini-3.5-flash` if rate limited or interrupted).
* **Prompting Strategy:**
  * System prompts are loaded from [seed.ts](file:///d:/nirbhay/spur-chat/backend/src/db/seed.ts) (`STORE_KNOWLEDGE`). It explicitly instructs the model on Nova Store's shipping fees, return window (30 days), payments, support contacts, and tone expectations (friendly, concise, under 150 words).
  * **History Window:** Fetches the last 20 messages (~10 turns of conversation) from the database and forwards it to Gemini with every new user message to provide full context.
* **Error Handling:** If Gemini throws an exception (e.g. key expiry or API failure), a friendly fallback banner is sent to the client and saved in PostgreSQL, maintaining the session's chat history flow.
