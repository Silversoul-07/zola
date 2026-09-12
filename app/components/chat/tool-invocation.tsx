"use client"

import { cn } from "@/lib/utils"
import type { ToolInvocationUIPart } from "@ai-sdk/ui-utils"
import { Wrench } from "@phosphor-icons/react"
import { getToolLabel } from "./tools/tool-labels"
import { getToolRenderer } from "./tools"
import { parseToolResult, ToolShell } from "./tools/tool-shell"

interface ToolInvocationProps {
  toolInvocations: ToolInvocationUIPart[]
  className?: string
  defaultOpen?: boolean
}

// Renders one compact transcript row per tool call, stacked with no gap so
// consecutive calls read as a single tight block (adopted from Coder's
// Conversation / TranscriptRow layout).
export function ToolInvocation({
  toolInvocations,
  className,
  defaultOpen = false,
}: ToolInvocationProps) {
  const toolInvocationsData = Array.isArray(toolInvocations)
    ? toolInvocations
    : [toolInvocations]

  // Group by toolCallId and keep the most informative state per call
  // (result > call > partial-call), since the same call can appear
  // multiple times as it streams in.
  const groupedTools = toolInvocationsData.reduce(
    (acc, item) => {
      const { toolCallId } = item.toolInvocation
      ;(acc[toolCallId] ??= []).push(item)
      return acc
    },
    {} as Record<string, ToolInvocationUIPart[]>
  )

  const toolsToDisplay = Object.values(groupedTools)
    .map(
      (group) =>
        group.find((item) => item.toolInvocation.state === "result") ||
        group.find((item) => item.toolInvocation.state === "call") ||
        group.find((item) => item.toolInvocation.state === "partial-call")
    )
    .filter(Boolean) as ToolInvocationUIPart[]

  if (toolsToDisplay.length === 0) return null

  return (
    <div className={cn("mb-4 flex flex-col", className)}>
      {toolsToDisplay.map((tool) => (
        <ToolCard
          key={tool.toolInvocation.toolCallId}
          toolData={tool}
          defaultOpen={defaultOpen}
        />
      ))}
    </div>
  )
}

// Dispatches to a dedicated per-tool renderer (compact, expandable, no raw
// JSON) when one exists for this toolName; otherwise falls back to the
// generic JSON-dump renderer below.
function ToolCard({
  toolData,
  defaultOpen,
}: {
  toolData: ToolInvocationUIPart
  defaultOpen?: boolean
}) {
  const Renderer = getToolRenderer(toolData.toolInvocation.toolName)
  if (Renderer) {
    return <Renderer toolData={toolData} defaultOpen={defaultOpen} />
  }
  return <GenericToolCard toolData={toolData} defaultOpen={defaultOpen} />
}

function GenericToolCard({
  toolData,
  defaultOpen,
}: {
  toolData: ToolInvocationUIPart
  defaultOpen?: boolean
}) {
  const { toolInvocation } = toolData
  const { state, toolName, args } = toolInvocation
  const isRunning = state !== "result"
  const result = state === "result" ? parseToolResult(toolInvocation.result) : null

  return (
    <ToolShell
      icon={<Wrench />}
      label={getToolLabel(toolName, isRunning)}
      summary={toolName}
      running={isRunning}
      defaultOpen={defaultOpen}
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
