import Link from 'next/link'
import { BrainCircuit, ExternalLink, Mail, Phone } from 'lucide-react'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-[#020617]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/25"
                aria-hidden
              >
                <BrainCircuit className="h-4 w-4 text-white" strokeWidth={2} />
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
            <div className="flex flex-col gap-1.5 text-xs text-slate-500 sm:pl-9">
              <a
                href="tel:+84936328990"
                className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Phone className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                <span>+84 936 328 990</span>
              </a>
              <a
                href="mailto:appliedailab@gmail.com"
                className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors break-all"
              >
                <Mail className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                <span>appliedailab@gmail.com</span>
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs text-slate-600 sm:justify-end">
            <Link href="/papers" className="hover:text-slate-400 transition-colors">Papers</Link>
            <Link href="/collections" className="hover:text-slate-400 transition-colors">Collections</Link>
            <Link href="/blog" className="hover:text-slate-400 transition-colors">Blog</Link>
          </div>

        </div>
      </div>
    </footer>
  )
}
