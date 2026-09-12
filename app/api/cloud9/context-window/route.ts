import { getCurrentUser } from "@/lib/auth"
import { laneInfoFor } from "@/lib/models/litellm-info"
import { NextResponse } from "next/server"

const FALLBACK = 128_000

// Context window for a LiteLLM lane (max_input_tokens from /model/info);
// "hermes-agent" resolves to the agent's default lane.
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const model = new URL(req.url).searchParams.get("model") || ""
  const lane = model ? await laneInfoFor(model) : undefined
  return NextResponse.json({ maxTokens: lane?.contextWindow ?? FALLBACK })
}
