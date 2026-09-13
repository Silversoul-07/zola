import assert from "node:assert"
import { randomUUID } from "node:crypto"
import { mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

async function main() {
  process.env.BLOB_DIR = await mkdtemp(path.join(os.tmpdir(), "blobs-test-"))
  // blobs.ts reads the signing key at module load, so set it before importing.
  process.env.AUTH_SECRET = "test-signing-key"

  const { saveBlob, readBlob, signBlobPath, verifyBlobSignature } =
    await import("./blobs")

  // save/read roundtrip preserves bytes + name + contentType
  const bytes = Buffer.from("hello world")
  const id = await saveBlob(bytes, { name: "hello.txt", contentType: "text/plain" })
  const read = await readBlob(id)
  assert(read, "expected blob to be found")
  assert(read.bytes.equals(bytes))
  assert.equal(read.name, "hello.txt")
  assert.equal(read.contentType, "text/plain")

  // path traversal is rejected before touching the filesystem
  assert.equal(await readBlob("../../etc/passwd"), null)

  // well-formed but unknown id returns null
  assert.equal(await readBlob(randomUUID()), null)

  // --- signed links: the only thing standing between a private attachment
  // and the open internet, so cover forgery and expiry, not just the happy path.
  const signedId = "11111111-2222-4333-8444-555555555555"
  const link = signBlobPath(signedId, 60)
  const q = new URLSearchParams(link.slice(link.indexOf("?") + 1))
  assert.ok(link.startsWith(`/api/files/${signedId}?`))
  assert.equal(verifyBlobSignature(signedId, q.get("exp"), q.get("sig")), true)

  // A signature is bound to one id; it must not unlock another blob.
  const otherId = "99999999-2222-4333-8444-555555555555"
  assert.equal(verifyBlobSignature(otherId, q.get("exp"), q.get("sig")), false)

  // Extending the expiry by hand must invalidate the signature.
  assert.equal(verifyBlobSignature(signedId, "9999999999", q.get("sig")), false)

  // An expired link is refused even though its own signature is genuine.
  const stale = signBlobPath(signedId, -10)
  const sq = new URLSearchParams(stale.slice(stale.indexOf("?") + 1))
  assert.equal(verifyBlobSignature(signedId, sq.get("exp"), sq.get("sig")), false)

  // Missing or short parameters are refused, not thrown on.
  assert.equal(verifyBlobSignature(signedId, null, null), false)
  assert.equal(verifyBlobSignature(signedId, q.get("exp"), "short"), false)

  console.log("blob tests ok")
}

main()
