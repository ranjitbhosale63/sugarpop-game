import assert from 'node:assert/strict';
import {
  CAMPAIGN_LEVELS,
  getLevelDefinition,
  getWorldForLevel,
  resolveActiveCampaignLevel,
} from './levelCatalog';
import {
  applyGravityAndRefill,
  checkMatchesInGrid,
  countBoardObstacles,
  createSeededRng,
  generateBoardForLevel,
  getCandyPoolForLevel,
  hasPossibleMoves,
  reshuffleBoard,
  resolveObstacleAndJellyUpdates,
  resolveSpecialActivations,
  createCandy,
} from './boardEngine';
import { simulateAllLevels, validateAllLevels } from './levelValidator';

function runTest(name: string, fn: () => void) {
  fn();
  console.log(`PASS: ${name}`);
}

runTest('Level 17 (Prism Well) preserves intended 7x8 layout and explicit top-row playable spawners', () => {
  const lvl17 = getLevelDefinition(17);
  assert.ok(lvl17, 'Level 17 must exist');

  const grid = generateBoardForLevel(17, lvl17.boardLayout, {
    rng: createSeededRng(101),
    candyDistribution: lvl17.candyDistribution,
  });

  assert.equal(grid.length, 7);
  assert.equal(grid[0].length, 8);

  const expectedHoles = new Set(['3,3', '3,4', '0,0', '0,7', '6,0', '6,7']);
  const expectedSpawners = new Set(['0,1', '0,2', '0,3', '0,4', '0,5', '0,6']);

  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 8; c++) {
      const k = `${r},${c}`;
      const cell = grid[r][c];
      if (expectedHoles.has(k)) {
        assert.equal(cell.playable, false, `${k} must be non-playable`);
        assert.equal(cell.candy, null, `${k} must remain empty`);
        assert.equal(cell.isSpawner, false, `${k} must never be a spawner`);
      } else {
        assert.equal(cell.playable, true, `${k} must be playable`);
        assert.ok(cell.candy !== null, `${k} must start populated`);
        assert.equal(
          Boolean(cell.isSpawner),
          expectedSpawners.has(k),
          `${k} spawner flag mismatch`
        );
      }
    }
  }
});

runTest('Level 17 matches directly below central cutouts refill via valid side-entry without hole teleportation', () => {
  const lvl17 = getLevelDefinition(17)!;
  const pool = getCandyPoolForLevel(17, lvl17.candyDistribution);
  const grid = generateBoardForLevel(17, lvl17.boardLayout, {
    rng: createSeededRng(202),
    candyDistribution: lvl17.candyDistribution,
  });

  // Snapshot candies directly above central cutouts (0..2, 3..4)
  const aboveLeft = [0, 1, 2].map((r) => grid[r][3].candy!.color);
  const aboveRight = [0, 1, 2].map((r) => grid[r][4].candy!.color);

  // Match/clear both columns directly below the central holes (4..6, 3..4)
  const matched = new Set(['4,3', '5,3', '6,3', '4,4', '5,4', '6,4']);
  const res = applyGravityAndRefill(grid, matched, pool, {
    rng: createSeededRng(303),
    candyDistribution: lvl17.candyDistribution,
  });

  // 1. Holes stay empty & non-spawner
  assert.equal(res.droppedGrid[3][3].playable, false);
  assert.equal(res.droppedGrid[3][3].candy, null);
  assert.equal(res.droppedGrid[3][4].playable, false);
  assert.equal(res.droppedGrid[3][4].candy, null);

  // 2. Candies above (3,3) and (3,4) never teleport through the cutouts
  assert.deepEqual([0, 1, 2].map((r) => res.droppedGrid[r][3].candy?.color), aboveLeft);
  assert.deepEqual([0, 1, 2].map((r) => res.droppedGrid[r][4].candy?.color), aboveRight);

  // 3. Lower cells (4..6, 3..4) are completely refilled via valid side-entry
  for (let r = 4; r <= 6; r++) {
    for (const c of [3, 4]) {
      assert.ok(res.droppedGrid[r][c].candy !== null, `Lower cell (${r},${c}) must refill`);
      const info = res.fallingInfo[`${r},${c}`];
      assert.ok(info, `Lower cell (${r},${c}) should record falling origin`);
      assert.equal(info.isNew, false, `Lower cell (${r},${c}) receives existing candies via side-entry`);
      assert.ok(info.fromRow !== undefined && info.fromCol !== undefined);
      assert.ok(info.fromCol !== c, `Cell (${r},${c}) must enter sideways, not straight through hole (3,${c})`);
      assert.ok(info.fromColDelta !== 0, `Cell (${r},${c}) must animate diagonally around hole`);
    }
  }

  // 4. All newly spawned candies originate strictly from top playable spawners (0,1..6)
  for (const [key, info] of Object.entries(res.fallingInfo)) {
    if (info.isNew) {
      assert.equal(info.fromRow, 0, `New candy at ${key} must enter from row 0 spawner`);
      assert.ok(
        info.fromCol !== undefined && info.fromCol >= 1 && info.fromCol <= 6,
        `New candy at ${key} entered from invalid col ${info.fromCol}`
      );
    }
  }
});

