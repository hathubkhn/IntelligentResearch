import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const { id: collectionId } = await params
  const { paperId } = await req.json() as { paperId: string }

  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
  })
  if (!collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

  const item = await prisma.userCollectionItem.upsert({
    where: { collectionId_paperId: { collectionId, paperId } },
    update: {},
    create: { collectionId, paperId },
  })

  return NextResponse.json(item)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as { id: string }).id

  const { id: collectionId } = await params
  const { paperId } = await req.json() as { paperId: string }

  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
  })
  if (!collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

  await prisma.userCollectionItem.deleteMany({
    where: { collectionId, paperId },
  })

  return NextResponse.json({ success: true })
}
