"use client"

import { SettingsTrigger } from "@/app/components/layout/settings/settings-trigger"
import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useChats } from "@/lib/chat-store/chats/provider"
import { APP_NAME } from "@/lib/config"
import { fetchClient } from "@/lib/fetch"
import { useUser } from "@/lib/user-store/provider"
import { cn } from "@/lib/utils"
import {
  CaretDownIcon,
  ChatTeardropText,
  DotsThreeIcon,
  GearSixIcon,
  SidebarSimpleIcon,
  SignOut,
  X,
} from "@phosphor-icons/react"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { HistoryTrigger } from "../../history/history-trigger"
import { NavMain, sidebarRowTriggerClassName } from "./nav-main"
import { SidebarItem } from "./sidebar-item"

const iconButtonClassName =
  "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex size-8 items-center justify-center rounded-full bg-transparent transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"

const RECENT_CHATS_LIMIT = 12

async function signOut() {
  await fetchClient("/api/auth/logout", { method: "POST" })
  window.location.assign("/auth")
}

export function AppSidebar() {
  const isMobile = useBreakpoint(768)
  const { setOpenMobile, toggleSidebar } = useSidebar()
  const { chats, pinnedChats, isLoading } = useChats()
  const { user } = useUser()
  const params = useParams<{ chatId: string }>()
  const currentChatId = params.chatId

  const unpinnedChats = useMemo(
    () => chats.filter((chat) => !chat.pinned),
    [chats]
  )
  const recentChats = unpinnedChats.slice(0, RECENT_CHATS_LIMIT)
  const hasMoreChats = unpinnedChats.length > RECENT_CHATS_LIMIT
  const hasChats = chats.length > 0

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className="border-border/40 border-r bg-transparent"
    >
      <SidebarHeader className="h-14 pl-3">
        <div className="flex h-full items-center justify-between pr-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-primary hover:bg-muted flex min-w-0 items-center gap-1 rounded-md p-1 text-sm font-semibold transition-colors group-data-[collapsible=icon]:hidden"
              >
                <span className="truncate">{APP_NAME}</span>
                <CaretDownIcon
                  size={14}
                  className="text-muted-foreground shrink-0"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <SettingsTrigger />
              <DropdownMenuItem onClick={signOut}>
                <SignOut className="size-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="flex h-full px-3 [&>div>div]:!block">
          <NavMain />
          {isLoading ? (
            <div className="h-full" />
          ) : hasChats ? (
            <div className="space-y-3 group-data-[collapsible=icon]:hidden">
              {pinnedChats.length > 0 && (
                <SidebarGroup className="p-0">
                  <SidebarGroupLabel>Pinned</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {pinnedChats.map((chat) => (
                        <SidebarItem
                          key={chat.id}
                          chat={chat}
                          currentChatId={currentChatId}
                        />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
              <SidebarGroup className="p-0">
                <SidebarGroupLabel>Chats</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {recentChats.map((chat) => (
                      <SidebarItem
                        key={chat.id}
                        chat={chat}
                        currentChatId={currentChatId}
                      />
                    ))}
                    {hasMoreChats && (
                      <SidebarMenuItem>
                        <HistoryTrigger
                          hasSidebar={false}
                          classNameTrigger={sidebarRowTriggerClassName}
                          icon={<DotsThreeIcon size={16} weight="bold" />}
                          label={<span>More</span>}
                          hasPopover={false}
                        />
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
          ) : (
            <div className="flex h-[calc(100vh-160px)] flex-col items-center justify-center group-data-[collapsible=icon]:hidden">
              <ChatTeardropText
                size={24}
                className="text-muted-foreground mb-1 opacity-40"
              />
              <div className="text-muted-foreground text-center">
                <p className="mb-1 text-sm font-medium">No chats yet</p>
                <p className="text-13 opacity-70">Start a new conversation</p>
              </div>
            </div>
          )}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="mb-2 flex-row items-center justify-between p-3">
        <SettingsTrigger
          trigger={
            <button
              type="button"
              className="flex min-w-0 items-center gap-2 rounded-lg text-left"
            >
              <Avatar className="size-6 shrink-0">
                <AvatarImage src={user?.profile_image ?? undefined} />
                <AvatarFallback>{user?.display_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-foreground truncate text-sm font-medium group-data-[collapsible=icon]:hidden">
                {user?.display_name}
              </span>
            </button>
          }
        />
        <SettingsTrigger
          trigger={
            <button
              type="button"
              aria-label="Settings"
              className={cn(
                iconButtonClassName,
                "group-data-[collapsible=icon]:hidden"
              )}
            >
              <GearSixIcon size={20} />
            </button>
          }
        />
      </SidebarFooter>
    </Sidebar>
  )
}
