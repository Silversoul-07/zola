import { openproviders } from "@/lib/openproviders"
import { ModelConfig } from "../types"

// LiteLLM lanes (our own gateway, see lib/openproviders/index.ts). These are
// the models shown in the chat-box picker for "direct" (no agent) chats, plus
// a virtual "Agent default" entry used only when an agent is selected in the
// header AgentPicker (see app/api/chat/route.ts).
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
  apiSdk: (apiKey?: string) => openproviders(id, undefined, apiKey),
}))

litellmModels.push({
  id: "hermes-agent",
  name: "Agent default",
  provider: "LiteLLM",
  providerId: "litellm",
  baseProviderId: "litellm",
  modelFamily: "LiteLLM",
  description: "Let the selected Hermes agent pick its own default model.",
  apiSdk: () => {
    throw new Error("hermes-agent is handled by the chat route's agent branch")
  },
})

export { litellmModels }
