import { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { invalidatePattern } from '@/lib/cache'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const paper = await prisma.paper.findUnique({
    where: { id },
    include: { collection: true },
  })
  if (!paper) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(paper)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const paper = await prisma.paper.update({ where: { id }, data: body })

  // Bust ISR cache and Redis cache
  revalidatePath(`/papers/${id}`)
  await invalidatePattern('papers:*').catch(() => null)

  return Response.json(paper)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.paper.delete({ where: { id } })
  revalidatePath('/papers')
  await invalidatePattern('papers:*').catch(() => null)
  return Response.json({ success: true })
}
