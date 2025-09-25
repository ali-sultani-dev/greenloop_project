"use client"

import { useEffect } from "react"
import { usePlatformSettings } from "@/hooks/use-platform-settings"

export function DynamicMetadata() {
  const { platform_name, company_name, loading } = usePlatformSettings()

  useEffect(() => {
    if (!loading) {
      // Update document title
      document.title = `${platform_name} - Employee Sustainability Platform`

      // Update meta description
      const metaDescription = document.querySelector('meta[name="description"]')
      if (metaDescription) {
        metaDescription.setAttribute(
          "content",
          `Engage employees in sustainability initiatives, track environmental impact, and build a greener workplace culture through ${platform_name}'s gamification and team collaboration platform.`,
        )
      }

      // Update Open Graph title
      const ogTitle = document.querySelector('meta[property="og:title"]')
      if (ogTitle) {
        ogTitle.setAttribute("content", `${platform_name} - Employee Sustainability Platform`)
      }

      // Update Open Graph site name
      const ogSiteName = document.querySelector('meta[property="og:site_name"]')
      if (ogSiteName) {
        ogSiteName.setAttribute("content", platform_name)
      }

      // Update Twitter title
      const twitterTitle = document.querySelector('meta[name="twitter:title"]')
      if (twitterTitle) {
        twitterTitle.setAttribute("content", `${platform_name} - Employee Sustainability Platform`)
      }
    }
  }, [platform_name, company_name, loading])

  return null
}
