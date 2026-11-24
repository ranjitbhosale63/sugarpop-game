import {
  BlockerType,
  BoardCell,
  BoardGrid,
  BoardLayoutConfig,
  Candy,
  CandyDistributionConfig,
  CandyShape,
  LevelGoal,
  LevelInfo,
  LevelObjective,
  PreGameBoosterType,
  SpecialCandyType,
} from '../types/game';

export const ROWS = 8;
export const COLS = 8;

export function getGridDimensions(grid: BoardGrid): { rows: number; cols: number } {
  const rows = grid.length > 0 ? grid.length : ROWS;
  const cols = grid[0]?.length ? grid[0].length : COLS;
  return { rows, cols };
}

/**
 * Deterministic Mulberry32 PRNG for reproducible seeded board generation and simulation tests.
 */
export function createSeededRng(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Candy pool for Level 1 (5 types) and subsequent levels (6 types)
export const LEVEL1_CANDIES: CandyShape[] = [
  'strawberry_drop',
  'citrus_ring',
  'star_lemon',
  'mint_emerald',
  'blueberry_oval',
];

export const ALL_CANDIES: CandyShape[] = [
  'strawberry_drop',
  'citrus_ring',
  'star_lemon',
  'mint_emerald',
  'blueberry_oval',
  'plum_heart',
];

export interface CellCoord {
  r: number;
  c: number;
}

export type MatchPatternType =
  | 'NORMAL_MATCH'
  | 'STRIPED_MATCH'
  | 'WRAPPED_MATCH'
  | 'COLOR_BOMB_MATCH';

export type MatchOrientation = 'horizontal' | 'vertical' | null;

export interface MatchGroup {
  cells: CellCoord[];
  length: number;
  orientation: 'horizontal' | 'vertical';
  color: CandyShape;
}

export interface MatchCluster {
  id: string;
  color: CandyShape;
  cells: CellCoord[];
  patternType: MatchPatternType;
  orientation: MatchOrientation;
  spawnPosition: CellCoord | null;
  runs: MatchGroup[];
}

export interface MatchDetectionOptions {
  swapDestination?: CellCoord | null;
  swapOrigin?: CellCoord | null;
}

export interface MatchResult {
  matchedSet: Set<string>;
  matchGroups: MatchGroup[];
  clusters: MatchCluster[];
}

export interface SpecialSpawn {
  coord: CellCoord;
  candy: Candy;
}

export interface MatchResolutionResult {
  cellsToClear: Set<string>;
  gridWithSpawns: BoardGrid;
  specialSpawns: SpecialSpawn[];
}

export interface ColorBombTrigger {
  bombCoord: CellCoord;
  targetColor: CandyShape;
}

export type SpecialComboType =
  | 'STRIPED_STRIPED'
  | 'STRIPED_WRAPPED'
  | 'WRAPPED_WRAPPED'
  | 'COLOR_BOMB_STRIPED'
  | 'COLOR_BOMB_WRAPPED'
  | 'COLOR_BOMB_COLOR_BOMB';

export interface SpecialComboTrigger {
  comboType: SpecialComboType;
  centerCoord: CellCoord;
  originCoord: CellCoord;
  targetColor?: CandyShape;
}

export interface SpecialActivationEvent {
  coord: CellCoord;
  special: Exclude<SpecialCandyType, null> | SpecialComboType;
  color: CandyShape;
  targetColor?: CandyShape;
  affectedCells: CellCoord[];
}

export interface ActivationResolutionOptions {
  protectedKeys?: Set<string>;
  colorBombTrigger?: ColorBombTrigger | null;
  specialComboTrigger?: SpecialComboTrigger | null;
  initialMatchedSet?: Set<string>;
}

export interface ActivationResolutionResult {
  allClearedCells: Set<string>;
  specialHitCells: Set<string>;
  consumedSpecials: Array<Exclude<SpecialCandyType, null>>;
  activationEvents: SpecialActivationEvent[];
  resolvedGrid: BoardGrid;
}

export interface ObstacleUpdateResult {
  updatedGrid: BoardGrid;
  candiesToRemove: Set<string>;
  unlockedCells: CellCoord[];
  damagedBlockers: Array<{
    coord: CellCoord;
    type: Exclude<BlockerType, null>;
    remainingHealth: number;
  }>;
  brokenBlockers: Array<{
    coord: CellCoord;
    type: Exclude<BlockerType, null>;
  }>;
  jellyReducedCells: CellCoord[];
  clearedJellyCount: number;
  blockerBrokenCounts: Record<string, number>;
}

export interface BoardObstacleSummary {
  totalJellyCells: number;
  blockerCounts: Record<string, number>;
  lockedCount: number;
  nonPlayableCount: number;
}

export interface ObjectiveProgressState {
  candyCounts: Record<string, number>;
  jellyCleared: number;
  blockerBrokenCounts: Record<string, number>;
  specialCounts: Record<string, number>;
  score: number;
}

export interface ResolvedObjective {
  key: string;
  objective: LevelObjective;
  current: number;
  target: number;
  remaining: number;
  isComplete: boolean;
}

export const SUGAR_CRUSH_MOVE_BONUS = 250;

export interface SwapValidationResult {
  isValid: boolean;
  swappedGrid: BoardGrid;
  matchResult: MatchResult;
  colorBombTrigger: ColorBombTrigger | null;
  specialComboTrigger: SpecialComboTrigger | null;
}

export interface FallingCellInfo {
  distance: number;
  isNew: boolean;
  fromRow?: number;
  fromCol?: number;
  fromRowDelta?: number;
  fromColDelta?: number;
}

export interface GravityStepResult {
  droppedGrid: BoardGrid;
  fallingInfo: Record<string, FallingCellInfo>;
  maxDistanceInCascade: number;
}

export interface MatchOutcomeStats {
  newlyMatchedTally: Record<string, number>;
  centerR: number;
  centerC: number;
  maxMatchLength: number;
  totalPoints: number;
}

export function createCandy(color: CandyShape, special: SpecialCandyType = null): Candy {
  return { color, special };
}

export function createBoardCell(
  candy: Candy | null = null,
  overrides?: Partial<Omit<BoardCell, 'candy'>>
): BoardCell {
  return {
    candy,
    playable: overrides?.playable ?? true,
    ...(overrides?.isSpawner !== undefined ? { isSpawner: overrides.isSpawner } : {}),
    jellyLayers: overrides?.jellyLayers ?? 0,
    blocker: overrides?.blocker ?? null,
    blockerHealth: overrides?.blockerHealth ?? 0,
    isLocked: overrides?.isLocked ?? false,
  };
}

export function cloneBoardGrid(grid: BoardGrid): BoardGrid {
  return grid.map((row) =>
    row.map((cell) => ({
      ...cell,
      candy: cell.candy ? { ...cell.candy } : null,
    }))
  );
}

export function isDamagableBlocker(blocker: BlockerType): boolean {
  return blocker === 'frosting' || blocker === 'chocolate' || blocker === 'licorice';
}

export function resolveBlockerHealth(blocker: BlockerType, health?: number): number {
  if (!blocker || blocker === 'stone') return 0;
  return Math.max(1, health ?? 1);
}

export function resolveDefaultSpawnerMask(grid: BoardGrid): boolean[][] {
  const { rows, cols } = getGridDimensions(grid);
  const spawnerMask: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );
  const reachable: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );
  const queue: CellCoord[] = [];

  for (let c = 0; c < cols; c++) {
    if (grid[0]?.[c]?.playable) {
      spawnerMask[0][c] = true;
      reachable[0][c] = true;
      queue.push({ r: 0, c });
    }
  }

  const expandReachable = () => {
    while (queue.length > 0) {
      const { r, c } = queue.shift()!;
      const nextR = r + 1;
      if (nextR >= rows) continue;
      for (const nextC of [c, c - 1, c + 1]) {
        if (nextC < 0 || nextC >= cols) continue;
        if (grid[nextR]?.[nextC]?.playable && !reachable[nextR][nextC]) {
          reachable[nextR][nextC] = true;
          queue.push({ r: nextR, c: nextC });
        }
      }
    }
  };

  expandReachable();

  // Only unreachable playable pocket roots (e.g. tucked beneath side-by-side corner bevel holes)
  // become fallback playable entry points; lower cells reachable via side-entry stay non-spawners.
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r]?.[c]?.playable && !reachable[r][c]) {
        spawnerMask[r][c] = true;
        reachable[r][c] = true;
        queue.push({ r, c });
        expandReachable();
      }
    }
  }

  return spawnerMask;
}

export function applyBoardLayoutOverrides(
  grid: BoardGrid,
  boardLayout?: BoardLayoutConfig
): BoardGrid {
  const nextGrid = cloneBoardGrid(grid);
  const { rows, cols } = getGridDimensions(nextGrid);

  if (boardLayout) {
    boardLayout.nonPlayableCells?.forEach(({ r, c }) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        nextGrid[r][c] = createBoardCell(null, { playable: false, isSpawner: false });
      }
    });

    boardLayout.jellyCells?.forEach(({ r, c, layers }) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols && nextGrid[r][c].playable) {
        nextGrid[r][c].jellyLayers = Math.max(0, layers);
      }
    });

    boardLayout.blockerCells?.forEach(({ r, c, type, health }) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols && nextGrid[r][c].playable) {
        nextGrid[r][c].blocker = type;
        nextGrid[r][c].blockerHealth = resolveBlockerHealth(type, health);
        nextGrid[r][c].candy = null;
        nextGrid[r][c].isLocked = false;
      }
    });

    boardLayout.lockedCells?.forEach(({ r, c }) => {
      if (
        r >= 0 &&
        r < rows &&
        c >= 0 &&
        c < cols &&
        nextGrid[r][c].playable &&
        nextGrid[r][c].blocker === null
      ) {
        nextGrid[r][c].isLocked = true;
      }
    });

    if (boardLayout.cells) {
      Object.entries(boardLayout.cells).forEach(([key, config]) => {
        const [r, c] = key.split(',').map(Number);
        if (Number.isNaN(r) || Number.isNaN(c) || r < 0 || r >= rows || c < 0 || c >= cols) {
          return;
        }
        const cell = nextGrid[r][c];
        if (config.playable !== undefined) {
          cell.playable = config.playable;
        }
        if (!cell.playable) {
          nextGrid[r][c] = createBoardCell(null, { playable: false, isSpawner: false });
          return;
        }
        if (config.isSpawner !== undefined) {
          cell.isSpawner = config.isSpawner;
        }
        if (config.jellyLayers !== undefined) {
          cell.jellyLayers = Math.max(0, config.jellyLayers);
        }
        if (config.blocker !== undefined) {
          cell.blocker = config.blocker;
          cell.blockerHealth = resolveBlockerHealth(config.blocker, config.blockerHealth);
        } else if (config.blockerHealth !== undefined && cell.blocker !== null) {
          cell.blockerHealth = resolveBlockerHealth(cell.blocker, config.blockerHealth);
        }
        if (cell.blocker !== null) {
          cell.candy = null;
          cell.isLocked = false;
        } else if (config.isLocked !== undefined) {
          cell.isLocked = config.isLocked;
        }
      });
    }
  }

  const hasExplicitSpawners =
    Boolean(boardLayout?.spawnerCells && boardLayout.spawnerCells.length > 0) ||
    nextGrid.some((row) => row.some((cell) => cell.isSpawner === true));

  if (boardLayout?.spawnerCells && boardLayout.spawnerCells.length > 0) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nextGrid[r][c].isSpawner = false;
      }
    }
    boardLayout.spawnerCells.forEach(({ r, c }) => {
      if (r >= 0 && r < rows && c >= 0 && c < cols && nextGrid[r][c].playable) {
        nextGrid[r][c].isSpawner = true;
      }
    });
  } else if (!hasExplicitSpawners) {
    const defaultMask = resolveDefaultSpawnerMask(nextGrid);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nextGrid[r][c].isSpawner = Boolean(nextGrid[r][c].playable && defaultMask[r][c]);
      }
    }
  } else {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nextGrid[r][c].isSpawner = Boolean(nextGrid[r][c].playable && nextGrid[r][c].isSpawner);
      }
    }
  }

  return nextGrid;
}

function getMatchableColor(cell: BoardCell | undefined): CandyShape | null {
  if (
    !cell ||
    !cell.playable ||
    cell.blocker !== null ||
    !cell.candy ||
    cell.candy.special === 'color_bomb'
  ) {
    return null;
  }
  return cell.candy.color;
}

