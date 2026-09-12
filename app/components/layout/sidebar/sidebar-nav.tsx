"use client"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  ChartLineIcon,
  ChatsCircleIcon,
  ClockCounterClockwiseIcon,
  KanbanIcon,
  NotePencilIcon,
  PlugsConnectedIcon,
  RobotIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_ITEMS = [
  { href: "/", label: "New chat", icon: NotePencilIcon },
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
    <SidebarMenu className="mb-3 gap-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname?.startsWith(item.href)
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={item.label}
              className="h-10 text-sm"
            >
              <Link href={item.href} prefetch>
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
