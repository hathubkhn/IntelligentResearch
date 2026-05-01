import * as React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'tier1' | 'tier2' | 'tier3' | 'preprint' | 'default'
}

const variantClasses = {
  tier1: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  tier2: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  tier3: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  preprint: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  default: 'bg-white/10 text-white/70 border-white/20',
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
