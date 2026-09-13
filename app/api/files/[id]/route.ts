import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { readBlob } from "@/lib/blobs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const blob = await readBlob(id)
  if (!blob) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return new Response(new Uint8Array(blob.bytes), {
    headers: {
      "Content-Type": blob.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  })
}
