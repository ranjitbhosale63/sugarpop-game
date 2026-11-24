import React, { useState, useEffect, useRef } from 'react';
import { Play, X, AlertTriangle, CheckCircle2, ShieldCheck, Film } from 'lucide-react';
import {
  rewardVerification,
  RewardedAdResult,
  RewardedAdRewardType,
} from '../services/rewardedAds';
import { SoundSettings } from '../types/game';
import { soundEngine } from '../audio/SoundEffects';

interface RewardedAdPlayerModalProps {
  isOpen: boolean;
  levelNumber: number;
  rewardType?: RewardedAdRewardType;
  soundSettings: SoundSettings;
  onAdResult: (result: RewardedAdResult) => void;
}

export const RewardedAdPlayerModal: React.FC<RewardedAdPlayerModalProps> = ({
  isOpen,
  levelNumber,
  rewardType = 'extra_moves',
  soundSettings,
  onAdResult,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [isFinishing, setIsFinishing] = useState(false);
  const hasFinishedRef = useRef(false);
  const rewardLabel = rewardType === 'extra_life' ? '+1 Life' : '+5 Moves';

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSecondsRemaining(5);
      setIsFinishing(false);
      hasFinishedRef.current = false;
    }
  }, [isOpen]);

  // Automatic countdown timer (5 seconds)
  useEffect(() => {
    if (!isOpen || isFinishing) return;

    if (secondsRemaining <= 0) {
      handleCompleteAd('completed');
      return;
    }

    const timer = setTimeout(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOpen, secondsRemaining, isFinishing]);

  // Terminal dispatcher with single-dispatch guard
  const dispatchResult = (result: RewardedAdResult) => {
    if (hasFinishedRef.current) {
      console.warn('[RewardedAdPlayer] Duplicate dispatch blocked');
      return;
    }
    hasFinishedRef.current = true;
    setIsFinishing(true);
    onAdResult(result);
  };

  // 1. Success Flow: Verified Completion
  const handleCompleteAd = (reason: 'completed' = 'completed') => {
    if (hasFinishedRef.current) return;

    if (soundSettings.soundEffectsEnabled) {
      soundEngine.playMatch(2, soundSettings.masterVolume);
    }

    // Generate verified one-time token for the requested reward type
    const rewardToken = rewardVerification.createRewardToken(rewardType, levelNumber);

    dispatchResult({
      success: true,
      rewardGranted: true,
      reward: rewardToken,
      reason,
    });
  };

  // 2. Skipped / Cancelled Flow: No Reward
  const handleSkipOrCancel = () => {
    if (hasFinishedRef.current) return;

    if (soundSettings.soundEffectsEnabled) {
      soundEngine.playClick(soundSettings.masterVolume);
    }

    dispatchResult({
      success: false,
      rewardGranted: false,
      reason: 'skipped',
      errorMessage: 'Rewarded ad was closed or skipped before completion.',
    });
  };

  // 3. Simulated Failure Flow: No Reward
  const handleSimulateFailure = () => {
    if (hasFinishedRef.current) return;

    if (soundSettings.soundEffectsEnabled) {
      soundEngine.playInvalidSwap(soundSettings.masterVolume);
    }

    dispatchResult({
      success: false,
      rewardGranted: false,
      reason: 'failed',
      errorMessage: 'Simulated AdMob network error / no ad fill.',
    });
  };

  if (!isOpen) return null;

  const progressPercent = Math.max(0, Math.min(100, ((5 - secondsRemaining) / 5) * 100));

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/90 backdrop-blur-md select-none animate-fade-in">
      <div className="relative w-full max-w-sm max-h-full overflow-y-auto overflow-x-hidden rounded-3xl bg-gradient-to-b from-[#181828] via-[#10101c] to-[#08080f] border-2 border-indigo-500/50 p-4 sm:p-5 text-white shadow-2xl flex flex-col items-center">
        {/* DEV / TEST MODE IDENTIFIER BADGE */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black tracking-wider uppercase">
            <ShieldCheck className="w-3 h-3 text-amber-400" />
            <span>DEV TEST MODE • AD PREVIEW</span>
          </div>

          {/* Skip / Close early button */}
          <button
            onClick={handleSkipOrCancel}
            disabled={isFinishing}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-[11px] font-bold active:scale-95 transition-all cursor-pointer"
            title="Skip Ad Early"
          >
            <X className="w-3.5 h-3.5" />
            <span>Skip</span>
          </button>
        </div>

        {/* Ad Video Simulator Screen */}
        <div className="w-full h-36 sm:h-44 rounded-2xl bg-gradient-to-br from-purple-900/60 via-pink-900/40 to-indigo-900/60 border border-white/15 p-3 flex flex-col justify-between relative overflow-hidden shadow-inner shrink-0">
          {/* Subtle Ambient Background Animation */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
            <Film className="w-32 h-32 text-white animate-pulse" />
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-pink-300">
              <Play className="w-3.5 h-3.5 fill-pink-300" />
              <span>SugarPop Reward Video</span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-black/60 text-[11px] font-mono font-bold text-amber-300 border border-white/10">
              {secondsRemaining > 0 ? `${secondsRemaining}s` : 'DONE!'}
            </div>
          </div>

          {/* Center Graphic */}
          <div className="relative z-10 text-center my-auto">
            <div className="inline-block p-2 rounded-2xl bg-white/10 border border-white/20 mb-1">
              <span className="text-2xl">
                {rewardType === 'extra_life' ? '❤️ ✨ 🍬' : '🍬 ✨ 🍭'}
              </span>
            </div>
            <p className="text-xs font-extrabold text-white">Watch to earn {rewardLabel}!</p>
            <p className="text-[10px] text-white/60">
              {secondsRemaining > 0
                ? 'Reward verifies upon timer completion'
                : 'Ad completed! Verifying reward...'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="relative z-10 w-full">
            <div className="w-full h-2 rounded-full bg-black/50 overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-pink-500 transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Explanation for Browser Preview vs Native AdMob */}
        <p className="text-[11px] text-white/60 text-center my-3 leading-relaxed">
          In production Android builds, Google AdMob renders the real rewarded video ad.
          In browser preview, test all outcomes below:
        </p>

        {/* TESTING CONTROLS (Complete, Skip, Fail) */}
        <div className="w-full space-y-2">
          {/* Action 1: Complete Ad Immediately */}
          <button
            onClick={() => handleCompleteAd('completed')}
            disabled={isFinishing}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 active:scale-95 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Complete Ad (Verify & Grant {rewardLabel})</span>
          </button>

          <div className="flex gap-2">
            {/* Action 2: Skip / Cancel */}
            <button
              onClick={handleSkipOrCancel}
              disabled={isFinishing}
              className="flex-1 py-1.5 px-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-all"
            >
              <X className="w-3 h-3 text-rose-400" />
              <span>Skip Ad (No Reward)</span>
            </button>

            {/* Action 3: Simulate Error */}
            <button
              onClick={handleSimulateFailure}
              disabled={isFinishing}
              className="flex-1 py-1.5 px-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 active:scale-95 text-rose-300 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-all"
            >
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Simulate Failure</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
