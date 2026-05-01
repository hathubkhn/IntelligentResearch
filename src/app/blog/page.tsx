import { prisma } from '@/lib/prisma'
import { PostCard } from '@/components/blog/PostCard'
import type { Post } from '@/types/post'

export const revalidate = 3600

export const metadata = {
  title: 'Blog — ResearchBlog',
  description: 'Insights and commentary on AI research and machine learning.',
}

export default async function BlogPage() {
  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: { publishedAt: 'desc' },
  }) as unknown as Post[]

  const [featured, ...rest] = posts

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Header */}
        <div className="mb-14">
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Blog</h1>
          <p className="text-white/40 text-base">
            Commentary, tutorials, and insights on AI research.
          </p>
        </div>

        {posts.length === 0 ? (
          <p className="text-white/30 text-sm">No posts published yet. Check back soon.</p>
        ) : (
          <div className="space-y-0">
            {/* Featured post */}
            {featured && (
              <div className="pb-14 mb-14 border-b border-white/8">
                <PostCard post={featured} featured />
              </div>
            )}

            {/* More posts */}
            {rest.length > 0 && (
              <>
                <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.2em] mb-8">
                  More Posts
                </p>
                <div className="divide-y divide-white/6">
                  {rest.map(post => (
                    <div key={post.id} className="py-7">
                      <PostCard post={post} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
