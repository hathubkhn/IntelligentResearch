'use client'

import { FileText, Code2, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface PaperLinksProps {
  paperUrl?: string | null
  codeUrl?: string | null
  title?: string
  venue?: string | null
  year?: number | null
  authors?: string[]
  arxivId?: string | null
}

export function PaperLinks({ paperUrl, codeUrl, title, venue, year, authors = [], arxivId }: PaperLinksProps) {
  const bibtex = `@article{${title?.split(' ')[0]?.toLowerCase() ?? 'paper'}${year ?? ''},
  title={${title ?? ''}},
  author={${authors.join(' and ')}},
  year={${year ?? ''}},
  ${venue ? `booktitle={${venue}},` : ''}
  ${arxivId ? `eprint={${arxivId}},` : ''}
}`

  const copyBibtex = () => {
    navigator.clipboard.writeText(bibtex).then(() => toast.success('BibTeX copied!'))
  }

  return (
    <div className="flex flex-wrap gap-2">
      {paperUrl && (
        <Button variant="outline" size="sm" asChild>
          <a href={paperUrl} target="_blank" rel="noopener noreferrer" aria-label="View paper">
            <FileText className="h-4 w-4" />
            Paper
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </Button>
      )}
      {codeUrl && (
        <Button variant="outline" size="sm" asChild>
          <a href={codeUrl} target="_blank" rel="noopener noreferrer" aria-label="View code">
            <Code2 className="h-4 w-4" />
            Code
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </Button>
      )}
      {title && (
        <Button variant="ghost" size="sm" onClick={copyBibtex} aria-label="Copy BibTeX citation">
          <Copy className="h-4 w-4" />
          Cite
        </Button>
      )}
    </div>
  )
}
