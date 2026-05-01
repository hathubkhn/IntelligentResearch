import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { config } from 'dotenv'

config()

const sql = neon(process.env.DATABASE_URL)
const migration = readFileSync(
  'prisma/migrations/20260428000002_add_subscriptions/migration.sql',
  'utf8'
)

// Split on semicolons, keeping DO $$ ... $$ blocks intact
const statements = []
let current = ''
let inDollarQuote = false

for (const line of migration.split('\n')) {
  const trimmed = line.trim()
  if (trimmed.startsWith('--')) { current += '\n'; continue }
  if (trimmed.includes('$$')) inDollarQuote = !inDollarQuote
  current += line + '\n'
  if (!inDollarQuote && trimmed.endsWith(';')) {
    const stmt = current.trim()
    if (stmt) statements.push(stmt)
    current = ''
  }
}

console.log(`Applying ${statements.length} statements…`)
for (const stmt of statements) {
  try {
    await sql.query(stmt)
    console.log('  OK:', stmt.slice(0, 60).replace(/\n/g, ' '))
  } catch (e) {
    if (e.message.includes('already exists') || e.message.includes('duplicate')) {
      console.log('  SKIP (already exists):', stmt.slice(0, 60).replace(/\n/g, ' '))
    } else {
      console.error('  ERR:', e.message, '\n  STMT:', stmt.slice(0, 120))
    }
  }
}
console.log('Done.')
