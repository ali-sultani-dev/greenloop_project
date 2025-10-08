"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Settings, Save, Globe, Loader2, Trophy } from "lucide-react"

interface SystemSettings {
  platform_name: string
  company_name: string
  challenge_creation_enabled: boolean
  max_team_size: number
  team_creation_enabled: boolean
  user_registration_enabled: boolean
}

interface LevelThreshold {
  level: number
  points_required: number
}

const DEFAULT_SETTINGS: SystemSettings = {
  platform_name: "GreenLoop",
  company_name: "GreenLoop",
  challenge_creation_enabled: true,
  max_team_size: 10,
  team_creation_enabled: true,
  user_registration_enabled: true,
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingThresholds, setSavingThresholds] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS)
  const [levelThresholds, setLevelThresholds] = useState<LevelThreshold[]>([])

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError || !authData?.user) {
          window.location.href = "/auth/login"
          return
        }

        const { data: profile } = await supabase.from("users").select("*").eq("id", authData.user.id).single()

        if (!profile?.is_admin) {
          window.location.href = "/dashboard"
          return
        }

        setUserProfile(profile)

        console.log("-> Loading settings via API...")
        const response = await fetch("/api/admin/settings")

        if (response.ok) {
          const result = await response.json()
          console.log("-> Loaded settings from API:", result)

          if (result.settings) {
            const transformedSettings: Partial<SystemSettings> = {}

            result.settings.forEach((setting: any) => {
              const key = setting.key as keyof SystemSettings
              let value = setting.setting_value

              if (setting.data_type === "boolean") {
                value = value === "true" || value === true
              } else if (setting.data_type === "number") {
                value = Number.parseInt(value) || 0
              }

              transformedSettings[key] = value
            })

            console.log("-> Transformed settings:", transformedSettings)

            setSettings({
              ...DEFAULT_SETTINGS,
              ...transformedSettings,
            })
          }
        } else {
          console.error("-> Failed to load settings from API")
        }

        const { data: thresholds, error: thresholdsError } = await supabase
          .from("level_thresholds")
          .select("level, points_required")
          .order("level", { ascending: true })

        if (thresholdsError) {
          console.error("-> Error loading level thresholds:", thresholdsError)
        } else {
          setLevelThresholds(thresholds || [])
        }
      } catch (error) {
        console.error("-> Error loading settings:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      console.log("-> Starting to save settings via API:", settings)

      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ settings }),
      })

      const result = await response.json()
      console.log("-> API response:", result)

      if (!response.ok) {
        throw new Error(result.error || "Failed to save settings")
      }

      console.log("-> Settings saved successfully via API")
      toast({
        title: "Settings Saved",
        description: "System settings have been updated successfully.",
      })
    } catch (error: any) {
      console.error("-> Error saving settings:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const validateLevelThresholds = (thresholds: LevelThreshold[]): string | null => {
    const sortedThresholds = [...thresholds].sort((a, b) => a.level - b.level)

    for (let i = 1; i < sortedThresholds.length; i++) {
      const current = sortedThresholds[i]
      const previous = sortedThresholds[i - 1]

      if (current.points_required <= previous.points_required) {
        return `Level ${current.level} (${current.points_required} points) must have more points than Level ${previous.level} (${previous.points_required} points)`
      }
    }

    return null
  }

  const handleSaveLevelThresholds = async () => {
    const validationError = validateLevelThresholds(levelThresholds)
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      })
      return
    }

    setSavingThresholds(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) throw new Error("Not authenticated")

      for (const threshold of levelThresholds) {
        const { data, error } = await supabase.rpc("update_level_threshold", {
          threshold_level: threshold.level,
          new_points_required: threshold.points_required,
          admin_user_id: authData.user.id,
        })

        console.log(`[v0] Update response for level ${threshold.level}:`, { data, error })

        if (error) {
          throw new Error(`Failed to update level ${threshold.level}: ${error.message}`)
        }

        // Check if the function returned an error in the response
        if (data && typeof data === "object" && "success" in data && !data.success) {
          throw new Error(`Failed to update level ${threshold.level}: ${data.error || "Unknown error"}`)
        }
      }

      const { data: updatedThresholds, error: reloadError } = await supabase
        .from("level_thresholds")
        .select("level, points_required")
        .order("level", { ascending: true })

      if (!reloadError && updatedThresholds) {
        setLevelThresholds(updatedThresholds)
      }

      toast({
        title: "Level Thresholds Updated",
        description: "All user levels have been recalculated based on new thresholds.",
      })
    } catch (error: any) {
      console.error("-> Error saving level thresholds:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save level thresholds",
        variant: "destructive",
      })
    } finally {
      setSavingThresholds(false)
    }
  }

  const updateSetting = (key: keyof SystemSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const updateLevelThreshold = (level: number, points: number) => {
    setLevelThresholds((prev) =>
      prev.map((threshold) => (threshold.level === level ? { ...threshold, points_required: points } : threshold)),
    )
  }

  const thresholdValidationError = validateLevelThresholds(levelThresholds)

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground flex items-center gap-4">
                <Settings className="h-10 w-10 text-primary" />
                System Settings
              </h1>
              <p className="text-lg text-muted-foreground mt-2">Configure basic platform settings and preferences.</p>
            </div>
            <Button onClick={handleSaveSettings} disabled={saving} size="lg" className="px-8 py-3 text-lg">
              {saving ? <Loader2 className="h-5 w-5 mr-3 animate-spin" /> : <Save className="h-5 w-5 mr-3" />}
              Save Changes
            </Button>
          </div>

          <div className="w-full space-y-8">
            <Card className="shadow-lg border-2">
              <CardHeader className="pb-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <Globe className="h-7 w-7 text-primary" />
                  Platform Configuration
                </CardTitle>
                <CardDescription className="text-lg">Basic platform identity and branding settings</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="platform-name" className="text-lg font-semibold text-foreground">
                      Platform Name
                    </Label>
                    <Input
                      id="platform-name"
                      value={settings?.platform_name || ""}
                      onChange={(e) => updateSetting("platform_name", e.target.value)}
                      className="h-14 text-lg border-2 focus:border-primary transition-colors"
                      placeholder="Enter platform name"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="company-name" className="text-lg font-semibold text-foreground">
                      Company Name
                    </Label>
                    <Input
                      id="company-name"
                      value={settings?.company_name || ""}
                      onChange={(e) => updateSetting("company_name", e.target.value)}
                      className="h-14 text-lg border-2 focus:border-primary transition-colors"
                      placeholder="Enter company name"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-2">
              <CardHeader className="pb-6 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <Settings className="h-7 w-7 text-blue-600" />
                  System Configuration
                </CardTitle>
                <CardDescription className="text-lg">Core system parameters and limits</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="max-team-size" className="text-lg font-semibold text-foreground">
                      Maximum Team Size
                    </Label>
                    <Input
                      id="max-team-size"
                      type="number"
                      value={settings?.max_team_size || 10}
                      onChange={(e) => updateSetting("max_team_size", Number.parseInt(e.target.value) || 10)}
                      className="h-14 text-lg border-2 focus:border-primary transition-colors"
                      placeholder="10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-2">
              <CardHeader className="pb-6 bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/20 dark:to-yellow-900/20 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <Trophy className="h-7 w-7 text-yellow-600" />
                  Level Thresholds
                </CardTitle>
                <CardDescription className="text-lg">
                  Configure points required for each user level (changes will recalculate all user levels)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="space-y-6">
                  {thresholdValidationError && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-red-700 dark:text-red-300 font-medium">⚠️ {thresholdValidationError}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {levelThresholds.map((threshold) => {
                      const isInvalid =
                        thresholdValidationError && thresholdValidationError.includes(`Level ${threshold.level}`)

                      return (
                        <div key={threshold.level} className="space-y-2">
                          <Label className="text-sm font-medium text-foreground">Level {threshold.level}</Label>
                          <Input
                            type="number"
                            value={threshold.points_required}
                            onChange={(e) =>
                              updateLevelThreshold(threshold.level, Number.parseInt(e.target.value) || 0)
                            }
                            className={`h-12 text-base border-2 transition-colors ${
                              isInvalid ? "border-red-500 focus:border-red-600" : "focus:border-primary"
                            }`}
                            placeholder="0"
                            min="0"
                          />
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveLevelThresholds}
                      disabled={savingThresholds || !!thresholdValidationError}
                      size="lg"
                      className="px-6 py-2"
                    >
                      {savingThresholds ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Update Level Thresholds
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-2">
              <CardHeader className="pb-6 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <Settings className="h-7 w-7 text-green-600" />
                  Feature Controls
                </CardTitle>
                <CardDescription className="text-lg">
                  Enable or disable platform features and user capabilities
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="flex items-center justify-between p-6 bg-card border-2 rounded-lg hover:shadow-md transition-shadow">
                    <div className="space-y-2">
                      <Label htmlFor="user-registration" className="text-lg font-semibold text-foreground">
                        User Registration
                      </Label>
                      <p className="text-base text-muted-foreground">Allow new user registrations</p>
                    </div>
                    <Switch
                      id="user-registration"
                      checked={settings?.user_registration_enabled ?? true}
                      onCheckedChange={(checked) => updateSetting("user_registration_enabled", checked)}
                      className="scale-150"
                    />
                  </div>

                  <div className="flex items-center justify-between p-6 bg-card border-2 rounded-lg hover:shadow-md transition-shadow">
                    <div className="space-y-2">
                      <Label htmlFor="team-creation" className="text-lg font-semibold text-foreground">
                        Team Creation
                      </Label>
                      <p className="text-base text-muted-foreground">Allow users to create their own teams</p>
                    </div>
                    <Switch
                      id="team-creation"
                      checked={settings?.team_creation_enabled ?? true}
                      onCheckedChange={(checked) => updateSetting("team_creation_enabled", checked)}
                      className="scale-150"
                    />
                  </div>

                  <div className="flex items-center justify-between p-6 bg-card border-2 rounded-lg hover:shadow-md transition-shadow">
                    <div className="space-y-2">
                      <Label htmlFor="challenge-creation" className="text-lg font-semibold text-foreground">
                        Challenge Creation
                      </Label>
                      <p className="text-base text-muted-foreground">Allow users to create their own challenges</p>
                    </div>
                    <Switch
                      id="challenge-creation"
                      checked={settings?.challenge_creation_enabled ?? true}
                      onCheckedChange={(checked) => updateSetting("challenge_creation_enabled", checked)}
                      className="scale-150"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
