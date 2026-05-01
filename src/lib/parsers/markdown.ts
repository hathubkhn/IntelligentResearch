import type { ParsedPaper } from '@/types/paper'

const URL_REGEX = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g

export function parseMarkdownList(markdown: string): ParsedPaper[] {
  const lines = markdown.split('\n')
  let currentCategory = 'General'
  const papers: ParsedPaper[] = []

  for (const line of lines) {
    const sectionMatch = line.match(/^#{1,3}\s+(.+)$/)
    if (sectionMatch) {
      currentCategory = sectionMatch[1]
        .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
        .replace(/[☀-➿]/gu, '')
        .trim()
      continue
    }

    if (!line.startsWith('*') && !line.startsWith('-')) continue

    const titleMatch = line.match(/\*\*(.+?)\*\*/)
    if (!titleMatch) continue

    const title = titleMatch[1]
    const venueMatch = line.match(
      /,\s*(ICLR|NeurIPS|ICML|ACL|EMNLP|COLING|AAAI|TMLR|arXiv|CoLM|ACL Findings|EMNLP Findings|NAACL|EACL|COLM|TMLR|findings)[^,]*\s+(\d{4})/i
    )

    const urls: { paperUrl?: string; codeUrl?: string } = {}
    const urlRegex = new RegExp(URL_REGEX.source, 'g')
    let urlMatch
    while ((urlMatch = urlRegex.exec(line)) !== null) {
      const label = urlMatch[1].toLowerCase()
      if (label.includes('paper') || label.includes('openreview') || label.includes('pdf')) {
        urls.paperUrl = urlMatch[2]
      }
      if (label.includes('code') || label.includes('github')) {
        urls.codeUrl = urlMatch[2]
      }
    }

    papers.push({
      title,
      venue: venueMatch ? `${venueMatch[1]} ${venueMatch[2]}` : null,
      year: venueMatch ? parseInt(venueMatch[2]) : null,
      category: currentCategory,
      isPublished: !line.includes('💡'),
      rawInput: line,
      paperUrl: urls.paperUrl ?? null,
      codeUrl: urls.codeUrl ?? null,
    })
  }

  return papers
}
