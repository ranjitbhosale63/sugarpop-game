package com.candypop.puzzle.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.candypop.puzzle.model.CandyType
import kotlin.math.abs

data class BoardPosition(val row: Int, val col: Int)

/**
 * Native Jetpack Compose Match-3 Board with finger swipe detection.
 * Uses pointerInput and detectDragGestures to identify drag direction
 * (UP, DOWN, LEFT, RIGHT) and trigger smooth adjacent candy swaps.
 */
@Composable
fun Match3Board(
    grid: List<List<CandyType>>,
    selectedCell: BoardPosition?,
    onSwipeSwap: (from: BoardPosition, to: BoardPosition) -> Unit,
    onTapCell: (BoardPosition) -> Unit,
    modifier: Modifier = Modifier
) {
    var dragStartOffset by remember { mutableStateOf<Offset?>(null) }
    var dragCurrentCell by remember { mutableStateOf<BoardPosition?>(null) }
    var hasTriggeredSwipe by remember { mutableStateOf(false) }

    val swipeThresholdPx = 40f // Minimum swipe drag distance in pixels

    Surface(
        color = Color(0x66000000),
        shape = RoundedCornerShape(24.dp),
        border = border(2.dp, Color(0x44FFFFFF), RoundedCornerShape(24.dp)),
        modifier = modifier
            .padding(8.dp)
            .pointerInput(Unit) {
                detectDragGestures(
                    onDragStart = { offset ->
                        dragStartOffset = offset
                        hasTriggeredSwipe = false
                    },
                    onDrag = { change, dragAmount ->
                        change.consume()
                        val start = dragStartOffset ?: return@detectDragGestures
                        if (hasTriggeredSwipe) return@detectDragGestures

                        val totalDrag = change.position - start
                        if (totalDrag.getDistance() >= swipeThresholdPx) {
                            val dx = totalDrag.x
                            val dy = totalDrag.y

                            val origin = dragCurrentCell ?: return@detectDragGestures
                            val target = if (abs(dx) > abs(dy)) {
                                if (dx > 0) BoardPosition(origin.row, origin.col + 1)
                                else BoardPosition(origin.row, origin.col - 1)
                            } else {
                                if (dy > 0) BoardPosition(origin.row + 1, origin.col)
                                else BoardPosition(origin.row - 1, origin.col)
                            }

                            // Validate adjacent target is inside 8x8 grid bounds
                            if (target.row in 0..7 && target.col in 0..7) {
                                hasTriggeredSwipe = true
                                onSwipeSwap(origin, target)
                            }
                        }
                    },
                    onDragEnd = {
                        dragStartOffset = null
                        dragCurrentCell = null
                        hasTriggeredSwipe = false
                    },
                    onDragCancel = {
                        dragStartOffset = null
                        dragCurrentCell = null
                        hasTriggeredSwipe = false
                    }
                )
            }
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            grid.forEachIndexed { r, rowCandies ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    rowCandies.forEachIndexed { c, candy ->
                        val pos = BoardPosition(r, c)
                        val isSelected = selectedCell == pos

                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    if (isSelected) Color(0x55FFFFFF)
                                    else Color(0x18FFFFFF)
                                )
                                .then(
                                    if (isSelected) Modifier.border(2.dp, Color(0xFFFFD600), RoundedCornerShape(12.dp))
                                    else Modifier
                                )
                                .pointerInput(pos) {
                                    detectDragGestures(
                                        onDragStart = {
                                            dragCurrentCell = pos
                                        },
                                        onDrag = { _, _ -> },
                                        onDragEnd = {},
                                        onDragCancel = {}
                                    )
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            CandyArtwork(
                                candyType = candy,
                                size = 32.dp,
                                modifier = if (isSelected) Modifier.scale(1.1f) else Modifier
                            )
                        }
                    }
                }
            }
        }
    }
}
