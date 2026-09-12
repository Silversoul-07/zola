"use client"

import { MessageResponse } from "@/components/ai-elements/message"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { isToolUIPart, type UIMessage } from "ai"
import { BrainIcon, ChevronDownIcon, MessageSquareIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { type OpencodePermissionData, PermissionCard } from "./permission-card"
import { StepRow, ToolInvocation } from "./tool-invocation"

type Part = UIMessage["parts"][number]

function firstLine(text: string, max = 110): string {
  const line = text.trim().split("\n").find((l) => l.trim()) ?? ""
  return line.length > max ? `${line.slice(0, max)}…` : line
}

// Claude-style step group: everything the agent did before its final answer
// (interstitial text, reasoning, tool calls, permission prompts) folds into
// one collapsible block: a summary line with the turn duration, and one flat
// row per step inside.
export function WorkGroup({
  parts,
  streaming,
  durationMs,
  timings,
  showTools,
}: {
  parts: Part[]
  streaming: boolean
  durationMs?: number
  timings?: Record<string, number>
  showTools: boolean
}) {
  const [open, setOpen] = useState(streaming)
  // Collapse once the turn finishes, like Claude's "Worked for 14s".
  useEffect(() => {
    if (!streaming) setOpen(false)
  }, [streaming])

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!streaming) return
    const started = Date.now()
    const t = setInterval(() => setElapsed(Date.now() - started), 1000)
    return () => clearInterval(t)
  }, [streaming])

  const toolCount = parts.filter(isToolUIPart).length
  const thinkingCount = parts.filter((p) => p.type === "reasoning").length
  const firstText = parts.find(
    (p): p is { type: "text"; text: string } => p.type === "text" && !!p.text.trim()
  )
  const counts = [
    thinkingCount ? `${thinkingCount} thinking` : null,
    toolCount ? `${toolCount} tool ${toolCount === 1 ? "call" : "calls"}` : null,
  ]
    .filter(Boolean)
    .join(", ")
  const summary = firstText ? firstLine(firstText.text) : streaming ? "Working" : counts
  const seconds = Math.round((durationMs ?? elapsed) / 1000)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full min-w-0">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full min-w-0 items-center gap-2 py-1 text-left text-sm transition-colors">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            streaming ? "bg-primary animate-pulse" : "bg-muted-foreground/50"
          )}
        />
        <span className="min-w-0 truncate">{summary}</span>
        {firstText && counts && (
          <span className="text-muted-foreground/70 hidden shrink-0 text-xs sm:inline">
            · {counts}
          </span>
        )}
        {seconds > 0 && <span className="shrink-0 text-xs tabular-nums">{seconds}s</span>}
        <ChevronDownIcon
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <div className="border-border/60 flex w-full min-w-0 flex-col rounded-lg border py-1">
          {parts.map((part, i) => {
            if (part.type === "text") {
              if (!part.text.trim()) return null
              return (
                <StepRow key={i} icon={<MessageSquareIcon />} label="Output" summary={firstLine(part.text)}>
                  <div className="prose prose-sm dark:prose-invert text-muted-foreground w-full min-w-0 max-w-full">
                    <MessageResponse>{part.text}</MessageResponse>
                  </div>
                </StepRow>
              )
            }
            if (part.type === "reasoning") {
              if (!part.text) return null
              return (
                <StepRow
                  key={i}
                  icon={<BrainIcon />}
                  label="Thinking"
                  summary={firstLine(part.text)}
                  running={streaming && i === parts.length - 1}
                >
                  <div className="prose prose-sm dark:prose-invert text-muted-foreground w-full min-w-0 max-w-full">
                    <MessageResponse>{part.text}</MessageResponse>
                  </div>
                </StepRow>
              )
            }
            if (isToolUIPart(part)) {
              return showTools ? (
                <ToolInvocation key={part.toolCallId ?? i} toolInvocations={[part]} timings={timings} />
              ) : null
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

// Index of the last "work" part (tool, reasoning, permission). Text after it
// is the final answer; everything up to and including it is the work group.
export function splitWork(parts: Part[]): { work: Part[]; answer: Part[] } {
  let last = -1
  parts.forEach((p, i) => {
    if (isToolUIPart(p) || p.type === "reasoning" || p.type === "data-opencode-permission") last = i
  })
  if (last < 0) return { work: [], answer: parts }
  return { work: parts.slice(0, last + 1), answer: parts.slice(last + 1) }
}
