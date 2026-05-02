import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import https from 'https'

export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const CURRENT_YEAR = new Date().getFullYear()

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PaperInput {
  title:     string
  abstract:  string
  year:      number
  url:       string
  id?:       string
  keywords?: string[]
  venue?:    string    // conference name, e.g. "ICLR", "NeurIPS"
  pdfUrl?:   string    // direct PDF link
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

// ── Venue name extraction ──────────────────────────────────────────────────────
function extractVenueName(venueid: string): string {
  if (!venueid) return ''
  // "ICLR.cc/2024/Conference" → "ICLR"
  // "NeurIPS.cc/2024/Workshop/TSALM" → "NeurIPS Workshop"
  const ccMatch = venueid.match(/^([^.]+)\.cc\/\d+\/(\w+)/)
  if (ccMatch) {
    const conf = ccMatch[1].toUpperCase()
    return venueid.toLowerCase().includes('workshop') ? `${conf} Workshop` : conf
  }
  // "auai.org/UAI/2024/Conference" → "UAI"
  const orgMatch = venueid.match(/\/([A-Z]{2,})\/\d+\//)
  if (orgMatch) return orgMatch[1]
  // "TMLR" plain
  if (/^[A-Z]+$/.test(venueid.trim())) return venueid.trim()
  return venueid.split(/[./]/)[0].toUpperCase()
}

// ── In-memory cache (1 hour TTL) ───────────────────────────────────────────────
const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000
function getCached(key: string) {
  const e = cache.get(key); if (e && Date.now() - e.ts < CACHE_TTL_MS) return e.data; cache.delete(key); return null
}
function setCached(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() })
  if (cache.size > 50) { const o = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]; cache.delete(o[0]) }
}

// ── Semantic re-ranking ────────────────────────────────────────────────────────
async function semanticRank(query: string, papers: PaperInput[], topK = 20): Promise<PaperInput[]> {
  if (papers.length <= topK) return papers
  try {
    const texts = [query, ...papers.map(p => `${p.title}\n${(p.keywords ?? []).join(', ')}\n${p.abstract}`.slice(0, 2000))]
    const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: texts })
    const embs = resp.data.map(d => d.embedding)
    const qEmb = embs[0]
    const cos = (a: number[], b: number[]) => {
      let dot = 0, na = 0, nb = 0
      for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i] }
      return dot / (Math.sqrt(na) * Math.sqrt(nb))
    }
    return papers.map((p, i) => ({ p, s: cos(qEmb, embs[i+1]) })).sort((a, b) => b.s - a.s).slice(0, topK).map(x => x.p)
  } catch {
    return papers.slice(0, topK)
  }
}

// ── OpenReview search ──────────────────────────────────────────────────────────
const OPENREVIEW_HOST = 'api2.openreview.net'
const OPENREVIEW_IP   = '34.120.73.14'

interface ORNoteContent {
  title?:        { value: string }
  abstract?:     { value: string }
  keywords?:     { value: string[] }
  venueid?:      { value: string }
  'venue id'?:   { value: string }
  primary_area?: { value: string }
  pdf?:          { value: string }
}
interface ORNote { id: string; forum: string; content: ORNoteContent }

function openreviewFetch(params: URLSearchParams): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: OPENREVIEW_IP, port: 443,
      path: `/notes/search?${params.toString()}`,
      headers: { 'Host': OPENREVIEW_HOST, 'User-Agent': 'ResearchBlog/1.0', 'Accept': 'application/json' },
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
  const params = new URLSearchParams({ term: query, source: 'forum', limit: String(limit), offset: '0' })
  const text = await openreviewFetch(params)
  const data = JSON.parse(text) as { notes?: ORNote[] }
  const minYear = CURRENT_YEAR - 2
  return (data.notes ?? []).flatMap(note => {
    const c = note.content
    const title    = c.title?.value
    const abstract = c.abstract?.value
    if (!title || !abstract || abstract.length < 50) return []
    const venueStr = c.venueid?.value ?? c['venue id']?.value ?? ''
    if (venueStr.toLowerCase().includes('rejected')) return []
    const yearMatch = venueStr.match(/(\d{4})/)
    const year = yearMatch ? parseInt(yearMatch[1]) : CURRENT_YEAR
    if (year < minYear) return []
    const pdfVal = c.pdf?.value ?? ''
    const pdfUrl = pdfVal.startsWith('/') ? `https://openreview.net${pdfVal}` : (pdfVal || `https://openreview.net/pdf?id=${note.id}`)
    const paper: PaperInput = {
      id:       note.id,
      title,
      abstract,
      year,
      venue:    extractVenueName(venueStr),
      keywords: c.keywords?.value ?? [],
      url:      `https://openreview.net/forum?id=${note.forum || note.id}`,
      pdfUrl,
    }
    return [paper]
  })
}

