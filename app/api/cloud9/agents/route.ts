import { hermes } from "@/lib/cloud9/hermes"
import { NextResponse } from "next/server"

type AgentConfig = { id: string; name: string; model: string }

function readAgents(): AgentConfig[] {
  try {
    const raw = process.env.NEXT_PUBLIC_AGENTS
    if (!raw) throw new Error("unset")
    return JSON.parse(raw)
  } catch {
    return [{ id: "hermes", name: "Hermes Agent", model: "hermes-agent" }]
  }
}

// All configured agents are currently backed by the single Hermes API. One card per agent,
// each populated from the same Hermes health/model/toolset/session endpoints.
export async function GET() {
  const agents = readAgents()
  const [healthRes, modelOptionsRes, toolsetsRes, sessionsRes] = await Promise.all([
    hermes.healthDetailed(),
    hermes.modelOptions(),
    hermes.toolsets(),
    hermes.sessions(),
  ])

  const currentModel = modelOptionsRes.ok
    ? modelOptionsRes.data.providers.find((p) => p.is_current)?.slug
    : undefined

  const cards = agents.map((agent) => ({
    ...agent,
    health: healthRes.ok
      ? { status: healthRes.data.status, version: healthRes.data.version, gatewayState: healthRes.data.gateway_state }
      : { status: "unreachable", error: healthRes.error },
    currentModel: currentModel ?? agent.model,
    toolsetsCount: toolsetsRes.ok ? toolsetsRes.data.data.length : null,
    sessionsCount: sessionsRes.ok ? sessionsRes.data.data.length : null,
    dashboardUrl: process.env.HERMES_DASHBOARD_URL || "https://hermes.kryos.dev",
  }))

  return NextResponse.json({ agents: cards })
}
