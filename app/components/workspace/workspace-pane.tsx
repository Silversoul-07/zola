"use client"

import { CodeBlockCode } from "@/components/prompt-kit/code-block"
import { cn } from "@/lib/utils"
import { MagnifyingGlass, X } from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { useWorkspace } from "./workspace-provider"

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

function languageFromPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase()
  return (ext && EXT_LANG[ext]) || "text"
}

function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path
}

type FileState =
  | { status: "loading" }
  | { status: "ready"; content: string }
  | { status: "error"; error: string }

const MIN_WIDTH = 320
const DEFAULT_WIDTH_PCT = 0.4

export function WorkspacePane() {
  const { isOpen, tabs, activePath, openFile, close, setActivePath, closeTab } = useWorkspace()
  const [width, setWidth] = useState<number | null>(null)
  const [files, setFiles] = useState<Record<string, FileState>>({})
  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<string[]>([])
  const paneRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const activeTab = tabs.find((t) => t.path === activePath) ?? null
  const activeFile = activePath ? files[activePath] : undefined

  // Fetch content once per opened path; cached in `files` so tab switches don't refetch.
  useEffect(() => {
    if (!activePath || files[activePath]) return
    setFiles((prev) => ({ ...prev, [activePath]: { status: "loading" } }))
    fetch(`/api/cloud9/file?path=${encodeURIComponent(activePath)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        const content = data.type === "text" ? data.content : JSON.stringify(data, null, 2)
        setFiles((prev) => ({ ...prev, [activePath]: { status: "ready", content } }))
      })
      .catch((err) => {
        setFiles((prev) => ({
          ...prev,
          [activePath]: {
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          },
        }))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath])

  // Scroll to the requested line once shiki has rendered the `.line` spans (bounded poll).
  useEffect(() => {
    if (!activeTab?.line || activeFile?.status !== "ready") return
    let cancelled = false
    let attempts = 0
    const tryScroll = () => {
      if (cancelled) return
      const target = bodyRef.current?.querySelectorAll(".line")[activeTab.line! - 1]
      if (target) {
        target.scrollIntoView({ block: "center" })
        return
      }
      if (attempts++ < 20) requestAnimationFrame(tryScroll)
    }
    tryScroll()
    return () => {
      cancelled = true
    }
  }, [activeTab?.path, activeTab?.line, activeFile?.status])

  // Quick open: debounced search against /api/cloud9/files?q=
  useEffect(() => {
    if (!query.trim()) {
      setMatches([])
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/cloud9/files?q=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setMatches(Array.isArray(data) ? data.slice(0, 20) : []))
        .catch(() => setMatches([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && paneRef.current?.contains(document.activeElement)) close()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [isOpen, close])

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth =
      paneRef.current?.getBoundingClientRect().width ?? window.innerWidth * DEFAULT_WIDTH_PCT
    const onMove = (moveEvent: MouseEvent) => {
      const next = startWidth - (moveEvent.clientX - startX)
      setWidth(Math.min(Math.max(next, MIN_WIDTH), window.innerWidth * 0.8))
    }
    const onUp = () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  if (!isOpen) return null

  return (
    <div
      ref={paneRef}
      tabIndex={-1}
      style={{ width: width ?? `${DEFAULT_WIDTH_PCT * 100}%` }}
      className="border-border bg-background relative hidden h-dvh shrink-0 flex-col overflow-hidden border-l md:flex"
    >
      <div
        onMouseDown={startDrag}
        className="hover:bg-border absolute top-0 left-0 z-10 h-full w-1 cursor-col-resize"
      />

      <div className="border-border flex flex-col gap-1.5 border-b p-2">
        <div className="relative">
          <MagnifyingGlass className="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2" size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Quick open…"
            className="border-border bg-background w-full rounded-md border py-1 pr-2 pl-7 text-sm focus:outline-none"
          />
        </div>
        {matches.length > 0 && (
          <ul className="border-border max-h-40 overflow-y-auto rounded-md border text-xs">
            {matches.map((m) => (
              <li key={m}>
                <button
                  className="hover:bg-muted block w-full truncate px-2 py-1 text-left font-mono"
                  onClick={() => {
                    openFile(m)
                    setQuery("")
                    setMatches([])
                  }}
                >
                  {m}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {tabs.length > 1 && (
        <div className="border-border flex shrink-0 overflow-x-auto border-b">
          {tabs.map((t) => (
            <button
              key={t.path}
              onClick={() => setActivePath(t.path)}
              className={cn(
                "border-border flex shrink-0 items-center gap-1.5 border-r px-2 py-1 text-xs",
                t.path === activePath ? "bg-muted" : "hover:bg-muted/50"
              )}
            >
              <span className="max-w-32 truncate font-mono">{fileName(t.path)}</span>
              <X
                size={12}
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(t.path)
                }}
              />
            </button>
          ))}
        </div>
      )}

      {activePath && (
        <div className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1.5">
          <button
            title="Copy path"
            onClick={() => navigator.clipboard.writeText(activePath)}
            className="text-muted-foreground hover:text-foreground truncate font-mono text-xs"
          >
            {activePath}
          </button>
          <button onClick={close} aria-label="Close workspace pane" className="shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      <div ref={bodyRef} className="workspace-code flex-1 overflow-auto text-[13px]">
        <style>{`
          .workspace-code code { counter-reset: line; }
          .workspace-code .line { counter-increment: line; }
          .workspace-code .line::before {
            content: counter(line);
            display: inline-block;
            width: 2.5rem;
            margin-right: 0.75rem;
            text-align: right;
            color: var(--muted-foreground);
            user-select: none;
          }
        `}</style>
        {!activePath ? (
          <div className="text-muted-foreground p-4 text-xs">No file open</div>
        ) : !activeFile || activeFile.status === "loading" ? (
          <div className="text-muted-foreground p-4 text-xs">Reading file…</div>
        ) : activeFile.status === "error" ? (
          <div className="text-muted-foreground p-4 text-xs">
            Could not read {activePath}: {activeFile.error}
          </div>
        ) : (
          <CodeBlockCode code={activeFile.content} language={languageFromPath(activePath)} />
        )}
      </div>
    </div>
  )
}
