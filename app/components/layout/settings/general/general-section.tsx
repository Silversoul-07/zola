"use client"

import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { Button } from "@/components/ui/button"
import { fetchClient } from "@/lib/fetch"
import { SignOut } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"

type Row = [string, string]

async function signOut() {
  await fetchClient("/api/auth/logout", { method: "POST" })
  window.location.assign("/auth")
}

// Read-only: these values come from the environment (see .env.example), not from a form.
// `rows` is passed by the server-rendered /settings page; the settings dialog (client-only,
// no server ancestor to thread env through) fetches the same rows from the API route instead.
export function GeneralSection({ rows: rowsProp }: { rows?: Row[] }) {
  const shouldFetch = !rowsProp
  const { data, isLoading } = useQuery<{ rows: Row[] }>({
    queryKey: ["cloud9", "settings", "general"],
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/settings/general")
      return res.json()
    },
    enabled: shouldFetch,
  })
  const rows = rowsProp ?? data?.rows ?? []

  return (
    <div className="space-y-4">
      <StatusBlock isLoading={shouldFetch && isLoading}>
        <dl className="divide-border divide-y text-sm">
          {rows.map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between gap-6 py-2.5"
            >
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate font-mono text-xs">{v}</dd>
            </div>
          ))}
        </dl>
      </StatusBlock>
      <p className="text-muted-foreground text-xs">
        Set via environment variables. Edit <code>.env</code> and restart to
        change.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        onClick={signOut}
      >
        <SignOut className="size-4" />
        <span>Sign out</span>
      </Button>
    </div>
  )
}
