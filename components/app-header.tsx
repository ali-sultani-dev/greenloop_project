"use client"

import Link from "next/link"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { NotificationBell } from "@/components/notification-bell"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Settings, LogOut } from "lucide-react"
import { usePathname } from "next/navigation"
import { useMemo } from "react"

interface AppHeaderProps {
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

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  actions: "Actions",
  challenges: "Challenges",
  teams: "Teams",
  rewards: "Rewards",
  badges: "Badges",
  leaderboard: "Leaderboard",
  announcements: "Announcements",
  education: "Education",
  analytics: "Analytics",
  profile: "Profile",
  settings: "Settings",
  admin: "Admin",
  notifications: "Notifications",
  create: "Create",
  log: "Log Action",
  members: "Members",
  users: "Users",
  content: "Content",
  "action-reviews": "Action Reviews",
}

export function AppHeader({ user }: AppHeaderProps) {
  const pathname = usePathname()

  const displayName = user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : "User"
  const userInitials = user ? `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}` : "U"

  const handleSignOut = async () => {
    const form = document.createElement("form")
    form.method = "POST"
    form.action = "/auth/logout"
    document.body.appendChild(form)
    form.submit()
  }

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean)
    const crumbs: { label: string; href: string; isLast: boolean }[] = []

    let currentPath = ""
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`
      const isLast = index === segments.length - 1
      
      // Skip UUID-like segments for display but keep them in path
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
      
      if (!isUuid) {
        crumbs.push({
          label: routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
          href: currentPath,
          isLast,
        })
      }
    })

    return crumbs
  }, [pathname])

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
      </div>

      <Breadcrumb className="flex-1">
        <BreadcrumbList>
          {breadcrumbs.map((crumb, index) => (
            <BreadcrumbItem key={crumb.href}>
              {index > 0 && <BreadcrumbSeparator />}
              {crumb.isLast ? (
                <BreadcrumbPage className="font-medium">{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
                  {crumb.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3">
        {/* Points Display */}
        <div className="hidden sm:flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-primary">{user?.points || 0}</span>
          <span className="text-muted-foreground">pts</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground">Lv {user?.level || 1}</span>
        </div>

        <Separator orientation="vertical" className="h-4 hidden sm:block" />

        {/* Notifications */}
        <NotificationBell />

        <Separator orientation="vertical" className="h-4" />

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-7 border border-border">
                <AvatarImage src={user?.avatar_url} alt={displayName} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-sm font-medium leading-none">{displayName}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            <div className="px-3 py-2 border-b">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer">
                <User className="size-4 mr-2" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="size-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="size-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
