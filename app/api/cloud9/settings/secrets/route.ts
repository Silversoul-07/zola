import { litellm } from "@/lib/cloud9/litellm"
import { NextResponse } from "next/server"

function mask(key?: string) {
  if (!key) return ""
  return key.length <= 8 ? "****" : `${key.slice(0, 6)}...${key.slice(-4)}`
}

// LiteLLM has no "list all keys" endpoint by default; the UI keeps track of keys it created
// (client-side, name + masked token) and refreshes each one's spend/budget via /key/info.
export async function POST(request: Request) {
  const body = await request.json()
  const res = await litellm.generateKey({
    key_alias: body.name,
    models: body.models,
    max_budget: body.maxBudget,
  })
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  const key = res.data.key || res.data.token
  return NextResponse.json({ key, masked: mask(key), name: body.name })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")
  if (!key) return NextResponse.json({ error: "key query param is required" }, { status: 400 })

  const res = await litellm.keyInfo(key)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json({ info: res.data.info, masked: mask(key) })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")
  if (!key) return NextResponse.json({ error: "key query param is required" }, { status: 400 })

  const res = await litellm.deleteKey([key])
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  return NextResponse.json({ deleted: true })
}

export async function PATCH(request: Request) {
  const { key } = await request.json()
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 })

  const res = await litellm.regenerateKey(key)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 502 })
  }
  const newKey = res.data.key || res.data.token
  return NextResponse.json({ key: newKey, masked: mask(newKey) })
}
