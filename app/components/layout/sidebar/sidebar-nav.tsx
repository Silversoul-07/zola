"use client"

import { cn } from "@/lib/utils"
import {
  ChartLineIcon,
  ChatsCircleIcon,
  ClockCounterClockwiseIcon,
  KanbanIcon,
  PlugsConnectedIcon,
  RobotIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_ITEMS = [
  { href: "/agents", label: "Agents", icon: RobotIcon },
  { href: "/skills", label: "Skills", icon: ChatsCircleIcon },
  { href: "/connectors", label: "Connectors", icon: PlugsConnectedIcon },
  { href: "/scheduled", label: "Scheduled", icon: ClockCounterClockwiseIcon },
  { href: "/projects", label: "Projects", icon: SquaresFourIcon },
  { href: "/board", label: "Board", icon: KanbanIcon },
  { href: "/observe", label: "Observe", icon: ChartLineIcon },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="mb-5 space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname?.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "text-primary hover:bg-accent/80 hover:text-foreground flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
              isActive && "bg-accent text-foreground"
            )}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