function canCellBeSwapped(cell: BoardCell | undefined): boolean {
  return Boolean(
    cell &&
      cell.playable &&
      cell.blocker === null &&
      !cell.isLocked &&
      cell.candy !== null
  );
}

function isStripedSpecial(special: SpecialCandyType | undefined): boolean {
  return special === 'striped_h' || special === 'striped_v';
}

function isColorBombNormalSwap(
  cellA: BoardCell | undefined,
  cellB: BoardCell | undefined
): boolean {
  if (!canCellBeSwapped(cellA) || !canCellBeSwapped(cellB)) return false;
  const aSpecial = cellA!.candy!.special;
  const bSpecial = cellB!.candy!.special;
  return (
    (aSpecial === 'color_bomb' && bSpecial === null) ||
    (bSpecial === 'color_bomb' && aSpecial === null)
  );
}

function isSpecialComboSwap(
  cellA: BoardCell | undefined,
  cellB: BoardCell | undefined
): boolean {
  if (!canCellBeSwapped(cellA) || !canCellBeSwapped(cellB)) return false;
  return Boolean(cellA!.candy!.special && cellB!.candy!.special);
}

function resolveSpecialComboTrigger(
  candyA: Candy | null,
  candyB: Candy | null,
  originCoord: CellCoord,
  centerCoord: CellCoord
): SpecialComboTrigger | null {
  if (!candyA?.special || !candyB?.special) return null;

  const sA = candyA.special;
  const sB = candyB.special;

  if (sA === 'color_bomb' && sB === 'color_bomb') {
    return {
      comboType: 'COLOR_BOMB_COLOR_BOMB',
      centerCoord: { ...centerCoord },
      originCoord: { ...originCoord },
    };
  }

  if (sA === 'color_bomb' && isStripedSpecial(sB)) {
    return {
      comboType: 'COLOR_BOMB_STRIPED',
      centerCoord: { ...centerCoord },
      originCoord: { ...originCoord },
      targetColor: candyB.color,
    };
  }
  if (sB === 'color_bomb' && isStripedSpecial(sA)) {
    return {
      comboType: 'COLOR_BOMB_STRIPED',
      centerCoord: { ...centerCoord },
      originCoord: { ...originCoord },
      targetColor: candyA.color,
    };
  }

  if (sA === 'color_bomb' && sB === 'wrapped') {
    return {
      comboType: 'COLOR_BOMB_WRAPPED',
      centerCoord: { ...centerCoord },
      originCoord: { ...originCoord },
      targetColor: candyB.color,
    };
  }
  if (sB === 'color_bomb' && sA === 'wrapped') {
    return {
      comboType: 'COLOR_BOMB_WRAPPED',
      centerCoord: { ...centerCoord },
      originCoord: { ...originCoord },
      targetColor: candyA.color,
    };
  }

  if (sA === 'wrapped' && sB === 'wrapped') {
    return {
      comboType: 'WRAPPED_WRAPPED',
      centerCoord: { ...centerCoord },
      originCoord: { ...originCoord },
    };
  }

  if (
    (isStripedSpecial(sA) && sB === 'wrapped') ||
    (isStripedSpecial(sB) && sA === 'wrapped')
  ) {
    return {
      comboType: 'STRIPED_WRAPPED',
      centerCoord: { ...centerCoord },
      originCoord: { ...originCoord },
    };
  }

  if (isStripedSpecial(sA) && isStripedSpecial(sB)) {
    return {
      comboType: 'STRIPED_STRIPED',
      centerCoord: { ...centerCoord },
      originCoord: { ...originCoord },
    };
  }

  return null;
}

export function getCandyPoolForLevel(
  levelNumber: number,
  candyDistribution?: CandyDistributionConfig
): CandyShape[] {
  if (candyDistribution?.candyPool && candyDistribution.candyPool.length > 0) {
    return candyDistribution.candyPool.filter((c) => c !== 'rainbow_swirl');
  }
  return levelNumber === 1 ? LEVEL1_CANDIES : ALL_CANDIES;
}

export function pickCandyFromPool(
  choices: CandyShape[],
  rng: () => number = Math.random,
  candyDistribution?: CandyDistributionConfig
): CandyShape {
  if (choices.length === 0) return ALL_CANDIES[0];
  const weights = candyDistribution?.weights;
  if (!weights) {
    return choices[Math.floor(rng() * choices.length)];
  }

  let totalWeight = 0;
  const resolvedWeights = choices.map((c) => {
    const raw = weights[c];
    const w = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 1;
    totalWeight += w;
    return w;
  });

  if (totalWeight <= 0) {
    return choices[Math.floor(rng() * choices.length)];
  }

  let roll = rng() * totalWeight;
  for (let i = 0; i < choices.length; i++) {
    roll -= resolvedWeights[i];
    if (roll <= 0) return choices[i];
  }
  return choices[choices.length - 1];
}

export function areCellsAdjacent(from: CellCoord, to: CellCoord): boolean {
  return (
    (Math.abs(from.r - to.r) === 1 && from.c === to.c) ||
    (Math.abs(from.c - to.c) === 1 && from.r === to.r)
  );
}

function coordKey(coord: CellCoord): string {
  return `${coord.r},${coord.c}`;
}

function compareCoords(a: CellCoord, b: CellCoord): number {
  return a.r - b.r || a.c - b.c;
}

function resolveClusterSpawnPosition(
  patternType: MatchPatternType,
  sortedCells: CellCoord[],
  clusterKeySet: Set<string>,
  componentRuns: MatchGroup[],
  options?: MatchDetectionOptions
): CellCoord | null {
  if (patternType === 'NORMAL_MATCH' || sortedCells.length === 0) {
    return null;
  }

  // Prefer player's swap destination when it belongs to this special match cluster
  if (options?.swapDestination && clusterKeySet.has(coordKey(options.swapDestination))) {
    return { r: options.swapDestination.r, c: options.swapDestination.c };
  }

  // Fallback to swap origin if that swapped tile formed the special cluster
  if (options?.swapOrigin && clusterKeySet.has(coordKey(options.swapOrigin))) {
    return { r: options.swapOrigin.r, c: options.swapOrigin.c };
  }

  if (patternType === 'COLOR_BOMB_MATCH') {
    const fivePlusRuns = componentRuns
      .filter((run) => run.length >= 5)
      .sort((a, b) => compareCoords(a.cells[0], b.cells[0]));
    if (fivePlusRuns.length > 0) {
      const targetRun = fivePlusRuns[0];
      const mid = targetRun.cells[Math.floor(targetRun.cells.length / 2)];
      return { r: mid.r, c: mid.c };
    }
  }

  if (patternType === 'WRAPPED_MATCH') {
    const hKeys = new Set<string>();
    const vKeys = new Set<string>();
    componentRuns.forEach((run) => {
      const targetSet = run.orientation === 'horizontal' ? hKeys : vKeys;
      run.cells.forEach((cell) => targetSet.add(coordKey(cell)));
    });

    const intersections = sortedCells.filter((cell) => {
      const key = coordKey(cell);
      return hKeys.has(key) && vKeys.has(key);
    });

    if (intersections.length > 0) {
      return { r: intersections[0].r, c: intersections[0].c };
    }
  }

  // Deterministic interior position for STRIPED_MATCH (or fallback)
  const fallbackIdx = Math.floor((sortedCells.length - 1) / 2);
  const chosen = sortedCells[fallbackIdx];
  return { r: chosen.r, c: chosen.c };
}

/**
 * Pure match and pattern-cluster detection for an 8x8 structured candy grid.
 * Merges overlapping horizontal and vertical runs into deduplicated connected clusters.
 */
export function checkMatchesInGrid(
  currentGrid: BoardGrid,
  options?: MatchDetectionOptions
): MatchResult {
  const { rows, cols } = getGridDimensions(currentGrid);
  const matched = new Set<string>();
  const matchGroups: MatchGroup[] = [];

  // Horizontal maximal runs
  for (let r = 0; r < rows; r++) {
    let matchLength = 1;
    for (let c = 0; c < cols; c++) {
      const current = getMatchableColor(currentGrid[r]?.[c]);
      const next = c + 1 < cols ? getMatchableColor(currentGrid[r]?.[c + 1]) : null;

      if (current !== null && current === next) {
        matchLength++;
      } else {
        if (matchLength >= 3 && current !== null) {
          const groupCells: CellCoord[] = [];
          const startCol = c - matchLength + 1;
          for (let colIdx = startCol; colIdx <= c; colIdx++) {
            matched.add(`${r},${colIdx}`);
            groupCells.push({ r, c: colIdx });
          }
          matchGroups.push({
            cells: groupCells,
            length: matchLength,
            orientation: 'horizontal',
            color: current,
          });
        }
        matchLength = 1;
      }
    }
  }

  // Vertical maximal runs
  for (let c = 0; c < cols; c++) {
    let matchLength = 1;
    for (let r = 0; r < rows; r++) {
      const current = getMatchableColor(currentGrid[r]?.[c]);
      const next = r + 1 < rows ? getMatchableColor(currentGrid[r + 1]?.[c]) : null;

      if (current !== null && current === next) {
        matchLength++;
      } else {
        if (matchLength >= 3 && current !== null) {
          const groupCells: CellCoord[] = [];
          const startRow = r - matchLength + 1;
          for (let rowIdx = startRow; rowIdx <= r; rowIdx++) {
            matched.add(`${rowIdx},${c}`);
            groupCells.push({ r: rowIdx, c });
          }
          matchGroups.push({
            cells: groupCells,
            length: matchLength,
            orientation: 'vertical',
            color: current,
          });
        }
        matchLength = 1;
      }
    }
  }

  if (matchGroups.length === 0) {
    return { matchedSet: matched, matchGroups, clusters: [] };
  }

  // Map each cell coordinate to all run indices containing it
  const cellToRunIndices = new Map<string, number[]>();
  matchGroups.forEach((group, runIdx) => {
    group.cells.forEach((cell) => {
      const key = coordKey(cell);
      const list = cellToRunIndices.get(key);
      if (list) {
        list.push(runIdx);
      } else {
        cellToRunIndices.set(key, [runIdx]);
      }
    });
  });

  // Merge intersecting runs into distinct connected match clusters
  const visitedRuns = new Set<number>();
  const clusters: MatchCluster[] = [];

  for (let startIdx = 0; startIdx < matchGroups.length; startIdx++) {
    if (visitedRuns.has(startIdx)) continue;

    const queue: number[] = [startIdx];
    visitedRuns.add(startIdx);
    const componentRunIndices: number[] = [];

    while (queue.length > 0) {
      const currentRunIdx = queue.shift()!;
      componentRunIndices.push(currentRunIdx);

      const currentRun = matchGroups[currentRunIdx];
      for (const cell of currentRun.cells) {
        const overlappingRuns = cellToRunIndices.get(coordKey(cell)) || [];
        for (const neighborIdx of overlappingRuns) {
          if (!visitedRuns.has(neighborIdx)) {
            visitedRuns.add(neighborIdx);
            queue.push(neighborIdx);
          }
        }
      }
    }

    const componentRuns = componentRunIndices.map((idx) => matchGroups[idx]);
    const uniqueCellsMap = new Map<string, CellCoord>();
    let hasHorizontal = false;
    let hasVertical = false;
    let maxLength = 0;

    for (const run of componentRuns) {
      if (run.orientation === 'horizontal') hasHorizontal = true;
      if (run.orientation === 'vertical') hasVertical = true;
      if (run.length > maxLength) maxLength = run.length;
      for (const cell of run.cells) {
        const key = coordKey(cell);
        if (!uniqueCellsMap.has(key)) {
          uniqueCellsMap.set(key, { r: cell.r, c: cell.c });
        }
      }
    }

    const sortedCells = Array.from(uniqueCellsMap.values()).sort(compareCoords);
    const clusterKeySet = new Set(uniqueCellsMap.keys());
    const color = componentRuns[0].color;

    let patternType: MatchPatternType = 'NORMAL_MATCH';
    let orientation: MatchOrientation = null;

    if (maxLength >= 5) {
      patternType = 'COLOR_BOMB_MATCH';
    } else if (hasHorizontal && hasVertical) {
      patternType = 'WRAPPED_MATCH';
    } else if (maxLength === 4) {
      patternType = 'STRIPED_MATCH';
      orientation = componentRuns[0].orientation;
    }

    const spawnPosition = resolveClusterSpawnPosition(
      patternType,
      sortedCells,
      clusterKeySet,
      componentRuns,
      options
    );

    clusters.push({
      id: `cluster-${clusters.length}-${color}-${sortedCells[0].r}-${sortedCells[0].c}`,
      color,
      cells: sortedCells,
      patternType,
      orientation,
      spawnPosition,
      runs: componentRuns,
    });
  }

  return { matchedSet: matched, matchGroups, clusters };
}

