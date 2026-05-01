import type { ParsedPaper } from '@/types/paper'

interface JsonPaperInput {
  title: string
  authors?: string | string[]
  venue?: string
  year?: number
  paperUrl?: string
  codeUrl?: string
  category?: string
  tags?: string[]
}

export function parseJsonList(data: unknown): ParsedPaper[] {
  if (!Array.isArray(data)) throw new Error('Expected a JSON array')

  return (data as JsonPaperInput[]).map((item) => {
    if (!item.title) throw new Error('Each paper must have a title')
    return {
      title: item.title,
      venue: item.venue ?? null,
      year: item.year ?? null,
      paperUrl: item.paperUrl ?? null,
      codeUrl: item.codeUrl ?? null,
      category: item.category ?? 'General',
      isPublished: true,
      rawInput: JSON.stringify(item),
    }
  })
}
