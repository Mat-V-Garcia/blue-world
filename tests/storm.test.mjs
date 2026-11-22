import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { stormLevel, lightningGap, createStorm } from '../src/storm.js';

const scene = { add() {}, remove() {} };
const rig = () => ({
  sky: { top: new THREE.Color(0x2f6fc4), bottom: new THREE.Color(0xcfe3f2), painting: null },
  fog: { color: new THREE.Color(0xcfe3f2) },
  hemi: { color: new THREE.Color(0xcfe4ff), groundColor: new THREE.Color(0xd9a877), intensity: 1.45 },
  sun: { color: new THREE.Color(0xfff1dc), intensity: 2.7 },
});

test('storm level follows boss health', () => {
  assert.equal(stormLevel(6, 6), 0); assert.equal(stormLevel(3, 6), 0.5); assert.equal(stormLevel(0, 6), 1);
});
test('no lightning before half way; gaps shrink but never under 1.5 s', () => {
  assert.equal(lightningGap(0.49, 0), null);
  assert.equal(lightningGap(0.5, 0), 5); assert.equal(lightningGap(0.5, 1), 9);
  assert.equal(lightningGap(5 / 6, 0), 1.5); assert.equal(lightningGap(1, 1), 4);
});
test('the sky eases to red over about a second, and reset snaps it back', () => {
  const r = rig(), s = createStorm(scene, r);
  s.set(1);
  s.update(0.5);
  assert.ok(s.level > 0.4 && s.level < 0.6);
  s.update(1);
  assert.equal(s.level, 1);
  assert.ok(r.sky.top.r > r.sky.top.b && r.fog.color.r > r.fog.color.b);
  assert.ok(Math.abs(r.sun.intensity - 1.9) < 0.01);
  s.reset(); s.update(0);
  assert.equal(s.level, 0);
  assert.equal(r.sky.top.getHex(), 0x2f6fc4);
  assert.ok(Math.abs(r.sun.intensity - 2.7) < 0.01);
});
test('bolts come only when stormy and at least 1.5 s apart', () => {
  const calm = createStorm(scene, rig(), () => 0);
  for (let i = 0; i < 600; i++) assert.equal(calm.update(1 / 60).bolt, false);
  const s = createStorm(scene, rig(), () => 0);
  s.set(1);
  let last = -Infinity, n = 0;
  for (let i = 0; i < 20 * 60; i++) {
    if (s.update(1 / 60).bolt) { assert.ok(i / 60 - last >= 1.49); last = i / 60; n++; }
  }
  assert.ok(n >= 8);
});
test('a flash never pushes the skylight above its calm brightness plus 0.8', () => {
  const r = rig(), s = createStorm(scene, r, () => 0);
  s.set(1);
  for (let i = 0; i < 600; i++) { s.update(1 / 60); assert.ok(r.hemi.intensity <= 1.45 + 0.8 + 1e-6); }
});
