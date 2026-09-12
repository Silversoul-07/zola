import { dashboard, dashboardConfigured } from "@/lib/cloud9/dashboard"
import { hermes } from "@/lib/cloud9/hermes"
import { NextResponse } from "next/server"

export async function GET() {
  const res = await hermes.jobs()
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json({ jobs: res.data.jobs })
}

// Creates the job via the dashboard admin API when a token is configured; otherwise returns the
// equivalent `hermes` CLI command so the user can run it themselves.
export async function POST(request: Request) {
  const body = await request.json()

  if (!dashboardConfigured) {
    const cmd = `hermes job add --name "${body.name}" --schedule "${body.schedule}" --prompt "${body.prompt ?? ""}"`
    return NextResponse.json({ created: false, cliCommand: cmd })
  }

  const res = await dashboard.createCronJob(body)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json({ created: true, job: res.data })
}
