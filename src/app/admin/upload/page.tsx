'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UploadDropzone } from '@/components/admin/UploadDropzone'

interface PaperProgress {
  id: string
  title: string
  status: 'processing' | 'done' | 'error'
  message?: string
}

export default function UploadPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'markdown' | 'json'>('markdown')
  const [collectionName, setCollectionName] = useState('')
  const [collectionUrl, setCollectionUrl] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [preview, setPreview] = useState<Array<{ title: string; venue: string | null; category: string }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [collectionId, setCollectionId] = useState<string | null>(null)
  const [progress, setProgress] = useState<PaperProgress[]>([])
  const [summarizing, setSummarizing] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const handlePreview = async () => {
    if (!markdown.trim() || !collectionName.trim()) {
      toast.error('Collection name and markdown are required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/upload/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown, collectionName, preview: true }),
      })
      const data = await res.json()
      setPreview(data.papers)
    } catch {
      toast.error('Failed to parse markdown')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!markdown.trim() || !collectionName.trim()) return
    setImporting(true)
    try {
      const res = await fetch('/api/upload/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown, collectionName, collectionUrl }),
      })
      const data = await res.json()
      setCollectionId(data.collectionId)
      toast.success(`Imported ${data.paperCount} papers`)
      setPreview(null)
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleSummarizeBatch = async () => {
    setSummarizing(true)
    setProgress([])

    const es = new EventSource('/api/summarize/batch', { withCredentials: false })
    eventSourceRef.current = es

    // Use POST instead via fetch with ReadableStream
    es.close()

    try {
      const res = await fetch('/api/summarize/batch', { method: 'POST' })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) return

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          const data = JSON.parse(line.slice(6))

          if (data.type === 'processing') {
            setProgress(p => [...p.filter(x => x.id !== data.id), { id: data.id, title: data.title, status: 'processing' }])
          } else if (data.type === 'done') {
            setProgress(p => p.map(x => x.id === data.id ? { ...x, status: 'done' } : x))
          } else if (data.type === 'error') {
            setProgress(p => p.map(x => x.id === data.id ? { ...x, status: 'error', message: data.message } : x))
          } else if (data.type === 'complete') {
            toast.success('Batch summarization complete!')
            setSummarizing(false)
          }
        }
      }
    } catch {
      toast.error('Summarization failed')
      setSummarizing(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-8">Upload Papers</h1>

      <div className="flex gap-1 mb-8 p-1 bg-white/5 rounded-lg w-fit">
        <button
          onClick={() => setMode('markdown')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'markdown' ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'
          }`}
        >
          Paste Markdown
        </button>
        <button
          onClick={() => setMode('json')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'json' ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'
          }`}
        >
          Upload JSON
        </button>
      </div>

      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Collection Name *</label>
            <Input
              value={collectionName}
              onChange={e => setCollectionName(e.target.value)}
              placeholder="LLM Agent Survey 2024"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Source URL (optional)</label>
            <Input
              value={collectionUrl}
              onChange={e => setCollectionUrl(e.target.value)}
              placeholder="https://github.com/..."
            />
          </div>
        </div>
      </div>

      {mode === 'markdown' ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Markdown Reading List</label>
            <textarea
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              placeholder="Paste your markdown reading list here...&#10;&#10;## Tool Use&#10;* **ReAct: Synergizing Reasoning and Acting**, ICLR 2023 [[paper](https://...)]"
              rows={12}
              className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-y"
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={handlePreview} variant="outline" disabled={loading || !markdown.trim() || !collectionName.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Preview papers
            </Button>
            {preview && (
              <Button onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Import {preview.length} papers
              </Button>
            )}
          </div>

          {preview && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 max-h-64 overflow-y-auto">
              <p className="text-sm text-white/40 mb-3">{preview.length} papers found:</p>
              <div className="space-y-1">
                {preview.map((p, i) => (
                  <div key={i} className="text-sm text-white/70 flex items-center gap-2">
                    <span className="text-white/20 text-xs">{i + 1}.</span>
                    <span className="line-clamp-1">{p.title}</span>
                    {p.venue && <span className="text-xs text-white/30 ml-auto flex-shrink-0">{p.venue}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <UploadDropzone
          onFileParsed={(result) => {
            const r = result as { collectionId: string; paperCount: number }
            setCollectionId(r.collectionId)
            toast.success(`Imported ${r.paperCount} papers`)
          }}
          collectionName={collectionName}
        />
      )}

      {collectionId && (
        <div className="mt-8 rounded-xl border border-blue-500/20 bg-blue-500/10 p-5">
          <p className="text-sm text-blue-300 mb-4">
            Papers imported! Now generate AI summaries.
          </p>
          <Button onClick={handleSummarizeBatch} disabled={summarizing}>
            {summarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {summarizing ? 'Generating summaries...' : 'Generate AI summaries'}
          </Button>
        </div>
      )}

      {progress.length > 0 && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 max-h-64 overflow-y-auto">
          <p className="text-xs text-white/40 mb-3">Progress:</p>
          <div className="space-y-1.5">
            {progress.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                {p.status === 'processing' && <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin flex-shrink-0" />}
                {p.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
                {p.status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />}
                <span className={`line-clamp-1 ${p.status === 'done' ? 'text-white/50' : 'text-white/70'}`}>
                  {p.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
