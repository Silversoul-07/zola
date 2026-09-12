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
  NotePencilIcon,
  PlugsConnectedIcon,
  RobotIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_ITEMS = [
  { href: "/", label: "New chat", icon: NotePencilIcon },
  { href: "/agents", label: "Agents", icon: RobotIcon },
  { href: "/skills", label: "Skills", icon: ChatsCircleIcon },
  { href: "/connectors", label: "Connectors", icon: PlugsConnectedIcon },
  { href: "/scheduled", label: "Scheduled", icon: ClockCounterClockwiseIcon },
  // brainstorm: Projects hidden for now, see app/(cloud9)/projects/page.tsx
  // { href: "/projects", label: "Projects", icon: SquaresFourIcon },
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
              className="relative h-9 rounded-lg text-sm data-[active=true]:bg-transparent data-[active=true]:before:absolute data-[active=true]:before:inset-y-1 data-[active=true]:before:left-0 data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-full data-[active=true]:before:bg-sky-500"
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
