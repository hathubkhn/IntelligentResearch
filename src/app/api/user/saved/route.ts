import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function getUserId(session: { user?: { id?: string } } | null) {
  const id = session?.user?.id
  // 'admin' is the hardcoded credentials-only id — no DB row
  return id && id !== 'admin' ? id : null
}

export async function GET() {
  const session = await getServerSession(authOptions) as { user?: { id?: string } } | null
  const userId = getUserId(session)
  if (!userId) return Response.json({ ids: [] })

  const saved = await prisma.savedPaper.findMany({
    where: { userId },
    select: { paperId: true, savedAt: true },
    orderBy: { savedAt: 'desc' },
  })
  return Response.json({ ids: saved.map(s => s.paperId) })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions) as { user?: { id?: string } } | null
  const userId = getUserId(session)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { paperId } = await req.json()
  if (!paperId) return Response.json({ error: 'paperId required' }, { status: 400 })

  await prisma.savedPaper.upsert({
    where: { userId_paperId: { userId, paperId } },
    create: { userId, paperId },
    update: {},
  })
  return Response.json({ saved: true })
}
