import { getCurrentUser } from "@/lib/auth"
import { NextResponse } from "next/server"

const FALLBACK = 128_000
// ponytail: module cache, refreshed on process restart only; LiteLLM lanes rarely change.
const cache = new Map<string, number>()

// Context window for a LiteLLM lane, from LiteLLM's /model/info
// (max_input_tokens). Hermes' virtual "hermes-agent" model gets the fallback.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const model = new URL(req.url).searchParams.get("model") || ""
  if (!model) return NextResponse.json({ maxTokens: FALLBACK })
  const hit = cache.get(model)
  if (hit) return NextResponse.json({ maxTokens: hit })

  let maxTokens = FALLBACK
  try {
    const res = await fetch(
      `${process.env.LITELLM_URL || "http://127.0.0.1:4000"}/model/info`,
      { headers: { Authorization: `Bearer ${process.env.LITELLM_MASTER_KEY}` } }
    )
    if (res.ok) {
      const json = (await res.json()) as {
        data?: Array<{ model_name?: string; model_info?: { max_input_tokens?: number } }>
      }
      const row = json.data?.find((d) => d.model_name === model)
      if (row?.model_info?.max_input_tokens) maxTokens = row.model_info.max_input_tokens
    }
  } catch {
    // fall through to the default
  }
  cache.set(model, maxTokens)
  return NextResponse.json({ maxTokens })
}
