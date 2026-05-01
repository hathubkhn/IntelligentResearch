import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseMarkdownList } from '@/lib/parsers/markdown'
import { getCategoryColor } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const { markdown, collectionName, collectionUrl, preview } = await request.json()

  if (!markdown || !collectionName) {
    return Response.json({ error: 'markdown and collectionName are required' }, { status: 400 })
  }

  const parsed = parseMarkdownList(markdown)

  if (preview) {
    return Response.json({ papers: parsed, paperCount: parsed.length })
  }

  const collection = await prisma.collection.create({
    data: { name: collectionName, sourceUrl: collectionUrl ?? null },
  })

  await prisma.paper.createMany({
    data: parsed.map(p => ({
      title: p.title,
      authors: [],
      venue: p.venue,
      year: p.year,
      category: p.category,
      tags: [],
      isPublished: p.isPublished,
      paperUrl: p.paperUrl,
      codeUrl: p.codeUrl,
      rawInput: p.rawInput,
      status: 'PENDING',
      coverColor: getCategoryColor(p.category),
      collectionId: collection.id,
    })),
  })

  return Response.json({ collectionId: collection.id, paperCount: parsed.length })
}
