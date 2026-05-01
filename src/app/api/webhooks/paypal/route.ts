/**
 * POST /api/webhooks/paypal
 * Handles PayPal webhook events for subscription lifecycle.
 * Events handled:
 *   BILLING.SUBSCRIPTION.RENEWED   → reset next period dates
 *   BILLING.SUBSCRIPTION.CANCELLED → downgrade to FREE
 *   BILLING.SUBSCRIPTION.EXPIRED   → downgrade to FREE
 *   BILLING.SUBSCRIPTION.SUSPENDED → downgrade to FREE
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/paypal'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Collect verification headers
  const sigHeaders: Record<string, string> = {}
  for (const key of [
    'paypal-auth-algo',
    'paypal-cert-url',
    'paypal-transmission-id',
    'paypal-transmission-sig',
    'paypal-transmission-time',
  ]) {
    sigHeaders[key] = req.headers.get(key) ?? ''
  }

  const valid = await verifyWebhookSignature(rawBody, sigHeaders)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: { event_type: string; resource: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event_type, resource } = event
  const subscriptionId = resource?.id as string | undefined

  if (!subscriptionId) {
    return NextResponse.json({ ok: true }) // nothing to do
  }

  if (event_type === 'BILLING.SUBSCRIPTION.RENEWED') {
    const nextBilling = (resource.billing_info as Record<string, unknown>)?.next_billing_time as string | undefined
    const now         = new Date()
    const end         = nextBilling ? new Date(nextBilling) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    await prisma.subscription.updateMany({
      where: { providerSubscriptionId: subscriptionId },
      data:  { status: 'active', currentPeriodStart: now, currentPeriodEnd: end, updatedAt: new Date() },
    })
  }

  if (
    event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ||
    event_type === 'BILLING.SUBSCRIPTION.EXPIRED'   ||
    event_type === 'BILLING.SUBSCRIPTION.SUSPENDED'
  ) {
    const sub = await prisma.subscription.findUnique({
      where:  { providerSubscriptionId: subscriptionId },
      select: { userId: true },
    })

    if (sub) {
      await prisma.$transaction([
        prisma.subscription.update({
          where: { providerSubscriptionId: subscriptionId },
          data:  { status: 'cancelled', updatedAt: new Date() },
        }),
        prisma.user.update({
          where: { id: sub.userId },
          data:  { plan: 'FREE' },
        }),
      ])
    }
  }

  return NextResponse.json({ ok: true })
}
