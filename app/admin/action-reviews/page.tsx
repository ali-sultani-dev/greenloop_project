"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, AlertCircle, Eye, Search, User, Target, Award, Leaf, Camera } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ActionReviewsPage() {
  const [userSubmissions, setUserSubmissions] = useState<any[]>([])
  const [userActionLogs, setUserActionLogs] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState("pending")
  const [logStatusFilter, setLogStatusFilter] = useState("pending")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAction, setSelectedAction] = useState<any>(null)
  const [reviewNotes, setReviewNotes] = useState("")
  const [pointsValue, setPointsValue] = useState(0)
  const [co2Impact, setCo2Impact] = useState(0)
  const [isReviewing, setIsReviewing] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      console.log("-> Loading data for admin review page")

      const { data: submissions, error: submissionsError } = await supabase
        .from("sustainability_actions")
        .select(`
          *,
          action_categories (*)
        `)
        .eq("is_user_created", true)
        .order("created_at", { ascending: false })

      if (submissionsError) {
        console.error("-> Error loading submissions:", submissionsError)
      } else {
        console.log("-> Loaded submissions:", submissions?.length || 0)

        if (submissions && submissions.length > 0) {
          const userIds = submissions.map((s) => s.submitted_by).filter(Boolean)
          const { data: users } = await supabase.from("users").select("*").in("id", userIds)

          const submissionsWithUsers = submissions.map((submission) => ({
            ...submission,
            users: users?.find((user) => user.id === submission.submitted_by),
          }))

          setUserSubmissions(submissionsWithUsers)
        } else {
          setUserSubmissions(submissions || [])
        }
      }

      const { data: actionLogs, error: logsError } = await supabase
        .from("user_actions")
        .select("*")
        .not("photo_url", "is", null)
        .order("completed_at", { ascending: false })

      if (logsError) {
        console.error("-> Error loading action logs:", logsError)
        setUserActionLogs([])
      } else {
        console.log("-> Loaded action logs:", actionLogs?.length || 0)

        if (actionLogs && actionLogs.length > 0) {
          const actionIds = [...new Set(actionLogs.map((log) => log.action_id))]
          const userIds = [...new Set(actionLogs.map((log) => log.user_id))]

          const { data: actions } = await supabase.from("sustainability_actions").select("*").in("id", actionIds)
          const { data: users } = await supabase.from("users").select("*").in("id", userIds)

          const actionLogsWithData = actionLogs.map((log) => ({
            ...log,
            sustainability_actions: actions?.find((action) => action.id === log.action_id),
            users: users?.find((user) => user.id === log.user_id),
          }))

          setUserActionLogs(actionLogsWithData)
        } else {
          setUserActionLogs([])
        }
      }
    } catch (error) {
      console.error("-> Failed to load data:", error)
      toast({
        title: "Error",
        description: "Failed to load action reviews",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproveSubmission = async (action: any) => {
    setIsReviewing(true)
    try {
      const response = await fetch("/api/admin/actions/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actionId: action.id,
          pointsValue,
          co2Impact,
          isSubmission: true,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Failed to approve action")
      }

      toast({
        title: "Success",
        description: "Action approved and auto-logged for submitter",
      })

      setSelectedAction(null)
      loadData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve action",
        variant: "destructive",
      })
    } finally {
      setIsReviewing(false)
    }
  }

  const handleRejectSubmission = async (action: any) => {
    if (!reviewNotes.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      })
      return
    }

    setIsReviewing(true)
    try {
      const response = await fetch("/api/admin/actions/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actionId: action.id,
          rejectionReason: reviewNotes,
          isSubmission: true,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Failed to reject action")
      }

      toast({
        title: "Success",
        description: "Action rejected with feedback",
      })

      setSelectedAction(null)
      loadData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject action",
        variant: "destructive",
      })
    } finally {
      setIsReviewing(false)
    }
  }

  const handleApproveActionLog = async (actionLog: any) => {
    setIsReviewing(true)
    try {
      const response = await fetch("/api/admin/actions/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actionLogId: actionLog.id,
          isSubmission: false,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Failed to approve action log")
      }

      toast({
        title: "Success",
        description: "Action log approved",
      })

      setSelectedAction(null)
      loadData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve action log",
        variant: "destructive",
      })
    } finally {
      setIsReviewing(false)
    }
  }

  const handleRejectActionLog = async (actionLog: any) => {
    if (!reviewNotes.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      })
      return
    }

    setIsReviewing(true)
    try {
      const response = await fetch("/api/admin/actions/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actionLogId: actionLog.id,
          rejectionReason: reviewNotes,
          isSubmission: false,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Failed to reject action log")
      }

      toast({
        title: "Success",
        description: "Action log rejected",
      })

      setSelectedAction(null)
      loadData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject action log",
        variant: "destructive",
      })
    } finally {
      setIsReviewing(false)
    }
  }

  const getStatusBadge = (item: any, isSubmission: boolean) => {
    if (isSubmission) {
      if (item.is_active) {
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      } else if (item.rejection_reason) {
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        )
      } else {
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      }
    } else {
      if (item.verification_status === "approved") {
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      } else if (item.verification_status === "rejected") {
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        )
      } else {
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      }
    }
  }

  const openReviewModal = (item: any, isSubmission: boolean) => {
    setSelectedAction({ ...item, isSubmission })
    setReviewNotes("")
    if (isSubmission) {
      setPointsValue(item.points_value || 10)
      setCo2Impact(item.co2_impact || 1)
    }
  }

  const getFilteredSubmissions = (status: string) => {
    return userSubmissions.filter((submission) => {
      const matchesSearch = submission.title.toLowerCase().includes(searchTerm.toLowerCase())
      let matchesStatus = false

      switch (status) {
        case "pending":
          matchesStatus = !submission.is_active && !submission.rejection_reason
          break
        case "approved":
          matchesStatus = submission.is_active
          break
        case "rejected":
          matchesStatus = !!submission.rejection_reason
          break
        default:
          matchesStatus = true
      }

      return matchesSearch && matchesStatus
    })
  }

  const getFilteredActionLogs = (status: string) => {
    return userActionLogs.filter((log) => {
      const matchesSearch = log.sustainability_actions?.title.toLowerCase().includes(searchTerm.toLowerCase())
      let matchesStatus = false

      switch (status) {
        case "pending":
          matchesStatus = log.verification_status === "pending"
          break
        case "approved":
          matchesStatus = log.verification_status === "approved"
          break
        case "rejected":
          matchesStatus = log.verification_status === "rejected"
          break
        default:
          matchesStatus = true
      }

      return matchesSearch && matchesStatus
    })
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading reviews...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 overflow-auto">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Action Reviews</h1>
          <p className="text-muted-foreground">Review user-submitted actions and verify completed action logs</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="submissions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="submissions">
              <Target className="h-4 w-4 mr-2" />
              Action Submissions ({getFilteredSubmissions("pending").length} pending)
            </TabsTrigger>
            <TabsTrigger value="logs">
              <User className="h-4 w-4 mr-2" />
              Action Logs ({getFilteredActionLogs("pending").length} pending)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="space-y-6">
            <Tabs value={submissionStatusFilter} onValueChange={setSubmissionStatusFilter}>
              <TabsList>
                <TabsTrigger value="pending">Pending ({getFilteredSubmissions("pending").length})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({getFilteredSubmissions("approved").length})</TabsTrigger>
                <TabsTrigger value="rejected">Rejected ({getFilteredSubmissions("rejected").length})</TabsTrigger>
              </TabsList>

              <TabsContent value={submissionStatusFilter} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getFilteredSubmissions(submissionStatusFilter).map((submission) => (
                    <Card key={submission.id} className="relative">
                      <div className="absolute top-3 right-3">{getStatusBadge(submission, true)}</div>

                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg pr-20">{submission.title}</CardTitle>
                        <CardDescription>{submission.description}</CardDescription>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>By {submission.users?.full_name || submission.users?.email}</span>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{submission.action_categories?.name}</Badge>
                        </div>

                        {submission.is_active && (
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Award className="h-4 w-4 text-primary" />
                              <span>+{submission.points_value} pts</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Leaf className="h-4 w-4 text-accent" />
                              <span>{submission.co2_impact}kg CO₂</span>
                            </div>
                          </div>
                        )}

                        {submission.rejection_reason && (
                          <Alert variant="destructive">
                            <AlertDescription className="text-sm">
                              <strong>Rejected:</strong> {submission.rejection_reason}
                            </AlertDescription>
                          </Alert>
                        )}

                        <Button
                          className="w-full bg-transparent"
                          variant="outline"
                          onClick={() => openReviewModal(submission, true)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Review Action
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <Tabs value={logStatusFilter} onValueChange={setLogStatusFilter}>
              <TabsList>
                <TabsTrigger value="pending">Pending ({getFilteredActionLogs("pending").length})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({getFilteredActionLogs("approved").length})</TabsTrigger>
                <TabsTrigger value="rejected">Rejected ({getFilteredActionLogs("rejected").length})</TabsTrigger>
              </TabsList>

              <TabsContent value={logStatusFilter} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getFilteredActionLogs(logStatusFilter).map((log) => (
                    <Card key={log.id} className="relative">
                      <div className="absolute top-3 right-3">{getStatusBadge(log, false)}</div>

                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg pr-20">{log.sustainability_actions?.title}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>By {log.users?.full_name || log.users?.email}</span>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Award className="h-4 w-4 text-primary" />
                            <span>+{log.points_earned} pts</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Leaf className="h-4 w-4 text-accent" />
                            <span>{log.co2_saved}kg CO₂</span>
                          </div>
                        </div>

                        {log.photo_url && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Camera className="h-4 w-4" />
                            <span>Photo provided</span>
                          </div>
                        )}

                        {log.notes && (
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm">{log.notes}</p>
                          </div>
                        )}

                        {log.rejection_reason && (
                          <Alert variant="destructive">
                            <AlertDescription className="text-sm">
                              <strong>Rejected:</strong> {log.rejection_reason}
                            </AlertDescription>
                          </Alert>
                        )}

                        <Button
                          className="w-full bg-transparent"
                          variant="outline"
                          onClick={() => openReviewModal(log, false)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Review Log
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedAction} onOpenChange={() => setSelectedAction(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedAction?.isSubmission ? "Review Action Submission" : "Review Action Log"}</DialogTitle>
            <DialogDescription>
              {selectedAction?.isSubmission
                ? "Review and approve/reject this user-submitted action"
                : "Verify this completed action log"}
            </DialogDescription>
          </DialogHeader>

          {selectedAction && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">
                    {selectedAction.isSubmission ? selectedAction.title : selectedAction.sustainability_actions?.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedAction.isSubmission
                      ? selectedAction.description
                      : selectedAction.sustainability_actions?.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  <span>Submitted by: {selectedAction.users?.full_name || selectedAction.users?.email}</span>
                </div>

                {selectedAction.photo_url && (
                  <div>
                    <Label>Photo Proof</Label>
                    <img
                      src={selectedAction.photo_url || "/placeholder.svg"}
                      alt="Action proof"
                      className="w-full max-w-md h-48 object-cover rounded-lg border mt-2"
                    />
                  </div>
                )}

                {selectedAction.notes && (
                  <div>
                    <Label>User Notes</Label>
                    <div className="p-3 bg-muted rounded-lg mt-2">
                      <p className="text-sm">{selectedAction.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {selectedAction.isSubmission && !selectedAction.is_active && !selectedAction.rejection_reason && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="points">Points Value</Label>
                      <Input
                        id="points"
                        type="number"
                        value={pointsValue}
                        onChange={(e) => setPointsValue(Number(e.target.value))}
                        min="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="co2">CO₂ Impact (kg)</Label>
                      <Input
                        id="co2"
                        type="number"
                        step="0.1"
                        value={co2Impact}
                        onChange={(e) => setCo2Impact(Number(e.target.value))}
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="review-notes">Rejection Reason (required)</Label>
                <Textarea
                  id="review-notes"
                  placeholder="Provide reason for rejection (required for rejection)"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setSelectedAction(null)}>
                  Cancel
                </Button>

                {selectedAction.isSubmission ? (
                  <>
                    {!selectedAction.is_active && !selectedAction.rejection_reason && (
                      <>
                        <Button
                          variant="destructive"
                          onClick={() => handleRejectSubmission(selectedAction)}
                          disabled={isReviewing}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button onClick={() => handleApproveSubmission(selectedAction)} disabled={isReviewing}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve & Auto-Log
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {selectedAction.verification_status === "pending" && (
                      <>
                        <Button
                          variant="destructive"
                          onClick={() => handleRejectActionLog(selectedAction)}
                          disabled={isReviewing}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button onClick={() => handleApproveActionLog(selectedAction)} disabled={isReviewing}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
