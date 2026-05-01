import { NextRequest, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { summarizePaper, generateEmbedding } from '@/lib/openai'
import { invalidatePattern } from '@/lib/cache'

async function runSummarize(paperId: string) {
  const paper = await prisma.paper.findUnique({ where: { id: paperId } })
  if (!paper) return

  try {
    const summary = await summarizePaper(paper)
    await prisma.paper.update({
      where: { id: paperId },
      data: { ...summary, status: 'DONE', errorMessage: null },
    })

    // Best-effort embedding for semantic search
    const text = `${paper.title} ${summary.tldr} ${summary.keyIdea ?? ''}`
    const embedding = await generateEmbedding(text).catch(() => null)
    if (embedding) {
      const vector = `[${embedding.join(',')}]`
      await prisma.$executeRawUnsafe(
        `UPDATE "Paper" SET embedding = $1::vector WHERE id = $2`,
        vector,
        paperId,
      )
    }
  } catch (error) {
    console.error('[summarize] error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = (error as Record<string, unknown>)?.status
    const detail = status ? `HTTP ${status}: ${message}` : message
    await prisma.paper.update({
      where: { id: paperId },
      data: { status: 'ERROR', errorMessage: detail },
    })
  }

  await invalidatePattern('papers:*').catch(() => null)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const force = req.nextUrl.searchParams.get('force') === 'true'

  const paper = await prisma.paper.findUnique({ where: { id } })
  if (!paper) return Response.json({ error: 'Not found' }, { status: 404 })

  // Idempotency: skip if already summarized unless forced
  if (paper.status === 'DONE' && !force) {
    return Response.json(paper)
  }

  // Mark as processing so the UI shows the spinner
  await prisma.paper.update({ where: { id }, data: { status: 'PROCESSING', errorMessage: null } })

  // Try Inngest (when dev server is running or INNGEST_SIGNING_KEY set for prod).
  // Falls back to after() if Inngest is unavailable so local dev always works.
  const useInngest = !!(process.env.INNGEST_DEV || process.env.INNGEST_SIGNING_KEY)

  if (useInngest) {
    try {
      const { inngest } = await import('@/inngest/client')
      await inngest.send({ name: 'paper/summarize', data: { paperId: id } })
    } catch (err) {
      console.warn('[summarize] Inngest unavailable, falling back to after():', (err as Error).message)
      after(async () => runSummarize(id))
    }
  } else {
    after(async () => runSummarize(id))
  }

  return Response.json({ status: 'processing', id }, { status: 202 })
}
