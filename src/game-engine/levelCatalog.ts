import {
  BlockerType,
  BoardLayoutConfig,
  CandyDistributionConfig,
  CandyShape,
  LevelDifficulty,
  LevelInfo,
  LevelObjective,
} from '../types/game';
import { ALL_CANDIES, LEVEL1_CANDIES } from './boardEngine';

export interface WorldDefinition {
  id: string;
  name: string;
  badgeEmoji: string;
  levelRange: [number, number];
  gradientClass: string;
  accentColor: string;
}

export const WORLD_DEFINITIONS: WorldDefinition[] = [
  {
    id: 'sugar-meadows',
    name: 'Sugar Meadows',
    badgeEmoji: '🌸',
    levelRange: [1, 3],
    gradientClass: 'from-emerald-500/85 via-teal-600/85 to-emerald-700/85',
    accentColor: '#34d399',
  },
  {
    id: 'jelly-valley',
    name: 'Jelly Valley',
    badgeEmoji: '🍇',
    levelRange: [4, 6],
    gradientClass: 'from-pink-600/85 to-purple-600/85',
    accentColor: '#ec4899',
  },
  {
    id: 'caramel-creek',
    name: 'Caramel Creek',
    badgeEmoji: '🍯',
    levelRange: [7, 9],
    gradientClass: 'from-amber-600/85 to-orange-700/85',
    accentColor: '#f59e0b',
  },
  {
    id: 'frosting-peaks',
    name: 'Frosting Peaks',
    badgeEmoji: '❄️',
    levelRange: [10, 12],
    gradientClass: 'from-indigo-600/85 to-purple-700/85',
    accentColor: '#818cf8',
  },
  {
    id: 'candy-castle',
    name: 'Candy Castle',
    badgeEmoji: '👑',
    levelRange: [13, 15],
    gradientClass: 'from-rose-500/85 via-fuchsia-600/85 to-purple-700/85',
    accentColor: '#f43f5e',
  },
  {
    id: 'crystal-hollows',
    name: 'Crystal Hollows',
    badgeEmoji: '💎',
    levelRange: [16, 18],
    gradientClass: 'from-cyan-600/85 via-sky-600/85 to-indigo-700/85',
    accentColor: '#22d3ee',
  },
  {
    id: 'frostbite-glaze',
    name: 'Frostbite Glaze',
    badgeEmoji: '🧊',
    levelRange: [19, 21],
    gradientClass: 'from-blue-600/85 via-indigo-600/85 to-slate-700/85',
    accentColor: '#60a5fa',
  },
  {
    id: 'cocoa-foundry',
    name: 'Cocoa Foundry',
    badgeEmoji: '🍫',
    levelRange: [22, 24],
    gradientClass: 'from-amber-800/90 via-orange-800/85 to-rose-900/90',
    accentColor: '#fb923c',
  },
  {
    id: 'licorice-vaults',
    name: 'Licorice Vaults',
    badgeEmoji: '🗝️',
    levelRange: [25, 27],
    gradientClass: 'from-purple-800/90 via-fuchsia-800/85 to-slate-900/90',
    accentColor: '#c084fc',
  },
  {
    id: 'starlight-citadel',
    name: 'Starlight Citadel',
    badgeEmoji: '✨',
    levelRange: [28, 30],
    gradientClass: 'from-amber-400/90 via-rose-500/90 to-purple-700/90',
    accentColor: '#fbbf24',
  },
];

// Reusable coordinate & layout composition helpers
type GridCoordTuple = readonly [number, number];

function coords(pairs: readonly GridCoordTuple[]): Array<{ r: number; c: number }> {
  return pairs.map(([r, c]) => ({ r, c }));
}

function rectCoords(
  rStart: number,
  rEndInclusive: number,
  cStart: number,
  cEndInclusive: number
): Array<{ r: number; c: number }> {
  const result: Array<{ r: number; c: number }> = [];
  for (let r = rStart; r <= rEndInclusive; r++) {
    for (let c = cStart; c <= cEndInclusive; c++) {
      result.push({ r, c });
    }
  }
  return result;
}

function cornerHoles(rows: number, cols: number, variant: 'single' | 'bevel' | 'octagon'): Array<{ r: number; c: number }> {
  const list: Array<{ r: number; c: number }> = [
    { r: 0, c: 0 },
    { r: 0, c: cols - 1 },
    { r: rows - 1, c: 0 },
    { r: rows - 1, c: cols - 1 },
  ];
  if (variant === 'bevel' || variant === 'octagon') {
    list.push(
      { r: 0, c: 1 },
      { r: 0, c: cols - 2 },
      { r: rows - 1, c: 1 },
      { r: rows - 1, c: cols - 2 }
    );
  }
  if (variant === 'octagon') {
    list.push(
      { r: 1, c: 0 },
      { r: 1, c: cols - 1 },
      { r: rows - 2, c: 0 },
      { r: rows - 2, c: cols - 1 }
    );
  }
  return list;
}

function buildJellyCells(
  positions: Array<{ r: number; c: number }>,
  layers: number
): Array<{ r: number; c: number; layers: number }> {
  return positions.map((pos) => ({ r: pos.r, c: pos.c, layers }));
}

function buildBlockerCells(
  positions: Array<{ r: number; c: number }>,
  type: Exclude<BlockerType, null>,
  health?: number
): Array<{ r: number; c: number; type: Exclude<BlockerType, null>; health?: number }> {
  return positions.map((pos) => ({
    r: pos.r,
    c: pos.c,
    type,
    ...(type === 'stone' ? {} : { health: health ?? 1 }),
  }));
}