/**
 * Pure check for whether at least one valid swap move exists on the board.
 */
export function hasPossibleMoves(currentGrid: BoardGrid): boolean {
  const { rows, cols } = getGridDimensions(currentGrid);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = currentGrid[r]?.[c];
      if (!canCellBeSwapped(cell)) continue;

      // Swap Right
      if (c + 1 < cols && canCellBeSwapped(currentGrid[r]?.[c + 1])) {
        const rightCell = currentGrid[r]?.[c + 1];
        if (isColorBombNormalSwap(cell, rightCell) || isSpecialComboSwap(cell, rightCell)) {
          return true;
        }
        const testGrid = cloneBoardGrid(currentGrid);
        const temp = testGrid[r][c].candy;
        testGrid[r][c].candy = testGrid[r][c + 1].candy;
        testGrid[r][c + 1].candy = temp;
        if (checkMatchesInGrid(testGrid).matchedSet.size > 0) return true;
      }
      // Swap Down
      if (r + 1 < rows && canCellBeSwapped(currentGrid[r + 1]?.[c])) {
        const downCell = currentGrid[r + 1]?.[c];
        if (isColorBombNormalSwap(cell, downCell) || isSpecialComboSwap(cell, downCell)) {
          return true;
        }
        const testGrid = cloneBoardGrid(currentGrid);
        const temp = testGrid[r][c].candy;
        testGrid[r][c].candy = testGrid[r + 1][c].candy;
        testGrid[r + 1][c].candy = temp;
        if (checkMatchesInGrid(testGrid).matchedSet.size > 0) return true;
      }
    }
  }
  return false;
}

export interface GenerateBoardOptions {
  candyDistribution?: CandyDistributionConfig;
  rng?: () => number;
}

/**
 * Generates an initial structured board with configurable dimensions, optional layout/obstacle overrides,
 * candy pool/weights, and optional deterministic RNG, ensuring no pre-existing matches and at least one valid move.
 */
export function generateBoardForLevel(
  levelNumber: number,
  boardLayout?: BoardLayoutConfig,
  options?: GenerateBoardOptions
): BoardGrid {
  const rng = options?.rng ?? Math.random;
  const distribution = options?.candyDistribution;
  const pool = getCandyPoolForLevel(levelNumber, distribution);

  const rows = Math.max(4, Math.min(12, Math.floor(boardLayout?.rows ?? ROWS)));
  const cols = Math.max(4, Math.min(12, Math.floor(boardLayout?.cols ?? COLS)));

  // Build static cell template (playable holes, jelly layers, blockers, locks)
  const templateGrid: BoardGrid = [];
  for (let r = 0; r < rows; r++) {
    const row: BoardCell[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(createBoardCell(null));
    }
    templateGrid.push(row);
  }
  const configuredTemplate = applyBoardLayoutOverrides(templateGrid, boardLayout);

  let attempts = 0;
  while (attempts < 80) {
    attempts++;
    const newGrid: BoardGrid = [];
    for (let r = 0; r < rows; r++) {
      const row: BoardCell[] = [];
      for (let c = 0; c < cols; c++) {
        const tmpl = configuredTemplate[r][c];
        if (!tmpl.playable || tmpl.blocker !== null) {
          row.push(
            createBoardCell(null, {
              playable: tmpl.playable,
              isSpawner: Boolean(tmpl.playable && tmpl.isSpawner),
              jellyLayers: tmpl.jellyLayers,
              blocker: tmpl.blocker,
              blockerHealth: tmpl.blockerHealth,
              isLocked: false,
            })
          );
          continue;
        }

        const available = pool.filter((color) => {
          const matchH =
            c >= 2 &&
            row[c - 1].candy?.color === color &&
            row[c - 2].candy?.color === color;
          const matchV =
            r >= 2 &&
            newGrid[r - 1][c].candy?.color === color &&
            newGrid[r - 2][c].candy?.color === color;
          return !matchH && !matchV;
        });
        const choices = available.length > 0 ? available : pool;
        const picked = pickCandyFromPool(choices, rng, distribution);
        row.push(
          createBoardCell(createCandy(picked), {
            playable: tmpl.playable,
            isSpawner: Boolean(tmpl.isSpawner),
            jellyLayers: tmpl.jellyLayers,
            blocker: null,
            blockerHealth: 0,
            isLocked: tmpl.isLocked,
          })
        );
      }
      newGrid.push(row);
    }

    if (checkMatchesInGrid(newGrid).matchedSet.size === 0 && hasPossibleMoves(newGrid)) {
      return newGrid;
    }
  }

  // Fallback patterned grid respecting holes, blockers, and locks
  const fallbackGrid: BoardGrid = [];
  for (let r = 0; r < rows; r++) {
    const row: BoardCell[] = [];
    for (let c = 0; c < cols; c++) {
      const tmpl = configuredTemplate[r][c];
      if (!tmpl.playable || tmpl.blocker !== null) {
        row.push(
          createBoardCell(null, {
            playable: tmpl.playable,
            isSpawner: Boolean(tmpl.playable && tmpl.isSpawner),
            jellyLayers: tmpl.jellyLayers,
            blocker: tmpl.blocker,
            blockerHealth: tmpl.blockerHealth,
            isLocked: false,
          })
        );
      } else {
        row.push(
          createBoardCell(createCandy(pool[(r * 3 + c * 2) % pool.length]), {
            playable: tmpl.playable,
            isSpawner: Boolean(tmpl.isSpawner),
            jellyLayers: tmpl.jellyLayers,
            blocker: null,
            blockerHealth: 0,
            isLocked: tmpl.isLocked,
          })
        );
      }
    }
    fallbackGrid.push(row);
  }
  return hasPossibleMoves(fallbackGrid) ? fallbackGrid : reshuffleBoard(fallbackGrid, rng);
}

/**
 * Simulates swapping two adjacent cells and validates whether the swap produces a match.
 */
export function validateAndSwapCells(
  currentGrid: BoardGrid,
  from: CellCoord,
  to: CellCoord
): SwapValidationResult {
  const { rows, cols } = getGridDimensions(currentGrid);
  const inBounds =
    from.r >= 0 &&
    from.r < rows &&
    from.c >= 0 &&
    from.c < cols &&
    to.r >= 0 &&
    to.r < rows &&
    to.c >= 0 &&
    to.c < cols;

  const swappedGrid = cloneBoardGrid(currentGrid);

  if (
    !inBounds ||
    !areCellsAdjacent(from, to) ||
    !canCellBeSwapped(swappedGrid[from.r][from.c]) ||
    !canCellBeSwapped(swappedGrid[to.r][to.c])
  ) {
    return {
      isValid: false,
      swappedGrid,
      matchResult: { matchedSet: new Set<string>(), matchGroups: [], clusters: [] },
      colorBombTrigger: null,
      specialComboTrigger: null,
    };
  }

  const temp = swappedGrid[from.r][from.c].candy;
  swappedGrid[from.r][from.c].candy = swappedGrid[to.r][to.c].candy;
  swappedGrid[to.r][to.c].candy = temp;

  const swappedFromCandy = swappedGrid[from.r][from.c].candy;
  const swappedToCandy = swappedGrid[to.r][to.c].candy;

  const specialComboTrigger = resolveSpecialComboTrigger(
    swappedFromCandy,
    swappedToCandy,
    from,
    to
  );

  let colorBombTrigger: ColorBombTrigger | null = null;
  if (!specialComboTrigger) {
    if (
      swappedToCandy?.special === 'color_bomb' &&
      swappedFromCandy &&
      swappedFromCandy.special === null
    ) {
      colorBombTrigger = {
        bombCoord: { r: to.r, c: to.c },
        targetColor: swappedFromCandy.color,
      };
    } else if (
      swappedFromCandy?.special === 'color_bomb' &&
      swappedToCandy &&
      swappedToCandy.special === null
    ) {
      colorBombTrigger = {
        bombCoord: { r: from.r, c: from.c },
        targetColor: swappedToCandy.color,
      };
    }
  }

  const matchResult = specialComboTrigger
    ? { matchedSet: new Set<string>(), matchGroups: [], clusters: [] }
    : checkMatchesInGrid(swappedGrid, {
        swapDestination: to,
        swapOrigin: from,
      });

  return {
    isValid:
      matchResult.matchedSet.size > 0 ||
      colorBombTrigger !== null ||
      specialComboTrigger !== null,
    swappedGrid,
    matchResult,
    colorBombTrigger,
    specialComboTrigger,
  };
}

/**
 * Maps a detected match cluster to the special candy type it produces.
 */
export function getSpecialTypeForCluster(cluster: MatchCluster): SpecialCandyType {
  switch (cluster.patternType) {
    case 'COLOR_BOMB_MATCH':
      return 'color_bomb';
    case 'WRAPPED_MATCH':
      return 'wrapped';
    case 'STRIPED_MATCH':
      return cluster.orientation === 'vertical' ? 'striped_v' : 'striped_h';
    case 'NORMAL_MATCH':
    default:
      return null;
  }
}

/**
 * Resolves matched clusters into cleared cell coordinates and newly spawned special candies.
 * Ensures newly spawned special candies are preserved at cluster.spawnPosition without duplicates.
 */
export function resolveMatchClusters(
  currentGrid: BoardGrid,
  matchResult: MatchResult,
  allowSpecialCreation: boolean
): MatchResolutionResult {
  const gridWithSpawns = cloneBoardGrid(currentGrid);
  const cellsToClear = new Set<string>(matchResult.matchedSet);
  const specialSpawns: SpecialSpawn[] = [];
  const spawnedKeys = new Set<string>();

  if (allowSpecialCreation) {
    for (const cluster of matchResult.clusters) {
      const specialType = getSpecialTypeForCluster(cluster);
      if (!specialType || !cluster.spawnPosition) continue;

      let spawnCoord = cluster.spawnPosition;
      let targetCell = gridWithSpawns[spawnCoord.r]?.[spawnCoord.c];
      if (!targetCell || !targetCell.playable || targetCell.blocker !== null || targetCell.isLocked) {
        const fallbackCoord = cluster.cells.find((coord) => {
          const cCell = gridWithSpawns[coord.r]?.[coord.c];
          return Boolean(cCell && cCell.playable && cCell.blocker === null && !cCell.isLocked);
        });
        if (!fallbackCoord) continue;
        spawnCoord = fallbackCoord;
        targetCell = gridWithSpawns[spawnCoord.r][spawnCoord.c];
      }

      const { r, c } = spawnCoord;
      const key = coordKey(spawnCoord);
      if (spawnedKeys.has(key)) continue;

      spawnedKeys.add(key);
      cellsToClear.delete(key);

      const specialCandy = createCandy(cluster.color, specialType);
      targetCell.candy = specialCandy;
      specialSpawns.push({ coord: { r, c }, candy: { ...specialCandy } });
    }
  }

  return {
    cellsToClear,
    gridWithSpawns,
    specialSpawns,
  };
}

function isPlayableCell(cell: BoardCell | undefined): boolean {
  return Boolean(cell && cell.playable);
}

function canClearCandyAtCell(cell: BoardCell | undefined): boolean {
  return Boolean(
    cell && cell.playable && cell.blocker === null && !cell.isLocked && cell.candy !== null
  );
}

function canSpecialDetonateAtCell(cell: BoardCell | undefined): boolean {
  return Boolean(
    cell &&
      cell.playable &&
      cell.blocker === null &&
      !cell.isLocked &&
      cell.candy?.special
  );
}

/**
 * Resolves special candy activations and deterministic chain reactions via a FIFO queue.
 * Guarantees each special candy activates at most once and deduplicates all cleared coordinates.
 */
