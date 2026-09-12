import { hermes } from "@/lib/cloud9/hermes"
import { opencodeHealth } from "@/lib/opencode/client"
import { NextResponse } from "next/server"

type AgentConfig = {
  id: string
  name: string
  model: string
  runtime?: "hermes" | "opencode"
}

function readAgents(): AgentConfig[] {
  try {
    const raw = process.env.NEXT_PUBLIC_AGENTS
    if (!raw) throw new Error("unset")
    return JSON.parse(raw)
  } catch {
    return [{ id: "hermes", name: "Hermes Agent", model: "hermes-agent" }]
  }
}

// Hermes-runtime agents are backed by the single Hermes API; OpenCode-runtime
// agents are backed by the OpenCode server. One card per agent, health/model/
// toolset/session data pulled from whichever backend that agent's runtime maps to.
export async function GET() {
  const agents = readAgents()
  const [healthRes, modelOptionsRes, toolsetsRes, sessionsRes, opencodeHealthRes] =
    await Promise.all([
      hermes.healthDetailed(),
      hermes.modelOptions(),
      hermes.toolsets(),
      hermes.sessions(),
      opencodeHealth(),
    ])

  const currentModel = modelOptionsRes.ok
    ? modelOptionsRes.data.providers.find((p) => p.is_current)?.slug
    : undefined

  const cards = agents.map((agent) => {
    const runtime = agent.runtime === "opencode" ? "opencode" : "hermes"
    if (runtime === "opencode") {
      return {
        ...agent,
        runtime,
        health: opencodeHealthRes.ok
          ? { status: opencodeHealthRes.data.status, version: opencodeHealthRes.data.version }
          : { status: "unreachable", error: opencodeHealthRes.error },
        currentModel: agent.model,
        toolsetsCount: null,
        sessionsCount: null,
        dashboardUrl: process.env.OPENCODE_URL || "https://opencode.kryos.dev",
      }
    }
    return {
      ...agent,
      runtime,
      health: healthRes.ok
        ? { status: healthRes.data.status, version: healthRes.data.version, gatewayState: healthRes.data.gateway_state }
        : { status: "unreachable", error: healthRes.error },
      currentModel: currentModel ?? agent.model,
      toolsetsCount: toolsetsRes.ok ? toolsetsRes.data.data.length : null,
      sessionsCount: sessionsRes.ok ? sessionsRes.data.data.length : null,
      dashboardUrl: process.env.HERMES_DASHBOARD_URL || "https://hermes.kryos.dev",
    }
  })

  return NextResponse.json({ agents: cards })
}
