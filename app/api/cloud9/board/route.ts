import { dashboard, dashboardConfigured } from "@/lib/cloud9/dashboard"
import { NextResponse } from "next/server"

export async function GET() {
  if (!dashboardConfigured) {
    return NextResponse.json(
      { error: "HERMES_DASHBOARD_USER / HERMES_DASHBOARD_PASSWORD are not configured", boardUrl: "https://hermes.kryos.dev/kanban" },
      { status: 401 }
    )
  }

  const res = await dashboard.kanbanBoard()
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error, boardUrl: "https://hermes.kryos.dev/kanban" },
      { status: res.status || 502 }
    )
  }
  return NextResponse.json(res.data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const res = await dashboard.createKanbanTask(body)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json(res.data)
}
