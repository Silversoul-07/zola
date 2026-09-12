import { createUIMessageStream, type UIMessage, type UIMessageStreamWriter } from "ai"
import { toolTimer, turnData } from "@/lib/turn"

type OpencodeTokens = {
  input?: number
  output?: number
  reasoning?: number
  cache?: { read?: number; write?: number }
}

// Maps OpenCode's `/event` SSE bus to the AI SDK v5+ UI message stream
// protocol (same job as lib/hermes/stream.ts, mirrored for OpenCode's event
// shape). Emits writer.write() chunks; createUIMessageStream reconstructs
// the final assistant UIMessage (with `.parts`) for onFinish persistence.
//
// Event shapes (from packages/sdk/js/src/gen/types.gen.ts, anomalyco/opencode
// dev branch): every SSE frame is `{ type, properties }`.
//   message.part.updated  -> properties.part (Part), part.sessionID scopes it
//   session.idle          -> properties.sessionID                -> finish
//   session.error         -> properties.sessionID?, properties.error -> error
//   permission.updated    -> properties is the Permission itself (id, type,
//     pattern, sessionID, messageID, callID, title, metadata, time), scoped
//     by properties.sessionID -> written through as a data-opencode-permission
//     UI message data part (not text/tool-shaped, so no finish/error here)
// Part union relevant here:
//   TextPart      { id, sessionID, type: "text", text }              -> text-delta
//   ReasoningPart { id, sessionID, type: "reasoning", text }         -> reasoning-delta
//   ToolPart      { id, sessionID, type: "tool", callID, tool, state }
//     state.status: "pending" | "running" | "completed" | "error"
//     state.input always present; state.output on completed; state.error on error
//     first sighting of a tool part (any status) -> tool-input-available
//     status transitions to completed/error (once)  -> tool-output-available/-error
// The `/event` stream is a global bus shared by every session, so every part
// and idle/error event not matching our `sessionId` is ignored, and we stop
// reading (cancelling the underlying connection) once our session goes idle
// or errors, rather than waiting for the stream to end on its own.

type OpencodeToolState = {
  status: "pending" | "running" | "completed" | "error"
  input?: Record<string, unknown>
  output?: unknown
  error?: unknown
}

type OpencodePart = {
  id: string
  sessionID: string
  messageID?: string
  type: string
  text?: string
  callID?: string
  tool?: string
  state?: OpencodeToolState
}

// Matches OpenCode's `Permission` type (packages/sdk/js/src/gen/types.gen.ts,
// anomalyco/opencode dev branch): the `permission.updated` event's
// `properties` IS this object, not a wrapper around it.
export type OpencodePermission = {
  id: string
  type: string
  pattern?: string | string[]
  sessionID: string
  messageID: string
  callID?: string
  title: string
  metadata: Record<string, unknown>
}

// OpenCode tool names/params, normalised to the Hermes shapes the chat
// renderers already understand (tools/index.tsx, tool-labels.ts). Unknown
// tools pass through untouched and fall back to the generic row.
const TOOL_NAME_MAP: Record<string, string> = {
  bash: "terminal",
  read: "read_file",
  write: "write_file",
  edit: "patch",
  glob: "search_files",
  grep: "search_files",
  list: "search_files",
  webfetch: "web_extract",
  todowrite: "todo_list",
  todoread: "todo_list",
  task: "delegate_task",
}

function editToDiff(path: string, oldStr: string, newStr: string): string {
  const minus = oldStr ? oldStr.split("\n").map((l) => "-" + l) : []
  const plus = newStr ? newStr.split("\n").map((l) => "+" + l) : []
  return [`--- ${path}`, `+++ ${path}`, "@@ @@", ...minus, ...plus].join("\n")
}

