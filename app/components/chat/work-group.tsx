"use client"

import { MessageResponse } from "@/components/ai-elements/message"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { isToolUIPart, type UIMessage } from "ai"
import { BrainIcon, ChevronDownIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { type OpencodePermissionData, PermissionCard } from "./permission-card"
import { StepRow, ToolInvocation } from "./tool-invocation"
import { getToolLabel } from "./tools/tool-labels"

type Part = UIMessage["parts"][number]

export type Run =
  | { kind: "text"; text: string }
  | { kind: "work"; parts: Part[] }

const isWork = (p: Part) =>
  isToolUIPart(p) || p.type === "reasoning" || p.type === "data-opencode-permission"

// Split a message into alternating prose and work runs, in order. A work run
// is a batch of consecutive tool calls / reasoning / permission prompts;
// the prose between batches stays prose (Claude.ai's "text, tools, text").
export function segmentParts(parts: Part[]): Run[] {
  const runs: Run[] = []
  for (const p of parts) {
    const last = runs[runs.length - 1]
    if (isWork(p)) {
      if (last?.kind === "work") last.parts.push(p)
      else runs.push({ kind: "work", parts: [p] })
    } else if (p.type === "text" && p.text) {
      if (last?.kind === "text") last.text += p.text
      else runs.push({ kind: "text", text: p.text })
    }
  }
  return runs.filter((r) => r.kind === "work" || r.text.trim())
}

function firstLine(text: string, max = 110): string {
  const line = text.trim().split("\n").find((l) => l.trim()) ?? ""
  return line.length > max ? `${line.slice(0, max)}…` : line
}

function toolNameOf(p: Part): string {
  if ("toolName" in p && typeof p.toolName === "string") return p.toolName
  return p.type.startsWith("tool-") ? p.type.slice(5) : p.type
}

const COMMAND_TOOLS = new Set(["terminal", "execute_code", "process_manage"])

function groupLabel(parts: Part[], running: boolean): string {
  const tools = parts.filter(isToolUIPart)
  const n = tools.length
  if (n === 0) return running ? "Thinking…" : "Thought"
  if (n === 1) return getToolLabel(toolNameOf(tools[0]), running)
  const allCommands = tools.every((t) => COMMAND_TOOLS.has(toolNameOf(t)))
  if (allCommands) return running ? `Running ${n} commands…` : `Ran ${n} commands`
  return running ? `Using ${n} tools…` : `Used ${n} tools`
}

// One collapsible batch of tool calls, inline in the reply. Header is the
// batch label ("Ran 2 commands"); body is one flat row per step.
export function WorkGroup({
  parts,
  streaming,
  timings,
  showTools,
}: {
  parts: Part[]
  streaming: boolean
  timings?: Record<string, number>
  showTools: boolean
}) {
  const [open, setOpen] = useState(streaming)
  useEffect(() => {
    if (!streaming) setOpen(false)
  }, [streaming])

  const visible = parts.filter(
    (p) => showTools || p.type === "data-opencode-permission"
  )
  if (visible.length === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full min-w-0">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1 py-1 text-left text-sm transition-colors">
        <span className={cn(streaming && "animate-pulse")}>{groupLabel(parts, streaming)}</span>
        <ChevronDownIcon
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <div className="border-border/60 divide-border/60 flex w-full min-w-0 flex-col divide-y rounded-lg border">
          {visible.map((part, i) => {
            if (part.type === "reasoning") {
              return (
                <StepRow
                  key={i}
                  icon={<BrainIcon />}
                  label="Thinking"
                  summary={firstLine(part.text)}
                  running={streaming && i === visible.length - 1}
                >
                  <div className="prose prose-sm dark:prose-invert text-muted-foreground w-full min-w-0 max-w-full">
                    <MessageResponse>{part.text}</MessageResponse>
                  </div>
                </StepRow>
              )
            }
            if (isToolUIPart(part)) {
              return (
                <ToolInvocation key={part.toolCallId ?? i} toolInvocations={[part]} timings={timings} />
              )
            }
            if (part.type === "data-opencode-permission") {
              const data = (part as { data: OpencodePermissionData }).data
              return (
                <div key={data.id ?? i} className="px-2 py-1">
                  <PermissionCard data={data} />
                </div>
              )
            }
            return null
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
