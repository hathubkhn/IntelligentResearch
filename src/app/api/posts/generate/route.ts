import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

export const maxDuration = 60
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: (() => {
    const url = process.env.OPENAI_BASE_URL
    if (!url) return undefined
    return url.endsWith('/v1') || url.endsWith('/v1/') ? url : `${url.replace(/\/$/, '')}/v1`
  })(),
})

const BLOG_MODEL = process.env.OPENAI_SUMMARY_MODEL ?? 'gpt-4o-mini'

const SYSTEM_PROMPT = `You are an expert technical blog writer specializing in AI, machine learning, and computer science research.
Write posts that are insightful, opinionated, well-structured, and accessible to a technical audience.
Always return valid JSON only — no markdown fences, no extra text outside JSON.`

const JSON_SCHEMA = `{
  "title": "string — compelling, specific title (not generic clickbait)",
  "slug": "string — lowercase, hyphen-separated, URL-safe, derived from title",
  "excerpt": "string — 2-3 sentences under 220 characters, suitable for blog listing preview",
  "content": "string — full markdown blog post (900-1500 words). Structure: engaging intro, 3-4 ## sections with analysis and depth, practical takeaways, brief conclusion. Use bullet lists and code blocks where appropriate.",
  "tags": ["string"] — 3-5 lowercase tags (single words or short phrases like 'machine-learning', 'llm', 'rag'),
  "readingTime": number — estimated reading time in minutes
}`

async function fetchUrlContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-blog-bot/1.0)' },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`)
  const html = await res.text()

  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Keep first 9000 chars to fit model context comfortably
  return text.slice(0, 9000)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { input?: string; inputType?: 'url' | 'topic' }
  const { input, inputType } = body

  if (!input?.trim()) {
    return Response.json({ error: 'Input is required' }, { status: 400 })
  }
  if (inputType !== 'url' && inputType !== 'topic') {
    return Response.json({ error: 'inputType must be "url" or "topic"' }, { status: 400 })
  }

  let userPrompt: string

  if (inputType === 'url') {
    let urlContent: string
    try {
      urlContent = await fetchUrlContent(input)
    } catch (err) {
      return Response.json({ error: `Could not fetch URL: ${(err as Error).message}` }, { status: 422 })
    }

    userPrompt = `Write an original, insightful blog post inspired by the following reference content from: ${input}

<reference>
${urlContent}
</reference>

The post should:
- Synthesize the key ideas and explain why they matter
- Add your own analysis and perspective — do not just summarize
- Highlight implications for practitioners
- Be written for an AI/ML research audience

Return ONLY valid JSON matching this schema:
${JSON_SCHEMA}`
  } else {
    userPrompt = `Write an insightful, opinionated blog post about the following topic:

Topic: ${input}

The post should:
- Start with a clear thesis or framing of the problem
- Cover key concepts and current state of the field
- Offer concrete analysis, not just description
- Include practical implications or takeaways for practitioners
- End with a forward-looking conclusion

Target audience: AI/ML researchers and engineers.

Return ONLY valid JSON matching this schema:
${JSON_SCHEMA}`
  }

  try {
    const response = await openai.chat.completions.create({
      model: BLOG_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.72,
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0].message.content
    if (!raw) throw new Error('Empty response from OpenAI')

    const generated = JSON.parse(raw) as {
      title: string
      slug: string
      excerpt: string
      content: string
      tags: string[]
      readingTime: number
    }

    // Sanitize slug
    generated.slug = generated.slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    return Response.json(generated)
  } catch (err) {
    console.error('[generate-post] OpenAI error:', err)
    return Response.json({ error: 'Generation failed. Check your OpenAI quota.' }, { status: 500 })
  }
}
