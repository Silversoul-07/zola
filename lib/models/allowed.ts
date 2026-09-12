import { EFFECTIVE_ALLOWED_MODEL_IDS, getEffectiveAgentId } from "@/lib/config"
import { ModelConfig } from "@/lib/models/types"

// Chat-input pickers only ever show models on the allow-list (env-driven,
// see lib/config.ts). Anything else (including pro/locked upsell models)
// never reaches the UI, so there is nothing left to gate client-side.
export function filterAllowedModels(models: ModelConfig[]): ModelConfig[] {
  const allowed = new Set(EFFECTIVE_ALLOWED_MODEL_IDS)
  return models.filter((model) => allowed.has(model.id))
}

// "Agent default" (hermes-agent) only makes sense while an agent is selected
// in the header AgentPicker; hide it from the chat-box picker otherwise.
export function filterAgentDefaultModel(
  models: ModelConfig[],
  selectedAgentId: string | undefined
): ModelConfig[] {
  const effectiveAgentId = getEffectiveAgentId(selectedAgentId)
  const agentSelected = !!effectiveAgentId && effectiveAgentId !== "none"
  if (agentSelected) return models
  return models.filter((model) => model.id !== "hermes-agent")
}
