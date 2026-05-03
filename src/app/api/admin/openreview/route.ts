import { NextRequest, NextResponse } from 'next/server'
import https from 'https'
import OpenAI from 'openai'

export const maxDuration = 60 // seconds — OpenReview API can be slow (10-15s per page)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// OpenReview v2: use content.venueid to get accepted papers only.
// Papers assigned a venue ID by the PCs are accepted; rejected papers are not tagged.
export const VENUE_IDS: Record<string, Partial<Record<number, string>>> = {
  // ── ML / AI ──────────────────────────────────────────────────────────────────
  ICLR:    {
    2020: 'ICLR.cc/2020/Conference',
    2021: 'ICLR.cc/2021/Conference',
    2022: 'ICLR.cc/2022/Conference',
    2023: 'ICLR.cc/2023/Conference',
    2024: 'ICLR.cc/2024/Conference',
    2025: 'ICLR.cc/2025/Conference',
  },
  NeurIPS: {
    2021: 'NeurIPS.cc/2021/Conference',
    2022: 'NeurIPS.cc/2022/Conference',
    2023: 'NeurIPS.cc/2023/Conference',
    2024: 'NeurIPS.cc/2024/Conference',
  },
  ICML:    {
    2022: 'ICML.cc/2022/Conference',
    2023: 'ICML.cc/2023/Conference',
    2024: 'ICML.cc/2024/Conference',
    2025: 'ICML.cc/2025/Conference',
  },
  AISTATS: {
    2024: 'AISTATS.cc/2024/Conference',
    2025: 'AISTATS.cc/2025/Conference',
  },
  UAI: {
    2023: 'auai.org/UAI/2023/Conference',
    2024: 'auai.org/UAI/2024/Conference',
  },
  // ── NLP ──────────────────────────────────────────────────────────────────────
  ACL: {
    2023: 'aclweb.org/ACL/2023/Conference',
    2024: 'aclweb.org/ACL/2024/Conference',
  },
  EMNLP: {
    2023: 'aclweb.org/EMNLP/2023/Conference',
    2024: 'aclweb.org/EMNLP/2024/Conference',
  },
  NAACL: {
    2024: 'aclweb.org/NAACL/2024/Conference',
  },
  EACL: {
    2024: 'aclweb.org/EACL/2024/Conference',
  },
  // ── Specialized ──────────────────────────────────────────────────────────────
  COLM: {
    2024: 'COLM.cc/2024/Conference',
    2025: 'COLM.cc/2025/Conference',
  },
  TMLR: {
    2022: 'TMLR',
    2023: 'TMLR',
    2024: 'TMLR',
    2025: 'TMLR',
  },
  CoRL: {
    2023: 'robot-learning.org/CoRL/2023/Conference',
    2024: 'robot-learning.org/CoRL/2024/Conference',
  },
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

function toTerms(raw: string): string[] {
  // Split on comma/semicolon to get phrases only.
  // Phrases are matched as whole substrings — do NOT further split into single words
  // to avoid false positives (e.g. "time" matching unrelated papers).
  return raw.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(t => t.length >= 3)
}

function matchesGroup(note: ORNote, terms: string[]): boolean {
  if (terms.length === 0) return true
  const title    = (note.content.title?.value ?? '').toLowerCase()
  const abstract = (note.content.abstract?.value ?? '').toLowerCase()
  const kws      = (note.content.keywords?.value ?? []).map(k => k.toLowerCase())
  const primary  = (note.content.primary_area?.value ?? note.content['primary area']?.value ?? '').toLowerCase()
  return terms.some(t =>
    title.includes(t) || primary.includes(t) || kws.some(k => k.includes(t)) || abstract.includes(t)
  )
}

function scoreGroup(note: ORNote, terms: string[]): number {
  if (terms.length === 0) return 0
  const title    = (note.content.title?.value ?? '').toLowerCase()
  const abstract = (note.content.abstract?.value ?? '').toLowerCase()
  const kws      = (note.content.keywords?.value ?? []).map(k => k.toLowerCase())
  const primary  = (note.content.primary_area?.value ?? note.content['primary area']?.value ?? '').toLowerCase()
  let score = 0
  for (const t of terms) {
    if (t.length < 3) continue
    if (title.includes(t))               score += 4
    if (primary.includes(t))             score += 3
    if (kws.some(k => k.includes(t)))    score += 2
    if (abstract.includes(t))            score += 1
  }
  return score
}

interface TermGroups {
  methods: string[]   // AI Method filter (REQUIRED if non-empty)
  domains: string[]   // Application Domain filter (REQUIRED if non-empty)
  tasks:   string[]   // Research Task filter (REQUIRED if non-empty)
  custom:  string[]   // Additional keywords (REQUIRED if non-empty)
  all:     string[]   // Legacy flat topics string (fallback)
}

function filterAndScore(note: ORNote, groups: TermGroups): number | null {
  // Legacy mode: single flat topics string (history re-runs)
  const hasSeparatedGroups =
    groups.methods.length > 0 || groups.domains.length > 0 ||
    groups.tasks.length > 0   || groups.custom.length > 0

  if (!hasSeparatedGroups) {
    if (groups.all.length === 0) return 1
    const s = scoreGroup(note, groups.all)
    return s > 0 ? s : null
  }

  // Strict AND across ALL non-empty groups — a paper must match every provided group.
  // Within each group, OR logic applies (any term in the group is enough).
  if (groups.methods.length > 0 && !matchesGroup(note, groups.methods)) return null
  if (groups.domains.length > 0 && !matchesGroup(note, groups.domains)) return null
  if (groups.tasks.length   > 0 && !matchesGroup(note, groups.tasks))   return null
  if (groups.custom.length  > 0 && !matchesGroup(note, groups.custom))  return null

  // Weighted score: methods + custom highest (user's explicit intent), then domains/tasks
  const score =
    scoreGroup(note, groups.methods) * 2.0 +
    scoreGroup(note, groups.custom)  * 1.5 +
    scoreGroup(note, groups.tasks)   * 1.2 +
    scoreGroup(note, groups.domains) * 1.0

  return score > 0 ? score : 1 // always positive since at least one group matched
}

export function mapNote(note: ORNote, conference: string, year: number): OpenReviewPaper {
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

// ── Semantic re-ranking ────────────────────────────────────────────────────────
// After keyword filtering, re-rank remaining candidates by embedding cosine similarity.
// Single batched API call: 1 query + N papers.
async function semanticRerank<T extends { title: string; abstract: string; keywords: string[] }>(
  query: string,
  papers: T[],
): Promise<T[]> {
  if (papers.length <= 1) return papers
  try {
    const texts = [
      query,
      ...papers.map(p => `${p.title}\n${p.keywords.slice(0, 6).join(', ')}\n${p.abstract}`.slice(0, 2000)),
    ]
    const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: texts })
    const embs = resp.data.map(d => d.embedding)
    const qEmb = embs[0]
    function cos(a: number[], b: number[]) {
      let dot = 0, na = 0, nb = 0
      for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
      return dot / (Math.sqrt(na) * Math.sqrt(nb))
    }
    return papers
      .map((p, i) => ({ p, score: cos(qEmb, embs[i + 1]) }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.p)
  } catch {
    return papers // fall back to keyword-scored order on any error
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
export async function fetchNotes(venueId: string, maxFetch: number): Promise<{ notes: ORNote[]; fetchedCount: number }> {
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

  // Separated filter groups (new) — fall back to legacy `topics` if not provided
  const methodsRaw = sp.get('methods') ?? ''
  const domainsRaw = sp.get('domains') ?? ''
  const tasksRaw   = sp.get('tasks')   ?? ''
  const customRaw  = sp.get('custom')  ?? ''
  const topicsRaw  = sp.get('topics')  ?? '' // legacy fallback

  const maxResults = Math.min(200, parseInt(sp.get('limit') ?? '50'))
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

  // Build term groups
  const groups: TermGroups = {
    methods: toTerms(methodsRaw),
    domains: toTerms(domainsRaw),
    tasks:   toTerms(tasksRaw),
    custom:  toTerms(customRaw),
    all:     toTerms(topicsRaw),
  }

  const hasAnyTerms = groups.methods.length > 0 || groups.domains.length > 0 ||
    groups.tasks.length > 0 || groups.custom.length > 0 || groups.all.length > 0

  try {
    const { notes, fetchedCount } = await fetchNotes(venueId, maxFetch)

    const results: Array<OpenReviewPaper & { score: number }> = []
    for (const note of notes) {
      const score = filterAndScore(note, groups)
      if (!hasAnyTerms || score !== null) {
        const paper = mapNote(note, conference, year)
        paper.score = score ?? 1
        results.push(paper)
      }
    }

    results.sort((a, b) => b.score - a.score)

    // Semantic re-rank: use embeddings to reorder by meaning, not just keyword hits.
    // Build a single query string from all provided filter groups.
    const queryText = [methodsRaw, domainsRaw, tasksRaw, customRaw, topicsRaw].filter(Boolean).join(' ')
    const pool = results.slice(0, Math.min(100, results.length)) // re-rank top-100 candidates
    const reranked = hasAnyTerms && queryText.trim()
      ? await semanticRerank(queryText, pool)
      : pool

    return NextResponse.json({
      papers: reranked.slice(0, maxResults),
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
