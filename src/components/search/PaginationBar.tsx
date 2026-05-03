'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  totalPages: number
  params: Record<string, string | undefined>
}

function buildHref(params: Record<string, string | undefined>, p: number) {
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) if (v) clean[k] = v
  return `/papers?${new URLSearchParams({ ...clean, page: String(p) })}`
}

/** Returns the page numbers to show, inserting null for "…" gaps */
function getPages(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | null)[] = [1]
  if (current > 3) pages.push(null)
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push(null)
  pages.push(total)
  return pages
}

export function PaginationBar({ page, totalPages, params }: Props) {
  const pages = getPages(page, totalPages)

  return (
    <nav aria-label="Pagination" className="flex justify-center items-center gap-1 mt-10 flex-wrap">
      {/* Prev */}
      <PageLink
        href={page > 1 ? buildHref(params, page - 1) : undefined}
        disabled={page <= 1}
        label="Previous"
        icon={<ChevronLeft className="h-4 w-4" />}
      />

      {pages.map((p, i) =>
        p === null ? (
          <span key={`ellipsis-${i}`} className="px-2 text-white/20 select-none">…</span>
        ) : (
          <a
            key={p}
            href={buildHref(params, p)}
            aria-current={p === page ? 'page' : undefined}
            className={`min-w-[32px] h-8 flex items-center justify-center px-2 rounded text-sm font-medium transition-colors ${
              p === page
                ? 'bg-blue-600 text-white pointer-events-none'
                : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}
          >
            {p}
          </a>
        )
      )}

      {/* Next */}
      <PageLink
        href={page < totalPages ? buildHref(params, page + 1) : undefined}
        disabled={page >= totalPages}
        label="Next"
        icon={<ChevronRight className="h-4 w-4" />}
      />
    </nav>
  )
}

function PageLink({
  href, disabled, label, icon,
}: {
  href?: string
  disabled: boolean
  label: string
  icon: React.ReactNode
}) {
  if (disabled) {
    return (
      <span aria-disabled="true" className="h-8 flex items-center px-2 rounded text-white/15 cursor-default">
        {icon}
      </span>
    )
  }
  return (
    <a href={href} aria-label={label} className="h-8 flex items-center px-2 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors">
      {icon}
    </a>
  )
}
