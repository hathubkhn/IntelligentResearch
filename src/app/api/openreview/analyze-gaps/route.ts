import { NextRequest } from 'next/server'

export const maxDuration = 300
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { consumeTurn, QuotaExceededError } from '@/lib/usage'
import OpenAI from 'openai'
import type { OpenReviewPaper } from '@/app/api/admin/openreview/route'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MODEL = process.env.OPENAI_SUMMARY_MODEL ?? 'gpt-4o-mini'

function buildPrompt(papers: OpenReviewPaper[], targetDomain?: string): string {
  const paperList = papers
    .map((p, i) =>
      `[${i + 1}] "${p.title}" (${p.venue} ${p.year})
   Authors: ${p.authors.slice(0, 3).join(', ')}${p.authors.length > 3 ? ' et al.' : ''}
   Area: ${p.primaryArea ?? 'N/A'}
   Keywords: ${p.keywords.slice(0, 6).join(', ')}
   Abstract: ${p.abstract.slice(0, 300)}${p.abstract.length > 300 ? '…' : ''}`
    )
    .join('\n\n')

  const domainContext = targetDomain
    ? `The researcher is working in the domain of **${targetDomain}** and wants to understand how these AI methods could transfer to their field.`
    : ''

  return `You are an expert research assistant helping a researcher analyze a curated collection of AI/ML papers.
${domainContext}

Below are ${papers.length} papers from top AI conferences. Analyze them and produce a structured research intelligence report in Markdown.

---

${paperList}

---

Produce a report with exactly these sections:

## Common Methods & Architectures
List the AI/ML techniques that appear across multiple papers. Note frequency and variants.

## Datasets & Benchmarks
List the datasets and benchmarks most commonly used. Note which papers use which.

## Author-Stated Limitations
Extract limitations or future work mentioned (or implied) by the authors. Group by theme.

## Underexplored Directions
Identify important combinations of (method, domain, task) that are notably absent from these papers.

## Research Questions
Generate 4–6 specific, actionable research questions that emerge from the gaps above.

## Possible Paper Titles
Suggest 4 novel paper titles that address identified gaps. Make them specific and compelling.

## Domain Transfer Opportunities
For each major method in these papers, identify one real-world application domain where it could be transferred with minimal adaptation. Explain why the data structure or problem formulation is analogous.

## Recommended Baselines
What baseline models should a researcher proposing work in this area compare against?

Write concisely. Use bold for key terms. Be specific — avoid vague phrases.`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const userId = (session.user as { id: string }).id

  try {
    await consumeTurn(userId)
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return Response.json(
        { error: 'Monthly analysis limit reached', quota: e.info, upgrade: true },
        { status: 429 }
      )
    }
    throw e
  }

  const body = await req.json() as { papers: OpenReviewPaper[]; targetDomain?: string }
  const { papers, targetDomain } = body

  if (!Array.isArray(papers) || papers.length < 2) {
    return Response.json({ error: 'Provide at least 2 papers for gap analysis' }, { status: 400 })
  }

  const prompt = buildPrompt(papers.slice(0, 20), targetDomain) // cap at 20 to control cost

  const stream = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are a research intelligence assistant. Write precise, structured Markdown.' },
      { role: 'user', content: prompt },
    ],
    stream: true,
    temperature: 0.4,
    max_tokens: 2000,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? ''
        if (text) controller.enqueue(encoder.encode(text))
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
