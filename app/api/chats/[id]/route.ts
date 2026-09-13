import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { toChatDTO } from "../utils"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const [chat] = await db
    .select()
    .from(schema.chats)
    .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, user.id)))

  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  return NextResponse.json(toChatDTO(chat))
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const updates: Partial<typeof schema.chats.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (typeof body.title === "string") updates.title = body.title
  if (typeof body.model === "string") updates.model = body.model
  if (typeof body.public === "boolean") updates.public = body.public
  if (typeof body.agentId === "string" || body.agentId === null) {
    updates.agentId = body.agentId
  }
  if (typeof body.pinned === "boolean") {
    updates.pinned = body.pinned
    updates.pinnedAt = body.pinned ? new Date() : null
  }

  const [chat] = await db
    .update(schema.chats)
    .set(updates)
    .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, user.id)))
    .returning()

  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  return NextResponse.json(toChatDTO(chat))
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db
    .delete(schema.chats)
    .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, user.id)))

  return NextResponse.json({ success: true })
}
