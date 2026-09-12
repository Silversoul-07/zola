"use client"

import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type EnvVar = { name: string; set: boolean; masked: string | null }

// ponytail: LiteLLM has no "list all virtual keys" endpoint, so created keys are tracked
// client-side (name + masked token) in localStorage — the source of truth is still LiteLLM.
const KEYS_STORAGE = "cloud9-litellm-keys"
type TrackedKey = { name: string; masked: string; key: string }

export default function SecretsSettingsPage() {
  const [keys, setKeys] = useState<TrackedKey[]>([])
  const [form, setForm] = useState({ name: "", models: "", maxBudget: "" })

  useEffect(() => {
    const raw = localStorage.getItem(KEYS_STORAGE)
    if (raw) setKeys(JSON.parse(raw))
  }, [])
  const persist = (next: TrackedKey[]) => {
    setKeys(next)
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(next))
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/cloud9/settings/secrets", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          models: form.models ? form.models.split(",").map((m) => m.trim()) : undefined,
          maxBudget: form.maxBudget ? Number(form.maxBudget) : undefined,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to create key")
      return body as { key: string; masked: string; name: string }
    },
    onSuccess: (body) => {
      persist([...keys, { name: body.name, masked: body.masked, key: body.key }])
      toast({ title: "Key created" })
      setForm({ name: "", models: "", maxBudget: "" })
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, status: "error" }),
  })

  const regenerateMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetchClient("/api/cloud9/settings/secrets", {
        method: "PATCH",
        body: JSON.stringify({ key }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to regenerate")
      return body as { key: string; masked: string }
    },
    onSuccess: (body, oldKey) => {
      persist(keys.map((k) => (k.key === oldKey ? { ...k, key: body.key, masked: body.masked } : k)))
      toast({ title: "Key regenerated" })
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, status: "error" }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetchClient(`/api/cloud9/settings/secrets?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to delete")
      return key
    },
    onSuccess: (deletedKey) => {
      persist(keys.filter((k) => k.key !== deletedKey))
      toast({ title: "Key deleted" })
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, status: "error" }),
  })

  const { data: envData, isLoading: envLoading } = useQuery<{ vars: EnvVar[] }>({
    queryKey: ["cloud9", "settings", "env"],
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/settings/env")
      return res.json()
    },
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">LiteLLM virtual keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusBlock isLoading={false} isEmpty={keys.length === 0} emptyLabel="No keys created yet.">
            <ul className="divide-y rounded-md border">
              {keys.map((k) => (
                <li key={k.key} className="flex items-center justify-between px-4 py-2 text-sm">
                  <div>
                    <p className="font-medium">{k.name}</p>
                    <p className="text-muted-foreground font-mono text-xs">{k.masked}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={regenerateMutation.isPending}
                      onClick={() => regenerateMutation.mutate(k.key)}
                    >
                      Regenerate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(k.key)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </StatusBlock>

          <div className="grid max-w-md gap-2">
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              placeholder="Models (comma-separated, optional)"
              value={form.models}
              onChange={(e) => setForm((f) => ({ ...f, models: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Max budget (optional)"
              value={form.maxBudget}
              onChange={(e) => setForm((f) => ({ ...f, maxBudget: e.target.value }))}
            />
            <Button disabled={!form.name || createMutation.isPending} onClick={() => createMutation.mutate()}>
              Create key
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vault</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="text-muted-foreground">
            Provider keys live in Vaultwarden and LiteLLM, never in this app.
          </p>
          <a href="https://vault.kryos.dev" target="_blank" rel="noreferrer" className="text-primary underline">
            Open Vault
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment variables (read-only, masked)</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusBlock isLoading={envLoading} isEmpty={!envData?.vars.length}>
            <ul className="divide-y rounded-md border text-sm">
              {envData?.vars.map((v) => (
                <li key={v.name} className="flex items-center justify-between px-4 py-2">
                  <span className="font-mono">{v.name}</span>
                  {v.set ? (
                    <span className="text-muted-foreground font-mono text-xs">{v.masked}</span>
                  ) : (
                    <Badge variant="secondary">not set</Badge>
                  )}
                </li>
              ))}
            </ul>
          </StatusBlock>
        </CardContent>
      </Card>
    </div>
  )
}
