"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Target,
  Users,
  Trophy,
  Award,
  BarChart3,
  Settings,
  LogOut,
  User,
  Shield,
  Megaphone,
  GraduationCap,
  Gift,
  Leaf,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePlatformSettings } from "@/hooks/use-platform-settings"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"


interface AppSidebarProps {
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
}

const mainNavItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Actions",
    href: "/actions",
    icon: Target,
  },
  {
    title: "Challenges",
    href: "/challenges",
    icon: Trophy,
  },
  {
    title: "Teams",
    href: "/teams",
    icon: Users,
  },
]

const engagementItems = [
  {
    title: "Rewards",
    href: "/rewards",
    icon: Gift,
  },
  {
    title: "Badges",
    href: "/badges",
    icon: Award,
  },
  {
    title: "Leaderboard",
    href: "/leaderboard",
    icon: BarChart3,
  },
]

const resourceItems = [
  {
    title: "Announcements",
    href: "/announcements",
    icon: Megaphone,
  },
  {
    title: "Education",
    href: "/education",
    icon: GraduationCap,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
]

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const { state } = useSidebar()
  const { platform_name } = usePlatformSettings()

  const displayName = user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : "User"
  const userInitials = user ? `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}` : "U"
  const userPoints = user?.points || 0
  const userLevel = user?.level || 1

  const handleSignOut = async () => {
    const form = document.createElement("form")
    form.method = "POST"
    form.action = "/auth/logout"
    document.body.appendChild(form)
    form.submit()
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Header with Logo */}
      <SidebarHeader className="h-16 border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="hover:bg-transparent active:bg-transparent"
            >
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Leaf className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold text-sm">{platform_name}</span>
                  <span className="text-xs text-muted-foreground">Sustainability</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                    className={cn(
                      "transition-all duration-200",
                      isActive(item.href) && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Engagement */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Engagement
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {engagementItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                    className={cn(
                      "transition-all duration-200",
                      isActive(item.href) && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Resources */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            Resources
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {resourceItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.title}
                    className={cn(
                      "transition-all duration-200",
                      isActive(item.href) && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin Section */}
        {user?.is_admin && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-orange-500/70 uppercase tracking-wider">
                Administration
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith("/admin")}
                      tooltip="Admin Panel"
                      className={cn(
                        "transition-all duration-200 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-900/20",
                        pathname.startsWith("/admin") && "bg-orange-50 dark:bg-orange-900/20 font-medium"
                      )}
                    >
                      <Link href="/admin">
                        <Shield className="size-4" />
                        <span>Admin Panel</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* Footer with User Info + Quick Actions */}
      <SidebarFooter className="border-t border-sidebar-border pb-2">
        {/* User identity row */}
        <div className="px-2 pt-3 pb-1 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2.5 px-1">
            <Avatar className="size-8 shrink-0 border border-sidebar-border">
              <AvatarImage src={user?.avatar_url} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5 leading-none min-w-0">
              <span className="font-medium text-sm truncate">{displayName}</span>
              <span className="text-xs text-muted-foreground">
                {userPoints} pts · Level {userLevel}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/profile"}
              tooltip="Profile"
              className={cn(
                "transition-all duration-200",
                pathname === "/profile" && "bg-primary/10 text-primary font-medium"
              )}
            >
              <Link href="/profile">
                <User className="size-4" />
                <span>Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/settings"}
              tooltip="Settings"
              className={cn(
                "transition-all duration-200",
                pathname === "/settings" && "bg-primary/10 text-primary font-medium"
              )}
            >
              <Link href="/settings">
                <Settings className="size-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={handleSignOut}
              className="transition-all duration-200 text-destructive hover:text-destructive hover:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="size-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
