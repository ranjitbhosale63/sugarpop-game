import assert from 'node:assert/strict';
import { PlayerProfile } from '../types/game';
import {
  DEFAULT_MAX_LIVES,
  LIFE_REGEN_INTERVAL_SECONDS,
  deductLife,
  getMsUntilNextLife,
  getRemainingRegenSeconds,
  hasMeaningfulLifeStateChange,
  syncLivesWithTimestamp,
} from './economyEngine';
import { getFreshState, loadGameData, saveGameData } from '../utils/storage';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  public setItemCalls = 0;

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.setItemCalls += 1;
    this.store.set(key, value);
  }
}

function runTest(name: string, fn: () => void) {
  fn();
  console.log(`PASS: ${name}`);
}

function makeProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    lives: DEFAULT_MAX_LIVES,
    maxLives: DEFAULT_MAX_LIVES,
    nextLifeSeconds: LIFE_REGEN_INTERVAL_SECONDS,
    lastLifeUpdatedAt: 1_000_000,
    coins: 100,
    currentLevel: 1,
    totalStars: 0,
    highestUnlockedLevel: 1,
    completedLevelRewards: {},
    boosterInventory: {},
    ...overrides,
  };
}

function withMockStorage(fn: (storage: MemoryStorage) => void) {
  const previousStorage = (globalThis as { localStorage?: Storage }).localStorage;
  const mockStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });
  try {
    fn(mockStorage);
  } finally {
    if (previousStorage === undefined) {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    } else {
      Object.defineProperty(globalThis, 'localStorage', {
        value: previousStorage,
        configurable: true,
        writable: true,
      });
    }
  }
}

// 1. Close with 2 lives, reopen after 1 interval (+1 life, preserved remainder)
runTest('1. Reopening after 1 interval with 2 lives restores +1 life and preserves remainder', () => {
  withMockStorage(() => {
    const t0 = 10_000_000;
    const { levels } = getFreshState(t0);
    const savedProfile = makeProfile({
      lives: 2,
      nextLifeSeconds: 420, // 7 minutes remaining until 3rd life
      lastLifeUpdatedAt: t0,
    });
    saveGameData(savedProfile, levels);

    // Reopen 15 minutes (900s) later -> 420s finishes 3rd life, 480s elapses into 4th life -> 420s left
    const reopened = loadGameData(t0 + LIFE_REGEN_INTERVAL_SECONDS * 1000);
    assert.equal(reopened.playerProfile.lives, 3);
    assert.equal(reopened.playerProfile.nextLifeSeconds, 420);
    assert.equal(reopened.playerProfile.lastLifeUpdatedAt, t0 + LIFE_REGEN_INTERVAL_SECONDS * 1000);
  });
});

// 2. Close for multiple intervals, verify multiple lives restored capped at maxLives
runTest('2. Reopening after multiple intervals restores all earned lives capped at maxLives (5)', () => {
  withMockStorage(() => {
    const t0 = 20_000_000;
    const { levels } = getFreshState(t0);
    const savedProfile = makeProfile({
      lives: 1,
      nextLifeSeconds: 900,
      lastLifeUpdatedAt: t0,
    });
    saveGameData(savedProfile, levels);

    // Away for 2.5 intervals (2250s = 37m 30s): restores 2 lives (1 -> 3) with 450s left
    const midReopen = loadGameData(t0 + 2250_000);
    assert.equal(midReopen.playerProfile.lives, 3);
    assert.equal(midReopen.playerProfile.nextLifeSeconds, 450);

    // Away for 10 hours (36,000s): capped cleanly at maxLives = 5
    const longReopen = loadGameData(t0 + 36_000_000);
    assert.equal(longReopen.playerProfile.lives, DEFAULT_MAX_LIVES);
    assert.equal(longReopen.playerProfile.nextLifeSeconds, LIFE_REGEN_INTERVAL_SECONDS);
    assert.equal(getMsUntilNextLife(longReopen.playerProfile, t0 + 36_000_000), null);
  });
});

