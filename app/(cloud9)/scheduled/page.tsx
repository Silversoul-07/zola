"use client"

import { PageHeader } from "@/app/(cloud9)/_components/page-header"
import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { StatusDot } from "@/app/(cloud9)/_components/status-dot"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { ArrowClockwise, Pause, Play } from "@phosphor-icons/react"
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

// date-fns isn't installed in this app; Intl.RelativeTimeFormat covers "in 12 min" fine.
function relativeTime(iso: string | null) {
  if (!iso) return "—"
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute")
  const diffHr = Math.round(diffMin / 60)
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour")
  return rtf.format(Math.round(diffHr / 24), "day")
}

export default function ScheduledPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
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
      setOpen(false)
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, status: "error" }),
  })

  return (
    <div>
      <PageHeader
        title="Scheduled"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-sky-500 text-white hover:bg-sky-600">New job</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New job</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
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
              </div>
              <DialogFooter>
                <Button
                  className="bg-sky-500 text-white hover:bg-sky-600"
                  disabled={!form.name || !form.schedule || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <StatusBlock
        isLoading={isLoading}
        error={error?.message}
        isEmpty={data?.jobs.length === 0}
        emptyLabel="No scheduled jobs yet. Create one to run a prompt on a recurring schedule."
      >
        <div className="divide-y divide-border rounded-xl border border-border">
          {data?.jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <StatusDot status={job.last_status === "ok" ? "ok" : job.last_status ? "error" : "muted"} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{job.name}</p>
                  <p className="text-muted-foreground truncate text-[13px]">
                    {job.schedule_display} · next {relativeTime(job.next_run_at)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        actionMutation.mutate({ id: job.id, action: job.enabled ? "pause" : "resume" })
                      }
                    >
                      {job.enabled ? <Pause /> : <Play />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{job.enabled ? "Pause" : "Resume"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={actionMutation.isPending}
                      onClick={() => actionMutation.mutate({ id: job.id, action: "run" })}
                    >
                      <ArrowClockwise />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Run now</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      </StatusBlock>
    </div>
  )
}
