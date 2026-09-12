// Feeds a hand-written Hermes /v1/responses SSE sample through the mapper
// and asserts the UI message stream chunks it produces. Run with:
//   npx tsx scripts/hermes-stream.test.mjs
import assert from "node:assert/strict"
import { hermesResponsesToUIMessageStream } from "../lib/hermes/stream.ts"

const events = [
  { type: "response.created" },
  { type: "response.output_text.delta", delta: "Hel" },
  { type: "response.output_text.delta", delta: "lo" },
  {
    type: "response.output_item.done",
    item: {
      type: "function_call",
      status: "completed",
      call_id: "call_1",
      name: "terminal",
      arguments: JSON.stringify({ command: "echo hi" }),
    },
  },
  {
    type: "response.output_item.done",
    item: {
      type: "function_call_output",
      call_id: "call_1",
      output: [{ text: JSON.stringify({ output: "hi" }) }],
    },
  },
  {
    type: "response.completed",
    response: { usage: { input_tokens: 10, output_tokens: 2 } },
  },
]

const sseText = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n"

const encoder = new TextEncoder()
const sourceStream = new ReadableStream({
  start(controller) {
    const bytes = encoder.encode(sseText)
    const mid = Math.floor(bytes.length / 2)
    controller.enqueue(bytes.slice(0, mid))
    controller.enqueue(bytes.slice(mid))
    controller.close()
  },
})

let finishedMessage
const uiStream = hermesResponsesToUIMessageStream(sourceStream, {
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
assert.deepEqual(toolInputChunk.input, { command: "echo hi" })

const toolOutputChunk = chunks.find((c) => c.type === "tool-output-available")
assert.ok(toolOutputChunk, "expected a tool-output-available chunk")
assert.equal(toolOutputChunk.toolCallId, "call_1")
assert.deepEqual(toolOutputChunk.output, { output: "hi" })

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

console.log("hermes-stream.test.mjs: all assertions passed")
