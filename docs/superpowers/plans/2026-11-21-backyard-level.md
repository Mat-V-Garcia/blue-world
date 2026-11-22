# Level 3 — The Back Yard: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Level 3, a tidy version of the family back yard, with alley kittens that can only be scared (push-ups) or fooled (tail drop).

**Architecture:** A new level module `src/levels/yard.js` follows the existing level contract. The shared enemy manager in `src/enemies.js` gains three config-driven behaviours (can't be defeated, scared, distracted by a tail). The tail drop is a small self-contained module (`src/tail.js`) wired into `main.js`. The world gets optional rectangular bounds, because the yard is a rectangle and the other levels are circles.

**Tech Stack:** Vite 6, Three.js 0.170, plain JS modules. Logic tests use Node's built-in runner (`node --test`, Node 22) — no new dependencies. Level geometry is verified in the in-app browser.

**Spec:** `docs/superpowers/specs/2026-11-21-backyard-level-design.md` — read it first; this plan argues from it.

## Global Constraints

- No new dependencies (`three` and `vite` only).
- Levels 1 and 2 must play exactly as before, except that the tail drop also works there.
- No kitten is ever defeated: no squash, no poof, never `alive = false`.
- The yard must look tidy: no clutter piles, torn cloth, stains, bare dirt, peeling paint or leaning structures.
- Every solid-looking prop gets a collider matching its mesh; anything the lizard can stand on is stood on, not in. `tools/clipScan.js` (Task 6) must come back clean for the yard apart from unreachable spots.
- Scale: lizard ≈ 1.6 long, `HEIGHT` 0.45, `STEP` 0.4 (`src/player.js`). Hiding gaps must have a clearance ≥ 0.5 and < 1.1 (lizard fits, kitten doesn't).
- The yard photo is not stored in the repo.
- Do not commit unless Mathew asks; pushing to `main` deploys the live game. Each task ends at "tests pass", not at a commit.
- Tuning numbers (from the spec): kitten notice 9, chase speed 6, give-up as existing; scare after 0.7 s of push-ups, range 6, lasts 12 s; tail wriggles 6 s, attracts within 12, regrows after 30 s (visibly over the last 4 s).

## Review Focus

1. **Tail dropped while climbing or in mid-air** — it should land on the ground or prop top below the lizard, not hang in the air. (Test in Task 3.)
2. **Q / Tail pressed when it can't apply** (tail already off, title screen, win screen, mid-respawn) — nothing happens, no error, no second tail. (Test in Task 3; manual check in Task 4.)
3. **Push-ups on Levels 1 and 2** — tarantulas and pigeons are not scared, and stomp/bite still defeat them. (Tests in Task 2.)
4. **A scared or distracted kitten at the yard's edge or against a prop** — it stays inside the rectangle and never hurts the lizard while scared/distracted. (Tests in Tasks 1 and 2.)
5. **Browser storage unavailable or already at Level 3** — the one-off unlock doesn't throw, doesn't lower progress, and doesn't run twice. (Test in Task 5.)

---

## File Structure

| File | Responsibility |
|---|---|
| `src/world.js` (modify) | optional rectangular bounds; `clampToWorld` |
| `src/player.js`, `src/enemies.js` (modify) | use `clampToWorld`; enemy manager behaviours |
| `src/tail.js` (create) | tail-drop state machine + the wriggling tail mesh |
| `src/lizardModel.js`, `src/lizard.js` (modify) | `setTail(k)` to hide/regrow the tail |
| `src/kittenModel.js` (create) | stand-in kitten + GLB loader with fallback |
| `src/levels/yard.js` (create) | the yard |
| `src/levels/index.js` (modify) | Level 3 entry, per-level hint/help text, one-off unlock |
| `src/main.js`, `src/touch.js`, `src/audio.js`, `index.html`, `src/style.css` (modify) | wiring, Tail button, tail indicator, sounds, per-level text |
| `tools/clipScan.js` (create) | dev-only scan for stand-inside-geometry spots |
| `tests/*.test.mjs` (create) | Node tests for bounds, enemies, tail, unlock |

---

### Task 1: Rectangular world bounds

**Files:**
- Modify: `src/world.js`, `src/player.js` (the "stay inside the world" block), `src/enemies.js` (`moveTo`), `package.json`
- Test: `tests/world.test.mjs`

**Interfaces:**
- Produces: `setGround({ height, radius, bounds })` where `bounds` is optional `{ x0, x1, z0, z1 }`; `clampToWorld(x, z, margin = 0) → [x, z]`. With `bounds`, clamps to the rectangle shrunk by `margin`; without, scales onto the circle of `radius - margin` (today's behaviour). `worldRadius()` stays.

- [ ] **Step 1:** Add `"test": "node --test tests/"` to `package.json` scripts.
- [ ] **Step 2: Write the failing tests** in `tests/world.test.mjs`:

```js
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
```

- [ ] **Step 3:** Run `npm test` — expect FAIL (`clampToWorld` is not exported).
- [ ] **Step 4:** Implement `clampToWorld` and the `bounds` option in `src/world.js`.
- [ ] **Step 5:** Replace the radius scaling in `Player.update` with `clampToWorld(nx, nz)` and in `enemies.js` `moveTo` with `clampToWorld(nx, nz, 2)`.
- [ ] **Step 6:** Run `npm test` — expect 3 passing. Run `npm run build` — expect success.

---

### Task 2: Enemy manager — can't be defeated, scared, distracted

**Files:**
- Modify: `src/enemies.js`
- Test: `tests/enemies.test.mjs`

**Interfaces:**
- Consumes: `clampToWorld` (Task 1).
- Produces, on the object returned by `createTarantulas(scene, colliders, pebbleSpots, makeSpider, cfg)`:
  - `cfg.defeatable` (default `true`), `cfg.scareable` (default `false`).
  - `update(dt, player, canBeHurt) → { result, from }` — `result` gains `'bounce'`: the lizard landed on a non-defeatable enemy (same geometry test as a stomp; enemy unharmed).
  - `bite(pos, yaw) → { defeated: number, shrugged: number }` — **changed return type**; `shrugged` counts non-defeatable enemies that were in bite range.
  - `scare(pos, range = 6, duration = 12) → number` scared. Returns 0 and does nothing unless `cfg.scareable`.
  - `distract(pos, range = 12, duration = 6) → number` distracted. Works for every kind. `pos` is a `THREE.Vector3`.
  - Enemy `state` adds `'scared'` (run to `home` at 1.6 × chase speed, ignore the lizard until the duration ends, then `'wander'`) and `'tail'` (go to the tail position, stop at touching distance, until the duration ends, then `'wander'`). Neither state can hurt the lizard, and neither is interrupted by noticing the lizard. A new `scare` or `distract` call replaces the current one.
  - The model's `update` is called as `v.update(dt, speed, state)` — third argument is the state string, so models can react (existing models ignore it).
  - `reset()` also clears `'scared'`/`'tail'` and their timers.

- [ ] **Step 1: Write the failing tests** in `tests/enemies.test.mjs`. Shared helpers at the top:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setGround } from '../src/world.js';
import { createTarantulas } from '../src/enemies.js';

const scene = { add() {}, remove() {} };
const model = () => ({ root: new THREE.Object3D(), update() {} });
const make = (cfg) => { // one enemy, home at (0,0)
  setGround({ height: () => 0, radius: 60, bounds: cfg.bounds });
  return createTarantulas(scene, [], [], model, { homes: [[0, 0]], count: 1, ...cfg });
};
const lizard = (x, z, y = 0, velY = 0) => ({ pos: new THREE.Vector3(x, y, z), velY });
const run = (m, p, secs, hurt = true) => { let last; for (let i = 0; i < secs * 60; i++) { last = m.update(1 / 60, p, hurt); if (last.result) return last; } return last; };
```

Tests (name → assertions):
  - `defeatable enemy is stomped as before` — default cfg; lizard at `(0,0)`, `y = 0.3`, `velY = -5`; one `update` returns `result === 'stomp'` and `m.spiders[0].alive === false`.
  - `non-defeatable enemy bounces the lizard and stays alive` — `{ defeatable: false, radius: 0.7, height: 1.1 }`; lizard at `y = 0.8`, `velY = -5`; `result === 'bounce'`, `alive === true`.
  - `bite defeats a tarantula, is shrugged off by a kitten` — default: `bite(new Vector3(0,0,-1), 0)` deep-equals `{ defeated: 1, shrugged: 0 }`; with `defeatable: false`: `{ defeated: 0, shrugged: 1 }` and `alive === true`.
  - `scare does nothing unless scareable` — default cfg: `scare(new Vector3(1,0,0)) === 0`, state unchanged.
  - `scared kitten runs home, cannot hurt, then wanders again` — `{ scareable: true, defeatable: false, chaseSpeed: 6, notice: 9 }`; lizard at `(4,0)`; run 1 s (kitten is chasing, has left home); `scare(p.pos) === 1`; `state === 'scared'`; put the lizard on top of the kitten and run 1 s with `hurt = true` → `result` is never `'hurt'`; after running 12.1 s more, `state !== 'scared'`.
  - `scare ignores kittens out of range` — kitten at home, `scare(new Vector3(20,0,0)) === 0`.
  - `distract pulls the enemy to the tail and holds it there without hurting` — default cfg (tarantula); `distract(new Vector3(5,0,0)) === 1`; after 3 s the enemy is within 1.2 of `(5,0)`; lizard placed on the enemy gets no `'hurt'`; after 6.1 s total, `state === 'wander'`.
  - `scared kitten stays inside rectangular bounds` — `bounds: { x0: -3, x1: 3, z0: -3, z1: 3 }`, `homes: [[2.5, 2.5]]`; chase a lizard at `(-2.5,-2.5)` 1 s, scare, run 5 s; every frame `|pos.x| ≤ 3` and `|pos.z| ≤ 3`.
  - `reset clears scared and distracted states` — after `scare` then `reset()`, `state === 'wander'`.

- [ ] **Step 2:** Run `npm test` — expect the new tests to FAIL.
- [ ] **Step 3:** Implement in `src/enemies.js`. `defeat()` must be unreachable when `cfg.defeatable === false`.
- [ ] **Step 4:** Update the one caller of `bite` in `src/main.js` so the game still runs: treat `defeated > 0` as today's truthy result (full wiring is Task 4).
- [ ] **Step 5:** Run `npm test` — all pass. `npm run build` — success.

---

### Task 3: Tail drop module and tail on/off for the lizard models

**Files:**
- Create: `src/tail.js`
- Modify: `src/lizardModel.js`, `src/lizard.js`
- Test: `tests/tail.test.mjs`

**Interfaces:**
- Produces:
  - `createTailDrop(scene, groundAt) → tail`, where `groundAt(x, z, y) → number` returns the height of the surface below `(x, y, z)`.
    - `tail.ready: boolean` — tail is attached and can be dropped.
    - `tail.grown: number` — 0 while off, rising 0 → 1 over the last 4 s of regrowth, 1 when ready.
    - `tail.pos: THREE.Vector3 | null` — where the dropped tail is, while it wriggles; `null` otherwise.
    - `tail.drop(pos: Vector3, yaw: number) → boolean` — `false` (and no effect) unless `ready`. Places the tail at `(pos.x, groundAt(pos.x, pos.z, pos.y), pos.z)`.
    - `tail.update(dt)` — wriggles the mesh for `WRIGGLE = 6` s, then removes it; makes the tail ready again `REGROW = 30` s after the drop.
    - `tail.reset()` — tail back on, dropped mesh removed.
  - Both lizard factories (`createLizardModel`, `createLizard`) return an extra `setTail(k: number)`: `k = 1` normal, `k = 0` no visible tail, in between a proportionally short tail. On the rigged model, scale the first tail bone (`bone_2`); on the simple lizard, scale the first tail segment. Clamp `k` to a minimum of `0.001` (a zero scale breaks skinning normals).
  - The dropped-tail mesh: a tapered chain of 5 short segments in the lizard's tail colour, about 0.7 long, wriggling side to side, fading out over its last second. Built from primitives with `toon()`.

- [ ] **Step 1: Write the failing tests** in `tests/tail.test.mjs` (`scene = { add() {}, remove() {} }`, `flat = () => 0`):
  - `starts ready and fully grown` — `ready === true`, `grown === 1`, `pos === null`.
  - `drop places the tail on the surface below and can't be repeated` — `groundAt = () => 2`; `drop(new Vector3(1, 9, 3), 0) === true`; `pos` deep-equals `(1, 2, 3)`; `ready === false`; `grown === 0`; a second `drop` returns `false` and `pos` is unchanged.
  - `the dropped tail disappears after 6 s` — after 5.9 s of updates `pos !== null`; after 6.1 s `pos === null`.
  - `the tail regrows over the last 4 s and is ready at 30 s` — at 25.9 s `grown === 0`; at 28 s `0.4 < grown < 0.6`; at 30.1 s `ready === true`, `grown === 1`.
  - `reset puts the tail back at once` — drop, `reset()`; `ready === true`, `grown === 1`, `pos === null`.
- [ ] **Step 2:** `npm test` — expect FAIL (module missing).
- [ ] **Step 3:** Implement `src/tail.js`.
- [ ] **Step 4:** Add `setTail(k)` to both lizard factories.
- [ ] **Step 5:** `npm test` — all pass. `npm run build` — success.

---

### Task 4: Wire the tail drop, the scare and the kitten outcomes into the game

**Files:**
- Modify: `src/main.js`, `src/touch.js`, `src/audio.js`, `index.html`, `src/style.css`, `src/levels/index.js`

**Interfaces:**
- Consumes: `scare`, `distract`, `bite → { defeated, shrugged }`, `'bounce'` (Task 2); `createTailDrop`, `setTail` (Task 3).
- Produces:
  - Each entry in `LEVELS` gains `hint` (the in-game line, mouse/keyboard), `help` (title screen, mouse) and `helpTouch` (title screen, touch). `main.js` writes them into `#hint`, `.mouse-only` and `.touch-only`.
  - Touch: `#btn-tail` button labelled "Tail" in `.tbtns`; `touch.state.tail`; `touch.consumeTail()`.
  - HUD: `<div class="tail" id="tail">` next to the hearts; class `growing` while the tail is off.
  - `sfx.scare()` and `sfx.tail()`.
  - `window.__game` gains `tail` and `level` (the built world) for testing.

Exact copy:
  - Levels 1 & 2 `hint`: `WASD move · Mouse look · Space jump (land on enemies!) · F bite · Q drop tail · Shift sprint · E push-ups`
  - Levels 1 & 2 `help`: `Climb almost anything · Jump on enemies or bite them with F · Q drops your tail to distract them · Click the game to look around`
  - Levels 1 & 2 `helpTouch`: `Left thumb: move (push far to run) · Right thumb: drag to look · Jump on enemies or tap Bite · Tail distracts them`
  - Toasts: tail dropped → `Dropped your tail!`; scare worked → `Scared it off!`; bounce or shrugged bite → `Kittens don't mind! Try push-ups or drop your tail`.
  - (Level 3's three strings are set in Task 5.)

Behaviour:
  - **Tail drop:** `KeyQ` (edge-triggered, like `KeyF`) or `consumeTail()`, only while `state === 'play'`. If `tail.drop(player.pos, player.yaw)` returns `true`: `tarantulas.distract(tail.pos)`, `sfx.tail()`, toast. Each frame: `tail.update(dt)`, `lizard.setTail(tail.grown)`, toggle `#tail.growing`. `groundAt` passed to `createTailDrop` is the highest of `terrainHeight` and any collider top at or below the given `y` whose footprint contains the point.
  - `tail.reset()` in `reset()` and in the respawn after losing all hearts.
  - **Scare:** keep a counter of continuous push-up time; each time it passes 0.7 s, call `tarantulas.scare(player.pos)` and restart the counter; if the call returns > 0, `sfx.scare()` and toast. The counter resets to 0 whenever push-ups stop.
  - **Bounce:** `result === 'bounce'` → same upward bounce as a stomp (`velY = 8.5`), no "Squish!", show the kittens toast.
  - **Bite:** `defeated > 0` → today's "Chomp!"; else `shrugged > 0` → the kittens toast.

- [ ] **Step 1:** Add the level text fields, the Tail button, the tail indicator, the two sounds.
- [ ] **Step 2:** Wire tail drop, scare, bounce and bite as above.
- [ ] **Step 3:** `npm test` and `npm run build` — both pass.
- [ ] **Step 4: Verify in the browser** (preview `game`, `?level=1&go=1`):
  - `document.getElementById('hint').textContent` contains `Q drop tail`.
  - Press Q: toast "Dropped your tail!", `__game.tail.ready === false`, `__game.tail.pos` is at the lizard's ground position, the lizard is drawn without a tail (screenshot), `#tail` has class `growing`. Press Q again: nothing changes.
  - Teleport the lizard next to a tarantula (`__game.tarantulas.spiders[0].pos`), drop is unavailable so call `__game.tarantulas.distract(...)` directly: its `state === 'tail'`.
  - Hold E beside a tarantula for 2 s: its state never becomes `'scared'` (Review Focus 3).
  - On the title screen (reload without `&go`), press Q: `__game.tail.ready` stays `true` (Review Focus 2).
  - No console errors.

---

### Task 5: Kitten model, the yard level, and unlocking

**Files:**
- Create: `src/kittenModel.js`, `src/levels/yard.js`
- Modify: `src/levels/index.js`, `src/main.js` (enemy-kind → model table, call the unlock migration)
- Test: `tests/unlock.test.mjs`

**Interfaces:**
- Consumes: level contract (see `src/levels/mall.js`), `setGround({ bounds })` (Task 1), enemy cfg flags (Task 2), `hint`/`help`/`helpTouch` (Task 4).
- Produces:
  - `createSimpleKitten() → { root, update(dt, speed, state) }` — each call takes the next coat from the cycle tabby, black, orange, grey, tuxedo. About 2.2 long and 1.1 tall at the ears (bigger than the lizard, smaller than a chair). Walk cycle, swishing tail, ears; when `state === 'scared'` the back arches and the tail fluffs up; when `state === 'tail'` a front paw bats.
  - `loadKittenModel(url = '/assets/kitten.glb') → Promise<() => model>` — rejects if the file is missing, exactly like `loadPigeonModel`, so `main.js` falls back to `createSimpleKitten`.
  - `main.js`: replace the pigeon/tarantula ternary with a lookup table keyed by `kind` (`tarantula`, `pigeon`, `kitten`).
  - `src/levels/index.js`: Level 3 entry — `name: 'The Back Yard'`, `title: '/assets/title.jpg'`, `load: () => import('./yard.js')`, and:
    - `intro`: `You slipped under the fence into a sunny back yard. Ten golden pebbles are hidden around the patio, the swings and the lemon tree. The alley kittens only want to play, but they play rough!`
    - `hint`: `WASD move · Mouse look · Space jump · E push-ups scare kittens · Q drop tail · Shift sprint`
    - `help`: `Kittens can't be beaten · Do push-ups (E) to scare them or drop your tail (Q) to fool them · Climb or hide where they can't reach`
    - `helpTouch`: `Left thumb: move (push far to run) · Right thumb: drag to look · 💪 scares kittens · Tail fools them`
  - `migrateUnlocks(storage = localStorage)` exported from `src/levels/index.js`, called once at the top of `init()`: if the flag `blueworld.l3open` is not set, then when `blueworld.unlocked` is exactly `2` raise it to `3`; set the flag either way. All storage access wrapped in try/catch.
  - `yard.js` `build(scene)` returns the level contract, with:
    - `setGround({ height, radius: 60, bounds: { x0: -24, x1: 24, z0: -48, z1: 48 } })`. `+z` is the far (porch) end; `-x` is the white house side; `+x` is the fence side.
    - `spawn: { x: 0, z: -43, yaw: 0 }` — on the path at the near end, facing the porch.
    - `enemies: { kind: 'kitten', defeatable: false, scareable: true, count: 5, chaseSpeed: 6, wanderSpeed: 1.6, notice: 9, radius: 0.7, height: 1.1, homes: [...] }` with at least 7 candidate homes spread over patio, path and lawn, none within 14 of the spawn and none within 4 of a pebble (the manager filters on colliders and pebbles).
    - `pebbleSpots`: exactly 10, with these hints: `On the gazebo roof`, `Up in the playhouse`, `On the swing`, `Top of the lemon tree`, `Among the snake plants`, `On the wagon wheel`, `Under the bench`, `On the shed roof`, `On the patio table`, `Along the fence top`.

Yard layout (zones in x; everything from the spec's "The yard" section must be present):
  - Patio `x -24..-5`, concrete with curved terracotta stripes (draw them on a canvas texture). Path `x -5..0`. Lawn `x 0..24`, green. All at height 0. Porch deck `z 40..48` across the full width at height 0.4 (one step), with the green house front behind it (`z 48`), orange trim, gabled roof, lattice, French doors, neat pots.
  - White clapboard house wall along `x = -24` with one window; white board fence along `x = 24`; low brick edging and hedge along `z = -48`.
  - Patio: gazebo centred near `(-14, 0)` with the table under it; chairs, exercise ball and urn near `(-20, -38)`; hammock chair on its stand near `(-21, 18)`; wicker plant stand near the path.
  - Lawn: lemon tree near `(8, 36)`; closed umbrella and playhouse (legs, ladder, slide, deck at about 4 high) near `(8, 22)`; swing set near `(14, 0)` with two belt swings and the green glider; ride-on toy near `(4, 8)`; wagon wheel and wall ornament on the fence near `(23.5, 4)`; shed in the corner near `(18, -40)` with the mailbox on a post; snake plants on stools along the fence near `(22, -24)`; bench with blue cushions on a paved pad near `(16, -30)`; child's bike near `(21, -46)`.
  - Climbable / not climbable / hiding gaps exactly as the spec's "Climbing and hiding" section. Hiding gaps (under bench, playhouse, patio table, chairs): collider `bottom` between 0.5 and 1.05 above the ground.
  - Every pebble must be reachable: check each with a simulated climb (the pattern in Task 6) or by playing to it.
  - Follow `mall.js` for helpers (`add`, `boxCol`, `circCol` with `rAt`), shadows, `solids`, and the sky (`buildSky` with `sky.jpg`). Reuse `stucco.jpg` / `sidewalk.jpg` where they suit; otherwise flat toon colours.

- [ ] **Step 1: Write the failing tests** in `tests/unlock.test.mjs`, with `const store = (init) => { const m = new Map(Object.entries(init)); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };`:
  - `Level 2 players get Level 3, once` — `{ 'blueworld.unlocked': '2' }` → after `migrateUnlocks(s)`, unlocked is `'3'` and the flag is set.
  - `new players are not unlocked` — `{}` → unlocked still absent, flag set.
  - `does not run twice` — `{ 'blueworld.unlocked': '2', 'blueworld.l3open': '1' }` → unlocked stays `'2'`.
  - `never lowers progress` — `{ 'blueworld.unlocked': '3' }` → stays `'3'`.
  - `storage that throws is survived` — a store whose `getItem` throws → `migrateUnlocks` does not throw.
- [ ] **Step 2:** `npm test` — expect FAIL.
- [ ] **Step 3:** Implement `migrateUnlocks` and the Level 3 entry; call it in `init()`. `npm test` — pass.
- [ ] **Step 4:** Implement `src/kittenModel.js` and the kind → model table in `main.js`.
- [ ] **Step 5:** Implement `src/levels/yard.js`.
- [ ] **Step 6:** `npm test` and `npm run build` — both pass.
- [ ] **Step 7: Verify in the browser:** set `localStorage['blueworld.unlocked'] = '3'`, open `?level=3&go=1`. Expect: title "Blue World · The Back Yard", no console errors, `__game.tarantulas.spiders.length === 5`, `__game.pebbles.pebbles.length === 10`. Take one screenshot from the spawn and one from above the lawn and compare against the spec's landmark list and the "tidy" anti-goal.

---

### Task 6: Clip scan, play-through checks and docs

**Files:**
- Create: `tools/clipScan.js`
- Modify: `README.md` (levels list, controls: Q / Tail, push-ups scare kittens), `.vercelignore` (add `tools`, `tests`)

**Interfaces:**
- Produces: `scan(levelPath) → Promise<string[]>` in `tools/clipScan.js`, run from the browser console in dev: `(await import('/tools/clipScan.js')).scan('/src/levels/yard.js')`. It builds the level into a throwaway scene and, on a 0.25 grid over the play area, at the ground and at every collider top the lizard could stand on (and where `Player.blocking` is false), reports each mesh that contains a point 0.12 or 0.35 above that standing height. Shape-aware for box, cylinder, cone and sphere geometry via `geometry.parameters`; skips ground planes, the sky and anything outside the bounds. One output line per mesh: geometry type, world position, hit count, standing heights. It reads the play area from `clampToWorld`.

- [ ] **Step 1:** Write `tools/clipScan.js`.
- [ ] **Step 2:** Run it on `/src/levels/mall.js` — expect only the known unreachable spots (clock-tower spire, bench-leg tops) and sub-0.15 sinks on the orange tree and umbrellas.
- [ ] **Step 3:** Run it on `/src/levels/yard.js`. Fix every reported spot in `yard.js` that the lizard can actually reach, re-run until clean.
- [ ] **Step 4: Simulated checks in the browser console** (build the yard into a throwaway scene, drive a `Player` at 60 fps):
  - each of the ten pebbles: walking/climbing toward its prop ends with the lizard standing within pickup range of it;
  - the lizard can walk under the bench, the playhouse and the patio table;
  - a kitten placed beside the bench cannot get under it (run the manager 5 s with the lizard underneath; the kitten's footprint distance to the bench collider stays > 0).
- [ ] **Step 5: Play-through checks** on `?level=3&go=1`:
  - a chasing kitten catches a walking lizard and costs one heart;
  - push-ups with a kitten within 6: toast "Scared it off!", kitten runs home and ignores the lizard for ~12 s;
  - Q with a kitten chasing: it goes to the tail, the lizard has no tail, the indicator shows growing, the tail is back after 30 s;
  - jumping on a kitten: bounce, kitten still there, hint toast; F beside a kitten: hint toast;
  - drop the tail while climbing the fence: the tail lies on the ground below (Review Focus 1);
  - a scared kitten whose home is near the fence stays inside the yard (Review Focus 4);
  - collect all ten pebbles (teleporting is fine): win screen says every level is finished;
  - Levels 1 and 2 still load, enemies still chase, stomp and bite still defeat.
- [ ] **Step 6:** Update `README.md` and `.vercelignore`. `npm test` and `npm run build` — both pass.
