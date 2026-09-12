import { EFFECTIVE_ALLOWED_MODEL_IDS } from "@/lib/config"
import { ModelConfig } from "@/lib/models/types"

// Chat-input pickers only ever show models on the allow-list (env-driven,
// see lib/config.ts). Anything else (including pro/locked upsell models)
// never reaches the UI, so there is nothing left to gate client-side.
export function filterAllowedModels(models: ModelConfig[]): ModelConfig[] {
  const allowed = new Set(EFFECTIVE_ALLOWED_MODEL_IDS)
  return models.filter((model) => allowed.has(model.id))
}
