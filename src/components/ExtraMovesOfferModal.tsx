import React from 'react';
import { Play, Sparkles, X, AlertCircle, Star, Shield, Droplets, Zap } from 'lucide-react';
import { LevelGoal, SoundSettings } from '../types/game';
import { ResolvedObjective } from '../game-engine/boardEngine';
import { soundEngine } from '../audio/SoundEffects';
import { OriginalCandy } from './OriginalCandies';

interface ExtraMovesOfferModalProps {
  isOpen: boolean;
  goals: LevelGoal[];
  collectedCounts: Record<string, number>;
  resolvedObjectives?: ResolvedObjective[];
  levelNumber: number;
  soundSettings: SoundSettings;
  onWatchAd: () => void;
  onDecline: () => void;
  isLoading?: boolean;
}

export const ExtraMovesOfferModal: React.FC<ExtraMovesOfferModalProps> = ({
  isOpen,
  goals,
  collectedCounts,
  resolvedObjectives,
  levelNumber,
  soundSettings,
  onWatchAd,
  onDecline,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const handleWatchClick = () => {
    if (isLoading) return;
    if (soundSettings.soundEffectsEnabled) {
      soundEngine.playClick(soundSettings.masterVolume);
    }
    onWatchAd();
  };

  const handleDeclineClick = () => {
    if (isLoading) return;
    if (soundSettings.soundEffectsEnabled) {
      soundEngine.playClick(soundSettings.masterVolume);
    }
    onDecline();
  };

  const remainingResolved =
    resolvedObjectives && resolvedObjectives.length > 0
      ? resolvedObjectives.filter((o) => !o.isComplete)
      : null;

  // Identify uncompleted legacy goals to show the player how close they are
  const remainingGoals = goals
    .map((g) => {
      const collected = collectedCounts[g.candyType] || 0;
      const remaining = Math.max(0, g.requiredCount - collected);
      return {
        candyType: g.candyType,
        requiredCount: g.requiredCount,
        remaining,
      };
    })
    .filter((g) => g.remaining > 0);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm max-h-full overflow-y-auto overflow-x-hidden rounded-3xl bg-gradient-to-b from-[#3d0e37] via-[#240822] to-[#120311] border-4 border-amber-400/90 p-4 sm:p-6 text-center text-white shadow-[0_25px_60px_rgba(0,0,0,0.95)]">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />

        {/* Close / Decline X in upper corner */}
        <button
          onClick={handleDeclineClick}
          disabled={isLoading}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
          title="Decline Offer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon & Title */}
        <div className="w-14 h-14 mx-auto mb-2.5 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 border border-amber-200/50 flex items-center justify-center shadow-lg shadow-orange-500/30">
          <Sparkles className="w-8 h-8 text-white animate-pulse" />
        </div>

        {/* REQUIRED HEADING */}
        <h3 className="text-2xl sm:text-3xl font-black text-amber-300 tracking-wider uppercase drop-shadow-md">
          No Moves Left!
        </h3>

        {/* REQUIRED MESSAGE */}
        <p className="text-sm font-semibold text-pink-200/90 mt-1">
          You're so close! Get another chance.
        </p>

        {/* Remaining Objectives Preview (Shows player their proximity to winning) */}
        {remainingResolved ? (
          remainingResolved.length > 0 && (
            <div className="my-3.5 p-2.5 rounded-2xl bg-black/40 border border-white/15">
              <p className="text-[11px] font-bold tracking-wider uppercase text-amber-200/80 mb-2">
                Remaining Objectives:
              </p>
              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                {remainingResolved.map((item) => {
                  const obj = item.objective;
                  if (obj.type === 'collect_candy') {
                    return (
                      <div
                        key={item.key}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 border border-white/10"
                      >
                        <OriginalCandy type={obj.candyType} size={24} />
                        <span className="text-base font-black text-white">+{item.remaining}</span>
                      </div>
                    );
                  }
                  if (obj.type === 'clear_jelly') {
                    return (
                      <div
                        key={item.key}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 border border-white/10"
                      >
                        <Droplets className="w-4 h-4 text-fuchsia-300" />
                        <span className="text-xs font-bold text-fuchsia-100">Jelly</span>
                        <span className="text-base font-black text-white">+{item.remaining}</span>
                      </div>
                    );
                  }
                  if (obj.type === 'break_blocker') {
                    return (
                      <div
                        key={item.key}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 border border-white/10"
                      >
                        <Shield className="w-4 h-4 text-amber-300" />
                        <span className="text-xs font-bold capitalize text-amber-100">
                          {obj.blockerType}
                        </span>
                        <span className="text-base font-black text-white">+{item.remaining}</span>
                      </div>
                    );
                  }
                  if (obj.type === 'collect_special') {
                    return (
                      <div
                        key={item.key}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 border border-white/10"
                      >
                        <Zap className="w-4 h-4 text-cyan-300" />
                        <span className="text-xs font-bold text-cyan-100">Special</span>
                        <span className="text-base font-black text-white">+{item.remaining}</span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={item.key}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 border border-white/10"
                    >
                      <Star className="w-4 h-4 text-amber-300 fill-amber-300" />
                      <span className="text-sm font-black text-white">
                        +{item.remaining.toLocaleString()} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          remainingGoals.length > 0 && (
            <div className="my-3.5 p-2.5 rounded-2xl bg-black/40 border border-white/15">
              <p className="text-[11px] font-bold tracking-wider uppercase text-amber-200/80 mb-2">
                Candies Needed:
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {remainingGoals.map((g) => (
                  <div
                    key={g.candyType}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/10 border border-white/10"
                  >
                    <OriginalCandy type={g.candyType} size={24} />
                    <span className="text-base font-black text-white">+{g.remaining}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* Reward Value Feature Callout */}
        <div className="py-2 px-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-pink-500/20 border border-amber-400/30 mb-4 flex items-center justify-center gap-2">
          <div className="w-6 h-6 rounded-full bg-amber-400 text-purple-950 font-black text-xs flex items-center justify-center shadow">
            +5
          </div>
          <span className="text-xs font-extrabold text-amber-100 tracking-wide">
            5 EXTRA MOVES WILL BE GRANTED
          </span>
        </div>

        {/* PROMINENT BUTTON: "WATCH AD – GET 5 MOVES" */}
        <button
          onClick={handleWatchClick}
          disabled={isLoading}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 hover:from-amber-300 hover:via-orange-400 hover:to-pink-400 active:scale-[0.98] text-white font-black text-sm sm:text-base tracking-wide uppercase shadow-[0_8px_25px_rgba(245,158,11,0.5)] border-2 border-yellow-200 flex items-center justify-center gap-2.5 cursor-pointer transition-all"
        >
          <Play className="w-5 h-5 fill-white text-white drop-shadow" />
          <span>WATCH AD – GET 5 MOVES</span>
        </button>

        {/* SECONDARY OPTION TO FINISH THE LEVEL */}
        <button
          onClick={handleDeclineClick}
          disabled={isLoading}
          className="mt-2.5 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-white/80 hover:text-white font-bold text-xs tracking-wider uppercase transition-all cursor-pointer"
        >
          Finish Level
        </button>

        {/* Context / Rule notice */}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-white/50">
          <AlertCircle className="w-3 h-3 text-amber-400/80 shrink-0" />
          <span>1 ad reward allowed per attempt • Level {levelNumber}</span>
        </div>
      </div>
    </div>
  );
};
