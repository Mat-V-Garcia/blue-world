import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setGround } from '../src/world.js';
import { createFalcon, FALCON } from '../src/falcon.js';

const scene = { add() {}, remove() {} };
const model = () => ({ root: new THREE.Object3D(), update() {} });
const make = (colliders = []) => {
  setGround({ height: () => 0, radius: 66 });
  return createFalcon(scene, colliders, model, { perch: { x: -20, y: 30, z: 20 } });
};
const liz = (x, z, y = 0, velY = 0) => ({ pos: new THREE.Vector3(x, y, z), velY });
const until = (b, p, pred, secs = 15, hurt = true) => {
  for (let i = 0; i < secs * 60; i++) { const e = b.update(1 / 60, p, hurt); if (pred(e, b)) return e; }
  assert.fail(`never happened; state ${b.state}`);
};
// make it dive, step aside once it has committed, and wait for it to hit the ground
const miss = (b, p) => {
  until(b, p, (_e, bb) => bb.state === 'dive');
  p.pos.x += 8;
  return until(b, p, (e) => e.stuckNow);
};
const land = (b, p) => { p.pos.set(b.pos.x, b.pos.y + 0.9, b.pos.z); p.velY = -3; return b.update(1 / 60, p, true); };

test('sits on its perch and does nothing until the fight starts', () => {
  const b = make(), p = liz(0, 0);
  for (let i = 0; i < 300; i++) assert.equal(b.update(1 / 60, p, true).windupNow, null);
  assert.equal(b.state, 'hidden');
  assert.equal(b.pos.y, 30);
  assert.equal(b.emerge(), true);
  assert.equal(b.emerge(), false);
});
test('flies over the lizard, then screeches and dives', () => {
  const b = make(), p = liz(0, 0);
  b.emerge();
  assert.equal(until(b, p, (e) => e.windupNow).windupNow, 'dive');
  assert.ok(b.pos.y > 8, 'high above the lizard');
  until(b, p, (_e, bb) => bb.state === 'dive', FALCON.WINDUP + 0.1);
});
test('a lizard that stands still is caught', () => {
  const b = make(), p = liz(0, 0);
  b.emerge();
  const e = until(b, p, (ev) => ev.caught || ev.stuckNow);
  assert.ok(e.caught?.isVector3);
  assert.equal(b.state, 'circle'); // straight back up, no opening
});
test('a dodged dive leaves it on the ground for 2.4 s at full health', () => {
  const b = make(), p = liz(0, 0);
  b.emerge();
  miss(b, p);
  assert.equal(b.state, 'stuck');
  assert.ok(Math.abs(b.pos.y) < 0.01 && Math.hypot(b.pos.x, b.pos.z) < 0.5, 'where the lizard was');
  for (let i = 0; i < 2.3 * 60; i++) b.update(1 / 60, p, true);
  assert.equal(b.state, 'stuck');
  for (let i = 0; i < 0.2 * 60; i++) b.update(1 / 60, p, true);
  assert.equal(b.state, 'circle');
});
test('a dive through a flashing lizard is a miss', () => {
  const b = make(), p = liz(0, 0);
  b.emerge();
  const e = until(b, p, (ev) => ev.caught || ev.stuckNow, 15, false);
  assert.equal(e.caught, null);
});
test('landing on its back while it is down takes 1 health, once', () => {
  const b = make(), p = liz(0, 0);
  b.emerge(); miss(b, p);
  assert.equal(land(b, p).hit, true);
  assert.equal(b.health, 5);
  assert.equal(b.state, 'circle');
  assert.equal(b.update(1 / 60, p, true).hit, false);
});
test('walking into it while it is down is harmless', () => {
  const b = make(), p = liz(0, 0);
  b.emerge(); miss(b, p);
  p.pos.set(b.pos.x, 0, b.pos.z); p.velY = 0;
  const e = b.update(1 / 60, p, true);
  assert.equal(e.caught, null); assert.equal(e.hit, false);
});
test('it only hurts while diving: flying past the lizard is harmless', () => {
  const b = make(), p = liz(0, 0);
  b.emerge(); miss(b, p);
  p.pos.set(b.pos.x, 0, b.pos.z);
  for (let i = 0; i < 3 * 60; i++) { // it takes off right through the lizard
    const e = b.update(1 / 60, p, true);
    if (b.state === 'dive') break;
    assert.equal(e.caught, null);
  }
});
test('a lizard under a car is safe: the falcon bonks into the roof and recovers fast', () => {
  const car = { type: 'box', x: 0, z: 0, hx: 2.7, hz: 6, angle: 0, bottom: 0.8, top: 3.0, climbable: true };
  const b = make([car]), p = liz(0, 0);
  b.emerge();
  const e = until(b, p, (ev) => ev.caught || ev.stuckNow);
  assert.equal(e.caught, null);
  assert.equal(e.bonked, true);
  assert.ok(Math.abs(b.pos.y) < 0.01, 'on the ground');
  assert.ok(Math.abs(b.pos.x) > 2.7 || Math.abs(b.pos.z) > 6, 'beside the car, not inside it');
  for (let i = 0; i < (FALCON.BONK + 0.1) * 60; i++) b.update(1 / 60, p, true);
  assert.equal(b.state, 'circle');
});
test('a dive at a lizard on a roof lands on the roof', () => {
  const car = { type: 'box', x: 0, z: 0, hx: 2.7, hz: 6, angle: 0, bottom: 0.8, top: 3.0, climbable: true };
  const b = make([car]), p = liz(0, 0, 3.0);
  b.emerge();
  until(b, p, (_e, bb) => bb.state === 'dive');
  p.pos.z += 5; // still on the roof
  const e = until(b, p, (ev) => ev.stuckNow);
  assert.equal(e.bonked, false);
  assert.ok(Math.abs(b.pos.y - 3.0) < 0.01);
  assert.equal(land(b, p).hit, true);
});
test('time on the ground shrinks to 1.7 s at 1 health; the sixth hit defeats it', () => {
  const b = make(), p = liz(0, 0);
  b.emerge();
  for (let n = 6; n > 1; n--) { miss(b, p); assert.equal(land(b, p).hit, true); p.pos.y = 0; p.velY = 0; }
  assert.equal(b.health, 1);
  miss(b, p);
  for (let i = 0; i < 1.6 * 60; i++) b.update(1 / 60, p, true);
  assert.equal(b.state, 'stuck');
  for (let i = 0; i < 0.2 * 60; i++) b.update(1 / 60, p, true);
  assert.equal(b.state, 'circle');
  p.pos.y = 0; miss(b, p);
  const e = land(b, p);
  assert.equal(e.defeated, true); assert.equal(b.state, 'defeated');
  p.pos.y = 0;
  for (let i = 0; i < 300; i++) assert.equal(b.update(1 / 60, p, true).caught, null);
  assert.ok(b.pos.y > 20, 'flies away');
});
test('below half health it hovers for less time', () => {
  const b = make(), p = liz(0, 0);
  b.emerge();
  for (let n = 0; n < 4; n++) { miss(b, p); land(b, p); p.pos.y = 0; p.velY = 0; }
  assert.equal(b.health, 2);
  until(b, p, (e) => e.windupNow);
  for (let i = 0; i < FALCON.WINDUP * FALCON.ANGRY * 60 + 2; i++) b.update(1 / 60, p, true);
  assert.notEqual(b.state, 'windup');
});
test('a dropped tail baits a dive at the tail', () => {
  const b = make(), p = liz(0, 0);
  assert.equal(b.baitWith(new THREE.Vector3(5, 0, 0)), false); // still on its perch
  b.emerge();
  until(b, p, (_e, bb) => bb.pos.y < 13);
  const tail = new THREE.Vector3(6, 0, 0);
  assert.equal(b.baitWith(tail), true);
  assert.equal(b.state, 'windup');
  p.pos.set(-6, 0, 0); // the lizard runs the other way
  until(b, p, (e) => e.stuckNow);
  assert.ok(b.pos.distanceTo(tail) < 0.5);
  assert.equal(b.baitWith(tail), false); // already down
});
test('a tail too far away is ignored', () => {
  const b = make(), p = liz(0, 0);
  b.emerge();
  assert.equal(b.baitWith(new THREE.Vector3(60, 0, 60)), false);
});
test('reset puts it back on its perch at full health', () => {
  const b = make(), p = liz(0, 0);
  b.emerge(); miss(b, p); land(b, p);
  b.reset();
  assert.equal(b.state, 'hidden'); assert.equal(b.health, 6);
  assert.deepEqual([b.pos.x, b.pos.y, b.pos.z], [-20, 30, 20]);
});

