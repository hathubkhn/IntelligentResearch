'use client'

import Link from 'next/link'
import { X, Crown, Zap, ArrowRight } from 'lucide-react'

interface Props {
  plan: string
  used: number
  limit: number
  onClose: () => void
}

export function QuotaModal({ plan, used, limit, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-[#111118] border border-white/[0.10] shadow-2xl overflow-hidden">
        {/* Purple glow */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-purple-600/15 to-transparent pointer-events-none" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-8 text-center">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
            <Crown className="h-7 w-7 text-amber-400" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">Monthly limit reached</h2>
          <p className="text-sm text-white/50 mb-6 leading-relaxed">
            You've used <span className="text-white font-semibold">{used}/{limit}</span> turns
            this month on your <span className="font-semibold capitalize">{plan.toLowerCase()}</span> plan.
            {' '}Upgrade to Pro for 100 turns every month.
          </p>

          {/* Comparison pills */}
          <div className="flex gap-3 mb-7">
            <div className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
              <div className="flex items-center gap-1.5 mb-1.5 justify-center">
                <Zap className="h-3.5 w-3.5 text-white/40" />
                <span className="text-xs text-white/40 font-medium">Free</span>
              </div>
              <span className="text-2xl font-bold text-white/60">10</span>
              <p className="text-[11px] text-white/30 mt-0.5">turns / month</p>
            </div>
            <div className="flex-1 rounded-xl bg-purple-900/30 border border-purple-500/25 p-4">
              <div className="flex items-center gap-1.5 mb-1.5 justify-center">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs text-amber-400 font-medium">Pro</span>
              </div>
              <span className="text-2xl font-bold text-white">100</span>
              <p className="text-[11px] text-purple-300/60 mt-0.5">turns / month</p>
            </div>
          </div>

          {/* CTA */}
          <Link
            href="/pricing"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
          >
            Upgrade to Pro <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <button
            onClick={onClose}
            className="mt-3 text-xs text-white/25 hover:text-white/50 transition-colors w-full py-2"
          >
            Maybe later · resets {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </button>
        </div>
      </div>
    </div>
  )
}
