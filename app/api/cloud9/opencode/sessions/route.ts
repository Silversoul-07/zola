import { getCurrentUser } from "@/lib/auth"
import { opencodeListSessions } from "@/lib/opencode/client"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const res = await opencodeListSessions()
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 502 })
  }

  const sessions = res.data
    .slice(0, 50)
    .map((s) => ({ id: s.id, title: s.title, updated: s.time?.updated }))

  return NextResponse.json({ sessions })
}