runTest('Level 17 multi-column cascade below and beside central cutouts never spawns from (3,3)/(3,4) or (0,0)/(0,7)', () => {
  const lvl17 = getLevelDefinition(17)!;
  const pool = getCandyPoolForLevel(17, lvl17.candyDistribution);
  const grid = generateBoardForLevel(17, lvl17.boardLayout, {
    rng: createSeededRng(404),
    candyDistribution: lvl17.candyDistribution,
  });

  // Simultaneously clear (4,2..5) below cutouts AND col 2 upper cells so new candies slide diagonally
  const matched = new Set(['0,2', '1,2', '2,2', '4,2', '4,3', '4,4', '4,5']);
  const res = applyGravityAndRefill(grid, matched, pool, {
    rng: createSeededRng(505),
    candyDistribution: lvl17.candyDistribution,
  });

  // All playable cells on Level 17 must end filled
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = res.droppedGrid[r][c];
      if (cell.playable) {
        assert.ok(cell.candy !== null, `Playable (${r},${c}) ended empty`);
      } else {
        assert.equal(cell.candy, null, `Hole (${r},${c}) must stay empty`);
      }
    }
  }

  // Verify every falling/spawn origin is a valid playable (and spawner when isNew) cell
  for (const [key, info] of Object.entries(res.fallingInfo)) {
    assert.ok(info.fromRow !== undefined && info.fromCol !== undefined, `Missing origin for ${key}`);
    const originCell = res.droppedGrid[info.fromRow][info.fromCol];
    assert.equal(originCell.playable, true, `Candy at ${key} originated from non-playable (${info.fromRow},${info.fromCol})`);
    if (info.isNew) {
      assert.equal(originCell.isSpawner, true, `New candy at ${key} spawned from non-spawner (${info.fromRow},${info.fromCol})`);
    }
  }
});

runTest('Level 17 corner pockets below (0,0) and (0,7) refill diagonally without spawning out of corner holes', () => {
  const lvl17 = getLevelDefinition(17)!;
  const pool = getCandyPoolForLevel(17, lvl17.candyDistribution);
  const grid = generateBoardForLevel(17, lvl17.boardLayout, {
    rng: createSeededRng(606),
    candyDistribution: lvl17.candyDistribution,
  });

  const matched = new Set(['1,0', '2,0', '3,0', '1,7', '2,7']);
  const res = applyGravityAndRefill(grid, matched, pool, {
    rng: createSeededRng(707),
    candyDistribution: lvl17.candyDistribution,
  });

  assert.equal(res.droppedGrid[0][0].candy, null);
  assert.equal(res.droppedGrid[0][7].candy, null);
  assert.ok(res.droppedGrid[1][0].candy !== null);
  assert.ok(res.droppedGrid[1][7].candy !== null);

  const leftOrigin = res.fallingInfo['1,0'];
  const rightOrigin = res.fallingInfo['1,7'];
  assert.ok(leftOrigin && leftOrigin.fromCol === 1, '(1,0) must receive candy from col 1, not hole (0,0)');
  assert.ok(rightOrigin && rightOrigin.fromCol === 6, '(1,7) must receive candy from col 6, not hole (0,7)');
});

runTest('Level 16 bevel corner interior spawners do not animate from non-playable row 0 holes', () => {
  const lvl16 = getLevelDefinition(16)!;
  const pool = getCandyPoolForLevel(16, lvl16.candyDistribution);
  const grid = generateBoardForLevel(16, lvl16.boardLayout, {
    rng: createSeededRng(808),
    candyDistribution: lvl16.candyDistribution,
  });

  assert.equal(grid[0][0].playable, false);
  assert.equal(grid[0][1].playable, false);
  assert.equal(grid[1][0].isSpawner, true);

  const res = applyGravityAndRefill(grid, new Set(['1,0', '2,0', '3,0']), pool, {
    rng: createSeededRng(909),
    candyDistribution: lvl16.candyDistribution,
  });

  const topCornerFall = res.fallingInfo['1,0'];
  assert.ok(topCornerFall && topCornerFall.isNew);
  assert.equal(topCornerFall.fromRow, 1, 'Interior playable spawner starts at row 1, never row 0 hole');
  assert.equal(topCornerFall.fromRowDelta, 0, 'Interior spawner at (1,0) enters in-place without dropping from hole (0,0)');
});

