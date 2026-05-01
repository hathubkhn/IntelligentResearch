import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUsageInfo } from '@/lib/usage'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as { id: string }).id

  const [usage, subscription] = await Promise.all([
    getUsageInfo(userId),
    prisma.subscription.findUnique({
      where: { userId },
      select: {
        status: true,
        billingCycle: true,
        currentPeriodEnd: true,
        providerSubscriptionId: true,
      },
    }),
  ])

  return NextResponse.json({ usage, subscription })
}
