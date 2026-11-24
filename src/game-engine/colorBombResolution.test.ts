import assert from 'node:assert/strict';
import {
  computeColorBombPolishTiming,
  createBoardCell,
  createCandy,
  resolveMatchClusters,
  resolveSpecialActivations,
  validateAndSwapCells,
} from './boardEngine';
import { BoardGrid } from '../types/game';
import { DEFAULT_SOUND_SETTINGS, sanitizeSoundSettings } from '../utils/storage';

function runTest(name: string, fn: () => void) {
  fn();
  console.log(`PASS: ${name}`);
}

function createEmptyGrid(rows = 6, cols = 6): BoardGrid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => createBoardCell(createCandy('blueberry_oval')))
  );
}

runTest('Striped swapped into Color Bomb uses actual Color Bomb coordinate as zap beam origin', () => {
  const grid = createEmptyGrid(6, 6);
  // Fill non-matching baseline pattern
  const palette = ['strawberry_drop', 'citrus_ring', 'star_lemon', 'mint_emerald', 'blueberry_oval'] as const;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      grid[r][c] = createBoardCell(createCandy(palette[(r * 2 + c) % palette.length]));
    }
  }

  // Place Striped Red at (2, 2) and Color Bomb at (2, 3); swap (2,2) -> (2,3)
  grid[2][2] = createBoardCell(createCandy('strawberry_drop', 'striped_h'));
  grid[2][3] = createBoardCell(createCandy('rainbow_swirl', 'color_bomb'));
  grid[0][5] = createBoardCell(createCandy('strawberry_drop'));
  grid[5][0] = createBoardCell(createCandy('strawberry_drop'));

  const swapRes = validateAndSwapCells(grid, { r: 2, c: 2 }, { r: 2, c: 3 });
  assert.equal(swapRes.isValid, true);
  assert.equal(swapRes.specialComboTrigger?.comboType, 'COLOR_BOMB_STRIPED');

  // After swap, Color Bomb sits at (2, 2) and Striped Red sits at (2, 3)
  assert.equal(swapRes.swappedGrid[2][2].candy?.special, 'color_bomb');
  assert.equal(swapRes.swappedGrid[2][3].candy?.special, 'striped_h');

  const activationRes = resolveSpecialActivations(swapRes.swappedGrid, new Set(), {
    specialComboTrigger: swapRes.specialComboTrigger,
  });

  const comboEvent = activationRes.activationEvents[0];
  assert.ok(comboEvent, 'Expected combo activation event');
  assert.equal(comboEvent.special, 'COLOR_BOMB_STRIPED');
  assert.deepEqual(comboEvent.coord, { r: 2, c: 2 }, 'Origin must be Color Bomb coord (2,2), not centerCoord (2,3)');

  const timing = computeColorBombPolishTiming(activationRes.activationEvents, 6, 6);
  assert.ok(timing.zapBeams.length > 0, 'Expected rainbow zap beams');
  for (const beam of timing.zapBeams) {
    assert.equal(beam.fromR, 2);
    assert.equal(beam.fromC, 2);
  }
  // Converted targets must pop after beam travel, never instantaneously at t=0
  assert.ok((timing.cellPopDelays['0,5'] ?? 0) > 100);
  assert.ok((timing.cellPopDelays['5,0'] ?? 0) > 100);
});

runTest('Wrapped swapped into Color Bomb and Color Bomb swapped into Striped both originate at actual Color Bomb', () => {
  const grid = createEmptyGrid(6, 6);
  const palette = ['citrus_ring', 'star_lemon', 'mint_emerald', 'blueberry_oval', 'plum_heart'] as const;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      grid[r][c] = createBoardCell(createCandy(palette[(r * 3 + c) % palette.length]));
    }
  }

  // Case A: Wrapped at (3, 1) swapped into Color Bomb at (3, 2) -> bomb ends at (3, 1)
  grid[3][1] = createBoardCell(createCandy('mint_emerald', 'wrapped'));
  grid[3][2] = createBoardCell(createCandy('rainbow_swirl', 'color_bomb'));
  grid[0][4] = createBoardCell(createCandy('mint_emerald'));

  const swapWrappedIntoBomb = validateAndSwapCells(grid, { r: 3, c: 1 }, { r: 3, c: 2 });
  assert.equal(swapWrappedIntoBomb.specialComboTrigger?.comboType, 'COLOR_BOMB_WRAPPED');

  const actWrapped = resolveSpecialActivations(swapWrappedIntoBomb.swappedGrid, new Set(), {
    specialComboTrigger: swapWrappedIntoBomb.specialComboTrigger,
  });
  assert.deepEqual(actWrapped.activationEvents[0]?.coord, { r: 3, c: 1 });
  assert.equal(actWrapped.resolvedGrid[0][4].candy?.special, 'wrapped');

  const wrappedTiming = computeColorBombPolishTiming(actWrapped.activationEvents, 6, 6);
  assert.ok(wrappedTiming.zapBeams.every((b) => b.fromR === 3 && b.fromC === 1));

  // Case B: Color Bomb at (1, 1) swapped into Striped at (1, 2) -> bomb ends at (1, 2)
  const gridB = createEmptyGrid(6, 6);
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      gridB[r][c] = createBoardCell(createCandy(palette[(r * 3 + c) % palette.length]));
    }
  }
  gridB[1][1] = createBoardCell(createCandy('rainbow_swirl', 'color_bomb'));
  gridB[1][2] = createBoardCell(createCandy('citrus_ring', 'striped_v'));
  gridB[4][4] = createBoardCell(createCandy('citrus_ring'));

  const swapBombIntoStriped = validateAndSwapCells(gridB, { r: 1, c: 1 }, { r: 1, c: 2 });
  const actBombIntoStriped = resolveSpecialActivations(
    swapBombIntoStriped.swappedGrid,
    new Set(),
    { specialComboTrigger: swapBombIntoStriped.specialComboTrigger }
  );
  assert.deepEqual(actBombIntoStriped.activationEvents[0]?.coord, { r: 1, c: 2 });
});

