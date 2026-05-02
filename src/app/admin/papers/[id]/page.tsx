'use client'

import { useState, useEffect, use, useRef } from 'react'
import { ArrowLeft, Save, RefreshCw, Loader2, Upload, X, ImageIcon, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SummaryStatusIndicator } from '@/components/admin/SummaryStatusIndicator'
import type { Paper } from '@/types/paper'

interface Category { id: string; name: string; color: string }

const COLOR_CLS: Record<string, string> = {
  blue:    'bg-blue-500/20 text-blue-300 border-blue-500/30',
  violet:  'bg-violet-500/20 text-violet-300 border-violet-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  amber:   'bg-amber-500/20 text-amber-300 border-amber-500/30',
  rose:    'bg-rose-500/20 text-rose-300 border-rose-500/30',
  cyan:    'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  orange:  'bg-orange-500/20 text-orange-300 border-orange-500/30',
}

interface Props {
  params: Promise<{ id: string }>
}

export default function EditPaperPage({ params }: Props) {
  const { id } = use(params)
  const [paper, setPaper] = useState<Paper | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/papers/${id}`).then(r => r.json()).then(setPaper)
    fetch('/api/admin/categories').then(r => r.json()).then(setCategories)
  }, [id])

  const save = async () => {
    if (!paper) return
    setSaving(true)
    try {
      const res = await fetch(`/api/papers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: paper.title,
          authors: paper.authors,
          venue: paper.venue,
          year: paper.year,
          category: paper.category,
          paperUrl: paper.paperUrl,
          codeUrl: paper.codeUrl,
          openReviewUrl: paper.openReviewUrl,
          arxivId: paper.arxivId,
          methodDiagram: paper.methodDiagram,
          methodDescription: paper.methodDescription,
          tldr: paper.tldr,
          problem: paper.problem,
          keyIdea: paper.keyIdea,
          results: paper.results,
          contributions: paper.contributions,
          tags: paper.tags,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Saved!')
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const summarize = async (force = false) => {
    setSummarizing(true)
    try {
      const url = `/api/summarize/${id}${force ? '?force=true' : ''}`
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')

      if (res.status === 202) {
        // Async job queued — poll until status leaves PROCESSING
        toast.info('Summarization queued, processing in background…')
        const poll = setInterval(async () => {
          const r = await fetch(`/api/papers/${id}`)
          const updated = await r.json()
          if (updated.status !== 'PROCESSING') {
            clearInterval(poll)
            setPaper(updated)
            setSummarizing(false)
            if (updated.status === 'DONE') toast.success('Summarized!')
            else toast.error(updated.errorMessage ?? 'Summarization failed')
          }
        }, 3000)
      } else {
        setPaper(data)
        toast.success('Summarized!')
        setSummarizing(false)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Summarization failed')
      setSummarizing(false)
    }
  }

  const uploadImage = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/image', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setPaper(p => p ? { ...p, methodDiagram: data.url } : p)
      toast.success('Image uploaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (!paper) {
    return <div className="p-8 text-white/40 text-sm">Loading...</div>
  }

  const diagramIsLocal = paper.methodDiagram?.startsWith('/')
  const diagramPreviewSrc = paper.methodDiagram
    ? (diagramIsLocal ? paper.methodDiagram : paper.methodDiagram)
    : null

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/papers" className="text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold text-white flex-1 line-clamp-1">{paper.title}</h1>
        <SummaryStatusIndicator status={paper.status} />
      </div>

      <div className="space-y-4 mb-8">

        {/* ── Metadata ── */}
        <SectionHeading>Metadata</SectionHeading>

        <Field label="Title">
          <Input value={paper.title} onChange={e => setPaper({ ...paper, title: e.target.value })} />
        </Field>
        <Field label="Authors (comma-separated)">
          <Input
            value={paper.authors.join(', ')}
            onChange={e => setPaper({ ...paper, authors: e.target.value.split(',').map(a => a.trim()).filter(Boolean) })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Venue">
            <Input value={paper.venue ?? ''} onChange={e => setPaper({ ...paper, venue: e.target.value })} />
          </Field>
          <Field label="Year">
            <Input
              type="number"
              value={paper.year ?? ''}
              onChange={e => setPaper({ ...paper, year: e.target.value ? parseInt(e.target.value) : null })}
            />
          </Field>
        </div>
        <Field label="Category">
          <CategorySelect
            value={paper.category ?? ''}
            categories={categories}
            onChange={v => setPaper({ ...paper, category: v || null })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Paper URL">
            <Input value={paper.paperUrl ?? ''} onChange={e => setPaper({ ...paper, paperUrl: e.target.value })} />
          </Field>
          <Field label="Code URL">
            <Input value={paper.codeUrl ?? ''} onChange={e => setPaper({ ...paper, codeUrl: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="OpenReview URL">
            <Input value={paper.openReviewUrl ?? ''} onChange={e => setPaper({ ...paper, openReviewUrl: e.target.value })} />
          </Field>
          <Field label="arXiv ID">
            <Input value={paper.arxivId ?? ''} onChange={e => setPaper({ ...paper, arxivId: e.target.value })} />
          </Field>
        </div>

        {/* ── Method Diagram ── */}
        <SectionHeading>Method Diagram</SectionHeading>

        <Field label="Image URL (or upload below)">
          <Input
            value={paper.methodDiagram ?? ''}
            placeholder="https://... or /uploads/..."
            onChange={e => setPaper({ ...paper, methodDiagram: e.target.value || null })}
          />
        </Field>

        {/* Upload area */}
        <div
          className="relative border-2 border-dashed border-white/15 rounded-xl p-5 text-center hover:border-white/30 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) uploadImage(file)
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) uploadImage(file)
              e.target.value = ''
            }}
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Uploading…</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-white/40">
              <Upload className="h-4 w-4" />
              <span className="text-sm">Click or drag an image to upload</span>
            </div>
          )}
        </div>

        {/* Image preview */}
        {diagramPreviewSrc && (
          <div className="relative rounded-xl border border-white/10 overflow-hidden bg-white/5">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div className="flex items-center gap-1.5 text-white/40 text-xs">
                <ImageIcon className="h-3.5 w-3.5" />
                Preview
              </div>
              <button
                onClick={() => setPaper({ ...paper, methodDiagram: null })}
                className="text-white/30 hover:text-red-400 transition-colors"
                title="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={diagramPreviewSrc}
              alt="Method diagram preview"
              className="w-full object-contain max-h-72 p-3"
            />
          </div>
        )}

        <Field label="Method Description (shown on detail page alongside the diagram)">
          <textarea
            value={paper.methodDescription ?? ''}
            onChange={e => setPaper({ ...paper, methodDescription: e.target.value || null })}
            rows={4}
            placeholder="Describe the method, architecture, or key design choices in 3-5 sentences…"
            className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </Field>

        {/* ── AI Summary ── */}
        <SectionHeading>Summary</SectionHeading>

        <Field label="TL;DR">
          <textarea
            value={paper.tldr ?? ''}
            onChange={e => setPaper({ ...paper, tldr: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </Field>
        <Field label="Problem">
          <textarea
            value={paper.problem ?? ''}
            onChange={e => setPaper({ ...paper, problem: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </Field>
        <Field label="Key Idea / Method">
          <textarea
            value={paper.keyIdea ?? ''}
            onChange={e => setPaper({ ...paper, keyIdea: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </Field>
        <Field label="Results">
          <textarea
            value={paper.results ?? ''}
            onChange={e => setPaper({ ...paper, results: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </Field>
        <Field label="Contributions (one per line)">
          <textarea
            value={paper.contributions.join('\n')}
            onChange={e => setPaper({ ...paper, contributions: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
            rows={4}
            placeholder="Each line becomes a numbered contribution"
            className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
          />
        </Field>
        <Field label="Tags (comma-separated)">
          <Input
            value={paper.tags.join(', ')}
            onChange={e => setPaper({ ...paper, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
            placeholder="e.g. vision, transformer, self-supervised"
          />
        </Field>

        {/* Error message if summarization failed */}
        {paper.status === 'ERROR' && paper.errorMessage && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            Last error: {paper.errorMessage}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
        <Button variant="outline" onClick={() => summarize(paper.status === 'DONE')} disabled={summarizing}>
          {summarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {paper.status === 'DONE' ? 'Re-summarize' : 'Summarize'}
        </Button>
        <Button variant="ghost" asChild>
          <Link href={`/papers/${id}`} target="_blank">View public page</Link>
        </Button>
      </div>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-2 pb-1 border-b border-white/10">
      <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest">{children}</h2>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-white/60 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function CategorySelect({ value, categories, onChange }: {
  value: string
  categories: Category[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = categories.find(c => c.name === value)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        {selected ? (
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${COLOR_CLS[selected.color] ?? COLOR_CLS.blue}`}>
            {selected.name}
          </span>
        ) : (
          <span className="text-white/30">No category</span>
        )}
        <ChevronDown className="h-4 w-4 text-white/40 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-white/15 bg-slate-900 shadow-2xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {/* None option */}
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="w-full text-left px-3 py-2.5 text-sm text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors"
            >
              — No category
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => { onChange(cat.name); setOpen(false) }}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-white/5 transition-colors ${
                  cat.name === value ? 'bg-white/5' : ''
                }`}
              >
                <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${COLOR_CLS[cat.color] ?? COLOR_CLS.blue}`}>
                  {cat.name}
                </span>
                {cat.name === value && <span className="ml-auto text-blue-400 text-xs">✓</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-white/10 px-3 py-2">
            <Link
              href="/admin/categories"
              target="_blank"
              className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors"
            >
              + Manage categories →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
