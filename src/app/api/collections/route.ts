import { prisma } from '@/lib/prisma'

export async function GET() {
  const collections = await prisma.collection.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { papers: true } } },
  })
  return Response.json(collections)
}
