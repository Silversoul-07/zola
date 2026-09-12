import { hermes } from "@/lib/cloud9/hermes"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const { action } = await request.json()
  if (action !== "pause" && action !== "resume" && action !== "run") {
    return NextResponse.json({ error: "action must be pause, resume, or run" }, { status: 400 })
  }

  const res = await hermes.jobAction(id, action)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data ?? { ok: true })
}
