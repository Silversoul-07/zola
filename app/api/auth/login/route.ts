import { checkCredentials, createSession } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { username, password } = await request.json()

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !checkCredentials(username, password)
  ) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    )
  }

  await createSession()
  return NextResponse.json({ success: true })
}
