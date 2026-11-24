package com.candypop.puzzle.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool

/**
 * SoundManager for Android Match-3 game foundation.
 * Uses SoundPool for zero-latency candy pops, button clicks, and fanfares.
 */
class SoundManager(private val context: Context) {
    private var soundPool: SoundPool? = null
    private var isMuted: Boolean = false

    init {
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_GAME)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        soundPool = SoundPool.Builder()
            .setMaxStreams(6)
            .setAudioAttributes(audioAttributes)
            .build()
    }

    fun setMuted(muted: Boolean) {
        isMuted = muted
    }

    fun playButtonClick() {
        if (isMuted) return
        // Trigger button click sound sample
    }

    fun playCandyPop() {
        if (isMuted) return
        // Trigger candy pop sound sample
    }

    fun playLevelStartFanfare() {
        if (isMuted) return
        // Trigger upbeat sweet fanfare
    }

    fun release() {
        soundPool?.release()
        soundPool = null
    }
}
