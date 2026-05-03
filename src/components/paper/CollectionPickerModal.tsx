'use client'

import { useState, useEffect, useRef } from 'react'
import { Layers, Plus, Check, Loader2, X, FolderPlus } from 'lucide-react'
import { createPortal } from 'react-dom'

export interface UserCollection {
  id:          string
  name:        string
  description: string | null
  paperCount:  number
  hasPaper:    boolean
}

interface Props {
  paperId:   string
  paperTitle?: string
  onClose:   () => void
}

export function CollectionPickerModal({ paperId, paperTitle, onClose }: Props) {
  const [collections, setCollections] = useState<UserCollection[]>([])
  const [loading,     setLoading]     = useState(true)
  const [newName,     setNewName]     = useState('')
  const [creating,    setCreating]    = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [busy,        setBusy]        = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  // Load collections and paper membership
  useEffect(() => {
    setLoading(true)
    fetch(`/api/user/collections?paperId=${encodeURIComponent(paperId)}`)
      .then(r => r.json())
      .then(d => { setCollections(d.collections ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [paperId])

  useEffect(() => {
    if (showNew) setTimeout(() => inputRef.current?.focus(), 50)
  }, [showNew])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const toggle = async (col: UserCollection) => {
    if (busy.has(col.id)) return
    setBusy(s => new Set([...s, col.id]))

    const optimistic = collections.map(c =>
      c.id === col.id ? { ...c, hasPaper: !c.hasPaper, paperCount: c.paperCount + (c.hasPaper ? -1 : 1) } : c
    )
    setCollections(optimistic)

    try {
      if (col.hasPaper) {
        await fetch(`/api/collections/${col.id}/items`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperId }),
        })
      } else {
        await fetch(`/api/collections/${col.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperId }),
        })
      }
    } catch {
      // revert on error
      setCollections(prev => prev.map(c =>
        c.id === col.id ? { ...c, hasPaper: col.hasPaper, paperCount: col.paperCount } : c
      ))
    } finally {
      setBusy(s => { const n = new Set(s); n.delete(col.id); return n })
    }
  }

  const createCollection = async () => {
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      const res  = await fetch('/api/user/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json() as { collection: UserCollection }
      if (data.collection) {
        // Also immediately add the paper to the new collection
        await fetch(`/api/collections/${data.collection.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperId }),
        })
        setCollections(prev => [{ ...data.collection, hasPaper: true, paperCount: 1 }, ...prev])
        setNewName('')
        setShowNew(false)
      }
    } catch { /* ignore */ }
    setCreating(false)
  }

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/12 bg-[#0f1117] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <Layers className="h-4 w-4 text-blue-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Add to collection</p>
              {paperTitle && (
                <p className="text-[11px] text-white/35 truncate max-w-[220px] mt-0.5">{paperTitle}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors ml-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New collection row */}
        <div className="px-4 pt-3 pb-1">
          {showNew ? (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createCollection(); if (e.key === 'Escape') { setShowNew(false); setNewName('') } }}
                placeholder="Collection name…"
                maxLength={80}
                className="flex-1 bg-white/5 border border-white/12 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50"
              />
              <button
                onClick={createCollection}
                disabled={!newName.trim() || creating}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium transition-colors flex items-center gap-1.5 flex-shrink-0">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Create & add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNew(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/15 hover:border-blue-500/40 hover:bg-blue-500/5 text-white/40 hover:text-blue-300 text-sm transition-colors">
              <FolderPlus className="h-4 w-4 flex-shrink-0" />
              New collection
            </button>
          )}
        </div>

        {/* Collection list */}
        <div className="px-2 pb-2 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-white/20 mx-auto" />
            </div>
          ) : collections.length === 0 ? (
            <p className="text-center py-6 text-xs text-white/25">
              No collections yet. Create one above.
            </p>
          ) : (
            <div className="mt-1 divide-y divide-white/5">
              {collections.map(col => (
                <button
                  key={col.id}
                  onClick={() => toggle(col)}
                  disabled={busy.has(col.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left hover:bg-white/[0.04] disabled:opacity-60 ${
                    col.hasPaper ? 'text-white' : 'text-white/60'
                  }`}>
                  {/* Checkbox */}
                  <span className={`flex-shrink-0 w-4.5 h-4.5 rounded border flex items-center justify-center transition-colors ${
                    col.hasPaper
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-white/20 hover:border-white/40'
                  }`}>
                    {busy.has(col.id)
                      ? <Loader2 className="h-2.5 w-2.5 animate-spin text-white" />
                      : col.hasPaper
                        ? <Check className="h-2.5 w-2.5 text-white" />
                        : null}
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{col.name}</span>
                    {col.description && (
                      <span className="block text-[10px] text-white/30 truncate">{col.description}</span>
                    )}
                  </span>

                  <span className={`text-[10px] flex-shrink-0 ${col.hasPaper ? 'text-blue-300' : 'text-white/20'}`}>
                    {col.paperCount} paper{col.paperCount !== 1 ? 's' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-2 border-t border-white/8">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof window === 'undefined') return null
  return createPortal(modal, document.body)
}
