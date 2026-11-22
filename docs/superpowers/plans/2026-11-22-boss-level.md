# Boss Level (The Giant Tarantula) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth, boss level: a giant tarantula in a desert arena that lunges and shoots webs, is hurt by landing on its back while its fangs are stuck, and turns the sky into a red lightning storm as its health drops.

**Architecture:** The boss is its own state machine in `src/boss.js`, separate from the wandering-enemy manager, and reports per-frame events that `src/main.js` acts on. `src/storm.js` recolours the sky, fog and lights from one storm value and schedules lightning. `src/levels/boss.js` builds the arena and returns a `boss` entry that switches `main.js` from win-by-pebbles to win-by-boss.

**Tech Stack:** Vite 6, Three.js 0.170, plain JS modules, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-22-boss-level-design.md`

## Global Constraints

- No new dependencies. Work on branch `boss-level`; never push to `main` (it deploys live) without Mathew's say-so.
- Levels 1 to 3 must play exactly as now: `src/enemies.js` is not modified; every change to `player.js`, `world.js`, `main.js` is inert unless the level returns `boss`.
- Run the whole suite with `npm test` (currently 28 passing) at the end of every task.
- Not frightening or gory; being caught is the usual "Ouch!".
- Lightning: single soft flashes, never less than 1.5 s apart, never pure white.
- The boss is never a solid collider; `Player` collision code is unchanged apart from the webbed slow-down.
- Boss health 6. Lizard: walk 5.5, sprint 10, jump peak about 1.3.

## Review Focus

- Lizard webbed while clinging to a boulder: it must let go and not be left stuck on the wall (test in Task 1).
- Lunge started while the lizard is invulnerable (flashing): counts as a miss and ends stuck (test in Task 2).
- Tail dropped while the boss is stuck, recovering or mid-lunge: ignored, boss state unchanged (test in Task 3).
- Losing the last heart mid-fight: boss health is kept; "Play again" restores it to 6 and storm to 0 (tests in Tasks 3 and 4).
- Level 4 requested by URL (`?level=4`) when only 3 is unlocked: falls back to 3 (test in Task 5).

---

### Task 1: Webbed slow-down on the player

**Files:** Modify `src/player.js`; Test `tests/player.test.mjs`

**Interfaces:**
- Produces: `player.webbed` (number, seconds left, default 0). While `> 0`: horizontal speed is `WALK / 3` whatever `input.sprint` says, `input.jump` is ignored, no climb can start, and a climb in progress is dropped (`wall = null`). `Player.update` counts it down. `respawn()` sets it to 0.

- [ ] **Step 1: Write failing tests** in `tests/player.test.mjs` (use that file's existing setup helpers):

```js
test('a webbed lizard crawls, cannot sprint or jump, and gets free', () => {
  const p = makePlayer();            // flat ground, no colliders
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
  const wall = { type: 'box', x: 0, z: 2, hx: 3, hz: 0.5, angle: 0, bottom: -100, top: 4, climbable: true };
  const p = makePlayer([wall]);
  p.wall = wall; p.pos.set(0, 1, 1.2);
  p.webbed = 1;
  p.update(1 / 60, { x: 0, z: 1 });
  assert.equal(p.climbing, false);
  for (let i = 0; i < 30; i++) p.update(1 / 60, { x: 0, z: 1 });
  assert.equal(p.climbing, false);
});
```

If the file has no `makePlayer`, add `const makePlayer = (cols = []) => { setGround({ height: () => 0, radius: 60 }); return new Player(cols); };`.

- [ ] **Step 2: Run** `node --test tests/player.test.mjs`. Expected: both new tests FAIL (speed 10; climbing true).
- [ ] **Step 3: Implement** in `Player`: field, countdown at the top of `update`, the four effects, reset in `respawn()`.
- [ ] **Step 4: Run** `npm test`. Expected: 30 pass.
- [ ] **Step 5: Commit** `Player: webbed slow-down`.

---

### Task 2: Boss core — approach, lunge, stuck, hit

**Files:** Create `src/boss.js`; Test `tests/boss.test.mjs`

**Interfaces:**
- Consumes: `terrainHeight`, `footprint`, `clampToWorld` from `src/world.js`; a model factory `() => ({ root: Object3D, update(dt, speed) })`.
- Produces:

```js
export const BOSS = {
  HEALTH: 6, WALK: 3, LUNGE_RANGE: 14, LUNGE_TRAVEL: 22, LUNGE_SPEED: 18, OVERSHOOT: 3,
  WINDUP: 0.8, STUCK_MAX: 2.5, STUCK_MIN: 1.8, RECOVER: 1.5,
  BODY_R: 2.2,          // touch / landing radius
  BACK_UP: 2.6,         // back height when standing
  BACK_STUCK: 1.0,      // back height while stuck (reachable by a jump)
  WEB_RANGE: 14, WEB_WINDUP: 0.6, WEB_SPEED: 16, WEB_TIME: 2.5, WEB_COOLDOWN: 3,
  PERCH_HEIGHT: 1, PERCH_TIME: 2, TAIL_RANGE: 20, ANGRY_BELOW: 0.5, ANGRY_WINDUP: 0.75,
};
// cfg: { x, z, scale = 5 }
export function createBoss(scene, colliders, makeModel, cfg)
// returns {
//   pos: Vector3, yaw, health, maxHealth, state, webs: [{ pos: Vector3 }],
//   update(dt, player, canHurt) -> events,
//   baitWith(pos: Vector3) -> boolean,     (Task 3)
//   reset(),
// }
// player: { pos: Vector3, velY: number }
// state: 'approach' | 'windup' | 'lunge' | 'stuck' | 'recover' | 'webwind' | 'defeated'
// events (fresh object each frame, all falsy unless it happened this frame):
//   { caught: Vector3|null (boss position, for knock-back), hit, bounced, defeated,
//     stuckNow, windupNow: 'lunge'|'web'|null, shotNow, webbed, splat: Vector3|null }
```

- Rules this task implements: `approach` turns toward and walks at `WALK` toward the player; within `LUNGE_RANGE` → `windup` (target = player position at that moment; duration `WINDUP`, × `ANGRY_WINDUP` when `health / maxHealth < ANGRY_BELOW`); `lunge` moves at `LUNGE_SPEED` along the locked line to target + `OVERSHOOT`, capped at `LUNGE_TRAVEL`; a lunge ends in `stuck` when it reaches its end, when `clampToWorld(x, z, BODY_R)` moves it, or when its body circle overlaps a collider whose top is more than 0.5 above the sand. Stuck time = `STUCK_MIN + (STUCK_MAX - STUCK_MIN) * (health - 1) / (maxHealth - 1)`. Touch: player within `BODY_R` horizontally and `pos.y < BACK_UP - 0.6` while state is `approach`, `windup`, `lunge` or `webwind` → `caught` if `canHurt`; if `!canHurt` nothing (the lunge carries on to its end and sticks). Landing: player within `BODY_R`, `velY < 0`; while `stuck` and `0.4 <= pos.y - ground <= BACK_STUCK + 1` → `hit` (health − 1, → `recover` for `RECOVER`, or → `defeated` with `defeated: true` at 0); while not stuck/recover/defeated and `|pos.y - ground - BACK_UP| <= 0.6` → `bounced`. `recover`: no touch, no hits, then `approach`. The model group is posed per state (rear-up tilt in `windup`, squashed low in `stuck`, legs-in and sinking in `defeated`); posing is not tested.

- [ ] **Step 1: Write failing tests** in `tests/boss.test.mjs`:

```js
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
```

- [ ] **Step 2: Run** `node --test tests/boss.test.mjs`. Expected: FAIL, cannot find `../src/boss.js`.
- [ ] **Step 3: Implement** `src/boss.js` to the interface and rules above.
- [ ] **Step 4: Run** `npm test`. Expected: 40 pass.
- [ ] **Step 5: Commit** `Boss: approach, lunge, stuck and hit`.

---

### Task 3: Boss webs, tail bait, anger, reset

**Files:** Modify `src/boss.js`, `tests/boss.test.mjs`

**Interfaces:**
- Consumes: Task 2's `createBoss`.
- Produces (completing Task 2's interface): web events `windupNow: 'web'`, `shotNow`, `webbed`, `splat`; `boss.webs`; `baitWith(pos)`; `reset()`.
- Rules: in `approach`, if the player is beyond `WEB_RANGE`, or has been more than `PERCH_HEIGHT` above the sand for `PERCH_TIME` at any range, and `WEB_COOLDOWN` has passed since the last shot → `webwind` for `WEB_WINDUP` (× `ANGRY_WINDUP` when angry), then fire one web (`shotNow`) at the player's position at firing time and return to `approach`. When angry, every second web shot is followed immediately by another `webwind`. A web flies at `WEB_SPEED` horizontally with a gentle arc; it is removed with `splat` when it reaches its target, and removed silently when it enters a collider (`footprint(c, x, z).dist < 0.2` and its height between the collider's bottom and top); if it passes within 0.7 of the player (and within 1 vertically) and `canHurt` → `webbed: true`, web removed. After `webbed`, the boss's next action is a lunge wind-up from where it stands if the player is within `LUNGE_TRAVEL`, otherwise it approaches first. `baitWith(pos)`: returns false and does nothing if state is `lunge`, `stuck`, `recover` or `defeated`, or the tail is further than `TAIL_RANGE`; otherwise goes straight to `windup` locked on `pos` and returns true. `reset()`: start position, full health, `approach`, no webs, timers cleared.

- [ ] **Step 1: Write failing tests** (append; reuse `make`, `liz`, `until`, `stick`):

```js
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
  const b = make(), p = liz(0, 18);
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
    p.pos.set(b.pos.x, 0, b.pos.z + 10); p.velY = 0;
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
```

- [ ] **Step 2: Run** `node --test tests/boss.test.mjs`. Expected: the ten new tests FAIL (no web events / `baitWith` missing).
- [ ] **Step 3: Implement** the rules above; web balls are small white spheres added to/removed from `scene`.
- [ ] **Step 4: Run** `npm test`. Expected: 50 pass.
- [ ] **Step 5: Commit** `Boss: webs, tail bait, anger, reset`.

---

### Task 4: Storm

**Files:** Create `src/storm.js`; Modify `src/world.js` (`buildSky`); Test `tests/storm.test.mjs`

**Interfaces:**
- Produces in `src/world.js`: `buildSky(scene, skyTex, out = null)` still returns the horizon `Color`; when `out` is given it is filled with `{ top: Color, bottom: Color, painting: Material|null }` (the dome's two uniform colours and the panorama material). Existing callers are untouched.
- Produces in `src/storm.js`:

```js
export function stormLevel(health, maxHealth)        // 1 - health / maxHealth, clamped 0..1
export function lightningGap(storm, rand)            // seconds to the next bolt, or null below 0.5
// storm 0.5 -> 5 + rand * 4;  storm >= 5/6 -> 1.5 + rand * 2.5;  linear in between; never < 1.5
export function createStorm(scene, { sky, fog, hemi, sun }, rand = Math.random)
// returns { level, set(target), update(dt) -> { bolt: boolean }, reset() }
// level eases toward target at 1 per second; reset() snaps level and target to 0.
```

- Colours at level 1 (blend linearly from the values captured at creation): dome top `0x3a0508`, dome bottom and fog `0x8a2a1c`, painting tint `0xb8483a`, hemisphere sky `0xff8a6a` / ground `0x6a2a1a` / intensity 1.1, sun `0xff7a4a` / intensity 1.9. A bolt: a jagged bright line mesh (`fog: false`) 300 units out in a random direction for 0.2 s, plus `+0.8` hemisphere intensity decaying over 0.25 s. `sky` may be `null` or have a null `painting`; `hemi`/`sun` are objects with `color`, `intensity` (and `groundColor` for hemi).

- [ ] **Step 1: Write failing tests** in `tests/storm.test.mjs`:

```js
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
```

- [ ] **Step 2: Run** `node --test tests/storm.test.mjs`. Expected: FAIL, cannot find `../src/storm.js`.
- [ ] **Step 3: Implement** `src/storm.js` and the `out` parameter of `buildSky`.
- [ ] **Step 4: Run** `npm test`. Expected: 55 pass.
- [ ] **Step 5: Commit** `Storm: red sky and lightning driven by one value`.

---

### Task 5: Arena level and level list

**Files:** Create `src/levels/boss.js`; Modify `src/levels/index.js`; Test `tests/unlock.test.mjs`, `tests/bossLevel.test.mjs`

**Interfaces:**
- Consumes: `buildSky(scene, skyTex, out)` (Task 4); `setGround`, `shapedRock`, `wobble`, `rng` from `src/world.js`; `toon`, `loadTexture`, `tiled`.
- Produces: `src/levels/boss.js` exporting `ARENA_R = 40`, `terrainHeight(x, z)` (ripples no taller than 0.25 inside radius 36, rising rim beyond), `BOULDERS` (4 to 6 of `{ x, z, r, h }`, `h` between 2 and 2.5, each 12 to 28 from the centre and at least 8 from the spawn) and `build(scene)` returning `{ colliders, solids, horizonColor, pebbleSpots: [], spawn: { x: 0, z: -32, yaw: 0 }, enemies: { kind: 'tarantula', count: 0 }, boss: { x: 0, z: 0, health: 6, scale: 5 }, sky, update }`. `setGround({ height: terrainHeight, radius: ARENA_R })`. Boulders use the same radius function for mesh and collider (as Level 1's mesas do), `climbable: true`; the ring wall is rock meshes outside the radius with `climbable: false` colliders.
- Produces in `src/levels/index.js`: a fourth `LEVELS` entry `{ id: 4, boss: true, name: 'The Giant Tarantula', title: '/assets/title.jpg', intro, hint, help, helpTouch, load }`. Intro: "Something huge is stirring under the dunes. The giant tarantula has woken up, and only one small lizard can send it back!" Help lines cover: dodge the lunge, jump on its back while its fangs are stuck, drop your tail to trick it, hide from webs behind rocks. No change to `migrateUnlocks`.

- [ ] **Step 1: Write failing tests.** `tests/bossLevel.test.mjs`:

```js
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
test('the boss is the fourth and last level', () => {
  assert.equal(LEVELS.length, 4);
  assert.equal(LEVELS[3].boss, true);
  assert.equal(LEVELS.filter((l) => l.boss).length, 1);
});
```

`src/levels/boss.js` must be importable in Node: no `document`/`window` use at module top level. In `tests/unlock.test.mjs` add (using that file's existing storage/location stubs): with unlocked = 3 and `?level=4`, `currentLevelId()` is 3; with unlocked = 4 it is 4; `migrateUnlocks` on a store holding `'3'` leaves it `'3'`.

- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL (module missing; `LEVELS.length` 3).
- [ ] **Step 3: Implement** the arena and the level entry.
- [ ] **Step 4: Run** `npm test`. Expected: all pass (about 61).
- [ ] **Step 5: Commit** `Boss arena level and level-list entry`.

---

### Task 6: Wire the fight into the game

**Files:** Modify `src/main.js`, `index.html`, `src/style.css`, `src/audio.js`, `src/spiderModel.js` (only if the factory needs a scale argument), `README.md`

**Interfaces:**
- Consumes: `createBoss`, `BOSS` (Tasks 2–3); `stormLevel`, `createStorm` (Task 4); `world.boss`, `world.sky`, `LEVEL.boss` (Task 5); `player.webbed` (Task 1).
- Produces: `window.__game.boss` and `window.__game.storm` getters for browser checks.

Everything below happens only when `world.boss` is set; otherwise `main.js` behaves as today.

- [ ] **Step 1: Page and sounds.** `index.html`: `<div class="bossbar hidden" id="bossbar"><span>Giant Tarantula</span><div class="track"><div class="fill" id="bossfill"></div></div></div>` inside `#hud`; give the win heading `id="win-title"`. `style.css`: bar top-centre, about 40% wide (70% in touch mode, below the safe-area inset), red fill whose width animates over 0.3 s. `audio.js`: a `noise(start, dur, gain, freq)` helper (filtered white-noise buffer) and `sfx.hiss`, `sfx.web`, `sfx.webbed`, `sfx.bossHit`, `sfx.thunder` (low rumble, about 1.2 s), `sfx.stuck`.
- [ ] **Step 2: Set-up in `init()`.** Keep `hemi` in a variable. If `world.boss`: build the boss with the tarantula factory (fallback `createSimpleSpider`), `createStorm(scene, { sky: world.sky, fog: scene.fog, hemi, sun })`, show `#bossbar`, hide `.counter`. `setupTitle()` shows `Boss · ${LEVEL.name}` instead of `Level 4 · …` and a 🕷 instead of the number in the picker. `reset()` also calls `boss.reset()`, `storm.reset()`, sets `player.webbed = 0` and redraws the bar.
- [ ] **Step 3: Per-frame in `frame(dt)`**, after the enemy update:
  - `const ev = boss.update(dt, player, playing && invuln <= 0)`.
  - `ev.caught` → `getHurt(ev.caught)`. `ev.webbed` → `player.webbed = BOSS.WEB_TIME`, toast "Webbed!", `sfx.webbed()`.
  - `ev.hit` → bounce (`velY = 9`, `onGround = false`), toast "Got it!", `sfx.bossHit()`, redraw bar, `storm.set(stormLevel(boss.health, boss.maxHealth))`.
  - `ev.bounced` → bounce, toast "Wait until its fangs are stuck!".
  - `ev.stuckNow` → `sfx.stuck()`; the first time in a fight, toast "Its fangs are stuck! Jump on its back!".
  - `ev.windupNow === 'lunge'` → `sfx.hiss()`; `ev.shotNow` → `sfx.web()`; `ev.splat` → a flat white splat disc at that point that fades over 4 s.
  - `ev.defeated` → `state = 'win'`, `storm.set(0)`, dust puff, `sfx.win()` after 1.5 s, and after 3 s the win screen with `#win-title` "You beat the Giant Tarantula!", message "Blue World is safe again. Do a victory push-up!", "Next" hidden.
  - Tail drop: where `tarantulas.distract(tail.pos)` is called, also `boss.baitWith(tail.pos)`.
  - Bite with a boss present and the snout within 3 of it → toast "Wait until its fangs are stuck!".
  - `storm.update(dt)` every frame (also on the win screen so the sky clears); `.bolt` → `sfx.thunder()`.
  - Web strands: a small white wire sphere parented to the lizard, visible while `player.webbed > 0`.
  - Losing the last heart: existing respawn; also `player.webbed = 0`. Boss health is not touched.
  - The pebble win branch cannot fire (no pebbles); the Level 3 win now unlocks and names the boss through the existing `hasNext` code; its message reads "The boss is unlocked: The Giant Tarantula!" when `LEVELS[LEVEL_ID].boss`.
