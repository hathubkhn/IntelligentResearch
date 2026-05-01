'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import {
  PayPalScriptProvider,
  PayPalButtons,
  usePayPalScriptReducer,
} from '@paypal/react-paypal-js'
import { Check, Sparkles, Zap, Crown, ArrowRight, Brain } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

// ─── Plan data ────────────────────────────────────────────────────────────────

const FEATURES_FREE = [
  'Read & save papers',
  'Create collections',
  'Browse curated workspaces',
  'Blog & community content',
  '50 Discover searches / month',
  '50 Research Gap Analyses / month',
]

const FEATURES_PRO = [
  'Everything in Free',
  '100 Discover searches / month',
  '100 Research Gap Analyses / month',
  'Import from OpenReview',
  'AI paper summarization',
  'Semantic similarity search',
  'Export gap analysis reports',
  'Priority support',
]

// ─── PayPal button wrapper ────────────────────────────────────────────────────

function PayPalButtonInner({
  planId,
  onSuccess,
}: {
  planId: string
  onSuccess: () => void
}) {
  const [{ isPending }] = usePayPalScriptReducer()

  if (isPending) {
    return (
      <div className="h-11 rounded-xl bg-white/5 animate-pulse" />
    )
  }

  if (!planId) {
    return (
      <div className="h-11 rounded-xl bg-white/5 flex items-center justify-center text-xs text-white/30">
        PayPal not configured
      </div>
    )
  }

  return (
    <PayPalButtons
      style={{ layout: 'horizontal', color: 'gold', shape: 'rect', label: 'subscribe', height: 44 }}
      createSubscription={(_data, actions) =>
        actions.subscription.create({ plan_id: planId })
      }
      onApprove={async (data) => {
        try {
          const res = await fetch('/api/payments/paypal/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: data.subscriptionID }),
          })
          const json = await res.json() as { success?: boolean; error?: string }
          if (!res.ok || !json.success) throw new Error(json.error ?? 'Activation failed')
          toast.success('Welcome to Pro! Your account has been upgraded.')
          onSuccess()
        } catch (e) {
          toast.error((e as Error).message)
        }
      }}
      onError={(err) => {
        console.error('PayPal error', err)
        toast.error('Payment failed. Please try again.')
      }}
    />
  )
}

// ─── Usage indicator ─────────────────────────────────────────────────────────

interface UsageData {
  plan: string
  used: number
  limit: number
  remaining: number
}

