import { getCurrentUser } from "@/lib/auth"
import { opencodeDiff } from "@/lib/opencode/client"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sessionId = req.nextUrl.searchParams.get("session")
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session param" }, { status: 400 })
  }

  const res = await opencodeDiff(sessionId)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 502 })
  }

  return NextResponse.json(res.data)
}
