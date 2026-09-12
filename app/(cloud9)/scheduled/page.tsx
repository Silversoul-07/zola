"use client"

import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

type Job = {
  id: string
  name: string
  schedule_display: string
  enabled: boolean
  state: string
  next_run_at: string | null
  last_run_at: string | null
  last_status: string | null
}

export default function ScheduledPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: "", schedule: "", prompt: "" })

  const { data, isLoading, error } = useQuery<{ jobs: Job[] }>({
    queryKey: ["cloud9", "scheduled"],
    queryFn: async () => {
      const res = await fetchClient("/api/cloud9/scheduled")
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to load jobs")
      return body
    },
  })

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "pause" | "resume" | "run" }) => {
      const res = await fetchClient(`/api/cloud9/scheduled/${id}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Action failed")
      return body
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cloud9", "scheduled"] }),
    onError: (err: Error) => toast({ title: "Job action failed", description: err.message, status: "error" }),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchClient("/api/cloud9/scheduled", {
        method: "POST",
        body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to create job")
      return body as { created: boolean; cliCommand?: string }
    },
    onSuccess: (body) => {
      if (body.created) {
        toast({ title: "Job created" })
        queryClient.invalidateQueries({ queryKey: ["cloud9", "scheduled"] })
      } else {
        toast({ title: "Dashboard not connected", description: `Run: ${body.cliCommand}` })
      }
      setForm({ name: "", schedule: "", prompt: "" })
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, status: "error" }),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Scheduled jobs</h1>

      <StatusBlock isLoading={isLoading} error={error?.message} isEmpty={data?.jobs.length === 0}>
        <div className="space-y-3">
          {data?.jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{job.name}</CardTitle>
                <Badge variant={job.last_status === "ok" ? "default" : "destructive"}>
                  {job.last_status ?? job.state}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{job.schedule_display}</p>
                <p className="text-muted-foreground">Next run: {job.next_run_at ?? "—"}</p>
                <p className="text-muted-foreground">Last run: {job.last_run_at ?? "—"}</p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionMutation.isPending}
                    onClick={() => actionMutation.mutate({ id: job.id, action: job.enabled ? "pause" : "resume" })}
                  >
                    {job.enabled ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionMutation.isPending}
                    onClick={() => actionMutation.mutate({ id: job.id, action: "run" })}
                  >
                    Run now
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </StatusBlock>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            placeholder="Schedule (e.g. every 15m, or a cron expression)"
            value={form.schedule}
            onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
          />
          <Input
            placeholder="Prompt"
            value={form.prompt}
            onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
          />
          <Button
            disabled={!form.name || !form.schedule || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
