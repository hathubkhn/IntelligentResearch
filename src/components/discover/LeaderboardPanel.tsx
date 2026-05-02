'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Search, Loader2, Trophy, ExternalLink, ChevronDown, ChevronUp,
  Database, BarChart2, RefreshCw, AlertCircle, TrendingUp, TrendingDown,
  Layers, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BenchmarkTable, PaperInput } from '@/app/api/discover/leaderboard/route'
import type { OpenReviewPaper } from '@/app/api/admin/openreview/route'

interface Props {
  // Current search results from OpenReview (use these directly when available)
  currentPapers?: OpenReviewPaper[]
  // Pre-fill the search bar with current filter state
  initialQuery?: string
}

const MEDAL = ['🥇', '🥈', '🥉']
const SOURCE_LABEL: Record<string, string> = {
  provided:         '📄 from your current search',
  semantic_scholar: '🔬 Semantic Scholar',
  arxiv:            '📚 arXiv',
}

const METRIC_COLOR_MAP: Record<string, string> = {
  accuracy: 'text-emerald-400', f1: 'text-emerald-400', bleu: 'text-emerald-400',
  rouge: 'text-emerald-400', map: 'text-emerald-400', auc: 'text-emerald-400',
  mse: 'text-rose-400', mae: 'text-rose-400', rmse: 'text-rose-400',
  wer: 'text-rose-400', fde: 'text-rose-400', ade: 'text-rose-400',
}
const metricColor = (m: string) => METRIC_COLOR_MAP[m.toLowerCase()] ?? 'text-blue-400'

