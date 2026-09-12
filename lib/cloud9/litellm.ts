// Server-side client for the LiteLLM proxy. Unreachable from a laptop (host-local on the VM at
// 127.0.0.1:4000) — callers must handle ok:false as "unreachable" rather than an app error.
// ponytail: /key/regenerate/{key} and /spend/logs shapes are per docs.litellm.ai/docs/proxy/virtual_keys
// (not hand-verified live, since the proxy isn't reachable here) — re-check against a live proxy
// before shipping this to the VM.
import { fetchJson } from "./fetch-json"

const BASE = process.env.LITELLM_URL || "http://127.0.0.1:4000"
const KEY = process.env.LITELLM_MASTER_KEY || ""

function authHeaders(): Record<string, string> {
  return KEY ? { Authorization: `Bearer ${KEY}` } : {}
}

function get<T>(path: string) {
  return fetchJson<T>(`${BASE}${path}`, { headers: authHeaders() }, 5000)
}

function post<T>(path: string, body?: unknown) {
  return fetchJson<T>(
    `${BASE}${path}`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    5000
  )
}

export type LiteLLMModel = { id: string; object: string; owned_by?: string }

export type LiteLLMKeyInfo = {
  key_name?: string
  key_alias?: string
  token?: string
  key?: string
  spend?: number
  max_budget?: number | null
  models?: string[]
}

export const litellm = {
  models: () => get<{ data: LiteLLMModel[] }>("/v1/models"),
  modelInfo: () => get<{ data: Record<string, unknown>[] }>("/model/info"),
  generateKey: (body: { key_alias?: string; models?: string[]; max_budget?: number }) =>
    post<LiteLLMKeyInfo>("/key/generate", body),
  keyInfo: (key: string) => get<{ info: LiteLLMKeyInfo }>(`/key/info?key=${encodeURIComponent(key)}`),
  deleteKey: (keys: string[]) => post("/key/delete", { keys }),
  regenerateKey: (key: string) => post<LiteLLMKeyInfo>(`/key/regenerate/${encodeURIComponent(key)}`, {}),
  spendLogs: () => get<Record<string, unknown>[]>("/spend/logs"),
  globalSpend: () => get<Record<string, unknown>>("/global/spend"),
}
