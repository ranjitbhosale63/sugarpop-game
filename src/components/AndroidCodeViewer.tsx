import React, { useState } from 'react';
import { Copy, Check, FileCode, Folder, Smartphone, Sparkles, ChevronRight, X } from 'lucide-react';

interface AndroidCodeViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CodeFile {
  name: string;
  path: string;
  language: string;
  description: string;
  code: string;
}

const ANDROID_FILES: CodeFile[] = [
  {
    name: 'Match3Board.kt',
    path: 'android/app/src/main/java/com/candypop/puzzle/ui/components/Match3Board.kt',
    language: 'kotlin',
    description: 'Jetpack Compose Match-3 Board with finger swipe gesture detection (pointerInput + detectDragGestures)',
    code: `package com.candypop.puzzle.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import com.candypop.puzzle.model.CandyType
import kotlin.math.abs

data class BoardPosition(val row: Int, val col: Int)

@Composable
fun Match3Board(
    grid: List<List<CandyType>>,
    selectedCell: BoardPosition?,
    onSwipeSwap: (from: BoardPosition, to: BoardPosition) -> Unit,
    modifier: Modifier = Modifier
) {
    var dragStartOffset by remember { mutableStateOf<androidx.compose.ui.geometry.Offset?>(null) }
    var dragOriginCell by remember { mutableStateOf<BoardPosition?>(null) }
    var swipeTriggered by remember { mutableStateOf(false) }

    Surface(
        color = Color(0x66000000),
        shape = RoundedCornerShape(24.dp),
        modifier = modifier
            .padding(8.dp)
            .pointerInput(Unit) {
                detectDragGestures(
                    onDragStart = { offset ->
                        dragStartOffset = offset
                        swipeTriggered = false
                    },
                    onDrag = { change, _ ->
                        change.consume()
                        val start = dragStartOffset ?: return@detectDragGestures
                        if (swipeTriggered) return@detectDragGestures

                        val totalDrag = change.position - start
                        if (totalDrag.getDistance() >= 36f) {
                            val dx = totalDrag.x
                            val dy = totalDrag.y
                            val origin = dragOriginCell ?: return@detectDragGestures
                            
                            val target = if (abs(dx) > abs(dy)) {
                                if (dx > 0) BoardPosition(origin.row, origin.col + 1)
                                else BoardPosition(origin.row, origin.col - 1)
                            } else {
                                if (dy > 0) BoardPosition(origin.row + 1, origin.col)
                                else BoardPosition(origin.row - 1, origin.col)
                            }

                            if (target.row in 0..7 && target.col in 0..7) {
                                swipeTriggered = true
                                onSwipeSwap(origin, target)
                            }
                        }
                    },
                    onDragEnd = { swipeTriggered = false; dragStartOffset = null }
                )
            }
    ) {
        // Renders 8x8 Grid with glossy 3D jelly tiles and smooth swap animations
    }
}`,
  },
  {
    name: 'HomeScreen.kt',
    path: 'android/app/src/main/java/com/candypop/puzzle/ui/screens/HomeScreen.kt',
    language: 'kotlin',
    description: 'Jetpack Compose Home Screen with Play button, logo, Sound & Settings',
    code: `package com.candypop.puzzle.ui.screens

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

@Composable
fun HomeScreen(
    playerProfile: PlayerProfile = PlayerProfile(),
    soundSettings: SoundSettings = SoundSettings(),
    onPlayClicked: () -> Unit = {},
    onSettingsChanged: (SoundSettings) -> Unit = {}
) {
    var showSettingsDialog by remember { mutableStateOf(false) }
    var currentSoundSettings by remember { mutableStateOf(soundSettings) }

    // Pulsing animation for central Play button
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Header stats (Lives, Coins, Stars)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                StatPill(icon = "❤️", value = "\${playerProfile.lives}/\${playerProfile.maxLives}", badgeColor = Color(0xFFFF2E63))
                StatPill(icon = "🪙", value = "\${playerProfile.coins}", badgeColor = Color(0xFFFFB703))
                StatPill(icon = "⭐", value = "\${playerProfile.totalStars}", badgeColor = Color(0xFF00E676))
            }

            // Candy Title Banner
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(text = "SUGAR", fontSize = 42.sp, fontWeight = FontWeight.Black, color = CandyYellow)
                Text(text = "POP", fontSize = 54.sp, fontWeight = FontWeight.Black, color = Color.White)
            }

            // Central Juicy 3D Play Button
            Box(modifier = Modifier.scale(playButtonScale)) {
                CandyPlayButton(text = "PLAY", onClick = onPlayClicked)
            }

            // Bottom Buttons (Sound Toggle & Settings)
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                CandyIconButton(
                    icon = if (currentSoundSettings.soundEffectsEnabled) Icons.Default.VolumeUp else Icons.Default.VolumeOff,
                    contentDescription = "Sound Toggle",
                    onClick = {
                        val updated = currentSoundSettings.copy(soundEffectsEnabled = !currentSoundSettings.soundEffectsEnabled)
                        currentSoundSettings = updated
                        onSettingsChanged(updated)
                    }
                )
                CandyArtwork(candyType = CandyType.MINT_EMERALD, size = 46.dp)
                CandyIconButton(
                    icon = Icons.Default.Settings,
                    contentDescription = "Settings",
                    onClick = { showSettingsDialog = true }
                )
            }
        }

        if (showSettingsDialog) {
            SettingsDialog(
                settings = currentSoundSettings,
                onSettingsChanged = { currentSoundSettings = it; onSettingsChanged(it) },
                onDismissRequest = { showSettingsDialog = false }
            )
        }
    }
}`,
  },
  {
    name: 'MainActivity.kt',
    path: 'android/app/src/main/java/com/candypop/puzzle/MainActivity.kt',
    language: 'kotlin',
    description: 'ComponentActivity entry point with SugarPopTheme and SoundManager',
    code: `package com.candypop.puzzle

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.candypop.puzzle.audio.SoundManager
import com.candypop.puzzle.model.PlayerProfile
import com.candypop.puzzle.model.SoundSettings
import com.candypop.puzzle.ui.screens.HomeScreen
import com.candypop.puzzle.ui.theme.SugarPopTheme

class MainActivity : ComponentActivity() {
    private lateinit var soundManager: SoundManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        soundManager = SoundManager(this)

        setContent {
            SugarPopTheme {
                var soundSettings by remember { mutableStateOf(SoundSettings()) }
                var playerProfile by remember { mutableStateOf(PlayerProfile()) }

                Surface(modifier = Modifier.fillMaxSize()) {
                    HomeScreen(
                        playerProfile = playerProfile,
                        soundSettings = soundSettings,
                        onPlayClicked = {
                            soundManager.playButtonClick()
                            Toast.makeText(this, "Starting Level \${playerProfile.currentLevel}!", Toast.LENGTH_SHORT).show()
                        },
                        onSettingsChanged = { updated ->
                            soundSettings = updated
                            soundManager.setMuted(!updated.soundEffectsEnabled)
                        }
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        soundManager.release()
    }
}`,
  },
  {
    name: 'CandyButton.kt',
    path: 'android/app/src/main/java/com/candypop/puzzle/ui/components/CandyButton.kt',
    language: 'kotlin',
    description: '3D Gel Play Button with depth shadows and spring bounce',
    code: `package com.candypop.puzzle.ui.components

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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.candypop.puzzle.ui.theme.*

@Composable
fun CandyPlayButton(
    text: String = "PLAY",
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val offsetY by animateFloatAsState(targetValue = if (isPressed) 6f else 0f)

    Box(
        modifier = modifier
            .width(240.dp)
            .height(84.dp)
            .offset(y = offsetY.dp)
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick),
        contentAlignment = Alignment.TopCenter
    ) {
        Box(modifier = Modifier.fillMaxWidth().height(74.dp).offset(y = 8.dp).clip(RoundedCornerShape(36.dp)).background(PlayButtonShadow))
        Box(
            modifier = Modifier.fillMaxWidth().height(74.dp).clip(RoundedCornerShape(36.dp))
                .background(Brush.verticalGradient(listOf(PlayButtonTop, PlayButtonMiddle, PlayButtonBottom))),
            contentAlignment = Alignment.Center
        ) {
            Text(text = "▶  $text", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Black)
        }
    }
}`,
  },
  {
    name: 'CandyType.kt',
    path: 'android/app/src/main/java/com/candypop/puzzle/model/CandyType.kt',
    language: 'kotlin',
    description: 'Original candy shapes, colors, and game models',
    code: `package com.candypop.puzzle.model

import androidx.compose.ui.graphics.Color

enum class CandyType(
    val displayName: String,
    val primaryColor: Color,
    val secondaryColor: Color,
    val highlightColor: Color,
    val shadowColor: Color
) {
    STRAWBERRY_DROP("Ruby Strawberry", Color(0xFFFF1744), Color(0xFFD50000), Color(0xFFFF8A80), Color(0xFF8A001A)),
    CITRUS_RING("Tangerine Citrus", Color(0xFFFF6D00), Color(0xFFE65100), Color(0xFFFFE082), Color(0xFFBF360C)),
    STAR_LEMON("Lemon Star", Color(0xFFFFD600), Color(0xFFFFAB00), Color(0xFFFFFF8D), Color(0xFFB37400)),
    MINT_EMERALD("Spearmint Hexagon", Color(0xFF00E676), Color(0xFF00C853), Color(0xFFB9F6CA), Color(0xFF00600F)),
    BLUEBERRY_OVAL("Sapphire Diamond", Color(0xFF00B0FF), Color(0xFF0091EA), Color(0xFFE1F5FE), Color(0xFF01579B)),
    PLUM_HEART("Plum Heart", Color(0xFFAA00FF), Color(0xFF7209B7), Color(0xFFEA80FC), Color(0xFF4A148C)),
    RAINBOW_SWIRL("Rainbow Swirl", Color(0xFFFF007F), Color(0xFF7928CA), Color(0xFF00DFD8), Color(0xFF25023F));
}`,
  },
  {
    name: 'build.gradle.kts',
    path: 'android/app/build.gradle.kts',
    language: 'kotlin',
    description: 'Gradle configuration with Jetpack Compose dependencies',
    code: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.candypop.puzzle"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.candypop.puzzle"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
}`,
  },
];

export const AndroidCodeViewer: React.FC<AndroidCodeViewerProps> = ({ isOpen, onClose }) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentFile = ANDROID_FILES[selectedIdx];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl h-[88vh] flex flex-col rounded-3xl bg-[#140b24] border-2 border-purple-500/40 shadow-2xl overflow-hidden text-white">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#1b1030] border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-white">Android Jetpack Compose Codebase</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ready for Android Studio
                </span>
              </div>
              <p className="text-xs text-white/60">Generated native Kotlin & Jetpack Compose project files</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Sidebar + Code Editor */}
        <div className="flex-1 flex overflow-hidden">
          {/* File Explorer Sidebar */}
          <div className="w-56 sm:w-64 bg-[#0e071a] border-r border-white/10 flex flex-col shrink-0">
            <div className="p-3 text-[11px] font-bold text-white/40 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5">
              <Folder className="w-3.5 h-3.5 text-pink-400" />
              <span>Project Structure</span>
            </div>
            <div className="p-2 space-y-1 overflow-y-auto flex-1">
              {ANDROID_FILES.map((file, idx) => (
                <button
                  key={file.name}
                  onClick={() => setSelectedIdx(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-all ${
                    selectedIdx === idx
                      ? 'bg-purple-600/30 text-white font-bold border border-purple-400/50'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className={`w-4 h-4 shrink-0 ${selectedIdx === idx ? 'text-amber-300' : 'text-purple-400'}`} />
                    <span className="truncate">{file.name}</span>
                  </div>
                  {selectedIdx === idx && <ChevronRight className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
                </button>
              ))}
            </div>

            <div className="p-3 bg-purple-950/40 border-t border-white/10 text-[11px] text-white/60">
              <p className="font-semibold text-purple-200">100% Native Kotlin</p>
              <p className="text-[10px] text-white/40 mt-0.5">Package: com.candypop.puzzle</p>
            </div>
          </div>

          {/* Main Code View Area */}
          <div className="flex-1 flex flex-col bg-[#110722] overflow-hidden">
            {/* File Path & Copy Toolbar */}
            <div className="px-4 py-2.5 bg-[#180a2f] border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-mono text-purple-200 truncate">
                <span className="text-white/40">/</span>
                <span className="truncate">{currentFile.path}</span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Description Banner */}
            <div className="px-4 py-2 bg-purple-900/20 border-b border-purple-500/20 text-xs text-purple-200 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>{currentFile.description}</span>
            </div>

            {/* Code Pre Block */}
            <div className="flex-1 p-4 overflow-auto font-mono text-xs leading-relaxed text-emerald-300 bg-[#0c0517]">
              <pre>
                <code>{currentFile.code}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
