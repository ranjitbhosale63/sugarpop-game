import {
  LevelInfo,
  LevelRewardProgress,
  PlayerProfile,
  SoundSettings,
} from '../types/game';
import { INITIAL_LEVELS } from '../game-engine/levelCatalog';
import {
  DEFAULT_MAX_LIVES,
  DEFAULT_STARTING_COINS,
  LIFE_REGEN_INTERVAL_SECONDS,
  sanitizeBoosterInventory,
  sanitizeCoins,
  syncLivesWithTimestamp,
} from '../game-engine/economyEngine';

const STORAGE_KEY = 'sugarpop_candy_match3_save_v1';
const SOUND_SETTINGS_STORAGE_KEY = 'sugarpop_sound_settings_v1';

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  soundEffectsEnabled: true,
  musicEnabled: false,
  hapticsEnabled: true,
  masterVolume: 0.8,
};

export interface SavedGameData {
  playerProfile: PlayerProfile;
  levelData: Record<
    number,
    {
      starsEarned: number;
      isUnlocked: boolean;
      highScore: number;
    }
  >;
}

function sanitizeCompletedLevelRewards(
  rawRewards: unknown,
  mergedLevels: LevelInfo[]
): Record<number, LevelRewardProgress> {
  const result: Record<number, LevelRewardProgress> = {};
  if (rawRewards && typeof rawRewards === 'object') {
    Object.entries(rawRewards as Record<string, unknown>).forEach(([k, val]) => {
      const lvlNum = Number(k);
      if (!Number.isInteger(lvlNum) || lvlNum <= 0 || !val || typeof val !== 'object') {
        return;
      }
      const entry = val as Record<string, unknown>;
      const maxStars =
        typeof entry.maxStarsRewarded === 'number' && Number.isFinite(entry.maxStarsRewarded)
          ? Math.max(0, Math.min(3, Math.floor(entry.maxStarsRewarded)))
          : 0;
      result[lvlNum] = {
        firstClearClaimed: Boolean(entry.firstClearClaimed),
        maxStarsRewarded: maxStars,
      };
    });
  }

  // Backward-compatible migration: any level already completed in older saves counts as claimed
  for (const lvl of mergedLevels) {
    if (lvl.starsEarned > 0) {
      const existing = result[lvl.levelNumber];
      result[lvl.levelNumber] = {
        firstClearClaimed: true,
        maxStarsRewarded: Math.max(existing?.maxStarsRewarded ?? 0, lvl.starsEarned),
      };
    }
  }

  return result;
}

