"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import { Award, Leaf, Target, Star } from "lucide-react"

interface EcoMetricCardProps {
  title: string
  value: number
  suffix?: string
  icon: "award" | "leaf" | "target" | "star"
  description?: string
  trend?: "up" | "down" | "neutral"
  className?: string
}

export function EcoMetricCard({
  title,
  value,
  suffix = "",
  icon,
  description,
  trend = "neutral",
  className = "",
}: EcoMetricCardProps) {
  const trendColors = {
    up: "text-chart-1",
    down: "text-destructive",
    neutral: "text-muted-foreground",
  }

  const iconComponents = {
    award: Award,
    leaf: Leaf,
    target: Target,
    star: Star,
  }

  const IconComponent = iconComponents[icon]

  return (
    <Card className={`organic-card leaf-shadow hover-lift animate-organic-slide-up ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-balance">{title}</CardTitle>
        <div className="p-2 bg-primary/10 rounded-full animate-nature-pulse">
          <IconComponent className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-primary">
            <AnimatedCounter value={value} suffix={suffix} />
          </div>
          {description && <p className={`text-xs ${trendColors[trend]} flex items-center gap-1`}>{description}</p>}
          <div className="eco-progress h-1 w-full">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, (value / 1000) * 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
