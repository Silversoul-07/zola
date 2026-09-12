import { createHmac, timingSafeEqual } from "crypto"

// ponytail: HMAC-signed cookie, not iron-session — one secret, one claim
// (username + expiry). Upgrade to iron-session if we ever need encrypted
// (not just signed) payloads.
const SECRET = process.env.AUTH_SECRET || process.env.CSRF_SECRET || ""
if (!SECRET) {
  throw new Error("AUTH_SECRET or CSRF_SECRET is required")
}

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
export const SESSION_COOKIE = "zola_session"

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex")
}

export function createSessionToken(username: string): string {
  const payload = `${username}:${Date.now() + SESSION_MAX_AGE_MS}`
  const payloadB64 = Buffer.from(payload).toString("base64url")
  return `${payloadB64}.${sign(payloadB64)}`
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null
  const [payloadB64, signature] = token.split(".")
  if (!payloadB64 || !signature) return null

  const expected = sign(payloadB64)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  const payload = Buffer.from(payloadB64, "base64url").toString("utf8")
  const [username, expiresAtStr] = payload.split(":")
  const expiresAt = Number(expiresAtStr)
  if (!username || !expiresAt || Date.now() > expiresAt) return null

  return username
}
