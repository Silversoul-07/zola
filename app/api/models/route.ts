import {
  getAllModels,
  getModelsForUserProviders,
  getModelsWithAccessFlags,
  refreshModelsCache,
} from "@/lib/models"
import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      const models = await getModelsWithAccessFlags()
      return NextResponse.json({ models })
    }

    const rows = await db
      .select({ provider: schema.userKeys.provider })
      .from(schema.userKeys)
      .where(eq(schema.userKeys.userId, user.id))

    const userProviders = rows.map((k: { provider: string }) => k.provider)

    if (userProviders.length === 0) {
      const models = await getModelsWithAccessFlags()
      return NextResponse.json({ models })
    }

    const models = await getModelsForUserProviders(userProviders)
    return NextResponse.json({ models })
  } catch (error) {
    console.error("Error fetching models:", error)
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 })
  }
}

export async function POST() {
  try {
    refreshModelsCache()
    const models = await getAllModels()

    return NextResponse.json({
      message: "Models cache refreshed",
      models,
      timestamp: new Date().toISOString(),
      count: models.length,
    })
  } catch (error) {
    console.error("Failed to refresh models:", error)
    return NextResponse.json(
      { error: "Failed to refresh models" },
      { status: 500 }
    )
  }
}
