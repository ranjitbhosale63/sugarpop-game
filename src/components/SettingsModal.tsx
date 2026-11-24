import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Music, Smartphone, X, RotateCcw, Sparkles, AlertTriangle } from 'lucide-react';
import { SoundSettings } from '../types/game';
import { soundEngine } from '../audio/SoundEffects';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SoundSettings;
  onUpdateSettings: (newSettings: SoundSettings) => void;
  onResetProgress: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetProgress,
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const isResettingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setShowResetConfirm(false);
      setIsResetting(false);
      isResettingRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    if (settings.soundEffectsEnabled) soundEngine.playClick(settings.masterVolume);
    setShowResetConfirm(false);
    onClose();
  };

  const handleConfirmReset = () => {
    if (isResettingRef.current || isResetting) return;
    isResettingRef.current = true;
    setIsResetting(true);
    if (settings.soundEffectsEnabled) soundEngine.playClick(settings.masterVolume);
    setShowResetConfirm(false);
    onResetProgress();
  };

  const handleToggleSound = () => {
    const nextVal = !settings.soundEffectsEnabled;
    const updated = { ...settings, soundEffectsEnabled: nextVal };
    onUpdateSettings(updated);
    if (nextVal) {
      soundEngine.playToggle(true, settings.masterVolume);
    }
  };

  const handleToggleMusic = () => {
    const nextVal = !settings.musicEnabled;
    const updated = { ...settings, musicEnabled: nextVal };
    onUpdateSettings(updated);
    if (settings.soundEffectsEnabled) {
      soundEngine.playToggle(nextVal, settings.masterVolume);
    }
    if (nextVal) {
      soundEngine.startMusic(settings.masterVolume, true);
    } else {
      soundEngine.stopMusic();
    }
  };

  const handleToggleHaptics = () => {
    const nextVal = !settings.hapticsEnabled;
    const updated = { ...settings, hapticsEnabled: nextVal };
    onUpdateSettings(updated);
    if (settings.soundEffectsEnabled) {
      soundEngine.playToggle(nextVal, settings.masterVolume);
    }
    if (nextVal && 'vibrate' in navigator) {
      navigator.vibrate([30, 20, 30]);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm max-h-full overflow-y-auto overflow-x-hidden rounded-3xl bg-gradient-to-b from-[#31134f] to-[#1a082c] border-4 border-[#ff77aa]/80 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-white p-4 sm:p-6">
        {/* Glow backdrop decorative accent */}
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-pink-500/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-purple-500/20 blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-pink-500/20 border border-pink-400/30 text-pink-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-orange-300">
              SETTINGS
            </h2>
          </div>
          <button
            onClick={handleCloseModal}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white/80 hover:text-white"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Setting Toggle Options */}
        <div className="mt-5 space-y-3.5">
          {/* Sound FX Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                {settings.soundEffectsEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold">Sound FX</p>
                <p className="text-xs text-white/60">Tactile candy pops & chimes</p>
              </div>
            </div>
            <button
              onClick={handleToggleSound}
              className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors ${
                settings.soundEffectsEnabled ? 'bg-emerald-500' : 'bg-white/20'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                  settings.soundEffectsEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Music Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Background Music</p>
                <p className="text-xs text-white/60">Gentle pastel chime melody</p>
              </div>
            </div>
            <button
              onClick={handleToggleMusic}
              className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors ${
                settings.musicEnabled ? 'bg-purple-500' : 'bg-white/20'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                  settings.musicEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Haptics / Vibration Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Vibration (Haptics)</p>
                <p className="text-xs text-white/60">Tactile feedback on supported devices</p>
              </div>
            </div>
            <button
              onClick={handleToggleHaptics}
              className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors ${
                settings.hapticsEnabled ? 'bg-amber-500' : 'bg-white/20'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                  settings.hapticsEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Master Volume Slider */}
        <div className="mt-4 p-3.5 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex justify-between items-center text-xs font-semibold mb-2">
            <span className="text-white/80">Master Volume</span>
            <span className="text-amber-300">{Math.round(settings.masterVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.masterVolume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              soundEngine.setMusicVolume(val);
              onUpdateSettings({ ...settings, masterVolume: val });
            }}
            className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>

        {/* Reset Progress Action / Inline Confirmation */}
        <div className="mt-4">
          {showResetConfirm ? (
            <div
              role="alertdialog"
              aria-labelledby="reset-confirm-title"
              aria-describedby="reset-confirm-desc"
              className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/40 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-xl bg-rose-500/25 text-rose-300 shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p id="reset-confirm-title" className="text-xs font-extrabold text-rose-200">
                    Reset all game progress?
                  </p>
                  <p id="reset-confirm-desc" className="text-[11px] text-white/75 leading-relaxed mt-0.5">
                    Your score, stars, unlocked levels, coins, and lives will be permanently reset. This cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (settings.soundEffectsEnabled) soundEngine.playClick(settings.masterVolume);
                    setShowResetConfirm(false);
                  }}
                  disabled={isResetting}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  disabled={isResetting}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-b from-rose-500 to-rose-700 hover:brightness-110 active:scale-95 transition-all text-xs font-extrabold text-white border border-rose-300/40 shadow-md cursor-pointer disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (settings.soundEffectsEnabled) soundEngine.playClick(settings.masterVolume);
                  setShowResetConfirm(true);
                }}
                className="flex items-center gap-1.5 text-xs text-pink-300/80 hover:text-pink-200 transition-colors py-1 px-2 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Game Progress</span>
              </button>

              <span className="text-[11px] text-white/40 font-mono">v1.0.0</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
