import { saveFinalAssistantMessage } from "@/app/api/chat/db"
import type {
  ChatApiParams,
  LogUserMessageParams,
  StoreAssistantMessageParams,
} from "@/app/types/api.types"
import { FREE_MODELS_IDS } from "@/lib/config"
import { db, schema } from "@/lib/db"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import { sanitizeUserInput } from "@/lib/sanitize"
import { checkUsageByModel, incrementUsage } from "@/lib/usage"
import { getUserKey, type ProviderWithoutOllama } from "@/lib/user-keys"

/**
 * Validates the model can be used and enforces usage limits.
 * Incognito requests skip persistence entirely but are still rate-limited.
 */
export async function validateAndTrackUsage({
  userId,
  model,
  incognito,
}: ChatApiParams): Promise<boolean> {
  const provider = getProviderForModel(model)

  if (provider !== "ollama") {
    const userApiKey = await getUserKey(userId, provider as ProviderWithoutOllama)
    if (!userApiKey && !FREE_MODELS_IDS.includes(model)) {
      throw new Error(
        `This model requires an API key for ${provider}. Please add your API key in settings or use a free model.`
      )
    }
  }

  await checkUsageByModel(userId, model)

  return !incognito
}

export async function incrementMessageCount({
  userId,
}: {
  userId: string
}): Promise<void> {
  try {
    await incrementUsage(userId)
  } catch (err) {
    console.error("Failed to increment message count:", err)
  }
}

export async function logUserMessage({
  userId,
  chatId,
  content,
  attachments,
  model,
  message_group_id,
}: LogUserMessageParams): Promise<void> {
  try {
    await db.insert(schema.messages).values({
      chatId,
      role: "user",
      content: sanitizeUserInput(content),
      experimentalAttachments: attachments,
      userId,
      messageGroupId: message_group_id,
      model,
    })
  } catch (error) {
    console.error("Error saving user message:", error)
  }
}

export async function storeAssistantMessage({
  chatId,
  messages,
  message_group_id,
  model,
}: StoreAssistantMessageParams): Promise<void> {
  try {
    await saveFinalAssistantMessage(chatId, messages, message_group_id, model)
  } catch (err) {
    console.error("Failed to save assistant messages:", err)
  }
}
