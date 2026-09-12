import { db, schema } from "@/lib/db"
import { and, eq } from "drizzle-orm"
import { decryptKey } from "./encryption"
import { env } from "./openproviders/env"
import { Provider } from "./openproviders/types"

export type { Provider } from "./openproviders/types"
export type ProviderWithoutOllama = Exclude<Provider, "ollama">

export async function getUserKey(
  userId: string,
  provider: Provider
): Promise<string | null> {
  try {
    const [row] = await db
      .select({ encryptedKey: schema.userKeys.encryptedKey, iv: schema.userKeys.iv })
      .from(schema.userKeys)
      .where(and(eq(schema.userKeys.userId, userId), eq(schema.userKeys.provider, provider)))

    if (!row) return null

    return decryptKey(row.encryptedKey, row.iv)
  } catch (error) {
    console.error("Error retrieving user key:", error)
    return null
  }
}

export async function getEffectiveApiKey(
  userId: string | null,
  provider: ProviderWithoutOllama
): Promise<string | null> {
  if (userId) {
    const userKey = await getUserKey(userId, provider)
    if (userKey) return userKey
  }

  const envKeyMap: Record<ProviderWithoutOllama, string | undefined> = {
    openai: env.OPENAI_API_KEY,
    mistral: env.MISTRAL_API_KEY,
    perplexity: env.PERPLEXITY_API_KEY,
    google: env.GOOGLE_GENERATIVE_AI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
    xai: env.XAI_API_KEY,
    openrouter: env.OPENROUTER_API_KEY,
    hermes: env.HERMES_API_KEY,
  }

  return envKeyMap[provider] || null
}
