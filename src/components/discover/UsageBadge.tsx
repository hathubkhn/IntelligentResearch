'use client'

import Link from 'next/link'
import { Zap, Crown } from 'lucide-react'

interface Props {
  used: number
  limit: number
  plan: string
}

export function UsageBadge({ used, limit, plan }: Props) {
  const remaining = Math.max(0, limit - used)
  const pct = Math.min(100, (used / limit) * 100)
  const isCritical = pct >= 90
  const isPro = plan === 'PRO'

  return (
    <Link
      href="/pricing"
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] transition-colors group"
      title={`${remaining} turns remaining this month`}
    >
      {isPro ? (
        <Crown className="h-3 w-3 text-amber-400 flex-shrink-0" />
      ) : (
        <Zap className="h-3 w-3 text-white/40 flex-shrink-0" />
      )}

      <div className="flex items-center gap-1.5">
        {/* Mini progress bar */}
        <div className="w-16 h-1 rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isCritical ? 'bg-red-500' : isPro ? 'bg-amber-400' : 'bg-white/30'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-[11px] font-medium tabular-nums ${
          isCritical ? 'text-red-400' : 'text-white/40'
        }`}>
          {remaining}/{limit}
        </span>
      </div>

      {!isPro && (
        <span className="text-[10px] text-purple-400/70 group-hover:text-purple-400 transition-colors font-medium">
          Upgrade
        </span>
      )}
    </Link>
  )
}
