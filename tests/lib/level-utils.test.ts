import {
  calculateLevelProgress,
  type LevelThreshold,
} from "@/lib/level-utils"

describe("calculateLevelProgress", () => {
  describe("fallback when no thresholds", () => {
    it("uses level * 1000 for pointsToNextLevel when no thresholds", () => {
      const result = calculateLevelProgress(500, 1, [])
      expect(result.pointsToNextLevel).toBe(500) // 1000 - 500
    })

    it("uses (points % 1000) / 10 for levelProgress when no thresholds", () => {
      const result = calculateLevelProgress(500, 1, [])
      expect(result.levelProgress).toBe(50) // 500 % 1000 / 10
    })

    it("handles null/undefined thresholds", () => {
      const result = calculateLevelProgress(200, 2, undefined)
      expect(result.pointsToNextLevel).toBe(1800) // 2000 - 200
      expect(result.levelProgress).toBe(20) // 200 % 1000 / 10
    })
  })

  describe("max level", () => {
    it("returns 0 pointsToNextLevel and 100 progress when at max level", () => {
      const thresholds: LevelThreshold[] = [
        { level: 1, points_required: 0 },
        { level: 2, points_required: 1000 },
        { level: 3, points_required: 2500 },
      ]
      const result = calculateLevelProgress(2500, 3, thresholds)
      expect(result.pointsToNextLevel).toBe(0)
      expect(result.levelProgress).toBe(100)
    })
  })

  describe("normal progression", () => {
    it("calculates correct progress when between levels", () => {
      const thresholds: LevelThreshold[] = [
        { level: 1, points_required: 0 },
        { level: 2, points_required: 1000 },
        { level: 3, points_required: 2500 },
      ]
      const result = calculateLevelProgress(500, 1, thresholds)
      expect(result.pointsToNextLevel).toBe(500) // 1000 - 500
      expect(result.levelProgress).toBe(50) // 500/1000 * 100
    })

    it("handles level 2 with partial progress", () => {
      const thresholds: LevelThreshold[] = [
        { level: 1, points_required: 0 },
        { level: 2, points_required: 1000 },
        { level: 3, points_required: 2500 },
      ]
      const result = calculateLevelProgress(1750, 2, thresholds)
      expect(result.pointsToNextLevel).toBe(750) // 2500 - 1750
      expect(result.levelProgress).toBe(50) // (1750-1000)/(2500-1000) * 100
    })

    it("returns levelProgress 100 when exactly at next threshold", () => {
      const thresholds: LevelThreshold[] = [
        { level: 1, points_required: 0 },
        { level: 2, points_required: 1000 },
      ]
      const result = calculateLevelProgress(1000, 1, thresholds)
      expect(result.pointsToNextLevel).toBe(0)
      expect(result.levelProgress).toBe(100)
    })
  })

  describe("edge cases", () => {
    it("returns 100 progress when user level not in thresholds", () => {
      const thresholds: LevelThreshold[] = [
        { level: 1, points_required: 0 },
        { level: 2, points_required: 1000 },
      ]
      const result = calculateLevelProgress(5000, 99, thresholds)
      expect(result.pointsToNextLevel).toBe(0)
      expect(result.levelProgress).toBe(100)
    })

    it("handles zero points", () => {
      const thresholds: LevelThreshold[] = [
        { level: 1, points_required: 0 },
        { level: 2, points_required: 1000 },
      ]
      const result = calculateLevelProgress(0, 1, thresholds)
      expect(result.pointsToNextLevel).toBe(1000)
      expect(result.levelProgress).toBe(0)
    })
  })
})
