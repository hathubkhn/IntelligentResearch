import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  return (session?.user as { role?: string })?.role === 'admin'
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()

  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(body.name        !== undefined ? { name: body.name.trim() }              : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      ...(body.color       !== undefined ? { color: body.color }                   : {}),
      ...(body.order       !== undefined ? { order: body.order }                   : {}),
    },
  })
  return NextResponse.json(category)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const cat = await prisma.category.findUnique({ where: { id } })
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Null out papers using this category
  await prisma.paper.updateMany({ where: { category: cat.name }, data: { category: null } })
  await prisma.category.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
