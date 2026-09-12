import { dashboard, dashboardConfigured } from "@/lib/cloud9/dashboard"
import { hermes } from "@/lib/cloud9/hermes"
import { NextResponse } from "next/server"

export async function GET() {
  const [mcpRes, toolsetsRes] = await Promise.all([dashboard.mcpServers(), hermes.toolsets()])

  return NextResponse.json({
    mcp: mcpRes.ok
      ? { servers: mcpRes.data.servers }
      : { error: mcpRes.error, configured: dashboardConfigured },
    toolsets: toolsetsRes.ok ? toolsetsRes.data.data : [],
    toolsetsError: toolsetsRes.ok ? null : toolsetsRes.error,
  })
}
