"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts"

const COLORS = [
  "#FF6B6B", // Coral Red
  "#4ECDC4", // Turquoise
  "#45B7D1", // Sky Blue
  "#96CEB4", // Mint Green
  "#FFEAA7", // Soft Yellow
  "#DDA0DD", // Plum
  "#98D8C8", // Seafoam
  "#F7DC6F", // Light Gold
  "#BB8FCE", // Lavender
  "#85C1E9", // Light Blue
  "#F8C471", // Peach
  "#82E0AA", // Light Green
]

interface TrendData {
  month: string
  users: number
  actions: number
}

interface CategoryData {
  name: string
  value: number
  color?: string
}

interface WeeklyData {
  day: string
  actions: number
}

interface UserStatsData {
  total_users: number
  active_users: number
  admin_users: number
  avg_points: number
  total_co2_saved: number
}

interface ChallengeStatsData {
  total_challenges: number
  active_challenges: number
  avg_completion_rate: number
  completed_challenges: number
}

interface TeamStatsData {
  total_teams: number
  active_teams: number
  avg_team_size: number
  top_performing_teams: Array<{
    name: string
    total_points: number
    total_co2_saved: number
  }>
}

interface DashboardChartsProps {
  trendData: TrendData[]
  categoryData: CategoryData[]
  weeklyData: WeeklyData[]
  userStats?: UserStatsData
  challengeStats?: ChallengeStatsData
  teamStats?: TeamStatsData
}

export function DashboardCharts({
  trendData,
  categoryData,
  weeklyData,
  userStats,
  challengeStats,
  teamStats,
}: DashboardChartsProps) {
  const filteredCategoryData = categoryData
    .filter((category) => category.value > 0)
    .map((category, index, array) => {
      const total = array.reduce((sum, cat) => sum + cat.value, 0)
      const percentage = total > 0 ? (category.value / total) * 100 : 0
      return {
        ...category,
        percentage: Math.round(percentage),
      }
    })
    .filter((category) => category.percentage >= 1) // Only show categories with at least 1%

  const formattedTrendData = trendData.map((item) => ({
    ...item,
    month: item.month.replace(/(\w+)\s*(\d{2})$/, "$1 20$2"),
  }))

  return (
    <div className="space-y-6">
      {(userStats || challengeStats || teamStats) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {userStats && (
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">User Statistics</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Total Users:</span>
                  <span className="font-medium">{userStats.total_users}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Active Users:</span>
                  <span className="font-medium text-green-600">{userStats.active_users}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Avg Points:</span>
                  <span className="font-medium">
                    {userStats.avg_points && !isNaN(userStats.avg_points) ? Math.round(userStats.avg_points) : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total CO₂ Saved:</span>
                  <span className="font-medium text-green-600">{userStats.total_co2_saved}kg</span>
                </div>
              </div>
            </div>
          )}

          {challengeStats && (
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Challenge Statistics</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Total Challenges:</span>
                  <span className="font-medium">{challengeStats.total_challenges}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Active:</span>
                  <span className="font-medium text-blue-600">{challengeStats.active_challenges}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Completion Rate:</span>
                  <span className="font-medium">{challengeStats.avg_completion_rate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Completed Challenges:</span>
                  <span className="font-medium">{challengeStats.completed_challenges}</span>
                </div>
              </div>
            </div>
          )}

          {teamStats && (
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Team Statistics</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Total Teams:</span>
                  <span className="font-medium">{teamStats.total_teams}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Active Teams:</span>
                  <span className="font-medium text-purple-600">{teamStats.active_teams}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Avg Team Size:</span>
                  <span className="font-medium">{teamStats.avg_team_size}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trends Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Monthly Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={formattedTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="users" stroke="#0088FE" strokeWidth={2} />
              <Line type="monotone" dataKey="actions" stroke="#00C49F" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Action Categories</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={filteredCategoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => {
                  return percentage >= 5 ? `${name} ${percentage}%` : ""
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {filteredCategoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value} actions`, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Activity Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Weekly Activity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="actions" fill="#0088FE" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {teamStats?.top_performing_teams && teamStats.top_performing_teams.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Top Performing Teams</h3>
          <div className="space-y-3">
            {teamStats.top_performing_teams.slice(0, 5).map((team, index) => (
              <div
                key={team.name}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      index === 0
                        ? "bg-yellow-500"
                        : index === 1
                          ? "bg-gray-400"
                          : index === 2
                            ? "bg-orange-500"
                            : "bg-primary"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{team.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {team.total_points} points • {team.total_co2_saved}kg CO₂ saved
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
