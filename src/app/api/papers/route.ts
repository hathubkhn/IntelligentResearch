import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const query = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''
  const year = searchParams.get('year') || ''
  const status = searchParams.get('status') || ''
  const collectionId = searchParams.get('collectionId') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  if (query) {
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { tldr: { contains: query, mode: 'insensitive' } },
      { keyIdea: { contains: query, mode: 'insensitive' } },
    ]
  }
  if (category) where.category = category
  if (year) where.year = parseInt(year)
  if (status) where.status = status
  if (collectionId) where.collectionId = collectionId

  const [papers, total] = await Promise.all([
    prisma.paper.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { collection: { select: { id: true, name: true } } },
    }),
    prisma.paper.count({ where }),
  ])

  return Response.json({ papers, total, page, limit })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const paper = await prisma.paper.create({ data: body })
  return Response.json(paper, { status: 201 })
}
