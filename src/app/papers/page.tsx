import { Suspense } from 'react'
import { PaginationBar } from '@/components/search/PaginationBar'
import { prisma } from '@/lib/prisma'
import { getCached, setCached } from '@/lib/cache'
import { PaperCard } from '@/components/paper/PaperCard'
import { FilterPanel } from '@/components/search/FilterPanel'
import { SearchBar } from '@/components/search/SearchBar'
import type { Paper } from '@/types/paper'

export const dynamic = 'force-dynamic'

interface PapersPageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    year?: string
    venue?: string
    summary?: string
    tag?: string
    collection?: string
    page?: string
  }>
}

async function getPapers(params: Awaited<PapersPageProps['searchParams']>) {
  const { q, category, year, venue, summary, tag, collection, page: pageStr } = params
  const page = parseInt(pageStr ?? '1')
  const limit = 20
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { tldr: { contains: q, mode: 'insensitive' } },
      { authors: { has: q } },
    ]
  }
  if (category) where.category = category
  if (year) where.year = parseInt(year)
  if (venue) where.venue = { equals: venue, mode: 'insensitive' }
  if (summary) {
    const statuses = summary.split(',')
    where.status = statuses.length === 1 ? statuses[0] : { in: statuses }
  }
  if (tag) where.tags = { has: tag }
  if (collection) where.collectionId = collection

  const cacheKey = `papers:list:${JSON.stringify({ where, skip, limit })}`
  const cached = await getCached<{ papers: unknown[]; total: number }>(cacheKey)
  if (cached) return { papers: cached.papers, total: cached.total, page, limit }

  const [papers, total] = await Promise.all([
    prisma.paper.findMany({ where, skip, take: limit, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] }),
    prisma.paper.count({ where }),
  ])

  await setCached(cacheKey, { papers, total }, 60)
  return { papers, total, page, limit }
}

async function getFilters() {
  const cached = await getCached<{ categories: string[]; years: number[]; tags: string[]; venues: string[]; collections: Array<{ id: string; name: string }> }>('papers:filters')
  if (cached) return cached

  const [cats, years, tagRows, venueRows, collections] = await Promise.all([
    prisma.paper.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    }),
    prisma.paper.findMany({
      where: { year: { not: null } },
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' },
    }),
    prisma.$queryRaw<{ tag: string }[]>`
      SELECT DISTINCT unnest(tags) AS tag FROM "Paper"
      WHERE array_length(tags, 1) > 0
      ORDER BY tag
    `,
    prisma.paper.findMany({
      where: { venue: { not: null } },
      select: { venue: true },
      distinct: ['venue'],
      orderBy: { venue: 'asc' },
    }),
    prisma.collection.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const result = {
    categories: cats.map(c => c.category!).filter(Boolean),
    years: years.map(y => y.year!).filter(Boolean),
    tags: tagRows.map(r => r.tag),
    venues: venueRows.map(v => v.venue!).filter(Boolean),
    collections,
  }
  await setCached('papers:filters', result, 300)
  return result
}

export default async function PapersPage({ searchParams }: PapersPageProps) {
  const params = await searchParams
  const [{ papers, total, page, limit }, { categories, years, tags, venues, collections }] = await Promise.all([
    getPapers(params),
    getFilters(),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Papers</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-slate-500 text-sm">{total} papers</p>
          {params.collection && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400">
              {collections.find(c => c.id === params.collection)?.name ?? 'Collection'}
            </span>
          )}
          {params.venue && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-600/20 border border-cyan-500/30 text-cyan-400">
              {params.venue}
            </span>
          )}
          {params.year && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/60 border border-slate-600/40 text-slate-300">
              {params.year}
            </span>
          )}
          {params.q && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/60 border border-slate-600/40 text-slate-300">
              &ldquo;{params.q}&rdquo;
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-8">
        <div className="hidden lg:block w-56 flex-shrink-0">
          <Suspense fallback={null}>
            <FilterPanel categories={categories} years={years} tags={tags} venues={venues} collections={collections} />
          </Suspense>
        </div>

        <div className="flex-1 min-w-0">
          <div className="mb-6">
            <Suspense fallback={null}>
              <SearchBar />
            </Suspense>
          </div>

          {papers.length === 0 ? (
            <div className="text-center py-20 text-white/30">
              No papers found{params.q ? ` for "${params.q}"` : ''}.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {(papers as unknown as Paper[]).map(paper => (
                  <PaperCard key={paper.id} paper={paper} />
                ))}
              </div>

              {totalPages > 1 && (
                <PaginationBar page={page} totalPages={totalPages} params={params} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
