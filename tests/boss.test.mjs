import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setGround } from '../src/world.js';
import { createBoss, BOSS } from '../src/boss.js';

const scene = { add() {}, remove() {} };
const model = () => ({ root: new THREE.Object3D(), update() {} });
const make = (colliders = []) => { setGround({ height: () => 0, radius: 40 }); return createBoss(scene, colliders, model, { x: 0, z: 0 }); };
const liz = (x, z, y = 0, velY = 0) => ({ pos: new THREE.Vector3(x, y, z), velY });
// step until pred(events, boss) is true; returns the events of that frame (fails after `secs`)
const until = (b, p, pred, secs = 10, hurt = true) => {
  for (let i = 0; i < secs * 60; i++) { const e = b.update(1 / 60, p, hurt); if (pred(e, b)) return e; }
  assert.fail(`never happened; state ${b.state}`);
};
const stick = (b, p) => { until(b, p, (e) => e.windupNow === 'lunge'); p.pos.set(30, 0, 30); until(b, p, (e) => e.stuckNow); };

test('walks toward a distant lizard, slower than the lizard walks', () => {
  const b = make(), p = liz(0, 30);
  b.update(1, p, true);                       // too far to lunge (webs come in Task 3)
  assert.ok(b.pos.z > 0 && b.pos.z <= BOSS.WALK + 0.01);
});
test('winds up for 0.8 s when the lizard is in range, then lunges at where it was', () => {
  const b = make(), p = liz(0, 10);
  assert.equal(b.update(1 / 60, p, true).windupNow, 'lunge');
  for (let i = 0; i < 46; i++) b.update(1 / 60, p, true);
  assert.equal(b.state, 'windup');
  until(b, p, (_e, bb) => bb.state === 'lunge', 0.1);
});
test('a lunge that reaches the lizard costs a heart', () => {
  const b = make(), p = liz(0, 10);
  const e = until(b, p, (ev) => ev.caught);
  assert.ok(e.caught.isVector3);
});
test('a dodged lunge leaves it stuck, then it pulls free after 2.5 s at full health', () => {
  const b = make(), p = liz(0, 10);
  stick(b, p);
  assert.equal(b.state, 'stuck');
  for (let i = 0; i < 2.4 * 60; i++) b.update(1 / 60, p, true);
  assert.equal(b.state, 'stuck');
  for (let i = 0; i < 0.2 * 60; i++) b.update(1 / 60, p, true);
  assert.notEqual(b.state, 'stuck');
});
test('a lunge through a flashing lizard is a miss and sticks', () => {
  const b = make(), p = liz(0, 10);
  const e = until(b, p, (ev) => ev.stuckNow || ev.caught, 10, false);
  assert.equal(e.caught, null);
});
test('a lunge into a boulder sticks there', () => {
  const rock = { type: 'circle', x: 0, z: 6, r: 1.5, bottom: -100, top: 2.2, climbable: true };
  const b = make([rock]), p = liz(0, 12);
  until(b, p, (e) => e.stuckNow);
  assert.ok(b.pos.z < 6);
});
test('landing on its back while stuck takes 1 health and frees it', () => {
  const b = make(), p = liz(0, 10);
  stick(b, p);
  p.pos.set(b.pos.x, 0.9, b.pos.z); p.velY = -3;
  const e = b.update(1 / 60, p, true);
  assert.equal(e.hit, true);
  assert.equal(b.health, 5);
  assert.equal(b.state, 'recover');
  assert.equal(b.update(1 / 60, p, true).hit, false);   // not twice
});
test('walking into it while stuck is harmless', () => {
  const b = make(), p = liz(0, 10);
  stick(b, p);
  p.pos.set(b.pos.x, 0, b.pos.z); p.velY = 0;
  const e = b.update(1 / 60, p, true);
  assert.equal(e.caught, null); assert.equal(e.hit, false);
});
test('landing on its back when it is not stuck only bounces', () => {
  const b = make(), p = liz(0, 0, BOSS.BACK_UP, -3);
  const e = b.update(1 / 60, p, true);
  assert.equal(e.bounced, true); assert.equal(b.health, 6); assert.equal(e.caught, null);
});
test('stuck time shrinks to 1.8 s at 1 health; the sixth hit defeats it', () => {
  const b = make(), p = liz(0, 10);
  for (let n = 6; n > 1; n--) {
    stick(b, p); p.pos.set(b.pos.x, 0.9, b.pos.z); p.velY = -3;
    b.update(1 / 60, p, true);
    p.pos.set(b.pos.x, 0, b.pos.z + 10); p.velY = 0;
    until(b, p, (_e, bb) => bb.state !== 'recover');
  }
  assert.equal(b.health, 1);
  stick(b, p);
  for (let i = 0; i < 1.7 * 60; i++) b.update(1 / 60, p, true);
  assert.equal(b.state, 'stuck');
  p.pos.set(b.pos.x, 0.9, b.pos.z); p.velY = -3;
  const e = b.update(1 / 60, p, true);
  assert.equal(e.defeated, true); assert.equal(b.state, 'defeated');
  assert.equal(b.update(1, liz(b.pos.x, b.pos.z), true).caught, null);
});
test('shoots a web at a lizard that stays far away', () => {
  const b = make(), p = liz(0, 30);
  assert.equal(until(b, p, (e) => e.windupNow).windupNow, 'web');
  until(b, p, (e) => e.shotNow, 1);
  assert.equal(b.webs.length, 1);
});
test('a web that reaches the lizard webs it; a flashing lizard is not webbed', () => {
  const b = make(), p = liz(0, 30);
  until(b, p, (e) => e.webbed, 6);
  const b2 = make();
  const e = until(b2, liz(0, 30), (ev) => ev.splat || ev.webbed, 6, false);
  assert.equal(e.webbed, false);
});
test('a web that misses splats on the sand', () => {
  const b = make(), p = liz(0, 30);
  until(b, p, (e) => e.shotNow);
  p.pos.set(30, 0, 0);
  const e = until(b, p, (ev) => ev.splat || ev.webbed, 4);
  assert.ok(e.splat && Math.abs(e.splat.z - 30) < 4);
});
test('a boulder stops a web', () => {
  const rock = { type: 'circle', x: 0, z: 20, r: 2, bottom: -100, top: 2.2, climbable: true };
  const b = make([rock]), p = liz(0, 30);
  until(b, p, (e) => e.shotNow);
  for (let i = 0; i < 180; i++) { const e = b.update(1 / 60, p, true); assert.equal(e.webbed, false); assert.equal(e.splat, null); if (!b.webs.length) return; }
  assert.fail('web never stopped');
});
test('webbing the lizard is followed by a lunge from where it stands', () => {
  const b = make(), p = liz(0, 24); // far enough that it is still out of lunge range when the web lands
  until(b, p, (e) => e.webbed, 6);
  assert.equal(until(b, p, (e) => e.windupNow, 0.2).windupNow, 'lunge');
});
test('a lizard perched on a boulder for 2 s gets a web even up close', () => {
  const b = make(), p = liz(0, 16, 2.2);
  until(b, p, (e) => e.shotNow);          // far: web
  p.pos.set(b.pos.x, 2.2, b.pos.z + 8);   // close, but up on a rock
  assert.equal(until(b, p, (e) => e.windupNow === 'web', 8).windupNow, 'web');
});
test('a dropped tail within 20 units baits a lunge at the tail', () => {
  const b = make(), p = liz(0, 30);
  assert.equal(b.baitWith(new THREE.Vector3(15, 0, 0)), true);
  assert.equal(b.state, 'windup');
  until(b, p, (e) => e.stuckNow);
  assert.ok(b.pos.x > 12);
});
test('tail bait is ignored when too far, or while stuck, recovering or lunging', () => {
  const far = make();
  assert.equal(far.baitWith(new THREE.Vector3(25, 0, 0)), false);
  const b = make(), p = liz(0, 10);
  stick(b, p);
  assert.equal(b.baitWith(new THREE.Vector3(5, 0, 0)), false);
  assert.equal(b.state, 'stuck');
});
test('below half health wind-ups are 25% shorter', () => {
  const b = make(), p = liz(0, 10);
  for (let n = 0; n < 4; n++) {
    stick(b, p); p.pos.set(b.pos.x, 0.9, b.pos.z); p.velY = -3; b.update(1 / 60, p, true);
    p.pos.set(b.pos.x, 0, b.pos.z + (b.pos.z > 0 ? -10 : 10)); p.velY = 0; // back toward the middle, clear of the wall
    until(b, p, (_e, bb) => bb.state !== 'recover');
  }
  assert.equal(b.health, 2);
  until(b, p, (e) => e.windupNow === 'lunge');
  for (let i = 0; i < 0.62 * 60; i++) b.update(1 / 60, p, true);
  assert.equal(b.state, 'lunge');
});
test('reset restores full health, the start spot and clears webs', () => {
  const b = make(), p = liz(0, 30);
  until(b, p, (e) => e.shotNow);
  b.reset();
  assert.equal(b.health, 6); assert.equal(b.webs.length, 0);
  assert.equal(b.state, 'approach'); assert.deepEqual([b.pos.x, b.pos.z], [0, 0]);
});
