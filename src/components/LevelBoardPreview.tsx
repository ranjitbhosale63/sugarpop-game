import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Star,
  Trophy,
  Zap,
  AlertCircle,
  Move,
  Flame,
  ChevronRight,
  Map,
  Droplets,
  Shield,
  Lock,
  Heart,
  Coins,
  Hammer,
  Shuffle,
  Plus,
  X,
  Check,
  Play,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  BlockerType,
  BoardGrid,
  BoosterType,
  CANDY_DEFINITIONS,
  Candy,
  CandyShape,
  LevelInfo,
  PreGameBoosterType,
  SoundSettings,
} from '../types/game';
import { soundEngine } from '../audio/SoundEffects';
import { OriginalCandy } from './OriginalCandies';
import { ExtraMovesOfferModal } from './ExtraMovesOfferModal';
import { RewardedAdPlayerModal } from './RewardedAdPlayerModal';
import { rewardedAdsService, RewardedAdResult } from '../services/rewardedAds';
import {
  IN_GAME_BOOSTERS,
  canAffordCoins,
  formatRegenCountdown,
} from '../game-engine/economyEngine';
import {
  SUGAR_CRUSH_MOVE_BONUS,
  CellCoord,
  MatchGroup,
  MatchDetectionOptions,
  ColorBombTrigger,
  SpecialComboTrigger,
  FallingCellInfo,
  BoardObstacleSummary,
  ObjectiveProgressState,
  getCandyPoolForLevel,
  getGridDimensions,
  cloneBoardGrid,
  areCellsAdjacent,
  checkMatchesInGrid,
  resolveMatchClusters,
  resolveSpecialActivations,
  resolveObstacleAndJellyUpdates,
  hasPossibleMoves,
  createLevelBoardWithPreGameBoosters,
  resolveRestartPreGameBoosters,
  reshuffleBoard,
  validateAndSwapCells,
  calculateMatchOutcome,
  applyGravityAndRefill,
  calculateStarsForScore,
  countBoardObstacles,
  createInitialObjectiveProgress,
  getEffectiveObjectives,
  evaluateObjectives,
  areAllObjectivesSatisfied,
  pickSugarCrushTargetCoord,
  pickSugarCrushStripedOrientation,
  findSugarCrushTokenCoord,
  computeSugarCrushBlastTiming,
  SugarCrushBeamSegment,
  COLOR_BOMB_CHARGE_DURATION_MS,
  COLOR_BOMB_ZAP_FADE_MS,
  ColorBombZapBeam,
  computeColorBombPolishTiming,
  canHammerHitCell,
  applyLollipopHammer,
  HintMoveSuggestion,
  findBestHintMove,
} from '../game-engine/boardEngine';

const HINT_INACTIVITY_DELAY_MS = 6000;
const HINT_DISPLAY_DURATION_MS = 3000;
const HINT_REPEAT_GAP_MS = 3000;

export interface LevelWinCoinSummary {
  attemptId: string;
  coinsAwarded: number;
  baseCoins: number;
  starBonusCoins: number;
  isFirstClear: boolean;
}

interface LevelBoardPreviewProps {
  level: LevelInfo;
  onBackToHome: () => void;
  onOpenLevelSelect: () => void;
  onNextLevel: () => void;
  onLevelWon: (
    levelNumber: number,
    finalScore: number,
    starsEarned: number,
    attemptId: string
  ) => void;
  hasNextLevel: boolean;
  soundSettings: SoundSettings;
  playerCoins: number;
  playerLives: number;
  playerMaxLives: number;
  nextLifeSeconds: number;
  initialPreGameBoosters?: PreGameBoosterType[];
  onSpendCoins: (cost: number, booster: BoosterType) => boolean;
  onLifeLost: (attemptId: string) => number | void;
  onClaimRewardedLife?: (result: RewardedAdResult) => boolean;
  lastWinReward?: LevelWinCoinSummary | null;
}

const SWIPE_THRESHOLD = 18; // pixels required to trigger swipe

interface SwappingState {
  from: CellCoord;
  to: CellCoord;
  phase: 'forward' | 'revert';
}

interface FloatingScore {
  id: number;
  text: string;
  xPercent: number;
  yPercent: number;
  isSpecial?: boolean;
}

type MatchBurstTier = 'normal' | 'big' | 'mega';

interface MatchParticleItem {
  id: string;
  kind: 'droplet' | 'sparkle';
  tx: number;
  ty: number;
  rot: number;
  size: number;
  color: string;
  glowColor?: string;
  durationMs: number;
  delayMs: number;
  noFilter?: boolean;
}

interface MatchParticleBurst {
  batchId: number;
  r: number;
  c: number;
  tier: MatchBurstTier;
  ringColor: string;
  ringDelayMs: number;
  noRingShadow?: boolean;
  particles: MatchParticleItem[];
}

interface SugarCrushBeamEffect extends SugarCrushBeamSegment {
  id: number;
  highlightColor: string;
}

interface ColorBombZapEffect extends ColorBombZapBeam {
  id: number;
  highlightColor: string;
}

function createMatchParticleBursts(
  matchedSet: Set<string>,
  matchGroups: MatchGroup[],
  currentGrid: BoardGrid,
  batchId: number,
  cellDelaysMs?: Record<string, number>,
  options?: { lightweight?: boolean }
): { bursts: MatchParticleBurst[]; maxDurationMs: number } {
  const cellMaxLen: Record<string, number> = {};
  matchGroups.forEach((group) => {
    group.cells.forEach(({ r, c }) => {
      const key = `${r},${c}`;
      cellMaxLen[key] = Math.max(cellMaxLen[key] || 3, group.length);
    });
  });

  const bursts: MatchParticleBurst[] = [];
  let maxDurationMs = 380;
  const lightweight = Boolean(options?.lightweight);
  const totalMatched = matchedSet.size;
  const cellStride = lightweight && totalMatched > 28 ? 2 : 1;
  let cellIdx = 0;

  matchedSet.forEach((key) => {
    const currentIdx = cellIdx;
    cellIdx += 1;
    if (cellStride > 1 && currentIdx % cellStride !== 0) return;

    const [r, c] = key.split(',').map(Number);
    const candy = currentGrid[r]?.[c]?.candy;
    if (!candy) return;

    const baseCellDelayMs = cellDelaysMs?.[key] ?? 0;
    const def = CANDY_DEFINITIONS[candy.color];
    const matchLen = cellMaxLen[key] || 3;
    const tier: MatchBurstTier = matchLen >= 5 ? 'mega' : matchLen === 4 ? 'big' : 'normal';

    const dropletCount = lightweight
      ? totalMatched > 24
        ? 1
        : 2
      : tier === 'mega'
      ? 6
      : tier === 'big'
      ? 5
      : 4;
    const sparkleCount = lightweight
      ? totalMatched > 24 || currentIdx % 2 === 1
        ? 0
        : 1
      : tier === 'mega'
      ? 4
      : tier === 'big'
      ? 3
      : 2;
    const dropletColors = [def.primaryColor, def.highlightColor, def.secondaryColor];
    const sparkleColors =
      tier === 'mega'
        ? ['#ffffff', '#fde047', def.highlightColor]
        : ['#ffffff', def.highlightColor, '#fef08a'];

    const particles: MatchParticleItem[] = [];

    for (let i = 0; i < dropletCount; i++) {
      const baseAngle = (i / dropletCount) * Math.PI * 2;
      const angle = baseAngle + (Math.random() - 0.5) * 0.45;
      const minRadius = tier === 'mega' ? 24 : tier === 'big' ? 20 : 15;
      const maxRadius = tier === 'mega' ? 40 : tier === 'big' ? 33 : 26;
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      const durationMs =
        (tier === 'mega' ? 380 : tier === 'big' ? 350 : 320) + Math.round(Math.random() * 80);
      const delayMs = baseCellDelayMs + Math.round(Math.random() * 35);
      const size =
        (tier === 'mega' ? 5.5 : tier === 'big' ? 5 : 4) + Math.random() * 2.5;

      if (durationMs + delayMs > maxDurationMs) {
        maxDurationMs = durationMs + delayMs;
      }

      particles.push({
        id: `${batchId}-${r}-${c}-d-${i}`,
        kind: 'droplet',
        tx: Math.round(Math.cos(angle) * radius * 10) / 10,
        ty: Math.round(Math.sin(angle) * radius * 10) / 10,
        rot: Math.round((Math.random() - 0.5) * 180),
        size: Math.round(size * 10) / 10,
        color: dropletColors[i % dropletColors.length],
        glowColor: !lightweight && i % 2 === 0 ? def.accentGlow : undefined,
        durationMs,
        delayMs,
      });
    }

    for (let i = 0; i < sparkleCount; i++) {
      const baseAngle = ((i + 0.5) / sparkleCount) * Math.PI * 2;
      const angle = baseAngle + (Math.random() - 0.5) * 0.5;
      const minRadius = tier === 'mega' ? 26 : tier === 'big' ? 22 : 17;
      const maxRadius = tier === 'mega' ? 44 : tier === 'big' ? 36 : 28;
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      const durationMs =
        (tier === 'mega' ? 420 : tier === 'big' ? 390 : 350) + Math.round(Math.random() * 80);
      const delayMs = baseCellDelayMs + 15 + Math.round(Math.random() * 40);
      const size =
        (tier === 'mega' ? 10 : tier === 'big' ? 9 : 8) + Math.random() * 3;

      if (durationMs + delayMs > maxDurationMs) {
        maxDurationMs = durationMs + delayMs;
      }

      particles.push({
        id: `${batchId}-${r}-${c}-s-${i}`,
        kind: 'sparkle',
        tx: Math.round(Math.cos(angle) * radius * 10) / 10,
        ty: Math.round(Math.sin(angle) * radius * 10) / 10,
        rot: Math.round(90 + Math.random() * 90),
        size: Math.round(size * 10) / 10,
        color: sparkleColors[i % sparkleColors.length],
        durationMs,
        delayMs,
        noFilter: lightweight,
      });
    }

    const effectiveRingDelayMs = baseCellDelayMs;
    const includeRing = !lightweight || totalMatched <= 18 || currentIdx % 2 === 0;
    if (includeRing && effectiveRingDelayMs + 340 > maxDurationMs) {
      maxDurationMs = effectiveRingDelayMs + 340;
    }

    bursts.push({
      batchId,
      r,
      c,
      tier: includeRing ? (baseCellDelayMs > 0 && tier === 'normal' ? 'big' : tier) : 'normal',
      ringColor: tier === 'mega' ? '#fde047' : def.highlightColor,
      ringDelayMs: effectiveRingDelayMs,
      noRingShadow: lightweight,
      particles,
    });
  });

  return { bursts, maxDurationMs };
}

const DEFAULT_STAR_SCORES: [number, number, number] = [1000, 2200, 3500];

function renderBlockerVisual(
  blocker: Exclude<BlockerType, null>,
  health: number
): React.ReactNode {
  if (blocker === 'frosting') {
    return (
      <div className="relative w-[92%] h-[92%] rounded-xl bg-gradient-to-b from-rose-50 via-pink-100 to-rose-200 border-2 border-white shadow-[0_3px_8px_rgba(0,0,0,0.45),inset_0_-3px_0_rgba(244,114,182,0.45)] flex items-center justify-center overflow-hidden">
        <div className="absolute top-0.5 left-1 right-1 h-2 rounded-full bg-white/80" />
        {/* Original SugarPop frosting swirl & sprinkles */}
        <svg viewBox="0 0 36 36" className="w-[78%] h-[78%]" aria-hidden="true">
          <path
            d="M8 22 C8 14, 14 10, 18 8 C22 10, 28 14, 28 22 C28 26, 24 28, 18 28 C12 28, 8 26, 8 22 Z"
            fill="#ffffff"
            stroke="#f472b6"
            strokeWidth="1.8"
          />
          <path
            d="M12 18 C14 15, 22 15, 24 18"
            stroke="#fbcfe8"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <rect x="13" y="13" width="3.5" height="1.5" rx="0.75" transform="rotate(-20 13 13)" fill="#ff1744" />
          <rect x="20" y="14" width="3.5" height="1.5" rx="0.75" transform="rotate(25 20 14)" fill="#00b0ff" />
          <rect x="16" y="21" width="3.5" height="1.5" rx="0.75" transform="rotate(12 16 21)" fill="#ffd600" />
        </svg>
        {health > 1 && (
          <span className="absolute -bottom-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-600 border border-white text-[9px] font-black text-white flex items-center justify-center shadow">
            {health}
          </span>
        )}
      </div>
    );
  }

  if (blocker === 'chocolate') {
    return (
      <div className="relative w-[92%] h-[92%] rounded-xl bg-gradient-to-br from-[#6b3419] via-[#4a200d] to-[#2b1004] border-2 border-[#a86442] shadow-[0_3px_8px_rgba(0,0,0,0.55),inset_0_2px_4px_rgba(255,215,180,0.28)] flex items-center justify-center overflow-hidden">
        <div className="w-[66%] h-[66%] rounded-md border border-[#8f4c2c] bg-gradient-to-br from-[#7e3e20] to-[#3f1a09] shadow-inner flex items-center justify-center">
          <div className="w-[55%] h-[2px] rounded-full bg-[#c98763]/40 -rotate-45" />
        </div>
        {health > 1 && (
          <span className="absolute -bottom-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-600 border border-amber-100 text-[9px] font-black text-white flex items-center justify-center shadow">
            {health}
          </span>
        )}
      </div>
    );
  }

  if (blocker === 'licorice') {
    return (
      <div className="relative w-[92%] h-[92%] rounded-xl bg-gradient-to-br from-[#2d1244] via-[#1b092b] to-[#0d0417] border-2 border-purple-400/50 shadow-[0_3px_8px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 36 36" className="w-[82%] h-[82%]" aria-hidden="true">
          <circle cx="18" cy="18" r="11" fill="none" stroke="#a855f7" strokeWidth="3.5" strokeOpacity="0.45" />
          <path
            d="M18 8 A10 10 0 1 1 9 22 A7 7 0 1 1 21 15 A4 4 0 1 1 17 20"
            fill="none"
            stroke="#e9d5ff"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
        {health > 1 && (
          <span className="absolute -bottom-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-purple-600 border border-purple-100 text-[9px] font-black text-white flex items-center justify-center shadow">
            {health}
          </span>
        )}
      </div>
    );
  }

  // Permanent indestructible stone block
  return (
    <div className="relative w-[92%] h-[92%] rounded-xl bg-gradient-to-b from-slate-500 via-slate-700 to-slate-900 border-2 border-slate-300/60 shadow-[0_4px_8px_rgba(0,0,0,0.65),inset_0_2px_4px_rgba(255,255,255,0.3)] flex items-center justify-center overflow-hidden">
      <svg viewBox="0 0 36 36" className="w-[74%] h-[74%]" aria-hidden="true">
        <polygon
          points="18,5 30,13 26,29 10,29 6,13"
          fill="#475569"
          stroke="#cbd5e1"
          strokeWidth="1.6"
        />
        <line x1="10" y1="15" x2="26" y2="15" stroke="#94a3b8" strokeWidth="1.4" />
        <circle cx="12" cy="10" r="1.2" fill="#e2e8f0" />
        <circle cx="24" cy="10" r="1.2" fill="#e2e8f0" />
      </svg>
    </div>
  );
}

