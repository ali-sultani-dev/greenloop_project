"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Bell,
  BellRing,
  CheckCircle,
  Eye,
  EyeOff,
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

interface NotificationsResponse {
  notifications: Notification[]
  unread_count: number
  page: number
  limit: number
  has_more: boolean
}

interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  avatar_url?: string
  points: number
  level: number
  is_admin?: boolean
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
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
    case "challenge_progress":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
    case "team_updates":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    case "announcements":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
    case "educational_content":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
    case "reward_status":
      return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200"
    case "leaderboard_updates":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    case "achievement_alerts":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
  }
}

const formatNotificationType = (type: string) => {
  switch (type) {
    case "action_status":
      return "Action Status"
    case "challenge_progress":
      return "Challenge Progress"
    case "team_updates":
      return "Team Updates"
    case "announcements":
      return "Announcements"
    case "educational_content":
      return "Educational Content"
    case "reward_status":
      return "Reward Status"
    case "leaderboard_updates":
      return "Leaderboard Updates"
    case "achievement_alerts":
      return "Achievement Alerts"
    default:
      return type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())
  }
}

export default function NotificationsPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [markingAllRead, setMarkingAllRead] = useState(false)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData?.user) {
          router.push("/auth/login")
          return
        }

        const { data: profile } = await supabase.from("users").select("*").eq("id", userData.user.id).single()

        if (profile) {
          setUserProfile({
            id: profile.id,
            email: profile.email,
            first_name: profile.first_name || "",
            last_name: profile.last_name || "",
            avatar_url: profile.avatar_url,
            points: profile.points || 0,
            level: profile.level || 1,
            is_admin: profile.is_admin || false,
          })
        }
      } catch (error) {
        console.error("Error loading user profile:", error)
      } finally {
        setIsLoadingUser(false)
      }
    }

    loadUserProfile()
  }, [router, supabase])

  useEffect(() => {
    if (!isLoadingUser && userProfile) {
      fetchNotifications(1, showUnreadOnly)
    }
  }, [showUnreadOnly, isLoadingUser, userProfile])

  const fetchNotifications = async (pageNum = 1, unreadOnly = false) => {
    try {
      const response = await fetch(`/api/notifications?page=${pageNum}&limit=20&unread_only=${unreadOnly}`)
      if (response.ok) {
        const data: NotificationsResponse = await response.json()
        if (pageNum === 1) {
          setNotifications(data.notifications)
        } else {
          setNotifications((prev) => [...prev, ...data.notifications])
        }
        setUnreadCount(data.unread_count)
        setHasMore(data.has_more)
        setPage(pageNum)
      }
    } catch (error) {
      console.error("Error fetching notifications:", error)
    } finally {
      setLoading(false)
    }
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
    setMarkingAllRead(true)
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
      setMarkingAllRead(false)
    }
  }

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchNotifications(page + 1, showUnreadOnly)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markNotificationAsRead(notification.id)
    }
  }

  if (loading || isLoadingUser) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation user={userProfile || undefined} />
        <div className="w-full px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={userProfile || undefined} />
      <div className="w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BellRing className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Notifications</h1>
              <p className="text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                  : "All caught up!"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={showUnreadOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className="flex items-center gap-2"
            >
              {showUnreadOnly ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {showUnreadOnly ? "Show All" : "Unread Only"}
            </Button>

            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                disabled={markingAllRead}
                className="flex items-center gap-2 bg-transparent"
              >
                <CheckCircle className="h-4 w-4" />
                {markingAllRead ? "Marking..." : "Mark All Read"}
              </Button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No notifications</h3>
              <p className="text-muted-foreground text-center">
                {showUnreadOnly ? "You don't have any unread notifications." : "You don't have any notifications yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => {
              const IconComponent = getNotificationIcon(notification.type)
              const colorClass = getNotificationColor(notification.type)

              return (
                <Card
                  key={notification.id}
                  className={`transition-all hover:shadow-md ${
                    !notification.is_read ? "border-l-4 border-l-primary bg-primary/5" : ""
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-full ${colorClass}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-foreground">{notification.title}</h3>
                              {!notification.is_read && <div className="w-2 h-2 bg-primary rounded-full"></div>}
                            </div>

                            <Badge variant="secondary" className="mb-2">
                              {formatNotificationType(notification.type)}
                            </Badge>

                            <p className="text-muted-foreground mb-3">{notification.message}</p>

                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              </span>

                              <div className="flex items-center gap-2">
                                {notification.link_url && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                    onClick={() => handleNotificationClick(notification)}
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
                                    className="flex items-center gap-1"
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                    Mark Read
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={loadMore} disabled={loading}>
                  {loading ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
