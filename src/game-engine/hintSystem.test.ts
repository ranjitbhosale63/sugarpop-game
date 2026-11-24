import assert from 'node:assert/strict';
import { BoardGrid, CandyShape } from '../types/game';
import {
  ResolvedObjective,
  createBoardCell,
  createCandy,
  findBestHintMove,
  validateAndSwapCells,
} from './boardEngine';

function runTest(name: string, fn: () => void) {
  fn();
  console.log(`PASS: ${name}`);
}

/**
 * Builds an R x C grid filled with a non-matching cyclic candy pattern
 * so individual test cases can plant exact swap scenarios deterministically.
 */
function buildMatchFreeGrid(rows = 6, cols = 6): BoardGrid {
  const pool: CandyShape[] = [
    'strawberry_drop',
    'citrus_ring',
    'star_lemon',
    'mint_emerald',
    'blueberry_oval',
    'plum_heart',
  ];
  const grid: BoardGrid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const color = pool[(r * 2 + c) % pool.length];
      row.push(createBoardCell(createCandy(color)));
    }
    grid.push(row);
  }
  return grid;
}

runTest('findBestHintMove returns a valid matching swap and never mutates the input grid', () => {
  const grid = buildMatchFreeGrid(6, 6);
  // Create exactly one valid swap: swapping (2,1) with (2,2) forms a horizontal 3-match at row 2
  grid[2][0].candy = createCandy('strawberry_drop');
  grid[2][1].candy = createCandy('strawberry_drop');
  grid[2][2].candy = createCandy('blueberry_oval');
  grid[2][3].candy = createCandy('strawberry_drop');

  const snapshotBefore = JSON.stringify(grid);
  const hint = findBestHintMove(grid);

  assert.ok(hint, 'Expected a valid hint move');
  assert.equal(JSON.stringify(grid), snapshotBefore, 'findBestHintMove must never mutate input grid');

  const swapCheck = validateAndSwapCells(grid, hint.from, hint.to);
  assert.equal(swapCheck.isValid, true, 'Suggested hint must pass validateAndSwapCells');
  assert.equal(swapCheck.matchResult.matchedSet.size >= 3, true);
});

runTest('findBestHintMove never suggests locked cells, blockers, or holes as swappable cells', () => {
  const grid = buildMatchFreeGrid(6, 6);

  // Blocked/locked/hole scenarios that would match if allowed to swap:
  // 1) Locked candy next to two matching candies
  grid[0][0].candy = createCandy('mint_emerald');
  grid[0][1].candy = createCandy('mint_emerald');
  grid[0][2].candy = createCandy('citrus_ring');
  grid[0][3].candy = createCandy('mint_emerald');
  grid[0][3].isLocked = true; // Locked: cannot swap (0,2)<->(0,3)

  // 2) Hole & blocker cells
  grid[1][2] = createBoardCell(null, { playable: false });
  grid[3][2] = createBoardCell(null, { blocker: 'frosting', blockerHealth: 1 });

  // No valid swap exists yet when (0,3) is locked -> must return null
  assert.equal(findBestHintMove(grid), null);

  // Add one genuinely legal swap at row 5
  grid[5][1].candy = createCandy('star_lemon');
  grid[5][2].candy = createCandy('star_lemon');
  grid[5][3].candy = createCandy('plum_heart');
  grid[5][4].candy = createCandy('star_lemon');

  const hint = findBestHintMove(grid);
  assert.ok(hint);
  assert.equal(grid[hint.from.r][hint.from.c].playable, true);
  assert.equal(grid[hint.to.r][hint.to.c].playable, true);
  assert.equal(grid[hint.from.r][hint.from.c].isLocked, false);
  assert.equal(grid[hint.to.r][hint.to.c].isLocked, false);
  assert.equal(grid[hint.from.r][hint.from.c].blocker, null);
  assert.equal(grid[hint.to.r][hint.to.c].blocker, null);
  assert.equal(validateAndSwapCells(grid, hint.from, hint.to).isValid, true);
});

runTest('findBestHintMove supports Color Bomb swaps and special-candy combinations', () => {
  // Case A: Color Bomb + normal candy swap (even with no 3-match on board)
  const colorBombGrid = buildMatchFreeGrid(5, 5);
  colorBombGrid[2][2].candy = createCandy('rainbow_swirl', 'color_bomb');
  const cbHint = findBestHintMove(colorBombGrid);
  assert.ok(cbHint, 'Color Bomb adjacent to normal candy must be suggested');
  assert.equal(validateAndSwapCells(colorBombGrid, cbHint.from, cbHint.to).isValid, true);

  // Case B: Special + Special combo preferred over plain 3-match when objectives are equal
  const comboGrid = buildMatchFreeGrid(6, 6);
  // Plain 3-match at row 0
  comboGrid[0][0].candy = createCandy('strawberry_drop');
  comboGrid[0][1].candy = createCandy('strawberry_drop');
  comboGrid[0][2].candy = createCandy('blueberry_oval');
  comboGrid[0][3].candy = createCandy('strawberry_drop');

  // Striped + Wrapped combo at row 4
  comboGrid[4][1].candy = createCandy('mint_emerald', 'striped_h');
  comboGrid[4][2].candy = createCandy('citrus_ring', 'wrapped');

  const comboHint = findBestHintMove(comboGrid);
  assert.ok(comboHint);
  assert.deepEqual(comboHint.from, { r: 4, c: 1 });
  assert.deepEqual(comboHint.to, { r: 4, c: 2 });
  assert.ok(validateAndSwapCells(comboGrid, comboHint.from, comboHint.to).specialComboTrigger);
});

runTest('findBestHintMove prefers moves that advance incomplete objectives and stronger matches on ties', () => {
  const grid = buildMatchFreeGrid(6, 6);

  // Move A (rows 0-1): swapping (0,2)<->(1,2) creates a horizontal 4-match of strawberry_drop
  grid[0][0].candy = createCandy('strawberry_drop');
  grid[0][1].candy = createCandy('strawberry_drop');
  grid[0][2].candy = createCandy('blueberry_oval');
  grid[0][3].candy = createCandy('strawberry_drop');
  grid[1][2].candy = createCandy('strawberry_drop');
  grid[2][2].candy = createCandy('mint_emerald');

  // Move B (row 4): 3-match of plum_heart sitting directly on jelly cells
  grid[4][0].candy = createCandy('plum_heart');
  grid[4][1].candy = createCandy('plum_heart');
  grid[4][2].candy = createCandy('mint_emerald');
  grid[4][3].candy = createCandy('plum_heart');
  grid[4][0].jellyLayers = 1;
  grid[4][1].jellyLayers = 1;

  // Without jelly objective, 4-match Move A should beat 3-match Move B
  const noObjHint = findBestHintMove(grid);
  assert.ok(noObjHint);
  assert.equal(noObjHint.from.r, 0);
  assert.equal(noObjHint.from.c, 2);
  assert.equal(noObjHint.to.r, 1);
  assert.equal(noObjHint.to.c, 2);

  // With incomplete clear_jelly objective, Move B must be preferred
  const jellyObjectives: ResolvedObjective[] = [
    {
      key: 'clear-jelly',
      objective: { id: 'clear-jelly', type: 'clear_jelly', requiredCount: 2 },
      current: 0,
      target: 2,
      remaining: 2,
      isComplete: false,
    },
  ];
  const jellyHint = findBestHintMove(grid, jellyObjectives);
  assert.ok(jellyHint);
  assert.equal(jellyHint.from.r, 4);
  assert.equal(validateAndSwapCells(grid, jellyHint.from, jellyHint.to).isValid, true);
});
