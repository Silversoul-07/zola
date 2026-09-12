import { formatDataStreamPart } from "@ai-sdk/ui-utils"

// Maps Hermes Agent's `/v1/responses` SSE (OpenAI Responses API shape) to the
// AI SDK v4 data-stream protocol Zola's client already renders.
//
// Event names below are taken verbatim from Hermes 0.21.2
// gateway/platforms/api_server_openai_routes.py (commit 939e45c):
//   response.created                 (line 201) - ignored, no data-stream equivalent
//   response.output_item.added       (lines 211, 240) - ignored (partial-call skipped per spec)
//   response.output_text.delta       (line 219) -> "0:" text delta
//   response.output_item.done        (lines 253, 266, 332) -> "9:"/"a:" (see below)
//   response.output_text.done        (line 328) - ignored, redundant with deltas
//   response.completed               (line 369) -> "e:" + "d:" finish
//   response.failed                  (lines 355, 374) -> "3:" error
//
// `response.output_item.done` carries one `item`:
//   item.type === "function_call" && item.status === "completed"      -> "9:" tool_call
//   item.type === "function_call_output"                              -> "a:" tool_result
//   item.type === "message"                                           -> ignored (text already streamed)
//
// Grepped the file for "reasoning"/"thinking" — Hermes 0.21.2 emits no reasoning
// SSE events at all, so there is nothing to map to "g:" yet. Add a case here
// (event name confirmed from source, not guessed) if/when Hermes starts
// streaming reasoning.

type HermesToolPart = {
  type: "tool-invocation"
  toolInvocation: {
    state: "call" | "result"
    step: number
    toolCallId: string
    toolName: string
    args?: unknown
    result?: unknown
  }
}

type HermesFinishPayload = {
  text: string
  toolParts: HermesToolPart[]
}

type HermesStreamOpts = {
  messageId: string
  /** Called once the underlying SSE stream ends, so the caller can persist
   * the reconstructed assistant message (used to make the `hermes:` bypass
   * behave like the normal `onFinish` persistence path). */
  onFinish?: (payload: HermesFinishPayload) => void | Promise<void>
}

function parseJsonOr<T>(text: string, fallback: (raw: string) => T): T {
  try {
    return JSON.parse(text)
  } catch {
    return fallback(text)
  }
}

export function hermesResponsesToDataStream(
  sse: ReadableStream<Uint8Array>,
  opts: HermesStreamOpts
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (line: string) => controller.enqueue(encoder.encode(line))
      emit(formatDataStreamPart("start_step", { messageId: opts.messageId }))

      const textParts: string[] = []
      const toolParts = new Map<string, HermesToolPart>()

      const handleFrame = (frame: string) => {
        const dataLine = frame
          .split("\n")
          .find((line) => line.startsWith("data:"))
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
              textParts.push(data.delta)
              emit(formatDataStreamPart("text", data.delta))
            }
            break
          }
          case "response.output_item.done": {
            const item = data.item as Record<string, unknown> | undefined
            if (!item) break
            if (item.type === "function_call" && item.status === "completed") {
              const args = parseJsonOr(String(item.arguments ?? "{}"), (r) => ({
                raw: r,
              }))
              const toolCallId = String(item.call_id)
              toolParts.set(toolCallId, {
                type: "tool-invocation",
                toolInvocation: {
                  state: "call",
                  step: 0,
                  toolCallId,
                  toolName: String(item.name),
                  args,
                },
              })
              emit(
                formatDataStreamPart("tool_call", {
                  toolCallId,
                  toolName: String(item.name),
                  args,
                })
              )
            } else if (item.type === "function_call_output") {
              const output = item.output as Array<{ text?: string }> | undefined
              const text = output?.[0]?.text ?? ""
              const result = parseJsonOr<unknown>(text, (r) => r)
              const toolCallId = String(item.call_id)
              const existing = toolParts.get(toolCallId)
              toolParts.set(toolCallId, {
                type: "tool-invocation",
                toolInvocation: {
                  state: "result",
                  step: 0,
                  toolCallId,
                  toolName: existing?.toolInvocation.toolName || "",
                  args: existing?.toolInvocation.args,
                  result,
                },
              })
              emit(
                formatDataStreamPart("tool_result", {
                  toolCallId,
                  result,
                })
              )
            }
            break
          }
          case "response.completed": {
            const response = data.response as Record<string, unknown> | undefined
            const rawUsage = response?.usage as
              | Record<string, number>
              | undefined
            const usage = rawUsage
              ? {
                  promptTokens: rawUsage.input_tokens ?? 0,
                  completionTokens: rawUsage.output_tokens ?? 0,
                }
              : undefined
            emit(
              formatDataStreamPart("finish_step", {
                finishReason: "stop",
                usage,
                isContinued: false,
              })
            )
            emit(
              formatDataStreamPart("finish_message", {
                finishReason: "stop",
                usage,
              })
            )
            break
          }
          case "response.failed": {
            const response = data.response as Record<string, unknown> | undefined
            const error = response?.error
            const message =
              typeof error === "string"
                ? error
                : (error as { message?: string })?.message ||
                  "Hermes agent request failed"
            emit(formatDataStreamPart("error", message))
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
      } catch (err) {
        emit(
          formatDataStreamPart(
            "error",
            err instanceof Error ? err.message : String(err)
          )
        )
      } finally {
        try {
          await opts.onFinish?.({
            text: textParts.join(""),
            toolParts: [...toolParts.values()],
          })
        } catch (err) {
          console.error("hermes onFinish persistence failed:", err)
        }
        controller.close()
      }
    },
  })
}
