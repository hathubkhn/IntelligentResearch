import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      papers: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!collection) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(collection)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.collection.delete({ where: { id } })
  return Response.json({ success: true })
}
