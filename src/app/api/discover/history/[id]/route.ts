import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/discover/history/[id] — attach gap analysis to an existing history entry
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as { id: string }).id
  const { id } = await params
  const body = await req.json() as { gapMarkdown: string; targetDomain?: string }

  const entry = await prisma.discoverHistory.updateMany({
    where: { id, userId },
    data: {
      gapMarkdown: body.gapMarkdown,
      targetDomain: body.targetDomain ?? null,
    },
  })

  if (entry.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/discover/history/[id] — remove a history entry
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as { id: string }).id
  const { id } = await params

  await prisma.discoverHistory.deleteMany({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
