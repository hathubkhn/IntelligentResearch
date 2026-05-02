import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import https from 'https'

export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const SS_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY ?? ''
const CURRENT_YEAR = new Date().getFullYear()

// ── In-memory cache (1 hour TTL) ───────────────────────────────────────────────
const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000

function getCached(key: string) {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data
  cache.delete(key)
  return null
}
function setCached(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() })
  if (cache.size > 50) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]
    cache.delete(oldest[0])
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PaperInput {
  title:    string
  abstract: string
  year:     number
  url:      string
  id?:      string
  keywords?: string[]
}

export interface BenchmarkRow {
  model:        string
  score:        number
  scoreLabel:   string
  metric:       string
  dataset:      string
  year:         number
  paperTitle:   string
  paperUrl:     string
  higherBetter: boolean
}

export interface BenchmarkTable {
  dataset:      string
  metric:       string
  higherBetter: boolean
  rows:         BenchmarkRow[]
}

// ── Semantic re-ranking (query + paper embeddings → cosine similarity) ────────
// Runs in a single batched OpenAI embedding call. Very cheap (~$0.0002 per search).
async function semanticRank(query: string, papers: PaperInput[], topK = 20): Promise<PaperInput[]> {
  if (papers.length <= topK) return papers
  try {
    const texts = [
      query,
      ...papers.map(p => `${p.title}\n${(p.keywords ?? []).join(', ')}\n${p.abstract}`.slice(0, 2000)),
    ]
    const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: texts })
    const embs = resp.data.map(d => d.embedding)
    const qEmb = embs[0]

    function cos(a: number[], b: number[]) {
      let dot = 0, na = 0, nb = 0
      for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i] }
      return dot / (Math.sqrt(na) * Math.sqrt(nb))
    }

    return papers
      .map((p, i) => ({ p, score: cos(qEmb, embs[i + 1]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(x => x.p)
  } catch (err) {
    console.warn('[Leaderboard] Semantic re-rank failed, using original order:', (err as Error).message)
    return papers.slice(0, topK)
  }
}

// ── OpenReview search (PRIMARY source) ────────────────────────────────────────
// Stage 1: broad full-text fetch (term=) — casts a wide net of candidates.
// Stage 2: semantic re-ranking (embeddings) — keeps top-K by meaning, not keywords.
const OPENREVIEW_HOST = 'api2.openreview.net'
const OPENREVIEW_IP   = '34.120.73.14'

interface ORNoteContent {
  title?:        { value: string }
  abstract?:     { value: string }
  keywords?:     { value: string[] }
  venueid?:      { value: string }
  'venue id'?:   { value: string }
  primary_area?: { value: string }
}
interface ORNote { id: string; forum: string; content: ORNoteContent }

function openreviewFetch(params: URLSearchParams): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: OPENREVIEW_IP, port: 443,
      path: `/notes/search?${params.toString()}`,  // /notes/search supports term= free-text search
      headers: {
        'Host': OPENREVIEW_HOST,
        'User-Agent': 'ResearchBlog/1.0',
        'Accept': 'application/json',
      },
      rejectUnauthorized: false, servername: '', timeout: 25000,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('OpenReview timed out')) })
    req.on('error', reject)
  })
}

async function searchOpenReview(query: string, limit = 100): Promise<PaperInput[]> {
  const params = new URLSearchParams({
    term: query,
    source: 'forum',   // forum = top-level paper submissions, not reviews/replies
    limit: String(limit),
    offset: '0',
  })
  const text = await openreviewFetch(params)
  const data = JSON.parse(text) as { notes?: ORNote[] }
  const notes = data.notes ?? []

  const minYear = CURRENT_YEAR - 2   // last 3 years

  return notes
    .map(note => {
      const c = note.content
      const title    = c.title?.value
      const abstract = c.abstract?.value
      if (!title || !abstract || abstract.length < 50) return null

      // Extract year from venueid (e.g. "ICLR.cc/2024/Conference" → 2024)
      const venueStr = c.venueid?.value ?? c['venue id']?.value ?? ''

      // Skip rejected submissions
      if (venueStr.toLowerCase().includes('rejected')) return null

      const yearMatch = venueStr.match(/(\d{4})/)
      const year = yearMatch ? parseInt(yearMatch[1]) : CURRENT_YEAR

      if (year < minYear) return null // skip older than 3 years

      return {
        id:       note.id,
        title,
        abstract,
        year,
        keywords: c.keywords?.value ?? [],
        url:      `https://openreview.net/forum?id=${note.forum || note.id}`,
      } satisfies PaperInput
    })
    .filter((p): p is PaperInput => p !== null)
}

