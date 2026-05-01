import { NextRequest, NextResponse } from 'next/server'
import https from 'https'

export const maxDuration = 60 // seconds — OpenReview API can be slow (10-15s per page)

// OpenReview v2: use content.venueid to get accepted papers only.
// Papers assigned a venue ID by the PCs are accepted; rejected papers are not tagged.
const VENUE_IDS: Record<string, Partial<Record<number, string>>> = {
  ICLR:    { 2022: 'ICLR.cc/2022/Conference', 2023: 'ICLR.cc/2023/Conference', 2024: 'ICLR.cc/2024/Conference', 2025: 'ICLR.cc/2025/Conference' },
  NeurIPS: { 2021: 'NeurIPS.cc/2021/Conference', 2022: 'NeurIPS.cc/2022/Conference', 2023: 'NeurIPS.cc/2023/Conference', 2024: 'NeurIPS.cc/2024/Conference' },
  ICML:    { 2022: 'ICML.cc/2022/Conference', 2023: 'ICML.cc/2023/Conference', 2024: 'ICML.cc/2024/Conference', 2025: 'ICML.cc/2025/Conference' },
  COLM:    { 2024: 'COLM.cc/2024/Conference', 2025: 'COLM.cc/2025/Conference' },
  TMLR:    { 2022: 'TMLR', 2023: 'TMLR', 2024: 'TMLR', 2025: 'TMLR' },
  AISTATS: { 2024: 'AISTATS.cc/2024/Conference', 2025: 'AISTATS.cc/2025/Conference' },
  UAI:     { 2023: 'auai.org/UAI/2023/Conference', 2024: 'auai.org/UAI/2024/Conference' },
}

export interface OpenReviewPaper {
  openReviewId: string
  title: string
  authors: string[]
  abstract: string
  keywords: string[]
  primaryArea: string | null
  paperUrl: string
  openReviewUrl: string
  venue: string
  year: number
  score: number
}

interface ORContent {
  title?: { value: string }
  authors?: { value: string[] }
  abstract?: { value: string }
  keywords?: { value: string[] }
  primary_area?: { value: string }
  'primary area'?: { value: string }
  pdf?: { value: string }
}

interface ORNote {
  id: string
  forum: string
  content: ORContent
}

function scoreNote(note: ORNote, terms: string[]): number {
  if (terms.length === 0) return 1
  const title = (note.content.title?.value ?? '').toLowerCase()
  const abstract = (note.content.abstract?.value ?? '').toLowerCase()
  const keywords = (note.content.keywords?.value ?? []).map(k => k.toLowerCase())
  const primary = (note.content.primary_area?.value ?? note.content['primary area']?.value ?? '').toLowerCase()

  let score = 0
  for (const term of terms) {
    const t = term.toLowerCase()
    if (t.length < 3) continue
    if (title.includes(t)) score += 4
    if (primary.includes(t)) score += 3
    if (keywords.some(k => k.includes(t))) score += 2
    if (abstract.includes(t)) score += 1
  }
  return score
}

function toTerms(raw: string): string[] {
  // Split on comma/semicolon to get phrases, then also split phrases into words.
  // Both phrases and individual words are used for matching.
  const phrases = raw.split(/[,;]/).map(s => s.trim()).filter(Boolean)
  const words = phrases.flatMap(p => p.split(/\s+/))
  return [...new Set([...phrases, ...words])].filter(t => t.length >= 3)
}

function mapNote(note: ORNote, conference: string, year: number): OpenReviewPaper {
  return {
    openReviewId: note.id,
    title: note.content.title?.value ?? '(no title)',
    authors: note.content.authors?.value ?? [],
    abstract: note.content.abstract?.value ?? '',
    keywords: note.content.keywords?.value ?? [],
    primaryArea: note.content.primary_area?.value ?? note.content['primary area']?.value ?? null,
    paperUrl: `https://openreview.net/pdf?id=${note.id}`,
    openReviewUrl: `https://openreview.net/forum?id=${note.forum || note.id}`,
    venue: conference,
    year,
    score: 0,
  }
}

