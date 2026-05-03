'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useMemo } from 'react'
import { CheckCircle2, Clock, XCircle, Layers, Search, ChevronDown, ChevronUp, X } from 'lucide-react'
import { CATEGORY_TAXONOMY, GROUP_ACCENT } from '@/lib/categories'

interface FilterPanelProps {
  categories: string[]     // from DB (what actually exists)
  years: number[]
  tags: string[]
  venues?: string[]
  collections?: Array<{ id: string; name: string }>
}

const SUMMARY_OPTIONS = [
  { value: '',                    label: 'All',        icon: <Layers       className="h-3.5 w-3.5" /> },
  { value: 'DONE',                label: 'Summarized', icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> },
  { value: 'PENDING,PROCESSING',  label: 'Pending',    icon: <Clock        className="h-3.5 w-3.5 text-amber-400" /> },
  { value: 'ERROR',               label: 'Failed',     icon: <XCircle      className="h-3.5 w-3.5 text-red-400" /> },
]

const PAGE_SIZE = 10  // how many items to reveal per "Show more" click

export function FilterPanel({ categories: dbCategories, years, tags, venues, collections }: FilterPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [catSearch,    setCatSearch]    = useState('')
  const [tagSearch,    setTagSearch]    = useState('')
  const [venueSearch,  setVenueSearch]  = useState('')
  const [catVisible,   setCatVisible]   = useState(PAGE_SIZE)
  const [tagVisible,   setTagVisible]   = useState(PAGE_SIZE)
  const [venueVisible, setVenueVisible] = useState(PAGE_SIZE)

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    value ? params.set(key, value) : params.delete(key)
    params.delete('page')
    router.push(`/papers?${params.toString()}`)
  }

  const activeCategory   = searchParams.get('category')   ?? ''
  const activeYear       = searchParams.get('year')        ?? ''
  const activeSummary    = searchParams.get('summary')     ?? ''
  const activeTag        = searchParams.get('tag')         ?? ''
  const activeCollection = searchParams.get('collection')  ?? ''
  const activeVenue      = searchParams.get('venue')       ?? ''

  // ── Build flat, searchable category list from taxonomy ────────────────────
  // Each item carries its group color for the accent dot
  const allCategoryItems = useMemo(() => {
    return CATEGORY_TAXONOMY.flatMap(group =>
      group.items.map(item => ({ label: item, color: group.color, group: group.label }))
    )
  }, [])

  const filteredCategories = useMemo(() => {
    const q = catSearch.toLowerCase()
    return q
      ? allCategoryItems.filter(c => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q))
      : allCategoryItems
  }, [catSearch, allCategoryItems])

  const filteredTags = useMemo(() => {
    const q = tagSearch.toLowerCase()
    return q ? tags.filter(t => t.toLowerCase().includes(q)) : tags
  }, [tagSearch, tags])

  const filteredVenues = useMemo(() => {
    const q = venueSearch.toLowerCase()
    return q ? (venues ?? []).filter(v => v.toLowerCase().includes(q)) : (venues ?? [])
  }, [venueSearch, venues])

  return (
    <aside className="space-y-5 sticky top-20">

      {/* ── Summary status ── */}
      <Section title="Summary">
        {SUMMARY_OPTIONS.map(opt => (
          <FilterItem
            key={opt.value}
            label={opt.label}
            icon={opt.icon}
            active={activeSummary === opt.value}
            onClick={() => update('summary', activeSummary === opt.value ? '' : opt.value)}
          />
        ))}
      </Section>

      {/* ── Collections ── */}
      {collections && collections.length > 0 && (
        <Section title="Collection">
          <FilterItem label="All" active={!activeCollection} onClick={() => update('collection', '')} />
          {collections.map(col => (
            <FilterItem
              key={col.id}
              label={col.name}
              active={activeCollection === col.id}
              onClick={() => update('collection', activeCollection === col.id ? '' : col.id)}
            />
          ))}
        </Section>
      )}

      {/* ── Conference / Venue ── */}
      {venues && venues.length > 0 && (
        <Section title="Conference">
          <SearchInput
            value={venueSearch}
            onChange={v => { setVenueSearch(v); setVenueVisible(PAGE_SIZE) }}
            placeholder="Search conferences…"
          />
          <FilterItem label="All" active={!activeVenue} onClick={() => update('venue', '')} />
          {filteredVenues.slice(0, venueVisible).map(v => (
            <FilterItem
              key={v}
              label={v}
              active={activeVenue === v}
              onClick={() => update('venue', activeVenue === v ? '' : v)}
            />
          ))}
          <ShowMoreRow
            total={filteredVenues.length}
            visible={venueVisible}
            onMore={() => setVenueVisible(n => n + PAGE_SIZE)}
            onLess={() => setVenueVisible(PAGE_SIZE)}
          />
        </Section>
      )}

      {/* ── Categories (taxonomy-based, searchable) ── */}
      <Section title="Category">
        <SearchInput
          value={catSearch}
          onChange={v => { setCatSearch(v); setCatVisible(PAGE_SIZE) }}
          placeholder="Search categories…"
        />
        <FilterItem label="All" active={!activeCategory} onClick={() => update('category', '')} />

        {catSearch
          // Flat search results
          ? filteredCategories.slice(0, catVisible).map(item => (
              <FilterItem
                key={item.label}
                label={item.label}
                dot={item.color}
                active={activeCategory === item.label}
                onClick={() => update('category', activeCategory === item.label ? '' : item.label)}
              />
            ))
          // Grouped view
          : CATEGORY_TAXONOMY.map(group => (
              <GroupedSection
                key={group.label}
                group={group}
                activeCategory={activeCategory}
                onSelect={cat => update('category', activeCategory === cat ? '' : cat)}
                pageSize={PAGE_SIZE}
              />
            ))
        }

        {catSearch && (
          <ShowMoreRow
            total={filteredCategories.length}
            visible={catVisible}
            onMore={() => setCatVisible(n => n + PAGE_SIZE)}
            onLess={() => setCatVisible(PAGE_SIZE)}
          />
        )}
      </Section>

      {/* ── Year ── */}
      {years.length > 0 && (
        <Section title="Year">
          <FilterItem label="All" active={!activeYear} onClick={() => update('year', '')} />
          {years.map(y => (
            <FilterItem
              key={y}
              label={String(y)}
              active={activeYear === String(y)}
              onClick={() => update('year', activeYear === String(y) ? '' : String(y))}
            />
          ))}
        </Section>
      )}

      {/* ── Tags (searchable + show more) ── */}
      {tags.length > 0 && (
        <Section title="Tags">
          <SearchInput
            value={tagSearch}
            onChange={v => { setTagSearch(v); setTagVisible(PAGE_SIZE) }}
            placeholder="Search tags…"
          />
          <FilterItem label="All" active={!activeTag} onClick={() => update('tag', '')} />
          {filteredTags.slice(0, tagVisible).map(tag => (
            <FilterItem
              key={tag}
              label={tag}
              active={activeTag === tag}
              onClick={() => update('tag', activeTag === tag ? '' : tag)}
            />
          ))}
          <ShowMoreRow
            total={filteredTags.length}
            visible={tagVisible}
            onMore={() => setTagVisible(n => n + PAGE_SIZE)}
            onLess={() => setTagVisible(PAGE_SIZE)}
          />
        </Section>
      )}
    </aside>
  )
}