// ── Semantic Scholar search (secondary, only with API key) ─────────────────────
async function searchSemanticScholar(query: string, limit = 20): Promise<PaperInput[]> {
  const params = new URLSearchParams({
    query,
    fields: 'title,abstract,year,citationCount,externalIds',
    limit: String(limit),
  })
  const res = await fetch(
    `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
    {
      headers: { 'User-Agent': 'ResearchBlog/1.0', 'Accept': 'application/json', 'x-api-key': SS_KEY },
      signal: AbortSignal.timeout(15000),
    }
  )
  if (!res.ok) throw new Error(`Semantic Scholar ${res.status}: ${(await res.text()).slice(0, 120)}`)
  const data = await res.json() as { data?: Record<string, unknown>[] }
  return (data.data ?? [])
    .filter(p => p.abstract)
    .map(p => ({
      title:    String(p.title ?? ''),
      abstract: String(p.abstract ?? ''),
      year:     Number(p.year ?? CURRENT_YEAR),
      url:      p.externalIds && (p.externalIds as Record<string, string>).ArXiv
        ? `https://arxiv.org/abs/${(p.externalIds as Record<string, string>).ArXiv}`
        : `https://www.semanticscholar.org/paper/${p.paperId}`,
      id:       String(p.paperId ?? ''),
    }))
}

// ── arXiv search (normal HTTPS — direct IP breaks Fastly CDN) ────────────────
const ARXIV_HOST = 'export.arxiv.org'
async function searchArxiv(query: string, maxResults = 20): Promise<PaperInput[]> {
  // Wrap multi-word query in quotes for exact phrase matching
  const phrase = query.includes(' ') ? `"${query}"` : query
  const searchQuery = `ti:${phrase} OR abs:${phrase}`
  const params = new URLSearchParams({
    search_query: searchQuery,
    sortBy: 'submittedDate',
    sortOrder: 'descending',
    max_results: String(maxResults),
  })

  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: ARXIV_HOST, port: 443,
      path: `/api/query?${params.toString()}`,
      headers: { 'User-Agent': 'ResearchBlog/1.0', 'Accept': 'text/xml' },
      timeout: 20000,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        const papers: PaperInput[] = []
        for (const m of text.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
          const block = m[1]
          const idM    = block.match(/<id>https?:\/\/arxiv\.org\/abs\/([^<\s]+)<\/id>/)
          const titleM = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)
          const absM   = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)
          const yearM  = block.match(/<published>(\d{4})/)
          if (!idM || !titleM || !absM) return
          const arxivId = idM[1].replace(/v\d+$/, '')
          papers.push({
            id:       arxivId,
            title:    titleM[1].replace(/\s+/g, ' ').trim(),
            abstract: absM[1].replace(/\s+/g, ' ').trim(),
            year:     yearM ? parseInt(yearM[1]) : CURRENT_YEAR,
            url:      `https://arxiv.org/abs/${arxivId}`,
          })
        }
        resolve(papers)
      })
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('arXiv timed out')) })
    req.on('error', reject)
  })
}

// ── GPT benchmark extraction ───────────────────────────────────────────────────
async function extractBenchmarks(papers: PaperInput[], topic: string): Promise<BenchmarkRow[]> {
  if (papers.length === 0) return []

  const papersText = papers
    .slice(0, 20)
    .map((p, i) => {
      const kwLine = p.keywords?.length ? `\nKEYWORDS: ${p.keywords.slice(0, 8).join(', ')}` : ''
      return `[${i + 1}] ${p.title} (${p.year})\nURL: ${p.url}${kwLine}\nABSTRACT: ${p.abstract.slice(0, 700)}`
    })
    .join('\n\n---\n\n')

  const prompt = `You are a research benchmark extractor specializing in "${topic}".

Given these paper abstracts (and keywords when available), extract ALL concrete benchmark results.

For each result extract:
- model: proposed model/method name (e.g., "iTransformer", "PatchTST", "GPT-4")
- dataset: benchmark dataset name (e.g., "ETTh1", "ETTm2", "M4", "ImageNet")
- metric: evaluation metric (e.g., "MSE", "MAE", "BLEU", "F1", "Accuracy")
- score: exact numeric value (number only)
- score_label: display string (e.g., "0.386", "95.2%")
- higher_better: true if higher = better (false for error metrics: MSE, MAE, RMSE, FDE)
- paper_index: the [N] number of the source paper

Rules:
- Only extract when a concrete number is stated on a named dataset
- A paper may contribute MULTIPLE rows (different datasets or metrics)
- Ignore vague comparisons — must have an actual number

Papers:
${papersText}

Return ONLY valid JSON: {"results": [{"model":"...", "dataset":"...", "metric":"...", "score":0.0, "score_label":"...", "higher_better":true, "paper_index":1}]}`

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 3000,
  })

  try {
    const parsed = JSON.parse(resp.choices[0]?.message?.content ?? '{}')
    const arr: Record<string, unknown>[] = parsed.results ?? parsed.benchmarks ?? []
    return arr
      .filter(r => r.model && r.dataset && r.metric && r.score !== undefined)
      .map(r => {
        const idx = Math.max(0, (r.paper_index as number) - 1)
        const paper = papers[idx] ?? papers[0]
        return {
          model:        String(r.model).trim(),
          score:        Number(r.score),
          scoreLabel:   String(r.score_label ?? r.score),
          metric:       String(r.metric).trim(),
          dataset:      String(r.dataset).trim(),
          year:         paper?.year ?? CURRENT_YEAR,
          paperTitle:   paper?.title ?? '',
          paperUrl:     paper?.url ?? '',
          higherBetter: Boolean(r.higher_better),
        } as BenchmarkRow
      })
  } catch { return [] }
}

