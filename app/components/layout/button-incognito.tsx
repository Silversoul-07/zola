"use client"

import { Button } from "@/components/ui/button"
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onToggle(!isSelected)}
          aria-pressed={isSelected}
          className={cn(
            "pointer-events-auto rounded-lg",
            isSelected &&
              "text-sky-500 bg-sky-500/10 hover:bg-sky-500/10 hover:text-sky-500"
          )}
        >
          <EyeSlash className="size-5" />
          <span className="sr-only">Private chat</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isSelected ? "Private on: not saved" : "Private chat"}</TooltipContent>
    </Tooltip>
  )
}
