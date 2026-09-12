"use client"

import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockGroup,
} from "@/components/prompt-kit/code-block"
import { useWorkspace } from "@/app/components/workspace/workspace-provider"
import { CodeBlock as ToolCodeBlock } from "@/components/tool-ui/code-block"
import type { ReactNode } from "react"
import { CodeOutput, parseToolResult, type ToolBodyProps } from "./tool-shell"

// First `+` line in a diff body, 1-based, so "Open file" can land the viewer near the change.
function firstChangedLine(body: string): number | undefined {
  const lines = body.split("\n")
  const idx = lines.findIndex((l) => l.startsWith("+") && !l.startsWith("+++"))
  return idx >= 0 ? idx + 1 : undefined
}

// The path itself becomes a click target that opens the file in the right-hand workspace pane.
function OpenFileButton({
  path,
  line,
  className,
}: {
  path: string
  line?: number
  className?: string
}) {
  const { openFile } = useWorkspace()
  return (
    <button
      type="button"
      className={className}
      title={`Open ${path}`}
      onClick={(e) => {
        e.stopPropagation()
        openFile(path, { line })
      }}
    >
      {path}
    </button>
  )
}

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

type DiffFile = { path: string; added: number; removed: number; body: string }

// Splits a unified diff into per-file sections so a multi-file patch
// renders as stacked headers (path + counts), each with its own diff
// body. Adopted from Coder's EditFilesTool / DiffFileHeader.
function parseUnifiedDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = []
  let current: DiffFile | null = null
  let body: string[] = []

  const flush = () => {
    if (current) files.push({ ...current, body: body.join("\n") })
  }

  for (const line of diff.split("\n")) {
    const gitHeader = line.match(/^diff --git a\/(.+) b\/(.+)$/)
    const plusHeader = line.match(/^\+\+\+ (?:b\/)?(.+)$/)
    if (gitHeader) {
      flush()
      current = { path: gitHeader[2], added: 0, removed: 0, body: "" }
      body = []
      continue
    }
    if (!current && plusHeader && plusHeader[1] !== "/dev/null") {
      current = { path: plusHeader[1], added: 0, removed: 0, body: "" }
      body = []
    }
    if (!current) continue
    if (line.startsWith("+++") || line.startsWith("---")) continue
    if (line.startsWith("+")) current.added++
    else if (line.startsWith("-")) current.removed++
    body.push(line)
  }
  flush()

  return files.length > 0 ? files : [{ path: "", added: 0, removed: 0, body: diff }]
}

function DiffView({ file }: { file: DiffFile }) {
  return (
    <CodeBlock className="rounded-md">
      {file.path && (
        <CodeBlockGroup className="border-border text-muted-foreground border-b px-3 py-1.5 font-mono text-xs">
          <OpenFileButton
            path={file.path}
            line={firstChangedLine(file.body)}
            className="hover:text-foreground min-w-0 flex-1 truncate text-left"
          />
          <span className="flex shrink-0 gap-2">
            <span className="text-green-600 dark:text-green-400">
              +{file.added}
            </span>
            <span className="text-red-600 dark:text-red-400">
              -{file.removed}
            </span>
          </span>
        </CodeBlockGroup>
      )}
      <div className="max-h-96 overflow-y-auto">
        <CodeBlockCode code={file.body || " "} language="diff" />
      </div>
    </CodeBlock>
  )
}

// read_file / write_file / patch / search_files
export function FileTool({ toolName, toolData, className }: ToolBodyProps) {
  const { state } = toolData
  const args = toolData.input as Record<string, unknown> | undefined
  const isRunning = state !== "output-available" && state !== "output-error"
  const path = (args?.path ?? args?.file_path ?? firstStringArg(args)) as
    | string
    | undefined
  const result = state === "output-available" ? parseToolResult(toolData.output) : null
  const resultObj = (result && typeof result === "object" ? result : {}) as Record<
    string,
    unknown
  >

  let body: ReactNode = null
  if (toolName === "write_file") {
    body = (
      <div className="space-y-1">
        {path && (
          <OpenFileButton
            path={path}
            className="text-muted-foreground hover:text-foreground block truncate text-left font-mono text-xs"
          />
        )}
        <ToolCodeBlock
          id={toolData.toolCallId}
          code={(args?.content as string) ?? ""}
          language={languageFromPath(path)}
          filename={path}
          lineNumbers="hidden"
          maxCollapsedLines={24}
        />
      </div>
    )
  } else if (toolName === "patch") {
    const diff = (args?.diff ?? args?.patch ?? resultObj.diff ?? "") as string
    const files = diff ? parseUnifiedDiff(diff) : []
    body =
      files.length > 0 ? (
        <div className="space-y-2">
          {files.map((file, i) => (
            <DiffView key={file.path || i} file={file} />
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground text-xs">
          {isRunning ? "Editing…" : "No diff"}
        </div>
      )
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
      <div className="space-y-1">
        {path && (
          <OpenFileButton
            path={path}
            className="text-muted-foreground hover:text-foreground block truncate text-left font-mono text-xs"
          />
        )}
        <CodeOutput code={content} language={languageFromPath(path)} />
      </div>
    ) : (
      <div className="text-muted-foreground text-xs">
        {isRunning ? "Reading…" : "No content"}
      </div>
    )
  }

  return <div className={className}>{body}</div>
}
