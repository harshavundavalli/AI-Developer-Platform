# AI Developer Platform

An AI-powered platform that lets developers connect their GitHub repositories and query them using natural language. Built with RAG (Retrieval Augmented Generation) — your questions are answered using the actual source code as context.

**Live Demo:** https://ai-developer-platform.vercel.app

---

## What it does

- **Connect GitHub repos** — sign in with GitHub and see all your repositories
- **Ingest & embed** — files are chunked and embedded using HuggingFace's `sentence-transformers/all-mpnet-base-v2` model, stored as vectors in PostgreSQL
- **Ask questions** — chat with your codebase using natural language. Answers are grounded in real code with file paths and line numbers
- **AI analysis** — auto-generate code reviews, documentation, architecture overviews, and explanations for any ingested repo

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | NextAuth.js + GitHub OAuth |
| Database | PostgreSQL + pgvector (Supabase) |
| Cache | Redis (Upstash) |
| ORM | Prisma |
| LLM | HuggingFace `Qwen/Qwen2.5-72B-Instruct` |
| Embeddings | HuggingFace `sentence-transformers/all-mpnet-base-v2` (768-dim) |
| Hosting | Vercel |
| Styling | Tailwind CSS |

---

## How it works

1. **Ingestion** — when you click "Ingest" on a repo, the pipeline fetches all files from GitHub, splits them into semantic chunks (language-aware), generates 768-dimensional embeddings via HuggingFace, and stores them in pgvector
2. **Retrieval** — when you ask a question, it's embedded using the same model, then a cosine similarity search finds the most relevant code chunks
3. **Generation** — the retrieved chunks are injected as context into the LLM prompt. The model streams its response back via Server-Sent Events (SSE)

---

## Local Development

**Prerequisites:** Node.js 18+, PostgreSQL with pgvector, Redis

1. Clone the repo
   ```bash
   git clone https://github.com/harshavundavalli/AI-Developer-Platform
   cd AI-Developer-Platform
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env.local` file for local overrides:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aidevplatform
   DIRECT_URL=postgresql://postgres:postgres@localhost:5432/aidevplatform
   REDIS_URL=redis://localhost:6379
   NEXTAUTH_URL=http://localhost:3000
   ```

4. Fill in your API keys in `.env`:
   ```
   GITHUB_CLIENT_ID=your_github_oauth_client_id
   GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
   NEXTAUTH_SECRET=your_random_secret        # openssl rand -base64 32
   HUGGINGFACE_API_KEY=your_hf_token
   ```

5. Set up the database
   ```bash
   npx prisma db push
   ```

6. Run the dev server
   ```bash
   npm run dev
   ```

---

## Deployment

Deployed on **Vercel + Supabase + Upstash** — 100% free.

| Service | Purpose | Free Tier |
|---|---|---|
| Vercel | Next.js hosting | Unlimited deploys |
| Supabase | PostgreSQL + pgvector | 500MB storage |
| Upstash | Redis | 10k commands/day |

### Steps
1. Push code to GitHub
2. Create a Supabase project, enable pgvector, run `npx prisma db push`
3. Create an Upstash Redis database
4. Import repo on Vercel, add all environment variables, deploy
5. Update GitHub OAuth app callback URL to your Vercel domain

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/        # Protected pages (repos, chat, analysis)
│   ├── api/                # API routes (auth, repos, conversations)
│   └── login/              # Login page
├── components/             # Reusable UI components
├── lib/
│   ├── auth/               # NextAuth config, session helpers
│   ├── db/                 # Prisma client
│   ├── ingestion/          # GitHub fetching, chunking, pipeline
│   ├── llm/                # HuggingFace + Gemini provider abstraction
│   ├── retrieval/          # Vector search (pgvector cosine similarity)
│   └── analysis/           # Code review, docs, overview generation
└── types/                  # TypeScript type definitions
prisma/
└── schema.prisma           # Database schema with pgvector extension
```

---

## License

MIT