export const LevelBoardPreview: React.FC<LevelBoardPreviewProps> = ({
  level,
  onBackToHome,
  onOpenLevelSelect,
  onNextLevel,
  onLevelWon,
  hasNextLevel,
  soundSettings,
  playerCoins,
  playerLives,
  playerMaxLives,
  nextLifeSeconds,
  initialPreGameBoosters = [],
  onSpendCoins,
  onLifeLost,
  onClaimRewardedLife,
  lastWinReward,
}) => {
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(level.maxMoves);
  const [totalMovesGranted, setTotalMovesGranted] = useState(level.maxMoves);

  // Dynamic Goal / Objective Progress tracking
  const [collectedCounts, setCollectedCounts] = useState<Record<string, number>>({});
  const [objectiveProgress, setObjectiveProgress] = useState<ObjectiveProgressState>(
    createInitialObjectiveProgress
  );

  const [selectedCell, setSelectedCell] = useState<CellCoord | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swapping, setSwapping] = useState<SwappingState | null>(null);
  const [matchedCells, setMatchedCells] = useState<Set<string>>(new Set());
  const [matchedCellDelays, setMatchedCellDelays] = useState<Record<string, number>>({});
  // Distance-aware falling tracking: map of "r,c" -> { distance: number; isNew: boolean }
  const [fallingInfo, setFallingInfo] = useState<Record<string, FallingCellInfo>>({});
  const dropStepRef = useRef(0);
  const [comboCount, setComboCount] = useState(0);

  // Special match banner alert (e.g., 4 or 5 match)
  const [specialMatchBanner, setSpecialMatchBanner] = useState<string | null>(null);

  // Floating score popups
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);

  // Local candy match particle bursts, Color Bomb zap polish & Sugar Crush visual states
  const [matchParticles, setMatchParticles] = useState<MatchParticleBurst[]>([]);
  const [colorBombChargingCoords, setColorBombChargingCoords] = useState<CellCoord[]>([]);
  const [colorBombZaps, setColorBombZaps] = useState<ColorBombZapEffect[]>([]);
  const [isColorBombPoppingActive, setIsColorBombPoppingActive] = useState(false);
  const [sugarCrushPoppingCells, setSugarCrushPoppingCells] = useState<Record<string, number>>({});
  const [sugarCrushPrimingCoord, setSugarCrushPrimingCoord] = useState<CellCoord | null>(null);
  const [sugarCrushBeams, setSugarCrushBeams] = useState<SugarCrushBeamEffect[]>([]);
  const particleBatchIdRef = useRef(0);
  const particleTimeoutsRef = useRef<Set<number>>(new Set());

  // Subtle board impact feedback (4-match micro-shake & 5+ match impact)
  const [boardImpact, setBoardImpact] = useState<'micro' | 'strong' | null>(null);
  const boardImpactRef = useRef<'micro' | 'strong' | null>(null);
  const boardImpactTimeoutRef = useRef<number | null>(null);
  const boardImpactRafRef = useRef<number | null>(null);

  // Game Status Modals & Automatic Hint State
  const [isWon, setIsWon] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [showTutorialHint, setShowTutorialHint] = useState(level.levelNumber === 1);
  const [hintMove, setHintMove] = useState<HintMoveSuggestion | null>(null);
  const [hintActivityNonce, setHintActivityNonce] = useState(0);
  const lastHintPairKeyRef = useRef<string | undefined>(undefined);

  // Rewarded Ad Extra Moves & Extra Life State & Flags
  const [showExtraMovesOffer, setShowExtraMovesOffer] = useState(false);
  const [showRewardedAdPlayer, setShowRewardedAdPlayer] = useState(false);
  const [showLifeAdPlayer, setShowLifeAdPlayer] = useState(false);
  const [lifeAdFeedback, setLifeAdFeedback] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);
  const [extraMovesBanner, setExtraMovesBanner] = useState<string | null>(null);
  const isClaimingLifeAdRef = useRef(false);

  // In-game booster state & feedback
  const [isHammerArmed, setIsHammerArmed] = useState(false);
  const [pendingBoosterConfirm, setPendingBoosterConfirm] = useState<
    | { type: 'extra_moves' | 'shuffle' }
    | { type: 'lollipop_hammer'; target: CellCoord }
    | null
  >(null);
  const [boosterFeedback, setBoosterFeedback] = useState<{
    text: string;
    tone: 'error' | 'info' | 'success';
  } | null>(null);
  const boosterBusyRef = useRef(false);

  // Synchronous guard refs for rewarded ad usage, victory triggers, and life deduction per attempt
  const attemptIdRef = useRef<string>(
    `lvl-${level.levelNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const hasUsedRewardedAdRef = useRef(false);
  const isRedeemingRewardRef = useRef(false);
  const hasTriggeredVictoryRef = useRef(false);
  const hasFinalizedVictoryRef = useRef(false);
  const isSugarCrushRunningRef = useRef(false);
  const hasConsumedMoveRef = useRef(false);
  const hasDeductedLifeRef = useRef(false);
  const hasEndedInGameOverRef = useRef(false);

  // Board container ref for coordinate calculations
  const boardRef = useRef<HTMLDivElement>(null);

  // Synchronous refs to prevent nested setState updater side-effects & state update loops
  const scoreRef = useRef(0);
  const movesLeftRef = useRef(level.maxMoves);
  const collectedCountsRef = useRef<Record<string, number>>({});
  const objectiveProgressRef = useRef<ObjectiveProgressState>(createInitialObjectiveProgress());

  // Swipe gesture tracking refs
  const touchStartRef = useRef<{ x: number; y: number; r: number; c: number } | null>(null);
  const isSwipingRef = useRef(false);

  // Synchronous cascade cancellation and tracked timeout refs
  const cascadeRunIdRef = useRef(0);
  const pendingRunTimersRef = useRef<Set<{ timerId: number; cancel: () => void }>>(new Set());
  const uiTimeoutsRef = useRef<Set<number>>(new Set());

  const cancelActiveCascades = useCallback(() => {
    cascadeRunIdRef.current += 1;
    isSugarCrushRunningRef.current = false;

    pendingRunTimersRef.current.forEach((entry) => {
      window.clearTimeout(entry.timerId);
      entry.cancel();
    });
    pendingRunTimersRef.current.clear();

    uiTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    uiTimeoutsRef.current.clear();

    particleTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    particleTimeoutsRef.current.clear();

    if (boardImpactTimeoutRef.current !== null) {
      window.clearTimeout(boardImpactTimeoutRef.current);
      boardImpactTimeoutRef.current = null;
    }
    if (boardImpactRafRef.current !== null) {
      window.cancelAnimationFrame(boardImpactRafRef.current);
      boardImpactRafRef.current = null;
    }
    boardImpactRef.current = null;
  }, []);

  const waitForCascadeDelay = useCallback((ms: number, runId: number): Promise<boolean> => {
    if (cascadeRunIdRef.current !== runId) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      const entry = {
        timerId: 0,
        cancel: () => resolve(false),
      };
      entry.timerId = window.setTimeout(() => {
        pendingRunTimersRef.current.delete(entry);
        resolve(cascadeRunIdRef.current === runId);
      }, ms);
      pendingRunTimersRef.current.add(entry);
    });
  }, []);

  const scheduleUiTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      uiTimeoutsRef.current.delete(id);
      fn();
    }, ms);
    uiTimeoutsRef.current.add(id);
  }, []);

  // Current level candy variety and objectives
  const candyPool = getCandyPoolForLevel(level.levelNumber, level.candyDistribution);
  const effectiveObjectives = getEffectiveObjectives(level);

  // Paid pre-game boosters for the current launch (preserved across active restarts, cleared on win/loss completion)
  const activePaidBoostersRef = useRef<PreGameBoosterType[]>(
    Array.from(new Set(initialPreGameBoosters))
  );

  // Board state initialized once per level, with any paid pre-game boosters placed safely
  const [grid, setGrid] = useState<BoardGrid>(() =>
    createLevelBoardWithPreGameBoosters(
      level.levelNumber,
      level.boardLayout,
      activePaidBoostersRef.current,
      { candyDistribution: level.candyDistribution }
    )
  );
  const { rows: boardRows, cols: boardCols } = getGridDimensions(grid);
  const [initialObstacles, setInitialObstacles] = useState<BoardObstacleSummary>(() =>
    countBoardObstacles(grid)
  );
  const initialObstaclesRef = useRef<BoardObstacleSummary>(initialObstacles);

  // Cancel all pending cascades and timers on unmount
  useEffect(() => {
    return () => {
      cancelActiveCascades();
    };
  }, [cancelActiveCascades]);

  const showBoosterToast = useCallback(
    (text: string, tone: 'error' | 'info' | 'success' = 'info') => {
      setBoosterFeedback({ text, tone });
      scheduleUiTimeout(() => {
        setBoosterFeedback((prev) => (prev?.text === text ? null : prev));
      }, 2400);
    },
    [scheduleUiTimeout]
  );

  // Deduct at most 1 life if leaving or restarting an active (post-move, non-won) attempt
  const penalizeActiveAttemptIfNeeded = useCallback((): number => {
    if (
      !hasConsumedMoveRef.current ||
      hasTriggeredVictoryRef.current ||
      hasFinalizedVictoryRef.current ||
      hasEndedInGameOverRef.current ||
      hasDeductedLifeRef.current
    ) {
      return playerLives;
    }

    hasDeductedLifeRef.current = true;
    const nextLives = onLifeLost(attemptIdRef.current);
    return typeof nextLives === 'number' ? nextLives : Math.max(0, playerLives - 1);
  }, [onLifeLost, playerLives]);

  // Trigger Game Over and deduct at most 1 life for the failed level attempt
  const triggerGameOver = useCallback(() => {
    setIsHammerArmed(false);
    setPendingBoosterConfirm(null);
    setHintMove(null);
    if (
      !hasDeductedLifeRef.current &&
      !hasTriggeredVictoryRef.current &&
      !hasFinalizedVictoryRef.current
    ) {
      hasDeductedLifeRef.current = true;
      onLifeLost(attemptIdRef.current);
    }
    hasEndedInGameOverRef.current = true;
    setIsGameOver(true);
  }, [onLifeLost]);

  // Reset board and game state cleanly (only called on explicit user action like Restart or Replay)
  const resetBoardAndState = useCallback(
    (lvlNumber: number, maxMoves: number, boostersToApply: PreGameBoosterType[] = []) => {
      cancelActiveCascades();

      attemptIdRef.current = `lvl-${lvlNumber}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      scoreRef.current = 0;
      movesLeftRef.current = maxMoves;
      collectedCountsRef.current = {};
      objectiveProgressRef.current = createInitialObjectiveProgress();
      hasUsedRewardedAdRef.current = false;
      isRedeemingRewardRef.current = false;
      hasTriggeredVictoryRef.current = false;
      hasFinalizedVictoryRef.current = false;
      isSugarCrushRunningRef.current = false;
      hasConsumedMoveRef.current = false;
      hasDeductedLifeRef.current = false;
      hasEndedInGameOverRef.current = false;
      boosterBusyRef.current = false;

      const freshGrid = createLevelBoardWithPreGameBoosters(
        lvlNumber,
        level.boardLayout,
        boostersToApply,
        { candyDistribution: level.candyDistribution }
      );
      const freshObstacles = countBoardObstacles(freshGrid);
      initialObstaclesRef.current = freshObstacles;

      setScore(0);
      setMovesLeft(maxMoves);
      setTotalMovesGranted(maxMoves);
      setCollectedCounts({});
      setObjectiveProgress(createInitialObjectiveProgress());
      setInitialObstacles(freshObstacles);
      setSelectedCell(null);
      setSwapping(null);
      setMatchedCells(new Set());
      setMatchedCellDelays({});
      setFallingInfo({});
      dropStepRef.current = 0;
      setMatchParticles([]);
      setColorBombChargingCoords([]);
      setColorBombZaps([]);
      setIsColorBombPoppingActive(false);
      setSugarCrushPoppingCells({});
      setSugarCrushPrimingCoord(null);
      setSugarCrushBeams([]);
      setBoardImpact(null);
      setIsWon(false);
      setIsGameOver(false);
      setShowExtraMovesOffer(false);
      setShowRewardedAdPlayer(false);
      setShowLifeAdPlayer(false);
      setLifeAdFeedback(null);
      isClaimingLifeAdRef.current = false;
      setExtraMovesBanner(null);
      setIsHammerArmed(false);
      setPendingBoosterConfirm(null);
      setBoosterFeedback(null);
      setIsAnimating(false);
      setComboCount(0);
      setSpecialMatchBanner(null);
      setFloatingScores([]);
      setShowTutorialHint(lvlNumber === 1);
      setHintMove(null);
      lastHintPairKeyRef.current = undefined;
      setHintActivityNonce((prev) => prev + 1);
      setGrid(freshGrid);
    },
    [cancelActiveCascades, level.boardLayout, level.candyDistribution]
  );

  // Spawn floating score indicators
  const spawnFloatingScore = useCallback(
    (text: string, xPercent: number, yPercent: number, isSpecial = false) => {
      const id = Date.now() + Math.random();
      setFloatingScores((prev) => [...prev, { id, text, xPercent, yPercent, isSpecial }]);
      scheduleUiTimeout(() => {
        setFloatingScores((prev) => prev.filter((item) => item.id !== id));
      }, 1000);
    },
    [scheduleUiTimeout]
  );

  // Spawn local candy-colored particles & sparkles around matched positions
  const spawnMatchParticles = useCallback(
    (
      matchedSet: Set<string>,
      matchGroups: MatchGroup[],
      currentGrid: BoardGrid,
      cellDelaysMs?: Record<string, number>,
      options?: { lightweight?: boolean }
    ) => {
      if (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }

      particleBatchIdRef.current += 1;
      const batchId = particleBatchIdRef.current;
      const { bursts, maxDurationMs } = createMatchParticleBursts(
        matchedSet,
        matchGroups,
        currentGrid,
        batchId,
        cellDelaysMs,
        options
      );

      if (bursts.length === 0) return;

      setMatchParticles((prev) => [...prev, ...bursts]);

      const timeoutId = window.setTimeout(() => {
        setMatchParticles((prev) => prev.filter((item) => item.batchId !== batchId));
        particleTimeoutsRef.current.delete(timeoutId);
      }, maxDurationMs + 60);

      particleTimeoutsRef.current.add(timeoutId);
    },
    []
  );

  // Spawn brief golden/candy sparkle burst when Sugar Crush converts a candy into a striped special
  const spawnSugarCrushCreateSparkle = useCallback(
    (coord: CellCoord, candyColor: CandyShape) => {
      if (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }

      particleBatchIdRef.current += 1;
      const batchId = particleBatchIdRef.current;
      const def = CANDY_DEFINITIONS[candyColor];
      const sparkleColors = ['#ffffff', '#fde047', def.highlightColor];
      const particles: MatchParticleItem[] = [];
      let maxDurationMs = 340;

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + 0.25;
        const radius = 16 + (i % 2) * 8;
        const durationMs = 280 + (i % 3) * 35;
        const delayMs = (i % 2) * 20;
        if (durationMs + delayMs > maxDurationMs) {
          maxDurationMs = durationMs + delayMs;
        }
        particles.push({
          id: `${batchId}-sc-${coord.r}-${coord.c}-${i}`,
          kind: 'sparkle',
          tx: Math.round(Math.cos(angle) * radius * 10) / 10,
          ty: Math.round(Math.sin(angle) * radius * 10) / 10,
          rot: 95 + i * 20,
          size: 8.5 + (i % 2) * 2,
          color: sparkleColors[i % sparkleColors.length],
          durationMs,
          delayMs,
        });
      }

      const burst: MatchParticleBurst = {
        batchId,
        r: coord.r,
        c: coord.c,
        tier: 'big',
        ringColor: '#fde047',
        ringDelayMs: 0,
        particles,
      };

      setMatchParticles((prev) => [...prev, burst]);

      const timeoutId = window.setTimeout(() => {
        setMatchParticles((prev) => prev.filter((item) => item.batchId !== batchId));
        particleTimeoutsRef.current.delete(timeoutId);
      }, maxDurationMs + 50);

      particleTimeoutsRef.current.add(timeoutId);
    },
    []
  );

  // Spawn split-directional travelling laser beams for Sugar Crush striped candy blasts
  const spawnSugarCrushBeams = useCallback(
    (segments: SugarCrushBeamSegment[]) => {
      if (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }

      if (segments.length === 0) return;

      const addedIds: number[] = [];
      let maxCleanupMs = 340;
      const beams: SugarCrushBeamEffect[] = segments.slice(0, 24).map((seg) => {
        particleBatchIdRef.current += 1;
        const id = particleBatchIdRef.current;
        addedIds.push(id);
        const endMs = seg.startDelayMs + seg.travelMs + 190;
        if (endMs > maxCleanupMs) maxCleanupMs = endMs;
        return {
          ...seg,
          id,
          highlightColor: CANDY_DEFINITIONS[seg.color].highlightColor,
        };
      });

      setSugarCrushBeams((prev) => [...prev, ...beams]);
      const idSet = new Set(addedIds);
      const timeoutId = window.setTimeout(() => {
        setSugarCrushBeams((prev) => prev.filter((item) => !idSet.has(item.id)));
        particleTimeoutsRef.current.delete(timeoutId);
      }, maxCleanupMs + 40);
      particleTimeoutsRef.current.add(timeoutId);
    },
    []
  );

  // Spawn outward travelling rainbow zap beams for Color Bomb activations
  const spawnColorBombZaps = useCallback((zapBeams: ColorBombZapBeam[]) => {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    if (zapBeams.length === 0) return;

    const addedIds: number[] = [];
    let maxCleanupMs = 420;
    const zaps: ColorBombZapEffect[] = zapBeams.map((beam) => {
      particleBatchIdRef.current += 1;
      const id = particleBatchIdRef.current;
      addedIds.push(id);
      const endMs = beam.startDelayMs + beam.travelMs + COLOR_BOMB_ZAP_FADE_MS;
      if (endMs > maxCleanupMs) maxCleanupMs = endMs;
      return {
        ...beam,
        id,
        highlightColor: CANDY_DEFINITIONS[beam.targetColor].highlightColor,
      };
    });

    setColorBombZaps((prev) => [...prev, ...zaps]);
    const idSet = new Set(addedIds);
    const timeoutId = window.setTimeout(() => {
      setColorBombZaps((prev) => prev.filter((item) => !idSet.has(item.id)));
      particleTimeoutsRef.current.delete(timeoutId);
    }, maxCleanupMs + 50);
    particleTimeoutsRef.current.add(timeoutId);
  }, []);

  // Trigger subtle board impact animation without overlapping or remounting the board
  const triggerBoardImpact = useCallback((tier: 'micro' | 'strong') => {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    if (boardImpactTimeoutRef.current !== null) {
      window.clearTimeout(boardImpactTimeoutRef.current);
      boardImpactTimeoutRef.current = null;
    }
    if (boardImpactRafRef.current !== null) {
      window.cancelAnimationFrame(boardImpactRafRef.current);
      boardImpactRafRef.current = null;
    }

    const durationMs = tier === 'strong' ? 290 : 230;

    const startImpact = () => {
      boardImpactRef.current = tier;
      setBoardImpact(tier);
      boardImpactTimeoutRef.current = window.setTimeout(() => {
        boardImpactRef.current = null;
        setBoardImpact(null);
        boardImpactTimeoutRef.current = null;
      }, durationMs);
    };

    if (boardImpactRef.current !== null) {
      boardImpactRef.current = null;
      setBoardImpact(null);
      boardImpactRafRef.current = window.requestAnimationFrame(() => {
        boardImpactRafRef.current = null;
        startImpact();
      });
    } else {
      startImpact();
    }
  }, []);

  // Star threshold calculation with stable fallback
  const starThresholds = level.starScores || DEFAULT_STAR_SCORES;
  const calculatedStars = calculateStarsForScore(score, starThresholds);
  const resolvedObjectives = evaluateObjectives(
    effectiveObjectives,
    objectiveProgress,
    initialObstacles
  );
  const resolvedObjectivesRef = useRef(resolvedObjectives);
  resolvedObjectivesRef.current = resolvedObjectives;

  const clearHintAndRestartIdle = useCallback(() => {
    setHintMove((prev) => (prev !== null ? null : prev));
    setHintActivityNonce((prev) => prev + 1);
  }, []);

  const isBoardIdleForHint =
    !isAnimating &&
    swapping === null &&
    matchedCells.size === 0 &&
    Object.keys(fallingInfo).length === 0 &&
    !isWon &&
    !isGameOver &&
    !hasTriggeredVictoryRef.current &&
    !isSugarCrushRunningRef.current &&
    !isHammerArmed &&
    pendingBoosterConfirm === null &&
    !showExtraMovesOffer &&
    !showRewardedAdPlayer &&
    !showLifeAdPlayer &&
    movesLeft > 0;

  useEffect(() => {
    if (!isBoardIdleForHint) {
      setHintMove((prev) => (prev !== null ? null : prev));
      return;
    }

    let cancelled = false;
    let showTimerId: number | null = null;
    let hideTimerId: number | null = null;

    const scheduleNextHint = (delayMs: number) => {
      showTimerId = window.setTimeout(() => {
        if (
          cancelled ||
          hasTriggeredVictoryRef.current ||
          isSugarCrushRunningRef.current
        ) {
          return;
        }

        const suggestion = findBestHintMove(grid, resolvedObjectivesRef.current, {
          excludePairKey: lastHintPairKeyRef.current,
        });
        if (!suggestion) return;

        lastHintPairKeyRef.current = `${suggestion.from.r},${suggestion.from.c}->${suggestion.to.r},${suggestion.to.c}`;
        setHintMove(suggestion);

        hideTimerId = window.setTimeout(() => {
          if (cancelled) return;
          setHintMove(null);
          scheduleNextHint(HINT_REPEAT_GAP_MS);
        }, HINT_DISPLAY_DURATION_MS);
      }, delayMs);
    };

    scheduleNextHint(HINT_INACTIVITY_DELAY_MS);

    return () => {
      cancelled = true;
      if (showTimerId !== null) window.clearTimeout(showTimerId);
      if (hideTimerId !== null) window.clearTimeout(hideTimerId);
    };
  }, [isBoardIdleForHint, hintActivityNonce, grid]);

  // Apply match/obstacle/special/score updates synchronously to refs & UI state without duplicate counting
  const applyProgressDelta = useCallback(
    (
      newlyMatchedTally: Record<string, number>,
      clearedJellyDelta: number,
      blockerBrokenDelta: Record<string, number>,
      consumedSpecials: Array<string>,
      pointsDelta: number
    ) => {
      const nextCandyCounts = { ...collectedCountsRef.current };
      Object.entries(newlyMatchedTally).forEach(([candyType, count]) => {
        nextCandyCounts[candyType] = (nextCandyCounts[candyType] || 0) + count;
      });
      collectedCountsRef.current = nextCandyCounts;
      setCollectedCounts(nextCandyCounts);

      const prevProgress = objectiveProgressRef.current;
      const nextBlockerCounts = { ...prevProgress.blockerBrokenCounts };
      Object.entries(blockerBrokenDelta).forEach(([bType, count]) => {
        nextBlockerCounts[bType] = (nextBlockerCounts[bType] || 0) + count;
      });

      const nextSpecialCounts = { ...prevProgress.specialCounts };
      consumedSpecials.forEach((sType) => {
        nextSpecialCounts[sType] = (nextSpecialCounts[sType] || 0) + 1;
      });

      const nextScore = scoreRef.current + pointsDelta;
      scoreRef.current = nextScore;
      setScore(nextScore);

      const nextProgress: ObjectiveProgressState = {
        candyCounts: nextCandyCounts,
        jellyCleared: prevProgress.jellyCleared + clearedJellyDelta,
        blockerBrokenCounts: nextBlockerCounts,
        specialCounts: nextSpecialCounts,
        score: nextScore,
      };
      objectiveProgressRef.current = nextProgress;
      setObjectiveProgress(nextProgress);

      return { nextProgress, nextScore };
    },
    []
  );

  const finalizeLevelVictory = useCallback(
    (finalScore: number) => {
      if (hasFinalizedVictoryRef.current) return;
      hasFinalizedVictoryRef.current = true;
      isSugarCrushRunningRef.current = false;

      setIsAnimating(false);
      setIsHammerArmed(false);
      setPendingBoosterConfirm(null);
      setComboCount(0);
      setSpecialMatchBanner(null);
      setMatchedCellDelays({});
      setColorBombChargingCoords([]);
      setColorBombZaps([]);
      setIsColorBombPoppingActive(false);
      setSugarCrushPoppingCells({});
      setSugarCrushPrimingCoord(null);
      setSugarCrushBeams([]);
      setHintMove(null);
      setIsWon(true);
      if (soundSettings.soundEffectsEnabled) {
        soundEngine.playLevelWin(soundSettings.masterVolume);
      }
      confetti({
        particleCount: 90,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#ff1744', '#ffd600', '#00e676', '#00b0ff', '#ff6d00'],
      });

      const stars = calculateStarsForScore(finalScore, starThresholds);
      onLevelWon(level.levelNumber, finalScore, stars, attemptIdRef.current);
    },
    [soundSettings, starThresholds, level.levelNumber, onLevelWon]
  );

  // Sugar Crush sequence:
  // Phase 1: Randomly convert all unused moves into a mix of striped_h/striped_v candies
  // Phase 2: Sequentially prime & activate each tracked sugarCrushId candy individually,
  //          completing gravity, refill, and automatic match cascades between each activation
  const runSugarCrushSequence = useCallback(
    async (startGrid: BoardGrid, startingMoves: number, runId: number) => {
      if (cascadeRunIdRef.current !== runId || isSugarCrushRunningRef.current) return;
      isSugarCrushRunningRef.current = true;
      setIsAnimating(true);

      try {
        triggerBoardImpact('strong');
        setSpecialMatchBanner('🌟 SUGAR CRUSH! 🌟');

        let workingGrid = startGrid;
        let remainingMoves = startingMoves;
        let step = 0;
        const createdTokens: Array<{ id: number; lastCoord: CellCoord }> = [];
        const createdTargetKeys = new Set<string>();
        const processedTokenIds = new Set<number>();

        const syncRemainingTokenCoords = (gridSnapshot: BoardGrid, fromIdx: number) => {
          for (let remIdx = fromIdx; remIdx < createdTokens.length; remIdx++) {
            const shifted = findSugarCrushTokenCoord(gridSnapshot, createdTokens[remIdx].id);
            if (shifted) {
              createdTokens[remIdx].lastCoord = shifted;
            }
          }
        };

        const triggerStripedBlastAudio = (beamSegments: SugarCrushBeamSegment[]) => {
          if (!soundSettings.soundEffectsEnabled || beamSegments.length === 0) return;
          const triggeredOrigins = new Set<string>();
          for (const seg of beamSegments) {
            const originKey = `${seg.r},${seg.c},${seg.startDelayMs}`;
            if (triggeredOrigins.has(originKey)) continue;
            triggeredOrigins.add(originKey);
            soundEngine.playStripedBlast(soundSettings.masterVolume, seg.startDelayMs / 1000);
          }
        };

        // Phase 1: Randomly place striped bonus candies across eligible cells without gravity/cascades
        while (remainingMoves > 0 && cascadeRunIdRef.current === runId) {
          const targetCoord = pickSugarCrushTargetCoord(workingGrid, step, {
            excludeKeys: createdTargetKeys,
          });
          remainingMoves -= 1;
          movesLeftRef.current = remainingMoves;
          setMovesLeft(remainingMoves);

          const targetKey = targetCoord ? `${targetCoord.r},${targetCoord.c}` : null;
          const targetCell = targetCoord ? workingGrid[targetCoord.r]?.[targetCoord.c] : undefined;
          const canConvertNormal = Boolean(
            targetCoord &&
              targetKey &&
              !createdTargetKeys.has(targetKey) &&
              targetCell?.candy?.special === null
          );

          if (!canConvertNormal || !targetCoord || !targetKey || !targetCell?.candy) {
            applyProgressDelta({}, 0, {}, [], SUGAR_CRUSH_MOVE_BONUS);
            spawnFloatingScore(`CRUSH! +${SUGAR_CRUSH_MOVE_BONUS}`, 50, 50, true);
            const okOverflow = await waitForCascadeDelay(105, runId);
            if (!okOverflow) return;
            step += 1;
            continue;
          }

          const stripedType = pickSugarCrushStripedOrientation();
          const convertedColor = targetCell.candy.color;
          const tokenId = createdTokens.length + 1;

          workingGrid = workingGrid.map((row, rr) =>
            row.map((cell, cc) =>
              rr === targetCoord.r && cc === targetCoord.c && cell.candy
                ? {
                    ...cell,
                    candy: {
                      ...cell.candy,
                      special: stripedType,
                      sugarCrushId: tokenId,
                    },
                  }
                : cell
            )
          );

          createdTokens.push({ id: tokenId, lastCoord: { ...targetCoord } });
          createdTargetKeys.add(targetKey);

          const popToken = step + 1;
          setSugarCrushPoppingCells((prev) => ({ ...prev, [targetKey]: popToken }));
          scheduleUiTimeout(() => {
            setSugarCrushPoppingCells((prev) => {
              if (prev[targetKey] !== popToken) return prev;
              const next = { ...prev };
              delete next[targetKey];
              return next;
            });
          }, 320);

          spawnSugarCrushCreateSparkle(targetCoord, convertedColor);
          if (soundSettings.soundEffectsEnabled) {
            soundEngine.playPop(Math.min(1.9, 1 + step * 0.08), soundSettings.masterVolume);
          }
          setGrid(workingGrid);

          const okConvert = await waitForCascadeDelay(105, runId);
          if (!okConvert) return;
          step += 1;
        }

        // Allow the final converted striped candy to finish popping in before activations begin
        if (createdTokens.length > 0) {
          const canStartActivations = await waitForCascadeDelay(260, runId);
          if (!canStartActivations) return;
        }

        // Phase 2: Individually prime, activate, drop/refill, and settle cascades for each token
        for (let idx = 0; idx < createdTokens.length; idx++) {
          if (cascadeRunIdRef.current !== runId) return;

          const token = createdTokens[idx];
          if (processedTokenIds.has(token.id)) continue;
          processedTokenIds.add(token.id);

          const liveCoord = findSugarCrushTokenCoord(workingGrid, token.id);
          const { rows: gridRows, cols: gridCols } = getGridDimensions(workingGrid);

          // If a chain reaction or automatic cascade already consumed this candy, award its
          // 250-point unused-move bonus once without re-activating
          if (!liveCoord) {
            applyProgressDelta({}, 0, {}, [], SUGAR_CRUSH_MOVE_BONUS);
            spawnFloatingScore(
              `CRUSH! +${SUGAR_CRUSH_MOVE_BONUS}`,
              ((token.lastCoord.c + 0.5) / gridCols) * 100,
              ((token.lastCoord.r + 0.5) / gridRows) * 100,
              true
            );
            const okBonusBeat = await waitForCascadeDelay(110, runId);
            if (!okBonusBeat) return;
            continue;
          }

          token.lastCoord = liveCoord;
          const liveCell = workingGrid[liveCoord.r]?.[liveCoord.c];
          if (!liveCell?.candy?.special || liveCell.blocker !== null || liveCell.isLocked) {
            applyProgressDelta({}, 0, {}, [], SUGAR_CRUSH_MOVE_BONUS);
            spawnFloatingScore(
              `CRUSH! +${SUGAR_CRUSH_MOVE_BONUS}`,
              ((liveCoord.c + 0.5) / gridCols) * 100,
              ((liveCoord.r + 0.5) / gridRows) * 100,
              true
            );
            const okFallbackBeat = await waitForCascadeDelay(110, runId);
            if (!okFallbackBeat) return;
            continue;
          }

          // Brief pre-fire visual cue so the player sees which striped candy activates next
          setSugarCrushPrimingCoord(liveCoord);
          const canFire = await waitForCascadeDelay(150, runId);
          if (!canFire) return;
          setSugarCrushPrimingCoord(null);

          const {
            allClearedCells,
            specialHitCells,
            consumedSpecials,
            activationEvents,
            resolvedGrid,
          } = resolveSpecialActivations(workingGrid, new Set([`${liveCoord.r},${liveCoord.c}`]));

          const obstacleResult = resolveObstacleAndJellyUpdates(
            resolvedGrid,
            allClearedCells,
            new Set(),
            specialHitCells
          );

          const {
            updatedGrid,
            candiesToRemove,
            unlockedCells,
            damagedBlockers,
            brokenBlockers,
            jellyReducedCells,
            clearedJellyCount,
            blockerBrokenCounts,
          } = obstacleResult;

          const { newlyMatchedTally, centerR, centerC, totalPoints } = calculateMatchOutcome(
            updatedGrid,
            candiesToRemove,
            [],
            1
          );

          const obstaclePoints =
            unlockedCells.length * 100 +
            damagedBlockers.length * 50 +
            brokenBlockers.length * 150 +
            jellyReducedCells.length * 100;
          const stepPoints = SUGAR_CRUSH_MOVE_BONUS + totalPoints + obstaclePoints;

          const blastTiming = computeSugarCrushBlastTiming(
            activationEvents,
            gridRows,
            gridCols
          );

          setGrid(updatedGrid);
          setMatchedCellDelays(blastTiming.cellPopDelays);
          setMatchedCells(candiesToRemove);
          spawnMatchParticles(candiesToRemove, [], updatedGrid, blastTiming.cellPopDelays);
          spawnSugarCrushBeams(blastTiming.beamSegments);
          if (blastTiming.beamSegments.length > 0) {
            triggerStripedBlastAudio(blastTiming.beamSegments);
          } else if (soundSettings.soundEffectsEnabled) {
            soundEngine.playMatch(Math.min(5, 2 + idx), soundSettings.masterVolume);
          }

          applyProgressDelta(
            newlyMatchedTally,
            clearedJellyCount,
            blockerBrokenCounts,
            consumedSpecials,
            stepPoints
          );
          spawnFloatingScore(
            `CRUSH! +${stepPoints}`,
            ((centerC + 0.5) / gridCols) * 100,
            ((centerR + 0.5) / gridRows) * 100,
            true
          );

          // Wait until the travelling beams cross the board AND the furthest candy completes its pop
          const canPop = await waitForCascadeDelay(blastTiming.totalBlastWaitMs, runId);
          if (!canPop) return;

          const { droppedGrid, fallingInfo: newFallingInfo, maxDistanceInCascade } =
            applyGravityAndRefill(updatedGrid, candiesToRemove, candyPool, {
              candyDistribution: level.candyDistribution,
            });

          workingGrid = droppedGrid;
          syncRemainingTokenCoords(workingGrid, idx + 1);

          setMatchedCells(new Set());
          setMatchedCellDelays({});
          dropStepRef.current += 1;
          setFallingInfo(newFallingInfo);
          setGrid(workingGrid);

          const dropDuration =
            maxDistanceInCascade > 0 ? 200 + maxDistanceInCascade * 31 : 100;
          const canDrop = await waitForCascadeDelay(dropDuration, runId);
          if (!canDrop) return;
          setFallingInfo({});

          // Settle any resulting automatic match cascades before proceeding to the next bonus candy
          let cascadeCombo = 2;
          while (cascadeRunIdRef.current === runId) {
            const followUp = checkMatchesInGrid(workingGrid);
            if (followUp.matchedSet.size === 0) break;

            const followUpActivations = resolveSpecialActivations(
              workingGrid,
              followUp.matchedSet,
              {
                initialMatchedSet: followUp.matchedSet,
              }
            );
            const followObstacles = resolveObstacleAndJellyUpdates(
              followUpActivations.resolvedGrid,
              followUpActivations.allClearedCells,
              followUp.matchedSet,
              followUpActivations.specialHitCells
            );
            const followStats = calculateMatchOutcome(
              followObstacles.updatedGrid,
              followObstacles.candiesToRemove,
              followUp.matchGroups,
              cascadeCombo
            );

            const followTiming =
              followUpActivations.activationEvents.length > 0
                ? computeSugarCrushBlastTiming(
                    followUpActivations.activationEvents,
                    gridRows,
                    gridCols
                  )
                : null;

            setGrid(followObstacles.updatedGrid);
            setMatchedCellDelays(followTiming ? followTiming.cellPopDelays : {});
            setMatchedCells(followObstacles.candiesToRemove);
            spawnMatchParticles(
              followObstacles.candiesToRemove,
              followUp.matchGroups,
              followObstacles.updatedGrid,
              followTiming?.cellPopDelays
            );
            if (followTiming && followTiming.beamSegments.length > 0) {
              spawnSugarCrushBeams(followTiming.beamSegments);
              triggerStripedBlastAudio(followTiming.beamSegments);
            }
            if (soundSettings.soundEffectsEnabled) {
              soundEngine.playMatch(Math.min(5, cascadeCombo), soundSettings.masterVolume);
            }
            applyProgressDelta(
              followStats.newlyMatchedTally,
              followObstacles.clearedJellyCount,
              followObstacles.blockerBrokenCounts,
              followUpActivations.consumedSpecials,
              followStats.totalPoints
            );

            const followPopWaitMs =
              followTiming && followTiming.beamSegments.length > 0
                ? followTiming.totalBlastWaitMs
                : 230;
            const okPop = await waitForCascadeDelay(followPopWaitMs, runId);
            if (!okPop) return;

            const gravityFollow = applyGravityAndRefill(
              followObstacles.updatedGrid,
              followObstacles.candiesToRemove,
              candyPool,
              { candyDistribution: level.candyDistribution }
            );
            workingGrid = gravityFollow.droppedGrid;
            syncRemainingTokenCoords(workingGrid, idx + 1);

            setMatchedCells(new Set());
            setMatchedCellDelays({});
            dropStepRef.current += 1;
            setFallingInfo(gravityFollow.fallingInfo);
            setGrid(workingGrid);

            const followDropDuration =
              gravityFollow.maxDistanceInCascade > 0
                ? 200 + gravityFollow.maxDistanceInCascade * 31
                : 110;
            const okDrop = await waitForCascadeDelay(followDropDuration, runId);
            if (!okDrop) return;
            setFallingInfo({});
            cascadeCombo += 1;
          }
        }

        if (createdTokens.length > 0 && cascadeRunIdRef.current === runId) {
          const canFinalize = await waitForCascadeDelay(260, runId);
          if (!canFinalize) return;
        }

        if (cascadeRunIdRef.current === runId) {
          finalizeLevelVictory(scoreRef.current);
        }
      } finally {
        if (cascadeRunIdRef.current === runId) {
          isSugarCrushRunningRef.current = false;
          setSugarCrushPrimingCoord(null);
        }
      }
    },
    [
      triggerBoardImpact,
      applyProgressDelta,
      spawnFloatingScore,
      waitForCascadeDelay,
      scheduleUiTimeout,
      spawnSugarCrushCreateSparkle,
      spawnSugarCrushBeams,
      spawnMatchParticles,
      soundSettings,
      candyPool,
      level.candyDistribution,
      finalizeLevelVictory,
    ]
  );

  // Cascade sequence: matches -> obstacle/jelly resolution -> pop -> gravity drop -> check new cascades
  const executeCascade = useCallback(
    async (
      currentGrid: BoardGrid,
      currentCombo: number,
      runId: number,
      swapOptions?: MatchDetectionOptions,
      colorBombTrigger?: ColorBombTrigger | null,
      specialComboTrigger?: SpecialComboTrigger | null
    ) => {
      if (cascadeRunIdRef.current !== runId) return;

      const matchResult = specialComboTrigger
        ? { matchedSet: new Set<string>(), matchGroups: [], clusters: [] }
        : checkMatchesInGrid(currentGrid, swapOptions);
      const { matchedSet, matchGroups } = matchResult;

      if (matchedSet.size === 0 && !colorBombTrigger && !specialComboTrigger) {
        // Cascade completed! Check win, loss, and deadlock conditions cleanly
        const goalsMet = areAllObjectivesSatisfied(
          effectiveObjectives,
          objectiveProgressRef.current,
          initialObstaclesRef.current
        );
        if (goalsMet) {
          if (hasTriggeredVictoryRef.current) return;
          hasTriggeredVictoryRef.current = true;

          if (movesLeftRef.current > 0) {
            await runSugarCrushSequence(currentGrid, movesLeftRef.current, runId);
          } else {
            finalizeLevelVictory(scoreRef.current);
          }
        } else if (movesLeftRef.current <= 0) {
          setIsAnimating(false);
          setComboCount(0);
          setIsHammerArmed(false);
          setPendingBoosterConfirm(null);
          // If the player hasn't used their rewarded ad extra-moves offer for this attempt, show the offer!
          if (!hasUsedRewardedAdRef.current) {
            setShowExtraMovesOffer(true);
          } else {
            triggerGameOver();
          }
        } else {
          if (!hasPossibleMoves(currentGrid)) {
            const reshuffledGrid = reshuffleBoard(currentGrid);
            setGrid(reshuffledGrid);
          }
          setIsAnimating(false);
          setComboCount(0);
        }

        return;
      }

      const allowSpecialCreation = Boolean(swapOptions) && !specialComboTrigger;
      const { cellsToClear, gridWithSpawns, specialSpawns } = resolveMatchClusters(
        currentGrid,
        matchResult,
        allowSpecialCreation
      );

      const protectedKeys = new Set(
        specialSpawns.map((spawn) => `${spawn.coord.r},${spawn.coord.c}`)
      );

      const {
        allClearedCells,
        specialHitCells,
        consumedSpecials,
        activationEvents,
        resolvedGrid,
      } = resolveSpecialActivations(currentGrid, cellsToClear, {
        protectedKeys,
        colorBombTrigger,
        specialComboTrigger,
        initialMatchedSet: matchedSet,
      });

      const preObstacleGrid = specialSpawns.length > 0 ? gridWithSpawns : resolvedGrid;
      const {
        updatedGrid,
        candiesToRemove,
        unlockedCells,
        damagedBlockers,
        brokenBlockers,
        jellyReducedCells,
        clearedJellyCount,
        blockerBrokenCounts,
      } = resolveObstacleAndJellyUpdates(
        preObstacleGrid,
        allClearedCells,
        matchedSet,
        specialHitCells
      );

      // Calculate score, center, and candy types across removed candies + obstacle progress
      const {
        newlyMatchedTally,
        centerR,
        centerC,
        maxMatchLength,
        totalPoints,
      } = calculateMatchOutcome(updatedGrid, candiesToRemove, matchGroups, currentCombo);

      const obstaclePoints =
        unlockedCells.length * 100 +
        damagedBlockers.length * 50 +
        brokenBlockers.length * 150 +
        jellyReducedCells.length * 100;
      const stepTotalPoints = totalPoints + obstaclePoints;

      const hasSpecialCombo = Boolean(specialComboTrigger);
      const hasColorBombActivation = activationEvents.some((e) => e.special === 'color_bomb');
      const hasColorBombPolish = activationEvents.some(
        (e) =>
          e.special === 'color_bomb' ||
          e.special === 'COLOR_BOMB_STRIPED' ||
          e.special === 'COLOR_BOMB_WRAPPED' ||
          e.special === 'COLOR_BOMB_COLOR_BOMB'
      );
      const hasWrappedActivation = activationEvents.some((e) => e.special === 'wrapped');
      const hasStripedActivation = activationEvents.some(
        (e) => e.special === 'striped_h' || e.special === 'striped_v'
      );

      // Phase 1 (Color Bomb polish): Brief charge-up glow on activated Color Bomb(s) before beams fire
      if (hasColorBombPolish) {
        const chargeCoords: CellCoord[] = [];
        const chargeKeySet = new Set<string>();
        const addChargeCoord = (coord: CellCoord) => {
          const k = `${coord.r},${coord.c}`;
          if (!chargeKeySet.has(k)) {
            chargeKeySet.add(k);
            chargeCoords.push(coord);
          }
        };

        for (const ev of activationEvents) {
          if (ev.special === 'color_bomb') {
            addChargeCoord(ev.coord);
          } else if (
            ev.special === 'COLOR_BOMB_STRIPED' ||
            ev.special === 'COLOR_BOMB_WRAPPED' ||
            ev.special === 'COLOR_BOMB_COLOR_BOMB'
          ) {
            if (specialComboTrigger) {
              if (
                currentGrid[specialComboTrigger.centerCoord.r]?.[specialComboTrigger.centerCoord.c]
                  ?.candy?.special === 'color_bomb'
              ) {
                addChargeCoord(specialComboTrigger.centerCoord);
              }
              if (
                currentGrid[specialComboTrigger.originCoord.r]?.[specialComboTrigger.originCoord.c]
                  ?.candy?.special === 'color_bomb'
              ) {
                addChargeCoord(specialComboTrigger.originCoord);
              }
            } else {
              addChargeCoord(ev.coord);
            }
          }
        }

        if (chargeCoords.length > 0) {
          setColorBombChargingCoords(chargeCoords);
          if (soundSettings.soundEffectsEnabled) {
            soundEngine.playColorBombCharge(
              COLOR_BOMB_CHARGE_DURATION_MS,
              soundSettings.masterVolume
            );
          }
          const canContinueAfterCharge = await waitForCascadeDelay(
            COLOR_BOMB_CHARGE_DURATION_MS,
            runId
          );
          setColorBombChargingCoords([]);
          if (!canContinueAfterCharge) return;
        }
      }

      // Check for big matches of 4 or 5, special combos, or special candy activations
      if (
        hasSpecialCombo ||
        maxMatchLength >= 5 ||
        hasColorBombActivation ||
        hasWrappedActivation ||
        activationEvents.length >= 2
      ) {
        triggerBoardImpact('strong');
        setSpecialMatchBanner('🌟 SUGAR CRUSH! 🌟');
        scheduleUiTimeout(() => {
          if (cascadeRunIdRef.current === runId) {
            setSpecialMatchBanner(null);
          }
        }, 1400);
        confetti({
          particleCount: hasColorBombPolish ? 18 : 35,
          spread: 60,
          origin: { y: 0.4 },
          colors: ['#ffd600', '#ff007f', '#00e676', '#00b0ff'],
        });
      } else if (maxMatchLength === 4 || hasStripedActivation) {
        triggerBoardImpact('micro');
        setSpecialMatchBanner('✨ SWEET! ✨');
        scheduleUiTimeout(() => {
          if (cascadeRunIdRef.current === runId) {
            setSpecialMatchBanner(null);
          }
        }, 1200);
      }

      // 1. Highlight cleared cells (excluding spawns & unlocked-this-turn candies) and update obstacle state
      const hasConvertedSpecials =
        specialComboTrigger?.comboType === 'COLOR_BOMB_STRIPED' ||
        specialComboTrigger?.comboType === 'COLOR_BOMB_WRAPPED';
      const hasObstacleVisualChange =
        unlockedCells.length > 0 ||
        damagedBlockers.length > 0 ||
        brokenBlockers.length > 0 ||
        jellyReducedCells.length > 0;

      const { rows: gridRows, cols: gridCols } = getGridDimensions(updatedGrid);
      const colorBombTiming = hasColorBombPolish
        ? computeColorBombPolishTiming(activationEvents, gridRows, gridCols)
        : null;

      if (hasConvertedSpecials && colorBombTiming) {
        const convertedBatchesByDelay = new globalThis.Map<
          number,
          Array<{ r: number; c: number; candy: Candy }>
        >();
        const deferredConvertedKeys = new Set<string>();

        for (let r = 0; r < gridRows; r++) {
          for (let c = 0; c < gridCols; c++) {
            const prevCandy = currentGrid[r]?.[c]?.candy;
            const nextCandy = updatedGrid[r]?.[c]?.candy;
            if (prevCandy && nextCandy && prevCandy.special === null && nextCandy.special !== null) {
              const key = `${r},${c}`;
              const impactDelayMs = Math.max(
                0,
                Math.round(colorBombTiming.cellPopDelays[key] ?? 0)
              );
              if (impactDelayMs > 0) {
                deferredConvertedKeys.add(key);
                const list = convertedBatchesByDelay.get(impactDelayMs);
                if (list) {
                  list.push({ r, c, candy: nextCandy });
                } else {
                  convertedBatchesByDelay.set(impactDelayMs, [{ r, c, candy: nextCandy }]);
                }
              }
            }
          }
        }

        if (deferredConvertedKeys.size > 0) {
          if (specialSpawns.length > 0 || hasObstacleVisualChange) {
            const initialStepGrid = cloneBoardGrid(updatedGrid);
            deferredConvertedKeys.forEach((key) => {
              const [kr, kc] = key.split(',').map(Number);
              const prevCell = currentGrid[kr]?.[kc];
              const stepCell = initialStepGrid[kr]?.[kc];
              if (prevCell?.candy && stepCell) {
                stepCell.candy = { ...prevCell.candy };
              }
            });
            setGrid(initialStepGrid);
          }

          convertedBatchesByDelay.forEach((batch, delayMs) => {
            scheduleUiTimeout(() => {
              if (cascadeRunIdRef.current !== runId) return;
              setGrid((prev) => {
                const next = prev.map((row) => [...row]);
                for (const item of batch) {
                  const existingCell = next[item.r]?.[item.c];
                  if (existingCell) {
                    next[item.r][item.c] = {
                      ...existingCell,
                      candy: { ...item.candy },
                    };
                  }
                }
                return next;
              });
            }, delayMs);
          });
        } else if (specialSpawns.length > 0 || hasObstacleVisualChange) {
          setGrid(updatedGrid);
        }
      } else if (specialSpawns.length > 0 || hasConvertedSpecials || hasObstacleVisualChange) {
        setGrid(updatedGrid);
      }
      setIsColorBombPoppingActive(Boolean(colorBombTiming));
      setMatchedCellDelays(colorBombTiming ? colorBombTiming.cellPopDelays : {});
      setMatchedCells(candiesToRemove);
      spawnMatchParticles(
        candiesToRemove,
        matchGroups,
        updatedGrid,
        colorBombTiming ? colorBombTiming.cellPopDelays : undefined,
        colorBombTiming || candiesToRemove.size > 16 ? { lightweight: true } : undefined
      );
      if (colorBombTiming) {
        spawnColorBombZaps(colorBombTiming.zapBeams);
      }
      setComboCount(currentCombo);

      if (soundSettings.soundEffectsEnabled) {
        if (colorBombTiming) {
          const popDelaysMs = Array.from(candiesToRemove)
            .map((key) => colorBombTiming.cellPopDelays[key])
            .filter((delay): delay is number => typeof delay === 'number');
          soundEngine.playColorBombSequence(
            popDelaysMs.length > 0 ? popDelaysMs : Object.values(colorBombTiming.cellPopDelays),
            soundSettings.masterVolume
          );
        } else {
          soundEngine.playMatch(currentCombo, soundSettings.masterVolume);
        }
      }
      if (soundSettings.hapticsEnabled && 'vibrate' in navigator) {
        navigator.vibrate(25 + currentCombo * 10);
      }

      applyProgressDelta(
        newlyMatchedTally,
        clearedJellyCount,
        blockerBrokenCounts,
        consumedSpecials,
        stepTotalPoints
      );

      const scoreLabel =
        hasSpecialCombo || hasColorBombActivation || maxMatchLength >= 5
          ? `CRUSH! +${stepTotalPoints}`
          : hasWrappedActivation || hasStripedActivation || maxMatchLength === 4
          ? `SWEET! +${stepTotalPoints}`
          : currentCombo > 1
          ? `${currentCombo}x COMBO! +${stepTotalPoints}`
          : `+${stepTotalPoints}`;

      spawnFloatingScore(
        scoreLabel,
        ((centerC + 0.5) / gridCols) * 100,
        ((centerR + 0.5) / gridRows) * 100,
        maxMatchLength >= 4 || activationEvents.length > 0
      );

      // Wait for pop burst animation (or final Color Bomb zap + staggered pop) before gravity & refill
      const popWaitMs = colorBombTiming
        ? colorBombTiming.totalWaitMs
        : specialComboTrigger?.comboType === 'STRIPED_WRAPPED'
        ? 420
        : 240;
      const canContinueAfterPop = await waitForCascadeDelay(popWaitMs, runId);
      if (!canContinueAfterPop) return;

      // 2. Remove cleared candies (preserving spawns, locks, blockers) and apply gravity drop / refill
      const { droppedGrid, fallingInfo: newFallingInfo, maxDistanceInCascade } =
        applyGravityAndRefill(updatedGrid, candiesToRemove, candyPool, {
          candyDistribution: level.candyDistribution,
        });

      setMatchedCells(new Set());
      setMatchedCellDelays({});
      setIsColorBombPoppingActive(false);
      dropStepRef.current += 1;
      setFallingInfo(newFallingInfo);
      setGrid(droppedGrid);

      // Calibrated drop duration based on the maximum distance fallen in this step
      const dropDuration =
        maxDistanceInCascade > 0 ? 200 + maxDistanceInCascade * 31 : 100;

      // Await drop and elastic squash-and-stretch landing animation
      const canContinueAfterDrop = await waitForCascadeDelay(dropDuration, runId);
      if (!canContinueAfterDrop) return;
      setFallingInfo({});

      // 4. Cascade recursion for chain reactions (no swap context -> no cascade special creation)
      executeCascade(droppedGrid, currentCombo + 1, runId);
    },
    [
      effectiveObjectives,
      runSugarCrushSequence,
      finalizeLevelVictory,
      triggerGameOver,
      soundSettings,
      applyProgressDelta,
      spawnFloatingScore,
      spawnMatchParticles,
      spawnColorBombZaps,
      triggerBoardImpact,
      candyPool,
      level.candyDistribution,
      waitForCascadeDelay,
      scheduleUiTimeout,
    ]
  );

  // In-game booster handlers with validation, confirmation, and safe coin deduction
  const handleToggleHammerBooster = () => {
    clearHintAndRestartIdle();
    if (
      isAnimating ||
      isWon ||
      isGameOver ||
      hasTriggeredVictoryRef.current ||
      boosterBusyRef.current ||
      pendingBoosterConfirm
    ) {
      return;
    }

    if (isHammerArmed) {
      if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
      setIsHammerArmed(false);
      showBoosterToast('Hammer target cancelled', 'info');
      return;
    }

    const cost = IN_GAME_BOOSTERS.lollipop_hammer.cost;
    if (!canAffordCoins(playerCoins, cost)) {
      if (soundSettings.soundEffectsEnabled) soundEngine.playInvalidSwap(soundSettings.masterVolume);
      showBoosterToast(`Not enough coins! Need ${cost} coins.`, 'error');
      return;
    }

    if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
    setSelectedCell(null);
    setIsHammerArmed(true);
    showBoosterToast('Tap any candy, lock, or blocker to smash', 'info');
  };

  const handleRequestInGameBooster = (type: 'extra_moves' | 'shuffle') => {
    clearHintAndRestartIdle();
    if (
      isAnimating ||
      isWon ||
      isGameOver ||
      hasTriggeredVictoryRef.current ||
      boosterBusyRef.current ||
      pendingBoosterConfirm
    ) {
      return;
    }

    const cost = IN_GAME_BOOSTERS[type].cost;
    if (!canAffordCoins(playerCoins, cost)) {
      if (soundSettings.soundEffectsEnabled) soundEngine.playInvalidSwap(soundSettings.masterVolume);
      showBoosterToast(`Not enough coins! Need ${cost} coins.`, 'error');
      return;
    }

    if (type === 'shuffle') {
      let movableCount = 0;
      for (let r = 0; r < boardRows; r++) {
        for (let c = 0; c < boardCols; c++) {
          const cell = grid[r]?.[c];
          if (cell?.playable && cell.blocker === null && !cell.isLocked && cell.candy) {
            movableCount += 1;
          }
        }
      }
      if (movableCount < 3) {
        if (soundSettings.soundEffectsEnabled) soundEngine.playInvalidSwap(soundSettings.masterVolume);
        showBoosterToast('Not enough movable candies to shuffle!', 'error');
        return;
      }
    }

    if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
    setIsHammerArmed(false);
    setSelectedCell(null);
    setPendingBoosterConfirm({ type });
  };

  const handleConfirmBoosterPurchase = async () => {
    if (
      !pendingBoosterConfirm ||
      boosterBusyRef.current ||
      isAnimating ||
      isWon ||
      isGameOver ||
      hasTriggeredVictoryRef.current
    ) {
      return;
    }

    boosterBusyRef.current = true;
    const action = pendingBoosterConfirm;
    setPendingBoosterConfirm(null);

    try {
      if (action.type === 'extra_moves') {
        const booster = IN_GAME_BOOSTERS.extra_moves;
        const paid = onSpendCoins(booster.cost, 'extra_moves');
        if (!paid) {
          if (soundSettings.soundEffectsEnabled) soundEngine.playInvalidSwap(soundSettings.masterVolume);
          showBoosterToast(`Not enough coins! Need ${booster.cost} coins.`, 'error');
          return;
        }

        const addedMoves = booster.extraMovesAmount ?? 5;
        const nextMoves = movesLeftRef.current + addedMoves;
        movesLeftRef.current = nextMoves;
        setMovesLeft(nextMoves);
        setTotalMovesGranted((prev) => prev + addedMoves);
        setExtraMovesBanner(`+${addedMoves} EXTRA MOVES!`);
        scheduleUiTimeout(() => setExtraMovesBanner(null), 2000);
        showBoosterToast(`+${addedMoves} moves added!`, 'success');

        if (soundSettings.soundEffectsEnabled) {
          soundEngine.playPlayFanfare(soundSettings.masterVolume);
        }
        return;
      }

      if (action.type === 'shuffle') {
        const booster = IN_GAME_BOOSTERS.shuffle;
        const reshuffled = reshuffleBoard(grid);
        if (!hasPossibleMoves(reshuffled)) {
          if (soundSettings.soundEffectsEnabled) soundEngine.playInvalidSwap(soundSettings.masterVolume);
          showBoosterToast('Unable to find a valid shuffle on this board.', 'error');
          return;
        }

        const paid = onSpendCoins(booster.cost, 'shuffle');
        if (!paid) {
          if (soundSettings.soundEffectsEnabled) soundEngine.playInvalidSwap(soundSettings.masterVolume);
          showBoosterToast(`Not enough coins! Need ${booster.cost} coins.`, 'error');
          return;
        }

        setGrid(reshuffled);
        setSelectedCell(null);
        triggerBoardImpact('micro');
        showBoosterToast('Board candies shuffled!', 'success');
        if (soundSettings.soundEffectsEnabled) {
          soundEngine.playMatch(2, soundSettings.masterVolume);
        }
        return;
      }

      if (action.type === 'lollipop_hammer') {
        const booster = IN_GAME_BOOSTERS.lollipop_hammer;
        const targetCell = grid[action.target.r]?.[action.target.c];
        if (!canHammerHitCell(targetCell)) {
          if (soundSettings.soundEffectsEnabled) soundEngine.playInvalidSwap(soundSettings.masterVolume);
          showBoosterToast('Invalid hammer target! No coins spent.', 'error');
          return;
        }

        const hammerResult = applyLollipopHammer(grid, action.target);
        if (!hammerResult.applied) {
          if (soundSettings.soundEffectsEnabled) soundEngine.playInvalidSwap(soundSettings.masterVolume);
          showBoosterToast('Cannot smash that cell! No coins spent.', 'error');
          return;
        }

        const paid = onSpendCoins(booster.cost, 'lollipop_hammer');
        if (!paid) {
          if (soundSettings.soundEffectsEnabled) soundEngine.playInvalidSwap(soundSettings.masterVolume);
          showBoosterToast(`Not enough coins! Need ${booster.cost} coins.`, 'error');
          return;
        }

        setIsHammerArmed(false);
        setIsAnimating(true);
        const runId = cascadeRunIdRef.current;

        const {
          updatedGrid,
          candiesToRemove,
          consumedSpecials,
          obstacleUpdate,
          activationEvents,
        } = hammerResult;

        const {
          unlockedCells,
          damagedBlockers,
          brokenBlockers,
          jellyReducedCells,
          clearedJellyCount,
          blockerBrokenCounts,
        } = obstacleUpdate;

        const { newlyMatchedTally, totalPoints } = calculateMatchOutcome(
          updatedGrid,
          candiesToRemove,
          [],
          1
        );

        const obstaclePoints =
          unlockedCells.length * 100 +
          damagedBlockers.length * 50 +
          brokenBlockers.length * 150 +
          jellyReducedCells.length * 100;
        const hitPoints = Math.max(60, totalPoints + obstaclePoints);

        triggerBoardImpact(activationEvents.length > 0 ? 'strong' : 'micro');
        setGrid(updatedGrid);
        if (candiesToRemove.size > 0) {
          setMatchedCells(candiesToRemove);
          spawnMatchParticles(candiesToRemove, [], updatedGrid);
        }

        if (soundSettings.soundEffectsEnabled) {
          soundEngine.playMatch(activationEvents.length > 0 ? 3 : 2, soundSettings.masterVolume);
        }
        if (soundSettings.hapticsEnabled && 'vibrate' in navigator) {
          navigator.vibrate(35);
        }

        const nextProgressState = applyProgressDelta(
          newlyMatchedTally,
          clearedJellyCount,
          blockerBrokenCounts,
          consumedSpecials,
          hitPoints
        );

        spawnFloatingScore(
          `SMASH! +${hitPoints}`,
          ((action.target.c + 0.5) / boardCols) * 100,
          ((action.target.r + 0.5) / boardRows) * 100,
          true
        );

        if (candiesToRemove.size > 0 || brokenBlockers.length > 0) {
          const canContinueAfterPop = await waitForCascadeDelay(220, runId);
          if (!canContinueAfterPop) return;

          const { droppedGrid, fallingInfo: newFallingInfo, maxDistanceInCascade } =
            applyGravityAndRefill(updatedGrid, candiesToRemove, candyPool, {
              candyDistribution: level.candyDistribution,
            });

          setMatchedCells(new Set());
          dropStepRef.current += 1;
          setFallingInfo(newFallingInfo);
          setGrid(droppedGrid);

          const dropDuration =
            maxDistanceInCascade > 0 ? 200 + maxDistanceInCascade * 31 : 110;
          const canContinueAfterDrop = await waitForCascadeDelay(dropDuration, runId);
          if (!canContinueAfterDrop) return;
          setFallingInfo({});

          executeCascade(droppedGrid, 1, runId);
        } else {
          // Unlock or partial blocker damage only (no cavity created)
          const goalsMet = areAllObjectivesSatisfied(
            effectiveObjectives,
            nextProgressState.nextProgress,
            initialObstaclesRef.current
          );
          if (goalsMet && !hasTriggeredVictoryRef.current) {
            hasTriggeredVictoryRef.current = true;
            if (movesLeftRef.current > 0) {
              await runSugarCrushSequence(updatedGrid, movesLeftRef.current, runId);
            } else {
              finalizeLevelVictory(scoreRef.current);
            }
          } else {
            if (!hasPossibleMoves(updatedGrid)) {
              setGrid(reshuffleBoard(updatedGrid));
            }
            setIsAnimating(false);
          }
        }
      }
    } finally {
      boosterBusyRef.current = false;
    }
  };

  // Perform candidate swap between two adjacent cells
  const attemptSwap = useCallback(
    async (from: CellCoord, to: CellCoord) => {
      clearHintAndRestartIdle();
      if (
        isAnimating ||
        movesLeftRef.current <= 0 ||
        isWon ||
        isGameOver ||
        hasTriggeredVictoryRef.current ||
        pendingBoosterConfirm !== null
      ) {
        return;
      }

      const fromCell = grid[from.r]?.[from.c];
      const toCell = grid[to.r]?.[to.c];

      if (!areCellsAdjacent(from, to)) {
        if (toCell && toCell.playable && toCell.blocker === null && !toCell.isLocked && toCell.candy) {
          setSelectedCell(to);
        }
        return;
      }

      if (
        !fromCell?.playable ||
        !toCell?.playable ||
        fromCell.blocker !== null ||
        fromCell.isLocked ||
        !fromCell.candy ||
        toCell.blocker !== null ||
        toCell.isLocked ||
        !toCell.candy
      ) {
        setSelectedCell(null);
        return;
      }

      const runId = cascadeRunIdRef.current;
      setIsAnimating(true);
      setShowTutorialHint(false);

      if (soundSettings.soundEffectsEnabled) {
        soundEngine.playClick(soundSettings.masterVolume);
      }

      // 1. Visual forward slide animation
      setSwapping({ from, to, phase: 'forward' });
      const canContinueForward = await waitForCascadeDelay(200, runId);
      if (!canContinueForward) return;

      // 2. Check if swapped board produces any match, color-bomb activation, or special+special combo
      const { isValid, swappedGrid, colorBombTrigger, specialComboTrigger } =
        validateAndSwapCells(grid, from, to);

      if (!isValid) {
        // INVALID SWAP: No match formed -> Revert back smoothly!
        if (soundSettings.soundEffectsEnabled) {
          soundEngine.playInvalidSwap(soundSettings.masterVolume);
        }
        if (soundSettings.hapticsEnabled && 'vibrate' in navigator) {
          navigator.vibrate(30);
        }

        setSwapping({ from, to, phase: 'revert' });
        const canContinueRevert = await waitForCascadeDelay(200, runId);
        if (!canContinueRevert) return;

        setSwapping(null);
        setSelectedCell(null);
        setIsAnimating(false);
      } else {
        // VALID SWAP: Mark attempt active, deduct move, commit swapped state, and cascade!
        hasConsumedMoveRef.current = true;
        const nextMoves = Math.max(0, movesLeftRef.current - 1);
        movesLeftRef.current = nextMoves;
        setMovesLeft(nextMoves);
        setGrid(swappedGrid);
        setSwapping(null);
        setSelectedCell(null);

        executeCascade(
          swappedGrid,
          1,
          runId,
          {
            swapDestination: to,
            swapOrigin: from,
          },
          colorBombTrigger,
          specialComboTrigger
        );
      }
    },
    [
      isAnimating,
      isWon,
      isGameOver,
      pendingBoosterConfirm,
      grid,
      soundSettings,
      executeCascade,
      waitForCascadeDelay,
      clearHintAndRestartIdle,
    ]
  );

  // Finger Swipe / Touch Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, r: number, c: number) => {
    clearHintAndRestartIdle();
    if (
      isAnimating ||
      movesLeft <= 0 ||
      isWon ||
      isGameOver ||
      hasTriggeredVictoryRef.current ||
      pendingBoosterConfirm !== null
    ) {
      return;
    }

    const cell = grid[r]?.[c];

    // If Lollipop Hammer is armed, tap validates and opens purchase confirmation without swiping
    if (isHammerArmed) {
      if (!canHammerHitCell(cell)) {
        if (soundSettings.soundEffectsEnabled) soundEngine.playInvalidSwap(soundSettings.masterVolume);
        showBoosterToast('Cannot smash stone or empty spaces! Pick a candy, lock, or blocker.', 'error');
        return;
      }
      if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
      setPendingBoosterConfirm({ type: 'lollipop_hammer', target: { r, c } });
      return;
    }

    if (!cell || !cell.playable || cell.blocker !== null || cell.isLocked || !cell.candy) {
      return;
    }

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    touchStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      r,
      c,
    };
    isSwipingRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || isAnimating || isSwipingRef.current) return;

    const dx = e.clientX - touchStartRef.current.x;
    const dy = e.clientY - touchStartRef.current.y;
    const dist = Math.hypot(dx, dy);

    if (dist >= SWIPE_THRESHOLD) {
      isSwipingRef.current = true;
      const origin = { r: touchStartRef.current.r, c: touchStartRef.current.c };

      let targetR = origin.r;
      let targetC = origin.c;

      if (Math.abs(dx) > Math.abs(dy)) {
        targetC = dx > 0 ? origin.c + 1 : origin.c - 1;
      } else {
        targetR = dy > 0 ? origin.r + 1 : origin.r - 1;
      }

      if (targetR >= 0 && targetR < boardRows && targetC >= 0 && targetC < boardCols) {
        attemptSwap(origin, { r: targetR, c: targetC });
      }

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      touchStartRef.current = null;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;

    if (!isSwipingRef.current && !isAnimating) {
      const tapped = { r: touchStartRef.current.r, c: touchStartRef.current.c };

      if (!selectedCell) {
        setSelectedCell(tapped);
        if (soundSettings.soundEffectsEnabled) {
          soundEngine.playClick(soundSettings.masterVolume);
        }
      } else {
        if (areCellsAdjacent(selectedCell, tapped)) {
          attemptSwap(selectedCell, tapped);
        } else if (selectedCell.r === tapped.r && selectedCell.c === tapped.c) {
          setSelectedCell(null);
        } else {
          setSelectedCell(tapped);
          if (soundSettings.soundEffectsEnabled) {
            soundEngine.playClick(soundSettings.masterVolume);
          }
        }
      }
    }

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    touchStartRef.current = null;
    isSwipingRef.current = false;
  };

  const handlePointerCancel = () => {
    touchStartRef.current = null;
    isSwipingRef.current = false;
  };

  // Consistent exit handler for Home / Map / All Levels navigation
  const handleExitLevel = useCallback(
    (navigate: () => void) => {
      cancelActiveCascades();
      penalizeActiveAttemptIfNeeded();
      if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
      navigate();
    },
    [cancelActiveCascades, penalizeActiveAttemptIfNeeded, soundSettings]
  );

  // Reset / Replay / Retry Level with life-loss, zero-life, and paid pre-game booster integrity
  const handleResetLevel = () => {
    const isVictoryCompleted =
      hasTriggeredVictoryRef.current || hasFinalizedVictoryRef.current || isWon;

    if (isVictoryCompleted) {
      if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
      const boostersForReplay = resolveRestartPreGameBoosters(activePaidBoostersRef.current, {
        isVictoryCompleted: true,
        isGameOver: false,
      });
      activePaidBoostersRef.current = boostersForReplay;
      resetBoardAndState(level.levelNumber, level.maxMoves, boostersForReplay);
      return;
    }

    if (hasEndedInGameOverRef.current || isGameOver) {
      if (playerLives <= 0) {
        if (soundSettings.soundEffectsEnabled) soundEngine.playInvalidSwap(soundSettings.masterVolume);
        showBoosterToast(
          `Out of lives! Next life in ${formatRegenCountdown(nextLifeSeconds)}.`,
          'error'
        );
        return;
      }
      if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
      const boostersForRetry = resolveRestartPreGameBoosters(activePaidBoostersRef.current, {
        isVictoryCompleted: false,
        isGameOver: true,
      });
      activePaidBoostersRef.current = boostersForRetry;
      resetBoardAndState(level.levelNumber, level.maxMoves, boostersForRetry);
      return;
    }

    const hadConsumedMove = hasConsumedMoveRef.current;
    const remainingLives = penalizeActiveAttemptIfNeeded();

    if (remainingLives <= 0) {
      cancelActiveCascades();
      setShowExtraMovesOffer(false);
      setShowRewardedAdPlayer(false);
      if (soundSettings.soundEffectsEnabled) soundEngine.playInvalidSwap(soundSettings.masterVolume);
      if (hadConsumedMove) {
        triggerGameOver();
      } else {
        showBoosterToast(
          `Out of lives! Next life in ${formatRegenCountdown(nextLifeSeconds)}.`,
          'error'
        );
      }
      return;
    }

    if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
    const boostersForActiveRestart = resolveRestartPreGameBoosters(
      activePaidBoostersRef.current,
      {
        isVictoryCompleted: false,
        isGameOver: false,
      }
    );
    activePaidBoostersRef.current = boostersForActiveRestart;
    resetBoardAndState(level.levelNumber, level.maxMoves, boostersForActiveRestart);
  };

  // Rewarded Ad Extra-Moves Handlers
  const handleWatchRewardedAd = useCallback(() => {
    if (hasUsedRewardedAdRef.current || isRedeemingRewardRef.current) return;
    setShowExtraMovesOffer(false);
    setShowRewardedAdPlayer(true);
  }, []);

  const handleDeclineExtraMoves = useCallback(() => {
    setShowExtraMovesOffer(false);
    triggerGameOver();
  }, [triggerGameOver]);

  const handleAdResult = useCallback(
    (result: RewardedAdResult) => {
      setShowRewardedAdPlayer(false);

      if (result.success && result.rewardGranted && result.reward) {
        // Guard against repeated or duplicate reward redemption
        if (hasUsedRewardedAdRef.current || isRedeemingRewardRef.current) {
          console.warn('[RewardedAds] Duplicate reward claim blocked');
          return;
        }

        isRedeemingRewardRef.current = true;

        // Verify and redeem one-time token through verification manager
        const verified = rewardedAdsService.redeemReward(result.reward, 'extra_moves');
        if (!verified) {
          console.error('[RewardedAds] Reward token verification failed or already redeemed');
          isRedeemingRewardRef.current = false;
          triggerGameOver();
          return;
        }

        // Mark as consumed for this attempt
        hasUsedRewardedAdRef.current = true;
        isRedeemingRewardRef.current = false;

        // Grant exactly 5 additional moves
        const newMoves = movesLeftRef.current + 5;
        movesLeftRef.current = newMoves;
        setMovesLeft(newMoves);
        setTotalMovesGranted((prev) => prev + 5);

        // Ensure the resumed board has at least one valid move
        setGrid((prevGrid) => (!hasPossibleMoves(prevGrid) ? reshuffleBoard(prevGrid) : prevGrid));

        // Celebration banner & audio feedback
        setExtraMovesBanner('+5 EXTRA MOVES GRANTED!');
        scheduleUiTimeout(() => setExtraMovesBanner(null), 2400);

        if (soundSettings.soundEffectsEnabled) {
          soundEngine.playLevelWin(soundSettings.masterVolume);
        }
        confetti({
          particleCount: 45,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#ffd600', '#ff007f', '#00e676', '#ff9100', '#00b0ff'],
        });
      } else {
        // Ad skipped, cancelled, or failed: DO NOT grant moves; continue to failure screen
        triggerGameOver();
      }
    },
    [soundSettings, scheduleUiTimeout, triggerGameOver]
  );

  // Rewarded Ad +1 Life Handlers (Game Over when lives === 0)
  const handleWatchLifeAd = useCallback(() => {
    if (playerLives > 0 || showLifeAdPlayer || isClaimingLifeAdRef.current) return;
    if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
    setLifeAdFeedback(null);
    setShowLifeAdPlayer(true);
  }, [playerLives, showLifeAdPlayer, soundSettings]);

  const handleLifeAdResult = useCallback(
    (result: RewardedAdResult) => {
      setShowLifeAdPlayer(false);
      if (isClaimingLifeAdRef.current) return;

      if (result.success && result.rewardGranted && result.reward) {
        isClaimingLifeAdRef.current = true;
        const granted = onClaimRewardedLife ? onClaimRewardedLife(result) : false;
        isClaimingLifeAdRef.current = false;

        if (granted) {
          if (soundSettings.soundEffectsEnabled) {
            soundEngine.playPlayFanfare(soundSettings.masterVolume);
          }
          setLifeAdFeedback({
            text: '+1 Life granted! Tap Try Again to retry.',
            tone: 'success',
          });
        } else {
          setLifeAdFeedback({
            text: 'Could not claim life reward or lives already full.',
            tone: 'error',
          });
        }
      } else {
        setLifeAdFeedback({
          text: 'Ad skipped or failed — no life granted.',
          tone: 'error',
        });
      }
    },
    [onClaimRewardedLife, soundSettings]
  );

  const scoreProgressPercent = Math.min(100, Math.round((score / starThresholds[2]) * 100));

  return (
    <div className="relative w-full h-full min-h-0 max-w-[430px] mx-auto overflow-hidden bg-gradient-to-b from-[#210940] via-[#431263] to-[#871653] text-white shadow-2xl select-none">
      {/* Dynamic Ambient Background Sparkles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-12 left-6 w-36 h-36 rounded-full bg-pink-500/15 blur-2xl" />
        <div className="absolute bottom-12 right-6 w-44 h-44 rounded-full bg-amber-400/15 blur-2xl" />
      </div>

      {/* Scrollable Gameplay Viewport */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between overflow-y-auto overflow-x-hidden p-2 sm:p-3 touch-pan-y">

      {/* TOP NAVIGATION & LEVEL BADGE */}
      <div className="relative z-10 flex items-center justify-between gap-1.5 pb-1.5 border-b border-white/10 shrink-0">
        <button
          onClick={() => handleExitLevel(onBackToHome)}
          className="min-w-[44px] min-h-[44px] shrink-0 flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-xs font-bold text-white cursor-pointer shadow-sm"
          title="Return to Home Screen"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          <span>Home</span>
        </button>

        {/* Center Level Title Banner */}
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <button
            onClick={() => handleExitLevel(onOpenLevelSelect)}
            className="min-h-[44px] min-w-[44px] max-w-full px-2.5 sm:px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 border border-white/30 shadow-md flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
            title="Open Level Selection Map"
          >
            <Map className="w-3 h-3 text-amber-300 shrink-0" />
            <h2 className="text-[10px] sm:text-[11px] font-black tracking-wide sm:tracking-widest text-white uppercase drop-shadow truncate">
              LEVEL {level.levelNumber} • {level.name}
            </h2>
          </button>
        </div>

        <button
          onClick={handleResetLevel}
          className="min-w-[44px] min-h-[44px] shrink-0 flex items-center justify-center p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 active:scale-95 transition-all cursor-pointer shadow-sm"
          title="Restart Level"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ECONOMY & LIVES STATUS STRIP */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-1 py-1 shrink-0 text-[11px] font-black">
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/40 border border-rose-400/35">
          <Heart className="w-3 h-3 text-rose-400 fill-rose-400 shrink-0" />
          <span className="text-white tabular-nums">
            {playerLives}/{playerMaxLives}
          </span>
          <span className="text-[10px] font-bold text-rose-200 tabular-nums">
            {playerLives >= playerMaxLives ? 'FULL' : formatRegenCountdown(nextLifeSeconds)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/40 border border-amber-400/35">
          <Coins className="w-3 h-3 text-amber-300 shrink-0" />
          <span className="text-amber-300 tabular-nums">{playerCoins.toLocaleString()}</span>
        </div>
      </div>

      {/* TOP HUD: DEDICATED OBJECTIVES, SEPARATE MOVES COUNTER, & SCORE METER */}
      <div className="@container relative z-10 my-1.5 shrink-0">
        <div className="flex flex-wrap @[280px]:flex-nowrap items-stretch gap-1 @[315px]:gap-1.5 @[345px]:gap-2">
          {/* SECTION 1: DEDICATED OBJECTIVES SECTION (Supports candy, jelly, blocker, special, & score objectives) */}
          <div className="basis-full @[280px]:basis-auto flex-1 min-w-0 px-1.5 py-1 @[345px]:p-2 rounded-2xl bg-black/40 border border-white/15 shadow-md flex items-center justify-center">
            {resolvedObjectives.length > 0 ? (
              <div
                className={`w-full flex flex-wrap items-center justify-center ${
                  resolvedObjectives.length === 1
                    ? 'gap-2'
                    : resolvedObjectives.length === 2
                    ? 'gap-1 @[345px]:gap-1.5'
                    : 'gap-1'
                }`}
              >
                {resolvedObjectives.map((item) => {
                  const obj = item.objective;
                  const isMet = item.isComplete;

                  const iconSize =
                    resolvedObjectives.length === 1
                      ? 28
                      : resolvedObjectives.length === 2
                      ? 22
                      : 18;
                  const iconSizeClass =
                    resolvedObjectives.length === 1
                      ? 'w-6 h-6 @[345px]:w-7 @[345px]:h-7'
                      : resolvedObjectives.length === 2
                      ? 'w-[18px] h-[18px] @[315px]:w-5 @[315px]:h-5 @[345px]:w-[22px] @[345px]:h-[22px]'
                      : 'w-4 h-4 @[315px]:w-[17px] @[315px]:h-[17px] @[345px]:w-[18px] @[345px]:h-[18px]';
                  const textSize =
                    resolvedObjectives.length === 1
                      ? 'text-xl @[345px]:text-2xl'
                      : resolvedObjectives.length === 2
                      ? 'text-base @[345px]:text-lg'
                      : 'text-xs @[315px]:text-sm @[345px]:text-base';

                  return (
                    <div
                      key={item.key}
                      className={`flex items-center justify-center gap-1 px-1.5 @[345px]:px-2 py-0.5 @[345px]:py-1 rounded-xl border shadow-sm transition-all ${
                        isMet
                          ? 'bg-emerald-950/60 border-emerald-400/50 text-emerald-400'
                          : 'bg-white/5 border-white/10 text-white'
                      } ${resolvedObjectives.length <= 2 ? 'flex-1 min-w-fit' : 'shrink-0'}`}
                    >
                      {obj.type === 'collect_candy' && (
                        <OriginalCandy
                          type={obj.candyType}
                          size={iconSize}
                          className={`shrink-0 ${iconSizeClass}`}
                        />
                      )}
                      {obj.type === 'clear_jelly' && (
                        <Droplets
                          className={`shrink-0 text-fuchsia-300 ${iconSizeClass}`}
                        />
                      )}
                      {obj.type === 'break_blocker' && (
                        <Shield
                          className={`shrink-0 text-amber-300 ${iconSizeClass}`}
                        />
                      )}
                      {obj.type === 'collect_special' && (
                        <Zap
                          className={`shrink-0 text-cyan-300 ${iconSizeClass}`}
                        />
                      )}
                      {obj.type === 'reach_score' && (
                        <Star
                          className={`shrink-0 text-amber-300 fill-amber-300 ${iconSizeClass}`}
                        />
                      )}
                      <span
                        className={`${textSize} font-black leading-none tabular-nums whitespace-nowrap drop-shadow ${
                          isMet ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        {obj.type === 'reach_score'
                          ? `${item.remaining.toLocaleString()}`
                          : item.remaining}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <span className="text-sm font-black text-amber-300">{level.targetScore} pts</span>
              </div>
            )}
          </div>

          {/* SECTION 2: DEDICATED MOVES COUNTER (Completely isolated, guaranteed no overlap) */}
          <div className="flex-1 @[280px]:flex-none @[280px]:w-[56px] @[315px]:w-[62px] @[345px]:w-[70px] shrink-0 px-1 @[315px]:px-1.5 @[345px]:p-2 py-1.5 rounded-2xl bg-black/40 border border-white/15 shadow-md flex flex-col items-center justify-center text-center">
            <p className="text-[8px] @[315px]:text-[9px] font-bold text-white/60 uppercase tracking-wide @[345px]:tracking-wider">
              Moves
            </p>
            <p
              className={`text-xl @[345px]:text-2xl font-black leading-none mt-0.5 tabular-nums ${
                movesLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-amber-300'
              }`}
            >
              {movesLeft}
            </p>
          </div>

          {/* SECTION 3: DEDICATED SCORE & STARS METER */}
          <div className="flex-[1.35] @[280px]:flex-none @[280px]:w-[84px] @[315px]:w-[92px] @[345px]:w-[104px] shrink-0 px-1.5 @[345px]:p-2 py-1.5 rounded-2xl bg-black/40 border border-white/15 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[8px] @[315px]:text-[9px] @[345px]:text-[10px] font-bold text-white/60 uppercase">
                Score
              </span>
              <div className="flex items-center gap-0.5 shrink-0">
                {[1, 2, 3].map((s) => (
                  <Star
                    key={s}
                    className={`w-2.5 h-2.5 @[345px]:w-3 @[345px]:h-3 ${
                      s <= calculatedStars
                        ? 'fill-amber-400 text-amber-300 drop-shadow-[0_1px_3px_rgba(251,191,36,0.8)]'
                        : 'fill-white/10 text-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            <p className="text-xs @[315px]:text-sm font-black text-emerald-300 leading-tight tabular-nums whitespace-nowrap">
              {score.toLocaleString()}
            </p>

            {/* Score Star Progress Bar */}
            <div className="relative w-full bg-black/40 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-all duration-300"
                style={{ width: `${scoreProgressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* SPECIAL MATCH CELEBRATION SHOCKWAVE BANNER */}
      {specialMatchBanner && (
        <div className="absolute top-[28%] left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-shockwave">
          <div className="px-5 py-2 rounded-3xl bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600 border-2 border-white shadow-[0_10px_30px_rgba(255,214,0,0.7)] text-center">
            <span className="text-base font-black tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] uppercase">
              {specialMatchBanner}
            </span>
          </div>
        </div>
      )}

      {/* EXTRA MOVES REWARD CELEBRATION BANNER */}
      {extraMovesBanner && (
        <div className="absolute top-[28%] left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-shockwave">
          <div className="px-5 py-2.5 rounded-3xl bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 border-2 border-yellow-200 shadow-[0_10px_35px_rgba(245,158,11,0.85)] text-center flex items-center justify-center gap-2">
            <span className="text-xl">🍬</span>
            <span className="text-base font-black tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] uppercase">
              {extraMovesBanner}
            </span>
            <span className="text-xl">✨</span>
          </div>
        </div>
      )}

      {/* 8x8 PREMIUM CANDY GAME BOARD */}
      <div
        ref={boardRef}
        className="relative my-auto flex flex-col items-center justify-center select-none"
      >
        {/* COMBO BANNER */}
        {comboCount > 1 && !specialMatchBanner && (
          <div className="pointer-events-none absolute -top-2.5 left-1/2 -translate-x-1/2 z-30">
            <div className="px-4 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 text-white text-[11px] font-black shadow-lg animate-bounce flex items-center gap-1 whitespace-nowrap">
              <Flame className="w-3 h-3 fill-white shrink-0" />
              <span>{comboCount}x SWEET COMBO!</span>
            </div>
          </div>
        )}

        {/* Floating Scores Container */}
        {floatingScores.map((item) => (
          <div
            key={item.id}
            style={{
              left: `${item.xPercent}%`,
              top: `${item.yPercent}%`,
            }}
            className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-1/2 animate-float-score"
          >
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-black shadow-lg border ${
                item.isSpecial
                  ? 'bg-gradient-to-r from-amber-300 to-rose-500 text-white border-white scale-110'
                  : 'bg-black/75 text-amber-300 border-amber-300/40'
              }`}
            >
              {item.text}
            </span>
          </div>
        ))}

        {/* 8x8 Board Chassis: Rich Gradient, Gloss Inset, Rounded Corners */}
        <div
          className={`relative p-2 rounded-[28px] bg-gradient-to-b from-[#2d1245] via-[#1b082e] to-[#120420] border-[3px] border-[#ff70a6]/60 shadow-[0_18px_45px_rgba(0,0,0,0.8),inset_0_2px_6px_rgba(255,255,255,0.25)] touch-none select-none max-w-[370px] w-full ${
            boardImpact === 'strong'
              ? 'animate-board-impact-strong'
              : boardImpact === 'micro'
              ? 'animate-board-impact-micro'
              : ''
          }`}
          style={{ touchAction: 'none' }}
        >
          {/* Subtle Top Specular Curved Highlight */}
          <div className="absolute top-1 left-6 right-6 h-3 rounded-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

          {/* 8x8 Grid with Checkered Gel Tiles */}
          <div className="relative w-full">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${boardCols}, minmax(0, 1fr))` }}
            >
              {grid.map((row, r) =>
                row.map((cell, c) => {
                  const candy = cell.candy;
                  const cellCoord = `${r},${c}`;
                  const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                  const isMatched = matchedCells.has(cellCoord);
                  const fall = fallingInfo[cellCoord];
                  const isAlternateTile = (r + c) % 2 === 0;

                  // Dynamic swap transform with smooth easing
                  let transformStyle: React.CSSProperties = {};
                  if (swapping) {
                    const isFrom = swapping.from.r === r && swapping.from.c === c;
                    const isTo = swapping.to.r === r && swapping.to.c === c;

                    if (swapping.phase === 'forward') {
                      if (isFrom) {
                        const deltaC = (swapping.to.c - swapping.from.c) * 100;
                        const deltaR = (swapping.to.r - swapping.from.r) * 100;
                        transformStyle = {
                          transform: `translate(${deltaC}%, ${deltaR}%) scale(1.12)`,
                          zIndex: 25,
                          transition: 'transform 0.19s cubic-bezier(0.2, 0.9, 0.3, 1)',
                        };
                      } else if (isTo) {
                        const deltaC = (swapping.from.c - swapping.to.c) * 100;
                        const deltaR = (swapping.from.r - swapping.to.r) * 100;
                        transformStyle = {
                          transform: `translate(${deltaC}%, ${deltaR}%) scale(0.92)`,
                          zIndex: 20,
                          transition: 'transform 0.19s cubic-bezier(0.2, 0.9, 0.3, 1)',
                        };
                      }
                    } else if (swapping.phase === 'revert') {
                      if (isFrom || isTo) {
                        transformStyle = {
                          transform: 'translate(0%, 0%)',
                          zIndex: 20,
                          transition: 'transform 0.19s cubic-bezier(0.3, 1.2, 0.4, 1)',
                        };
                      }
                    }
                  }

                  if (!cell.playable) {
                    return (
                      <div
                        key={`${r}-${c}`}
                        aria-hidden="true"
                        className="relative aspect-square rounded-xl bg-transparent pointer-events-none select-none"
                      />
                    );
                  }

                  const isHammerTarget =
                    pendingBoosterConfirm?.type === 'lollipop_hammer' &&
                    pendingBoosterConfirm.target.r === r &&
                    pendingBoosterConfirm.target.c === c;
                  const canHammerCell = isHammerArmed && canHammerHitCell(cell);
                  const isColorBombCharging = colorBombChargingCoords.some(
                    (coord) => coord.r === r && coord.c === c
                  );
                  const isSugarCrushPriming =
                    sugarCrushPrimingCoord?.r === r && sugarCrushPrimingCoord?.c === c;
                  const isHintCell = Boolean(
                    isBoardIdleForHint &&
                      hintMove &&
                      !isMatched &&
                      !fall &&
                      !isSelected &&
                      cell.blocker === null &&
                      !cell.isLocked &&
                      candy &&
                      ((hintMove.from.r === r && hintMove.from.c === c) ||
                        (hintMove.to.r === r && hintMove.to.c === c))
                  );

                  return (
                    <div
                      key={`${r}-${c}`}
                      onPointerDown={(e) => handlePointerDown(e, r, c)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerCancel}
                      style={{
                        ...transformStyle,
                        touchAction: 'none',
                      }}
                      className={`relative aspect-square rounded-xl flex items-center justify-center select-none transition-all duration-150 ${
                        isHammerArmed
                          ? canHammerCell
                            ? 'cursor-crosshair ring-1 ring-amber-300/60 hover:ring-2 hover:ring-amber-300'
                            : 'cursor-not-allowed opacity-70'
                          : cell.blocker !== null || cell.isLocked
                          ? 'cursor-default'
                          : 'cursor-pointer'
                      } ${
                        isAlternateTile
                          ? 'bg-white/[0.07] shadow-inner'
                          : 'bg-white/[0.03]'
                      } ${
                        isColorBombCharging
                          ? 'ring-2 ring-white/95 bg-gradient-to-br from-pink-400/35 via-amber-300/35 to-cyan-300/35 z-20'
                          : isSugarCrushPriming
                          ? 'ring-3 ring-amber-200 bg-amber-300/25 shadow-[0_0_14px_rgba(253,224,71,0.9)] z-20'
                          : isHammerTarget
                          ? 'ring-3 ring-rose-400 bg-rose-500/30 scale-105 z-20 shadow-lg'
                          : isSelected
                          ? 'ring-3 ring-amber-300 bg-white/30 scale-105 z-10 shadow-lg'
                          : isHintCell
                          ? 'ring-2 ring-amber-300/75 bg-amber-300/15 shadow-[0_0_12px_rgba(253,224,71,0.45)] z-10'
                          : !isHammerArmed && cell.blocker === null && !cell.isLocked
                          ? 'hover:bg-white/15 active:scale-95'
                          : ''
                      }`}
                    >
                      {isColorBombCharging && (
                        <div
                          className="absolute -inset-1 rounded-full pointer-events-none z-[1] animate-color-bomb-aura"
                          style={{
                            background:
                              'conic-gradient(from 0deg, rgba(255,59,127,0.8), rgba(250,204,21,0.85), rgba(52,211,153,0.8), rgba(56,189,248,0.85), rgba(168,85,247,0.8), rgba(255,59,127,0.8))',
                            WebkitMaskImage:
                              'radial-gradient(circle, rgba(0,0,0,0.95) 36%, rgba(0,0,0,0) 72%)',
                            maskImage:
                              'radial-gradient(circle, rgba(0,0,0,0.95) 36%, rgba(0,0,0,0) 72%)',
                          }}
                          aria-hidden="true"
                        />
                      )}

                      {/* Jelly layer underneath candies / blockers (1 layer vs 2+ layers) */}
                      {cell.jellyLayers > 0 && (
                        <div
                          className={`absolute inset-[2px] rounded-[10px] pointer-events-none z-0 transition-all ${
                            cell.jellyLayers >= 2
                              ? 'bg-gradient-to-br from-cyan-300/75 via-fuchsia-500/70 to-pink-600/80 border-2 border-cyan-100/85 shadow-[inset_0_3px_8px_rgba(255,255,255,0.65),0_0_8px_rgba(232,121,249,0.5)]'
                              : 'bg-gradient-to-br from-pink-400/55 via-fuchsia-500/45 to-rose-500/55 border border-pink-200/65 shadow-[inset_0_2px_6px_rgba(255,255,255,0.45)]'
                          }`}
                        >
                          <div className="absolute top-0.5 left-1 right-2 h-1 rounded-full bg-white/45" />
                          {cell.jellyLayers >= 2 && (
                            <span className="absolute top-0.5 right-0.5 px-1 rounded bg-purple-950/85 border border-cyan-200/70 text-[8px] font-black leading-[11px] text-cyan-200">
                              ×{cell.jellyLayers}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Blocker overlay or Candy */}
                      {cell.blocker !== null ? (
                        <div className="relative z-[5] w-full h-full flex items-center justify-center pointer-events-none">
                          {renderBlockerVisual(cell.blocker, cell.blockerHealth)}
                        </div>
                      ) : (
                        candy && (() => {
                          const useVectorAnim = Boolean(
                            fall &&
                              ((fall.fromColDelta !== undefined && fall.fromColDelta !== 0) ||
                                (fall.isNew && (fall.fromRow ?? 0) > 0))
                          );
                          const isSugarCrushPopping = Boolean(sugarCrushPoppingCells[cellCoord]);
                          const animClass = isMatched
                            ? isColorBombPoppingActive
                              ? 'animate-color-bomb-candy-pop'
                              : 'animate-candy-pop'
                            : fall
                            ? useVectorAnim
                              ? fall.isNew
                                ? 'animate-candy-spawn-vector'
                                : 'animate-candy-drop-vector'
                              : fall.isNew
                              ? `animate-candy-spawn-${fall.distance}`
                              : `animate-candy-drop-${fall.distance}`
                            : isColorBombCharging
                            ? 'animate-color-bomb-charge'
                            : isSugarCrushPriming
                            ? 'animate-sugar-crush-prime'
                            : isSugarCrushPopping
                            ? 'animate-sugar-crush-create'
                            : isHintCell
                            ? 'animate-hint-candy'
                            : '';

                          const matchedPopDelay = isMatched ? matchedCellDelays[cellCoord] : undefined;
                          const candyAnimStyle: React.CSSProperties = {
                            zIndex: fall ? 12 : 2,
                            ...(isMatched && matchedPopDelay !== undefined
                              ? {
                                  animationDelay: `${matchedPopDelay}ms`,
                                  animationFillMode: 'both',
                                }
                              : {}),
                            ...(useVectorAnim && fall
                              ? ({
                                  '--drop-x': `${(fall.fromColDelta ?? 0) * 100}%`,
                                  '--drop-y': `${(fall.fromRowDelta ?? -fall.distance) * 100}%`,
                                } as React.CSSProperties)
                              : {}),
                          };

                          return (
                            <div
                              key={
                                fall
                                  ? `fall-${dropStepRef.current}-${r}-${c}`
                                  : `candy-${r}-${c}`
                              }
                              className={`w-full h-full flex items-center justify-center ${animClass}`}
                              style={candyAnimStyle}
                            >
                              <OriginalCandy
                                type={candy.color}
                                special={candy.special}
                                size={32}
                                className={`w-[92%] h-[92%] max-w-[32px] max-h-[32px] aspect-square shrink-0 ${
                                  isSelected ? 'animate-bounce' : ''
                                }`}
                              />
                            </div>
                          );
                        })()
                      )}

                      {/* Locked candy lattice cage overlay */}
                      {cell.isLocked && cell.blocker === null && (
                        <div className="absolute inset-[1px] z-[8] rounded-xl pointer-events-none border-2 border-amber-200/80 shadow-[inset_0_0_6px_rgba(251,191,36,0.45)] overflow-hidden flex items-end justify-end">
                          <svg
                            viewBox="0 0 36 36"
                            className="absolute inset-0 w-full h-full"
                            aria-hidden="true"
                          >
                            <line x1="0" y1="12" x2="36" y2="12" stroke="rgba(253,230,138,0.65)" strokeWidth="2" />
                            <line x1="0" y1="24" x2="36" y2="24" stroke="rgba(253,230,138,0.65)" strokeWidth="2" />
                            <line x1="12" y1="0" x2="12" y2="36" stroke="rgba(253,230,138,0.65)" strokeWidth="2" />
                            <line x1="24" y1="0" x2="24" y2="36" stroke="rgba(253,230,138,0.65)" strokeWidth="2" />
                          </svg>
                          <div className="relative m-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 border border-white flex items-center justify-center shadow">
                            <Lock className="w-2 h-2 text-purple-950" />
                          </div>
                        </div>
                      )}

                      {/* Selected pulse aura */}
                      {isSelected && (
                        <div className="absolute inset-0 rounded-xl bg-amber-400/20 pointer-events-none z-10" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Sugar Crush Split-Directional Travelling Striped Laser Beams Overlay */}
            {sugarCrushBeams.length > 0 && (
              <div
                className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-2xl"
                aria-hidden="true"
              >
                {sugarCrushBeams.map((beam) => {
                  const isHorizontal =
                    beam.direction === 'left' || beam.direction === 'right';
                  const fadeDelayMs = beam.startDelayMs + beam.travelMs;

                  if (isHorizontal) {
                    const leftPct =
                      beam.direction === 'left'
                        ? 0
                        : ((beam.c + 0.5) / boardCols) * 100;
                    const widthPct =
                      beam.direction === 'left'
                        ? ((beam.c + 0.5) / boardCols) * 100
                        : ((boardCols - (beam.c + 0.5)) / boardCols) * 100;
                    const trailGradient =
                      beam.direction === 'right'
                        ? `linear-gradient(90deg, transparent 0%, ${beam.highlightColor} 22%, #ffffff 78%, #fef08a 100%)`
                        : `linear-gradient(270deg, transparent 0%, ${beam.highlightColor} 22%, #ffffff 78%, #fef08a 100%)`;

                    return (
                      <div
                        key={beam.id}
                        className="absolute animate-sugar-crush-segment-fade"
                        style={
                          {
                            top: `${((beam.r + 0.5) / boardRows) * 100}%`,
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            height: `calc(100% / ${boardRows} * 0.44)`,
                            transform: 'translateY(-50%)',
                            '--fade-delay': `${fadeDelayMs}ms`,
                          } as React.CSSProperties
                        }
                      >
                        <div
                          className="absolute inset-0 rounded-full animate-sugar-crush-trail-h"
                          style={
                            {
                              transformOrigin:
                                beam.direction === 'right' ? 'left center' : 'right center',
                              background: trailGradient,
                              boxShadow: `0 0 12px ${beam.highlightColor}, 0 0 5px #ffffff`,
                              '--beam-dur': `${beam.travelMs}ms`,
                              '--beam-delay': `${beam.startDelayMs}ms`,
                            } as React.CSSProperties
                          }
                        />
                        <div
                          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full ${
                            beam.direction === 'right'
                              ? 'animate-sugar-crush-tip-right'
                              : 'animate-sugar-crush-tip-left'
                          }`}
                          style={
                            {
                              background: `radial-gradient(circle, #ffffff 0%, #fef08a 45%, ${beam.highlightColor} 80%, transparent 100%)`,
                              boxShadow: `0 0 14px #ffffff, 0 0 22px ${beam.highlightColor}`,
                              '--beam-dur': `${beam.travelMs}ms`,
                              '--beam-delay': `${beam.startDelayMs}ms`,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                    );
                  }

                  const topPct =
                    beam.direction === 'up'
                      ? 0
                      : ((beam.r + 0.5) / boardRows) * 100;
                  const heightPct =
                    beam.direction === 'up'
                      ? ((beam.r + 0.5) / boardRows) * 100
                      : ((boardRows - (beam.r + 0.5)) / boardRows) * 100;
                  const trailGradient =
                    beam.direction === 'down'
                      ? `linear-gradient(180deg, transparent 0%, ${beam.highlightColor} 22%, #ffffff 78%, #fef08a 100%)`
                      : `linear-gradient(0deg, transparent 0%, ${beam.highlightColor} 22%, #ffffff 78%, #fef08a 100%)`;

                  return (
                    <div
                      key={beam.id}
                      className="absolute animate-sugar-crush-segment-fade"
                      style={
                        {
                          left: `${((beam.c + 0.5) / boardCols) * 100}%`,
                          top: `${topPct}%`,
                          height: `${heightPct}%`,
                          width: `calc(100% / ${boardCols} * 0.44)`,
                          transform: 'translateX(-50%)',
                          '--fade-delay': `${fadeDelayMs}ms`,
                        } as React.CSSProperties
                      }
                    >
                      <div
                        className="absolute inset-0 rounded-full animate-sugar-crush-trail-v"
                        style={
                          {
                            transformOrigin:
                              beam.direction === 'down' ? 'center top' : 'center bottom',
                            background: trailGradient,
                            boxShadow: `0 0 12px ${beam.highlightColor}, 0 0 5px #ffffff`,
                            '--beam-dur': `${beam.travelMs}ms`,
                            '--beam-delay': `${beam.startDelayMs}ms`,
                          } as React.CSSProperties
                        }
                      />
                      <div
                        className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full ${
                          beam.direction === 'down'
                            ? 'animate-sugar-crush-tip-down'
                            : 'animate-sugar-crush-tip-up'
                        }`}
                        style={
                          {
                            background: `radial-gradient(circle, #ffffff 0%, #fef08a 45%, ${beam.highlightColor} 80%, transparent 100%)`,
                            boxShadow: `0 0 14px #ffffff, 0 0 22px ${beam.highlightColor}`,
                            '--beam-dur': `${beam.travelMs}ms`,
                            '--beam-delay': `${beam.startDelayMs}ms`,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Color Bomb Outward Travelling Rainbow Zap Beams Overlay (GPU transform + opacity) */}
            {colorBombZaps.length > 0 && (
              <div
                className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-2xl"
                aria-hidden="true"
              >
                {colorBombZaps.map((zap) => {
                  const dx = zap.toC - zap.fromC;
                  const dy = zap.toR - zap.fromR;
                  const widthPct = (Math.hypot(dx, dy) / boardCols) * 100;
                  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
                  const fadeDelayMs = zap.startDelayMs + zap.travelMs;

                  return (
                    <div
                      key={zap.id}
                      className="absolute animate-color-bomb-zap-fade"
                      style={
                        {
                          left: `${((zap.fromC + 0.5) / boardCols) * 100}%`,
                          top: `${((zap.fromR + 0.5) / boardRows) * 100}%`,
                          width: `${widthPct}%`,
                          height: '9px',
                          transformOrigin: '0% 50%',
                          transform: `translate3d(0, -50%, 0) rotate(${angleDeg}deg)`,
                          '--zap-fade-delay': `${fadeDelayMs}ms`,
                        } as React.CSSProperties
                      }
                    >
                      <div
                        className="relative w-full h-full rounded-full animate-color-bomb-zap-beam"
                        style={
                          {
                            background: `linear-gradient(90deg, rgba(255,255,255,0.25) 0%, #ff3b7f 22%, #facc15 48%, #34d399 72%, #38bdf8 90%, ${zap.highlightColor} 100%)`,
                            '--zap-dur': `${zap.travelMs}ms`,
                            '--zap-delay': `${zap.startDelayMs}ms`,
                          } as React.CSSProperties
                        }
                      >
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-white/95" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Local Candy Match Particles & Sparkles Overlay */}
            {matchParticles.length > 0 && (
              <div
                className="absolute inset-0 pointer-events-none z-20 overflow-visible"
                aria-hidden="true"
              >
                {matchParticles.map((burst) => (
                  <div
                    key={`${burst.batchId}-${burst.r}-${burst.c}`}
                    style={{
                      left: `${((burst.c + 0.5) / boardCols) * 100}%`,
                      top: `${((burst.r + 0.5) / boardRows) * 100}%`,
                    }}
                    className="absolute"
                  >
                    {burst.tier !== 'normal' && (
                      <span
                        className="absolute left-0 top-0 rounded-full animate-match-ring"
                        style={
                          {
                            width: burst.tier === 'mega' ? 40 : 32,
                            height: burst.tier === 'mega' ? 40 : 32,
                            border: `2px solid ${burst.ringColor}`,
                            boxShadow: burst.noRingShadow
                              ? undefined
                              : `0 0 10px ${burst.ringColor}`,
                            '--delay': `${burst.ringDelayMs}ms`,
                          } as React.CSSProperties
                        }
                      />
                    )}

                    {burst.particles.map((p) =>
                      p.kind === 'sparkle' ? (
                        <svg
                          key={p.id}
                          width={p.size}
                          height={p.size}
                          viewBox="0 0 16 16"
                          fill="none"
                          className="absolute left-0 top-0 animate-match-sparkle"
                          style={
                            {
                              '--tx': `${p.tx}px`,
                              '--ty': `${p.ty}px`,
                              '--rot': `${p.rot}deg`,
                              '--dur': `${p.durationMs}ms`,
                              '--delay': `${p.delayMs}ms`,
                              filter: p.noFilter ? undefined : `drop-shadow(0 0 3px ${p.color})`,
                            } as React.CSSProperties
                          }
                        >
                          <path
                            d="M8 0L9.8 6.2L16 8L9.8 9.8L8 16L6.2 9.8L0 8L6.2 6.2L8 0Z"
                            fill={p.color}
                          />
                        </svg>
                      ) : (
                        <span
                          key={p.id}
                          className="absolute left-0 top-0 rounded-full animate-match-particle"
                          style={
                            {
                              width: p.size,
                              height: p.size,
                              backgroundColor: p.color,
                              boxShadow: p.glowColor ? `0 0 6px ${p.glowColor}` : undefined,
                              '--tx': `${p.tx}px`,
                              '--ty': `${p.ty}px`,
                              '--rot': `${p.rot}deg`,
                              '--dur': `${p.durationMs}ms`,
                              '--delay': `${p.delayMs}ms`,
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tutorial Hint Pill */}
        {showTutorialHint && !isHammerArmed && !boosterFeedback && (
          <div className="mt-1.5 px-3 py-1 rounded-full bg-black/40 border border-white/20 text-[10px] text-amber-200 font-semibold flex items-center gap-1.5 animate-pulse shadow-md">
            <Move className="w-3 h-3 text-amber-300" />
            <span>Swipe adjacent candies to match 3, 4 or 5!</span>
          </div>
        )}

        {/* Armed Hammer or Booster Toast Banner */}
        {(isHammerArmed || boosterFeedback) && (
          <div
            className={`mt-1.5 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1.5 shadow-md border ${
              boosterFeedback?.tone === 'error'
                ? 'bg-rose-950/90 border-rose-400/70 text-rose-200'
                : boosterFeedback?.tone === 'success'
                ? 'bg-emerald-950/90 border-emerald-400/70 text-emerald-200'
                : 'bg-amber-950/90 border-amber-300/70 text-amber-200'
            }`}
          >
            {isHammerArmed ? (
              <>
                <Hammer className="w-3 h-3 text-amber-300 shrink-0" />
                <span>
                  {boosterFeedback?.tone === 'error'
                    ? boosterFeedback.text
                    : 'Hammer Armed: Tap a candy, lock, or blocker'}
                </span>
              </>
            ) : (
              <span>{boosterFeedback?.text}</span>
            )}
          </div>
        )}
      </div>

      {/* IN-GAME BOOSTERS BAR */}
      <div className="relative z-10 mt-1 grid grid-cols-3 gap-1.5 shrink-0">
        {(['lollipop_hammer', 'extra_moves', 'shuffle'] as const).map((boosterId) => {
          const def = IN_GAME_BOOSTERS[boosterId];
          const affordable = canAffordCoins(playerCoins, def.cost);
          const isArmed = boosterId === 'lollipop_hammer' && isHammerArmed;
          const isDisabled = isAnimating || isWon || isGameOver || pendingBoosterConfirm !== null;

          return (
            <button
              key={boosterId}
              type="button"
              disabled={isDisabled}
              onClick={() =>
                boosterId === 'lollipop_hammer'
                  ? handleToggleHammerBooster()
                  : handleRequestInGameBooster(boosterId)
              }
              className={`px-2 py-1.5 rounded-2xl border flex items-center justify-between gap-1 text-left transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                isArmed
                  ? 'bg-amber-400/25 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                  : affordable
                  ? 'bg-black/45 border-white/20 hover:bg-white/10'
                  : 'bg-black/30 border-rose-400/30 opacity-85'
              }`}
              title={def.description}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-xl flex items-center justify-center shrink-0 ${
                    boosterId === 'lollipop_hammer'
                      ? 'bg-pink-500/30 text-pink-200'
                      : boosterId === 'extra_moves'
                      ? 'bg-emerald-500/30 text-emerald-200'
                      : 'bg-cyan-500/30 text-cyan-200'
                  }`}
                >
                  {boosterId === 'lollipop_hammer' && <Hammer className="w-3.5 h-3.5" />}
                  {boosterId === 'extra_moves' && <Plus className="w-3.5 h-3.5" />}
                  {boosterId === 'shuffle' && <Shuffle className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-white leading-tight truncate">
                    {isArmed ? 'Cancel' : def.shortName}
                  </p>
                  <p
                    className={`text-[9px] font-black flex items-center gap-0.5 leading-tight ${
                      affordable ? 'text-amber-300' : 'text-rose-300'
                    }`}
                  >
                    <Coins className="w-2.5 h-2.5 shrink-0" />
                    <span>{def.cost}</span>
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* FOOTER BAR */}
      <div className="relative z-10 mt-1 p-2 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between shrink-0">
        <button
          onClick={() => handleExitLevel(onOpenLevelSelect)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer"
        >
          <Map className="w-3.5 h-3.5 text-amber-300" />
          <span>All Levels</span>
        </button>

        <button
          onClick={() => handleExitLevel(onBackToHome)}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-pink-600 to-rose-700 hover:from-pink-500 hover:to-rose-600 active:scale-95 text-white text-xs font-black transition-all cursor-pointer shadow-sm"
        >
          Exit to Home
        </button>
      </div>

      </div>

      {/* LEVEL WON CELEBRATION MODAL (WITH NEXT LEVEL BUTTON!) */}
      {isWon && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm max-h-full overflow-y-auto overflow-x-hidden rounded-3xl bg-gradient-to-b from-[#3d135d] via-[#260a3f] to-[#140424] border-4 border-amber-400 p-4 sm:p-6 text-center text-white shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
            {/* Top Trophy Icon */}
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center shadow-lg animate-bounce">
              <Trophy className="w-9 h-9 text-white" />
            </div>

            <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-orange-300 tracking-wider uppercase">
              LEVEL {level.levelNumber} COMPLETED!
            </h3>
            <p className="text-xs text-white/80 mt-1">
              {level.name} successfully conquered!
            </p>

            {/* Earned Stars */}
            <div className="flex items-center justify-center gap-2 my-4">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  className={`w-9 h-9 ${
                    s <= calculatedStars
                      ? 'fill-amber-400 text-amber-300 drop-shadow-[0_2px_10px_rgba(251,191,36,0.9)] animate-pulse'
                      : 'fill-white/10 text-white/30'
                  }`}
                />
              ))}
            </div>

            {/* Score, Coins & Objectives Summary Card */}
            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 mb-5 space-y-1.5">
              <p className="text-xs text-white/60">Final Score</p>
              <p className="text-2xl font-black text-emerald-400">{score.toLocaleString()} pts</p>
              <p className="text-[11px] text-amber-200 font-semibold">
                🎯 {level.goalDescription} (Complete!)
              </p>
              {lastWinReward && lastWinReward.attemptId === attemptIdRef.current && (
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-center gap-2 text-xs font-black text-amber-300">
                  <Coins className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>+{lastWinReward.coinsAwarded} Coins Earned</span>
                  {lastWinReward.starBonusCoins > 0 && (
                    <span className="text-[10px] font-bold text-amber-200/80">
                      (incl. +{lastWinReward.starBonusCoins} star bonus)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ACTION BUTTONS: PROMINENT "NEXT LEVEL" BUTTON */}
            <div className="flex flex-col gap-2.5">
              {hasNextLevel ? (
                <button
                  onClick={() => {
                    if (soundSettings.soundEffectsEnabled) soundEngine.playPlayFanfare(soundSettings.masterVolume);
                    onNextLevel();
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#ffe542] via-[#ff9b00] to-[#e64700] text-white font-black text-base tracking-wider shadow-[0_8px_20px_rgba(255,155,0,0.6)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shine-effect"
                >
                  <span>NEXT LEVEL</span>
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              ) : (
                <button
                  onClick={() => handleExitLevel(onBackToHome)}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-emerald-400 to-green-600 text-white font-black text-base shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  ALL LEVELS COMPLETED!
                </button>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleResetLevel}
                  className="flex-1 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer"
                >
                  Replay
                </button>
                <button
                  onClick={() => handleExitLevel(onOpenLevelSelect)}
                  className="flex-1 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                >
                  <Map className="w-3.5 h-3.5 text-amber-300" />
                  <span>Level Map</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IN-GAME BOOSTER PURCHASE CONFIRMATION MODAL */}
      {pendingBoosterConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xs rounded-3xl bg-gradient-to-b from-[#3d135d] to-[#1a0730] border-2 border-amber-400/80 p-4 text-center shadow-2xl">
            <h4 className="text-base font-black text-amber-300 uppercase tracking-wide">
              Confirm Booster
            </h4>
            <p className="text-xs text-white/85 mt-1.5">
              Use <span className="font-black text-white">{IN_GAME_BOOSTERS[pendingBoosterConfirm.type].name}</span> for{' '}
              <span className="font-black text-amber-300">
                {IN_GAME_BOOSTERS[pendingBoosterConfirm.type].cost} Coins
              </span>
              ?
            </p>
            <p className="text-[11px] text-white/60 mt-1">
              {IN_GAME_BOOSTERS[pendingBoosterConfirm.type].description}
            </p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setPendingBoosterConfirm(null)}
                className="flex-1 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmBoosterPurchase}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 text-purple-950 font-black text-xs flex items-center justify-center gap-1 shadow-md hover:brightness-110 active:scale-95 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXTRA MOVES REWARDED AD OFFER MODAL */}
      <ExtraMovesOfferModal
        isOpen={showExtraMovesOffer}
        goals={level.goals}
        collectedCounts={collectedCounts}
        resolvedObjectives={resolvedObjectives}
        levelNumber={level.levelNumber}
        soundSettings={soundSettings}
        onWatchAd={handleWatchRewardedAd}
        onDecline={handleDeclineExtraMoves}
      />

      {/* REWARDED AD SIMULATION / TEST MODE PLAYER MODAL */}
      <RewardedAdPlayerModal
        isOpen={showRewardedAdPlayer}
        levelNumber={level.levelNumber}
        soundSettings={soundSettings}
        onAdResult={handleAdResult}
      />

      {/* OUT OF MOVES / GAME OVER MODAL */}
      {isGameOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm max-h-full overflow-y-auto overflow-x-hidden rounded-3xl bg-gradient-to-b from-[#310d29] via-[#1d0618] to-[#10030d] border-4 border-rose-500/80 p-4 sm:p-6 text-center text-white shadow-[0_25px_60px_rgba(0,0,0,0.9)]">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-rose-400" />
            </div>

            <h3 className="text-2xl font-black text-rose-300 tracking-wider uppercase">
              OUT OF MOVES!
            </h3>
            <p className="text-xs text-white/70 mt-1">
              Target goal not reached in {totalMovesGranted} moves.
            </p>

            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-[11px] font-bold text-rose-200">
              <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
              <span>
                -1 Life • {playerLives}/{playerMaxLives} Left (
                {playerLives >= playerMaxLives ? 'FULL' : formatRegenCountdown(nextLifeSeconds)})
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 my-4 space-y-1">
              <p className="text-xs text-white/60">Final Score</p>
              <p className="text-xl font-black text-amber-300">{score.toLocaleString()}</p>
              <p className="text-[11px] text-pink-300">Goal: {level.goalDescription}</p>
            </div>

            {lifeAdFeedback && (
              <div
                className={`mb-3 px-3 py-2 rounded-xl border text-[11px] font-bold ${
                  lifeAdFeedback.tone === 'success'
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                    : 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                }`}
              >
                {lifeAdFeedback.text}
              </div>
            )}

            {playerLives <= 0 && (
              <button
                type="button"
                onClick={handleWatchLifeAd}
                disabled={showLifeAdPlayer}
                className="mb-2.5 w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 hover:brightness-110 active:scale-[0.98] border-2 border-yellow-200 text-white font-black text-xs sm:text-sm tracking-wide uppercase flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(245,158,11,0.45)] cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-white text-white shrink-0" />
                <span>Watch Ad – Get 1 Life</span>
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleExitLevel(onBackToHome)}
                className="flex-1 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Map
              </button>
              <button
                type="button"
                disabled={playerLives <= 0}
                onClick={handleResetLevel}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-b from-rose-500 to-pink-600 text-white font-extrabold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {playerLives > 0 ? 'Try Again' : `Wait ${formatRegenCountdown(nextLifeSeconds)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REWARDED AD PLAYER MODAL FOR +1 LIFE (GAME OVER) */}
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
