import { NextResponse } from "next/server"

// Read-only, masked. Names only vary by what's relevant to cloud9 backends + BYOK providers —
// never the raw secret managers list, and never actual values.
const TRACKED_ENV_VARS = [
  "HERMES_API_URL",
  "HERMES_API_KEY",
  "HERMES_DASHBOARD_URL",
  "HERMES_DASHBOARD_TOKEN",
  "LITELLM_URL",
  "LITELLM_MASTER_KEY",
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "MISTRAL_API_KEY",
  "XAI_API_KEY",
]

function mask(value: string) {
  if (!value) return null
  return value.length <= 8 ? "****" : `${value.slice(0, 4)}...${value.slice(-4)}`
}

export async function GET() {
  const vars = TRACKED_ENV_VARS.map((name) => {
    const value = process.env[name] || ""
    return { name, set: value.length > 0, masked: mask(value) }
  })
  return NextResponse.json({ vars })
}
