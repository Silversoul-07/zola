// Server-side client for the OpenCode coder-agent server (opencode serve).
// Basic auth (user "opencode") never reaches the browser.
import { fetchJson } from "@/lib/cloud9/fetch-json"

const BASE = process.env.OPENCODE_URL || "https://opencode.kryos.dev"
const PASSWORD = process.env.OPENCODE_SERVER_PASSWORD || ""

function authHeader(): string {
  return `Basic ${Buffer.from(`opencode:${PASSWORD}`).toString("base64")}`
}

type OpencodeRequestArgs = {
  sessionId: string
  text: string
  /** LiteLLM lane id from our model picker, or "hermes-agent" for OpenCode's own default. */
  model?: string
  /** Agent mode picker (build/plan/...), an OpenCode `Agent.name` from GET /agent. */
  agent?: string
  system?: string
  /** Thinking effort variant name ("low"/"medium"/"high"), matching a `variants` entry in opencode.json. */
  variant?: string
  signal?: AbortSignal
}

// Opens the global SSE event stream first (so no `message.part.updated`
// events are missed), then kicks off the prompt and returns the event
// stream's body for the caller to pipe through opencodeEventsToDataStream.
export async function opencodeRequest({
  sessionId,
  text,
  model,
  agent,
  system,
  variant,
  signal,
}: OpencodeRequestArgs): Promise<ReadableStream<Uint8Array>> {
  const eventRes = await fetch(`${BASE}/event`, {
    headers: { Authorization: authHeader(), Accept: "text/event-stream" },
    signal,
  })
  if (!eventRes.ok || !eventRes.body) {
    throw new Error(`OpenCode /event failed (${eventRes.status})`)
  }

  const promptController = new AbortController()
  const timeout = setTimeout(() => promptController.abort(), 15000)
  try {
    const body: Record<string, unknown> = { parts: [{ type: "text", text }] }
    // OpenCode appends `system` to the agent's own prompt (used for the
    // canvas protocol; Hermes gets the same text via its system prompt).
    if (system) body.system = system
    if (model && model !== "hermes-agent") {
      body.model = {
        providerID: process.env.OPENCODE_PROVIDER_ID || "litellm",
        modelID: model,
      }
    }
    if (agent) body.agent = agent
    if (variant) body.variant = variant
    const promptRes = await fetch(
      `${BASE}/session/${encodeURIComponent(sessionId)}/prompt_async`,
      {
        method: "POST",
        signal: promptController.signal,
        headers: {
          Authorization: authHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    )
    if (!promptRes.ok) {
      const errText = await promptRes.text().catch(() => "")
      throw new Error(
        `OpenCode prompt_async failed (${promptRes.status}): ${errText}`
      )
    }
  } finally {
    clearTimeout(timeout)
  }

  return eventRes.body
}

// Creates a session so the chat has a `runtime_session_id` to reuse on
// subsequent turns (see the chat route's session-mapping logic).
export async function opencodeCreateSession(
  title?: string
): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/session`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(title ? { title } : {}),
  })
  if (!res.ok) {
    throw new Error(`OpenCode create session failed (${res.status})`)
  }
  return res.json()
}

export type OpencodeSession = { id: string; title: string; time: { updated: number } }

// Used by app/api/cloud9/opencode/sessions/route.ts.
export function opencodeListSessions() {
  return fetchJson<OpencodeSession[]>(`${BASE}/session`, {
    headers: { Authorization: authHeader() },
  })
}

// Used by app/api/cloud9/opencode/diff/route.ts.
export function opencodeDiff(sessionId: string) {
  return fetchJson<unknown>(
    `${BASE}/session/${encodeURIComponent(sessionId)}/diff`,
    { headers: { Authorization: authHeader() } }
  )
}

// Used by app/api/cloud9/agents/route.ts for the OpenCode agent's health card.
export function opencodeHealth() {
  return fetchJson<{ status: string; version?: string }>(
    `${BASE}/global/health`,
    { headers: { Authorization: authHeader() } }
  )
}

// Used by app/api/cloud9/opencode/abort/route.ts: cancels a running session
// in addition to the client just dropping the fetch (which leaves OpenCode
// running server-side).
export function opencodeAbort(sessionId: string) {
  return fetchJson<boolean>(
    `${BASE}/session/${encodeURIComponent(sessionId)}/abort`,
    { method: "POST", headers: { Authorization: authHeader() } }
  )
}

export type OpencodeAgent = { name: string; mode: "primary" | "subagent" | "all" }

// Used by app/api/cloud9/opencode/agents/route.ts for the agent mode picker
// (build/plan/...) next to the model picker.
export function opencodeAgents() {
  return fetchJson<OpencodeAgent[]>(`${BASE}/agent`, {
    headers: { Authorization: authHeader() },
  })
}

// Used by app/api/cloud9/opencode/permission/route.ts to answer a
// `permission.updated` event surfaced as a card in the chat UI.
export function opencodeReplyPermission(
  sessionId: string,
  permissionId: string,
  response: "once" | "always" | "reject"
) {
  return fetchJson<boolean>(
    `${BASE}/session/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(permissionId)}`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ response }),
    }
  )
}
