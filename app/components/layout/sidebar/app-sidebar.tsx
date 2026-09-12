"use client"

import { groupChatsByDate } from "@/app/components/history/utils"
import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"
import { useChats } from "@/lib/chat-store/chats/provider"
import { APP_NAME } from "@/lib/config"
import { useUser } from "@/lib/user-store/provider"
import { cn } from "@/lib/utils"
import {
  ChatTeardropText,
  GearSixIcon,
  MagnifyingGlass,
  SidebarSimpleIcon,
  X,
} from "@phosphor-icons/react"
import { Pin } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { HistoryTrigger } from "../../history/history-trigger"
import { UserMenu } from "../user-menu"
import { SidebarList } from "./sidebar-list"
import { SidebarNav } from "./sidebar-nav"

const iconButtonClassName =
  "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 items-center justify-center rounded-full bg-transparent transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"

export function AppSidebar() {
  const isMobile = useBreakpoint(768)
  const { setOpenMobile, toggleSidebar } = useSidebar()
  const { chats, pinnedChats, isLoading } = useChats()
  const { user } = useUser()
  const params = useParams<{ chatId: string }>()
  const currentChatId = params.chatId

  const groupedChats = useMemo(() => {
    const result = groupChatsByDate(chats, "")
    return result
  }, [chats])
  const hasChats = chats.length > 0

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className="border-border/40 border-r bg-transparent"
    >
      <SidebarHeader className="h-14 pl-3">
        <div className="flex h-full items-center justify-between pr-2">
          <span className="text-primary truncate text-base font-semibold group-data-[collapsible=icon]:hidden">
            {APP_NAME}
          </span>
          <div className="flex items-center gap-1">
            <HistoryTrigger
              hasSidebar={false}
              classNameTrigger={cn(
                iconButtonClassName,
                "group-data-[collapsible=icon]:hidden"
              )}
              icon={<MagnifyingGlass size={18} />}
              hasPopover={false}
            />
            {isMobile ? (
              <button
                type="button"
                onClick={() => setOpenMobile(false)}
                aria-label="Close sidebar"
                className={iconButtonClassName}
              >
                <X size={20} />
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
                className={iconButtonClassName}
              >
                <SidebarSimpleIcon size={20} />
              </button>
            )}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="border-border/40 border-t">
        <ScrollArea className="flex h-full px-3 [&>div>div]:!block">
          <SidebarNav />
          {isLoading ? (
            <div className="h-full" />
          ) : hasChats ? (
            <div className="space-y-5 group-data-[collapsible=icon]:hidden">
              {pinnedChats.length > 0 && (
                <div className="space-y-5">
                  <SidebarList
                    key="pinned"
                    title="Pinned"
                    icon={<Pin className="size-3" />}
                    items={pinnedChats}
                    currentChatId={currentChatId}
                  />
                </div>
              )}
              {groupedChats?.map((group) => (
                <SidebarList
                  key={group.name}
                  title={group.name}
                  items={group.chats}
                  currentChatId={currentChatId}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-[calc(100vh-160px)] flex-col items-center justify-center group-data-[collapsible=icon]:hidden">
              <ChatTeardropText
                size={24}
                className="text-muted-foreground mb-1 opacity-40"
              />
              <div className="text-muted-foreground text-center">
                <p className="mb-1 text-base font-medium">No chats yet</p>
                <p className="text-sm opacity-70">Start a new conversation</p>
              </div>
            </div>
          )}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="border-border/40 mb-2 flex-row items-center justify-between border-t p-3">
        <div className="flex min-w-0 items-center gap-2">
          <UserMenu />
          <span className="text-primary truncate text-sm font-medium group-data-[collapsible=icon]:hidden">
            {user?.display_name}
          </span>
        </div>
        <Link
          href="/settings"
          aria-label="Settings"
          className={cn(
            iconButtonClassName,
            "group-data-[collapsible=icon]:hidden"
          )}
        >
          <GearSixIcon size={20} />
        </Link>
      </SidebarFooter>
    </Sidebar>
  )
}
