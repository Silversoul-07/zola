import { env } from "@/lib/openproviders/env"
import type { UIMessage } from "ai"

// Builds OpenAI Responses API `input` items from Zola's v5 UIMessages.
// User turns use "input_text"/"input_image" parts, assistant history uses
// "output_text" parts, per the Responses API input schema.
type ResponsesContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string }
  | { type: "output_text"; text: string }

type ResponsesInputItem = {
  role: "user" | "assistant"
  content: ResponsesContentPart[]
}

function toInputItems(messages: UIMessage[]): ResponsesInputItem[] {
  return messages
    .filter(
      (m): m is UIMessage & { role: "user" | "assistant" } =>
        m.role === "user" || m.role === "assistant"
    )
    .map((m) => {
      const textType = m.role === "user" ? "input_text" : "output_text"
      const parts: ResponsesContentPart[] = []
      const text = m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("")
      if (text) parts.push({ type: textType, text })
      if (m.role === "user") {
        for (const part of m.parts) {
          if (
            part.type === "file" &&
            part.mediaType?.startsWith("image/") &&
            part.url
          ) {
            parts.push({ type: "input_image", image_url: part.url })
          }
        }
      }
      return { role: m.role, content: parts }
    })
}

type HermesRequestArgs = {
  messages: UIMessage[]
  model: string
  chatId: string
  systemPrompt?: string
  signal?: AbortSignal
}

// POSTs to Hermes Agent's `/v1/responses` (stream: true) and returns the raw
// Response so the caller can pipe `res.body` through hermesResponsesToDataStream.
// Hermes executes tools server-side; we never see or run a tool call ourselves.
export async function hermesRequest({
  messages,
  model,
  chatId,
  systemPrompt,
  signal,
}: HermesRequestArgs): Promise<Response> {
  const res = await fetch(`${env.HERMES_API_URL}/v1/responses`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.HERMES_API_KEY}`,
      "X-Hermes-Session-Key": chatId,
    },
    body: JSON.stringify({
      model,
      stream: true,
      instructions: systemPrompt,
      input: toInputItems(messages),
    }),
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "")
    throw new Error(`Hermes agent request failed (${res.status}): ${text}`)
  }

  return res
}
