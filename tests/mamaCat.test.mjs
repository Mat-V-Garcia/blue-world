import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setGround } from '../src/world.js';
import { createMamaCat, CAT } from '../src/mamaCat.js';

const scene = { add() {}, remove() {} };
const model = () => ({ root: new THREE.Object3D(), update() {} });
const DT = 1 / 60;
const liz = (x, z, y = 0, velY = 0) => ({ pos: new THREE.Vector3(x, y, z), velY, onGround: y === 0 });
const until = (b, p, pred, secs = 10, hurt = true) => {
  for (let i = 0; i < secs * 60; i++) { const e = b.update(DT, p, hurt); if (pred(e, b)) return e; }
  assert.fail(`never happened; state ${b.state}`);
};
const run = (b, p, secs, hurt = true) => { const all = []; for (let i = 0; i < Math.round(secs * 60); i++) all.push(b.update(DT, p, hurt)); return all; };
const hidden = (colliders = [], cfg = {}, radius = 40) => { setGround({ height: () => 0, radius }); return createMamaCat(scene, colliders, model, { x: 0, z: 0, emergeFrom: 9, ...cfg }); };
// a cat that has landed and is on its first frame of stalking; p is where the lizard waited
const make = (p, colliders, cfg, radius) => { const b = hidden(colliders, cfg, radius); b.emerge(); until(b, p, (_e, bb) => bb.state === 'stalk'); return b; };
const dist = (b, p) => Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z);

// ---------- arriving ----------
test('waits hidden, drops in from above, harmless until she lands', () => {
  const b = hidden(), p = liz(0, 1);
  assert.equal(b.state, 'hidden');
  assert.equal(b.rig.visible, false);
  assert.equal(b.update(DT, p, true).caught, null);
  assert.equal(b.emerge(), true);
  assert.equal(b.emerge(), false);
  b.update(DT, p, true);
  assert.ok(b.rig.visible && b.rig.position.y > 5, 'starts high');
  const evs = run(b, p, CAT.EMERGE - 0.1);
  assert.equal(b.state, 'emerge');
  assert.ok(evs.every((e) => !e.caught), 'harmless while dropping in');
  until(b, p, (_e, bb) => bb.state === 'stalk', 0.3);
});

// ---------- stalking ----------
test('stalks: closes on a far lizard, no faster than CAT.STALK', () => {
  const p = liz(0, 30), b = make(p);
  const d0 = dist(b, p), x0 = b.pos.x, z0 = b.pos.z;
  run(b, p, 1);
  assert.equal(b.state, 'stalk');
  assert.ok(dist(b, p) < d0 - 1, 'got closer');
  assert.ok(Math.hypot(b.pos.x - x0, b.pos.z - z0) <= CAT.STALK + 0.01);
});

// ---------- paw swipe ----------
test('swipe: lifts a paw for 0.6 s, then catches a lizard on the ground in front of her', () => {
  const p = liz(0, 4), b = make(p);
  assert.equal(b.update(DT, p, true).windupNow, 'swipe');
  assert.equal(b.state, 'swipeWind');
  const evs = run(b, p, CAT.SWIPE_WINDUP - 2 * DT);
  assert.equal(b.state, 'swipeWind');
  assert.ok(evs.every((e) => !e.caught), 'the raised paw does not hurt');
  const e = until(b, p, (ev) => ev.caught, 0.4);
  assert.ok(e.caught.isVector3);
});
const windUp = (p) => { const b = make(p); b.update(DT, p, true); assert.equal(b.state, 'swipeWind'); return b; };
const noCatch = (b, p) => assert.ok(run(b, p, CAT.SWIPE_WINDUP + CAT.SWIPE_TIME + 0.2).every((e) => !e.caught));
test('swipe: a lizard that backs out of reach is missed', () => {
  const p = liz(0, 4), b = windUp(p);
  p.pos.set(0, 0, 12);
  noCatch(b, p);
});
test('swipe: a lizard jumping over the paw is missed', () => {
  const p = liz(0, 4), b = windUp(p);
  p.pos.y = 0.9; p.onGround = false;
  noCatch(b, p);
});
test('swipe: a lizard behind her is missed', () => {
  const p = liz(0, 4), b = windUp(p);
  p.pos.set(0, 0, -4);
  noCatch(b, p);
});

// ---------- touching her ----------
test('walking into her side while she is on her feet costs a heart', () => {
  const p = liz(0, 30), b = make(p);
  p.pos.set(b.pos.x + 1, 0, b.pos.z);
  assert.ok(b.update(DT, p, true).caught);
});
test('landing on her standing back bounces the lizard off, unhurt', () => {
  const p = liz(0, 30), b = make(p);
  p.pos.set(b.pos.x, CAT.BACK_UP, b.pos.z); p.velY = -3; p.onGround = false;
  const e = b.update(DT, p, true);
  assert.equal(e.bounced, true);
  assert.equal(e.caught, null);
  assert.equal(b.health, CAT.HEALTH);
});
test('canHurt false: neither her side nor her paw catches the lizard', () => {
  const p = liz(0, 4), b = make(p);
  assert.ok(run(b, p, 3, false).every((e) => !e.caught));
  p.pos.set(b.pos.x + 1, 0, b.pos.z);
  assert.equal(b.update(DT, p, false).caught, null);
});
test('reset(): hidden again at full health where she started', () => {
  const p = liz(0, 30), b = make(p);
  run(b, p, 2);
  b.reset();
  assert.equal(b.state, 'hidden');
  assert.equal(b.health, b.maxHealth);
  assert.equal(b.pos.x, 0); assert.equal(b.pos.z, 0);
  assert.equal(b.rig.visible, false);
});
