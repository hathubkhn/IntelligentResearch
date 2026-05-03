'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession, signIn } from 'next-auth/react'
import {
  Bookmark, Download, Trash2, GitFork, Search, SlidersHorizontal,
  X, Sparkles, Loader2, ChevronDown, ChevronUp, Filter,
} from 'lucide-react'
import { PaperCard } from '@/components/paper/PaperCard'
import { getLocalSaved } from '@/components/paper/SaveButton'
import type { Paper } from '@/types/paper'
import type { Facets, SavedSearchResult } from '@/app/api/user/saved/search/route'

// ── Helpers ────────────────────────────────────────────────────────────────────
function toLocalYear(paper: Paper): number | null { return paper.year }
function toLocalVenue(paper: Paper): string | null {
  if (!paper.venue) return null
  const m = paper.venue.match(/^([A-Z][A-Za-z0-9]+)/)
  return m ? m[1] : paper.venue.split(/[\s/]/)[0]
}
function buildLocalFacets(papers: Paper[]): Facets {
  return {
    venues:     [...new Set(papers.map(toLocalVenue).filter(Boolean) as string[])].sort(),
    years:      [...new Set(papers.map(p => p.year).filter((y): y is number => y != null))].sort((a, b) => b - a),
    categories: [...new Set(papers.map(p => p.category).filter(Boolean) as string[])].sort(),
  }
}
function paperMatchesFilters(p: Paper, venue: string, year: string, category: string): boolean {
  if (venue    && !(p.venue    ?? '').toLowerCase().includes(venue.toLowerCase()))    return false
  if (year     && String(p.year) !== year)                                            return false
  if (category && p.category !== category)                                            return false
  return true
}
function localKeywordSearch(papers: Paper[], q: string): Paper[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  return papers.filter(p => {
    const text = `${p.title} ${p.tldr ?? ''} ${p.problem ?? ''} ${p.keyIdea ?? ''} ${(p.tags ?? []).join(' ')}`.toLowerCase()
    return terms.every(t => text.includes(t))
  })
}

