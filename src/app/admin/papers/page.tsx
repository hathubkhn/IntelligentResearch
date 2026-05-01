'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { PaperTable } from '@/components/admin/PaperTable'
import type { Paper } from '@/types/paper'

export default function AdminPapersPage() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchPapers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '50' })
    if (search) params.set('q', search)
    const res = await fetch(`/api/papers?${params}`)
    const data = await res.json()
    setPapers(data.papers)
    setTotal(data.total)
    setLoading(false)
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchPapers, 300)
    return () => clearTimeout(t)
  }, [fetchPapers])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Papers</h1>
          <p className="text-white/40 text-sm mt-1">{total} total</p>
        </div>
        <div className="w-64">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search papers..."
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-white/30 text-sm">Loading...</div>
      ) : (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900 p-5">
          <PaperTable papers={papers} onRefresh={fetchPapers} />
        </div>
      )}
    </div>
  )
}
