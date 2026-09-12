import { getCurrentUser } from "@/lib/auth"
import { opencodeReplyPermission } from "@/lib/opencode/client"
import { NextResponse } from "next/server"

type Body = {
  sessionId?: string
  permissionId?: string
  response?: "once" | "always" | "reject"
}

// Proxies the approve/deny card's answer to OpenCode's permission channel
// (see .claude/docs/runtime-coverage.md item 3). No chat/session ownership
// check here: the sessionId comes from a data part we wrote into this user's
// own message stream, same trust level as the abort/permission routes above.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { sessionId, permissionId, response } = (await req.json()) as Body
  if (!sessionId || !permissionId || !response) {
    return NextResponse.json({ error: "Missing sessionId/permissionId/response" }, { status: 400 })
  }
  if (!["once", "always", "reject"].includes(response)) {
    return NextResponse.json({ error: "Invalid response" }, { status: 400 })
  }

  const res = await opencodeReplyPermission(sessionId, permissionId, response)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
