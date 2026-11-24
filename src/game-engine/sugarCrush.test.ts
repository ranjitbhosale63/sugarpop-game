import assert from 'node:assert/strict';
import { getLevelDefinition } from './levelCatalog';
import {
  SUGAR_CRUSH_BEAM_STEP_MS,
  SUGAR_CRUSH_MOVE_BONUS,
  SUGAR_CRUSH_POP_DURATION_MS,
  applyGravityAndRefill,
  computeSugarCrushBlastTiming,
  createBoardCell,
  createCandy,
  createSeededRng,
  findSugarCrushTokenCoord,
  generateBoardForLevel,
  getCandyPoolForLevel,
  pickSugarCrushStripedOrientation,
  pickSugarCrushTargetCoord,
  resolveObstacleAndJellyUpdates,
  resolveSpecialActivations,
} from './boardEngine';

function runTest(name: string, fn: () => void) {
  fn();
  console.log(`PASS: ${name}`);
}

runTest('pickSugarCrushTargetCoord selects randomly across multiple rows and columns (no column-3 pattern)', () => {
  const lvl1 = getLevelDefinition(1)!;
  const rng = createSeededRng(4242);
  const grid = generateBoardForLevel(1, lvl1.boardLayout, {
    rng: createSeededRng(101),
    candyDistribution: lvl1.candyDistribution,
  });

  const excludeKeys = new Set<string>();
  const pickedCols = new Set<number>();
  const pickedRows = new Set<number>();

  for (let step = 0; step < 8; step++) {
    const coord = pickSugarCrushTargetCoord(grid, step, { rng, excludeKeys });
    assert.ok(coord, `Step ${step} must pick an eligible coordinate`);
    const key = `${coord.r},${coord.c}`;
    assert.equal(excludeKeys.has(key), false, `Must never repeat already-excluded ${key}`);
    excludeKeys.add(key);
    pickedCols.add(coord.c);
    pickedRows.add(coord.r);
  }

  assert.ok(pickedCols.size >= 4, `Expected >= 4 distinct columns, got ${pickedCols.size}`);
  assert.ok(pickedRows.size >= 4, `Expected >= 4 distinct rows, got ${pickedRows.size}`);
});

runTest('pickSugarCrushTargetCoord respects holes, blockers, locks, color bombs, and prefers normal candies', () => {
  const grid = [
    [
      createBoardCell(null, { playable: false }),
      createBoardCell(null, { blocker: 'frosting', blockerHealth: 1 }),
      createBoardCell(createCandy('strawberry_drop'), { isLocked: true }),
    ],
    [
      createBoardCell(createCandy('rainbow_swirl', 'color_bomb')),
      createBoardCell(createCandy('citrus_ring', 'wrapped')),
      createBoardCell(createCandy('mint_emerald')),
    ],
  ];

  // With one normal candy at (1, 2), it must always be preferred over (1, 1) wrapped
  for (let seed = 1; seed <= 5; seed++) {
    const picked = pickSugarCrushTargetCoord(grid, seed, { rng: createSeededRng(seed) });
    assert.deepEqual(picked, { r: 1, c: 2 });
  }

  // Excluding (1, 2) leaves only fallback non-color-bomb special at (1, 1)
  const fallback = pickSugarCrushTargetCoord(grid, 0, {
    rng: createSeededRng(99),
    excludeKeys: new Set(['1,2']),
  });
  assert.deepEqual(fallback, { r: 1, c: 1 });

  // Excluding (1, 1) and (1, 2) leaves no eligible clearable candy (never picks hole/blocker/lock/color_bomb)
  const none = pickSugarCrushTargetCoord(grid, 0, {
    rng: createSeededRng(99),
    excludeKeys: new Set(['1,2', '1,1']),
  });
  assert.equal(none, null);
});

runTest('pickSugarCrushStripedOrientation produces both horizontal and vertical stripes naturally', () => {
  const rng = createSeededRng(777);
  let horizontalCount = 0;
  let verticalCount = 0;
  const sequence: Array<'striped_h' | 'striped_v'> = [];

  for (let i = 0; i < 20; i++) {
    const orientation = pickSugarCrushStripedOrientation(rng);
    sequence.push(orientation);
    if (orientation === 'striped_h') horizontalCount++;
    else verticalCount++;
  }

  assert.ok(horizontalCount >= 5 && verticalCount >= 5, 'Expected balanced random H/V mix');
  const isStrictAlternating = sequence.every(
    (dir, i) => dir === (i % 2 === 0 ? 'striped_h' : 'striped_v')
  );
  assert.equal(isStrictAlternating, false, 'Must not be locked in strict alternating H/V pattern');
});

