"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface ChallengeDeleteButtonProps {
  challengeId: string
  challengeTitle: string
  challengeType: string
  canDelete: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
}

export function ChallengeDeleteButton({
  challengeId,
  challengeTitle,
  challengeType,
  canDelete,
  variant = "destructive",
  size = "default",
  className = "",
}: ChallengeDeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/challenges/${challengeId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete challenge")
      }

      toast.success("Challenge deleted successfully!", {
        description: `"${challengeTitle}" has been removed.`,
      })

      // Redirect based on challenge type
      if (challengeType === "individual") {
        router.push("/challenges")
      } else {
        router.push("/challenges")
      }

      router.refresh()
    } catch (error) {
      console.error("Error deleting challenge:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete challenge")
    } finally {
      setIsDeleting(false)
    }
  }

  if (!canDelete) {
    return null
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={isDeleting}>
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {size !== "icon" && (isDeleting ? "Deleting..." : "Delete")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Challenge</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{challengeTitle}"? This action cannot be undone and will remove all
            participant data and progress.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Challenge
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
