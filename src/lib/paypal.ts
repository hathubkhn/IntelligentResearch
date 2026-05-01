/**
 * PayPal REST API helpers (server-side only).
 * Credentials: PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET in .env
 * Sandbox vs live is determined by PAYPAL_MODE ('sandbox' | 'live'), default sandbox.
 */

const MODE    = process.env.PAYPAL_MODE ?? 'sandbox'
const BASE    = MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

let _tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 30_000) {
    return _tokenCache.token
  }

  const creds = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal auth failed: ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return _tokenCache.token
}

export async function getSubscription(subscriptionId: string) {
  const token = await getAccessToken()
  const res = await fetch(`${BASE}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal getSubscription failed: ${text}`)
  }
  return res.json() as Promise<PayPalSubscription>
}

export async function verifyWebhookSignature(body: string, headers: Record<string, string>) {
  const token = await getAccessToken()

  const payload = {
    auth_algo:         headers['paypal-auth-algo'],
    cert_url:          headers['paypal-cert-url'],
    transmission_id:   headers['paypal-transmission-id'],
    transmission_sig:  headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id:        process.env.PAYPAL_WEBHOOK_ID ?? '',
    webhook_event:     JSON.parse(body),
  }

  const res = await fetch(`${BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) return false
  const data = await res.json() as { verification_status: string }
  return data.verification_status === 'SUCCESS'
}

export interface PayPalSubscription {
  id: string
  status: string // 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | ...
  plan_id: string
  billing_info?: {
    last_payment?: { time: string }
    next_billing_time?: string
  }
  start_time: string
  create_time: string
}
