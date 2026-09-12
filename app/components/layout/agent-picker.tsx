"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AGENTS } from "@/lib/config"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { CaretDownIcon, CheckIcon, CpuIcon } from "@phosphor-icons/react"

const triggerClassName =
  "text-muted-foreground hover:text-foreground hover:bg-muted pointer-events-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors"

export function AgentPicker() {
  const { preferences, setSelectedAgentId } = useUserPreferences()

  if (AGENTS.length === 0) return null

  const selectedAgent =
    AGENTS.find((agent) => agent.id === preferences.selectedAgentId) ||
    AGENTS[0]

  // Only one runtime configured: show a non-interactive label instead of a
  // dropdown with nothing to pick.
  if (AGENTS.length === 1) {
    return (
      <span title="Runtime" className={triggerClassName}>
        <CpuIcon className="size-4" />
        <span className="max-w-32 truncate">{selectedAgent.name}</span>
      </span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" title="Runtime" className={triggerClassName}>
          <CpuIcon className="size-4" />
          <span className="max-w-32 truncate">{selectedAgent.name}</span>
          <CaretDownIcon className="size-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {AGENTS.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            className="flex items-center justify-between"
            onSelect={() => setSelectedAgentId(agent.id)}
          >
            <span className="truncate">{agent.name}</span>
            {agent.id === selectedAgent.id && (
              <CheckIcon className="size-4 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
