'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Link2, Lightbulb, Sparkles, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type InputType = 'url' | 'topic'

export default function NewPostPage() {
  const router = useRouter()
  const [inputType, setInputType] = useState<InputType>('topic')
  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleGenerate = async () => {
    if (!input.trim()) {
      toast.error(inputType === 'url' ? 'Please enter a URL' : 'Please enter a topic')
      return
    }

    setGenerating(true)
    try {
      // 1. Generate content via OpenAI
      const genRes = await fetch('/api/posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim(), inputType }),
      })
      if (!genRes.ok) {
        const err = await genRes.json()
        throw new Error(err.error ?? 'Generation failed')
      }
      const generated = await genRes.json()

      // 2. Save to DB as draft
      setSaving(true)
      const saveRes = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generated),
      })
      if (!saveRes.ok) throw new Error('Failed to save post')
      const post = await saveRes.json()

      toast.success('Draft generated — review and edit before publishing')
      router.push(`/admin/blog/${post.id}`)
    } catch (err) {
      toast.error((err as Error).message)
      setSaving(false)
    } finally {
      setGenerating(false)
    }
  }

  const busy = generating || saving

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
        <div className="flex items-center gap-3 px-6 h-14">
          <Link href="/admin/blog" className="text-white/40 hover:text-white/70 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm text-white/50">New Post</span>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center pt-20 px-4">
        <div className="w-full max-w-lg space-y-8">

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-2">
              <Sparkles className="h-5 w-5 text-blue-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Generate Blog Post</h1>
            <p className="text-sm text-white/40">
              Provide a reference URL or a topic — AI will write a draft for you to review and edit.
            </p>
          </div>

          {/* Input type toggle */}
          <div className="flex rounded-xl border border-white/8 p-1 bg-white/3 gap-1">
            <button
              type="button"
              onClick={() => { setInputType('topic'); setInput('') }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
                inputType === 'topic'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Topic / Idea
            </button>
            <button
              type="button"
              onClick={() => { setInputType('url'); setInput('') }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${
                inputType === 'url'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              Reference URL
            </button>
          </div>

          {/* Input */}
          <div className="space-y-3">
            {inputType === 'topic' ? (
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate() }}
                placeholder="e.g. How retrieval-augmented generation is changing production LLM systems"
                rows={3}
                disabled={busy}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 resize-none disabled:opacity-50 transition-colors"
              />
            ) : (
              <input
                type="url"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleGenerate() }}
                placeholder="https://arxiv.org/abs/..."
                disabled={busy}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50 transition-colors"
              />
            )}
            <p className="text-[11px] text-white/25">
              {inputType === 'topic'
                ? 'Describe the topic in a sentence or two. More detail → better output.'
                : 'A blog post, paper, or article URL. The page content will be fetched and used as reference.'}
            </p>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={busy || !input.trim()}
            className="w-full h-11 text-sm font-medium gap-2"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {saving ? 'Saving draft…' : 'Generating…'}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Draft
              </>
            )}
          </Button>

          {busy && (
            <p className="text-center text-xs text-white/30 animate-pulse">
              {saving ? 'Almost done…' : 'Writing your post — this takes 10–20 seconds…'}
            </p>
          )}

          {/* Divider + manual option */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/6" />
            <span className="text-xs text-white/25">or</span>
            <div className="flex-1 h-px bg-white/6" />
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setSaving(true)
              try {
                const res = await fetch('/api/posts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: 'Untitled Post' }),
                })
                const post = await res.json()
                router.push(`/admin/blog/${post.id}`)
              } finally {
                setSaving(false)
              }
            }}
            className="w-full py-2.5 text-sm text-white/35 hover:text-white/55 transition-colors disabled:opacity-40"
          >
            Start with a blank post
          </button>

        </div>
      </div>
    </div>
  )
}
