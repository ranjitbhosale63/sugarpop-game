package com.candypop.puzzle.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.Spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.candypop.puzzle.ui.theme.*

/**
 * 3D Candy Button with jelly tactile depth, gloss specular highlight,
 * and responsive spring press animation.
 */
@Composable
fun CandyPlayButton(
    text: String = "PLAY",
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 74.dp,
    width: Dp = 240.dp
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val offsetY by animateFloatAsState(
        targetValue = if (isPressed) 6f else 0f,
        animationSpec = spring(stiffness = Spring.StiffnessHigh)
    )

    Box(
        modifier = modifier
            .width(width)
            .height(height + 10.dp)
            .offset(y = offsetY.dp)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            ),
        contentAlignment = Alignment.TopCenter
    ) {
        // Bottom 3D shadow layer
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(height)
                .offset(y = 8.dp)
                .clip(RoundedCornerShape(36.dp))
                .background(PlayButtonShadow)
        )

        // Main juicy gradient face
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(height)
                .shadow(elevation = 12.dp, shape = RoundedCornerShape(36.dp), spotColor = PlayButtonBottom)
                .clip(RoundedCornerShape(36.dp))
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            PlayButtonTop,
                            PlayButtonMiddle,
                            PlayButtonBottom
                        )
                    )
                ),
            contentAlignment = Alignment.Center
        ) {
            // Top specular gloss highlight arc
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.92f)
                    .height(height * 0.42f)
                    .align(Alignment.TopCenter)
                    .offset(y = 4.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        brush = Brush.verticalGradient(
                            colors = listOf(
                                Color.White.copy(alpha = 0.55f),
                                Color.White.copy(alpha = 0.05f)
                            )
                        )
                    )
            )

            // Centered Play Text with 3D drop shadow
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "▶",
                    color = Color.White,
                    fontSize = 28.sp,
                    modifier = Modifier.padding(end = 8.dp)
                )
                Text(
                    text = text,
                    color = Color.White,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 2.sp
                )
            }
        }
    }
}
