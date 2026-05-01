import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { OpenReviewPaper } from '@/app/api/admin/openreview/route'

const VENUE_TYPE_MAP: Record<string, 'CONFERENCE' | 'JOURNAL' | 'WORKSHOP' | 'PREPRINT'> = {
  ICLR: 'CONFERENCE',
  NeurIPS: 'CONFERENCE',
  ICML: 'CONFERENCE',
  COLM: 'CONFERENCE',
  AISTATS: 'CONFERENCE',
  UAI: 'CONFERENCE',
  TMLR: 'JOURNAL',
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const userId = (session.user as { id: string }).id

  const body = await req.json() as {
    papers: OpenReviewPaper[]
    collectionName: string
    collectionDescription?: string
  }
  const { papers, collectionName, collectionDescription } = body

  if (!Array.isArray(papers) || papers.length === 0) {
    return NextResponse.json({ error: 'No papers provided' }, { status: 400 })
  }
  if (!collectionName?.trim()) {
    return NextResponse.json({ error: 'Collection name is required' }, { status: 400 })
  }

  const openReviewUrls = papers.map(p => p.openReviewUrl).filter(Boolean)
  const titles         = papers.map(p => p.title).filter(Boolean)

  // Skip papers already in this user's private library
  const existing = await prisma.paper.findMany({
    where: {
      userId,
      OR: [
        ...(openReviewUrls.length ? [{ openReviewUrl: { in: openReviewUrls } }] : []),
        ...(titles.length         ? [{ title:         { in: titles         } }] : []),
      ],
    },
    select: { openReviewUrl: true, title: true },
  })

  const existingUrls   = new Set(existing.map(e => e.openReviewUrl).filter(Boolean))
  const existingTitles = new Set(existing.map(e => e.title))
  const toCreate       = papers.filter(
    p => !existingUrls.has(p.openReviewUrl) && !existingTitles.has(p.title)
  )

  // Create the user-owned collection
  const collection = await prisma.collection.create({
    data: {
      name: collectionName.trim(),
      description: collectionDescription?.trim() || null,
      userId,
    },
  })

  // Create private papers linked to this collection
  if (toCreate.length > 0) {
    await prisma.paper.createMany({
      data: toCreate.map(p => ({
        title: p.title,
        authors: p.authors,
        year: p.year,
        venue: p.venue,
        venueType: VENUE_TYPE_MAP[p.venue?.toUpperCase()] ?? 'CONFERENCE',
        category: p.primaryArea ?? null,
        tags: p.keywords.slice(0, 8),
        paperUrl: p.paperUrl,
        openReviewUrl: p.openReviewUrl,
        rawInput: p.abstract || p.title,
        status: 'PENDING',
        isPublished: false,
        collectionId: collection.id,
        userId,
        contributions: [],
      })),
      skipDuplicates: true,
    })
  }

  const skipped = papers.length - toCreate.length

  return NextResponse.json({
    collectionId: collection.id,
    collectionName: collection.name,
    created: toCreate.length,
    skipped,
  })
}