// 3. Close with almost one full interval remaining, verify remaining time preserved (not reset)
runTest('3. Reopening before interval completes preserves remaining countdown instead of resetting', () => {
  withMockStorage(() => {
    const t0 = 30_000_000;
    const { levels } = getFreshState(t0);
    const savedProfile = makeProfile({
      lives: 4,
      nextLifeSeconds: 890, // almost full 15 minutes remaining (10s already elapsed)
      lastLifeUpdatedAt: t0,
    });
    saveGameData(savedProfile, levels);

    // Reopen 300s (5 minutes) later -> 590s must remain, NOT reset to 900s
    const reopen1 = loadGameData(t0 + 300_000);
    assert.equal(reopen1.playerProfile.lives, 4);
    assert.equal(reopen1.playerProfile.nextLifeSeconds, 590);

    // Close again immediately and reopen 589s later -> 1s left (00:01)
    saveGameData(reopen1.playerProfile, levels);
    const reopen2 = loadGameData(t0 + 889_000);
    assert.equal(reopen2.playerProfile.lives, 4);
    assert.equal(reopen2.playerProfile.nextLifeSeconds, 1);

    // 1 second later -> reaches 5/5
    const reopen3 = loadGameData(t0 + 890_000);
    assert.equal(reopen3.playerProfile.lives, 5);
  });
});

// 4. Spend a life, verify next regeneration timing is calculated accurately
runTest('4. Spending a life starts a 900s timer from full and preserves progress when already regenerating', () => {
  const t0 = 40_000_000;
  const fullProfile = makeProfile({
    lives: 5,
    nextLifeSeconds: 900,
    lastLifeUpdatedAt: t0,
  });

  // Spend first life from full (5 -> 4): starts 900s regen timer anchored at t0
  const afterFirstLoss = deductLife(fullProfile, t0);
  assert.equal(afterFirstLoss.lives, 4);
  assert.equal(afterFirstLoss.nextLifeSeconds, 900);
  assert.equal(afterFirstLoss.lastLifeUpdatedAt, t0);
  assert.equal(getMsUntilNextLife(afterFirstLoss, t0), 900_000);

  // 250 seconds later, spend second life (4 -> 3): must keep 650s remaining, NOT reset to 900s
  const t1 = t0 + 250_000;
  const afterSecondLoss = deductLife(afterFirstLoss, t1);
  assert.equal(afterSecondLoss.lives, 3);
  assert.equal(afterSecondLoss.nextLifeSeconds, 650);
  assert.equal(afterSecondLoss.lastLifeUpdatedAt, t1);
  assert.equal(getMsUntilNextLife(afterSecondLoss, t1), 650_000);
});

// 5. Reach max lives, verify countdown stops
runTest('5. Reaching maxLives stops countdown and clears next-life timer target', () => {
  const t0 = 50_000_000;
  const profile = makeProfile({
    lives: 4,
    nextLifeSeconds: 120,
    lastLifeUpdatedAt: t0,
  });

  assert.equal(getRemainingRegenSeconds(profile, t0 + 60_000), 60);
  assert.equal(getMsUntilNextLife(profile, t0 + 60_000), 60_000);

  const syncedFull = syncLivesWithTimestamp(profile, t0 + 120_000);
  assert.equal(syncedFull.lives, 5);
  assert.equal(getRemainingRegenSeconds(syncedFull, t0 + 120_000), 0);
  assert.equal(getMsUntilNextLife(syncedFull, t0 + 120_000), null);
});

