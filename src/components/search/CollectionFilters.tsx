'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

interface CollectionFiltersProps {
  collectionId: string
  years: number[]
  venues: string[]
  totalCount: number
  filteredCount: number
}

export function CollectionFilters({ collectionId, years, venues, totalCount, filteredCount }: CollectionFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const q = searchParams.get('q') ?? ''
  const activeYear = searchParams.get('year') ?? ''
  const activeVenue = searchParams.get('venue') ?? ''

  const [searchValue, setSearchValue] = useState(q)

  const update = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, val] of Object.entries(updates)) {
        if (val) {
          params.set(key, val)
        } else {
          params.delete(key)
        }
      }
      startTransition(() => {
        router.push(`/collections/${collectionId}?${params.toString()}`)
      })
    },
    [router, searchParams, collectionId]
  )

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchValue(e.target.value)
      update({ q: e.target.value })
    },
    [update]
  )

  const clearAll = () => {
    setSearchValue('')
    router.push(`/collections/${collectionId}`)
  }

  const hasFilters = !!(q || activeYear || activeVenue)

  return (
    <div className="space-y-4 mb-8">
      {/* Search row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          <input
            value={searchValue}
            onChange={handleSearch}
            placeholder="Search papers, authors…"
            className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
          />
          {searchValue && (
            <button
              onClick={() => { setSearchValue(''); update({ q: '' }) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <span className="text-sm text-slate-500 shrink-0">
          {hasFilters ? `${filteredCount} of ${totalCount}` : `${totalCount}`} papers
        </span>

        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Year + Venue pills */}
      {(years.length > 0 || venues.length > 0) && (
        <div className="flex flex-wrap gap-4">
          {/* Year pills */}
          {years.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-600 uppercase tracking-wider font-medium">Year</span>
              <div className="flex flex-wrap gap-1.5">
                {years.map(y => (
                  <button
                    key={y}
                    onClick={() => update({ year: activeYear === String(y) ? '' : String(y) })}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      activeYear === String(y)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Venue pills */}
          {venues.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-600 uppercase tracking-wider font-medium">Conference</span>
              <div className="flex flex-wrap gap-1.5">
                {venues.map(v => (
                  <button
                    key={v}
                    onClick={() => update({ venue: activeVenue === v ? '' : v })}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      activeVenue === v
                        ? 'bg-cyan-600/80 text-white border border-cyan-500/40'
                        : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
