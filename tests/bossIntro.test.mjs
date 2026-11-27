import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setGround } from '../src/world.js';
import { INTRO, INTRO_LENGTH, INTROS, introFor, introBlend, introLetsBossMove, introCamera } from '../src/bossIntro.js';
import { createBoss } from '../src/boss.js';
import { createFalcon } from '../src/falcon.js';
import { createMamaCat } from '../src/mamaCat.js';

test('the camera starts and ends on the lizard and is fully on the boss in between', () => {
  assert.equal(introBlend(0), 0);
  assert.equal(introBlend(INTRO.IN), 1);
  assert.equal(introBlend(INTRO.HOLD_END), 1);
  assert.equal(introBlend(INTRO_LENGTH), 0);
  let last = 0;
  for (let t = 0; t <= INTRO.IN; t += 0.05) { const w = introBlend(t); assert.ok(w >= last); last = w; }
});
test('the boss comes out while the camera is arriving, and the name follows', () => {
  assert.ok(INTRO.REVEAL <= INTRO.IN && INTRO.CARD > INTRO.REVEAL && INTRO.CARD < INTRO.HOLD_END);
  assert.ok(INTRO_LENGTH > 4 && INTRO_LENGTH < 6.5);
});
test('every boss has its words, regular and inverted', () => {
  for (const kind of ['tarantula', 'falcon', 'cat']) {
    assert.ok(INTROS[kind].line && INTROS[kind].invertedLine);
    assert.notEqual(INTROS[kind].line, INTROS[kind].invertedLine);
  }
  assert.equal(introFor(undefined), INTROS.tarantula); // the tarantula level names no kind
});
test('the camera sits on the lizard side of the boss, at the shot distance or closer', () => {
  const shot = INTROS.tarantula, anchor = { x: 0, y: 0, z: 0 };
  for (const t of [0, 2, INTRO_LENGTH]) {
    const c = introCamera(anchor, { x: 0, z: -30 }, shot, t);
    assert.ok(c.z < 0, 'on the side the lizard is on');
    const d = Math.hypot(c.x, c.z);
    assert.ok(d <= shot.dist + 1e-6 && d > shot.dist * 0.8);
    assert.equal(c.y, shot.height);
  }
  // a lizard standing right on the spot still gets a sensible camera
  const c = introCamera(anchor, { x: 0, z: 0 }, shot, 1);
  assert.ok(Number.isFinite(c.x) && Math.hypot(c.x, c.z) > 5);
});
test('the boss is only let move while it is arriving', () => {
  for (const s of ['hidden', 'emerge', 'circle']) assert.ok(introLetsBossMove(s));
  for (const s of ['approach', 'windup', 'lunge', 'webwind', 'dive', 'stalk', 'crouch', 'pounce', 'swipeWind']) assert.ok(!introLetsBossMove(s));
});

// Played the way main.js plays the intro: the boss is stepped only while introLetsBossMove
// says so, and never allowed to hurt. Whatever the lizard does, nothing reaches it.
const scene = { add() {}, remove() {} };
const model = () => ({ root: new THREE.Object3D(), update() {} });
const liz = (x, z) => ({ pos: new THREE.Vector3(x, 0, z), velY: 0, onGround: true });
const playIntro = (boss, player) => {
  setGround({ height: () => 0, radius: 60 });
  let emerged = false;
  for (let t = 0; t < INTRO_LENGTH; t += 1 / 60) {
    if (!emerged && t >= INTRO.REVEAL) { emerged = boss.emerge(); assert.ok(emerged); }
    if (!introLetsBossMove(boss.state)) continue;
    const ev = boss.update(1 / 60, player, false);
    assert.equal(ev.caught, null);
    assert.ok(!ev.webbed && !ev.hit);
  }
};
test('tarantula: out of the sand and standing by when the intro ends, no attack begun', () => {
  setGround({ height: () => 0, radius: 60 });
  const b = createBoss(scene, [], model, { x: 0, z: 0, hidden: true });
  playIntro(b, liz(0, 3)); // the lizard right beside it
  assert.equal(b.state, 'approach');
  assert.equal(b.webs.length, 0);
});
test('falcon: off its perch and in the air when the intro ends, not diving', () => {
  setGround({ height: () => 0, radius: 60 });
  const b = createFalcon(scene, [], model, { perch: { x: 0, y: 30, z: 0 } });
  playIntro(b, liz(4, 4));
  assert.ok(b.state === 'circle' || b.state === 'windup');
  assert.ok(b.pos.y > 5, 'still up in the air');
});
test('Mama Cat: over the fence and on her feet when the intro ends, not pouncing', () => {
  setGround({ height: () => 0, radius: 60 });
  const c = createMamaCat(scene, [], model, { x: 0, z: 0 });
  playIntro(c, liz(0, 3));
  assert.equal(c.state, 'stalk');
});
