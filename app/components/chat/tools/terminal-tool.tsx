"use client"

import {
  CodeOutput,
  ExitCodeBadge,
  parseToolResult,
  type ToolBodyProps,
} from "./tool-shell"

type TerminalResult = {
  output?: string
  error?: string | null
  exit_code?: number
}

// terminal / execute_code / process_manage
export function TerminalTool({ toolData, className }: ToolBodyProps) {
  const { state } = toolData
  const args = toolData.input as Record<string, unknown> | undefined
  const result =
    state === "output-available"
      ? (parseToolResult(toolData.output) as TerminalResult | null)
      : null

  const hasError =
    state === "output-error" || (result?.error != null && result.error !== "")
  const exitCode = result?.exit_code
  const command = (args?.command ?? args?.code ?? "") as string

  return (
    <div className={className}>
      {result ? (
        <div className="space-y-2">
          {(command || typeof exitCode === "number") && (
            <div className="flex items-center justify-between gap-2">
              {command && (
                <pre className="text-muted-foreground m-0 min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs">
                  <span aria-hidden className="select-none">
                    $
                  </span>{" "}
                  {command}
                </pre>
              )}
              {typeof exitCode === "number" && <ExitCodeBadge code={exitCode} />}
            </div>
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
    </div>
  )
}
