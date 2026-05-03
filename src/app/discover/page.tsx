'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import {
  Search, Download, Loader2, CheckSquare, Square,
  AlertCircle, Sparkles, BookOpen, LayoutList, PanelRight,
  X, Check, Brain, LayoutGrid, Filter, History, Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { WorkspaceGrid } from '@/components/discover/WorkspaceGrid'
import { DiscoverFilterPanel } from '@/components/discover/DiscoverFilterPanel'
import { EnhancedPaperCard } from '@/components/discover/EnhancedPaperCard'
import { GapAnalysisPanel, type GapAnalysisState } from '@/components/discover/GapAnalysisPanel'
import { RelatedPapersPanel } from '@/components/discover/RelatedPapersPanel'
import { UsageBadge } from '@/components/discover/UsageBadge'
import { QuotaModal } from '@/components/discover/QuotaModal'
import { DiscoverHistoryPanel, type HistoryEntry } from '@/components/discover/DiscoverHistoryPanel'
import { LeaderboardPanel } from '@/components/discover/LeaderboardPanel'
import {
  buildKeywordsFromSelections,
  buildWorkspaceKeywords,
  AI_METHODS,
  APPLICATION_DOMAINS,
  RESEARCH_TASKS,
  type Workspace,
  type SubTopic,
} from '@/lib/discover-config'
import type { OpenReviewPaper } from '@/app/api/admin/openreview/route'

const CONFERENCES = ['ICLR', 'NeurIPS', 'ICML', 'COLM', 'TMLR', 'AISTATS', 'UAI'] as const
const YEARS = [2025, 2024, 2023, 2022, 2021] as const

// Which years are available per conference (mirrors VENUE_IDS in admin route)
const VALID_VENUE_YEARS: Record<string, number[]> = {
  ICLR:    [2022, 2023, 2024, 2025],
  NeurIPS: [2021, 2022, 2023, 2024],
  ICML:    [2022, 2023, 2024, 2025],
  COLM:    [2024, 2025],
  TMLR:    [2022, 2023, 2024, 2025],
  AISTATS: [2024, 2025],
  UAI:     [2023, 2024],
}

type View = 'workspaces' | 'search' | 'imported' | 'history' | 'leaderboard'
type RightPanel = null | 'gaps' | 'related'

type SummarizeEvent =
  | { type: 'start';      total: number }
  | { type: 'processing'; id: string; title: string }
  | { type: 'done';       id: string }
  | { type: 'error';      id: string; message: string }
  | { type: 'complete' }

interface ImportedCollection {
  collectionId: string
  collectionName: string
  created: number
  skipped: number
}

interface SummarizeProgress {
  total: number
  done: number
  current: string | null
  errors: number
  finished: boolean
}

