"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles } from "lucide-react"

const motivationalQuotes = [
  {
    text: "Every small action creates a ripple of positive change.",
    author: "Environmental Wisdom",
  },
  {
    text: "The Earth does not belong to us; we belong to the Earth.",
    author: "Chief Seattle",
  },
  {
    text: "Be the change you wish to see in the world.",
    author: "Mahatma Gandhi",
  },
  {
    text: "We do not inherit the Earth from our ancestors; we borrow it from our children.",
    author: "Native American Proverb",
  },
  {
    text: "The greatest threat to our planet is the belief that someone else will save it.",
    author: "Robert Swan",
  },
]

interface MotivationalQuoteProps {
  userPoints?: number
}

export function MotivationalQuote({ userPoints = 0 }: MotivationalQuoteProps) {
  const [currentQuote, setCurrentQuote] = useState(motivationalQuotes[0])

  useEffect(() => {
    // Change quote based on user activity level
    const quoteIndex = Math.floor((userPoints / 1000) % motivationalQuotes.length)
    setCurrentQuote(motivationalQuotes[quoteIndex])
  }, [userPoints])

  return (
    <Card className="gradient-border hover-lift animate-slide-up">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-accent/10 rounded-full animate-pulse-glow">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1">
            <blockquote className="text-lg font-medium text-balance leading-relaxed">"{currentQuote.text}"</blockquote>
            <cite className="text-sm text-muted-foreground mt-2 block">— {currentQuote.author}</cite>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
