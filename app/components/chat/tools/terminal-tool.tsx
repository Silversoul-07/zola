"use client"

import { Terminal } from "@phosphor-icons/react"
import { getToolLabel } from "./tool-labels"
import {
  CodeOutput,
  ExitCodeBadge,
  parseToolResult,
  ToolShell,
  type ToolBodyProps,
} from "./tool-shell"

type TerminalResult = {
  output?: string
  error?: string | null
  exit_code?: number
}

// terminal / execute_code / process_manage
export function TerminalTool({ toolData, defaultOpen, className }: ToolBodyProps) {
  const { toolInvocation } = toolData
  const { state, args, toolName } = toolInvocation
  const isRunning = state !== "result"
  const command = (args?.command ?? args?.code ?? "") as string
  const result =
    state === "result"
      ? (parseToolResult(toolInvocation.result) as TerminalResult | null)
      : null

  const hasError = result?.error != null && result.error !== ""
  const exitCode = result?.exit_code

  return (
    <ToolShell
      icon={<Terminal />}
      label={getToolLabel(toolName, isRunning)}
      summary={command}
      running={isRunning}
      error={hasError}
      defaultOpen={defaultOpen}
      className={className}
      badge={
        typeof exitCode === "number" ? <ExitCodeBadge code={exitCode} /> : undefined
      }
    >
      {result ? (
        <div className="space-y-2">
          {command && (
            <pre className="text-muted-foreground m-0 whitespace-pre-wrap break-all font-mono text-xs">
              <span aria-hidden className="select-none">
                $
              </span>{" "}
              {command}
            </pre>
          )}
          {hasError ? (
            <CodeOutput code={String(result.error)} className="[&_pre]:!text-red-500" />
          ) : (
            <CodeOutput code={result.output ?? ""} />
          )}
        </div>
      ) : (
        <div className="text-muted-foreground text-xs">Waiting for output…</div>
      )}
    </ToolShell>
  )
}
