"use client"

import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchClient } from "@/lib/fetch"
import { useQuery } from "@tanstack/react-query"

type Section<T> = { ok: boolean; data?: T; error?: string }

type ObserveResponse = {
  health: Section<{
    version: string
    gateway_state: string
    active_agents: number
    readiness: { checks: Record<string, { status: string }> }
  }>
  sessions: Section<{ count: number; totalInputTokens: number; totalOutputTokens: number }>
  litellmSpend: Section<Record<string, unknown>>
  recentFailures: {
    hermes: { id: string; title: string; end_reason: string | null }[]
    litellm: Record<string, unknown>[]
    litellmError: string | null
  }
}

export default function ObservePage() {
  const { data, isLoading, error } = useQuery<ObserveResponse>({
    queryKey: ["cloud9", "observe"],
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/observe")
      if (!res.ok) throw new Error("Failed to load observability data")
      return res.json()
    },
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Observe</h1>

      <StatusBlock isLoading={isLoading} error={error?.message}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">VM / agent status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusBlock isLoading={false} error={data?.health.ok ? undefined : data?.health.error}>
                <ul className="space-y-1 text-sm">
                  <li>Version: {data?.health.data?.version}</li>
                  <li>Gateway: {data?.health.data?.gateway_state}</li>
                  <li>Active agents: {data?.health.data?.active_agents}</li>
                  <li>
                    Checks:{" "}
                    {data?.health.data &&
                      Object.entries(data.health.data.readiness.checks)
                        .map(([name, c]) => `${name}=${c.status}`)
                        .join(", ")}
                  </li>
                </ul>
              </StatusBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hermes sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusBlock isLoading={false} error={data?.sessions.ok ? undefined : data?.sessions.error}>
                <ul className="space-y-1 text-sm">
                  <li>Sessions: {data?.sessions.data?.count}</li>
                  <li>Input tokens: {data?.sessions.data?.totalInputTokens.toLocaleString()}</li>
                  <li>Output tokens: {data?.sessions.data?.totalOutputTokens.toLocaleString()}</li>
                </ul>
              </StatusBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">LiteLLM spend</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusBlock
                isLoading={false}
                error={data?.litellmSpend.ok ? undefined : data?.litellmSpend.error || "LiteLLM unreachable"}
              >
                <pre className="bg-muted overflow-auto rounded-md p-2 text-xs">
                  {JSON.stringify(data?.litellmSpend.data, null, 2)}
                </pre>
              </StatusBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent failures</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground text-xs">Hermes sessions with a non-normal end reason:</p>
              <StatusBlock isLoading={false} isEmpty={data?.recentFailures.hermes.length === 0} emptyLabel="None.">
                <ul className="space-y-1">
                  {data?.recentFailures.hermes.map((s) => (
                    <li key={s.id}>
                      {s.title} — {s.end_reason}
                    </li>
                  ))}
                </ul>
              </StatusBlock>
              <p className="text-muted-foreground pt-2 text-xs">LiteLLM 4xx/5xx log entries:</p>
              <StatusBlock
                isLoading={false}
                error={data?.recentFailures.litellmError ?? undefined}
                isEmpty={data?.recentFailures.litellm.length === 0}
                emptyLabel="None."
              >
                <pre className="bg-muted overflow-auto rounded-md p-2 text-xs">
                  {JSON.stringify(data?.recentFailures.litellm, null, 2)}
                </pre>
              </StatusBlock>
            </CardContent>
          </Card>
        </div>
      </StatusBlock>
    </div>
  )
}
