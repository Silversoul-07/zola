import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { encryptKey } from "@/lib/encryption"
import { getModelsForProvider } from "@/lib/models"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { provider, apiKey } = await request.json()

  if (!provider || !apiKey) {
    return NextResponse.json(
      { error: "Provider and API key are required" },
      { status: 400 }
    )
  }

  const { encrypted, iv } = encryptKey(apiKey)

  const [existingKey] = await db
    .select({ provider: schema.userKeys.provider })
    .from(schema.userKeys)
    .where(and(eq(schema.userKeys.userId, user.id), eq(schema.userKeys.provider, provider)))

  const isNewKey = !existingKey

  await db
    .insert(schema.userKeys)
    .values({ userId: user.id, provider, encryptedKey: encrypted, iv })
    .onConflictDoUpdate({
      target: [schema.userKeys.userId, schema.userKeys.provider],
      set: { encryptedKey: encrypted, iv, updatedAt: new Date() },
    })

  if (isNewKey) {
    try {
      const [current] = await db
        .select({ favoriteModels: schema.users.favoriteModels })
        .from(schema.users)
        .where(eq(schema.users.id, user.id))

      const currentFavorites = current?.favoriteModels || []
      const providerModels = await getModelsForProvider(provider)
      const providerModelIds = providerModels.map((model) => model.id)

      if (providerModelIds.length > 0) {
        const newModelsToAdd = providerModelIds.filter(
          (modelId) => !currentFavorites.includes(modelId)
        )

        if (newModelsToAdd.length > 0) {
          await db
            .update(schema.users)
            .set({ favoriteModels: [...currentFavorites, ...newModelsToAdd] })
            .where(eq(schema.users.id, user.id))
        }
      }
    } catch (modelsError) {
      console.error("Failed to update favorite models:", modelsError)
    }
  }

  return NextResponse.json({
    success: true,
    isNewKey,
    message: isNewKey
      ? `API key saved and ${provider} models added to favorites`
      : "API key updated",
  })
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { provider } = await request.json()
  if (!provider) {
    return NextResponse.json({ error: "Provider is required" }, { status: 400 })
  }

  await db
    .delete(schema.userKeys)
    .where(and(eq(schema.userKeys.userId, user.id), eq(schema.userKeys.provider, provider)))

  return NextResponse.json({ success: true })
}
