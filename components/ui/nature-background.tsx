"use client"

import { useEffect, useState } from "react"

interface NatureBackgroundProps {
  className?: string
  season?: "spring" | "summer" | "autumn" | "winter"
}

export function NatureBackground({ className = "", season }: NatureBackgroundProps) {
  const [currentSeason, setCurrentSeason] = useState<string>(season || "spring")

  useEffect(() => {
    if (!season) {
      // Auto-detect season based on current month
      const month = new Date().getMonth()
      if (month >= 2 && month <= 4) setCurrentSeason("spring")
      else if (month >= 5 && month <= 7) setCurrentSeason("summer")
      else if (month >= 8 && month <= 10) setCurrentSeason("autumn")
      else setCurrentSeason("winter")
    }
  }, [season])

  const seasonalElements = {
    spring: (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-4 h-4 bg-pink-300 rounded-full opacity-30 animate-float" />
        <div className="absolute top-20 right-20 w-3 h-3 bg-green-300 rounded-full opacity-40 animate-leaf-sway" />
        <div className="absolute bottom-20 left-1/4 w-5 h-5 bg-yellow-300 rounded-full opacity-25 animate-float" />
      </div>
    ),
    summer: (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-16 right-16 w-6 h-6 bg-yellow-400 rounded-full opacity-20 animate-nature-pulse" />
        <div className="absolute bottom-32 left-16 w-4 h-4 bg-blue-300 rounded-full opacity-30 animate-float" />
      </div>
    ),
    autumn: (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-12 left-1/3 w-4 h-4 bg-orange-400 rounded-full opacity-35 animate-leaf-sway" />
        <div className="absolute bottom-24 right-1/3 w-3 h-3 bg-red-400 rounded-full opacity-30 animate-float" />
        <div className="absolute top-1/2 left-12 w-5 h-5 bg-yellow-600 rounded-full opacity-25 animate-leaf-sway" />
      </div>
    ),
    winter: (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-8 right-1/4 w-3 h-3 bg-blue-200 rounded-full opacity-40 animate-float" />
        <div className="absolute bottom-16 left-1/5 w-4 h-4 bg-white rounded-full opacity-30 animate-nature-pulse" />
      </div>
    ),
  }

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 nature-pattern opacity-50" />
      {seasonalElements[currentSeason as keyof typeof seasonalElements]}
    </div>
  )
}
