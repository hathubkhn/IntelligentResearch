import Link from 'next/link'
import { FileText, CheckCircle2, Clock, XCircle, Layers, Upload, RefreshCw, Users, Search } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function getStats() {
  const [total, summarized, pending, errors, collections, recent, totalUsers, searchUsage] = await Promise.all([
    prisma.paper.count(),
    prisma.paper.count({ where: { status: 'DONE' } }),
    prisma.paper.count({ where: { status: 'PENDING' } }),
    prisma.paper.count({ where: { status: 'ERROR' } }),
    prisma.collection.count(),
    prisma.paper.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, status: true, createdAt: true },
    }),
    prisma.user.count(),
    prisma.user.aggregate({ _sum: { discoverUsage: true } }),
  ])
  return { total, summarized, pending, errors, collections, recent, totalUsers, totalSearches: searchUsage._sum.discoverUsage ?? 0 }
}

export default async function AdminDashboard() {
  const { total, summarized, pending, errors, collections, recent, totalUsers, totalSearches } = await getStats()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-8">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard icon={<FileText />} label="Total Papers" value={total} color="text-white" />
        <StatCard icon={<CheckCircle2 />} label="Summarized" value={summarized} color="text-emerald-400" />
        <StatCard icon={<Clock />} label="Pending" value={pending} color="text-amber-400" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <StatCard icon={<XCircle />} label="Errors" value={errors} color="text-red-400" />
        <StatCard icon={<Users />} label="Total Users" value={totalUsers} color="text-blue-400" />
        <StatCard icon={<Search />} label="Discover Searches" value={totalSearches} color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="rounded-xl border border-slate-800/80 bg-slate-900 p-5">
          <h2 className="font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              href="/admin/upload"
              className="flex items-center gap-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 px-3 py-2 rounded-md transition-colors"
            >
              <Upload className="h-4 w-4 text-blue-400" /> Upload new papers
            </Link>
            <Link
              href="/admin/papers"
              className="flex items-center gap-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 px-3 py-2 rounded-md transition-colors"
            >
              <FileText className="h-4 w-4 text-blue-400" /> Manage papers
            </Link>
            {pending > 0 && (
              <SummarizeBatchButton pendingCount={pending} />
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-900 p-5">
          <h2 className="font-semibold text-white mb-4">Recent Papers</h2>
          <div className="space-y-2">
            {recent.map(paper => (
              <Link
                key={paper.id}
                href={`/admin/papers/${paper.id}`}
                className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors py-1"
              >
                <StatusDot status={paper.status} />
                <span className="line-clamp-1">{paper.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800/80 bg-slate-900 p-5">
        <div className="flex items-center gap-2 text-white/40">
          <Layers className="h-4 w-4" />
          <span className="text-sm">{collections} collections total</span>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900 p-5">
      <div className={`mb-3 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
      <div className="text-xs text-white/40">{label}</div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DONE: 'bg-emerald-400',
    ERROR: 'bg-red-400',
    PROCESSING: 'bg-blue-400',
    PENDING: 'bg-amber-400',
  }
  return <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${colors[status] ?? 'bg-gray-400'}`} />
}

function SummarizeBatchButton({ pendingCount }: { pendingCount: number }) {
  return (
    <a
      href="/admin/upload"
      className="flex items-center gap-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 px-3 py-2 rounded-md transition-colors"
    >
      <RefreshCw className="h-4 w-4 text-blue-400" /> Summarize {pendingCount} pending papers
    </a>
  )
}
