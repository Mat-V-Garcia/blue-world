import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTailDrop } from '../src/tail.js';

const scene = { add() {}, remove() {} };
const flat = () => 0;
const run = (tail, secs) => { for (let i = 0; i < Math.round(secs * 60); i++) tail.update(1 / 60); };

test('starts ready and fully grown', () => {
  const tail = createTailDrop(scene, flat);
  assert.equal(tail.ready, true);
  assert.equal(tail.grown, 1);
  assert.equal(tail.pos, null);
});

test("drop places the tail on the surface below and can't be repeated", () => {
  const tail = createTailDrop(scene, () => 2);
  assert.equal(tail.drop(new THREE.Vector3(1, 9, 3), 0), true);
  assert.deepEqual(tail.pos.toArray(), [1, 2, 3]);
  assert.equal(tail.ready, false);
  assert.equal(tail.grown, 0);
  assert.equal(tail.drop(new THREE.Vector3(7, 7, 7), 0), false);
  assert.deepEqual(tail.pos.toArray(), [1, 2, 3]);
});

test('drop asks for the surface below the lizard, not above it', () => {
  const calls = [];
  const tail = createTailDrop(scene, (x, z, y) => { calls.push([x, z, y]); return 0; });
  tail.drop(new THREE.Vector3(1, 9, 3), 0);
  assert.deepEqual(calls, [[1, 3, 9]]);
});

test('the dropped tail disappears after 6 s', () => {
  const tail = createTailDrop(scene, flat);
  tail.drop(new THREE.Vector3(), 0);
  run(tail, 5.9);
  assert.notEqual(tail.pos, null);
  run(tail, 0.2);
  assert.equal(tail.pos, null);
});

test('the tail regrows over the last 4 s and is ready at 30 s', () => {
  const tail = createTailDrop(scene, flat);
  tail.drop(new THREE.Vector3(), 0);
  run(tail, 25.9);
  assert.equal(tail.grown, 0);
  assert.equal(tail.ready, false);
  run(tail, 2.1);
  assert.ok(tail.grown > 0.4 && tail.grown < 0.6, `grown ${tail.grown}`);
  run(tail, 2.1);
  assert.equal(tail.ready, true);
  assert.equal(tail.grown, 1);
});

test('reset puts the tail back at once', () => {
  const tail = createTailDrop(scene, flat);
  tail.drop(new THREE.Vector3(), 0);
  tail.reset();
  assert.equal(tail.ready, true);
  assert.equal(tail.grown, 1);
  assert.equal(tail.pos, null);
});
