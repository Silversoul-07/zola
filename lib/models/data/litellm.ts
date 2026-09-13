import { openproviders } from "@/lib/openproviders"
import { ModelConfig } from "../types"

// LiteLLM lanes (our own gateway, see lib/openproviders/index.ts). These are
// the models shown in the chat-box picker for "direct" (no agent) chats, plus
// a virtual "Agent default" entry used only when an agent is selected in the
// header AgentPicker (see app/api/chat/route.ts).
const LANE_DESCRIPTIONS: Record<string, string> = {
  "deepseek-v4-flash": "Default lane: fast, reliable tool use",
  "deepseek-v4-pro": "Escalation lane: slower, stronger",
  "gemini-3.5-flash": "Free tier: long context, vision",
  "gemini-3.5-flash-lite": "Free tier: cheap bulk work",
  "gemini-2.5-pro": "Free tier: few requests per day",
  "gpt-oss-120b": "Groq: fastest, small rate limit",
  "mistral-small-latest": "Free tier: tight rate limits",
  "nemotron-3.5-lightning": "OpenRouter free pool",
}

// Which lanes really accept an image, probed against the live proxy on
// 2026-09-13 by sending one image URL per lane and checking which model
// actually served the reply. LiteLLM's own `supports_vision` was wrong in
// BOTH directions here -- it claims deepseek-v4-flash takes images (it fails
// over to gemini instead) and claims deepseek-v4-pro does not (it served the
// image fine). So this list wins over /model/info for vision; the other
// capability badges still come from LiteLLM.
// Untested, assumed from the vendor: gemini-2.5-pro (daily quota exhausted
// during the probe) and mistral-small-latest (rate-limited during the probe).
const VISION_LANES = new Set([
  "deepseek-v4-pro",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-pro",
  "mistral-small-latest",
])

const litellmModels: ModelConfig[] = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-pro",
  "gpt-oss-120b",
  "mistral-small-latest",
  "nemotron-3.5-lightning",
].map((id) => ({
  id,
  name: id,
  provider: "LiteLLM",
  providerId: "litellm",
  baseProviderId: "litellm",
  modelFamily: "LiteLLM",
  description: LANE_DESCRIPTIONS[id],
  // The attachment button is gated on this (button-file-upload.tsx), so a lane
  // that omits it cannot accept images at all -- which silently disabled
  // uploads on every lane we run, including the vision lane itself.
  vision: VISION_LANES.has(id),
  apiSdk: (apiKey?: string) => openproviders(id, undefined, apiKey),
}))

litellmModels.push({
  id: "hermes-agent",
  name: "Agent default",
  provider: "LiteLLM",
  providerId: "litellm",
  baseProviderId: "litellm",
  modelFamily: "LiteLLM",
  description: "Whatever the agent is configured with",
  // Hermes picks the lane per turn and has a vision tool, so let images through
  // and let the agent route them.
  vision: true,
  apiSdk: () => {
    throw new Error("hermes-agent is handled by the chat route's agent branch")
  },
})

export { litellmModels }
