package com.candypop.puzzle

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
                            Toast.makeText(
                                this,
                                "Starting Level ${playerProfile.currentLevel} - Match 3 Candies!",
                                Toast.LENGTH_SHORT
                            ).show()
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
}
