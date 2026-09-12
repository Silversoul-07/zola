// Feeds a hand-written OpenCode /event SSE sample through the mapper and
// asserts the AI SDK v4 data-stream lines it produces. Run with:
//   npx tsx scripts/opencode-stream.test.mjs
import assert from "node:assert/strict"
import { opencodeEventsToDataStream } from "../lib/opencode/stream.ts"

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

let finishPayload
const out = opencodeEventsToDataStream(sourceStream, {
  sessionId: SESSION_ID,
  onFinish: (payload) => {
    finishPayload = payload
  },
})

const reader = out.getReader()
const decoder = new TextDecoder()
let text = ""
for (;;) {
  const { done, value } = await reader.read()
  if (done) break
  text += decoder.decode(value)
}

const lines = text.split("\n").filter(Boolean)
console.log(text)

assert.equal(lines[0], '0:"Hel"')
assert.equal(lines[1], '0:"lo"')

const toolCallLine = lines.find((l) => l.startsWith("9:"))
assert.ok(toolCallLine, "expected a 9: tool_call line")
assert.deepEqual(JSON.parse(toolCallLine.slice(2)), {
  toolCallId: "call_1",
  toolName: "bash",
  args: { command: "ls" },
})

const toolResultLine = lines.find((l) => l.startsWith("a:"))
assert.ok(toolResultLine, "expected an a: tool_result line")
assert.deepEqual(JSON.parse(toolResultLine.slice(2)), {
  toolCallId: "call_1",
  result: { output: "file1\nfile2" },
})

const finishStepLine = lines.find((l) => l.startsWith("e:"))
assert.ok(finishStepLine, "expected an e: finish_step line")
assert.deepEqual(JSON.parse(finishStepLine.slice(2)), {
  finishReason: "stop",
  isContinued: false,
})

const finishMessageLine = lines.find((l) => l.startsWith("d:"))
assert.ok(finishMessageLine, "expected a d: finish_message line")
assert.deepEqual(JSON.parse(finishMessageLine.slice(2)), {
  finishReason: "stop",
})

assert.equal(finishPayload.text, "Hello")
assert.equal(finishPayload.toolParts.length, 2)

console.log("opencode-stream.test.mjs: all assertions passed")
