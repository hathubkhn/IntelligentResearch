import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateEmbedding } from '@/lib/openai'

function getUserId(session: { user?: { id?: string } } | null) {
  const id = session?.user?.id
  return id && id !== 'admin' ? id : null
}

export interface SavedSearchResult {
  id: string
  title: string
  authors: string[]
  year: number | null
  venue: string | null
  venueType: string | null
  category: string | null
  tags: string[]
  isPublished: boolean
  paperUrl: string | null
  codeUrl: string | null
  openReviewUrl: string | null
  arxivId: string | null
  rawInput: string
  tldr: string | null
  problem: string | null
  keyIdea: string | null
  results: string | null
  contributions: string[]
  methodDiagram: string | null
  methodDescription: string | null
  coverColor: string | null
  status: string
  errorMessage: string | null
  collectionId: string | null
  createdAt: string
  updatedAt: string
  similarity?: number
}

export interface Facets {
  venues:     string[]
  years:      number[]
  categories: string[]
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as { user?: { id?: string } } | null
  const userId = getUserId(session)
  if (!userId) return Response.json({ papers: [], facets: { venues: [], years: [], categories: [] } })

  const sp       = req.nextUrl.searchParams
  const q        = sp.get('q')?.trim() ?? ''
  const venue    = sp.get('venue') ?? ''
  const yearStr  = sp.get('year')
  const category = sp.get('category') ?? ''
  const year     = yearStr ? parseInt(yearStr) : null

  // ── Fetch user's saved paper IDs ─────────────────────────────────────────────
  const saved = await prisma.savedPaper.findMany({
    where: { userId },
    select: { paperId: true },
    orderBy: { savedAt: 'desc' },
  })
  const ids = saved.map(s => s.paperId)
  if (ids.length === 0) {
    return Response.json({ papers: [], facets: { venues: [], years: [], categories: [] } })
  }

  // ── Facets — always computed from ALL saved papers ────────────────────────────
  const allPapers = await prisma.paper.findMany({
    where: { id: { in: ids } },
    select: { venue: true, year: true, category: true },
  })
  const facets: Facets = {
    venues:     [...new Set(allPapers.map(p => p.venue).filter((v): v is string => !!v))].sort(),
    years:      [...new Set(allPapers.map(p => p.year).filter((y): y is number => y != null))].sort((a, b) => b - a),
    categories: [...new Set(allPapers.map(p => p.category).filter((c): c is string => !!c))].sort(),
  }

  // ── Semantic search (when query given) ────────────────────────────────────────
  if (q) {
    // 1. Keyword search across ALL saved papers (regardless of embedding)
    //    Split query into tokens, require all to appear in title or tldr
    const terms = q.split(/\s+/).filter(Boolean)
    const keywordWhere = {
      id: { in: ids },
      AND: terms.map(t => ({
        OR: [
          { title:   { contains: t, mode: 'insensitive' as const } },
          { tldr:    { contains: t, mode: 'insensitive' as const } },
          { problem: { contains: t, mode: 'insensitive' as const } },
          { keyIdea: { contains: t, mode: 'insensitive' as const } },
        ],
      })),
      ...(venue    ? { venue:    { contains: venue,    mode: 'insensitive' as const } } : {}),
      ...(year !== null ? { year } : {}),
      ...(category ? { category: { equals: category } } : {}),
    }

    // 2. Semantic (vector) search for papers WITH embeddings
    let vectorPapers: (SavedSearchResult & { similarity: number })[] = []
    try {
      const embedding = await generateEmbedding(q)
      const vector    = `[${embedding.join(',')}]`
      const idList    = ids.map(id => `'${id}'`).join(', ')

      const params: unknown[] = [vector]
      const extraConds: string[] = []
      if (venue) {
        params.push(`%${venue}%`)
        extraConds.push(`venue ILIKE $${params.length}`)
      }
      if (year !== null) {
        params.push(year)
        extraConds.push(`year = $${params.length}`)
      }
      if (category) {
        params.push(category)
        extraConds.push(`category = $${params.length}`)
      }
      const filterClause = extraConds.length ? `AND ${extraConds.join(' AND ')}` : ''

      type Row = SavedSearchResult & { similarity: number }
      vectorPapers = await prisma.$queryRawUnsafe<Row[]>(
        `SELECT id, title, authors, year, venue, "venueType", category, tags,
                "isPublished", "paperUrl", "codeUrl", "openReviewUrl", "arxivId",
                "rawInput", tldr, problem, "keyIdea", results, contributions,
                "methodDiagram", "methodDescription", "coverColor", status,
                "errorMessage", "collectionId", "createdAt", "updatedAt",
                ROUND(CAST(1 - (embedding <=> $1::vector) AS numeric), 4) AS similarity
         FROM "Paper"
         WHERE id IN (${idList})
           AND embedding IS NOT NULL
           ${filterClause}
         ORDER BY embedding <=> $1::vector
         LIMIT 60`,
        ...params,
      )
    } catch { /* embedding generation failed — fall back to keyword only */ }

    // 3. Fetch keyword-matched papers (catches papers with no embedding)
    const keywordPapers = await prisma.paper.findMany({ where: keywordWhere })

    // 4. Merge: vector results first (with similarity), then keyword-only extras
    const seenIds = new Set(vectorPapers.map(p => p.id))
    const keywordOnly = keywordPapers
      .filter(p => !seenIds.has(p.id))
      .map(p => ({ ...p, similarity: null } as unknown as SavedSearchResult & { similarity: number }))

    const papers = [...vectorPapers, ...keywordOnly]
    return Response.json({ papers, facets, query: q })
  }

  // ── No query — return all papers with optional filters ────────────────────────
  const papers = await prisma.paper.findMany({
    where: {
      id: { in: ids },
      ...(venue    ? { venue:    { contains: venue,    mode: 'insensitive' } } : {}),
      ...(year !== null ? { year } : {}),
      ...(category ? { category: { equals:   category                      } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json({ papers, facets })
}
