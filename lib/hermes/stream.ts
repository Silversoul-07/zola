import { createUIMessageStream, type UIMessage, type UIMessageStreamWriter } from "ai"

// Maps Hermes Agent's `/v1/responses` SSE (OpenAI Responses API shape) to the
// AI SDK v5+ UI message stream protocol. Emits writer.write() chunks;
// createUIMessageStream reconstructs the final assistant UIMessage (with
// `.parts`) for onFinish persistence.
//
// Event names below are taken verbatim from Hermes 0.21.2
// gateway/platforms/api_server_openai_routes.py (commit 939e45c):
//   response.created                 (line 201) - ignored, no stream equivalent
//   response.output_item.added       (lines 211, 240) - ignored (partial-call skipped per spec)
//   response.output_text.delta       (line 219) -> text-delta
//   response.output_item.done        (lines 253, 266, 332) -> tool-input-available / tool-output-available
//   response.output_text.done        (line 328) - ignored, redundant with deltas
//   response.completed               (line 369) -> finish
//   response.failed                  (lines 355, 374) -> error
//
// `response.output_item.done` carries one `item`:
//   item.type === "function_call" && item.status === "completed"      -> tool-input-available
//   item.type === "function_call_output"                              -> tool-output-available
//   item.type === "message"                                           -> ignored (text already streamed)
//
// Grepped the file for "reasoning"/"thinking" — Hermes 0.21.2 emits no reasoning
// SSE events at all, so there is nothing to map to reasoning-* yet. Add a case
// here (event name confirmed from source, not guessed) if/when Hermes starts
// streaming reasoning.

type HermesStreamOpts = {
  onFinish?: (payload: { message: UIMessage }) => void | Promise<void>
}

function parseJsonOr<T>(text: string, fallback: (raw: string) => T): T {
  try {
    return JSON.parse(text)
  } catch {
    return fallback(text)
  }
}

const TEXT_ID = "hermes-text"

async function writeHermesResponses(
  sse: ReadableStream<Uint8Array>,
  writer: UIMessageStreamWriter
): Promise<void> {
  const decoder = new TextDecoder()
  let textOpen = false
  // Hermes doesn't send a call_id on function_call_output beyond what we
  // captured on the matching function_call, so args aren't needed again here.

  writer.write({ type: "start" })

  const closeTextIfOpen = () => {
    if (textOpen) {
      writer.write({ type: "text-end", id: TEXT_ID })
      textOpen = false
    }
  }

  const handleFrame = (frame: string) => {
    const dataLine = frame.split("\n").find((line) => line.startsWith("data:"))
    if (!dataLine) return
    const raw = dataLine.slice(5).trim()
    if (!raw || raw === "[DONE]") return

    let data: Record<string, unknown>
    try {
      data = JSON.parse(raw)
    } catch {
      return
    }

    switch (data.type as string) {
      case "response.output_text.delta": {
        if (typeof data.delta === "string") {
          if (!textOpen) {
            writer.write({ type: "text-start", id: TEXT_ID })
            textOpen = true
          }
          writer.write({ type: "text-delta", id: TEXT_ID, delta: data.delta })
        }
        break
      }
      case "response.output_item.done": {
        const item = data.item as Record<string, unknown> | undefined
        if (!item) break
        if (item.type === "function_call" && item.status === "completed") {
          closeTextIfOpen()
          const input = parseJsonOr(String(item.arguments ?? "{}"), (r) => ({
            raw: r,
          }))
          writer.write({
            type: "tool-input-available",
            toolCallId: String(item.call_id),
            toolName: String(item.name),
            input,
          })
        } else if (item.type === "function_call_output") {
          closeTextIfOpen()
          const output = item.output as Array<{ text?: string }> | undefined
          const text = output?.[0]?.text ?? ""
          const result = parseJsonOr<unknown>(text, (r) => r)
          writer.write({
            type: "tool-output-available",
            toolCallId: String(item.call_id),
            output: result,
          })
        }
        break
      }
      case "response.completed": {
        closeTextIfOpen()
        writer.write({ type: "finish" })
        break
      }
      case "response.failed": {
        closeTextIfOpen()
        const response = data.response as Record<string, unknown> | undefined
        const error = response?.error
        const message =
          typeof error === "string"
            ? error
            : (error as { message?: string })?.message ||
              "Hermes agent request failed"
        writer.write({ type: "error", errorText: message })
        break
      }
      default:
        break
    }
  }

  const reader = sse.getReader()
  let buf = ""
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        handleFrame(buf.slice(0, idx))
        buf = buf.slice(idx + 2)
      }
    }
    if (buf.trim()) handleFrame(buf)
    closeTextIfOpen()
  } catch (err) {
    closeTextIfOpen()
    writer.write({
      type: "error",
      errorText: err instanceof Error ? err.message : String(err),
    })
  }
}

export function hermesResponsesToUIMessageStream(
  sse: ReadableStream<Uint8Array>,
  opts: HermesStreamOpts = {}
) {
  return createUIMessageStream({
    execute: async ({ writer }) => {
      await writeHermesResponses(sse, writer)
    },
    onFinish: async ({ responseMessage }) => {
      try {
        await opts.onFinish?.({ message: responseMessage })
      } catch (err) {
        console.error("hermes onFinish persistence failed:", err)
      }
    },
  })
}
