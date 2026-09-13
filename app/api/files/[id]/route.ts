import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { readBlob, verifyBlobSignature } from "@/lib/blobs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Two ways in: the operator's session (the browser rendering the chat), or a
  // signed link handed to a model provider, which has no cookie to send.
  const query = new URL(request.url).searchParams
  const signed = verifyBlobSignature(id, query.get("exp"), query.get("sig"))
  if (!signed) {
    const user = await getCurrentUser()
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const blob = await readBlob(id)
  if (!blob) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return new Response(new Uint8Array(blob.bytes), {
    headers: {
      "Content-Type": blob.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  })
}