// ── arXiv search ───────────────────────────────────────────────────────────────
const ARXIV_HOST = 'export.arxiv.org'

async function searchArxiv(query: string, maxResults = 20): Promise<PaperInput[]> {
  const phrase = query.includes(' ') ? `"${query}"` : query
  const params = new URLSearchParams({
    search_query: `ti:${phrase} OR abs:${phrase}`,
    sortBy: 'submittedDate', sortOrder: 'descending',
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
        const text   = Buffer.concat(chunks).toString('utf8')
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
            id:      arxivId,
            title:   titleM[1].replace(/\s+/g, ' ').trim(),
            abstract: absM[1].replace(/\s+/g, ' ').trim(),
            year:    yearM ? parseInt(yearM[1]) : CURRENT_YEAR,
            url:     `https://arxiv.org/abs/${arxivId}`,
            pdfUrl:  `https://arxiv.org/pdf/${arxivId}`,
            venue:   'arXiv',
          })
        }
        resolve(papers)
      })
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('arXiv timed out')) })
    req.on('error', reject)
  })
}

// ── PDF download ───────────────────────────────────────────────────────────────
function downloadPDFBuffer(pdfUrl: string, useDirectIP: boolean): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(pdfUrl)
    // For direct-IP OpenReview requests, use the URL's own hostname in the Host header
    const hostHeader = parsed.hostname
    const opts: https.RequestOptions = useDirectIP
      ? {
          hostname: OPENREVIEW_IP, port: 443,
          path: parsed.pathname + parsed.search,
          headers: { 'Host': hostHeader, 'User-Agent': 'ResearchBlog/1.0', 'Accept': 'application/pdf' },
          rejectUnauthorized: false, servername: '', timeout: 30000,
        }
      : {
          hostname: parsed.hostname, port: 443,
          path: parsed.pathname + parsed.search,
          headers: { 'User-Agent': 'ResearchBlog/1.0', 'Accept': 'application/pdf' },
          timeout: 25000,
        }

    const req = https.get(opts, (res) => {
      if ((res.statusCode ?? 0) >= 400) { reject(new Error(`PDF ${res.statusCode}`)); return }
      // Handle redirects (arXiv redirects PDF requests)
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        downloadPDFBuffer(res.headers.location, false).then(resolve).catch(reject)
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('PDF download timed out')) })
    req.on('error', reject)
  })
}

function findExperimentSection(text: string): string {
  // Clean up PDF artifacts common in ICLR/NeurIPS submissions
  const cleaned = text
    .replace(/\b\d{3}\s+/g, '')         // strip 3-digit margin line numbers
    .replace(/-\n([a-z])/g, '$1')       // reconnect hyphenated words
    .replace(/\n{3,}/g, '\n\n')         // collapse excessive blank lines

  // Strategy 1: Find explicit experiment/results section heading
  const headingRe = /(?:^|\n)\s{0,6}(?:\d+\.?\d*\.?\s+)?(?:EXPERIMENTS?|Experiments?|EVALUATION|Evaluation|RESULTS?|Results?|BENCHMARKS?|Benchmarks?|EMPIRICAL|Empirical|MAIN RESULTS?|Main Results?|PERFORMANCE)\s*(?:\n|$)/gm
  const headingMatch = headingRe.exec(cleaned)
  if (headingMatch) {
    const start = headingMatch.index + headingMatch[0].length
    const nextRe = /(?:^|\n)\s{0,6}\d+\.?\s+[A-Z][a-zA-Z ]{3,}(?:\n|$)/gm
    nextRe.lastIndex = start + 100
    const next = nextRe.exec(cleaned)
    const end = next ? Math.min(next.index, start + 8000) : Math.min(start + 8000, cleaned.length)
    return cleaned.slice(start, end)
  }

  // Strategy 2: Find the densest cluster of 3-4 decimal numbers (benchmark table indicator)
  const decimalRe = /\d+\.\d{3,4}/g
  const positions: number[] = []
  let dm
  while ((dm = decimalRe.exec(cleaned)) !== null) positions.push(dm.index)

  if (positions.length >= 5) {
    const WINDOW = 2000
    let bestStart = positions[0], bestCount = 0
    for (let i = 0; i < positions.length; i++) {
      const limit = positions[i] + WINDOW
      let count = 0
      for (let j = i; j < positions.length && positions[j] < limit; j++) count++
      if (count > bestCount) { bestCount = count; bestStart = positions[i] }
    }
    if (bestCount >= 5) {
      const start = Math.max(0, bestStart - 500)
      return cleaned.slice(start, start + 7000)
    }
  }

  // Strategy 3: Fallback — return from 40% through the document
  const fallbackStart = Math.floor(cleaned.length * 0.4)
  return cleaned.slice(fallbackStart, fallbackStart + 6000)
}