function UsageBar({ usage }: { usage: UsageData }) {
  const pct = Math.min(100, (usage.used / usage.limit) * 100)
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/50 font-medium uppercase tracking-wider">This month</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          usage.plan === 'PRO'
            ? 'bg-amber-500/15 text-amber-400'
            : 'bg-white/8 text-white/40'
        }`}>
          {usage.plan}
        </span>
      </div>
      <div className="flex items-end justify-between mb-2">
        <span className="text-2xl font-bold text-white">{usage.used}</span>
        <span className="text-sm text-white/30">/ {usage.limit} turns</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-white/30 mt-2">{usage.remaining} turns remaining</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { data: session, status, update: updateSession } = useSession()
  const isAuth = status === 'authenticated'
  const user = session?.user as { plan?: string; usageUsed?: number; usageLimit?: number } | undefined
  const isPro = user?.plan === 'PRO'

  const [billing, setBilling]   = useState<'monthly' | 'annual'>('monthly')
  const [usage, setUsage]       = useState<UsageData | null>(null)
  const [upgraded, setUpgraded] = useState(false)

  const monthlyPlanId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID_MONTHLY ?? ''
  const annualPlanId  = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID_ANNUAL  ?? ''
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ''

  useEffect(() => {
    if (isAuth) {
      fetch('/api/user/subscription')
        .then(r => r.json())
        .then((d: { usage?: UsageData }) => d.usage && setUsage(d.usage))
        .catch(() => {})
    }
  }, [isAuth, upgraded])

  const handleSuccess = async () => {
    setUpgraded(true)
    await updateSession()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-950/30 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 font-medium mb-6">
            <Sparkles className="h-3 w-3" />
            Research Discovery · Powered by AI
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-5 bg-gradient-to-br from-white via-white/90 to-white/50 bg-clip-text text-transparent">
            Unlock your research<br />potential
          </h1>
          <p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
            Free to explore. Pro to accelerate. Search OpenReview, analyze gaps,
            and discover AI methods across domains.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-24">

        {/* Billing toggle */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-1 bg-white/[0.05] rounded-xl p-1 border border-white/[0.08]">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === 'monthly'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === 'annual'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Annual
              <span className="absolute -top-2 -right-1 text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                −17%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">

          {/* Free card */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-8 flex flex-col">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center">
                <Zap className="h-4 w-4 text-white/60" />
              </div>
              <span className="text-base font-semibold">Free</span>
            </div>

            <div className="mb-6">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-white/40 ml-2 text-sm">forever</span>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {FEATURES_FREE.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                  <Check className="h-4 w-4 text-white/30 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            {isAuth && !isPro ? (
              <div className="h-11 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-sm text-white/40 font-medium">
                Current plan
              </div>
            ) : !isAuth ? (
              <button
                onClick={() => signIn()}
                className="h-11 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center gap-2 text-sm text-white/70 hover:text-white font-medium transition-colors"
              >
                Get started free <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Pro card */}
          <div className="relative rounded-2xl bg-gradient-to-b from-purple-950/60 to-[#0a0a0f] border border-purple-500/30 p-8 flex flex-col overflow-hidden">
            {/* Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-purple-600/20 blur-[80px] pointer-events-none" />

            <div className="relative flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Crown className="h-4 w-4 text-amber-400" />
              </div>
              <span className="text-base font-semibold">Pro</span>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                POPULAR
              </span>
            </div>

            <div className="relative mb-6">
              <span className="text-4xl font-bold">
                {billing === 'annual' ? '$8.33' : '$10'}
              </span>
              <span className="text-white/40 ml-2 text-sm">/ month</span>
              {billing === 'annual' && (
                <div className="text-xs text-emerald-400 mt-1">
                  Billed as $100 / year · Save $20
                </div>
              )}
            </div>

            <ul className="relative space-y-3 mb-8 flex-1">
              {FEATURES_PRO.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-white/80">
                  <Check className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="relative">
              {isPro ? (
                <div className="h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center gap-2 text-sm text-purple-300 font-medium">
                  <Check className="h-4 w-4" />
                  Active plan
                </div>
              ) : !isAuth ? (
                <button
                  onClick={() => signIn()}
                  className="w-full h-11 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
                >
                  Sign in to upgrade <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <PayPalScriptProvider
                  options={{
                    clientId: paypalClientId || 'test',
                    vault: true,
                    intent: 'subscription',
                    currency: 'USD',
                  }}
                >
                  <PayPalButtonInner
                    planId={billing === 'annual' ? annualPlanId : monthlyPlanId}
                    onSuccess={handleSuccess}
                  />
                </PayPalScriptProvider>
              )}
            </div>
          </div>
        </div>

        {/* Usage card (if authenticated) */}
        {isAuth && usage && (
          <div className="max-w-sm mx-auto mt-10">
            <UsageBar usage={usage} />
          </div>
        )}

        {/* Feature comparison table */}
        <div className="mt-20">
          <h2 className="text-xl font-semibold text-center mb-10 text-white/80">
            Everything included
          </h2>
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                  <th className="text-left px-6 py-4 text-white/40 font-medium">Feature</th>
                  <th className="text-center px-6 py-4 text-white/40 font-medium w-28">Free</th>
                  <th className="text-center px-6 py-4 text-purple-400 font-semibold w-28">Pro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Read & save papers', true, true],
                  ['Create collections', true, true],
                  ['Blog & community', true, true],
                  ['Discover searches / mo', '10', '100'],
                  ['Research Gap Analysis / mo', '10', '100'],
                  ['OpenReview import', false, true],
                  ['AI summarization', false, true],
                  ['Semantic search', false, true],
                  ['Export reports (.md)', false, true],
                ].map(([feature, free, pro]) => (
                  <tr key={String(feature)} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3.5 text-white/70">{String(feature)}</td>
                    <td className="px-6 py-3.5 text-center">
                      {typeof free === 'boolean' ? (
                        free
                          ? <Check className="h-4 w-4 text-white/40 mx-auto" />
                          : <span className="text-white/15">—</span>
                      ) : (
                        <span className="text-white/50 font-mono text-xs">{String(free)}</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {typeof pro === 'boolean' ? (
                        pro
                          ? <Check className="h-4 w-4 text-purple-400 mx-auto" />
                          : <span className="text-white/15">—</span>
                      ) : (
                        <span className="text-purple-400 font-mono text-xs font-semibold">{String(pro)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-center mb-10 text-white/80">FAQ</h2>
          <div className="space-y-4">
            {[
              {
                q: 'What counts as a "turn"?',
                a: 'Each Discover search and each Research Gap Analysis consumes one turn. Reading papers, browsing collections, creating notes, and saving papers are unlimited and free.',
              },
              {
                q: 'When does the monthly counter reset?',
                a: 'Turns reset on the 1st of every calendar month (UTC), regardless of your billing date.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes. Cancel from your PayPal subscriptions page. You keep Pro access until the end of your current billing period.',
              },
              {
                q: 'Is payment secure?',
                a: 'All payments are processed by PayPal. We never store your card details.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-5">
                <h3 className="font-medium text-white/85 mb-2">{q}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 rounded-2xl bg-gradient-to-br from-purple-900/40 to-purple-950/20 border border-purple-500/20 p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-600/5 to-transparent pointer-events-none" />
          <Brain className="h-10 w-10 text-purple-400 mx-auto mb-4 relative" />
          <h2 className="text-2xl font-bold mb-3 relative">Start discovering today</h2>
          <p className="text-white/50 mb-6 relative">
            No credit card required. Upgrade when you need more.
          </p>
          <div className="flex items-center justify-center gap-3 relative">
            {!isAuth ? (
              <button
                onClick={() => signIn()}
                className="px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
              >
                Get started free
              </button>
            ) : (
              <Link
                href="/discover"
                className="px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors inline-flex items-center gap-2"
              >
                Go to Discover <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
