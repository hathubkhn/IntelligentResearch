export type SummaryStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'ERROR'
export type VenueType = 'CONFERENCE' | 'JOURNAL' | 'PREPRINT' | 'WORKSHOP'

export interface Paper {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  authors: string[]
  year: number | null
  venue: string | null
  venueType: VenueType | null
  category: string | null
  tags: string[]
  isPublished: boolean
  paperUrl: string | null
  codeUrl: string | null
  openReviewUrl: string | null
  arxivId: string | null
  rawInput: string
  tldr: string | null
  problem: string | null
  keyIdea: string | null
  results: string | null
  contributions: string[]
  methodDiagram: string | null
  methodDescription: string | null
  coverColor: string | null
  status: SummaryStatus
  errorMessage: string | null
  collectionId: string | null
  collection?: Collection | null
}

export interface Collection {
  id: string
  createdAt: string
  name: string
  description: string | null
  sourceUrl: string | null
  papers?: Paper[]
}

export interface ParsedPaper {
  title: string
  venue: string | null
  year: number | null
  paperUrl: string | null
  codeUrl: string | null
  category: string
  isPublished: boolean
  rawInput: string
}

export interface SummaryResult {
  tldr: string
  problem: string
  keyIdea: string
  results: string
  methodDescription: string
  contributions: string[]
  tags: string[]
}
