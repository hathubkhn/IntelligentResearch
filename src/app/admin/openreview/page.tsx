'use client'

import { useState } from 'react'
import {
  Search, Download, Loader2, CheckSquare, Square,
  ChevronDown, ExternalLink, Tag, AlertCircle,
  Zap, CheckCircle2, XCircle, Database,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { OpenReviewPaper } from '@/app/api/admin/openreview/route'

// ── Constants ─────────────────────────────────────────────────────────────────

const CONFERENCE_GROUPS = [
  { label: 'ML / AI',     values: ['ICLR', 'NeurIPS', 'ICML', 'AISTATS', 'UAI'] },
  { label: 'NLP',         values: ['ACL', 'EMNLP', 'NAACL', 'EACL'] },
  { label: 'Specialized', values: ['COLM', 'TMLR', 'CoRL'] },
]
const ALL_CONFERENCES = CONFERENCE_GROUPS.flatMap(g => g.values)

// Available years per conference (mirrors VENUE_IDS in route.ts)
const CONF_YEARS: Record<string, number[]> = {
  ICLR:    [2025, 2024, 2023, 2022, 2021, 2020],
  NeurIPS: [2024, 2023, 2022, 2021],
  ICML:    [2025, 2024, 2023, 2022],
  AISTATS: [2025, 2024],
  UAI:     [2024, 2023],
  ACL:     [2024, 2023],
  EMNLP:   [2024, 2023],
  NAACL:   [2024],
  EACL:    [2024],
  COLM:    [2025, 2024],
  TMLR:    [2025, 2024, 2023, 2022],
  CoRL:    [2024, 2023],
}

const TOPIC_PRESETS = [
  { label: 'Multimodal & VLM',   value: 'multimodal, vision language, visual question answering, image text' },
  { label: 'LLM Reasoning',      value: 'reasoning, chain of thought, mathematical, theorem proving, code generation' },
  { label: 'Efficient LLMs',     value: 'quantization, pruning, distillation, efficient, compression, speculative decoding' },
  { label: 'Embodied AI',        value: 'embodied, robot, manipulation, locomotion, sim-to-real' },
  { label: '3D & NeRF',          value: '3D reconstruction, gaussian splatting, neural radiance, point cloud, depth estimation' },
  { label: 'Healthcare & Bio',   value: 'medical, clinical, radiology, pathology, genomics, protein, drug discovery' },
  { label: 'Diffusion Models',   value: 'diffusion, score matching, denoising, generative, image generation' },
  { label: 'RLHF & Alignment',   value: 'alignment, RLHF, reward model, preference, constitutional AI, safety' },
  { label: 'Agents & Planning',  value: 'agent, planning, tool use, multi-agent, autonomous, workflow' },
  { label: 'Time Series',        value: 'time series, forecasting, temporal, sequential, anomaly detection' },
  { label: 'Graph Neural Nets',  value: 'graph neural, GNN, knowledge graph, molecular, node classification' },
  { label: 'Reinforcement Lrn.', value: 'reinforcement learning, policy gradient, reward, offline RL, model-based' },
]

interface Collection { id: string; name: string }

// ── SSE event types from bulk-import route ────────────────────────────────────
interface SSEEvent {
  type: 'status' | 'progress' | 'summarized' | 'summarize_error' | 'complete' | 'error'
  step?: string
  message?: string
  total?: number
  done?: number
  created?: number
  skipped?: number
  summarized?: number
  paperId?: string
  title?: string
  error?: string
}

// ═════════════════════════════════════════════════════════════════════════════
export default function OpenReviewImportPage() {
  const [tab, setTab] = useState<'search' | 'bulk'>('search')

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-white/10 px-8 py-5">
        <h1 className="text-xl font-bold text-white">OpenReview Import</h1>
        <p className="text-sm text-white/40 mt-0.5">
          Fetch accepted papers from ICLR, NeurIPS, ICML, ACL, EMNLP, CoRL and more · No API key required
        </p>

        {/* Tab switcher */}
        <div className="flex gap-1 mt-4 border-b border-white/10">
          <button
            onClick={() => setTab('search')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === 'search' ? 'border-blue-500 text-white' : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <Search className="h-3.5 w-3.5 inline mr-1.5" />
            Curated Search
          </button>
          <button
            onClick={() => setTab('bulk')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === 'bulk' ? 'border-emerald-500 text-white' : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <Zap className="h-3.5 w-3.5 inline mr-1.5" />
            Bulk Import All
          </button>
        </div>
      </div>

      {tab === 'search' ? <SearchTab /> : <BulkTab />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Curated Search (original flow, extended)
// ─────────────────────────────────────────────────────────────────────────────
function SearchTab() {
  const [conference, setConference] = useState<string>('ICLR')
  const [year, setYear] = useState<number>(2025)
  const [topics, setTopics] = useState('')
  const [maxResults, setMaxResults] = useState(50)
  const [collectionId, setCollectionId] = useState('')
  const [collections, setCollections] = useState<Collection[]>([])
  const [collectionsLoaded, setCollectionsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [papers, setPapers] = useState<OpenReviewPaper[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [meta, setMeta] = useState<{ total: number; matched: number; venueId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const availableYears = CONF_YEARS[conference] ?? []

  const handleConfChange = (c: string) => {
    setConference(c)
    const ys = CONF_YEARS[c] ?? []
    if (!ys.includes(year)) setYear(ys[0] ?? 2024)
    setPapers([]); setSelected(new Set()); setMeta(null); setError(null)
  }

  const loadCollections = async () => {
    if (collectionsLoaded) return
    const res = await fetch('/api/collections')
    const data = await res.json()
    setCollections(data.collections ?? data ?? [])
    setCollectionsLoaded(true)
  }

  const search = async () => {
    setLoading(true); setError(null); setPapers([]); setSelected(new Set()); setMeta(null)
    try {
      const params = new URLSearchParams({ conference, year: String(year), topics, limit: String(maxResults) })
      const res = await fetch(`/api/admin/openreview?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Search failed')
      setPapers(data.papers ?? [])
      setMeta({ total: data.fetchedFromAPI, matched: data.matched, venueId: data.venueId })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const toggleAll = () => {
    setSelected(selected.size === papers.length ? new Set() : new Set(papers.map(p => p.openReviewId)))
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const importSelected = async () => {
    if (selected.size === 0) { toast.error('Select at least one paper'); return }
    setImporting(true)
    try {
      const toImport = papers.filter(p => selected.has(p.openReviewId))
      const res = await fetch('/api/admin/openreview/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papers: toImport, collectionId: collectionId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      toast.success(`Imported ${data.created} paper${data.created !== 1 ? 's' : ''}${data.skipped ? ` · ${data.skipped} already existed` : ''}`)
      setSelected(new Set())
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel */}
      <aside className="w-72 flex-shrink-0 border-r border-white/10 overflow-y-auto p-5 space-y-5">

        {/* Conference groups */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Conference</label>
          <div className="space-y-2">
            {CONFERENCE_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[9px] text-white/20 uppercase tracking-widest mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.values.map(c => (
                    <button
                      key={c}
                      onClick={() => handleConfChange(c)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        conference === c
                          ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300'
                          : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:border-white/25'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Year */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Year</label>
          <div className="flex flex-wrap gap-1.5">
            {availableYears.map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  year === y
                    ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300'
                    : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:border-white/25'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Topic presets */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Quick Presets</label>
          <div className="flex flex-wrap gap-1.5">
            {TOPIC_PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setTopics(preset.value)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                  topics === preset.value
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                    : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Topic keywords */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">
            Topic Keywords <span className="text-white/20 normal-case font-normal">(comma-separated)</span>
          </label>
          <textarea
            value={topics}
            onChange={e => setTopics(e.target.value)}
            rows={3}
            placeholder="Leave empty to get all accepted papers"
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 resize-none"
          />
        </div>

        {/* Max results */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">
            Max Results <span className="text-white/40 font-normal normal-case">({maxResults})</span>
          </label>
          <input
            type="range" min={10} max={200} step={10} value={maxResults}
            onChange={e => setMaxResults(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
            <span>10</span><span>200</span>
          </div>
        </div>

        {/* Collection */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Assign to Collection</label>
          <div className="relative">
            <select
              value={collectionId}
              onFocus={loadCollections}
              onChange={e => setCollectionId(e.target.value)}
              className="w-full appearance-none bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 pr-8"
            >
              <option value="">— None —</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
          </div>
        </div>

        <Button onClick={search} disabled={loading} className="w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Searching…' : 'Search'}
        </Button>

        {meta && (
          <div className="rounded-lg bg-white/[0.03] border border-white/8 p-3 text-xs space-y-1">
            <p className="text-white/50">Venue: <span className="text-white/70 font-mono text-[10px]">{meta.venueId}</span></p>
            <p className="text-white/50">Scanned <span className="text-white/80">{meta.total}</span> papers</p>
            <p className="text-white/50">Matched <span className="text-white/80">{meta.matched}</span> by topic</p>
          </div>
        )}
      </aside>

      {/* Right panel */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {papers.length > 0 && (
          <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
            <button type="button" onClick={toggleAll} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
              {selected.size === papers.length
                ? <CheckSquare className="h-4 w-4 text-blue-400" />
                : <Square className="h-4 w-4" />}
              {selected.size === papers.length ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-white/20 text-xs">{papers.length} results</span>
            <div className="ml-auto flex items-center gap-2">
              {selected.size > 0 && <span className="text-sm text-white/50">{selected.size} selected</span>}
              <Button onClick={importSelected} disabled={importing || selected.size === 0} size="sm">
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Import {selected.size > 0 ? `(${selected.size})` : ''}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="m-6 flex items-start gap-3 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        {!loading && papers.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-8">
            <Search className="h-8 w-8 text-white/15 mb-4" />
            <p className="text-white/30 text-sm mb-1">No papers loaded</p>
            <p className="text-white/20 text-xs max-w-xs">Select a conference, optionally enter topic keywords, then click Search.</p>
          </div>
        )}

        {loading && (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2 animate-pulse">
                <div className="h-3 bg-white/8 rounded w-3/4" />
                <div className="h-2.5 bg-white/5 rounded w-1/2" />
                <div className="h-2.5 bg-white/5 rounded w-full" />
              </div>
            ))}
          </div>
        )}

        {papers.length > 0 && !loading && (
          <div className="p-6 space-y-2">
            {papers.map(paper => (
              <PaperRow key={paper.openReviewId} paper={paper} selected={selected.has(paper.openReviewId)} onToggle={() => toggle(paper.openReviewId)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Bulk Import All
// ─────────────────────────────────────────────────────────────────────────────
function BulkTab() {
  // multi-select conference + year combinations
  const [selectedCombos, setSelectedCombos] = useState<{ conference: string; year: number }[]>([])
  const [maxFetch, setMaxFetch] = useState(500)
  const [withSummarize, setWithSummarize] = useState(false)
  const [collectionId, setCollectionId] = useState('')
  const [collections, setCollections] = useState<Collection[]>([])
  const [collectionsLoaded, setCollectionsLoaded] = useState(false)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<{ text: string; type: 'info' | 'ok' | 'err' | 'progress' }[]>([])
  const [overallProgress, setOverallProgress] = useState<{ done: number; total: number } | null>(null)
  const [done, setDone] = useState(false)

  const loadCollections = async () => {
    if (collectionsLoaded) return
    const res = await fetch('/api/collections')
    const data = await res.json()
    setCollections(data.collections ?? data ?? [])
    setCollectionsLoaded(true)
  }

  const toggleCombo = (conference: string, year: number) => {
    const key = `${conference}-${year}`
    const exists = selectedCombos.some(c => `${c.conference}-${c.year}` === key)
    setSelectedCombos(exists
      ? selectedCombos.filter(c => `${c.conference}-${c.year}` !== key)
      : [...selectedCombos, { conference, year }]
    )
  }

  const addLog = (text: string, type: 'info' | 'ok' | 'err' | 'progress' = 'info') => {
    setLog(l => [...l, { text, type }])
  }

  const startBulk = async () => {
    if (selectedCombos.length === 0) { toast.error('Select at least one conference + year'); return }
    setRunning(true); setLog([]); setDone(false); setOverallProgress(null)

    for (let i = 0; i < selectedCombos.length; i++) {
      const { conference, year } = selectedCombos[i]
      addLog(`[${i + 1}/${selectedCombos.length}] Starting ${conference} ${year}…`, 'info')

      try {
        const res = await fetch('/api/admin/openreview/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conference, year, collectionId: collectionId || undefined, maxFetch, summarize: withSummarize }),
        })

        const reader = res.body?.getReader()
        if (!reader) { addLog('No stream from server', 'err'); continue }
        const dec = new TextDecoder()

        while (true) {
          const { done: rdone, value } = await reader.read()
          if (rdone) break
          const chunk = dec.decode(value)
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue
            try {
              const ev = JSON.parse(line.slice(6)) as SSEEvent
              if (ev.type === 'status')   addLog(`  ${ev.message}`, 'info')
              if (ev.type === 'progress') {
                setOverallProgress({ done: ev.done ?? 0, total: ev.total ?? 0 })
                addLog(`  Imported ${ev.created} / ${ev.total} papers`, 'progress')
              }
              if (ev.type === 'summarized')      addLog(`  ✓ Summarized: ${ev.title}`, 'ok')
              if (ev.type === 'summarize_error') addLog(`  ✗ Error: ${ev.title} — ${ev.error}`, 'err')
              if (ev.type === 'complete') {
                addLog(`✅ ${conference} ${year}: ${ev.created} created, ${ev.skipped} skipped${withSummarize ? `, ${ev.summarized} summarized` : ''}`, 'ok')
              }
              if (ev.type === 'error') addLog(`❌ ${conference} ${year}: ${ev.message}`, 'err')
            } catch { /* malformed SSE line */ }
          }
        }
      } catch (err) {
        addLog(`❌ ${conference} ${year}: ${(err as Error).message}`, 'err')
      }
    }

    setRunning(false)
    setDone(true)
    setOverallProgress(null)
    toast.success('Bulk import complete!')
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel */}
      <aside className="w-80 flex-shrink-0 border-r border-white/10 overflow-y-auto p-5 space-y-6">
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">
            Select Conference × Year
          </label>
          <div className="space-y-4">
            {CONFERENCE_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[9px] text-white/20 uppercase tracking-widest mb-2">{group.label}</p>
                <div className="space-y-1.5">
                  {group.values.map(conf => {
                    const years = CONF_YEARS[conf] ?? []
                    return (
                      <div key={conf}>
                        <p className="text-xs text-white/50 font-medium mb-1">{conf}</p>
                        <div className="flex flex-wrap gap-1">
                          {years.map(y => {
                            const active = selectedCombos.some(c => c.conference === conf && c.year === y)
                            return (
                              <button
                                key={y}
                                onClick={() => toggleCombo(conf, y)}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                                  active
                                    ? 'bg-emerald-600/25 border-emerald-500/40 text-emerald-300'
                                    : 'bg-white/5 border-white/10 text-white/35 hover:text-white/60 hover:border-white/20'
                                }`}
                              >
                                {y}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedCombos.length > 0 && (
          <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 p-3 text-xs text-emerald-300/70">
            {selectedCombos.length} combination{selectedCombos.length > 1 ? 's' : ''} selected:{' '}
            {selectedCombos.map(c => `${c.conference} ${c.year}`).join(', ')}
          </div>
        )}

        {/* Max fetch */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">
            Max papers per source <span className="text-white/40 font-normal normal-case">({maxFetch})</span>
          </label>
          <input type="range" min={50} max={2000} step={50} value={maxFetch}
            onChange={e => setMaxFetch(Number(e.target.value))} className="w-full accent-emerald-500" />
          <div className="flex justify-between text-[10px] text-white/20 mt-0.5"><span>50</span><span>2000</span></div>
          <p className="text-[10px] text-white/25 mt-1">Large conferences (ICLR, NeurIPS) have 1000–4000 accepted papers per year.</p>
        </div>

        {/* Collection */}
        <div>
          <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Assign to Collection (optional)</label>
          <div className="relative">
            <select value={collectionId} onFocus={loadCollections} onChange={e => setCollectionId(e.target.value)}
              className="w-full appearance-none bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 pr-8">
              <option value="">— None —</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
          </div>
        </div>

        {/* Summarize option */}
        <label className="flex items-start gap-3 cursor-pointer">
          <div className="relative mt-0.5">
            <input type="checkbox" checked={withSummarize} onChange={e => setWithSummarize(e.target.checked)} className="sr-only" />
            <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${withSummarize ? 'bg-emerald-600 border-emerald-600' : 'border-white/25 bg-white/5'}`}>
              {withSummarize && <CheckCircle2 className="h-3 w-3 text-white" />}
            </div>
          </div>
          <div>
            <p className="text-sm text-white/70 font-medium">Auto-summarize with AI</p>
            <p className="text-[10px] text-white/30 mt-0.5">Generates TL;DR, key ideas, and embeddings. Uses OpenAI credits. Slow for large batches.</p>
          </div>
        </label>

        <Button
          onClick={startBulk}
          disabled={running || selectedCombos.length === 0}
          className="w-full bg-emerald-700 hover:bg-emerald-600 border-emerald-600"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          {running ? 'Importing…' : `Import All (${selectedCombos.length} source${selectedCombos.length !== 1 ? 's' : ''})`}
        </Button>
      </aside>

      {/* Right panel — progress log */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6">
        {log.length === 0 && !running && (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <Database className="h-10 w-10 text-white/10 mb-4" />
            <p className="text-white/30 text-sm mb-1">Select conference + year combinations</p>
            <p className="text-white/20 text-xs max-w-sm">
              Bulk import fetches ALL accepted papers from the chosen sources, skips any that are already in your database, and optionally generates AI summaries.
            </p>
          </div>
        )}

        {overallProgress && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-white/40 mb-1">
              <span>Importing papers…</span>
              <span>{overallProgress.done} / {overallProgress.total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${(overallProgress.done / Math.max(overallProgress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {log.length > 0 && (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/8 flex items-center gap-2">
              <span className="text-xs text-white/30 font-medium">Import Log</span>
              {done && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Complete</span>}
              {running && <Loader2 className="h-3 w-3 text-white/30 animate-spin" />}
            </div>
            <div className="p-4 space-y-1 max-h-[600px] overflow-y-auto font-mono text-xs">
              {log.map((entry, i) => (
                <p key={i} className={
                  entry.type === 'ok'       ? 'text-emerald-400' :
                  entry.type === 'err'      ? 'text-red-400' :
                  entry.type === 'progress' ? 'text-blue-400/60' :
                  'text-white/40'
                }>
                  {entry.text}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared PaperRow
// ─────────────────────────────────────────────────────────────────────────────
function PaperRow({ paper, selected, onToggle }: { paper: OpenReviewPaper; selected: boolean; onToggle: () => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`rounded-xl border transition-colors ${selected ? 'border-blue-500/30 bg-blue-500/[0.05]' : 'border-white/8 bg-white/[0.02] hover:border-white/15'}`}>
      <div className="flex items-start gap-3 p-4">
        <button type="button" onClick={onToggle} className="flex-shrink-0 mt-0.5 text-white/40 hover:text-blue-400 transition-colors">
          {selected ? <CheckSquare className="h-4 w-4 text-blue-400" /> : <Square className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <p className="text-sm font-semibold text-white/90 leading-snug flex-1">{paper.title}</p>
            {paper.score > 0 && (
              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono">{paper.score}pt</span>
            )}
          </div>
          <p className="text-xs text-white/35 mb-1.5 truncate">
            {paper.authors.slice(0, 4).join(', ')}{paper.authors.length > 4 ? ` +${paper.authors.length - 4}` : ''}
          </p>
          {paper.primaryArea && <p className="text-[10px] text-blue-400/70 mb-1.5">{paper.primaryArea}</p>}
          <p className={`text-xs text-white/40 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>{paper.abstract}</p>
          {paper.abstract.length > 200 && (
            <button type="button" onClick={() => setExpanded(e => !e)} className="text-[10px] text-white/30 hover:text-white/60 mt-0.5 transition-colors">
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {paper.keywords.slice(0, 5).map(kw => (
              <span key={kw} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">
                <Tag className="h-2 w-2" />{kw}
              </span>
            ))}
            <a href={paper.openReviewUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="ml-auto flex items-center gap-0.5 text-[10px] text-white/25 hover:text-blue-400 transition-colors">
              OpenReview <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
