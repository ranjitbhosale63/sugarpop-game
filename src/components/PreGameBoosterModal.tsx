import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Coins,
  Heart,
  Star,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  LevelInfo,
  PlayerProfile,
  PreGameBoosterType,
  SoundSettings,
} from '../types/game';
import {
  PRE_GAME_BOOSTERS,
  calculatePreGameBoostersCost,
  canAffordCoins,
  formatRegenCountdown,
} from '../game-engine/economyEngine';
import { RewardedAdResult } from '../services/rewardedAds';
import { RewardedAdPlayerModal } from './RewardedAdPlayerModal';
import { soundEngine } from '../audio/SoundEffects';
import { OriginalCandy } from './OriginalCandies';

interface PreGameBoosterModalProps {
  level: LevelInfo | null;
  playerProfile: PlayerProfile;
  soundSettings: SoundSettings;
  onStartLevel: (level: LevelInfo, selectedBoosters: PreGameBoosterType[]) => void;
  onClaimRewardedLife?: (result: RewardedAdResult) => boolean;
  onClose: () => void;
}

const PRE_GAME_ORDER: PreGameBoosterType[] = ['striped', 'wrapped', 'color_bomb'];

export const PreGameBoosterModal: React.FC<PreGameBoosterModalProps> = ({
  level,
  playerProfile,
  soundSettings,
  onStartLevel,
  onClaimRewardedLife,
  onClose,
}) => {
  const [selectedBoosters, setSelectedBoosters] = useState<PreGameBoosterType[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'error' | 'success'>('error');
  const [isStarting, setIsStarting] = useState(false);
  const [showLifeAdPlayer, setShowLifeAdPlayer] = useState(false);
  const hasStartedRef = useRef(false);
  const isClaimingLifeAdRef = useRef(false);

  useEffect(() => {
    setSelectedBoosters([]);
    setFeedbackMessage(null);
    setFeedbackTone('error');
    setIsStarting(false);
    setShowLifeAdPlayer(false);
    hasStartedRef.current = false;
    isClaimingLifeAdRef.current = false;
  }, [level?.levelNumber, level === null]);

  if (!level) return null;

  const totalCost = calculatePreGameBoostersCost(selectedBoosters);
  const isFullLives = playerProfile.lives >= playerProfile.maxLives;
  const hasLives = playerProfile.lives > 0;

  const handleToggleBooster = (boosterId: PreGameBoosterType) => {
    if (isStarting) return;
    const isAlreadySelected = selectedBoosters.includes(boosterId);

    if (isAlreadySelected) {
      if (soundSettings.soundEffectsEnabled) {
        soundEngine.playClick(soundSettings.masterVolume);
      }
      setSelectedBoosters((prev) => prev.filter((id) => id !== boosterId));
      setFeedbackMessage(null);
      return;
    }

    const boosterCost = PRE_GAME_BOOSTERS[boosterId].cost;
    const projectedCost = totalCost + boosterCost;

    if (!canAffordCoins(playerProfile.coins, projectedCost)) {
      if (soundSettings.soundEffectsEnabled) {
        soundEngine.playInvalidSwap(soundSettings.masterVolume);
      }
      if (soundSettings.hapticsEnabled && 'vibrate' in navigator) {
        navigator.vibrate(35);
      }
      setFeedbackTone('error');
      setFeedbackMessage(
        `Not enough coins for ${PRE_GAME_BOOSTERS[boosterId].name} (need ${projectedCost} coins).`
      );
      return;
    }

    if (soundSettings.soundEffectsEnabled) {
      soundEngine.playClick(soundSettings.masterVolume);
    }
    setSelectedBoosters((prev) => [...prev, boosterId]);
    setFeedbackMessage(null);
  };

  const handleWatchLifeAd = () => {
    if (hasLives || isStarting || showLifeAdPlayer || isClaimingLifeAdRef.current) {
      return;
    }
    if (soundSettings.soundEffectsEnabled) {
      soundEngine.playClick(soundSettings.masterVolume);
    }
    setFeedbackMessage(null);
    setShowLifeAdPlayer(true);
  };

  const handleLifeAdResult = (result: RewardedAdResult) => {
    setShowLifeAdPlayer(false);

    if (isClaimingLifeAdRef.current) {
      return;
    }

    if (result.success && result.rewardGranted && result.reward) {
      isClaimingLifeAdRef.current = true;
      const granted = onClaimRewardedLife ? onClaimRewardedLife(result) : false;
      isClaimingLifeAdRef.current = false;

      if (granted) {
        if (soundSettings.soundEffectsEnabled) {
          soundEngine.playPlayFanfare(soundSettings.masterVolume);
        }
        setFeedbackTone('success');
        setFeedbackMessage('+1 Life earned! Tap Play Level when ready.');
      } else {
        setFeedbackTone('error');
        setFeedbackMessage('Could not grant life reward or lives are already full.');
      }
    } else {
      setFeedbackTone('error');
      setFeedbackMessage('Ad skipped or failed — no life granted.');
    }
  };

  const handlePlayClick = () => {
    if (isStarting || hasStartedRef.current || showLifeAdPlayer) return;

    if (!hasLives) {
      if (soundSettings.soundEffectsEnabled) {
        soundEngine.playInvalidSwap(soundSettings.masterVolume);
      }
      setFeedbackTone('error');
      setFeedbackMessage(
        `Out of lives! Next life in ${formatRegenCountdown(playerProfile.nextLifeSeconds)}.`
      );
      return;
    }

    if (!canAffordCoins(playerProfile.coins, totalCost)) {
      if (soundSettings.soundEffectsEnabled) {
        soundEngine.playInvalidSwap(soundSettings.masterVolume);
      }
      setFeedbackTone('error');
      setFeedbackMessage('Insufficient coins for selected boosters.');
      return;
    }

    hasStartedRef.current = true;
    setIsStarting(true);
    if (soundSettings.soundEffectsEnabled) {
      soundEngine.playPlayFanfare(soundSettings.masterVolume);
    }
    onStartLevel(level, selectedBoosters);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm max-h-full overflow-y-auto overflow-x-hidden rounded-3xl bg-gradient-to-b from-[#3f145f] via-[#240a3d] to-[#130423] border-4 border-[#ff70a6] p-4 sm:p-5 text-white shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
        {/* Close Button */}
        <button
          onClick={() => {
            if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
            onClose();
          }}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
          aria-label="Close level start"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center pr-6 pl-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-amber-500 border border-white/40 text-[10px] font-black tracking-widest uppercase shadow">
            <Sparkles className="w-3 h-3 text-white" />
            <span>LEVEL {level.levelNumber}</span>
          </div>
          <h2 className="mt-1.5 text-xl sm:text-2xl font-black text-amber-200 tracking-wide">
            {level.name}
          </h2>
          <p className="text-xs text-pink-100/80 mt-0.5">{level.goalDescription}</p>
        </div>

        {/* Stars + High Score + Currency Strip */}
        <div className="mt-3 flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-black/40 border border-white/15">
          <div className="flex items-center gap-1">
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                className={`w-4 h-4 ${
                  s <= (level.starsEarned || 0)
                    ? 'fill-amber-400 text-amber-300'
                    : 'fill-white/10 text-white/25'
                }`}
              />
            ))}
            {(level.highScore ?? 0) > 0 && (
              <span className="ml-1 text-[10px] font-bold text-emerald-300">
                Best {level.highScore?.toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-black">
            <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-pink-500/25 border border-pink-400/40">
              <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-400" />
              <span>
                {playerProfile.lives}/{playerProfile.maxLives}
              </span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/25 border border-amber-400/40 text-amber-300">
              <Coins className="w-3.5 h-3.5 fill-amber-400 text-amber-300" />
              <span>{playerProfile.coins}</span>
            </div>
          </div>
        </div>

        {/* Lives Regeneration Status Banner */}
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white/75">
          <Clock className="w-3.5 h-3.5 text-pink-300" />
          {isFullLives ? (
            <span className="text-emerald-300 font-bold">Lives Full</span>
          ) : (
            <span>
              Next life in{' '}
              <span className="font-black text-amber-300 tabular-nums">
                {formatRegenCountdown(playerProfile.nextLifeSeconds)}
              </span>
            </span>
          )}
        </div>

        {/* Pre-Game Boosters Selection */}
        <div className="mt-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-200">
              Pre-Game Boosters (Optional)
            </span>
            {totalCost > 0 && (
              <span className="text-[11px] font-black text-amber-300 flex items-center gap-1">
                <Coins className="w-3 h-3 fill-amber-400" />
                Total: {totalCost}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {PRE_GAME_ORDER.map((id) => {
              const def = PRE_GAME_BOOSTERS[id];
              const isSelected = selectedBoosters.includes(id);
              const canSelectMore =
                isSelected || canAffordCoins(playerProfile.coins, totalCost + def.cost);

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleToggleBooster(id)}
                  className={`relative flex flex-col items-center justify-between p-2 rounded-2xl border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-b from-amber-500/35 to-pink-600/35 border-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.45)] scale-[1.03]'
                      : canSelectMore
                      ? 'bg-white/10 hover:bg-white/15 border-white/20 active:scale-95'
                      : 'bg-black/35 border-white/10 opacity-55'
                  }`}
                  title={def.description}
                >
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-400 border-2 border-white flex items-center justify-center shadow">
                      <Check className="w-3 h-3 text-purple-950 stroke-[3]" />
                    </div>
                  )}

                  <div className="w-10 h-10 flex items-center justify-center my-0.5">
                    {id === 'color_bomb' && (
                      <OriginalCandy type="strawberry_drop" special="color_bomb" size={36} />
                    )}
                    {id === 'striped' && (
                      <OriginalCandy type="blueberry_oval" special="striped_h" size={36} />
                    )}
                    {id === 'wrapped' && (
                      <OriginalCandy type="plum_heart" special="wrapped" size={36} />
                    )}
                  </div>

                  <span className="text-[10px] font-black text-white leading-tight text-center">
                    {def.shortName}
                  </span>

                  <div
                    className={`mt-1.5 px-2 py-0.5 rounded-full flex items-center gap-1 text-[10px] font-black ${
                      canSelectMore
                        ? 'bg-black/45 text-amber-300 border border-amber-400/30'
                        : 'bg-rose-950/70 text-rose-300 border border-rose-400/30'
                    }`}
                  >
                    <Coins className="w-2.5 h-2.5 fill-amber-400 text-amber-300" />
                    <span>{def.cost}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Validation / Insufficient Coins / Reward Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`mt-3 px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
              feedbackTone === 'success'
                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                : 'bg-rose-500/20 border-rose-400/60 text-rose-200'
            }`}
          >
            <AlertCircle
              className={`w-4 h-4 shrink-0 ${
                feedbackTone === 'success' ? 'text-emerald-300' : 'text-rose-300'
              }`}
            />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex flex-col gap-2">
          {!hasLives && (
            <button
              type="button"
              onClick={handleWatchLifeAd}
              disabled={isStarting || showLifeAdPlayer}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 hover:brightness-110 active:scale-[0.98] border-2 border-yellow-200 text-white font-black text-sm tracking-wide uppercase flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(245,158,11,0.45)] cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-white text-white shrink-0" />
              <span>Watch Ad – Get 1 Life</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePlayClick}
            disabled={!hasLives || isStarting || showLifeAdPlayer}
            className={`w-full py-3.5 px-4 rounded-2xl font-black text-base tracking-wider uppercase flex items-center justify-center gap-2 transition-all border-2 ${
              hasLives
                ? 'bg-gradient-to-b from-[#ffe542] via-[#ff9b00] to-[#e64700] border-white/70 text-white shadow-[0_8px_22px_rgba(255,155,0,0.55)] hover:brightness-110 active:scale-95 cursor-pointer shine-effect'
                : 'bg-white/10 border-white/15 text-white/50 cursor-not-allowed'
            }`}
          >
            <Play className="w-5 h-5 fill-current" />
            <span>
              {!hasLives
                ? `Wait ${formatRegenCountdown(playerProfile.nextLifeSeconds)}`
                : totalCost > 0
                ? `PLAY (${totalCost} COINS)`
                : 'PLAY LEVEL'}
            </span>
          </button>

          <button
            type="button"
            disabled={isStarting}
            onClick={() => {
              if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
              onClose();
            }}
            className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs font-bold uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Simulated Rewarded Ad Player for +1 Life */}
      <RewardedAdPlayerModal
        isOpen={showLifeAdPlayer}
        levelNumber={level.levelNumber}
        rewardType="extra_life"
        soundSettings={soundSettings}
        onAdResult={handleLifeAdResult}
      />
    </div>
  );
};
