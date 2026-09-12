import { Shimmer } from "@/components/ai-elements/shimmer"

// Assistant "thinking" indicator shown before the first token streams in.
export function Loader() {
  return (
    <Shimmer className="text-muted-foreground text-[13px]">Thinking…</Shimmer>
  )
}
