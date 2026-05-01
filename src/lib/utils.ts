import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const CATEGORY_COLORS: Record<string, string> = {
  'Tool Use': 'from-violet-500 to-purple-600',
  'Planning': 'from-blue-500 to-cyan-600',
  'Feedback Learning': 'from-emerald-500 to-teal-600',
  'Composition': 'from-orange-500 to-amber-600',
  'World Modeling': 'from-pink-500 to-rose-600',
  'Benchmarks': 'from-slate-500 to-gray-600',
  'Surveys': 'from-blue-500 to-blue-600',
  'General': 'from-gray-500 to-slate-600',
}

export const VENUE_TIERS = {
  tier1: ['NeurIPS', 'ICML', 'ICLR', 'ACL', 'EMNLP', 'NAACL'],
  tier2: ['AAAI', 'COLING', 'EACL', 'COLM', 'TMLR'],
  tier3: ['workshop', 'findings', 'Findings'],
  preprint: ['arXiv', 'under review'],
}

export function getVenueTier(venue: string | null): 'tier1' | 'tier2' | 'tier3' | 'preprint' | null {
  if (!venue) return null
  for (const [tier, venues] of Object.entries(VENUE_TIERS)) {
    if (venues.some(v => venue.toLowerCase().includes(v.toLowerCase()))) {
      return tier as 'tier1' | 'tier2' | 'tier3' | 'preprint'
    }
  }
  return null
}

export function getCategoryColor(category: string | null): string {
  if (!category) return CATEGORY_COLORS['General']
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS['General']
}

export function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return 'Unknown'
  if (authors.length <= 3) return authors.join(', ')
  return `${authors.slice(0, 3).join(', ')} et al.`
}

export function formatDistanceToNow(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}
