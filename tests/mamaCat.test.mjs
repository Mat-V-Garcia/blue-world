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
test('a lizard right across the yard is trotted after, faster than a stalk', () => {
  const p = liz(0, 38), b = make(p);
  const z0 = b.pos.z;
  run(b, p, 1);
  const moved = b.pos.z - z0;
  assert.ok(moved > CAT.STALK + 1 && moved <= CAT.TROT + 0.01, `moved ${moved}`);
});
test('stalks: closes on a lizard just out of pouncing range, no faster than CAT.STALK', () => {
  const p = liz(0, 19), b = make(p);
  const d0 = dist(b, p), x0 = b.pos.x, z0 = b.pos.z;
  run(b, p, 0.9);
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

// ---------- tail play ----------
const tailAt = (x, z) => new THREE.Vector3(x, 0, z);
test('tail: she trots to a dropped tail in range and plays with it for 3.0 s, then stalks again', () => {
  const p = liz(0, 30), b = make(p);
  assert.equal(b.baitWith(tailAt(8, 0)), true);
  assert.equal(b.state, 'trot');
  until(b, p, (_e, bb) => bb.state === 'play', 4);
  assert.ok(Math.hypot(b.pos.x - 8, b.pos.z) < CAT.BODY_R + 1, 'beside the tail');
  run(b, p, CAT.PLAY - 0.1);
  assert.equal(b.state, 'play');
  run(b, p, 0.2);
  assert.equal(b.state, 'stalk');
});
test('tail: landing on her back while she plays is a hit', () => {
  const p = liz(0, 30), b = make(p);
  b.baitWith(tailAt(8, 0));
  until(b, p, (_e, bb) => bb.state === 'play', 4);
  const e = land(b, p);
  assert.equal(e.hit, true);
  assert.equal(b.health, CAT.HEALTH - 1);
  assert.equal(b.state, 'recover');
});
test('tail: standing beside her while she plays does not hurt', () => {
  const p = liz(0, 30), b = make(p);
  b.baitWith(tailAt(8, 0));
  until(b, p, (_e, bb) => bb.state === 'play', 4);
  p.pos.set(b.pos.x + 1, 0, b.pos.z);
  assert.ok(run(b, p, 1).every((e) => !e.caught));
});
test('tail: ignored when out of range, hidden, in the air, flopped, shaking off, or asleep', () => {
  const h = hidden();
  assert.equal(h.baitWith(tailAt(1, 1)), false);
  assert.equal(h.state, 'hidden');
  const p = liz(0, 10), b = make(p);
  assert.equal(b.baitWith(tailAt(0, CAT.TAIL_RANGE + 1)), false);
  assert.equal(b.state, 'stalk');
  b.update(DT, p, true); away(p);
  until(b, p, (_e, bb) => bb.state === 'pounce', 2);
  assert.equal(b.baitWith(tailAt(1, 1)), false); assert.equal(b.state, 'pounce');
  until(b, p, (e) => e.stuckNow, 2);
  assert.equal(b.baitWith(tailAt(1, 1)), false); assert.equal(b.state, 'flop');
  land(b, p);
  assert.equal(b.baitWith(tailAt(1, 1)), false); assert.equal(b.state, 'recover');
  for (let n = 0; n < 5; n++) { flopHer(b, p); land(b, p); }
  assert.equal(b.state, 'defeated');
  assert.equal(b.baitWith(tailAt(1, 1)), false); assert.equal(b.state, 'defeated');
});
test('tail: a tail dropped mid-crouch calls the pounce off and hides the ring', () => {
  const p = liz(0, 10), b = make(p);
  b.update(DT, p, true);
  assert.equal(b.state, 'crouch');
  assert.equal(b.baitWith(tailAt(3, 3)), true);
  assert.equal(b.state, 'trot');
  assert.equal(b.ring.visible, false);
});

// ---------- fishing under furniture ----------
const underTable = () => { const p = liz(-14, 0); return { p, cols: [table(-14, 0)] }; };
test('fishing: a hidden lizard brings her over to lie down and reach under', () => {
  const { p, cols } = underTable(), b = make(p, cols);
  const e = until(b, p, (ev) => ev.windupNow === 'fish', 20);
  assert.equal(e.caught, null);
  assert.equal(b.state, 'fish');
  assert.ok(dist(b, p) <= CAT.FISH_DIST + CAT.BODY_R + 0.01, `dist ${dist(b, p)}`);
});
test('fishing: she never swipes or pounces at a hidden lizard on the way', () => {
  const { p, cols } = underTable(), b = make(p, cols);
  until(b, p, (ev, bb) => { assert.ok(!['swipeWind', 'crouch', 'pounce', 'yawn'].includes(bb.state)); assert.equal(ev.caught, null); return ev.windupNow === 'fish'; }, 20);
});
test('fishing: a lizard that leaves is not caught and she stalks again', () => {
  const { p, cols } = underTable(), b = make(p, cols);
  until(b, p, (ev) => ev.windupNow === 'fish', 20);
  run(b, p, 1);
  p.pos.set(-14, 0, 12);
  const e = b.update(DT, p, true);
  assert.equal(e.caught, null);
  assert.equal(b.state, 'stalk');
});
test('fishing: a lizard still hidden after 3.0 s is batted out', () => {
  const { p, cols } = underTable(), b = make(p, cols);
  until(b, p, (ev) => ev.windupNow === 'fish', 20);
  assert.ok(run(b, p, CAT.FISH_TIME - 0.1).every((e) => !e.caught));
  const e = until(b, p, (ev) => ev.caught, 0.3);
  assert.ok(e.caught.isVector3);
  assert.equal(b.state, 'stalk');
});

// ---------- perches ----------
test('perch: a lizard higher than CAT.REACH_UP is never caught and she waits below', () => {
  const p = liz(0, 12, CAT.REACH_UP + 1); p.onGround = true;
  const b = make(p);
  const evs = run(b, p, 20);
  assert.ok(evs.every((e) => !e.caught && !e.windupNow), 'no swipes or pounces at something out of reach');
  assert.ok(dist(b, p) <= CAT.CIRCLE_R + 1, `waits close by (${dist(b, p)})`);
  const x = b.pos.x, z = b.pos.z;
  run(b, p, 2);
  assert.ok(Math.hypot(b.pos.x - x, b.pos.z - z) < 0.5, 'sits still');
});
test('perch: a lizard on something lower than CAT.REACH_UP is swiped', () => {
  const p = liz(0, 12, 2); p.onGround = true;
  const b = make(p);
  let pounced = false;
  until(b, p, (e) => { pounced ||= e.windupNow === 'pounce'; return e.caught; }, 20);
  assert.equal(pounced, false, 'she swipes at a perch, she does not pounce on it');
});

// ---------- restart ----------
test('reset() during pounce, play and fish: hidden, full health, ring hidden', () => {
  const check = (b) => { b.reset(); assert.equal(b.state, 'hidden'); assert.equal(b.health, b.maxHealth); assert.equal(b.ring.visible, false); assert.equal(b.rig.visible, false); };
  let p = liz(0, 10), b = make(p);
  b.update(DT, p, true); until(b, p, (_e, bb) => bb.state === 'pounce', 2); check(b);
  b.emerge(); until(b, p, (_e, bb) => bb.state === 'stalk'); assert.equal(b.update(DT, p, true).windupNow, 'pounce'); // works again after a restart
  p = liz(0, 30); b = make(p); b.baitWith(tailAt(8, 0)); until(b, p, (_e, bb) => bb.state === 'play', 4); check(b);
  const t = underTable(); b = make(t.p, t.cols); until(b, t.p, (e) => e.windupNow === 'fish', 20); check(b);
});

// ---------- fairness ----------
test('after shaking off a hit she waits a moment before her next move, so the lizard can get clear', () => {
  const p = liz(0, 10), b = make(p);
  flopHer(b, p);
  land(b, p);
  p.pos.set(b.pos.x, 0, b.pos.z + 4); // bounced off, landed right in front of her
  until(b, p, (_e, bb) => bb.state === 'stalk', 2);
  const evs = run(b, p, 0.7);
  assert.ok(evs.every((e) => !e.windupNow && !e.caught), 'no swipe or pounce straight away');
  until(b, p, (e) => e.windupNow, 1);
});

// ---------- the real yard ----------
test('she walks under a high roof (the gazebo) instead of being stopped by it', () => {
  const roof = { type: 'box', x: 0, z: 14, hx: 6.5, hz: 6.5, angle: 0, bottom: 8.4, top: 8.5 };
  const p = liz(0, 34), b = make(p, [roof]);
  run(b, p, 6);
  assert.ok(b.pos.z > 9, `went under it (z ${b.pos.z.toFixed(1)})`);
  assert.ok(Math.abs(b.pos.x) < 1, 'in a straight line');
});

// ---------- found in review ----------
const wall = (x, z, hx, hz) => ({ type: 'box', x, z, hx, hz, angle: 0, bottom: -100, top: 3 });
test('a dead end between her and a far lizard does not hold her: she finds a way or hops over, without flopping', () => {
  // a U-shaped pocket open towards her, the lizard well beyond it
  const cols = [wall(0, 12, 10, 0.5), wall(-10, 8, 0.5, 4.5), wall(10, 8, 0.5, 4.5)];
  const p = liz(0, 34), b = make(p, cols);
  const e = until(b, p, (ev) => { assert.equal(ev.stuckNow, false, 'getting unstuck is not an opening'); return ev.caught; }, 60);
  assert.ok(e.caught.isVector3, 'she reached the lizard');
});
test('a hop over furniture towards a hidden lizard does not hurt it', () => {
  const cols = [wall(0, 12, 10, 0.5), wall(-10, 8, 0.5, 4.5), wall(10, 8, 0.5, 4.5), table(0, 24)];
  const p = liz(0, 24), b = make(p, cols);
  until(b, p, (ev) => { assert.equal(ev.caught, null); assert.equal(ev.stuckNow, false); return ev.windupNow === 'fish'; }, 60);
});
test('swipe: a lizard clinging to a wall within her reach is hit, even if it jumped on', () => {
  const p = liz(0, 4), b = windUp(p);
  p.pos.y = 3; p.onGround = false; p.climbing = true;
  until(b, p, (ev) => ev.caught, 1.5);
});
test('tail: one dropped on a perch out of her reach is ignored', () => {
  const p = liz(0, 30), b = make(p);
  assert.equal(b.baitWith(new THREE.Vector3(8, CAT.REACH_UP + 2, 0)), false);
  assert.equal(b.state, 'stalk');
  assert.equal(b.baitWith(new THREE.Vector3(8, CAT.REACH_UP - 1, 0)), true);
});
