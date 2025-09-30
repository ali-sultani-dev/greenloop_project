"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CreateActionPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/admin/content")
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-muted-foreground">Redirecting to Content Management...</p>
      </div>
    </div>
  )
}
