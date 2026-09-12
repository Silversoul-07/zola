"use client"

import { Image as ImageIcon } from "@phosphor-icons/react"
import { getToolLabel } from "./tool-labels"
import { parseToolResult, ToolShell, type ToolBodyProps } from "./tool-shell"

function findImageUrl(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined
  const obj = result as Record<string, unknown>
  const candidates = [obj.url, obj.image_url, obj.image, obj.data_url]
  return candidates.find((v) => typeof v === "string") as string | undefined
}

function findCaption(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined
  const obj = result as Record<string, unknown>
  const candidates = [obj.caption, obj.description, obj.text]
  return candidates.find((v) => typeof v === "string") as string | undefined
}

// vision_analyze / image_generate
export function MediaTool({ toolData, defaultOpen, className }: ToolBodyProps) {
  const { toolInvocation } = toolData
  const { state, toolName } = toolInvocation
  const isRunning = state !== "result"
  const result = state === "result" ? parseToolResult(toolInvocation.result) : null
  const imageUrl = findImageUrl(result)
  const caption = findCaption(result)

  return (
    <ToolShell
      icon={<ImageIcon />}
      label={getToolLabel(toolName, isRunning)}
      summary={caption}
      running={isRunning}
      defaultOpen={defaultOpen}
      className={className}
    >
      {imageUrl ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- tool result URL, not a build-time asset */}
          <img
            src={imageUrl}
            alt={caption || toolName}
            className="max-h-[320px] max-w-[320px] rounded border object-contain"
          />
          {caption && <div className="text-muted-foreground text-xs">{caption}</div>}
        </div>
      ) : (
        <div className="text-muted-foreground text-xs">
          {isRunning ? "Processing…" : caption || "No image"}
        </div>
      )}
    </ToolShell>
  )
}
