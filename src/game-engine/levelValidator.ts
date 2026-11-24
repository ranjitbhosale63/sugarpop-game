import {
  BlockerType,
  BoardGrid,
  CandyShape,
  LevelInfo,
  LevelObjective,
} from '../types/game';
import {
  ALL_CANDIES,
  CellCoord,
  applyGravityAndRefill,
  checkMatchesInGrid,
  countBoardObstacles,
  createSeededRng,
  generateBoardForLevel,
  getCandyPoolForLevel,
  getEffectiveObjectives,
  getGridDimensions,
  hasPossibleMoves,
  isDamagableBlocker,
  reshuffleBoard,
  resolveMatchClusters,
  resolveObstacleAndJellyUpdates,
  resolveSpecialActivations,
  validateAndSwapCells,
} from './boardEngine';

export interface LevelValidationError {
  levelNumber: number;
  field: string;
  message: string;
}

export interface LevelValidationResult {
  levelNumber: number;
  name: string;
  isValid: boolean;
  errors: LevelValidationError[];
  warnings: string[];
  boardSummary: {
    rows: number;
    cols: number;
    playableCells: number;
    swappableCells: number;
    totalJellyCells: number;
    blockerCounts: Record<string, number>;
    lockedCount: number;
    candyPoolSize: number;
  };
}

export interface CampaignValidationSummary {
  totalLevels: number;
  passedCount: number;
  failedCount: number;
  allPassed: boolean;
  results: LevelValidationResult[];
}

export interface LevelSimulationSeedResult {
  seed: number;
  initialMatchCount: number;
  initialValidMoveCount: number;
  hasInitialValidMove: boolean;
  swapCascadeSucceeded: boolean;
  activationEventsCount: number;
  chainTerminatedSafely: boolean;
  gravityPreservedInvariants: boolean;
  reshufflePreservedInvariants: boolean;
}

export interface LevelSimulationReport {
  levelNumber: number;
  name: string;
  world: string;
  difficulty: string;
  seedsTested: number;
  allSeedsValid: boolean;
  minInitialMoves: number;
  avgInitialMoves: number;
  maxInitialMoves: number;
  maxSpecialChainEvents: number;
  gravityInvariantFailures: number;
  reshuffleInvariantFailures: number;
  notes: string[];
  seedResults: LevelSimulationSeedResult[];
}

export interface CampaignSimulationSummary {
  totalLevels: number;
  passedCount: number;
  failedCount: number;
  allPassed: boolean;
  simulationScopeNote: string;
  reports: LevelSimulationReport[];
}

const VALID_CANDY_SHAPES = new Set<CandyShape>(ALL_CANDIES);
const VALID_BLOCKER_TYPES = new Set<Exclude<BlockerType, null>>([
  'frosting',
  'chocolate',
  'stone',
  'licorice',
]);

function coordKey(r: number, c: number): string {
  return `${r},${c}`;
}

export function enumerateValidSwapsInGrid(grid: BoardGrid): Array<{ from: CellCoord; to: CellCoord }> {
  const { rows, cols } = getGridDimensions(grid);
  const moves: Array<{ from: CellCoord; to: CellCoord }> = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r]?.[c];
      if (!cell || !cell.playable || cell.blocker !== null || cell.isLocked || !cell.candy) {
        continue;
      }

      if (c + 1 < cols) {
        const res = validateAndSwapCells(grid, { r, c }, { r, c: c + 1 });
        if (res.isValid) {
          moves.push({ from: { r, c }, to: { r, c: c + 1 } });
        }
      }
      if (r + 1 < rows) {
        const res = validateAndSwapCells(grid, { r, c }, { r: r + 1, c });
        if (res.isValid) {
          moves.push({ from: { r, c }, to: { r: r + 1, c } });
        }
      }
    }
  }

  return moves;
}

function summarizeGridCandyInventory(grid: BoardGrid): Record<string, number> {
  const counts: Record<string, number> = {};
  const { rows, cols } = getGridDimensions(grid);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r]?.[c];
      if (cell?.playable && cell.blocker === null && !cell.isLocked && cell.candy) {
        const token = `${cell.candy.color}:${cell.candy.special ?? 'none'}`;
        counts[token] = (counts[token] || 0) + 1;
      }
    }
  }
  return counts;
}