export function resolveSpecialActivations(
  currentGrid: BoardGrid,
  initialCellsToClear: Set<string>,
  options?: ActivationResolutionOptions
): ActivationResolutionResult {
  const resolvedGrid = cloneBoardGrid(currentGrid);
  const { rows, cols } = getGridDimensions(resolvedGrid);
  const protectedKeys = options?.protectedKeys ?? new Set<string>();
  const allClearedCells = new Set<string>();
  const specialHitCells = new Set<string>();
  const consumedSpecials: Array<Exclude<SpecialCandyType, null>> = [];

  initialCellsToClear.forEach((key) => {
    if (!protectedKeys.has(key)) {
      allClearedCells.add(key);
    }
  });

  const queue: Array<{ coord: CellCoord; targetColor?: CandyShape }> = [];
  const queuedKeys = new Set<string>();
  const activatedKeys = new Set<string>();
  const activationEvents: SpecialActivationEvent[] = [];

  const enqueueSpecial = (r: number, c: number, targetColor?: CandyShape) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    const key = `${r},${c}`;
    if (protectedKeys.has(key) || queuedKeys.has(key) || activatedKeys.has(key)) return;
    const cell = resolvedGrid[r]?.[c];
    if (!canSpecialDetonateAtCell(cell)) return;

    queuedKeys.add(key);
    queue.push({ coord: { r, c }, targetColor });
  };

  const applyHitCell = (
    tr: number,
    tc: number,
    affectedCells: CellCoord[],
    affectedKeySet: Set<string>,
    triggerSpecials = true
  ) => {
    if (tr < 0 || tr >= rows || tc < 0 || tc >= cols) return;
    const tCell = resolvedGrid[tr]?.[tc];
    if (!isPlayableCell(tCell)) return;

    const tKey = `${tr},${tc}`;
    if (!affectedKeySet.has(tKey)) {
      affectedKeySet.add(tKey);
      affectedCells.push({ r: tr, c: tc });
    }
    specialHitCells.add(tKey);

    if (!protectedKeys.has(tKey) && canClearCandyAtCell(tCell)) {
      allClearedCells.add(tKey);
    }
    if (triggerSpecials && canSpecialDetonateAtCell(tCell) && !protectedKeys.has(tKey)) {
      enqueueSpecial(tr, tc);
    }
  };

  // 1. Resolve Special + Special combo trigger if present
  if (options?.specialComboTrigger) {
    const { comboType, centerCoord, originCoord, targetColor } = options.specialComboTrigger;
    const centerCell = resolvedGrid[centerCoord.r]?.[centerCoord.c];
    const originCell = resolvedGrid[originCoord.r]?.[originCoord.c];

    if (
      canSpecialDetonateAtCell(centerCell) &&
      canSpecialDetonateAtCell(originCell) &&
      centerCell.candy?.special &&
      originCell.candy?.special
    ) {
      const centerKey = coordKey(centerCoord);
      const originKey = coordKey(originCoord);

      // Consume both swapped special candies so neither re-triggers as a single special
      activatedKeys.add(centerKey);
      activatedKeys.add(originKey);
      queuedKeys.add(centerKey);
      queuedKeys.add(originKey);
      consumedSpecials.push(centerCell.candy.special, originCell.candy.special);
      if (!protectedKeys.has(centerKey)) allClearedCells.add(centerKey);
      if (!protectedKeys.has(originKey)) allClearedCells.add(originKey);

      const affectedCells: CellCoord[] = [];
      const affectedKeySet = new Set<string>();
      applyHitCell(centerCoord.r, centerCoord.c, affectedCells, affectedKeySet, false);
      applyHitCell(originCoord.r, originCoord.c, affectedCells, affectedKeySet, false);

      if (comboType === 'STRIPED_STRIPED') {
        for (let c = 0; c < cols; c++) {
          applyHitCell(centerCoord.r, c, affectedCells, affectedKeySet);
        }
        for (let r = 0; r < rows; r++) {
          applyHitCell(r, centerCoord.c, affectedCells, affectedKeySet);
        }
      } else if (comboType === 'STRIPED_WRAPPED') {
        for (let dr = -1; dr <= 1; dr++) {
          const row = centerCoord.r + dr;
          if (row < 0 || row >= rows) continue;
          for (let c = 0; c < cols; c++) {
            applyHitCell(row, c, affectedCells, affectedKeySet);
          }
        }
        for (let dc = -1; dc <= 1; dc++) {
          const col = centerCoord.c + dc;
          if (col < 0 || col >= cols) continue;
          for (let r = 0; r < rows; r++) {
            applyHitCell(r, col, affectedCells, affectedKeySet);
          }
        }
      } else if (comboType === 'WRAPPED_WRAPPED') {
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            applyHitCell(centerCoord.r + dr, centerCoord.c + dc, affectedCells, affectedKeySet);
          }
        }
      } else if (comboType === 'COLOR_BOMB_STRIPED' || comboType === 'COLOR_BOMB_WRAPPED') {
        const resolvedColor =
          targetColor ??
          (centerCell.candy.special !== 'color_bomb'
            ? centerCell.candy.color
            : originCell.candy.color);
        let convertedIndex = 0;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const key = `${r},${c}`;
            if (key === centerKey || key === originKey || protectedKeys.has(key)) continue;
            const tCell = resolvedGrid[r]?.[c];
            if (!isPlayableCell(tCell) || tCell.blocker !== null || !tCell.candy) continue;
            if (tCell.candy.color !== resolvedColor) continue;

            if (tCell.isLocked) {
              // Break lock without converting or removing candy on same hit
              applyHitCell(r, c, affectedCells, affectedKeySet, false);
            } else if (tCell.candy.special === null) {
              const convertedSpecial: SpecialCandyType =
                comboType === 'COLOR_BOMB_STRIPED'
                  ? convertedIndex % 2 === 0
                    ? 'striped_h'
                    : 'striped_v'
                  : 'wrapped';
              convertedIndex++;
              tCell.candy = createCandy(resolvedColor, convertedSpecial);
              applyHitCell(r, c, affectedCells, affectedKeySet, true);
            } else if (tCell.candy.special !== 'color_bomb') {
              applyHitCell(r, c, affectedCells, affectedKeySet, true);
            }
          }
        }
      } else if (comboType === 'COLOR_BOMB_COLOR_BOMB') {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            applyHitCell(r, c, affectedCells, affectedKeySet, false);
          }
        }
      }

      const isColorBombTargetedCombo =
        comboType === 'COLOR_BOMB_STRIPED' || comboType === 'COLOR_BOMB_WRAPPED';
      const eventCoord =
        isColorBombTargetedCombo &&
        originCell.candy.special === 'color_bomb' &&
        centerCell.candy.special !== 'color_bomb'
          ? originCoord
          : centerCoord;
      const eventOriginCell =
        eventCoord.r === originCoord.r && eventCoord.c === originCoord.c
          ? originCell
          : centerCell;

      activationEvents.push({
        coord: { ...eventCoord },
        special: comboType,
        color: eventOriginCell.candy!.color,
        targetColor: isColorBombTargetedCombo
          ? targetColor ??
            (centerCell.candy.special !== 'color_bomb'
              ? centerCell.candy.color
              : originCell.candy.color)
          : undefined,
        affectedCells,
      });
    }
  }

  // 2. Seed color-bomb normal-candy swap trigger if present
  if (!options?.specialComboTrigger && options?.colorBombTrigger) {
    const { bombCoord, targetColor } = options.colorBombTrigger;
    const bombCell = resolvedGrid[bombCoord.r]?.[bombCoord.c];
    if (
      canSpecialDetonateAtCell(bombCell) &&
      bombCell.candy?.special === 'color_bomb'
    ) {
      const bombKey = coordKey(bombCoord);
      if (!protectedKeys.has(bombKey)) {
        allClearedCells.add(bombKey);
      }
      specialHitCells.add(bombKey);
      enqueueSpecial(bombCoord.r, bombCoord.c, targetColor);
    }
  }

  // 3. Seed any existing special candies present in the initial matched cells in deterministic (r, c) order
  const seedKeySet = new Set<string>(initialCellsToClear);
  if (options?.initialMatchedSet) {
    options.initialMatchedSet.forEach((key) => {
      if (!protectedKeys.has(key)) {
        seedKeySet.add(key);
      }
    });
  }
  const sortedSeedCoords = Array.from(seedKeySet)
    .map((key) => {
      const [r, c] = key.split(',').map(Number);
      return { r, c };
    })
    .sort(compareCoords);

  for (const coord of sortedSeedCoords) {
    enqueueSpecial(coord.r, coord.c);
  }

  // 4. Process deterministic FIFO activation queue
  while (queue.length > 0) {
    const { coord, targetColor } = queue.shift()!;
    const currentKey = coordKey(coord);
    if (activatedKeys.has(currentKey)) continue;

    const originCell = resolvedGrid[coord.r]?.[coord.c];
    if (!canSpecialDetonateAtCell(originCell) || !originCell.candy?.special) {
      continue;
    }

    const special = originCell.candy.special;
    activatedKeys.add(currentKey);
    consumedSpecials.push(special);
    specialHitCells.add(currentKey);
    if (!protectedKeys.has(currentKey)) {
      allClearedCells.add(currentKey);
    }

    const affectedCells: CellCoord[] = [];
    const affectedKeySet = new Set<string>();

    if (special === 'striped_h') {
      for (let c = 0; c < cols; c++) {
        applyHitCell(coord.r, c, affectedCells, affectedKeySet);
      }
    } else if (special === 'striped_v') {
      for (let r = 0; r < rows; r++) {
        applyHitCell(r, coord.c, affectedCells, affectedKeySet);
      }
    } else if (special === 'wrapped') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          applyHitCell(coord.r + dr, coord.c + dc, affectedCells, affectedKeySet);
        }
      }
    } else if (special === 'color_bomb') {
      const resolvedTargetColor = targetColor ?? originCell.candy.color;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tCell = resolvedGrid[r]?.[c];
          if (
            isPlayableCell(tCell) &&
            tCell.blocker === null &&
            tCell.candy &&
            tCell.candy.color === resolvedTargetColor &&
            tCell.candy.special !== 'color_bomb'
          ) {
            applyHitCell(r, c, affectedCells, affectedKeySet);
          }
        }
      }
    }

    activationEvents.push({
      coord,
      special,
      color: originCell.candy.color,
      targetColor: special === 'color_bomb' ? targetColor ?? originCell.candy.color : undefined,
      affectedCells,
    });
  }

  return {
    allClearedCells,
    specialHitCells,
    consumedSpecials,
    activationEvents,
    resolvedGrid,
  };
}

/**
 * Computes candy tallies, center position, max match length, and points for a cleared batch.
 */
export function calculateMatchOutcome(
  currentGrid: BoardGrid,
  matchedSet: Set<string>,
  matchGroups: MatchGroup[],
  currentCombo: number
): MatchOutcomeStats {
  const maxMatchLength =
    matchGroups.length > 0
      ? matchGroups.reduce((max, g) => Math.max(max, g.length), 3)
      : 3;
  const newlyMatchedTally: Record<string, number> = {};
  let centerR = 0;
  let centerC = 0;

  matchedSet.forEach((key) => {
    const [r, c] = key.split(',').map(Number);
    centerR += r;
    centerC += c;
    const candy = currentGrid[r]?.[c]?.candy;
    if (candy && candy.special !== 'color_bomb') {
      newlyMatchedTally[candy.color] = (newlyMatchedTally[candy.color] || 0) + 1;
    }
  });

  if (matchedSet.size > 0) {
    centerR /= matchedSet.size;
    centerC /= matchedSet.size;
  }

  const basePoints = matchedSet.size * 100 * Math.max(1, currentCombo);
  const bonusPoints = maxMatchLength >= 5 ? 500 : maxMatchLength === 4 ? 200 : 0;
  const totalPoints = basePoints + bonusPoints;

  return {
    newlyMatchedTally,
    centerR,
    centerC,
    maxMatchLength,
    totalPoints,
  };
}

/**
 * Resolves lock breaking, blocker health damage, and jelly layer reduction for one cascade step.
 * - Locked candies unlock without losing their candy on the unlock hit.
 * - Damagable blockers (frosting, chocolate, licorice) lose 1 HP from adjacent normal matches or special hits.
 * - Permanent stone blockers never take damage.
 * - Jelly layers decrement by 1 per step on matched/cleared/special-hit playable cells and count as cleared only at 0.
 */
