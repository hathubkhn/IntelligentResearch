import { prisma } from '@/lib/prisma'
import { summarizePaper } from '@/lib/openai'

export const maxDuration = 300

// Process 10 papers per batch call — keeps each invocation well under 300s
const BATCH_SIZE = 10

export async function POST() {
  const pendingPapers = await prisma.paper.findMany({
    where: { status: { in: ['PENDING', 'ERROR'] } },
    take: BATCH_SIZE,
  })

  const encoder = new TextEncoder()
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()

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
