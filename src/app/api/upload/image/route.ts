import { NextRequest } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED.includes(file.type)) {
    return Response.json({ error: 'Unsupported file type' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'png'
  const filename = `${randomUUID()}.${ext}`
  const dest = join(process.cwd(), 'public', 'uploads', filename)

  const bytes = await file.arrayBuffer()
  await writeFile(dest, Buffer.from(bytes))

  return Response.json({ url: `/uploads/${filename}` })
}
