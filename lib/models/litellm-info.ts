
export type LaneInfo = {
  contextWindow?: number
  /** USD per 1M tokens */
  inputCost?: number
  outputCost?: number
  /** LiteLLM knows what the upstream model can do; we should not guess. */
  vision?: boolean
  tools?: boolean
  reasoning?: boolean
  webSearch?: boolean
  audio?: boolean
}

// The model the Hermes agent actually runs when Zola sends "hermes-agent"
// (its config default). Lets the virtual lane show a real context window.
export const HERMES_DEFAULT_MODEL = process.env.HERMES_DEFAULT_MODEL || "deepseek-v4-flash"

const TTL_MS = 10 * 60_000
let cache: { at: number; info: Map<string, LaneInfo> } | null = null

// LiteLLM /model/info, keyed by lane name. Empty map when LiteLLM is
// unreachable (the laptop), so callers fall back to their defaults.
export async function getLaneInfo(): Promise<Map<string, LaneInfo>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.info
  const info = new Map<string, LaneInfo>()
  try {
    const res = await fetch(
      `${process.env.LITELLM_URL || "http://127.0.0.1:4000"}/model/info`,
      {
        headers: { Authorization: `Bearer ${process.env.LITELLM_MASTER_KEY}` },
        signal: AbortSignal.timeout(3000),
      }
    )
    if (res.ok) {
      const json = (await res.json()) as {
        data?: Array<{
          model_name?: string
          model_info?: {
            max_input_tokens?: number
            input_cost_per_token?: number
            output_cost_per_token?: number
            supports_vision?: boolean
            supports_function_calling?: boolean
            supports_reasoning?: boolean
            supports_web_search?: boolean
            supports_audio_input?: boolean
          }
        }>
      }
      for (const row of json.data ?? []) {
        if (!row.model_name || !row.model_info) continue
        const m = row.model_info
        info.set(row.model_name, {
          contextWindow: m.max_input_tokens || undefined,
          inputCost: m.input_cost_per_token ? m.input_cost_per_token * 1_000_000 : undefined,
          outputCost: m.output_cost_per_token ? m.output_cost_per_token * 1_000_000 : undefined,
          vision: m.supports_vision,
          tools: m.supports_function_calling,
          reasoning: m.supports_reasoning,
          webSearch: m.supports_web_search,
          audio: m.supports_audio_input,
        })
      }
    }
  } catch {
    // unreachable: leave the map empty, retry after TTL
  }
  if (info.size) cache = { at: Date.now(), info }
  return info
}

export async function laneInfoFor(modelId: string): Promise<LaneInfo | undefined> {
  const info = await getLaneInfo()
  return info.get(modelId === "hermes-agent" ? HERMES_DEFAULT_MODEL : modelId)
}
