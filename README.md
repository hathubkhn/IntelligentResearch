# ResearchBlog

An AI-powered research paper curation and publishing platform. Browse papers with AI-generated summaries, discover related work via semantic search, curate collections, import directly from OpenReview, and publish blog posts — all from a single admin dashboard.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Admin Guide](#admin-guide)
- [Public Features](#public-features)
- [API Reference](#api-reference)
- [Architecture](#architecture)

---

## Features

### For Readers
- **Paper browser** — Search, filter by category / year / tag / venue, paginate through the full library
- **AI summaries** — Every paper gets a TL;DR, problem statement, key idea, results, and numbered contributions
- **Method section** — Optional diagram + description displayed alongside the summary
- **Semantic search** — pgvector-powered similarity search across all summarised papers
- **Related papers** — Automatically surfaced by cosine similarity (pgvector) with a category/tag fallback
- **Collections** — Curated reading lists (e.g. "LLM Survey 2024", "3D Reconstruction & Gaussian Splatting")
- **Reading list** — Save papers to a personal list; synced to DB for logged-in users, localStorage for guests
- **Blog** — Markdown-based articles with cover images, tags, and reading-time estimates

### For Admins
- **Bulk import** — Paste a markdown reading list or upload JSON; auto-parses into a collection
- **OpenReview import** — Search ICLR / NeurIPS / ICML / COLM / TMLR by topic keywords; cherry-pick papers; import in one click
- **AI summarisation** — One-click per paper or batch-process dozens via Server-Sent Events with live progress
- **Paper editor** — Edit every field: metadata, method diagram (upload or URL), AI summary fields, tags
- **Blog editor** — Split-pane Markdown editor with live preview, toolbar, word count, slug, cover image, publish toggle
- **User management** — View and delete GitHub OAuth users

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router, React 19) |
| Language | TypeScript |
| Styling | Tailwind CSS v4, Radix UI, Framer Motion |
| Database | PostgreSQL (Neon) + pgvector extension |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Auth | NextAuth.js v4 — GitHub OAuth + Credentials |
| AI | OpenAI SDK v6 (gpt-4o-mini summaries, text-embedding-3-small vectors) |
| Cache | Upstash Redis (optional, graceful fallback) |
| Background jobs | Inngest v4 (optional, falls back to `next/server` `after()`) |
| Notifications | Sonner |
| Icons | Lucide React |
| Markdown | react-markdown + remark-gfm |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database with the `vector` extension enabled
- OpenAI API key (or a compatible proxy such as LiteLLM)

### Installation

```bash
git clone <repo-url>
cd research-blog
npm install
```

### Configure environment

```bash
cp .env.example .env
# fill in the values — see Environment Variables below
```

### Database setup

```bash
# Apply schema and regenerate Prisma client
npx prisma db push
npx prisma generate
```

Enable the pgvector extension once in your Postgres database:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Create admin account

```bash
# 1. Start the dev server
npm run dev

# 2. Hash your chosen password
curl -X POST http://localhost:3000/api/setup \
  -H 'Content-Type: application/json' \
  -d '{"password":"your-password"}'
# Copy the returned hash into ADMIN_PASSWORD_HASH in .env
```

> `/api/setup` is disabled in production (`NODE_ENV=production`).

### Run dev server

```bash
npm run dev
# → http://localhost:3000

# Optional: Inngest dev server for background summarisation jobs
npx inngest-cli@latest dev
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✅ | Random string ≥ 32 chars for JWT signing |
| `NEXTAUTH_URL` | ✅ | App origin, e.g. `http://localhost:3000` |
| `OPENAI_API_KEY` | ✅ | OpenAI key or LiteLLM proxy token |
| `ADMIN_EMAIL` | ✅ | Admin login email |
| `ADMIN_PASSWORD_HASH` | ✅ | bcrypt hash — generate via `/api/setup` |
| `GITHUB_CLIENT_ID` | ✅ | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | ✅ | GitHub OAuth App client secret |
| `OPENAI_BASE_URL` | optional | Custom endpoint (e.g. LiteLLM). Must end with `/v1` |
| `OPENAI_SUMMARY_MODEL` | optional | Override model (default: `gpt-4o-mini`) |
| `UPSTASH_REDIS_REST_URL` | optional | Upstash Redis URL for caching |
| `UPSTASH_REDIS_REST_TOKEN` | optional | Upstash Redis token |
| `INNGEST_DEV` | optional | Set to `1` to enable Inngest in dev |
| `INNGEST_SIGNING_KEY` | optional | Inngest signing key for production |

### GitHub OAuth App setup

1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
2. Set **Authorization callback URL** to `http://localhost:3000/api/auth/callback/github`
3. Copy the Client ID and Client Secret into `.env`

---

## Database Setup

### Schema models

| Model | Purpose |
|---|---|
| `Paper` | Research paper with metadata, AI summary fields, pgvector embedding |
| `Collection` | Named grouping of papers |
| `Post` | Blog article (Markdown content, tags, cover image, publish state) |
| `User` | GitHub OAuth user |
| `Account` | OAuth provider link |
| `Session` | JWT session token |
| `SavedPaper` | User ↔ Paper reading list (many-to-many) |

### After schema changes

```bash
npx prisma db push        # sync schema to DB
npx prisma generate       # regenerate client
# restart the dev server — the global Prisma singleton caches the old client
```

---

## Admin Guide

All admin pages live at `/admin/*` and require credentials login at `/admin/login`.

### Importing papers

#### Option 1 — Markdown upload (`/admin/upload`)

Paste or upload a markdown reading list in this format:

```markdown
## Section Name

* **Paper Title**, Venue YYYY [[paper](https://arxiv.org/...)] [[code](https://github.com/...)]
* **Another Paper**, NeurIPS 2024 [[paper](https://openreview.net/...)]
```

The parser extracts title, venue, year, paper URL, and code URL. A collection is created automatically from the section name.

#### Option 2 — JSON upload (`/admin/upload`)

Upload a JSON file:

```json
[
  {
    "title": "Paper Title",
    "venue": "ICLR",
    "year": 2025,
    "paperUrl": "https://openreview.net/forum?id=...",
    "codeUrl": "https://github.com/..."
  }
]
```

#### Option 3 — OpenReview import (`/admin/openreview`)

Search accepted papers directly from OpenReview.net — no API key required:

1. Select **conference** (ICLR, NeurIPS, ICML, COLM, TMLR, AISTATS, UAI) and **year**
2. Enter **topic keywords** (comma-separated) or click a quick preset
3. Click **Search** — papers are scored by keyword hits in title, primary area, keywords, and abstract
4. Check the papers you want and optionally assign to a **collection**
5. Click **Import** — duplicates are automatically skipped

Supported conferences and years:

| Conference | Available years |
|---|---|
| ICLR | 2022 – 2025 |
| NeurIPS | 2021 – 2024 |
| ICML | 2022 – 2025 |
| COLM | 2024 – 2025 |
| TMLR | 2022 – 2025 |
| AISTATS | 2024 – 2025 |
| UAI | 2023 – 2024 |

### Generating summaries

#### Single paper

Open any paper in `/admin/papers/[id]` and click **Summarize**. The page polls for completion when the job runs asynchronously.

#### Batch summarisation (`/admin/upload`)

After importing, click **Summarize all pending**. A live SSE progress stream shows each paper as it processes. Up to 50 papers per batch.

The AI generates:

| Field | Description |
|---|---|
| TL;DR | One-sentence summary |
| Problem | Gap this paper addresses |
| Key idea | Core technical contribution |
| Results | Key numbers and benchmarks |
| Contributions | Numbered bullet list |
| Tags | Automatically extracted keywords |
| Method description | Prose description of the architecture (optional) |

After summarisation, a **pgvector embedding** (1536 dims) is generated for semantic search and related-paper recommendations.

### Writing blog posts (`/admin/blog`)

1. Click **New Post** — a draft is created and you land in the editor
2. Write in the **Markdown editor** with the toolbar (bold, italic, headings, code, blockquote, lists, links, images, dividers)
3. Switch to **Preview** to see rendered output with the public styles
4. Fill in the sidebar: URL slug, cover image URL, tags
5. **Save** at any time, then **Publish** when ready — reading time is calculated automatically

---

## Public Features

### Paper browsing (`/papers`)

- Full-text search across titles and TL;DRs
- Filter by category, year, tag, summary status
- 20 papers per page with pagination
- Faceted sidebar with available filter values

### Paper detail (`/papers/[id]`)

- AI summary block: TL;DR, problem, key idea, results, contributions
- Method section: diagram + description (side-by-side on large screens)
- Sidebar: Read Paper / Code / OpenReview / arXiv links, BibTeX citation, authors list, Save button
- Related papers: up to 5 semantically similar papers via pgvector, falling back to same category/tags then newest

### Collections (`/collections`, `/collections/[id]`)

Curated groupings maintained by the admin. Default collections:

- LLM Survey 2024
- Bioinformatics & Genomics AI
- Healthcare VLM & Medical Imaging
- 3D Reconstruction & Gaussian Splatting
- Efficient LLMs & Quantization
- Reasoning & Mathematical Problem Solving
- Embodied AI & Robot Learning
- Multimodal Foundation Models

### Reading list (`/saved`)

- Authenticated users: saved papers stored in PostgreSQL, synced across devices
- Guest users: saved to localStorage, with a prompt to sign in
- BibTeX export of the entire reading list

### Blog (`/blog`, `/blog/[slug]`)

Published articles with Markdown rendering (GFM — tables, strikethrough, task lists), syntax-styled code blocks, cover images, tag pills, and reading-time estimate.

---

## API Reference

### Papers

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/papers` | List papers. Params: `q`, `category`, `year`, `status`, `collectionId`, `page`, `limit` |
| `POST` | `/api/papers` | Create a paper |
| `GET` | `/api/papers/[id]` | Get single paper with collection |
| `PATCH` | `/api/papers/[id]` | Update paper (busts ISR + Redis cache) |
| `DELETE` | `/api/papers/[id]` | Delete paper |

### Summarisation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/summarize/[id]` | Summarise a paper. Add `?force=true` to re-run. Returns `202` for async |
| `POST` | `/api/summarize/batch` | Batch-summarise pending/error papers via SSE stream |

### Search

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/search/semantic?q=...` | Semantic similarity search, returns top 10 |

### Collections

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/collections` | List all collections with paper counts |
| `GET` | `/api/collections/[id]` | Get a single collection |

### Blog posts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/posts` | List posts. Params: `published`, `tag`, `page`, `limit` |
| `POST` | `/api/posts` | Create post (title → auto-slug) |
| `GET` | `/api/posts/[id]` | Get post |
| `PATCH` | `/api/posts/[id]` | Update post (auto-calculates reading time) |
| `DELETE` | `/api/posts/[id]` | Delete post |

### User reading list

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/user/saved` | Get saved paper IDs for current user |
| `POST` | `/api/user/saved` | Save a paper — body: `{ paperId }` |
| `DELETE` | `/api/user/saved/[paperId]` | Remove paper from saved list |

### OpenReview import (admin)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/openreview` | Search OpenReview. Params: `conference`, `year`, `topics`, `limit` |
| `POST` | `/api/admin/openreview/import` | Import papers — body: `{ papers, collectionId? }` |

### Uploads (admin)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload/image` | Upload image (multipart). Returns `{ url }` |
| `POST` | `/api/upload/markdown` | Parse + import markdown reading list |
| `POST` | `/api/upload/json` | Parse + import JSON paper list |

### Admin utilities

| Method | Endpoint | Description |
|---|---|---|
| `DELETE` | `/api/admin/users/[id]` | Delete a user |
| `POST` | `/api/setup` | Generate bcrypt hash for admin password (dev only) |

---

## Architecture

```
src/
├── app/
│   ├── admin/              # Admin dashboard (auth-gated by middleware)
│   │   ├── blog/           # Blog post management + editor
│   │   ├── openreview/     # OpenReview paper search & import
│   │   ├── papers/         # Paper list + per-paper editor
│   │   ├── upload/         # Markdown / JSON bulk import + batch summarise
│   │   └── users/          # User management
│   ├── api/                # All API routes
│   │   ├── admin/          # Admin-only endpoints
│   │   ├── papers/         # Paper CRUD
│   │   ├── posts/          # Blog post CRUD
│   │   ├── search/         # Semantic search
│   │   ├── summarize/      # AI summarisation + batch SSE
│   │   ├── upload/         # File upload handlers
│   │   └── user/           # Reading list endpoints
│   ├── blog/               # Public blog list + post detail
│   ├── collections/        # Collections browser + detail
│   ├── papers/             # Paper browser + detail
│   └── saved/              # Reading list page
├── components/
│   ├── admin/              # Admin-specific UI (MarkdownEditor, PaperTable…)
│   ├── blog/               # PostCard
│   ├── layout/             # Navbar, Footer, ConditionalNav, Providers
│   ├── paper/              # PaperCard, PaperDetail, PaperSummaryBlock, RelatedPapers, SaveButton
│   ├── search/             # SearchBar, FilterPanel
│   └── ui/                 # Design system — Button, Input, Badge, Card, Skeleton
├── inngest/
│   ├── client.ts           # Inngest client
│   └── summarize.ts        # Background summarisation job definition
├── lib/
│   ├── auth.ts             # NextAuth config (GitHub + Credentials providers)
│   ├── cache.ts            # Upstash Redis wrapper with graceful fallback
│   ├── openai.ts           # summarizePaper(), generateEmbedding(), summarizeBatch()
│   ├── parsers/            # Markdown + JSON reading-list parsers
│   ├── prisma.ts           # Singleton PrismaClient with PrismaPg adapter
│   └── utils.ts            # cn(), CATEGORY_COLORS, VENUE_TIERS, formatters
├── middleware.ts            # Protects /admin/* — redirects to /admin/login
└── types/
    ├── paper.ts            # Paper, SummaryResult interfaces
    └── post.ts             # Post interface
```

### AI summarisation flow

```
Admin clicks "Summarize"
  → POST /api/summarize/[id]
  → Sets paper.status = PROCESSING, returns 202
  → If Inngest configured → fires paper/summarize event → worker picks up
  → Else → schedules via next/server after() (fires post-response)
  → Worker calls OpenAI gpt-4o-mini with structured JSON prompt
  → Updates paper: tldr, problem, keyIdea, results, contributions, tags
  → Calls text-embedding-3-small → stores 1536-dim vector in pgvector
  → Sets paper.status = DONE (or ERROR with errorMessage)
  → Admin UI polls /api/papers/[id] every 3 s until status changes
```

### Caching strategy

| Layer | Scope | TTL |
|---|---|---|
| Redis | Paper list pages, keyed by all query params | 60 s |
| Next.js ISR | Paper detail pages, blog posts | 3600 s |
| Cache invalidation | On any `PATCH` / `DELETE` → `invalidatePattern("papers:*")` + `revalidatePath()` | immediate |

---

## Development Notes

- **Schema changes** — always run `npx prisma db push && npx prisma generate`, then **restart the dev server**. The global Prisma singleton caches the client instance in `globalThis`; a hot-reload does not create a new one.
- **Inngest** — run `npx inngest-cli@latest dev` alongside `npm run dev`. Without it, summarisation still works via `after()`, which fires after the HTTP response is sent.
- **LiteLLM / custom OpenAI proxy** — set `OPENAI_BASE_URL`. The app enforces the `/v1` suffix automatically.
- **pgvector** — if the extension is missing, summarisation still works but semantic search and related-paper similarity are disabled. The app falls back to category/tag matching for related papers.
- **Redis** — if `UPSTASH_REDIS_REST_URL` is not set, the cache layer is silently skipped. All features work without it, just without the caching benefit.
