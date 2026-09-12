import { getCurrentUser } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { asc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name } = await request.json()
  const [project] = await db
    .insert(schema.projects)
    .values({ name, userId: user.id })
    .returning()

  return NextResponse.json(project)
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.userId, user.id))
    .orderBy(asc(schema.projects.createdAt))

  return NextResponse.json(rows)
}