// ISPs in some regions block api2.openreview.net via SNI inspection.
// Connecting directly to the pre-resolved IP with no SNI (servername:'') bypasses this.
// The Host header tells the server which vhost to serve; rejectUnauthorized:false is needed
// since the TLS cert is issued for the hostname, not the IP.
const OPENREVIEW_HOST = 'api2.openreview.net'
const OPENREVIEW_IP   = '34.120.73.14'
const FETCH_TIMEOUT_MS = 20000

function fetchPage(urlObj: URL): Promise<{ notes: ORNote[] }> {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: OPENREVIEW_IP,
      port: 443,
      path: `${urlObj.pathname}?${urlObj.searchParams.toString()}`,
      headers: {
        'Host': OPENREVIEW_HOST,
        'User-Agent': 'ResearchBlog/1.0',
        'Accept': 'application/json',
      },
      rejectUnauthorized: false, // cert is for hostname; we connect by IP
      servername: '',            // omit SNI — bypasses ISP SNI-based blocking
      timeout: FETCH_TIMEOUT_MS,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            const body = Buffer.concat(chunks).toString('utf8')
            reject(new Error(`OpenReview API ${res.statusCode}: ${body.slice(0, 200)}`))
            return
          }
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as { notes: ORNote[] })
        } catch (e) { reject(e) }
      })
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('OpenReview API timed out')) })
    req.on('error', reject)
  })
}

// Fetch up to maxFetch notes, paginating through the API.
// OpenReview v2: parameter is "content.venueid" (not "venueid").
async function fetchNotes(venueId: string, maxFetch: number): Promise<{ notes: ORNote[]; fetchedCount: number }> {
  const PAGE = 200
  const notes: ORNote[] = []
  let offset = 0

  while (notes.length < maxFetch) {
    const take = Math.min(PAGE, maxFetch - notes.length)
    const url = new URL('https://api2.openreview.net/notes')
    url.searchParams.set('content.venueid', venueId)
    url.searchParams.set('limit', String(take))
    url.searchParams.set('offset', String(offset))

    const data = await fetchPage(url)
    const page = data.notes ?? []
    notes.push(...page)

    // Stop if this page was smaller than requested (no more data)
    if (page.length < take) break
    offset += PAGE
  }

  return { notes, fetchedCount: offset + notes.length }
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const conference = (sp.get('conference') ?? 'ICLR').toUpperCase()
  const year = parseInt(sp.get('year') ?? '2024')
  const topicsRaw = sp.get('topics') ?? ''
  // How many to return to the UI
  const maxResults = Math.min(200, parseInt(sp.get('limit') ?? '50'))
  // Single page fetch only (200 notes) — OpenReview can be 10-12s per request;
  // one page gives enough papers to rank and return good results within timeout budget.
  const maxFetch = 200

  const venueId = VENUE_IDS[conference]?.[year]
  if (!venueId) {
    const supported = Object.entries(VENUE_IDS)
      .flatMap(([c, ys]) => Object.keys(ys).map(y => `${c} ${y}`))
      .join(', ')
    return NextResponse.json(
      { error: `No venue ID known for ${conference} ${year}. Supported: ${supported}` },
      { status: 400 }
    )
  }

  const terms = toTerms(topicsRaw)

  try {
    const { notes, fetchedCount } = await fetchNotes(venueId, maxFetch)

    const results = notes
      .map(note => {
        const paper = mapNote(note, conference, year)
        paper.score = scoreNote(note, terms)
        return paper
      })
      .filter(p => terms.length === 0 || p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)

    return NextResponse.json({
      papers: results,
      fetchedFromAPI: fetchedCount,
      matched: results.length,
      venueId,
    })
  } catch (err) {
    const msg = (err as Error).name === 'AbortError'
      ? 'OpenReview API timed out. Please try again in a moment.'
      : (err as Error).message
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
