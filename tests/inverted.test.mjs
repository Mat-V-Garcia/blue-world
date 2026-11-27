import test from 'node:test';
import assert from 'node:assert/strict';
import { harder, harderEnemies, harderBoss, SMALL, EXTRA_HEALTH } from '../src/levels/inverted.js';
import { BOSS } from '../src/boss.js';
import { FALCON } from '../src/falcon.js';
import { CAT } from '../src/mamaCat.js';
import { BOSS as CAT_BOSS } from '../src/levels/cat.js';

const WALK = 5.5, SPRINT = 10; // the lizard's speeds (src/player.js)

test('small enemies get faster, notice from further and there are two more', () => {
  const pigeons = { kind: 'pigeon', count: 6, chaseSpeed: 3.4, notice: 8, radius: 0.6 };
  const h = harderEnemies(pigeons);
  assert.equal(h.count, 8);
  assert.ok(h.chaseSpeed > pigeons.chaseSpeed && h.notice > pigeons.notice);
  assert.equal(h.kind, 'pigeon');
  assert.equal(h.radius, 0.6);                 // everything else is left alone
  assert.equal(pigeons.count, 6);              // the regular level's settings are not changed
});

test('a level with no settings gets the harder defaults; a level with no small enemies keeps none', () => {
  const h = harderEnemies(undefined);
  assert.equal(h.kind, 'tarantula');
  assert.equal(h.count, 6 + SMALL.extra);
  assert.equal(harderEnemies({ kind: 'falcon', count: 0 }).count, 0);
});

test('enemies that can be beaten stay slower than a walking lizard; kittens stay slower than a sprint', () => {
  assert.ok(harderEnemies(undefined).chaseSpeed < WALK);
  assert.ok(harderEnemies({ kind: 'pigeon', chaseSpeed: 3.4 }).chaseSpeed < WALK);
  assert.ok(harderEnemies({ kind: 'kitten', chaseSpeed: 6 }).chaseSpeed < SPRINT);
});

test('every boss takes two more hits, moves faster and gives a shorter opening', () => {
  const t = harderBoss({ x: 0, z: 0, health: 6 });
  assert.equal(t.health, 6 + EXTRA_HEALTH);
  assert.ok(t.tune.WALK > BOSS.WALK && t.tune.LUNGE_SPEED > BOSS.LUNGE_SPEED);
  assert.ok(t.tune.STUCK_MAX < BOSS.STUCK_MAX && t.tune.STUCK_MIN < BOSS.STUCK_MIN && t.tune.WINDUP < BOSS.WINDUP);

  const f = harderBoss({ kind: 'falcon', health: 6 });
  assert.equal(f.health, 8);
  assert.ok(f.tune.DIVE_SPEED > FALCON.DIVE_SPEED && f.tune.STUCK_MAX < FALCON.STUCK_MAX && f.tune.WINDUP < FALCON.WINDUP);
  assert.equal(f.tune.RINGS, 3);  // it strikes three rings in turn
  assert.equal(FALCON.RINGS, 1);  // the regular falcon dives once, at the lizard

  const c = harderBoss(CAT_BOSS);
  assert.equal(c.health, 8);
  assert.ok(c.tune.STALK > CAT.STALK && c.tune.FLOP < CAT.FLOP && c.tune.PLAY < CAT.PLAY && c.tune.CROUCH < CAT.CROUCH);
  // the regular Mama Cat is a little gentler than standard, and that easing does not
  // carry over: the inverted one is built from her standard numbers
  assert.ok(CAT_BOSS.tune.STALK < CAT.STALK && CAT_BOSS.tune.FLOP > CAT.FLOP && CAT_BOSS.tune.CROUCH > CAT.CROUCH);
  assert.equal(CAT_BOSS.health, 6);
  assert.deepEqual(c.tune, harderBoss({ kind: 'cat', health: 6 }).tune);
  assert.equal(c.tune.STALK, 3.84);
  assert.equal(c.tune.FLOP, 1.5);
  assert.equal(c.tune.DOUBLE, true); // she pounces twice from the start
  assert.equal(c.dark, true);        // and her fight is in the dark
  assert.ok(!f.dark && !t.dark && !CAT_BOSS.dark); // only hers
  assert.equal(CAT.DOUBLE, false);   // the regular one only when she is sleepy
  assert.equal(c.text, CAT_BOSS.text);
});

test('openings stay long enough to use: at least a second on the back of each boss', () => {
  assert.ok(harderBoss({}).tune.STUCK_MIN >= 1);
  assert.ok(harderBoss({ kind: 'falcon' }).tune.STUCK_MIN >= 1);
  assert.ok(harderBoss({ kind: 'cat' }).tune.FLOP >= 1);
});

test('harder() changes only the enemies and the boss', () => {
  const update = () => {}, world = { colliders: [1], pebbleSpots: [2], update, enemies: { kind: 'kitten', count: 5, chaseSpeed: 6 } };
  const h = harder(world);
  assert.equal(h.colliders, world.colliders);
  assert.equal(h.update, update);
  assert.equal(h.enemies.count, 7);
  assert.equal('boss' in h, false);
  assert.equal(harder({ ...world, boss: { kind: 'cat', health: 6 } }).boss.health, 8);
});
