import assert from 'node:assert/strict';
import { PlayerProfile } from '../types/game';
import {
  DEFAULT_MAX_LIVES,
  LIFE_REGEN_INTERVAL_SECONDS,
  grantLife,
  syncLivesWithTimestamp,
} from './economyEngine';
import {
  RewardedAdTokenPayload,
  rewardVerification,
  rewardedAdsService,
} from '../services/rewardedAds';

function runTest(name: string, fn: () => void) {
  fn();
  console.log(`PASS: ${name}`);
}

function makeProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    lives: 0,
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

runTest('grantLife adds exactly 1 life at 0 lives and preserves 15-min regen progress', () => {
  const startMs = 1_000_000;
  const profile = makeProfile({
    lives: 0,
    maxLives: 5,
    nextLifeSeconds: 640,
    lastLifeUpdatedAt: startMs,
  });

  // 10 seconds later: regen clock drops 640 -> 630, then +1 life granted -> 1/5 with 630s left
  const res = grantLife(profile, startMs + 10_000);
  assert.equal(res.granted, true);
  assert.equal(res.profile.lives, 1);
  assert.equal(res.profile.nextLifeSeconds, 630);
  assert.equal(res.profile.lastLifeUpdatedAt, startMs + 10_000);

  // Subsequent 630s tick regenerates naturally from 1 -> 2
  const afterRegen = syncLivesWithTimestamp(res.profile, startMs + 10_000 + 630_000);
  assert.equal(afterRegen.lives, 2);
});

runTest('grantLife syncs elapsed regen before granting and caps cleanly at maxLives', () => {
  const startMs = 2_000_000;
  const profile = makeProfile({
    lives: 3,
    maxLives: 5,
    nextLifeSeconds: 300, // 5 min until 4th life
    lastLifeUpdatedAt: startMs,
  });

  // 6 minutes pass -> sync gives 4th life with 840s left, then ad grants 5th (maxLives)
  const res = grantLife(profile, startMs + 360_000);
  assert.equal(res.granted, true);
  assert.equal(res.profile.lives, 5);
  assert.equal(res.profile.nextLifeSeconds, LIFE_REGEN_INTERVAL_SECONDS);

  // Attempting to grant again at maxLives is rejected and does not exceed maxLives
  const rejected = grantLife(res.profile, startMs + 365_000);
  assert.equal(rejected.granted, false);
  assert.equal(rejected.profile.lives, 5);
});

runTest('grantLife refuses grant if elapsed regen already filled lives to maxLives', () => {
  const startMs = 3_000_000;
  const profile = makeProfile({
    lives: 4,
    maxLives: 5,
    nextLifeSeconds: 60,
    lastLifeUpdatedAt: startMs,
  });

  // 2 minutes later -> sync already reached 5/5 -> grantLife must return granted: false
  const res = grantLife(profile, startMs + 120_000);
  assert.equal(res.granted, false);
  assert.equal(res.profile.lives, 5);
});

runTest('rewardVerification validates extra_life (1) and extra_moves (5) separately and blocks reuse', () => {
  rewardVerification.clearTokens();

  const lifeToken = rewardVerification.createRewardToken('extra_life', 4);
  assert.equal(lifeToken.rewardType, 'extra_life');
  assert.equal(lifeToken.amount, 1);

  // Cannot redeem extra_life token when expecting extra_moves
  assert.equal(rewardedAdsService.redeemReward(lifeToken, 'extra_moves'), false);
  // Valid redemption when expecting extra_life succeeds once
  assert.equal(rewardedAdsService.redeemReward(lifeToken, 'extra_life'), true);
  // Duplicate reuse is blocked
  assert.equal(rewardedAdsService.redeemReward(lifeToken, 'extra_life'), false);

  const movesToken = rewardVerification.createRewardToken('extra_moves', 4);
  assert.equal(movesToken.rewardType, 'extra_moves');
  assert.equal(movesToken.amount, 5);

  // Cannot redeem extra_moves token when expecting extra_life
  assert.equal(rewardedAdsService.redeemReward(movesToken, 'extra_life'), false);
  // Valid redemption succeeds once, then blocks reuse
  assert.equal(rewardedAdsService.redeemReward(movesToken, 'extra_moves'), true);
  assert.equal(rewardedAdsService.redeemReward(movesToken, 'extra_moves'), false);
});

runTest('rewardVerification rejects forged/mismatched amounts and empty tokens', () => {
  rewardVerification.clearTokens();

  const forgedLifeWith5: RewardedAdTokenPayload = {
    token: 'forged_life_5',
    rewardType: 'extra_life',
    amount: 5,
    timestamp: Date.now(),
    levelNumber: 1,
  };
  const forgedMovesWith1: RewardedAdTokenPayload = {
    token: 'forged_moves_1',
    rewardType: 'extra_moves',
    amount: 1,
    timestamp: Date.now(),
    levelNumber: 1,
  };
  const emptyToken: RewardedAdTokenPayload = {
    token: '   ',
    rewardType: 'extra_life',
    amount: 1,
    timestamp: Date.now(),
    levelNumber: 1,
  };

  assert.equal(rewardVerification.verifyAndRedeemToken(forgedLifeWith5, 'extra_life'), false);
  assert.equal(rewardVerification.verifyAndRedeemToken(forgedMovesWith1, 'extra_moves'), false);
  assert.equal(rewardVerification.verifyAndRedeemToken(emptyToken, 'extra_life'), false);
  assert.equal(rewardVerification.verifyAndRedeemToken(undefined, 'extra_life'), false);
});
