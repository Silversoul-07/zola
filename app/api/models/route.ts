import {
  getAllModels,
  getModelsForUserProviders,
  getModelsWithAccessFlags,
  refreshModelsCache,
} from "@/lib/models"
import { getCurrentUser } from "@/lib/auth"
import { getLaneInfo, HERMES_DEFAULT_MODEL } from "@/lib/models/litellm-info"
import type { ModelConfig } from "@/lib/models/types"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

// LiteLLM lanes are static entries; fill context window and pricing from
// LiteLLM's /model/info so the picker's detail panel shows real numbers.
// "hermes-agent" borrows the agent's default lane.
async function enrich(models: ModelConfig[]): Promise<ModelConfig[]> {
  const info = await getLaneInfo()
  if (!info.size) return models
  return models.map((m) => {
    if (m.providerId !== "litellm") return m
    const lane = info.get(m.id === "hermes-agent" ? HERMES_DEFAULT_MODEL : m.id)
    if (!lane) return m
    return {
      ...m,
      contextWindow: m.contextWindow ?? lane.contextWindow,
      // LiteLLM fills the hover card's capability badges from the upstream
      // model. `vision` is the exception: its supports_vision is wrong for our
      // deepseek lanes in both directions (probed 2026-09-13), and the attach
      // button depends on it, so the probed list in litellm.ts wins there.
      vision: m.vision ?? lane.vision,
      tools: lane.tools ?? m.tools,
      reasoning: lane.reasoning ?? m.reasoning,
      webSearch: lane.webSearch ?? m.webSearch,
      audio: lane.audio ?? m.audio,
      inputCost: m.inputCost ?? lane.inputCost,
      outputCost: m.outputCost ?? lane.outputCost,
      description:
        m.id === "hermes-agent" ? `${m.description} (${HERMES_DEFAULT_MODEL})` : m.description,
    }
  })
}

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      const models = await getModelsWithAccessFlags()
      return NextResponse.json({ models: await enrich(models) })
    }

    const rows = await db
      .select({ provider: schema.userKeys.provider })
      .from(schema.userKeys)
      .where(eq(schema.userKeys.userId, user.id))

    const userProviders = rows.map((k: { provider: string }) => k.provider)

    if (userProviders.length === 0) {
      const models = await getModelsWithAccessFlags()
      return NextResponse.json({ models: await enrich(models) })
    }

    const models = await getModelsForUserProviders(userProviders)
    return NextResponse.json({ models: await enrich(models) })
  } catch (error) {
    console.error("Error fetching models:", error)
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 })
  }
}

export async function POST() {
  try {
    refreshModelsCache()
    const models = await getAllModels()

    return NextResponse.json({
      message: "Models cache refreshed",
      models,
      timestamp: new Date().toISOString(),
      count: models.length,
    })
  } catch (error) {
    console.error("Failed to refresh models:", error)
    return NextResponse.json(
      { error: "Failed to refresh models" },
      { status: 500 }
    )
  }
}
