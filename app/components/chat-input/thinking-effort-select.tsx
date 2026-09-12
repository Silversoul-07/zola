"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BrainIcon } from "lucide-react"

const OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "Thinking: auto" },
  { value: "low", label: "Thinking: low" },
  { value: "medium", label: "Thinking: medium" },
  { value: "high", label: "Thinking: high" },
]

export function ThinkingEffortSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="h-8 w-auto gap-1 rounded-full border-none bg-transparent px-3 text-sm shadow-none"
        title="Thinking effort"
      >
        <BrainIcon className="size-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
