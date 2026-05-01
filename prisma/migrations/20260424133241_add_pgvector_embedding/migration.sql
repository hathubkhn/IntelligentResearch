-- Enable pgvector extension (available on Neon, Supabase, and standard Postgres 15+)
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "Paper" ADD COLUMN "embedding" vector(1536);

-- Index for fast cosine-similarity search
CREATE INDEX ON "Paper" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
