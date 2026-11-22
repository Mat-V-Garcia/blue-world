import test from 'node:test';
import assert from 'node:assert/strict';
import { setGround } from '../src/world.js';
import { Player } from '../src/player.js';

const wall = { type: 'box', x: 0, z: -1.2, hx: 5, hz: 0.5, angle: 0, bottom: -100, top: 6, climbable: true };

test('behind(): the spot a little behind the lizard when it is free', () => {
  setGround({ height: () => 0, radius: 50 });
  const p = new Player([]);
  p.yaw = 0; // facing +z
  assert.deepEqual(p.behind(0.6).toArray(), [0, 0, -0.6]);
});

test('behind(): falls back to the lizard itself when that spot is inside a wall', () => {
  setGround({ height: () => 0, radius: 50 });
  const p = new Player([wall]);
  p.yaw = 0;
  assert.deepEqual(p.behind(0.6).toArray(), [0, 0, 0]);
});

test('behind(): falls back to the lizard itself when that spot is outside the level', () => {
  setGround({ height: () => 0, radius: 50, bounds: { x0: -5, x1: 5, z0: -0.3, z1: 5 } });
  const p = new Player([]);
  p.yaw = 0;
  assert.deepEqual(p.behind(0.6).toArray(), [0, 0, 0]);
});
