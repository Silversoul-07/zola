export type CanvasSegment =
  | { kind: "text"; text: string }
  | { kind: "canvas"; title: string; content: string; complete: boolean }

const OPEN_RE = /```canvas(?:\s+title="([^"]*)")?\s*\n/

/**
 * Splits assistant text into plain-text and canvas segments. Handles a
 * still-streaming (unclosed) canvas fence by returning it as an incomplete
 * segment with whatever content has arrived so far.
 */
export function parseCanvasSegments(text: string): CanvasSegment[] {
  const segments: CanvasSegment[] = []
  let rest = text

  for (;;) {
    const match = OPEN_RE.exec(rest)
    if (!match) {
      if (rest) segments.push({ kind: "text", text: rest })
      break
    }

    const before = rest.slice(0, match.index)
    if (before) segments.push({ kind: "text", text: before })

    const afterOpen = rest.slice(match.index + match[0].length)
    const closeIdx = afterOpen.indexOf("\n```")
    const title = match[1] ?? "Untitled"

    if (closeIdx === -1) {
      segments.push({ kind: "canvas", title, content: afterOpen, complete: false })
      break
    }

    segments.push({
      kind: "canvas",
      title,
      content: afterOpen.slice(0, closeIdx),
      complete: true,
    })
    rest = afterOpen.slice(closeIdx + "\n```".length)
    // Drop a single leading newline left by the closing fence line.
    if (rest.startsWith("\n")) rest = rest.slice(1)
  }

  return segments
}
