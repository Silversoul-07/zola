import { db, schema } from "@/lib/db"
import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { eq, sql } from "drizzle-orm"

const TITLE_MODEL = process.env.TITLE_MODEL || "deepseek-v4-flash"
const SYSTEM =
  "Write a chat title of at most 6 words for the conversation. Plain words only: no quotes, no trailing period, no markdown."

async function viaLiteLLM(prompt: string): Promise<string> {
  const litellm = createOpenAI({
    baseURL: `${process.env.LITELLM_URL || "http://127.0.0.1:4000"}/v1`,
    apiKey: process.env.LITELLM_MASTER_KEY,
    name: "litellm",
  })
  const { text } = await generateText({
    model: litellm.chat(TITLE_MODEL),
    system: SYSTEM,
    prompt,
    maxOutputTokens: 24,
  })
  return text
}

// ponytail: LiteLLM is loopback-only on the VM, so a dev laptop can't reach it;
// fall back to one non-streaming Hermes turn (heavier, but only once per chat).
async function viaHermes(prompt: string): Promise<string> {
  const res = await fetch(`${process.env.HERMES_API_URL}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HERMES_API_KEY}`,
      "X-Hermes-Session-Key": "zola-title-gen",
    },
    body: JSON.stringify({
      model: TITLE_MODEL,
      stream: false,
      instructions: SYSTEM,
      input: prompt,
    }),
  })
  if (!res.ok) throw new Error(`Hermes title request failed (${res.status})`)
  const json = (await res.json()) as {
    output_text?: string
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
  }
  return (
    json.output_text ??
    json.output
      ?.filter((o) => o.type === "message")
      .flatMap((o) => o.content ?? [])
      .find((c) => c.type === "output_text")?.text ??
    ""
  )
}

// After the first exchange, replace the "first user message" placeholder
// title with a short generated one (ChatGPT-style). Runs once per chat:
// only when the chat has exactly one assistant message so far.
export async function maybeGenerateTitle({
  chatId,
  userText,
  assistantText,
}: {
  chatId: string
  userText: string
  assistantText: string
}): Promise<void> {
  if (!userText.trim()) return
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.messages)
    .where(eq(schema.messages.chatId, chatId))
  if (count > 2) return

  const prompt = `User: ${userText.slice(0, 1500)}\n\nAssistant: ${assistantText.slice(0, 1500)}`
  let text: string
  try {
    text = await viaLiteLLM(prompt)
  } catch (err) {
    console.warn("Title via LiteLLM failed, trying Hermes:", (err as Error).message)
    text = await viaHermes(prompt)
  }
  const title = text
    .replace(/^["'\s]+|["'\s.]+$/g, "")
    .split("\n")[0]
    .slice(0, 80)
  if (!title) return
  await db.update(schema.chats).set({ title }).where(eq(schema.chats.id, chatId))
}
