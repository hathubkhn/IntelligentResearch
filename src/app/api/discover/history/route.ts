import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/discover/history — list the current user's discovery history (latest 30)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as { id: string }).id

  const history = await prisma.discoverHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      createdAt: true,
      conference: true,
      year: true,
      topics: true,
      methods: true,
      domains: true,
      tasks: true,
      maxResults: true,
      matchedCount: true,
      papers: true,
      gapMarkdown: true,
      targetDomain: true,
    },
  })

  return NextResponse.json({ history })
}

// POST /api/discover/history — save a new search to history
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as { id: string }).id
  const body = await req.json() as {
    conference: string
    year: number
    topics: string
    methods: string[]
    domains: string[]
    tasks: string[]
    maxResults: number
    matchedCount: number
    papers: { id: string; title: string; venue: string; year: number; score: number; openReviewUrl: string }[]
  }

  const entry = await prisma.discoverHistory.create({
    data: {
      userId,
      conference: body.conference,
      year: body.year,
      topics: body.topics,
      methods: body.methods ?? [],
      domains: body.domains ?? [],
      tasks: body.tasks ?? [],
      maxResults: body.maxResults ?? 50,
      matchedCount: body.matchedCount ?? 0,
      papers: body.papers ?? [],
    },
  })

  return NextResponse.json({ id: entry.id })
}
