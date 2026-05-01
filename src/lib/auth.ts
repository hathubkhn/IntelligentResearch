import type { NextAuthOptions } from 'next-auth'
import type { Adapter } from 'next-auth/adapters'
import CredentialsProvider from 'next-auth/providers/credentials'
import GithubProvider from 'next-auth/providers/github'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { getUsageInfo, PLAN_LIMITS } from '@/lib/usage'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,

  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const adminEmail = process.env.ADMIN_EMAIL
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH
        if (!adminEmail || !adminPasswordHash) return null
        if (credentials.email !== adminEmail) return null
        const isValid = await bcrypt.compare(credentials.password, adminPasswordHash)
        if (!isValid) return null
        return { id: 'admin', email: adminEmail, name: 'Admin', role: 'admin' }
      },
    }),
  ],

  pages: {
    signIn: '/login',
  },

  session: {
    strategy: 'jwt',
  },

  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role ?? 'user'
      }
      // Refresh plan + usage on sign-in or explicit session update
      if ((trigger === 'signIn' || trigger === 'update') && token.id && token.role !== 'admin') {
        try {
          const usage = await getUsageInfo(token.id as string)
          token.plan      = usage.plan
          token.usageUsed = usage.used
          token.usageLimit = usage.limit
        } catch {
          token.plan       = 'FREE'
          token.usageUsed  = 0
          token.usageLimit = PLAN_LIMITS.FREE
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { plan?: string }).plan = (token.plan as string) ?? 'FREE';
        (session.user as { usageUsed?: number }).usageUsed = (token.usageUsed as number) ?? 0;
        (session.user as { usageLimit?: number }).usageLimit = (token.usageLimit as number) ?? PLAN_LIMITS.FREE;
      }
      return session
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
}
