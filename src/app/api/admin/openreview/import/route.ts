import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { OpenReviewPaper } from '../route'

export const maxDuration = 60

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
  const body = await req.json() as { papers: OpenReviewPaper[]; collectionId?: string }
  const { papers, collectionId } = body

  if (!Array.isArray(papers) || papers.length === 0) {
    return NextResponse.json({ error: 'No papers provided' }, { status: 400 })
  }

  const openReviewUrls = papers.map(p => p.openReviewUrl).filter(Boolean)
  const titles         = papers.map(p => p.title).filter(Boolean)

  // Check duplicates by openReviewUrl (same import source) OR exact title
  // (catches papers already added via another route, e.g. arXiv).
  const existing = await prisma.paper.findMany({
    where: {
      OR: [
        ...(openReviewUrls.length ? [{ openReviewUrl: { in: openReviewUrls } }] : []),
        ...(titles.length         ? [{ title:         { in: titles         } }] : []),
      ],
    },
    select: { openReviewUrl: true, title: true },
  })

  const existingUrls   = new Set(existing.map(e => e.openReviewUrl).filter(Boolean))
  const existingTitles = new Set(existing.map(e => e.title))

  const toCreate = papers.filter(p =>
    !existingUrls.has(p.openReviewUrl) &&
    !existingTitles.has(p.title)
  )

  const skipped = papers.length - toCreate.length

  if (toCreate.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped,
      message: 'All papers already exist in the database.',
    })
  }

  const created = await prisma.paper.createMany({
    data: toCreate.map(p => ({
      title: p.title,
      authors: p.authors,
      year: p.year,
      venue: p.venue,
      venueType: VENUE_TYPE_MAP[p.venue.toUpperCase()] ?? 'CONFERENCE',
      category: p.primaryArea ?? null,
      tags: p.keywords.slice(0, 8),
      paperUrl: p.paperUrl,
      openReviewUrl: p.openReviewUrl,
      rawInput: p.abstract || p.title,
      status: 'PENDING',
      isPublished: true,
      collectionId: collectionId ?? null,
      contributions: [],
    })),
    skipDuplicates: true,
  })

  return NextResponse.json({
    created: created.count,
    skipped: skipped + (toCreate.length - created.count),
  })
}
