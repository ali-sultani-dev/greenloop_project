"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { InteractiveSearch } from "@/components/admin/interactive-search"
import { UserCrudModal } from "@/components/admin/user-crud-modal"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  Users,
  Plus,
  Mail,
  TrendingUp,
  MoreHorizontal,
  Eye,
  Edit,
  UserCheck,
  UserX,
  Shield,
  ShieldOff,
  Trash2,
} from "lucide-react"

interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  department: string
  points: number
  level: number
  total_co2_saved: number
  is_active: boolean
  is_admin: boolean
  last_login: string
  created_at: string
  team_members?: { teams: { name: string } }[]
  team_name?: string
  total_points?: number
  total_actions?: number
  verified_actions?: number
  employee_id?: string
  job_title?: string
  phone?: string
  date_joined?: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [modalMode, setModalMode] = useState<"view" | "edit" | "create">("create")
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number
    bottom?: number
    left?: number
    right?: number
  }>({})

  const { toast } = useToast()
  const supabase = createClient()

  const loadData = async () => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user) {
        window.location.href = "/auth/login"
        return
      }

      const { data: profile } = await supabase.from("users").select("*").eq("id", authData.user.id).single()

      if (!profile?.is_admin) {
        window.location.href = "/dashboard"
        return
      }

      setUserProfile(profile)

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select(`
          *,
          team_members(
            teams(
              name
            )
          )
        `)
        .order("created_at", { ascending: false })

      if (usersError) {
        console.error("Error fetching users:", usersError)
        const { data: basicUsers } = await supabase.from("users").select("*").order("created_at", { ascending: false })
        setUsers(basicUsers || [])
        setFilteredUsers(basicUsers || [])
      } else {
        const processedUsers = await Promise.all(
          usersData.map(async (user) => {
            const { count: totalActions } = await supabase
              .from("user_actions")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)

            const { count: verifiedActions } = await supabase
              .from("user_actions")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("verification_status", "approved")

            return {
              ...user,
              team_name: user.team_members?.[0]?.teams?.name || null,
              total_points: user.points || 0,
              total_actions: totalActions || 0,
              verified_actions: verifiedActions || 0,
            }
          }),
        )

        setUsers(processedUsers)
        setFilteredUsers(processedUsers)
      }
    } catch (error) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: "Failed to load user data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    const csvContent = [
      [
        "Name",
        "Email",
        "Department",
        "Team",
        "Points",
        "Level",
        "CO2 Saved",
        "Status",
        "Actions",
        "Verified Actions",
      ].join(","),
      ...filteredUsers.map((user) =>
        [
          `"${user.first_name} ${user.last_name}"`,
          user.email,
          user.department || "Not Set",
          user.team_name || "No Team",
          user.total_points || 0,
          user.level || 1,
          user.total_co2_saved || 0,
          user.is_active ? "Active" : "Inactive",
          user.total_actions || 0,
          user.verified_actions || 0,
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `users-export-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleCreateUser = () => {
    setSelectedUser(null)
    setModalMode("create")
    setModalOpen(true)
  }

  const handleViewUser = async (user: User) => {
    const { data: fullUserData } = await supabase.from("users").select("*").eq("id", user.id).single()

    if (fullUserData) {
      setSelectedUser({ ...user, ...fullUserData })
      setModalMode("view")
      setModalOpen(true)
    }
  }

  const handleEditUser = async (user: User) => {
    const { data: fullUserData } = await supabase.from("users").select("*").eq("id", user.id).single()

    if (fullUserData) {
      setSelectedUser({ ...user, ...fullUserData })
      setModalMode("edit")
      setModalOpen(true)
    }
  }

  const handleUserAction = async (action: string, user: User) => {
    console.log("-> Handling action:", action, "for user:", user.email)
    setOpenDropdown(null)

    switch (action) {
      case "edit":
        await handleEditUser(user)
        break
      case "view":
        await handleViewUser(user)
        break
      case "toggle-status":
        await supabase.from("users").update({ is_active: !user.is_active }).eq("id", user.id)
        toast({
          title: "Success",
          description: `User ${user.is_active ? "deactivated" : "activated"} successfully`,
        })
        loadData()
        break
      case "toggle-admin":
        await supabase.from("users").update({ is_admin: !user.is_admin }).eq("id", user.id)
        toast({
          title: "Success",
          description: `Admin privileges ${user.is_admin ? "removed" : "granted"} successfully`,
        })
        loadData()
        break
      case "reset-password":
        toast({
          title: "Feature Coming Soon",
          description: "Password reset functionality will be available in the next update.",
        })
        break
      case "delete":
        if (confirm(`Are you sure you want to delete ${user.first_name} ${user.last_name}?`)) {
          await supabase.from("users").delete().eq("id", user.id)
          toast({
            title: "Success",
            description: "User deleted successfully",
          })
          loadData()
        }
        break
    }
  }

  const filterOptions = [
    {
      key: "department",
      label: "Department",
      values: [...new Set(users.map((u) => u.department).filter((dept): dept is string => Boolean(dept)))].sort(),
    },
    {
      key: "is_active",
      label: "Status",
      values: ["true", "false"],
    },
    {
      key: "team_name",
      label: "Team",
      values: [...new Set(users.map((u) => u.team_name).filter((team): team is string => Boolean(team)))].sort(),
    },
    {
      key: "level",
      label: "Level",
      values: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    },
  ]

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdown(null)
    }

    if (openDropdown) {
      document.addEventListener("click", handleClickOutside)
      return () => document.removeEventListener("click", handleClickOutside)
    }
  }, [openDropdown])

  const toggleDropdown = (userId: string, event?: React.MouseEvent) => {
    console.log("-> Toggling dropdown for user:", userId)

    if (openDropdown === userId) {
      setOpenDropdown(null)
      return
    }

    if (event) {
      const rect = (event.target as HTMLElement).getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const dropdownWidth = 192 // w-48 = 12rem = 192px
      const dropdownHeight = 240 // approximate height of dropdown

      const position: { top?: number; bottom?: number; left?: number; right?: number } = {}

      if (rect.right + dropdownWidth > viewportWidth) {
        position.right = viewportWidth - rect.left
      } else {
        position.left = rect.right
      }

      if (rect.bottom + dropdownHeight > viewportHeight) {
        position.bottom = viewportHeight - rect.top
      } else {
        position.top = rect.bottom
      }

      setDropdownPosition(position)
    }

    setOpenDropdown(userId)
  }

  if (loading) {
    return (
      <main className="flex-1 p-8">
        <div className="text-center">Loading...</div>
      </main>
    )
  }

  return (
    <main className="flex-1 p-8">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              User Management
            </h1>
            <p className="text-muted-foreground">
              Manage user accounts, permissions, and monitor engagement across the platform.
            </p>
          </div>
          <Button onClick={handleCreateUser}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Users</CardTitle>
            <CardDescription>Find and filter users by name, email, department, or performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <InteractiveSearch
              data={users}
              onFilteredData={setFilteredUsers}
              searchFields={["first_name", "last_name", "email", "department"]}
              filterOptions={filterOptions}
              placeholder="Search by name, email, or department..."
              onExport={handleExport}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Users ({filteredUsers.length})</CardTitle>
            <CardDescription>
              Complete list of platform users with their activity and engagement metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>CO₂ Saved</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={`/abstract-geometric-shapes.png?key=65fp2&height=40&width=40&query=${user.first_name}+${user.last_name}`}
                          />
                          <AvatarFallback>
                            {user.first_name?.[0]}
                            {user.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {user.first_name} {user.last_name}
                            {user.is_admin && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Admin
                              </Badge>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.department || "Not Set"}</Badge>
                    </TableCell>
                    <TableCell>
                      {user.team_name ? (
                        <Badge variant="secondary">{user.team_name}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">No Team</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Level {user.level || 1}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{user.total_points || 0}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">{user.total_actions || 0}</span>
                        <span className="text-muted-foreground"> total</span>
                        <br />
                        <span className="text-green-600 font-medium">{user.verified_actions || 0}</span>
                        <span className="text-muted-foreground"> verified</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-green-600">{user.total_co2_saved || 0}kg</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleDropdown(user.id, e)
                          }}
                          className="p-2 hover:bg-gray-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {openDropdown === user.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                            <div
                              className="fixed w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50"
                              style={{
                                top: dropdownPosition.top,
                                bottom: dropdownPosition.bottom,
                                left: dropdownPosition.left,
                                right: dropdownPosition.right,
                              }}
                            >
                              <div className="py-1">
                                <button
                                  onClick={() => handleUserAction("view", user)}
                                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <Eye className="h-4 w-4" />
                                  View Details
                                </button>
                                <button
                                  onClick={() => handleUserAction("edit", user)}
                                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit User
                                </button>
                                <button
                                  onClick={() => handleUserAction("toggle-status", user)}
                                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  {user.is_active ? (
                                    <>
                                      <UserX className="h-4 w-4" />
                                      Deactivate User
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-4 w-4" />
                                      Activate User
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleUserAction("toggle-admin", user)}
                                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  {user.is_admin ? (
                                    <>
                                      <ShieldOff className="h-4 w-4" />
                                      Remove Admin Role
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="h-4 w-4" />
                                      Promote to Admin
                                    </>
                                  )}
                                </button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                  onClick={() => handleUserAction("delete", user)}
                                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete User
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <UserCrudModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        user={selectedUser}
        mode={modalMode}
        onSuccess={loadData}
        currentAdminId={userProfile?.id}
      />
    </main>
  )
}
