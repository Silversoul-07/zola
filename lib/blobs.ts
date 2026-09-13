import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
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

// Signed read links. A model provider cannot send our auth cookie, so the
// bytes have to be reachable without it -- but a plain public path would make
// every attachment permanently world-readable to anyone who ever saw the URL.
// An HMAC over id+expiry keeps the exposure to one short window per send.
const SIGNING_KEY = process.env.AUTH_SECRET || process.env.CSRF_SECRET || ""
const DEFAULT_TTL_SECONDS = 30 * 60

function signature(id: string, exp: number): string {
  return createHmac("sha256", SIGNING_KEY).update(`${id}.${exp}`).digest("base64url")
}

/** `/api/files/<id>?exp=…&sig=…`, readable without a session until it expires. */
export function signBlobPath(id: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  return `/api/files/${id}?exp=${exp}&sig=${signature(id, exp)}`
}

export function verifyBlobSignature(
  id: string,
  exp: string | null,
  sig: string | null
): boolean {
  if (!SIGNING_KEY || !exp || !sig) return false
  const expiry = Number(exp)
  if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) return false
  const want = Buffer.from(signature(id, expiry))
  const got = Buffer.from(sig)
  // Length check first: timingSafeEqual throws on a mismatch.
  return want.length === got.length && timingSafeEqual(want, got)
}
