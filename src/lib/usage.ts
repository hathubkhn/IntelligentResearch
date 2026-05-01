import { prisma } from '@/lib/prisma'

export const PLAN_LIMITS = {
  FREE: 50,
  PRO: 100,
} as const

export type Plan = 'FREE' | 'PRO'

export interface UsageInfo {
  plan: Plan
  used: number
  limit: number
  remaining: number
  hasCapacity: boolean
}

/** One calendar month window. Returns the start of the current month (UTC). */
function startOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/**
 * Fetch the current usage info for a user, resetting the counter if we've
 * rolled into a new calendar month.
 */
export async function getUsageInfo(userId: string): Promise<UsageInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, discoverUsage: true, discoverUsageResetAt: true },
  })

  if (!user) throw new Error('User not found')

  const monthStart = startOfCurrentMonth()
  const needsReset = user.discoverUsageResetAt < monthStart

  let used = user.discoverUsage
  if (needsReset) {
    // Reset counter for the new month
    await prisma.user.update({
      where: { id: userId },
      data: { discoverUsage: 0, discoverUsageResetAt: monthStart },
    })
    used = 0
  }

  const plan = user.plan as Plan
  const limit = PLAN_LIMITS[plan]
  const remaining = Math.max(0, limit - used)

  return { plan, used, limit, remaining, hasCapacity: remaining > 0 }
}

/**
 * Increment usage by 1. Returns the updated UsageInfo.
 * Throws if the user has no remaining capacity.
 */
export async function consumeTurn(userId: string): Promise<UsageInfo> {
  const info = await getUsageInfo(userId)

  if (!info.hasCapacity) {
    throw new QuotaExceededError(info)
  }

  await prisma.user.update({
    where: { id: userId },
    data: { discoverUsage: { increment: 1 } },
  })

  return {
    ...info,
    used: info.used + 1,
    remaining: info.remaining - 1,
    hasCapacity: info.remaining - 1 > 0,
  }
}

export class QuotaExceededError extends Error {
  info: UsageInfo
  constructor(info: UsageInfo) {
    super(`Monthly limit reached (${info.used}/${info.limit} turns used)`)
    this.name = 'QuotaExceededError'
    this.info = info
  }
}
