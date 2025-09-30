"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export function RefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    console.log("-> Refreshing dashboard data...")
    setIsRefreshing(true)

    try {
      // Add a small delay to show the loading state
      await new Promise((resolve) => setTimeout(resolve, 500))
      window.location.reload()
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
      {isRefreshing ? "Refreshing..." : "Refresh"}
    </Button>
  )
}
