"use client"

import { Globe } from "@phosphor-icons/react"
import type { ReactNode } from "react"
import { CodeOutput, parseToolResult, ToolShell, type ToolBodyProps } from "./tool-shell"

type LinkItem = { title?: string; url?: string; snippet?: string }

function hostname(url?: string) {
  if (!url) return ""
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

// web_search / web_extract / browser_navigate
export function WebTool({ toolData, defaultOpen, className }: ToolBodyProps) {
  const { toolInvocation } = toolData
  const { state, args, toolName } = toolInvocation
  const isRunning = state !== "result"
  const title = (args?.query ?? args?.url ?? toolName) as string
  const result = state === "result" ? parseToolResult(toolInvocation.result) : null
  const resultObj = (result && typeof result === "object" ? result : {}) as Record<
    string,
    unknown
  >

  const items: LinkItem[] = Array.isArray(result)
    ? (result as LinkItem[]).filter((i) => i && typeof i === "object" && "url" in i)
    : Array.isArray(resultObj.results)
      ? (resultObj.results as LinkItem[])
      : []

  let body: ReactNode
  if (toolName === "web_extract") {
    const text =
      typeof result === "string"
        ? result
        : ((resultObj.text as string) ?? (resultObj.content as string) ?? "")
    body = text ? (
      <CodeOutput code={text} />
    ) : (
      <div className="text-muted-foreground text-xs">
        {isRunning ? "Extracting…" : "No content"}
      </div>
    )
  } else if (items.length > 0) {
    body = (
      <div className="space-y-2">
        {items.slice(0, 5).map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-accent -mx-1.5 block rounded px-1.5 py-1"
          >
            <div className="truncate text-sm font-medium">{item.title || item.url}</div>
            <div className="bg-secondary text-muted-foreground mt-1 inline-block rounded-full px-1.5 py-0.5 font-mono text-[11px]">
              {hostname(item.url)}
            </div>
            {item.snippet && (
              <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                {item.snippet}
              </div>
            )}
          </a>
        ))}
      </div>
    )
  } else {
    body = (
      <div className="text-muted-foreground text-xs">
        {isRunning ? "Working…" : "No results"}
      </div>
    )
  }

  return (
    <ToolShell
      icon={<Globe />}
      title={title}
      running={isRunning}
      defaultOpen={defaultOpen}
      className={className}
    >
      {body}
    </ToolShell>
  )
}
