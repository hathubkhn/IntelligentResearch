'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { GitFork, BookOpen } from 'lucide-react'

function LoginForm() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/saved'

  useEffect(() => {
    if (status === 'authenticated') router.replace(callbackUrl)
  }, [status, router, callbackUrl])

  if (status === 'loading') return null

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-blue-400 mb-4">
            <BookOpen className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Sign in</h1>
          <p className="text-white/40 text-sm">Sync your reading list across devices</p>
        </div>

        <button
          onClick={() => signIn('github', { callbackUrl })}
          className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 text-white font-medium py-3 px-4 rounded-xl transition-all"
        >
          <GitFork className="h-5 w-5" />
          Continue with GitHub
        </button>

        <p className="text-center text-white/30 text-xs mt-6">
          Only used to identify you — we don&apos;t access your repositories.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
