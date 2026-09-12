"use client"

import { useWorkspace } from "@/app/components/workspace/workspace-provider"
import {
  Artifact,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { FileTextIcon } from "lucide-react"
import { useEffect, useRef } from "react"

type UpsertedCanvas = { id: string; title: string; content: string }

// Renders a ```canvas fenced block (see lib/canvas/prompt.ts) as a compact
// document card, and upserts it to the DB once the block is complete and the
// message has finished streaming.
export function CanvasBlock({
  title,
  content,
  complete,
  streaming,
}: {
  title: string
  content: string
  complete: boolean
  /** True while the parent assistant message is still streaming. */
  streaming: boolean
}) {
  const { chatId } = useChatSession()
  const { tabs, openCanvas, updateCanvasContent } = useWorkspace()
  const upsertedRef = useRef(false)
  const canvasRef = useRef<UpsertedCanvas | null>(null)
  // True only for a block written in this session; a reloaded chat renders
  // its cards without popping the pane open.
  const liveRef = useRef(false)
  if (streaming) liveRef.current = true

  useEffect(() => {
    if (!complete || streaming || upsertedRef.current || !chatId) return
    upsertedRef.current = true
    ;(async () => {
      try {
        // ponytail: "the chat's canvas" = most recently updated row for this
        // chat (see route comment); a per-turn canvasId thread would be more
        // precise if multiple canvases per chat becomes a real use case.
        const listRes = await fetch(`/api/cloud9/canvas?chatId=${encodeURIComponent(chatId)}`)
        const existing = listRes.ok ? ((await listRes.json()) as UpsertedCanvas[]) : []
        const current = existing[0]

        const res = current
          ? await fetch(`/api/cloud9/canvas/${current.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title, content }),
            })
          : await fetch("/api/cloud9/canvas", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chatId, title, content }),
            })
        if (!res.ok) return
        const canvas = (await res.json()) as UpsertedCanvas
        canvasRef.current = canvas

        if (liveRef.current) {
          openCanvas(canvas.id, title, content)
        } else if (tabs.some((t) => t.kind === "canvas" && t.id === canvas.id)) {
          updateCanvasContent(canvas.id, content, title)
        }
      } catch {
        // Best-effort: the card still renders from the message text either way.
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, streaming, chatId])

  const open = () => {
    const canvas = canvasRef.current
    if (canvas) openCanvas(canvas.id, canvas.title, canvas.content)
  }

  return (
    <Artifact
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && open()}
      className="w-full max-w-sm cursor-pointer transition-colors hover:bg-muted/40"
    >
      <ArtifactHeader className="border-b-0 py-2.5">
        <div className="flex items-center gap-2.5">
          <FileTextIcon className="text-muted-foreground size-5 shrink-0" />
          <div className="flex flex-col">
            <ArtifactTitle>{title || "Untitled"}</ArtifactTitle>
            <ArtifactDescription>
              {complete ? "Document" : "Writing…"}
            </ArtifactDescription>
          </div>
        </div>
      </ArtifactHeader>
    </Artifact>
  )
}
