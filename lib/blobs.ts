import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

// ponytail: local disk volume, not S3/MinIO. Fine for a single-VM deployment;
// swap for an object-store client if this ever needs to scale horizontally.
const BLOB_DIR = process.env.BLOB_DIR ?? "/data/blobs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type BlobMeta = {
  name: string
  contentType: string
  size: number
}

export async function saveBlob(
  bytes: Buffer,
  meta: { name: string; contentType: string }
): Promise<string> {
  await mkdir(BLOB_DIR, { recursive: true })
  const id = randomUUID()
  const fullMeta: BlobMeta = { ...meta, size: bytes.length }
  await writeFile(path.join(BLOB_DIR, `${id}.bin`), bytes)
  await writeFile(
    path.join(BLOB_DIR, `${id}.json`),
    JSON.stringify(fullMeta)
  )
  return id
}

export async function readBlob(
  id: string
): Promise<{ bytes: Buffer; name: string; contentType: string } | null> {
  // Path-traversal boundary: id becomes a filename below, so it must be a
  // plain uuid before it ever touches the filesystem.
  if (!UUID_RE.test(id)) return null

  try {
    const [bytes, metaRaw] = await Promise.all([
      readFile(path.join(BLOB_DIR, `${id}.bin`)),
      readFile(path.join(BLOB_DIR, `${id}.json`), "utf8"),
    ])
    const meta = JSON.parse(metaRaw) as BlobMeta
    return { bytes, name: meta.name, contentType: meta.contentType }
  } catch {
    return null
  }
}
