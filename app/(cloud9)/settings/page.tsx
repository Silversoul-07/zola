"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEffect, useState } from "react"

// ponytail: stored in localStorage, not the shared user-preferences store, to avoid touching a
// file other in-flight branches may also be editing. Promote to the real preferences store once
// that schema stabilizes.
const STORAGE_KEY = "cloud9-general-settings"

type GeneralSettings = { appName: string; defaultAgent: string; defaultModel: string }

const DEFAULTS: GeneralSettings = {
  appName: "Zola",
  defaultAgent: "hermes",
  defaultModel: "hermes:hermes-agent",
}

export default function GeneralSettingsPage() {
  const [settings, setSettings] = useState<GeneralSettings>(DEFAULTS)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) })
  }, [])

  const update = (patch: Partial<GeneralSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">General</CardTitle>
      </CardHeader>
      <CardContent className="max-w-sm space-y-4">
        <div className="space-y-1">
          <Label htmlFor="app-name">App name</Label>
          <Input id="app-name" value={settings.appName} onChange={(e) => update({ appName: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="default-agent">Default agent</Label>
          <Input
            id="default-agent"
            value={settings.defaultAgent}
            onChange={(e) => update({ defaultAgent: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="default-model">Default model</Label>
          <Input
            id="default-model"
            value={settings.defaultModel}
            onChange={(e) => update({ defaultModel: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  )
}
