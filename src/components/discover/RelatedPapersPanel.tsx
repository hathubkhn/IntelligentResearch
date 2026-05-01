'use client'

import { useState, useCallback } from 'react'
import { Search, Loader2, Plus, Check, X, ExternalLink } from 'lucide-react'

interface SemanticResult {
  id: string
  title: string
  tldr: string | null
  year: number | null
  venue: string | null
  category: string | null
  similarity: number
}

interface Props {
  collectionId: string
  onClose: () => void
}

export function RelatedPapersPanel({ collectionId, onClose }: Props) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SemanticResult[]>([])
  const [loading, setLoading] = useState(false)
  const [added, setAdded]     = useState<Set<string>>(new Set())
  const [adding, setAdding]   = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const search = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/search/semantic?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Search failed')
      setResults(data.results ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [query])

  const addToCollection = async (paperId: string) => {
    setAdding(paperId)
    try {
      const res = await fetch(`/api/collections/${collectionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId }),
      })
      if (!res.ok) throw new Error('Failed to add paper')
      setAdded(prev => new Set([...prev, paperId]))
    } catch {
      // silently fail — user can retry
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-white">Find Related Papers</h3>
          <p className="text-[10px] text-white/35 mt-0.5">Semantic search across the database</p>
        </div>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white transition-colors p-1"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search input */}
      <div className="px-4 py-3 border-b border-white/8 flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Describe what you're looking for…"
            className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50"
          />
          <button
            onClick={search}
            disabled={loading || !query.trim()}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-colors text-white"
            aria-label="Search"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <p className="m-4 text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!loading && results.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-48 text-center px-6">
            <Search className="h-6 w-6 text-white/15 mb-3" />
            <p className="text-white/30 text-xs">
              Search by topic, concept, or paste a paper title to find semantically similar papers.
            </p>
          </div>
        )}

        <div className="p-3 space-y-2">
          {results.map(paper => {
            const isAdded  = added.has(paper.id)
            const isAdding = adding === paper.id
            return (
              <div
                key={paper.id}
                className={`rounded-xl border p-3 transition-colors ${
                  isAdded
                    ? 'border-emerald-500/25 bg-emerald-500/[0.04]'
                    : 'border-white/8 bg-white/[0.02]'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/85 leading-snug mb-1 line-clamp-2">
                      {paper.title}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {paper.venue && (
                        <span className="text-[9px] text-white/35 font-medium">{paper.venue}</span>
                      )}
                      {paper.year && (
                        <span className="text-[9px] text-white/25">{paper.year}</span>
                      )}
                      <span className="text-[9px] text-blue-400/60 font-mono ml-auto">
                        {Math.round(paper.similarity * 100)}% match
                      </span>
                    </div>
                    {paper.tldr && (
                      <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2">
                        {paper.tldr}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <a
                    href={`/papers/${paper.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[9px] text-white/25 hover:text-blue-400 transition-colors"
                  >
                    View <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                  <button
                    onClick={() => !isAdded && addToCollection(paper.id)}
                    disabled={isAdded || isAdding}
                    className={`ml-auto flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full transition-colors ${
                      isAdded
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 cursor-default'
                        : 'text-white/50 bg-white/5 border border-white/10 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {isAdding
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : isAdded
                        ? <><Check className="h-3 w-3" /> Added</>
                        : <><Plus className="h-3 w-3" /> Add</>}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
