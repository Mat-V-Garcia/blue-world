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

const makePlayer = (cols = []) => { setGround({ height: () => 0, radius: 60 }); return new Player(cols); };

test('a webbed lizard crawls, cannot sprint or jump, and gets free', () => {
  const p = makePlayer();
  p.webbed = 1;
  p.update(1 / 60, { x: 0, z: 1, sprint: true, jump: true });
  assert.ok(Math.abs(p.speed - 5.5 / 3) < 0.05, `speed ${p.speed}`);
  assert.equal(p.onGround, true);
  for (let i = 0; i < 61; i++) p.update(1 / 60, { x: 0, z: 0 });
  assert.equal(p.webbed, 0);
  p.update(1 / 60, { x: 0, z: 1, sprint: true });
  assert.ok(Math.abs(p.speed - 10) < 0.05);
});

test('a webbed lizard lets go of a wall and cannot grab one', () => {
  const w = { type: 'box', x: 0, z: 2, hx: 3, hz: 0.5, angle: 0, bottom: -100, top: 4, climbable: true };
  const p = makePlayer([w]);
  p.wall = w; p.pos.set(0, 1, 1.2);
  p.webbed = 1;
  p.update(1 / 60, { x: 0, z: 1 });
  assert.equal(p.climbing, false);
  for (let i = 0; i < 30; i++) p.update(1 / 60, { x: 0, z: 1 });
  assert.equal(p.climbing, false);
});
