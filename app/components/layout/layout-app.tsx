"use client"

import { Header } from "@/app/components/layout/header"
import { IncognitoProvider } from "@/app/components/layout/incognito-provider"
import { AppSidebar } from "@/app/components/layout/sidebar/app-sidebar"
import { WorkspacePane } from "@/app/components/workspace/workspace-pane"
import { WorkspaceProvider } from "@/app/components/workspace/workspace-provider"

export function LayoutApp({ children }: { children: React.ReactNode }) {
  const hasSidebar = true

  return (
    <IncognitoProvider>
      <WorkspaceProvider>
        <div className="bg-background flex h-dvh w-full overflow-hidden">
          {hasSidebar && <AppSidebar />}
          <main className="@container relative h-dvh w-0 flex-shrink flex-grow overflow-y-auto">
            <Header hasSidebar={hasSidebar} />
            {children}
          </main>
          <WorkspacePane />
        </div>
      </WorkspaceProvider>
    </IncognitoProvider>
  )
}
