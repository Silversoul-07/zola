"use client"

// Tiny loading/error/empty wrapper reused by every cloud9 section (observe has four independent
// ones on a single page). Not a data-fetching abstraction — callers still bring their own query.
export function StatusBlock({
  isLoading,
  error,
  isEmpty,
  emptyLabel = "Nothing here yet.",
  children,
}: {
  isLoading: boolean
  error?: string | null
  isEmpty?: boolean
  emptyLabel?: string
  children: React.ReactNode
}) {
  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>
  }
  if (error) {
    return <p className="text-destructive text-sm">{error}</p>
  }
  if (isEmpty) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>
  }
  return <>{children}</>
}
