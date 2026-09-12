"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AGENTS } from "@/lib/config"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { CaretDownIcon, CheckIcon, RobotIcon } from "@phosphor-icons/react"

const NONE_AGENT = { id: "none", name: "Direct (no agent)" }

export function AgentPicker() {
  const { preferences, setSelectedAgentId } = useUserPreferences()

  if (AGENTS.length === 0) return null

  const options = [...AGENTS, NONE_AGENT]
  const selectedAgent =
    options.find((agent) => agent.id === preferences.selectedAgentId) ||
    AGENTS[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground hover:bg-muted pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm transition-colors"
        >
          <RobotIcon className="size-4" />
          <span className="max-w-32 truncate">{selectedAgent.name}</span>
          <CaretDownIcon className="size-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {options.map((agent) => (
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
