'use client'

import { useEffect, useState, useCallback } from 'react'
import { History, Trash2, Brain, ChevronRight, Loader2, FileText, RotateCcw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export interface HistoryEntry {
  id: string
  createdAt: string
  conference: string
  year: number
  topics: string
  methods: string[]
  domains: string[]
  tasks: string[]
  maxResults: number
  matchedCount: number
  papers: { id: string; title: string; venue: string; year: number; score: number; openReviewUrl: string }[]
  gapMarkdown: string | null
  targetDomain: string | null
}

interface Props {
  onRestoreSearch: (entry: HistoryEntry) => void
  onViewGapAnalysis: (entry: HistoryEntry) => void
  // Notified when a new entry is saved so we can refresh the list
  refreshTrigger?: number
}

export function DiscoverHistoryPanel({ onRestoreSearch, onViewGapAnalysis, refreshTrigger }: Props) {
  const [history, setHistory]   = useState<HistoryEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/discover/history')
      if (res.ok) {
        const data = await res.json() as { history: HistoryEntry[] }
        setHistory(data.history)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshTrigger])

  const deleteEntry = async (id: string) => {
    setDeleting(id)
    await fetch(`/api/discover/history/${id}`, { method: 'DELETE' })
    setHistory(prev => prev.filter(e => e.id !== id))
    setDeleting(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="h-5 w-5 text-white/20 animate-spin" />
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-8 text-center gap-3">
        <History className="h-8 w-8 text-white/15" />
        <p className="text-sm text-white/30 font-medium">No search history yet</p>
        <p className="text-xs text-white/20 leading-relaxed">
          Your searches will be saved here so you can revisit them anytime.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {history.map(entry => (
        <HistoryCard
          key={entry.id}
          entry={entry}
          expanded={expanded === entry.id}
          deleting={deleting === entry.id}
          onToggle={() => setExpanded(prev => prev === entry.id ? null : entry.id)}
          onRestore={() => onRestoreSearch(entry)}
          onViewGap={() => onViewGapAnalysis(entry)}
          onDelete={() => deleteEntry(entry.id)}
        />
      ))}
    </div>
  )
}

// ─── Individual history card ─────────────────────────────────────────────────

function HistoryCard({
  entry, expanded, deleting,
  onToggle, onRestore, onViewGap, onDelete,
}: {
  entry: HistoryEntry
  expanded: boolean
  deleting: boolean
  onToggle: () => void
  onRestore: () => void
  onViewGap: () => void
  onDelete: () => void
}) {
  const papers = entry.papers as { id: string; title: string; venue: string; year: number; score: number; openReviewUrl: string }[]

  // Build label from filters
  const filterLabel = [
    ...entry.domains,
    ...entry.methods.slice(0, 2),
    ...entry.tasks.slice(0, 1),
  ].filter(Boolean).join(' · ') || entry.conference

  const timeAgo = formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })

  return (
    <div className={`rounded-xl border transition-colors ${
      expanded ? 'border-white/15 bg-white/[0.04]' : 'border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.03]'
    }`}>
      {/* Header row */}
      <button className="w-full text-left px-3 py-2.5 flex items-start gap-2" onClick={onToggle}>
        <ChevronRight className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-white/30 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-semibold text-white/70 font-mono">
              {entry.conference} {entry.year}
            </span>
            <span className="text-[10px] text-white/25 font-mono">·</span>
            <span className="text-[10px] text-white/40">{entry.matchedCount} papers</span>
            {entry.gapMarkdown && (
              <span className="flex items-center gap-0.5 text-[9px] text-purple-400/60 border border-purple-400/20 rounded px-1 py-0.5">
                <Brain className="h-2.5 w-2.5" /> Gap
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/40 truncate">{filterLabel}</p>
          <p className="text-[10px] text-white/20 mt-0.5">{timeAgo}</p>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/8 pt-3">
          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onRestore}
              className="flex items-center gap-1.5 text-[11px] text-white/60 hover:text-white border border-white/15 hover:border-white/30 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Re-run search
            </button>
            {entry.gapMarkdown && (
              <button
                onClick={onViewGap}
                className="flex items-center gap-1.5 text-[11px] text-purple-400/70 hover:text-purple-300 border border-purple-500/20 hover:border-purple-400/40 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <Brain className="h-3 w-3" /> View gap analysis
              </button>
            )}
            <button
              onClick={onDelete}
              disabled={deleting}
              className="ml-auto flex items-center gap-1 text-[10px] text-white/20 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </button>
          </div>

          {/* Filter chips */}
          {(entry.methods.length > 0 || entry.domains.length > 0 || entry.tasks.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {entry.domains.map(d => (
                <span key={d} className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300/70">{d}</span>
              ))}
              {entry.methods.map(m => (
                <span key={m} className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300/70">{m}</span>
              ))}
              {entry.tasks.map(t => (
                <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300/70">{t}</span>
              ))}
            </div>
          )}

          {/* Top papers */}
          {papers.length > 0 && (
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-1">Top papers</p>
              {papers.slice(0, 5).map(p => (
                <a
                  key={p.id}
                  href={p.openReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-1.5 group"
                >
                  <FileText className="h-3 w-3 flex-shrink-0 mt-0.5 text-white/20 group-hover:text-white/40 transition-colors" />
                  <span className="text-[11px] text-white/40 group-hover:text-white/70 transition-colors leading-snug line-clamp-2">
                    {p.title}
                  </span>
                </a>
              ))}
              {papers.length > 5 && (
                <p className="text-[10px] text-white/20 pl-4.5">+{papers.length - 5} more</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