export function resolveObstacleAndJellyUpdates(
  currentGrid: BoardGrid,
  allClearedCells: Set<string>,
  normalMatchedCells: Set<string>,
  specialHitCells: Set<string>
): ObstacleUpdateResult {
  const updatedGrid = cloneBoardGrid(currentGrid);
  const unlockedKeySet = new Set<string>();
  const unlockedCells: CellCoord[] = [];
  const candiesToRemove = new Set<string>();

  const unlockCandidateKeys = new Set<string>();
  allClearedCells.forEach((k) => unlockCandidateKeys.add(k));
  normalMatchedCells.forEach((k) => unlockCandidateKeys.add(k));
  specialHitCells.forEach((k) => unlockCandidateKeys.add(k));

  const sortedUnlockKeys = Array.from(unlockCandidateKeys).sort((a, b) => {
    const [r1, c1] = a.split(',').map(Number);
    const [r2, c2] = b.split(',').map(Number);
    return r1 - r2 || c1 - c2;
  });

  for (const key of sortedUnlockKeys) {
    const [r, c] = key.split(',').map(Number);
    const cell = updatedGrid[r]?.[c];
    if (cell && cell.playable && cell.blocker === null && cell.isLocked) {
      cell.isLocked = false;
      unlockedKeySet.add(key);
      unlockedCells.push({ r, c });
    }
  }

  allClearedCells.forEach((key) => {
    if (unlockedKeySet.has(key)) return;
    const [r, c] = key.split(',').map(Number);
    const cell = updatedGrid[r]?.[c];
    if (canClearCandyAtCell(cell)) {
      candiesToRemove.add(key);
    }
  });

  const blockerDamageKeys = new Set<string>();
  specialHitCells.forEach((key) => {
    const [r, c] = key.split(',').map(Number);
    const cell = updatedGrid[r]?.[c];
    if (cell && cell.playable && isDamagableBlocker(cell.blocker)) {
      blockerDamageKeys.add(key);
    }
  });

  const { rows: obsRows, cols: obsCols } = getGridDimensions(updatedGrid);
  normalMatchedCells.forEach((key) => {
    const [r, c] = key.split(',').map(Number);
    const neighbors: CellCoord[] = [
      { r: r - 1, c },
      { r: r + 1, c },
      { r, c: c - 1 },
      { r, c: c + 1 },
    ];
    for (const n of neighbors) {
      if (n.r < 0 || n.r >= obsRows || n.c < 0 || n.c >= obsCols) continue;
      const nCell = updatedGrid[n.r]?.[n.c];
      if (nCell && nCell.playable && isDamagableBlocker(nCell.blocker)) {
        blockerDamageKeys.add(`${n.r},${n.c}`);
      }
    }
  });

  const sortedBlockerKeys = Array.from(blockerDamageKeys).sort((a, b) => {
    const [r1, c1] = a.split(',').map(Number);
    const [r2, c2] = b.split(',').map(Number);
    return r1 - r2 || c1 - c2;
  });

  const damagedBlockers: ObstacleUpdateResult['damagedBlockers'] = [];
  const brokenBlockers: ObstacleUpdateResult['brokenBlockers'] = [];
  const blockerBrokenCounts: Record<string, number> = {};

  for (const key of sortedBlockerKeys) {
    const [r, c] = key.split(',').map(Number);
    const cell = updatedGrid[r]?.[c];
    if (!cell || !cell.playable || !isDamagableBlocker(cell.blocker) || cell.blocker === null) {
      continue;
    }
    const type = cell.blocker as Exclude<BlockerType, null>;
    const currentHealth = Math.max(1, cell.blockerHealth);
    const remainingHealth = currentHealth - 1;
    if (remainingHealth <= 0) {
      cell.blocker = null;
      cell.blockerHealth = 0;
      brokenBlockers.push({ coord: { r, c }, type });
      blockerBrokenCounts[type] = (blockerBrokenCounts[type] || 0) + 1;
    } else {
      cell.blockerHealth = remainingHealth;
      damagedBlockers.push({ coord: { r, c }, type, remainingHealth });
    }
  }

  const jellyAffectedKeys = new Set<string>();
  candiesToRemove.forEach((k) => jellyAffectedKeys.add(k));
  unlockedKeySet.forEach((k) => jellyAffectedKeys.add(k));
  normalMatchedCells.forEach((k) => jellyAffectedKeys.add(k));
  specialHitCells.forEach((k) => jellyAffectedKeys.add(k));

  const sortedJellyKeys = Array.from(jellyAffectedKeys).sort((a, b) => {
    const [r1, c1] = a.split(',').map(Number);
    const [r2, c2] = b.split(',').map(Number);
    return r1 - r2 || c1 - c2;
  });

  const jellyReducedCells: CellCoord[] = [];
  let clearedJellyCount = 0;

  for (const key of sortedJellyKeys) {
    const [r, c] = key.split(',').map(Number);
    const cell = updatedGrid[r]?.[c];
    if (!cell || !cell.playable || cell.jellyLayers <= 0) continue;

    const prevLayers = cell.jellyLayers;
    const nextLayers = Math.max(0, prevLayers - 1);
    cell.jellyLayers = nextLayers;
    jellyReducedCells.push({ r, c });
    if (prevLayers > 0 && nextLayers === 0) {
      clearedJellyCount += 1;
    }
  }

  return {
    updatedGrid,
    candiesToRemove,
    unlockedCells,
    damagedBlockers,
    brokenBlockers,
    jellyReducedCells,
    clearedJellyCount,
    blockerBrokenCounts,
  };
}

function isImmovableBarrier(cell: BoardCell | undefined): boolean {
  return !cell || !cell.playable || cell.blocker !== null || cell.isLocked;
}

/**
 * Clears matched candies, drops surviving candies across playable segments (stopping at holes,
 * blockers, and locks), slides diagonally into empty playable pockets below holes/blockers,
 * and spawns new candies strictly at explicit playable spawner cells (never from non-playable holes).
 */
export function applyGravityAndRefill(
  currentGrid: BoardGrid,
  matchedSet: Set<string>,
  candyPool: CandyShape[],
  options?: { rng?: () => number; candyDistribution?: CandyDistributionConfig }
): GravityStepResult {
  const droppedGrid = cloneBoardGrid(currentGrid);
  const { rows, cols } = getGridDimensions(droppedGrid);
  const rng = options?.rng ?? Math.random;
  const distribution = options?.candyDistribution;

  // Ensure non-playable cells are always clean & cleared cells are emptied
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = droppedGrid[r][c];
      if (!cell.playable) {
        cell.candy = null;
        cell.isSpawner = false;
        continue;
      }
      if (matchedSet.has(`${r},${c}`) && !isImmovableBarrier(cell)) {
        cell.candy = null;
      }
    }
  }

  const hasExplicitSpawners = droppedGrid.some((row) =>
    row.some((cell) => cell.playable && cell.isSpawner === true)
  );
  const defaultSpawnerMask = hasExplicitSpawners ? null : resolveDefaultSpawnerMask(droppedGrid);

  const isPlayableSpawnerCell = (r: number, c: number): boolean => {
    const cell = droppedGrid[r]?.[c];
    if (!cell || !cell.playable) return false;
    return hasExplicitSpawners
      ? Boolean(cell.isSpawner)
      : Boolean(defaultSpawnerMask?.[r]?.[c]);
  };

  // Persist resolved spawner flags cleanly onto playable cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      droppedGrid[r][c].isSpawner = isPlayableSpawnerCell(r, c);
    }
  }

  interface MovingSlot {
    candy: Candy;
    originRow: number;
    originCol: number;
    spawnRow?: number;
    spawnCol?: number;
    spawnDistance: number;
    isNew: boolean;
  }

  const slots: (MovingSlot | null)[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const cell = droppedGrid[r][c];
      if (!cell.playable || !cell.candy) return null;
      return {
        candy: cell.candy,
        originRow: r,
        originCol: c,
        spawnDistance: 0,
        isNew: false,
      };
    })
  );

  const settleVerticalAndSpawnerRefill = () => {
    for (let c = 0; c < cols; c++) {
      let r = 0;
      while (r < rows) {
        if (isImmovableBarrier(droppedGrid[r][c])) {
          r++;
          continue;
        }

        const segStart = r;
        while (r < rows && !isImmovableBarrier(droppedGrid[r][c])) {
          r++;
        }
        const segEnd = r - 1;

        const segmentItems: MovingSlot[] = [];
        for (let sr = segStart; sr <= segEnd; sr++) {
          const slot = slots[sr][c];
          if (slot !== null) {
            segmentItems.push(slot);
          }
          slots[sr][c] = null;
        }

        const emptySlots = segEnd - segStart + 1 - segmentItems.length;

        // Place surviving items at bottom of the playable segment
        for (let idx = 0; idx < segmentItems.length; idx++) {
          const targetRow = segStart + emptySlots + idx;
          slots[targetRow][c] = segmentItems[idx];
        }

        // Only spawn new candies if the top of this segment is an explicit playable spawner
        if (emptySlots > 0 && isPlayableSpawnerCell(segStart, c)) {
          const isTopEdgeSpawner = segStart === 0;
          const spawnDist = Math.max(1, Math.min(8, emptySlots));
          for (let sr = segStart; sr < segStart + emptySlots; sr++) {
            const newColor = pickCandyFromPool(candyPool, rng, distribution);
            slots[sr][c] = {
              candy: createCandy(newColor),
              originRow: isTopEdgeSpawner ? segStart - 1 : segStart,
              originCol: c,
              spawnRow: segStart,
              spawnCol: c,
              spawnDistance: spawnDist,
              isNew: true,
            };
          }
        }
      }
    }
  };

  settleVerticalAndSpawnerRefill();

  // Diagonal side-entry slide into empty playable cells below holes, blockers, or locked cells.
  // Re-settles vertical columns & explicit playable spawners immediately after each slide.
  const maxSlidePasses = rows * cols * 4;
  for (let pass = 0; pass < maxSlidePasses; pass++) {
    let didSlide = false;
    for (let r = rows - 1; r >= 1 && !didSlide; r--) {
      for (let c = 0; c < cols; c++) {
        if (isImmovableBarrier(droppedGrid[r][c]) || slots[r][c] !== null) continue;

        const candidates =
          (r + c + pass) % 2 === 0
            ? [c - 1, c + 1]
            : [c + 1, c - 1];

        for (const nc of candidates) {
          if (nc < 0 || nc >= cols) continue;
          if (!isImmovableBarrier(droppedGrid[r - 1][nc]) && slots[r - 1][nc] !== null) {
            slots[r][c] = slots[r - 1][nc];
            slots[r - 1][nc] = null;
            settleVerticalAndSpawnerRefill();
            didSlide = true;
            break;
          }
        }
        if (didSlide) break;
      }
    }
    if (!didSlide) break;
  }

  const fallingInfo: Record<string, FallingCellInfo> = {};
  let maxDistanceInCascade = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isImmovableBarrier(droppedGrid[r][c])) continue;
      const slot = slots[r][c];
      droppedGrid[r][c].candy = slot ? slot.candy : null;

      if (!slot) continue;

      if (slot.isNew) {
        const spRow = slot.spawnRow ?? 0;
        const spCol = slot.spawnCol ?? c;
        const colDelta = spCol - c;
        const rowDelta = spRow === 0 ? -(r + 1) : spRow - r;
        const distSpan = Math.max(
          slot.spawnDistance,
          Math.abs(rowDelta),
          Math.abs(colDelta)
        );
        const clamped = Math.max(1, Math.min(8, distSpan));
        fallingInfo[`${r},${c}`] = {
          distance: clamped,
          isNew: true,
          fromRow: spRow,
          fromCol: spCol,
          fromRowDelta: rowDelta,
          fromColDelta: colDelta,
        };
        if (clamped > maxDistanceInCascade) maxDistanceInCascade = clamped;
      } else {
        const rowDelta = slot.originRow - r;
        const colDelta = slot.originCol - c;
        if (rowDelta !== 0 || colDelta !== 0) {
          const distSpan = Math.max(Math.abs(rowDelta), Math.abs(colDelta));
          const clamped = Math.max(1, Math.min(8, distSpan));
          fallingInfo[`${r},${c}`] = {
            distance: clamped,
            isNew: false,
            fromRow: slot.originRow,
            fromCol: slot.originCol,
            fromRowDelta: rowDelta,
            fromColDelta: colDelta,
          };
          if (clamped > maxDistanceInCascade) maxDistanceInCascade = clamped;
        }
      }
    }
  }

  return {
    droppedGrid,
    fallingInfo,
    maxDistanceInCascade,
  };
}

