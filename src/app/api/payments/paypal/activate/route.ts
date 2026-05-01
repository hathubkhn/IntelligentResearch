/**
 * POST /api/payments/paypal/activate
 * Called client-side after PayPal `onApprove` with the subscription ID.
 * Verifies the subscription against PayPal's API and upgrades the user to PRO.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSubscription } from '@/lib/paypal'
import { prisma } from '@/lib/prisma'

const MONTHLY_PLAN_ID = process.env.PAYPAL_PLAN_ID_MONTHLY ?? ''
const ANNUAL_PLAN_ID  = process.env.PAYPAL_PLAN_ID_ANNUAL  ?? ''

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as { id: string }).id
  const { subscriptionId } = await req.json() as { subscriptionId: string }

  if (!subscriptionId) {
    return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 })
  }

  // Verify with PayPal
  let ppSub
  try {
    ppSub = await getSubscription(subscriptionId)
  } catch (e) {
    return NextResponse.json({ error: `PayPal verification failed: ${(e as Error).message}` }, { status: 502 })
  }

  if (ppSub.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: `Subscription is not active (status: ${ppSub.status})` },
      { status: 400 }
    )
  }

  const billingCycle = ppSub.plan_id === ANNUAL_PLAN_ID ? 'ANNUAL' : 'MONTHLY'
  const periodStart  = new Date(ppSub.start_time ?? ppSub.create_time)
  // Next billing time from PayPal, or fallback based on billing cycle
  const nextBilling  = ppSub.billing_info?.next_billing_time
  const periodEnd    = nextBilling
    ? new Date(nextBilling)
    : billingCycle === 'ANNUAL'
      ? new Date(periodStart.getTime() + 365 * 24 * 60 * 60 * 1000)
      : new Date(periodStart.getTime() + 30  * 24 * 60 * 60 * 1000)

  // Upsert subscription record + upgrade user plan atomically
  await prisma.$transaction([
    prisma.subscription.upsert({
      where:  { userId },
      create: {
        userId,
        provider: 'paypal',
        providerSubscriptionId: subscriptionId,
        status: 'active',
        billingCycle,
        currentPeriodStart: periodStart,
        currentPeriodEnd:   periodEnd,
      },
      update: {
        providerSubscriptionId: subscriptionId,
        status: 'active',
        billingCycle,
        currentPeriodStart: periodStart,
        currentPeriodEnd:   periodEnd,
        updatedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data:  { plan: 'PRO' },
    }),
  ])

  return NextResponse.json({ success: true, plan: 'PRO', billingCycle, periodEnd })
}