// 6. Browser refresh / repeated loadGameData persistence cycle, verify no duplicate life grants
runTest('6. Repeated browser refreshes do not duplicate life grants', () => {
  withMockStorage(() => {
    const t0 = 60_000_500; // sub-second offset to verify drift-free alignment
    const { levels } = getFreshState(t0);
    const saved = makeProfile({
      lives: 2,
      nextLifeSeconds: 900,
      lastLifeUpdatedAt: t0,
    });
    saveGameData(saved, levels);

    // Refresh after 900.2 seconds -> +1 life (2 -> 3), aligned anchor
    const refresh1 = loadGameData(t0 + 900_200);
    assert.equal(refresh1.playerProfile.lives, 3);
    assert.equal(refresh1.playerProfile.nextLifeSeconds, 900);
    saveGameData(refresh1.playerProfile, levels);

    // Rapidly refresh 5 times within the next 4 seconds -> must remain at 3 lives
    for (let i = 1; i <= 5; i++) {
      const rapid = loadGameData(t0 + 900_200 + i * 700);
      assert.equal(rapid.playerProfile.lives, 3);
      saveGameData(rapid.playerProfile, levels);
    }

    // Also test refreshing WITHOUT re-saving between refreshes (idempotency)
    const tAnchor = 70_000_000;
    saveGameData(
      makeProfile({
        lives: 2,
        nextLifeSeconds: 900,
        lastLifeUpdatedAt: tAnchor,
      }),
      levels
    );
    const loadA = loadGameData(tAnchor + 900_500);
    const loadB = loadGameData(tAnchor + 900_900);
    assert.equal(loadA.playerProfile.lives, 3);
    assert.equal(loadB.playerProfile.lives, 3);
  });
});

// 7. Countdown-only ticks do not trigger meaningful state updates or localStorage saves every second
runTest('7. Countdown-only ticks update display time without triggering full-game localStorage saves', () => {
  withMockStorage((storage) => {
    const t0 = 80_000_000;
    const { levels } = getFreshState(t0);
    let currentProfile = makeProfile({
      lives: 3,
      nextLifeSeconds: 900,
      lastLifeUpdatedAt: t0,
    });
    saveGameData(currentProfile, levels);
    const initialWrites = storage.setItemCalls;

    // Simulate 100 consecutive 1-second UI countdown ticks (none cross the 900s boundary)
    for (let sec = 1; sec <= 100; sec++) {
      const nowMs = t0 + sec * 1000;
      const displaySec = getRemainingRegenSeconds(currentProfile, nowMs);
      assert.equal(displaySec, 900 - sec);

      const candidateSync = syncLivesWithTimestamp(currentProfile, nowMs);
      const meaningful = hasMeaningfulLifeStateChange(currentProfile, candidateSync, nowMs);
      assert.equal(meaningful, false);

      if (meaningful) {
        currentProfile = candidateSync;
        saveGameData(currentProfile, levels);
      }
    }

    // Zero extra localStorage writes occurred during all 100 countdown-only ticks
    assert.equal(storage.setItemCalls, initialWrites);

    // At 900s boundary, life IS gained -> meaningful change triggers immediate save
    const boundaryMs = t0 + 900_000;
    const boundarySync = syncLivesWithTimestamp(currentProfile, boundaryMs);
    assert.equal(hasMeaningfulLifeStateChange(currentProfile, boundarySync, boundaryMs), true);
    currentProfile = boundarySync;
    saveGameData(currentProfile, levels);
    assert.equal(currentProfile.lives, 4);
    assert.equal(storage.setItemCalls, initialWrites + 1);
  });
});

// 8. System clock changes (backward and forward jumps) remain safe and bounded
runTest('8. System clock backward and forward jumps are handled safely without negative or frozen timers', () => {
  const t0 = 90_000_000;
  const profile = makeProfile({
    lives: 2,
    nextLifeSeconds: 500,
    lastLifeUpdatedAt: t0,
  });

  // Backward jump: clock moves 1 hour into the past
  const backwardMs = t0 - 3_600_000;
  const backwardSync = syncLivesWithTimestamp(profile, backwardMs);
  assert.equal(backwardSync.lives, 2);
  assert.equal(backwardSync.nextLifeSeconds, 500);
  assert.equal(backwardSync.lastLifeUpdatedAt, backwardMs);
  assert.equal(hasMeaningfulLifeStateChange(profile, backwardSync, backwardMs), true);
  assert.equal(getRemainingRegenSeconds(backwardSync, backwardMs), 500);

  // Forward jump: clock jumps 3 hours ahead -> caps cleanly at maxLives (5)
  const forwardMs = backwardMs + 3 * 3_600_000;
  const forwardSync = syncLivesWithTimestamp(backwardSync, forwardMs);
  assert.equal(forwardSync.lives, 5);
  assert.equal(getRemainingRegenSeconds(forwardSync, forwardMs), 0);
  assert.equal(getMsUntilNextLife(forwardSync, forwardMs), null);
});
