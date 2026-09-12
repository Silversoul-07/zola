import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { opencodeAbort } from "@/lib/opencode/client"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

// Called in addition to the client dropping its fetch: OpenCode keeps
// running server-side otherwise (see .claude/docs/runtime-coverage.md item 1).
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { chatId } = (await req.json()) as { chatId?: string }
  if (!chatId) {
    return NextResponse.json({ error: "Missing chatId" }, { status: 400 })
  }

  const [chatRow] = await db
    .select({ runtimeSessionId: schema.chats.runtimeSessionId })
    .from(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, user.id)))

  if (!chatRow?.runtimeSessionId) {
    // Nothing to abort (no OpenCode session yet, or not this user's chat).
    return NextResponse.json({ ok: true })
  }

  const res = await opencodeAbort(chatRow.runtimeSessionId)
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