function verifyStaticCellInvariants(before: BoardGrid, after: BoardGrid): boolean {
  const dimA = getGridDimensions(before);
  const dimB = getGridDimensions(after);
  if (dimA.rows !== dimB.rows || dimA.cols !== dimB.cols) return false;

  for (let r = 0; r < dimA.rows; r++) {
    for (let c = 0; c < dimA.cols; c++) {
      const a = before[r][c];
      const b = after[r][c];
      if (a.playable !== b.playable) return false;
      if (a.jellyLayers !== b.jellyLayers) return false;
      if (a.isLocked !== b.isLocked) return false;
      if (a.blocker !== b.blocker) return false;
      if (a.blockerHealth !== b.blockerHealth) return false;
      if (!b.playable && b.candy !== null) return false;
      if (b.blocker !== null && b.candy !== null) return false;
      if (b.isLocked && JSON.stringify(a.candy) !== JSON.stringify(b.candy)) return false;
    }
  }
  return true;
}

/**
 * Validates a single LevelInfo configuration thoroughly before gameplay or compilation.
 */
export function validateLevelConfig(level: LevelInfo): LevelValidationResult {
  const errors: LevelValidationError[] = [];
  const warnings: string[] = [];
  const addError = (field: string, message: string) => {
    errors.push({ levelNumber: level.levelNumber, field, message });
  };

  if (!Number.isInteger(level.levelNumber) || level.levelNumber < 1) {
    addError('levelNumber', `Invalid levelNumber (${level.levelNumber}); must be integer >= 1.`);
  }
  if (!level.name || level.name.trim().length === 0) {
    addError('name', 'Level name must be a non-empty string.');
  }
  if (!Number.isInteger(level.maxMoves) || level.maxMoves <= 0 || level.maxMoves > 100) {
    addError('maxMoves', `Invalid maxMoves (${level.maxMoves}); expected 1..100.`);
  }
  if (typeof level.targetScore !== 'number' || !Number.isFinite(level.targetScore) || level.targetScore <= 0) {
    addError('targetScore', `Invalid targetScore (${level.targetScore}); must be > 0.`);
  }

  // Star threshold checks
  if (!Array.isArray(level.starScores) || level.starScores.length !== 3) {
    addError('starScores', 'starScores must be a tuple of 3 positive numbers.');
  } else {
    const [s1, s2, s3] = level.starScores;
    if (s1 <= 0 || s2 <= s1 || s3 <= s2) {
      addError(
        'starScores',
        `starScores [${s1}, ${s2}, ${s3}] must be strictly increasing positive numbers.`
      );
    }
  }

  // Board dimension checks
  const layout = level.boardLayout;
  const rows = layout?.rows ?? 8;
  const cols = layout?.cols ?? 8;
  if (!Number.isInteger(rows) || rows < 4 || rows > 12) {
    addError('boardLayout.rows', `Board rows (${rows}) must be an integer between 4 and 12.`);
  }
  if (!Number.isInteger(cols) || cols < 4 || cols > 12) {
    addError('boardLayout.cols', `Board cols (${cols}) must be an integer between 4 and 12.`);
  }

  const safeRows = Math.max(4, Math.min(12, Math.floor(rows || 8)));
  const safeCols = Math.max(4, Math.min(12, Math.floor(cols || 8)));

  const holeKeys = new Set<string>();
  const blockerKeys = new Set<string>();
  const jellyKeys = new Set<string>();
  const lockKeys = new Set<string>();

  const checkBounds = (field: string, r: number, c: number): boolean => {
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= safeRows || c < 0 || c >= safeCols) {
      addError(field, `Coordinate (${r}, ${c}) is out of bounds for ${safeRows}x${safeCols} board.`);
      return false;
    }
    return true;
  };

  layout?.nonPlayableCells?.forEach(({ r, c }) => {
    if (!checkBounds('boardLayout.nonPlayableCells', r, c)) return;
    const key = coordKey(r, c);
    if (holeKeys.has(key)) {
      addError('boardLayout.nonPlayableCells', `Duplicate hole coordinate (${r}, ${c}).`);
    }
    holeKeys.add(key);
  });

  layout?.blockerCells?.forEach(({ r, c, type, health }) => {
    if (!checkBounds('boardLayout.blockerCells', r, c)) return;
    const key = coordKey(r, c);
    if (!VALID_BLOCKER_TYPES.has(type)) {
      addError('boardLayout.blockerCells', `Unsupported blocker type '${String(type)}' at (${r}, ${c}).`);
    }
    if (holeKeys.has(key)) {
      addError('boardLayout.blockerCells', `Blocker at (${r}, ${c}) overlaps a non-playable hole.`);
    }
    if (blockerKeys.has(key)) {
      addError('boardLayout.blockerCells', `Duplicate blocker at (${r}, ${c}).`);
    }
    if (type === 'stone' && health !== undefined && health > 0) {
      addError('boardLayout.blockerCells', `Stone blocker at (${r}, ${c}) is indestructible and must not specify health > 0.`);
    }
    if (isDamagableBlocker(type) && health !== undefined && (!Number.isInteger(health) || health < 1 || health > 5)) {
      addError('boardLayout.blockerCells', `Blocker '${type}' at (${r}, ${c}) has invalid health (${health}); expected 1..5.`);
    }
    blockerKeys.add(key);
  });

  layout?.jellyCells?.forEach(({ r, c, layers }) => {
    if (!checkBounds('boardLayout.jellyCells', r, c)) return;
    const key = coordKey(r, c);
    if (holeKeys.has(key)) {
      addError('boardLayout.jellyCells', `Jelly cell at (${r}, ${c}) cannot sit on a non-playable hole.`);
    }
    if (jellyKeys.has(key)) {
      addError('boardLayout.jellyCells', `Duplicate jelly cell at (${r}, ${c}).`);
    }
    if (!Number.isInteger(layers) || layers < 1 || layers > 3) {
      addError('boardLayout.jellyCells', `Jelly layers (${layers}) at (${r}, ${c}) must be 1..3.`);
    }
    jellyKeys.add(key);
  });

  layout?.lockedCells?.forEach(({ r, c }) => {
    if (!checkBounds('boardLayout.lockedCells', r, c)) return;
    const key = coordKey(r, c);
    if (holeKeys.has(key)) {
      addError('boardLayout.lockedCells', `Locked cell at (${r}, ${c}) overlaps a non-playable hole.`);
    }
    if (blockerKeys.has(key)) {
      addError('boardLayout.lockedCells', `Locked cell at (${r}, ${c}) cannot overlap a blocker.`);
    }
    if (lockKeys.has(key)) {
      addError('boardLayout.lockedCells', `Duplicate locked cell at (${r}, ${c}).`);
    }
    lockKeys.add(key);
  });

  const spawnerKeys = new Set<string>();
  layout?.spawnerCells?.forEach(({ r, c }) => {
    if (!checkBounds('boardLayout.spawnerCells', r, c)) return;
    const key = coordKey(r, c);
    if (holeKeys.has(key)) {
      addError('boardLayout.spawnerCells', `Spawner at (${r}, ${c}) cannot be placed on a non-playable hole.`);
    }
    if (blockerKeys.has(key)) {
      addError('boardLayout.spawnerCells', `Spawner at (${r}, ${c}) cannot overlap a blocker.`);
    }
    if (spawnerKeys.has(key)) {
      addError('boardLayout.spawnerCells', `Duplicate spawner coordinate (${r}, ${c}).`);
    }
    spawnerKeys.add(key);
  });

  if (layout?.cells) {
    Object.entries(layout.cells).forEach(([key, cfg]) => {
      const [r, c] = key.split(',').map(Number);
      if (!checkBounds('boardLayout.cells', r, c)) return;
      if (cfg.playable === false && (cfg.jellyLayers || cfg.blocker || cfg.isLocked || cfg.isSpawner)) {
        addError('boardLayout.cells', `Non-playable cell (${r}, ${c}) cannot contain jelly, blocker, lock, or spawner.`);
      }
      if (cfg.jellyLayers !== undefined && (!Number.isInteger(cfg.jellyLayers) || cfg.jellyLayers < 0 || cfg.jellyLayers > 3)) {
        addError('boardLayout.cells', `Cell (${r}, ${c}) jellyLayers (${cfg.jellyLayers}) must be 0..3.`);
      }
    });
  }

  // Candy distribution checks
  if (level.candyDistribution?.candyPool) {
    const rawPool = level.candyDistribution.candyPool;
    const unique = Array.from(new Set(rawPool));
    if (unique.length !== rawPool.length) {
      addError('candyDistribution.candyPool', 'candyPool contains duplicate candy shapes.');
    }
    rawPool.forEach((shape) => {
      if (!VALID_CANDY_SHAPES.has(shape)) {
        addError('candyDistribution.candyPool', `Invalid candy shape '${shape}' in candyPool.`);
      }
    });
    if (unique.length < 4) {
      addError('candyDistribution.candyPool', `candyPool must have at least 4 distinct candy types (got ${unique.length}).`);
    }
  }

  if (level.candyDistribution?.weights) {
    Object.entries(level.candyDistribution.weights).forEach(([shape, weight]) => {
      if (!VALID_CANDY_SHAPES.has(shape as CandyShape)) {
        addError('candyDistribution.weights', `Unknown candy shape '${shape}' in weights.`);
      }
      if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
        addError('candyDistribution.weights', `Weight for '${shape}' must be a finite number > 0.`);
      }
    });
  }

  const candyPool = getCandyPoolForLevel(level.levelNumber, level.candyDistribution);
  const candyPoolSet = new Set<CandyShape>(candyPool);

  // Generate seeded board to measure concrete obstacle & swappable counts
  const rng = createSeededRng(1000 + level.levelNumber);
  const generatedGrid = generateBoardForLevel(level.levelNumber, level.boardLayout, {
    candyDistribution: level.candyDistribution,
    rng,
  });
  const obstacles = countBoardObstacles(generatedGrid);

  let playableCells = 0;
  let swappableCells = 0;
  for (let r = 0; r < generatedGrid.length; r++) {
    for (let c = 0; c < generatedGrid[r].length; c++) {
      const cell = generatedGrid[r][c];
      if (cell.playable) {
        playableCells++;
        if (cell.blocker === null && !cell.isLocked && cell.candy !== null) {
          swappableCells++;
        }
      }
    }
  }

  if (swappableCells < 16) {
    addError(
      'boardLayout',
      `Only ${swappableCells} swappable cells available; at least 16 required for reliable playability.`
    );
  }

  const initialMatches = checkMatchesInGrid(generatedGrid);
  if (initialMatches.matchedSet.size > 0) {
    addError(
      'boardGeneration',
      `Seeded board generated with ${initialMatches.matchedSet.size} pre-existing matched cells.`
    );
  }
  if (!hasPossibleMoves(generatedGrid)) {
    addError('boardGeneration', 'Seeded board has zero initial valid moves.');
  }

  // Verify non-playable cells are never spawners & all playable cells are reachable from explicit spawners
  const spawnerQueue: CellCoord[] = [];
  const reachablePlayable = new Set<string>();
  for (let r = 0; r < generatedGrid.length; r++) {
    for (let c = 0; c < generatedGrid[r].length; c++) {
      const cell = generatedGrid[r][c];
      if (!cell.playable && cell.isSpawner) {
        addError('spawners', `Non-playable hole (${r}, ${c}) must not be marked isSpawner.`);
      }
      if (cell.playable && cell.isSpawner) {
        reachablePlayable.add(`${r},${c}`);
        spawnerQueue.push({ r, c });
      }
    }
  }
  if (spawnerQueue.length === 0) {
    addError('spawners', 'Board must contain at least one playable spawn cell.');
  }
  while (spawnerQueue.length > 0) {
    const cur = spawnerQueue.shift()!;
    const nextR = cur.r + 1;
    if (nextR >= generatedGrid.length) continue;
    for (const nextC of [cur.c, cur.c - 1, cur.c + 1]) {
      if (nextC < 0 || nextC >= generatedGrid[nextR].length) continue;
      const k = `${nextR},${nextC}`;
      if (generatedGrid[nextR][nextC].playable && !reachablePlayable.has(k)) {
        reachablePlayable.add(k);
        spawnerQueue.push({ r: nextR, c: nextC });
      }
    }
  }
  for (let r = 0; r < generatedGrid.length; r++) {
    for (let c = 0; c < generatedGrid[r].length; c++) {
      if (generatedGrid[r][c].playable && !reachablePlayable.has(`${r},${c}`)) {
        addError('spawners', `Playable cell (${r}, ${c}) has no valid gravity path from any spawner.`);
      }
    }
  }

  // Objective checks against concrete board state
  const objectives: LevelObjective[] = getEffectiveObjectives(level);
  if (objectives.length === 0) {
    addError('objectives', 'Level must define at least one objective.');
  }

  objectives.forEach((obj, idx) => {
    switch (obj.type) {
      case 'collect_candy':
        if (!candyPoolSet.has(obj.candyType)) {
          addError(
            `objectives[${idx}]`,
            `Objective candyType '${obj.candyType}' does not spawn in this level's candyPool.`
          );
        }
        if (!Number.isInteger(obj.requiredCount) || obj.requiredCount <= 0) {
          addError(`objectives[${idx}]`, `collect_candy requiredCount (${obj.requiredCount}) must be > 0.`);
        }
        break;
      case 'clear_jelly': {
        const target = obj.requiredCount ?? obstacles.totalJellyCells;
        if (obstacles.totalJellyCells === 0) {
          addError(`objectives[${idx}]`, 'clear_jelly objective present, but board has 0 jelly cells.');
        } else if (target <= 0 || target > obstacles.totalJellyCells) {
          addError(
            `objectives[${idx}]`,
            `clear_jelly requires ${target} cells, but board only has ${obstacles.totalJellyCells}.`
          );
        }
        break;
      }
      case 'break_blocker': {
        if (obj.blockerType === 'stone') {
          addError(`objectives[${idx}]`, 'break_blocker cannot target indestructible stone blockers.');
          break;
        }
        const available = obstacles.blockerCounts[obj.blockerType] || 0;
        const target = obj.requiredCount ?? available;
        if (available === 0) {
          addError(
            `objectives[${idx}]`,
            `break_blocker('${obj.blockerType}') present, but board has 0 '${obj.blockerType}' blockers.`
          );
        } else if (target <= 0 || target > available) {
          addError(
            `objectives[${idx}]`,
            `break_blocker('${obj.blockerType}') requires ${target}, but board only has ${available}.`
          );
        }
        break;
      }
      case 'collect_special':
        if (!Number.isInteger(obj.requiredCount) || obj.requiredCount <= 0) {
          addError(`objectives[${idx}]`, `collect_special requiredCount (${obj.requiredCount}) must be > 0.`);
        }
        if (obj.specialType === 'color_bomb' && candyPool.length >= 6 && level.maxMoves < 18) {
          warnings.push('Color bomb objective with >=6 candy colors and <18 moves may feel tight.');
        }
        break;
      case 'reach_score':
        if (typeof obj.targetScore !== 'number' || !Number.isFinite(obj.targetScore) || obj.targetScore <= 0) {
          addError(`objectives[${idx}]`, `reach_score targetScore (${obj.targetScore}) must be > 0.`);
        }
        break;
    }
  });

  return {
    levelNumber: level.levelNumber,
    name: level.name,
    isValid: errors.length === 0,
    errors,
    warnings,
    boardSummary: {
      rows: safeRows,
      cols: safeCols,
      playableCells,
      swappableCells,
      totalJellyCells: obstacles.totalJellyCells,
      blockerCounts: obstacles.blockerCounts,
      lockedCount: obstacles.lockedCount,
      candyPoolSize: candyPool.length,
    },
  };
}

