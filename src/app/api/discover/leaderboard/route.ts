import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import https from 'https'

export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const SS_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY ?? ''

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

// ── Semantic Scholar search (only used when API key is set) ────────────────────
async function searchSemanticScholar(query: string, limit = 20): Promise<PaperInput[]> {
  const params = new URLSearchParams({
    query,
    fields: 'title,abstract,year,citationCount,externalIds',
    limit: String(limit),
  })
  const headers: Record<string, string> = {
    'User-Agent': 'ResearchBlog/1.0',
    'Accept': 'application/json',
    'x-api-key': SS_KEY,
  }
  const res = await fetch(
    `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
    { headers, signal: AbortSignal.timeout(15000) }
  )
  if (!res.ok) throw new Error(`Semantic Scholar ${res.status}: ${(await res.text()).slice(0, 120)}`)
  const data = await res.json() as { data?: Record<string, unknown>[] }
  return (data.data ?? [])
    .filter(p => p.abstract)
    .map(p => ({
      title:    String(p.title ?? ''),
      abstract: String(p.abstract ?? ''),
      year:     Number(p.year ?? new Date().getFullYear()),
      url:      p.externalIds && (p.externalIds as Record<string, string>).ArXiv
        ? `https://arxiv.org/abs/${(p.externalIds as Record<string, string>).ArXiv}`
        : `https://www.semanticscholar.org/paper/${p.paperId}`,
      id:       String(p.paperId ?? ''),
    }))
}

// ── arXiv search (direct IP, bypasses ISP SNI blocking) ───────────────────────
const ARXIV_HOST = 'export.arxiv.org'
const ARXIV_IP   = '199.232.115.42'

function arxivFetch(urlObj: URL): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: ARXIV_IP, port: 443,
      path: `${urlObj.pathname}?${urlObj.searchParams.toString()}`,
      headers: { 'Host': ARXIV_HOST, 'User-Agent': 'ResearchBlog/1.0', 'Accept': 'text/xml' },
      rejectUnauthorized: false, servername: '', timeout: 30000,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('arXiv timed out')) })
    req.on('error', reject)
  })
}

async function searchArxiv(query: string, maxResults = 20): Promise<PaperInput[]> {
  const urlObj = new URL(`https://${ARXIV_HOST}/api/query`)
  urlObj.searchParams.set('search_query', `ti:${query} OR abs:${query}`)
  urlObj.searchParams.set('sortBy', 'submittedDate')
  urlObj.searchParams.set('sortOrder', 'descending')
  urlObj.searchParams.set('max_results', String(maxResults))

  const text = await arxivFetch(urlObj)
  const papers: PaperInput[] = []
  for (const m of text.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const block = m[1]
    const idM    = block.match(/<id>https?:\/\/arxiv\.org\/abs\/([^<\s]+)<\/id>/)
    const titleM = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)
    const absM   = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)
    const yearM  = block.match(/<published>(\d{4})/)
    if (!idM || !titleM || !absM) continue
    const arxivId = idM[1].replace(/v\d+$/, '')
    papers.push({
      id:       arxivId,
      title:    titleM[1].replace(/\s+/g, ' ').trim(),
      abstract: absM[1].replace(/\s+/g, ' ').trim(),
      year:     yearM ? parseInt(yearM[1]) : new Date().getFullYear(),
      url:      `https://arxiv.org/abs/${arxivId}`,
    })
  }
  return papers
}

// ── GPT benchmark extraction ───────────────────────────────────────────────────
async function extractBenchmarks(papers: PaperInput[], topic: string): Promise<BenchmarkRow[]> {
  if (papers.length === 0) return []

  const papersText = papers
    .slice(0, 20)
    .map((p, i) =>
      `[${i + 1}] ${p.title} (${p.year})\nURL: ${p.url}\nABSTRACT: ${p.abstract.slice(0, 700)}`
    )
    .join('\n\n---\n\n')

  const prompt = `You are a research benchmark extractor specializing in "${topic}".

Given these paper abstracts, extract ALL concrete benchmark results reported.

For each result extract:
- model: proposed model/method name (e.g., "iTransformer", "PatchTST", "GPT-4")
- dataset: benchmark dataset name (e.g., "ETTh1", "ETTm2", "M4", "ImageNet")
- metric: evaluation metric (e.g., "MSE", "MAE", "BLEU", "F1", "Accuracy", "RMSE")
- score: exact numeric value (number only)
- score_label: display string (e.g., "0.386", "95.2%", "32.4")
- higher_better: true if higher = better (false for error metrics: MSE, MAE, RMSE, FDE)
- paper_index: the [N] number of the source paper

Rules:
- Only extract when a concrete number is given on a named dataset
- A paper may contribute MULTIPLE rows (different datasets or metrics)
- Ignore vague statements like "our method achieves better performance"

Papers:
${papersText}

Return ONLY valid JSON with key "results":
{"results": [{"model":"...", "dataset":"...", "metric":"...", "score":0.0, "score_label":"...", "higher_better":true, "paper_index":1}]}`

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
          year:         paper?.year ?? new Date().getFullYear(),
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

// ── POST — extract from provided papers (OpenReview search results) ────────────
export async function POST(req: NextRequest) {
  if (!await requireAuth(req)) return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  const body = await req.json() as { papers: PaperInput[]; topic: string }
  if (!body.papers?.length) return NextResponse.json({ error: 'No papers provided' }, { status: 400 })
  try {
    const rows   = await extractBenchmarks(body.papers, body.topic ?? 'research')
    const tables = buildTables(rows)
    return NextResponse.json({ tables, extracted: rows.length, source: 'provided', papers: body.papers.length })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// ── GET — search query → Semantic Scholar (with key) or arXiv → extract ────────
export async function GET(req: NextRequest) {
  if (!await requireAuth(req)) return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ error: 'Query required' }, { status: 400 })

  // Return cached result if available
  const cacheKey = `leaderboard:${q.toLowerCase()}`
  const cached = getCached(cacheKey)
  if (cached) return NextResponse.json({ ...(cached as object), cached: true })

  let papers: PaperInput[] = []
  let source = 'arxiv'

  // Use Semantic Scholar only when API key is configured (avoids 429 rate limits)
  if (SS_KEY) {
    try {
      papers = await searchSemanticScholar(q, 20)
      source = 'semantic_scholar'
    } catch (err) {
      console.warn('Semantic Scholar failed:', (err as Error).message)
    }
  }

  // arXiv as primary (no key) or fallback
  if (papers.length === 0) {
    source = 'arxiv'
    try {
      papers = await searchArxiv(q, 20)
    } catch (err) {
      return NextResponse.json({ error: `arXiv search failed: ${(err as Error).message}` }, { status: 502 })
    }
  }

  if (papers.length === 0) {
    return NextResponse.json({ tables: [], extracted: 0, papers: 0, source, message: 'No papers found on arXiv or Semantic Scholar' })
  }

  const rows   = await extractBenchmarks(papers, q)
  const tables = buildTables(rows)
  const result = { tables, extracted: rows.length, papers: papers.length, source, query: q }
  setCached(cacheKey, result)
  return NextResponse.json(result)
}
