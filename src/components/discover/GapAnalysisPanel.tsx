'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Brain, AlertCircle, Copy, Check, RotateCcw, FileDown, Sparkles } from 'lucide-react'
import type { OpenReviewPaper } from '@/app/api/admin/openreview/route'

type GapStatus = 'idle' | 'loading' | 'done' | 'error'

export interface GapAnalysisState {
  status: GapStatus
  markdown: string
}

interface Props {
  papers: OpenReviewPaper[]
  targetDomain?: string
  // Lifted state — persists across panel close/reopen cycles
  savedState: GapAnalysisState
  onStateChange: (s: GapAnalysisState) => void
  onClose: () => void
  // Called when the API returns 429 quota-exceeded so the parent can show the modal
  onQuotaExceeded?: () => void
  // Optional usage info to show remaining turns in the idle prompt
  usageRemaining?: number
}

export function GapAnalysisPanel({ papers, targetDomain, savedState, onStateChange, onClose, onQuotaExceeded, usageRemaining }: Props) {
  // LOCAL state drives the UI during streaming — avoids re-rendering the entire parent on each chunk.
  // Parent (lifted) state is only written on status transitions: idle → done/error.
  const [localStatus,   setLocalStatus]   = useState<GapStatus>(savedState.status)
  const [localMarkdown, setLocalMarkdown] = useState(savedState.markdown)

  // Sync from parent whenever savedState changes (e.g. reset on new search)
  useEffect(() => {
    setLocalStatus(savedState.status)
    setLocalMarkdown(savedState.markdown)
  }, [savedState.status, savedState.markdown])

  const [error, setError]   = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef      = useRef<AbortController | null>(null)
  const bottomRef     = useRef<HTMLDivElement>(null)
  const autoStartedRef = useRef(false)

  const run = useCallback(async () => {
    setLocalStatus('loading')
    setLocalMarkdown('')
    setError(null)
    onStateChange({ status: 'loading', markdown: '' })

    const ctrl = new AbortController()
    abortRef.current = ctrl

    let accumulated = ''

    try {
      const res = await fetch('/api/openreview/analyze-gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papers, targetDomain }),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string; upgrade?: boolean }
        if (res.status === 429 && d.upgrade) {
          setLocalStatus('idle')
          onStateChange({ status: 'idle', markdown: '' })
          onQuotaExceeded?.()
          return
        }
        throw new Error(d.error ?? 'Analysis failed')
      }

      const reader  = res.body?.getReader()
      if (!reader) throw new Error('No response stream')
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        // Local-only update — smooth streaming without re-rendering parent
        setLocalMarkdown(accumulated)
      }

      setLocalStatus('done')
      // Persist final result to parent so it survives panel close/reopen
      onStateChange({ status: 'done', markdown: accumulated })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError((e as Error).message)
      setLocalStatus('error')
      onStateChange({ status: 'error', markdown: accumulated })
    }
  }, [papers, targetDomain, onStateChange, onQuotaExceeded])

  const status   = localStatus
  const markdown = localMarkdown

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (status === 'loading') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [markdown, status])

  // Auto-start when the panel first opens in idle state with enough papers.
  // The ref guard prevents re-running if the component re-renders while already started.
  // After a completed analysis savedState.status === 'done', so this won't re-fire on reopen.
  useEffect(() => {
    if (
      !autoStartedRef.current &&
      savedState.status === 'idle' &&
      papers.length >= 2 &&
      (usageRemaining === undefined || usageRemaining > 0)
    ) {
      autoStartedRef.current = true
      run()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const exportMarkdown = () => {
    const date = new Date().toISOString().slice(0, 10)
    const domainSlug = targetDomain ? `-${targetDomain.replace(/[^a-z0-9]/gi, '-').toLowerCase()}` : ''
    const filename = `research-gap-analysis${domainSlug}-${date}.md`

    // ── Build the full export document ──────────────────────────────────────
    const paperSection = papers.map((p, i) => {
      const lines: string[] = [
        `### ${i + 1}. ${p.title}`,
        '',
        `| Field | Value |`,
        `|---|---|`,
        `| **Venue** | ${p.venue} ${p.year} |`,
        `| **Authors** | ${p.authors.join(', ')} |`,
        `| **Primary Area** | ${p.primaryArea ?? '—'} |`,
        `| **Keywords** | ${p.keywords.slice(0, 8).join(', ')} |`,
        `| **OpenReview** | [View paper](${p.openReviewUrl}) |`,
      ]
      if (p.paperUrl && p.paperUrl !== p.openReviewUrl) {
        lines.push(`| **PDF / Code** | [Link](${p.paperUrl}) |`)
      }
      // Detect GitHub from abstract
      const ghMatch = p.abstract.match(/https?:\/\/github\.com\/[^\s\)\"\']+/)
      if (ghMatch) lines.push(`| **GitHub** | [${ghMatch[0]}](${ghMatch[0]}) |`)

      lines.push('', `**Abstract:** ${p.abstract}`, '')
      return lines.join('\n')
    }).join('\n---\n\n')

    const doc = [
      `# Research Gap Analysis Report`,
      ``,
      `> Generated: ${new Date().toLocaleString()}${targetDomain ? `  \n> Domain: **${targetDomain}**` : ''}  `,
      `> Papers analyzed: **${papers.length}**`,
      ``,
      `---`,
      ``,
      `## Papers Analyzed`,
      ``,
      paperSection,
      `---`,
      ``,
      `## AI Analysis`,
      ``,
      markdown,
      ``,
      `---`,
      ``,
      `*Report generated by [Research Blog](/) · Powered by OpenAI*`,
    ].join('\n')

    const blob = new Blob([doc], { type: 'text/markdown;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const isStreaming = status === 'loading'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Brain className={`h-4 w-4 ${isStreaming ? 'text-purple-400 animate-pulse' : 'text-purple-400'}`} />
          <div>
            <h3 className="text-sm font-semibold text-white leading-none">Research Gap Analysis</h3>
            <p className="text-[10px] text-white/35 mt-0.5">
              {isStreaming
                ? `Analyzing ${papers.length} papers${targetDomain ? ` · ${targetDomain}` : ''}…`
                : `${papers.length} papers${targetDomain ? ` · ${targetDomain}` : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {status === 'done' && (
            <>
              <button
                onClick={() => run()}
                title="Re-run analysis"
                className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20"
              >
                {copied
                  ? <><Check className="h-3 w-3 text-emerald-400" /> Copied</>
                  : <><Copy className="h-3 w-3" /> Copy</>}
              </button>
              <button
                onClick={exportMarkdown}
                title="Download full report as Markdown"
                className="flex items-center gap-1 text-[10px] text-emerald-400/70 hover:text-emerald-300 transition-colors px-2 py-1 rounded border border-emerald-500/20 hover:border-emerald-400/40 bg-emerald-500/5 hover:bg-emerald-500/10"
              >
                <FileDown className="h-3 w-3" /> Export .md
              </button>
            </>
          )}
          {isStreaming && (
            <button onClick={() => {
              abortRef.current?.abort()
              setLocalStatus('done')
              onStateChange({ status: 'done', markdown })
            }}
              className="text-[10px] text-white/30 hover:text-red-400 transition-colors px-2 py-1 rounded border border-white/10 hover:border-red-400/30">
              Stop
            </button>
          )}
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors p-1 ml-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {status === 'idle' ? (
          /* Not yet started — explicit user action required to prevent surprise costs */
          <div className="flex flex-col items-center justify-center h-full gap-5 px-8 text-center">
            <div className={`rounded-2xl p-4 ${usageRemaining === 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-purple-500/10 border border-purple-500/20'}`}>
              <Brain className={`h-8 w-8 mx-auto ${usageRemaining === 0 ? 'text-amber-400' : 'text-purple-400'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">Ready to analyze {papers.length} papers</p>
              <p className="text-xs text-white/40 leading-relaxed">
                The AI will identify common methods, datasets, limitations,<br/>
                underexplored domains, and research directions.
              </p>
              {targetDomain && (
                <p className="text-[11px] text-purple-400/70 mt-1.5">Domain: {targetDomain}</p>
              )}
              {usageRemaining !== undefined && (
                <p className={`text-[11px] mt-2 font-medium ${usageRemaining === 0 ? 'text-amber-400' : 'text-white/30'}`}>
                  {usageRemaining === 0 ? 'No turns remaining this month' : `${usageRemaining} turn${usageRemaining === 1 ? '' : 's'} remaining`}
                </p>
              )}
            </div>
            {usageRemaining === 0 ? (
              <button
                onClick={onQuotaExceeded}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Upgrade to analyze
              </button>
            ) : (
              <button
                onClick={run}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Start Analysis
              </button>
            )}
            <p className="text-[10px] text-white/25">Uses OpenAI · results saved for this session</p>
          </div>
        ) : status === 'error' ? (
          <div className="m-5 flex items-start gap-3 rounded-xl bg-red-500/8 border border-red-500/20 p-4 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Analysis failed</p>
              <p className="text-xs text-red-400/70">{error}</p>
              <button onClick={run} className="mt-3 text-xs text-red-400 hover:text-red-300 underline">
                Try again
              </button>
            </div>
          </div>
        ) : markdown ? (
          <div className="p-5">
            <StreamMarkdown content={markdown} streaming={isStreaming} />
            <div ref={bottomRef} />
          </div>
        ) : (
          /* Thinking skeleton — shown while waiting for first chunk */
          <div className="p-5 space-y-3">
            <ThinkingIndicator />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Thinking indicator (shown before first chunk) ───────────────────────────

function ThinkingIndicator() {
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-purple-400/60"
              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
        <span className="text-xs text-white/40">Reading papers and identifying patterns…</span>
      </div>

      {/* Skeleton lines */}
      {[
        'w-1/3', 'w-full', 'w-5/6', 'w-full', 'w-4/5',
        'w-1/3', 'w-full', 'w-3/4',
      ].map((w, i) => (
        <div
          key={i}
          className={`h-2.5 rounded-full bg-white/[0.06] ${w}`}
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Streaming markdown renderer ─────────────────────────────────────────────

function StreamMarkdown({ content, streaming }: { content: string; streaming?: boolean }) {
  const lines = content.split('\n')

  return (
    <div className="space-y-0.5 text-[13px] leading-relaxed">
      {lines.map((line, i) => {
        const isLast = i === lines.length - 1
        // Last few lines fade in while streaming for a smooth ChatGPT feel
        const fadeClass = streaming && i >= lines.length - 3 ? 'stream-line' : ''

        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className={`text-white font-bold text-[11px] uppercase tracking-[0.12em] mt-6 mb-2 first:mt-0 pb-1 border-b border-white/10 ${fadeClass}`}>
              {line.slice(3)}
              {isLast && streaming && <Cursor />}
            </h2>
          )
        }
        if (line.startsWith('### ')) {
          return (
            <h3 key={i} className={`text-white/85 font-semibold text-xs mt-4 mb-1.5 ${fadeClass}`}>
              {line.slice(4)}{isLast && streaming && <Cursor />}
            </h3>
          )
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className={`flex items-start gap-2.5 py-0.5 ${fadeClass}`}>
              <span className="flex-shrink-0 mt-[7px] h-1 w-1 rounded-full bg-purple-400/50" />
              <span className="text-white/65 text-[12px] leading-relaxed flex-1"
                dangerouslySetInnerHTML={{ __html: renderInline(line.slice(2)) + (isLast && streaming ? '<span class="cursor-blink">▋</span>' : '') }} />
            </div>
          )
        }
        if (/^\d+\. /.test(line)) {
          const num = line.match(/^(\d+)\. /)?.[1]
          return (
            <div key={i} className={`flex items-start gap-2.5 py-0.5 ${fadeClass}`}>
              <span className="flex-shrink-0 text-[10px] font-bold text-purple-400/60 mt-1 w-4 text-right">{num}.</span>
              <span className="text-white/65 text-[12px] leading-relaxed flex-1"
                dangerouslySetInnerHTML={{ __html: renderInline(line.replace(/^\d+\. /, '')) + (isLast && streaming ? '<span class="cursor-blink">▋</span>' : '') }} />
            </div>
          )
        }
        if (line.trim() === '') return <div key={i} className="h-2" />
        return (
          <p key={i} className={`text-white/60 text-[12px] leading-relaxed ${fadeClass}`}
            dangerouslySetInnerHTML={{ __html: renderInline(line) + (isLast && streaming ? '<span class="cursor-blink">▋</span>' : '') }} />
        )
      })}

      <style>{`
        .cursor-blink {
          display: inline-block;
          color: rgb(192 132 252 / 0.8);
          animation: cursor-flash 0.7s ease-in-out infinite;
          font-size: 0.8em;
          line-height: 1;
          vertical-align: middle;
          margin-left: 1px;
        }
        @keyframes cursor-flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .stream-line {
          animation: stream-fade 0.25s ease-out forwards;
        }
        @keyframes stream-fade {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function Cursor() {
  return (
    <span className="inline-block ml-1 text-purple-400/70 text-sm"
      style={{ animation: 'cursor-flash 0.7s ease-in-out infinite' }}>▋</span>
  )
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:rgba(255,255,255,0.88);font-weight:600">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:rgba(255,255,255,0.65)">$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.07);padding:1px 5px;border-radius:4px;font-size:0.85em;color:rgb(147,197,253)">$1</code>')
}
