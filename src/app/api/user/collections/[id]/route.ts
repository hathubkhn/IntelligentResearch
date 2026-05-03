import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function getUserId(session: { user?: { id?: string } } | null) {
  const id = session?.user?.id
  return id && id !== 'admin' ? id : null
}

// PATCH /api/user/collections/[id]  { name?, description? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions) as { user?: { id?: string } } | null
  const userId = getUserId(session)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, description } = await req.json() as { name?: string; description?: string }

  const existing = await prisma.collection.findFirst({ where: { id, userId } })
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.collection.update({
    where: { id },
    data: {
      ...(name?.trim()               ? { name: name.trim() }                        : {}),
      ...(description !== undefined  ? { description: description?.trim() || null } : {}),
    },
  })
  return Response.json({ collection: updated })
}

// DELETE /api/user/collections/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions) as { user?: { id?: string } } | null
  const userId = getUserId(session)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.collection.findFirst({ where: { id, userId } })
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  // UserCollectionItem rows cascade-delete via DB relation
  await prisma.collection.delete({ where: { id } })
  return Response.json({ success: true })
}
