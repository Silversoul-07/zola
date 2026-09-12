"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { BrainIcon } from "lucide-react"

// Slider stops, left to right. "auto" leaves the runtime's own default;
// the rest map to Hermes `reasoning.effort` / OpenCode variants.
const LEVELS = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra High" },
] as const

export type ThinkingEffort = (typeof LEVELS)[number]["value"]

export function ThinkingEffortSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const index = Math.max(0, LEVELS.findIndex((l) => l.value === value))
  const active = value !== "auto"
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Thinking effort: ${LEVELS[index].label}`}
              className={cn(
                "size-8 rounded-full",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <BrainIcon className="size-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Thinking effort</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-56 rounded-2xl p-4">
        <div className="mb-3 text-center text-sm font-medium">{LEVELS[index].label}</div>
        <Slider
          min={0}
          max={LEVELS.length - 1}
          step={1}
          value={[index]}
          onValueChange={([i]) => onChange(LEVELS[i].value)}
          aria-label="Thinking effort"
        />
        <div className="text-muted-foreground mt-2 flex justify-between text-[10px]">
          <span>Auto</span>
          <span>Max</span>
        </div>
      </PopoverContent>
    </Popover>
  )
}
