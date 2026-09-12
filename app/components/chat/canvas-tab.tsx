"use client"

import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
  ArtifactHeader,
} from "@/components/ai-elements/artifact"
import { MessageResponse } from "@/components/ai-elements/message"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspace } from "@/app/components/workspace/workspace-provider"
import { CopyIcon, DownloadIcon, EyeIcon, FileTextIcon, PencilIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const SAVE_DEBOUNCE_MS = 800

type Selection = { text: string; top: number; left: number }

export function CanvasTab({
  canvasId,
  title: initialTitle,
  content: initialContent,
  contentVersion,
  onClose,
}: {
  canvasId: string
  title: string
  content: string
  /** Bumped whenever the agent pushes new content; re-syncs the local editor state. */
  contentVersion: number
  onClose: () => void
}) {
  const { updateCanvasTitle, sendCanvasInstruction } = useWorkspace()
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [preview, setPreview] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [instruction, setInstruction] = useState("")
  const bodyRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Re-sync from the agent's pushed content; user edits never bump contentVersion,
  // so this never clobbers in-progress typing.
  useEffect(() => {
    setContent(initialContent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentVersion])

  const save = (patch: { title?: string; content?: string }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch(`/api/cloud9/canvas/${canvasId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => {})
    }, SAVE_DEBOUNCE_MS)
  }

  const handleTitleChange = (value: string) => {
    setTitle(value)
    updateCanvasTitle(canvasId, value)
    save({ title: value })
  }

  const handleContentChange = (value: string) => {
    setContent(value)
    save({ content: value })
  }

  const handleSelect = () => {
    const el = bodyRef.current?.querySelector("textarea")
    if (!el) return
    const { selectionStart, selectionEnd } = el
    if (selectionStart === selectionEnd) {
      setSelection(null)
      return
    }
    const text = el.value.slice(selectionStart, selectionEnd)
    const rect = el.getBoundingClientRect()
    const containerRect = bodyRef.current!.getBoundingClientRect()
    setSelection({
      text,
      top: rect.top - containerRect.top + 24,
      left: Math.min(rect.left - containerRect.left + 24, containerRect.width - 260),
    })
  }

  const submitInstruction = () => {
    if (!selection || !instruction.trim()) return
    sendCanvasInstruction(
      `In the canvas "${title}", regarding this selection:\n\n${selection.text}\n\n${instruction}\n\nReturn the full updated document in a \`\`\`canvas block.`
    )
    setInstruction("")
    setSelection(null)
  }

  const download = () => {
    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${title || "document"}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Artifact className="h-full flex-1 rounded-none border-0">
      <ArtifactHeader>
        <div className="flex min-w-0 items-center gap-2">
          <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-7 border-none bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-1"
          />
        </div>
        <ArtifactActions>
          <ArtifactAction
            tooltip={preview ? "Edit" : "Preview"}
            icon={preview ? PencilIcon : EyeIcon}
            onClick={() => setPreview((p) => !p)}
          />
          <ArtifactAction
            tooltip="Copy"
            icon={CopyIcon}
            onClick={() => navigator.clipboard.writeText(content)}
          />
          <ArtifactAction tooltip="Download .md" icon={DownloadIcon} onClick={download} />
          <ArtifactClose onClick={onClose} />
        </ArtifactActions>
      </ArtifactHeader>

      <ArtifactContent className="flex flex-1 flex-col overflow-hidden p-0">
        <div ref={bodyRef} className="relative flex flex-1 flex-col overflow-auto">
          {preview ? (
            <div className="prose dark:prose-invert size-full max-w-none overflow-auto p-4">
              <MessageResponse>{content}</MessageResponse>
            </div>
          ) : (
            <Textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onSelect={handleSelect}
              onBlur={() => setTimeout(() => setSelection(null), 150)}
              placeholder="Write, or ask the agent to write, a document…"
              className="size-full flex-1 resize-none rounded-none border-none font-mono text-sm shadow-none focus-visible:ring-0"
            />
          )}

          {selection && (
            <div
              className="bg-popover absolute z-20 flex w-64 flex-col gap-2 rounded-md border p-2 shadow-md"
              style={{ top: selection.top, left: selection.left }}
            >
              <Input
                autoFocus
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitInstruction()}
                placeholder="Make it more creative…"
                className="h-8 text-sm"
              />
              <Button size="sm" className="h-7 self-end" onClick={submitInstruction}>
                Ask
              </Button>
            </div>
          )}
        </div>
      </ArtifactContent>
    </Artifact>
  )
}
