import { getToolName, isToolUIPart, type UIMessage } from "ai"

type Source = { id?: string; url: string; title: string }

// Pulls citation-style sources out of a message's parts: v5's own
// source-url parts, plus our summarizeSources tool's citation payload.
export function getSources(parts: UIMessage["parts"] | undefined): Source[] {
  const sources = (parts ?? [])
    .map((part) => {
      if (part.type === "source-url") {
        return { id: part.sourceId, url: part.url, title: part.title || part.url }
      }

      if (isToolUIPart(part) && part.state === "output-available") {
        const toolName = getToolName(part)
        const output = part.output as
          | { result?: Array<{ citations?: unknown[] }> }
          | unknown[]
          | undefined

        if (
          toolName === "summarizeSources" &&
          output &&
          typeof output === "object" &&
          "result" in output &&
          Array.isArray(output.result)
        ) {
          return output.result.flatMap(
            (item: { citations?: unknown[] }) => item.citations || []
          )
        }

        return Array.isArray(output) ? output.flat() : null
      }

      return null
    })
    .filter(Boolean)
    .flat()

  return (sources as Source[]).filter(
    (source) => source && typeof source === "object" && source.url
  )
}
