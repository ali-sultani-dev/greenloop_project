"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  SettingsIcon,
  Bell,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle,
  Target,
  Users,
  Megaphone,
  GraduationCap,
  Gift,
  BarChart3,
  Award,
} from "lucide-react"

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [preferences, setPreferences] = useState({
    action_status: true,
    challenge_progress: true,
    team_updates: true,
    announcements: true,
    educational_content: true,
    reward_status: true,
    achievement_alerts: true,
    leaderboard_updates: false,
    profile_visibility: "public",
    leaderboard_participation: true,
    analytics_sharing: true,
  })
  const [accountInfo, setAccountInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData?.user) {
          router.push("/auth/login")
          return
        }

        const response = await fetch("/api/settings", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          throw new Error("Failed to fetch settings")
        }

        const data = await response.json()
        const { preferences: userPreferences, account } = data

        // Get user profile for navigation
        const { data: userProfile } = await supabase.from("users").select("*").eq("id", userData.user.id).single()
        setUser(userProfile)

        if (userPreferences) {
          setPreferences(userPreferences)
        }

        setAccountInfo(account)
      } catch (err) {
        setError("Failed to load settings")
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [router, supabase])

  const handleSettingChange = (key: string, value: boolean | string) => {
    setPreferences((prev) => {
      const newPrefs = { ...prev, [key]: value }

      if (key === "profile_visibility" && value === "private") {
        newPrefs.leaderboard_participation = false
        newPrefs.analytics_sharing = false
      } else if (key === "profile_visibility" && value === "public") {
        newPrefs.leaderboard_participation = true
        newPrefs.analytics_sharing = true
      }

      return newPrefs
    })
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings")
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const response = await fetch("/api/settings/export", {
        method: "GET",
      })

      if (!response.ok) {
        throw new Error("Failed to export data")
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get("Content-Disposition")
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1].replace(/"/g, "")
        : `greenloop-data-export-${new Date().toISOString().split("T")[0]}.json`

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || "Failed to export data")
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true)
      return
    }

    if (deleteConfirmText !== "DELETE MY ACCOUNT") {
      setError("Please type 'DELETE MY ACCOUNT' to confirm")
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch("/api/settings/delete-account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmationText: deleteConfirmText,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete account")
      }

      // Redirect to login after successful deletion
      router.push("/auth/login")
    } catch (err: any) {
      setError(err.message || "Failed to delete account")
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation user={user} />
        <main className="px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading settings...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />

      <main className="px-6 py-8 w-full">
        <div className="w-full space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <SettingsIcon className="h-8 w-8 text-primary" />
              Settings
            </h1>
            <p className="text-muted-foreground">Manage your account preferences and privacy settings.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 w-full">
            {/* Settings Form */}
            <div className="xl:col-span-3 space-y-6">
              <Tabs defaultValue="notifications" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="notifications">Notifications</TabsTrigger>
                  <TabsTrigger value="data">Data Management</TabsTrigger>
                </TabsList>

                <TabsContent value="notifications" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Notification Preferences
                      </CardTitle>
                      <CardDescription>Choose what notifications you'd like to receive in-app</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-blue-600" />
                              Action Status Updates
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Get notified when your actions are approved or rejected
                            </p>
                          </div>
                          <Switch
                            checked={preferences.action_status}
                            onCheckedChange={(checked) => handleSettingChange("action_status", checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-green-600" />
                              Team Updates
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Get notified when you're added to teams or team achievements
                            </p>
                          </div>
                          <Switch
                            checked={preferences.team_updates}
                            onCheckedChange={(checked) => handleSettingChange("team_updates", checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="flex items-center gap-2">
                              <Megaphone className="h-4 w-4 text-orange-600" />
                              Announcements
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Receive important announcements from administrators
                            </p>
                          </div>
                          <Switch
                            checked={preferences.announcements}
                            onCheckedChange={(checked) => handleSettingChange("announcements", checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4 text-indigo-600" />
                              Educational Content
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Get notified about new educational content and sustainability tips
                            </p>
                          </div>
                          <Switch
                            checked={preferences.educational_content}
                            onCheckedChange={(checked) => handleSettingChange("educational_content", checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="flex items-center gap-2">
                              <Gift className="h-4 w-4 text-pink-600" />
                              Reward Status Updates
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Notifications about reward claims and delivery status
                            </p>
                          </div>
                          <Switch
                            checked={preferences.reward_status}
                            onCheckedChange={(checked) => handleSettingChange("reward_status", checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="flex items-center gap-2">
                              <Award className="h-4 w-4 text-emerald-600" />
                              Achievement Alerts
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Get notified when you earn badges or reach milestones
                            </p>
                          </div>
                          <Switch
                            checked={preferences.achievement_alerts}
                            onCheckedChange={(checked) => handleSettingChange("achievement_alerts", checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-yellow-600" />
                              Leaderboard Updates
                            </Label>
                            <p className="text-sm text-muted-foreground">Notifications about your ranking changes</p>
                          </div>
                          <Switch
                            checked={preferences.leaderboard_updates}
                            onCheckedChange={(checked) => handleSettingChange("leaderboard_updates", checked)}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="data" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Data Management</CardTitle>
                      <CardDescription>Export or delete your account data</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                        <div>
                          <h4 className="font-medium">Export Your Data</h4>
                          <p className="text-sm text-muted-foreground">
                            Download a complete copy of all your sustainability data
                          </p>
                        </div>
                        <Button variant="outline" onClick={handleExportData} disabled={isExporting}>
                          <Download className="h-4 w-4 mr-2" />
                          {isExporting ? "Exporting..." : "Export"}
                        </Button>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div className="p-6 bg-destructive/5 border border-destructive/20 rounded-lg text-center">
                          <div className="space-y-3">
                            <Trash2 className="h-8 w-8 text-destructive mx-auto" />
                            <div>
                              <h4 className="font-bold text-lg text-destructive mb-2">Delete Account</h4>
                              <p className="text-base font-semibold text-foreground">
                                To delete your account, please contact your administrator.
                              </p>
                              <p className="text-sm text-muted-foreground mt-2">
                                Account deletion requires administrative approval and cannot be processed through this
                                interface.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">Settings saved successfully!</AlertDescription>
                </Alert>
              )}

              <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full md:w-auto">
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </div>

            {/* Info Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Account Type</span>
                    <span className="font-medium">{accountInfo?.type || "Employee"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Member Since</span>
                    <span className="font-medium">
                      {accountInfo?.memberSince ? new Date(accountInfo.memberSince).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Data Usage</span>
                    <span className="font-medium">Normal</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Need Help?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    If you have questions about your account or need assistance with settings, contact your IT
                    administrator or support team.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
