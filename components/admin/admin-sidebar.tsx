"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { usePlatformSettings } from "@/hooks/use-platform-settings"
import {
  LayoutDashboard,
  Users,
  Trophy,
  Target,
  BarChart3,
  Settings,
  FileText,
  Shield,
  LogOut,
  User,
  CheckSquare,
  Gift,
  Award,
} from "lucide-react"

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "User Management",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Team Management",
    href: "/admin/teams",
    icon: Trophy,
  },
  {
    title: "Challenge Management",
    href: "/admin/challenges",
    icon: Target,
  },
  {
    title: "Action Reviews",
    href: "/admin/action-reviews",
    icon: CheckSquare,
  },
  {
    title: "Reward Management",
    href: "/admin/rewards",
    icon: Gift,
  },
  {
    title: "Badge Management",
    href: "/admin/badges",
    icon: Award,
  },
  {
    title: "Analytics & Reports",
    href: "/admin/analytics",
    icon: BarChart3,
  },
  {
    title: "Content Management",
    href: "/admin/content",
    icon: FileText,
  },
  {
    title: "System Settings",
    href: "/admin/settings",
    icon: Settings,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { toast } = useToast()
  const supabase = createClient()

  const { platform_name } = usePlatformSettings()

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      window.location.href = "/auth/login"
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border relative">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-sidebar-foreground">{platform_name}</h2>
            <p className="text-xs text-muted-foreground">Admin Panel</p>
          </div>
        </div>

        <nav className="space-y-2 pb-20">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3",
                    isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Button>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border bg-sidebar space-y-2">
        <Link href="/dashboard">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 text-primary border-primary/20 hover:bg-primary hover:text-primary-foreground bg-transparent"
          >
            <User className="h-4 w-4" />
            User Dashboard
          </Button>
        </Link>

        <Button
          variant="outline"
          className="w-full justify-start gap-3 text-destructive border-destructive/20 hover:bg-destructive hover:text-destructive-foreground bg-transparent"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
