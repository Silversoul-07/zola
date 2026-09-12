import { AUTH_DAILY_MESSAGE_LIMIT, DAILY_LIMIT_PRO_MODELS } from "@/lib/config"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"

export async function getMessageUsage(userId: string) {
  const [data] = await db
    .select({
      dailyMessageCount: schema.users.dailyMessageCount,
      dailyProMessageCount: schema.users.dailyProMessageCount,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))

  if (!data) throw new Error("Failed to fetch message usage")

  const dailyCount = data.dailyMessageCount || 0
  const dailyProCount = data.dailyProMessageCount || 0

  return {
    dailyCount,
    dailyProCount,
    dailyLimit: AUTH_DAILY_MESSAGE_LIMIT,
    remaining: AUTH_DAILY_MESSAGE_LIMIT - dailyCount,
    remainingPro: DAILY_LIMIT_PRO_MODELS - dailyProCount,
  }
}
