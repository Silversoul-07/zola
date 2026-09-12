// Feeds a hand-written OpenCode /event SSE sample through the mapper and
// asserts the UI message stream chunks it produces. Run with:
//   npx tsx scripts/opencode-stream.test.mjs
import assert from "node:assert/strict"
import { opencodeEventsToUIMessageStream } from "../lib/opencode/stream.ts"

const SESSION_ID = "sess_1"

const events = [
  { type: "server.connected", properties: {} },
  {
    type: "message.part.updated",
    properties: {
      part: {
        id: "part_1",
        sessionID: SESSION_ID,
        type: "text",
        text: "Hel",
      },
    },
  },
  {
    type: "message.part.updated",
    properties: {
      part: {
        id: "part_1",
        sessionID: SESSION_ID,
        type: "text",
        text: "Hello",
      },
    },
  },
  {
    type: "message.part.updated",
    properties: {
      part: {
        id: "part_2",
        sessionID: SESSION_ID,
        type: "tool",
        callID: "call_1",
        tool: "bash",
        state: { status: "pending", input: { command: "ls" } },
      },
    },
  },
  {
    type: "message.part.updated",
    properties: {
      part: {
        id: "part_2",
        sessionID: SESSION_ID,
        type: "tool",
        callID: "call_1",
        tool: "bash",
        state: {
          status: "completed",
          input: { command: "ls" },
          output: "file1\nfile2",
          title: "ls",
        },
      },
    },
  },
  {
    type: "permission.updated",
    properties: {
      id: "perm_1",
      type: "bash",
      pattern: "rm -rf *",
      sessionID: SESSION_ID,
      messageID: "msg_1",
      callID: "call_2",
      title: "Run rm -rf *?",
      metadata: {},
    },
  },
  {
    type: "session.idle",
    properties: { sessionID: SESSION_ID },
  },
]

const sseText = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("")

const encoder = new TextEncoder()
const sourceStream = new ReadableStream({
  start(controller) {
    // Split across two chunks to exercise the buffer/frame-boundary logic.
    const bytes = encoder.encode(sseText)
    const mid = Math.floor(bytes.length / 2)
    controller.enqueue(bytes.slice(0, mid))
    controller.enqueue(bytes.slice(mid))
    controller.close()
  },
})

let finishedMessage
const uiStream = opencodeEventsToUIMessageStream(sourceStream, {
  sessionId: SESSION_ID,
  onFinish: ({ message }) => {
    finishedMessage = message
  },
})

const reader = uiStream.getReader()
const chunks = []
for (;;) {
  const { done, value } = await reader.read()
  if (done) break
  chunks.push(value)
}

console.log(JSON.stringify(chunks, null, 2))

const types = chunks.map((c) => c.type)
assert.ok(types.includes("start"), "expected a start chunk")
assert.ok(types.includes("text-start"), "expected a text-start chunk")

const textDeltas = chunks.filter((c) => c.type === "text-delta")
assert.equal(
  textDeltas.map((c) => c.delta).join(""),
  "Hello",
  "expected text deltas to reassemble to 'Hello'"
)

const toolInputChunk = chunks.find((c) => c.type === "tool-input-available")
assert.ok(toolInputChunk, "expected a tool-input-available chunk")
assert.equal(toolInputChunk.toolCallId, "call_1")
assert.equal(toolInputChunk.toolName, "terminal")
assert.deepEqual(toolInputChunk.input, { command: "ls" })

const toolOutputChunk = chunks.find((c) => c.type === "tool-output-available")
assert.ok(toolOutputChunk, "expected a tool-output-available chunk")
assert.equal(toolOutputChunk.toolCallId, "call_1")
assert.deepEqual(toolOutputChunk.output, { output: "file1\nfile2" })

const permissionChunk = chunks.find((c) => c.type === "data-opencode-permission")
assert.ok(permissionChunk, "expected a data-opencode-permission chunk")
assert.equal(permissionChunk.id, "perm_1")
assert.equal(permissionChunk.data.type, "bash")
assert.equal(permissionChunk.data.title, "Run rm -rf *?")

assert.ok(types.includes("finish"), "expected a finish chunk")

assert.ok(finishedMessage, "expected onFinish to receive the reconstructed message")
const finishedText = finishedMessage.parts
  .filter((p) => p.type === "text")
  .map((p) => p.text)
  .join("")
assert.equal(finishedText, "Hello")
const finishedToolPart = finishedMessage.parts.find(
  (p) => p.type === "tool-terminal"
)
assert.ok(finishedToolPart, "expected a tool-terminal part on the reconstructed message")
assert.equal(finishedToolPart.state, "output-available")

// --- Cancellation: simulates a browser refresh mid-stream. The HTTP
// consumer cancels the output reader after only the first chunk, but
// onFinish must still receive the full accumulated text once the upstream
// /event bus finishes draining in the background. ---
{
  const sourceStream2 = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseText))
      controller.close()
    },
  })

  let finishedMessage2
  let resolveFinished
  const finished2 = new Promise((resolve) => {
    resolveFinished = resolve
  })
  const uiStream2 = opencodeEventsToUIMessageStream(sourceStream2, {
    sessionId: SESSION_ID,
    onFinish: ({ message }) => {
      finishedMessage2 = message
      resolveFinished()
    },
  })

  const reader2 = uiStream2.getReader()
  await reader2.read() // consume only the first chunk
  await reader2.cancel() // simulate the client disconnecting

  await Promise.race([
    finished2,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("onFinish did not fire after cancel")),
        2000
      )
    ),
  ])

  const finishedText2 = finishedMessage2.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("")
  assert.equal(
    finishedText2,
    "Hello",
    "expected onFinish to receive full text even after the reader was cancelled early"
  )
}

console.log("opencode-stream.test.mjs: all assertions passed")
