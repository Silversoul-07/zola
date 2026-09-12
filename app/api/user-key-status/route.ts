import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { PROVIDERS } from "@/lib/providers"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

const SUPPORTED_PROVIDERS = PROVIDERS.map((p) => p.id)

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await db
    .select({ provider: schema.userKeys.provider })
    .from(schema.userKeys)
    .where(eq(schema.userKeys.userId, user.id))

  const userProviders = rows.map((k) => k.provider)
  const providerStatus = SUPPORTED_PROVIDERS.reduce(
    (acc, provider) => {
      acc[provider] = userProviders.includes(provider)
      return acc
    },
    {} as Record<string, boolean>
  )

  return NextResponse.json(providerStatus)
}
