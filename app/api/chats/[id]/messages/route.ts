import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { asc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { toMessageDTO } from "../../utils"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.chatId, id))
    .orderBy(asc(schema.messages.createdAt))

  return NextResponse.json(rows.map(toMessageDTO))
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const messages = Array.isArray(body.messages) ? body.messages : [body]

  const rows = await db
    .insert(schema.messages)
    .values(
      messages.map(
        (m: {
          role: string
          content: string | null
          experimental_attachments?: unknown
          createdAt?: string
          message_group_id?: string
          model?: string
        }) => ({
          chatId: id,
          userId: user.id,
          role: m.role,
          content: m.content,
          experimentalAttachments: m.experimental_attachments,
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
          messageGroupId: m.message_group_id || null,
          model: m.model || null,
        })
      )
    )
    .returning()

  return NextResponse.json(rows.map(toMessageDTO))
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await db.delete(schema.messages).where(eq(schema.messages.chatId, id))
  return NextResponse.json({ success: true })
}