runTest('Overwritten existing special at spawnPosition is protected from duplicate activation via initialMatchedSet', () => {
  const grid = createEmptyGrid(6, 6);
  const palette = ['citrus_ring', 'star_lemon', 'mint_emerald', 'blueberry_oval'] as const;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      grid[r][c] = createBoardCell(createCandy(palette[(r * 2 + c) % palette.length]));
    }
  }

  // Row 3 has red at (3,0), (3,1), (3,3) and an existing striped_v at (2,2) to swap into (3,2)
  grid[3][0] = createBoardCell(createCandy('strawberry_drop'));
  grid[3][1] = createBoardCell(createCandy('strawberry_drop', 'striped_h'));
  grid[3][2] = createBoardCell(createCandy('mint_emerald'));
  grid[3][3] = createBoardCell(createCandy('strawberry_drop'));
  grid[2][2] = createBoardCell(createCandy('strawberry_drop', 'striped_v'));

  const swapRes = validateAndSwapCells(grid, { r: 2, c: 2 }, { r: 3, c: 2 });
  assert.equal(swapRes.isValid, true);
  assert.equal(swapRes.matchResult.clusters.length, 1);

  const cluster = swapRes.matchResult.clusters[0];
  assert.deepEqual(cluster.spawnPosition, { r: 3, c: 2 });

  const clusterRes = resolveMatchClusters(swapRes.swappedGrid, swapRes.matchResult, true);
  assert.equal(clusterRes.specialSpawns.length, 1);
  assert.equal(clusterRes.cellsToClear.has('3,2'), false);

  const protectedKeys = new Set(
    clusterRes.specialSpawns.map((s) => `${s.coord.r},${s.coord.c}`)
  );

  // Test both pre-spawn and post-spawn grid inputs with initialMatchedSet containing '3,2'
  for (const inputGrid of [swapRes.swappedGrid, clusterRes.gridWithSpawns]) {
    const activationRes = resolveSpecialActivations(inputGrid, clusterRes.cellsToClear, {
      protectedKeys,
      initialMatchedSet: swapRes.matchResult.matchedSet,
    });

    // Spawn coordinate (3,2) must NEVER detonate during the spawn turn or be marked cleared
    assert.equal(
      activationRes.activationEvents.some((ev) => ev.coord.r === 3 && ev.coord.c === 2),
      false,
      'spawnPosition (3,2) must not activate on spawn turn'
    );
    assert.equal(activationRes.allClearedCells.has('3,2'), false);

    // Non-protected special at (3,1) must still activate exactly once
    const row31Events = activationRes.activationEvents.filter(
      (ev) => ev.coord.r === 3 && ev.coord.c === 1
    );
    assert.equal(row31Events.length, 1, 'Non-protected special at (3,1) must activate once');
  }
});

runTest('sanitizeSoundSettings restores valid saved fields and falls back safely on invalid values', () => {
  assert.deepEqual(sanitizeSoundSettings(null), DEFAULT_SOUND_SETTINGS);
  assert.deepEqual(sanitizeSoundSettings('corrupt'), DEFAULT_SOUND_SETTINGS);

  const partial = sanitizeSoundSettings({
    soundEffectsEnabled: false,
    musicEnabled: true,
    hapticsEnabled: 'bad',
    masterVolume: 2.5,
  });
  assert.deepEqual(partial, {
    soundEffectsEnabled: false,
    musicEnabled: true,
    hapticsEnabled: true,
    masterVolume: 1,
  });

  const negative = sanitizeSoundSettings({
    soundEffectsEnabled: true,
    musicEnabled: false,
    hapticsEnabled: false,
    masterVolume: -0.4,
  });
  assert.equal(negative.masterVolume, 0);
  assert.equal(negative.hapticsEnabled, false);
});
