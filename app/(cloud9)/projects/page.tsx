"use client"

import { StatusBlock } from "@/app/(cloud9)/_components/status-block"
import { DialogCreateProject } from "@/app/components/layout/sidebar/dialog-create-project"
import { DialogDeleteProject } from "@/app/components/layout/sidebar/dialog-delete-project"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          A project is a chat grouper with its own system prompt and pinned context that every
          chat in it inherits.
        </p>
      </div>

      <Button onClick={() => setIsCreateOpen(true)}>New project</Button>

      <StatusBlock isLoading={isLoading} error={error?.message} isEmpty={projects?.length === 0}>
        <div className="grid gap-3 sm:grid-cols-2">
          {projects?.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                {renaming?.id === project.id ? (
                  <div className="flex gap-2">
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
                  <CardTitle>{project.name}</CardTitle>
                )}
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{chatCount(project.id)} chats</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRenaming({ id: project.id, name: project.name })}
                  >
                    Rename
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(project)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
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
