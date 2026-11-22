import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainHeight, BOULDERS, ARENA_R } from '../src/levels/boss.js';
import { LEVELS } from '../src/levels/index.js';

test('the arena floor is nearly flat where the fight happens', () => {
  for (let x = -36; x <= 36; x += 3) for (let z = -36; z <= 36; z += 3) {
    if (Math.hypot(x, z) <= 36) assert.ok(Math.abs(terrainHeight(x, z)) <= 0.25, `${x},${z}`);
  }
});
test('boulders are low cover, clear of the middle and of the start', () => {
  assert.ok(BOULDERS.length >= 4 && BOULDERS.length <= 6);
  for (const b of BOULDERS) {
    assert.ok(b.h >= 2 && b.h <= 2.5);
    const d = Math.hypot(b.x, b.z);
    assert.ok(d >= 12 && d <= 28 && d + b.r < ARENA_R);
    assert.ok(Math.hypot(b.x, b.z + 32) >= 8);
  }
});
test('the boss is the fourth and last level', () => {
  assert.equal(LEVELS.length, 4);
  assert.equal(LEVELS[3].boss, true);
  assert.equal(LEVELS.filter((l) => l.boss).length, 1);
});
