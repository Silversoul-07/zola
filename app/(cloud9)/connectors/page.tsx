"use client"

import { PageHeader } from "@/app/(cloud9)/_components/page-header"
import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { StatusDot } from "@/app/(cloud9)/_components/status-dot"
import { Button } from "@/components/ui/button"
import { fetchClient } from "@/lib/fetch"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"

type McpServer = { name: string; enabled: boolean; transport: string; status?: string }
type Toolset = { name: string; label: string; description: string; enabled: boolean; tools: string[] }

type ConnectorsResponse = {
  mcp: { servers?: McpServer[]; error?: string; configured?: boolean }
  toolsets: Toolset[]
  toolsetsError: string | null
}

// Toolset labels come back with an emoji prefix (e.g. "🔍 web_search"); the design wants a plain
// title-cased name instead, built from `name` rather than `label`.
function titleCase(name: string) {
  return name
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ConnectorsPage() {
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

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
    onSuccess: (_body, name) => setTestResults((r) => ({ ...r, [name]: { ok: true, message: "ok" } })),
    onError: (err: Error, name) =>
      setTestResults((r) => ({ ...r, [name]: { ok: false, message: err.message } })),
  })

  return (
    <div>
      <PageHeader title="Connectors" />

      <section className="mb-8">
        <h2 className="text-muted-foreground mb-2 text-[13px]">MCP servers</h2>
        <StatusBlock
          isLoading={isLoading}
          error={error?.message || (!data?.mcp.servers ? data?.mcp.error : undefined)}
          isEmpty={data?.mcp.servers?.length === 0}
          emptyLabel={
            data?.mcp.configured === false
              ? "Dashboard login failed. Check HERMES_DASHBOARD_USER / HERMES_DASHBOARD_PASSWORD."
              : "No MCP servers configured."
          }
        >
          <div className="divide-y divide-border rounded-xl border border-border">
            {data?.mcp.servers?.map((server) => {
              const result = testResults[server.name]
              return (
                <div key={server.name} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusDot status={server.enabled ? "ok" : "muted"} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{server.name}</p>
                      <p className="text-muted-foreground truncate font-mono text-[13px]">
                        {server.transport}
                        {server.status ? ` — ${server.status}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {result && (
                      <span className={result.ok ? "text-sky-500 text-[13px]" : "text-red-500 text-[13px]"}>
                        {result.ok ? "ok" : result.message}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={testMutation.isPending}
                      onClick={() => testMutation.mutate(server.name)}
                    >
                      Test
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </StatusBlock>
      </section>

      <section>
        <h2 className="text-muted-foreground mb-2 text-[13px]">Toolsets</h2>
        <StatusBlock
          isLoading={isLoading}
          error={data?.toolsetsError ?? undefined}
          isEmpty={data?.toolsets.length === 0}
        >
          <div className="divide-y divide-border rounded-xl border border-border">
            {data?.toolsets.map((toolset) => {
              const isOpen = expanded[toolset.name]
              const shown = isOpen ? toolset.tools : toolset.tools.slice(0, 4)
              const more = toolset.tools.length - shown.length
              return (
                <div key={toolset.name} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{titleCase(toolset.name)}</p>
                    <p className="text-muted-foreground truncate text-[13px]">
                      {shown.join(", ")}
                      {more > 0 && (
                        <button
                          type="button"
                          className="text-foreground ml-1 underline underline-offset-2"
                          onClick={() => setExpanded((e) => ({ ...e, [toolset.name]: true }))}
                        >
                          +{more} more
                        </button>
                      )}
                    </p>
                  </div>
                  <StatusDot status={toolset.enabled ? "ok" : "muted"} className="shrink-0" />
                </div>
              )
            })}
          </div>
        </StatusBlock>
      </section>
    </div>
  )
}
