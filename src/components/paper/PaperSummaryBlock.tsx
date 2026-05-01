import { Zap, HelpCircle, Lightbulb, BarChart2, Sparkles } from 'lucide-react'
import type { Paper } from '@/types/paper'

export function PaperSummaryBlock({ paper }: { paper: Paper }) {
  return (
    <div className="space-y-4">

      {/* TL;DR — gradient hero */}
      {paper.tldr && (
        <div className="relative rounded-2xl overflow-hidden">
          {/* layered bg */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/15 via-slate-950/40 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
          <div className="relative border border-blue-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.15em]">TL;DR</span>
            </div>
            <p className="text-white text-[0.95rem] leading-[1.75] font-[450]">{paper.tldr}</p>
          </div>
        </div>
      )}

      {/* Problem + Key Idea — 2 col */}
      {(paper.problem || paper.keyIdea) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {paper.problem && (
            <InfoCard
              icon={<HelpCircle className="h-3.5 w-3.5" />}
              label="Problem"
              color="amber"
            >
              {paper.problem}
            </InfoCard>
          )}
          {paper.keyIdea && (
            <InfoCard
              icon={<Lightbulb className="h-3.5 w-3.5" />}
              label="Key Idea"
              color="emerald"
            >
              {paper.keyIdea}
            </InfoCard>
          )}
        </div>
      )}

      {/* Results */}
      {paper.results && (
        <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.15em]">Results</span>
          </div>
          <p className="text-white/80 text-sm leading-[1.75]">{paper.results}</p>
        </div>
      )}

      {/* Contributions */}
      {paper.contributions.length > 0 && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-[0.15em]">Contributions</span>
          </div>
          <ol className="space-y-3.5">
            {paper.contributions.map((c, i) => (
              <li key={i} className="flex items-start gap-3.5">
                <span className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-[10px] font-bold text-violet-400 leading-none">
                  {i + 1}
                </span>
                <span className="text-white/70 text-sm leading-[1.7]">{c}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

const colorMap = {
  amber: {
    border: 'border-amber-500/15',
    bg: 'bg-amber-500/[0.04]',
    icon: 'text-amber-400',
    label: 'text-amber-400',
  },
  emerald: {
    border: 'border-emerald-500/15',
    bg: 'bg-emerald-500/[0.04]',
    icon: 'text-emerald-400',
    label: 'text-emerald-400',
  },
}

function InfoCard({
  icon,
  label,
  color,
  children,
}: {
  icon: React.ReactNode
  label: string
  color: keyof typeof colorMap
  children: string
}) {
  const c = colorMap[color]
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-5 flex flex-col gap-3`}>
      <div className={`flex items-center gap-2 ${c.icon}`}>
        {icon}
        <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${c.label}`}>{label}</span>
      </div>
      <p className="text-white/70 text-sm leading-[1.75] flex-1">{children}</p>
    </div>
  )
}
