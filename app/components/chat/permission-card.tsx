"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ShieldWarningIcon } from "@phosphor-icons/react"
import { useState } from "react"

export type OpencodePermissionData = {
  id: string
  type: string
  pattern?: string | string[]
  sessionID: string
  messageID: string
  callID?: string
  title: string
  metadata: Record<string, unknown>
}

type PermissionResponse = "once" | "always" | "reject"

// Renders a `permission.updated` OpenCode event as an approve/deny card (see
// .claude/docs/runtime-coverage.md item 3). Answered state is local only:
// once replied, the card just shows what was picked, keyed by permission id
// so it survives re-renders as new parts stream in.
export function PermissionCard({ data }: { data: OpencodePermissionData }) {
  const [answered, setAnswered] = useState<PermissionResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reply = async (response: PermissionResponse) => {
    if (isSubmitting || answered) return
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/cloud9/opencode/permission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: data.sessionID,
          permissionId: data.id,
          response,
        }),
      })
      if (res.ok) setAnswered(response)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="not-prose mb-4 w-full rounded-md border">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <ShieldWarningIcon className="size-4 text-yellow-600" />
        <span className="text-sm font-medium">{data.title}</span>
      </div>
      <div className="space-y-3 px-4 py-3">
        <p className="text-muted-foreground text-sm">
          OpenCode wants to run <code className="text-foreground">{data.type}</code>
          {data.pattern
            ? `: ${Array.isArray(data.pattern) ? data.pattern.join(", ") : data.pattern}`
            : "."}
        </p>
        {answered ? (
          <p className="text-muted-foreground text-sm italic">
            {answered === "reject" ? "Rejected" : `Allowed (${answered})`}
          </p>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => reply("once")}
            >
              Allow once
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => reply("always")}
            >
              Always
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={cn("text-destructive hover:text-destructive")}
              disabled={isSubmitting}
              onClick={() => reply("reject")}
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
