'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { GitFork, BookOpen, LogIn } from 'lucide-react'

function LoginForm() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/saved'

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'authenticated') router.replace(callbackUrl)
  }, [status, router, callbackUrl])

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        // Sign up
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: username, password }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Failed to create account')
          setLoading(false)
          return
        }
        // After signup, sign in
        const signInRes = await signIn('credentials', {
          username,
          password,
          redirect: false,
        })
        if (signInRes?.error) {
          setError('Account created, but sign-in failed')
        } else {
          router.replace(callbackUrl)
        }
      } else {
        // Sign in
        const res = await signIn('credentials', {
          username,
          password,
          redirect: false,
        })
        if (res?.error) {
          setError('Invalid username or password')
        } else {
          router.replace(callbackUrl)
        }
      }
    } catch {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') return null

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-blue-400 mb-4">
            <BookOpen className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </h1>
          <p className="text-white/40 text-sm">Sync your reading list across devices</p>
        </div>

        <div className="space-y-4">
          {/* GitHub OAuth */}
          <button
            onClick={() => signIn('github', { callbackUrl })}
            className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 text-white font-medium py-3 px-4 rounded-xl transition-all"
          >
            <GitFork className="h-5 w-5" />
            Continue with GitHub
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-950 px-2 text-white/40">Or</span>
            </div>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleCredentialsSubmit} className="space-y-3">
            <div>
              <label htmlFor="username" className="block text-sm text-white/60 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:border-blue-500 focus:outline-none transition"
                placeholder="your-username"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm text-white/60 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:border-blue-500 focus:outline-none transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium py-3 px-4 rounded-xl transition-all"
            >
              <LogIn className="h-5 w-5" />
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {/* Toggle mode */}
          <p className="text-center text-sm text-white/40">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError('')
              }}
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

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
