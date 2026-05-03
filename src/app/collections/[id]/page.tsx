import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowLeft, ExternalLink, Lock } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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

  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string; role?: string })?.role === 'user'
    ? (session?.user as { id?: string }).id
    : null

  const collection = await prisma.collection.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, sourceUrl: true, userId: true },
  })

  if (!collection) notFound()

  // Private collection: only the owner can view it
  if (collection.userId !== null && collection.userId !== userId) notFound()

  // Paper queries differ by collection type:
  // - Public admin collections: papers linked via Paper.collectionId
  // - Private user collections: papers linked via UserCollectionItem
  const isUserCollection = collection.userId !== null

  let papers: Awaited<ReturnType<typeof prisma.paper.findMany>> = []
  let totalCount = 0
  let years:  number[] = []
  let venues: string[] = []

  if (isUserCollection) {
    // Fetch paper IDs from join table first
    const items = await prisma.userCollectionItem.findMany({
      where: { collectionId: id },
      select: { paperId: true },
    })
    const paperIds = items.map(i => i.paperId)

    const baseWhere: Record<string, unknown> = { id: { in: paperIds } }
    if (q) {
      baseWhere.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { tldr:  { contains: q, mode: 'insensitive' } },
      ]
    }
    if (year)  baseWhere.year  = parseInt(year)
    if (venue) baseWhere.venue = { equals: venue, mode: 'insensitive' }

    const [p, yearRows, venueRows] = await Promise.all([
      prisma.paper.findMany({ where: baseWhere, orderBy: [{ year: 'desc' }, { createdAt: 'desc' }] }),
      prisma.paper.findMany({ where: { id: { in: paperIds }, year: { not: null } }, select: { year: true }, distinct: ['year'], orderBy: { year: 'desc' } }),
      prisma.paper.findMany({ where: { id: { in: paperIds }, venue: { not: null } }, select: { venue: true }, distinct: ['venue'], orderBy: { venue: 'asc' } }),
    ])
    papers     = p
    totalCount = paperIds.length
    years      = yearRows.map(r => r.year!).filter(Boolean) as number[]
    venues     = venueRows.map(r => r.venue!).filter(Boolean) as string[]
  } else {
    // Public admin collection — original logic via Paper.collectionId
    const baseWhere: Record<string, unknown> = { collectionId: id }
    if (q) {
      baseWhere.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { tldr:  { contains: q, mode: 'insensitive' } },
        { authors: { has: q } },
      ]
    }
    if (year)  baseWhere.year  = parseInt(year)
    if (venue) baseWhere.venue = { equals: venue, mode: 'insensitive' }

    const [p, cnt, yearRows, venueRows] = await Promise.all([
      prisma.paper.findMany({ where: baseWhere, orderBy: [{ year: 'desc' }, { createdAt: 'desc' }] }),
      prisma.paper.count({ where: { collectionId: id } }),
      prisma.paper.findMany({ where: { collectionId: id, year: { not: null } }, select: { year: true }, distinct: ['year'], orderBy: { year: 'desc' } }),
      prisma.paper.findMany({ where: { collectionId: id, venue: { not: null } }, select: { venue: true }, distinct: ['venue'], orderBy: { venue: 'asc' } }),
    ])
    papers     = p
    totalCount = cnt
    years      = yearRows.map(r => r.year!).filter(Boolean) as number[]
    venues     = venueRows.map(r => r.venue!).filter(Boolean) as string[]
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <Link
        href={isUserCollection ? '/saved' : '/collections'}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" /> {isUserCollection ? 'My reading list' : 'All collections'}
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold text-white">{collection.name}</h1>
          {isUserCollection && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/8 text-white/40 text-xs">
              <Lock className="h-3 w-3" /> Private
            </span>
          )}
        </div>
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
