import React from 'react';
import { Star, Lock, X, Play, Trophy, CheckCircle, ArrowLeft } from 'lucide-react';
import { LevelInfo, SoundSettings } from '../types/game';
import { soundEngine } from '../audio/SoundEffects';

interface LevelSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  levels: LevelInfo[];
  currentLevel: number;
  highestUnlockedLevel: number;
  onSelectLevel: (level: LevelInfo) => void;
  soundSettings: SoundSettings;
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  isOpen,
  onClose,
  levels,
  currentLevel,
  highestUnlockedLevel,
  onSelectLevel,
  soundSettings,
}) => {
  if (!isOpen) return null;

  const totalEarnedStars = levels.reduce((sum, l) => sum + (l.starsEarned || 0), 0);
  const maxPossibleStars = levels.length * 3;

  const handleLockedClick = (levelNumber: number) => {
    if (soundSettings.soundEffectsEnabled) {
      soundEngine.playInvalidSwap(soundSettings.masterVolume);
    }
    if (soundSettings.hapticsEnabled && 'vibrate' in navigator) {
      navigator.vibrate(40);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-2.5 sm:p-3.5 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm max-h-full flex flex-col rounded-3xl bg-gradient-to-b from-[#3a165c] via-[#240c3d] to-[#140624] border-4 border-[#ff70a6] shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden text-white">
        {/* Glow backdrop decorative accent */}
        <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-44 h-44 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
                onClose();
              }}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white/80 hover:text-white cursor-pointer mr-1"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="p-2 rounded-2xl bg-amber-400/20 border border-amber-300/40 text-amber-300">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-orange-300">
                LEVEL SELECT
              </h2>
              <p className="text-[11px] text-white/70">
                ⭐ {totalEarnedStars}/{maxPossibleStars} Stars Collected
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
              onClose();
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white/80 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Level List / Roadmap Grid */}
        <div className="flex-1 min-h-0 p-3 sm:p-4 overflow-y-auto space-y-3 divide-y divide-white/5">
          {levels.map((lvl) => {
            const isCompleted = lvl.starsEarned > 0;
            const isUnlocked = lvl.isUnlocked;
            const isCurrent = lvl.levelNumber === currentLevel;

            return (
              <div
                key={lvl.levelNumber}
                onClick={() => {
                  if (isUnlocked) {
                    if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
                    onSelectLevel(lvl);
                  } else {
                    handleLockedClick(lvl.levelNumber);
                  }
                }}
                className={`pt-3 first:pt-0 group flex items-center justify-between p-3.5 rounded-2xl transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-gradient-to-r from-pink-500/30 to-purple-500/30 border-2 border-pink-400 shadow-lg scale-[1.01]'
                    : isCompleted
                    ? 'bg-emerald-950/20 hover:bg-emerald-900/30 border border-emerald-400/30'
                    : isUnlocked
                    ? 'bg-white/5 hover:bg-white/10 border border-white/15'
                    : 'bg-black/25 opacity-55 border border-white/5 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  {/* Level Number Badge */}
                  <div
                    className={`relative w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-md shrink-0 ${
                      isCompleted
                        ? 'bg-gradient-to-b from-emerald-400 to-green-600 text-white'
                        : isCurrent
                        ? 'bg-gradient-to-b from-amber-300 to-orange-500 text-white ring-2 ring-white animate-pulse'
                        : isUnlocked
                        ? 'bg-gradient-to-b from-purple-500 to-indigo-600 text-white'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {isUnlocked ? (
                      lvl.levelNumber
                    ) : (
                      <Lock className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {/* Level Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm sm:text-base text-white group-hover:text-amber-200 transition-colors">
                        Level {lvl.levelNumber}: {lvl.name}
                      </h3>
                      {isCompleted && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white flex items-center gap-0.5">
                          <CheckCircle className="w-2.5 h-2.5" />
                          <span>Done</span>
                        </span>
                      )}
                      {!isCompleted && isUnlocked && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white">
                          Play
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/60 flex items-center gap-1.5 mt-0.5">
                      <span>
                        🎯 {lvl.world ? `${lvl.world} • ` : ''}
                        {lvl.goalDescription}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Stars and Status */}
                <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                  {isUnlocked ? (
                    <>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3].map((starNum) => (
                          <Star
                            key={starNum}
                            className={`w-4 h-4 ${
                              starNum <= lvl.starsEarned
                                ? 'fill-amber-400 text-amber-300 drop-shadow-[0_1px_4px_rgba(251,191,36,0.8)]'
                                : 'fill-white/10 text-white/25'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-amber-300/80 font-bold">
                        Target: {lvl.targetScore.toLocaleString()}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> Locked
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer with Direct Play Button */}
        <div className="p-2.5 sm:p-3.5 bg-black/40 border-t border-white/10 flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={() => {
              if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
              onClose();
            }}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            Close
          </button>

          <button
            onClick={() => {
              // Play current unlocked level
              const active =
                levels.find((l) => l.levelNumber === currentLevel && l.isUnlocked) ||
                levels.find((l) => l.isUnlocked && l.starsEarned === 0) ||
                levels[0];
              onSelectLevel(active);
            }}
            className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 text-white font-extrabold text-xs sm:text-sm candy-btn-shadow hover:brightness-110 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>PLAY LEVEL {currentLevel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
