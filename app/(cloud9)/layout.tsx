import { LayoutApp } from "@/app/components/layout/layout-app"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"

// Wraps every cloud9 page (/agents, /skills, /connectors, /scheduled, /projects, /board,
// /observe, /settings) in the same app shell the rest of Zola uses, so sidebar/header render
// consistently without each page importing LayoutApp itself. MessagesProvider is required by
// the sidebar's chat item menu (delete/reset), same as app/p/[projectId]/page.tsx.
export default function Cloud9Layout({ children }: { children: React.ReactNode }) {
  return (
    <MessagesProvider>
      <LayoutApp>
        <div className="mx-auto w-full max-w-[960px] px-6 py-8">{children}</div>
      </LayoutApp>
    </MessagesProvider>
  )
}
