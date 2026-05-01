import { prisma } from '@/lib/prisma'

export async function GET() {
  const [total, summarized, pending, errors, collections] = await Promise.all([
    prisma.paper.count(),
    prisma.paper.count({ where: { status: 'DONE' } }),
    prisma.paper.count({ where: { status: 'PENDING' } }),
    prisma.paper.count({ where: { status: 'ERROR' } }),
    prisma.collection.count(),
  ])
  return Response.json({ total, summarized, pending, errors, collections })
}
