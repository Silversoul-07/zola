import assert from "node:assert"
import { parseCanvasSegments } from "./parse"

// plain text, no canvas
assert.deepEqual(parseCanvasSegments("hello"), [{ kind: "text", text: "hello" }])

// complete canvas block with surrounding text
const full = parseCanvasSegments(
  'before\n```canvas title="Sea"\nline1\nline2\n```\nafter'
)
assert.equal(full.length, 3)
assert.deepEqual(full[0], { kind: "text", text: "before\n" })
assert.deepEqual(full[1], {
  kind: "canvas",
  title: "Sea",
  content: "line1\nline2",
  complete: true,
})
assert.deepEqual(full[2], { kind: "text", text: "after" })

// streaming / unclosed block
const streaming = parseCanvasSegments('```canvas title="Sea"\nline1\nline2')
assert.equal(streaming.length, 1)
assert.deepEqual(streaming[0], {
  kind: "canvas",
  title: "Sea",
  content: "line1\nline2",
  complete: false,
})

// no title attribute
const noTitle = parseCanvasSegments("```canvas\nbody\n```\n")
assert.equal(noTitle[0].kind, "canvas")
assert.equal((noTitle[0] as { title: string }).title, "Untitled")

console.log("parse.test.ts OK")
