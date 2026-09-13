import {
  BookOpenText,
  Brain,
  Code,
  Lightbulb,
  Notepad,
  PaintBrush,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr"

export const NON_AUTH_DAILY_MESSAGE_LIMIT = 100000
export const AUTH_DAILY_MESSAGE_LIMIT = 1000
export const REMAINING_QUERY_ALERT_THRESHOLD = 2
export const DAILY_FILE_UPLOAD_LIMIT = 5
export const DAILY_LIMIT_PRO_MODELS = 500

// CLOUD9: chat-box models are LiteLLM lanes only (our own gateway, one key).
// Hermes agent runs server-side and is selected via the header AgentPicker,
// not this list (see hermes-agent handling in EFFECTIVE_ALLOWED_MODEL_IDS).
export const ALLOWED_MODEL_IDS = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-pro",
  "gpt-oss-120b",
  "mistral-small-2603",
  "nemotron-3.5-lightning",
]
export const NON_AUTH_ALLOWED_MODELS = ALLOWED_MODEL_IDS

export const FREE_MODELS_IDS = ALLOWED_MODEL_IDS

export const MODEL_DEFAULT = "deepseek-v4-flash"

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Zola"
export const APP_DOMAIN = "https://zola.chat"

// Agent picker (header): NEXT_PUBLIC_AGENTS is a JSON array of { id, name, runtime? }.
// `runtime` picks which server-side agent backend handles the chat (see the
// runtime dispatch in app/api/chat/route.ts); it defaults to "hermes" so
// existing NEXT_PUBLIC_AGENTS values (no runtime field) keep working.
// The model itself is still chosen independently via the chat-box model picker.
export type AgentConfig = {
  id: string
  name: string
  runtime: "hermes" | "opencode"
}

const DEFAULT_AGENTS: AgentConfig[] = [
  { id: "hermes", name: "Hermes Agent", runtime: "hermes" },
]

function parseAgents(): AgentConfig[] {
  const raw = process.env.NEXT_PUBLIC_AGENTS
  if (!raw) return DEFAULT_AGENTS
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_AGENTS
    return (parsed as Array<{ id: string; name: string; runtime?: string }>).map(
      (agent) => ({
        id: agent.id,
        name: agent.name,
        runtime: agent.runtime === "opencode" ? "opencode" : "hermes",
      })
    )
  } catch {
    return DEFAULT_AGENTS
  }
}

export const AGENTS: AgentConfig[] = parseAgents()

// Resolves the header AgentPicker's effective selection: an explicit choice,
// or the default (first agent) when nothing was chosen yet. The app always
// routes through an agent, so this always returns a real agent id.
export function getEffectiveAgentId(
  selectedAgentId: string | undefined
): string | undefined {
  return selectedAgentId || AGENTS[0]?.id
}

// Model picker (chat input): NEXT_PUBLIC_ALLOWED_MODELS is a comma-separated
// list of model ids. Defaults to ALLOWED_MODEL_IDS above, plus agent models.
export const ALLOWED_MODEL_IDS_ENV = process.env.NEXT_PUBLIC_ALLOWED_MODELS?.split(
  ","
)
  .map((id) => id.trim())
  .filter(Boolean)

export const EFFECTIVE_ALLOWED_MODEL_IDS = Array.from(
  new Set([
    ...(ALLOWED_MODEL_IDS_ENV && ALLOWED_MODEL_IDS_ENV.length > 0
      ? ALLOWED_MODEL_IDS_ENV
      : ALLOWED_MODEL_IDS),
    // "Agent default" only makes sense once an agent exists to default to.
    ...(AGENTS.length > 0 ? ["hermes-agent"] : []),
  ])
)

export const SUGGESTIONS = [
  {
    label: "Summary",
    highlight: "Summarize",
    prompt: `Summarize`,
    items: [
      "Summarize the French Revolution",
      "Summarize the plot of Inception",
      "Summarize World War II in 5 sentences",
      "Summarize the benefits of meditation",
    ],
    icon: Notepad,
  },
  {
    label: "Code",
    highlight: "Help me",
    prompt: `Help me`,
    items: [
      "Help me write a function to reverse a string in JavaScript",
      "Help me create a responsive navbar in HTML/CSS",
      "Help me write a SQL query to find duplicate emails",
      "Help me convert this Python function to JavaScript",
    ],
    icon: Code,
  },
  {
    label: "Design",
    highlight: "Design",
    prompt: `Design`,
    items: [
      "Design a color palette for a tech blog",
      "Design a UX checklist for mobile apps",
      "Design 5 great font pairings for a landing page",
      "Design better CTAs with useful tips",
    ],
    icon: PaintBrush,
  },
  {
    label: "Research",
    highlight: "Research",
    prompt: `Research`,
    items: [
      "Research the pros and cons of remote work",
      "Research the differences between Apple Vision Pro and Meta Quest",
      "Research best practices for password security",
      "Research the latest trends in renewable energy",
    ],
    icon: BookOpenText,
  },
  {
    label: "Get inspired",
    highlight: "Inspire me",
    prompt: `Inspire me`,
    items: [
      "Inspire me with a beautiful quote about creativity",
      "Inspire me with a writing prompt about solitude",
      "Inspire me with a poetic way to start a newsletter",
      "Inspire me by describing a peaceful morning in nature",
    ],
    icon: Sparkle,
  },
  {
    label: "Think deeply",
    highlight: "Reflect on",
    prompt: `Reflect on`,
    items: [
      "Reflect on why we fear uncertainty",
      "Reflect on what makes a conversation meaningful",
      "Reflect on the concept of time in a simple way",
      "Reflect on what it means to live intentionally",
    ],
    icon: Brain,
  },
  {
    label: "Learn gently",
    highlight: "Explain",
    prompt: `Explain`,
    items: [
      "Explain quantum physics like I'm 10",
      "Explain stoicism in simple terms",
      "Explain how a neural network works",
      "Explain the difference between AI and AGI",
    ],
    icon: Lightbulb,
  },
]

export const SYSTEM_PROMPT_DEFAULT = `You are Zola, a thoughtful and clear assistant. Your tone is calm, minimal, and human. You write with intention—never too much, never too little. You avoid clichés, speak simply, and offer helpful, grounded answers. When needed, you ask good questions. You don't try to impress—you aim to clarify. You may use metaphors if they bring clarity, but you stay sharp and sincere. You're here to help the user think clearly and move forward, not to overwhelm or overperform.`

export const MESSAGE_MAX_LENGTH = 10000
