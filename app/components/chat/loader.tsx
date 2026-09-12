import { Loader as ElementsLoader } from "@/components/ai-elements/loader"
import { Shimmer } from "@/components/ai-elements/shimmer"

// Assistant "thinking" indicator shown before the first assistant part streams in.
export function Loader() {
  return (
    <div className="flex items-center gap-2">
      <ElementsLoader size={14} />
      <Shimmer className="text-muted-foreground text-[13px]">
        Thinking…
      </Shimmer>
    </div>
  )
}
