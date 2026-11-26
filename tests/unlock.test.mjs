import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateUnlocks } from '../src/levels/index.js';

const store = (init) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m };
};

test('players from before the Back Yard existed (Shops open) get the Back Yard, once', () => {
  const s = store({ 'blueworld.unlocked': '2' });
  migrateUnlocks(s);
  assert.equal(s.m.get('blueworld.unlocked'), '5'); // the Back Yard is now id 5
  assert.ok(s.m.get('blueworld.l3open'));
});

test('new players are not unlocked', () => {
  const s = store({});
  migrateUnlocks(s);
  assert.equal(s.m.has('blueworld.unlocked'), false);
  assert.ok(s.m.get('blueworld.l3open'));
});

test('does not run twice', () => {
  const s = store({ 'blueworld.unlocked': '2', 'blueworld.l3open': '1', 'blueworld.bossSecond': '1' });
  migrateUnlocks(s);
  assert.equal(s.m.get('blueworld.unlocked'), '2');
});

test('never lowers progress', () => {
  const s = store({ 'blueworld.unlocked': '3' });
  migrateUnlocks(s);
  assert.ok(Number(s.m.get('blueworld.unlocked')) >= 3);
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

// The boss moved from last to second (Desert, Boss, Shops, Back Yard). Saved progress is
// the highest level id open, so old saves shift up by one to keep the same levels open.
import { LEVELS, levelLabel } from '../src/levels/index.js';

test('level order: the six regular levels, then the same six inverted', () => {
  assert.deepEqual(LEVELS.map((l) => l.name), [
    'The Desert', 'The Giant Tarantula', 'Fullerton Shops', 'The Peregrine Falcon', 'The Back Yard', 'Mama Cat',
    'Inverted Desert', 'Inverted Giant Tarantula', 'Inverted Fullerton Shops', 'Inverted Peregrine Falcon', 'Inverted Back Yard', 'Inverted Mama Cat',
  ]);
  assert.deepEqual(LEVELS.map((l) => l.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(LEVELS.map(levelLabel), ['Level 1', 'Boss', 'Level 2', 'Boss', 'Level 3', 'Boss', 'Level 4', 'Boss', 'Level 5', 'Boss', 'Level 6', 'Boss']);
  assert.deepEqual(LEVELS.map((l) => !!l.inverted), [false, false, false, false, false, false, true, true, true, true, true, true]);
});

test('each inverted level is its regular level again: same place, same kind, its own story', () => {
  for (let i = 0; i < 6; i++) {
    const a = LEVELS[i], b = LEVELS[i + 6];
    assert.equal(b.load, a.load);
    assert.equal(!!b.boss, !!a.boss);
    assert.notEqual(b.intro, a.intro);
    assert.ok(b.intro.length > 40);
  }
});

test('the inverted levels stay locked until Mama Cat is beaten', async () => {
  assert.equal(await withBrowser(6, '?level=7', (m) => m.currentLevelId()), 6); // Mama Cat open, not beaten
  assert.equal(await withBrowser(7, '?level=7', (m) => m.currentLevelId()), 7);
  assert.equal(await withBrowser(12, '?level=12', (m) => m.currentLevelId()), 12);
  assert.equal(await withBrowser(12, '?level=99', (m) => m.currentLevelId()), 12);
});

test('progress saved before the inverted levels existed is left as it is', () => {
  for (const n of [1, 3, 5, 6]) {
    const s = store({ 'blueworld.unlocked': String(n), 'blueworld.l3open': '1', 'blueworld.bossSecond': '1', 'blueworld.falconFourth': '1' });
    migrateUnlocks(s);
    assert.equal(s.m.get('blueworld.unlocked'), String(n));
  }
});

test('old saves keep the levels they had open after the re-order, once', () => {
  const after = (n) => { const s = store({ 'blueworld.unlocked': String(n), 'blueworld.l3open': '1' }); migrateUnlocks(s); migrateUnlocks(s); return s.m.get('blueworld.unlocked'); };
  assert.equal(after(1), '1'); // only the desert: the boss still has to be earned
  assert.equal(after(2), '3'); // had the Shops
  assert.equal(after(3), '5'); // had the Back Yard (now id 5, past the falcon)
  assert.equal(after(4), '5'); // had everything
});

test('a brand-new player starts with only the desert', () => {
  const s = store({});
  migrateUnlocks(s);
  assert.equal(s.m.has('blueworld.unlocked'), false);
});

// The falcon boss then arrived between the Shops and the Back Yard.
test('saves from before the falcon keep the Back Yard, once; the falcon has to be earned otherwise', () => {
  const after = (n) => { const s = store({ 'blueworld.unlocked': String(n), 'blueworld.l3open': '1', 'blueworld.bossSecond': '1' }); migrateUnlocks(s); migrateUnlocks(s); return s.m.get('blueworld.unlocked'); };
  assert.equal(after(3), '3'); // had the Shops: the falcon is still locked
  assert.equal(after(4), '5'); // had the Back Yard
});
