"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { NatureBackground } from "@/components/ui/nature-background"

interface AppLayoutProps {
  user?: {
    id: string
    email: string
    first_name: string
    last_name: string
    avatar_url?: string
    points: number
    level: number
    is_admin?: boolean
  }
  children: React.ReactNode
  showBackground?: boolean
}

export function AppLayout({ user, children, showBackground = true }: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar user={user} />
      <SidebarInset className="flex flex-col min-h-screen">
        <AppHeader user={user} />
        <main className="flex-1 relative">
          {showBackground && <NatureBackground className="fixed inset-0 z-0 pointer-events-none" />}
          <div className="relative z-10 p-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
