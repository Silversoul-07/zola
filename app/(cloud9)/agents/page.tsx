"use client"

import { PageHeader } from "@/app/(cloud9)/_components/page-header"
import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { StatusDot } from "@/app/(cloud9)/_components/status-dot"
import { fetchClient } from "@/lib/fetch"
import { useQuery } from "@tanstack/react-query"

type AgentCard = {
  id: string
  name: string
  model: string
  currentModel: string
  toolsetsCount: number | null
  sessionsCount: number | null
  dashboardUrl: string
  health: { status: string; version?: string; gatewayState?: string; error?: string }
}

export default function AgentsPage() {
  const { data, isLoading, error } = useQuery<{ agents: AgentCard[] }>({
    queryKey: ["cloud9", "agents"],
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/agents")
      if (!res.ok) throw new Error("Failed to load agents")
      return res.json()
    },
  })

  return (
    <div>
      <PageHeader title="Agents" />
      <StatusBlock
        isLoading={isLoading}
        error={error?.message}
        isEmpty={data?.agents.length === 0}
        emptyLabel="No agents configured on the VM yet."
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {data?.agents.map((agent) => (
            <div key={agent.id} className="w-full rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{agent.name}</span>
                <StatusDot status={agent.health.status === "ok" ? "ok" : "error"} />
              </div>
              <div className="text-muted-foreground mt-2 space-y-1 text-[13px]">
                <p>Model: {agent.currentModel}</p>
                <p>Toolsets: {agent.toolsetsCount ?? "—"}</p>
                <p>Sessions: {agent.sessionsCount ?? "—"}</p>
                {agent.health.error && <p className="text-red-500">{agent.health.error}</p>}
              </div>
              <a
                href={agent.dashboardUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground mt-3 inline-block text-[13px] underline underline-offset-2"
              >
                Open dashboard
              </a>
            </div>
          ))}
        </div>
      </StatusBlock>
    </div>
  )
}