async function getPaperText(paper: PaperInput): Promise<string> {
  if (!paper.pdfUrl) return ''
  try {
    const isOR   = paper.pdfUrl.includes('openreview.net')
    const buffer = await downloadPDFBuffer(paper.pdfUrl, isOR)
    if (buffer.length < 1000) return ''
    const { getDocumentProxy, extractText } = await import('unpdf')
    const pdf    = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    return findExperimentSection(text)
  } catch {
    return ''
  }
}

// ── Benchmark extraction ───────────────────────────────────────────────────────
// Downloads full PDFs for the 2 NEWEST papers (most current benchmarks).
// All remaining papers contribute their abstracts as context.
async function extractBenchmarks(
  papers: PaperInput[],
  topic: string,
  onProgress?: (msg: string) => void,
): Promise<BenchmarkRow[]> {
  if (papers.length === 0) return []

  // Pick papers for PDF download:
  // - First slot: most semantically relevant non-workshop paper (best chance of comparison tables)
  // - Second slot: newest non-workshop paper different from first (for recency)
  const nonWorkshop = papers.filter(p => !p.venue?.toLowerCase().includes('workshop'))
  const candidates = nonWorkshop.length >= 2 ? nonWorkshop : papers
  const first = candidates[0]
  const second = [...candidates].sort((a, b) => b.year - a.year)
    .find(p => (p.id ?? p.url) !== (first?.id ?? first?.url))
  const top2 = [first, second].filter((p): p is PaperInput => p != null)

  onProgress?.(`Downloading papers for experiment data…`)

  const fullTexts = new Map<string, string>()
  await Promise.all(
    top2.map(async (p, i) => {
      onProgress?.(`Downloading paper ${i + 1}/2: "${p.title.slice(0, 55)}…"`)
      const text = await getPaperText(p)
      fullTexts.set(p.id ?? p.url, text)
    })
  )

  const papersText = papers
    .slice(0, 20)
    .map((p, i) => {
      const kwLine  = p.keywords?.length ? `\nKEYWORDS: ${p.keywords.slice(0, 8).join(', ')}` : ''
      const venLine = p.venue ? `\nVENUE: ${p.venue} ${p.year}` : `\nYEAR: ${p.year}`
      const key     = p.id ?? p.url
      const ft      = fullTexts.get(key)
      const body    = ft
        ? `\nEXPERIMENT SECTION (full PDF):\n${ft.slice(0, 5000)}`
        : `\nABSTRACT: ${p.abstract.slice(0, 700)}`
      return `[${i + 1}] ${p.title}${venLine}${kwLine}${body}\nURL: ${p.url}`
    })
    .join('\n\n---\n\n')

  onProgress?.(`Extracting benchmark scores with AI…`)

  const prompt = `You are a research benchmark extractor for the topic "${topic}".

Analyze the paper content below (some papers include their full Experiments section, others only abstracts).

Extract ALL model comparison rows from benchmark tables, including BOTH the proposed model AND all baseline methods compared against it.

For each CONCRETE benchmark result found, extract:
- model: the model/method name (e.g. "iTransformer", "PatchTST", "TimesNet", "LSTM") — include baselines too
- dataset: the benchmark dataset name (e.g. "ETTh1", "ETTm2", "M4", "ImageNet")
- metric: the evaluation metric (e.g. "MSE", "MAE", "BLEU", "F1", "Accuracy", "RMSE")
- score: the exact numeric value (number only)
- score_label: display string (e.g. "0.386", "95.2%")
- higher_better: true if higher is better; false for error metrics (MSE, MAE, RMSE, FDE, ADE)
- paper_index: the [N] number from the source paper

Focus on:
- Tables labeled "Main results", "Comparison with SOTA", "Performance on..." — extract EVERY row
- The proposed model AND ALL baselines it is compared to
- Numeric scores on named standard datasets (ETTh1/ETTh2/ETTm1/ETTm2/Weather/Traffic/Exchange/M4 for time series)
- If a paper compares 5 models on ETTh1 MSE, extract all 5 rows

Papers:
${papersText}

Return ONLY valid JSON:
{"results": [{"model":"...", "dataset":"...", "metric":"...", "score":0.0, "score_label":"...", "higher_better":true, "paper_index":1}]}`

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 8000,
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

// ── Build ranked tables ────────────────────────────────────────────────────────
function buildTables(rows: BenchmarkRow[]): BenchmarkTable[] {
  const map = new Map<string, BenchmarkTable>()
  for (const row of rows) {
    const key = `${row.dataset.toLowerCase()}::${row.metric.toLowerCase()}`
    if (!map.has(key)) map.set(key, { dataset: row.dataset, metric: row.metric, higherBetter: row.higherBetter, rows: [] })
    const t = map.get(key)!
    const dupe = t.rows.find(r => r.model.toLowerCase() === row.model.toLowerCase())
    if (!dupe) t.rows.push(row)
    else if (row.higherBetter ? row.score > dupe.score : row.score < dupe.score) Object.assign(dupe, row)
  }
  for (const t of map.values()) {
    t.rows.sort((a, b) => t.higherBetter ? b.score - a.score : a.score - b.score)
    t.rows = t.rows.slice(0, 12)
  }
  return [...map.values()].filter(t => t.rows.length >= 1).sort((a, b) => b.rows.length - a.rows.length).slice(0, 10)
}

// ── Auth helper ────────────────────────────────────────────────────────────────
async function requireAuth(req: NextRequest) {
  const session = await getServerSession(authOptions)
  return session?.user ? session : null
}

// ── POST — extract from provided papers ───────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!await requireAuth(req)) return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  const body = await req.json() as { papers: PaperInput[]; topic: string }
  if (!body.papers?.length) return NextResponse.json({ error: 'No papers provided' }, { status: 400 })
  try {
    const topic  = body.topic ?? 'research'
    const ranked = await semanticRank(topic, body.papers, 20)
    const rows   = await extractBenchmarks(ranked, topic)
    const tables = buildTables(rows)
    return NextResponse.json({ tables, extracted: rows.length, source: 'provided', papers: ranked.length })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// ── GET — SSE streaming, 3 steps ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!await requireAuth(req)) return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  const sp  = new URL(req.url).searchParams
  const q   = sp.get('q')?.trim() ?? ''
  if (!q)   return NextResponse.json({ error: 'Query required' }, { status: 400 })
  const source = sp.get('source') ?? 'openreview'

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* closed */ }
      }

      try {
        // ── Step 1: search ──────────────────────────────────────────────────────
        send({ step: 1, status: 'searching', source,
          message: source === 'arxiv' ? 'Searching arXiv for recent papers…' : 'Searching OpenReview (last 3 years)…' })

        let candidates: PaperInput[] = []
        if (source === 'arxiv') {
          candidates = await searchArxiv(q, 40)
        } else {
          candidates = await searchOpenReview(q, 100)
        }

        if (candidates.length === 0) {
          send({ step: 1, status: 'no_results', source,
            message: source === 'arxiv'
              ? 'No papers found on arXiv for this query.'
              : 'No papers found on OpenReview. Try searching arXiv instead.' })
          controller.close(); return
        }

        send({ step: 1, status: 'done', source, papers: candidates, count: candidates.length })

        // ── Step 2: semantic re-rank ─────────────────────────────────────────────
        send({ step: 2, status: 'ranking',
          message: `Ranking ${candidates.length} papers by semantic similarity to "${q}"…` })
        const ranked = await semanticRank(q, candidates, 20)
        send({ step: 2, status: 'done', papers: ranked, count: ranked.length,
          message: `Top ${ranked.length} most relevant papers selected` })

        // ── Step 3: download top-2 PDFs + extract benchmarks ─────────────────────
        send({ step: 3, status: 'extracting',
          message: `Downloading 2 newest papers for full experiment data…` })

        const rows = await extractBenchmarks(ranked, q, (msg) => {
          send({ step: 3, status: 'extracting', message: msg })
        })
        const tables = buildTables(rows)
        send({ step: 3, status: 'done', tables, extracted: rows.length, papers: ranked.length })

      } catch (err) {
        send({ status: 'error', message: (err as Error).message })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
    },
  })
}
