"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { EyeSlash } from "@phosphor-icons/react"

type ButtonIncognitoProps = {
  isSelected: boolean
  onToggle: (value: boolean) => void
}

export function ButtonIncognito({
  isSelected,
  onToggle,
}: ButtonIncognitoProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onToggle(!isSelected)}
          aria-pressed={isSelected}
          aria-label="Private chat"
          className={cn(
            "pointer-events-auto inline-flex size-9 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            isSelected
              ? "text-sky-500 bg-sky-500/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <EyeSlash className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Private chat: not saved</TooltipContent>
    </Tooltip>
  )
}
