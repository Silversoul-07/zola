import { UsageLimitError } from "@/lib/api"
import { AUTH_DAILY_MESSAGE_LIMIT, DAILY_LIMIT_PRO_MODELS, FREE_MODELS_IDS } from "@/lib/config"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"

const isFreeModel = (modelId: string) => FREE_MODELS_IDS.includes(modelId)
const isProModel = (modelId: string) => !isFreeModel(modelId)

function isNewUtcDay(lastReset: Date | string | null): boolean {
  if (!lastReset) return true
  const now = new Date()
  const last = new Date(lastReset)
  return (
    now.getUTCFullYear() !== last.getUTCFullYear() ||
    now.getUTCMonth() !== last.getUTCMonth() ||
    now.getUTCDate() !== last.getUTCDate()
  )
}

/**
 * Single-user app: there's only ever one row, so every check/increment
 * operates on the current user's id.
 */
export async function checkUsage(userId: string) {
  const [userData] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))

  if (!userData) {
    throw new Error("User record not found for id: " + userId)
  }

  let dailyCount = userData.dailyMessageCount || 0

  if (isNewUtcDay(userData.dailyReset)) {
    dailyCount = 0
    await db
      .update(schema.users)
      .set({ dailyMessageCount: 0, dailyReset: new Date() })
      .where(eq(schema.users.id, userId))
  }

  if (dailyCount >= AUTH_DAILY_MESSAGE_LIMIT) {
    throw new UsageLimitError("Daily message limit reached.")
  }

  return { userData, dailyCount, dailyLimit: AUTH_DAILY_MESSAGE_LIMIT }
}

export async function incrementUsage(userId: string): Promise<void> {
  const [userData] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))

  if (!userData) throw new Error("User not found")

  await db
    .update(schema.users)
    .set({
      messageCount: (userData.messageCount || 0) + 1,
      dailyMessageCount: (userData.dailyMessageCount || 0) + 1,
    })
    .where(eq(schema.users.id, userId))
}

export async function checkProUsage(userId: string) {
  const [userData] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))

  if (!userData) throw new Error("User not found for ID: " + userId)

  let dailyProCount = userData.dailyProMessageCount || 0

  if (isNewUtcDay(userData.dailyProReset)) {
    dailyProCount = 0
    await db
      .update(schema.users)
      .set({ dailyProMessageCount: 0, dailyProReset: new Date() })
      .where(eq(schema.users.id, userId))
  }

  if (dailyProCount >= DAILY_LIMIT_PRO_MODELS) {
    throw new UsageLimitError("Daily Pro model limit reached.")
  }

  return { dailyProCount, limit: DAILY_LIMIT_PRO_MODELS }
}

export async function incrementProUsage(userId: string) {
  const [userData] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))

  if (!userData) throw new Error("Failed to fetch user usage for increment")

  await db
    .update(schema.users)
    .set({ dailyProMessageCount: (userData.dailyProMessageCount || 0) + 1 })
    .where(eq(schema.users.id, userId))
}

export async function checkUsageByModel(userId: string, modelId: string) {
  if (isProModel(modelId)) return checkProUsage(userId)
  return checkUsage(userId)
}

export async function incrementUsageByModel(userId: string, modelId: string) {
  if (isProModel(modelId)) return incrementProUsage(userId)
  return incrementUsage(userId)
}
