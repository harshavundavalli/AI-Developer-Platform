# AI Developer Productivity Platform

AI-powered developer productivity platform that integrates with GitHub to automate code review, bug explanation, documentation generation, and natural-language repository Q&A.

**100% free-tier stack** — $0/month to run.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) |
| Database | PostgreSQL 16 + pgvector |
| LLM | Google Gemini 2.0 Flash (free) |
| Embeddings | Gemini text-embedding-004 (768d) |
| Auth | NextAuth.js + GitHub OAuth |
| Queue | BullMQ + Redis |
| Hosting | Vercel (free) + Railway (free) |
| CI/CD | GitHub Actions |

## Features

- **Repository Q&A** — Ask natural-language questions, get answers grounded in your actual code
- **AI Code Review** — Paste code and get severity-rated issues with fix suggestions
- **Bug Explanation** — Paste errors/stack traces and get root cause analysis
- **Documentation Generation** — Auto-generate JSDoc, module docs, or README sections
- **RAG Pipeline** — Code is chunked, embedded, and retrieved via vector similarity search

## Prerequisites

- Node.js 20+
- Docker Desktop
- GitHub account
- Google Gemini API key (free from [ai.google.dev](https://ai.google.dev))

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/ai-dev-platform.git
cd ai-dev-platform
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — Create a [GitHub OAuth App](https://github.com/settings/developers)
  - Homepage URL: `http://localhost:3000`
  - Callback URL: `http://localhost:3000/api/auth/callback/github`
- `GEMINI_API_KEY` — Get free from [Google AI Studio](https://ai.google.dev)
- `NEXTAUTH_SECRET` — Generate with `openssl rand -base64 32`

### 3. Start local services

```bash
docker compose up -d
```

This starts PostgreSQL (with pgvector) and Redis.

### 4. Set up database

```bash
npx prisma generate
npx prisma db push
```

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with GitHub.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   │   ├── auth/           # NextAuth endpoints
│   │   ├── repos/          # Repository CRUD + ingestion
│   │   └── conversations/  # Chat history
│   ├── (auth)/             # Login page
│   └── (dashboard)/        # Authenticated pages
│       ├── repos/          # Repository list
│       ├── chat/           # Chat interface
│       └── settings/       # Settings page
├── components/             # React components
├── lib/                    # Core business logic
│   ├── auth/               # NextAuth config
│   ├── db/                 # Prisma + pgvector helpers
│   ├── ingestion/          # GitHub API, chunking, pipeline
│   ├── embedding/          # Gemini embedding service
│   ├── retrieval/          # Vector search + context assembly
│   ├── analysis/           # LLM analysis (review, explain, docs)
│   ├── llm/                # LLM provider abstraction (Gemini)
│   └── utils/              # Shared utilities
└── types/                  # TypeScript type definitions
```

## Architecture

### RAG Pipeline

1. **Ingest** — Clone repo via GitHub API, walk file tree
2. **Chunk** — Split code into semantic chunks (functions, classes, blocks)
3. **Embed** — Generate 768-dim vectors via Gemini text-embedding-004
4. **Store** — Save vectors in PostgreSQL/pgvector
5. **Query** — Embed user question → similarity search → retrieve top-K chunks
6. **Generate** — Send chunks as context to Gemini Flash → stream response

### Module Boundaries

Each `src/lib/*` module has a clean interface and maps to a future microservice:

- `auth` → Auth Service
- `ingestion` → Ingestion Service
- `embedding` → Embedding Service
- `retrieval` → Retrieval Service
- `analysis` → Analysis Service
- `llm` → LLM Gateway

## Deployment

### Vercel (Frontend + API)

1. Connect your GitHub repo to [Vercel](https://vercel.com)
2. Add environment variables in Vercel dashboard
3. Deploy — automatic on push to `main`

### Railway (Database + Redis)

1. Create a [Railway](https://railway.app) project
2. Add PostgreSQL service (pgvector extension is auto-available)
3. Add Redis service
4. Copy connection strings to Vercel env vars

### Database Migrations (Production)

```bash
npx prisma migrate deploy
```

## Testing

```bash
npm run test        # Watch mode
npm run test:run    # Single run
```

## Free Tier Limits

| Service | Limit |
|---------|-------|
| Gemini API | 15 RPM, 1,500 req/day |
| Vercel Hobby | 100 GB bandwidth |
| Railway PG | 500 MB storage |
| Railway Redis | 500 MB memory |
| GitHub Actions | 2,000 min/month |

## License

MIT
