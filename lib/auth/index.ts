import { timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { MODEL_DEFAULT } from "@/lib/config"
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from "./session"

export const AUTH_USERNAME = process.env.AUTH_USERNAME || "admin"
export const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "Welcome123"

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  // Pad to equal length first so timingSafeEqual never throws on mismatched
  // lengths (which would itself leak length information via the exception).
  const len = Math.max(bufA.length, bufB.length, 1)
  const paddedA = Buffer.alloc(len)
  const paddedB = Buffer.alloc(len)
  bufA.copy(paddedA)
  bufB.copy(paddedB)
  return timingSafeEqual(paddedA, paddedB) && bufA.length === bufB.length
}

export function checkCredentials(username: string, password: string): boolean {
  return (
    constantTimeEqual(username, AUTH_USERNAME) &&
    constantTimeEqual(password, AUTH_PASSWORD)
  )
}

/** Single-user app: there is ever only one row. Create it on first login. */
export async function getOrCreateUser() {
  const existing = await db.select().from(schema.users).limit(1)
  if (existing[0]) return existing[0]

  const [created] = await db
    .insert(schema.users)
    .values({
      username: AUTH_USERNAME,
      email: `${AUTH_USERNAME}@local`,
      displayName: AUTH_USERNAME,
      favoriteModels: [MODEL_DEFAULT],
    })
    .returning()
  return created
}

export async function createSession() {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, createSessionToken(AUTH_USERNAME), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

/** Returns the single user row if the request has a valid session cookie. */
export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const username = verifySessionToken(token)
  if (!username) return null

  return getOrCreateUser()
}
