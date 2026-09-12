"use client"

import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool"
import { Shimmer } from "@/components/ai-elements/shimmer"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import { getToolLabel, getToolSummary } from "./tools/tool-labels"
import { getToolRenderer } from "./tools"
import type { ToolUIPart } from "./tools/tool-shell"

interface ToolInvocationProps {
  toolInvocations: UIMessage["parts"]
  className?: string
  defaultOpen?: boolean
}

function toolNameOf(type: string): string {
  return type.startsWith("tool-") ? type.slice("tool-".length) : type
}

// Renders one compact transcript row per tool call, stacked with no gap so
// consecutive calls read as a single tight block (adopted from Coder's
// Conversation / TranscriptRow layout).
export function ToolInvocation({
  toolInvocations,
  className,
  defaultOpen = false,
}: ToolInvocationProps) {
  const toolParts = toolInvocations.filter(
    (part) => part.type.startsWith("tool-") || part.type === "dynamic-tool"
  ) as unknown as ToolUIPart[]

  if (toolParts.length === 0) return null

  return (
    <div className={cn("mb-4 flex w-full min-w-0 max-w-full flex-col", className)}>
      {toolParts.map((tool, i) => (
        <ToolCard
          key={tool.toolCallId ?? `${tool.type}-${i}`}
          toolData={tool}
          defaultOpen={defaultOpen}
        />
      ))}
    </div>
  )
}

// Dispatches to a dedicated per-tool renderer (compact, expandable, no raw
// JSON) when one exists for this toolName; otherwise falls back to Elements'
// generic ToolInput/ToolOutput JSON dump.
function ToolCard({
  toolData,
  defaultOpen,
}: {
  toolData: ToolUIPart
  defaultOpen?: boolean
}) {
  const toolName =
    "toolName" in toolData
      ? String((toolData as { toolName?: string }).toolName)
      : toolNameOf(toolData.type)
  const isRunning = toolData.state !== "output-available" && toolData.state !== "output-error"
  const Renderer = getToolRenderer(toolName)
  const headerProps =
    toolData.type === "dynamic-tool"
      ? { type: toolData.type, state: toolData.state, toolName }
      : { type: toolData.type, state: toolData.state }

  const label = getToolLabel(toolName, isRunning)
  const summary = getToolSummary(toolData.input)
  const title = (
    <span className="flex min-w-0 items-center gap-2">
      {isRunning ? <Shimmer as="span">{label}</Shimmer> : <span>{label}</span>}
      {summary && (
        <span className="text-muted-foreground min-w-0 truncate font-mono text-xs font-normal">
          {summary}
        </span>
      )}
    </span>
  )

  return (
    <Tool defaultOpen={defaultOpen}>
      <ToolHeader title={title} {...headerProps} />
      <ToolContent>
        {Renderer ? (
          <Renderer toolName={toolName} toolData={toolData} />
        ) : (
          <>
            <ToolInput input={toolData.input} />
            <ToolOutput output={toolData.output} errorText={toolData.errorText} />
          </>
        )}
      </ToolContent>
    </Tool>
  )
}