/**
 * Validates the entire level catalog and verifies unique sequential level numbering.
 */
export function validateAllLevels(levels: LevelInfo[]): CampaignValidationSummary {
  const seenNumbers = new Set<number>();
  const results = levels.map((level) => {
    const res = validateLevelConfig(level);
    if (seenNumbers.has(level.levelNumber)) {
      res.errors.push({
        levelNumber: level.levelNumber,
        field: 'levelNumber',
        message: `Duplicate levelNumber (${level.levelNumber}) in catalog.`,
      });
      res.isValid = false;
    }
    seenNumbers.add(level.levelNumber);
    return res;
  });

  const passedCount = results.filter((r) => r.isValid).length;
  return {
    totalLevels: levels.length,
    passedCount,
    failedCount: levels.length - passedCount,
    allPassed: passedCount === levels.length,
    results,
  };
}

/**
 * Deterministic multi-seed simulation checking board stability, valid move counts,
 * special-chain loop termination, gravity preservation, and reshuffle invariants.
 *
 * NOTE: This verifies structural & mechanical board validity across deterministic seeds;
 * it does NOT estimate human/AI level win-rate percentages.
 */
export function simulateLevelBoardSuite(
  level: LevelInfo,
  seeds: number[] = [101, 202, 303, 404, 505]
): LevelSimulationReport {
  const candyPool = getCandyPoolForLevel(level.levelNumber, level.candyDistribution);
  const seedResults: LevelSimulationSeedResult[] = [];
  let gravityInvariantFailures = 0;
  let reshuffleInvariantFailures = 0;
  let maxSpecialChainEvents = 0;
  const notes: string[] = [];

  for (const seed of seeds) {
    const rng = createSeededRng(seed * 97 + level.levelNumber);
    const initialGrid = generateBoardForLevel(level.levelNumber, level.boardLayout, {
      candyDistribution: level.candyDistribution,
      rng,
    });

    const initialMatches = checkMatchesInGrid(initialGrid);
    const validSwaps = enumerateValidSwapsInGrid(initialGrid);

    let swapCascadeSucceeded = false;
    let activationEventsCount = 0;
    let chainTerminatedSafely = true;
    let gravityPreservedInvariants = true;

    if (validSwaps.length > 0) {
      const chosenSwap = validSwaps[0];
      const swapRes = validateAndSwapCells(initialGrid, chosenSwap.from, chosenSwap.to);

      if (swapRes.isValid) {
        const clusterRes = resolveMatchClusters(
          swapRes.swappedGrid,
          swapRes.matchResult,
          true
        );
        const protectedKeys = new Set(
          clusterRes.specialSpawns.map((spawn) => `${spawn.coord.r},${spawn.coord.c}`)
        );
        const activationRes = resolveSpecialActivations(
          clusterRes.gridWithSpawns,
          clusterRes.cellsToClear,
          {
            protectedKeys,
            colorBombTrigger: swapRes.colorBombTrigger,
            specialComboTrigger: swapRes.specialComboTrigger,
            initialMatchedSet: swapRes.matchResult.matchedSet,
          }
        );

        activationEventsCount = activationRes.activationEvents.length;
        if (activationEventsCount > maxSpecialChainEvents) {
          maxSpecialChainEvents = activationEventsCount;
        }
        // Activation queue must strictly terminate with <= total playable cells
        const { rows, cols } = getGridDimensions(initialGrid);
        chainTerminatedSafely = activationEventsCount <= rows * cols;

        const obstacleRes = resolveObstacleAndJellyUpdates(
          activationRes.resolvedGrid,
          activationRes.allClearedCells,
          swapRes.matchResult.matchedSet,
          activationRes.specialHitCells
        );

        const gravityRes = applyGravityAndRefill(
          obstacleRes.updatedGrid,
          obstacleRes.candiesToRemove,
          candyPool,
          { rng, candyDistribution: level.candyDistribution }
        );

        // Verify gravity never fills holes or blockers, locks never shift, and falling origins never come from holes
        let originSafe = true;
        for (const info of Object.values(gravityRes.fallingInfo)) {
          if (info.fromRow !== undefined && info.fromCol !== undefined) {
            const srcCell = gravityRes.droppedGrid[info.fromRow]?.[info.fromCol];
            if (!srcCell || !srcCell.playable || (info.isNew && !srcCell.isSpawner)) {
              originSafe = false;
              break;
            }
          }
        }
        const noHoleSpawners = gravityRes.droppedGrid.every((row) =>
          row.every((cell) => cell.playable || (!cell.isSpawner && cell.candy === null))
        );

        gravityPreservedInvariants =
          originSafe &&
          noHoleSpawners &&
          verifyStaticCellInvariants(obstacleRes.updatedGrid, gravityRes.droppedGrid);
        if (!gravityPreservedInvariants) {
          gravityInvariantFailures++;
        }

        swapCascadeSucceeded = chainTerminatedSafely && gravityPreservedInvariants;
      }
    }

    // Verify reshuffle preserves exact candy inventory, obstacles, holes, locks & restores moves
    const beforeCounts = summarizeGridCandyInventory(initialGrid);
    const reshuffled = reshuffleBoard(initialGrid, createSeededRng(seed + 777));
    const afterCounts = summarizeGridCandyInventory(reshuffled);
    const sameCandyCounts =
      Object.keys(beforeCounts).length === Object.keys(afterCounts).length &&
      Object.entries(beforeCounts).every(([k, count]) => afterCounts[k] === count);
    const staticOk = verifyStaticCellInvariants(initialGrid, reshuffled);
    const reshuffleClean =
      sameCandyCounts &&
      staticOk &&
      checkMatchesInGrid(reshuffled).matchedSet.size === 0 &&
      hasPossibleMoves(reshuffled);

    if (!reshuffleClean) {
      reshuffleInvariantFailures++;
    }

    seedResults.push({
      seed,
      initialMatchCount: initialMatches.matchedSet.size,
      initialValidMoveCount: validSwaps.length,
      hasInitialValidMove: validSwaps.length > 0,
      swapCascadeSucceeded,
      activationEventsCount,
      chainTerminatedSafely,
      gravityPreservedInvariants,
      reshufflePreservedInvariants: reshuffleClean,
    });
  }

  const moveCounts = seedResults.map((s) => s.initialValidMoveCount);
  const minInitialMoves = Math.min(...moveCounts);
  const maxInitialMoves = Math.max(...moveCounts);
  const avgInitialMoves = Number(
    (moveCounts.reduce((acc, n) => acc + n, 0) / Math.max(1, moveCounts.length)).toFixed(2)
  );

  const allSeedsValid = seedResults.every(
    (s) =>
      s.initialMatchCount === 0 &&
      s.hasInitialValidMove &&
      s.swapCascadeSucceeded &&
      s.chainTerminatedSafely &&
      s.gravityPreservedInvariants &&
      s.reshufflePreservedInvariants
  );

  if (minInitialMoves < 3) {
    notes.push(`Tight opening density on at least one seed (min ${minInitialMoves} valid moves).`);
  }

  return {
    levelNumber: level.levelNumber,
    name: level.name,
    world: level.world || 'Unknown World',
    difficulty: level.difficulty || 'medium',
    seedsTested: seeds.length,
    allSeedsValid,
    minInitialMoves,
    avgInitialMoves,
    maxInitialMoves,
    maxSpecialChainEvents,
    gravityInvariantFailures,
    reshuffleInvariantFailures,
    notes,
    seedResults,
  };
}

export function simulateAllLevels(
  levels: LevelInfo[],
  seeds: number[] = [101, 202, 303, 404, 505]
): CampaignSimulationSummary {
  const reports = levels.map((lvl) => simulateLevelBoardSuite(lvl, seeds));
  const passedCount = reports.filter((r) => r.allSeedsValid).length;

  return {
    totalLevels: levels.length,
    passedCount,
    failedCount: levels.length - passedCount,
    allPassed: passedCount === levels.length,
    simulationScopeNote:
      'Deterministic multi-seed structural simulation verifying initial match-free generation, valid opening moves, special-chain loop termination, gravity & obstacle invariants, and reshuffle integrity (distinct from Monte Carlo full-game win-rate simulation).',
    reports,
  };
}
