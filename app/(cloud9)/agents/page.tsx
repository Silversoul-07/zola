"use client"

import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Agents</h1>
      <StatusBlock isLoading={isLoading} error={error?.message} isEmpty={data?.agents.length === 0}>
        <div className="grid gap-4 sm:grid-cols-2">
          {data?.agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{agent.name}</CardTitle>
                <Badge variant={agent.health.status === "ok" ? "default" : "destructive"}>
                  {agent.health.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Model: </span>
                  {agent.currentModel}
                </p>
                <p>
                  <span className="text-muted-foreground">Toolsets: </span>
                  {agent.toolsetsCount ?? "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Sessions: </span>
                  {agent.sessionsCount ?? "—"}
                </p>
                {agent.health.error && <p className="text-destructive">{agent.health.error}</p>}
                <a
                  href={agent.dashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-block pt-1 underline"
                >
                  Open dashboard
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </StatusBlock>
    </div>
  )
}