// ── Aggregate into ranked tables ───────────────────────────────────────────────
function buildTables(rows: BenchmarkRow[]): BenchmarkTable[] {
  const map = new Map<string, BenchmarkTable>()
  for (const row of rows) {
    const key = `${row.dataset.toLowerCase()}::${row.metric.toLowerCase()}`
    if (!map.has(key)) map.set(key, { dataset: row.dataset, metric: row.metric, higherBetter: row.higherBetter, rows: [] })
    const table = map.get(key)!
    const dupe = table.rows.find(r => r.model.toLowerCase() === row.model.toLowerCase())
    if (!dupe) table.rows.push(row)
    else if (row.higherBetter ? row.score > dupe.score : row.score < dupe.score) Object.assign(dupe, row)
  }
  for (const t of map.values()) {
    t.rows.sort((a, b) => t.higherBetter ? b.score - a.score : a.score - b.score)
    t.rows = t.rows.slice(0, 12)
  }
  return [...map.values()].filter(t => t.rows.length >= 2).sort((a, b) => b.rows.length - a.rows.length).slice(0, 8)
}

// ── Auth helper ────────────────────────────────────────────────────────────────
async function requireAuth(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return session
}

// ── POST — extract from provided papers (from current discover search results) ──
export async function POST(req: NextRequest) {
  if (!await requireAuth(req)) return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  const body = await req.json() as { papers: PaperInput[]; topic: string }
  if (!body.papers?.length) return NextResponse.json({ error: 'No papers provided' }, { status: 400 })
  try {
    // Semantic re-rank provided papers by topic before extraction
    const topic = body.topic ?? 'research'
    const ranked = await semanticRank(topic, body.papers, 20)
    const rows   = await extractBenchmarks(ranked, topic)
    const tables = buildTables(rows)
    return NextResponse.json({ tables, extracted: rows.length, source: 'provided', papers: ranked.length })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// ── GET — pipeline: OpenReview (last 3 yrs) → Semantic Scholar → arXiv ─────────
export async function GET(req: NextRequest) {
  if (!await requireAuth(req)) return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  const cacheKey = `leaderboard:${q.toLowerCase()}`
  const cached = getCached(cacheKey)
  if (cached) return NextResponse.json({ ...(cached as object), cached: true })

  let papers: PaperInput[] = []
  let source = 'openreview'

  // 1. OpenReview (primary): full-text search, latest 3 years, rich structured data
  try {
    const candidates = await searchOpenReview(q, 100)
    // Semantic re-rank: use embeddings to keep papers most relevant to the query by meaning
    papers = await semanticRank(q, candidates, 20)
    console.log(`[Leaderboard] OpenReview: ${candidates.length} candidates → ${papers.length} after semantic re-rank`)
  } catch (err) {
    console.warn('[Leaderboard] OpenReview failed:', (err as Error).message)
  }

  // 2. Semantic Scholar (secondary, only with API key)
  if (papers.length < 5 && SS_KEY) {
    try {
      const ssCandidates = await searchSemanticScholar(q, 40)
      const ssRanked = await semanticRank(q, ssCandidates, 15)
      papers = [...papers, ...ssRanked]
      source = papers.length > 0 ? 'openreview+semantic_scholar' : 'semantic_scholar'
      console.log(`[Leaderboard] +Semantic Scholar: ${ssRanked.length} papers after re-rank`)
    } catch (err) {
      console.warn('[Leaderboard] Semantic Scholar failed:', (err as Error).message)
    }
  }

  // 3. arXiv fallback (last resort)
  if (papers.length < 5) {
    source = 'arxiv'
    try {
      const axCandidates = await searchArxiv(q, 40)
      const axRanked = await semanticRank(q, axCandidates, 15)
      papers = [...papers, ...axRanked]
      console.log(`[Leaderboard] +arXiv: ${axRanked.length} papers after re-rank`)
    } catch (err) {
      if (papers.length === 0) {
        return NextResponse.json({ error: `All sources failed: ${(err as Error).message}` }, { status: 502 })
      }
    }
  }

  if (papers.length === 0) {
    return NextResponse.json({ tables: [], extracted: 0, papers: 0, source, message: 'No papers found' })
  }

  const rows   = await extractBenchmarks(papers, q)
  const tables = buildTables(rows)
  const result = { tables, extracted: rows.length, papers: papers.length, source, query: q }
  setCached(cacheKey, result)
  return NextResponse.json(result)
}