export function normalizeOpencodeTool(
  tool: string,
  input: Record<string, unknown>,
  output?: unknown
): { toolName: string; args: Record<string, unknown>; result?: Record<string, unknown> } {
  const toolName = TOOL_NAME_MAP[tool] ?? tool
  const path = typeof input.filePath === "string" ? input.filePath : undefined
  const args: Record<string, unknown> = { ...input }
  if (path) args.path = path
  if (tool === "edit" && path) {
    args.diff = editToDiff(
      path,
      String(input.oldString ?? ""),
      String(input.newString ?? "")
    )
  }
  if (tool === "glob" || tool === "grep") args.query = input.pattern
  if (tool === "list") args.query = input.path
  if (output === undefined) return { toolName, args }
  const text = typeof output === "string" ? output : JSON.stringify(output)
  const result =
    toolName === "search_files"
      ? { matches: text.split("\n").filter(Boolean) }
      : { output: text }
  return { toolName, args, result }
}

type OpencodeStreamOpts = {
  sessionId: string
  onFinish?: (payload: { message: UIMessage }) => void | Promise<void>
}

async function writeOpencodeEvents(
  sse: ReadableStream<Uint8Array>,
  writer: UIMessageStreamWriter,
  sessionId: string
): Promise<void> {
  const decoder = new TextDecoder()

  // OpenCode part events carry the *cumulative* text so far, not a delta,
  // so each part id's previously-seen length has to be tracked to compute
  // the actual text-delta/reasoning-delta chunk.
  const textByPart = new Map<string, string>()
  const reasoningByPart = new Map<string, string>()
  const toolCalled = new Set<string>()
  const toolFinished = new Set<string>()
  let finished = false
  const startedAt = Date.now()
  const timer = toolTimer()
  let lastTokens: OpencodeTokens | undefined
  // The /event bus also replays the user's own message parts; skip them.
  const userMessageIds = new Set<string>()

  writer.write({ type: "start" })

  const handlePart = (part: OpencodePart) => {
    if (part.sessionID !== sessionId) return
    if (part.messageID && userMessageIds.has(part.messageID)) return

    if (part.type === "text" && typeof part.text === "string") {
      if (!textByPart.has(part.id)) {
        textByPart.set(part.id, "")
        writer.write({ type: "text-start", id: part.id })
      }
      const prev = textByPart.get(part.id) ?? ""
      if (part.text.length > prev.length) {
        const delta = part.text.slice(prev.length)
        textByPart.set(part.id, part.text)
        writer.write({ type: "text-delta", id: part.id, delta })
      }
      return
    }

    if (part.type === "reasoning" && typeof part.text === "string") {
      if (!reasoningByPart.has(part.id)) {
        reasoningByPart.set(part.id, "")
        writer.write({ type: "reasoning-start", id: part.id })
      }
      const prev = reasoningByPart.get(part.id) ?? ""
      if (part.text.length > prev.length) {
        const delta = part.text.slice(prev.length)
        reasoningByPart.set(part.id, part.text)
        writer.write({ type: "reasoning-delta", id: part.id, delta })
      }
      return
    }

    if (part.type === "tool" && part.state && part.callID && part.tool) {
      const { state } = part
      // "pending" parts carry no input yet; wait for running/completed so
      // the call line has real args.
      if (!toolCalled.has(part.id) && state.status !== "pending") {
        toolCalled.add(part.id)
        const { toolName, args } = normalizeOpencodeTool(
          part.tool,
          state.input ?? {}
        )
        timer.start(part.callID)
        writer.write({
          type: "tool-input-available",
          toolCallId: part.callID,
          toolName,
          input: args,
        })
      }

      if (
        (state.status === "completed" || state.status === "error") &&
        !toolFinished.has(part.id)
      ) {
        toolFinished.add(part.id)
        const norm = normalizeOpencodeTool(
          part.tool,
          state.input ?? {},
          state.status === "completed" ? (state.output ?? "") : undefined
        )
        timer.end(part.callID)
        if (state.status === "completed") {
          writer.write({
            type: "tool-output-available",
            toolCallId: part.callID,
            output: norm.result ?? { output: state.output },
          })
        } else {
          const errorText =
            typeof state.error === "string"
              ? state.error
              : JSON.stringify(state.error)
          writer.write({
            type: "tool-output-error",
            toolCallId: part.callID,
            errorText,
          })
        }
      }
    }
  }

  const closeOpenParts = () => {
    for (const id of textByPart.keys()) writer.write({ type: "text-end", id })
    for (const id of reasoningByPart.keys())
      writer.write({ type: "reasoning-end", id })
  }

  const handleFrame = (frame: string) => {
    const dataLine = frame.split("\n").find((line) => line.startsWith("data:"))
    if (!dataLine) return
    const raw = dataLine.slice(5).trim()
    if (!raw) return

    let event: { type?: string; properties?: Record<string, unknown> }
    try {
      event = JSON.parse(raw)
    } catch {
      return
    }

    switch (event.type) {
      case "message.updated": {
        const info = event.properties?.info as
          | { id?: string; role?: string; sessionID?: string; tokens?: OpencodeTokens }
          | undefined
        if (info?.sessionID === sessionId && info.role === "user" && info.id) {
          userMessageIds.add(info.id)
        }
        if (info?.sessionID === sessionId && info.role === "assistant" && info.tokens) {
          lastTokens = info.tokens
        }
        break
      }
      case "message.part.updated": {
        const part = event.properties?.part as OpencodePart | undefined
        if (part) handlePart(part)
        break
      }
      case "permission.updated": {
        const permission = event.properties as OpencodePermission | undefined
        if (permission?.sessionID !== sessionId) break
        writer.write({
          type: "data-opencode-permission",
          id: permission.id,
          data: permission,
        })
        break
      }
      case "session.idle": {
        if (event.properties?.sessionID !== sessionId) break
        closeOpenParts()
        writer.write({
          type: "data-turn",
          id: "turn",
          data: turnData(startedAt, {
            inputTokens: lastTokens?.input,
            outputTokens: lastTokens?.output,
            reasoningTokens: lastTokens?.reasoning,
            cacheReadTokens: lastTokens?.cache?.read,
            cacheWriteTokens: lastTokens?.cache?.write,
          }, timer.tools),
        })
        writer.write({ type: "finish" })
        finished = true
        break
      }
      case "session.error": {
        const sid = event.properties?.sessionID
        if (sid && sid !== sessionId) break
        const error = event.properties?.error
        const message =
          typeof error === "string"
            ? error
            : (error as { message?: string; data?: { message?: string } } | undefined)
                ?.data?.message ||
              (error as { message?: string } | undefined)?.message ||
              "OpenCode agent request failed"
        closeOpenParts()
        writer.write({ type: "error", errorText: message })
        finished = true
        break
      }
      default:
        break
    }
  }

  const reader = sse.getReader()
  let buf = ""
  try {
    while (!finished) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        handleFrame(buf.slice(0, idx))
        buf = buf.slice(idx + 2)
        if (finished) break
      }
    }
    if (!finished) {
      closeOpenParts()
      writer.write({ type: "finish" })
    }
  } catch (err) {
    closeOpenParts()
    writer.write({
      type: "error",
      errorText: err instanceof Error ? err.message : String(err),
    })
  } finally {
    // Don't await the cancel: cancelling the shared /event connection can
    // block on the server, and awaiting it here would delay execute()
    // resolving (and therefore delay onFinish persistence) until it does.
    reader.cancel().catch(() => {})
  }
}

export function opencodeEventsToUIMessageStream(
  sse: ReadableStream<Uint8Array>,
  opts: OpencodeStreamOpts
) {
  // Two nested UI message streams, not one: the inner one is read to
  // completion right here (never by the HTTP response consumer), so its
  // onFinish always fires from a normal `flush` once the /event bus reaches
  // session.idle/error - never from `cancel`, whose accumulated text would
  // be truncated at whatever point the browser disconnected. The outer
  // stream just relays chunks to the real client and keeps forwarding (into
  // a writer that silently no-ops once cancelled) even after that client
  // goes away, so the inner read loop is never starved.
  const inner = createUIMessageStream({
    execute: async ({ writer }) => {
      await writeOpencodeEvents(sse, writer, opts.sessionId)
    },
    onFinish: async ({ responseMessage }) => {
      try {
        await opts.onFinish?.({ message: responseMessage })
      } catch (err) {
        console.error("opencode onFinish persistence failed:", err)
      }
    },
  })

  return createUIMessageStream({
    execute: async ({ writer }) => {
      const reader = inner.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          writer.write(value)
        }
      } catch (err) {
        writer.write({
          type: "error",
          errorText: err instanceof Error ? err.message : String(err),
        })
      }
    },
  })
}