test('tune overrides the falcon\'s numbers (the inverted level uses this)', async () => {
  const { createFalcon, FALCON } = await import('../src/falcon.js');
  const THREE = await import('three');
  const model = () => ({ root: new THREE.Group(), update() {} });
  const f = createFalcon(new THREE.Scene(), [], model, { perch: { x: 0, y: 12, z: 0 }, health: 8, tune: { BODY_R: 3 } });
  assert.equal(f.bodyR, 3);
  assert.equal(f.maxHealth, 8);
  assert.equal(createFalcon(new THREE.Scene(), [], model, {}).bodyR, FALCON.BODY_R);
});

// ---- three strikes (the inverted falcon) ----
const triple = () => {
  setGround({ height: () => 0, radius: 66 });
  return createFalcon(scene, [], model, { perch: { x: -20, y: 30, z: 20 }, tune: { RINGS: 3 } });
};
const shown = (b) => b.rings.filter((r) => r.visible);
test('the regular falcon has one ring, on the lizard', () => {
  const b = make(), p = liz(3, 4);
  b.emerge();
  until(b, p, (_e, bb) => bb.state === 'windup');
  assert.equal(b.rings.length, 1);
  assert.equal(shown(b).length, 1);
  assert.ok(Math.hypot(b.rings[0].position.x - 3, b.rings[0].position.z - 4) < 0.01);
});
test('with three rings, they circle close round the lizard while it hovers, and stop when it dives', () => {
  const b = triple(), p = liz(0, 0);
  b.emerge();
  until(b, p, (_e, bb) => bb.state === 'windup');
  b.update(1 / 60, p, true);
  assert.equal(shown(b).length, 3);
  const at = () => b.rings.map((r) => [r.position.x, r.position.z]);
  const a = at();
  for (const [x, z] of a) assert.ok(Math.abs(Math.hypot(x, z) - FALCON.RING_R) < 0.01);
  b.update(1 / 60, p, true);
  assert.notDeepEqual(at(), a, 'turning');
  p.pos.x = 5; b.update(1 / 60, p, true);
  for (const [x, z] of at()) assert.ok(Math.abs(Math.hypot(x - 5, z) - FALCON.RING_R) < 0.01, 'following the lizard');
  until(b, p, (_e, bb) => bb.state === 'dive');
  const fixed = at();
  p.pos.x = 30; b.update(1 / 60, p, true); b.update(1 / 60, p, true);
  assert.deepEqual(at(), fixed);
});
test('with three rings, it strikes all three before it is down, and a ring goes out as it is struck', () => {
  const b = triple(), p = liz(0, 0);
  b.emerge();
  until(b, p, (_e, bb) => bb.state === 'dive');
  p.pos.x = 30; // well clear of all three
  const spots = b.rings.map((r) => r.position.clone());
  let strikes = 0, e;
  for (let i = 0; i < 10 * 60; i++) {
    e = b.update(1 / 60, p, true);
    if (e.struck) { strikes++; assert.equal(shown(b).length, 3 - strikes); assert.equal(b.state, 'hop'); }
    if (e.stuckNow) break;
  }
  assert.equal(strikes, 2);
  assert.ok(e.stuckNow);
  assert.equal(b.state, 'stuck');
  assert.ok(Math.hypot(b.pos.x - spots[2].x, b.pos.z - spots[2].z) < 0.5, 'down at the last ring');
  assert.equal(shown(b).length, 0);
  assert.equal(land(b, p).hit, true); // and it can be landed on there
});
test('with three rings, a lizard that stands still is caught', () => {
  const b = triple(), p = liz(0, 0);
  b.emerge();
  assert.ok(until(b, p, (ev) => ev.caught || ev.stuckNow).caught);
  assert.equal(b.state, 'circle');
});
test('with three rings, a lizard that waits in a ring not yet struck is caught there', () => {
  const b = triple(), p = liz(0, 0);
  b.emerge();
  until(b, p, (_e, bb) => bb.state === 'dive');
  p.pos.set(b.rings[2].position.x, 0, b.rings[2].position.z); // step into the last ring: the first two miss
  const e = until(b, p, (ev) => ev.caught || ev.stuckNow);
  assert.ok(e.caught);
});
test('with three rings, the hop between strikes cannot hurt', () => {
  const b = triple(), p = liz(0, 0);
  b.emerge();
  until(b, p, (_e, bb) => bb.state === 'dive');
  p.pos.x = 30;
  until(b, p, (e) => e.struck);
  p.pos.copy(b.pos); // right on top of it as it lifts off
  assert.equal(b.update(1 / 60, p, true).caught, null);
});
test('with three rings, a dropped tail still gets one dive, at the tail', () => {
  const b = triple(), p = liz(0, 0);
  b.emerge();
  until(b, p, (_e, bb) => bb.state === 'windup');
  assert.equal(b.baitWith(new THREE.Vector3(6, 0, 0)), true);
  b.update(1 / 60, p, true);
  assert.equal(shown(b).length, 1);
  p.pos.x = -20;
  const e = until(b, p, (ev) => ev.struck || ev.stuckNow);
  assert.ok(e.stuckNow);
  assert.ok(Math.hypot(b.pos.x - 6, b.pos.z) < 0.5);
});