/**
 * Reshuffles movable candies on the board when no valid moves remain,
 * preserving exact candy counts and all cell/obstacle properties.
 * Guarantees no immediate matches and at least one valid move when possible.
 */
export function reshuffleBoard(
  currentGrid: BoardGrid,
  rng: () => number = Math.random
): BoardGrid {
  const { rows, cols } = getGridDimensions(currentGrid);
  const movableCoords: CellCoord[] = [];
  const movableCandies: Candy[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = currentGrid[r]?.[c];
      if (canCellBeSwapped(cell) && cell.candy) {
        movableCoords.push({ r, c });
        movableCandies.push({ ...cell.candy });
      }
    }
  }

  if (movableCoords.length < 3) {
    return cloneBoardGrid(currentGrid);
  }

  const buildCandidate = (candies: Candy[]): BoardGrid => {
    const candidate = cloneBoardGrid(currentGrid);
    for (let i = 0; i < movableCoords.length; i++) {
      const { r, c } = movableCoords[i];
      candidate[r][c].candy = { ...candies[i] };
    }
    return candidate;
  };

  const shuffleInPlace = (items: Candy[]) => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
  };

  // Primary pass: random Fisher-Yates shuffles checking match-free + valid move
  for (let attempt = 0; attempt < 120; attempt++) {
    const pool = movableCandies.map((c) => ({ ...c }));
    shuffleInPlace(pool);
    const candidate = buildCandidate(pool);
    if (checkMatchesInGrid(candidate).matchedSet.size === 0 && hasPossibleMoves(candidate)) {
      return candidate;
    }
  }

  // Repair fallback: resolve any accidental matches, then pair-swap until a valid move exists
  const pool = movableCandies.map((c) => ({ ...c }));
  shuffleInPlace(pool);
  const candidate = buildCandidate(pool);

  const movableKeySet = new Set(movableCoords.map(({ r, c }) => `${r},${c}`));

  for (let step = 0; step < 150; step++) {
    const { matchedSet } = checkMatchesInGrid(candidate);
    if (matchedSet.size === 0) break;

    const firstMatchedKey = Array.from(matchedSet).find((key) => movableKeySet.has(key));
    if (!firstMatchedKey) break;

    const [r1, c1] = firstMatchedKey.split(',').map(Number);
    const sourceCandy = candidate[r1][c1].candy;
    let swapped = false;

    for (let tryIdx = 0; tryIdx < movableCoords.length; tryIdx++) {
      const target = movableCoords[Math.floor(rng() * movableCoords.length)];
      const targetCandy = candidate[target.r][target.c].candy;
      if (!targetCandy || targetCandy.color === sourceCandy?.color) continue;

      candidate[r1][c1].candy = targetCandy;
      candidate[target.r][target.c].candy = sourceCandy;

      const afterCount = checkMatchesInGrid(candidate).matchedSet.size;
      if (afterCount < matchedSet.size) {
        swapped = true;
        break;
      }

      // Revert if swap didn't reduce matches
      candidate[r1][c1].candy = sourceCandy;
      candidate[target.r][target.c].candy = targetCandy;
    }

    if (!swapped) {
      const fallback = movableCoords[Math.floor(rng() * movableCoords.length)];
      const temp = candidate[r1][c1].candy;
      candidate[r1][c1].candy = candidate[fallback.r][fallback.c].candy;
      candidate[fallback.r][fallback.c].candy = temp;
    }
  }

  if (checkMatchesInGrid(candidate).matchedSet.size === 0 && hasPossibleMoves(candidate)) {
    return candidate;
  }

  // Pair-swap search for a valid move while keeping board match-free
  for (let i = 0; i < movableCoords.length; i++) {
    for (let j = i + 1; j < movableCoords.length; j++) {
      const a = movableCoords[i];
      const b = movableCoords[j];
      if (candidate[a.r][a.c].candy?.color === candidate[b.r][b.c].candy?.color) continue;

      const temp = candidate[a.r][a.c].candy;
      candidate[a.r][a.c].candy = candidate[b.r][b.c].candy;
      candidate[b.r][b.c].candy = temp;

      if (checkMatchesInGrid(candidate).matchedSet.size === 0 && hasPossibleMoves(candidate)) {
        return candidate;
      }

      candidate[b.r][b.c].candy = candidate[a.r][a.c].candy;
      candidate[a.r][a.c].candy = temp;
    }
  }

  return checkMatchesInGrid(candidate).matchedSet.size === 0 ? candidate : cloneBoardGrid(currentGrid);
}

/**
 * Computes earned stars (0–3) from score and level star thresholds.
 */
export function calculateStarsForScore(
  score: number,
  starScores: [number, number, number]
): number {
  if (score >= starScores[2]) return 3;
  if (score >= starScores[1]) return 2;
  if (score >= starScores[0]) return 1;
  return 0;
}

/**
 * Checks whether all level candy collection goals have been met.
 */
export function areGoalsSatisfied(
  goals: LevelGoal[] | undefined,
  counts: Record<string, number>
): boolean {
  if (!goals || goals.length === 0) return true;
  return goals.every((g) => (counts[g.candyType] || 0) >= g.requiredCount);
}

/**
 * Summarizes initial board obstacles, jelly cells, locks, and non-playable cells.
 */
export function countBoardObstacles(grid: BoardGrid): BoardObstacleSummary {
  const { rows, cols } = getGridDimensions(grid);
  let totalJellyCells = 0;
  let lockedCount = 0;
  let nonPlayableCount = 0;
  const blockerCounts: Record<string, number> = {};

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r]?.[c];
      if (!cell || !cell.playable) {
        nonPlayableCount++;
        continue;
      }
      if (cell.jellyLayers > 0) {
        totalJellyCells++;
      }
      if (cell.blocker !== null) {
        blockerCounts[cell.blocker] = (blockerCounts[cell.blocker] || 0) + 1;
      }
      if (cell.isLocked) {
        lockedCount++;
      }
    }
  }

  return {
    totalJellyCells,
    blockerCounts,
    lockedCount,
    nonPlayableCount,
  };
}

export function createInitialObjectiveProgress(): ObjectiveProgressState {
  return {
    candyCounts: {},
    jellyCleared: 0,
    blockerBrokenCounts: {},
    specialCounts: {},
    score: 0,
  };
}

/**
 * Resolves a level's effective objective list, preserving 100% compatibility with LevelGoal[].
 */
export function getEffectiveObjectives(level: Pick<LevelInfo, 'objectives' | 'goals' | 'targetScore'>): LevelObjective[] {
  if (level.objectives && level.objectives.length > 0) {
    return level.objectives;
  }
  if (level.goals && level.goals.length > 0) {
    return level.goals.map((g) => ({
      id: `candy-${g.candyType}`,
      type: 'collect_candy',
      candyType: g.candyType,
      requiredCount: g.requiredCount,
    }));
  }
  return [
    {
      id: 'reach-score',
      type: 'reach_score',
      targetScore: level.targetScore,
    },
  ];
}

export function countConsumedSpecialsForType(
  specialCounts: Record<string, number>,
  specialType: Exclude<SpecialCandyType, null> | 'striped' | 'any'
): number {
  if (specialType === 'striped') {
    return (specialCounts['striped_h'] || 0) + (specialCounts['striped_v'] || 0);
  }
  if (specialType === 'any') {
    return (
      (specialCounts['striped_h'] || 0) +
      (specialCounts['striped_v'] || 0) +
      (specialCounts['wrapped'] || 0) +
      (specialCounts['color_bomb'] || 0)
    );
  }
  return specialCounts[specialType] || 0;
}

/**
 * Evaluates current progress against each objective simultaneously without double-counting.
 */
export function evaluateObjectives(
  objectives: LevelObjective[],
  progress: ObjectiveProgressState,
  initialObstacles?: BoardObstacleSummary
): ResolvedObjective[] {
  return objectives.map((objective, idx) => {
    let current = 0;
    let target = 0;

    switch (objective.type) {
      case 'collect_candy':
        current = progress.candyCounts[objective.candyType] || 0;
        target = objective.requiredCount;
        break;
      case 'clear_jelly':
        current = progress.jellyCleared;
        target = objective.requiredCount ?? initialObstacles?.totalJellyCells ?? 0;
        break;
      case 'break_blocker':
        current = progress.blockerBrokenCounts[objective.blockerType] || 0;
        target =
          objective.requiredCount ??
          initialObstacles?.blockerCounts[objective.blockerType] ??
          0;
        break;
      case 'collect_special':
        current = countConsumedSpecialsForType(progress.specialCounts, objective.specialType);
        target = objective.requiredCount;
        break;
      case 'reach_score':
        current = progress.score;
        target = objective.targetScore;
        break;
    }

    const remaining = Math.max(0, target - current);
    return {
      key: objective.id ?? `${objective.type}-${idx}`,
      objective,
      current,
      target,
      remaining,
      isComplete: remaining === 0,
    };
  });
}

export function areAllObjectivesSatisfied(
  objectives: LevelObjective[],
  progress: ObjectiveProgressState,
  initialObstacles?: BoardObstacleSummary
): boolean {
  if (objectives.length === 0) return true;
  return evaluateObjectives(objectives, progress, initialObstacles).every(
    (item) => item.isComplete
  );
}

export interface SugarCrushPickOptions {
  rng?: () => number;
  excludeKeys?: Set<string>;
}

/**
 * Randomly picks a playable, unblocked, unlocked cell across the board to convert into a
 * Sugar Crush striped candy blast from remaining unused moves.
 * Prefers normal candies before falling back to non-color-bomb specials.
 */
export function pickSugarCrushTargetCoord(
  grid: BoardGrid,
  _stepIndex = 0,
  options?: SugarCrushPickOptions
): CellCoord | null {
  const { rows, cols } = getGridDimensions(grid);
  const normalCandidates: CellCoord[] = [];
  const fallbackCandidates: CellCoord[] = [];
  const excludeKeys = options?.excludeKeys;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      if (excludeKeys?.has(key)) continue;
      const cell = grid[r]?.[c];
      if (!canClearCandyAtCell(cell)) continue;
      if (cell.candy?.special === null) {
        normalCandidates.push({ r, c });
      } else if (cell.candy?.special !== 'color_bomb') {
        fallbackCandidates.push({ r, c });
      }
    }
  }

  const pool = normalCandidates.length > 0 ? normalCandidates : fallbackCandidates;
  if (pool.length === 0) return null;

  const rng = options?.rng ?? Math.random;
  const raw = rng();
  const clamped = Number.isFinite(raw) ? Math.min(0.999999999999, Math.max(0, raw)) : 0;
  const chosenIndex = Math.floor(clamped * pool.length);
  return pool[chosenIndex];
}

/**
 * Picks a horizontal or vertical striped orientation for a Sugar Crush bonus candy.
 */
export function pickSugarCrushStripedOrientation(
  rng: () => number = Math.random
): 'striped_h' | 'striped_v' {
  return rng() < 0.5 ? 'striped_h' : 'striped_v';
}

/**
 * Finds the current grid coordinate of a pending Sugar Crush bonus candy by its tracked ID.
 */
export function findSugarCrushTokenCoord(
  grid: BoardGrid,
  tokenId: number
): CellCoord | null {
  const { rows, cols } = getGridDimensions(grid);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r]?.[c]?.candy?.sugarCrushId === tokenId) {
        return { r, c };
      }
    }
  }
  return null;
}

export const SUGAR_CRUSH_BEAM_STEP_MS = 50;
export const SUGAR_CRUSH_POP_DURATION_MS = 260;

export interface SugarCrushBeamSegment {
  r: number;
  c: number;
  direction: 'left' | 'right' | 'up' | 'down';
  color: CandyShape;
  startDelayMs: number;
  travelMs: number;
  spanCells: number;
}

export interface SugarCrushBlastTimingResult {
  cellPopDelays: Record<string, number>;
  beamSegments: SugarCrushBeamSegment[];
  maxCellDelayMs: number;
  maxBeamEndMs: number;
  totalBlastWaitMs: number;
}

