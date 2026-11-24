import {
  BoosterType,
  InGameBoosterType,
  LevelRewardProgress,
  PlayerProfile,
  PreGameBoosterType,
} from '../types/game';

export const DEFAULT_MAX_LIVES = 5;
export const DEFAULT_STARTING_COINS = 100;
export const LIFE_REGEN_INTERVAL_SECONDS = 900; // 15 minutes per life

export const FIRST_CLEAR_BASE_COINS = 30;
export const REPLAY_CLEAR_BASE_COINS = 10;
export const STAR_BONUS_COINS_PER_STAR = 15;

export interface PreGameBoosterDefinition {
  id: PreGameBoosterType;
  name: string;
  shortName: string;
  description: string;
  cost: number;
}

export interface InGameBoosterDefinition {
  id: InGameBoosterType;
  name: string;
  shortName: string;
  description: string;
  cost: number;
  extraMovesAmount?: number;
}

export const PRE_GAME_BOOSTERS: Record<PreGameBoosterType, PreGameBoosterDefinition> = {
  color_bomb: {
    id: 'color_bomb',
    name: 'Color Bomb',
    shortName: 'Color Bomb',
    description: 'Start with a Color Bomb placed on the board',
    cost: 120,
  },
  striped: {
    id: 'striped',
    name: 'Striped Candy',
    shortName: 'Striped',
    description: 'Start with a Striped Candy on the board',
    cost: 60,
  },
  wrapped: {
    id: 'wrapped',
    name: 'Wrapped Candy',
    shortName: 'Wrapped',
    description: 'Start with a Wrapped Candy on the board',
    cost: 80,
  },
};

export const IN_GAME_BOOSTERS: Record<InGameBoosterType, InGameBoosterDefinition> = {
  lollipop_hammer: {
    id: 'lollipop_hammer',
    name: 'Lollipop Hammer',
    shortName: 'Hammer',
    description: 'Smash 1 candy or damage 1 blocker/lock',
    cost: 80,
  },
  extra_moves: {
    id: 'extra_moves',
    name: '+5 Extra Moves',
    shortName: '+5 Moves',
    description: 'Add 5 more moves to finish the level',
    cost: 100,
    extraMovesAmount: 5,
  },
  shuffle: {
    id: 'shuffle',
    name: 'Candy Shuffle',
    shortName: 'Shuffle',
    description: 'Reshuffle movable candies safely',
    cost: 40,
  },
};

export function sanitizeCoins(value: unknown, fallback = 0): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return Math.max(0, Math.floor(fallback));
  return Math.max(0, Math.floor(num));
}

export function canAffordCoins(coins: number, cost: number): boolean {
  return Number.isFinite(cost) && cost >= 0 && sanitizeCoins(coins) >= cost;
}

export function deductCoins(
  coins: number,
  cost: number
): { success: boolean; nextCoins: number } {
  const safeCoins = sanitizeCoins(coins);
  const safeCost = Math.max(0, Math.floor(Number.isFinite(cost) ? cost : 0));
  if (safeCoins < safeCost) {
    return { success: false, nextCoins: safeCoins };
  }
  return { success: true, nextCoins: Math.max(0, safeCoins - safeCost) };
}

export function addCoins(coins: number, amount: number): number {
  const safeCoins = sanitizeCoins(coins);
  const safeAdd = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
  return safeCoins + safeAdd;
}

export function calculatePreGameBoostersCost(boosters: PreGameBoosterType[]): number {
  const unique = Array.from(new Set(boosters));
  return unique.reduce((sum, id) => sum + (PRE_GAME_BOOSTERS[id]?.cost ?? 0), 0);
}

/**
 * Formats remaining regeneration seconds as MM:SS.
 */
export function formatRegenCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Synchronizes lives and remaining regeneration time against real wall-clock elapsed time.
 * Works both during live 1-second UI ticks and across app restarts.
 */
