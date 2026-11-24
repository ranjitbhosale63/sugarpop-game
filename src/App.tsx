/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AndroidHomeScreen } from './components/AndroidHomeScreen';
import { SettingsModal } from './components/SettingsModal';
import { LevelSelectModal } from './components/LevelSelectModal';
import { CandyWorldMap } from './components/CandyWorldMap';
import { LevelBoardPreview, LevelWinCoinSummary } from './components/LevelBoardPreview';
import { PreGameBoosterModal } from './components/PreGameBoosterModal';
import {
  BoosterType,
  LevelInfo,
  PlayerProfile,
  PreGameBoosterType,
  SoundSettings,
} from './types/game';
import { INITIAL_LEVELS } from './game-engine/levelCatalog';
import { soundEngine } from './audio/SoundEffects';
import {
  loadGameData,
  saveGameData,
  clearGameData,
  getFreshState,
  loadSoundSettings,
  saveSoundSettings,
} from './utils/storage';
import {
  addCoins,
  calculateLevelCompletionCoinReward,
  calculatePreGameBoostersCost,
  deductCoins,
  deductLife,
  grantLife,
  syncLivesWithTimestamp,
} from './game-engine/economyEngine';
import { RewardedAdResult, rewardedAdsService } from './services/rewardedAds';

