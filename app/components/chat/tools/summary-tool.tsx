"use client"

import { parseToolResult, type ToolBodyProps } from "./tool-shell"

function firstMeaningfulArg(args: Record<string, unknown> | undefined) {
  if (!args) return undefined
  for (const v of Object.values(args)) {
    if (typeof v === "string" && v.trim()) return v
  }
  return undefined
}

// delegate_task, memory, todo_list, skill_*, cronjob_manage, session_search,
// manage_connections: one-line summary row, expands to the generic JSON view.
export function SummaryTool({ toolData, className }: ToolBodyProps) {
  const { state } = toolData
  const args = toolData.input as Record<string, unknown> | undefined
  const isRunning = state !== "output-available" && state !== "output-error"
  const result = state === "output-available" ? parseToolResult(toolData.output) : null
  const summaryArg = firstMeaningfulArg(args)

  return (
    <div className={className}>
      <div className="space-y-2 font-mono text-xs">
        {summaryArg && (
          <div className="text-muted-foreground not-italic">{summaryArg}</div>
        )}
        {args && Object.keys(args).length > 0 && (
          <pre className="whitespace-pre-wrap">{JSON.stringify(args, null, 2)}</pre>
        )}
        {result != null && (
          <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        )}
        {isRunning && !args && (
          <div className="text-muted-foreground text-xs">Working…</div>
        )}
      </div>
    </div>
  )
}