export function syncLivesWithTimestamp(
  profile: PlayerProfile,
  nowMs: number = Date.now(),
  regenIntervalSec: number = LIFE_REGEN_INTERVAL_SECONDS
): PlayerProfile {
  const interval = Math.max(1, Math.floor(regenIntervalSec));
  const maxLives =
    Number.isFinite(profile.maxLives) && profile.maxLives >= 1
      ? Math.floor(profile.maxLives)
      : DEFAULT_MAX_LIVES;

  const rawLives = Number.isFinite(profile.lives) ? Math.floor(profile.lives) : maxLives;
  const clampedLives = Math.max(0, Math.min(maxLives, rawLives));

  if (clampedLives >= maxLives) {
    return {
      ...profile,
      lives: maxLives,
      maxLives,
      nextLifeSeconds: interval,
      lastLifeUpdatedAt: nowMs,
    };
  }

  const prevRemaining =
    Number.isFinite(profile.nextLifeSeconds) && profile.nextLifeSeconds > 0
      ? Math.min(interval, Math.floor(profile.nextLifeSeconds))
      : interval;

  const lastUpdated =
    typeof profile.lastLifeUpdatedAt === 'number' &&
    Number.isFinite(profile.lastLifeUpdatedAt) &&
    profile.lastLifeUpdatedAt > 0
      ? Math.min(nowMs, profile.lastLifeUpdatedAt)
      : nowMs;

  const elapsedSec = Math.max(0, Math.floor((nowMs - lastUpdated) / 1000));

  if (elapsedSec === 0) {
    return {
      ...profile,
      lives: clampedLives,
      maxLives,
      nextLifeSeconds: prevRemaining,
      lastLifeUpdatedAt: lastUpdated,
    };
  }

  // Advance timestamp by exact whole seconds consumed to prevent sub-second drift
  const alignedNowMs = lastUpdated + elapsedSec * 1000;

  if (elapsedSec < prevRemaining) {
    return {
      ...profile,
      lives: clampedLives,
      maxLives,
      nextLifeSeconds: prevRemaining - elapsedSec,
      lastLifeUpdatedAt: alignedNowMs,
    };
  }

  const afterFirst = elapsedSec - prevRemaining;
  const livesGained = 1 + Math.floor(afterFirst / interval);
  const newLives = Math.min(maxLives, clampedLives + livesGained);

  if (newLives >= maxLives) {
    return {
      ...profile,
      lives: maxLives,
      maxLives,
      nextLifeSeconds: interval,
      lastLifeUpdatedAt: nowMs,
    };
  }

  const remainderIntoCurrent = afterFirst % interval;
  const nextRemaining = interval - remainderIntoCurrent;

  return {
    ...profile,
    lives: newLives,
    maxLives,
    nextLifeSeconds: nextRemaining,
    lastLifeUpdatedAt: alignedNowMs,
  };
}

/**
 * Deducts one life when a level attempt fails.
 * Preserves existing regen timer progress if lives were already below maxLives.
 */
export function deductLife(
  profile: PlayerProfile,
  nowMs: number = Date.now(),
  regenIntervalSec: number = LIFE_REGEN_INTERVAL_SECONDS
): PlayerProfile {
  const synced = syncLivesWithTimestamp(profile, nowMs, regenIntervalSec);
  const interval = Math.max(1, Math.floor(regenIntervalSec));

  if (synced.lives <= 0) {
    return synced;
  }

  const wasFull = synced.lives >= synced.maxLives;
  return {
    ...synced,
    lives: Math.max(0, synced.lives - 1),
    nextLifeSeconds: wasFull ? interval : synced.nextLifeSeconds,
    lastLifeUpdatedAt: wasFull ? nowMs : synced.lastLifeUpdatedAt ?? nowMs,
  };
}

export interface GrantLifeResult {
  granted: boolean;
  profile: PlayerProfile;
}

/**
 * Safely grants 1 life (e.g., from a verified rewarded ad) after synchronizing elapsed
 * regeneration time. Never exceeds maxLives and preserves existing regen timer progress
 * whenever lives remain below maxLives.
 */
