import {
  getAllModels,
  getModelsForUserProviders,
  getModelsWithAccessFlags,
  refreshModelsCache,
} from "@/lib/models"
import { getCurrentUser } from "@/lib/auth"
import { getLaneInfo, HERMES_DEFAULT_MODEL } from "@/lib/models/litellm-info"
import { getCatalog } from "@/lib/models/openrouter-catalog"
import type { ModelConfig } from "@/lib/models/types"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

// LiteLLM lanes are static entries with nothing but a name and a description,
// so the picker's detail panel is filled from two catalogues:
//
//   OpenRouter  what the model can do and how much context it has. Public,
//               needs no key, and is right where LiteLLM's built-in map is
//               wrong -- it correctly lists both deepseek lanes as text-only.
//   LiteLLM     what a call costs us, which depends on our own provider
//               accounts and free tiers, not on OpenRouter's rates.
//
// Either one being unreachable degrades the panel rather than breaking it.
// "hermes-agent" borrows whichever lane the agent runs by default.
async function enrich(models: ModelConfig[]): Promise<ModelConfig[]> {
  const [info, catalog] = await Promise.all([getLaneInfo(), getCatalog()])
  if (!info.size && !catalog.size) return models
  return models.map((m) => {
    if (m.providerId !== "litellm") return m
    const id = m.id === "hermes-agent" ? HERMES_DEFAULT_MODEL : m.id
    const lane = info.get(id)
    const cat = catalog.get(id)
    if (!lane && !cat) return m
    return {
      ...m,
      contextWindow: m.contextWindow ?? cat?.contextWindow ?? lane?.contextWindow,
      // The attach button is gated on `vision`, so this one has to be right.
      vision: cat?.vision ?? lane?.vision ?? m.vision,
      tools: cat?.tools ?? lane?.tools ?? m.tools,
      reasoning: lane?.reasoning ?? m.reasoning,
      webSearch: lane?.webSearch ?? m.webSearch,
      audio: lane?.audio ?? m.audio,
      inputCost: m.inputCost ?? lane?.inputCost,
      outputCost: m.outputCost ?? lane?.outputCost,
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
