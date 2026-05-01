import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseJsonList } from '@/lib/parsers/json'
import { getCategoryColor } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const { data, collectionName, collectionUrl } = await request.json()

  if (!data || !collectionName) {
    return Response.json({ error: 'data and collectionName are required' }, { status: 400 })
  }

  const parsed = parseJsonList(data)

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
