"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { InteractiveSearch } from "@/components/admin/interactive-search"
import { ContentCrudModal } from "@/components/admin/content-crud-modal"
import { ActionDropdown } from "@/components/admin/action-dropdown"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Plus, Calendar, Globe } from "lucide-react"

interface ContentItem {
  id?: string
  title: string
  content: string // Made content required to match modal expectations
  description?: string
  type: "action" | "announcement" | "educational"
  category: string
  status: "draft" | "published" | "archived"
  points?: number
  co2_impact?: number
  tags: string[]
  is_active?: boolean
  points_value?: number
  created_at?: string
  updated_at?: string
  created_by?: string
  submitter_name?: string
  submitter_email?: string
  is_user_created?: boolean
  first_name?: string
  last_name?: string
}

interface UserData {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

export default function AdminContentPage() {
  const [sustainabilityActions, setSustainabilityActions] = useState<ContentItem[]>([])
  const [announcements, setAnnouncements] = useState<ContentItem[]>([])
  const [educationalContent, setEducationalContent] = useState<ContentItem[]>([])
  const [filteredActions, setFilteredActions] = useState<ContentItem[]>([])
  const [adminActions, setAdminActions] = useState<ContentItem[]>([])
  const [userActions, setUserActions] = useState<ContentItem[]>([])
  const [filteredAdminActions, setFilteredAdminActions] = useState<ContentItem[]>([])
  const [filteredUserActions, setFilteredUserActions] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create")
  const [activeTab, setActiveTab] = useState("actions")
  const [activeActionTab, setActiveActionTab] = useState("admin")

  const supabase = createClient()

  const loadData = async () => {
    try {
      // Check authentication
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user) {
        window.location.href = "/auth/login"
        return
      }

      // Check if user is admin
      const { data: profile } = await supabase.from("users").select("*").eq("id", authData.user.id).single()

      if (!profile?.is_admin) {
        window.location.href = "/dashboard"
        return
      }

      setUserProfile(profile)

      const { data: actionsData } = await supabase
        .from("sustainability_actions")
        .select(`
          *,
          action_categories!inner(
            name,
            description,
            color
          )
        `)
        .order("created_at", { ascending: false })

      console.log("[v0] Raw actions data:", actionsData)

      const userSubmittedActions = actionsData?.filter((action) => action.is_user_created && action.submitted_by) || []
      const userIds = [...new Set(userSubmittedActions.map((action) => action.submitted_by))]

      let usersData: UserData[] = []
      if (userIds.length > 0) {
        const { data: userData } = await supabase
          .from("users")
          .select("id, first_name, last_name, email")
          .in("id", userIds)
        usersData = (userData as UserData[]) || []
      }

      const transformedActions =
        actionsData?.map((action) => {
          let submitterName = undefined
          let submitterEmail = undefined

          if (action.is_user_created && action.submitted_by) {
            const user = usersData.find((u) => u.id === action.submitted_by)
            if (user) {
              submitterName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email
              submitterEmail = user.email
            }
          }

          return {
            ...action,
            type: "action" as const,
            category: action.action_categories?.name || "Unknown",
            status: action.is_active ? ("published" as const) : ("draft" as const),
            points: action.points_value,
            tags: action.tags || [],
            submitter_name: submitterName,
            submitter_email: submitterEmail,
          }
        }) || []

      console.log("[v0] Transformed actions:", transformedActions)

      setSustainabilityActions(transformedActions)
      setFilteredActions(transformedActions)

      const adminCreatedActions = transformedActions.filter((action) => !action.is_user_created)
      const userCreatedActions = transformedActions.filter((action) => action.is_user_created === true)

      console.log("[v0] Admin actions:", adminCreatedActions)
      console.log("[v0] User actions:", userCreatedActions)

      setAdminActions(adminCreatedActions)
      setUserActions(userCreatedActions)
      setFilteredAdminActions(adminCreatedActions)
      setFilteredUserActions(userCreatedActions)

      const { data: announcementsData } = await supabase
        .from("content_items")
        .select("*")
        .eq("type", "announcement")
        .order("created_at", { ascending: false })

      setAnnouncements(announcementsData || [])

      const { data: educationalData } = await supabase
        .from("content_items")
        .select("*")
        .eq("type", "educational")
        .order("created_at", { ascending: false })

      setEducationalContent(educationalData || [])
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateContent = () => {
    setSelectedContent(null)
    setModalMode("create")
    setModalOpen(true)
  }

  const handleEditContent = (content: ContentItem) => {
    setSelectedContent(content)
    setModalMode("edit")
    setModalOpen(true)
  }

  const handleViewContent = (content: ContentItem) => {
    setSelectedContent(content)
    setModalMode("view")
    setModalOpen(true)
  }

  const handleSaveContent = async (contentData: ContentItem) => {
    loadData()
    setModalOpen(false)
  }

  const handleContentAction = async (action: string, content: ContentItem) => {
    switch (action) {
      case "view":
        handleViewContent(content)
        break
      case "edit":
        handleEditContent(content)
        break
      case "toggle-status":
        if (content.type === "action") {
          const newStatus = content.status === "published" ? "draft" : "published"
          const isActive = newStatus === "published"

          const response = await fetch(`/api/sustainability-actions/${content.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: content.title,
              description: content.description || content.content,
              category_id: content.category,
              points_value: content.points || content.points_value,
              co2_impact: content.co2_impact,
              is_active: isActive,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error("Failed to toggle status:", errorData.error)
          }
        } else {
          const newStatus = content.status === "published" ? "draft" : "published"
          await supabase
            .from("content_items")
            .update({
              status: newStatus,
            })
            .eq("id", content.id)
        }
        loadData()
        break
      case "duplicate":
        const { id, ...duplicateData } = content
        const newContent = {
          ...duplicateData,
          title: `${content.title} (Copy)`,
        }
        await handleSaveContent(newContent)
        break
      case "delete":
        if (confirm(`Are you sure you want to delete "${content.title}"?`)) {
          if (content.type === "action") {
            const response = await fetch(`/api/sustainability-actions/${content.id}`, {
              method: "DELETE",
            })

            if (!response.ok) {
              const errorData = await response.json()
              alert(`Failed to delete: ${errorData.error}`)
              return
            }
          } else {
            await supabase.from("content_items").delete().eq("id", content.id)
          }
          loadData()
        }
        break
    }
  }

  const handleExportAdmin = () => {
    const csvContent = [
      ["Title", "Type", "Category", "Status", "Points", "CO2 Impact", "Created"].join(","),
      ...filteredAdminActions.map((item) =>
        [
          `"${item.title}"`,
          item.type,
          item.category,
          item.status,
          item.points || 0,
          item.co2_impact || 0,
          item.created_at ? new Date(item.created_at).toLocaleDateString() : "N/A",
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `admin-actions-export-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleExportUser = () => {
    const csvContent = [
      ["Title", "Type", "Category", "Status", "Points", "CO2 Impact", "Submitted By", "Created"].join(","),
      ...filteredUserActions.map((item) =>
        [
          `"${item.title}"`,
          item.type,
          item.category,
          item.status,
          item.points || 0,
          item.co2_impact || 0,
          `"${item.submitter_name || "Unknown"}"`,
          item.created_at ? new Date(item.created_at).toLocaleDateString() : "N/A",
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `user-actions-export-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleAdminActionsFilter = (filtered: ContentItem[]) => {
    setFilteredAdminActions(filtered)
  }

  const handleUserActionsFilter = (filtered: ContentItem[]) => {
    setFilteredUserActions(filtered)
  }

  const filterOptions = [
    {
      key: "category",
      label: "Category",
      values: [...new Set(sustainabilityActions.map((item) => item.category).filter(Boolean))].sort(),
    },
    {
      key: "status",
      label: "Status",
      values: ["published", "draft", "archived"],
    },
  ]

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <main className="flex-1 p-8">
          <div className="text-center">Loading...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <main className="flex-1 p-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                Content Management
              </h1>
              <p className="text-muted-foreground">
                Manage platform content, sustainability actions, announcements, and educational resources.
              </p>
            </div>
            <Button onClick={handleCreateContent}>
              <Plus className="h-4 w-4 mr-2" />
              Create Content
            </Button>
          </div>

          {/* Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="actions">Sustainability Actions</TabsTrigger>
              <TabsTrigger value="announcements">Announcements</TabsTrigger>
              <TabsTrigger value="educational">Educational Content</TabsTrigger>
            </TabsList>

            {/* Sustainability Actions Tab */}
            <TabsContent value="actions" className="space-y-6">
              {/* Nested Tabs for Admin vs User Actions */}
              <Tabs value={activeActionTab} onValueChange={setActiveActionTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="admin">Admin Created ({adminActions.length})</TabsTrigger>
                  <TabsTrigger value="user">User Submitted ({userActions.length})</TabsTrigger>
                </TabsList>

                {/* Admin Created Actions */}
                <TabsContent value="admin" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Search Admin Actions</CardTitle>
                      <CardDescription>Find and filter admin-created sustainability actions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <InteractiveSearch
                        data={adminActions}
                        onFilteredData={handleAdminActionsFilter}
                        searchFields={["title", "description", "category"]}
                        filterOptions={filterOptions}
                        placeholder="Search admin actions..."
                        onExport={handleExportAdmin}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Admin Created Actions ({filteredAdminActions.length})</CardTitle>
                      <CardDescription>Default sustainability actions created by administrators</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Action</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Points</TableHead>
                            <TableHead>CO₂ Impact</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAdminActions.map((action) => (
                            <TableRow key={action.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{action.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {action.description || action.content}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{action.category}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{action.points || action.points_value}</div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{action.co2_impact}kg</div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={action.status === "published" || action.is_active ? "default" : "secondary"}
                                >
                                  {action.status === "published" || (action.is_active && !action.status)
                                    ? "Published"
                                    : "Draft"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {action.created_at ? new Date(action.created_at).toLocaleDateString() : "N/A"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <ActionDropdown
                                  type="content"
                                  onView={() => handleViewContent(action)}
                                  onEdit={() => handleEditContent(action)}
                                  onToggleStatus={() => handleContentAction("toggle-status", action)}
                                  onDelete={() => handleContentAction("delete", action)}
                                  isActive={action.status === "published" || action.is_active}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* User Submitted Actions */}
                <TabsContent value="user" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Search User Submissions</CardTitle>
                      <CardDescription>Find and filter user-submitted sustainability actions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <InteractiveSearch
                        data={userActions}
                        onFilteredData={handleUserActionsFilter}
                        searchFields={["title", "description", "category"]}
                        filterOptions={filterOptions}
                        placeholder="Search user submissions..."
                        onExport={handleExportUser}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>User Submitted Actions ({filteredUserActions.length})</CardTitle>
                      <CardDescription>Sustainability actions submitted by platform users</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Action</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Points</TableHead>
                            <TableHead>CO₂ Impact</TableHead>
                            <TableHead>Submitted By</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUserActions.map((action) => (
                            <TableRow key={action.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{action.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {action.description || action.content}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{action.category}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{action.points || action.points_value}</div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{action.co2_impact}kg</div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{action.submitter_name || "Unknown"}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={action.status === "published" || action.is_active ? "default" : "secondary"}
                                >
                                  {action.status === "published" || (action.is_active && !action.status)
                                    ? "Published"
                                    : "Draft"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {action.created_at ? new Date(action.created_at).toLocaleDateString() : "N/A"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <ActionDropdown
                                  type="content"
                                  onView={() => handleViewContent(action)}
                                  onEdit={() => handleEditContent(action)}
                                  onToggleStatus={() => handleContentAction("toggle-status", action)}
                                  onDelete={() => handleContentAction("delete", action)}
                                  isActive={action.status === "published" || action.is_active}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* Announcements Tab */}
            <TabsContent value="announcements" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Platform Announcements ({announcements.length})</CardTitle>
                  <CardDescription>Manage announcements and notifications for users</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {announcements.length ? (
                      announcements.map((announcement) => (
                        <div
                          key={announcement.id}
                          className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-full">
                              <Globe className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{announcement.title}</p>
                              <p className="text-sm text-muted-foreground">{announcement.content}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={announcement.status === "published" ? "default" : "secondary"}>
                              {announcement.status === "published" ? "Published" : "Draft"}
                            </Badge>
                            <ActionDropdown
                              type="content"
                              onView={() => handleViewContent(announcement)}
                              onEdit={() => handleEditContent(announcement)}
                              onDelete={() => handleContentAction("delete", announcement)}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No announcements found</p>
                        <Button className="mt-4" onClick={handleCreateContent}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create First Announcement
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Educational Content Tab */}
            <TabsContent value="educational" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Educational Resources ({educationalContent.length})</CardTitle>
                  <CardDescription>Manage educational content and sustainability guides</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {educationalContent.length ? (
                      educationalContent.map((content) => (
                        <div key={content.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent/10 rounded-full">
                              <FileText className="h-4 w-4 text-accent" />
                            </div>
                            <div>
                              <p className="font-medium">{content.title}</p>
                              <p className="text-sm text-muted-foreground">{content.content}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{content.category}</Badge>
                            <Badge
                              variant={
                                content.status === "published"
                                  ? "default"
                                  : content.status === "archived"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {content.status === "published"
                                ? "Published"
                                : content.status === "archived"
                                  ? "Archived"
                                  : "Draft"}
                            </Badge>
                            <ActionDropdown
                              type="content"
                              onView={() => handleViewContent(content)}
                              onEdit={() => handleEditContent(content)}
                              onDelete={() => handleContentAction("delete", content)}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No educational content found</p>
                        <Button className="mt-4" onClick={handleCreateContent}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Educational Content
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <ContentCrudModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveContent}
        content={selectedContent}
        mode={modalMode}
        currentAdminId={userProfile?.id}
      />
    </div>
  )
}
