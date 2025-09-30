import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Plus, Crown, Target, Calendar, UserPlus } from "lucide-react"
import Link from "next/link"

export default async function TeamsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Get user profile
  const { data: userProfile } = await supabase.from("users").select("*").eq("id", data.user.id).single()

  const { data: settings } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("key", "team_creation_enabled")
    .single()

  const teamCreationEnabled = settings?.setting_value === "true"

  const { data: maxTeamSizeSetting } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("key", "max_team_size")
    .single()
  const systemMaxTeamSize = Number.parseInt(maxTeamSizeSetting?.setting_value || "10")

  // Get user's current team memberships (can be multiple)
  const { data: userTeamMemberships } = await supabase
    .from("team_members")
    .select(`
      *,
      teams (
        *,
        team_members (
          *,
          users (id, first_name, last_name, avatar_url, points, total_co2_saved)
        )
      )
    `)
    .eq("user_id", data.user.id)

  // Get all teams for browsing
  const { data: allTeams } = await supabase
    .from("teams")
    .select(`
      *,
      team_members (
        id,
        users (id, first_name, last_name, avatar_url)
      )
    `)
    .eq("is_active", true)
    .order("total_points", { ascending: false })
    .limit(12)

  let teamChallenges = null
  if (userTeamMemberships && userTeamMemberships.length > 0) {
    const { data: challenges } = await supabase
      .from("challenge_participants")
      .select(`
        id,
        current_progress,
        completed,
        joined_at,
        challenges!inner (
          id,
          title,
          description,
          target_value,
          end_date
        )
      `)
      .eq("team_id", userTeamMemberships[0].teams.id)
      .order("joined_at", { ascending: false })
      .limit(3)

    const uniqueChallenges = challenges?.reduce((unique: any[], participation: any) => {
      const exists = unique.find((p) => p.challenges.id === participation.challenges.id)
      if (!exists) {
        unique.push(participation)
      }
      return unique
    }, [])

    teamChallenges = uniqueChallenges
  }

  const userTeam = userTeamMemberships && userTeamMemberships.length > 0 ? userTeamMemberships[0].teams : null
  const isTeamLeader = userTeam?.team_leader_id === data.user.id
  const isAdmin = userProfile?.is_admin || false
  const hasMultipleTeams = userTeamMemberships && userTeamMemberships.length > 1

  const userTeamIds = userTeamMemberships?.map((membership) => membership.teams.id) || []

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={userProfile} />

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                Teams
              </h1>
              <p className="text-muted-foreground text-balance">
                Join forces with colleagues to amplify your sustainability impact through teamwork and friendly
                competition.
              </p>
            </div>
            <div className="flex gap-3">
              {isAdmin && (
                <Button variant="outline" asChild>
                  <Link href="/admin/teams">
                    <Crown className="h-4 w-4 mr-2" />
                    Admin Panel
                  </Link>
                </Button>
              )}
              {teamCreationEnabled && (
                <Button asChild>
                  <Link href="/teams/create">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Team
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* User's Team Section */}
          {userTeam ? (
            <div className="space-y-6">
              <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{userTeam.name}</CardTitle>
                        <CardDescription>{userTeam.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {isTeamLeader && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          <Crown className="h-3 w-3 mr-1" />
                          Leader
                        </Badge>
                      )}
                      {!isTeamLeader && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          Member
                        </Badge>
                      )}
                      {hasMultipleTeams && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          +{userTeamMemberships.length - 1} more team{userTeamMemberships.length > 2 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Team Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-background/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{userTeam.total_points}</div>
                      <p className="text-sm text-muted-foreground">Total Points</p>
                    </div>
                    <div className="text-center p-4 bg-background/50 rounded-lg">
                      <div className="text-2xl font-bold text-accent">{userTeam.total_co2_saved}kg</div>
                      <p className="text-sm text-muted-foreground">CO₂ Saved</p>
                    </div>
                    <div className="text-center p-4 bg-background/50 rounded-lg">
                      <div className="text-2xl font-bold">{userTeam.team_members?.length || 0}</div>
                      <p className="text-sm text-muted-foreground">Members</p>
                    </div>
                  </div>

                  {/* Team Members */}
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Team Members
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {userTeam.team_members?.slice(0, 8).map((member: any) => (
                        <div key={member.id} className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.users?.avatar_url || "/placeholder.svg"} />
                            <AvatarFallback className="text-xs">
                              {member.users?.first_name?.[0]}
                              {member.users?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {member.users?.first_name} {member.users?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">{member.users?.points} pts</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button asChild>
                      <Link href={`/teams/${userTeam.id}`}>View Team Dashboard</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Active Team Challenges */}
              {teamChallenges && teamChallenges.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Active Team Challenges
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {teamChallenges.map((participation: any) => {
                        const challenge = participation.challenges
                        const progress = (participation.current_progress / challenge.target_value) * 100

                        return (
                          <div key={participation.id} className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-medium mb-2">{challenge.title}</h4>
                            <div className="space-y-2">
                              <Progress value={progress} className="h-2" />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>
                                  {participation.current_progress} / {challenge.target_value}
                                </span>
                                <span>{Math.round(progress)}%</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              <Calendar className="h-3 w-3" />
                              <span className="text-xs text-muted-foreground">
                                Ends {new Date(challenge.end_date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            /* No Team - Browse Teams */
            <Card>
              <CardHeader>
                <CardTitle>Team Membership</CardTitle>
                <CardDescription>
                  {!teamCreationEnabled
                    ? "Team creation is currently disabled. Contact your administrator to join a team."
                    : "You're not currently part of a team. Team membership is managed by administrators - contact your admin to join a team, or create your own team to lead."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {teamCreationEnabled && (
                    <Button asChild>
                      <Link href="/teams/create">
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Team
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline">Browse Teams Below</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Teams</TabsTrigger>
              {userTeamMemberships && userTeamMemberships.length > 0 && (
                <TabsTrigger value="your-teams">Your Teams ({userTeamMemberships.length})</TabsTrigger>
              )}
              <TabsTrigger value="available-teams">Available Teams</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <h2 className="text-2xl font-bold">All Teams</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allTeams?.map((team) => {
                  const effectiveMaxMembers = Math.min(team.max_members, systemMaxTeamSize)
                  const currentMembers = team.team_members?.length || 0
                  const isTeamFull = currentMembers >= effectiveMaxMembers
                  const isUserTeam = userTeamIds.includes(team.id)

                  return (
                    <Card key={team.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{team.name}</CardTitle>
                            <CardDescription className="mt-1">{team.description}</CardDescription>
                          </div>
                          {isUserTeam && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              Your Team
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Team Stats */}
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div>
                            <div className="text-lg font-bold text-primary">{team.total_points}</div>
                            <p className="text-xs text-muted-foreground">Points</p>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-accent">{team.total_co2_saved}kg</div>
                            <p className="text-xs text-muted-foreground">CO₂ Saved</p>
                          </div>
                        </div>

                        {/* Team Members Preview */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {currentMembers} / {effectiveMaxMembers} members
                            </span>
                            {isTeamFull && (
                              <Badge variant="secondary" className="text-xs">
                                Full
                              </Badge>
                            )}
                          </div>
                          <div className="flex -space-x-2">
                            {team.team_members?.slice(0, 5).map((member: any, index: number) => (
                              <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                                <AvatarImage src={member.users?.avatar_url || "/placeholder.svg"} />
                                <AvatarFallback className="text-xs">
                                  {member.users?.first_name?.[0]}
                                  {member.users?.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {currentMembers > 5 && (
                              <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                <span className="text-xs font-medium">+{currentMembers - 5}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Button */}
                        <Button variant="default" className="w-full" asChild disabled={isTeamFull && !isUserTeam}>
                          <Link href={`/teams/${team.id}`}>{isUserTeam ? "View Dashboard" : "View Team"}</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>

            {userTeamMemberships && userTeamMemberships.length > 0 && (
              <TabsContent value="your-teams" className="space-y-4">
                <h2 className="text-2xl font-bold">Your Teams</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {userTeamMemberships.map((membership) => {
                    const team = membership.teams
                    const effectiveMaxMembers = Math.min(team.max_members, systemMaxTeamSize)
                    const currentMembers = team.team_members?.length || 0
                    const isTeamFull = currentMembers >= effectiveMaxMembers

                    return (
                      <Card key={team.id} className="hover:shadow-md transition-shadow border-primary/20">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{team.name}</CardTitle>
                              <CardDescription className="mt-1">{team.description}</CardDescription>
                            </div>
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              Your Team
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Team Stats */}
                          <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                              <div className="text-lg font-bold text-primary">{team.total_points}</div>
                              <p className="text-sm text-muted-foreground">Points</p>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-accent">{team.total_co2_saved}kg</div>
                              <p className="text-sm text-muted-foreground">CO₂ Saved</p>
                            </div>
                          </div>

                          {/* Team Members Preview */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {currentMembers} / {effectiveMaxMembers} members
                              </span>
                            </div>
                            <div className="flex -space-x-2">
                              {team.team_members?.slice(0, 5).map((member: any, index: number) => (
                                <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                                  <AvatarImage src={member.users?.avatar_url || "/placeholder.svg"} />
                                  <AvatarFallback className="text-xs">
                                    {member.users?.first_name?.[0]}
                                    {member.users?.last_name?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {currentMembers > 5 && (
                                <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                  <span className="text-xs font-medium">+{currentMembers - 5}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <Button variant="default" className="w-full" asChild>
                            <Link href={`/teams/${team.id}`}>View Dashboard</Link>
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </TabsContent>
            )}

            <TabsContent value="available-teams" className="space-y-4">
              <h2 className="text-2xl font-bold">Available Teams</h2>
              <p className="text-muted-foreground">Teams you can explore and potentially join.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allTeams
                  ?.filter((team) => !userTeamIds.includes(team.id))
                  .map((team) => {
                    const effectiveMaxMembers = Math.min(team.max_members, systemMaxTeamSize)
                    const currentMembers = team.team_members?.length || 0
                    const isTeamFull = currentMembers >= effectiveMaxMembers

                    return (
                      <Card key={team.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{team.name}</CardTitle>
                              <CardDescription className="mt-1">{team.description}</CardDescription>
                            </div>
                            {isTeamFull && (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                Full
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Team Stats */}
                          <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                              <div className="text-lg font-bold text-primary">{team.total_points}</div>
                              <p className="text-xs text-muted-foreground">Points</p>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-accent">{team.total_co2_saved}kg</div>
                              <p className="text-xs text-muted-foreground">CO₂ Saved</p>
                            </div>
                          </div>

                          {/* Team Members Preview */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {currentMembers} / {effectiveMaxMembers} members
                              </span>
                            </div>
                            <div className="flex -space-x-2">
                              {team.team_members?.slice(0, 5).map((member: any, index: number) => (
                                <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                                  <AvatarImage src={member.users?.avatar_url || "/placeholder.svg"} />
                                  <AvatarFallback className="text-xs">
                                    {member.users?.first_name?.[0]}
                                    {member.users?.last_name?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {currentMembers > 5 && (
                                <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                  <span className="text-xs font-medium">+{currentMembers - 5}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Button */}
                          <Button variant="outline" className="w-full bg-transparent" asChild>
                            <Link href={`/teams/${team.id}`}>View Team</Link>
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
              </div>
              {allTeams?.filter((team) => !userTeamIds.includes(team.id)).length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="font-medium mb-2">No available teams</h3>
                    <p className="text-sm text-muted-foreground">
                      You're already a member of all available teams, or there are no other teams to join.
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
