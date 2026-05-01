import Link from 'next/link'
import { Layers } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function CollectionsPage() {
  const collections = await prisma.collection.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { papers: true } } },
  })

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-white mb-8">Collections</h1>

      {collections.length === 0 ? (
        <div className="text-center py-20 text-white/30">No collections yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {collections.map((col) => (
            <Link key={col.id} href={`/collections/${col.id}`} className="group">
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm p-6 hover:border-slate-700/80 hover:shadow-lg hover:shadow-blue-500/5 transition-all h-full">
                <Layers className="h-8 w-8 text-blue-400 mb-4" />
                <h2 className="font-semibold text-white mb-2 group-hover:text-blue-300 transition-colors">
                  {col.name}
                </h2>
                {col.description && (
                  <p className="text-white/40 text-sm mb-3 line-clamp-2">{col.description}</p>
                )}
                <p className="text-xs text-white/30">
                  {col._count.papers} papers
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