export function loadGameData(): {
  playerProfile: PlayerProfile;
  levels: LevelInfo[];
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return getFreshState();
    }

    const parsed: Partial<SavedGameData> = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.levelData || typeof parsed.levelData !== 'object') {
      return getFreshState();
    }

    // Step 1: Merge saved level progress with INITIAL_LEVELS template
    const mergedLevels = INITIAL_LEVELS.map((lvl) => {
      const saved = parsed.levelData?.[lvl.levelNumber];
      if (saved && typeof saved === 'object') {
        const stars =
          typeof saved.starsEarned === 'number' && Number.isFinite(saved.starsEarned)
            ? Math.max(0, Math.min(3, Math.floor(saved.starsEarned)))
            : 0;
        const high =
          typeof saved.highScore === 'number' && Number.isFinite(saved.highScore)
            ? Math.max(0, Math.floor(saved.highScore))
            : 0;
        return {
          ...lvl,
          starsEarned: stars,
          highScore: high,
          isUnlocked: Boolean(saved.isUnlocked) || lvl.levelNumber === 1,
        };
      }
      return {
        ...lvl,
        starsEarned: 0,
        highScore: 0,
        isUnlocked: lvl.levelNumber === 1,
      };
    });

    // Ensure Level 1 is always unlocked
    if (mergedLevels.length > 0) {
      mergedLevels[0].isUnlocked = true;
    }

    // Step 2: Progression consistency enforcement
    for (let i = 0; i < mergedLevels.length - 1; i++) {
      if (mergedLevels[i].starsEarned > 0) {
        mergedLevels[i + 1].isUnlocked = true;
      }
    }

    // Also honor saved highestUnlockedLevel if saved higher
    const rawHighest = parsed.playerProfile?.highestUnlockedLevel;
    const savedHighestUnlocked =
      typeof rawHighest === 'number' && Number.isFinite(rawHighest)
        ? Math.max(1, Math.min(mergedLevels.length, Math.floor(rawHighest)))
        : 1;
    for (const lvl of mergedLevels) {
      if (lvl.levelNumber <= savedHighestUnlocked) {
        lvl.isUnlocked = true;
      }
    }

    let calculatedHighestUnlocked = 1;
    for (const lvl of mergedLevels) {
      if (lvl.isUnlocked && lvl.levelNumber > calculatedHighestUnlocked) {
        calculatedHighestUnlocked = lvl.levelNumber;
      }
    }

    const totalStars = mergedLevels.reduce((sum, l) => sum + (l.starsEarned || 0), 0);

    const nextIncomplete = mergedLevels.find((l) => l.isUnlocked && l.starsEarned === 0);
    const resolvedCurrentLevel = nextIncomplete
      ? nextIncomplete.levelNumber
      : calculatedHighestUnlocked;

    const rawProfile = parsed.playerProfile ?? ({} as Partial<PlayerProfile>);
    const maxLives =
      typeof rawProfile.maxLives === 'number' &&
      Number.isFinite(rawProfile.maxLives) &&
      rawProfile.maxLives >= 1
        ? Math.floor(rawProfile.maxLives)
        : DEFAULT_MAX_LIVES;

    const lives =
      typeof rawProfile.lives === 'number' && Number.isFinite(rawProfile.lives)
        ? Math.max(0, Math.min(maxLives, Math.floor(rawProfile.lives)))
        : maxLives;

    const nextLifeSeconds =
      typeof rawProfile.nextLifeSeconds === 'number' &&
      Number.isFinite(rawProfile.nextLifeSeconds) &&
      rawProfile.nextLifeSeconds > 0
        ? Math.min(LIFE_REGEN_INTERVAL_SECONDS, Math.floor(rawProfile.nextLifeSeconds))
        : LIFE_REGEN_INTERVAL_SECONDS;

    const lastLifeUpdatedAt =
      typeof rawProfile.lastLifeUpdatedAt === 'number' &&
      Number.isFinite(rawProfile.lastLifeUpdatedAt) &&
      rawProfile.lastLifeUpdatedAt > 0
        ? rawProfile.lastLifeUpdatedAt
        : Date.now();

    const baseProfile: PlayerProfile = {
      lives,
      maxLives,
      nextLifeSeconds,
      lastLifeUpdatedAt,
      coins: sanitizeCoins(rawProfile.coins, DEFAULT_STARTING_COINS),
      currentLevel: resolvedCurrentLevel,
      totalStars,
      highestUnlockedLevel: calculatedHighestUnlocked,
      completedLevelRewards: sanitizeCompletedLevelRewards(
        rawProfile.completedLevelRewards,
        mergedLevels
      ),
      boosterInventory: sanitizeBoosterInventory(rawProfile.boosterInventory),
    };

    const syncedProfile = syncLivesWithTimestamp(baseProfile, Date.now());

    return {
      playerProfile: syncedProfile,
      levels: mergedLevels,
    };
  } catch (err) {
    console.warn('Failed to load game save data:', err);
    return getFreshState();
  }
}

