import { cn } from "@/lib/utils"

// The one accent color (sky) marks "running/active"; red marks error; muted is everything else.
export function StatusDot({
  status,
  className,
}: {
  status: "ok" | "error" | "muted"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        status === "ok" && "bg-sky-500",
        status === "error" && "bg-red-500",
        status === "muted" && "bg-muted-foreground/40",
        className
      )}
    />
  )
}
