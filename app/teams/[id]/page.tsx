import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Crown, Award, Target, Calendar, TrendingUp, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { TeamMemberActions } from "@/components/team-member-actions"

interface TeamPageProps {
  params: {
    id: string
  }
}

export default async function TeamPage({ params }: TeamPageProps) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Get user profile
  const { data: userProfile } = await supabase.from("users").select("*").eq("id", data.user.id).single()

  const { data: teamPerformanceData } = await supabase
    .from("team_performance_summary")
    .select("*")
    .eq("team_id", params.id)

  if (!teamPerformanceData || teamPerformanceData.length === 0) {
    redirect("/teams")
  }

  // Extract team info and members from performance data
  const firstRecord = teamPerformanceData[0]
  const team = {
    id: params.id,
    name: firstRecord.team_name,
    description: "", // Will get from teams table
    team_leader_id: teamPerformanceData.find((m) => m.is_leader)?.user_id,
    total_points: firstRecord.team_total_points,
    total_co2_saved: firstRecord.team_total_co2,
    max_members: 50, // Default, will get from teams table
    team_members: teamPerformanceData.map((member) => ({
      id: member.user_id,
      user_id: member.user_id,
      role: member.is_leader ? "leader" : "member",
      joined_at: member.joined_at,
      users: {
        id: member.user_id,
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        avatar_url: null,
        points: member.points,
        total_co2_saved: member.total_co2_saved,
        level: member.level,
        department: member.department,
        job_title: member.job_title,
        verified_actions: member.verified_actions,
      },
    })),
  }

  // Get additional team details
  const { data: teamDetails } = await supabase
    .from("teams")
    .select("description, max_members, created_at, is_active")
    .eq("id", params.id)
    .single()

  if (teamDetails) {
    team.description = teamDetails.description
    team.max_members = teamDetails.max_members
  }

  // Check if current user is a member
  const userMembership = team.team_members?.find((member: any) => member.user_id === data.user.id)
  const isTeamLeader = team.team_leader_id === data.user.id
  const isMember = !!userMembership

  // Get team challenges
  const { data: teamChallenges } = await supabase
    .from("challenge_participants")
    .select(`
      id,
      current_progress,
      completed,
      joined_at,
      challenges!inner (
        id, title, description, challenge_type, start_date, end_date,
        target_metric, target_value, reward_points, reward_description
      )
    `)
    .eq("team_id", params.id)
    .order("joined_at", { ascending: false })

  const totalMembers = team.team_members?.length || 0
  const avgPointsPerMember = totalMembers > 0 ? Math.round(team.total_points / totalMembers) : 0
  const avgCO2PerMember = totalMembers > 0 ? (team.total_co2_saved / totalMembers).toFixed(1) : "0"

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={userProfile} />

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Back Button */}
          <Button variant="ghost" asChild>
            <Link href="/teams">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Teams
            </Link>
          </Button>

          {/* Team Header */}
          <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-3xl font-bold">{team.name}</h1>
                      {isTeamLeader && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          <Crown className="h-3 w-3 mr-1" />
                          Leader
                        </Badge>
                      )}
                      {isMember && !isTeamLeader && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          Member
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1">{team.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {userProfile?.is_admin && (
                    <Button variant="outline" asChild>
                      <Link href={`/admin/teams/${team.id}/members`}>
                        <Crown className="h-4 w-4 mr-2" />
                        Admin Manage
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-background/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{Math.round(team.total_points)}</div>
                  <p className="text-sm text-muted-foreground">Total Points</p>
                </div>
                <div className="text-center p-4 bg-background/50 rounded-lg">
                  <div className="text-2xl font-bold text-accent">{Math.round(team.total_co2_saved)}kg</div>
                  <p className="text-sm text-muted-foreground">CO₂ Saved</p>
                </div>
                <div className="text-center p-4 bg-background/50 rounded-lg">
                  <div className="text-2xl font-bold">{totalMembers}</div>
                  <p className="text-sm text-muted-foreground">Members</p>
                </div>
                <div className="text-center p-4 bg-background/50 rounded-lg">
                  <div className="text-2xl font-bold">{avgPointsPerMember}</div>
                  <p className="text-sm text-muted-foreground">Avg Points</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Content */}
          <Tabs defaultValue="members" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="challenges">Challenges</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
            </TabsList>

            {/* Members Tab */}
            <TabsContent value="members" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Team Members ({totalMembers}/{team.max_members})
                    </CardTitle>
                    <TeamMemberActions
                      teamId={params.id}
                      isTeamLeader={isTeamLeader}
                      isAdmin={userProfile?.is_admin || false}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {team.team_members?.map((member: any) => (
                      <div key={member.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.users?.avatar_url || "/placeholder.svg"} />
                          <AvatarFallback>
                            {member.users?.first_name?.[0]}
                            {member.users?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">
                              {member.users?.first_name} {member.users?.last_name}
                            </h3>
                            {member.role === "leader" && (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
                                <Crown className="h-3 w-3 mr-1" />
                                Leader
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{member.users?.department}</p>
                          <p className="text-xs text-muted-foreground">{member.users?.job_title}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{member.users?.points} pts</div>
                          <div className="text-xs text-muted-foreground">Level {member.users?.level}</div>
                          <div className="text-xs text-accent">{Math.round(member.users?.total_co2_saved)}kg CO₂</div>
                          <div className="text-xs text-muted-foreground">{member.users?.verified_actions} actions</div>
                        </div>
                        {member.role !== "leader" && (
                          <div className="relative">
                            <TeamMemberActions
                              teamId={params.id}
                              memberId={member.user_id}
                              memberName={`${member.users?.first_name} ${member.users?.last_name}`}
                              memberEmail={member.users?.email}
                              isTeamLeader={isTeamLeader}
                              isAdmin={userProfile?.is_admin || false}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Challenges Tab */}
            <TabsContent value="challenges" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Team Challenges</h2>
                {isTeamLeader && (
                  <Button asChild>
                    <Link href="/challenges/create">
                      <Target className="h-4 w-4 mr-2" />
                      Create Challenge
                    </Link>
                  </Button>
                )}
              </div>

              {teamChallenges && teamChallenges.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {teamChallenges
                    .reduce((unique: any[], participation: any) => {
                      const exists = unique.find((p) => p.challenges.id === participation.challenges.id)
                      if (!exists) {
                        unique.push(participation)
                      }
                      return unique
                    }, [])
                    .map((participation: any) => {
                      const challenge = participation.challenges
                      const progress = (participation.current_progress / challenge.target_value) * 100
                      const isActive = new Date(challenge.end_date) > new Date()

                      return (
                        <Card key={challenge.id} className={isActive ? "" : "opacity-75"}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-lg">{challenge.title}</CardTitle>
                                <CardDescription className="mt-1">{challenge.description}</CardDescription>
                              </div>
                              <Badge variant={isActive ? "default" : "secondary"}>
                                {isActive ? "Active" : "Completed"}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Progress</span>
                                <span className="font-medium">{Math.round(progress)}%</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                              <p className="text-xs text-muted-foreground">
                                {participation.current_progress} / {challenge.target_value} {challenge.target_metric}
                              </p>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span className="text-muted-foreground">
                                  Ends {new Date(challenge.end_date).toLocaleDateString()}
                                </span>
                              </div>
                              {challenge.reward_points && (
                                <div className="flex items-center gap-1">
                                  <Award className="h-3 w-3 text-primary" />
                                  <span className="text-primary font-medium">+{challenge.reward_points} pts</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="font-medium mb-2">No challenges yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This team hasn't participated in any challenges yet.
                    </p>
                    {isTeamLeader && (
                      <Button asChild>
                        <Link href="/challenges/create">Create First Challenge</Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Statistics Tab */}
            <TabsContent value="stats" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Team Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Points</span>
                      <span className="font-medium">{Math.round(team.total_points)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average per Member</span>
                      <span className="font-medium">{avgPointsPerMember}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total CO₂ Saved</span>
                      <span className="font-medium">{Math.round(team.total_co2_saved)}kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average CO₂ per Member</span>
                      <span className="font-medium">{avgCO2PerMember}kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Actions Completed</span>
                      <span className="font-medium">
                        {team.team_members?.reduce(
                          (sum: number, member: any) => sum + (member.users?.verified_actions || 0),
                          0,
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Team Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-medium">
                        {teamDetails?.created_at ? new Date(teamDetails.created_at).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Members</span>
                      <span className="font-medium">
                        {totalMembers} / {team.max_members}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={teamDetails?.is_active ? "default" : "secondary"}>
                        {teamDetails?.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Team Leader</span>
                      <span className="font-medium">
                        {team.team_members?.find((m: any) => m.role === "leader")?.users?.first_name}{" "}
                        {team.team_members?.find((m: any) => m.role === "leader")?.users?.last_name}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
