package com.candypop.puzzle.model

/**
 * Foundation state models for player progress, settings, and upcoming levels.
 * Cleanly separated to support saving to SharedPreferences/DataStore.
 */
data class SoundSettings(
    val soundEffectsEnabled: Boolean = true,
    val musicEnabled: Boolean = true,
    val hapticsEnabled: Boolean = true,
    val masterVolume: Float = 0.8f
)

data class PlayerProfile(
    val lives: Int = 5,
    val maxLives: Int = 5,
    val coins: Int = 100,
    val currentLevel: Int = 1,
    val totalStars: Int = 0,
    val highestUnlockedLevel: Int = 1
)

data class LevelInfo(
    val levelNumber: Int,
    val name: String,
    val targetScore: Int,
    val maxMoves: Int,
    val starsEarned: Int = 0,
    val isUnlocked: Boolean = false
)

object GameConstants {
    val SAMPLE_LEVELS = listOf(
        LevelInfo(1, "Sugar Meadow", 1200, 25, 0, isUnlocked = true),
        LevelInfo(2, "Jelly Valley", 2200, 22, 0, isUnlocked = false),
        LevelInfo(3, "Caramel Creek", 2800, 20, 0, isUnlocked = false),
        LevelInfo(4, "Minty Peak", 3400, 18, 0, isUnlocked = false),
        LevelInfo(5, "Berry Lagoon", 4000, 18, 0, isUnlocked = false),
        LevelInfo(6, "Swirl Kingdom", 4800, 16, 0, isUnlocked = false),
        LevelInfo(7, "Cocoa Canyon", 5500, 15, 0, isUnlocked = false),
        LevelInfo(8, "Marshmallow Cloud", 6200, 14, 0, isUnlocked = false)
    )
}
