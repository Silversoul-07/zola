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
          className={cn(
            "border-border flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
            isSelected
              ? "bg-accent text-foreground"
              : "text-muted-foreground bg-transparent"
          )}
        >
          <EyeSlash className="size-4" />
          {isSelected && <span>Incognito</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {isSelected ? "Incognito: not saved" : "Turn on incognito"}
      </TooltipContent>
    </Tooltip>
  )
}
