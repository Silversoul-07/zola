"use client"

import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { fetchClient } from "@/lib/fetch"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

type Skill = { name: string; description?: string; source?: string; body?: string }

export default function SkillsPage() {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Skill | null>(null)

  const { data, isLoading, error } = useQuery<{ skills: Skill[] }>({
    queryKey: ["cloud9", "skills"],
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/skills")
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to load skills")
      return res.json()
    },
  })

  const filtered = useMemo(() => {
    if (!data?.skills) return []
    const q = search.trim().toLowerCase()
    if (!q) return data.skills
    return data.skills.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
    )
  }, [data, search])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Skills</h1>
      <Input
        placeholder="Search skills…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <StatusBlock isLoading={isLoading} error={error?.message} isEmpty={filtered.length === 0}>
        <ul className="divide-y rounded-md border">
          {filtered.map((skill) => (
            <li
              key={skill.name}
              className="hover:bg-muted/50 cursor-pointer px-4 py-3"
              onClick={() => setSelected(skill)}
            >
              <p className="font-medium">{skill.name}</p>
              {skill.description && (
                <p className="text-muted-foreground text-sm">{skill.description}</p>
              )}
              {skill.source && <p className="text-muted-foreground text-xs">{skill.source}</p>}
            </li>
          ))}
        </ul>
      </StatusBlock>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
            <SheetDescription>{selected?.description}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4 text-sm">
            {selected?.body ? (
              <pre className="bg-muted overflow-auto rounded-md p-3 whitespace-pre-wrap">
                {selected.body}
              </pre>
            ) : (
              <p className="text-muted-foreground">No body returned by the API for this skill.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
