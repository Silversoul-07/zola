"use client"

import { AgentPicker } from "@/app/components/layout/agent-picker"
import { ButtonIncognito } from "@/app/components/layout/button-incognito"
import { HeaderSidebarTrigger } from "@/app/components/layout/header-sidebar-trigger"
import { useIncognito } from "@/app/components/layout/incognito-provider"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

export function Header({ hasSidebar }: { hasSidebar: boolean }) {
  const { open } = useSidebar()
  const { incognito, setIncognito } = useIncognito()

  return (
    <header className="h-app-header pointer-events-none fixed top-0 right-0 left-0 z-50">
      <div className="relative mx-auto flex h-full items-center justify-between bg-transparent px-4 sm:px-6 lg:bg-transparent lg:px-8">
        <div className="pointer-events-auto flex items-center gap-2">
          <HeaderSidebarTrigger
            className={cn(hasSidebar && open && "md:hidden")}
          />
          <AgentPicker />
        </div>
        <div className="pointer-events-auto flex items-center">
          <ButtonIncognito isSelected={incognito} onToggle={setIncognito} />
        </div>
      </div>
    </header>
  )
}
