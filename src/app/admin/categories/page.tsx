'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Check, X, GripVertical, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Category {
  id: string
  name: string
  description: string | null
  color: string
  order: number
}

const COLOR_OPTIONS = [
  { key: 'blue',   label: 'Blue',   cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { key: 'violet', label: 'Violet', cls: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  { key: 'emerald',label: 'Green',  cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { key: 'amber',  label: 'Amber',  cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { key: 'rose',   label: 'Rose',   cls: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { key: 'cyan',   label: 'Cyan',   cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { key: 'orange', label: 'Orange', cls: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
]

export function colorClass(color: string) {
  return COLOR_OPTIONS.find(c => c.key === color)?.cls ?? COLOR_OPTIONS[0].cls
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', color: 'blue' })
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', description: '', color: 'blue' })
  const [paperCounts, setPaperCounts] = useState<Record<string, number>>({})

  const fetchCategories = async () => {
    const res = await fetch('/api/admin/categories')
    const data = await res.json()
    setCategories(data)
    setLoading(false)
  }

  const fetchCounts = async () => {
    const res = await fetch('/api/papers?limit=1000')
    const data = await res.json()
    const counts: Record<string, number> = {}
    for (const p of data.papers ?? []) {
      if (p.category) counts[p.category] = (counts[p.category] ?? 0) + 1
    }
    setPaperCounts(counts)
  }

  useEffect(() => {
    fetchCategories()
    fetchCounts()
  }, [])

  const startEdit = (cat: Category) => {
    setEditingId(cat.id)
    setEditForm({ name: cat.name, description: cat.description ?? '', color: cat.color })
  }

  const saveEdit = async (id: string) => {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      toast.success('Category updated')
      setEditingId(null)
      fetchCategories()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to update')
    }
  }

  const deleteCategory = async (cat: Category) => {
    const count = paperCounts[cat.name] ?? 0
    const msg = count > 0
      ? `Delete "${cat.name}"? This will remove the category from ${count} paper${count !== 1 ? 's' : ''}.`
      : `Delete "${cat.name}"?`
    if (!confirm(msg)) return

    const res = await fetch(`/api/admin/categories/${cat.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Category deleted')
      fetchCategories()
      fetchCounts()
    } else {
      toast.error('Failed to delete')
    }
  }

  const addCategory = async () => {
    if (!addForm.name.trim()) { toast.error('Name is required'); return }
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    })
    if (res.ok) {
      toast.success('Category added')
      setShowAdd(false)
      setAddForm({ name: '', description: '', color: 'blue' })
      fetchCategories()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to add')
    }
  }

  if (loading) return <div className="p-8 text-white/40 text-sm">Loading...</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Categories</h1>
          <p className="text-white/40 text-sm mt-1">{categories.length} categories · used to classify papers</p>
        </div>
        <Button onClick={() => setShowAdd(true)} disabled={showAdd}>
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-blue-300">New Category</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Name *</label>
              <Input
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Computer Vision"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Color</label>
              <ColorPicker value={addForm.color} onChange={c => setAddForm(f => ({ ...f, color: c }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Description <span className="text-white/30">(optional)</span></label>
            <Input
              value={addForm.description}
              onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Short description of what papers belong here"
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={addCategory}><Check className="h-4 w-4" /> Save</Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)}><X className="h-4 w-4" /> Cancel</Button>
          </div>
        </div>
      )}

      {/* Categories list */}
      <div className="space-y-2">
        {categories.map(cat => (
          <div key={cat.id} className="rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
            {editingId === cat.id ? (
              /* Edit mode */
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">Name</label>
                    <Input
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">Color</label>
                    <ColorPicker value={editForm.color} onChange={c => setEditForm(f => ({ ...f, color: c }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Description</label>
                  <Input
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Short description"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(cat.id)}><Check className="h-3.5 w-3.5" /> Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /> Cancel</Button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="flex items-center gap-4 px-4 py-3">
                <GripVertical className="h-4 w-4 text-white/20 flex-shrink-0" />
                <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium flex-shrink-0 ${colorClass(cat.color)}`}>
                  <Tag className="h-3 w-3" />
                  {cat.name}
                </span>
                <p className="text-sm text-white/40 flex-1 truncate">{cat.description ?? '—'}</p>
                <span className="text-xs text-white/25 flex-shrink-0">
                  {paperCounts[cat.name] ?? 0} paper{(paperCounts[cat.name] ?? 0) !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(cat)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteCategory(cat)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {COLOR_OPTIONS.map(c => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange(c.key)}
          title={c.label}
          className={`h-7 px-2.5 rounded-full text-xs border transition-all font-medium ${c.cls} ${
            value === c.key ? 'ring-2 ring-white/40 scale-105' : 'opacity-50 hover:opacity-80'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}
