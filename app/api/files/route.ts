import * as fileType from "file-type"
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { saveBlob } from "@/lib/blobs"
import { ALLOWED_FILE_TYPES } from "@/lib/file-handling"

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024 // 20MB

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await request.formData()
  // chatId is accepted for forward compatibility with the client's upload
  // call but unused here — associating blobs with a chat is out of scope
  // (no DB schema changes in this change).
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: `File size exceeds ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB limit` },
      { status: 413 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const type = await fileType.fileTypeFromBuffer(buffer.subarray(0, 4100))
  if (!type || !ALLOWED_FILE_TYPES.includes(type.mime)) {
    return NextResponse.json(
      { error: "File type not supported or doesn't match its extension" },
      { status: 415 }
    )
  }

  const id = await saveBlob(buffer, { name: file.name, contentType: type.mime })

  return NextResponse.json({
    url: `/api/files/${id}`,
    name: file.name,
    contentType: type.mime,
  })
}
