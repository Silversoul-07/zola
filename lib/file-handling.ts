import { toast } from "@/components/ui/toast"
import * as fileType from "file-type"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]

export type Attachment = {
  name: string
  contentType: string
  url: string
}

export async function validateFile(
  file: File
): Promise<{ isValid: boolean; error?: string }> {
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
    }
  }

  const buffer = await file.arrayBuffer()
  const type = await fileType.fileTypeFromBuffer(
    Buffer.from(buffer.slice(0, 4100))
  )

  if (!type || !ALLOWED_FILE_TYPES.includes(type.mime)) {
    return {
      isValid: false,
      error: "File type not supported or doesn't match its extension",
    }
  }

  return { isValid: true }
}

export function createAttachment(file: File, url: string): Attachment {
  return {
    name: file.name,
    contentType: file.type,
    url,
  }
}

// ponytail: blobs are saved to a single local disk volume (lib/blobs.ts), not
// object storage. Fine for a single-VM deployment; swap for S3/MinIO if this
// ever needs to scale beyond one machine.
export async function processFiles(
  files: File[],
  chatId: string,
  _userId: string
): Promise<Attachment[]> {
  const attachments: Attachment[] = []

  for (const file of files) {
    const validation = await validateFile(file)
    if (!validation.isValid) {
      console.warn(`File ${file.name} validation failed:`, validation.error)
      toast({
        title: "File validation failed",
        description: validation.error,
        status: "error",
      })
      continue
    }

    // Upload the bytes to disk and keep only the short /api/files/<id> url on
    // the message; the chat route inlines it back to a data url server-side
    // right before sending to a model provider.
    const form = new FormData()
    form.append("file", file)
    form.append("chatId", chatId)

    try {
      const res = await fetch("/api/files", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      })
      if (!res.ok) throw new Error(`Upload failed with status ${res.status}`)
      const { url } = (await res.json()) as { url: string }
      attachments.push(createAttachment(file, url))
    } catch (err) {
      console.warn(`File ${file.name} upload failed:`, err)
      toast({
        title: "File upload failed",
        description: `Could not upload ${file.name}`,
        status: "error",
      })
    }
  }

  return attachments
}

export class FileUploadLimitError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "DAILY_FILE_LIMIT_REACHED"
  }
}

export async function checkFileUploadLimit(_userId: string) {
  return 0
}