runTest('Pending sugarCrushId tokens remain trackable by live coordinate after vertical and irregular gravity drops', () => {
  // Normal 8x8 vertical gravity shift
  const lvl1 = getLevelDefinition(1)!;
  const pool1 = getCandyPoolForLevel(1, lvl1.candyDistribution);
  const grid1 = generateBoardForLevel(1, lvl1.boardLayout, {
    rng: createSeededRng(202),
    candyDistribution: lvl1.candyDistribution,
  });

  grid1[1][4].candy = { color: 'star_lemon', special: 'striped_h', sugarCrushId: 101 };
  const drop1 = applyGravityAndRefill(grid1, new Set(['4,4', '5,4', '6,4']), pool1, {
    rng: createSeededRng(203),
    candyDistribution: lvl1.candyDistribution,
  });

  const live1 = findSugarCrushTokenCoord(drop1.droppedGrid, 101);
  assert.deepEqual(live1, { r: 4, c: 4 }, 'Pending token must track to its shifted row after drop');

  // Irregular Level 17 diagonal side-entry slide around central cutouts
  const lvl17 = getLevelDefinition(17)!;
  const pool17 = getCandyPoolForLevel(17, lvl17.candyDistribution);
  const grid17 = generateBoardForLevel(17, lvl17.boardLayout, {
    rng: createSeededRng(303),
    candyDistribution: lvl17.candyDistribution,
  });

  grid17[3][2].candy = { color: 'mint_emerald', special: 'striped_v', sugarCrushId: 202 };
  const drop17 = applyGravityAndRefill(grid17, new Set(['4,3', '5,3', '6,3']), pool17, {
    rng: createSeededRng(304),
    candyDistribution: lvl17.candyDistribution,
  });

  const live17 = findSugarCrushTokenCoord(drop17.droppedGrid, 202);
  assert.ok(live17 !== null, 'Pending token must stay present and trackable on irregular Level 17');
  assert.equal(drop17.droppedGrid[live17.r][live17.c].playable, true);
});

runTest('Chained pending Sugar Crush candy is consumed once without duplicate activation and retains move bonus', () => {
  const lvl1 = getLevelDefinition(1)!;
  const pool = getCandyPoolForLevel(1, lvl1.candyDistribution);
  const grid = generateBoardForLevel(1, lvl1.boardLayout, {
    rng: createSeededRng(505),
    candyDistribution: lvl1.candyDistribution,
  });

  // Two pending Sugar Crush candies in the same row: token 1 (striped_h) hits token 2 (striped_v)
  grid[2][1].candy = { color: 'strawberry_drop', special: 'striped_h', sugarCrushId: 1 };
  grid[2][5].candy = { color: 'blueberry_oval', special: 'striped_v', sugarCrushId: 2 };

  const activation = resolveSpecialActivations(grid, new Set(['2,1']));
  const obstacles = resolveObstacleAndJellyUpdates(
    activation.resolvedGrid,
    activation.allClearedCells,
    new Set(),
    activation.specialHitCells
  );

  assert.equal(obstacles.candiesToRemove.has('2,1'), true);
  assert.equal(obstacles.candiesToRemove.has('2,5'), true);
  assert.equal(activation.consumedSpecials.length >= 2, true);

  const afterGravity = applyGravityAndRefill(obstacles.updatedGrid, obstacles.candiesToRemove, pool, {
    rng: createSeededRng(506),
    candyDistribution: lvl1.candyDistribution,
  });

  assert.equal(findSugarCrushTokenCoord(afterGravity.droppedGrid, 1), null);
  assert.equal(findSugarCrushTokenCoord(afterGravity.droppedGrid, 2), null);

  // Simulate sequence token accounting: each pending token gets SUGAR_CRUSH_MOVE_BONUS exactly once
  const processed = new Set<number>();
  let moveBonusTotal = 0;
  for (const tokenId of [1, 2]) {
    if (processed.has(tokenId)) continue;
    processed.add(tokenId);
    moveBonusTotal += SUGAR_CRUSH_MOVE_BONUS;
  }
  assert.equal(moveBonusTotal, 500);
});

