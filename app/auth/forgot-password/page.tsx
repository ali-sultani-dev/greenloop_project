"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState } from "react"
import { Leaf, Mail, ArrowLeft } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      setIsSubmitted(true)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to send reset email")
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-accent/10 p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="p-2 bg-primary rounded-lg">
                  <Leaf className="h-6 w-6 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">GreenLoop</h1>
              </div>
            </div>

            <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
              <CardHeader className="text-center space-y-4">
                <div className="mx-auto p-3 bg-accent/10 rounded-full w-fit">
                  <Mail className="h-8 w-8 text-accent" />
                </div>
                <CardTitle className="text-xl">Check Your Email</CardTitle>
                <CardDescription className="text-balance">
                  {
                    "We've sent a password reset link to your email address. Please check your inbox and follow the instructions."
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Link href="/auth/login">
                  <Button variant="outline" className="w-full bg-transparent">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {"Back to Sign In"}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-accent/10 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          {/* Logo and Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="p-2 bg-primary rounded-lg">
                <Leaf className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">GreenLoop</h1>
            </div>
            <p className="text-muted-foreground text-balance">
              {"Reset your password to continue your sustainability journey"}
            </p>
          </div>

          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-center">Reset Password</CardTitle>
              <CardDescription className="text-center">
                {"Enter your email address and we'll send you a reset link"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 bg-input border-border focus:ring-2 focus:ring-ring"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90" disabled={isLoading}>
                  {isLoading ? "Sending reset link..." : "Send Reset Link"}
                </Button>
              </form>

              <div className="text-center mt-4">
                <Link
                  href="/auth/login"
                  className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  {"Back to Sign In"}
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