runTest('Level 17 special blasts, jelly updates, and reshuffle preserve irregular layout and reachability', () => {
  const lvl17 = getLevelDefinition(17)!;
  const pool = getCandyPoolForLevel(17, lvl17.candyDistribution);
  const grid = generateBoardForLevel(17, lvl17.boardLayout, {
    rng: createSeededRng(1111),
    candyDistribution: lvl17.candyDistribution,
  });

  // Trigger wrapped candy blast at (4,2) next to (3,3) hole & (4,2)/(5,2) double-jelly
  grid[4][2].candy = createCandy('blueberry_oval', 'wrapped');
  const activation = resolveSpecialActivations(grid, new Set(['4,2']));
  assert.equal(activation.allClearedCells.has('3,3'), false, 'Wrapped blast must never clear hole (3,3)');
  assert.equal(activation.allClearedCells.has('4,3'), true, 'Wrapped blast hits (4,3) below hole');

  const obstacles = resolveObstacleAndJellyUpdates(
    activation.resolvedGrid,
    activation.allClearedCells,
    new Set(),
    activation.specialHitCells
  );
  // (4,2) had 2 jelly layers -> reduced to 1
  assert.equal(obstacles.updatedGrid[4][2].jellyLayers, 1);
  assert.equal(obstacles.updatedGrid[3][3].jellyLayers, 0);

  const gravity = applyGravityAndRefill(obstacles.updatedGrid, obstacles.candiesToRemove, pool, {
    rng: createSeededRng(1212),
    candyDistribution: lvl17.candyDistribution,
  });
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 8; c++) {
      if (gravity.droppedGrid[r][c].playable) {
        assert.ok(gravity.droppedGrid[r][c].candy !== null, `Playable (${r},${c}) must refill after special blast`);
      } else {
        assert.equal(gravity.droppedGrid[r][c].candy, null);
      }
    }
  }

  // Reshuffle preserves all holes, jellies, and valid moves
  const reshuffled = reshuffleBoard(gravity.droppedGrid, createSeededRng(1313));
  assert.equal(checkMatchesInGrid(reshuffled).matchedSet.size, 0);
  assert.equal(hasPossibleMoves(reshuffled), true);
  assert.deepEqual(countBoardObstacles(reshuffled), countBoardObstacles(gravity.droppedGrid));
});

runTest('Normal 8x8 Level 1 gravity and top-row spawn offsets remain unchanged', () => {
  const lvl1 = getLevelDefinition(1)!;
  const pool = getCandyPoolForLevel(1, lvl1.candyDistribution);
  const grid = generateBoardForLevel(1, lvl1.boardLayout, {
    rng: createSeededRng(1414),
    candyDistribution: lvl1.candyDistribution,
  });

  const res = applyGravityAndRefill(grid, new Set(['3,4', '4,4', '5,4']), pool, {
    rng: createSeededRng(1515),
    candyDistribution: lvl1.candyDistribution,
  });

  assert.equal(res.fallingInfo['0,4']?.isNew, true);
  assert.equal(res.fallingInfo['0,4']?.fromColDelta, 0);
  assert.equal(res.fallingInfo['5,4']?.isNew, false);
  assert.equal(res.fallingInfo['5,4']?.distance, 3);
  assert.equal(res.fallingInfo['5,4']?.fromColDelta, 0);
});

runTest('All 30 campaign levels pass configuration validation and multi-seed irregular gravity simulation', () => {
  const val = validateAllLevels(CAMPAIGN_LEVELS);
  if (!val.allPassed) {
    console.error(val.results.filter((r) => !r.isValid).map((r) => r.errors));
  }
  assert.equal(val.passedCount, 30);

  const sim = simulateAllLevels(CAMPAIGN_LEVELS, [101, 202, 303, 404, 505]);
  if (!sim.allPassed) {
    console.error(sim.reports.filter((r) => !r.allSeedsValid));
  }
  assert.equal(sim.passedCount, 30);
});

runTest('getWorldForLevel and resolveActiveCampaignLevel accurately track progression across all 10 worlds', () => {
  for (const lvl of CAMPAIGN_LEVELS) {
    assert.equal(getWorldForLevel(lvl.levelNumber)?.name, lvl.world);
  }

  // Fresh state -> Level 1 in Sugar Meadows
  const fresh = resolveActiveCampaignLevel(CAMPAIGN_LEVELS, 1, 1);
  assert.equal(fresh?.levelNumber, 1);
  assert.equal(fresh?.world, 'Sugar Meadows');

  // Beating Levels 1-3 unlocks Level 4 in Jelly Valley
  const progressed = CAMPAIGN_LEVELS.map((l) => ({
    ...l,
    starsEarned: l.levelNumber <= 3 ? 2 : 0,
    isUnlocked: l.levelNumber <= 4,
  }));
  const activeProgressed = resolveActiveCampaignLevel(progressed, 4, 3);
  assert.equal(activeProgressed?.levelNumber, 4);
  assert.equal(activeProgressed?.world, 'Jelly Valley');

  // All 30 levels completed -> Level 30 in Starlight Citadel
  const completedAll = CAMPAIGN_LEVELS.map((l) => ({
    ...l,
    starsEarned: 3,
    isUnlocked: true,
  }));
  const activeFinal = resolveActiveCampaignLevel(completedAll, 30, 30);
  assert.equal(activeFinal?.levelNumber, 30);
  assert.equal(activeFinal?.world, 'Starlight Citadel');
});
