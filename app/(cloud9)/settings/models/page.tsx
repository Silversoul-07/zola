"use client"

import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { ByokSection } from "@/app/components/layout/settings/apikeys/byok-section"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { fetchClient } from "@/lib/fetch"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type LiteLLMModel = { id: string; owned_by?: string }

const STORAGE_KEY = "cloud9-model-lane-enabled"

export default function ModelsSettingsPage() {
  const { data, isLoading, error } = useQuery<{
    models: LiteLLMModel[]
    modelsError: string | null
    info: Record<string, unknown>[]
    infoError: string | null
  }>({
    queryKey: ["cloud9", "settings", "models"],
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/settings/models")
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "LiteLLM unreachable")
      return body
    },
  })

  // ponytail: enabled-lane toggles are local-only (not synced to a shared preferences store yet).
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) setEnabled(JSON.parse(raw))
  }, [])
  const toggle = (id: string) => {
    const next = { ...enabled, [id]: !(enabled[id] ?? true) }
    setEnabled(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">LiteLLM lanes</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusBlock
            isLoading={isLoading}
            error={error?.message}
            isEmpty={data?.models.length === 0}
            emptyLabel="LiteLLM is unreachable from here (host-local proxy on the VM)."
          >
            <ul className="divide-y rounded-md border">
              {data?.models.map((model) => (
                <li key={model.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>{model.id}</span>
                  <Switch checked={enabled[model.id] ?? true} onCheckedChange={() => toggle(model.id)} />
                </li>
              ))}
            </ul>
          </StatusBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provider keys (BYOK)</CardTitle>
        </CardHeader>
        <CardContent>
          <ByokSection />
        </CardContent>
      </Card>
    </div>
  )
}
