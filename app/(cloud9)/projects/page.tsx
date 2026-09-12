"use client"

import { PageHeader } from "@/app/(cloud9)/_components/page-header"
import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { DialogCreateProject } from "@/app/components/layout/sidebar/dialog-create-project"
import { DialogDeleteProject } from "@/app/components/layout/sidebar/dialog-delete-project"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchClient } from "@/lib/fetch"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

type Project = { id: string; name: string; user_id: string; created_at: string }

export default function ProjectsPage() {
  const queryClient = useQueryClient()
  const { chats } = useChats()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)

  const { data: projects, isLoading, error } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error("Failed to load projects")
      return res.json()
    },
  })

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetchClient(`/api/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error("Failed to rename project")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      setRenaming(null)
    },
  })

  const chatCount = (projectId: string) => chats.filter((c) => c.project_id === projectId).length

  return (
    <div>
      <PageHeader
        title="Projects"
        action={
          <Button className="bg-sky-500 text-white hover:bg-sky-600" onClick={() => setIsCreateOpen(true)}>
            New project
          </Button>
        }
      />
      <p className="text-muted-foreground -mt-4 mb-6 text-sm">
        A project is a chat grouper with its own system prompt and pinned context that every chat
        in it inherits.
      </p>

      <StatusBlock
        isLoading={isLoading}
        error={error?.message}
        isEmpty={projects?.length === 0}
        emptyLabel="No projects yet. Create one to group related chats."
      >
        <div className="divide-y divide-border rounded-xl border border-border">
          {projects?.map((project) => (
            <div key={project.id} className="flex items-center justify-between gap-4 px-4 py-3">
              {renaming?.id === project.id ? (
                <div className="flex flex-1 gap-2">
                  <Input
                    autoFocus
                    value={renaming.name}
                    onChange={(e) => setRenaming({ id: project.id, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameMutation.mutate(renaming)
                      if (e.key === "Escape") setRenaming(null)
                    }}
                  />
                  <Button size="sm" onClick={() => renameMutation.mutate(renaming)}>
                    Save
                  </Button>
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="text-sm font-medium">{project.name}</p>
                  <p className="text-muted-foreground text-[13px]">{chatCount(project.id)} chats</p>
                </div>
              )}
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRenaming({ id: project.id, name: project.name })}
                >
                  Rename
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDeleteTarget(project)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </StatusBlock>

      <DialogCreateProject isOpen={isCreateOpen} setIsOpen={setIsCreateOpen} />
      {deleteTarget && (
        <DialogDeleteProject
          isOpen={!!deleteTarget}
          setIsOpen={(open) => !open && setDeleteTarget(null)}
          project={deleteTarget}
        />
      )}
    </div>
  )
}
