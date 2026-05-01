import OpenAI from 'openai'
import pLimit from 'p-limit'
import type { Paper } from '@/types/paper'
import type { SummaryResult } from '@/types/paper'

function buildBaseURL() {
  const url = process.env.OPENAI_BASE_URL
  if (!url) return undefined
  const base = url.endsWith('/v1') || url.endsWith('/v1/') ? url : `${url.replace(/\/$/, '')}/v1`
  console.log('[openai] baseURL:', base)
  return base
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: buildBaseURL(),
})

// gpt-4o-mini: 15× cheaper than gpt-4o, quality difference for structured JSON is minimal
const SUMMARY_MODEL = process.env.OPENAI_SUMMARY_MODEL ?? 'gpt-4o-mini'
const EMBEDDING_MODEL = 'text-embedding-3-small'

const SUMMARIZE_PROMPT = `You are a research assistant helping researchers quickly understand academic papers.

Given a paper's metadata, generate a structured summary with the following sections.
Be concise, precise, and use plain English accessible to researchers outside the subfield.

Paper metadata:
Title: {title}
Authors: {authors}
Venue: {venue} ({year})
Category: {category}

Return a JSON object with exactly these fields:
{
  "tldr": "2-3 sentence plain-English summary of what this paper does and why it matters.",
  "problem": "1-2 sentences describing the specific gap or limitation this paper addresses.",
  "keyIdea": "2-3 sentences explaining the core method or technical contribution.",
  "methodDescription": "3-5 sentences describing the method or architecture in detail: the key components, how they interact, and what makes the design choices non-obvious. Write for a technical reader.",
  "results": "1-2 sentences with the most important quantitative or qualitative results.",
  "contributions": ["Contribution 1", "Contribution 2", "Contribution 3"],
  "tags": ["tag1", "tag2", "tag3"]
}

Be specific. Avoid vague phrases like "a novel approach" or "state-of-the-art".`

export async function summarizePaper(paper: Pick<Paper, 'id' | 'title' | 'authors' | 'venue' | 'year' | 'category'>): Promise<SummaryResult> {
  const prompt = SUMMARIZE_PROMPT
    .replace('{title}', paper.title)
    .replace('{authors}', paper.authors.join(', ') || 'Unknown')
    .replace('{venue}', paper.venue || 'Unknown')
    .replace('{year}', paper.year?.toString() || 'Unknown')
    .replace('{category}', paper.category || 'General')

  const response = await openai.chat.completions.create({
    model: SUMMARY_MODEL,
    messages: [
      { role: 'system', content: 'You are a research paper summarization assistant. Always return valid JSON.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('Empty response from OpenAI')
  return JSON.parse(content) as SummaryResult
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // token safety
  })
  return response.data[0].embedding
}

const limit = pLimit(5)

export async function summarizeBatch(papers: Pick<Paper, 'id' | 'title' | 'authors' | 'venue' | 'year' | 'category'>[]) {
  const tasks = papers.map(paper => limit(() => summarizePaper(paper)))
  return Promise.allSettled(tasks)
}
