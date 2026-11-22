import test from 'node:test';
import assert from 'node:assert/strict';
import { setGround, clampToWorld } from '../src/world.js';

test('circle: points outside are pulled onto the radius', () => {
  setGround({ height: () => 0, radius: 10 });
  assert.deepEqual(clampToWorld(3, 4), [3, 4]);
  const [x, z] = clampToWorld(30, 40);
  assert.ok(Math.abs(Math.hypot(x, z) - 10) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...clampToWorld(30, 40, 2)) - 8) < 1e-9);
});

test('rectangle: each axis is clamped on its own, with margin', () => {
  setGround({ height: () => 0, radius: 99, bounds: { x0: -24, x1: 24, z0: -48, z1: 48 } });
  assert.deepEqual(clampToWorld(30, 0), [24, 0]);
  assert.deepEqual(clampToWorld(-30, 60), [-24, 48]);
  assert.deepEqual(clampToWorld(30, -60, 2), [22, -46]);
});

test('setGround without bounds clears earlier bounds', () => {
  setGround({ height: () => 0, radius: 10, bounds: { x0: -1, x1: 1, z0: -1, z1: 1 } });
  setGround({ height: () => 0, radius: 10 });
  assert.deepEqual(clampToWorld(5, 0), [5, 0]);
});
