// Server-side client for the opencode file API running on the VM (opencode serve).
// Basic auth, never reaches the browser.
import { fetchJson } from "./fetch-json"

const BASE = process.env.OPENCODE_URL || ""
const PASSWORD = process.env.OPENCODE_SERVER_PASSWORD || ""

function authHeaders(): Record<string, string> {
  const token = Buffer.from(`opencode:${PASSWORD}`).toString("base64")
  return { Authorization: `Basic ${token}` }
}

// Rejects any path containing a ".." segment (path traversal) so routes can 400 early.
export function hasParentTraversal(path: string): boolean {
  return path.split(/[\\/]/).includes("..")
}

export type FileNode = { name: string; path: string; type: "file" | "directory" }
export type FileContent =
  | { type: "text"; content: string }
  | { type: "raw"; [key: string]: unknown }

export function readFile(path: string) {
  return fetchJson<FileContent>(`${BASE}/file/content?path=${encodeURIComponent(path)}`, {
    headers: authHeaders(),
  })
}

export function listDir(path: string) {
  return fetchJson<FileNode[]>(`${BASE}/file?path=${encodeURIComponent(path)}`, {
    headers: authHeaders(),
  })
}

export function findFiles(query: string) {
  return fetchJson<string[]>(`${BASE}/find/file?query=${encodeURIComponent(query)}`, {
    headers: authHeaders(),
  })
}
