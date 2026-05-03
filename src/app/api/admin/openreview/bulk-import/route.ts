import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { summarizePaper, generateEmbedding } from '@/lib/openai'
import { VENUE_IDS, fetchNotes, mapNote } from '../route'
import type { OpenReviewPaper } from '../route'

export const maxDuration = 300 // 5 min — large conference bulk imports

const VENUE_TYPE_MAP: Record<string, 'CONFERENCE' | 'JOURNAL' | 'WORKSHOP' | 'PREPRINT'> = {
  ICLR: 'CONFERENCE', NeurIPS: 'CONFERENCE', ICML: 'CONFERENCE',
  COLM: 'CONFERENCE', AISTATS: 'CONFERENCE', UAI: 'CONFERENCE',
  ACL: 'CONFERENCE',  EMNLP: 'CONFERENCE',  NAACL: 'CONFERENCE',
  EACL: 'CONFERENCE', CoRL: 'CONFERENCE',
  TMLR: 'JOURNAL',
}

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

// Batch summarize with concurrency limit
const CONCURRENT = 3

export async function POST(req: NextRequest) {
  const {
    conference,
    year,
    collectionId,
    maxFetch = 500,
    summarize = false,
  } = await req.json() as {
    conference: string
    year: number
    collectionId?: string
    maxFetch?: number
    summarize?: boolean
  }

  const conf = conference.toUpperCase()
  const venueId = VENUE_IDS[conf]?.[year]

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encoder.encode(sse(data)))

      if (!venueId) {
        send({ type: 'error', message: `No venue ID for ${conf} ${year}` })
        controller.close()
        return
      }

      try {
        // ── 1. Fetch from OpenReview ─────────────────────────────────────────
        send({ type: 'status', step: 'fetch', message: `Fetching ${conf} ${year} papers from OpenReview…` })

        const { notes, fetchedCount } = await fetchNotes(venueId, maxFetch)
        const papers = notes.map(n => mapNote(n, conf, year))

        send({ type: 'status', step: 'fetch', message: `Fetched ${fetchedCount} papers from API`, total: papers.length })

        // ── 2. Deduplicate against existing DB ───────────────────────────────
        send({ type: 'status', step: 'dedup', message: 'Checking duplicates…' })

        const urls   = papers.map(p => p.openReviewUrl).filter(Boolean)
        const titles = papers.map(p => p.title).filter(Boolean)

        const existing = await prisma.paper.findMany({
          where: {
            OR: [
              ...(urls.length   ? [{ openReviewUrl: { in: urls   } }] : []),
              ...(titles.length ? [{ title:         { in: titles } }] : []),
            ],
          },
          select: { openReviewUrl: true, title: true },
        })
        const existingUrls   = new Set(existing.map(e => e.openReviewUrl).filter(Boolean))
        const existingTitles = new Set(existing.map(e => e.title))

        const toCreate: OpenReviewPaper[] = papers.filter(
          p => !existingUrls.has(p.openReviewUrl) && !existingTitles.has(p.title)
        )
        const skipped = papers.length - toCreate.length

        send({ type: 'status', step: 'dedup', message: `${toCreate.length} new papers, ${skipped} already in DB` })

        if (toCreate.length === 0) {
          send({ type: 'complete', created: 0, skipped, summarized: 0 })
          controller.close()
          return
        }

        // ── 3. Insert in batches of 50 ───────────────────────────────────────
        const BATCH = 50
        let totalCreated = 0
        const createdIds: string[] = []

        for (let i = 0; i < toCreate.length; i += BATCH) {
          const batch = toCreate.slice(i, i + BATCH)
          const result = await prisma.paper.createMany({
            data: batch.map(p => ({
              title:        p.title,
              authors:      p.authors,
              year:         p.year,
              venue:        p.venue,
              venueType:    VENUE_TYPE_MAP[p.venue] ?? 'CONFERENCE',
              category:     p.primaryArea ?? null,
              tags:         p.keywords.slice(0, 8),
              paperUrl:     p.paperUrl,
              openReviewUrl: p.openReviewUrl,
              rawInput:     p.abstract || p.title,
              status:       summarize ? 'PENDING' : 'PENDING',
              isPublished:  true,
              collectionId: collectionId ?? null,
              contributions: [],
            })),
            skipDuplicates: true,
          })
          totalCreated += result.count

          // Fetch IDs of just-created papers for summarization
          if (summarize) {
            const inserted = await prisma.paper.findMany({
              where: { openReviewUrl: { in: batch.map(p => p.openReviewUrl) } },
              select: { id: true },
            })
            createdIds.push(...inserted.map(p => p.id))
          }

          send({
            type: 'progress',
            step: 'import',
            done: Math.min(i + BATCH, toCreate.length),
            total: toCreate.length,
            created: totalCreated,
          })
        }

        send({ type: 'status', step: 'import', message: `Imported ${totalCreated} papers` })

        // ── 4. Optional AI summarization + embedding ─────────────────────────
        let summarized = 0
        if (summarize && createdIds.length > 0) {
          send({ type: 'status', step: 'summarize', message: `Generating AI summaries for ${createdIds.length} papers…` })

          // Mark all as PROCESSING first
          await prisma.paper.updateMany({
            where: { id: { in: createdIds } },
            data: { status: 'PROCESSING' },
          })

          const papersToSummarize = await prisma.paper.findMany({
            where: { id: { in: createdIds } },
            select: { id: true, title: true, authors: true, venue: true, year: true, category: true, rawInput: true },
          })

          // Process in sliding window of CONCURRENT
          const queue = [...papersToSummarize]
          let active = 0
          let qi = 0

          await new Promise<void>((resolve) => {
            const next = () => {
              while (active < CONCURRENT && qi < queue.length) {
                const paper = queue[qi++]
                active++
                ;(async () => {
                  try {
                    const result = await summarizePaper(paper)

                    // Generate embedding from tldr + abstract
                    let embeddingData: number[] | null = null
                    try {
                      const embText = `${result.tldr ?? ''} ${paper.rawInput ?? ''}`.slice(0, 8000)
                      embeddingData = await generateEmbedding(embText)
                    } catch { /* skip embedding if it fails */ }

                    await prisma.paper.update({
                      where: { id: paper.id },
                      data: {
                        status:            'DONE',
                        tldr:              result.tldr,
                        problem:           result.problem,
                        keyIdea:           result.keyIdea,
                        methodDescription: result.methodDescription,
                        results:           result.results,
                        contributions:     result.contributions ?? [],
                        tags:              result.tags ?? [],
                        ...(embeddingData ? {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          embedding: `[${embeddingData.join(',')}]` as any,
                        } : {}),
                      },
                    })
                    summarized++
                    send({ type: 'summarized', paperId: paper.id, title: paper.title, done: summarized, total: createdIds.length })
                  } catch (err) {
                    await prisma.paper.update({
                      where: { id: paper.id },
                      data: { status: 'ERROR', errorMessage: (err as Error).message },
                    })
                    send({ type: 'summarize_error', paperId: paper.id, title: paper.title, error: (err as Error).message })
                  }
                  active--
                  next()
                  if (active === 0 && qi >= queue.length) resolve()
                })()
              }
            }
            next()
            if (queue.length === 0) resolve()
          })
        }

        send({ type: 'complete', created: totalCreated, skipped, summarized })
      } catch (err) {
        send({ type: 'error', message: (err as Error).message })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
