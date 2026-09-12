"use client"

import { Wrench } from "@phosphor-icons/react"
import { parseToolResult, ToolShell, type ToolBodyProps } from "./tool-shell"

function firstMeaningfulArg(args: Record<string, unknown> | undefined) {
  if (!args) return undefined
  for (const v of Object.values(args)) {
    if (typeof v === "string" && v.trim()) return v
  }
  return undefined
}

// delegate_task, memory, todo_list, skill_*, cronjob_manage, session_search,
// manage_connections: one-line summary row, expands to the generic JSON view.
export function SummaryTool({ toolData, defaultOpen, className }: ToolBodyProps) {
  const { toolInvocation } = toolData
  const { state, args, toolName } = toolInvocation
  const isRunning = state !== "result"
  const result = state === "result" ? parseToolResult(toolInvocation.result) : null
  const summaryArg = firstMeaningfulArg(args as Record<string, unknown> | undefined)

  return (
    <ToolShell
      icon={<Wrench />}
      title={summaryArg ? `${toolName}: ${summaryArg}` : toolName}
      running={isRunning}
      defaultOpen={defaultOpen}
      className={className}
    >
      <div className="space-y-2 font-mono text-xs">
        {args && Object.keys(args).length > 0 && (
          <pre className="whitespace-pre-wrap">{JSON.stringify(args, null, 2)}</pre>
        )}
        {result != null && (
          <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        )}
      </div>
    </ToolShell>
  )
}
