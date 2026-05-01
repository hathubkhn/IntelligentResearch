#!/usr/bin/env node
import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

/**
 * Normalize venue names by removing year suffix
 * "ACL 2024" → "ACL"
 * "EMNLP 2023" → "EMNLP"
 * "ICLR" → "ICLR" (unchanged)
 */

async function main() {
  console.log('🔍 Fetching papers with year suffix in venue...')
  
  // Find papers where venue ends with a year (space + 4 digits)
  const papers = await sql`
    SELECT id, venue, year 
    FROM "Paper" 
    WHERE venue ~ '\\s+\\d{4}$'
    ORDER BY venue
  `
  
  console.log(`Found ${papers.length} papers to normalize:`)
  
  // Group by old venue name
  const grouped = papers.reduce((acc, p) => {
    if (!acc[p.venue]) acc[p.venue] = []
    acc[p.venue].push(p.id)
    return acc
  }, {})
  
  for (const [oldVenue, ids] of Object.entries(grouped)) {
    const newVenue = oldVenue.replace(/\s+\d{4}$/, '').trim()
    console.log(`  "${oldVenue}" → "${newVenue}" (${ids.length} papers)`)
  }
  
  console.log('\n🔧 Updating venue names...')
  
  let updated = 0
  for (const [oldVenue] of Object.entries(grouped)) {
    const newVenue = oldVenue.replace(/\s+\d{4}$/, '').trim()
    const result = await sql`
      UPDATE "Paper" 
      SET venue = ${newVenue}
      WHERE venue = ${oldVenue}
    `
    updated += result.length
  }
  
  console.log(`\n✅ Updated ${updated} papers`)
  
  // Show distinct venues after normalization
  const distinct = await sql`
    SELECT DISTINCT venue 
    FROM "Paper" 
    WHERE venue IS NOT NULL
    ORDER BY venue
  `
  
  console.log('\n📋 Distinct venues after normalization:')
  distinct.forEach(r => console.log(`  - ${r.venue}`))
  
  process.exit(0)
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
