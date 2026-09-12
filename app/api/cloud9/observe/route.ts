import { hermes } from "@/lib/cloud9/hermes"
import { litellm } from "@/lib/cloud9/litellm"
import { NextResponse } from "next/server"

// Each section is independently ok/error so the page can render per-section loading/error/data
// even when, e.g., LiteLLM is unreachable but Hermes is fine.
export async function GET() {
  const [healthRes, sessionsRes, globalSpendRes, spendLogsRes] = await Promise.all([
    hermes.healthDetailed(),
    hermes.sessions(),
    litellm.globalSpend(),
    litellm.spendLogs(),
  ])

  const sessions = sessionsRes.ok ? sessionsRes.data.data : []
  const failures = sessions.filter((s) => s.end_reason && s.end_reason !== "normal")

  return NextResponse.json({
    health: healthRes.ok ? { ok: true, data: healthRes.data } : { ok: false, error: healthRes.error },
    sessions: sessionsRes.ok
      ? {
          ok: true,
          data: {
            count: sessions.length,
            totalInputTokens: sessions.reduce((n, s) => n + (s.input_tokens || 0), 0),
            totalOutputTokens: sessions.reduce((n, s) => n + (s.output_tokens || 0), 0),
          },
        }
      : { ok: false, error: sessionsRes.error },
    litellmSpend: globalSpendRes.ok
      ? { ok: true, data: globalSpendRes.data }
      : { ok: false, error: globalSpendRes.error },
    recentFailures: {
      hermes: failures.slice(0, 20),
      litellm: spendLogsRes.ok
        ? spendLogsRes.data.filter((l) => {
            const status = (l as { status_code?: number }).status_code
            return typeof status === "number" && status >= 400
          })
        : [],
      litellmError: spendLogsRes.ok ? null : spendLogsRes.error,
    },
  })
}
