"use client"

import {
  CodeBlock,
  CodeBlockCode,
} from "@/components/prompt-kit/code-block"
import { cn } from "@/lib/utils"
import { CaretDown, Spinner, Warning } from "@phosphor-icons/react"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useState } from "react"
import { Shimmer } from "./shimmer"

const TRANSITION = {
  type: "spring",
  duration: 0.2,
  bounce: 0,
} as const

// Compact single-line transcript row every per-tool renderer uses: icon +
// label + summary + status, expanding on click. Borderless by default so
// consecutive rows stack tightly (see tool-invocation.tsx); the expanded
// body gets its own bordered panel. Adopted from Coder's TranscriptRow /
// ToolCall primitives.
export function ToolShell({
  icon,
  label,
  summary,
  badge,
  running,
  error,
  defaultOpen = false,
  className,
  children,
}: {
  icon: ReactNode
  label: string
  summary?: ReactNode
  badge?: ReactNode
  running?: boolean
  error?: boolean
  defaultOpen?: boolean
  className?: string
  children?: ReactNode
}) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen)
  const hasBody = children !== undefined && children !== null

  return (
    <div className={cn("flex flex-col text-[13px]", className)}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          if (hasBody) setIsExpanded((v) => !v)
        }}
        className={cn(
          "text-muted-foreground flex min-h-6 w-full min-w-0 items-center gap-2 rounded text-left transition-colors",
          hasBody && "hover:text-foreground cursor-pointer"
        )}
      >
        <span className="shrink-0 [&_svg]:size-4">{icon}</span>
        {running ? (
          <Shimmer className="shrink-0 truncate text-sky-500">{label}</Shimmer>
        ) : (
          <span className={cn("shrink-0 truncate", error && "text-red-500")}>
            {label}
          </span>
        )}
        {summary && (
          <span className="text-muted-foreground/70 min-w-0 flex-1 truncate font-mono text-xs">
            {summary}
          </span>
        )}
        {running && (
          <Spinner className="size-3.5 shrink-0 animate-spin text-sky-500" />
        )}
        {error && !running && (
          <Warning className="size-3.5 shrink-0 text-red-500" />
        )}
        {badge}
        {hasBody && (
          <CaretDown
            className={cn(
              "size-3 shrink-0 transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && hasBody && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={TRANSITION}
            className="overflow-hidden"
          >
            <div className="border-border bg-muted/40 mb-1 ml-6 rounded-md border px-3 py-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ExitCodeBadge({ code }: { code: number }) {
  const ok = code === 0
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 font-mono text-[11px]",
        ok
          ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
          : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
      )}
    >
      exit {code}
    </span>
  )
}

// Code block with a "Show more" toggle once the content is longer than
// `maxLines`. Scrollable so a fully-expanded huge output doesn't blow up
// the page.
export function CodeOutput({
  code,
  language = "text",
  maxLines = 12,
  className,
}: {
  code: string
  language?: string
  maxLines?: number
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const lines = code.split("\n")
  const isTruncated = lines.length > maxLines
  const display = isTruncated && !expanded ? lines.slice(0, maxLines).join("\n") : code

  return (
    <div className={className}>
      <CodeBlock className="rounded-md">
        <div className="max-h-96 overflow-y-auto">
          <CodeBlockCode code={display || " "} language={language} />
        </div>
      </CodeBlock>
      {isTruncated && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground mt-1 text-xs underline underline-offset-2"
        >
          {expanded ? "Show less" : `Show more (${lines.length - maxLines} more lines)`}
        </button>
      )}
    </div>
  )
}

// Hermes tool results sometimes arrive as plain objects, sometimes wrapped
// as `{ content: [{ type: "text", text: "<json>" }] }`. Normalize both.
export function parseToolResult(result: unknown): unknown {
  if (result === undefined || result === null) return null
  if (Array.isArray(result)) return result
  if (typeof result === "object" && "content" in (result as Record<string, unknown>)) {
    const content = (result as Record<string, unknown>).content
    const textContent = Array.isArray(content)
      ? content.find((item) => item?.type === "text")
      : null
    if (typeof textContent?.text === "string") {
      try {
        return JSON.parse(textContent.text)
      } catch {
        return textContent.text
      }
    }
  }
  return result
}

export type ToolBodyProps = {
  toolData: import("@ai-sdk/ui-utils").ToolInvocationUIPart
  defaultOpen?: boolean
  className?: string
}
