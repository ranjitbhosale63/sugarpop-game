/**
 * Rewarded Ads Service & Provider Architecture for SugarPop
 *
 * Designed to be modular for Google AdMob on Android (via Native Bridge / Capacitor)
 * while providing a clearly identified Development & Test Mode in browser preview.
 *
 * Strict Reward Rules:
 * 1. "extra_moves": exactly 5 additional moves granted only upon verified ad completion.
 * 2. "extra_life": exactly 1 additional life granted only upon verified ad completion.
 * 3. Never grant rewards if ad is skipped, cancelled, or fails.
 * 4. Guard against duplicate rewards from repeated callbacks or button double-taps.
 */

export type RewardedAdRewardType = 'extra_moves' | 'extra_life';

export const EXPECTED_REWARD_AMOUNTS: Record<RewardedAdRewardType, number> = {
  extra_moves: 5,
  extra_life: 1,
};

export interface RewardedAdTokenPayload {
  token: string;
  rewardType: RewardedAdRewardType;
  amount: number;
  timestamp: number;
  levelNumber: number;
}

export type AdCloseReason = 'completed' | 'skipped' | 'cancelled' | 'failed' | 'not_ready';

export interface RewardedAdResult {
  success: boolean;
  rewardGranted: boolean;
  reward?: RewardedAdTokenPayload;
  reason: AdCloseReason;
  errorMessage?: string;
}

export interface RewardedAdProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): Promise<boolean> | boolean;
  isTestMode(): boolean;
}

/**
 * Registry of redeemed reward tokens to prevent replay attacks or duplicate callbacks.
 */
class RewardVerificationManager {
  private redeemedTokens = new Set<string>();

  /**
   * Generates a randomized one-time token for a completed ad session.
   */
  public createRewardToken(
    rewardType: RewardedAdRewardType,
    levelNumber: number = 1
  ): RewardedAdTokenPayload {
    const amount = EXPECTED_REWARD_AMOUNTS[rewardType];
    const randomHex = Math.random().toString(36).substring(2, 12);
    const timestamp = Date.now();
    const token = `sugarpop_${rewardType}_${levelNumber}_${amount}_${timestamp}_${randomHex}`;

    return {
      token,
      rewardType,
      amount,
      timestamp,
      levelNumber,
    };
  }

  /**
   * Backward-compatible token generator (defaults to 5 extra_moves).
   */
  public createToken(
    amount: number = 5,
    levelNumber: number = 1,
    rewardType: RewardedAdRewardType = 'extra_moves'
  ): RewardedAdTokenPayload {
    const randomHex = Math.random().toString(36).substring(2, 12);
    const timestamp = Date.now();
    const token = `sugarpop_reward_${rewardType}_${levelNumber}_${amount}_${timestamp}_${randomHex}`;

    return {
      token,
      rewardType,
      amount,
      timestamp,
      levelNumber,
    };
  }

  /**
   * Verifies and immediately consumes a one-time token.
   * Validates rewardType + amount together and rejects invalid or reused tokens.
   */
  public verifyAndRedeemToken(
    payload: RewardedAdTokenPayload | undefined,
    expectedRewardType?: RewardedAdRewardType
  ): boolean {
    if (!payload || typeof payload.token !== 'string' || payload.token.trim().length === 0) {
      return false;
    }

    if (payload.rewardType !== 'extra_moves' && payload.rewardType !== 'extra_life') {
      console.error('[RewardedAds] Invalid reward type:', payload.rewardType);
      return false;
    }

    if (expectedRewardType && payload.rewardType !== expectedRewardType) {
      console.error('[RewardedAds] Mismatched reward type:', {
        expected: expectedRewardType,
        actual: payload.rewardType,
      });
      return false;
    }

    const expectedAmount = EXPECTED_REWARD_AMOUNTS[payload.rewardType];
    if (payload.amount !== expectedAmount) {
      console.error('[RewardedAds] Invalid reward amount for type:', payload);
      return false;
    }

    if (this.redeemedTokens.has(payload.token)) {
      console.warn('[RewardedAds] Blocked duplicate token redemption attempt:', payload.token);
      return false;
    }

    // Token is valid and fresh: redeem it immediately
    this.redeemedTokens.add(payload.token);
    return true;
  }

  /**
   * Resets redeemed tokens (for unit tests / dev session restart).
   */
  public clearTokens(): void {
    this.redeemedTokens.clear();
  }
}

export const rewardVerification = new RewardVerificationManager();

/**
 * Android AdMob Native Bridge Contract
 * When packaged into an Android application (e.g., via Capacitor or Android WebView),
 * window.AndroidAdMob or similar native interface will be injected.
 */
declare global {
  interface Window {
    AndroidAdMob?: {
      isRewardedLoaded: () => boolean;
      showRewardedVideo: (callbackName: string) => void;
    };
  }
}

export class RewardedAdsService {
  private activeSession = false;

  /**
   * Checks whether the app is running in browser dev preview vs native Android.
   */
  public isTestMode(): boolean {
    // In web browser preview environment, we use the development simulation mode
    return typeof window === 'undefined' || !window.AndroidAdMob;
  }

  /**
   * Starts a rewarded ad session with lock protection to prevent concurrent requests.
   */
  public beginSession(): boolean {
    if (this.activeSession) {
      console.warn('[RewardedAds] Session already active. Ignoring duplicate invocation.');
      return false;
    }
    this.activeSession = true;
    return true;
  }

  /**
   * Ends the active session.
   */
  public endSession(): void {
    this.activeSession = false;
  }

  /**
   * Verifies and redeems the reward payload.
   * Validates rewardType + amount together and enforces single redemption.
   */
  public redeemReward(
    reward: RewardedAdTokenPayload | undefined,
    expectedRewardType?: RewardedAdRewardType
  ): boolean {
    return rewardVerification.verifyAndRedeemToken(reward, expectedRewardType);
  }
}

export const rewardedAdsService = new RewardedAdsService();
