"use client"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  ChatsCircleIcon,
  ClockCounterClockwiseIcon,
  MagnifyingGlass,
  NotePencilIcon,
  PlugsConnectedIcon,
} from "@phosphor-icons/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HistoryTrigger } from "../../history/history-trigger"

const NAV_ITEMS = [
  { href: "/skills", label: "Skills", icon: ChatsCircleIcon },
  { href: "/connectors", label: "Connectors", icon: PlugsConnectedIcon },
  { href: "/scheduled", label: "Scheduled", icon: ClockCounterClockwiseIcon },
]

// Mirrors sidebarMenuButtonVariants({ size: "default" }) since HistoryTrigger
// renders its own <button> and can't be wrapped with SidebarMenuButton asChild.
export const sidebarRowTriggerClassName =
  "peer/menu-button bg-transparent text-sidebar-foreground flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>svg]:size-4 [&>svg]:shrink-0"

export function NavMain() {
  const pathname = usePathname()

  return (
    <SidebarMenu className="mb-3 gap-0.5">
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={pathname === "/"}
          tooltip="New chat"
        >
          <Link href="/" prefetch>
            <NotePencilIcon size={16} />
            <span>New chat</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <HistoryTrigger
          hasSidebar={false}
          classNameTrigger={sidebarRowTriggerClassName}
          icon={<MagnifyingGlass size={16} />}
          label={<span>Search</span>}
          hasPopover={false}
        />
      </SidebarMenuItem>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname?.startsWith(item.href)
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
              <Link href={item.href} prefetch>
                <item.icon size={16} />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
