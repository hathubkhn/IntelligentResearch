'use client'

import Link from 'next/link'
import { Bookmark, GitFork, LogOut, ChevronDown, FlaskConical, Sparkles, Crown, Zap } from 'lucide-react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'

export function Navbar() {
  const { data: session, status } = useSession()
  const isUser  = status === 'authenticated' && (session?.user as { role?: string })?.role === 'user'
  const isPro   = (session?.user as { plan?: string })?.plan === 'PRO'

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#020617]/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link
              href="https://www.appliedai-lab.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 group"
            >
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/25">
                <FlaskConical className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors hidden sm:block">
                Applied AI Lab
              </span>
            </Link>

            <span className="text-slate-700 hidden sm:block">/</span>

            <Link href="/" className="text-sm font-semibold text-white hover:text-blue-400 transition-colors">
              Research
            </Link>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/papers" className="text-slate-400 hover:text-white transition-colors">
              Papers
            </Link>
            <Link href="/collections" className="text-slate-400 hover:text-white transition-colors">
              Collections
            </Link>
            <Link href="/blog" className="text-slate-400 hover:text-white transition-colors">
              Blog
            </Link>
            {isUser && (
              <Link
                href="/discover"
                className="flex items-center gap-1 text-blue-400/80 hover:text-blue-300 transition-colors font-medium"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Discover</span>
              </Link>
            )}
            {/* Pricing / Upgrade */}
            {isUser && !isPro ? (
              <Link
                href="/pricing"
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs font-semibold transition-colors"
              >
                <Zap className="h-3 w-3" /> Upgrade
              </Link>
            ) : isUser && isPro ? (
              <Link
                href="/pricing"
                className="hidden sm:flex items-center gap-1 text-amber-400/60 hover:text-amber-400 transition-colors text-xs font-medium"
                title="Pro plan active"
              >
                <Crown className="h-3.5 w-3.5" />
                <span>Pro</span>
              </Link>
            ) : (
              <Link
                href="/pricing"
                className="hidden sm:block text-slate-400 hover:text-white transition-colors text-sm"
              >
                Pricing
              </Link>
            )}
            <Link
              href="/saved"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Saved</span>
            </Link>

            {status === 'loading' ? (
              <div className="h-7 w-7 rounded-full bg-slate-800 animate-pulse" />
            ) : isUser ? (
              <UserMenu session={session} />
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
              >
                <GitFork className="h-4 w-4" />
                <span className="hidden sm:inline">Sign in</span>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}

function UserMenu({ session }: { session: ReturnType<typeof useSession>['data'] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const user    = session?.user
  const isPro   = (user as { plan?: string })?.plan === 'PRO'
  const used    = (user as { usageUsed?: number })?.usageUsed  ?? 0
  const limit   = (user as { usageLimit?: number })?.usageLimit ?? 10
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={user.name ?? ''} className="h-7 w-7 rounded-full ring-1 ring-slate-700" />
        ) : (
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">
            {initials}
          </div>
        )}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 py-1 z-50">
          <div className="px-4 py-2.5 border-b border-slate-800">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            {/* Plan badge + usage */}
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                isPro
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-slate-700 text-slate-400'
              }`}>
                {isPro ? 'PRO' : 'FREE'}
              </span>
              <span className="text-[10px] text-slate-500">{used}/{limit} turns this month</span>
            </div>
          </div>
          <Link
            href="/discover"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-blue-400/80 hover:text-blue-300 hover:bg-slate-800/60 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" /> Discover Papers
          </Link>
          <Link
            href="/saved"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <Bookmark className="h-3.5 w-3.5" /> Reading List
          </Link>
          <Link
            href="/pricing"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2 w-full text-left px-4 py-2 text-sm transition-colors ${
              isPro
                ? 'text-amber-400/60 hover:text-amber-400 hover:bg-slate-800/60'
                : 'text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            {isPro ? <Crown className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
            {isPro ? 'Manage subscription' : 'Upgrade to Pro'}
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800/60 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
