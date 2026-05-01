import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PlusCircle, FileText, Clock, Eye } from 'lucide-react'

export default async function AdminBlogPage() {
  const posts = await prisma.post.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      published: true,
      publishedAt: true,
      readingTime: true,
      updatedAt: true,
      tags: true,
      excerpt: true,
    },
  })

  const published = posts.filter(p => p.published).length
  const drafts = posts.length - published

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-white">Blog Posts</h1>
          <p className="text-sm text-white/40 mt-1">
            {published} published · {drafts} draft{drafts !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          New Post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-14 text-center">
          <FileText className="h-8 w-8 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm mb-1">No posts yet</p>
          <p className="text-white/25 text-xs">Create your first blog post to share research insights.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          {posts.map((post, i) => (
            <Link
              key={post.id}
              href={`/admin/blog/${post.id}`}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors group ${i !== 0 ? 'border-t border-white/6' : ''}`}
            >
              {/* Status dot */}
              <div className={`flex-shrink-0 h-2 w-2 rounded-full ${post.published ? 'bg-emerald-400' : 'bg-white/20'}`} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors truncate">
                  {post.title}
                </p>
                {post.excerpt && (
                  <p className="text-xs text-white/30 mt-0.5 truncate">{post.excerpt}</p>
                )}
              </div>

              {/* Tags */}
              <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                {post.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/30">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Meta */}
              <div className="flex items-center gap-3 flex-shrink-0 text-xs text-white/30">
                {post.readingTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {post.readingTime}m
                  </span>
                )}
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                  post.published
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-white/8 text-white/30'
                }`}>
                  {post.published ? 'Published' : 'Draft'}
                </span>
                <span className="hidden md:block">
                  {new Date(post.updatedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                </span>
                {post.published && (
                  <span className="text-white/20 hover:text-white/60 transition-colors" title="View public page">
                    <Eye className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
