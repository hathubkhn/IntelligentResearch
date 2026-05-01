'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { Bookmark, Download, Trash2, GitFork } from 'lucide-react'
import { PaperCard } from '@/components/paper/PaperCard'
import { getLocalSaved } from '@/components/paper/SaveButton'
import type { Paper } from '@/types/paper'

export default function SavedPage() {
  const { data: session, status } = useSession()
  const isUser = status === 'authenticated' && (session?.user as { role?: string })?.role === 'user'
  const isGuest = status === 'unauthenticated' || (status === 'authenticated' && (session?.user as { role?: string })?.role !== 'user')

  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    let ids: string[] = []

    if (isUser) {
      const res = await fetch('/api/user/saved')
      const data = await res.json()
      ids = data.ids ?? []
    } else {
      ids = getLocalSaved()
    }

    if (ids.length === 0) { setPapers([]); setLoading(false); return }

    const results = await Promise.all(
      ids.map(id => fetch(`/api/papers/${id}`).then(r => r.ok ? r.json() : null))
    )
    setPapers(results.filter(Boolean))
    setLoading(false)
  }

  useEffect(() => {
    if (status === 'loading') return
    load()
    const handler = () => load()
    window.addEventListener('saved-papers-change', handler)
    return () => window.removeEventListener('saved-papers-change', handler)
  }, [status, isUser])

  const exportBibtex = () => {
    const bib = papers.map(p => {
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
    if (isUser) {
      await Promise.all(papers.map(p => fetch(`/api/user/saved/${p.id}`, { method: 'DELETE' })))
    } else {
      localStorage.removeItem('saved_papers')
      window.dispatchEvent(new CustomEvent('saved-papers-change'))
    }
    setPapers([])
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-blue-400" />
            Reading List
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {loading
              ? 'Loading…'
              : papers.length > 0
                ? `${papers.length} saved paper${papers.length !== 1 ? 's' : ''}`
                : 'No saved papers yet'}
          </p>
          {/* Guest nudge */}
          {isGuest && papers.length > 0 && (
            <p className="text-amber-400/70 text-xs mt-2">
              Sign in with GitHub to sync your list across devices.{' '}
              <button onClick={() => signIn('github')} className="underline hover:text-amber-300">
                Sign in
              </button>
            </p>
          )}
        </div>

        {papers.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={exportBibtex}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-colors"
            >
              <Download className="h-4 w-4" /> Export BibTeX
            </button>
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:border-red-500/30 bg-transparent hover:bg-red-500/5 text-white/30 hover:text-red-400 text-sm transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-white/30 text-sm">Loading…</div>
      ) : papers.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Bookmark className="h-12 w-12 text-white/10 mx-auto" />
          <p className="text-white/30 text-sm">
            Save papers by clicking the bookmark icon on any paper card or detail page.
          </p>
          {isGuest && (
            <button
              onClick={() => signIn('github')}
              className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white text-sm transition-colors"
            >
              <GitFork className="h-4 w-4" /> Sign in to sync across devices
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {papers.map(paper => (
            <PaperCard key={paper.id} paper={paper} />
          ))}
        </div>
      )}
    </div>
  )
}
