"use client"

import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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

const COLUMNS = ["todo", "ready", "running", "blocked", "done"] as const

export default function BoardPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ title: "", body: "", priority: 0 })

  const { data, isLoading } = useQuery<{ tasks?: Task[]; error?: string; boardUrl?: string }>({
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
      const res = await fetchClient("/api/cloud9/board", { method: "POST", body: JSON.stringify(form) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to create task")
      return body
    },
    onSuccess: () => {
      toast({ title: "Task created" })
      queryClient.invalidateQueries({ queryKey: ["cloud9", "board"] })
      setForm({ title: "", body: "", priority: 0 })
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, status: "error" }),
  })

  const boardUrl = data?.boardUrl || "https://hermes.kryos.dev/kanban"
  const unreachable = !!data?.error

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Board</h1>

      <StatusBlock isLoading={isLoading} isEmpty={false}>
        {unreachable ? (
          <p className="text-muted-foreground text-sm">
            The kanban dashboard API is unreachable.{" "}
            <a href={boardUrl} target="_blank" rel="noreferrer" className="text-primary underline">
              Open the Hermes kanban board
            </a>{" "}
            directly instead.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-5">
            {COLUMNS.map((col) => (
              <div key={col} className="space-y-2">
                <h2 className="text-sm font-medium capitalize">{col}</h2>
                {data?.tasks
                  ?.filter((t) => t.status === col)
                  .map((task) => (
                    <Card key={task.id}>
                      <CardHeader>
                        <CardTitle className="text-sm">{task.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-muted-foreground space-y-1 text-xs">
                        {task.assignee && <p>Assignee: {task.assignee}</p>}
                        {task.age?.created_age_seconds != null && (
                          <p>Age: {Math.round(task.age.created_age_seconds / 60)}m</p>
                        )}
                        {task.latest_summary && <p className="line-clamp-2">{task.latest_summary}</p>}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            ))}
          </div>
        )}
      </StatusBlock>

      {!unreachable && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Input
              placeholder="Body"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Priority"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
            />
            <Button disabled={!form.title || createMutation.isPending} onClick={() => createMutation.mutate()}>
              Create
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
