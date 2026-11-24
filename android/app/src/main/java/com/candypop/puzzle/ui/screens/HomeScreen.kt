package com.candypop.puzzle.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.candypop.puzzle.model.CandyType
import com.candypop.puzzle.model.PlayerProfile
import com.candypop.puzzle.model.SoundSettings
import com.candypop.puzzle.ui.components.*
import com.candypop.puzzle.ui.theme.*

/**
 * Native Jetpack Compose Home Screen for Sugar Pop Match-3 Puzzle Game.
 * Features:
 * - Playful Candy Land gradient backdrop with gentle floating candy particles
 * - High-contrast glossy 3D title logo with sparkling candy icons
 * - Prominent, juicy 3D Play button centered on mobile screen
 * - Quick-access Sound toggle and Settings modal
 * - Player header pill showing Lives, Coins, and Stars
 */
@Composable
fun HomeScreen(
    playerProfile: PlayerProfile = PlayerProfile(),
    soundSettings: SoundSettings = SoundSettings(),
    onPlayClicked: () -> Unit = {},
    onSettingsChanged: (SoundSettings) -> Unit = {}
) {
    var showSettingsDialog by remember { mutableStateOf(false) }
    var currentSoundSettings by remember { mutableStateOf(soundSettings) }

    // Pulsing animation for the main Play button
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val playButtonScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "playScale"
    )

    // Gentle float animation for candy title accents
    val candyFloatY by infiniteTransition.animateFloat(
        initialValue = -6f,
        targetValue = 6f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "candyFloat"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF3B1578),
                        Color(0xFF6B1D91),
                        Color(0xFFE9407A),
                        Color(0xFFFF9E3D)
                    )
                )
            )
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        // Decorative background candy bubbles / ambient jelly drops
        Box(
            modifier = Modifier
                .offset(x = (-30).dp, y = 140.dp)
                .size(110.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.06f))
        )
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .offset(x = 40.dp, y = 280.dp)
                .size(160.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.05f))
        )

        // Main Vertical Layout
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {

            // Top Player Stats Header Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Lives / Hearts Pill
                StatPill(
                    icon = "❤️",
                    value = "${playerProfile.lives}/${playerProfile.maxLives}",
                    badgeColor = Color(0xFFFF2E63)
                )

                // Coins Pill
                StatPill(
                    icon = "🪙",
                    value = "${playerProfile.coins}",
                    badgeColor = Color(0xFFFFB703)
                )

                // Stars Pill
                StatPill(
                    icon = "⭐",
                    value = "${playerProfile.totalStars}",
                    badgeColor = Color(0xFF00E676)
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Game Logo Banner Section
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(horizontal = 8.dp)
            ) {
                // Floating accent candies above logo
                Row(
                    horizontalArrangement = Arrangement.spacedBy(28.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.offset(y = candyFloatY.dp)
                ) {
                    CandyArtwork(candyType = CandyType.STRAWBERRY_DROP, size = 38.dp)
                    CandyArtwork(candyType = CandyType.STAR_LEMON, size = 42.dp)
                    CandyArtwork(candyType = CandyType.BLUEBERRY_OVAL, size = 38.dp)
                }

                Spacer(modifier = Modifier.height(10.dp))

                // 3D Gel Game Title Card
                Surface(
                    color = Color(0x33000000),
                    shape = RoundedCornerShape(24.dp),
                    border = border(2.dp, Color(0x66FFFFFF), RoundedCornerShape(24.dp)),
                    modifier = Modifier.padding(horizontal = 12.dp)
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 14.dp)
                    ) {
                        Text(
                            text = "SUGAR",
                            fontSize = 42.sp,
                            fontWeight = FontWeight.Black,
                            color = CandyYellow,
                            letterSpacing = 3.sp
                        )
                        Text(
                            text = "POP",
                            fontSize = 54.sp,
                            fontWeight = FontWeight.Black,
                            color = Color.White,
                            letterSpacing = 4.sp,
                            modifier = Modifier.offset(y = (-8).dp)
                        )
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = CandyPink,
                            modifier = Modifier.offset(y = (-4).dp)
                        ) {
                            Text(
                                text = "MATCH-3 PUZZLE",
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 2.sp,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }

            // Center: Large 3D Play Button
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.padding(vertical = 24.dp)
            ) {
                // Play Button with scale animation
                Box(modifier = Modifier.scale(playButtonScale)) {
                    CandyPlayButton(
                        text = "PLAY",
                        onClick = onPlayClicked
                    )
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Level indicator banner
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = Color(0x44000000),
                    border = border(1.5.dp, Color(0x55FFFFFF), RoundedCornerShape(20.dp))
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 18.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "NEXT: LEVEL ${playerProfile.currentLevel}",
                            color = Color(0xFFFFE082),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                    }
                }
            }

            // Bottom Action Bar: Settings, Sound, and Info Buttons
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Sound Toggle Button
                val soundIcon = if (currentSoundSettings.soundEffectsEnabled) {
                    Icons.Default.VolumeUp
                } else {
                    Icons.Default.VolumeOff
                }
                CandyIconButton(
                    icon = soundIcon,
                    contentDescription = if (currentSoundSettings.soundEffectsEnabled) "Sound On" else "Sound Off",
                    topColor = if (currentSoundSettings.soundEffectsEnabled) Color(0xFF00C9FF) else Color(0xFF78909C),
                    bottomColor = if (currentSoundSettings.soundEffectsEnabled) Color(0xFF92FE9D) else Color(0xFF455A64),
                    shadowColor = Color(0xFF1A3340),
                    onClick = {
                        val updated = currentSoundSettings.copy(
                            soundEffectsEnabled = !currentSoundSettings.soundEffectsEnabled
                        )
                        currentSoundSettings = updated
                        onSettingsChanged(updated)
                    }
                )

                // Extra candy mascot badge in center
                CandyArtwork(
                    candyType = CandyType.MINT_EMERALD,
                    size = 46.dp
                )

                // Settings Button
                CandyIconButton(
                    icon = Icons.Default.Settings,
                    contentDescription = "Settings",
                    topColor = Color(0xFFB5179E),
                    bottomColor = Color(0xFF7209B7),
                    shadowColor = Color(0xFF3F045C),
                    onClick = {
                        showSettingsDialog = true
                    }
                )
            }
        }

        // Settings Dialog Modal
        if (showSettingsDialog) {
            SettingsDialog(
                settings = currentSoundSettings,
                onSettingsChanged = { updated ->
                    currentSoundSettings = updated
                    onSettingsChanged(updated)
                },
                onDismissRequest = { showSettingsDialog = false }
            )
        }
    }
}

/**
 * Top pill display for stats (Lives, Coins, Stars).
 */
@Composable
private fun StatPill(
    icon: String,
    value: String,
    badgeColor: Color
) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Color(0x55000000),
        border = border(1.5.dp, Color(0x44FFFFFF), RoundedCornerShape(20.dp)),
        modifier = Modifier.shadow(4.dp, RoundedCornerShape(20.dp))
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        ) {
            Text(text = icon, fontSize = 16.sp)
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = value,
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.ExtraBold
            )
        }
    }
}
