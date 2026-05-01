import { Badge } from '@/components/ui/badge'
import { getVenueTier } from '@/lib/utils'

interface PaperBadgeProps {
  venue: string | null
  year?: number | null
  category?: string | null
}

export function PaperBadge({ venue, year, category }: PaperBadgeProps) {
  const tier = getVenueTier(venue)

  return (
    <div className="flex flex-wrap gap-1.5">
      {venue && (
        <Badge variant={tier ?? 'default'}>
          {venue}
        </Badge>
      )}
      {year && (
        <Badge variant="default">{year}</Badge>
      )}
      {category && (
        <Badge variant="default">{category}</Badge>
      )}
    </div>
  )
}
