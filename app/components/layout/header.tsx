"use client"

import { AgentPicker } from "@/app/components/layout/agent-picker"
import { ButtonIncognito } from "@/app/components/layout/button-incognito"
import { HeaderSidebarTrigger } from "@/app/components/layout/header-sidebar-trigger"
import { useIncognito } from "@/app/components/layout/incognito-provider"
import { useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

export function Header({ hasSidebar }: { hasSidebar: boolean }) {
  const { open } = useSidebar()
  const { incognito, setIncognito } = useIncognito()
  const isHome = usePathname() === "/"

  return (
    <header className="h-app-header pointer-events-none fixed top-0 right-0 left-0 z-50">
      <div className="relative mx-auto flex h-full items-center justify-between bg-transparent pl-2 pr-4 sm:pr-6 lg:bg-transparent lg:pr-8">
        <div
          className={cn(
            "pointer-events-auto flex items-center gap-2 transition-[margin]",
            // keep the left group clear of the open desktop sidebar
            hasSidebar && open && "md:ml-[var(--sidebar-width)]"
          )}
        >
          <HeaderSidebarTrigger
            className={cn(hasSidebar && open && "md:hidden")}
          />
          {isHome && <AgentPicker />}
        </div>
        {isHome && (
          <div className="pointer-events-auto flex items-center">
            <ButtonIncognito isSelected={incognito} onToggle={setIncognito} />
          </div>
        )}
      </div>
    </header>
  )
}
