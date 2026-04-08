# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm run test         # Vitest (watch mode)
npm run test:run     # Vitest (single run)

# Database
npm run db:push      # Apply schema to database (no migration history)
npm run db:migrate   # Create and apply a migration (dev)
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:studio    # Open Prisma Studio

# First-time local setup
npm run setup        # Installs, starts Docker (postgres + redis), pushes schema
```

## Environment Variables

Required in `.env` / `.env.local`:
- `DATABASE_URL` / `DIRECT_URL` — PostgreSQL with pgvector (Supabase in prod, Docker locally)
- `REDIS_URL` — Redis (Upstash in prod, Docker locally)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth app
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL`
- `HUGGINGFACE_API_KEY` — Used for both embeddings and LLM inference
- `GEMINI_API_KEY` — Optional alternative LLM

Local dev uses Docker Compose (postgres:5432, redis:6379). Run `npm run docker:up` to start containers.

## Architecture

**Next.js 14 App Router** with PostgreSQL + pgvector (Supabase), Redis (Upstash), NextAuth GitHub OAuth.

### Core RAG Pipeline

1. **Ingest** — User triggers POST `/api/repos/[id]/ingest` → pipeline fetches files from GitHub API, splits into semantic chunks (60-line max, 5-line overlap, language-aware boundary detection), generates 768-dim embeddings via HuggingFace `sentence-transformers/all-mpnet-base-v2`, stores in pgvector
2. **Query** — User question is embedded with the same model → cosine similarity search via raw SQL (`<=>` operator) → top-K chunks injected as context into `Qwen/Qwen2.5-72B-Instruct` prompt → response streamed via SSE

### Key Directories

- `src/lib/ingestion/` — `pipeline.ts` (7-phase orchestration), `chunker.ts` (language-aware splitting), `github.ts` (paginated GitHub API)
- `src/lib/db/vectors.ts` — Raw SQL for pgvector cosine similarity search and batch embedding storage
- `src/lib/llm/` — Provider abstraction; `index.ts` exports the active provider. Swap by changing the export (HuggingFace default, Gemini available)
- `src/lib/retrieval/` — Embeds a query, searches similar chunks, formats context string for LLM
- `src/lib/analysis/` — Specialized generation: code review, bug explanation, doc generation, architecture overview
- `src/lib/auth/` — NextAuth config with PrismaAdapter + GitHub OAuth; `requireAuth()` used in all API routes

### API Routes (`src/app/api/`)

- `repos/route.ts` — Merges GitHub API repos with DB status/stats
- `repos/[id]/ingest/route.ts` — Creates `Job` record, runs `ingestRepository()` async with `onProgress` callbacks updating the job row
- `repos/[id]/query/route.ts` — SSE streaming; requires `repo.status === "READY"`
- `repos/[id]/review|explain|docs|overview` — Analysis endpoints (one-shot, not streamed)
- `conversations/[id]/route.ts` — Chat history CRUD

### Database Schema (key models)

- **Repository** — status enum: `PENDING | INGESTING | READY | ERROR | STALE`
- **CodeChunk** — file path, line range, chunk type, content; one-to-one with **Embedding** (vector(768))
- **Job** — tracks ingestion progress: `progress`, `total`, `metadata.phase`, status enum
- **Conversation / Message** — chat history with `contextChunks[]` (chunk IDs used for the answer)

### Ingestion Progress Tracking

The `Job` model stores live progress. `ingestRepository()` accepts `onProgress(phase, progress, total)` and `onError(error)` callbacks. The ingest route updates the `Job` row on each callback. Phases in order: `"Fetching file tree"` → `"Processing files"` → `"Storing chunks"` → `"Generating embeddings"` → `"Creating search index"` → `"Complete"`.

### Streaming Pattern

Query route returns `text/event-stream`. SSE format:
```
data: {"text": "chunk", "done": false}
data: {"done": true, "conversationId": "..."}
```

### Auth Flow

GitHub OAuth → NextAuth callback → PrismaAdapter upserts User + Account → session stored in DB → subsequent API calls retrieve `account.access_token` from DB for GitHub API calls.
