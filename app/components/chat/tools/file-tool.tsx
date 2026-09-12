"use client"

import { FileCode, MagnifyingGlass } from "@phosphor-icons/react"
import type { ReactNode } from "react"
import { CodeOutput, parseToolResult, ToolShell, type ToolBodyProps } from "./tool-shell"

const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  py: "python",
  md: "markdown",
  css: "css",
  html: "html",
  sh: "bash",
  yml: "yaml",
  yaml: "yaml",
  go: "go",
  rs: "rust",
  java: "java",
}

function languageFromPath(path?: string) {
  const ext = path?.split(".").pop()?.toLowerCase()
  return (ext && EXT_LANG[ext]) || "text"
}

function firstStringArg(args: Record<string, unknown> | undefined) {
  if (!args) return undefined
  return Object.values(args).find((v) => typeof v === "string") as
    | string
    | undefined
}

// read_file / write_file / patch / search_files
export function FileTool({ toolData, defaultOpen, className }: ToolBodyProps) {
  const { toolInvocation } = toolData
  const { state, args, toolName } = toolInvocation
  const isRunning = state !== "result"
  const path = (args?.path ?? args?.file_path ?? firstStringArg(args)) as
    | string
    | undefined
  const result = state === "result" ? parseToolResult(toolInvocation.result) : null
  const resultObj = (result && typeof result === "object" ? result : {}) as Record<
    string,
    unknown
  >

  const icon = toolName === "search_files" ? <MagnifyingGlass /> : <FileCode />

  let body: ReactNode = null
  if (toolName === "write_file") {
    body = <CodeOutput code={(args?.content as string) ?? ""} language={languageFromPath(path)} />
  } else if (toolName === "patch") {
    const diff = (args?.diff ?? args?.patch ?? resultObj.diff ?? "") as string
    body = <CodeOutput code={diff} language="diff" />
  } else if (toolName === "search_files") {
    const query = (args?.query ?? args?.pattern) as string | undefined
    const matches = Array.isArray(resultObj.matches)
      ? (resultObj.matches as unknown[])
      : Array.isArray(result)
        ? (result as unknown[])
        : []
    body = (
      <div className="space-y-1">
        {query && (
          <div className="text-muted-foreground text-xs">
            Query: <span className="font-mono">{query}</span>
          </div>
        )}
        {matches.length > 0 ? (
          <ul className="space-y-0.5 font-mono text-xs">
            {matches.map((m, i) => (
              <li key={i} className="truncate">
                {typeof m === "string" ? m : JSON.stringify(m)}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-muted-foreground text-xs">
            {isRunning ? "Searching…" : "No matches"}
          </div>
        )}
      </div>
    )
  } else {
    // read_file
    const content = (resultObj.content ??
      resultObj.output ??
      (typeof result === "string" ? result : "")) as string
    body = content ? (
      <CodeOutput code={content} language={languageFromPath(path)} />
    ) : (
      <div className="text-muted-foreground text-xs">
        {isRunning ? "Reading…" : "No content"}
      </div>
    )
  }

  return (
    <ToolShell
      icon={icon}
      title={path || toolName}
      running={isRunning}
      defaultOpen={defaultOpen}
      className={className}
    >
      {body}
    </ToolShell>
  )
}
