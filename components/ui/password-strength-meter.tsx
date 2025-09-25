"use client"

import { useMemo } from "react"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface PasswordStrengthMeterProps {
  password: string
  className?: string
}

interface PasswordRequirement {
  label: string
  test: (password: string) => boolean
}

const requirements: PasswordRequirement[] = [
  {
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
  },
  {
    label: "Contains lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    label: "Contains uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    label: "Contains number",
    test: (password) => /\d/.test(password),
  },
]

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  const { strength, score, color } = useMemo(() => {
    if (!password) {
      return { strength: "Enter password", score: 0, color: "bg-muted" }
    }

    const passedRequirements = requirements.filter((req) => req.test(password))
    const score = passedRequirements.length

    let strength: string
    let color: string

    switch (score) {
      case 0:
      case 1:
        strength = "Very Weak"
        color = "bg-red-500"
        break
      case 2:
        strength = "Weak"
        color = "bg-orange-500"
        break
      case 3:
        strength = "Good"
        color = "bg-yellow-500"
        break
      case 4:
        strength = "Strong"
        color = "bg-green-500"
        break
      default:
        strength = "Enter password"
        color = "bg-muted"
    }

    return { strength, score, color }
  }, [password])

  return (
    <div className={cn("space-y-3", className)}>
      {/* Strength Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-muted-foreground">Password Strength</span>
          <span
            className={cn("text-xs font-medium", {
              "text-red-600": score <= 1,
              "text-orange-600": score === 2,
              "text-yellow-600": score === 3,
              "text-green-600": score === 4,
              "text-muted-foreground": score === 0 && !password,
            })}
          >
            {strength}
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn("h-2 flex-1 rounded-full transition-colors", {
                [color]: score >= level,
                "bg-muted": score < level,
              })}
            />
          ))}
        </div>
      </div>

      {/* Requirements List */}
      {password && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Requirements</span>
          <div className="space-y-1">
            {requirements.map((requirement, index) => {
              const passed = requirement.test(password)
              return (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <div
                    className={cn("flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center", {
                      "bg-green-100 text-green-600": passed,
                      "bg-muted text-muted-foreground": !passed,
                    })}
                  >
                    {passed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  </div>
                  <span
                    className={cn({
                      "text-green-600": passed,
                      "text-muted-foreground": !passed,
                    })}
                  >
                    {requirement.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
