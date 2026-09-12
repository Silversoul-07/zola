import { GeneralSection } from "@/app/components/layout/settings/general/general-section"
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
        <GeneralSection rows={rows} />
      </CardContent>
    </Card>
  )
}
