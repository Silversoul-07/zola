"use client"

import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

type McpServer = { name: string; enabled: boolean; transport: string; status?: string }
type Toolset = { name: string; label: string; description: string; enabled: boolean; tools: string[] }

type ConnectorsResponse = {
  mcp: { servers?: McpServer[]; error?: string; configured?: boolean }
  toolsets: Toolset[]
  toolsetsError: string | null
}

export default function ConnectorsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery<ConnectorsResponse>({
    queryKey: ["cloud9", "connectors"],
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/connectors")
      if (!res.ok) throw new Error("Failed to load connectors")
      return res.json()
    },
  })

  const testMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetchClient("/api/cloud9/connectors/test", {
        method: "POST",
        body: JSON.stringify({ name }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Test failed")
      return body
    },
    onSuccess: () => {
      toast({ title: "Connector test passed" })
      queryClient.invalidateQueries({ queryKey: ["cloud9", "connectors"] })
    },
    onError: (err: Error) => toast({ title: "Connector test failed", description: err.message }),
  })

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Connectors</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">MCP servers</h2>
        <StatusBlock
          isLoading={isLoading}
          error={error?.message || (!data?.mcp.servers ? data?.mcp.error : undefined)}
          isEmpty={data?.mcp.servers?.length === 0}
          emptyLabel={
            data?.mcp.configured === false
              ? "Connect the dashboard: set HERMES_DASHBOARD_TOKEN to see MCP servers."
              : "No MCP servers configured."
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {data?.mcp.servers?.map((server) => (
              <Card key={server.name}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{server.name}</CardTitle>
                  <Badge variant={server.enabled ? "default" : "secondary"}>
                    {server.enabled ? "enabled" : "disabled"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-muted-foreground">{server.transport}</p>
                    {server.status && <p className="text-muted-foreground">{server.status}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={testMutation.isPending}
                    onClick={() => testMutation.mutate(server.name)}
                  >
                    Test
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </StatusBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Toolsets</h2>
        <StatusBlock
          isLoading={isLoading}
          error={data?.toolsetsError ?? undefined}
          isEmpty={data?.toolsets.length === 0}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {data?.toolsets.map((toolset) => (
              <Card key={toolset.name}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{toolset.label}</CardTitle>
                  <Badge variant={toolset.enabled ? "default" : "secondary"}>
                    {toolset.enabled ? "enabled" : "disabled"}
                  </Badge>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  {toolset.description}
                </CardContent>
              </Card>
            ))}
          </div>
        </StatusBlock>
      </section>
    </div>
  )
}
