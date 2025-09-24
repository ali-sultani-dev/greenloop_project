"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Leaf, Mail, Lock, User, Building2, Award as IdCard, Briefcase, AlertCircle, Eye, EyeOff } from "lucide-react"
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter"
import { usePlatformSettings } from "@/hooks/use-platform-settings"

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    employeeId: "",
    department: "",
    jobTitle: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const router = useRouter()

  const { platform_name } = usePlatformSettings()

  const departments = [
    "Human Resources",
    "Engineering",
    "Marketing",
    "Sales",
    "Finance",
    "Operations",
    "Customer Support",
    "Legal",
    "IT",
    "Other",
  ]

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

        if (error) {
          console.error("Error fetching registration setting:", error)
          // Default to enabled if we can't fetch the setting
          setRegistrationEnabled(true)
        } else {
          const isEnabled = settings?.setting_value === "true" || settings?.setting_value === true
          setRegistrationEnabled(isEnabled)

          // If registration is disabled, redirect to login with message
          if (!isEnabled) {
            router.push("/auth/login?message=registration_disabled")
            return
          }
        }
      } catch (error) {
        console.error("Error checking registration setting:", error)
        // Default to enabled on error
        setRegistrationEnabled(true)
      } finally {
        setSettingsLoading(false)
      }
    }

    checkRegistrationSetting()
  }, [router])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      // Double-check registration is still enabled
      const { data: settings, error: settingsError } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("key", "user_registration_enabled")
        .single()

      if (!settingsError && settings) {
        const isEnabled = settings.setting_value === "true" || settings.setting_value === true
        if (!isEnabled) {
          setError("User registration is currently disabled. Please contact your administrator.")
          setIsLoading(false)
          return
        }
      }
    } catch (settingsError) {
      console.error("Error checking registration setting:", settingsError)
      // Continue with registration if we can't check the setting
    }

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long")
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/dashboard`,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            employee_id: formData.employeeId,
            department: formData.department,
            job_title: formData.jobTitle,
          },
        },
      })
      if (error) throw error
      router.push("/auth/verify-email")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Registration failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleMicrosoftSSO = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: settings, error: settingsError } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("key", "user_registration_enabled")
        .single()

      if (!settingsError && settings) {
        const isEnabled = settings.setting_value === "true" || settings.setting_value === true
        if (!isEnabled) {
          setError("User registration is currently disabled. Please contact your administrator.")
          setIsLoading(false)
          return
        }
      }

      // Redirect to custom Microsoft OAuth endpoint
      window.location.href = "/auth/microsoft"
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Microsoft SSO failed")
      setIsLoading(false)
    }
  }

  if (settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-accent/10 p-4">
        <Card className="w-full max-w-md shadow-lg border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <div className="p-2 bg-primary rounded-lg">
                <Leaf className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">{platform_name}</h1>
            </div>
            <CardDescription>Checking registration availability...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (registrationEnabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-accent/10 p-4">
        <Card className="w-full max-w-md shadow-lg border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <div className="p-2 bg-primary rounded-lg">
                <Leaf className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">{platform_name}</h1>
            </div>
            <div className="mx-auto p-3 bg-amber-100 rounded-full w-fit">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className="text-xl">Registration Unavailable</CardTitle>
            <CardDescription className="text-balance">
              New user registration is currently disabled. Please contact your administrator for access.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild className="w-full">
              <Link href="/auth/login">Back to Login</Link>
            </Button>
          </CardContent>
        </Card>
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
              <h1 className="text-2xl font-bold text-foreground">{platform_name}</h1>
            </div>
            <p className="text-muted-foreground text-balance">{"Join your company's sustainability initiative"}</p>
          </div>

          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-center">Create Account</CardTitle>
              <CardDescription className="text-center">
                {"Get started with your sustainability journey"}
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
                <Building2 className="mr-2 h-4 w-4" />
                {"Continue with Microsoft 365"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or register with email</span>
                </div>
              </div>

              {/* Registration Form */}
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-medium">
                      First Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange("firstName", e.target.value)}
                        className="pl-10 h-11 bg-input border-border focus:ring-2 focus:ring-ring"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      className="h-11 bg-input border-border focus:ring-2 focus:ring-ring"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="john.doe@company.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="pl-10 h-11 bg-input border-border focus:ring-2 focus:ring-ring"
                      required
                    />
                  </div>
                </div>

                {/* Employee Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="employeeId" className="text-sm font-medium">
                      Employee ID
                    </Label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="employeeId"
                        type="text"
                        placeholder="EMP001"
                        value={formData.employeeId}
                        onChange={(e) => handleInputChange("employeeId", e.target.value)}
                        className="pl-10 h-11 bg-input border-border focus:ring-2 focus:ring-ring"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department" className="text-sm font-medium">
                      Department
                    </Label>
                    <Select
                      value={formData.department}
                      onValueChange={(value) => handleInputChange("department", value)}
                    >
                      <SelectTrigger className="h-11 bg-input border-border focus:ring-2 focus:ring-ring">
                        <SelectValue placeholder="Select dept." />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Job Title */}
                <div className="space-y-2">
                  <Label htmlFor="jobTitle" className="text-sm font-medium">
                    Job Title
                  </Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="jobTitle"
                      type="text"
                      placeholder="Software Engineer"
                      value={formData.jobTitle}
                      onChange={(e) => handleInputChange("jobTitle", e.target.value)}
                      className="pl-10 h-11 bg-input border-border focus:ring-2 focus:ring-ring"
                      required
                    />
                  </div>
                </div>

                {/* Password Fields */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
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
                  {formData.password && <PasswordStrengthMeter password={formData.password} className="mt-2" />}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      className="pl-10 pr-10 h-11 bg-input border-border focus:ring-2 focus:ring-ring"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 text-sm text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded-md">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>

              <div className="text-center">
                <div className="text-sm text-muted-foreground">
                  {"Already have an account? "}
                  <Link
                    href="/auth/login"
                    className="text-primary hover:text-primary/80 underline-offset-4 hover:underline font-medium"
                  >
                    Sign in here
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-xs text-muted-foreground">
            {"By creating an account, you agree to our sustainability commitment and data privacy practices."}
          </div>
        </div>
      </div>
    </div>
  )
}
