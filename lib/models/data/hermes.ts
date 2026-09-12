import { ModelConfig } from "../types"

// Hermes Agent runs tools server-side on our own VM; the chat route bypasses
// streamText entirely for "hermes:" model ids (see app/api/chat/route.ts),
// so apiSdk here is never actually invoked.
const hermesModels: ModelConfig[] = [
  {
    id: "hermes:hermes-agent",
    name: "Hermes Agent",
    provider: "Hermes",
    providerId: "hermes",
    modelFamily: "Hermes",
    baseProviderId: "hermes",
    description:
      "NousResearch Hermes Agent with server-side tool execution, reasoning, and vision.",
    tags: ["agent", "tools", "reasoning", "vision"],
    vision: true,
    tools: true,
    audio: false,
    reasoning: true,
    openSource: true,
    website: "https://hermes-agent.nousresearch.com",
    apiDocs:
      "https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server/",
    icon: "openrouter",
    apiSdk: () => {
      throw new Error("hermes:hermes-agent is handled by the chat route directly")
    },
  },
]

export { hermesModels }
