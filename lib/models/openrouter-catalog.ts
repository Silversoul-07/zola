export type CatalogInfo = {
  contextWindow?: number
  vision?: boolean
  tools?: boolean
}

// OpenRouter publishes an accurate, public, key-free catalogue of nearly every
// model worth naming, and it is right about the things LiteLLM's built-in map
// gets wrong: it correctly lists both deepseek lanes as text-only, which a
// live probe confirmed on 2026-09-13. So capability and context window come
// from here; price still comes from LiteLLM, because what we pay depends on
// our own provider accounts and free tiers, not on OpenRouter's rates.
const CATALOG_URL = "https://openrouter.ai/api/v1/models"
const TTL_MS = 24 * 60 * 60_000

type CatalogRow = {
  id?: string
  context_length?: number
  architecture?: { input_modalities?: string[] }
  supported_parameters?: string[]
}

let cache: { at: number; info: Map<string, CatalogInfo> } | null = null

// Our lane names are bare model ids ("gemini-3.5-flash"); OpenRouter namespaces
// them ("google/gemini-3.5-flash", sometimes with a ":free" suffix). Index by
// the bare name so a lane matches without us maintaining a mapping table.
function bareName(id: string): string {
  return id.split("/").pop()!.split(":")[0]
}

export async function getCatalog(): Promise<Map<string, CatalogInfo>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.info
  const info = new Map<string, CatalogInfo>()
  try {
    const res = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const json = (await res.json()) as { data?: CatalogRow[] }
      for (const row of json.data ?? []) {
        if (!row.id) continue
        const key = bareName(row.id)
        // First entry wins: the catalogue lists paid and ":free" variants of
        // the same model, and they differ only in price, which we ignore here.
        if (info.has(key)) continue
        const modalities = row.architecture?.input_modalities
        info.set(key, {
          contextWindow: row.context_length,
          vision: modalities ? modalities.includes("image") : undefined,
          tools: row.supported_parameters?.includes("tools"),
        })
      }
    }
  } catch {
    // Offline or rate-limited: leave the map empty and let the caller fall
    // back to LiteLLM. Retried after the TTL.
  }
  if (info.size) cache = { at: Date.now(), info }
  return info
}

export async function catalogInfoFor(
  modelId: string
): Promise<CatalogInfo | undefined> {
  return (await getCatalog()).get(bareName(modelId))
}
