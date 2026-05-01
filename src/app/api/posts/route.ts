import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'untitled'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const published = searchParams.get('published')
  const tag = searchParams.get('tag')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))

  const where: Record<string, unknown> = {}
  if (published === 'true') where.published = true
  if (tag) where.tags = { has: tag }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.post.count({ where }),
  ])

  return NextResponse.json({ posts, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    title?: string
    slug?: string
    excerpt?: string
    content?: string
    tags?: string[]
    readingTime?: number
  }

  const title = body.title?.trim() || 'Untitled Post'

  let slug = body.slug?.trim() ? body.slug.trim() : slugify(title)
  slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled'

  const existing = await prisma.post.findUnique({ where: { slug } })
  if (existing) slug = `${slug}-${Date.now()}`

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      excerpt: body.excerpt ?? null,
      content: body.content ?? '',
      tags: body.tags ?? [],
      readingTime: body.readingTime ?? null,
    },
  })
  return NextResponse.json(post, { status: 201 })
}
