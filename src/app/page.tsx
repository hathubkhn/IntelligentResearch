import Link from 'next/link'
import { BookOpen, ArrowRight, Layers } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { PaperCard } from '@/components/paper/PaperCard'
import type { Paper } from '@/types/paper'

export const dynamic = 'force-dynamic'

async function getHomeData() {
  try {
    const [recentPapers, collections, total] = await Promise.all([
      prisma.paper.findMany({
        where: { status: 'DONE' },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.collection.findMany({
        orderBy: { createdAt: 'desc' },
        take: 4,
        include: { _count: { select: { papers: true } } },
      }),
      prisma.paper.count(),
    ])
    return { recentPapers, collections, total, error: false }
  } catch {
    return { recentPapers: [], collections: [], total: 0, error: true }
  }
}

export default async function HomePage() {
  const { recentPapers, collections, total, error } = await getHomeData()
  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-32 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/5 border border-white/10 mb-6 mx-auto">
          <BookOpen className="h-7 w-7 text-white/30" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Applied AI Lab Research</h1>
        <p className="text-white/40 mb-8">Database is temporarily unreachable. Please try again in a moment.</p>
        <Link href="/discover" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors">
          Browse Discover <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-16">
        <div className="flex justify-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/8 text-cyan-400 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Applied AI Lab Research
          </div>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
          AI Research, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Summarized</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-8">
          Structured AI-generated summaries for academic papers. Browse {total} papers across
          multiple research areas.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/papers"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/20"
          >
            Browse all papers <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/collections"
            className="inline-flex items-center gap-2 border border-slate-700/80 bg-slate-900/60 hover:border-slate-600 text-slate-300 hover:text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            <Layers className="h-4 w-4" /> Collections
          </Link>
        </div>
      </div>

      {collections.length > 0 && (
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Collections</h2>
            <Link
              href="/collections"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(collections as Array<typeof collections[number] & { _count: { papers: number } }>).map((col) => (
              <Link key={col.id} href={`/collections/${col.id}`} className="group">
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm p-5 hover:border-slate-700 hover:shadow-lg hover:shadow-blue-500/5 transition-all h-full">
                  <Layers className="h-6 w-6 text-blue-400 mb-3" />
                  <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1 group-hover:text-blue-300 transition-colors">
                    {col.name}
                  </h3>
                  <p className="text-xs text-white/40">{col._count.papers} papers</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recentPapers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Recent Papers</h2>
            <Link
              href="/papers"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recentPapers.map((paper) => (
              <PaperCard key={paper.id} paper={paper as unknown as Paper} />
            ))}
          </div>
        </section>
      )}

      {total === 0 && (
        <div className="text-center py-20 text-white/30">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>
            No papers yet.{' '}
            <Link href="/admin/upload" className="text-blue-400 hover:underline">
              Upload some papers
            </Link>{' '}
            to get started.
          </p>
        </div>
      )}
    </div>
  )
}
