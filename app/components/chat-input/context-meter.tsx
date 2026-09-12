"use client"

import {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "@/components/ai-elements/context"
import type { LanguageModelUsage } from "ai"
import { useEffect, useState } from "react"

const FALLBACK = 128_000

// AI Elements Context meter fed by the last assistant turn's usage
// (`data-turn` part). Window size comes from LiteLLM's model info.
export function ContextMeter({
  usage,
  modelId,
}: {
  usage?: LanguageModelUsage
  modelId: string
}) {
  const [maxTokens, setMaxTokens] = useState(FALLBACK)
  useEffect(() => {
    let alive = true
    fetch(`/api/cloud9/context-window?model=${encodeURIComponent(modelId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { maxTokens?: number } | null) => {
        if (alive && d?.maxTokens) setMaxTokens(d.maxTokens)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [modelId])

  if (!usage) return null
  const used = usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)

  return (
    <Context maxTokens={maxTokens} modelId={modelId} usage={usage} usedTokens={used}>
      <ContextTrigger size="sm" className="h-8 rounded-full px-2" />
      <ContextContent>
        <ContextContentHeader />
        <ContextContentBody>
          <ContextInputUsage />
          <ContextOutputUsage />
          <ContextReasoningUsage />
          <ContextCacheUsage />
        </ContextContentBody>
        <ContextContentFooter />
      </ContextContent>
    </Context>
  )
}
