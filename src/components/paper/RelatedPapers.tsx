import Link from 'next/link'
import { getCategoryColor } from '@/lib/utils'
import type { Paper } from '@/types/paper'

export function RelatedPapers({ papers }: { papers: Paper[] }) {
  if (papers.length === 0) return null

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 pt-4">
      <div className="border-t border-white/8 pt-10">
        <h2 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-6">
          Related Papers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {papers.map(p => <RelatedCard key={p.id} paper={p} />)}
        </div>
      </div>
    </section>
  )
}

function RelatedCard({ paper }: { paper: Paper }) {
  const gradient = paper.coverColor ?? getCategoryColor(paper.category)

  return (
    <Link
      href={`/papers/${paper.id}`}
      className="group flex flex-col rounded-2xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 overflow-hidden transition-all duration-200"
    >
      {/* gradient top bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${gradient} opacity-70 group-hover:opacity-100 transition-opacity`} />

      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* venue + year */}
        <div className="flex items-center gap-1.5">
          {paper.venue && (
            <span className="text-[10px] text-white/30 font-medium truncate">{paper.venue}</span>
          )}
          {paper.year && (
            <span className="text-[10px] text-white/20 flex-shrink-0">{paper.year}</span>
          )}
        </div>

        {/* title */}
        <p className="text-xs font-semibold text-white/75 group-hover:text-white line-clamp-3 leading-[1.5] transition-colors flex-1">
          {paper.title}
        </p>

        {/* tldr */}
        {paper.tldr && (
          <p className="text-[11px] text-white/35 line-clamp-2 leading-relaxed">
            {paper.tldr}
          </p>
        )}
      </div>
    </Link>
  )
}