/**
 * Computes synchronized split-beam travel durations and per-cell pop delays from
 * resolveSpecialActivations BFS events so candies vanish progressively as beams arrive.
 */
export function computeSugarCrushBlastTiming(
  activationEvents: SpecialActivationEvent[],
  boardRows: number,
  boardCols: number,
  stepMs = SUGAR_CRUSH_BEAM_STEP_MS
): SugarCrushBlastTimingResult {
  const cellPopDelays: Record<string, number> = {};
  const beamSegments: SugarCrushBeamSegment[] = [];

  for (const ev of activationEvents) {
    const originKey = `${ev.coord.r},${ev.coord.c}`;
    const triggerDelayMs = cellPopDelays[originKey] ?? 0;
    if (cellPopDelays[originKey] === undefined || triggerDelayMs < cellPopDelays[originKey]) {
      cellPopDelays[originKey] = triggerDelayMs;
    }

    if (ev.special === 'striped_h') {
      const leftSpan = Math.max(0.5, ev.coord.c + 0.5);
      const rightSpan = Math.max(0.5, boardCols - (ev.coord.c + 0.5));
      beamSegments.push(
        {
          r: ev.coord.r,
          c: ev.coord.c,
          direction: 'left',
          color: ev.color,
          startDelayMs: triggerDelayMs,
          travelMs: Math.round(leftSpan * stepMs),
          spanCells: leftSpan,
        },
        {
          r: ev.coord.r,
          c: ev.coord.c,
          direction: 'right',
          color: ev.color,
          startDelayMs: triggerDelayMs,
          travelMs: Math.round(rightSpan * stepMs),
          spanCells: rightSpan,
        }
      );
    } else if (ev.special === 'striped_v') {
      const upSpan = Math.max(0.5, ev.coord.r + 0.5);
      const downSpan = Math.max(0.5, boardRows - (ev.coord.r + 0.5));
      beamSegments.push(
        {
          r: ev.coord.r,
          c: ev.coord.c,
          direction: 'up',
          color: ev.color,
          startDelayMs: triggerDelayMs,
          travelMs: Math.round(upSpan * stepMs),
          spanCells: upSpan,
        },
        {
          r: ev.coord.r,
          c: ev.coord.c,
          direction: 'down',
          color: ev.color,
          startDelayMs: triggerDelayMs,
          travelMs: Math.round(downSpan * stepMs),
          spanCells: downSpan,
        }
      );
    }

    for (const target of ev.affectedCells) {
      const targetKey = `${target.r},${target.c}`;
      let dist = 0;
      if (ev.special === 'striped_h') {
        dist = Math.abs(target.c - ev.coord.c);
      } else if (ev.special === 'striped_v') {
        dist = Math.abs(target.r - ev.coord.r);
      } else if (ev.special === 'wrapped') {
        dist = Math.max(Math.abs(target.r - ev.coord.r), Math.abs(target.c - ev.coord.c));
      }
      const arrivalMs = triggerDelayMs + dist * stepMs;
      if (cellPopDelays[targetKey] === undefined || arrivalMs < cellPopDelays[targetKey]) {
        cellPopDelays[targetKey] = arrivalMs;
      }
    }
  }

  let maxCellDelayMs = 0;
  for (const delay of Object.values(cellPopDelays)) {
    if (delay > maxCellDelayMs) maxCellDelayMs = delay;
  }

  let maxBeamEndMs = 0;
  for (const seg of beamSegments) {
    const endMs = seg.startDelayMs + seg.travelMs;
    if (endMs > maxBeamEndMs) maxBeamEndMs = endMs;
  }

  const totalBlastWaitMs = Math.max(
    SUGAR_CRUSH_POP_DURATION_MS,
    maxBeamEndMs + 100,
    maxCellDelayMs + SUGAR_CRUSH_POP_DURATION_MS + 20
  );

  return {
    cellPopDelays,
    beamSegments,
    maxCellDelayMs,
    maxBeamEndMs,
    totalBlastWaitMs,
  };
}

export const COLOR_BOMB_CHARGE_DURATION_MS = 240;
export const COLOR_BOMB_MAX_STAGGER_WINDOW_MS = 680;
export const COLOR_BOMB_MIN_STAGGER_MS = 22;
export const COLOR_BOMB_MAX_STAGGER_MS = 58;
export const COLOR_BOMB_ZAP_BASE_TRAVEL_MS = 175;
export const COLOR_BOMB_ZAP_DIST_TRAVEL_MS = 22;
export const COLOR_BOMB_ZAP_FADE_MS = 220;
export const COLOR_BOMB_POP_DURATION_MS = 340;
export const COLOR_BOMB_MAX_VISUAL_BEAMS = 14;

export interface ColorBombZapBeam {
  fromR: number;
  fromC: number;
  toR: number;
  toC: number;
  startDelayMs: number;
  travelMs: number;
  distanceCells: number;
  targetColor: CandyShape;
}

export interface ColorBombPolishTimingResult {
  cellPopDelays: Record<string, number>;
  zapBeams: ColorBombZapBeam[];
  maxCellDelayMs: number;
  maxZapEndMs: number;
  totalWaitMs: number;
}

function isColorBombEventType(
  special: SpecialActivationEvent['special']
): boolean {
  return (
    special === 'color_bomb' ||
    special === 'COLOR_BOMB_STRIPED' ||
    special === 'COLOR_BOMB_WRAPPED' ||
    special === 'COLOR_BOMB_COLOR_BOMB'
  );
}

/**
 * Computes outward rainbow zap beam timings and staggered sequential pop delays
 * for Color Bomb activations (and any downstream chained special activations).
 */
