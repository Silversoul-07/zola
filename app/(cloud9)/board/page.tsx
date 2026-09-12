"use client"

import { PageHeader } from "@/app/(cloud9)/_components/page-header"
import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

type Task = {
  id: string
  title: string
  body?: string | null
  assignee?: string | null
  status: string
  priority: number
  latest_summary?: string | null
  age?: { created_age_seconds: number | null }
}

type BoardResponse = { tasks?: Task[]; columns?: Record<string, Task[]>; error?: string; boardUrl?: string }

// Fixed display order; a column is only rendered when the API actually returns it.
const COLUMN_ORDER = ["triage", "todo", "scheduled", "ready", "running", "blocked", "review", "done"] as const

function columnsFrom(data: BoardResponse | undefined): [string, Task[]][] {
  if (!data) return []
  if (data.columns) {
    return COLUMN_ORDER.filter((c) => c in data.columns!).map((c) => [c, data.columns![c]])
  }
  if (data.tasks) {
    // ponytail: no `columns` map from this API shape, so only columns with at least one task
    // show up — good enough without a second endpoint telling us which empty columns exist.
    const present = new Set(data.tasks.map((t) => t.status))
    return COLUMN_ORDER.filter((c) => present.has(c)).map((c) => [c, data.tasks!.filter((t) => t.status === c)])
  }
  return []
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function BoardPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: "", body: "", priority: "0" })

  const { data, isLoading } = useQuery<BoardResponse>({
    queryKey: ["cloud9", "board"],
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/board")
      const body = await res.json()
      // 401/502 still return usable JSON (error + boardUrl); treat as data, not a thrown error.
      return body
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/cloud9/board", {
        method: "POST",
        body: JSON.stringify({ ...form, priority: Number(form.priority) }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to create task")
      return body
    },
    onSuccess: () => {
      toast({ title: "Task created" })
      queryClient.invalidateQueries({ queryKey: ["cloud9", "board"] })
      setForm({ title: "", body: "", priority: "0" })
      setOpen(false)
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, status: "error" }),
  })

  const boardUrl = data?.boardUrl || "https://hermes.kryos.dev/kanban"
  const unreachable = !!data?.error
  const columns = columnsFrom(data)

  const newTaskDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-sky-500 text-white hover:bg-sky-600">New task</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Textarea
            placeholder="Body"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
          <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Priority 0</SelectItem>
              <SelectItem value="1">Priority 1</SelectItem>
              <SelectItem value="2">Priority 2</SelectItem>
              <SelectItem value="3">Priority 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            className="bg-sky-500 text-white hover:bg-sky-600"
            disabled={!form.title || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <div>
      <PageHeader title="Board" action={!unreachable ? newTaskDialog : undefined} />

      <StatusBlock isLoading={isLoading} isEmpty={false}>
        {unreachable ? (
          <p className="text-muted-foreground text-sm">
            The kanban dashboard API is unreachable.{" "}
            <a href={boardUrl} target="_blank" rel="noreferrer" className="text-foreground underline">
              Open the Hermes kanban board
            </a>{" "}
            directly instead.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            {columns.map(([col, tasks]) => (
              <div key={col} className="space-y-2">
                <div className="text-muted-foreground flex items-center justify-between text-[13px]">
                  <span>{titleCase(col)}</span>
                  <span>{tasks.length}</span>
                </div>
                {tasks.length === 0 ? (
                  <div className="border-border text-muted-foreground rounded-lg border border-dashed p-3 text-center text-[13px]">
                    No tasks
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`rounded-xl border border-border p-3 ${
                          task.priority > 0 ? "border-l-2 border-l-amber-500" : ""
                        }`}
                      >
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-muted-foreground mt-1 text-[13px]">
                          {[
                            task.assignee,
                            task.age?.created_age_seconds != null
                              ? `${Math.round(task.age.created_age_seconds / 60)}m`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {task.latest_summary && (
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-[13px]">
                            {task.latest_summary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </StatusBlock>
    </div>
  )
}
