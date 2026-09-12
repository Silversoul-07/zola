import { Shimmer } from "./tools/shimmer"

// Assistant "thinking" indicator shown before the first token streams in.
// Reuses the same shimmer treatment as pending tool labels.
export function Loader() {
  return (
    <Shimmer className="text-muted-foreground text-[13px]">Thinking…</Shimmer>
  )
}
