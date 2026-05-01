import { Redis } from '@upstash/redis'

let redis: Redis | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try { return await redis.get<T>(key) } catch { return null }
}

export async function setCached<T>(key: string, value: T, ttl = 60): Promise<void> {
  if (!redis) return
  try { await redis.set(key, value, { ex: ttl }) } catch {}
}

export async function invalidatePattern(pattern: string): Promise<void> {
  if (!redis) return
  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) await redis.del(...keys)
  } catch {}
}
