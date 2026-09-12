// Server-side client for the Hermes agent API (agent.kryos.dev). Bearer key never reaches the browser.
import { fetchJson } from "./fetch-json"

const BASE = process.env.HERMES_API_URL || "https://agent.kryos.dev"
const KEY = process.env.HERMES_API_KEY || ""

function authHeaders(): Record<string, string> {
  return KEY ? { Authorization: `Bearer ${KEY}` } : {}
}

function get<T>(path: string) {
  return fetchJson<T>(`${BASE}${path}`, { headers: authHeaders() })
}

function post<T>(path: string, body?: unknown) {
  return fetchJson<T>(`${BASE}${path}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export type HermesHealth = { status: string; platform: string; version: string }

export type HermesHealthDetailed = HermesHealth & {
  gateway_state: string
  active_agents: number
  pid: number
  updated_at: string
  readiness: { status: string; checks: Record<string, { status: string; [k: string]: unknown }> }
  platforms: Record<string, { state: string; error_code: string | null; updated_at: string }>
}

export type HermesModel = { id: string; object: string; owned_by: string }

export type HermesSession = {
  id: string
  title: string
  model: string
  started_at: number
  last_active: number
  message_count: number
  input_tokens: number
  output_tokens: number
  end_reason: string | null
  pinned?: boolean
  archived?: boolean
  preview?: string
}

export type HermesSkill = { name: string; description?: string; source?: string; body?: string }

export type HermesToolset = {
  name: string
  label: string
  description: string
  enabled: boolean
  configured: boolean
  tools: string[]
}

export type HermesJob = {
  id: string
  name: string
  schedule_display: string
  enabled: boolean
  state: string
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
  last_error: string | null
}

export type HermesModelOptionsProvider = {
  slug: string
  name: string
  is_current: boolean
  authenticated: boolean
  total_models: number
  models: string[]
  warning?: string
}

export const hermes = {
  health: () => get<HermesHealth>("/health"),
  healthDetailed: () => get<HermesHealthDetailed>("/health/detailed"),
  models: () => get<{ object: string; data: HermesModel[] }>("/v1/models"),
  skills: () => get<{ object: string; data: HermesSkill[] }>("/v1/skills"),
  toolsets: () => get<{ object: string; data: HermesToolset[] }>("/v1/toolsets"),
  sessions: () => get<{ object: string; data: HermesSession[] }>("/api/sessions"),
  session: (id: string) => get(`/api/sessions/${encodeURIComponent(id)}`),
  jobs: () => get<{ jobs: HermesJob[] }>("/api/jobs"),
  job: (id: string) => get(`/api/jobs/${encodeURIComponent(id)}`),
  jobAction: (id: string, action: "pause" | "resume" | "run") =>
    post(`/api/jobs/${encodeURIComponent(id)}/${action}`),
  modelOptions: () => get<{ providers: HermesModelOptionsProvider[] }>("/api/model/options"),
  capabilities: () => get("/v1/capabilities"),
}