export function grantLife(
  profile: PlayerProfile,
  nowMs: number = Date.now(),
  regenIntervalSec: number = LIFE_REGEN_INTERVAL_SECONDS
): GrantLifeResult {
  const synced = syncLivesWithTimestamp(profile, nowMs, regenIntervalSec);
  const interval = Math.max(1, Math.floor(regenIntervalSec));

  if (synced.lives >= synced.maxLives) {
    return {
      granted: false,
      profile: synced,
    };
  }

  const nextLives = Math.min(synced.maxLives, synced.lives + 1);
  const reachedMax = nextLives >= synced.maxLives;

  return {
    granted: true,
    profile: {
      ...synced,
      lives: nextLives,
      nextLifeSeconds: reachedMax ? interval : synced.nextLifeSeconds,
      lastLifeUpdatedAt: reachedMax ? nowMs : synced.lastLifeUpdatedAt ?? nowMs,
    },
  };
}

export interface LevelCoinRewardResult {
  coinsAwarded: number;
  baseCoins: number;
  starBonusCoins: number;
  isFirstClear: boolean;
  newMaxStarsRewarded: number;
  updatedCompletedLevelRewards: Record<number, LevelRewardProgress>;
}

/**
 * Computes coin rewards for completing a level without duplicating permanent first-clear
 * or already-earned star bonuses on replays.
 */
export function calculateLevelCompletionCoinReward(
  profile: PlayerProfile,
  levelNumber: number,
  starsEarned: number
): LevelCoinRewardResult {
  const clampedStars = Math.max(0, Math.min(3, Math.floor(starsEarned)));
  const existingMap: Record<number, LevelRewardProgress> = {
    ...(profile.completedLevelRewards ?? {}),
  };
  const prev = existingMap[levelNumber];

  if (!prev || !prev.firstClearClaimed) {
    const baseCoins = FIRST_CLEAR_BASE_COINS;
    const starBonusCoins = clampedStars * STAR_BONUS_COINS_PER_STAR;
    const coinsAwarded = baseCoins + starBonusCoins;

    existingMap[levelNumber] = {
      firstClearClaimed: true,
      maxStarsRewarded: clampedStars,
    };

    return {
      coinsAwarded,
      baseCoins,
      starBonusCoins,
      isFirstClear: true,
      newMaxStarsRewarded: clampedStars,
      updatedCompletedLevelRewards: existingMap,
    };
  }

  // Replaying an already-completed level: award replay completion + only newly achieved star increments
  const newlyEarnedStars = Math.max(0, clampedStars - prev.maxStarsRewarded);
  const baseCoins = REPLAY_CLEAR_BASE_COINS;
  const starBonusCoins = newlyEarnedStars * STAR_BONUS_COINS_PER_STAR;
  const coinsAwarded = baseCoins + starBonusCoins;
  const newMaxStarsRewarded = Math.max(prev.maxStarsRewarded, clampedStars);

  existingMap[levelNumber] = {
    firstClearClaimed: true,
    maxStarsRewarded: newMaxStarsRewarded,
  };

  return {
    coinsAwarded,
    baseCoins,
    starBonusCoins,
    isFirstClear: false,
    newMaxStarsRewarded,
    updatedCompletedLevelRewards: existingMap,
  };
}

export function sanitizeBoosterInventory(
  raw: unknown
): Partial<Record<BoosterType, number>> {
  if (!raw || typeof raw !== 'object') return {};
  const validKeys: BoosterType[] = [
    'color_bomb',
    'striped',
    'wrapped',
    'lollipop_hammer',
    'extra_moves',
    'shuffle',
  ];
  const result: Partial<Record<BoosterType, number>> = {};
  const record = raw as Record<string, unknown>;
  for (const key of validKeys) {
    if (key in record) {
      result[key] = sanitizeCoins(record[key], 0);
    }
  }
  return result;
}
