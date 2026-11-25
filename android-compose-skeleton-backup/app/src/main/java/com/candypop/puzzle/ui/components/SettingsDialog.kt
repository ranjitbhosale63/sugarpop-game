package com.candypop.puzzle.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.candypop.puzzle.model.SoundSettings
import com.candypop.puzzle.ui.theme.*

/**
 * Candy-styled Settings Dialog in Jetpack Compose.
 */
@Composable
fun SettingsDialog(
    settings: SoundSettings,
    onSettingsChanged: (SoundSettings) -> Unit,
    onDismissRequest: () -> Unit
) {
    Dialog(onDismissRequest = onDismissRequest) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .clip(RoundedCornerShape(28.dp))
                .border(3.dp, Brush.verticalGradient(listOf(Color(0xFFFF94C2), Color(0xFF7928CA))), RoundedCornerShape(28.dp))
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFF2E124D),
                            Color(0xFF160829)
                        )
                    )
                )
                .padding(24.dp)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                // Header with Close
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "SETTINGS",
                        color = CandyYellow,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 1.sp
                    )
                    IconButton(
                        onClick = onDismissRequest,
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(18.dp))
                            .background(Color(0x33FFFFFF))
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = Color.White
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Sound FX Toggle Row
                SettingToggleRow(
                    title = "Sound Effects",
                    subtitle = "Juicy popping & chime sounds",
                    checked = settings.soundEffectsEnabled,
                    onCheckedChange = { onSettingsChanged(settings.copy(soundEffectsEnabled = it)) }
                )

                Spacer(modifier = Modifier.height(14.dp))

                // Music Toggle Row
                SettingToggleRow(
                    title = "Background Music",
                    subtitle = "Sweet ambient candy melody",
                    checked = settings.musicEnabled,
                    onCheckedChange = { onSettingsChanged(settings.copy(musicEnabled = it)) }
                )

                Spacer(modifier = Modifier.height(14.dp))

                // Haptics Toggle Row
                SettingToggleRow(
                    title = "Vibrations & Haptics",
                    subtitle = "Tactile feedback on match and pop",
                    checked = settings.hapticsEnabled,
                    onCheckedChange = { onSettingsChanged(settings.copy(hapticsEnabled = it)) }
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Version & Architecture Badge
                Surface(
                    color = Color(0x22FFFFFF),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Sugar Pop Match-3 v1.0.0",
                            color = Color(0xFFE2D9F3),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = "Engineered with Kotlin & Jetpack Compose",
                            color = Color(0xFFA694C7),
                            fontSize = 11.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0x1AFFFFFF))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = subtitle,
                color = Color(0xFFBCAAA4),
                fontSize = 12.sp
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = CandyGreen,
                uncheckedThumbColor = Color(0xFFCCCCCC),
                uncheckedTrackColor = Color(0x44FFFFFF)
            )
        )
    }
}