// ── Filter sidebar section ─────────────────────────────────────────────────────
function FilterSection({
  title, options, selected, onToggle, showCount = 8,
}: {
  title: string
  options: (string | number)[]
  selected: string
  onToggle: (v: string) => void
  showCount?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? options : options.slice(0, showCount)
  return (
    <div className="border-b border-white/8 py-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-2">{title}</p>
      <div className="space-y-1">
        <button
          onClick={() => onToggle('')}
          className={`w-full text-left text-xs px-2 py-1 rounded transition-colors ${!selected ? 'bg-blue-600/25 text-blue-300' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}>
          All
        </button>
        {visible.map(opt => (
          <button
            key={opt}
            onClick={() => onToggle(String(opt))}
            className={`w-full text-left text-xs px-2 py-1 rounded transition-colors truncate ${selected === String(opt) ? 'bg-blue-600/25 text-blue-300' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}>
            {opt}
          </button>
        ))}
        {options.length > showCount && (
          <button onClick={() => setExpanded(e => !e)}
            className="w-full text-left text-[10px] text-white/25 hover:text-white/50 px-2 py-0.5 flex items-center gap-1">
            {expanded ? <><ChevronUp className="h-3 w-3" />Less</> : <><ChevronDown className="h-3 w-3" />{options.length - showCount} more</>}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SavedPage() {
  const { data: session, status } = useSession()
  const isUser  = status === 'authenticated' && (session?.user as { role?: string })?.role === 'user'
  const isGuest = status !== 'authenticated' || (session?.user as { role?: string })?.role !== 'user'

  // All papers loaded from DB / localStorage
  const [allPapers,  setAllPapers]  = useState<Paper[]>([])
  const [facets,     setFacets]     = useState<Facets>({ venues: [], years: [], categories: [] })
  const [loading,    setLoading]    = useState(true)

  // Search / filter state
  const [query,        setQuery]        = useState('')
  const [venueFilter,  setVenueFilter]  = useState('')
  const [yearFilter,   setYearFilter]   = useState('')
  const [catFilter,    setCatFilter]    = useState('')
  const [searching,    setSearching]    = useState(false)
  const [results,      setResults]      = useState<Paper[]>([])
  const [isSemanticOn, setIsSemanticOn] = useState(false)
  const [sidebarOpen,  setSidebarOpen]  = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Initial load ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    if (isUser) {
      const res  = await fetch('/api/user/saved/search')
      const data = await res.json() as { papers: Paper[]; facets: Facets }
      setAllPapers(data.papers ?? [])
      setFacets(data.facets ?? { venues: [], years: [], categories: [] })
      setResults(data.papers ?? [])
    } else {
      const ids = getLocalSaved()
      if (ids.length === 0) { setAllPapers([]); setResults([]); setLoading(false); return }
      const fetched = await Promise.all(ids.map(id => fetch(`/api/papers/${id}`).then(r => r.ok ? r.json() : null)))
      const papers = fetched.filter(Boolean) as Paper[]
      setAllPapers(papers)
      setFacets(buildLocalFacets(papers))
      setResults(papers)
    }
    setLoading(false)
  }, [isUser])

  useEffect(() => {
    if (status === 'loading') return
    load()
    const handler = () => load()
    window.addEventListener('saved-papers-change', handler)
    return () => window.removeEventListener('saved-papers-change', handler)
  }, [status, load])

  // ── Search / filter logic ─────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string, venue: string, year: string, cat: string) => {
    if (!isUser) {
      // Guest: pure client-side keyword filter
      let filtered = allPapers.filter(p => paperMatchesFilters(p, venue, year, cat))
      if (q.trim()) filtered = localKeywordSearch(filtered, q)
      setResults(filtered)
      setIsSemanticOn(false)
      return
    }

    if (!q.trim() && !venue && !year && !cat) {
      setResults(allPapers)
      setIsSemanticOn(false)
      return
    }

    setSearching(true)
    setIsSemanticOn(!!q.trim())
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (venue)    params.set('venue', venue)
      if (year)     params.set('year', year)
      if (cat)      params.set('category', cat)

      const res  = await fetch(`/api/user/saved/search?${params}`)
      const data = await res.json() as { papers: Paper[] }
      setResults(data.papers ?? [])
    } catch {
      // fallback to client-side
      setResults(allPapers.filter(p => paperMatchesFilters(p, venue, year, cat)))
    } finally {
      setSearching(false)
    }
  }, [isUser, allPapers])

  // Debounce query; filters apply immediately
  useEffect(() => {
    if (status === 'loading') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const delay = query.trim() && isUser ? 600 : 0
    debounceRef.current = setTimeout(() => {
      doSearch(query, venueFilter, yearFilter, catFilter)
    }, delay)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, venueFilter, yearFilter, catFilter, doSearch, isUser, status])

  // ── Actions ───────────────────────────────────────────────────────────────────
  const exportBibtex = () => {
    const bib = allPapers.map(p => {
      const key = `${p.title.split(' ')[0]?.toLowerCase() ?? 'paper'}${p.year ?? ''}`
      return `@article{${key},\n  title     = {${p.title}},\n  author    = {${p.authors.join(' and ')}},\n  year      = {${p.year ?? ''}},${p.venue ? `\n  booktitle = {${p.venue}},` : ''}${p.arxivId ? `\n  eprint    = {${p.arxivId}},` : ''}\n}`
    }).join('\n\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([bib], { type: 'text/plain' })),
      download: 'reading-list.bib',
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const clearAll = async () => {
    if (!window.confirm(`Remove all ${allPapers.length} papers from your reading list?`)) return
    if (isUser) {
      await Promise.all(allPapers.map(p => fetch(`/api/user/saved/${p.id}`, { method: 'DELETE' })))
    } else {
      localStorage.removeItem('saved_papers')
      window.dispatchEvent(new CustomEvent('saved-papers-change'))
    }
    setAllPapers([]); setResults([])
  }

  const clearFilters = () => { setQuery(''); setVenueFilter(''); setYearFilter(''); setCatFilter('') }
  const hasFilters = query || venueFilter || yearFilter || catFilter

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-8xl px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-blue-400" />
            Reading List
            {!loading && (
              <span className="text-xs font-normal text-white/30 ml-1">
                {allPapers.length} paper{allPapers.length !== 1 ? 's' : ''}
              </span>
            )}
          </h1>
          {isGuest && allPapers.length > 0 && (
            <p className="text-amber-400/70 text-xs mt-1">
              Sign in to sync across devices and enable semantic search.{' '}
              <button onClick={() => signIn('github')} className="underline hover:text-amber-300">Sign in</button>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSidebarOpen(o => !o)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/8 text-white/40 hover:text-white/70 text-xs transition-colors">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </button>
          {allPapers.length > 0 && (
            <>
              <button onClick={exportBibtex}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/8 text-white/40 hover:text-white/70 text-xs transition-colors">
                <Download className="h-3.5 w-3.5" /> BibTeX
              </button>
              <button onClick={clearAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/8 hover:border-red-500/30 bg-transparent hover:bg-red-500/5 text-white/25 hover:text-red-400 text-xs transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Main layout: sidebar + content ── */}
      <div className="flex gap-5">

        {/* ── Left sidebar ── */}
        {sidebarOpen && (
          <aside className="w-48 flex-shrink-0 space-y-1">
            <div className="sticky top-20">
              {hasFilters && (
                <button onClick={clearFilters}
                  className="w-full mb-2 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-600/15 border border-blue-500/25 text-blue-300 text-xs hover:bg-blue-600/25 transition-colors">
                  <X className="h-3 w-3" /> Clear filters
                </button>
              )}
              {loading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />)}
                </div>
              ) : (
                <>
                  <FilterSection
                    title="Conference"
                    options={facets.venues}
                    selected={venueFilter}
                    onToggle={setVenueFilter}
                  />
                  <FilterSection
                    title="Year"
                    options={facets.years}
                    selected={yearFilter}
                    onToggle={setYearFilter}
                  />
                  {facets.categories.length > 0 && (
                    <FilterSection
                      title="Category"
                      options={facets.categories}
                      selected={catFilter}
                      onToggle={setCatFilter}
                    />
                  )}
                </>
              )}
            </div>
          </aside>
        )}

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">

          {/* ── Search bar ── */}
          <div className="relative mb-5">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searching
                ? <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                : isSemanticOn
                  ? <Sparkles className="h-4 w-4 text-purple-400" />
                  : <Search className="h-4 w-4 text-white/25" />}
            </div>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={isUser
                ? 'Semantic search — e.g. "find papers about RAG in time series"'
                : 'Search by keywords — e.g. "diffusion model image generation"'}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-colors"
            />
            {query && (
              <button onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
            {isUser && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/25 text-purple-300 font-medium">
                  AI
                </span>
              </div>
            )}
          </div>

          {/* ── Active filter pills ── */}
          {(venueFilter || yearFilter || catFilter) && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <span className="text-[10px] text-white/25 flex items-center gap-1"><Filter className="h-3 w-3" />Filters:</span>
              {venueFilter && (
                <button onClick={() => setVenueFilter('')}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-300 hover:bg-blue-500/25">
                  {venueFilter} <X className="h-2.5 w-2.5" />
                </button>
              )}
              {yearFilter && (
                <button onClick={() => setYearFilter('')}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-300 hover:bg-blue-500/25">
                  {yearFilter} <X className="h-2.5 w-2.5" />
                </button>
              )}
              {catFilter && (
                <button onClick={() => setCatFilter('')}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-300 hover:bg-blue-500/25">
                  {catFilter} <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          )}

          {/* ── Results ── */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-52 rounded-2xl bg-white/[0.04] border border-white/8 animate-pulse" />
              ))}
            </div>
          ) : allPapers.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <Bookmark className="h-12 w-12 text-white/10 mx-auto" />
              <p className="text-white/30 text-sm">Save papers by clicking the bookmark icon on any paper card.</p>
              {isGuest && (
                <button onClick={() => signIn('github')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white text-sm transition-colors">
                  <GitFork className="h-4 w-4" /> Sign in to sync across devices
                </button>
              )}
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16">
              <Search className="h-8 w-8 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">No matching papers found.</p>
              <button onClick={clearFilters} className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline">
                Clear filters
              </button>
            </div>
          ) : (
            <>
              {/* Result count + search label */}
              <div className="flex items-center gap-2 mb-4">
                <p className="text-xs text-white/30">
                  {results.length} paper{results.length !== 1 ? 's' : ''}
                  {hasFilters ? ` matching your ${isSemanticOn ? 'query' : 'filters'}` : ''}
                </p>
                {isSemanticOn && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/20 text-purple-300 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" /> semantic
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {results.map(paper => (
                  <PaperCard key={paper.id} paper={paper as Paper} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
