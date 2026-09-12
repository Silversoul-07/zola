import { getCurrentUser } from "@/lib/auth"
import { getMessageUsage } from "./api"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  try {
    const usage = await getMessageUsage(user.id)
    return new Response(JSON.stringify(usage), { status: 200 })
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
    })
  }
}
