import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateUnlocks } from '../src/levels/index.js';

const store = (init) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m };
};

test('Level 2 players get Level 3, once', () => {
  const s = store({ 'blueworld.unlocked': '2' });
  migrateUnlocks(s);
  assert.equal(s.m.get('blueworld.unlocked'), '3');
  assert.ok(s.m.get('blueworld.l3open'));
});

test('new players are not unlocked', () => {
  const s = store({});
  migrateUnlocks(s);
  assert.equal(s.m.has('blueworld.unlocked'), false);
  assert.ok(s.m.get('blueworld.l3open'));
});

test('does not run twice', () => {
  const s = store({ 'blueworld.unlocked': '2', 'blueworld.l3open': '1' });
  migrateUnlocks(s);
  assert.equal(s.m.get('blueworld.unlocked'), '2');
});

test('never lowers progress', () => {
  const s = store({ 'blueworld.unlocked': '3' });
  migrateUnlocks(s);
  assert.equal(s.m.get('blueworld.unlocked'), '3');
});

test('storage that throws is survived', () => {
  assert.doesNotThrow(() => migrateUnlocks({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }));
});

test('a browser that blocks storage entirely (reading localStorage throws) is survived', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try { assert.doesNotThrow(() => migrateUnlocks()); } finally { delete globalThis.localStorage; }
});
