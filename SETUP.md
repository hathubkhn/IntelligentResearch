# Setup Guide

## 1. Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally or a hosted instance (Neon, Supabase, etc.)

## 2. Environment Variables

Edit `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/research_blog"
OPENAI_API_KEY="sk-..."
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD_HASH=""   # see step 4
```

## 3. Database Migration

```bash
npx prisma migrate dev --name init
```

## 4. Set Admin Password

Start the dev server, then run:

```bash
curl -X POST http://localhost:3000/api/setup \
  -H "Content-Type: application/json" \
  -d '{"password":"your-admin-password"}'
```

Copy the returned `hash` value and paste it as `ADMIN_PASSWORD_HASH` in `.env`.
Restart the dev server.

## 5. Remove Conflicting File

```bash
rm "src/app/(public)/page.tsx"
```

This removes a route conflict with `src/app/page.tsx` (both map to `/`).

## 6. Run

```bash
npm run dev
```

Visit:
- **Public**: http://localhost:3000
- **Admin**: http://localhost:3000/admin (login with ADMIN_EMAIL + password)

## Upload Papers

1. Go to `/admin/upload`
2. Paste a GitHub-style markdown reading list
3. Click "Preview papers" → "Import X papers"
4. Click "Generate AI summaries"
