import { DashboardSkeleton } from "@/components/ui/loading-skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 border-b border-border bg-background" />
      <main className="container mx-auto px-4 py-8">
        <DashboardSkeleton />
      </main>
    </div>
  )
}
