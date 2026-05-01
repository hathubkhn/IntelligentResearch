'use client'

import { useState, useEffect } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useSession } from 'next-auth/react'

// ── localStorage helpers (guest fallback) ────────────────────────────────────
const LS_KEY = 'saved_papers'

export function getLocalSaved(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') } catch { return [] }
}

function setLocalSaved(ids: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(ids))
  window.dispatchEvent(new CustomEvent('saved-papers-change'))
}

// kept for the /saved page migration helper
export function getSavedPapers() { return getLocalSaved() }
export function toggleSavedPaper(id: string): boolean {
  const ids = getLocalSaved()
  const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
  setLocalSaved(next)
  return next.includes(id)
}

// ── component ─────────────────────────────────────────────────────────────────
interface SaveButtonProps {
  paperId: string
  className?: string
}

export function SaveButton({ paperId, className = '' }: SaveButtonProps) {
  const { data: session, status } = useSession()
  const isUser = status === 'authenticated' && (session?.user as { role?: string })?.role === 'user'

  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // Load initial state
  useEffect(() => {
    if (isUser) {
      fetch('/api/user/saved')
        .then(r => r.json())
        .then(d => setSaved((d.ids as string[]).includes(paperId)))
        .catch(() => {})
    } else {
      setSaved(getLocalSaved().includes(paperId))
      const handler = () => setSaved(getLocalSaved().includes(paperId))
      window.addEventListener('saved-papers-change', handler)
      return () => window.removeEventListener('saved-papers-change', handler)
    }
  }, [paperId, isUser])

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return

    if (!isUser) {
      // Guest: localStorage
      setSaved(toggleSavedPaper(paperId))
      return
    }

    setBusy(true)
    try {
      if (saved) {
        await fetch(`/api/user/saved/${paperId}`, { method: 'DELETE' })
        setSaved(false)
      } else {
        await fetch('/api/user/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperId }),
        })
        setSaved(true)
      }
    } catch {
      // optimistic revert
      setSaved(s => !s)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={saved ? 'Remove from reading list' : 'Save to reading list'}
      className={`transition-colors disabled:opacity-50 ${
        saved ? 'text-blue-400 hover:text-blue-300' : 'text-white/30 hover:text-white/70'
      } ${className}`}
    >
      {saved
        ? <BookmarkCheck className="h-4 w-4" />
        : <Bookmark className="h-4 w-4" />
      }
    </button>
  )
}
