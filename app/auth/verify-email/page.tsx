import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Mail, Leaf, CheckCircle } from "lucide-react"

export default function VerifyEmailPage() {
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
          </div>

          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto p-3 bg-accent/10 rounded-full w-fit">
                <Mail className="h-8 w-8 text-accent" />
              </div>
              <CardTitle className="text-xl">Check Your Email</CardTitle>
              <CardDescription className="text-balance">
                {
                  "We've sent a verification link to your email address. Please check your inbox and click the link to activate your account."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle className="h-4 w-4 text-accent" />
                  {"What's next?"}
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                  <li>{"• Check your email inbox (and spam folder)"}</li>
                  <li>{"• Click the verification link"}</li>
                  <li>{"• Complete your profile setup"}</li>
                  <li>{"• Start your sustainability journey!"}</li>
                </ul>
              </div>

              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">{"Didn't receive the email?"}</p>
                <Button variant="outline" className="w-full bg-transparent">
                  {"Resend Verification Email"}
                </Button>
              </div>

              <div className="text-center">
                <Link
                  href="/auth/login"
                  className="text-sm text-primary hover:text-primary/80 underline-offset-4 hover:underline"
                >
                  {"Back to Sign In"}
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-xs text-muted-foreground">
            {"Having trouble? Contact your IT administrator for assistance."}
          </div>
        </div>
      </div>
    </div>
  )
}
