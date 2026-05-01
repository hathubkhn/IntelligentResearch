import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateEmbedding } from '@/lib/openai'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return Response.json({ results: [] })

  let embedding: number[]
  try {
    embedding = await generateEmbedding(q)
  } catch (e) {
    return Response.json({ error: 'Embedding generation failed' }, { status: 503 })
  }

  const vector = `[${embedding.join(',')}]`

  type Row = {
    id: string
    title: string
    tldr: string | null
    year: number | null
    venue: string | null
    category: string | null
    similarity: number
  }

  const results = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT id, title, tldr, year, venue, category,
       1 - (embedding <=> $1::vector) AS similarity
     FROM "Paper"
     WHERE embedding IS NOT NULL
       AND status = 'DONE'
     ORDER BY embedding <=> $1::vector
     LIMIT 10`,
    vector,
  )

  return Response.json({ results })
}
