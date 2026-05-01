import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function calcReadingTime(content: string): number {
  const words = content.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const post = await prisma.post.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(post)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()

  const wasPublished = body.published === true
  let publishedAt = body.publishedAt ?? null

  if (wasPublished && !publishedAt) {
    const current = await prisma.post.findUnique({ where: { id }, select: { publishedAt: true } })
    publishedAt = current?.publishedAt ?? new Date()
  }
  if (!wasPublished) publishedAt = null

  const post = await prisma.post.update({
    where: { id },
    data: {
      title: body.title,
      slug: body.slug,
      excerpt: body.excerpt ?? null,
      content: body.content ?? '',
      coverImage: body.coverImage ?? null,
      tags: body.tags ?? [],
      published: wasPublished,
      publishedAt,
      readingTime: calcReadingTime(body.content ?? ''),
    },
  })

  return NextResponse.json(post)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  await prisma.post.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
