import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { summarizePaper } from '@/lib/openai'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  const userId = (session.user as { id: string }).id

  const { collectionId } = await req.json() as { collectionId: string }
  if (!collectionId) {
    return Response.json({ error: 'collectionId required' }, { status: 400 })
  }

  // Verify the collection belongs to this user
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
  })
  if (!collection) {
    return Response.json({ error: 'Collection not found' }, { status: 404 })
  }

  const pendingPapers = await prisma.paper.findMany({
    where: {
      collectionId,
      userId,
      status: { in: ['PENDING', 'ERROR'] },
    },
    take: 50,
  })

  const encoder = new TextEncoder()
  const stream  = new TransformStream<Uint8Array, Uint8Array>()
  const writer  = stream.writable.getWriter()

  const send = (data: object) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  ;(async () => {
    await send({ type: 'start', total: pendingPapers.length })

    for (const paper of pendingPapers) {
      await send({ type: 'processing', id: paper.id, title: paper.title })
      await prisma.paper.update({ where: { id: paper.id }, data: { status: 'PROCESSING' } })

      try {
        const summary = await summarizePaper(paper)
        await prisma.paper.update({
          where: { id: paper.id },
          data: { ...summary, status: 'DONE' },
        })
        await send({ type: 'done', id: paper.id })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await prisma.paper.update({
          where: { id: paper.id },
          data: { status: 'ERROR', errorMessage: message },
        })
        await send({ type: 'error', id: paper.id, message })
      }
    }

    await send({ type: 'complete' })
    await writer.close()
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
