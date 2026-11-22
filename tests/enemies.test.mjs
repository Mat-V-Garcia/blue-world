import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setGround } from '../src/world.js';
import { createTarantulas } from '../src/enemies.js';

const scene = { add() {}, remove() {} };
const model = () => ({ root: new THREE.Object3D(), update() {} });
const make = (cfg = {}) => { // one enemy, home at (0,0) unless cfg.homes says otherwise
  setGround({ height: () => 0, radius: 60, bounds: cfg.bounds });
  return createTarantulas(scene, [], [], model, { homes: [[0, 0]], count: 1, ...cfg });
};
const lizard = (x, z, y = 0, velY = 0) => ({ pos: new THREE.Vector3(x, y, z), velY });
const run = (m, p, secs, hurt = true) => {
  let last;
  for (let i = 0; i < secs * 60; i++) { last = m.update(1 / 60, p, hurt); if (last.result) return last; }
  return last;
};
const KITTEN = { defeatable: false, scareable: true, radius: 0.7, height: 1.1, chaseSpeed: 6, notice: 9 };

test('defeatable enemy is stomped as before', () => {
  const m = make();
  const r = m.update(1 / 60, lizard(0, 0, 0.3, -5), true);
  assert.equal(r.result, 'stomp');
  assert.equal(m.spiders[0].alive, false);
});

test('non-defeatable enemy bounces the lizard and stays alive', () => {
  const m = make(KITTEN);
  const r = m.update(1 / 60, lizard(0, 0, 0.8, -5), true);
  assert.equal(r.result, 'bounce');
  assert.equal(m.spiders[0].alive, true);
});

test('bite defeats a tarantula, is shrugged off by a kitten', () => {
  const t = make();
  assert.deepEqual(t.bite(new THREE.Vector3(0, 0, -1), 0), { defeated: 1, shrugged: 0 });
  const k = make(KITTEN);
  assert.deepEqual(k.bite(new THREE.Vector3(0, 0, -1), 0), { defeated: 0, shrugged: 1 });
  assert.equal(k.spiders[0].alive, true);
});

test('scare does nothing unless scareable', () => {
  const m = make();
  assert.equal(m.scare(new THREE.Vector3(1, 0, 0)), 0);
  assert.equal(m.spiders[0].state, 'wander');
});

test('scared kitten runs home, cannot hurt, then wanders again', () => {
  const m = make(KITTEN);
  const p = lizard(4, 0);
  run(m, p, 1, false);
  const s = m.spiders[0];
  assert.equal(s.state, 'chase');
  assert.ok(Math.hypot(s.pos.x, s.pos.z) > 1, 'kitten left home to chase');
  assert.equal(m.scare(p.pos), 1);
  assert.equal(s.state, 'scared');
  p.pos.copy(s.pos);
  for (let i = 0; i < 60; i++) { p.pos.copy(s.pos); assert.notEqual(m.update(1 / 60, p, true).result, 'hurt'); }
  assert.ok(Math.hypot(s.pos.x, s.pos.z) < 1, 'kitten ran back home');
  p.pos.set(40, 0, 40);
  run(m, p, 11.2);
  assert.notEqual(s.state, 'scared');
});

test('scare ignores kittens out of range', () => {
  const m = make(KITTEN);
  assert.equal(m.scare(new THREE.Vector3(20, 0, 0)), 0);
  assert.equal(m.spiders[0].state, 'wander');
});

test('distract pulls the enemy to the tail and holds it there without hurting', () => {
  const m = make();
  const s = m.spiders[0];
  const far = lizard(40, 40);
  assert.equal(m.distract(new THREE.Vector3(5, 0, 0)), 1);
  assert.equal(s.state, 'tail');
  run(m, far, 3);
  assert.ok(Math.hypot(s.pos.x - 5, s.pos.z) < 1.2, 'enemy is at the tail');
  const p = lizard(s.pos.x, s.pos.z);
  for (let i = 0; i < 60; i++) assert.notEqual(m.update(1 / 60, p, true).result, 'hurt');
  run(m, far, 2.2);
  assert.equal(s.state, 'wander');
});

test('scared kitten stays inside rectangular bounds', () => {
  const m = make({ ...KITTEN, bounds: { x0: -3, x1: 3, z0: -3, z1: 3 }, homes: [[2.5, 2.5]] });
  const s = m.spiders[0];
  const p = lizard(-2.5, -2.5);
  run(m, p, 1, false);
  m.scare(p.pos, 50);
  for (let i = 0; i < 300; i++) {
    m.update(1 / 60, p, false);
    assert.ok(Math.abs(s.pos.x) <= 3 && Math.abs(s.pos.z) <= 3);
  }
});

test('reset clears scared and distracted states', () => {
  const m = make(KITTEN);
  m.scare(new THREE.Vector3(1, 0, 0));
  assert.equal(m.spiders[0].state, 'scared');
  m.reset();
  assert.equal(m.spiders[0].state, 'wander');
});

test('a kitten can reach a lizard hugging the edge of a rectangular yard', () => {
  const m = make({ ...KITTEN, edgeMargin: 0.7, bounds: { x0: -10, x1: 10, z0: -10, z1: 10 } });
  const r = run(m, lizard(-9.7, 0), 6);
  assert.equal(r.result, 'hurt');
});
