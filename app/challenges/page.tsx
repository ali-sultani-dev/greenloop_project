"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InteractiveSearch } from "@/components/admin/interactive-search"
import { Trophy, Plus, Calendar, Clock, Award } from "lucide-react"
import Link from "next/link"
import { ChallengeCardActions } from "@/components/challenge-card-actions"

export default function ChallengesPage() {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [allChallenges, setAllChallenges] = useState<any[]>([])
  const [filteredChallenges, setFilteredChallenges] = useState<any[]>([])
  const [myParticipations, setMyParticipations] = useState<any[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, any>>(new Map())
  const [participationMap, setParticipationMap] = useState<Map<string, any>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("active")
  const [challengeCreationEnabled, setChallengeCreationEnabled] = useState(true)

  const router = useRouter()
  const supabase = createClient()

  const handleParticipationChange = useCallback(
    (challengeId: string, isParticipating: boolean) => {
      // Update participation map
      setParticipationMap((prev) => {
        const newMap = new Map(prev)
        if (isParticipating) {
          newMap.set(challengeId, { challenge_id: challengeId, completed: false, current_progress: 0 })
        } else {
          newMap.delete(challengeId)
        }
        return newMap
      })

      // Update challenges state
      setAllChallenges((prev) =>
        prev.map((challenge) => {
          if (challenge.id === challengeId) {
            const updatedParticipants = isParticipating
              ? challenge.participants + 1
              : Math.max(0, challenge.participants - 1)

            return {
              ...challenge,
              participants: updatedParticipants,
              isParticipating,
              participation_status: isParticipating ? "Participating" : "Available",
            }
          }
          return challenge
        }),
      )

      // Update filtered challenges
      setFilteredChallenges((prev) =>
        prev.map((challenge) => {
          if (challenge.id === challengeId) {
            const updatedParticipants = isParticipating
              ? challenge.participants + 1
              : Math.max(0, challenge.participants - 1)

            return {
              ...challenge,
              participants: updatedParticipants,
              isParticipating,
              participation_status: isParticipating ? "Participating" : "Available",
            }
          }
          return challenge
        }),
      )

      // Update my participations if joining
      if (isParticipating) {
        const challenge = allChallenges.find((c) => c.id === challengeId)
        if (challenge) {
          setMyParticipations((prev) => [
            ...prev,
            {
              id: `temp-${challengeId}`,
              challenge_id: challengeId,
              user_id: userProfile?.id,
              challenges: challenge,
              joined_at: new Date().toISOString(),
            },
          ])
        }
      } else {
        // Remove from my participations if leaving
        setMyParticipations((prev) => prev.filter((p) => p.challenge_id !== challengeId))
      }
    },
    [allChallenges, userProfile?.id],
  )

  useEffect(() => {
    async function loadData() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData?.user) {
          router.push("/auth/login")
          return
        }

        // Get user profile
        const { data: profile } = await supabase.from("users").select("*").eq("id", userData.user.id).single()
        setUserProfile(profile)

        const { data: challengeCreationSetting } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("key", "challenge_creation_enabled")
          .single()

        const creationEnabled = challengeCreationSetting?.setting_value === "true"
        setChallengeCreationEnabled(creationEnabled)

        const { data: challengesData } = await supabase
          .from("challenges")
          .select(`
            *,
            users!challenges_created_by_fkey (
              id,
              first_name,
              last_name,
              avatar_url
            ),
            challenge_participants (
              id,
              user_id,
              team_id,
              current_progress,
              completed,
              teams (
                id,
                name,
                description,
                team_members (
                  id,
                  user_id,
                  users (id, first_name, last_name, avatar_url)
                )
              )
            )
          `)
          .eq("is_active", true)
          .gte("end_date", new Date().toISOString())
          .order("start_date", { ascending: false })

        // Get user's team membership
        const { data: userTeamMembership } = await supabase
          .from("team_members")
          .select(`
            team_id,
            role,
            teams (id, name)
          `)
          .eq("user_id", userData.user.id)

        const userTeamIds = userTeamMembership?.map((tm) => tm.team_id) || []

        // Get user's participations with progress data
        const { data: userParticipationsData } = await supabase
          .from("challenge_participants")
          .select(`
            *,
            challenges (*)
          `)
          .eq("user_id", userData.user.id)
          .order("joined_at", { ascending: false })

        const { data: userProgressData } = await supabase
          .from("challenge_progress")
          .select("challenge_id, current_progress, progress_percentage, completed")
          .eq("user_id", userData.user.id)

        const progressMapData = new Map(userProgressData?.map((p) => [p.challenge_id, p]) || [])
        setProgressMap(progressMapData)

        const { data: allUserParticipations } = await supabase
          .from("challenge_participants")
          .select("challenge_id, completed, current_progress")
          .eq("user_id", userData.user.id)

        const participationMapData = new Map(allUserParticipations?.map((p) => [p.challenge_id, p]) || [])
        setParticipationMap(participationMapData)

        const challengesWithStats =
          challengesData
            ?.map((challenge) => {
              const participantCount = challenge.challenge_participants?.length || 0
              const userParticipation = participationMapData.get(challenge.id)
              const userProgress = progressMapData.get(challenge.id)
              const challengeEnded = new Date(challenge.end_date) < new Date()

              let teamCount = 0
              let totalTeamMembers = 0
              let teamName = ""
              let isUserInTeam = false

              if (challenge.challenge_type === "team") {
                const teamParticipants =
                  challenge.challenge_participants?.filter(
                    (participant: any) => participant.team_id && participant.teams,
                  ) || []

                if (teamParticipants.length > 0) {
                  const firstTeamParticipant = teamParticipants[0]
                  teamName = firstTeamParticipant.teams.name
                  totalTeamMembers = firstTeamParticipant.teams.team_members?.length || 0
                  teamCount = 1
                  isUserInTeam =
                    firstTeamParticipant.teams.team_members?.some(
                      (member: any) => member.user_id === userData.user.id,
                    ) || false
                } else {
                  const allTeamParticipants =
                    challenge.challenge_participants?.filter((participant: any) => participant.team_id) || []
                  isUserInTeam =
                    challenge.challenge_participants?.some(
                      (participant: any) => participant.user_id === userData.user.id,
                    ) || false
                }
              }

              if (challenge.challenge_type === "team" && !isUserInTeam && !profile?.is_admin) {
                return null
              }

              if (challenge.challenge_type === "individual") {
                const isCreatedByUser = challenge.created_by === userData.user.id
                const isParticipatingInChallenge = !!userParticipation

                if (!isCreatedByUser && !isParticipatingInChallenge && !profile?.is_admin) {
                  return null
                }
              }

              return {
                ...challenge,
                participants: participantCount,
                teamCount,
                totalTeamMembers,
                teamName,
                maxParticipants: challenge.max_participants || 100,
                isParticipating: !!userParticipation,
                isCompleted: userProgress?.completed || false,
                userProgress: userProgress?.current_progress || 0,
                progressPercentage: userProgress?.progress_percentage || 0,
                challengeEnded,
                isUserInTeam,
                type_display:
                  challenge.challenge_type === "individual"
                    ? "Personal"
                    : challenge.challenge_type === "company"
                      ? "Company"
                      : "Team",
                status: challengeEnded ? "Ended" : "Active",
                participation_status: userProgress?.completed
                  ? "Completed"
                  : !!userParticipation
                    ? "Participating"
                    : "Available",
              }
            })
            .filter(Boolean) || []

        setAllChallenges(challengesWithStats)
        setFilteredChallenges(challengesWithStats)
        setMyParticipations(userParticipationsData || [])
      } catch (err) {
        console.error("Failed to load data:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [router, supabase])

  const filterOptions = useMemo(
    () => [
      {
        key: "category",
        label: "Category",
        values: [...new Set(allChallenges.map((challenge) => challenge.category).filter(Boolean))].sort(),
      },
      {
        key: "type_display",
        label: "Type",
        values: ["Personal", "Team", "Company"],
      },
      {
        key: "participation_status",
        label: "Status",
        values: ["Available", "Participating", "Completed"],
      },
    ],
    [allChallenges],
  )

  const handleFilteredData = (filtered: any[]) => {
    setFilteredChallenges(filtered)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation user={userProfile} />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading challenges...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={userProfile} />

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Trophy className="h-8 w-8 text-primary" />
                Challenges
              </h1>
              <p className="text-muted-foreground text-balance">
                Take on sustainability challenges, compete with colleagues, and make a measurable environmental impact.
              </p>
            </div>
            {(challengeCreationEnabled || userProfile?.is_admin) && (
              <Button asChild>
                <Link href="/challenges/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Challenge
                </Link>
              </Button>
            )}
          </div>

          {/* Challenge Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 h-12">
              <TabsTrigger value="active" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Active Challenges
              </TabsTrigger>
              <TabsTrigger value="my-challenges" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                My Challenges
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                Completed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Search & Filter Challenges</CardTitle>
                  <CardDescription>
                    Find challenges by title, description, category, type, or participation status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <InteractiveSearch
                    data={allChallenges}
                    onFilteredData={handleFilteredData}
                    searchFields={["title", "description", "category"]}
                    filterOptions={filterOptions}
                    placeholder="Search challenges..."
                  />
                </CardContent>
              </Card>

              {filteredChallenges.length > 0 ? (
                <div className="space-y-8">
                  {/* Personal Challenges */}
                  {filteredChallenges.filter((c) => c.challenge_type === "individual").length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Trophy className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h2 className="text-xl font-semibold">Personal Challenges</h2>
                            <p className="text-sm text-muted-foreground">Individual goals and achievements</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-primary/5 border-primary/20">
                          {filteredChallenges.filter((c) => c.challenge_type === "individual").length} challenges
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredChallenges
                          .filter((c) => c.challenge_type === "individual")
                          .map((challenge) => (
                            <Card
                              key={challenge.id}
                              className="hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/20 hover:border-l-primary"
                            >
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between mb-2">
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <Trophy className="h-3 w-3" />
                                    Personal
                                  </Badge>
                                  <Badge variant="outline">{challenge.category}</Badge>
                                </div>
                                <CardTitle className="text-lg text-balance">{challenge.title}</CardTitle>
                                {challenge.challenge_type === "individual" &&
                                  userProfile?.is_admin &&
                                  challenge.users && (
                                    <div className="text-sm text-muted-foreground">
                                      Created by: {challenge.users.first_name} {challenge.users.last_name}
                                    </div>
                                  )}
                                <CardDescription className="text-pretty">{challenge.description}</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {/* Challenge Stats */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                                    <div className="text-lg font-bold text-primary">{challenge.participants}</div>
                                    <p className="text-xs text-muted-foreground">Participants</p>
                                  </div>
                                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                                    <div className="text-lg font-bold text-accent">{challenge.reward_points || 0}</div>
                                    <p className="text-xs text-muted-foreground">Points</p>
                                  </div>
                                </div>

                                {/* Progress Bar */}
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-muted-foreground">Participation</span>
                                    <span className="text-muted-foreground">
                                      {challenge.participants}/{challenge.maxParticipants}
                                    </span>
                                  </div>
                                  <Progress
                                    value={(challenge.participants / challenge.maxParticipants) * 100}
                                    className="h-2"
                                  />
                                </div>

                                {/* Duration */}
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="h-4 w-4" />
                                  <span>
                                    {new Date(challenge.start_date).toLocaleDateString()} -{" "}
                                    {new Date(challenge.end_date).toLocaleDateString()}
                                  </span>
                                </div>

                                <ChallengeCardActions
                                  challengeId={challenge.id}
                                  isParticipating={challenge.isParticipating}
                                  isCompleted={challenge.isCompleted}
                                  challengeEnded={challenge.challengeEnded}
                                  challengeType={challenge.challenge_type}
                                  userProgress={challenge.userProgress}
                                  targetValue={challenge.target_value}
                                  progressPercentage={challenge.progressPercentage}
                                  isAdmin={userProfile?.is_admin || false}
                                  challengeCreatedBy={challenge.created_by}
                                  currentUserId={userProfile?.id}
                                  isUserInTeam={challenge.isUserInTeam}
                                  onParticipationChange={handleParticipationChange}
                                />
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Company-wide Challenges */}
                  {filteredChallenges.filter((c) => c.challenge_type === "company").length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-accent/10 rounded-lg">
                            <Trophy className="h-5 w-5 text-accent" />
                          </div>
                          <div>
                            <h2 className="text-xl font-semibold">Company-wide Challenges</h2>
                            <p className="text-sm text-muted-foreground">Organization-wide sustainability goals</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-accent/5 border-accent/20">
                          {filteredChallenges.filter((c) => c.challenge_type === "company").length} challenges
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredChallenges
                          .filter((c) => c.challenge_type === "company")
                          .map((challenge) => (
                            <Card
                              key={challenge.id}
                              className="hover:shadow-md transition-all duration-200 border-l-4 border-l-accent/20 hover:border-l-accent"
                            >
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between mb-2">
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <Trophy className="h-3 w-3" />
                                    Company-wide
                                  </Badge>
                                  <Badge variant="outline">{challenge.category}</Badge>
                                </div>
                                <CardTitle className="text-lg text-balance">{challenge.title}</CardTitle>
                                {challenge.challenge_type === "individual" &&
                                  userProfile?.is_admin &&
                                  challenge.users && (
                                    <div className="text-sm text-muted-foreground">
                                      Created by: {challenge.users.first_name} {challenge.users.last_name}
                                    </div>
                                  )}
                                <CardDescription className="text-pretty">{challenge.description}</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                                    <div className="text-lg font-bold text-primary">{challenge.participants}</div>
                                    <p className="text-xs text-muted-foreground">Participants</p>
                                  </div>
                                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                                    <div className="text-lg font-bold text-accent">{challenge.reward_points || 0}</div>
                                    <p className="text-xs text-muted-foreground">Points</p>
                                  </div>
                                </div>

                                {/* Progress Bar */}
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-muted-foreground">Participation</span>
                                    <span className="text-muted-foreground">
                                      {challenge.participants}/{challenge.maxParticipants}
                                    </span>
                                  </div>
                                  <Progress
                                    value={(challenge.participants / challenge.maxParticipants) * 100}
                                    className="h-2"
                                  />
                                </div>

                                {/* Duration */}
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="h-4 w-4" />
                                  <span>
                                    {new Date(challenge.start_date).toLocaleDateString()} -{" "}
                                    {new Date(challenge.end_date).toLocaleDateString()}
                                  </span>
                                </div>

                                <ChallengeCardActions
                                  challengeId={challenge.id}
                                  isParticipating={challenge.isParticipating}
                                  isCompleted={challenge.isCompleted}
                                  challengeEnded={challenge.challengeEnded}
                                  challengeType={challenge.challenge_type}
                                  userProgress={challenge.userProgress}
                                  targetValue={challenge.target_value}
                                  progressPercentage={challenge.progressPercentage}
                                  isAdmin={userProfile?.is_admin || false}
                                  challengeCreatedBy={challenge.created_by}
                                  currentUserId={userProfile?.id}
                                  isUserInTeam={challenge.isUserInTeam}
                                  onParticipationChange={handleParticipationChange}
                                />
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Team Challenges */}
                  {filteredChallenges.filter((c) => c.challenge_type === "team").length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-secondary/10 rounded-lg">
                            <Trophy className="h-5 w-5 text-secondary-foreground" />
                          </div>
                          <div>
                            <h2 className="text-xl font-semibold">Team Challenges</h2>
                            <p className="text-sm text-muted-foreground">Collaborative team-based goals</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-secondary/5 border-secondary/20">
                          {filteredChallenges.filter((c) => c.challenge_type === "team").length} challenges
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredChallenges
                          .filter((c) => c.challenge_type === "team")
                          .map((challenge) => (
                            <Card
                              key={challenge.id}
                              className="hover:shadow-md transition-all duration-200 border-l-4 border-l-secondary/20 hover:border-l-secondary"
                            >
                              <CardHeader className="pb-3">
                                <div className="flex items-start justify-between mb-2">
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <Trophy className="h-3 w-3" />
                                    Team
                                  </Badge>
                                  <Badge variant="outline">{challenge.category}</Badge>
                                </div>
                                <CardTitle className="text-lg text-balance">{challenge.title}</CardTitle>
                                {challenge.challenge_type === "individual" &&
                                  userProfile?.is_admin &&
                                  challenge.users && (
                                    <div className="text-sm text-muted-foreground">
                                      Created by: {challenge.users.first_name} {challenge.users.last_name}
                                    </div>
                                  )}
                                <CardDescription className="text-pretty">{challenge.description}</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                                    <div className="text-lg font-bold text-primary">
                                      {challenge.totalTeamMembers || 0}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Team Members</p>
                                  </div>
                                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                                    <div className="text-lg font-bold text-accent">{challenge.reward_points || 0}</div>
                                    <p className="text-xs text-muted-foreground">Points</p>
                                  </div>
                                </div>

                                {challenge.teamName ? (
                                  <div className="p-3 bg-primary/10 rounded-lg border-2 border-primary/20">
                                    <p className="font-semibold text-primary text-lg">{challenge.teamName}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {challenge.totalTeamMembers} team member
                                      {challenge.totalTeamMembers !== 1 ? "s" : ""} participating
                                    </p>
                                  </div>
                                ) : (
                                  <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-sm text-muted-foreground">Team Not Assigned</p>
                                  </div>
                                )}

                                {/* Duration */}
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="h-4 w-4" />
                                  <span>
                                    {new Date(challenge.start_date).toLocaleDateString()} -{" "}
                                    {new Date(challenge.end_date).toLocaleDateString()}
                                  </span>
                                </div>

                                <ChallengeCardActions
                                  challengeId={challenge.id}
                                  isParticipating={challenge.isParticipating}
                                  isCompleted={challenge.isCompleted}
                                  challengeEnded={challenge.challengeEnded}
                                  challengeType={challenge.challenge_type}
                                  userProgress={challenge.userProgress}
                                  targetValue={challenge.target_value}
                                  progressPercentage={challenge.progressPercentage}
                                  isAdmin={userProfile?.is_admin || false}
                                  challengeCreatedBy={challenge.created_by}
                                  currentUserId={userProfile?.id}
                                  isUserInTeam={challenge.isUserInTeam}
                                  onParticipationChange={handleParticipationChange}
                                />
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Active Challenges</h3>
                    <p className="text-muted-foreground mb-4">
                      There are no active challenges at the moment. Check back later or create your own!
                    </p>
                    {(challengeCreationEnabled || userProfile?.is_admin) && (
                      <Button asChild>
                        <Link href="/challenges/create">Create Challenge</Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="my-challenges" className="space-y-6">
              {myParticipations.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{myParticipations.length}</div>
                      <p className="text-sm text-muted-foreground">Active Challenges</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-accent/5 border-accent/20">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-accent">
                        {myParticipations.filter((p) => progressMap.get(p.challenges.id)?.completed).length}
                      </div>
                      <p className="text-sm text-muted-foreground">Completed</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-secondary/5 border-secondary/20">
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-secondary-foreground">
                        {Math.round(
                          myParticipations.reduce((acc, p) => {
                            const progress = progressMap.get(p.challenges.id)?.progress_percentage || 0
                            return acc + progress
                          }, 0) / myParticipations.length || 0,
                        )}
                        %
                      </div>
                      <p className="text-sm text-muted-foreground">Avg Progress</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {myParticipations.length > 0 ? (
                <div className="space-y-4">
                  {myParticipations.map((participation) => {
                    const challenge = participation.challenges
                    const userProgress = progressMap.get(challenge.id)
                    const progress = userProgress?.progress_percentage || 0
                    const daysLeft = Math.ceil(
                      (new Date(challenge.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
                    )
                    const pointsEarned = userProgress?.completed
                      ? challenge.reward_points
                      : Math.floor((progress / 100) * (challenge.reward_points || 0))

                    return (
                      <Card key={participation.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="font-semibold text-lg">{challenge.title}</h3>
                              <div className="flex items-center gap-4 mt-1">
                                <Badge variant={userProgress?.completed ? "default" : "secondary"}>
                                  {userProgress?.completed ? "Completed" : "In Progress"}
                                </Badge>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  {daysLeft > 0 ? `${daysLeft} days left` : "Ended"}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-primary">{pointsEarned}</div>
                              <p className="text-sm text-muted-foreground">Points earned</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Progress</span>
                              <span>
                                {userProgress?.current_progress || 0} / {challenge.target_value}
                              </span>
                            </div>
                            <Progress value={progress} className="h-3" />
                            <p className="text-xs text-muted-foreground">{Math.round(progress)}% complete</p>
                          </div>

                          <div className="flex gap-3 mt-4">
                            <Button asChild>
                              <Link href={`/challenges/${challenge.id}`}>View Details</Link>
                            </Button>
                            {!userProgress?.completed && (
                              <Button variant="outline" asChild>
                                <Link href="/actions">Log Actions</Link>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Active Challenges</h3>
                    <p className="text-muted-foreground mb-4">
                      You haven't joined any challenges yet. Browse active challenges to get started!
                    </p>
                    <Button asChild>
                      <Link href="#active">Browse Challenges</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-6">
              {myParticipations.filter((p) => progressMap.get(p.challenges.id)?.completed).length > 0 && (
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-100 rounded-full">
                        <Award className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-green-800">Congratulations!</h3>
                        <p className="text-green-700">
                          You've completed{" "}
                          {myParticipations.filter((p) => progressMap.get(p.challenges.id)?.completed).length}{" "}
                          challenges and earned{" "}
                          {myParticipations
                            .filter((p) => progressMap.get(p.challenges.id)?.completed)
                            .reduce((acc, p) => acc + (p.challenges.reward_points || 0), 0)}{" "}
                          total points!
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {myParticipations.filter((p) => progressMap.get(p.challenges.id)?.completed).length > 0 ? (
                <div className="space-y-4">
                  {myParticipations
                    .filter((p) => progressMap.get(p.challenges.id)?.completed)
                    .map((participation) => {
                      const challenge = participation.challenges
                      return (
                        <Card
                          key={participation.id}
                          className="hover:shadow-md transition-shadow border-l-4 border-l-green-500"
                        >
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold text-lg">{challenge.title}</h3>
                                <p className="text-muted-foreground">{challenge.description}</p>
                                <Badge variant="default" className="mt-2 bg-green-600">
                                  <Award className="h-3 w-3 mr-1" />
                                  Completed
                                </Badge>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-primary">{challenge.reward_points || 0}</div>
                                <p className="text-sm text-muted-foreground">Points earned</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Completed Challenges</h3>
                    <p className="text-muted-foreground">
                      Complete your first challenge to see your achievements here!
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
