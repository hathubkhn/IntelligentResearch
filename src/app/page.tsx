import Link from 'next/link'
import {
  ArrowRight, Layers, Compass, BookMarked, Library,
  Sparkles, Trophy, BarChart3, GitFork, FileSearch,
  Lightbulb, BookOpen, TrendingUp, Newspaper, Search,
  FolderOpen, FileText, MessageSquare, Database,
  CheckCircle2, Zap,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { PaperCard } from '@/components/paper/PaperCard'
import type { Paper } from '@/types/paper'

export const dynamic = 'force-dynamic'

async function getHomeData() {
  try {
    const [recentPapers, collections, totalPapers, totalCollections] = await Promise.all([
      prisma.paper.findMany({
        where: { status: 'DONE' },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.collection.findMany({
        where: { userId: null },
        orderBy: { createdAt: 'desc' },
        take: 4,
        include: { _count: { select: { papers: true } } },
      }),
      prisma.paper.count(),
      prisma.collection.count({ where: { userId: null } }),
    ])
    return { recentPapers, collections, totalPapers, totalCollections, error: false }
  } catch {
    return { recentPapers: [], collections: [], totalPapers: 0, totalCollections: 0, error: true }
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FeatureItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-current opacity-70" />
      </span>
      <span className="text-sm leading-snug">{text}</span>
    </li>
  )
}

function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center px-6 py-4">
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-xs text-white/35 mt-0.5">{label}</p>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const { recentPapers, collections, totalPapers, totalCollections, error } = await getHomeData()

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-32 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white/5 border border-white/10 mb-6 mx-auto">
          <BookOpen className="h-7 w-7 text-white/30" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Intelligence Research Hub</h1>
        <p className="text-white/40 mb-8">Database is temporarily unreachable. Please try again in a moment.</p>
        <Link href="/discover" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors">
          Browse Discover <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="overflow-x-hidden">

      {/* ═══════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════ */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-blue-600/8 blur-3xl" />
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white mb-5 tracking-tight leading-tight">
          Your AI Research<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400">
            Intelligence Hub
          </span>
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Discover papers from top AI conferences, extract benchmarks, manage your reading list
          with AI summaries, and explore a curated library of {totalPapers.toLocaleString()}+ papers.
        </p>

        {/* CTA buttons */}
        <div className="flex items-center justify-center gap-3 flex-wrap mb-14">
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02]"
          >
            <Compass className="h-4 w-4" /> Start Discovering
          </Link>
          <Link
            href="/papers"
            className="inline-flex items-center gap-2 border border-slate-700/80 bg-slate-900/60 hover:border-slate-600 text-slate-300 hover:text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            <Library className="h-4 w-4" /> Browse Papers
          </Link>
        </div>

        {/* Stats row */}
        <div className="inline-flex items-stretch divide-x divide-white/8 rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-sm overflow-hidden">
          <StatBadge value={`${totalPapers.toLocaleString()}+`} label="Papers with AI summaries" />
          <StatBadge value={`${totalCollections}+`}             label="Curated collections" />
          <StatBadge value="10+"                                label="Top AI conferences" />
          <StatBadge value="Daily"                              label="Trending updates" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          THREE FEATURE PILLARS
      ═══════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-white/30 font-semibold mb-2">What you can do</p>
          <h2 className="text-3xl font-bold text-white">Three pillars of research intelligence</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── PILLAR 1: Research Discovery ── */}
          <div className="group relative rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-950/40 to-slate-900/60 backdrop-blur-sm p-7 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/8 transition-all">
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 to-transparent" />

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/25">
                <Compass className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-blue-400/70 font-bold mb-0.5">Research Discovery</p>
                <h3 className="text-lg font-bold text-white leading-tight">Explore New Topics Fast</h3>
              </div>
            </div>

            <p className="text-sm text-white/50 leading-relaxed mb-6">
              Jump into any research area and instantly surface relevant papers from top AI conferences,
              extract benchmark leaderboards, and find research gaps — all in one place.
            </p>

            <ul className="space-y-2.5 text-blue-200/70 mb-7">
              <FeatureItem icon={Search}     text="Semantic search across NeurIPS, ICLR, ACL, EMNLP and more" />
              <FeatureItem icon={Trophy}     text="Step-by-step benchmark leaderboard extraction from PDFs" />
              <FeatureItem icon={BarChart3}  text="Filter by AI method, application domain, and research task" />
              <FeatureItem icon={Lightbulb}  text="Research gap analysis with streaming AI insights" />
              <FeatureItem icon={GitFork}    text="Cross-domain knowledge transfer suggestions" />
            </ul>

            <Link
              href="/discover"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors group-hover:gap-2.5"
            >
              Open Discover <ArrowRight className="h-4 w-4 transition-all" />
            </Link>
          </div>

          {/* ── PILLAR 2: Intelligent Reading List ── */}
          <div className="group relative rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-950/40 to-slate-900/60 backdrop-blur-sm p-7 hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-500/8 transition-all">
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/5 to-transparent" />

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/25">
                <BookMarked className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-purple-400/70 font-bold mb-0.5">Reading List Intelligence</p>
                <h3 className="text-lg font-bold text-white leading-tight">Manage Papers Smartly</h3>
              </div>
            </div>

            <p className="text-sm text-white/50 leading-relaxed mb-6">
              Your personal AI-powered research workspace. Save papers into private collections,
              get instant summaries, and generate research reports and questions from selected papers.
            </p>

            <ul className="space-y-2.5 text-purple-200/70 mb-7">
              <FeatureItem icon={FolderOpen}    text="Organize papers into private collections only you can see" />
              <FeatureItem icon={Sparkles}      text="AI-generated summaries: TLDR, key ideas, contributions" />
              <FeatureItem icon={FileSearch}    text="Semantic search — 'find papers about RAG in time series'" />
              <FeatureItem icon={FileText}      text="Select papers and extract a structured research report" />
              <FeatureItem icon={MessageSquare} text="Generate research questions from your saved papers" />
            </ul>

            <Link
              href="/saved"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-400 hover:text-purple-300 transition-colors group-hover:gap-2.5"
            >
              Open Reading List <ArrowRight className="h-4 w-4 transition-all" />
            </Link>
          </div>

          {/* ── PILLAR 3: Curated Paper Library ── */}
          <div className="group relative rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/40 to-slate-900/60 backdrop-blur-sm p-7 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/8 transition-all">
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-transparent" />

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/25">
                <Library className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-emerald-400/70 font-bold mb-0.5">Curated Library</p>
                <h3 className="text-lg font-bold text-white leading-tight">High-Value Paper Database</h3>
              </div>
            </div>

            <p className="text-sm text-white/50 leading-relaxed mb-6">
              A growing, curated library of {totalPapers.toLocaleString()}+ AI research papers — all with structured
              AI summaries — plus trending research blogs updated every day to keep you current.
            </p>

            <ul className="space-y-2.5 text-emerald-200/70 mb-7">
              <FeatureItem icon={Database}    text={`${totalPapers.toLocaleString()}+ papers with structured AI summaries`} />
              <FeatureItem icon={Layers}      text={`${totalCollections} public collections curated by domain experts`} />
              <FeatureItem icon={TrendingUp}  text="Trending papers ranked by recency and citation signals" />
              <FeatureItem icon={Newspaper}   text="Daily research blog updates across CV, NLP, RL, and more" />
              <FeatureItem icon={CheckCircle2} text="Covers NeurIPS, ICLR, ICML, ACL, EMNLP, CVPR & more" />
            </ul>

            <Link
              href="/papers"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors group-hover:gap-2.5"
            >
              Browse Library <ArrowRight className="h-4 w-4 transition-all" />
            </Link>
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          HOW IT WORKS (Quick workflow)
      ═══════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/8">
            {[
              {
                step: '01',
                icon: Compass,
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                title: 'Discover & Search',
                desc: 'Enter a topic, pick a conference and year. Get ranked papers, benchmarks, and research gaps in minutes.',
              },
              {
                step: '02',
                icon: BookMarked,
                color: 'text-purple-400',
                bg: 'bg-purple-500/10',
                title: 'Save & Organize',
                desc: 'Bookmark papers into private collections. AI auto-generates summaries, key ideas, and contributions.',
              },
              {
                step: '03',
                icon: Zap,
                color: 'text-amber-400',
                bg: 'bg-amber-500/10',
                title: 'Extract & Report',
                desc: 'Select papers from your list, extract a structured report, generate research questions, and export BibTeX.',
              },
            ].map(({ step, icon: Icon, color, bg, title, desc }) => (
              <div key={step} className="flex items-start gap-4 p-7">
                <div className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-white/20 mb-1">STEP {step}</p>
                  <h4 className="font-semibold text-white text-sm mb-1">{title}</h4>
                  <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          FEATURED COLLECTIONS
      ═══════════════════════════════════════════════════ */}
      {collections.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-1">Library</p>
              <h2 className="text-xl font-bold text-white">Featured Collections</h2>
            </div>
            <Link href="/collections" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(collections as Array<typeof collections[number] & { _count: { papers: number } }>).map((col) => (
              <Link key={col.id} href={`/collections/${col.id}`} className="group">
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm p-5 hover:border-slate-700 hover:shadow-lg hover:shadow-blue-500/5 transition-all h-full">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 mb-3">
                    <Layers className="h-4 w-4 text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-white text-sm line-clamp-2 mb-1 group-hover:text-blue-300 transition-colors">
                    {col.name}
                  </h3>
                  <p className="text-xs text-white/35">{col._count.papers} papers</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════
          RECENT PAPERS
      ═══════════════════════════════════════════════════ */}
      {recentPapers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 pb-20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-1">Latest additions</p>
              <h2 className="text-xl font-bold text-white">Recently Added Papers</h2>
            </div>
            <Link href="/papers" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              View all {totalPapers.toLocaleString()} papers <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recentPapers.map((paper) => (
              <PaperCard key={paper.id} paper={paper as unknown as Paper} />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
