'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Search, Loader2, Trophy, ExternalLink, ChevronDown, ChevronUp,
  Database, BarChart2, RefreshCw, AlertCircle, TrendingUp, TrendingDown,
  CheckCircle2, Circle, FileText, Cpu, Layers, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BenchmarkTable, PaperInput } from '@/app/api/discover/leaderboard/route'
import type { OpenReviewPaper } from '@/app/api/admin/openreview/route'

interface Props {
  currentPapers?: OpenReviewPaper[]
  initialQuery?: string
}

// ── SSE event types from the server ───────────────────────────────────────────
type SSEEvent =
  | { step: 1; status: 'searching'; source: string; message: string }
  | { step: 1; status: 'done';      source: string; papers: PaperInput[]; count: number }
  | { step: 1; status: 'no_results'; source: string; message: string }
  | { step: 2; status: 'ranking';   message: string }
  | { step: 2; status: 'done';      papers: PaperInput[]; count: number; message: string }
  | { step: 3; status: 'extracting'; message: string }
  | { step: 3; status: 'done';      tables: BenchmarkTable[]; extracted: number; papers: number }
  | { status: 'error'; message: string }

type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'

interface StepState {
  status:   StepStatus
  message?: string
  papers?:  PaperInput[]
  tables?:  BenchmarkTable[]
  count?:   number
  extracted?: number
}

const MEDAL = ['🥇', '🥈', '🥉']
const METRIC_COLOR_MAP: Record<string, string> = {
  accuracy: 'text-emerald-400', f1: 'text-emerald-400', bleu: 'text-emerald-400',
  rouge: 'text-emerald-400', map: 'text-emerald-400', auc: 'text-emerald-400',
  mse: 'text-rose-400', mae: 'text-rose-400', rmse: 'text-rose-400',
  wer: 'text-rose-400', fde: 'text-rose-400', ade: 'text-rose-400',
}
const metricColor = (m: string) => METRIC_COLOR_MAP[m.toLowerCase()] ?? 'text-blue-400'

function StepIcon({ status, icon: Icon }: { status: StepStatus; icon: React.ElementType }) {
  if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
  if (status === 'done')    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
  if (status === 'error')   return <AlertCircle className="h-4 w-4 text-red-400" />
  return <Icon className="h-4 w-4 text-white/20" />
}

const SUGGESTIONS = [
  'time series forecasting', 'graph neural network node classification',
  'image classification ImageNet', 'text summarization', 'question answering SQuAD',
]

