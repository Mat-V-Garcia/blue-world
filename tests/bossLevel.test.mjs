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
test('every level is followed by its boss: tarantula, falcon, mama cat, then the same again inverted', () => {
  assert.equal(LEVELS.length, 12);
  assert.deepEqual(LEVELS.map((l) => !!l.boss), [false, true, false, true, false, true, false, true, false, true, false, true]);
  for (const l of LEVELS.filter((x) => x.boss)) assert.ok(l.icon);
});

import { PEBBLES } from '../src/levels/boss.js';
test('ten pebbles in the arena, spread out, none where the boss comes up', () => {
  assert.equal(PEBBLES.length, 10);
  for (const [i, p] of PEBBLES.entries()) {
    const d = Math.hypot(p.x, p.z);
    assert.ok(d >= 6 && d <= 36, `pebble ${i} at ${d}`);
    assert.ok(p.hint);
    for (const q of PEBBLES.slice(i + 1)) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= 6);
  }
});

import { PEBBLES as FALCON_PEBBLES, PERCH } from '../src/levels/falcon.js';
test('falcon level: ten pebbles spread round the shops, low enough to reach from the ground', () => {
  assert.equal(FALCON_PEBBLES.length, 10);
  for (const [i, p] of FALCON_PEBBLES.entries()) {
    assert.ok(Math.hypot(p.x, p.z) <= 60, `pebble ${i}`);
    assert.ok(p.hint && p.up >= 0.5 && p.up <= 0.6);
    for (const q of FALCON_PEBBLES.slice(i + 1)) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= 6);
  }
  assert.ok(PERCH.y > 25);
});

import { PEBBLES as CAT_PEBBLES, CAT_START, BOSS as CAT_BOSS } from '../src/levels/cat.js';
test('cat level: the boss is Mama Cat, six hits, with nothing to shoot', () => {
  assert.equal(CAT_BOSS.kind, 'cat');
  assert.equal(CAT_BOSS.health, 6);
  assert.equal(CAT_BOSS.text.name, 'Mama Cat');
  assert.equal('shotColor' in CAT_BOSS, false);
  assert.equal(CAT_BOSS.tune?.WEB_TIME, undefined);
  assert.equal('webbed' in CAT_BOSS.text, false);
  assert.ok(!JSON.stringify(CAT_BOSS.text).match(/hairball|big cat/i));
});
test('cat level: the menu calls her Mama Cat and never mentions hairballs', () => {
  const l = LEVELS[5];
  assert.equal(l.name, 'Mama Cat');
  for (const k of ['intro', 'hint', 'help', 'helpTouch']) { assert.match(l[k], /mama/i, k); assert.doesNotMatch(l[k], /hairball|big cat/i, k); }
});
test('cat level: ten pebbles on the ground, spread out, none where the cat lands', () => {
  assert.equal(CAT_PEBBLES.length, 10);
  for (const [i, p] of CAT_PEBBLES.entries()) {
    assert.ok(Math.abs(p.x) <= 22 && Math.abs(p.z) <= 44 && p.hint, `pebble ${i}`);
    assert.ok(Math.hypot(p.x - CAT_START.x, p.z - CAT_START.z) >= 6);
    for (const q of CAT_PEBBLES.slice(i + 1)) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= 6);
  }
});