export function LeaderboardPanel({ currentPapers = [], initialQuery = '' }: Props) {
  const [mode, setMode]       = useState<'current' | 'search'>(currentPapers.length > 0 ? 'current' : 'search')
  const [query, setQuery]     = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const [tables, setTables]   = useState<BenchmarkTable[]>([])
  const [meta, setMeta]       = useState<{ papers: number; extracted: number; source: string; query?: string } | null>(null)
  const [error, setError]     = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [ran, setRan]         = useState(false)

  // Switch mode when papers change
  useEffect(() => {
    setMode(currentPapers.length > 0 ? 'current' : 'search')
  }, [currentPapers.length])

  // Analyze current OpenReview papers
  const analyzeCurrentPapers = useCallback(async () => {
    if (currentPapers.length === 0) return
    setLoading(true); setError(''); setTables([]); setMeta(null); setRan(true)

    const papers: PaperInput[] = currentPapers.map(p => ({
      title:    p.title,
      abstract: p.abstract,
      year:     p.year,
      url:      p.openReviewUrl ?? p.paperUrl ?? '',
      id:       p.openReviewId,
    }))
    const topic = query || initialQuery || papers[0]?.title?.split(' ').slice(0, 4).join(' ') || 'research'

    try {
      const res = await fetch('/api/discover/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papers, topic }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Extraction failed')
      setTables(data.tables ?? [])
      setMeta({ papers: data.papers, extracted: data.extracted, source: data.source })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [currentPapers, query, initialQuery])

  // Search and extract via Semantic Scholar / arXiv
  const searchAndExtract = useCallback(async (q = query) => {
    if (!q.trim()) return
    setLoading(true); setError(''); setTables([]); setMeta(null); setRan(true)
    try {
      const res = await fetch(`/api/discover/leaderboard?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Search failed')
      setTables(data.tables ?? [])
      setMeta({ papers: data.papers, extracted: data.extracted, source: data.source, query: data.query })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [query])

  const toggleCollapse = (key: string) =>
    setCollapsed(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  const SUGGESTIONS = ['time series forecasting', 'image classification ImageNet', 'text summarization CNN/DailyMail', 'machine translation WMT', 'question answering SQuAD']

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Mode toggle + controls ── */}
      <div className="px-5 py-4 border-b border-white/8 flex-shrink-0 space-y-3">

        {/* Mode selector */}
        <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/[0.02]">
          <button
            onClick={() => setMode('current')}
            disabled={currentPapers.length === 0}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              mode === 'current'
                ? 'bg-blue-600 text-white'
                : currentPapers.length === 0
                ? 'text-white/20 cursor-not-allowed'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            From search results
            {currentPapers.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${mode === 'current' ? 'bg-white/20' : 'bg-white/10'}`}>
                {currentPapers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setMode('search')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              mode === 'search'
                ? 'bg-blue-600 text-white'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            Search topic
          </button>
        </div>

        {/* Mode-specific controls */}
        {mode === 'current' && currentPapers.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-white/40">
              Extract benchmark results from <span className="text-white/60 font-medium">{currentPapers.length} papers</span> in your current search.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Topic hint (optional, improves extraction)"
                  className="w-full bg-white/5 border border-white/12 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <Button size="sm" onClick={analyzeCurrentPapers} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart2 className="h-3.5 w-3.5" />}
                Analyze
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-white/40">
              Search Semantic Scholar for recent papers and extract benchmark data using AI.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchAndExtract()}
                  placeholder="e.g. time series forecasting transformer"
                  className="w-full bg-white/5 border border-white/12 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <Button size="sm" onClick={() => searchAndExtract()} disabled={loading || !query.trim()}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                Search
              </Button>
            </div>

            {!ran && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => { setQuery(s); searchAndExtract(s) }}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/8 text-white/35 hover:text-white/60 hover:border-white/20 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Results ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 py-3 text-sm text-white/40">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-white/60 font-medium text-sm">
                  {mode === 'current' ? 'Extracting benchmarks from papers…' : 'Searching & analyzing papers…'}
                </p>
                <p className="text-xs mt-0.5 text-white/30">
                  {mode === 'current'
                    ? 'Using AI to find model names, datasets & scores'
                    : 'Fetching from Semantic Scholar → extracting with AI · ~15s'}
                </p>
              </div>
            </div>
            {[1, 2].map(i => (
              <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3 animate-pulse">
                <div className="h-3.5 bg-white/10 rounded w-1/2" />
                <div className="h-2.5 bg-white/5 rounded w-1/3" />
                <div className="space-y-1.5 mt-2">
                  {[1,2,3].map(j => <div key={j} className="h-7 bg-white/5 rounded" />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-300 font-medium">Analysis failed</p>
              <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
              <button onClick={mode === 'current' ? analyzeCurrentPapers : () => searchAndExtract()}
                className="mt-1.5 flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          </div>
        )}

        {/* Meta summary */}
        {meta && !loading && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/30 pb-1 border-b border-white/5">
            <span>📄 {meta.papers} papers analyzed</span>
            <span>🔢 {meta.extracted} benchmark entries</span>
            <span>📊 {tables.length} leaderboard tables</span>
            <span className="ml-auto">{SOURCE_LABEL[meta.source] ?? meta.source}</span>
          </div>
        )}

        {/* No results */}
        {ran && !loading && !error && tables.length === 0 && meta && (
          <div className="text-center py-10">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/5 mb-3">
              <BarChart2 className="h-5 w-5 text-white/20" />
            </div>
            <p className="text-sm text-white/50 font-medium">No benchmark tables found</p>
            <p className="text-xs text-white/30 mt-1.5 max-w-xs mx-auto">
              The papers analyzed didn't report concrete numeric scores on named datasets.
              {mode === 'current'
                ? ' Try running a more specific search first (e.g. add a Research Task filter).'
                : ' Try a more specific task name like "time series forecasting ETTh1".'}
            </p>
            {mode === 'current' && (
              <button onClick={() => setMode('search')}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mx-auto">
                <Search className="h-3 w-3" /> Switch to topic search
              </button>
            )}
          </div>
        )}

        {/* Benchmark tables */}
        {tables.map((table, ti) => {
          const key = `${table.dataset}::${table.metric}`
          const isCollapsed = collapsed.has(key)
          return (
            <div key={key} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              {/* Header */}
              <button type="button" onClick={() => toggleCollapse(key)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                    ${ti === 0 ? 'bg-amber-500/25 text-amber-300' : ti === 1 ? 'bg-slate-400/20 text-slate-300' : ti === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-white/5 text-white/30'}`}>
                    {ti < 3 ? ['🥇','🥈','🥉'][ti] : ti + 1}
                  </span>
                  <div className="text-left min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Database className="h-3 w-3 text-white/25 flex-shrink-0" />
                      <span className="font-semibold text-sm text-white">{table.dataset}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-mono font-medium ${metricColor(table.metric)}`}>{table.metric}</span>
                      <span className="text-[10px] text-white/20 flex items-center gap-0.5">
                        {table.higherBetter
                          ? <><TrendingUp className="h-2.5 w-2.5"/>higher better</>
                          : <><TrendingDown className="h-2.5 w-2.5"/>lower better</>}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="text-[10px] text-white/25">{table.rows.length} models</span>
                  {isCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-white/25"/> : <ChevronUp className="h-3.5 w-3.5 text-white/25"/>}
                </div>
              </button>

              {/* Table */}
              {!isCollapsed && (
                <div className="border-t border-white/8 overflow-x-auto">
                  <table className="w-full text-xs min-w-[400px]">
                    <thead>
                      <tr className="border-b border-white/8">
                        <th className="text-left px-3 py-2 text-white/25 font-medium w-8">#</th>
                        <th className="text-left px-3 py-2 text-white/25 font-medium">Model</th>
                        <th className="text-right px-3 py-2 text-white/25 font-medium">{table.metric}</th>
                        <th className="text-center px-3 py-2 text-white/25 font-medium">Year</th>
                        <th className="text-left px-3 py-2 text-white/25 font-medium">Paper</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, rank) => (
                        <tr key={rank} className={`border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors ${rank === 0 ? 'bg-amber-500/[0.03]' : ''}`}>
                          <td className="px-3 py-2.5 text-white/30">{rank < 3 ? MEDAL[rank] : <span className="font-mono text-white/20">{rank + 1}</span>}</td>
                          <td className="px-3 py-2.5">
                            <span className={`font-medium ${rank === 0 ? 'text-white' : 'text-white/65'}`}>{row.model}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`font-mono font-semibold ${rank === 0 ? metricColor(table.metric) : 'text-white/45'}`}>
                              {row.scoreLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-white/30">{row.year}</td>
                          <td className="px-3 py-2.5">
                            {row.paperUrl ? (
                              <a href={row.paperUrl} target="_blank" rel="noopener noreferrer"
                                title={row.paperTitle}
                                className="flex items-center gap-1 text-blue-400/60 hover:text-blue-400 transition-colors">
                                <ExternalLink className="h-3 w-3 flex-shrink-0"/>
                                <span className="truncate max-w-[100px] text-[10px]">{row.paperTitle.slice(0, 30) || 'paper'}</span>
                              </a>
                            ) : <span className="text-white/15">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
