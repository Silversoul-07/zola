import { litellm } from "@/lib/cloud9/litellm"
import { NextResponse } from "next/server"

export async function GET() {
  const [modelsRes, infoRes] = await Promise.all([litellm.models(), litellm.modelInfo()])

  if (!modelsRes.ok && !infoRes.ok) {
    return NextResponse.json({ error: modelsRes.error }, { status: 502 })
  }

  return NextResponse.json({
    models: modelsRes.ok ? modelsRes.data.data : [],
    modelsError: modelsRes.ok ? null : modelsRes.error,
    info: infoRes.ok ? infoRes.data.data : [],
    infoError: infoRes.ok ? null : infoRes.error,
  })
}
