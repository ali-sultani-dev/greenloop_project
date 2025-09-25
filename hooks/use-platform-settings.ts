"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

interface PlatformSettings {
  platform_name: string
  company_name: string
  loading: boolean
}

const DEFAULT_SETTINGS: PlatformSettings = {
  platform_name: "GreenLoop",
  company_name: "GreenLoop",
  loading: true,
}

export function usePlatformSettings(): PlatformSettings {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS)
  const supabase = createClient()

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("key, setting_value")
          .in("key", ["platform_name", "company_name"])

        if (!error && data) {
          const settingsMap = data.reduce(
            (acc, setting) => {
              acc[setting.key] = setting.setting_value
              return acc
            },
            {} as Record<string, string>,
          )

          setSettings({
            platform_name: settingsMap.platform_name || "GreenLoop",
            company_name: settingsMap.company_name || "GreenLoop",
            loading: false,
          })
        } else {
          // Use defaults if error
          setSettings((prev) => ({ ...prev, loading: false }))
        }
      } catch (error) {
        console.error("Error loading platform settings:", error)
        setSettings((prev) => ({ ...prev, loading: false }))
      }
    }

    loadSettings()
  }, [supabase])

  return settings
}
