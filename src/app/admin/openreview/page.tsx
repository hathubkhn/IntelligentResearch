'use client'

import { useState } from 'react'
import { Search, Download, Loader2, CheckSquare, Square, ChevronDown, ExternalLink, Tag, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { OpenReviewPaper } from '@/app/api/admin/openreview/route'

const CONFERENCES = ['ICLR', 'NeurIPS', 'ICML', 'COLM', 'TMLR', 'AISTATS', 'UAI'] as const
const YEARS = [2025, 2024, 2023, 2022, 2021] as const

// Suggested topic presets aligned with existing collections
const TOPIC_PRESETS = [
  { label: 'Multimodal & VLM', value: 'multimodal, vision language, visual question answering, image text' },
  { label: 'LLM Reasoning', value: 'reasoning, chain of thought, mathematical, theorem proving, code generation' },
  { label: 'Efficient LLMs', value: 'quantization, pruning, distillation, efficient, compression, speculative decoding' },
  { label: 'Embodied AI', value: 'embodied, robot, manipulation, locomotion, sim-to-real' },
  { label: '3D & NeRF', value: '3D reconstruction, gaussian splatting, neural radiance, point cloud, depth estimation' },
  { label: 'Healthcare & Bio', value: 'medical, clinical, radiology, pathology, genomics, protein, drug discovery' },
  { label: 'Bioinformatics', value: 'protein structure, genomics, single cell, gene expression, AlphaFold, RNA' },
  { label: 'Diffusion Models', value: 'diffusion, score matching, denoising, generative, image generation' },
  { label: 'RLHF & Alignment', value: 'alignment, RLHF, reward model, preference, constitutional AI, safety' },
  { label: 'Agents & Planning', value: 'agent, planning, tool use, multi-agent, autonomous, workflow' },
]

interface Collection { id: string; name: string }

export default function OpenReviewImportPage() {
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

  // Load collections lazily on first dropdown open
  const loadCollections = async () => {
    if (collectionsLoaded) return
    const res = await fetch('/api/collections')
    const data = await res.json()
    setCollections(data.collections ?? data ?? [])
    setCollectionsLoaded(true)
  }

  const search = async () => {
    if (!topics.trim()) {
      toast.error('Enter at least one topic keyword')
      return
    }
    setLoading(true)
    setError(null)
    setPapers([])
    setSelected(new Set())
    setMeta(null)
    try {
      const params = new URLSearchParams({
        conference,
        year: String(year),
        topics,
        limit: String(maxResults),
      })
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
    if (selected.size === papers.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(papers.map(p => p.openReviewId)))
    }
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
      // Deselect imported papers
      setSelected(new Set())
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-white/10 px-8 py-5">
        <h1 className="text-xl font-bold text-white">OpenReview Import</h1>
        <p className="text-sm text-white/40 mt-0.5">
          Search accepted papers from ICLR, NeurIPS, ICML, COLM and TMLR · No API key required
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — controls */}
        <aside className="w-72 flex-shrink-0 border-r border-white/10 overflow-y-auto p-5 space-y-5">

          {/* Conference + Year */}
          <div>
            <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Conference</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <select
                  value={conference}
                  onChange={e => setConference(e.target.value)}
                  className="w-full appearance-none bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 pr-8"
                >
                  {CONFERENCES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  className="w-full appearance-none bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 pr-8"
                >
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
              </div>
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
              placeholder="e.g. multimodal, vision language, image text"
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 resize-none"
            />
            <p className="text-[10px] text-white/25 mt-1">
              Papers are scored by keyword hits in title, primary area, keywords, and abstract.
            </p>
          </div>

          {/* Max results */}
          <div>
            <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">
              Max Results <span className="text-white/40 font-normal normal-case">({maxResults})</span>
            </label>
            <input
              type="range"
              min={10}
              max={200}
              step={10}
              value={maxResults}
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
            {loading ? 'Searching OpenReview…' : 'Search'}
          </Button>

          {meta && (
            <div className="rounded-lg bg-white/[0.03] border border-white/8 p-3 text-xs space-y-1">
              <p className="text-white/50">
                Venue: <span className="text-white/70 font-mono text-[10px]">{meta.venueId}</span>
              </p>
              <p className="text-white/50">Scanned <span className="text-white/80">{meta.total}</span> papers from API</p>
              <p className="text-white/50">Matched <span className="text-white/80">{meta.matched}</span> by topic</p>
            </div>
          )}
        </aside>

        {/* Right panel — results */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {/* Action bar */}
          {papers.length > 0 && (
            <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                {selected.size === papers.length
                  ? <CheckSquare className="h-4 w-4 text-blue-400" />
                  : <Square className="h-4 w-4" />}
                {selected.size === papers.length ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-white/20 text-xs">{papers.length} results</span>
              <div className="ml-auto flex items-center gap-2">
                {selected.size > 0 && (
                  <span className="text-sm text-white/50">{selected.size} selected</span>
                )}
                <Button onClick={importSelected} disabled={importing || selected.size === 0} size="sm">
                  {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Import {selected.size > 0 ? `(${selected.size})` : ''}
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="m-6 flex items-start gap-3 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && papers.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-8">
              <Search className="h-8 w-8 text-white/15 mb-4" />
              <p className="text-white/30 text-sm mb-1">No papers loaded</p>
              <p className="text-white/20 text-xs max-w-xs">
                Select a conference, enter topic keywords (e.g. "multimodal, vision language"), then click Search.
              </p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2 animate-pulse">
                  <div className="h-3 bg-white/8 rounded w-3/4" />
                  <div className="h-2.5 bg-white/5 rounded w-1/2" />
                  <div className="h-2.5 bg-white/5 rounded w-full" />
                  <div className="h-2.5 bg-white/5 rounded w-5/6" />
                </div>
              ))}
            </div>
          )}

          {/* Paper list */}
          {papers.length > 0 && !loading && (
            <div className="p-6 space-y-2">
              {papers.map(paper => (
                <PaperRow
                  key={paper.openReviewId}
                  paper={paper}
                  selected={selected.has(paper.openReviewId)}
                  onToggle={() => toggle(paper.openReviewId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PaperRow({
  paper,
  selected,
  onToggle,
}: {
  paper: OpenReviewPaper
  selected: boolean
  onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`rounded-xl border transition-colors ${
        selected
          ? 'border-blue-500/30 bg-blue-500/[0.05]'
          : 'border-white/8 bg-white/[0.02] hover:border-white/15'
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Checkbox */}
        <button
          type="button"
          onClick={onToggle}
          className="flex-shrink-0 mt-0.5 text-white/40 hover:text-blue-400 transition-colors"
        >
          {selected
            ? <CheckSquare className="h-4 w-4 text-blue-400" />
            : <Square className="h-4 w-4" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title + score */}
          <div className="flex items-start gap-2 mb-1">
            <p className="text-sm font-semibold text-white/90 leading-snug flex-1">
              {paper.title}
            </p>
            {paper.score > 0 && (
              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono">
                {paper.score}pt
              </span>
            )}
          </div>

          {/* Authors */}
          <p className="text-xs text-white/35 mb-1.5 truncate">
            {paper.authors.slice(0, 4).join(', ')}{paper.authors.length > 4 ? ` +${paper.authors.length - 4} more` : ''}
          </p>

          {/* Primary area */}
          {paper.primaryArea && (
            <p className="text-[10px] text-blue-400/70 mb-1.5">{paper.primaryArea}</p>
          )}

          {/* Abstract */}
          <p className={`text-xs text-white/40 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
            {paper.abstract}
          </p>
          {paper.abstract.length > 200 && (
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              className="text-[10px] text-white/30 hover:text-white/60 mt-0.5 transition-colors"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}

          {/* Keywords + links */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {paper.keywords.slice(0, 5).map(kw => (
              <span key={kw} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">
                <Tag className="h-2 w-2" />{kw}
              </span>
            ))}
            <a
              href={paper.openReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="ml-auto flex items-center gap-0.5 text-[10px] text-white/25 hover:text-blue-400 transition-colors"
            >
              OpenReview <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