export default function DiscoverPage() {
  const { data: session, status, update: refreshSession } = useSession()
  const isAuth = status === 'authenticated'

  const sessionUser = session?.user as {
    id?: string; plan?: string; usageUsed?: number; usageLimit?: number
  } | undefined
  const userPlan  = sessionUser?.plan  ?? 'FREE'
  const usageUsed = sessionUser?.usageUsed  ?? 0
  const usageLimit = sessionUser?.usageLimit ?? 10

  // ── Quota modal ──
  const [showQuota, setShowQuota] = useState(false)

  // ── View state ──
  const [view, setView] = useState<View>('workspaces')

  // ── Filter state (3-layer) ──
  const [selectedConferences, setSelectedConferences] = useState<string[]>([])   // empty = All
  const [selectedYears, setSelectedYears]             = useState<number[]>([])   // empty = All (last 3)
  const [selectedMethods, setSelectedMethods] = useState<string[]>([])
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])
  const [selectedTasks, setSelectedTasks]     = useState<string[]>([])
  const [customKeywords, setCustomKeywords]   = useState('')
  const [maxResults, setMaxResults]           = useState(50)

  // ── Active workspace context (for gap analysis domain context) ──
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)

  // ── Search state ──
  const [searching, setSearching]   = useState(false)
  const [papers, setPapers]         = useState<OpenReviewPaper[]>([])
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [searchMeta, setSearchMeta] = useState<{ total: number; matched: number; venueId: string } | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  // ── Import modal state ──
  const [showImportModal, setShowImportModal]   = useState(false)
  const [collectionName, setCollectionName]     = useState('')
  const [collectionDesc, setCollectionDesc]     = useState('')
  const [importing, setImporting]               = useState(false)

  // ── Post-import state ──
  const [imported, setImported] = useState<ImportedCollection | null>(null)

  // ── Summarize state ──
  const [summarizing, setSummarizing]                 = useState(false)
  const [summarizeProgress, setSummarizeProgress]     = useState<SummarizeProgress | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── Right panel ──
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)
  const togglePanel = (panel: RightPanel) =>
    setRightPanel(prev => prev === panel ? null : panel)

  // ── Gap analysis — lifted so results persist across panel close/reopen ──
  const [gapState, setGapState] = useState<GapAnalysisState>({ status: 'idle', markdown: '' })
  // Track the current history entry id so we can attach gap analysis to it later
  const currentHistoryIdRef = useRef<string | null>(null)

  // ── History ──
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  // Auto-switch to 'search' view whenever a search is in progress or has results.
  // This acts as a safeguard against any state-sync issue (HMR, stale closures, etc.)
  // that might leave view as 'workspaces' while a search is active.
  useEffect(() => {
    if (searching || papers.length > 0) setView('search')
  }, [searching, papers.length])

  // ── Workspace selection handler ──
  const handleWorkspaceSelect = (workspace: Workspace, subtopic?: SubTopic) => {
    setActiveWorkspace(workspace)
    const keywords = buildWorkspaceKeywords(workspace, subtopic)
    // Populate domain filter
    setSelectedDomains([workspace.domain])
    if (subtopic) {
      setSelectedMethods(subtopic.methods)
      setSelectedTasks(subtopic.tasks)
    } else {
      setSelectedMethods([])
      setSelectedTasks([])
    }
    setCustomKeywords('')
    // Store generated keywords as custom override so search uses them directly
    setCustomKeywords(keywords)
    setView('search')
    triggerSearch(keywords)
  }

  // ── Build keywords string for each group ──
  const buildMethodKeywords = () =>
    selectedMethods.map(m => AI_METHODS.find(o => o.label === m)?.keywords ?? '').filter(Boolean).join(', ')
  const buildDomainKeywords = () =>
    selectedDomains.map(d => APPLICATION_DOMAINS.find(o => o.label === d)?.keywords ?? '').filter(Boolean).join(', ')
  const buildTaskKeywords = () =>
    selectedTasks.map(t => RESEARCH_TASKS.find(o => o.label === t)?.keywords ?? '').filter(Boolean).join(', ')

  // Legacy flat topics string (used for history saving & fallback)
  const buildTopicQuery = (overrideCustom?: string) => {
    const custom = overrideCustom ?? customKeywords
    const fromFilters = buildKeywordsFromSelections(selectedMethods, selectedDomains, selectedTasks)
    const parts = [fromFilters, custom.trim()].filter(Boolean)
    return parts.join(', ')
  }

  // ── Search ──
  const triggerSearch = async (overrideKeywords?: string) => {
    // When called with overrideKeywords (history restore), use legacy flat topics mode
    const isLegacy = overrideKeywords !== undefined
    const legacyTopics = isLegacy ? overrideKeywords : ''
    if (isLegacy && !legacyTopics.trim()) { toast.error('Select at least one filter or enter keywords'); return }
    if (!isLegacy) {
      const hasAny = selectedMethods.length > 0 || selectedDomains.length > 0 ||
        selectedTasks.length > 0 || customKeywords.trim()
      if (!hasAny) { toast.error('Select at least one filter or enter keywords'); return }
    }
    setSearching(true)
    setSearchError(null)
    setPapers([])
    setSelected(new Set())
    setSearchMeta(null)
    setView('search')
    setGapState({ status: 'idle', markdown: '' })

    // Resolve "All" selections — empty = use defaults
    const confs = selectedConferences.length > 0 ? selectedConferences : [...CONFERENCES]
    const yrs   = selectedYears.length > 0 ? selectedYears : [2025, 2024, 2023]

    // Compute valid combos from the VALID_VENUE_YEARS map
    const combos = confs.flatMap(c =>
      yrs.filter(y => VALID_VENUE_YEARS[c]?.includes(y)).map(y => ({ c, y }))
    )

    try {
      const params = new URLSearchParams({
        conferences: combos.map(x => x.c).join(','),
        years:       combos.map(x => x.y).join(','),
        limit: String(maxResults),
      })
      if (isLegacy) {
        params.set('topics', legacyTopics)
      } else {
        if (selectedMethods.length > 0) params.set('methods', buildMethodKeywords())
        if (selectedDomains.length > 0) params.set('domains', buildDomainKeywords())
        if (selectedTasks.length > 0)   params.set('tasks',   buildTaskKeywords())
        if (customKeywords.trim())       params.set('custom',  customKeywords.trim())
      }
      const res  = await fetch(`/api/openreview?${params}`)
      const data = await res.json() as { papers?: unknown[]; fetchedFromAPI?: number; matched?: number; venueId?: string; error?: string; upgrade?: boolean }
      if (res.status === 429 && data.upgrade) { setShowQuota(true); return }
      if (!res.ok) throw new Error(data.error ?? 'Search failed')
      const resultPapers = (data.papers ?? []) as OpenReviewPaper[]
      setPapers(resultPapers)
      setSearchMeta({ total: data.fetchedFromAPI ?? 0, matched: data.matched ?? 0, venueId: data.venueId ?? '' })
      refreshSession()
      if (isAuth && resultPapers.length > 0) {
        const compactPapers = resultPapers.slice(0, 50).map(p => ({
          id: p.openReviewId, title: p.title, venue: p.venue,
          year: p.year, score: p.score, openReviewUrl: p.openReviewUrl,
        }))
        fetch('/api/discover/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conference: confs.join(', '), year: yrs[0],
            topics: buildTopicQuery(),
            methods: selectedMethods, domains: selectedDomains, tasks: selectedTasks,
            maxResults, matchedCount: resultPapers.length,
            papers: compactPapers,
          }),
        })
          .then(r => r.json())
          .then((d: { id?: string }) => { if (d.id) currentHistoryIdRef.current = d.id })
          .catch(() => { /* non-critical */ })
        setHistoryRefreshKey(k => k + 1)
      }
    } catch (e) {
      setSearchError((e as Error).message)
    } finally {
      setSearching(false)
    }
  }

  const toggleAll = () =>
    setSelected(selected.size === papers.length ? new Set() : new Set(papers.map(p => p.openReviewId)))
  const toggle = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  // ── Import ──
  const openImportModal = () => {
    if (!isAuth) { signIn('github'); return }
    if (selected.size === 0) { toast.error('Select at least one paper'); return }
    const methodLabel = selectedMethods[0] ?? ''
    const domainLabel = selectedDomains[0] ?? ''
    setCollectionName(`${domainLabel || methodLabel || selectedConferences[0] || ''} ${selectedYears[0] ?? ''} – Discovery`.trim())
    setShowImportModal(true)
  }

  const confirmImport = async () => {
    if (!collectionName.trim()) { toast.error('Collection name is required'); return }
    setImporting(true)
    try {
      const toImport = papers.filter(p => selected.has(p.openReviewId))
      const res = await fetch('/api/openreview/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          papers: toImport,
          collectionName: collectionName.trim(),
          collectionDescription: collectionDesc.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setImported(data as ImportedCollection)
      setShowImportModal(false)
      setView('imported')
      toast.success(`Imported ${data.created} papers into "${data.collectionName}"`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  // ── Summarize all ──
  const summarizeAll = async () => {
    if (!imported) return
    setSummarizing(true)
    setSummarizeProgress({ total: 0, done: 0, current: null, errors: 0, finished: false })
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await fetch('/api/collections/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId: imported.collectionId }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error('Failed to start summarization')
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const evt = JSON.parse(line.slice(6)) as SummarizeEvent
          setSummarizeProgress(prev => {
            if (!prev) return prev
            if (evt.type === 'start')      return { ...prev, total: evt.total }
            if (evt.type === 'processing') return { ...prev, current: evt.title }
            if (evt.type === 'done')       return { ...prev, done: prev.done + 1, current: null }
            if (evt.type === 'error')      return { ...prev, errors: prev.errors + 1, current: null }
            if (evt.type === 'complete')   return { ...prev, finished: true, current: null }
            return prev
          })
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error((e as Error).message)
    } finally {
      setSummarizing(false)
    }
  }

  const selectedPapers = papers.filter(p => selected.has(p.openReviewId))

  // Computed domain label — used for gap analysis context and history persistence
  const targetDomain = selectedDomains[0] ?? activeWorkspace?.domain

  const handleGapStateChange = (s: GapAnalysisState) => {
    setGapState(s)
    if (s.status === 'done') {
      refreshSession()
      // Attach gap analysis to the current history entry
      if (currentHistoryIdRef.current) {
        fetch(`/api/discover/history/${currentHistoryIdRef.current}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gapMarkdown: s.markdown, targetDomain }),
        }).catch(() => { /* non-critical */ })
      }
      setHistoryRefreshKey(k => k + 1)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST-IMPORT VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (view === 'imported' && imported) {
    return (
      <div className="min-h-screen flex">
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header */}
          <div className="border-b border-white/10 px-8 py-5 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Check className="h-4 w-4 text-emerald-400" />
                <h1 className="text-xl font-bold text-white">{imported.collectionName}</h1>
              </div>
              <p className="text-sm text-white/40">
                {imported.created} papers imported{imported.skipped > 0 ? ` · ${imported.skipped} skipped (duplicates)` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a href={`/collections/${imported.collectionId}`}
                className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg">
                <LayoutList className="h-3.5 w-3.5" /> View Collection
              </a>
              <button onClick={() => togglePanel('related')}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${rightPanel === 'related' ? 'bg-purple-500/15 border-purple-500/30 text-purple-300' : 'text-white/50 hover:text-white border-white/10 hover:border-white/20'}`}>
                <PanelRight className="h-3.5 w-3.5" /> Find Related
              </button>
              <button onClick={() => togglePanel('gaps')}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${rightPanel === 'gaps' ? 'bg-purple-500/15 border-purple-500/30 text-purple-300' : 'text-white/50 hover:text-white border-white/10 hover:border-white/20'}`}>
                <Brain className="h-3.5 w-3.5" /> Analyze Gaps
              </button>
            </div>
          </div>

          {/* Summarize section */}
          <div className="flex-1 overflow-y-auto px-8 py-8">
            <div className="max-w-2xl mx-auto">
              {/* Summarize card */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">AI Summarization</h2>
                    <p className="text-xs text-white/40">Generate TL;DR, key ideas, and contributions for all papers</p>
                  </div>
                </div>
                {summarizeProgress?.finished ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <Check className="h-4 w-4" />
                    Complete — {summarizeProgress.done} done
                    {summarizeProgress.errors > 0 && `, ${summarizeProgress.errors} errors`}
                  </div>
                ) : summarizing && summarizeProgress ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-white/50">
                      <span className={summarizeProgress.current ? 'text-blue-400 truncate max-w-xs' : ''}>
                        {summarizeProgress.current ?? 'Processing…'}
                      </span>
                      <span>{summarizeProgress.done} / {summarizeProgress.total}</span>
                    </div>
                    <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                        style={{ width: summarizeProgress.total > 0 ? `${(summarizeProgress.done / summarizeProgress.total) * 100}%` : '0%' }}
                      />
                    </div>
                    <button onClick={() => abortRef.current?.abort()} className="text-xs text-white/30 hover:text-red-400 transition-colors">Cancel</button>
                  </div>
                ) : (
                  <Button onClick={summarizeAll} className="w-full sm:w-auto">
                    <Sparkles className="h-4 w-4" /> Summarize All {imported.created} Papers
                  </Button>
                )}
              </div>

              {/* Next steps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a href={`/collections/${imported.collectionId}`}
                  className="rounded-xl border border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04] transition-colors p-4 group">
                  <BookOpen className="h-5 w-5 text-white/30 group-hover:text-white/60 mb-2 transition-colors" />
                  <p className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">Browse Papers</p>
                  <p className="text-xs text-white/30 mt-0.5">View your imported collection</p>
                </a>
                <button onClick={() => togglePanel('gaps')}
                  className="rounded-xl border border-white/8 bg-white/[0.02] hover:border-purple-500/20 hover:bg-purple-500/[0.04] transition-colors p-4 text-left group">
                  <Brain className="h-5 w-5 text-white/30 group-hover:text-purple-400 mb-2 transition-colors" />
                  <p className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">Analyze Research Gaps</p>
                  <p className="text-xs text-white/30 mt-0.5">Find gaps, open questions & transfer opportunities</p>
                </button>
                <button onClick={() => { setView('workspaces'); setImported(null) }}
                  className="rounded-xl border border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04] transition-colors p-4 text-left group sm:col-span-2">
                  <Search className="h-5 w-5 text-white/30 group-hover:text-white/60 mb-2 transition-colors" />
                  <p className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">New Discovery</p>
                  <p className="text-xs text-white/30 mt-0.5">Search another conference or topic</p>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        {rightPanel === 'related' && imported && (
          <aside className="w-80 flex-shrink-0 border-l border-white/10 flex flex-col overflow-hidden">
            <RelatedPapersPanel collectionId={imported.collectionId} onClose={() => setRightPanel(null)} />
          </aside>
        )}
        {rightPanel === 'gaps' && selectedPapers.length === 0 && (
          <aside className="w-96 flex-shrink-0 border-l border-white/10 flex flex-col overflow-hidden">
            <GapAnalysisPanel
              papers={papers.slice(0, 20)}
              targetDomain={targetDomain}
              savedState={gapState}
              onStateChange={handleGapStateChange}
              onClose={() => setRightPanel(null)}
              onQuotaExceeded={() => setShowQuota(true)}
              usageRemaining={Math.max(0, usageLimit - usageUsed)}
            />
          </aside>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKSPACE / SEARCH VIEW
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {showQuota && (
        <QuotaModal
          plan={userPlan}
          used={usageUsed}
          limit={usageLimit}
          onClose={() => setShowQuota(false)}
        />
      )}
      <div className="min-h-screen flex flex-col">
        {/* Header tabs */}
        <div className="border-b border-white/10 px-6 py-0 flex items-center gap-0">
          <div className="flex items-center gap-1.5 py-4 pr-6 mr-2 border-r border-white/8">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Discover</span>
          </div>
          <button
            onClick={() => {
              setView('workspaces')
              setPapers([])
              setSearchMeta(null)
              setSelected(new Set())
              setSearchError(null)
            }}
            className={`flex items-center gap-1.5 px-4 py-4 text-sm border-b-2 transition-colors ${
              view === 'workspaces'
                ? 'border-blue-400 text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Workspaces
          </button>
          <button
            onClick={() => setView('search')}
            className={`flex items-center gap-1.5 px-4 py-4 text-sm border-b-2 transition-colors ${
              view === 'search'
                ? 'border-blue-400 text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <Filter className="h-3.5 w-3.5" /> Filter Search
          </button>
          {papers.length > 0 && (
            <span className="ml-2 text-[10px] text-white/30 font-mono">{papers.length} results</span>
          )}
          <button
            onClick={() => setView('leaderboard')}
            className={`flex items-center gap-1.5 px-4 py-4 text-sm border-b-2 transition-colors ${
              view === 'leaderboard'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" /> Leaderboard
          </button>
          {/* History tab — only for authenticated users */}
          {isAuth && (
            <button
              onClick={() => setView('history')}
              className={`flex items-center gap-1.5 px-4 py-4 text-sm border-b-2 transition-colors ${
                view === 'history'
                  ? 'border-purple-400 text-white'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <History className="h-3.5 w-3.5" /> History
            </button>
          )}
          {/* Usage badge pushed to the right */}
          {isAuth && (
            <div className="ml-auto">
              <UsageBadge used={usageUsed} limit={usageLimit} plan={userPlan} />
            </div>
          )}
        </div>

        {/* Leaderboard view */}
        {view === 'leaderboard' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-6 py-3 border-b border-white/8 flex-shrink-0">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-white/70">Benchmark Leaderboard</span>
              <span className="text-[10px] text-white/30 ml-1">· AI-extracted from arXiv papers</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <LeaderboardPanel
                currentPapers={papers}
                initialQuery={buildTopicQuery()}
              />
            </div>
          </div>
        )}

        {/* History view */}
        {view === 'history' && isAuth && (          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-6 py-3 border-b border-white/8">
              <History className="h-4 w-4 text-white/40" />
              <span className="text-sm font-semibold text-white/70">Discovery History</span>
              <span className="text-[10px] text-white/30 ml-1">· click any entry to restore</span>
            </div>
            <DiscoverHistoryPanel
              refreshTrigger={historyRefreshKey}
              onRestoreSearch={(entry) => {
                // Restore filters and re-run search
                setSelectedConferences(entry.conference ? [entry.conference] : [])
                setSelectedYears(entry.year ? [entry.year] : [])
                setSelectedMethods(entry.methods)
                setSelectedDomains(entry.domains)
                setSelectedTasks(entry.tasks)
                setMaxResults(entry.maxResults)
                setCustomKeywords(entry.topics)
                setView('search')
                triggerSearch(entry.topics)
              }}
              onViewGapAnalysis={(entry) => {
                // Restore gap analysis from the history entry
                if (entry.gapMarkdown) {
                  setGapState({ status: 'done', markdown: entry.gapMarkdown })
                  currentHistoryIdRef.current = entry.id
                  setView('search')
                  setRightPanel('gaps')
                }
              }}
            />
          </div>
        )}

        {/* Workspace grid — hidden whenever a search is active or results exist */}
        {view === 'workspaces' && !searching && papers.length === 0 && (
          <div className="flex-1 overflow-y-auto">
            <WorkspaceGrid onSelectWorkspace={handleWorkspaceSelect} />
          </div>
        )}

        {/* Filter search (sidebar + results) — shown when view='search' OR when search is active */}
        {(view === 'search' || searching || papers.length > 0 || searchError) && (
          <div className="flex flex-1 overflow-hidden">
            {/* ── Sidebar ── */}
            <aside className="w-72 flex-shrink-0 border-r border-white/10 overflow-y-auto p-4 space-y-4">

              {/* Conference & Year — multi-select pills */}
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest">Conference & Year</label>

                {/* Conferences */}
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedConferences([])}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedConferences.length === 0
                          ? 'bg-blue-500/25 border-blue-400/50 text-blue-300'
                          : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                      }`}
                    >All</button>
                    {CONFERENCES.map(c => (
                      <button key={c}
                        onClick={() => setSelectedConferences(prev =>
                          prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
                        )}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selectedConferences.includes(c)
                            ? 'bg-blue-500/25 border-blue-400/50 text-blue-300'
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                        }`}
                      >{c}</button>
                    ))}
                  </div>
                </div>

                {/* Years */}
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedYears([])}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedYears.length === 0
                          ? 'bg-violet-500/25 border-violet-400/50 text-violet-300'
                          : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                      }`}
                    >All</button>
                    {YEARS.map(y => (
                      <button key={y}
                        onClick={() => setSelectedYears(prev =>
                          prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y]
                        )}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selectedYears.includes(y)
                            ? 'bg-violet-500/25 border-violet-400/50 text-violet-300'
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                        }`}
                      >{y}</button>
                    ))}
                  </div>
                </div>

                {/* Summary of active selection */}
                {(selectedConferences.length > 0 || selectedYears.length > 0) && (
                  <p className="text-[10px] text-white/30 leading-relaxed">
                    {selectedConferences.length === 0 ? 'All conferences' : selectedConferences.join(', ')}
                    {' · '}
                    {selectedYears.length === 0 ? 'last 3 years' : selectedYears.join(', ')}
                  </p>
                )}
              </div>

              {/* 3-layer filter */}
              <DiscoverFilterPanel
                selectedMethods={selectedMethods}
                selectedDomains={selectedDomains}
                selectedTasks={selectedTasks}
                customKeywords={customKeywords}
                onMethodsChange={v => { setSelectedMethods(v); setActiveWorkspace(null) }}
                onDomainsChange={v => { setSelectedDomains(v); setActiveWorkspace(null) }}
                onTasksChange={v => { setSelectedTasks(v); setActiveWorkspace(null) }}
                onCustomKeywordsChange={v => { setCustomKeywords(v); setActiveWorkspace(null) }}
              />

              {/* Max results */}
              <div>
                <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">
                  Max Results <span className="text-white/40 font-normal normal-case">({maxResults})</span>
                </label>
                <input type="range" min={10} max={200} step={10}
                  value={maxResults} onChange={e => setMaxResults(Number(e.target.value))}
                  className="w-full accent-blue-500" />
                <div className="flex justify-between text-[10px] text-white/20 mt-0.5"><span>10</span><span>200</span></div>
              </div>

              <Button onClick={() => triggerSearch()} disabled={searching} className="w-full">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {searching ? 'Searching…' : 'Search OpenReview'}
              </Button>

              {searchMeta && (
                <div className="rounded-lg bg-white/[0.03] border border-white/8 p-3 text-xs space-y-1">
                  <p className="text-white/40 font-mono text-[10px] truncate">{searchMeta.venueId}</p>
                  <p className="text-white/50">Scanned <span className="text-white/80">{searchMeta.total}</span> papers</p>
                  <p className="text-white/50">Matched <span className="text-white/80">{searchMeta.matched}</span> by topic</p>
                </div>
              )}

              {!isAuth && (
                <div className="rounded-lg bg-blue-500/8 border border-blue-500/20 p-3 text-xs">
                  <p className="text-blue-300 mb-2 font-medium">Sign in to import</p>
                  <p className="text-white/40 mb-3">Search is free. Sign in to save papers to your personal collection.</p>
                  <button onClick={() => signIn('github')}
                    className="w-full text-xs py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                    Sign in with GitHub
                  </button>
                </div>
              )}
            </aside>

            {/* ── Results ── */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              {/* Action bar */}
              {papers.length > 0 && (
                <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
                  <button type="button" onClick={toggleAll}
                    className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
                    {selected.size === papers.length
                      ? <CheckSquare className="h-4 w-4 text-blue-400" />
                      : <Square className="h-4 w-4" />}
                    {selected.size === papers.length ? 'Deselect all' : 'Select all'}
                  </button>

                  <div className="ml-auto flex items-center gap-2">
                    {selected.size >= 2 && (
                      <button
                        onClick={() => togglePanel('gaps')}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          rightPanel === 'gaps'
                            ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                            : 'text-white/50 hover:text-white border-white/10 hover:border-white/20'
                        }`}
                      >
                        <Brain className="h-3.5 w-3.5" />
                        Analyze Gaps ({selected.size})
                      </button>
                    )}
                    {selected.size > 0 && (
                      <span className="text-sm text-white/50">{selected.size} selected</span>
                    )}
                    <Button onClick={openImportModal} disabled={selected.size === 0} size="sm">
                      <Download className="h-3.5 w-3.5" />
                      Import {selected.size > 0 ? `(${selected.size})` : ''}
                    </Button>
                  </div>
                </div>
              )}

              {searchError && (
                <div className="m-6 flex items-start gap-3 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {searchError}
                </div>
              )}

              {!searching && papers.length === 0 && !searchError && (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-8">
                  <Filter className="h-8 w-8 text-white/15 mb-4" />
                  <p className="text-white/30 text-sm mb-1">Configure your research filter</p>
                  <p className="text-white/20 text-xs max-w-xs">
                    Select an AI method, application domain, or research task — or pick a workspace from the Workspaces tab.
                  </p>
                </div>
              )}

              {searching && (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2 animate-pulse">
                      <div className="h-3 bg-white/8 rounded w-3/4" />
                      <div className="h-2.5 bg-white/5 rounded w-1/3" />
                      <div className="h-2.5 bg-white/5 rounded w-full" />
                      <div className="h-2.5 bg-white/5 rounded w-5/6" />
                    </div>
                  ))}
                </div>
              )}

              {papers.length > 0 && !searching && (
                <div className="p-5 space-y-2">
                  {papers.map(paper => (
                    <EnhancedPaperCard
                      key={paper.openReviewId}
                      paper={paper}
                      selected={selected.has(paper.openReviewId)}
                      onToggle={() => toggle(paper.openReviewId)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right panel: gap analysis */}
            {rightPanel === 'gaps' && selectedPapers.length >= 2 && (
              <aside className="w-96 flex-shrink-0 border-l border-white/10 flex flex-col overflow-hidden">
                <GapAnalysisPanel
                  papers={selectedPapers}
                  targetDomain={targetDomain}
                  savedState={gapState}
                  onStateChange={handleGapStateChange}
                  onClose={() => setRightPanel(null)}
                  onQuotaExceeded={() => setShowQuota(true)}
                  usageRemaining={Math.max(0, usageLimit - usageUsed)}
                />
              </aside>
            )}
          </div>
        )}
      </div>

      {/* Import modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-white">Save to My Collection</h2>
              <button onClick={() => setShowImportModal(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5">
                  Collection Name <span className="text-red-400">*</span>
                </label>
                <input type="text" value={collectionName} onChange={e => setCollectionName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmImport()}
                  placeholder="My ICLR 2025 Reading List"
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50"
                  autoFocus />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5">
                  Description <span className="text-white/20 font-normal normal-case">(optional)</span>
                </label>
                <input type="text" value={collectionDesc} onChange={e => setCollectionDesc(e.target.value)}
                  placeholder="Brief description"
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50" />
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/8 px-3 py-2.5 text-xs text-white/50">
                <p><span className="text-white/70">{selected.size}</span> papers · {selectedConferences[0] ?? 'All'} {selectedYears[0] ?? ''}</p>
                {selectedMethods.length > 0 && (
                  <p className="mt-0.5 text-white/30">{selectedMethods.join(', ')}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowImportModal(false)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors">
                Cancel
              </button>
              <Button onClick={confirmImport} disabled={importing || !collectionName.trim()} className="flex-1">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {importing ? 'Importing…' : 'Import Papers'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
