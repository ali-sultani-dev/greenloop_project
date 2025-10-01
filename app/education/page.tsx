"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, Calendar, GraduationCap, Filter, Plus, Leaf } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ContentCrudModal } from "@/components/admin/content-crud-modal"
import { useToast } from "@/hooks/use-toast"
import { Navigation } from "@/components/navigation"
import { NatureBackground } from "@/components/ui/nature-background"

interface EducationalContent {
  id: string
  title: string
  content: string
  category: string
  status: "draft" | "published" | "archived"
  tags: string[]
  points?: number
  co2_impact?: number
  created_at: string
  updated_at: string
  type?: "educational"
}

export default function EducationPage() {
  const [educationalContent, setEducationalContent] = useState<EducationalContent[]>([])
  const [filteredContent, setFilteredContent] = useState<EducationalContent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [isAdmin, setIsAdmin] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedContent, setSelectedContent] = useState<EducationalContent | null>(null)
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create")

  const supabase = createClient()
  const { toast } = useToast()

  const loadEducationalContent = async () => {
    try {
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

      const response = await fetch("/api/education?status=published")
      if (!response.ok) {
        throw new Error("Failed to fetch educational content")
      }

      const result = await response.json()
      const data = result.data || []

      setEducationalContent(data)
      setFilteredContent(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEducationalContent()
  }, [])

  useEffect(() => {
    if (selectedCategory === "all") {
      setFilteredContent(educationalContent)
    } else {
      setFilteredContent(educationalContent.filter((content) => content.category === selectedCategory))
    }
  }, [selectedCategory, educationalContent])

  const handleCreateContent = () => {
    setSelectedContent(null)
    setModalMode("create")
    setModalOpen(true)
  }

  const handleSaveContent = async (contentData: any) => {
    loadEducationalContent()
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
      Energy: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      Transportation: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      Waste: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      Water: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
      Food: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      General: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    }
    return colors[category] || colors.General
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Energy":
        return "⚡"
      case "Transportation":
        return "🚗"
      case "Waste":
        return "♻️"
      case "Water":
        return "💧"
      case "Food":
        return "🍃"
      default:
        return "📚"
    }
  }

  const categories = [...new Set(educationalContent.map((content) => content.category))].sort()

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation user={userProfile} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading educational content...</p>
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
            <p className="text-destructive">Error loading educational content: {error}</p>
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
                    <GraduationCap className="h-8 w-8 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h1 className="text-4xl font-bold text-foreground text-balance flex items-center gap-3">
                    📚 Educational Garden
                  </h1>
                  <p className="text-muted-foreground text-balance text-lg">
                    Nurture your understanding of sustainability through our curated educational resources. Every lesson
                    plants seeds of change! 🌿
                  </p>
                </div>
              </div>
              {isAdmin && (
                <Button onClick={handleCreateContent} className="hover-lift leaf-shadow">
                  <Plus className="h-4 w-4 mr-2" />🌿 Grow New Content
                </Button>
              )}
            </div>
          </div>

          {categories.length > 0 && (
            <Card className="organic-card leaf-shadow hover-lift animate-organic-slide-up bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border-primary/20">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-full animate-nature-pulse">
                    <Filter className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">🔍 Filter by Ecosystem</h3>
                    <p className="text-sm text-muted-foreground">Explore content by category</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full organic-card leaf-shadow">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="organic-card leaf-shadow">
                    <SelectItem value="all">🌍 All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {getCategoryIcon(category)} {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <div className="space-y-6">
            {filteredContent.length > 0 ? (
              filteredContent.map((content, index) => (
                <Card
                  key={content.id}
                  className="organic-card leaf-shadow hover-lift animate-organic-slide-up bg-gradient-to-br from-background to-primary/5"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-primary/20">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-3 flex items-center gap-3 text-foreground group-hover:text-primary transition-colors duration-300 text-balance">
                          <span className="text-2xl animate-leaf-sway">{getCategoryIcon(content.category)}</span>
                          {content.title}
                        </CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-2 bg-background/60 px-3 py-1 rounded-full leaf-shadow">
                            <Calendar className="h-4 w-4" />
                            {formatDate(content.created_at)}
                          </div>
                          <Badge
                            className={`${getCategoryColor(content.category)} rounded-full px-3 py-1 font-medium leaf-shadow`}
                          >
                            {content.category}
                          </Badge>
                          {content.points && content.points > 0 && (
                            <Badge
                              variant="secondary"
                              className="bg-accent/10 text-accent rounded-full px-3 py-1 font-medium leaf-shadow"
                            >
                              🌟 {content.points} points
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-full animate-nature-pulse">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="prose prose-sm max-w-none">
                      <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap text-pretty">
                        {content.content}
                      </p>
                    </div>

                    {content.co2_impact && content.co2_impact > 0 && (
                      <div className="mt-6 p-4 bg-gradient-to-r from-accent/5 to-accent/10 rounded-2xl border border-accent/20 leaf-shadow">
                        <div className="flex items-center gap-3 text-sm text-accent">
                          <div className="p-2 bg-accent/10 rounded-full animate-leaf-sway">
                            <Leaf className="h-4 w-4 text-accent" />
                          </div>
                          <div>
                            <span className="font-semibold">🌱 Environmental Impact:</span>
                            <span className="ml-2">
                              Learn how to save {content.co2_impact}kg CO₂ and help our planet breathe!
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {content.tags && content.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-6">
                        {content.tags.map((tag, index) => (
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
                    <GraduationCap className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {selectedCategory === "all" ? "🌱 Knowledge Garden Growing" : `🔍 No ${selectedCategory} Content Yet`}
                </h3>
                <p className="text-muted-foreground mb-6 text-balance max-w-md mx-auto">
                  {selectedCategory === "all"
                    ? "Our educational garden is still sprouting! Check back soon for fresh learning resources. 🌿"
                    : `No educational content found in the ${selectedCategory} ecosystem. Try exploring other categories or check back later! 🌍`}
                </p>
                <div className="flex gap-3 justify-center">
                  {selectedCategory !== "all" && (
                    <Button
                      variant="outline"
                      onClick={() => setSelectedCategory("all")}
                      className="hover-lift leaf-shadow"
                    >
                      🌍 Explore All Content
                    </Button>
                  )}
                  {isAdmin && (
                    <Button onClick={handleCreateContent} className="hover-lift leaf-shadow">
                      <Plus className="h-4 w-4 mr-2" />🌱 Plant First Content
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
          content={selectedContent ? { ...selectedContent, type: "educational" as const } : null}
          mode={modalMode}
          currentAdminId={userProfile?.id}
          restrictedType="educational"
        />
      )}
    </div>
  )
}
