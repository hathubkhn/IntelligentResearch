import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
import { PaperCard } from '@/components/paper/PaperCard'
import { CollectionFilters } from '@/components/search/CollectionFilters'
import type { Paper } from '@/types/paper'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; year?: string; venue?: string }>
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { id } = await params
  const { q, year, venue } = await searchParams

  const collection = await prisma.collection.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, sourceUrl: true },
  })

  if (!collection) notFound()

  // Build filter
  const where: Record<string, unknown> = { collectionId: id }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { tldr: { contains: q, mode: 'insensitive' } },
      { authors: { has: q } },
    ]
  }
  if (year) where.year = parseInt(year)
  if (venue) where.venue = { equals: venue, mode: 'insensitive' }

  const [papers, totalCount, yearRows, venueRows] = await Promise.all([
    prisma.paper.findMany({
      where,
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.paper.count({ where: { collectionId: id } }),
    prisma.paper.findMany({
      where: { collectionId: id, year: { not: null } },
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' },
    }),
    prisma.paper.findMany({
      where: { collectionId: id, venue: { not: null } },
      select: { venue: true },
      distinct: ['venue'],
      orderBy: { venue: 'asc' },
    }),
  ])

  const years = yearRows.map(r => r.year!).filter(Boolean) as number[]
  const venues = venueRows.map(r => r.venue!).filter(Boolean) as string[]

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href="/collections"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" /> All collections
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{collection.name}</h1>
        {collection.description && (
          <p className="text-slate-400 mb-3 max-w-2xl">{collection.description}</p>
        )}
        {collection.sourceUrl && (
          <a
            href={collection.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-white transition-colors"
          >
            Source <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <Suspense fallback={null}>
        <CollectionFilters
          collectionId={id}
          years={years}
          venues={venues}
          totalCount={totalCount}
          filteredCount={papers.length}
        />
      </Suspense>

      {papers.length === 0 ? (
        <div className="text-center py-20 text-slate-600">
          No papers match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {papers.map(paper => (
            <PaperCard key={paper.id} paper={paper as unknown as Paper} />
          ))}
        </div>
      )}
    </div>
  )
}
