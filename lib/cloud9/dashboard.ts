// Server-side client for the Hermes dashboard admin API (hermes.kryos.dev).
// The dashboard's "basic" auth provider (plugins/dashboard_auth/basic) has no API tokens:
// it issues signed session cookies from POST /auth/password-login. We log in with
// HERMES_DASHBOARD_USER / HERMES_DASHBOARD_PASSWORD, keep the cookies in memory and
// re-login once on 401. When creds are missing or the host is unreachable, callers get
// ok:false so pages render a "connect the dashboard" state instead of crashing.
import { fetchJson, type JsonResult } from "./fetch-json"

const BASE = process.env.HERMES_DASHBOARD_URL || "https://hermes.kryos.dev"
const USER = process.env.HERMES_DASHBOARD_USER || ""
const PASSWORD = process.env.HERMES_DASHBOARD_PASSWORD || ""

// ponytail: one cookie jar per server process; fine for a single-operator app.
let cookieJar = ""

function notConfigured<T>(): Promise<JsonResult<T>> {
  return Promise.resolve({
    ok: false,
    status: 401,
    error: "HERMES_DASHBOARD_USER / HERMES_DASHBOARD_PASSWORD are not configured",
  })
}

async function login(): Promise<boolean> {
  const res = await fetch(`${BASE}/auth/password-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "basic", username: USER, password: PASSWORD }),
    cache: "no-store",
    redirect: "manual",
  }).catch(() => null)
  if (!res) return false
  const setCookies = res.headers.getSetCookie?.() ?? []
  if (!setCookies.length) return false
  cookieJar = setCookies.map((c) => c.split(";")[0]).join("; ")
  return true
}

async function request<T>(path: string, init: RequestInit = {}): Promise<JsonResult<T>> {
  if (!USER || !PASSWORD) return notConfigured<T>()
  if (!cookieJar && !(await login())) {
    return { ok: false, status: 401, error: "Dashboard login failed" }
  }
  const withCookie = (): RequestInit => ({
    ...init,
    headers: { ...(init.headers as Record<string, string>), Cookie: cookieJar },
  })
  let res = await fetchJson<T>(`${BASE}${path}`, withCookie())
  if (!res.ok && res.status === 401 && (await login())) {
    res = await fetchJson<T>(`${BASE}${path}`, withCookie())
  }
  return res
}

const get = <T,>(path: string) => request<T>(path)
const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

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

export type DashboardSkill = {
  name: string
  description?: string
  source?: string
  enabled?: boolean
  usage?: number
}

export const dashboardConfigured = USER.length > 0 && PASSWORD.length > 0

export const dashboard = {
  mcpServers: () => get<{ servers: McpServer[] }>("/api/mcp/servers"),
  mcpCatalog: () => get("/api/mcp/catalog"),
  testMcpServer: (name: string) => post(`/api/mcp/servers/${encodeURIComponent(name)}/test`),
  cronJobs: () => get<{ jobs: CronJob[] }>("/api/cron/jobs"),
  createCronJob: (body: unknown) => post("/api/cron/jobs", body),
  kanbanBoard: () => get<KanbanBoard>("/api/plugins/kanban/board"),
  createKanbanTask: (body: unknown) => post<KanbanTask>("/api/plugins/kanban/tasks", body),
  // Hermes 8642 /v1/skills is broken at the pinned commit (TypeError include_editorial);
  // the dashboard route is the working one.
  skills: () => get<DashboardSkill[]>("/api/skills"),
}
