'use client'

import { useRouter } from 'next/navigation'
import { FileText, Code2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SaveButton } from './SaveButton'
import { getCategoryColor, getVenueTier } from '@/lib/utils'
import type { Paper } from '@/types/paper'

interface PaperCardProps {
  paper: Paper
}

export function PaperCard({ paper }: PaperCardProps) {
  const router = useRouter()
  const gradientClass = paper.coverColor ?? getCategoryColor(paper.category)
  const venueTier = getVenueTier(paper.venue)

  return (
    <div
      className="group relative h-full rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/5 hover:border-slate-700/80 cursor-pointer"
      onClick={() => router.push(`/papers/${paper.id}`)}
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradientClass}`} />

      <div className="p-5">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {paper.venue && (
            <Badge variant={venueTier ?? 'default'} className="text-xs">
              {paper.venue}
            </Badge>
          )}
          {paper.year && (
            <Badge variant="default" className="text-xs">{paper.year}</Badge>
          )}
        </div>

        <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2 mb-2 group-hover:text-blue-300 transition-colors">
          {paper.title}
        </h3>

        {paper.tldr && (
          <p className="text-white/50 text-xs leading-relaxed line-clamp-3 mb-3">
            {paper.tldr}
          </p>
        )}

        {paper.status === 'PENDING' && (
          <p className="text-amber-400/70 text-xs mb-3">Summary pending...</p>
        )}
        {paper.status === 'PROCESSING' && (
          <p className="text-blue-400/70 text-xs mb-3">Generating summary...</p>
        )}

        <div className="flex flex-wrap gap-1 mb-3">
          {paper.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/40">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
          {paper.paperUrl && (
            <a
              href={paper.paperUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/80 transition-colors"
              aria-label="View paper"
            >
              <FileText className="h-3 w-3" /> Paper
            </a>
          )}
          {paper.codeUrl && (
            <a
              href={paper.codeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/80 transition-colors"
              aria-label="View code"
            >
              <Code2 className="h-3 w-3" /> Code
            </a>
          )}
          <div className="ml-auto">
            <SaveButton paperId={paper.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
