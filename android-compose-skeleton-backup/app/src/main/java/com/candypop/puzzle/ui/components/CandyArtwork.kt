package com.candypop.puzzle.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.candypop.puzzle.model.CandyType
import kotlin.math.cos
import kotlin.math.sin

/**
 * Procedurally draws original glossy candy graphics using Jetpack Compose Canvas.
 * No external image assets or copyright materials required.
 */
@Composable
fun CandyArtwork(
    candyType: CandyType,
    modifier: Modifier = Modifier,
    size: Dp = 48.dp
) {
    Canvas(modifier = modifier.size(size)) {
        val width = this.size.width
        val height = this.size.height
        val center = Offset(width / 2f, height / 2f)

        when (candyType) {
            CandyType.STRAWBERRY_DROP -> {
                // Conical gumdrop with sugar sparkle highlight
                val path = Path().apply {
                    moveTo(width * 0.5f, height * 0.12f)
                    cubicTo(
                        width * 0.95f, height * 0.28f,
                        width * 0.92f, height * 0.85f,
                        width * 0.78f, height * 0.92f
                    )
                    cubicTo(
                        width * 0.5f, height * 0.98f,
                        width * 0.22f, height * 0.92f,
                        width * 0.08f, height * 0.85f
                    )
                    cubicTo(
                        width * 0.05f, height * 0.28f,
                        width * 0.5f, height * 0.12f,
                        width * 0.5f, height * 0.12f
                    )
                    close()
                }
                drawPath(
                    path = path,
                    brush = Brush.verticalGradient(
                        colors = listOf(candyType.highlightColor, candyType.primaryColor, candyType.secondaryColor)
                    )
                )
                // Glossy reflection arc
                drawCircle(
                    color = Color.White.copy(alpha = 0.55f),
                    radius = width * 0.14f,
                    center = Offset(width * 0.38f, height * 0.38f)
                )
            }

            CandyType.CITRUS_RING -> {
                // Solid round citrus candy with citrus wedge segments
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(candyType.highlightColor, candyType.primaryColor, candyType.shadowColor),
                        center = Offset(width * 0.38f, height * 0.35f)
                    ),
                    radius = width * 0.44f,
                    center = center
                )
                drawCircle(
                    color = Color.White.copy(alpha = 0.4f),
                    style = Stroke(width = width * 0.04f),
                    radius = width * 0.38f,
                    center = center
                )
                // Citrus slice radial lines
                for (i in 0 until 4) {
                    val angle = (i * Math.PI / 4).toFloat()
                    val dx = (width * 0.35f * cos(angle.toDouble())).toFloat()
                    val dy = (width * 0.35f * sin(angle.toDouble())).toFloat()
                    drawLine(
                        color = Color.White.copy(alpha = 0.5f),
                        start = Offset(center.x - dx, center.y - dy),
                        end = Offset(center.x + dx, center.y + dy),
                        strokeWidth = width * 0.04f
                    )
                }
                drawCircle(
                    color = candyType.highlightColor,
                    radius = width * 0.08f,
                    center = center
                )
            }

            CandyType.STAR_LEMON -> {
                // 4-pointed radiant star candy
                val starPath = Path()
                val points = 4
                val outerRadius = width * 0.44f
                val innerRadius = width * 0.18f
                for (i in 0 until points * 2) {
                    val r = if (i % 2 == 0) outerRadius else innerRadius
                    val angle = (i * Math.PI / points) - Math.PI / 2
                    val x = center.x + (r * cos(angle)).toFloat()
                    val y = center.y + (r * sin(angle)).toFloat()
                    if (i == 0) starPath.moveTo(x, y) else starPath.lineTo(x, y)
                }
                starPath.close()

                drawPath(
                    path = starPath,
                    brush = Brush.radialGradient(
                        colors = listOf(candyType.highlightColor, candyType.primaryColor, candyType.secondaryColor),
                        center = center
                    )
                )
                drawPath(
                    path = starPath,
                    color = Color.White.copy(alpha = 0.4f),
                    style = Stroke(width = 3.dp.toPx())
                )
            }

            CandyType.MINT_EMERALD -> {
                // Hexagonal emerald-cut candy
                val hexPath = Path()
                val radius = width * 0.42f
                for (i in 0 until 6) {
                    val angle = (i * Math.PI / 3) + Math.PI / 6
                    val x = center.x + (radius * cos(angle)).toFloat()
                    val y = center.y + (radius * sin(angle)).toFloat()
                    if (i == 0) hexPath.moveTo(x, y) else hexPath.lineTo(x, y)
                }
                hexPath.close()

                drawPath(
                    path = hexPath,
                    brush = Brush.verticalGradient(
                        colors = listOf(candyType.highlightColor, candyType.primaryColor, candyType.secondaryColor)
                    )
                )
                // Inner jewel facet
                drawCircle(
                    color = Color.White.copy(alpha = 0.5f),
                    radius = width * 0.14f,
                    center = Offset(width * 0.4f, height * 0.35f)
                )
            }

            CandyType.BLUEBERRY_OVAL -> {
                // 4-sided Faceted Diamond (Rhombus) Jewel
                val diamondPath = Path().apply {
                    moveTo(center.x, height * 0.08f)
                    lineTo(width * 0.92f, center.y)
                    lineTo(center.x, height * 0.92f)
                    lineTo(width * 0.08f, center.y)
                    close()
                }
                drawPath(
                    path = diamondPath,
                    brush = Brush.radialGradient(
                        colors = listOf(candyType.highlightColor, candyType.primaryColor, candyType.secondaryColor),
                        center = Offset(width * 0.38f, height * 0.35f)
                    )
                )
                drawPath(
                    path = diamondPath,
                    color = Color.White.copy(alpha = 0.7f),
                    style = Stroke(width = 2.dp.toPx())
                )
                // Cross facet reflection lines
                drawLine(
                    color = Color.White.copy(alpha = 0.5f),
                    start = Offset(center.x, height * 0.08f),
                    end = Offset(center.x, height * 0.92f),
                    strokeWidth = 1.5.dp.toPx()
                )
                drawLine(
                    color = Color.White.copy(alpha = 0.5f),
                    start = Offset(width * 0.08f, center.y),
                    end = Offset(width * 0.92f, center.y),
                    strokeWidth = 1.5.dp.toPx()
                )
            }

            CandyType.PLUM_HEART -> {
                // Royal heart bonbon
                val heartPath = Path().apply {
                    moveTo(width * 0.5f, height * 0.82f)
                    cubicTo(
                        width * 0.08f, height * 0.55f,
                        width * 0.08f, height * 0.22f,
                        width * 0.35f, height * 0.2f
                    )
                    cubicTo(
                        width * 0.46f, height * 0.2f,
                        width * 0.5f, height * 0.32f,
                        width * 0.5f, height * 0.32f
                    )
                    cubicTo(
                        width * 0.5f, height * 0.32f,
                        width * 0.54f, height * 0.2f,
                        width * 0.65f, height * 0.2f
                    )
                    cubicTo(
                        width * 0.92f, height * 0.22f,
                        width * 0.92f, height * 0.55f,
                        width * 0.5f, height * 0.82f
                    )
                    close()
                }
                drawPath(
                    path = heartPath,
                    brush = Brush.radialGradient(
                        colors = listOf(candyType.highlightColor, candyType.primaryColor, candyType.shadowColor),
                        center = Offset(width * 0.42f, height * 0.35f)
                    )
                )
            }

            CandyType.RAINBOW_SWIRL -> {
                // Multi-color pinwheel lollipop
                drawCircle(
                    brush = Brush.sweepGradient(
                        colors = listOf(
                            Color(0xFFFF2A7A),
                            Color(0xFFFFD600),
                            Color(0xFF00E676),
                            Color(0xFF00B4D8),
                            Color(0xFFB5179E),
                            Color(0xFFFF2A7A)
                        ),
                        center = center
                    ),
                    radius = width * 0.42f,
                    center = center
                )
                drawCircle(
                    color = Color.White.copy(alpha = 0.8f),
                    radius = width * 0.1f,
                    center = center
                )
            }
        }
    }
}
