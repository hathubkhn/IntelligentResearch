import { prisma } from '@/lib/prisma'
import { formatDistanceToNow } from '@/lib/utils'
import { Users, Trash2 } from 'lucide-react'
import { DeleteUserButton } from './DeleteUserButton'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { savedPapers: true, accounts: true } },
    },
  })

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <Users className="h-5 w-5 text-blue-400" />
        <h1 className="text-xl font-bold text-white">Users</h1>
        <span className="ml-2 text-sm text-white/40">{users.length} registered</span>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Provider</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Saved</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-white/30">
                  No registered users yet.
                </td>
              </tr>
            ) : users.map(user => (
              <tr key={user.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt="" className="h-8 w-8 rounded-full flex-shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-blue-600/30 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                        {user.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{user.name ?? 'Unknown'}</p>
                      <p className="text-white/40 text-xs truncate">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-white/50 capitalize">
                  GitHub
                </td>
                <td className="px-4 py-3">
                  <span className="text-white/70">{user._count.savedPapers}</span>
                  <span className="text-white/30 text-xs ml-1">papers</span>
                </td>
                <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">
                  {formatDistanceToNow(new Date(user.createdAt))}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteUserButton userId={user.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
