'use client'

import { useState, useCallback } from 'react'
import {
  Search, Loader2, Trophy, ExternalLink, ChevronDown, ChevronUp,
  Database, BarChart2, RefreshCw, AlertCircle, TrendingUp, TrendingDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BenchmarkTable } from '@/app/api/discover/leaderboard/route'

interface Props {
  initialQuery?: string
}

const MEDAL = ['🥇', '🥈', '🥉']

const METRIC_COLORS: Record<string, string> = {
  accuracy: 'text-emerald-400', f1: 'text-emerald-400', bleu: 'text-emerald-400',
  rouge: 'text-emerald-400', map: 'text-emerald-400',
  mse: 'text-rose-400', mae: 'text-rose-400', rmse: 'text-rose-400', loss: 'text-rose-400',
}
function metricColor(m: string) {
  return METRIC_COLORS[m.toLowerCase()] ?? 'text-blue-400'
}

export function LeaderboardPanel({ initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const [tables, setTables] = useState<BenchmarkTable[]>([])
  const [meta, setMeta] = useState<{ papers: number; extracted: number; query: string } | null>(null)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [searched, setSearched] = useState(false)

  const search = useCallback(async (q = query) => {
    if (!q.trim()) return
    setLoading(true)
    setError('')
    setTables([])
    setMeta(null)
    setSearched(true)
    try {
      const res = await fetch(`/api/discover/leaderboard?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch leaderboard')
      setTables(data.tables ?? [])
      setMeta({ papers: data.papers, extracted: data.extracted, query: data.query })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch leaderboard')
    } finally {
      setLoading(false)
    }
  }, [query])

  const toggleCollapse = (key: string) => {
    setCollapsed(s => {
      const n = new Set(s)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Search bar ── */}
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0">
        <p className="text-xs text-white/40 mb-3">
          Searches arXiv for recent papers and uses AI to extract benchmark results (model rankings, datasets, metrics).
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="e.g. time series forecasting, LLM reasoning, GNN molecular…"
              className="w-full bg-white/5 border border-white/15 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/60 transition-colors"
            />
          </div>
          <Button onClick={() => search()} disabled={loading || !query.trim()}>
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Search className="h-4 w-4" />}
            {loading ? 'Analyzing…' : 'Search'}
          </Button>
        </div>

        {/* Quick suggestion chips */}
        {!searched && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {['time series forecasting', 'image classification', 'text summarization',
              'object detection', 'machine translation', 'question answering'].map(s => (
              <button
                key={s}
                onClick={() => { setQuery(s); search(s) }}
                className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Results area ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 py-4 text-sm text-white/40">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              <div>
                <p className="text-white/60 font-medium">Fetching papers from arXiv…</p>
                <p className="text-xs mt-0.5">Extracting benchmark results with AI · this takes ~15s</p>
              </div>
            </div>
            {[1, 2].map(i => (
              <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-2/3" />
                <div className="h-3 bg-white/5 rounded w-1/3" />
                <div className="space-y-2 mt-3">
                  {[1, 2, 3].map(j => <div key={j} className="h-8 bg-white/5 rounded" />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-300 font-medium">Failed to load leaderboard</p>
              <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
              <button onClick={() => search()} className="text-xs text-red-400 hover:text-red-300 mt-1 flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Try again
              </button>
            </div>
          </div>
        )}

        {/* Meta info */}
        {meta && !loading && (
          <div className="flex items-center gap-4 text-xs text-white/30 pb-1">
            <span className="flex items-center gap-1"><Search className="h-3 w-3" /> {meta.papers} papers from arXiv</span>
            <span className="flex items-center gap-1"><BarChart2 className="h-3 w-3" /> {meta.extracted} benchmark entries found</span>
            <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {tables.length} leaderboard tables</span>
          </div>
        )}

        {/* No results */}
        {searched && !loading && !error && tables.length === 0 && meta && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-white/5 mb-4">
              <BarChart2 className="h-6 w-6 text-white/20" />
            </div>
            <p className="text-white/50 text-sm font-medium">No benchmark tables found</p>
            <p className="text-white/30 text-xs mt-1.5 max-w-xs mx-auto">
              The papers found on arXiv for &ldquo;{meta.query}&rdquo; didn&apos;t contain
              enough concrete numeric benchmark scores. Try a more specific task name.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {['time series forecasting', 'image classification on ImageNet', 'machine translation BLEU'].map(s => (
                <button key={s} onClick={() => { setQuery(s); search(s) }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/15 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Benchmark tables */}
        {tables.map((table, ti) => {
          const key = `${table.dataset}::${table.metric}`
          const isCollapsed = collapsed.has(key)
          const best = table.rows[0]
          return (
            <div key={key} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">

              {/* Table header */}
              <button
                type="button"
                onClick={() => toggleCollapse(key)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${ti === 0 ? 'bg-amber-500/20 text-amber-300' : ti === 1 ? 'bg-slate-400/20 text-slate-300' : 'bg-amber-700/20 text-amber-600'}`}>
                    {ti + 1}
                  </div>
                  <div className="text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
                      <span className="font-semibold text-sm text-white truncate">{table.dataset}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-mono font-medium ${metricColor(table.metric)}`}>
                        {table.metric}
                      </span>
                      <span className="text-[10px] text-white/25 flex items-center gap-0.5">
                        {table.higherBetter
                          ? <><TrendingUp className="h-3 w-3" /> higher is better</>
                          : <><TrendingDown className="h-3 w-3" /> lower is better</>}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-white/30">{table.rows.length} models</span>
                  {best && (
                    <span className="hidden sm:block text-xs text-white/40 max-w-[120px] truncate">
                      🥇 {best.model}
                    </span>
                  )}
                  {isCollapsed
                    ? <ChevronDown className="h-4 w-4 text-white/30" />
                    : <ChevronUp className="h-4 w-4 text-white/30" />}
                </div>
              </button>

              {/* Table body */}
              {!isCollapsed && (
                <div className="border-t border-white/8">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/8">
                        <th className="text-left px-4 py-2 text-white/30 font-medium w-8">#</th>
                        <th className="text-left px-4 py-2 text-white/30 font-medium">Model</th>
                        <th className="text-right px-4 py-2 text-white/30 font-medium">{table.metric}</th>
                        <th className="text-left px-4 py-2 text-white/30 font-medium hidden sm:table-cell">Year</th>
                        <th className="text-left px-4 py-2 text-white/30 font-medium">Paper</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, rank) => (
                        <tr
                          key={rank}
                          className={`border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.03] ${
                            rank === 0 ? 'bg-amber-500/[0.04]' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5 font-mono text-white/40">
                            {rank < 3 ? MEDAL[rank] : <span className="text-white/25">{rank + 1}</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`font-medium ${rank === 0 ? 'text-white' : 'text-white/70'}`}>
                              {row.model}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-mono font-semibold ${
                              rank === 0
                                ? metricColor(table.metric)
                                : 'text-white/50'
                            }`}>
                              {row.scoreLabel}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-white/30 hidden sm:table-cell">{row.year}</td>
                          <td className="px-4 py-2.5">
                            {row.paperUrl ? (
                              <a
                                href={row.paperUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-400/70 hover:text-blue-400 transition-colors max-w-[120px] truncate"
                                title={row.paperTitle}
                              >
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate text-[10px]">{row.arxivId ?? 'arXiv'}</span>
                              </a>
                            ) : (
                              <span className="text-white/20">—</span>
                            )}
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
