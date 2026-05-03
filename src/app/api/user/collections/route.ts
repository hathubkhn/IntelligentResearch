import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function getUserId(session: { user?: { id?: string } } | null) {
  const id = session?.user?.id
  return id && id !== 'admin' ? id : null
}

// GET /api/user/collections?paperId=xxx
// Returns user's private collections; if paperId given, also marks hasPaper
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as { user?: { id?: string } } | null
  const userId = getUserId(session)
  if (!userId) return Response.json({ collections: [] })

  const paperId = req.nextUrl.searchParams.get('paperId') ?? ''

  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { items: true } } },
  })

  // Check paper membership across all collections in one query
  const membership: Set<string> = new Set()
  if (paperId) {
    const items = await prisma.userCollectionItem.findMany({
      where: { paperId, collection: { userId } },
      select: { collectionId: true },
    })
    items.forEach(i => membership.add(i.collectionId))
  }

  return Response.json({
    collections: collections.map(col => ({
      id:          col.id,
      name:        col.name,
      description: col.description,
      paperCount:  col._count.items,
      hasPaper:    paperId ? membership.has(col.id) : false,
    })),
  })
}

// POST /api/user/collections  { name, description? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as { user?: { id?: string } } | null
  const userId = getUserId(session)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description } = await req.json() as { name?: string; description?: string }
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })

  const collection = await prisma.collection.create({
    data: {
      name:        name.trim(),
      description: description?.trim() || null,
      userId,
    },
    include: { _count: { select: { items: true } } },
  })

  return Response.json({
    collection: {
      id:          collection.id,
      name:        collection.name,
      description: collection.description,
      paperCount:  collection._count.items,
      hasPaper:    false,
    },
  }, { status: 201 })
}