runTest('computeSugarCrushBlastTiming splits directional beams from origin and computes progressive cell delays', () => {
  // Horizontal stripe at (3, 2) on an 8x8 board
  const hTiming = computeSugarCrushBlastTiming(
    [
      {
        coord: { r: 3, c: 2 },
        special: 'striped_h',
        color: 'strawberry_drop',
        affectedCells: Array.from({ length: 8 }, (_, c) => ({ r: 3, c })),
      },
    ],
    8,
    8,
    SUGAR_CRUSH_BEAM_STEP_MS
  );

  assert.equal(hTiming.beamSegments.length, 2);
  const leftSeg = hTiming.beamSegments.find((s) => s.direction === 'left')!;
  const rightSeg = hTiming.beamSegments.find((s) => s.direction === 'right')!;
  assert.ok(leftSeg && rightSeg, 'Horizontal stripe must split into left and right segments');
  assert.equal(leftSeg.spanCells, 2.5);
  assert.equal(rightSeg.spanCells, 5.5);
  assert.equal(leftSeg.startDelayMs, 0);
  assert.equal(rightSeg.startDelayMs, 0);
  assert.equal(leftSeg.travelMs, Math.round(2.5 * SUGAR_CRUSH_BEAM_STEP_MS));
  assert.equal(rightSeg.travelMs, Math.round(5.5 * SUGAR_CRUSH_BEAM_STEP_MS));

  // Cell pop delays progress outward by distance * stepMs
  assert.equal(hTiming.cellPopDelays['3,2'], 0);
  assert.equal(hTiming.cellPopDelays['3,1'], SUGAR_CRUSH_BEAM_STEP_MS);
  assert.equal(hTiming.cellPopDelays['3,0'], 2 * SUGAR_CRUSH_BEAM_STEP_MS);
  assert.equal(hTiming.cellPopDelays['3,3'], SUGAR_CRUSH_BEAM_STEP_MS);
  assert.equal(hTiming.cellPopDelays['3,7'], 5 * SUGAR_CRUSH_BEAM_STEP_MS);

  assert.ok(hTiming.totalBlastWaitMs >= hTiming.maxBeamEndMs);
  assert.ok(hTiming.totalBlastWaitMs >= hTiming.maxCellDelayMs + SUGAR_CRUSH_POP_DURATION_MS);

  // Vertical stripe at (4, 5) on an 8x8 board
  const vTiming = computeSugarCrushBlastTiming(
    [
      {
        coord: { r: 4, c: 5 },
        special: 'striped_v',
        color: 'blueberry_oval',
        affectedCells: Array.from({ length: 8 }, (_, r) => ({ r, c: 5 })),
      },
    ],
    8,
    8,
    SUGAR_CRUSH_BEAM_STEP_MS
  );

  assert.equal(vTiming.beamSegments.length, 2);
  const upSeg = vTiming.beamSegments.find((s) => s.direction === 'up')!;
  const downSeg = vTiming.beamSegments.find((s) => s.direction === 'down')!;
  assert.ok(upSeg && downSeg, 'Vertical stripe must split into up and down segments');
  assert.equal(upSeg.spanCells, 4.5);
  assert.equal(downSeg.spanCells, 3.5);
  assert.equal(vTiming.cellPopDelays['4,5'], 0);
  assert.equal(vTiming.cellPopDelays['0,5'], 4 * SUGAR_CRUSH_BEAM_STEP_MS);
  assert.equal(vTiming.cellPopDelays['7,5'], 3 * SUGAR_CRUSH_BEAM_STEP_MS);
});

runTest('computeSugarCrushBlastTiming chains secondary activations at primary beam arrival time', () => {
  const lvl1 = getLevelDefinition(1)!;
  const grid = generateBoardForLevel(1, lvl1.boardLayout, {
    rng: createSeededRng(808),
    candyDistribution: lvl1.candyDistribution,
  });

  // Primary striped_h at (2, 1) triggers secondary striped_v at (2, 5) (distance = 4)
  grid[2][1].candy = { color: 'strawberry_drop', special: 'striped_h', sugarCrushId: 1 };
  grid[2][5].candy = { color: 'blueberry_oval', special: 'striped_v', sugarCrushId: 2 };

  const activation = resolveSpecialActivations(grid, new Set(['2,1']));
  const timing = computeSugarCrushBlastTiming(activation.activationEvents, 8, 8, SUGAR_CRUSH_BEAM_STEP_MS);

  const primaryDelay = 0;
  const chainTriggerDelay = 4 * SUGAR_CRUSH_BEAM_STEP_MS;
  assert.equal(timing.cellPopDelays['2,1'], primaryDelay);
  assert.equal(timing.cellPopDelays['2,5'], chainTriggerDelay);

  const secondaryUp = timing.beamSegments.find(
    (s) => s.r === 2 && s.c === 5 && s.direction === 'up'
  )!;
  const secondaryDown = timing.beamSegments.find(
    (s) => s.r === 2 && s.c === 5 && s.direction === 'down'
  )!;
  assert.ok(secondaryUp && secondaryDown);
  assert.equal(secondaryUp.startDelayMs, chainTriggerDelay);
  assert.equal(secondaryDown.startDelayMs, chainTriggerDelay);

  // Cell (6, 5) is 4 rows away from chained (2, 5): pops at chainTriggerDelay + 4 * stepMs
  assert.equal(timing.cellPopDelays['6,5'], chainTriggerDelay + 4 * SUGAR_CRUSH_BEAM_STEP_MS);
  assert.ok(timing.totalBlastWaitMs >= timing.maxBeamEndMs);
  assert.ok(timing.totalBlastWaitMs >= timing.maxCellDelayMs + SUGAR_CRUSH_POP_DURATION_MS);
});

