import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { consumeTurn, QuotaExceededError } from '@/lib/usage'

// Re-export the OpenReview paper type for consumers
export type { OpenReviewPaper } from '@/app/api/admin/openreview/route'

// Import the raw GET handler (doesn't do auth — we wrap it here)
import { GET as adminGET } from '@/app/api/admin/openreview/route'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in to search papers' }, { status: 401 })
  }

  const userId = (session.user as { id: string }).id

  try {
    await consumeTurn(userId)
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return NextResponse.json(
        { error: 'Monthly search limit reached', quota: e.info, upgrade: true },
        { status: 429 }
      )
    }
    throw e
  }

  return adminGET(req)
}
