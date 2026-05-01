import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { PaperDetail } from '@/components/paper/PaperDetail'
import { RelatedPapers } from '@/components/paper/RelatedPapers'
import type { Paper } from '@/types/paper'

export const revalidate = 3600

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const paper = await prisma.paper.findUnique({ where: { id }, select: { title: true, tldr: true } })
  if (!paper) return {}
  return {
    title: `${paper.title} — ResearchBlog`,
    description: paper.tldr ?? undefined,
  }
}

async function getRelatedPapers(paperId: string, paper: { category: string | null; tags: string[] }): Promise<Paper[]> {
  // Try pgvector semantic similarity first
  type EmbeddingRow = { has_embedding: boolean }
  const [row] = await prisma.$queryRawUnsafe<EmbeddingRow[]>(
    `SELECT (embedding IS NOT NULL) AS has_embedding FROM "Paper" WHERE id = $1`,
    paperId,
  )

  if (row?.has_embedding === true || (row?.has_embedding as unknown) === 't' || (row?.has_embedding as unknown) === 'true') {
    // Get top-20 most similar, then take the 5 newest among them
    type SimilarRow = { id: string }
    const similar = await prisma.$queryRawUnsafe<SimilarRow[]>(
      `SELECT id FROM "Paper"
       WHERE id != $1
         AND status = 'DONE'
         AND embedding IS NOT NULL
       ORDER BY embedding <=> (SELECT embedding FROM "Paper" WHERE id = $1)
       LIMIT 20`,
      paperId,
    )
    const ids = similar.map(r => r.id)
    const papers = await prisma.paper.findMany({
      where: { id: { in: ids } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    return papers as unknown as Paper[]
  }

  // Fallback: same category OR shared tags
  const orConditions: Record<string, unknown>[] = []
  if (paper.category) orConditions.push({ category: paper.category })
  if (paper.tags.length > 0) orConditions.push({ tags: { hasSome: paper.tags } })

  const where: Record<string, unknown> = { id: { not: paperId } }
  if (orConditions.length > 0) where.OR = orConditions

  const papers = await prisma.paper.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  if (papers.length > 0) return papers as unknown as Paper[]

  // Last resort: 5 newest papers
  const newest = await prisma.paper.findMany({
    where: { id: { not: paperId } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
  return newest as unknown as Paper[]
}

export default async function PaperPage({ params }: Props) {
  const { id } = await params
  const paper = await prisma.paper.findUnique({
    where: { id },
    include: { collection: true },
  })

  if (!paper) notFound()

  const related = await getRelatedPapers(id, { category: paper.category, tags: paper.tags })

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 pt-8">
        <Link
          href="/papers"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Back to papers
        </Link>
      </div>
      <PaperDetail paper={paper as unknown as Paper} />
      <RelatedPapers papers={related} />
    </div>
  )
}