export function computeColorBombPolishTiming(
  activationEvents: SpecialActivationEvent[],
  _boardRows: number,
  _boardCols: number
): ColorBombPolishTimingResult {
  const cellPopDelays: Record<string, number> = {};
  const zapBeams: ColorBombZapBeam[] = [];

  const setMinPopDelay = (key: string, delayMs: number) => {
    if (cellPopDelays[key] === undefined || delayMs < cellPopDelays[key]) {
      cellPopDelays[key] = delayMs;
    }
  };

  for (const ev of activationEvents) {
    const originKey = `${ev.coord.r},${ev.coord.c}`;
    const triggerDelayMs = cellPopDelays[originKey] ?? 0;

    if (isColorBombEventType(ev.special)) {
      const uniqueTargets: CellCoord[] = [];
      const seenKeys = new Set<string>();
      for (const target of ev.affectedCells) {
        if (target.r === ev.coord.r && target.c === ev.coord.c) continue;
        const key = `${target.r},${target.c}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueTargets.push(target);
        }
      }

      uniqueTargets.sort((a, b) => {
        const dA = (a.r - ev.coord.r) ** 2 + (a.c - ev.coord.c) ** 2;
        const dB = (b.r - ev.coord.r) ** 2 + (b.c - ev.coord.c) ** 2;
        return dA - dB || a.r - b.r || a.c - b.c;
      });

      const staggerMs =
        uniqueTargets.length <= 1
          ? 0
          : Math.max(
              COLOR_BOMB_MIN_STAGGER_MS,
              Math.min(
                COLOR_BOMB_MAX_STAGGER_MS,
                Math.round(COLOR_BOMB_MAX_STAGGER_WINDOW_MS / uniqueTargets.length)
              )
            );

      const visualBeamStride =
        uniqueTargets.length > COLOR_BOMB_MAX_VISUAL_BEAMS
          ? Math.ceil(uniqueTargets.length / COLOR_BOMB_MAX_VISUAL_BEAMS)
          : 1;

      uniqueTargets.forEach((target, idx) => {
        const dist = Math.hypot(target.r - ev.coord.r, target.c - ev.coord.c);
        const launchDelayMs = triggerDelayMs + idx * staggerMs;
        const travelMs =
          COLOR_BOMB_ZAP_BASE_TRAVEL_MS +
          Math.round(dist * COLOR_BOMB_ZAP_DIST_TRAVEL_MS);
        // Trigger candy pop and particle burst right as the eased beam tip reaches the target
        const popDelayMs = launchDelayMs + Math.round(travelMs * 0.9);
        setMinPopDelay(`${target.r},${target.c}`, popDelayMs);

        if (idx % visualBeamStride === 0 || idx === uniqueTargets.length - 1) {
          zapBeams.push({
            fromR: ev.coord.r,
            fromC: ev.coord.c,
            toR: target.r,
            toC: target.c,
            startDelayMs: launchDelayMs,
            travelMs,
            distanceCells: dist,
            targetColor: ev.targetColor ?? ev.color,
          });
        }
      });

      const lastLaunchDelayMs =
        uniqueTargets.length > 0
          ? triggerDelayMs + (uniqueTargets.length - 1) * staggerMs
          : triggerDelayMs;
      setMinPopDelay(originKey, lastLaunchDelayMs + 110);
    } else {
      setMinPopDelay(originKey, triggerDelayMs);
      for (const target of ev.affectedCells) {
        let dist = 0;
        if (ev.special === 'striped_h') {
          dist = Math.abs(target.c - ev.coord.c);
        } else if (ev.special === 'striped_v') {
          dist = Math.abs(target.r - ev.coord.r);
        } else if (ev.special === 'wrapped') {
          dist = Math.max(
            Math.abs(target.r - ev.coord.r),
            Math.abs(target.c - ev.coord.c)
          );
        } else {
          dist = Math.hypot(target.r - ev.coord.r, target.c - ev.coord.c);
        }
        setMinPopDelay(
          `${target.r},${target.c}`,
          triggerDelayMs + dist * SUGAR_CRUSH_BEAM_STEP_MS
        );
      }
    }
  }

  let maxCellDelayMs = 0;
  for (const delay of Object.values(cellPopDelays)) {
    if (delay > maxCellDelayMs) maxCellDelayMs = delay;
  }

  let maxZapEndMs = 0;
  for (const beam of zapBeams) {
    const endMs = beam.startDelayMs + beam.travelMs;
    if (endMs > maxZapEndMs) maxZapEndMs = endMs;
  }

  const totalWaitMs = Math.max(
    COLOR_BOMB_POP_DURATION_MS,
    maxZapEndMs + COLOR_BOMB_ZAP_FADE_MS + 20,
    maxCellDelayMs + COLOR_BOMB_POP_DURATION_MS + 30
  );

  return {
    cellPopDelays,
    zapBeams,
    maxCellDelayMs,
    maxZapEndMs,
    totalWaitMs,
  };
}

/**
 * Places selected pre-game boosters safely onto playable, unblocked, unlocked normal candies
 * without creating immediate matches or breaking valid moves.
 */
export function applyPreGameBoostersToGrid(
  grid: BoardGrid,
  boosters: PreGameBoosterType[]
): BoardGrid {
  const uniqueBoosters = Array.from(new Set(boosters));
  if (uniqueBoosters.length === 0) {
    return cloneBoardGrid(grid);
  }

  let workingGrid = cloneBoardGrid(grid);
  const { rows, cols } = getGridDimensions(workingGrid);

  const pickSpecialType = (booster: PreGameBoosterType, idx: number): SpecialCandyType => {
    if (booster === 'color_bomb') return 'color_bomb';
    if (booster === 'wrapped') return 'wrapped';
    return idx % 2 === 0 ? 'striped_h' : 'striped_v';
  };

  const centerR = (rows - 1) / 2;
  const centerC = (cols - 1) / 2;

  uniqueBoosters.forEach((booster, bIdx) => {
    const candidates: CellCoord[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = workingGrid[r]?.[c];
        if (
          cell &&
          cell.playable &&
          cell.blocker === null &&
          !cell.isLocked &&
          cell.candy !== null &&
          cell.candy.special === null
        ) {
          candidates.push({ r, c });
        }
      }
    }

    if (candidates.length === 0) return;

    // Prefer interior, well-spaced positions deterministically
    const scoredCandidates = [...candidates].sort((a, b) => {
      const distA = Math.abs(a.r - centerR) + Math.abs(a.c - centerC);
      const distB = Math.abs(b.r - centerR) + Math.abs(b.c - centerC);
      return distA - distB;
    });

    const specialType = pickSpecialType(booster, bIdx);
    const startOffset = (bIdx * 5) % Math.max(1, Math.min(12, scoredCandidates.length));

    for (let i = 0; i < scoredCandidates.length; i++) {
      const coord = scoredCandidates[(startOffset + i) % scoredCandidates.length];
      const testGrid = cloneBoardGrid(workingGrid);
      const targetCandy = testGrid[coord.r][coord.c].candy;
      if (!targetCandy) continue;

      testGrid[coord.r][coord.c].candy = createCandy(targetCandy.color, specialType);

      if (checkMatchesInGrid(testGrid).matchedSet.size === 0 && hasPossibleMoves(testGrid)) {
        workingGrid = testGrid;
        break;
      }
    }
  });

  return workingGrid;
}

/**
 * Generates a fresh playable board for a level and applies each unique paid
 * pre-game booster at most once onto normal candies.
 */
export function createLevelBoardWithPreGameBoosters(
  levelNumber: number,
  boardLayout?: BoardLayoutConfig,
  boosters: PreGameBoosterType[] = [],
  options?: GenerateBoardOptions
): BoardGrid {
  const baseGrid = generateBoardForLevel(levelNumber, boardLayout, options);
  const uniqueBoosters = Array.from(new Set(boosters));
  return uniqueBoosters.length > 0
    ? applyPreGameBoostersToGrid(baseGrid, uniqueBoosters)
    : baseGrid;
}

/**
 * Determines which pre-game boosters remain active when resetting a board.
 * Active/pre-move restarts preserve already-paid boosters; post-victory replays
 * and post-game-over retries clear them so boosters are not carried over for free.
 */
export function resolveRestartPreGameBoosters(
  paidBoosters: PreGameBoosterType[],
  context: { isVictoryCompleted: boolean; isGameOver: boolean }
): PreGameBoosterType[] {
  if (context.isVictoryCompleted || context.isGameOver) {
    return [];
  }
  return Array.from(new Set(paidBoosters));
}

/**
 * Checks whether a cell can be targeted by the in-game Lollipop Hammer booster.
 * Rejects non-playable holes, indestructible stone blockers, and empty spaces.
 */
export function canHammerHitCell(cell: BoardCell | undefined): boolean {
  if (!cell || !cell.playable) return false;
  if (cell.blocker !== null) {
    return isDamagableBlocker(cell.blocker);
  }
  return cell.candy !== null;
}

export interface HammerHitResult {
  applied: boolean;
  updatedGrid: BoardGrid;
  candiesToRemove: Set<string>;
  consumedSpecials: Array<Exclude<SpecialCandyType, null>>;
  obstacleUpdate: ObstacleUpdateResult;
  activationEvents: SpecialActivationEvent[];
}

/**
 * Applies a single Lollipop Hammer strike on a valid target cell, respecting locks,
 * blocker health, jelly layers, and special candy chain activations.
 */
export function applyLollipopHammer(
  currentGrid: BoardGrid,
  coord: CellCoord
): HammerHitResult {
  const targetCell = currentGrid[coord.r]?.[coord.c];
  const emptyObstacleResult: ObstacleUpdateResult = {
    updatedGrid: cloneBoardGrid(currentGrid),
    candiesToRemove: new Set<string>(),
    unlockedCells: [],
    damagedBlockers: [],
    brokenBlockers: [],
    jellyReducedCells: [],
    clearedJellyCount: 0,
    blockerBrokenCounts: {},
  };

  if (!canHammerHitCell(targetCell)) {
    return {
      applied: false,
      updatedGrid: emptyObstacleResult.updatedGrid,
      candiesToRemove: new Set<string>(),
      consumedSpecials: [],
      obstacleUpdate: emptyObstacleResult,
      activationEvents: [],
    };
  }

  const key = `${coord.r},${coord.c}`;

  // If hammering a playable, unblocked, unlocked special candy, trigger its special activation
  if (
    targetCell.blocker === null &&
    !targetCell.isLocked &&
    targetCell.candy?.special
  ) {
    const activationResult = resolveSpecialActivations(
      currentGrid,
      new Set([key])
    );
    const obstacleUpdate = resolveObstacleAndJellyUpdates(
      activationResult.resolvedGrid,
      activationResult.allClearedCells,
      new Set(),
      activationResult.specialHitCells
    );
    return {
      applied: true,
      updatedGrid: obstacleUpdate.updatedGrid,
      candiesToRemove: obstacleUpdate.candiesToRemove,
      consumedSpecials: activationResult.consumedSpecials,
      obstacleUpdate,
      activationEvents: activationResult.activationEvents,
    };
  }

  // Normal candy, locked candy, or damagable blocker: hit ONLY the selected cell
  const initialClear =
    targetCell.blocker === null && !targetCell.isLocked && targetCell.candy !== null
      ? new Set([key])
      : new Set<string>();
  const specialHits = new Set([key]);

  const obstacleUpdate = resolveObstacleAndJellyUpdates(
    currentGrid,
    initialClear,
    new Set(),
    specialHits
  );

  return {
    applied: true,
    updatedGrid: obstacleUpdate.updatedGrid,
    candiesToRemove: obstacleUpdate.candiesToRemove,
    consumedSpecials: [],
    obstacleUpdate,
    activationEvents: [],
  };
}

export interface HintMoveSuggestion {
  from: CellCoord;
  to: CellCoord;
  score: number;
}

export interface FindBestHintMoveOptions {
  excludePairKey?: string;
}

function doesSpecialMatchObjectiveType(
  special: Exclude<SpecialCandyType, null>,
  objectiveType: Exclude<SpecialCandyType, null> | 'striped' | 'any'
): boolean {
  if (objectiveType === 'any') return true;
  if (objectiveType === 'striped') {
    return special === 'striped_h' || special === 'striped_v';
  }
  return special === objectiveType;
}

/**
 * Pure hint-finding helper that evaluates all legal adjacent swaps (normal matches,
 * special-candy combinations, and Color Bomb swaps) without mutating the input grid.
 * Prefers moves that advance incomplete level objectives, breaking ties by match/combo strength.
 */
export function findBestHintMove(
  currentGrid: BoardGrid,
  resolvedObjectives: ResolvedObjective[] = [],
  options?: FindBestHintMoveOptions
): HintMoveSuggestion | null {
  const { rows, cols } = getGridDimensions(currentGrid);
  if (rows === 0 || cols === 0) return null;

  const incompleteObjectives = resolvedObjectives.filter(
    (item) => !item.isComplete && item.remaining > 0
  );

  let bestHint: HintMoveSuggestion | null = null;
  let bestSortKey = -Infinity;

  const evaluatePair = (from: CellCoord, to: CellCoord) => {
    const fromCell = currentGrid[from.r]?.[from.c];
    const toCell = currentGrid[to.r]?.[to.c];
    if (!canCellBeSwapped(fromCell) || !canCellBeSwapped(toCell)) return;

    const swapRes = validateAndSwapCells(currentGrid, from, to);
    if (!swapRes.isValid) return;

    const allowSpecialCreation = !swapRes.specialComboTrigger;
    const clusterRes = resolveMatchClusters(
      swapRes.swappedGrid,
      swapRes.matchResult,
      allowSpecialCreation
    );
    const protectedKeys = new Set(
      clusterRes.specialSpawns.map((spawn) => `${spawn.coord.r},${spawn.coord.c}`)
    );

    const activationRes = resolveSpecialActivations(
      swapRes.swappedGrid,
      clusterRes.cellsToClear,
      {
        protectedKeys,
        colorBombTrigger: swapRes.colorBombTrigger,
        specialComboTrigger: swapRes.specialComboTrigger,
        initialMatchedSet: swapRes.matchResult.matchedSet,
      }
    );

    const preObstacleGrid =
      clusterRes.specialSpawns.length > 0
        ? clusterRes.gridWithSpawns
        : activationRes.resolvedGrid;

    const obstacleRes = resolveObstacleAndJellyUpdates(
      preObstacleGrid,
      activationRes.allClearedCells,
      swapRes.matchResult.matchedSet,
      activationRes.specialHitCells
    );

    // Tally cleared candy colors without double counting color bombs
    const clearedColorCounts: Record<string, number> = {};
    obstacleRes.candiesToRemove.forEach((key) => {
      const [kr, kc] = key.split(',').map(Number);
      const cCandy = obstacleRes.updatedGrid[kr]?.[kc]?.candy;
      if (cCandy && cCandy.special !== 'color_bomb') {
        clearedColorCounts[cCandy.color] = (clearedColorCounts[cCandy.color] || 0) + 1;
      }
    });

    // 1. Objective-progress score (highest priority when incomplete objectives exist)
    let objectiveScore = 0;
    for (const resolved of incompleteObjectives) {
      const obj = resolved.objective;
      switch (obj.type) {
        case 'clear_jelly': {
          const cleared = Math.min(resolved.remaining, obstacleRes.clearedJellyCount);
          objectiveScore += cleared * 6000 + obstacleRes.jellyReducedCells.length * 1800;
          break;
        }
        case 'break_blocker': {
          const broken = Math.min(
            resolved.remaining,
            obstacleRes.blockerBrokenCounts[obj.blockerType] || 0
          );
          const damagedTargetCount = obstacleRes.damagedBlockers.filter(
            (b) => b.type === obj.blockerType
          ).length;
          objectiveScore += broken * 5500 + damagedTargetCount * 1500;
          break;
        }
        case 'collect_candy': {
          const collected = Math.min(
            resolved.remaining,
            clearedColorCounts[obj.candyType] || 0
          );
          objectiveScore += collected * 2200;
          break;
        }
        case 'collect_special': {
          let matchingConsumed = 0;
          for (const sp of activationRes.consumedSpecials) {
            if (doesSpecialMatchObjectiveType(sp, obj.specialType)) {
              matchingConsumed += 1;
            }
          }
          let matchingCreated = 0;
          for (const spawn of clusterRes.specialSpawns) {
            if (spawn.candy.special && doesSpecialMatchObjectiveType(spawn.candy.special, obj.specialType)) {
              matchingCreated += 1;
            }
          }
          objectiveScore +=
            Math.min(resolved.remaining, matchingConsumed) * 5000 +
            matchingCreated * 1500;
          break;
        }
        case 'reach_score': {
          objectiveScore += obstacleRes.candiesToRemove.size * 150;
          break;
        }
      }
    }

    // 2. Inherent match / special-combo strength tiebreaker
    let strengthScore = 0;
    if (swapRes.specialComboTrigger) {
      switch (swapRes.specialComboTrigger.comboType) {
        case 'COLOR_BOMB_COLOR_BOMB':
          strengthScore += 2400;
          break;
        case 'COLOR_BOMB_STRIPED':
        case 'COLOR_BOMB_WRAPPED':
          strengthScore += 2000;
          break;
        case 'STRIPED_WRAPPED':
          strengthScore += 1600;
          break;
        case 'WRAPPED_WRAPPED':
          strengthScore += 1400;
          break;
        case 'STRIPED_STRIPED':
          strengthScore += 1300;
          break;
      }
    }
    if (swapRes.colorBombTrigger) {
      strengthScore += 1500;
    }

    for (const spawn of clusterRes.specialSpawns) {
      if (spawn.candy.special === 'color_bomb') strengthScore += 1800;
      else if (spawn.candy.special === 'wrapped') strengthScore += 1200;
      else if (spawn.candy.special === 'striped_h' || spawn.candy.special === 'striped_v') {
        strengthScore += 900;
      }
    }

    strengthScore += activationRes.activationEvents.length * 400;
    strengthScore += obstacleRes.candiesToRemove.size * 40;
    strengthScore += obstacleRes.unlockedCells.length * 200;
    strengthScore += obstacleRes.brokenBlockers.length * 120;
    strengthScore += obstacleRes.damagedBlockers.length * 60;
    strengthScore += obstacleRes.jellyReducedCells.length * 80;

    const totalScore = objectiveScore + strengthScore;
    const pairKey = `${from.r},${from.c}->${to.r},${to.c}`;
    const sortKey =
      options?.excludePairKey && options.excludePairKey === pairKey
        ? totalScore - 1
        : totalScore;

    if (sortKey > bestSortKey) {
      bestSortKey = sortKey;
      bestHint = {
        from: { ...from },
        to: { ...to },
        score: totalScore,
      };
    }
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) {
        evaluatePair({ r, c }, { r, c: c + 1 });
      }
      if (r + 1 < rows) {
        evaluatePair({ r, c }, { r: r + 1, c });
      }
    }
  }

  return bestHint;
}


