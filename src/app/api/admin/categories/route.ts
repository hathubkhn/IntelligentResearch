import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as { role?: string })?.role
  if (role !== 'admin') return null
  return session
}

export async function GET() {
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, description, color, order } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const existing = await prisma.category.findUnique({ where: { name: name.trim() } })
  if (existing) return NextResponse.json({ error: 'Category already exists' }, { status: 409 })

  const maxOrder = await prisma.category.aggregate({ _max: { order: true } })
  const category = await prisma.category.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      color: color ?? 'blue',
      order: order ?? (maxOrder._max.order ?? 0) + 1,
    },
  })
  return NextResponse.json(category, { status: 201 })
}
