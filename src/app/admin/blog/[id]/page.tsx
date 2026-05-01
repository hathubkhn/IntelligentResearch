'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Trash2, Eye, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { MarkdownEditor } from '@/components/admin/MarkdownEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Post } from '@/types/post'

interface Props { params: Promise<{ id: string }> }

export default function EditPostPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/posts/${id}`)
      .then(r => r.json())
      .then(setPost)
  }, [id])

  const save = async (overrides: Partial<Post> = {}) => {
    if (!post) return
    setSaving(true)
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...post, ...overrides }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setPost(updated)
      toast.success('Saved')
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = () => save({ published: !post?.published })

  const handleDelete = async () => {
    if (!confirm('Delete this post? This cannot be undone.')) return
    setDeleting(true)
    try {
      await fetch(`/api/posts/${id}`, { method: 'DELETE' })
      router.push('/admin/blog')
    } catch {
      toast.error('Delete failed')
      setDeleting(false)
    }
  }

  if (!post) {
    return <div className="p-8 text-white/40 text-sm">Loading…</div>
  }

  const wordCount = post.content.split(/\s+/).filter(Boolean).length
  const readTime = Math.max(1, Math.ceil(wordCount / 200))

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
        <div className="flex items-center gap-3 px-6 h-14">
          <Link href="/admin/blog" className="text-white/40 hover:text-white/70 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <p className="flex-1 text-sm text-white/40 truncate">{post.title}</p>

          <span className="hidden sm:block text-xs text-white/25">
            {wordCount} words · {readTime} min read
          </span>

          {post.published && (
            <Link
              href={`/blog/${post.slug}`}
              target="_blank"
              className="text-white/40 hover:text-white/70 transition-colors"
              title="View public post"
            >
              <Eye className="h-4 w-4" />
            </Link>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>

          <Button variant="outline" size="sm" onClick={togglePublish} disabled={saving}>
            {post.published ? 'Unpublish' : 'Publish'}
          </Button>

          <Button size="sm" onClick={() => save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor area */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-8">
            {/* Title */}
            <input
              value={post.title}
              onChange={e => setPost({ ...post, title: e.target.value })}
              placeholder="Post title"
              className="w-full bg-transparent text-3xl font-bold text-white placeholder:text-white/20 focus:outline-none leading-tight mb-3"
            />

            {/* Excerpt */}
            <textarea
              value={post.excerpt ?? ''}
              onChange={e => setPost({ ...post, excerpt: e.target.value || null })}
              rows={2}
              placeholder="Short description shown in blog listings…"
              className="w-full bg-transparent text-base text-white/45 placeholder:text-white/18 focus:outline-none resize-none leading-relaxed border-b border-white/6 pb-6 mb-6"
            />

            {/* Content */}
            <MarkdownEditor
              value={post.content}
              onChange={content => setPost({ ...post, content })}
            />
          </div>
        </div>

        {/* Settings sidebar */}
        <aside className="hidden lg:block w-72 flex-shrink-0 border-l border-white/8 overflow-y-auto">
          <div className="p-5 space-y-6">

            {/* Status */}
            <div>
              <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Status</h3>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                  post.published
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-white/8 text-white/40'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${post.published ? 'bg-emerald-400' : 'bg-white/30'}`} />
                  {post.published ? 'Published' : 'Draft'}
                </span>
              </div>
              {post.publishedAt && (
                <p className="text-[11px] text-white/25 mt-2">
                  {new Date(post.publishedAt).toLocaleDateString('en', { dateStyle: 'medium' })}
                </p>
              )}
            </div>

            {/* Slug */}
            <div>
              <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">URL Slug</h3>
              <Input
                value={post.slug}
                onChange={e => setPost({ ...post, slug: e.target.value })}
                className="text-xs font-mono"
              />
              <p className="text-[10px] text-white/20 mt-1.5 truncate">/blog/{post.slug}</p>
            </div>

            {/* Cover image */}
            <div>
              <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Cover Image</h3>
              <Input
                value={post.coverImage ?? ''}
                onChange={e => setPost({ ...post, coverImage: e.target.value || null })}
                placeholder="https://..."
                className="text-xs"
              />
              {post.coverImage && (
                <div className="relative mt-2 rounded-lg overflow-hidden border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.coverImage}
                    alt=""
                    className="w-full h-28 object-cover"
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                  <button
                    type="button"
                    onClick={() => setPost({ ...post, coverImage: null })}
                    className="absolute top-1.5 right-1.5 p-0.5 rounded bg-black/60 text-white/60 hover:text-white transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Tags */}
            <div>
              <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Tags</h3>
              <Input
                value={post.tags.join(', ')}
                onChange={e => setPost({ ...post, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                placeholder="ai, research, nlp"
                className="text-xs"
              />
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {post.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 text-white/40">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="pt-4 border-t border-white/8">
              <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Stats</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/30">Words</span>
                  <span className="text-white/55">{wordCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/30">Read time</span>
                  <span className="text-white/55">{readTime} min</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/30">Characters</span>
                  <span className="text-white/55">{post.content.length.toLocaleString()}</span>
                </div>
              </div>
            </div>

          </div>
        </aside>
      </div>
    </div>
  )
}
