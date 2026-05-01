import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(_req: Request, { params }: { params: Promise<{ paperId: string }> }) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string })?.id
  if (!userId || userId === 'admin') return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { paperId } = await params
  await prisma.savedPaper.deleteMany({ where: { userId, paperId } })
  return Response.json({ saved: false })
}
