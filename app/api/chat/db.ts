import type { Message } from "@/app/types/api.types"
import { db, schema } from "@/lib/db"

// v5 UIMessage parts arrive already deduplicated/reconstructed by
// createUIMessageStream's onFinish (one entry per text/reasoning block or
// toolCallId), so this just concatenates text parts for the plain-text
// `content` column and stores the parts array verbatim as jsonb.
export async function saveFinalAssistantMessage(
  chatId: string,
  messages: Message[],
  message_group_id?: string,
  model?: string
) {
  const assistantMsg = messages.find((m) => m.role === "assistant")
  const parts = assistantMsg?.parts ?? []

  const finalPlainText = parts
    .filter((part) => part.type === "text")
    .map((part) => part.text || "")
    .join("\n\n")

  await db.insert(schema.messages).values({
    chatId,
    role: "assistant",
    content: finalPlainText || "",
    parts,
    messageGroupId: message_group_id,
    model,
  })
}
