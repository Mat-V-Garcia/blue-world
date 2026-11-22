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

// ---- the boss (level 4) ----
const withBrowser = async (unlocked, search, fn) => {
  globalThis.localStorage = store(unlocked ? { 'blueworld.unlocked': String(unlocked) } : {});
  globalThis.location = { search };
  try { return fn(await import('../src/levels/index.js')); } finally { delete globalThis.localStorage; delete globalThis.location; }
};

test('asking for the boss by address falls back to Level 3 until it is unlocked', async () => {
  assert.equal(await withBrowser(3, '?level=4', (m) => m.currentLevelId()), 3);
  assert.equal(await withBrowser(4, '?level=4', (m) => m.currentLevelId()), 4);
});

test('nobody gets the boss unlocked automatically', () => {
  const s = store({ 'blueworld.unlocked': '3' });
  migrateUnlocks(s);
  assert.equal(s.m.get('blueworld.unlocked'), '3');
});
