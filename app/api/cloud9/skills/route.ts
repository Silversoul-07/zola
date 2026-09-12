import { dashboard } from "@/lib/cloud9/dashboard"
import { NextResponse } from "next/server"

export async function GET() {
  const res = await dashboard.skills()
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json({ skills: res.data })
}
