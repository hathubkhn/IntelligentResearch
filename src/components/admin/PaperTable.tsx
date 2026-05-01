'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trash2, RefreshCw, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SummaryStatusIndicator } from './SummaryStatusIndicator'
import type { Paper } from '@/types/paper'

interface PaperTableProps {
  papers: Paper[]
  onRefresh: () => void
}

export function PaperTable({ papers, onRefresh }: PaperTableProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const summarize = async (id: string) => {
    setLoading(id)
    try {
      const res = await fetch(`/api/summarize/${id}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Paper summarized!')
      onRefresh()
    } catch {
      toast.error('Summarization failed')
    } finally {
      setLoading(null)
    }
  }

  const deletePaper = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return
    try {
      const res = await fetch(`/api/papers/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Paper deleted')
      onRefresh()
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left">
            <th className="pb-3 text-xs text-white/40 font-medium pr-4">Status</th>
            <th className="pb-3 text-xs text-white/40 font-medium pr-4">Title</th>
            <th className="pb-3 text-xs text-white/40 font-medium pr-4">Venue</th>
            <th className="pb-3 text-xs text-white/40 font-medium pr-4">Category</th>
            <th className="pb-3 text-xs text-white/40 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {papers.map(paper => (
            <tr key={paper.id} className="group">
              <td className="py-3 pr-4">
                <SummaryStatusIndicator status={paper.status} />
              </td>
              <td className="py-3 pr-4 max-w-xs">
                <Link
                  href={`/admin/papers/${paper.id}`}
                  className="text-white/80 hover:text-white flex items-center gap-1.5 line-clamp-1"
                >
                  {paper.title}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 flex-shrink-0" />
                </Link>
              </td>
              <td className="py-3 pr-4 text-white/40 text-xs">{paper.venue ?? '—'}</td>
              <td className="py-3 pr-4 text-white/40 text-xs">{paper.category ?? '—'}</td>
              <td className="py-3">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => summarize(paper.id)}
                    disabled={loading === paper.id}
                    aria-label="Re-summarize paper"
                    className="h-7 w-7"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading === paper.id ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePaper(paper.id, paper.title)}
                    className="h-7 w-7 text-red-400 hover:text-red-300"
                    aria-label="Delete paper"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {papers.length === 0 && (
        <div className="py-12 text-center text-white/30 text-sm">
          No papers found.
        </div>
      )}
    </div>
  )
}
