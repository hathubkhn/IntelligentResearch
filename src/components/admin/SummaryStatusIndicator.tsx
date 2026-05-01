import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'
import type { SummaryStatus } from '@/types/paper'

interface SummaryStatusIndicatorProps {
  status: SummaryStatus
  className?: string
}

export function SummaryStatusIndicator({ status, className }: SummaryStatusIndicatorProps) {
  switch (status) {
    case 'DONE':
      return <CheckCircle2 className={`h-4 w-4 text-emerald-400 ${className}`} />
    case 'ERROR':
      return <XCircle className={`h-4 w-4 text-red-400 ${className}`} />
    case 'PROCESSING':
      return <Loader2 className={`h-4 w-4 text-blue-400 animate-spin ${className}`} />
    case 'PENDING':
      return <Clock className={`h-4 w-4 text-amber-400 ${className}`} />
  }
}
