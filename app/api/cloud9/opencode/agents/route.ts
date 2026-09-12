import { getCurrentUser } from "@/lib/auth"
import { opencodeAgents } from "@/lib/opencode/client"
import { NextResponse } from "next/server"

const CACHE_TTL_MS = 60_000
// ponytail: module-level cache, one process. Fine for a single-instance
// deployment; revisit if this ever runs multi-instance behind a shared cache.
let cache: { agents: { name: string }[]; expires: number } | null = null

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (cache && cache.expires > Date.now()) {
    return NextResponse.json({ agents: cache.agents })
  }

  const res = await opencodeAgents()
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 502 })
  }

  // compaction / summary / title report mode "primary" but are OpenCode's
  // internal helpers, not something a user picks for a turn.
  const INTERNAL = new Set(["compaction", "summary", "title"])
  const agents = res.data
    .filter((a) => a.mode === "primary" && !INTERNAL.has(a.name))
    .map((a) => ({ name: a.name }))
  cache = { agents, expires: Date.now() + CACHE_TTL_MS }

  return NextResponse.json({ agents })
}