function composeLayout(spec: {
  rows?: number;
  cols?: number;
  nonPlayableCells?: Array<{ r: number; c: number }>;
  spawnerCells?: Array<{ r: number; c: number }>;
  jellyCells?: Array<{ r: number; c: number; layers: number }>;
  blockerCells?: Array<{
    r: number;
    c: number;
    type: Exclude<BlockerType, null>;
    health?: number;
  }>;
  lockedCells?: Array<{ r: number; c: number }>;
}): BoardLayoutConfig {
  const keyOf = (p: { r: number; c: number }) => `${p.r},${p.c}`;
  const dedupeCoords = <T extends { r: number; c: number }>(items: T[] = []): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    items.forEach((item) => {
      const k = keyOf(item);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(item);
      }
    });
    return out;
  };

  const rows = spec.rows ?? 8;
  const cols = spec.cols ?? 8;
  const holes = dedupeCoords(spec.nonPlayableCells);
  const holeSet = new Set(holes.map(keyOf));

  const blockers = dedupeCoords(spec.blockerCells).filter((b) => !holeSet.has(keyOf(b)));
  const blockerSet = new Set(blockers.map(keyOf));

  const jellies = dedupeCoords(spec.jellyCells).filter((j) => !holeSet.has(keyOf(j)));
  const locked = dedupeCoords(spec.lockedCells).filter(
    (l) => !holeSet.has(keyOf(l)) && !blockerSet.has(keyOf(l))
  );

  let spawners = dedupeCoords(spec.spawnerCells).filter(
    (s) => !holeSet.has(keyOf(s)) && !blockerSet.has(keyOf(s))
  );

  // Derive explicit playable spawners automatically for irregular boards if not manually supplied
  if (spawners.length === 0 && holes.length > 0) {
    const reachable = new Set<string>();
    const queue: Array<{ r: number; c: number }> = [];
    for (let c = 0; c < cols; c++) {
      const k = `0,${c}`;
      if (!holeSet.has(k) && !blockerSet.has(k)) {
        spawners.push({ r: 0, c });
        reachable.add(k);
        queue.push({ r: 0, c });
      }
    }
    const bfs = () => {
      while (queue.length > 0) {
        const cur = queue.shift()!;
        const nextR = cur.r + 1;
        if (nextR >= rows) continue;
        for (const nextC of [cur.c, cur.c - 1, cur.c + 1]) {
          if (nextC < 0 || nextC >= cols) continue;
          const nk = `${nextR},${nextC}`;
          if (!holeSet.has(nk) && !reachable.has(nk)) {
            reachable.add(nk);
            queue.push({ r: nextR, c: nextC });
          }
        }
      }
    };
    bfs();
    for (let r = 1; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = `${r},${c}`;
        if (!holeSet.has(k) && !blockerSet.has(k) && !reachable.has(k)) {
          spawners.push({ r, c });
          reachable.add(k);
          queue.push({ r, c });
          bfs();
        }
      }
    }
  }

  return {
    ...(spec.rows !== undefined ? { rows: spec.rows } : {}),
    ...(spec.cols !== undefined ? { cols: spec.cols } : {}),
    ...(holes.length > 0 ? { nonPlayableCells: holes } : {}),
    ...(spawners.length > 0 ? { spawnerCells: spawners } : {}),
    ...(jellies.length > 0 ? { jellyCells: jellies } : {}),
    ...(blockers.length > 0 ? { blockerCells: blockers } : {}),
    ...(locked.length > 0 ? { lockedCells: locked } : {}),
  };
}

interface LevelTemplateInput {
  levelNumber: number;
  name: string;
  world: string;
  difficulty: LevelDifficulty;
  targetScore: number;
  maxMoves: number;
  goalDescription: string;
  objectives: LevelObjective[];
  starScores: [number, number, number];
  boardLayout?: BoardLayoutConfig;
  candyDistribution?: CandyDistributionConfig;
  config?: Record<string, string | number | boolean>;
  isUnlocked?: boolean;
}

function createLevelEntry(input: LevelTemplateInput): LevelInfo {
  const candyGoals = input.objectives
    .filter((o): o is Extract<LevelObjective, { type: 'collect_candy' }> => o.type === 'collect_candy')
    .map((o) => ({
      candyType: o.candyType,
      requiredCount: o.requiredCount,
    }));

  return {
    levelNumber: input.levelNumber,
    name: input.name,
    world: input.world,
    difficulty: input.difficulty,
    targetScore: input.targetScore,
    maxMoves: input.maxMoves,
    starsEarned: 0,
    highScore: 0,
    isUnlocked: input.isUnlocked ?? input.levelNumber === 1,
    goalDescription: input.goalDescription,
    goals: candyGoals,
    objectives: input.objectives,
    ...(input.boardLayout ? { boardLayout: input.boardLayout } : {}),
    ...(input.candyDistribution ? { candyDistribution: input.candyDistribution } : {}),
    starScores: input.starScores,
    ...(input.config ? { config: input.config } : {}),
  };
}

/**
 * Preserved Campaign Levels 1–15 (existing progression, moves, targets, and star thresholds retained)
 */