- [ ] **Step 4: Run** `npm test` and `npm run build`. Expected: all tests pass; build succeeds with no warnings about missing imports.
- [ ] **Step 5: Check in the in-app browser** (`preview_start`, `?level=4&go` after `localStorage.setItem('blueworld.unlocked', '4')`; step with `__game.frame(1/60)` if the pane is hidden). Expected, each confirmed by reading `__game` state or a screenshot:
  - Levels 1–3 load with no console errors, no boss bar, pebble counter visible.
  - Boss level: bar visible, counter hidden, boss about 5 units long standing in the middle; no stray tarantulas.
  - Standing still at 10 units: wind-up, lunge, one heart lost.
  - Side-stepping: boss sticks; jumping from the sand onto its back registers a hit (health 5) — this is the reachability check; if a ground jump cannot register, adjust `BACK_STUCK`/the stuck pose, not the lizard.
  - Jumping at the standing boss from the sand does not reach its back.
  - Far away: web flies; a boulder between stops it; a hit slows the lizard and shows strands.
  - Tail drop within 20: boss sticks at the tail.
  - Screenshots at health 6, 3 and 1: sky visibly bluer → redder; lizard, boss and webs still clearly visible at 1; bolts appear from health 3.
  - Sixth hit: boss sinks, sky clears, win screen text correct; "Play again" gives health 6 and blue sky.
  - `tools/clipScan.js` on `/src/levels/boss.js`: no stand-inside-rock spots.
  - Touch mode at 375×812: boss bar does not overlap hearts, tail indicator or buttons.
- [ ] **Step 6: Update `README.md`** (boss level, how to beat it) and **commit** `Boss level: wire the fight, health bar, storm and sounds`.
