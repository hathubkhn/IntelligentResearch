import Link from 'next/link'
import { BookOpen, LayoutDashboard, Upload, FileText, Users, LogOut, PenLine, Library, Tag } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 flex-shrink-0 border-r border-slate-800/80 bg-slate-900 flex flex-col">
        <div className="p-5 border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-2 text-white font-semibold">
            <BookOpen className="h-5 w-5 text-blue-400" />
            Admin
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          <NavLink href="/admin" icon={<LayoutDashboard className="h-4 w-4" />}>
            Dashboard
          </NavLink>
          <NavLink href="/admin/upload" icon={<Upload className="h-4 w-4" />}>
            Upload
          </NavLink>
          <NavLink href="/admin/openreview" icon={<Library className="h-4 w-4" />}>
            OpenReview
          </NavLink>
          <NavLink href="/admin/papers" icon={<FileText className="h-4 w-4" />}>
            Papers
          </NavLink>
          <NavLink href="/admin/categories" icon={<Tag className="h-4 w-4" />}>
            Categories
          </NavLink>
          <NavLink href="/admin/blog" icon={<PenLine className="h-4 w-4" />}>
            Blog
          </NavLink>
          <NavLink href="/admin/users" icon={<Users className="h-4 w-4" />}>
            Users
          </NavLink>
        </nav>

        <div className="p-3 border-t border-white/10">
          <Link
            href="/api/auth/signout"
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 px-3 py-2 rounded-md transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 px-3 py-2 rounded-md transition-colors"
          >
            ← Public site
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 px-3 py-2 rounded-md transition-colors"
    >
      {icon}
      {children}
    </Link>
  )
}
