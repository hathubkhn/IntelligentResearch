import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { name, password } = await req.json()

    if (!name?.trim() || !password) {
      return NextResponse.json({ error: 'Name and password are required' }, { status: 400 })
    }

    const username = name.trim()

    // Check if username already exists (case-insensitive)
    const existing = await prisma.user.findFirst({
      where: {
        name: {
          equals: username,
          mode: 'insensitive',
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name: username,
        password: hashedPassword,
        plan: 'FREE',
        discoverUsage: 0,
        discoverUsageResetAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        plan: true,
      },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
