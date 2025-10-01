"use client"

import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts"

interface MonthlyProgressChartProps {
  data: Array<{
    month: string
    actions: number
    points: number
    co2: number
  }>
}

const formatMonthDisplay = (monthStr: string) => {
  try {
    // If it's already in "MMM YYYY" format, return as is
    if (monthStr.match(/^[A-Za-z]{3} \d{4}$/)) {
      return monthStr
    }

    // If it's in "YYYY-MM" format, convert to "MMM YYYY"
    if (monthStr.match(/^\d{4}-\d{2}$/)) {
      const [year, month] = monthStr.split("-")
      const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1)
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    }

    // Try to parse as date and format, but ensure we use current year if parsing fails
    const date = new Date(monthStr)
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
      return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    }

    // If all else fails, try to extract month and use current year
    const currentYear = new Date().getFullYear()
    const monthMatch = monthStr.match(/(\w{3})/i)
    if (monthMatch) {
      return `${monthMatch[1]} ${currentYear}`
    }

    return monthStr
  } catch {
    return monthStr
  }
}

export function MonthlyProgressChart({ data }: MonthlyProgressChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <p>No data available yet. Complete some actions to see your progress!</p>
      </div>
    )
  }

  const formattedData = data.map((item) => ({
    ...item,
    month: formatMonthDisplay(item.month),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={formattedData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="actions"
          stackId="1"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="points"
          stackId="2"
          stroke="hsl(var(--accent))"
          fill="hsl(var(--accent))"
          fillOpacity={0.6}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
