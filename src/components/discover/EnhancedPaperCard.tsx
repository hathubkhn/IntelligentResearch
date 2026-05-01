'use client'

import { useState } from 'react'
import { CheckSquare, Square, ExternalLink, Code, Database, ChevronDown, ChevronUp } from 'lucide-react'
import { VENUE_TIERS } from '@/lib/discover-config'
import type { OpenReviewPaper } from '@/app/api/admin/openreview/route'

// Detect method tags from keywords
const METHOD_PATTERNS: [string, string][] = [
  ['GNN', /\b(gnn|graph neural|graph attention|graph convolution|message passing)\b/i],
  ['Diffusion', /\bdiffusion\b/i],
  ['LLM', /\b(llm|large language|gpt|instruction tun|in-context)\b/i],
  ['RL', /\b(reinforcement learning|policy gradient|reward|PPO|MCTS)\b/i],
  ['ViT', /\b(vision transformer|vit|image-text|CLIP)\b/i],
  ['Multimodal', /\bmultimodal\b/i],
  ['RAG', /\b(retrieval augment|rag|dense retrieval)\b/i],
  ['PINN', /\bphysics.informed\b/i],
  ['Contrastive', /\bcontrastive\b/i],
  ['Federated', /\bfederated\b/i],
  ['Bayesian', /\bbayesian\b/i],
  ['Diffusion', /\bscore matching\b/i],
  ['Foundation', /\bfoundation model\b/i],
  ['AutoML', /\b(neural architecture search|nas)\b/i],
]

function extractMethodTags(keywords: string[], abstract: string): string[] {
  const text = [...keywords, abstract].join(' ')
  const found = new Set<string>()
  for (const [tag, pattern] of METHOD_PATTERNS) {
    if (pattern.test(text)) found.add(tag)
  }
  return [...found].slice(0, 5)
}

function hasCodeLink(paper: OpenReviewPaper): boolean {
  return Boolean(paper.paperUrl?.includes('github') || paper.abstract?.toLowerCase().includes('github') || paper.keywords?.some(k => k.toLowerCase().includes('code')))
}

const TIER_STYLES: Record<string, string> = {
  gold:   'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  silver: 'bg-slate-400/15 text-slate-300 border-slate-400/25',
  bronze: 'bg-orange-600/10 text-orange-400/80 border-orange-600/20',
}

interface Props {
  paper: OpenReviewPaper
  selected: boolean
  onToggle: () => void
}

export function EnhancedPaperCard({ paper, selected, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false)
  const methodTags = extractMethodTags(paper.keywords, paper.abstract)
  const codeAvailable = hasCodeLink(paper)
  const tier = VENUE_TIERS[paper.venue?.toUpperCase()] ?? 'bronze'

  return (
    <div className={`rounded-xl border transition-colors ${
      selected ? 'border-blue-500/30 bg-blue-500/[0.05]' : 'border-white/8 bg-white/[0.02] hover:border-white/14'
    }`}>
      <div className="flex items-start gap-3 p-4">
        {/* Checkbox */}
        <button
          type="button"
          onClick={onToggle}
          className="flex-shrink-0 mt-0.5 text-white/40 hover:text-blue-400 transition-colors"
        >
          {selected
            ? <CheckSquare className="h-4 w-4 text-blue-400" />
            : <Square className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start gap-2 mb-1.5">
            <p className="text-sm font-semibold text-white/90 leading-snug flex-1">{paper.title}</p>
            {paper.score > 0 && (
              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono">
                {paper.score}pt
              </span>
            )}
          </div>

          {/* Meta row: venue + year + authors */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${TIER_STYLES[tier]}`}>
              {paper.venue} {paper.year}
            </span>
            <span className="text-[10px] text-white/30 truncate max-w-[250px]">
              {paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : ''}
            </span>
            {codeAvailable && (
              <span className="flex items-center gap-0.5 text-[9px] text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/15 px-1.5 py-0.5 rounded">
                <Code className="h-2.5 w-2.5" /> Code
              </span>
            )}
          </div>

          {/* Primary area */}
          {paper.primaryArea && (
            <p className="text-[10px] text-violet-400/70 mb-1.5 leading-snug">{paper.primaryArea}</p>
          )}

          {/* Abstract */}
          <p className={`text-xs text-white/40 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
            {paper.abstract}
          </p>

          {/* Method tags + data availability + links */}
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            {methodTags.map(tag => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/8 border border-blue-500/15 text-blue-300/70">
                {tag}
              </span>
            ))}
            {paper.keywords.slice(0, 3).map(kw => (
              <span key={kw} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/25">
                {kw.length > 24 ? kw.slice(0, 22) + '…' : kw}
              </span>
            ))}

            <div className="ml-auto flex items-center gap-2">
              {paper.abstract.length > 150 && (
                <button
                  type="button"
                  onClick={() => setExpanded(e => !e)}
                  className="flex items-center gap-0.5 text-[10px] text-white/25 hover:text-white/50 transition-colors"
                >
                  {expanded ? <><ChevronUp className="h-3 w-3" /> Less</> : <><ChevronDown className="h-3 w-3" /> More</>}
                </button>
              )}
              <a
                href={paper.openReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-0.5 text-[10px] text-white/25 hover:text-blue-400 transition-colors"
              >
                <ExternalLink className="h-2.5 w-2.5" /> OpenReview
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
