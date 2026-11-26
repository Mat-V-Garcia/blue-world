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

// ---------- pounce, flop, hits ----------
const away = (p, n = 1) => { p.pos.set(n % 2 ? 20 : -20, 0, n % 2 ? -20 : 20); p.velY = 0; p.onGround = true; };
// dodge every pounce until she flops; returns the frame she flopped in
const flopHer = (b, p) => { let n = 0; return until(b, p, (e) => { if (e.windupNow === 'pounce') away(p, ++n); return e.stuckNow; }, 30); };
// drop onto her back for one frame, then step well clear
const land = (b, p) => {
  p.pos.set(b.pos.x, 0.9, b.pos.z); p.velY = -3; p.onGround = false;
  const e = b.update(DT, p, true);
  p.pos.set(b.pos.x, 0, b.pos.z + 10); p.velY = 0; p.onGround = true;
  return e;
};

test('pounce: crouches 0.9 s at mid range with a ring on the landing spot, then leaps there in a high arc', () => {
  const p = liz(0, 10), b = make(p);
  assert.equal(b.ring.visible, false);
  assert.equal(b.update(DT, p, true).windupNow, 'pounce');
  assert.equal(b.state, 'crouch');
  assert.ok(b.ring.visible && Math.abs(b.ring.position.x) < 0.01 && Math.abs(b.ring.position.z - 10) < 0.01);
  run(b, p, CAT.CROUCH - 2 * DT);
  assert.equal(b.state, 'crouch');
  until(b, p, (_e, bb) => bb.state === 'pounce', 0.1);
  away(p);
  let peak = 0;
  until(b, p, (e, bb) => { peak = Math.max(peak, bb.rig.position.y); return e.stuckNow; }, 2);
  assert.ok(Math.abs(peak - CAT.ARC) < 0.2, `peak ${peak}`);
  assert.ok(Math.hypot(b.pos.x, b.pos.z - 10) < 0.01, 'landed where the lizard was');
  assert.equal(b.ring.visible, false);
});
test('pounce: landing on the lizard costs a heart and she does not flop', () => {
  const p = liz(0, 10), b = make(p);
  let flopped = false;
  const e = until(b, p, (ev) => { flopped ||= ev.stuckNow; return ev.caught; }, 3);
  assert.ok(e.caught.isVector3);
  assert.equal(flopped, false);
  assert.notEqual(b.state, 'flop');
});
test('pounce: a dodged pounce flops her for 2.0 s, then she gets up', () => {
  const p = liz(0, 10), b = make(p);
  flopHer(b, p);
  assert.equal(b.state, 'flop');
  assert.ok(run(b, p, CAT.FLOP - 0.1).every((e) => !e.stuckNow), 'flops once');
  assert.equal(b.state, 'flop');
  run(b, p, 0.2);
  assert.notEqual(b.state, 'flop');
});
test('landing on her flopped back is a hit; she shakes it off for 1.5 s and cannot be hit or hurt meanwhile', () => {
  const p = liz(0, 10), b = make(p);
  flopHer(b, p);
  const e = land(b, p);
  assert.equal(e.hit, true);
  assert.equal(b.health, CAT.HEALTH - 1);
  assert.equal(b.state, 'recover');
  const again = land(b, p);
  assert.equal(again.hit, false); assert.equal(again.caught, null);
  assert.equal(b.health, CAT.HEALTH - 1);
  p.pos.set(b.pos.x + 1, 0, b.pos.z);
  assert.equal(b.update(DT, p, true).caught, null, 'her side is harmless while she shakes it off');
  away(p);
  run(b, p, CAT.RECOVER - 0.2);
  assert.equal(b.state, 'recover');
  run(b, p, 0.3);
  assert.notEqual(b.state, 'recover');
});
test('standing beside her while she is flopped does not hurt', () => {
  const p = liz(0, 10), b = make(p);
  flopHer(b, p);
  p.pos.set(b.pos.x + 1, 0, b.pos.z);
  assert.ok(run(b, p, 1).every((e) => !e.caught && !e.hit));
});
test('lizard still on her back when the flop ends is bounced off, not hurt', () => {
  const p = liz(0, 10), b = make(p);
  flopHer(b, p);
  p.pos.set(b.pos.x, CAT.BACK_FLOP, b.pos.z); p.velY = 0; p.onGround = true;
  const evs = run(b, p, CAT.FLOP + 0.6);
  assert.ok(evs.some((e) => e.bounced), 'bounced');
  assert.ok(evs.every((e) => !e.caught && !e.hit));
});
test('pounce aimed outside the yard lands inside it', () => {
  const R = 20, p = liz(0, 19.5), b = make(p, [], {}, R);
  until(b, p, (e) => e.windupNow === 'pounce', 20);
  assert.ok(Math.hypot(b.ring.position.x, b.ring.position.z) <= R - CAT.BODY_R + 0.01);
  p.pos.set(0, 0, -15);
  until(b, p, (e) => e.stuckNow, 3);
  assert.ok(Math.hypot(b.pos.x, b.pos.z) <= R - CAT.BODY_R + 0.01);
});
const table = (x, z) => ({ type: 'box', x, z, hx: 1.6, hz: 1.1, angle: 0, bottom: 1.0, top: 1.25 });
test('lizard hides during the crouch: the pounce is called off', () => {
  const cols = [], p = liz(0, 10), b = make(p, cols);
  b.update(DT, p, true);
  assert.equal(b.state, 'crouch');
  cols.push(table(0, 10));
  b.update(DT, p, true);
  assert.notEqual(b.state, 'crouch');
  assert.equal(b.ring.visible, false);
  for (let i = 0; i < 120; i++) { b.update(DT, p, true); assert.notEqual(b.state, 'pounce'); assert.notEqual(b.state, 'crouch'); }
});
test('sleepy: below half health she yawns, and a missed pounce is followed by a second before she flops', () => {
  const p = liz(0, 10), b = make(p);
  b.health = 2;
  assert.equal(b.update(DT, p, true).yawnNow, true);
  assert.equal(b.state, 'yawn');
  run(b, p, CAT.YAWN - 0.1);
  assert.equal(b.state, 'yawn');
  until(b, p, (e) => e.windupNow === 'pounce', 0.3);
  away(p, 1);
  const second = until(b, p, (e) => { assert.equal(e.stuckNow, false, 'no flop after the first'); return e.windupNow === 'pounce'; }, 3);
  assert.equal(second.caught, null);
  away(p, 2);
  until(b, p, (e) => e.stuckNow, 3);
});
test('not sleepy at exactly half health: no yawn, one pounce', () => {
  const p = liz(0, 10), b = make(p);
  b.health = 3;
  assert.equal(b.update(DT, p, true).windupNow, 'pounce');
  away(p);
  until(b, p, (e) => { assert.equal(e.yawnNow, false); return e.stuckNow; }, 3);
});
test('flop lasts 2.0 s at every health', () => {
  for (const h of [6, 1]) {
    const p = liz(0, 10), b = make(p);
    b.health = h;
    flopHer(b, p);
    run(b, p, CAT.FLOP - 0.1);
    assert.equal(b.state, 'flop', `health ${h}`);
    run(b, p, 0.2);
    assert.notEqual(b.state, 'flop', `health ${h}`);
  }
});
test('sixth hit: asleep where she is, still in view, ring hidden', () => {
  const p = liz(0, 10), b = make(p);
  let last;
  for (let n = 0; n < 6; n++) {
    flopHer(b, p);
    last = land(b, p);
    assert.equal(last.hit, true, `hit ${n + 1}`);
    assert.equal(last.defeated, n === 5);
  }
  assert.equal(b.health, 0);
  assert.equal(b.state, 'defeated');
  const evs = run(b, p, 5);
  assert.equal(b.state, 'defeated');
  assert.ok(evs.every((e) => !e.caught && !e.hit && !e.windupNow));
  assert.equal(b.rig.visible, true);
  assert.ok(Math.abs(b.rig.position.y) < 0.2);
  assert.equal(b.ring.visible, false);
  p.pos.set(b.pos.x + 1, 0, b.pos.z);
  assert.equal(b.update(DT, p, true).caught, null, 'a sleeping cat is harmless');
});
