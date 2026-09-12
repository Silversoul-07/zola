// Server-side client for the Hermes dashboard admin API (hermes.kryos.dev). Requires
// HERMES_DASHBOARD_TOKEN (bearer, see hermes_cli/dashboard_auth/token_auth.py). When the token
// is missing/rejected or the host is unreachable, callers get ok:false so pages can render a
// "connect the dashboard" state instead of crashing.
import { fetchJson, type JsonResult } from "./fetch-json"

const BASE = process.env.HERMES_DASHBOARD_URL || "https://hermes.kryos.dev"
const TOKEN = process.env.HERMES_DASHBOARD_TOKEN || ""

function authHeaders(): Record<string, string> {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}
}

function notConfigured<T>(): Promise<JsonResult<T>> {
  return Promise.resolve({
    ok: false,
    status: 401,
    error: "HERMES_DASHBOARD_TOKEN is not configured",
  })
}

function get<T>(path: string) {
  if (!TOKEN) return notConfigured<T>()
  return fetchJson<T>(`${BASE}${path}`, { headers: authHeaders() })
}

function post<T>(path: string, body?: unknown) {
  if (!TOKEN) return notConfigured<T>()
  return fetchJson<T>(`${BASE}${path}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export type McpServer = {
  name: string
  enabled: boolean
  transport: string
  status?: string
}

export type CronJob = {
  id: string
  name: string
  schedule_display: string
  enabled: boolean
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
}

export type KanbanTask = {
  id: string
  title: string
  body?: string | null
  assignee?: string | null
  status: string
  priority: number
  created_at: number
  latest_summary?: string | null
  age?: { created_age_seconds: number | null }
}

export type KanbanBoard = {
  tasks?: KanbanTask[]
  columns?: Record<string, KanbanTask[]>
}

export const dashboardConfigured = TOKEN.length > 0

export const dashboard = {
  mcpServers: () => get<{ servers: McpServer[] }>("/api/mcp/servers"),
  mcpCatalog: () => get("/api/mcp/catalog"),
  testMcpServer: (name: string) => post(`/api/mcp/servers/${encodeURIComponent(name)}/test`),
  cronJobs: () => get<{ jobs: CronJob[] }>("/api/cron/jobs"),
  createCronJob: (body: unknown) => post("/api/cron/jobs", body),
  kanbanBoard: () => get<KanbanBoard>("/api/plugins/kanban/board"),
  createKanbanTask: (body: unknown) => post<KanbanTask>("/api/plugins/kanban/tasks", body),
}