export function saveGameData(profile: PlayerProfile, levels: LevelInfo[]): void {
  try {
    const levelData: Record<
      number,
      { starsEarned: number; isUnlocked: boolean; highScore: number }
    > = {};

    levels.forEach((lvl) => {
      levelData[lvl.levelNumber] = {
        starsEarned: Math.max(0, Math.min(3, Math.floor(lvl.starsEarned || 0))),
        isUnlocked: Boolean(lvl.isUnlocked) || lvl.levelNumber === 1,
        highScore:
          typeof lvl.highScore === 'number' && Number.isFinite(lvl.highScore)
            ? Math.max(0, Math.floor(lvl.highScore))
            : 0,
      };
    });

    const safeProfile: PlayerProfile = {
      ...profile,
      coins: sanitizeCoins(profile.coins, 0),
      lives: Math.max(0, Math.min(profile.maxLives || DEFAULT_MAX_LIVES, Math.floor(profile.lives))),
      maxLives: Math.max(1, Math.floor(profile.maxLives || DEFAULT_MAX_LIVES)),
      nextLifeSeconds: Math.max(1, Math.floor(profile.nextLifeSeconds || LIFE_REGEN_INTERVAL_SECONDS)),
      lastLifeUpdatedAt: profile.lastLifeUpdatedAt ?? Date.now(),
      boosterInventory: sanitizeBoosterInventory(profile.boosterInventory),
    };

    const dataToSave: SavedGameData = {
      playerProfile: safeProfile,
      levelData,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (err) {
    console.warn('Failed to save game data:', err);
  }
}

export function clearGameData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear game data:', err);
  }
}

export function getFreshState(): {
  playerProfile: PlayerProfile;
  levels: LevelInfo[];
} {
  const freshLevels = INITIAL_LEVELS.map((lvl) => ({
    ...lvl,
    starsEarned: 0,
    highScore: 0,
    isUnlocked: lvl.levelNumber === 1, // Only Level 1 unlocked initially
  }));

  const freshProfile: PlayerProfile = {
    lives: DEFAULT_MAX_LIVES,
    maxLives: DEFAULT_MAX_LIVES,
    nextLifeSeconds: LIFE_REGEN_INTERVAL_SECONDS,
    lastLifeUpdatedAt: Date.now(),
    coins: DEFAULT_STARTING_COINS,
    currentLevel: 1,
    totalStars: 0,
    highestUnlockedLevel: 1,
    completedLevelRewards: {},
    boosterInventory: {},
  };

  return {
    playerProfile: freshProfile,
    levels: freshLevels,
  };
}

export function sanitizeSoundSettings(raw: unknown): SoundSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SOUND_SETTINGS };
  }

  const candidate = raw as Partial<Record<keyof SoundSettings, unknown>>;
  const masterVolume =
    typeof candidate.masterVolume === 'number' && Number.isFinite(candidate.masterVolume)
      ? Math.max(0, Math.min(1, candidate.masterVolume))
      : DEFAULT_SOUND_SETTINGS.masterVolume;

  return {
    soundEffectsEnabled:
      typeof candidate.soundEffectsEnabled === 'boolean'
        ? candidate.soundEffectsEnabled
        : DEFAULT_SOUND_SETTINGS.soundEffectsEnabled,
    musicEnabled:
      typeof candidate.musicEnabled === 'boolean'
        ? candidate.musicEnabled
        : DEFAULT_SOUND_SETTINGS.musicEnabled,
    hapticsEnabled:
      typeof candidate.hapticsEnabled === 'boolean'
        ? candidate.hapticsEnabled
        : DEFAULT_SOUND_SETTINGS.hapticsEnabled,
    masterVolume,
  };
}

export function loadSoundSettings(): SoundSettings {
  try {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_SOUND_SETTINGS };
    }
    const raw = localStorage.getItem(SOUND_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SOUND_SETTINGS };
    }
    return sanitizeSoundSettings(JSON.parse(raw));
  } catch (err) {
    console.warn('Failed to load sound settings:', err);
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

export function saveSoundSettings(settings: SoundSettings): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const safeSettings = sanitizeSoundSettings(settings);
    localStorage.setItem(SOUND_SETTINGS_STORAGE_KEY, JSON.stringify(safeSettings));
  } catch (err) {
    console.warn('Failed to save sound settings:', err);
  }
}