export function LeaderboardPanel({ currentPapers = [], initialQuery = '' }: Props) {
  const [mode, setMode]   = useState<'current' | 'search'>(currentPapers.length > 0 ? 'current' : 'search')
  const [query, setQuery] = useState(initialQuery)
  const [source, setSource] = useState<'openreview' | 'arxiv'>('openreview')

  const initSteps = (): [StepState, StepState, StepState] =>
    [{ status: 'pending' }, { status: 'pending' }, { status: 'pending' }]

  const [steps, setSteps]   = useState<[StepState, StepState, StepState]>(initSteps)
  const [ran, setRan]       = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [papersOpen, setPapersOpen] = useState(false)
  const [rankedOpen, setRankedOpen] = useState(false)

  useEffect(() => {
    setMode(currentPapers.length > 0 ? 'current' : 'search')
  }, [currentPapers.length])

  const setStep = (i: 0 | 1 | 2, patch: Partial<StepState>) =>
    setSteps(prev => {
      const next = [...prev] as [StepState, StepState, StepState]
      next[i] = { ...next[i], ...patch }
      return next
    })

  // ── "From current papers" mode (POST, non-streaming) ──────────────────────
  const analyzeCurrentPapers = useCallback(async () => {
    if (!currentPapers.length) return
    setRan(true)
    setGlobalError('')
    setSteps(initSteps())
    setPapersOpen(false)

    const papers: PaperInput[] = currentPapers.map(p => ({
      title: p.title, abstract: p.abstract, year: p.year,
      url: p.openReviewUrl ?? '', id: p.openReviewId,
    }))
    const topic = query || initialQuery || papers[0]?.title?.split(' ').slice(0, 4).join(' ') || 'research'

    // Step 1: instant — we already have the papers
    setStep(0, { status: 'done', papers, count: papers.length,
      message: `${papers.length} papers from your current search` })

    // Step 2: semantic re-rank (happens inside POST)
    setStep(1, { status: 'running', message: 'Ranking by semantic similarity…' })

    // Step 3: extraction
    try {
      const res  = await fetch('/api/discover/leaderboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papers, topic }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Extraction failed')
      setStep(1, { status: 'done', count: data.papers, message: `Top ${data.papers} papers ranked` })
      setStep(2, { status: 'done', tables: data.tables, extracted: data.extracted })
    } catch (e) {
      setStep(1, { status: 'error', message: (e as Error).message })
      setStep(2, { status: 'error' })
    }
  }, [currentPapers, query, initialQuery])

  // ── "Search topic" mode (GET with SSE streaming) ──────────────────────────
  const searchAndExtract = useCallback(async (q = query, src: 'openreview' | 'arxiv' = source) => {
    if (!q.trim()) return
    setRan(true)
    setGlobalError('')
    setSteps(initSteps())
    setPapersOpen(false)
    setSource(src)

    try {
      const params = new URLSearchParams({ q: q.trim(), source: src })
      const response = await fetch(`/api/discover/leaderboard?${params}`)
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({})) as { error?: string }
        throw new Error((data as { error?: string }).error ?? 'Request failed')
      }

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const handle = (event: SSEEvent) => {
        if ('step' in event) {
          const i = (event.step - 1) as 0 | 1 | 2

          if (event.status === 'searching') {
            setStep(i, { status: 'running', message: event.message })
          } else if (event.status === 'no_results') {
            setStep(i, { status: 'error', message: event.message })
          } else if (event.step === 1 && event.status === 'done') {
            setStep(i, { status: 'done', papers: event.papers, count: event.count,
              message: `Found ${event.count} papers` })
            setStep(1, { status: 'running' })
          } else if (event.step === 2 && event.status === 'ranking') {
            setStep(i, { status: 'running', message: event.message })
          } else if (event.step === 2 && event.status === 'done') {
            setStep(i, { status: 'done', count: event.count, message: event.message })
            setStep(2, { status: 'running' })
          } else if (event.step === 3 && event.status === 'extracting') {
            setStep(i, { status: 'running', message: event.message })
          } else if (event.step === 3 && event.status === 'done') {
            setStep(i, { status: 'done', tables: event.tables,
              extracted: event.extracted, count: event.papers })
          }
        } else if (event.status === 'error') {
          setGlobalError(event.message)
          setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s) as [StepState, StepState, StepState])
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try { handle(JSON.parse(line.slice(6)) as SSEEvent) } catch { /* ignore */ }
          }
        }
      }
    } catch (e) {
      setGlobalError((e as Error).message)
    }
  }, [query, source])

  const toggleCollapse = (key: string) =>
    setCollapsed(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  // Shared expandable paper list used in both Step 1 and Step 2
  const PaperList = ({ papers }: { papers: PaperInput[] }) => (
    <div className="border-t border-white/8 divide-y divide-white/5 max-h-64 overflow-y-auto">
      {papers.map((p, i) => (
        <div key={p.id ?? i} className="px-4 py-2.5 flex items-start gap-2 hover:bg-white/[0.02] transition-colors">
          <span className="text-[10px] text-white/20 font-mono w-4 flex-shrink-0 mt-0.5">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <a href={p.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-white/70 hover:text-white line-clamp-2 transition-colors leading-snug">
              {p.title}
            </a>
            <div className="flex items-center flex-wrap gap-1.5 mt-1">
              {p.venue && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/20 text-blue-300 font-medium">
                  {p.venue}
                </span>
              )}
              {p.year && <span className="text-[10px] text-white/30">{p.year}</span>}
              {p.keywords?.slice(0, 3).map(k => (
                <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/25">{k}</span>
              ))}
            </div>
          </div>
          {p.pdfUrl && (
            <a href={p.pdfUrl} target="_blank" rel="noopener noreferrer"
              className="text-[9px] text-white/20 hover:text-orange-300 flex-shrink-0 mt-0.5 transition-colors"
              title="View PDF">PDF</a>
          )}
        </div>
      ))}
    </div>
  )

  const step1 = steps[0], step2 = steps[1], step3 = steps[2]
  const tables = step3.tables ?? []
  const noResults1 = step1.status === 'error'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header / controls ── */}
      <div className="px-5 py-4 border-b border-white/8 flex-shrink-0 space-y-3">

        {/* Mode toggle */}
        <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/[0.02]">
          <button onClick={() => setMode('current')} disabled={!currentPapers.length}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              mode === 'current' ? 'bg-blue-600 text-white'
              : !currentPapers.length ? 'text-white/20 cursor-not-allowed'
              : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}>
            <Layers className="h-3.5 w-3.5" />
            From search results
            {currentPapers.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${mode === 'current' ? 'bg-white/20' : 'bg-white/10'}`}>
                {currentPapers.length}
              </span>
            )}
          </button>
          <button onClick={() => setMode('search')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
              mode === 'search' ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}>
            <Search className="h-3.5 w-3.5" />
            Search topic
          </button>
        </div>

        {/* Controls per mode */}
        {mode === 'current' ? (
          <div className="space-y-2">
            <p className="text-xs text-white/40">Extract benchmark results from <span className="text-white/60 font-medium">{currentPapers.length} papers</span> in your current search.</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Topic hint (optional)"
                  className="w-full bg-white/5 border border-white/12 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50" />
              </div>
              <Button size="sm" onClick={analyzeCurrentPapers} disabled={step1.status === 'running' || step2.status === 'running' || step3.status === 'running'}>
                {(step1.status === 'running' || step2.status === 'running' || step3.status === 'running')
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <BarChart2 className="h-3.5 w-3.5" />}
                Analyze
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-white/40">Search <span className="text-white/60">OpenReview</span> (last 3 years) for papers and extract benchmark tables using AI.</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchAndExtract()}
                  placeholder="e.g. time series forecasting"
                  className="w-full bg-white/5 border border-white/12 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50" />
              </div>
              <Button size="sm" onClick={() => searchAndExtract()} disabled={!query.trim() || step1.status === 'running' || step2.status === 'running' || step3.status === 'running'}>
                {(step1.status === 'running' || step2.status === 'running' || step3.status === 'running')
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Search className="h-3.5 w-3.5" />}
                Search
              </Button>
            </div>
            {!ran && (
              <div className="flex flex-wrap gap-1.5">
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

      {/* ── Step-by-step results ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

        {/* Global error */}
        {globalError && (
          <div className="flex gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-300 font-medium">Error</p>
              <p className="text-xs text-red-400/70 mt-0.5">{globalError}</p>
              <button onClick={() => mode === 'current' ? analyzeCurrentPapers() : searchAndExtract()}
                className="mt-1.5 flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          </div>
        )}

        {ran && (
          <div className="space-y-2">

            {/* ── Step 1: Search ── */}
            <div className={`rounded-xl border transition-colors overflow-hidden ${
              step1.status === 'done'    ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
              : step1.status === 'running' ? 'border-blue-500/20 bg-blue-500/[0.03]'
              : step1.status === 'error'   ? 'border-red-500/20 bg-red-500/[0.03]'
              : 'border-white/8 bg-white/[0.02]'}`}>

              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
                  <StepIcon status={step1.status} icon={FileText} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Step 1</span>
                    <span className="text-xs font-semibold text-white/70">
                      {mode === 'current' ? 'Papers from your search' : `Search ${source === 'arxiv' ? 'arXiv' : 'OpenReview'}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/40 mt-0.5 truncate">
                    {step1.message ?? (step1.status === 'pending' ? 'Waiting…' : '')}
                  </p>
                </div>
                {step1.status === 'done' && step1.papers && step1.papers.length > 0 && (
                  <button onClick={() => setPapersOpen(o => !o)}
                    className="flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60 transition-colors flex-shrink-0">
                    {papersOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {step1.papers.length} papers
                  </button>
                )}
              </div>

              {/* No results → arXiv fallback button */}
              {step1.status === 'error' && mode === 'search' && source === 'openreview' && (
                <div className="px-4 pb-3 flex flex-col items-start gap-2">
                  <button onClick={() => searchAndExtract(query, 'arxiv')}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-medium hover:bg-orange-500/20 transition-colors">
                    <Search className="h-3 w-3" />
                    Search arXiv instead
                  </button>
                </div>
              )}

              {/* Expandable paper list */}
              {step1.status === 'done' && papersOpen && step1.papers && (
                <PaperList papers={step1.papers} />
              )}
            </div>

            {/* ── Step 2: Semantic Re-rank ── */}
            {(step2.status !== 'pending' || step1.status === 'done') && (
              <div className={`rounded-xl border transition-colors overflow-hidden ${
                step2.status === 'done'    ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                : step2.status === 'running' ? 'border-blue-500/20 bg-blue-500/[0.03]'
                : step2.status === 'error'   ? 'border-red-500/20 bg-red-500/[0.03]'
                : 'border-white/8 bg-white/[0.02]'}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
                    <StepIcon status={step2.status} icon={Cpu} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Step 2</span>
                      <span className="text-xs font-semibold text-white/70">Semantic Ranking</span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5 truncate">
                      {step2.message ?? (step2.status === 'pending' ? 'Waiting for search…' : '')}
                    </p>
                  </div>
                  {step2.status === 'done' && step2.papers && step2.papers.length > 0 && (
                    <button onClick={() => setRankedOpen(o => !o)}
                      className="flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60 transition-colors flex-shrink-0">
                      {rankedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {step2.papers.length} ranked
                    </button>
                  )}
                </div>
                {step2.status === 'done' && rankedOpen && step2.papers && (
                  <PaperList papers={step2.papers} />
                )}
              </div>
            )}

            {/* ── Step 3: Benchmark Extraction + Leaderboard ── */}
            {(step3.status !== 'pending' || step2.status === 'done') && (
              <div className={`rounded-xl border transition-colors overflow-hidden ${
                step3.status === 'done'    ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
                : step3.status === 'running' ? 'border-blue-500/20 bg-blue-500/[0.03]'
                : step3.status === 'error'   ? 'border-red-500/20 bg-red-500/[0.03]'
                : 'border-white/8 bg-white/[0.02]'}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
                    <StepIcon status={step3.status} icon={Trophy} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Step 3</span>
                      <span className="text-xs font-semibold text-white/70">Benchmark Leaderboard</span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5 truncate">
                      {step3.status === 'running' ? (step3.message ?? 'Downloading papers & extracting benchmark scores with AI…')
                        : step3.status === 'done'
                        ? `${step3.extracted ?? 0} entries · ${tables.length} leaderboard tables`
                        : step3.status === 'pending' ? 'Waiting for ranking…' : ''}
                    </p>
                  </div>
                </div>

                {/* No tables found */}
                {step3.status === 'done' && tables.length === 0 && (
                  <div className="px-4 pb-4 text-center">
                    <p className="text-xs text-white/40">No concrete benchmark scores found in these papers.</p>
                    <p className="text-[11px] text-white/25 mt-1">Try a more specific query like <em>"time series forecasting ETTh1"</em></p>
                  </div>
                )}

                {/* Leaderboard tables */}
                {step3.status === 'done' && tables.length > 0 && (
                  <div className="border-t border-white/8 space-y-2 p-3">
                    {tables.map((table, ti) => {
                      const key = `${table.dataset}::${table.metric}`
                      const isCollapsed = collapsed.has(key)
                      return (
                        <div key={key} className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                          <button type="button" onClick={() => toggleCollapse(key)}
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
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
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span className="text-[10px] text-white/25">{table.rows.length} models</span>
                              {isCollapsed ? <ChevronDown className="h-3.5 w-3.5 text-white/25"/> : <ChevronUp className="h-3.5 w-3.5 text-white/25"/>}
                            </div>
                          </button>

                          {!isCollapsed && (
                            <div className="border-t border-white/8 overflow-x-auto">
                              <table className="w-full text-xs min-w-[380px]">
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
                                        <span className={`font-mono font-semibold ${rank === 0 ? metricColor(table.metric) : 'text-white/45'}`}>{row.scoreLabel}</span>
                                      </td>
                                      <td className="px-3 py-2.5 text-center text-white/30">{row.year}</td>
                                      <td className="px-3 py-2.5">
                                        {row.paperUrl ? (
                                          <a href={row.paperUrl} target="_blank" rel="noopener noreferrer"
                                            title={row.paperTitle}
                                            className="flex items-center gap-1 text-blue-400/60 hover:text-blue-400 transition-colors">
                                            <ExternalLink className="h-3 w-3 flex-shrink-0"/>
                                            <span className="truncate max-w-[90px] text-[10px]">{row.paperTitle.slice(0, 28) || 'paper'}</span>
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
                )}
              </div>
            )}
          </div>
        )}

        {!ran && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/5 mb-4">
              <Trophy className="h-6 w-6 text-white/15" />
            </div>
            <p className="text-sm text-white/30">Build a benchmark leaderboard</p>
            <p className="text-xs text-white/20 mt-1.5 max-w-xs">
              Search for a research topic to automatically find papers, extract benchmark scores, and rank models.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
