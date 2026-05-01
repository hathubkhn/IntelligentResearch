import Link from 'next/link'
import type { Post } from '@/types/post'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function PostCard({ post, featured = false }: { post: Post; featured?: boolean }) {
  const date = formatDate(post.publishedAt ?? post.createdAt)

  if (featured) {
    return (
      <Link href={`/blog/${post.slug}`} className="group block">
        {post.coverImage && (
          <div className="relative w-full aspect-[2.4/1] overflow-hidden rounded-2xl mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        )}
        <div className="space-y-3">
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 uppercase tracking-wide"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <h2 className="text-2xl sm:text-3xl font-bold text-white/90 group-hover:text-white leading-tight transition-colors">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="text-white/50 text-base leading-relaxed line-clamp-2">{post.excerpt}</p>
          )}
          <p className="text-sm text-white/30">
            {date}
            {post.readingTime ? ` · ${post.readingTime} min read` : ''}
          </p>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/blog/${post.slug}`} className="group flex gap-5 py-1">
      {/* Text */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {post.tags[0] && (
          <span className="text-[10px] font-medium text-white/30 uppercase tracking-wide">{post.tags[0]}</span>
        )}
        <h3 className="text-base font-bold text-white/80 group-hover:text-white leading-snug transition-colors line-clamp-2">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-white/40 line-clamp-2 leading-relaxed">{post.excerpt}</p>
        )}
        <p className="text-xs text-white/25">
          {date}
          {post.readingTime ? ` · ${post.readingTime} min` : ''}
        </p>
      </div>

      {/* Thumbnail */}
      {post.coverImage && (
        <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
    </Link>
  )
}
