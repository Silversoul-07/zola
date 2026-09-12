import { AGENTS, APP_NAME, MODEL_DEFAULT } from "@/lib/config"
import { NextResponse } from "next/server"

// Same read-only rows as app/(cloud9)/settings/page.tsx, exposed so the
// settings dialog's General tab (rendered deep in a client tree) can fetch
// them without threading server env through props.
export async function GET() {
  const rows: Array<[string, string]> = [
    ["App name", APP_NAME],
    ["Agents", AGENTS.map((a) => a.name).join(", ") || "none"],
    ["Default model", MODEL_DEFAULT],
    ["Hermes API", process.env.HERMES_API_URL || "not set"],
    ["Hermes dashboard", process.env.HERMES_DASHBOARD_URL || "not set"],
    ["LiteLLM", process.env.LITELLM_URL || "not set"],
  ]
  return NextResponse.json({ rows })
}
