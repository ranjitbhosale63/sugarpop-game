/**
 * Procedural Web Audio API sound synthesizer for Sugar Pop Match-3.
 * Generates 100% original, copyright-free sound effects:
 * - Juicy bubble pops
 * - Crisp tactile clicks
 * - Sweet ascending Play arpeggio
 * - Playful toggle sounds
 * - Looping ambient candy chime melody
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicOscillators: Set<OscillatorNode> = new Set();
  private musicGainNode: GainNode | null = null;
  private musicVolume = 0.8;
  private isMusicPlaying = false;
  private musicDesired = false;
  private autoplayBlocked = false;
  private musicInterval: number | null = null;
  private unlockListenersAttached = false;
  private boundUnlockHandler: (() => void) | null = null;

  private clampVolume(masterVolume: number): number {
    if (typeof masterVolume !== 'number' || !Number.isFinite(masterVolume)) {
      return 0.8;
    }
    return Math.max(0, Math.min(1, masterVolume));
  }

  private getAudioContext(resumeIfSuspended = true): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (resumeIfSuspended && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureMusicGain(ctx: AudioContext): GainNode {
    if (!this.musicGainNode || this.musicGainNode.context !== ctx) {
      this.musicGainNode = ctx.createGain();
      this.musicGainNode.gain.setValueAtTime(this.musicVolume, ctx.currentTime);
      this.musicGainNode.connect(ctx.destination);
    }
    return this.musicGainNode;
  }

  private stopActiveMusicOscillators() {
    this.musicOscillators.forEach((osc) => {
      try {
        osc.onended = null;
        osc.stop();
        osc.disconnect();
      } catch {
        // Oscillator may already have stopped
      }
    });
    this.musicOscillators.clear();
  }

  private clearMusicLoop() {
    this.isMusicPlaying = false;
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.stopActiveMusicOscillators();
  }

  private detachUnlockListeners() {
    if (typeof window === 'undefined' || !this.unlockListenersAttached || !this.boundUnlockHandler) {
      return;
    }
    window.removeEventListener('pointerdown', this.boundUnlockHandler, true);
    window.removeEventListener('keydown', this.boundUnlockHandler, true);
    this.unlockListenersAttached = false;
    this.boundUnlockHandler = null;
  }

  private attachUnlockListeners() {
    if (typeof window === 'undefined' || this.unlockListenersAttached) return;
    this.boundUnlockHandler = () => {
      this.detachUnlockListeners();
      this.autoplayBlocked = false;
      if (!this.musicDesired) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      this.startMusic(this.musicVolume, true);
    };
    window.addEventListener('pointerdown', this.boundUnlockHandler, { capture: true, passive: true });
    window.addEventListener('keydown', this.boundUnlockHandler, { capture: true, passive: true });
    this.unlockListenersAttached = true;
  }

  private beginMusicLoop(ctx: AudioContext) {
    if (this.isMusicPlaying) return;
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }

    const musicGain = this.ensureMusicGain(ctx);
    musicGain.gain.setValueAtTime(this.musicVolume, ctx.currentTime);

    this.isMusicPlaying = true;
    const melody = [
      { note: 392.0, dur: 0.3 }, // G4
      { note: 523.25, dur: 0.3 }, // C5
      { note: 659.25, dur: 0.3 }, // E5
      { note: 587.33, dur: 0.4 }, // D5
      { note: 523.25, dur: 0.3 }, // C5
      { note: 440.0, dur: 0.3 }, // A4
      { note: 523.25, dur: 0.5 }, // C5
    ];

    let noteIdx = 0;
    const playNextNote = () => {
      if (!this.isMusicPlaying || !this.musicDesired) return;
      if (ctx.state !== 'running') return;
      const current = melody[noteIdx];
      noteIdx = (noteIdx + 1) % melody.length;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(current.note, now);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + current.dur * 0.95);

      osc.connect(gain);
      gain.connect(musicGain);

      this.musicOscillators.add(osc);
      osc.onended = () => {
        this.musicOscillators.delete(osc);
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // Ignore cleanup errors on already-disconnected nodes
        }
      };

      osc.start(now);
      osc.stop(now + current.dur);
    };

    playNextNote();
    this.musicInterval = window.setInterval(playNextNote, 600);
  }

  // Juicy gelatinous bubble pop
  public playPop(pitchMultiplier = 1.0, masterVolume = 0.8) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 340 * pitchMultiplier;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.8, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.16);

    gain.gain.setValueAtTime(0.3 * masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.19);
  }

  // Tactile button click
  public playClick(masterVolume = 0.8) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.04);

    gain.gain.setValueAtTime(0.25 * masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Sweet play fanfare arpeggio (C5 - E5 - G5 - C6)
  public playPlayFanfare(masterVolume = 0.8) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const noteDuration = 0.09;
    const now = ctx.currentTime;

    notes.forEach((freq, index) => {
      const startTime = now + index * noteDuration;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Sweet vibraphone-like decay
      gain.gain.setValueAtTime(0.28 * masterVolume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  }

  // Toggle switch sound
  public playToggle(isOn: boolean, masterVolume = 0.8) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const startFreq = isOn ? 440 : 660;
    const endFreq = isOn ? 880 : 330;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);

    gain.gain.setValueAtTime(0.2 * masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Invalid swap bounce back sound (low gentle boing)
  public playInvalidSwap(masterVolume = 0.8) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

    gain.gain.setValueAtTime(0.22 * masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Juicy candy match chord with pitch scaling for combos
  public playMatch(comboCount = 1, masterVolume = 0.8) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const baseFreqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const multiplier = Math.min(1.8, 1 + (comboCount - 1) * 0.18);
    const now = ctx.currentTime;

    baseFreqs.slice(0, 3).forEach((f, idx) => {
      const startTime = now + idx * 0.035;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * multiplier, startTime);
      osc.frequency.exponentialRampToValueAtTime(f * multiplier * 1.05, startTime + 0.12);

      gain.gain.setValueAtTime(0.24 * masterVolume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.23);
    });
  }

  // Punchy striped-candy activation blast (sharp attack + directional whoosh + bright sweep)
  public playStripedBlast(masterVolume = 0.8, delaySec = 0) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const vol = Math.max(0, Math.min(1, masterVolume));
    if (vol <= 0) return;

    const startTime = ctx.currentTime + Math.max(0, delaySec);

    // 1. Sharp laser-candy punch sweep (triangle for rich, non-harsh warmth)
    const sweepOsc = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweepOsc.type = 'triangle';
    sweepOsc.frequency.setValueAtTime(1180, startTime);
    sweepOsc.frequency.exponentialRampToValueAtTime(290, startTime + 0.17);

    sweepGain.gain.setValueAtTime(0.001, startTime);
    sweepGain.gain.linearRampToValueAtTime(0.38 * vol, startTime + 0.008);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.19);

    sweepOsc.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweepOsc.start(startTime);
    sweepOsc.stop(startTime + 0.2);

    // 2. Bright crystalline shimmer accent (keeps the blast candy-sweet)
    const shimmerOsc = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.setValueAtTime(680, startTime);
    shimmerOsc.frequency.exponentialRampToValueAtTime(1380, startTime + 0.14);

    shimmerGain.gain.setValueAtTime(0.001, startTime);
    shimmerGain.gain.linearRampToValueAtTime(0.22 * vol, startTime + 0.012);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.21);

    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmerOsc.start(startTime);
    shimmerOsc.stop(startTime + 0.22);

    // 3. Directional whoosh via bandpass-filtered white noise burst
    const noiseDuration = 0.23;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * noiseDuration));
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const channelData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2.0, startTime);
    filter.frequency.setValueAtTime(2100, startTime);
    filter.frequency.exponentialRampToValueAtTime(680, startTime + noiseDuration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, startTime);
    noiseGain.gain.linearRampToValueAtTime(0.28 * vol, startTime + 0.015);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + noiseDuration);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(startTime);
    noiseSource.stop(startTime + noiseDuration + 0.01);
  }

  // Short rising magical charge shimmer for Color Bomb charge-up (240ms)
  public playColorBombCharge(durationMs = 240, masterVolume = 0.8) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const vol = Math.max(0, Math.min(1, masterVolume));
    if (vol <= 0) return;

    const durationSec = Math.max(0.08, durationMs / 1000);
    const now = ctx.currentTime;

    // Warm rising fundamental
    const baseOsc = ctx.createOscillator();
    const baseGain = ctx.createGain();
    baseOsc.type = 'sine';
    baseOsc.frequency.setValueAtTime(392, now); // G4
    baseOsc.frequency.exponentialRampToValueAtTime(784, now + durationSec); // G5

    baseGain.gain.setValueAtTime(0.001, now);
    baseGain.gain.linearRampToValueAtTime(0.14 * vol, now + durationSec * 0.65);
    baseGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec + 0.03);

    baseOsc.connect(baseGain);
    baseGain.connect(ctx.destination);
    baseOsc.start(now);
    baseOsc.stop(now + durationSec + 0.04);

    // Soft crystalline fifth shimmer
    const shimmerOsc = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmerOsc.type = 'triangle';
    shimmerOsc.frequency.setValueAtTime(587.33, now); // D5
    shimmerOsc.frequency.exponentialRampToValueAtTime(1174.66, now + durationSec); // D6

    shimmerGain.gain.setValueAtTime(0.001, now);
    shimmerGain.gain.linearRampToValueAtTime(0.075 * vol, now + durationSec * 0.7);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec + 0.03);

    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmerOsc.start(now);
    shimmerOsc.stop(now + durationSec + 0.04);
  }

  // Sequential crisp candy-pop audio synchronized with Color Bomb target clearing (max 8 sampled targets)
  public playColorBombSequence(popDelaysMs: number[], masterVolume = 0.8) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const vol = Math.max(0, Math.min(1, masterVolume));
    if (vol <= 0 || !popDelaysMs || popDelaysMs.length === 0) return;

    const sortedDelays = popDelaysMs
      .filter((d) => Number.isFinite(d) && d >= 0)
      .sort((a, b) => a - b);

    if (sortedDelays.length === 0) return;

    const maxSamples = 8;
    const sampledDelays: number[] = [];
    if (sortedDelays.length <= maxSamples) {
      sampledDelays.push(...sortedDelays);
    } else {
      for (let i = 0; i < maxSamples; i++) {
        const idx = Math.round((i * (sortedDelays.length - 1)) / (maxSamples - 1));
        sampledDelays.push(sortedDelays[idx]);
      }
    }

    const now = ctx.currentTime;
    const total = sampledDelays.length;

    sampledDelays.forEach((delayMs, idx) => {
      const startTime = now + delayMs / 1000;
      const progress = total <= 1 ? 0 : idx / (total - 1);
      const pitchMultiplier = 1 + progress * 0.45;
      const baseFreq = 420 * pitchMultiplier;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, startTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, startTime + 0.045);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.15, startTime + 0.11);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.14 * vol, startTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.125);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.135);
    });
  }

  // Triumphant Level Win fanfare
  public playLevelWin(masterVolume = 0.8) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5, E5, G5, C6, E6
    const now = ctx.currentTime;

    notes.forEach((freq, index) => {
      const startTime = now + index * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.3 * masterVolume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.46);
    });
  }

  // Immediately update volume of currently playing background music
  public setMusicVolume(masterVolume = 0.8) {
    this.musicVolume = this.clampVolume(masterVolume);
    if (this.ctx && this.musicGainNode) {
      try {
        this.musicGainNode.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.02);
      } catch {
        this.musicGainNode.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      }
    }
  }

  // Sweet gentle ambient background music with autoplay & single-instance protection
  public startMusic(masterVolume = 0.8, fromUserGesture = true) {
    this.musicDesired = true;
    this.setMusicVolume(masterVolume);

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.clearMusicLoop();
      return;
    }

    if (this.isMusicPlaying) {
      return;
    }

    if (this.autoplayBlocked && !fromUserGesture) {
      this.attachUnlockListeners();
      return;
    }

    const ctx = this.getAudioContext(false);
    if (!ctx) return;

    if (ctx.state === 'running') {
      this.autoplayBlocked = false;
      this.detachUnlockListeners();
      this.beginMusicLoop(ctx);
      return;
    }

    ctx
      .resume()
      .then(() => {
        if (ctx.state === 'running') {
          this.autoplayBlocked = false;
          this.detachUnlockListeners();
          if (
            this.musicDesired &&
            (typeof document === 'undefined' || document.visibilityState !== 'hidden')
          ) {
            this.beginMusicLoop(ctx);
          }
        } else {
          this.autoplayBlocked = true;
          if (this.musicDesired) {
            this.attachUnlockListeners();
          }
        }
      })
      .catch(() => {
        this.autoplayBlocked = true;
        if (this.musicDesired) {
          this.attachUnlockListeners();
        }
      });
  }

  public pauseMusic() {
    this.clearMusicLoop();
  }

  public resumeMusic(masterVolume = this.musicVolume) {
    if (!this.musicDesired) return;
    this.startMusic(masterVolume, false);
  }

  public stopMusic() {
    this.musicDesired = false;
    this.autoplayBlocked = false;
    this.detachUnlockListeners();
    this.clearMusicLoop();
  }
}

export const soundEngine = new SoundEngine();
