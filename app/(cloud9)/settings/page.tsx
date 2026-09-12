import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AGENTS, APP_NAME, MODEL_DEFAULT } from "@/lib/config"

// Read-only: these values come from the environment (see .env.example), not from a form.
export default function GeneralSettingsPage() {
  const rows: Array<[string, string]> = [
    ["App name", APP_NAME],
    ["Agents", AGENTS.map((a) => a.name).join(", ") || "none"],
    ["Default model", MODEL_DEFAULT],
    ["Hermes API", process.env.HERMES_API_URL || "not set"],
    ["Hermes dashboard", process.env.HERMES_DASHBOARD_URL || "not set"],
    ["LiteLLM", process.env.LITELLM_URL || "not set"],
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">General</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-border divide-y text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-6 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate font-mono text-xs">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground mt-4 text-xs">
          Set via environment variables. Edit <code>.env</code> and restart to change.
        </p>
      </CardContent>
    </Card>
  )
}