export const LEGACY_LEVELS_1_TO_15: LevelInfo[] = [
  createLevelEntry({
    levelNumber: 1,
    name: 'Sweet Awakening',
    world: 'Sugar Meadows',
    difficulty: 'easy',
    targetScore: 1000,
    maxMoves: 20,
    goalDescription: 'Collect 10 Strawberry Drops',
    objectives: [
      { id: 'l1-straw', type: 'collect_candy', candyType: 'strawberry_drop', requiredCount: 10 },
    ],
    starScores: [1000, 1800, 2600],
    candyDistribution: { candyPool: LEVEL1_CANDIES },
    isUnlocked: true,
    config: { tutorialLevel: true, worldIndex: 1 },
  }),
  createLevelEntry({
    levelNumber: 2,
    name: 'Berry Burst',
    world: 'Sugar Meadows',
    difficulty: 'easy',
    targetScore: 2000,
    maxMoves: 22,
    goalDescription: 'Collect 14 Strawberry & 14 Blueberry',
    objectives: [
      { id: 'l2-straw', type: 'collect_candy', candyType: 'strawberry_drop', requiredCount: 14 },
      { id: 'l2-blue', type: 'collect_candy', candyType: 'blueberry_oval', requiredCount: 14 },
    ],
    starScores: [2000, 3200, 4500],
    config: { worldIndex: 1 },
  }),
  createLevelEntry({
    levelNumber: 3,
    name: 'Citrus Twist',
    world: 'Sugar Meadows',
    difficulty: 'easy',
    targetScore: 3000,
    maxMoves: 22,
    goalDescription: 'Collect 18 Citrus & 18 Lemon Stars',
    objectives: [
      { id: 'l3-citrus', type: 'collect_candy', candyType: 'citrus_ring', requiredCount: 18 },
      { id: 'l3-lemon', type: 'collect_candy', candyType: 'star_lemon', requiredCount: 18 },
    ],
    starScores: [3000, 4600, 6200],
    config: { worldIndex: 1 },
  }),
  createLevelEntry({
    levelNumber: 4,
    name: 'Jelly Lagoon',
    world: 'Jelly Valley',
    difficulty: 'easy',
    targetScore: 3500,
    maxMoves: 24,
    goalDescription: 'Clear 12 Jelly tiles',
    objectives: [{ id: 'l4-jelly', type: 'clear_jelly', requiredCount: 12 }],
    starScores: [3500, 5200, 7000],
    boardLayout: composeLayout({
      jellyCells: buildJellyCells(rectCoords(2, 5, 2, 4), 1),
    }),
    config: { introducesMechanic: 'jelly', worldIndex: 2 },
  }),
  createLevelEntry({
    levelNumber: 5,
    name: 'Spearmint Surge',
    world: 'Jelly Valley',
    difficulty: 'medium',
    targetScore: 4200,
    maxMoves: 24,
    goalDescription: 'Clear 16 Jelly & Collect 18 Mint',
    objectives: [
      { id: 'l5-jelly', type: 'clear_jelly', requiredCount: 16 },
      { id: 'l5-mint', type: 'collect_candy', candyType: 'mint_emerald', requiredCount: 18 },
    ],
    starScores: [4200, 6200, 8200],
    boardLayout: composeLayout({
      jellyCells: buildJellyCells(rectCoords(2, 5, 2, 5), 1),
    }),
    config: { worldIndex: 2 },
  }),
  createLevelEntry({
    levelNumber: 6,
    name: 'Frosting Maze',
    world: 'Jelly Valley',
    difficulty: 'medium',
    targetScore: 4800,
    maxMoves: 25,
    goalDescription: 'Break 8 Frosting & Collect 20 Lemon',
    objectives: [
      { id: 'l6-frost', type: 'break_blocker', blockerType: 'frosting', requiredCount: 8 },
      { id: 'l6-lemon', type: 'collect_candy', candyType: 'star_lemon', requiredCount: 20 },
    ],
    starScores: [4800, 7000, 9200],
    boardLayout: composeLayout({
      nonPlayableCells: cornerHoles(8, 8, 'single'),
      blockerCells: buildBlockerCells(
        coords([
          [3, 2], [3, 3], [3, 4], [3, 5],
          [4, 2], [4, 3], [4, 4], [4, 5],
        ]),
        'frosting',
        1
      ),
    }),
    config: { introducesMechanic: 'frosting', worldIndex: 2 },
  }),
  createLevelEntry({
    levelNumber: 7,
    name: 'Sugar Cascade',
    world: 'Caramel Creek',
    difficulty: 'medium',
    targetScore: 5500,
    maxMoves: 25,
    goalDescription: 'Clear 16 Jelly & Free Locked Candies',
    objectives: [
      { id: 'l7-jelly', type: 'clear_jelly', requiredCount: 16 },
      { id: 'l7-plum', type: 'collect_candy', candyType: 'plum_heart', requiredCount: 22 },
    ],
    starScores: [5500, 8000, 10500],
    boardLayout: composeLayout({
      jellyCells: buildJellyCells(rectCoords(2, 5, 2, 5), 1),
      lockedCells: coords([
        [2, 2], [2, 5], [5, 2], [5, 5],
      ]),
    }),
    config: { introducesMechanic: 'locked_candy', worldIndex: 3 },
  }),
  createLevelEntry({
    levelNumber: 8,
    name: 'Caramel Crunch',
    world: 'Caramel Creek',
    difficulty: 'medium',
    targetScore: 6200,
    maxMoves: 26,
    goalDescription: 'Break 6 Frosting & 6 Chocolate',
    objectives: [
      { id: 'l8-frost', type: 'break_blocker', blockerType: 'frosting', requiredCount: 6 },
      { id: 'l8-choc', type: 'break_blocker', blockerType: 'chocolate', requiredCount: 6 },
    ],
    starScores: [6200, 8800, 11500],
    boardLayout: composeLayout({
      blockerCells: [
        ...buildBlockerCells(
          coords([[2, 2], [2, 3], [2, 4], [5, 3], [5, 4], [5, 5]]),
          'frosting',
          1
        ),
        ...buildBlockerCells(
          coords([[3, 2], [3, 5], [4, 2], [4, 5], [3, 3], [4, 4]]),
          'chocolate',
          1
        ),
      ],
    }),
    config: { introducesMechanic: 'chocolate', worldIndex: 3 },
  }),
  createLevelEntry({
    levelNumber: 9,
    name: 'Gumdrop Glaze',
    world: 'Caramel Creek',
    difficulty: 'medium',
    targetScore: 6800,
    maxMoves: 26,
    goalDescription: 'Clear 14 Double-Layer Jelly',
    objectives: [
      { id: 'l9-jelly', type: 'clear_jelly', requiredCount: 14 },
      { id: 'l9-blue', type: 'collect_candy', candyType: 'blueberry_oval', requiredCount: 24 },
    ],
    starScores: [6800, 9600, 12500],
    boardLayout: composeLayout({
      nonPlayableCells: cornerHoles(8, 8, 'single'),
      jellyCells: [
        ...buildJellyCells(rectCoords(2, 5, 2, 4), 2),
        ...buildJellyCells(coords([[3, 5], [4, 5]]), 2),
      ],
    }),
    config: { introducesMechanic: 'double_jelly', worldIndex: 3 },
  }),
  createLevelEntry({
    levelNumber: 10,
    name: 'Midnight Licorice',
    world: 'Frosting Peaks',
    difficulty: 'hard',
    targetScore: 7500,
    maxMoves: 26,
    goalDescription: 'Break 8 Licorice & Trigger 2 Striped',
    objectives: [
      { id: 'l10-lic', type: 'break_blocker', blockerType: 'licorice', requiredCount: 8 },
      { id: 'l10-str', type: 'collect_special', specialType: 'striped', requiredCount: 2 },
    ],
    starScores: [7500, 10500, 13800],
    boardLayout: composeLayout({
      blockerCells: buildBlockerCells(
        coords([
          [2, 1], [2, 6], [3, 2], [3, 5],
          [4, 2], [4, 5], [5, 1], [5, 6],
        ]),
        'licorice',
        1
      ),
      lockedCells: coords([[3, 3], [3, 4], [4, 3], [4, 4]]),
    }),
    config: { introducesMechanic: 'licorice', worldIndex: 4 },
  }),
  createLevelEntry({
    levelNumber: 11,
    name: 'Emerald Vault',
    world: 'Frosting Peaks',
    difficulty: 'hard',
    targetScore: 8200,
    maxMoves: 28,
    goalDescription: 'Clear 12 Jelly & Break 6 Frosting',
    objectives: [
      { id: 'l11-jelly', type: 'clear_jelly', requiredCount: 12 },
      { id: 'l11-frost', type: 'break_blocker', blockerType: 'frosting', requiredCount: 6 },
    ],
    starScores: [8200, 11400, 14800],
    boardLayout: composeLayout({
      jellyCells: buildJellyCells(rectCoords(2, 4, 2, 5), 2),
      blockerCells: [
        ...buildBlockerCells(coords([[1, 2], [1, 5], [6, 2], [6, 5]]), 'stone'),
        ...buildBlockerCells(coords([[5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [5, 6]]), 'frosting', 2),
      ],
    }),
    config: { introducesMechanic: 'stone_pillar', worldIndex: 4 },
  }),
  createLevelEntry({
    levelNumber: 12,
    name: 'Prism Core',
    world: 'Frosting Peaks',
    difficulty: 'hard',
    targetScore: 9000,
    maxMoves: 28,
    goalDescription: 'Trigger 2 Wrapped & Collect 26 Strawberries',
    objectives: [
      { id: 'l12-wrap', type: 'collect_special', specialType: 'wrapped', requiredCount: 2 },
      { id: 'l12-straw', type: 'collect_candy', candyType: 'strawberry_drop', requiredCount: 26 },
    ],
    starScores: [9000, 12500, 16000],
    boardLayout: composeLayout({
      nonPlayableCells: cornerHoles(8, 8, 'bevel'),
      lockedCells: coords([[2, 3], [2, 4], [5, 3], [5, 4]]),
      jellyCells: buildJellyCells(coords([[3, 3], [3, 4], [4, 3], [4, 4]]), 2),
    }),
    config: { worldIndex: 4 },
  }),
  createLevelEntry({
    levelNumber: 13,
    name: 'Royal Frosting',
    world: 'Candy Castle',
    difficulty: 'hard',
    targetScore: 9800,
    maxMoves: 28,
    goalDescription: 'Clear 14 Jelly & Break 8 Frosting',
    objectives: [
      { id: 'l13-jelly', type: 'clear_jelly', requiredCount: 14 },
      { id: 'l13-frost', type: 'break_blocker', blockerType: 'frosting', requiredCount: 8 },
    ],
    starScores: [9800, 13600, 17500],
    boardLayout: composeLayout({
      nonPlayableCells: cornerHoles(8, 8, 'single'),
      jellyCells: [
        ...buildJellyCells(rectCoords(2, 5, 2, 4), 2),
        ...buildJellyCells(coords([[3, 5], [4, 5]]), 2),
      ],
      blockerCells: buildBlockerCells(
        coords([[1, 2], [1, 5], [2, 1], [2, 6], [5, 1], [5, 6], [6, 2], [6, 5]]),
        'frosting',
        2
      ),
    }),
    config: { worldIndex: 5 },
  }),
  createLevelEntry({
    levelNumber: 14,
    name: 'Velvet Citadel',
    world: 'Candy Castle',
    difficulty: 'expert',
    targetScore: 10800,
    maxMoves: 30,
    goalDescription: 'Break 8 Chocolate & Score 10,800',
    objectives: [
      { id: 'l14-choc', type: 'break_blocker', blockerType: 'chocolate', requiredCount: 8 },
      { id: 'l14-score', type: 'reach_score', targetScore: 10800 },
    ],
    starScores: [10800, 14800, 19000],
    boardLayout: composeLayout({
      blockerCells: [
        ...buildBlockerCells(coords([[2, 2], [2, 5], [5, 2], [5, 5]]), 'stone'),
        ...buildBlockerCells(
          coords([[3, 1], [3, 6], [4, 1], [4, 6], [1, 3], [1, 4], [6, 3], [6, 4]]),
          'chocolate',
          2
        ),
      ],
      lockedCells: coords([[3, 3], [3, 4], [4, 3], [4, 4]]),
    }),
    config: { worldIndex: 5 },
  }),
  createLevelEntry({
    levelNumber: 15,
    name: 'Sugar King Crown',
    world: 'Candy Castle',
    difficulty: 'expert',
    targetScore: 12000,
    maxMoves: 30,
    goalDescription: 'Clear 16 Jelly, Break 6 Licorice & 3 Specials',
    objectives: [
      { id: 'l15-jelly', type: 'clear_jelly', requiredCount: 16 },
      { id: 'l15-lic', type: 'break_blocker', blockerType: 'licorice', requiredCount: 6 },
      { id: 'l15-spec', type: 'collect_special', specialType: 'any', requiredCount: 3 },
    ],
    starScores: [12000, 16500, 21000],
    boardLayout: composeLayout({
      nonPlayableCells: cornerHoles(8, 8, 'bevel'),
      jellyCells: buildJellyCells(rectCoords(2, 5, 2, 5), 2),
      blockerCells: [
        ...buildBlockerCells(coords([[1, 2], [1, 5]]), 'stone'),
        ...buildBlockerCells(coords([[2, 1], [3, 1], [4, 1], [2, 6], [3, 6], [4, 6]]), 'licorice', 2),
      ],
      lockedCells: coords([[5, 2], [5, 5]]),
    }),
    config: { bossLevel: true, worldIndex: 5 },
  }),
];

/**
 * Campaign Expansion Levels 16–30
 */
export const EXPANSION_LEVELS_16_TO_30: LevelInfo[] = [
  createLevelEntry({
    levelNumber: 16,
    name: 'Crystal Gate',
    world: 'Crystal Hollows',
    difficulty: 'medium',
    targetScore: 12500,
    maxMoves: 26,
    goalDescription: 'Clear 14 Jelly & Break 6 Frosting',
    objectives: [
      { id: 'l16-jelly', type: 'clear_jelly', requiredCount: 14 },
      { id: 'l16-frost', type: 'break_blocker', blockerType: 'frosting', requiredCount: 6 },
    ],
    starScores: [12500, 17000, 21800],
    boardLayout: composeLayout({
      nonPlayableCells: cornerHoles(8, 8, 'bevel'),
      jellyCells: [
        ...buildJellyCells(rectCoords(2, 5, 2, 4), 1),
        ...buildJellyCells(coords([[3, 5], [4, 5]]), 1),
      ],
      blockerCells: buildBlockerCells(
        coords([[1, 3], [1, 4], [3, 1], [4, 1], [6, 3], [6, 4]]),
        'frosting',
        1
      ),
    }),
    config: { layoutStyle: 'crystal_gate', worldIndex: 6 },
  }),
  createLevelEntry({
    levelNumber: 17,
    name: 'Prism Well',
    world: 'Crystal Hollows',
    difficulty: 'medium',
    targetScore: 13200,
    maxMoves: 25,
    goalDescription: 'Clear 12 Double-Jelly & Collect 24 Blueberries',
    objectives: [
      { id: 'l17-jelly', type: 'clear_jelly', requiredCount: 12 },
      { id: 'l17-blue', type: 'collect_candy', candyType: 'blueberry_oval', requiredCount: 24 },
    ],
    starScores: [13200, 18000, 23000],
    boardLayout: composeLayout({
      rows: 7,
      cols: 8,
      nonPlayableCells: coords([[3, 3], [3, 4], [0, 0], [0, 7], [6, 0], [6, 7]]),
      spawnerCells: coords([[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]]),
      jellyCells: buildJellyCells(
        coords([
          [1, 2], [1, 3], [1, 4], [1, 5],
          [2, 2], [2, 5],
          [4, 2], [4, 5],
          [5, 2], [5, 3], [5, 4], [5, 5],
        ]),
        2
      ),
    }),
    config: { layoutStyle: 'central_moat_7x8', worldIndex: 6 },
  }),
  createLevelEntry({
    levelNumber: 18,
    name: 'Amethyst Arch',
    world: 'Crystal Hollows',
    difficulty: 'hard',
    targetScore: 14200,
    maxMoves: 28,
    goalDescription: 'Clear 16 Jelly & Break 8 Reinforced Frosting',
    objectives: [
      { id: 'l18-jelly', type: 'clear_jelly', requiredCount: 16 },
      { id: 'l18-frost', type: 'break_blocker', blockerType: 'frosting', requiredCount: 8 },
    ],
    starScores: [14200, 19500, 24800],
    boardLayout: composeLayout({
      nonPlayableCells: coords([[0, 0], [0, 7], [7, 0], [7, 7], [3, 3], [3, 4]]),
      jellyCells: [
        ...buildJellyCells(rectCoords(1, 2, 2, 5), 1),
        ...buildJellyCells(rectCoords(4, 5, 2, 5), 2),
      ],
      blockerCells: buildBlockerCells(
        coords([[2, 1], [3, 1], [4, 1], [5, 1], [2, 6], [3, 6], [4, 6], [5, 6]]),
        'frosting',
        2
      ),
    }),
    config: { layoutStyle: 'arch_cutout', worldIndex: 6 },
  }),
  createLevelEntry({
    levelNumber: 19,
    name: 'Frozen Bridge',
    world: 'Frostbite Glaze',
    difficulty: 'medium',
    targetScore: 14800,
    maxMoves: 25,
    goalDescription: 'Clear 12 Double-Jelly & Collect 26 Mint',
    objectives: [
      { id: 'l19-jelly', type: 'clear_jelly', requiredCount: 12 },
      { id: 'l19-mint', type: 'collect_candy', candyType: 'mint_emerald', requiredCount: 26 },
    ],
    starScores: [14800, 20200, 25800],
    boardLayout: composeLayout({
      rows: 7,
      cols: 7,
      nonPlayableCells: coords([[2, 0], [2, 6], [4, 0], [4, 6]]),
      jellyCells: buildJellyCells(rectCoords(2, 4, 1, 4), 2),
      lockedCells: coords([[1, 1], [1, 5], [5, 1], [5, 5], [3, 1], [3, 5]]),
    }),
    config: { layoutStyle: 'bridge_7x7', worldIndex: 7 },
  }),
  createLevelEntry({
    levelNumber: 20,
    name: 'Glacier Steps',
    world: 'Frostbite Glaze',
    difficulty: 'hard',
    targetScore: 15600,
    maxMoves: 28,
    goalDescription: 'Clear 10 Jelly, Break 8 Frosting & 2 Striped',
    objectives: [
      { id: 'l20-jelly', type: 'clear_jelly', requiredCount: 10 },
      { id: 'l20-frost', type: 'break_blocker', blockerType: 'frosting', requiredCount: 8 },
      { id: 'l20-str', type: 'collect_special', specialType: 'striped', requiredCount: 2 },
    ],
    starScores: [15600, 21200, 27000],
    boardLayout: composeLayout({
      nonPlayableCells: cornerHoles(8, 8, 'bevel'),
      jellyCells: buildJellyCells(
        coords([
          [2, 2], [2, 5], [3, 2], [3, 3], [3, 4], [3, 5],
          [4, 2], [4, 3], [4, 4], [4, 5],
        ]),
        2
      ),
      blockerCells: buildBlockerCells(
        coords([[1, 2], [1, 5], [2, 1], [2, 6], [5, 1], [5, 6], [6, 2], [6, 5]]),
        'frosting',
        2
      ),
      lockedCells: coords([[5, 3], [5, 4]]),
    }),
    config: { worldIndex: 7 },
  }),
  createLevelEntry({
    levelNumber: 21,
    name: 'Permafrost Core',
    world: 'Frostbite Glaze',
    difficulty: 'hard',
    targetScore: 16500,
    maxMoves: 26,
    goalDescription: 'Break 8 Frosting, Trigger 3 Striped & Score 16,500',
    objectives: [
      { id: 'l21-frost', type: 'break_blocker', blockerType: 'frosting', requiredCount: 8 },
      { id: 'l21-str', type: 'collect_special', specialType: 'striped', requiredCount: 3 },
      { id: 'l21-score', type: 'reach_score', targetScore: 16500 },
    ],
    starScores: [16500, 22400, 28500],
    candyDistribution: { candyPool: LEVEL1_CANDIES },
    boardLayout: composeLayout({
      rows: 7,
      cols: 7,
      blockerCells: [
        ...buildBlockerCells(coords([[3, 2], [3, 4]]), 'stone'),
        ...buildBlockerCells(
          coords([[1, 2], [1, 4], [2, 1], [2, 5], [4, 1], [4, 5], [5, 2], [5, 4]]),
          'frosting',
          2
        ),
      ],
      lockedCells: coords([[0, 3], [3, 0], [3, 6], [6, 3]]),
    }),
    config: { compactFiveCandy: true, worldIndex: 7 },
  }),
  createLevelEntry({
    levelNumber: 22,
    name: 'Truffle Vat',
    world: 'Cocoa Foundry',
    difficulty: 'medium',
    targetScore: 17200,
    maxMoves: 28,
    goalDescription: 'Break 12 Chocolate & Clear 12 Jelly',
    objectives: [
      { id: 'l22-choc', type: 'break_blocker', blockerType: 'chocolate', requiredCount: 12 },
      { id: 'l22-jelly', type: 'clear_jelly', requiredCount: 12 },
    ],
    starScores: [17200, 23200, 29500],
    boardLayout: composeLayout({
      jellyCells: buildJellyCells(rectCoords(2, 5, 2, 4), 1),
      blockerCells: [
        ...buildBlockerCells(
          coords([[1, 2], [1, 3], [1, 4], [1, 5], [6, 2], [6, 3], [6, 4], [6, 5]]),
          'chocolate',
          1
        ),
        ...buildBlockerCells(coords([[2, 1], [5, 1], [2, 6], [5, 6]]), 'chocolate', 2),
      ],
    }),
    config: { worldIndex: 8 },
  }),
  createLevelEntry({
    levelNumber: 23,
    name: 'Molten Press',
    world: 'Cocoa Foundry',
    difficulty: 'hard',
    targetScore: 18000,
    maxMoves: 28,
    goalDescription: 'Break 8 Chocolate, Trigger 2 Wrapped & Collect 28 Plum',
    objectives: [
      { id: 'l23-choc', type: 'break_blocker', blockerType: 'chocolate', requiredCount: 8 },
      { id: 'l23-wrap', type: 'collect_special', specialType: 'wrapped', requiredCount: 2 },
      { id: 'l23-plum', type: 'collect_candy', candyType: 'plum_heart', requiredCount: 28 },
    ],
    starScores: [18000, 24500, 31000],
    boardLayout: composeLayout({
      rows: 8,
      cols: 7,
      nonPlayableCells: coords([[0, 0], [0, 6], [7, 0], [7, 6]]),
      blockerCells: [
        ...buildBlockerCells(coords([[3, 3], [4, 3]]), 'stone'),
        ...buildBlockerCells(
          coords([[2, 1], [2, 5], [3, 1], [3, 5], [4, 1], [4, 5], [5, 1], [5, 5]]),
          'chocolate',
          2
        ),
      ],
      lockedCells: coords([[1, 2], [1, 4], [6, 2], [6, 4]]),
    }),
    config: { layoutStyle: 'vertical_chute_8x7', worldIndex: 8 },
  }),
  createLevelEntry({
    levelNumber: 24,
    name: 'Fudge Crucible',
    world: 'Cocoa Foundry',
    difficulty: 'hard',
    targetScore: 19000,
    maxMoves: 30,
    goalDescription: 'Clear 12 Double-Jelly, Break 10 Chocolate & Score 19,000',
    objectives: [
      { id: 'l24-jelly', type: 'clear_jelly', requiredCount: 12 },
      { id: 'l24-choc', type: 'break_blocker', blockerType: 'chocolate', requiredCount: 10 },
      { id: 'l24-score', type: 'reach_score', targetScore: 19000 },
    ],
    starScores: [19000, 25800, 32600],
    boardLayout: composeLayout({
      nonPlayableCells: cornerHoles(8, 8, 'octagon'),
      jellyCells: buildJellyCells(rectCoords(2, 5, 2, 4), 2),
      blockerCells: buildBlockerCells(
        coords([
          [1, 3], [1, 4], [2, 1], [2, 6],
          [5, 1], [5, 6], [6, 3], [6, 4],
          [3, 5], [4, 5],
        ]),
        'chocolate',
        2
      ),
    }),
    config: { layoutStyle: 'octagon_crucible', worldIndex: 8 },
  }),
  createLevelEntry({
    levelNumber: 25,
    name: 'Blackberry Lock',
    world: 'Licorice Vaults',
    difficulty: 'hard',
    targetScore: 19800,
    maxMoves: 28,
    goalDescription: 'Break 10 Licorice & Clear 12 Jelly',
    objectives: [
      { id: 'l25-lic', type: 'break_blocker', blockerType: 'licorice', requiredCount: 10 },
      { id: 'l25-jelly', type: 'clear_jelly', requiredCount: 12 },
    ],
    starScores: [19800, 26800, 33800],
    boardLayout: composeLayout({
      jellyCells: buildJellyCells(rectCoords(2, 4, 2, 5), 1),
      blockerCells: buildBlockerCells(
        coords([
          [1, 1], [1, 6], [2, 1], [2, 6],
          [5, 2], [5, 3], [5, 4], [5, 5],
          [6, 1], [6, 6],
        ]),
        'licorice',
        1
      ),
      lockedCells: coords([[3, 2], [3, 5], [4, 2], [4, 5]]),
    }),
    config: { worldIndex: 9 },
  }),
  createLevelEntry({
    levelNumber: 26,
    name: 'Onyx Lattice',
    world: 'Licorice Vaults',
    difficulty: 'hard',
    targetScore: 20600,
    maxMoves: 28,
    goalDescription: 'Clear 10 Double-Jelly, Break 8 Licorice & 30 Citrus',
    objectives: [
      { id: 'l26-jelly', type: 'clear_jelly', requiredCount: 10 },
      { id: 'l26-lic', type: 'break_blocker', blockerType: 'licorice', requiredCount: 8 },
      { id: 'l26-citrus', type: 'collect_candy', candyType: 'citrus_ring', requiredCount: 30 },
    ],
    starScores: [20600, 27800, 35200],
    boardLayout: composeLayout({
      rows: 7,
      cols: 8,
      jellyCells: buildJellyCells(
        coords([
          [2, 2], [2, 3], [2, 4], [2, 5],
          [3, 3], [3, 4],
          [4, 2], [4, 3], [4, 4], [4, 5],
        ]),
        2
      ),
      blockerCells: [
        ...buildBlockerCells(coords([[1, 2], [1, 5], [5, 2], [5, 5]]), 'stone'),
        ...buildBlockerCells(
          coords([[1, 1], [1, 6], [3, 1], [3, 6], [5, 1], [5, 6], [0, 3], [6, 4]]),
          'licorice',
          2
        ),
      ],
    }),
    config: { layoutStyle: 'lattice_7x8', worldIndex: 9 },
  }),
  createLevelEntry({
    levelNumber: 27,
    name: 'Vault Chamber',
    world: 'Licorice Vaults',
    difficulty: 'expert',
    targetScore: 21500,
    maxMoves: 30,
    goalDescription: 'Break 6 Licorice, 6 Frosting & 4 Specials',
    objectives: [
      { id: 'l27-lic', type: 'break_blocker', blockerType: 'licorice', requiredCount: 6 },
      { id: 'l27-frost', type: 'break_blocker', blockerType: 'frosting', requiredCount: 6 },
      { id: 'l27-spec', type: 'collect_special', specialType: 'any', requiredCount: 4 },
    ],
    starScores: [21500, 29000, 36800],
    boardLayout: composeLayout({
      rows: 8,
      cols: 7,
      nonPlayableCells: cornerHoles(8, 7, 'single'),
      blockerCells: [
        ...buildBlockerCells(coords([[2, 1], [2, 5], [3, 1], [3, 5], [5, 2], [5, 4]]), 'licorice', 2),
        ...buildBlockerCells(coords([[1, 2], [1, 4], [4, 1], [4, 5], [6, 2], [6, 4]]), 'frosting', 2),
      ],
      lockedCells: coords([[3, 3], [4, 3], [2, 3], [5, 3]]),
    }),
    config: { layoutStyle: 'vault_8x7', worldIndex: 9 },
  }),
  createLevelEntry({
    levelNumber: 28,
    name: 'Nebula Spire',
    world: 'Starlight Citadel',
    difficulty: 'expert',
    targetScore: 22500,
    maxMoves: 30,
    goalDescription: 'Clear 14 Double-Jelly & Trigger 1 Color Bomb',
    objectives: [
      { id: 'l28-jelly', type: 'clear_jelly', requiredCount: 14 },
      { id: 'l28-cb', type: 'collect_special', specialType: 'color_bomb', requiredCount: 1 },
      { id: 'l28-score', type: 'reach_score', targetScore: 22500 },
    ],
    starScores: [22500, 30500, 38500],
    candyDistribution: {
      candyPool: LEVEL1_CANDIES,
      weights: {
        star_lemon: 1.3,
        strawberry_drop: 1.2,
        citrus_ring: 1,
        mint_emerald: 1,
        blueberry_oval: 1,
      },
    },
    boardLayout: composeLayout({
      nonPlayableCells: cornerHoles(8, 8, 'octagon'),
      jellyCells: [
        ...buildJellyCells(rectCoords(2, 5, 2, 4), 2),
        ...buildJellyCells(coords([[3, 5], [4, 5]]), 2),
      ],
      lockedCells: coords([[1, 3], [1, 4], [6, 3], [6, 4]]),
    }),
    config: { layoutStyle: 'octagon_spire', worldIndex: 10 },
  }),
  createLevelEntry({
    levelNumber: 29,
    name: 'Celestial Bastion',
    world: 'Starlight Citadel',
    difficulty: 'expert',
    targetScore: 24000,
    maxMoves: 32,
    goalDescription: 'Clear 12 Double-Jelly, Break 6 Choc & 6 Licorice',
    objectives: [
      { id: 'l29-jelly', type: 'clear_jelly', requiredCount: 12 },
      { id: 'l29-choc', type: 'break_blocker', blockerType: 'chocolate', requiredCount: 6 },
      { id: 'l29-lic', type: 'break_blocker', blockerType: 'licorice', requiredCount: 6 },
    ],
    starScores: [24000, 32500, 41000],
    boardLayout: composeLayout({
      jellyCells: buildJellyCells(rectCoords(2, 5, 2, 4), 2),
      blockerCells: [
        ...buildBlockerCells(coords([[1, 2], [1, 5], [6, 2], [6, 5]]), 'stone'),
        ...buildBlockerCells(coords([[2, 1], [3, 1], [4, 1], [5, 1], [1, 3], [1, 4]]), 'chocolate', 2),
        ...buildBlockerCells(coords([[2, 6], [3, 6], [4, 6], [5, 6], [6, 3], [6, 4]]), 'licorice', 2),
      ],
    }),
    config: { worldIndex: 10 },
  }),
  createLevelEntry({
    levelNumber: 30,
    name: 'Crown Finale',
    world: 'Starlight Citadel',
    difficulty: 'expert',
    targetScore: 26000,
    maxMoves: 34,
    goalDescription: 'Clear 16 Double-Jelly, Break 6 Chocolate & 5 Specials',
    objectives: [
      { id: 'l30-jelly', type: 'clear_jelly', requiredCount: 16 },
      { id: 'l30-choc', type: 'break_blocker', blockerType: 'chocolate', requiredCount: 6 },
      { id: 'l30-spec', type: 'collect_special', specialType: 'any', requiredCount: 5 },
      { id: 'l30-score', type: 'reach_score', targetScore: 26000 },
    ],
    starScores: [26000, 35000, 44500],
    boardLayout: composeLayout({
      nonPlayableCells: cornerHoles(8, 8, 'bevel'),
      jellyCells: buildJellyCells(rectCoords(2, 5, 2, 5), 2),
      blockerCells: [
        ...buildBlockerCells(coords([[1, 2], [1, 5]]), 'stone'),
        ...buildBlockerCells(coords([[2, 1], [3, 1], [4, 1], [2, 6], [3, 6], [4, 6]]), 'chocolate', 2),
        ...buildBlockerCells(coords([[6, 2], [6, 3], [6, 4], [6, 5]]), 'frosting', 2),
      ],
      lockedCells: coords([[5, 1], [5, 6]]),
    }),
    config: { finaleBossLevel: true, worldIndex: 10 },
  }),
];

export const CAMPAIGN_LEVELS: LevelInfo[] = [
  ...LEGACY_LEVELS_1_TO_15,
  ...EXPANSION_LEVELS_16_TO_30,
];

// Export alias preserving backward compatibility for storage & initialization
export const INITIAL_LEVELS: LevelInfo[] = CAMPAIGN_LEVELS;

export function getLevelDefinition(levelNumber: number): LevelInfo | undefined {
  return CAMPAIGN_LEVELS.find((lvl) => lvl.levelNumber === levelNumber);
}

export function getCampaignWorlds(): WorldDefinition[] {
  return WORLD_DEFINITIONS;
}

export function getWorldForLevel(levelNumber: number): WorldDefinition | undefined {
  return WORLD_DEFINITIONS.find(
    (world) => levelNumber >= world.levelRange[0] && levelNumber <= world.levelRange[1]
  );
}

export function resolveActiveCampaignLevel(
  levels: LevelInfo[],
  highestUnlockedLevel?: number,
  fallbackLevelNumber?: number
): LevelInfo | undefined {
  if (levels.length === 0) {
    return typeof fallbackLevelNumber === 'number'
      ? getLevelDefinition(fallbackLevelNumber)
      : CAMPAIGN_LEVELS[0];
  }

  const ordered = [...levels].sort((a, b) => a.levelNumber - b.levelNumber);
  const nextIncomplete = ordered.find((l) => l.isUnlocked && (l.starsEarned || 0) === 0);
  if (nextIncomplete) return nextIncomplete;

  if (typeof highestUnlockedLevel === 'number') {
    const highest = ordered.find((l) => l.levelNumber === highestUnlockedLevel && l.isUnlocked);
    if (highest) return highest;
  }

  if (typeof fallbackLevelNumber === 'number') {
    const fallback = ordered.find((l) => l.levelNumber === fallbackLevelNumber && l.isUnlocked);
    if (fallback) return fallback;
  }

  const unlocked = ordered.filter((l) => l.isUnlocked);
  if (unlocked.length > 0) return unlocked[unlocked.length - 1];

  return ordered[0];
}

export function getDefaultCandyPool(): CandyShape[] {
  return [...ALL_CANDIES];
}
