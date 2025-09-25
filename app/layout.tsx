import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { DynamicMetadata } from "@/components/dynamic-metadata"
import "./globals.css"

export const metadata: Metadata = {
  title: "Employee Sustainability Platform",
  description:
    "Engage employees in sustainability initiatives, track environmental impact, and build a greener workplace culture through gamification and team collaboration.",
  keywords: [
    "sustainability",
    "employee engagement",
    "environmental impact",
    "green workplace",
    "carbon footprint",
    "eco-friendly",
  ],
  authors: [{ name: "Platform Team" }],
  creator: "Platform Team",
  publisher: "Platform Team",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://greenloop.vercel.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Employee Sustainability Platform",
    description: "Engage employees in sustainability initiatives and track environmental impact",
    url: "https://greenloop.vercel.app",
    siteName: "Platform",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Employee Sustainability Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Employee Sustainability Platform",
    description: "Engage employees in sustainability initiatives and track environmental impact",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://vercel.live" />
        <meta name="theme-color" content="#0891b2" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            }
          >
            {children}
          </Suspense>
        </ErrorBoundary>
        <DynamicMetadata />
        <Analytics />
      </body>
    </html>
  )
}
