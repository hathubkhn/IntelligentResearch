export interface Post {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  coverImage: string | null
  tags: string[]
  published: boolean
  publishedAt: string | null
  readingTime: number | null
}
