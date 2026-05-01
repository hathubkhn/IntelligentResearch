import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Post } from '@/types/post'
import type { Metadata } from 'next'

export const revalidate = 3600

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await prisma.post.findUnique({
    where: { slug, published: true },
    select: { title: true, excerpt: true, coverImage: true },
  })
  if (!post) return {}
  return {
    title: `${post.title} — ResearchBlog`,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.coverImage ? [post.coverImage] : [],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await prisma.post.findUnique({
    where: { slug, published: true },
  }) as unknown as Post | null

  if (!post) notFound()

  const date = new Date(post.publishedAt ?? post.createdAt).toLocaleDateString('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen">
      {/* Cover image */}
      {post.coverImage && (
        <div className="relative w-full aspect-[3/1] overflow-hidden max-h-[480px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/20 to-transparent" />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        {/* Back link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-white/35 hover:text-white/60 transition-colors mb-10"
        >
          <ArrowLeft className="h-4 w-4" />
          All posts
        </Link>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {post.tags.map(tag => (
              <span
                key={tag}
                className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 uppercase tracking-wide"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight tracking-tight mb-5">
          {post.title}
        </h1>

        {/* Meta bar */}
        <div className="flex items-center gap-2 text-sm text-white/30 mb-12 pb-8 border-b border-white/8">
          <time>{date}</time>
          {post.readingTime && (
            <>
              <span className="text-white/15">·</span>
              <span>{post.readingTime} min read</span>
            </>
          )}
        </div>

        {/* Article content */}
        <article className="blog-prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {post.content}
          </ReactMarkdown>
        </article>

        {/* Tags footer */}
        {post.tags.length > 0 && (
          <div className="mt-14 pt-8 border-t border-white/8">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-4">Tagged</p>
            <div className="flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <Link
                  key={tag}
                  href={`/blog?tag=${encodeURIComponent(tag)}`}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
