import { dashboard } from "@/lib/cloud9/dashboard"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { name } = await request.json()
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

  const res = await dashboard.testMcpServer(name)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data)
}
