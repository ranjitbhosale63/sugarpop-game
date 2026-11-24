package com.candypop.puzzle.model

import androidx.compose.ui.graphics.Color

/**
 * Original candy types for the Match-3 game foundation.
 * Designed with distinct shapes, high-contrast colors, and unique silhouettes
 * for excellent accessibility and visual appeal.
 */
enum class CandyType(
    val displayName: String,
    val primaryColor: Color,
    val secondaryColor: Color,
    val highlightColor: Color,
    val shadowColor: Color
) {
    STRAWBERRY_DROP(
        displayName = "Ruby Strawberry",
        primaryColor = Color(0xFFFF1744),
        secondaryColor = Color(0xFFD50000),
        highlightColor = Color(0xFFFF8A80),
        shadowColor = Color(0xFF8A001A)
    ),
    CITRUS_RING(
        displayName = "Tangerine Citrus",
        primaryColor = Color(0xFFFF6D00),
        secondaryColor = Color(0xFFE65100),
        highlightColor = Color(0xFFFFE082),
        shadowColor = Color(0xFFBF360C)
    ),
    STAR_LEMON(
        displayName = "Lemon Star",
        primaryColor = Color(0xFFFFD600),
        secondaryColor = Color(0xFFFFAB00),
        highlightColor = Color(0xFFFFFF8D),
        shadowColor = Color(0xFFB37400)
    ),
    MINT_EMERALD(
        displayName = "Spearmint Hexagon",
        primaryColor = Color(0xFF00E676),
        secondaryColor = Color(0xFF00C853),
        highlightColor = Color(0xFFB9F6CA),
        shadowColor = Color(0xFF00600F)
    ),
    BLUEBERRY_OVAL(
        displayName = "Sapphire Diamond",
        primaryColor = Color(0xFF00B0FF),
        secondaryColor = Color(0xFF0091EA),
        highlightColor = Color(0xFFE1F5FE),
        shadowColor = Color(0xFF01579B)
    ),
    PLUM_HEART(
        displayName = "Plum Heart",
        primaryColor = Color(0xFFAA00FF),
        secondaryColor = Color(0xFF7209B7),
        highlightColor = Color(0xFFEA80FC),
        shadowColor = Color(0xFF4A148C)
    ),
    RAINBOW_SWIRL(
        displayName = "Rainbow Swirl",
        primaryColor = Color(0xFFFF007F),
        secondaryColor = Color(0xFF7928CA),
        highlightColor = Color(0xFF00DFD8),
        shadowColor = Color(0xFF25023F)
    );

    val isSpecial: Boolean
        get() = this == RAINBOW_SWIRL
}
