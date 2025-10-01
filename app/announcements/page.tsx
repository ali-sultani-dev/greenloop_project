"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Megaphone, Calendar, Globe, Plus } from "lucide-react"
import { ContentCrudModal } from "@/components/admin/content-crud-modal"
import { useToast } from "@/hooks/use-toast"
import { Navigation } from "@/components/navigation"
import { NatureBackground } from "@/components/ui/nature-background"

interface Announcement {
  id: string
  title: string
  content: string
  category: string
  status: "draft" | "published" | "archived"
  tags: string[]
  created_at: string
  updated_at: string
  type?: "announcement"
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedContent, setSelectedContent] = useState<Announcement | null>(null)
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create")

  const supabase = createClient()
  const { toast } = useToast()

  const loadAnnouncements = async () => {
    try {
      // Check authentication and admin status
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authData?.user) {
        const { data: profile } = await supabase.from("users").select("*").eq("id", authData.user.id).single()

        if (profile?.is_admin && profile?.is_active) {
          setIsAdmin(true)
          setUserProfile(profile)
        } else {
          setUserProfile(profile)
        }
      }

      // Use API route to fetch announcements
      const response = await fetch("/api/announcements?status=published")
      if (!response.ok) {
        throw new Error("Failed to fetch announcements")
      }

      const result = await response.json()
      const data = result.data || []

      setAnnouncements(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnnouncements()
  }, [])

  const handleCreateContent = () => {
    setSelectedContent(null)
    setModalMode("create")
    setModalOpen(true)
  }

  const handleSaveContent = async (contentData: any) => {
    // The ContentCrudModal already handles the API call in its handleSubmit function
    // Just refresh the data after modal completes its save operation
    loadAnnouncements()
    setModalOpen(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      Energy: "bg-yellow-100 text-yellow-800",
      Transportation: "bg-blue-100 text-blue-800",
      Waste: "bg-green-100 text-green-800",
      Water: "bg-cyan-100 text-cyan-800",
      Food: "bg-orange-100 text-orange-800",
      General: "bg-gray-100 text-gray-800",
    }
    return colors[category] || colors.General
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation user={userProfile} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading announcements...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation user={userProfile} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-destructive">Error loading announcements: {error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative">
      <NatureBackground className="fixed inset-0 z-0" />
      <Navigation user={userProfile} />

      <main className="relative z-10 w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-8">
        <div className="space-y-8">
          <div className="space-y-4 animate-organic-slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="animate-leaf-sway">
                  <div className="p-3 bg-gradient-to-br from-primary to-accent rounded-full leaf-shadow">
                    <Megaphone className="h-8 w-8 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h1 className="text-4xl font-bold text-foreground text-balance flex items-center gap-3">
                    🌍 Community Announcements
                  </h1>
                  <p className="text-muted-foreground text-balance text-lg">
                    Stay rooted with the latest news and important updates from our growing GreenLoop community. Every
                    announcement nurtures our collective growth! 🌱
                  </p>
                </div>
              </div>
              {isAdmin && (
                <Button onClick={handleCreateContent} className="hover-lift leaf-shadow">
                  <Plus className="h-4 w-4 mr-2" />🌿 Plant New Announcement
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {announcements.length > 0 ? (
              announcements.map((announcement, index) => (
                <Card
                  key={announcement.id}
                  className="organic-card leaf-shadow hover-lift animate-organic-slide-up bg-gradient-to-br from-background to-primary/5"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-primary/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-3 text-foreground group-hover:text-primary transition-colors duration-300 text-balance">
                          {announcement.title}
                        </CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-2 bg-background/60 px-3 py-1 rounded-full leaf-shadow">
                            <Calendar className="h-4 w-4" />
                            {formatDate(announcement.created_at)}
                          </div>
                          <Badge
                            className={`${getCategoryColor(announcement.category)} rounded-full px-3 py-1 font-medium leaf-shadow`}
                          >
                            {announcement.category}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-full animate-nature-pulse">
                        <Globe className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="prose prose-sm max-w-none">
                      <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap text-pretty">
                        {announcement.content}
                      </p>
                    </div>

                    {announcement.tags && announcement.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-6">
                        {announcement.tags.map((tag, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 transition-colors duration-200 rounded-full px-3 py-1 leaf-shadow"
                          >
                            🏷️ {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-16 animate-organic-slide-up">
                <div className="animate-leaf-sway mb-6">
                  <div className="p-6 bg-primary/10 rounded-full w-24 h-24 mx-auto flex items-center justify-center leaf-shadow">
                    <Megaphone className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">🌱 No Announcements Yet</h3>
                <p className="text-muted-foreground mb-6 text-balance max-w-md mx-auto">
                  Our community garden of announcements is still growing! Check back soon for fresh updates and news. 🌿
                </p>
                <div className="flex gap-3 justify-center">
                  {isAdmin && (
                    <Button onClick={handleCreateContent} className="hover-lift leaf-shadow">
                      <Plus className="h-4 w-4 mr-2" />🌱 Plant First Announcement
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {isAdmin && (
        <ContentCrudModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveContent}
          content={selectedContent ? { ...selectedContent, type: "announcement" as const } : null}
          mode={modalMode}
          currentAdminId={userProfile?.id}
          restrictedType="announcement"
        />
      )}
    </div>
  )
}
