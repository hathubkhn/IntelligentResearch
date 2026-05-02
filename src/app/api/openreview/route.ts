import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { consumeTurn, QuotaExceededError } from '@/lib/usage'

export type { OpenReviewPaper } from '@/app/api/admin/openreview/route'
import { GET as adminGET } from '@/app/api/admin/openreview/route'
import type { OpenReviewPaper } from '@/app/api/admin/openreview/route'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in to search papers' }, { status: 401 })
  }

  const userId = (session.user as { id: string }).id
  try {
    await consumeTurn(userId)
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return NextResponse.json(
        { error: 'Monthly search limit reached', quota: e.info, upgrade: true },
        { status: 429 }
      )
    }
    throw e
  }

  const sp = new URL(req.url).searchParams

  // Support both single values (legacy) and comma-separated multi-values
  const conferencesRaw = sp.get('conferences') ?? sp.get('conference') ?? 'ICLR'
  const yearsRaw       = sp.get('years')       ?? sp.get('year')       ?? '2025'

  const conferences = conferencesRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  const years       = yearsRaw.split(',').map(s => parseInt(s)).filter(y => !isNaN(y))

  // Single conference+year — use original path (no extra overhead)
  if (conferences.length === 1 && years.length === 1) {
    const singleParams = new URLSearchParams(sp)
    singleParams.set('conference', conferences[0])
    singleParams.set('year', String(years[0]))
    singleParams.delete('conferences')
    singleParams.delete('years')
    const fakeReq = new NextRequest(`${req.nextUrl.origin}/api/admin/openreview?${singleParams}`)
    return adminGET(fakeReq)
  }

  // Multiple combos — fan out in parallel, merge results
  const limit  = parseInt(sp.get('limit') ?? '50')
  const combos = conferences.flatMap(c => years.map(y => ({ c, y })))

  const results = await Promise.allSettled(
    combos.map(({ c, y }) => {
      const p = new URLSearchParams(sp)
      p.set('conference', c)
      p.set('year', String(y))
      p.delete('conferences')
      p.delete('years')
      const fakeReq = new NextRequest(`${req.nextUrl.origin}/api/admin/openreview?${p}`)
      return adminGET(fakeReq).then(r => r.json() as Promise<{
        papers?: OpenReviewPaper[]
        fetchedFromAPI?: number
        matched?: number
        venueId?: string
        error?: string
      }>)
    })
  )

  const allPapers: OpenReviewPaper[] = []
  let totalFetched = 0
  let totalMatched = 0
  const venueIds: string[] = []
  const errors: string[] = []

  for (const result of results) {
    if (result.status === 'rejected') {
      errors.push(String(result.reason))
      continue
    }
    const data = result.value
    if (data.error) { errors.push(data.error); continue }
    allPapers.push(...(data.papers ?? []))
    totalFetched += data.fetchedFromAPI ?? 0
    totalMatched += data.matched ?? 0
    if (data.venueId) venueIds.push(data.venueId)
  }

  // Deduplicate by openReviewId, keep highest-scoring copy
  const seen = new Map<string, OpenReviewPaper>()
  for (const p of allPapers) {
    const existing = seen.get(p.openReviewId)
    if (!existing || p.score > existing.score) seen.set(p.openReviewId, p)
  }

  const merged = [...seen.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  if (merged.length === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors[0] }, { status: 400 })
  }

  return NextResponse.json({
    papers: merged,
    fetchedFromAPI: totalFetched,
    matched: totalMatched,
    venueId: venueIds.join(', '),
  })
}
