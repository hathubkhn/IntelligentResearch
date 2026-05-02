import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export const maxDuration = 60

// ── Types ──────────────────────────────────────────────────────────────────────
export interface BenchmarkRow {
  model:       string
  score:       number
  scoreLabel:  string   // original string e.g. "0.386" or "85.2%"
  metric:      string
  dataset:     string
  year:        number
  paperTitle:  string
  arxivId:     string | null
  paperUrl:    string
  higherBetter: boolean
}

export interface BenchmarkTable {
  dataset:     string
  metric:      string
  higherBetter: boolean
  rows:        BenchmarkRow[]
}

interface ArxivEntry {
  id:       string
  title:    string
  abstract: string
  year:     number
}

// ── arXiv fetch ────────────────────────────────────────────────────────────────
async function fetchArxivPapers(query: string, maxResults = 25): Promise<ArxivEntry[]> {
  const q = encodeURIComponent(`ti:${query} OR abs:${query}`)
  const url = `https://export.arxiv.org/api/query?search_query=${q}&sortBy=submittedDate&sortOrder=descending&max_results=${maxResults}`

  const res  = await fetch(url, { signal: AbortSignal.timeout(20000) })
  const text = await res.text()

  // Parse Atom XML
  const entries: ArxivEntry[] = []
  const entryMatches = text.matchAll(/<entry>([\s\S]*?)<\/entry>/g)
  for (const m of entryMatches) {
    const block = m[1]
    const idMatch    = block.match(/<id>https?:\/\/arxiv\.org\/abs\/([^<\s]+)<\/id>/)
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)
    const absMatch   = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)
    const yearMatch  = block.match(/<published>(\d{4})/)
    if (!idMatch || !titleMatch || !absMatch) continue
    entries.push({
      id:       idMatch[1].replace(/v\d+$/, ''),
      title:    titleMatch[1].replace(/\s+/g, ' ').trim(),
      abstract: absMatch[1].replace(/\s+/g, ' ').trim(),
      year:     yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear(),
    })
  }
  return entries
}

// ── GPT extraction ─────────────────────────────────────────────────────────────
async function extractBenchmarks(papers: ArxivEntry[], query: string): Promise<BenchmarkRow[]> {
  if (papers.length === 0) return []

  const papersText = papers
    .map((p, i) => `[${i + 1}] TITLE: ${p.title}\nARXIV_ID: ${p.id}\nYEAR: ${p.year}\nABSTRACT: ${p.abstract.slice(0, 600)}`)
    .join('\n\n---\n\n')

  const prompt = `You are a research benchmark extractor. Given paper abstracts about "${query}", extract all benchmark results mentioned.

For EACH paper that reports concrete numeric scores on a benchmark/dataset, extract:
- model: proposed model or method name
- dataset: benchmark dataset name (e.g., "ETTh1", "ImageNet", "SQuAD 1.1")
- metric: evaluation metric (e.g., "MSE", "MAE", "BLEU", "Accuracy", "F1")
- score: exact numeric score (as number)
- score_label: original string (e.g., "0.386", "95.2%", "32.4")
- higher_better: true if higher score = better (false for MSE, MAE, RMSE, etc.)
- paper_index: the [N] index of the paper

Rules:
- Only extract if a concrete number is given
- Prefer final/best results on standard benchmarks
- Do NOT invent or estimate scores
- Return empty array [] if no clear scores found

Papers:
${papersText}

Return ONLY a valid JSON array, no markdown, no explanation:
[{"model":"...", "dataset":"...", "metric":"...", "score":0.0, "score_label":"...", "higher_better":true, "paper_index":1}, ...]`

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 2000,
  })

  let raw = resp.choices[0]?.message?.content ?? '{}'
  // Try to extract array if wrapped in object
  try {
    const parsed = JSON.parse(raw)
    const arr = Array.isArray(parsed)
      ? parsed
      : (parsed.results ?? parsed.benchmarks ?? parsed.data ?? Object.values(parsed)[0] ?? [])

    return (arr as Record<string, unknown>[])
      .filter(r => r.model && r.dataset && r.metric && r.score !== undefined)
      .map(r => {
        const idx = (r.paper_index as number) - 1
        const paper = papers[idx] ?? papers[0]
        return {
          model:        String(r.model),
          score:        Number(r.score),
          scoreLabel:   String(r.score_label ?? r.score),
          metric:       String(r.metric),
          dataset:      String(r.dataset),
          year:         paper?.year ?? new Date().getFullYear(),
          paperTitle:   paper?.title ?? '',
          arxivId:      paper?.id ?? null,
          paperUrl:     paper?.id ? `https://arxiv.org/abs/${paper.id}` : '',
          higherBetter: Boolean(r.higher_better),
        } as BenchmarkRow
      })
  } catch { return [] }
}

// ── Aggregate into tables ───────────────────────────────────────────────────────
function groupIntoTables(rows: BenchmarkRow[]): BenchmarkTable[] {
  const map = new Map<string, BenchmarkTable>()

  for (const row of rows) {
    const key = `${row.dataset}::${row.metric}`
    if (!map.has(key)) {
      map.set(key, {
        dataset:      row.dataset,
        metric:       row.metric,
        higherBetter: row.higherBetter,
        rows:         [],
      })
    }
    const table = map.get(key)!
    // Avoid duplicate models — keep best score
    const existing = table.rows.find(r => r.model.toLowerCase() === row.model.toLowerCase())
    if (!existing) {
      table.rows.push(row)
    } else if (row.higherBetter ? row.score > existing.score : row.score < existing.score) {
      Object.assign(existing, row)
    }
  }

  // Sort rows within each table
  for (const table of map.values()) {
    table.rows.sort((a, b) =>
      table.higherBetter ? b.score - a.score : a.score - b.score
    )
    // Keep top 10 per table
    table.rows = table.rows.slice(0, 10)
  }

  // Only return tables with >= 2 entries and sort by row count
  return [...map.values()]
    .filter(t => t.rows.length >= 2)
    .sort((a, b) => b.rows.length - a.rows.length)
    .slice(0, 8) // max 8 tables
}

// ── Route ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const query = new URL(req.url).searchParams.get('q') ?? ''
  if (!query.trim()) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  try {
    // 1. Fetch papers from arXiv
    const papers = await fetchArxivPapers(query.trim(), 25)
    if (papers.length === 0) {
      return NextResponse.json({ tables: [], papers: 0, message: 'No papers found on arXiv' })
    }

    // 2. Extract benchmark rows via GPT
    const rows = await extractBenchmarks(papers, query.trim())

    // 3. Group into tables
    const tables = groupIntoTables(rows)

    return NextResponse.json({
      tables,
      papers: papers.length,
      extracted: rows.length,
      query: query.trim(),
    })
  } catch (err) {
    console.error('Leaderboard error:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
