import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'

// One-time setup endpoint to hash the admin password
// POST { password: "..." } → returns { hash: "..." }
// Then set ADMIN_PASSWORD_HASH in .env
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not available in production' }, { status: 403 })
  }
  const { password } = await request.json()
  if (!password) return Response.json({ error: 'password required' }, { status: 400 })
  const hash = await bcrypt.hash(password, 12)
  return Response.json({ hash })
}
