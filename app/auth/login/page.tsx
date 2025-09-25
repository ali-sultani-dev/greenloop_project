"use client"

import type React from "react"
import { usePlatformSettings } from "@/hooks/use-platform-settings"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Leaf, Mail, Lock, Building2, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean>(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  const { platform_name } = usePlatformSettings()

  useEffect(() => {
    async function checkRegistrationSetting() {
      try {
        const supabase = createClient()

        // Check if user registration is enabled
        const { data: settings, error } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("key", "user_registration_enabled")
          .single()

        if (!error && settings) {
          const isEnabled = settings.setting_value === "true" || settings.setting_value === true
          setRegistrationEnabled(isEnabled)
        }
      } catch (error) {
        console.error("Error checking registration setting:", error)
        // Default to enabled on error
        setRegistrationEnabled(true)
      }
    }

    checkRegistrationSetting()

    // Handle URL messages
    const message = searchParams.get("message")
    if (message === "registration_disabled") {
      setError("User registration is currently disabled. Please contact your administrator for access.")
    } else if (message === "verification_complete") {
      setError("Email verification complete! Please sign in with your credentials.")
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push("/dashboard")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleMicrosoftSSO = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Redirect to custom Microsoft OAuth endpoint
      window.location.href = "/auth/microsoft"
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Microsoft SSO failed")
      setIsLoading(false)
    }
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
              <h1 className="text-2xl font-bold text-foreground">{platform_name}</h1>
            </div>
            <p className="text-muted-foreground text-balance">{"Welcome back to your sustainability journey"}</p>
          </div>

          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-center">Sign In</CardTitle>
              <CardDescription className="text-center">
                {"Access your employee sustainability dashboard"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Microsoft SSO Button */}
              <Button
                onClick={handleMicrosoftSSO}
                variant="outline"
                className="w-full h-11 border-border hover:bg-accent/10 bg-transparent"
                disabled={isLoading}
              >
                <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                {"Continue with Microsoft 365"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                </div>
              </div>

              {/* Email/Password Form */}
              <form onSubmit={handleLogin} className="space-y-4">
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

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 bg-input border-border focus:ring-2 focus:ring-ring"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              <div className="text-center space-y-2">
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </Link>
                <div className="text-sm text-muted-foreground">
                  {"Don't have an account? "}
                  {registrationEnabled ? (
                    <Link
                      href="/auth/register"
                      className="text-primary hover:text-primary/80 underline-offset-4 hover:underline font-medium"
                    >
                      Register here
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Registration is currently disabled</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-xs text-muted-foreground">
            {"By signing in, you agree to our sustainability commitment and data privacy practices."}
          </div>
        </div>
      </div>
    </div>
  )
}
