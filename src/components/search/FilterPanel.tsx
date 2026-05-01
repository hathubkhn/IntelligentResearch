'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Clock, XCircle, Layers } from 'lucide-react'

interface FilterPanelProps {
  categories: string[]
  years: number[]
  tags: string[]
  venues?: string[]
  collections?: Array<{ id: string; name: string }>
}

const SUMMARY_OPTIONS = [
  { value: '',        label: 'All',        icon: <Layers className="h-3.5 w-3.5" /> },
  { value: 'DONE',   label: 'Summarized', icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> },
  { value: 'PENDING,PROCESSING', label: 'Pending', icon: <Clock className="h-3.5 w-3.5 text-amber-400" /> },
  { value: 'ERROR',  label: 'Failed',     icon: <XCircle className="h-3.5 w-3.5 text-red-400" /> },
]

export function FilterPanel({ categories, years, tags, venues, collections }: FilterPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`/papers?${params.toString()}`)
  }

  const activeCategory = searchParams.get('category') ?? ''
  const activeYear = searchParams.get('year') ?? ''
  const activeSummary = searchParams.get('summary') ?? ''
  const activeTag = searchParams.get('tag') ?? ''
  const activeCollection = searchParams.get('collection') ?? ''
  const activeVenue = searchParams.get('venue') ?? ''

  return (
    <aside className="space-y-6">
      {/* Summary status */}
      <div>
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Summary</h3>
        <div className="space-y-1">
          {SUMMARY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => update('summary', activeSummary === opt.value ? '' : opt.value)}
              className={`w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${
                activeSummary === opt.value
                  ? 'bg-blue-600/30 text-blue-300'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Collections */}
      {collections && collections.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Collection</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            <FilterItem label="All" active={!activeCollection} onClick={() => update('collection', '')} />
            {collections.map(col => (
              <FilterItem
                key={col.id}
                label={col.name}
                active={activeCollection === col.id}
                onClick={() => update('collection', activeCollection === col.id ? '' : col.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Conference / Venue */}
      {venues && venues.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Conference</h3>
          <div className="space-y-1">
            <FilterItem label="All" active={!activeVenue} onClick={() => update('venue', '')} />
            {venues.map(v => (
              <FilterItem
                key={v}
                label={v}
                active={activeVenue === v}
                onClick={() => update('venue', activeVenue === v ? '' : v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Category */}
      <div>
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Category</h3>
        <div className="space-y-1">
          <FilterItem label="All" active={!activeCategory} onClick={() => update('category', '')} />
          {categories.map(cat => (
            <FilterItem
              key={cat}
              label={cat}
              active={activeCategory === cat}
              onClick={() => update('category', activeCategory === cat ? '' : cat)}
            />
          ))}
        </div>
      </div>

      {/* Year */}
      {years.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Year</h3>
          <div className="space-y-1">
            <FilterItem label="All" active={!activeYear} onClick={() => update('year', '')} />
            {years.map(y => (
              <FilterItem
                key={y}
                label={String(y)}
                active={activeYear === String(y)}
                onClick={() => update('year', activeYear === String(y) ? '' : String(y))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Tags</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
            <FilterItem label="All" active={!activeTag} onClick={() => update('tag', '')} />
            {tags.map(tag => (
              <FilterItem
                key={tag}
                label={tag}
                active={activeTag === tag}
                onClick={() => update('tag', activeTag === tag ? '' : tag)}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

function FilterItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors ${
        active ? 'bg-blue-600/30 text-blue-300' : 'text-white/50 hover:text-white hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  )
}
