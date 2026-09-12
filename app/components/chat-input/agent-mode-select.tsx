"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEffect, useState } from "react"

// Options come from OpenCode's own agent list (build/plan/...), see
// app/api/cloud9/opencode/agents/route.ts. Falls back to the two agents
// every OpenCode install ships with while that request is in flight.
export function AgentModeSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [modes, setModes] = useState<string[]>(["build", "plan"])

  useEffect(() => {
    fetch("/api/cloud9/opencode/agents")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { agents?: { name: string }[] } | null) => {
        if (data?.agents?.length) setModes(data.agents.map((a) => a.name))
      })
      .catch(() => {})
  }, [])

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="h-8 w-auto gap-1 rounded-full border-none bg-transparent px-3 text-sm shadow-none"
        title="OpenCode agent mode"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {modes.map((mode) => (
          <SelectItem key={mode} value={mode}>
            {mode}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
