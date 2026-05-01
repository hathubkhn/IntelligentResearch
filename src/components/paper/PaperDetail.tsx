'use client'

import { useState } from 'react'
import { Copy, Check, FileText, Code2, ExternalLink, BookOpen } from 'lucide-react'
import { PaperSummaryBlock } from './PaperSummaryBlock'
import { SaveButton } from './SaveButton'
import { getCategoryColor, getVenueTier, formatAuthors } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { Paper } from '@/types/paper'

export function PaperDetail({ paper }: { paper: Paper }) {
  const gradientClass = paper.coverColor ?? getCategoryColor(paper.category)
  const isGitHub = paper.codeUrl?.includes('github.com')
  const hasMethod = !!(paper.methodDiagram || paper.methodDescription)

  return (
    <article>
      {/* ── Hero header ───────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[#020617]">
        {/* category colour wash */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-[0.07]`} />
        {/* bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-[#020617]" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-14">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            {paper.venue && (
              <Badge variant={getVenueTier(paper.venue) ?? 'default'}>{paper.venue}</Badge>
            )}
            {paper.year && <Badge variant="default">{paper.year}</Badge>}
            {paper.category && (
              <Badge variant="default" className="text-white/50">{paper.category}</Badge>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-bold text-white leading-[1.2] tracking-tight mb-5 max-w-4xl">
            {paper.title}
          </h1>

          {/* Authors */}
          {paper.authors.length > 0 && (
            <p className="text-white/45 text-sm mb-5 max-w-3xl">
              {paper.authors.join(', ')}
            </p>
          )}

          {/* Tags */}
          {paper.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {paper.tags.map(tag => (
                <a
                  key={tag}
                  href={`/papers?tag=${encodeURIComponent(tag)}`}
                  className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-blue-300 hover:border-blue-500/40 hover:bg-blue-500/10 transition-colors"
                >
                  {tag}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Two-column body ───────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex gap-10 items-start">

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-6">
            {paper.status === 'DONE' ? (
              <PaperSummaryBlock paper={paper} />
            ) : paper.status === 'PENDING' || paper.status === 'PROCESSING' ? (
              <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-14 text-center">
                <div className="inline-flex items-center gap-2 text-white/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse [animation-delay:0.4s]" />
                  <span className="ml-2 text-sm">Generating summary…</span>
                </div>
              </div>
            ) : paper.status === 'ERROR' ? (
              <div className="rounded-2xl bg-red-500/8 border border-red-500/20 p-8 text-center text-red-400 text-sm">
                Summary generation failed.{paper.errorMessage ? ` ${paper.errorMessage}` : ''}
              </div>
            ) : null}
          </div>

          {/* Sidebar — hidden on mobile */}
          <aside className="hidden lg:block w-64 xl:w-72 flex-shrink-0">
            <Sidebar paper={paper} isGitHub={isGitHub ?? false} />
          </aside>
        </div>
      </div>

      {/* ── Method section — full width ───────────────────────── */}
      {hasMethod && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
          <MethodSection paper={paper} />
        </div>
      )}

      {/* ── Mobile links (below content on small screens) ─────── */}
      <div className="lg:hidden max-w-6xl mx-auto px-4 sm:px-6 pb-10">
        <MobileLinks paper={paper} />
      </div>
    </article>
  )
}

/* ── Sidebar ─────────────────────────────────────────────────── */
function Sidebar({ paper, isGitHub }: { paper: Paper; isGitHub: boolean }) {
  const [bibtexOpen, setBibtexOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const bibtex = `@article{${paper.title.split(' ')[0]?.toLowerCase()}${paper.year ?? ''},
  title     = {${paper.title}},
  author    = {${paper.authors.join(' and ')}},
  year      = {${paper.year ?? ''}},${paper.venue ? `\n  booktitle = {${paper.venue}},` : ''}${paper.arxivId ? `\n  eprint    = {${paper.arxivId}},` : ''}
}`

  const copyBibtex = () => {
    navigator.clipboard.writeText(bibtex).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="sticky top-20 space-y-3">

      {/* Primary action */}
      {paper.paperUrl && (
        <a
          href={paper.paperUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <FileText className="h-4 w-4" /> Read Paper
        </a>
      )}

      {/* Secondary links */}
      <div className="space-y-1.5">
        {paper.codeUrl && (
          <a
            href={paper.codeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 text-white/70 hover:text-white text-sm transition-all"
          >
            <Code2 className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{isGitHub ? paper.codeUrl.replace('https://github.com/', '') : 'Code'}</span>
            <ExternalLink className="h-3 w-3 ml-auto flex-shrink-0 opacity-40" />
          </a>
        )}
        {paper.openReviewUrl && (
          <a
            href={paper.openReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 text-white/60 hover:text-white text-sm transition-all"
          >
            <ExternalLink className="h-4 w-4 flex-shrink-0" />
            OpenReview
          </a>
        )}
        {paper.arxivId && (
          <a
            href={`https://arxiv.org/abs/${paper.arxivId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 text-white/60 hover:text-white text-sm transition-all"
          >
            <ExternalLink className="h-4 w-4 flex-shrink-0" />
            arXiv:{paper.arxivId}
          </a>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-white/8 bg-white/[0.02]">
        <SaveButton paperId={paper.id} />
        <span className="text-xs text-white/30">Save to reading list</span>
      </div>

      {/* Authors */}
      {paper.authors.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2.5">Authors</p>
          <div className="space-y-1">
            {paper.authors.map((a, i) => (
              <p key={i} className="text-xs text-white/60 leading-relaxed">{a}</p>
            ))}
          </div>
        </div>
      )}

      {/* BibTeX */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
        <button
          onClick={() => setBibtexOpen(o => !o)}
          className="flex items-center gap-2 w-full px-4 py-3 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <Copy className="h-3.5 w-3.5" />
          {bibtexOpen ? 'Hide citation' : 'Cite this paper'}
        </button>
        {bibtexOpen && (
          <div className="border-t border-white/8 relative">
            <pre className="text-[10px] text-white/40 font-mono leading-relaxed p-4 overflow-x-auto whitespace-pre-wrap break-all">
              {bibtex}
            </pre>
            <button
              onClick={copyBibtex}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white/50 hover:text-white text-[10px] transition-colors"
            >
              {copied ? <><Check className="h-3 w-3 text-green-400" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Method section ──────────────────────────────────────────── */
function MethodSection({ paper }: { paper: Paper }) {
  const [imgError, setImgError] = useState(false)
  const hasImg = !!paper.methodDiagram && !imgError
  const hasDesc = !!paper.methodDescription

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-white/8">
        <BookOpen className="h-4 w-4 text-teal-400" />
        <span className="text-xs font-semibold text-teal-400 uppercase tracking-widest">Method</span>
      </div>

      {/* Body: side-by-side on large screens if both exist */}
      {hasDesc && hasImg ? (
        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 px-6 py-5 border-b lg:border-b-0 lg:border-r border-white/8">
            <p className="text-white/75 text-sm leading-[1.8]">{paper.methodDescription}</p>
          </div>
          <div className="lg:w-[55%] flex items-center justify-center bg-black/20 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={paper.methodDiagram!}
              alt={`Method diagram — ${paper.title}`}
              className="max-h-[440px] w-full object-contain rounded-lg"
              onError={() => setImgError(true)}
            />
          </div>
        </div>
      ) : hasDesc ? (
        <p className="px-6 py-5 text-white/75 text-sm leading-[1.8]">{paper.methodDescription}</p>
      ) : hasImg ? (
        <div className="bg-black/20 p-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={paper.methodDiagram!}
            alt={`Method diagram — ${paper.title}`}
            className="max-h-[480px] w-full object-contain rounded-lg"
            onError={() => setImgError(true)}
          />
        </div>
      ) : null}
    </div>
  )
}

/* ── Mobile links ────────────────────────────────────────────── */
function MobileLinks({ paper }: { paper: Paper }) {
  const isGitHub = paper.codeUrl?.includes('github.com')
  return (
    <div className="flex flex-wrap gap-2">
      {paper.paperUrl && (
        <a href={paper.paperUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <FileText className="h-4 w-4" /> Read Paper
        </a>
      )}
      {paper.codeUrl && (
        <a href={paper.codeUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 border border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <Code2 className="h-4 w-4" /> Code
        </a>
      )}
      {paper.arxivId && (
        <a href={`https://arxiv.org/abs/${paper.arxivId}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 border border-white/10 bg-transparent text-white/60 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors">
          arXiv
        </a>
      )}
      <SaveButton paperId={paper.id} className="ml-auto" />
    </div>
  )
}