// ── Grouped category section (collapsible) ────────────────────────────────────
function GroupedSection({
  group, activeCategory, onSelect, pageSize,
}: {
  group: (typeof CATEGORY_TAXONOMY)[number]
  activeCategory: string
  onSelect: (cat: string) => void
  pageSize: number
}) {
  const [open, setOpen]     = useState(() => group.items.includes(activeCategory))
  const [visible, setVisible] = useState(pageSize)

  const accent = GROUP_ACCENT[group.color] ?? GROUP_ACCENT['blue']
  const hasActive = group.items.includes(activeCategory)

  return (
    <div className="mb-0.5">
      {/* Group header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between py-1.5 px-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors ${
          hasActive
            ? `${accent} border`
            : 'text-white/30 hover:text-white/50 hover:bg-white/[0.03]'
        }`}
      >
        <span className="truncate">{group.label}</span>
        {open ? <ChevronUp className="h-3 w-3 flex-shrink-0" /> : <ChevronDown className="h-3 w-3 flex-shrink-0" />}
      </button>

      {open && (
        <div className="ml-2 mt-0.5 border-l border-white/8 pl-2 space-y-0.5">
          {group.items.slice(0, visible).map(item => (
            <FilterItem
              key={item}
              label={item}
              small
              active={activeCategory === item}
              onClick={() => onSelect(item)}
            />
          ))}
          <ShowMoreRow
            total={group.items.length}
            visible={visible}
            onMore={() => setVisible(n => n + pageSize)}
            onLess={() => setVisible(pageSize)}
            small
          />
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">{title}</h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function FilterItem({
  label, active, onClick, icon, dot, small = false,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  dot?: string
  small?: boolean
}) {
  const dotColor: Record<string, string> = {
    blue: 'bg-blue-400', violet: 'bg-violet-400', cyan: 'bg-cyan-400',
    pink: 'bg-pink-400', slate: 'bg-slate-400', amber: 'bg-amber-400',
    emerald: 'bg-emerald-400', orange: 'bg-orange-400', rose: 'bg-rose-400',
  }
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1 rounded-md transition-colors flex items-center gap-2 ${
        small ? 'text-[11px]' : 'text-xs'
      } ${
        active ? 'bg-blue-600/25 text-blue-300' : 'text-white/45 hover:text-white hover:bg-white/[0.05]'
      }`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {dot && <span className={`flex-shrink-0 h-1.5 w-1.5 rounded-full ${dotColor[dot] ?? 'bg-white/30'}`} />}
      <span className="truncate">{label}</span>
    </button>
  )
}

function SearchInput({
  value, onChange, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="relative mb-2">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20 pointer-events-none" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/10 rounded-md pl-7 pr-7 py-1.5 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/40"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function ShowMoreRow({
  total, visible, onMore, onLess, small = false,
}: {
  total: number
  visible: number
  onMore: () => void
  onLess: () => void
  small?: boolean
}) {
  if (total <= visible && visible <= PAGE_SIZE) return null
  return (
    <div className={`flex gap-2 mt-0.5 ${small ? 'pl-0' : ''}`}>
      {visible < total && (
        <button
          onClick={onMore}
          className={`flex items-center gap-1 text-white/30 hover:text-white/60 transition-colors ${small ? 'text-[10px]' : 'text-[11px]'}`}
        >
          <ChevronDown className="h-3 w-3" />
          {Math.min(PAGE_SIZE, total - visible)} more
        </button>
      )}
      {visible > PAGE_SIZE && (
        <button
          onClick={onLess}
          className={`flex items-center gap-1 text-white/20 hover:text-white/50 transition-colors ${small ? 'text-[10px]' : 'text-[11px]'}`}
        >
          <ChevronUp className="h-3 w-3" />
          Show less
        </button>
      )}
    </div>
  )
}
