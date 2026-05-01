import Link from 'next/link'
import { FlaskConical, ExternalLink } from 'lucide-react'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-[#020617]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 shadow-sm shadow-blue-500/30">
              <FlaskConical className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm text-slate-500">
              A project of{' '}
              <Link
                href="https://www.appliedai-lab.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1"
              >
                Applied AI Lab <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            </span>
          </div>

          <div className="flex items-center gap-5 text-xs text-slate-600">
            <Link href="/papers" className="hover:text-slate-400 transition-colors">Papers</Link>
            <Link href="/collections" className="hover:text-slate-400 transition-colors">Collections</Link>
            <Link href="/blog" className="hover:text-slate-400 transition-colors">Blog</Link>
          </div>

        </div>
      </div>
    </footer>
  )
}
