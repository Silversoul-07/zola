// Feeds a hand-written Hermes /v1/responses SSE sample through the mapper and
// asserts the AI SDK v4 data-stream lines it produces. Run with:
//   npx tsx scripts/hermes-stream.test.mjs
import assert from "node:assert/strict"
import { hermesResponsesToDataStream } from "../lib/hermes/stream.ts"

const frames = [
  {
    type: "response.output_text.delta",
    delta: "Hello, ",
  },
  {
    type: "response.output_text.delta",
    delta: "world!",
  },
  {
    type: "response.output_item.done",
    output_index: 1,
    item: {
      id: "fc_1",
      type: "function_call",
      status: "completed",
      name: "get_weather",
      call_id: "call_abc",
      arguments: '{"city":"Paris"}',
    },
  },
  {
    type: "response.output_item.done",
    output_index: 2,
    item: {
      id: "fco_1",
      type: "function_call_output",
      call_id: "call_abc",
      status: "completed",
      output: [{ type: "input_text", text: '{"tempC":21}' }],
    },
  },
  {
    type: "response.completed",
    response: {
      id: "resp_1",
      status: "completed",
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    },
  },
]

const sseText = frames
  .map((f) => `event: ${f.type}\ndata: ${JSON.stringify(f)}\n\n`)
  .join("")

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

const out = hermesResponsesToDataStream(sourceStream, { messageId: "msg_1" })
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

assert.equal(lines[0], 'f:{"messageId":"msg_1"}')
assert.equal(lines[1], '0:"Hello, "')
assert.equal(lines[2], '0:"world!"')

const toolCallLine = lines.find((l) => l.startsWith("9:"))
assert.ok(toolCallLine, "expected a 9: tool_call line")
const toolCall = JSON.parse(toolCallLine.slice(2))
assert.deepEqual(toolCall, {
  toolCallId: "call_abc",
  toolName: "get_weather",
  args: { city: "Paris" },
})

const toolResultLine = lines.find((l) => l.startsWith("a:"))
assert.ok(toolResultLine, "expected an a: tool_result line")
const toolResult = JSON.parse(toolResultLine.slice(2))
assert.deepEqual(toolResult, {
  toolCallId: "call_abc",
  result: { tempC: 21 },
})

const finishStepLine = lines.find((l) => l.startsWith("e:"))
assert.ok(finishStepLine, "expected an e: finish_step line")
assert.deepEqual(JSON.parse(finishStepLine.slice(2)), {
  finishReason: "stop",
  usage: { promptTokens: 10, completionTokens: 5 },
  isContinued: false,
})

const finishMessageLine = lines.find((l) => l.startsWith("d:"))
assert.ok(finishMessageLine, "expected a d: finish_message line")
assert.deepEqual(JSON.parse(finishMessageLine.slice(2)), {
  finishReason: "stop",
  usage: { promptTokens: 10, completionTokens: 5 },
})

console.log("hermes-stream.test.mjs: all assertions passed")
