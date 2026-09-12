"use client"

import { PageHeader } from "@/app/(cloud9)/_components/page-header"
import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
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
  sessions: Section<{
    count: number
    totalInputTokens: number
    totalOutputTokens: number
    recent: { id: string; model: string; last_active: number }[]
  }>
  litellmSpend: Section<Record<string, unknown>>
  recentFailures: {
    hermes: { id: string; title: string; end_reason: string | null }[]
    litellm: Record<string, unknown>[]
    litellmError: string | null
  }
}

// date-fns isn't installed; Intl.RelativeTimeFormat covers "12 min ago" fine. Hermes timestamps
// are epoch seconds in this codebase's other age fields, so scale up if the value looks too small
// to be milliseconds.
function relativeTime(epoch: number) {
  const ms = epoch < 1e12 ? epoch * 1000 : epoch
  const diffMin = Math.round((ms - Date.now()) / 60000)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute")
  const diffHr = Math.round(diffMin / 60)
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour")
  return rtf.format(Math.round(diffHr / 24), "day")
}

function Rows({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  )
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
    <div>
      <PageHeader title="Observe" />

      <StatusBlock isLoading={isLoading} error={error?.message}>
        <div className="space-y-8">
          <section>
            <h2 className="text-muted-foreground mb-2 text-[13px]">Agent</h2>
            <StatusBlock isLoading={false} error={data?.health.ok ? undefined : data?.health.error}>
              <Rows
                items={[
                  ["Version", data?.health.data?.version],
                  ["Gateway", data?.health.data?.gateway_state],
                  ["Active agents", data?.health.data?.active_agents],
                  [
                    "Checks",
                    data?.health.data &&
                      Object.entries(data.health.data.readiness.checks)
                        .map(([name, c]) => `${name}=${c.status}`)
                        .join(", "),
                  ],
                ]}
              />
            </StatusBlock>
          </section>

          <section>
            <h2 className="text-muted-foreground mb-2 text-[13px]">Sessions</h2>
            <StatusBlock isLoading={false} error={data?.sessions.ok ? undefined : data?.sessions.error}>
              <div className="text-muted-foreground mb-2 text-[13px]">
                {data?.sessions.data?.count} sessions ·{" "}
                {data?.sessions.data?.totalInputTokens.toLocaleString()} in ·{" "}
                {data?.sessions.data?.totalOutputTokens.toLocaleString()} out
              </div>
              <StatusBlock isLoading={false} isEmpty={data?.sessions.data?.recent.length === 0} emptyLabel="No sessions.">
                <div className="divide-y divide-border rounded-xl border border-border">
                  {data?.sessions.data?.recent.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
                      <span className="truncate font-mono text-[13px]">{s.id}</span>
                      <span className="text-muted-foreground text-[13px]">{s.model}</span>
                      <span className="text-muted-foreground text-[13px]">{relativeTime(s.last_active)}</span>
                    </div>
                  ))}
                </div>
              </StatusBlock>
            </StatusBlock>
          </section>

          <section>
            <h2 className="text-muted-foreground mb-2 text-[13px]">LiteLLM</h2>
            {data?.litellmSpend.ok ? (
              <pre className="bg-muted overflow-auto rounded-xl p-3 text-xs">
                {JSON.stringify(data.litellmSpend.data, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground text-sm">LiteLLM is only reachable from the VM.</p>
            )}
            {data?.recentFailures.litellmError == null && data?.recentFailures.litellm.length ? (
              <pre className="bg-muted mt-2 overflow-auto rounded-xl p-3 text-xs">
                {JSON.stringify(data.recentFailures.litellm, null, 2)}
              </pre>
            ) : null}
          </section>
        </div>
      </StatusBlock>
    </div>
  )
}
