import { formatDataStreamPart } from "@ai-sdk/ui-utils"

// Maps OpenCode's `/event` SSE bus to the AI SDK v4 data-stream protocol
// Zola's client already renders (same job as lib/hermes/stream.ts, mirrored
// for OpenCode's event shape).
//
// Event shapes (from packages/sdk/js/src/gen/types.gen.ts, anomalyco/opencode
// dev branch): every SSE frame is `{ type, properties }`.
//   message.part.updated  -> properties.part (Part), part.sessionID scopes it
//   session.idle          -> properties.sessionID                -> "e:"+"d:" finish
//   session.error         -> properties.sessionID?, properties.error -> "3:" error
// Part union relevant here:
//   TextPart      { id, sessionID, type: "text", text }              -> "0:" delta
//   ReasoningPart { id, sessionID, type: "reasoning", text }         -> "g:" delta
//   ToolPart      { id, sessionID, type: "tool", callID, tool, state }
//     state.status: "pending" | "running" | "completed" | "error"
//     state.input always present; state.output on completed; state.error on error
//     first sighting of a tool part (any status) -> "9:" tool_call
//     status transitions to completed/error (once)  -> "a:" tool_result {output|error}
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

type OpencodeToolPart = {
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

type OpencodeFinishPayload = {
  text: string
  toolParts: OpencodeToolPart[]
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
  onFinish?: (payload: OpencodeFinishPayload) => void | Promise<void>
}

export function opencodeEventsToDataStream(
  sse: ReadableStream<Uint8Array>,
  opts: OpencodeStreamOpts
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (line: string) => controller.enqueue(encoder.encode(line))

      const textByPart = new Map<string, string>()
      const reasoningByPart = new Map<string, string>()
      const toolCalled = new Set<string>()
      const toolFinished = new Set<string>()
      const toolParts: OpencodeToolPart[] = []
      let fullText = ""
      let finished = false
      // The /event bus also replays the user's own message parts; skip them.
      const userMessageIds = new Set<string>()

      const handlePart = (part: OpencodePart) => {
        if (part.sessionID !== opts.sessionId) return
        if (part.messageID && userMessageIds.has(part.messageID)) return

        if (part.type === "text" && typeof part.text === "string") {
          const prev = textByPart.get(part.id) ?? ""
          if (part.text.length > prev.length) {
            const delta = part.text.slice(prev.length)
            textByPart.set(part.id, part.text)
            fullText += delta
            emit(formatDataStreamPart("text", delta))
          }
          return
        }

        if (part.type === "reasoning" && typeof part.text === "string") {
          const prev = reasoningByPart.get(part.id) ?? ""
          if (part.text.length > prev.length) {
            const delta = part.text.slice(prev.length)
            reasoningByPart.set(part.id, part.text)
            emit(formatDataStreamPart("reasoning", delta))
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
            emit(
              formatDataStreamPart("tool_call", {
                toolCallId: part.callID,
                toolName,
                args,
              })
            )
            toolParts.push({
              type: "tool-invocation",
              toolInvocation: {
                state: "call",
                step: 0,
                toolCallId: part.callID,
                toolName,
                args,
              },
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
            const result =
              state.status === "completed"
                ? (norm.result ?? { output: state.output })
                : {
                    error:
                      typeof state.error === "string"
                        ? state.error
                        : JSON.stringify(state.error),
                  }
            emit(
              formatDataStreamPart("tool_result", {
                toolCallId: part.callID,
                result,
              })
            )
            toolParts.push({
              type: "tool-invocation",
              toolInvocation: {
                state: "result",
                step: 0,
                toolCallId: part.callID,
                toolName: norm.toolName,
                args: norm.args,
                result,
              },
            })
          }
        }
      }

      const handleFrame = (frame: string) => {
        const dataLine = frame
          .split("\n")
          .find((line) => line.startsWith("data:"))
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
              | { id?: string; role?: string; sessionID?: string }
              | undefined
            if (info?.sessionID === opts.sessionId && info.role === "user" && info.id) {
              userMessageIds.add(info.id)
            }
            break
          }
          case "message.part.updated": {
            const part = event.properties?.part as OpencodePart | undefined
            if (part) handlePart(part)
            break
          }
          case "session.idle": {
            if (event.properties?.sessionID !== opts.sessionId) break
            emit(
              formatDataStreamPart("finish_step", {
                finishReason: "stop",
                isContinued: false,
              })
            )
            emit(formatDataStreamPart("finish_message", { finishReason: "stop" }))
            finished = true
            break
          }
          case "session.error": {
            const sid = event.properties?.sessionID
            if (sid && sid !== opts.sessionId) break
            const error = event.properties?.error
            const message =
              typeof error === "string"
                ? error
                : (error as { message?: string; data?: { message?: string } } | undefined)
                    ?.data?.message ||
                  (error as { message?: string } | undefined)?.message ||
                  "OpenCode agent request failed"
            emit(formatDataStreamPart("error", message))
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
      } catch (err) {
        emit(
          formatDataStreamPart(
            "error",
            err instanceof Error ? err.message : String(err)
          )
        )
      } finally {
        // Persist and close first: cancelling the shared /event connection can
        // block on the server, and awaiting it here kept the response open.
        try {
          await opts.onFinish?.({ text: fullText, toolParts })
        } catch (err) {
          console.error("opencode onFinish persistence failed:", err)
        }
        controller.close()
        reader.cancel().catch(() => {})
      }
    },
  })
}
