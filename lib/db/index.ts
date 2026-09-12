import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required")
}

// ponytail: module-level singleton, one pool per process. Fine for a
// single-user self-hosted deployment; revisit if this ever runs multi-tenant.
const client = postgres(DATABASE_URL, { max: 5 })

export const db = drizzle(client, { schema })
export { schema }