export default function App() {
  // Load initial progress from device localStorage
  const [initialData] = useState(() => loadGameData());

  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>(initialData.playerProfile);
  const [levels, setLevels] = useState<LevelInfo[]>(initialData.levels);

  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => loadSoundSettings());

  const [activeScreen, setActiveScreen] = useState<'home' | 'map' | 'game'>('home');
  const [selectedLevel, setSelectedLevel] = useState<LevelInfo>(() => {
    const current =
      initialData.levels.find(
        (l) => l.levelNumber === initialData.playerProfile.currentLevel && l.isUnlocked
      ) || initialData.levels[0];
    return current;
  });

  // Pre-game booster launch state & active boosters for the launched level attempt
  const [pendingStartLevel, setPendingStartLevel] = useState<LevelInfo | null>(null);
  const [activePreGameBoosters, setActivePreGameBoosters] = useState<PreGameBoosterType[]>([]);
  const [levelLaunchNonce, setLevelLaunchNonce] = useState(0);
  const [lastWinReward, setLastWinReward] = useState<LevelWinCoinSummary | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLevelSelectOpen, setIsLevelSelectOpen] = useState(false);

  // Stable refs to eliminate stale closure & React StrictMode double-update issues
  const selectedLevelRef = useRef(selectedLevel);
  selectedLevelRef.current = selectedLevel;

  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  const playerProfileRef = useRef(playerProfile);
  playerProfileRef.current = playerProfile;

  const soundSettingsRef = useRef(soundSettings);
  soundSettingsRef.current = soundSettings;

  const hasMountedSoundSettingsRef = useRef(false);

  const processedVictoryAttemptsRef = useRef<Set<string>>(new Set());
  const processedLifeLossAttemptsRef = useRef<Set<string>>(new Set());
  const processedLifeRewardTokensRef = useRef<Set<string>>(new Set());

  // Live 1-second life regeneration tick whenever player has missing lives
  useEffect(() => {
    if (playerProfile.lives >= playerProfile.maxLives) return;

    const timerId = window.setInterval(() => {
      setPlayerProfile((prev) => {
        const synced = syncLivesWithTimestamp(prev, Date.now());
        if (
          synced.lives === prev.lives &&
          synced.nextLifeSeconds === prev.nextLifeSeconds &&
          synced.lastLifeUpdatedAt === prev.lastLifeUpdatedAt
        ) {
          return prev;
        }
        playerProfileRef.current = synced;
        return synced;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [playerProfile.lives, playerProfile.maxLives]);

  // Catch up elapsed offline time when tab/window returns to focus
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      setPlayerProfile((prev) => {
        if (prev.lives >= prev.maxLives) return prev;
        const synced = syncLivesWithTimestamp(prev, Date.now());
        playerProfileRef.current = synced;
        return synced;
      });
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  // Synchronize save to localStorage whenever profile or levels change
  useEffect(() => {
    saveGameData(playerProfile, levels);
  }, [playerProfile, levels]);

  // Persist sound settings on user changes without overwriting saved values during startup
  useEffect(() => {
    if (!hasMountedSoundSettingsRef.current) {
      hasMountedSoundSettingsRef.current = true;
      return;
    }
    saveSoundSettings(soundSettings);
  }, [soundSettings]);

  // Keep background music volume and playback state synchronized with settings
  useEffect(() => {
    soundEngine.setMusicVolume(soundSettings.masterVolume);
    if (soundSettings.musicEnabled) {
      soundEngine.startMusic(soundSettings.masterVolume, false);
    } else {
      soundEngine.stopMusic();
    }
  }, [soundSettings.musicEnabled, soundSettings.masterVolume]);

  // Pause background music when document becomes hidden and resume only when enabled & visible
  useEffect(() => {
    const handleMusicVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        soundEngine.pauseMusic();
      } else if (document.visibilityState === 'visible') {
        const latest = soundSettingsRef.current;
        if (latest.musicEnabled) {
          soundEngine.resumeMusic(latest.masterVolume);
        }
      }
    };

    document.addEventListener('visibilitychange', handleMusicVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleMusicVisibilityChange);
      soundEngine.stopMusic();
    };
  }, []);

  // Handle Play button clicked from Home Screen: opens the Candy World Map
  const handlePlayClick = useCallback(() => {
    setActiveScreen('map');
  }, []);

  // Open pre-game booster modal instead of launching immediately without booster option / life check
  const handleSelectLevelFromMap = useCallback((level: LevelInfo) => {
    if (!level.isUnlocked) return;
    const synced = syncLivesWithTimestamp(playerProfileRef.current, Date.now());
    playerProfileRef.current = synced;
    setPlayerProfile(synced);
    setPendingStartLevel(level);
  }, []);

  const handleSelectLevel = useCallback((level: LevelInfo) => {
    if (!level.isUnlocked) return;
    setIsLevelSelectOpen(false);
    const synced = syncLivesWithTimestamp(playerProfileRef.current, Date.now());
    playerProfileRef.current = synced;
    setPlayerProfile(synced);
    setPendingStartLevel(level);
  }, []);

  const handleCancelPreGameModal = useCallback(() => {
    // Exiting before starting never deducts coins or lives
    setPendingStartLevel(null);
  }, []);

  const handleStartLevelWithBoosters = useCallback(
    (level: LevelInfo, selectedBoosters: PreGameBoosterType[]) => {
      const synced = syncLivesWithTimestamp(playerProfileRef.current, Date.now());
      if (synced.lives <= 0) {
        playerProfileRef.current = synced;
        setPlayerProfile(synced);
        return;
      }

      const cost = calculatePreGameBoostersCost(selectedBoosters);
      const deduction = deductCoins(synced.coins, cost);
      if (!deduction.success) {
        return;
      }

      const updatedProfile: PlayerProfile = {
        ...synced,
        coins: deduction.nextCoins,
        currentLevel: level.levelNumber,
        highestUnlockedLevel: Math.max(synced.highestUnlockedLevel, level.levelNumber),
      };

      playerProfileRef.current = updatedProfile;
      setPlayerProfile(updatedProfile);
      saveGameData(updatedProfile, levelsRef.current);

      setSelectedLevel(level);
      setActivePreGameBoosters(selectedBoosters);
      setLastWinReward(null);
      setPendingStartLevel(null);
      setLevelLaunchNonce((prev) => prev + 1);
      setActiveScreen('game');
    },
    []
  );

  // Synchronous coin spend callback for in-game boosters (prevents negative balance or double-spend)
  const handleSpendCoins = useCallback((cost: number, _booster: BoosterType): boolean => {
    const latest = playerProfileRef.current;
    const deduction = deductCoins(latest.coins, cost);
    if (!deduction.success) {
      return false;
    }

    const updatedProfile: PlayerProfile = {
      ...latest,
      coins: deduction.nextCoins,
    };

    playerProfileRef.current = updatedProfile;
    setPlayerProfile(updatedProfile);
    saveGameData(updatedProfile, levelsRef.current);
    return true;
  }, []);

  // Deduct at most 1 life per active attempt (when failing, restarting, or abandoning after consuming a move)
  const handleLifeLost = useCallback((attemptId?: string): number => {
    if (attemptId && processedLifeLossAttemptsRef.current.has(attemptId)) {
      const synced = syncLivesWithTimestamp(playerProfileRef.current, Date.now());
      playerProfileRef.current = synced;
      setPlayerProfile(synced);
      return synced.lives;
    }

    if (attemptId) {
      processedLifeLossAttemptsRef.current.add(attemptId);
    }

    const updatedProfile = deductLife(playerProfileRef.current, Date.now());
    playerProfileRef.current = updatedProfile;
    setPlayerProfile(updatedProfile);
    saveGameData(updatedProfile, levelsRef.current);
    return updatedProfile.lives;
  }, []);

  // Verify and grant +1 life from a completed rewarded ad (clamped at maxLives, duplicate-protected)
  const handleClaimRewardedLife = useCallback((result: RewardedAdResult): boolean => {
    if (!result.success || !result.rewardGranted || !result.reward) {
      return false;
    }

    const reward = result.reward;
    if (reward.rewardType !== 'extra_life' || reward.amount !== 1) {
      return false;
    }

    if (processedLifeRewardTokensRef.current.has(reward.token)) {
      return false;
    }

    const nowMs = Date.now();
    const synced = syncLivesWithTimestamp(playerProfileRef.current, nowMs);
    if (synced.lives >= synced.maxLives) {
      playerProfileRef.current = synced;
      setPlayerProfile(synced);
      return false;
    }

    const verified = rewardedAdsService.redeemReward(reward, 'extra_life');
    if (!verified) {
      return false;
    }

    processedLifeRewardTokensRef.current.add(reward.token);
    const grantResult = grantLife(synced, nowMs);
    if (!grantResult.granted) {
      playerProfileRef.current = grantResult.profile;
      setPlayerProfile(grantResult.profile);
      return false;
    }

    playerProfileRef.current = grantResult.profile;
    setPlayerProfile(grantResult.profile);
    saveGameData(grantResult.profile, levelsRef.current);
    return true;
  }, []);

  // Called when player clears a level with victory
  const handleLevelWon = useCallback(
    (levelNumber: number, finalScore: number, starsEarned: number, attemptId: string) => {
      if (processedVictoryAttemptsRef.current.has(attemptId)) {
        return;
      }
      processedVictoryAttemptsRef.current.add(attemptId);

      const currentLevels = levelsRef.current;
      const baseLevels =
        currentLevels.length < INITIAL_LEVELS.length
          ? INITIAL_LEVELS.map(
              (initLvl) =>
                currentLevels.find((l) => l.levelNumber === initLvl.levelNumber) || initLvl
            )
          : currentLevels;

      const updatedLevels = baseLevels.map((lvl) => {
        if (lvl.levelNumber === levelNumber) {
          return {
            ...lvl,
            starsEarned: Math.max(lvl.starsEarned, starsEarned),
            highScore: Math.max(lvl.highScore ?? 0, finalScore),
          };
        }
        if (lvl.levelNumber === levelNumber + 1) {
          return {
            ...lvl,
            isUnlocked: true,
          };
        }
        return lvl;
      });

      const nextLevelNum = levelNumber + 1;
      const totalStars = updatedLevels.reduce((sum, l) => sum + (l.starsEarned || 0), 0);
      const prevProfile = playerProfileRef.current;

      const rewardResult = calculateLevelCompletionCoinReward(
        prevProfile,
        levelNumber,
        starsEarned
      );

      const updatedProfile: PlayerProfile = {
        ...prevProfile,
        highestUnlockedLevel: Math.max(prevProfile.highestUnlockedLevel, nextLevelNum),
        totalStars,
        coins: addCoins(prevProfile.coins, rewardResult.coinsAwarded),
        completedLevelRewards: rewardResult.updatedCompletedLevelRewards,
      };

      levelsRef.current = updatedLevels;
      playerProfileRef.current = updatedProfile;
      setLevels(updatedLevels);
      setPlayerProfile(updatedProfile);
      saveGameData(updatedProfile, updatedLevels);

      setLastWinReward({
        attemptId,
        coinsAwarded: rewardResult.coinsAwarded,
        baseCoins: rewardResult.baseCoins,
        starBonusCoins: rewardResult.starBonusCoins,
        isFirstClear: rewardResult.isFirstClear,
      });

      setSelectedLevel((prev) => {
        if (prev.levelNumber === levelNumber) {
          return {
            ...prev,
            starsEarned: Math.max(prev.starsEarned, starsEarned),
            highScore: Math.max(prev.highScore ?? 0, finalScore),
          };
        }
        return prev;
      });
    },
    []
  );

  // Advance to Next Level via Pre-Game Booster modal
  const handleNextLevel = useCallback(() => {
    const currentLevelNum = selectedLevelRef.current.levelNumber;
    const nextLevelNum = currentLevelNum + 1;
    const maxAvailableLevels = Math.max(levelsRef.current.length, INITIAL_LEVELS.length);

    if (nextLevelNum > maxAvailableLevels) {
      setActiveScreen('map');
      return;
    }

    const nextLevel =
      levelsRef.current.find((l) => l.levelNumber === nextLevelNum) ||
      INITIAL_LEVELS.find((l) => l.levelNumber === nextLevelNum);

    if (nextLevel) {
      const target: LevelInfo = { ...nextLevel, isUnlocked: true };
      const synced = syncLivesWithTimestamp(playerProfileRef.current, Date.now());
      playerProfileRef.current = synced;
      setPlayerProfile(synced);
      setPendingStartLevel(target);
    } else {
      setActiveScreen('map');
    }
  }, []);

  // Reset Progress from Settings
  const handleResetProgress = () => {
    clearGameData();
    processedVictoryAttemptsRef.current.clear();
    processedLifeLossAttemptsRef.current.clear();
    processedLifeRewardTokensRef.current.clear();
    const fresh = getFreshState();

    levelsRef.current = fresh.levels;
    playerProfileRef.current = fresh.playerProfile;
    setLevels(fresh.levels);
    setPlayerProfile(fresh.playerProfile);
    setSelectedLevel(fresh.levels[0]);
    setPendingStartLevel(null);
    setActivePreGameBoosters([]);
    setLastWinReward(null);
    setIsSettingsOpen(false);
    setActiveScreen('home');
  };

  // Navigation and modal callbacks
  const handleBackToHome = useCallback(() => setActiveScreen('home'), []);
  const handleOpenMap = useCallback(() => setActiveScreen('map'), []);
  const handleCloseLevelSelect = useCallback(() => setIsLevelSelectOpen(false), []);
  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);

  const maxAvailableLevels = Math.max(levels.length, INITIAL_LEVELS.length);
  const hasNextLevel = selectedLevel.levelNumber < maxAvailableLevels;

  return (
    <div className="min-h-[100dvh] w-full bg-[#120a1f] flex items-center justify-center sm:p-4 overflow-hidden">
      <div className="relative isolate w-full max-w-[430px] h-[100dvh] sm:h-[min(94dvh,860px)] sm:rounded-3xl overflow-hidden shadow-2xl sm:border sm:border-white/15 flex flex-col">
        {activeScreen === 'home' ? (
          <AndroidHomeScreen
            playerProfile={playerProfile}
            levels={levels}
            soundSettings={soundSettings}
            onUpdateSoundSettings={setSoundSettings}
            onOpenSettings={handleOpenSettings}
            onOpenLevelSelect={handleOpenMap}
            onPlayClick={handlePlayClick}
          />
        ) : activeScreen === 'map' ? (
          <CandyWorldMap
            levels={levels}
            currentLevelNumber={selectedLevel.levelNumber}
            highestUnlockedLevel={playerProfile.highestUnlockedLevel}
            playerProfile={playerProfile}
            soundSettings={soundSettings}
            onSelectLevel={handleSelectLevelFromMap}
            onBackToHome={handleBackToHome}
          />
        ) : (
          <LevelBoardPreview
            key={`level-${selectedLevel.levelNumber}-${levelLaunchNonce}`}
            level={selectedLevel}
            onBackToHome={handleOpenMap}
            onOpenLevelSelect={handleOpenMap}
            onNextLevel={handleNextLevel}
            onLevelWon={handleLevelWon}
            hasNextLevel={hasNextLevel}
            soundSettings={soundSettings}
            playerCoins={playerProfile.coins}
            playerLives={playerProfile.lives}
            playerMaxLives={playerProfile.maxLives}
            nextLifeSeconds={playerProfile.nextLifeSeconds}
            initialPreGameBoosters={activePreGameBoosters}
            onSpendCoins={handleSpendCoins}
            onLifeLost={handleLifeLost}
            onClaimRewardedLife={handleClaimRewardedLife}
            lastWinReward={lastWinReward}
          />
        )}

        {/* Pre-Game Booster & Level Launch Modal */}
        <PreGameBoosterModal
          level={pendingStartLevel}
          playerProfile={playerProfile}
          soundSettings={soundSettings}
          onStartLevel={handleStartLevelWithBoosters}
          onClaimRewardedLife={handleClaimRewardedLife}
          onClose={handleCancelPreGameModal}
        />

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={handleCloseSettings}
          settings={soundSettings}
          onUpdateSettings={setSoundSettings}
          onResetProgress={handleResetProgress}
        />

        {/* Level Select / Roadmap Modal */}
        <LevelSelectModal
          isOpen={isLevelSelectOpen}
          onClose={handleCloseLevelSelect}
          levels={levels}
          currentLevel={selectedLevel.levelNumber}
          highestUnlockedLevel={playerProfile.highestUnlockedLevel}
          onSelectLevel={handleSelectLevel}
          soundSettings={soundSettings}
        />
      </div>
    </div>
  );
}
