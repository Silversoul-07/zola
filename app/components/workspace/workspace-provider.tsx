"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

const MAX_TABS = 6

export type WorkspaceTab = { path: string; line?: number }

type WorkspaceContextType = {
  isOpen: boolean
  tabs: WorkspaceTab[]
  activePath: string | null
  openFile: (path: string, opts?: { line?: number }) => void
  close: () => void
  setActivePath: (path: string) => void
  closeTab: (path: string) => void
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

// Right-pane file viewer state lives above the chat/layout split so both the
// file-tool diff rows (open) and the workspace pane (render) can reach it.
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const openFile = (path: string, opts?: { line?: number }) => {
    setTabs((prev) => {
      // Move-to-end on reopen doubles as LRU touch; slice from the front evicts oldest past MAX_TABS.
      const next = [...prev.filter((t) => t.path !== path), { path, line: opts?.line }]
      return next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next
    })
    setActivePath(path)
    setIsOpen(true)
  }

  const closeTab = (path: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.path !== path)
      setActivePath((current) =>
        current === path ? (next.length ? next[next.length - 1].path : null) : current
      )
      return next
    })
  }

  return (
    <WorkspaceContext.Provider
      value={{
        isOpen,
        tabs,
        activePath,
        openFile,
        close: () => setIsOpen(false),
        setActivePath,
        closeTab,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider")
  }
  return context
}
