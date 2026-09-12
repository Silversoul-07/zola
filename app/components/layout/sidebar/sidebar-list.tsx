import { SidebarMenu } from "@/components/ui/sidebar"
import { Chat } from "@/lib/chat-store/types"
import { SidebarItem } from "./sidebar-item"

type SidebarListProps = {
  title: string
  items: Chat[]
  currentChatId: string
}

export function SidebarList({ title, items, currentChatId }: SidebarListProps) {
  return (
    <div>
      <h3 className="text-sidebar-foreground/70 px-2 pt-1 pb-1 text-xs font-medium">
        {title}
      </h3>
      <SidebarMenu>
        {items.map((chat) => (
          <SidebarItem
            key={chat.id}
            chat={chat}
            currentChatId={currentChatId}
          />
        ))}
      </SidebarMenu>
    </div>
  )
}
