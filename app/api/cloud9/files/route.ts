import { getCurrentUser } from "@/lib/auth"
import { findFiles, hasParentTraversal, listDir } from "@/lib/cloud9/opencode-files"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dir = searchParams.get("dir")
  const q = searchParams.get("q")

  if (dir !== null) {
    if (hasParentTraversal(dir)) return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    const res = await listDir(dir)
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status || 502 })
    return NextResponse.json(res.data)
  }

  if (q !== null) {
    if (hasParentTraversal(q)) return NextResponse.json({ error: "Invalid query" }, { status: 400 })
    const res = await findFiles(q)
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status || 502 })
    return NextResponse.json(res.data)
  }

  return NextResponse.json({ error: "Missing dir or q" }, { status: 400 })
}
