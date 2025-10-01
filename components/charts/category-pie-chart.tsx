"use client"

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts"

interface CategoryPieChartProps {
  data: Array<{
    name: string
    value: number
    co2: number
    color: string
  }>
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <p>No data available yet. Complete some actions to see your categories!</p>
      </div>
    )
  }

  const enhancedColors = [
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

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || enhancedColors[index % enhancedColors.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}
