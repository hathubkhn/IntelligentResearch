import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { summarizePaperJob } from '@/inngest/summarize'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [summarizePaperJob],
})
