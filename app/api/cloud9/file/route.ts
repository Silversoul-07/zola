import { getCurrentUser } from "@/lib/auth"
import { hasParentTraversal, readFile } from "@/lib/cloud9/opencode-files"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const path = searchParams.get("path")
  if (!path || hasParentTraversal(path)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }

  const res = await readFile(path)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  return NextResponse.json(res.data)
}
