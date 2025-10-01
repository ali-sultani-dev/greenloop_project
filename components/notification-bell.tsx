"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Bell,
  BellRing,
  CheckCircle,
  ExternalLink,
  Target,
  Trophy,
  Users,
  Megaphone,
  GraduationCap,
  Gift,
  BarChart3,
  Award,
} from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link_url?: string
  link_type?: string
  link_id?: string
  is_read: boolean
  created_at: string
}

interface NotificationBellProps {
  className?: string
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "action_status":
      return Target
    case "challenge_progress":
      return Trophy
    case "team_updates":
      return Users
    case "announcements":
      return Megaphone
    case "educational_content":
      return GraduationCap
    case "reward_status":
      return Gift
    case "leaderboard_updates":
      return BarChart3
    case "achievement_alerts":
      return Award
    default:
      return Bell
  }
}

const getNotificationColor = (type: string) => {
  switch (type) {
    case "action_status":
      return "text-blue-600 dark:text-blue-400"
    case "challenge_progress":
      return "text-purple-600 dark:text-purple-400"
    case "team_updates":
      return "text-green-600 dark:text-green-400"
    case "announcements":
      return "text-orange-600 dark:text-orange-400"
    case "educational_content":
      return "text-indigo-600 dark:text-indigo-400"
    case "reward_status":
      return "text-pink-600 dark:text-pink-400"
    case "leaderboard_updates":
      return "text-yellow-600 dark:text-yellow-400"
    case "achievement_alerts":
      return "text-emerald-600 dark:text-emerald-400"
    default:
      return "text-gray-600 dark:text-gray-400"
  }
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number
    bottom?: number
    left?: number
    right?: number
  }>({})
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Fetch notifications on component mount and periodically
  useEffect(() => {
    fetchNotifications()

    // Set up polling for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications?limit=10")
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch (error) {
      console.error("Error fetching notifications:", error)
    }
  }

  const toggleDropdown = (event: React.MouseEvent) => {
    if (isOpen) {
      setIsOpen(false)
      return
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const dropdownWidth = 384 // w-96 = 24rem = 384px
    const dropdownHeight = 500 // approximate height of dropdown

    const position: { top?: number; bottom?: number; left?: number; right?: number } = {}

    // Position horizontally
    if (rect.right - dropdownWidth < 0) {
      position.left = rect.left
    } else {
      position.right = viewportWidth - rect.right
    }

    // Position vertically
    if (rect.bottom + dropdownHeight > viewportHeight) {
      position.bottom = viewportHeight - rect.top
    } else {
      position.top = rect.bottom + 8
    }

    setDropdownPosition(position)
    setIsOpen(true)
  }

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notification_id: notificationId }),
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId ? { ...notification, is_read: true } : notification,
          ),
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mark_all_read: true }),
      })

      if (response.ok) {
        setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markNotificationAsRead(notification.id)
    }
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        className="relative h-10 w-10 p-0 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={toggleDropdown}
      >
        {unreadCount > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}

        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
        <span className="sr-only">{unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}</span>
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div
            className="fixed w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 max-h-[500px] overflow-hidden"
            style={{
              top: dropdownPosition.top,
              bottom: dropdownPosition.bottom,
              left: dropdownPosition.left,
              right: dropdownPosition.right,
            }}
          >
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={markAllAsRead} disabled={loading} className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Mark all read
                    </Button>
                  )}
                  <Link href="/notifications">
                    <Button variant="ghost" size="sm" className="text-xs">
                      View all
                    </Button>
                  </Link>
                </div>
              </div>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
                </p>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {notifications.slice(0, 10).map((notification) => {
                    const IconComponent = getNotificationIcon(notification.type)
                    const colorClass = getNotificationColor(notification.type)

                    return (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                          !notification.is_read ? "bg-primary/5 border-l-2 border-l-primary" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 ${colorClass}`}>
                            <IconComponent className="h-4 w-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                                  {notification.title}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                </p>
                              </div>

                              {!notification.is_read && (
                                <div className="w-2 h-2 bg-primary rounded-full mt-1 flex-shrink-0"></div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                              {notification.link_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  onClick={() => handleNotificationClick(notification)}
                                  className="h-6 px-2 text-xs"
                                >
                                  <Link href={notification.link_url} className="flex items-center gap-1">
                                    <ExternalLink className="h-3 w-3" />
                                    View
                                  </Link>
                                </Button>
                              )}

                              {!notification.is_read && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markNotificationAsRead(notification.id)}
                                  className="h-6 px-2 text-xs"
                                >
                                  Mark read
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <>
                <Separator />
                <div className="p-3">
                  <Link href="/notifications">
                    <Button variant="ghost" className="w-full text-sm">
                      View all notifications
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
