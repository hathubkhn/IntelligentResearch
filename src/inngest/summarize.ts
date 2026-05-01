import { inngest } from './client'
import { prisma } from '@/lib/prisma'
import { summarizePaper, generateEmbedding } from '@/lib/openai'
import { invalidatePattern } from '@/lib/cache'

export const summarizePaperJob = inngest.createFunction(
  {
    id: 'summarize-paper',
    retries: 2,
    triggers: [{ event: 'paper/summarize' }],
  },
  async ({ event }: { event: { data: { paperId: string } } }) => {
    const { paperId } = event.data

    const paper = await prisma.paper.findUnique({ where: { id: paperId } })
    if (!paper) throw new Error(`Paper ${paperId} not found`)

    await prisma.paper.update({
      where: { id: paperId },
      data: { status: 'PROCESSING', errorMessage: null },
    })

    try {
      const summary = await summarizePaper(paper)
      await prisma.paper.update({
        where: { id: paperId },
        data: { ...summary, status: 'DONE', errorMessage: null },
      })

      // Generate and store embedding for semantic search (best-effort)
      const embeddingText = `${paper.title} ${summary.tldr} ${summary.keyIdea ?? ''}`
      const embedding = await generateEmbedding(embeddingText).catch(() => null)
      if (embedding) {
        const vector = `[${embedding.join(',')}]`
        await prisma.$executeRawUnsafe(
          `UPDATE "Paper" SET embedding = $1::vector WHERE id = $2`,
          vector,
          paperId,
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await prisma.paper.update({
        where: { id: paperId },
        data: { status: 'ERROR', errorMessage: message },
      })
      throw error
    }

    await invalidatePattern('papers:*')
    return { success: true, paperId }
  },
)
