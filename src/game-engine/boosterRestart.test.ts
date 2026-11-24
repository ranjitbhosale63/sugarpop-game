import assert from 'node:assert/strict';
import { BoardGrid, PlayerProfile, PreGameBoosterType, SpecialCandyType } from '../types/game';
import {
  DEFAULT_MAX_LIVES,
  LIFE_REGEN_INTERVAL_SECONDS,
  calculatePreGameBoostersCost,
  deductCoins,
  deductLife,
} from './economyEngine';
import {
  checkMatchesInGrid,
  createLevelBoardWithPreGameBoosters,
  hasPossibleMoves,
  resolveRestartPreGameBoosters,
} from './boardEngine';

function runTest(name: string, fn: () => void) {
  fn();
  console.log(`PASS: ${name}`);
}

function makeSeededRng(seedStart: number): () => number {
  let state = seedStart >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    lives: DEFAULT_MAX_LIVES,
    maxLives: DEFAULT_MAX_LIVES,
    nextLifeSeconds: LIFE_REGEN_INTERVAL_SECONDS,
    lastLifeUpdatedAt: 1_000_000,
    coins: 500,
    currentLevel: 1,
    totalStars: 0,
    highestUnlockedLevel: 1,
    completedLevelRewards: {},
    boosterInventory: {},
    ...overrides,
  };
}

function countSpecialCandies(grid: BoardGrid): {
  total: number;
  byType: Record<Exclude<SpecialCandyType, null>, number>;
} {
  const byType: Record<Exclude<SpecialCandyType, null>, number> = {
    striped_h: 0,
    striped_v: 0,
    wrapped: 0,
    color_bomb: 0,
  };
  let total = 0;

  for (const row of grid) {
    for (const cell of row) {
      const special = cell.candy?.special ?? null;
      if (special) {
        total += 1;
        byType[special] += 1;
      }
    }
  }

  return { total, byType };
}

runTest('initial launch deducts coins once and places each paid pre-game booster once', () => {
  const profile = makeProfile({ coins: 400, lives: 5 });
  const selectedBoosters: PreGameBoosterType[] = ['striped', 'wrapped', 'color_bomb'];
  const cost = calculatePreGameBoostersCost(selectedBoosters);
  assert.equal(cost, 60 + 80 + 120);

  const deduction = deductCoins(profile.coins, cost);
  assert.equal(deduction.success, true);
  assert.equal(deduction.nextCoins, 140);

  const initialGrid = createLevelBoardWithPreGameBoosters(1, undefined, selectedBoosters, {
    rng: makeSeededRng(101),
  });

  const specials = countSpecialCandies(initialGrid);
  assert.equal(specials.total, 3);
  assert.equal(specials.byType.striped_h + specials.byType.striped_v, 1);
  assert.equal(specials.byType.wrapped, 1);
  assert.equal(specials.byType.color_bomb, 1);
  assert.equal(checkMatchesInGrid(initialGrid).matchedSet.size, 0);
  assert.equal(hasPossibleMoves(initialGrid), true);
});

runTest('active restart preserves paid pre-game boosters, deducts 1 life, and never charges coins again', () => {
  const paidBoosters: PreGameBoosterType[] = ['striped', 'color_bomb'];
  const cost = calculatePreGameBoostersCost(paidBoosters);
  const afterPurchase = makeProfile({
    lives: 5,
    coins: deductCoins(300, cost).nextCoins,
  });
  assert.equal(afterPurchase.coins, 120);

  // Active attempt restart after consuming >= 1 move
  const afterRestartLifeLoss = deductLife(afterPurchase, 1_005_000);
  assert.equal(afterRestartLifeLoss.lives, 4);
  assert.equal(afterRestartLifeLoss.coins, 120);

  const boostersForRestart = resolveRestartPreGameBoosters(paidBoosters, {
    isVictoryCompleted: false,
    isGameOver: false,
  });
  assert.deepEqual(boostersForRestart, ['striped', 'color_bomb']);

  const restartedGrid = createLevelBoardWithPreGameBoosters(3, undefined, boostersForRestart, {
    rng: makeSeededRng(202),
  });
  const specials = countSpecialCandies(restartedGrid);
  assert.equal(specials.total, 2);
  assert.equal(specials.byType.striped_h + specials.byType.striped_v, 1);
  assert.equal(specials.byType.color_bomb, 1);
  assert.equal(checkMatchesInGrid(restartedGrid).matchedSet.size, 0);
  assert.equal(hasPossibleMoves(restartedGrid), true);
});

runTest('repeated active restarts never stack or duplicate paid booster effects', () => {
  let profile = makeProfile({
    lives: 5,
    coins: deductCoins(500, calculatePreGameBoostersCost(['wrapped', 'color_bomb'])).nextCoins,
  });
  let activeBoosters: PreGameBoosterType[] = ['wrapped', 'color_bomb'];

  for (let restartIdx = 0; restartIdx < 3; restartIdx++) {
    profile = deductLife(profile, 1_000_000 + (restartIdx + 1) * 10_000);
    activeBoosters = resolveRestartPreGameBoosters(activeBoosters, {
      isVictoryCompleted: false,
      isGameOver: false,
    });
    const grid = createLevelBoardWithPreGameBoosters(2, undefined, activeBoosters, {
      rng: makeSeededRng(300 + restartIdx),
    });
    const specials = countSpecialCandies(grid);
    assert.equal(specials.total, 2);
    assert.equal(specials.byType.wrapped, 1);
    assert.equal(specials.byType.color_bomb, 1);
  }

  assert.equal(profile.lives, 2);
  assert.equal(profile.coins, 300);
});

runTest('victory replay and game-over retry clear paid boosters so they cannot be reused for free', () => {
  const paidBoosters: PreGameBoosterType[] = ['striped', 'wrapped', 'color_bomb'];

  const replayBoosters = resolveRestartPreGameBoosters(paidBoosters, {
    isVictoryCompleted: true,
    isGameOver: false,
  });
  assert.deepEqual(replayBoosters, []);
  const replayGrid = createLevelBoardWithPreGameBoosters(1, undefined, replayBoosters, {
    rng: makeSeededRng(404),
  });
  assert.equal(countSpecialCandies(replayGrid).total, 0);

  const retryBoosters = resolveRestartPreGameBoosters(paidBoosters, {
    isVictoryCompleted: false,
    isGameOver: true,
  });
  assert.deepEqual(retryBoosters, []);
  const retryGrid = createLevelBoardWithPreGameBoosters(1, undefined, retryBoosters, {
    rng: makeSeededRng(505),
  });
  assert.equal(countSpecialCandies(retryGrid).total, 0);
});

runTest('duplicate booster entries are deduplicated before board placement', () => {
  const duplicateInput: PreGameBoosterType[] = ['striped', 'striped', 'color_bomb', 'color_bomb'];
  const grid = createLevelBoardWithPreGameBoosters(4, undefined, duplicateInput, {
    rng: makeSeededRng(606),
  });

  const specials = countSpecialCandies(grid);
  assert.equal(specials.total, 2);
  assert.equal(specials.byType.striped_h + specials.byType.striped_v, 1);
  assert.equal(specials.byType.color_bomb, 1);
});
