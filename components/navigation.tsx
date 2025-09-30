"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePlatformSettings } from "@/hooks/use-platform-settings"
import {
  Leaf,
  Home,
  Target,
  Users,
  Award,
  BarChart3,
  Settings,
  Menu,
  LogOut,
  User,
  Trophy,
  Shield,
  Megaphone,
  GraduationCap,
  Gift,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { NotificationBell } from "@/components/notification-bell"

interface NavigationProps {
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

const navigationItems = [
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
    title: "Teams",
    href: "/teams",
    icon: Users,
  },
  {
    title: "Challenges",
    href: "/challenges",
    icon: Trophy,
  },
  {
    title: "Rewards",
    href: "/rewards",
    icon: Gift,
  },
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
  {
    title: "Profile",
    href: "/profile",
    icon: User,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

export function Navigation({ user }: NavigationProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number
    bottom?: number
    left?: number
    right?: number
  }>({})
  const avatarDropdownRef = useRef<HTMLDivElement>(null)

  const { platform_name } = usePlatformSettings()

  console.log("Navigation user data:", user)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (avatarDropdownRef.current && !avatarDropdownRef.current.contains(event.target as Node)) {
        setIsAvatarDropdownOpen(false)
      }
    }

    if (isAvatarDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isAvatarDropdownOpen])

  const toggleAvatarDropdown = (event: React.MouseEvent) => {
    console.log("Avatar clicked - toggling dropdown")

    if (isAvatarDropdownOpen) {
      setIsAvatarDropdownOpen(false)
      return
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const dropdownWidth = 224 // w-56 = 14rem = 224px
    const dropdownHeight = 280 // approximate height of dropdown

    const position: { top?: number; bottom?: number; left?: number; right?: number } = {}

    if (rect.right - dropdownWidth < 0) {
      position.left = rect.left
    } else {
      position.right = viewportWidth - rect.right
    }

    if (rect.bottom + dropdownHeight > viewportHeight) {
      position.bottom = viewportHeight - rect.top
    } else {
      position.top = rect.bottom + 8
    }

    setDropdownPosition(position)
    setIsAvatarDropdownOpen(true)
  }

  const handleDropdownItemClick = (action: () => void) => {
    action()
    setIsAvatarDropdownOpen(false)
  }

  const getNavigationItems = () => {
    const items = [...navigationItems]
    if (user?.is_admin) {
      items.push({
        title: "Admin",
        href: "/admin",
        icon: Shield,
      })
    }
    return items
  }

  const handleSignOut = async () => {
    const form = document.createElement("form")
    form.method = "POST"
    form.action = "/auth/logout"
    document.body.appendChild(form)
    form.submit()
  }

  const displayName = user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : "User"
  const userInitials = user ? `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}` : "U"
  const userPoints = user?.points || 0
  const userLevel = user?.level || 1
  const userEmail = user?.email || ""

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 flex-shrink-0 mr-6 group transition-all duration-300 hover:scale-105"
        >
          <div className="p-1.5 bg-primary rounded-lg transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary/25 group-hover:bg-primary/90">
            <Leaf className="h-5 w-5 text-primary-foreground transition-transform duration-300 group-hover:rotate-12" />
          </div>
          <span className="font-bold text-lg transition-colors duration-300 group-hover:text-primary">
            {platform_name}
          </span>
        </Link>

        <nav className="hidden lg:flex items-center flex-1">
          <div className="flex items-center justify-evenly w-full">
            {getNavigationItems().map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md whitespace-nowrap group relative overflow-hidden",
                  "transition-all duration-300 ease-out",
                  "hover:scale-105 hover:shadow-md hover:shadow-primary/10",
                  "before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/10 before:to-primary/5",
                  "before:translate-x-[-100%] before:transition-transform before:duration-300",
                  "hover:before:translate-x-0",
                  pathname === item.href
                    ? "text-foreground bg-accent shadow-sm"
                    : "text-foreground/60 hover:text-foreground hover:bg-accent/50",
                  item.href === "/admin" &&
                    "text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20",
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0 relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3" />
                <span className="text-sm font-medium relative z-10 transition-all duration-300">{item.title}</span>

                <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </div>
        </nav>

        <div className="flex items-center gap-3 flex-shrink-0 ml-6">
          <div className="hidden sm:flex items-center gap-2 text-sm group transition-all duration-300 hover:scale-105">
            <div className="text-right transition-all duration-300 group-hover:text-primary">
              <div className="font-medium">{userPoints} pts</div>
              <div className="text-xs text-muted-foreground group-hover:text-primary/70">Level {userLevel}</div>
            </div>
          </div>

          <NotificationBell />

          <div className="relative" ref={avatarDropdownRef}>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-300 hover:scale-110 hover:ring-2 hover:ring-primary/20 hover:bg-accent"
              onClick={toggleAvatarDropdown}
            >
              <Avatar className="h-10 w-10 border-2 border-border transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
                <AvatarImage
                  src={user?.avatar_url || "/placeholder.svg?height=40&width=40&query=user avatar"}
                  alt={displayName}
                />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold transition-all duration-300 hover:bg-primary/90">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>

            {isAvatarDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsAvatarDropdownOpen(false)} />

                <div
                  className="fixed w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 animate-in fade-in-0 zoom-in-95 duration-200"
                  style={{
                    top: dropdownPosition.top,
                    bottom: dropdownPosition.bottom,
                    left: dropdownPosition.left,
                    right: dropdownPosition.right,
                  }}
                >
                  <div className="py-1">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none text-gray-900 dark:text-gray-100">
                          {displayName}
                        </p>
                        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400 break-all">
                          {userEmail}
                        </p>
                        <p className="text-xs leading-none text-gray-500 dark:text-gray-400">
                          {userPoints} pts • Level {userLevel}
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/profile"
                      onClick={() => handleDropdownItemClick(() => {})}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:translate-x-1"
                    >
                      <User className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                      Profile
                    </Link>

                    <Link
                      href="/settings"
                      onClick={() => handleDropdownItemClick(() => {})}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:translate-x-1"
                    >
                      <Settings className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
                      Settings
                    </Link>

                    {user?.is_admin && (
                      <>
                        <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                        <Link
                          href="/admin"
                          onClick={() => handleDropdownItemClick(() => {})}
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-orange-600 dark:text-orange-400 transition-all duration-200 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:translate-x-1"
                        >
                          <Shield className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                          Admin Panel
                        </Link>
                      </>
                    )}

                    <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>

                    <button
                      onClick={() => handleDropdownItemClick(handleSignOut)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:translate-x-1"
                    >
                      <LogOut className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="hidden lg:flex items-center gap-2 bg-transparent transition-all duration-300 hover:scale-105 hover:shadow-md hover:bg-red-50 hover:border-red-200 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:border-red-800 dark:hover:text-red-400"
          >
            <LogOut className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
            Sign Out
          </Button>

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="lg:hidden" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <nav className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-4 border-b">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.avatar_url || "/placeholder.svg"} alt={displayName} />
                    <AvatarFallback className="bg-primary text-primary-foreground">{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium">{displayName}</p>
                    <p className="text-xs text-muted-foreground break-all">{userEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      {userPoints} pts • Level {userLevel}
                    </p>
                  </div>
                </div>

                {getNavigationItems().map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-2 text-lg font-medium transition-colors hover:text-foreground/80",
                      pathname === item.href ? "text-foreground" : "text-foreground/60",
                      item.href === "/admin" &&
                        "text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300",
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.title}
                  </Link>
                ))}

                <div className="border-t pt-4 mt-4">
                  <Link
                    href="/profile"
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-2 text-lg font-medium transition-colors hover:text-foreground/80",
                      pathname === "/profile" ? "text-foreground" : "text-foreground/60",
                    )}
                  >
                    <User className="h-5 w-5" />
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-2 text-lg font-medium transition-colors hover:text-foreground/80 mt-4",
                      pathname === "/settings" ? "text-foreground" : "text-foreground/60",
                    )}
                  >
                    <Settings className="h-5 w-5" />
                    Settings
                  </Link>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsOpen(false)
                      handleSignOut()
                    }}
                    className="flex items-center gap-2 text-lg font-medium mt-4 w-full justify-start p-0 h-auto"
                  >
                    <LogOut className="h-5 w-5" />
                    Sign Out
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
