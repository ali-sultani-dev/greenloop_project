"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Leaf, Users, BarChart3, Target, Award, ArrowRight, CheckCircle, Zap } from "lucide-react"
import { usePlatformSettings } from "@/hooks/use-platform-settings"

export default function LandingPage() {
  const { platform_name, company_name } = usePlatformSettings()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="sticky top-0 z-50 w-full border-b border-border backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={{ backgroundColor: "#469cd3" }}
      >
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white">{platform_name}</span>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-white hover:bg-white/20 hover:text-white" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button className="bg-white text-[#469cd3] hover:bg-white/90" asChild>
              <Link href="/auth/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="h-screen min-h-[600px] flex items-center relative overflow-hidden"
        style={{ backgroundColor: "#469cd3" }}
      >
        <div className="container px-4 mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center h-full">
            {/* Left side - Text content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl lg:text-6xl font-bold text-balance leading-tight text-white">
                  Fighting for Fair, <span className="text-yellow-300">Building a Sustainable Future</span>
                </h1>
                <p className="text-xl text-white/90 text-pretty max-w-lg">
                  Join {company_name} in supporting a low-carbon economy, digital equity, and stronger communities.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="text-lg px-8 bg-white text-[#469cd3] hover:bg-white/90" asChild>
                  <Link href="/auth/register">
                    Join the Movement
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 bg-transparent border-white text-white hover:bg-white/10"
                  asChild
                >
                  <Link href="/auth/login">Sign In</Link>
                </Button>
              </div>

              <div className="flex items-center gap-8 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-300">21%</div>
                  <div className="text-sm text-white/80">Reduction in emissions since FY22</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-300">10,400+</div>
                  <div className="text-sm text-white/80">Phones traded-in or recycled</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-300">1,495+</div>
                  <div className="text-sm text-white/80">Volunteer hours through Fair Days</div>
                </div>
              </div>
            </div>

            {/* Right side - Ice block image */}
            <div className="flex justify-center lg:justify-end">
              <img
                src="/ice-block-phone.webp"
                alt="Phone frozen in ice block representing climate action"
                className="max-w-full h-auto max-h-[500px] object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container px-4 mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-balance">Why Choose {platform_name}?</h2>
            <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
              Our sustainability approach is built on four key pillars that drive meaningful change for the environment,
              community, and our team.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: "#469cd320" }}
                >
                  <Leaf className="h-6 w-6" style={{ color: "#469cd3" }} />
                </div>
                <CardTitle>Care for the Environment</CardTitle>
                <CardDescription>
                  Net Zero by 2040, 100% renewable energy by 2030. Leading the charge towards a sustainable future.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: "#469cd320" }}
                >
                  <Users className="h-6 w-6" style={{ color: "#469cd3" }} />
                </div>
                <CardTitle>Step Up for the Community</CardTitle>
                <CardDescription>
                  Digital equity, First Phones program, and volunteering initiatives that strengthen communities.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: "#469cd320" }}
                >
                  <Target className="h-6 w-6" style={{ color: "#469cd3" }} />
                </div>
                <CardTitle>Partner for Good</CardTitle>
                <CardDescription>
                  Ethical suppliers, science-based targets, and partnerships that create positive impact.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: "#469cd320" }}
                >
                  <Award className="h-6 w-6" style={{ color: "#469cd3" }} />
                </div>
                <CardTitle>Empower a Thriving Team</CardTitle>
                <CardDescription>
                  Inclusion, diversity, women in leadership, and creating an environment where everyone thrives.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="container px-4 mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-balance">How It Works</h2>
            <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
              Join {company_name}'s community sustainability hub and start making a difference in three simple steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-white"
                style={{ backgroundColor: "#469cd3" }}
              >
                1
              </div>
              <h3 className="text-xl font-semibold">Join the Movement</h3>
              <p className="text-muted-foreground">
                Sign up with {company_name}'s community sustainability hub and become part of our mission for a fairer
                future.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-white"
                style={{ backgroundColor: "#469cd3" }}
              >
                2
              </div>
              <h3 className="text-xl font-semibold">Take Climate & Community Action</h3>
              <p className="text-muted-foreground">
                Participate in EV transition, e-waste recycling, Fair Days volunteering, and other impactful
                initiatives.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-white"
                style={{ backgroundColor: "#469cd3" }}
              >
                3
              </div>
              <h3 className="text-xl font-semibold">See the Impact</h3>
              <p className="text-muted-foreground">
                Measure reduced CO₂, community support, and employee engagement through our comprehensive tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-muted/30">
        <div className="container px-4 mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-3xl lg:text-4xl font-bold text-balance">
                  Transform Your Workplace with {platform_name}
                </h2>
                <p className="text-xl text-muted-foreground text-pretty">
                  Join {company_name} in building a sustainable and equitable future for all.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Leaf className="h-6 w-6 flex-shrink-0 mt-0.5" style={{ color: "#469cd3" }} />
                  <div>
                    <h4 className="font-semibold">Employee Engagement</h4>
                    <p className="text-muted-foreground">
                      Boost morale through sustainability challenges and meaningful community involvement.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <BarChart3 className="h-6 w-6 flex-shrink-0 mt-0.5" style={{ color: "#469cd3" }} />
                  <div>
                    <h4 className="font-semibold">Measure Real Impact</h4>
                    <p className="text-muted-foreground">
                      Track Scope 1, 2, 3 emissions and reductions with comprehensive analytics.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="h-6 w-6 flex-shrink-0 mt-0.5" style={{ color: "#469cd3" }} />
                  <div>
                    <h4 className="font-semibold">Community Connection</h4>
                    <p className="text-muted-foreground">Support local volunteering and digital equity initiatives.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 flex-shrink-0 mt-0.5" style={{ color: "#469cd3" }} />
                  <div>
                    <h4 className="font-semibold">Corporate Social Responsibility</h4>
                    <p className="text-muted-foreground">
                      Lead with fairness and inclusion while driving meaningful environmental change.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div
                className="aspect-square rounded-2xl p-8 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #469cd320, #469cd310)" }}
              >
                <img
                  src="/office-team-celebrating-sustainability-achievement.jpg"
                  alt="Office team celebrating sustainability achievements"
                  className="rounded-xl shadow-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container px-4 mx-auto text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl lg:text-4xl font-bold text-balance">Ready to Make a Difference?</h2>
              <p className="text-xl text-muted-foreground text-pretty">
                Join {company_name} on the journey to Net Zero 2040 and a fairer digital future for all.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-lg px-8 text-white" style={{ backgroundColor: "#469cd3" }} asChild>
                <Link href="/auth/register">
                  <Zap className="mr-2 h-5 w-5" />
                  Get Started with {platform_name} Sustainability Platform
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="text-lg px-8 bg-transparent border-[#469cd3] text-[#469cd3] hover:bg-[#469cd3]/10"
                asChild
              >
                <Link
                  href="https://www.2degrees.nz/sites/default/files/2024-12/2degrees_Community_Impact_Report_2024.pdf"
                  target="_blank"
                >
                  Learn More from our Community Impact Report
                </Link>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Join the journey to Net Zero • Digital equity for all • Stronger communities together
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
