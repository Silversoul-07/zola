"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { AGENTS } from "@/lib/config"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { CaretDownIcon, CheckIcon, CpuIcon } from "@phosphor-icons/react"

const triggerClassName =
  "text-muted-foreground hover:text-foreground hover:bg-muted pointer-events-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors"

export function AgentPicker() {
  const { preferences, setSelectedAgentId } = useUserPreferences()
  // The picker is the live control: picking an agent inside an open chat
  // switches that chat (persisted below via updateChatAgent), so the chat's
  // own agent_id is what is actually in effect once one exists.
  const { chatId } = useChatSession()
  const { getChatById, updateChatAgent } = useChats()
  const chatAgentId = chatId ? getChatById(chatId)?.agent_id : undefined

  if (AGENTS.length === 0) return null

  const selectedAgent =
    AGENTS.find((agent) => agent.id === (chatAgentId || preferences.selectedAgentId)) ||
    AGENTS[0]

  const handleSelect = (agentId: string) => {
    // Always update the default used for new chats.
    setSelectedAgentId(agentId)
    // If a chat is open, also switch that chat itself from the next message
    // onward, and make the choice stick when the chat is reopened.
    if (chatId) {
      updateChatAgent(chatId, agentId)
    }
  }

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
            onSelect={() => handleSelect(agent.id)}
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
