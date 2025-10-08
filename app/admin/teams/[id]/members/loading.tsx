export default function Loading() {
  return (
    <main className="flex-1 p-8">
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="h-10 w-20 bg-muted animate-pulse rounded" />
          <div>
            <div className="h-8 w-64 bg-muted animate-pulse rounded mb-2" />
            <div className="h-4 w-96 bg-muted animate-pulse rounded" />
          </div>
        </div>

        <div className="h-32 bg-muted animate-pulse rounded-lg" />

        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    </main>
  )
}
