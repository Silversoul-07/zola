"use client"

import { PageHeader } from "@/app/(cloud9)/_components/page-header"
import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { fetchClient } from "@/lib/fetch"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

type Skill = { name: string; description?: string; source?: string; enabled?: boolean }

export default function SkillsPage() {
  const [search, setSearch] = useState("")

  const { data, isLoading, error } = useQuery<{ skills: Skill[] }>({
    queryKey: ["cloud9", "skills"],
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/skills")
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Failed to load skills")
      return res.json()
    },
  })

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = (data?.skills ?? []).filter(
      (s) => !q || s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
    )
    // ponytail: the API has no `category` field, so we group by `source` (the closest thing to
    // one) until Hermes adds a real category.
    const byCategory = new Map<string, Skill[]>()
    for (const skill of filtered) {
      const key = skill.source || "Other"
      if (!byCategory.has(key)) byCategory.set(key, [])
      byCategory.get(key)!.push(skill)
    }
    return [...byCategory.entries()]
  }, [data, search])

  return (
    <div>
      <PageHeader
        title="Skills"
        action={
          <Input
            placeholder="Search skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        }
      />
      <StatusBlock
        isLoading={isLoading}
        error={error?.message}
        isEmpty={groups.length === 0}
        emptyLabel="No skills found."
      >
        <div className="space-y-6">
          {groups.map(([category, skills]) => (
            <div key={category}>
              <h2 className="text-muted-foreground mb-2 text-[13px]">{category}</h2>
              <div className="divide-y divide-border rounded-xl border border-border">
                {skills.map((skill) => (
                  <div key={skill.name} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{skill.name}</p>
                      {skill.description && (
                        <p className="text-muted-foreground truncate text-[13px]">{skill.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="bg-muted text-muted-foreground rounded-lg px-2 py-0.5 text-[13px]">
                        {category}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Switch checked={skill.enabled ?? true} disabled />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Toggle from the Hermes dashboard</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </StatusBlock>
    </div>
  )
}
