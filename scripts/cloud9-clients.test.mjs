// Exercises lib/cloud9/{fetch-json,hermes,dashboard,litellm}.ts against recorded/mocked JSON
// (no network). Run with:
//   npx tsx scripts/cloud9-clients.test.mjs
import assert from "node:assert/strict"

// Env vars are read at module-load time by the clients, so set them before importing.
process.env.HERMES_API_URL = "https://hermes.test"
process.env.HERMES_API_KEY = "test-hermes-key"
process.env.HERMES_DASHBOARD_URL = "https://dashboard.test"
process.env.HERMES_DASHBOARD_TOKEN = ""
process.env.LITELLM_URL = "http://litellm.test"
process.env.LITELLM_MASTER_KEY = "test-litellm-key"

const routes = new Map()
function mock(url, status, body) {
  routes.set(url, { status, body })
}

global.fetch = async (url, init) => {
  const key = typeof url === "string" ? url : url.toString()
  const route = routes.get(key)
  if (!route) throw new Error(`unmocked fetch: ${init?.method || "GET"} ${key}`)
  const text = typeof route.body === "string" ? route.body : JSON.stringify(route.body)
  return {
    ok: route.status >= 200 && route.status < 300,
    status: route.status,
    statusText: `status ${route.status}`,
    text: async () => text,
  }
}

const { fetchJson } = await import("../lib/cloud9/fetch-json.ts")
const { hermes } = await import("../lib/cloud9/hermes.ts")
const { dashboard, dashboardConfigured } = await import("../lib/cloud9/dashboard.ts")
const { litellm } = await import("../lib/cloud9/litellm.ts")

// --- fetch-json: success, HTTP error, network error -------------------------------------------
mock("https://x.test/ok", 200, { hello: "world" })
{
  const res = await fetchJson("https://x.test/ok")
  assert.deepEqual(res, { ok: true, data: { hello: "world" } })
}

mock("https://x.test/err", 500, { error: { message: "boom" } })
{
  const res = await fetchJson("https://x.test/err")
  assert.deepEqual(res, { ok: false, status: 500, error: "boom" })
}

{
  const res = await fetchJson("https://x.test/unmocked")
  assert.equal(res.ok, false)
  assert.equal(res.status, 0)
}

// --- hermes: health/detailed, sessions, jobAction -----------------------------------------------
mock("https://hermes.test/health/detailed", 200, {
  status: "ok",
  platform: "hermes-agent",
  version: "0.21.2",
  gateway_state: "running",
  active_agents: 0,
  pid: 1,
  updated_at: "2026-01-01T00:00:00Z",
  readiness: { status: "ok", checks: { config: { status: "ok" } } },
  platforms: {},
})
{
  const res = await hermes.healthDetailed()
  assert.equal(res.ok, true)
  assert.equal(res.data.version, "0.21.2")
}

mock("https://hermes.test/api/sessions", 200, {
  object: "list",
  data: [{ id: "s1", title: "t", model: "m", started_at: 0, last_active: 0, message_count: 1, input_tokens: 10, output_tokens: 5, end_reason: null }],
})
{
  const res = await hermes.sessions()
  assert.equal(res.ok, true)
  assert.equal(res.data.data.length, 1)
}

mock("https://hermes.test/api/jobs/j1/pause", 200, { ok: true })
{
  const res = await hermes.jobAction("j1", "pause")
  assert.equal(res.ok, true)
}

// hermes calls must carry the bearer key
{
  let sawAuth = false
  const origFetch = global.fetch
  global.fetch = async (url, init) => {
    if (url === "https://hermes.test/health") sawAuth = init?.headers?.Authorization === "Bearer test-hermes-key"
    return origFetch(url, init)
  }
  mock("https://hermes.test/health", 200, { status: "ok", platform: "hermes-agent", version: "1" })
  await hermes.health()
  assert.equal(sawAuth, true)
  global.fetch = origFetch
}

// --- dashboard: no token configured -> ok:false without a network call -------------------------
{
  assert.equal(dashboardConfigured, false)
  const res = await dashboard.mcpServers()
  assert.deepEqual(res, { ok: false, status: 401, error: "HERMES_DASHBOARD_TOKEN is not configured" })
}

// --- litellm: models list + key generate ---------------------------------------------------------
mock("http://litellm.test/v1/models", 200, { data: [{ id: "gpt-4o", object: "model" }] })
{
  const res = await litellm.models()
  assert.equal(res.ok, true)
  assert.equal(res.data.data[0].id, "gpt-4o")
}

mock("http://litellm.test/key/generate", 200, { key: "sk-new", key_name: "test" })
{
  const res = await litellm.generateKey({ key_alias: "test" })
  assert.equal(res.ok, true)
  assert.equal(res.data.key, "sk-new")
}

console.log("cloud9-clients.test.mjs: all assertions passed")
