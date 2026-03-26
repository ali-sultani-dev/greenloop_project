export interface LevelThreshold {
  level: number
  points_required: number
}

/**
 * Calculates progress toward the next level based on user points and level.
 * Uses level_thresholds when available; falls back to legacy (level * 1000) when not.
 */
export function calculateLevelProgress(
  userPoints: number,
  userLevel: number,
  levelThresholds?: LevelThreshold[] | null
): { pointsToNextLevel: number; levelProgress: number } {
  if (!levelThresholds || levelThresholds.length === 0) {
    // Fallback to old calculation if thresholds not available
    const points = userPoints || 0
    const level = userLevel || 1
    const pointsToNextLevel = level * 1000 - points
    const levelProgress = (points % 1000) / 10
    return { pointsToNextLevel, levelProgress }
  }

  const currentThreshold = levelThresholds.find((t) => t.level === userLevel)
  const nextThreshold = levelThresholds.find((t) => t.level === userLevel + 1)

  if (!currentThreshold) {
    return { pointsToNextLevel: 0, levelProgress: 100 }
  }

  if (!nextThreshold) {
    // User is at max level
    return { pointsToNextLevel: 0, levelProgress: 100 }
  }

  const points = userPoints || 0
  const pointsToNextLevel = Math.max(0, nextThreshold.points_required - points)
  const progressRange = nextThreshold.points_required - currentThreshold.points_required
  const currentProgress = Math.max(0, points - currentThreshold.points_required)
  const levelProgress = progressRange > 0 ? (currentProgress / progressRange) * 100 : 100

  return { pointsToNextLevel, levelProgress }
}
