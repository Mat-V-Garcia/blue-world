import { COUNT, CHASE_SPEED, NOTICE_RANGE } from '../enemies.js';
import { BOSS } from '../boss.js';
import { FALCON } from '../falcon.js';
import { CAT } from '../mamaCat.js';

// The inverted levels: the same six levels again, colour-flipped, played after Mama Cat.
// Everything that makes them harder is in this one file. main.js runs a level's world
// through harder() when the level is marked inverted; the regular levels are untouched.

// Small enemies (tarantulas, pigeons, kittens): quicker, sharper-eyed, and more of them.
export const SMALL = { speed: 1.25, notice: 1.25, extra: 2 };

// Bosses take this many more landings to beat (6 becomes 8)...
export const EXTRA_HEALTH = 2;
// ...and each of their own numbers is multiplied by the factor here. Above 1 is faster or
// further; below 1 is a shorter wait: less warning before an attack, and less time to
// jump on their back afterwards.
export const FACTORS = {
  tarantula: {
    WALK: 1.2, LUNGE_SPEED: 1.2, WEB_SPEED: 1.2,
    WINDUP: 0.85, WEB_COOLDOWN: 0.8,
    STUCK_MAX: 0.75, STUCK_MIN: 0.75,
  },
  falcon: {
    FLY: 1.2, DIVE_SPEED: 1.2,
    CIRCLE_TIME: 0.8, WINDUP: 0.85,
    STUCK_MAX: 0.75, STUCK_MIN: 0.75,
  },
  cat: {
    STALK: 1.2, TROT: 1.2,
    SWIPE_WINDUP: 0.85, CROUCH: 0.85, POUNCE_CD: 0.8,
    FLOP: 0.75, PLAY: 0.75,
  },
};
// Numbers set outright instead of multiplied.
// The falcon strikes three times: three rings circle round the lizard while it hovers,
// stop when it dives, and it hits each in turn. Only after the third is it on the ground.
// Mama Cat pounces twice from the very start: a missed pounce goes straight into a second
// one before she flops (the regular Mama Cat only does that once she is half tired out).
export const SET = {
  falcon: { RINGS: 3 },
  cat: { DOUBLE: true },
};
// The inverted Mama Cat's fight is in the dark: once her intro is over the lights go out,
// and all that can be seen is the lizard, her face and the ring where she will land.
export const DARK = { cat: true };
const BASE = { tarantula: BOSS, falcon: FALCON, cat: CAT };
const round = (n) => Math.round(n * 100) / 100;

// A level's `enemies` settings, made harder. A level that has none (count 0) still has none.
export function harderEnemies(e = { kind: 'tarantula' }) {
  const count = e.count ?? COUNT;
  return {
    ...e,
    count: count === 0 ? 0 : count + SMALL.extra,
    chaseSpeed: round((e.chaseSpeed ?? CHASE_SPEED) * SMALL.speed),
    notice: round((e.notice ?? NOTICE_RANGE) * SMALL.notice),
  };
}

// A level's `boss` config, made harder: more health, and `tune` overrides for its numbers.
// The factors apply to the boss's standard numbers, not to the regular level's own `tune`:
// easing a regular boss does not ease its inverted twin.
export function harderBoss(boss) {
  const kind = boss.kind ?? 'tarantula', base = BASE[kind];
  const tune = {};
  for (const [k, f] of Object.entries(FACTORS[kind])) tune[k] = round(base[k] * f);
  Object.assign(tune, SET[kind]);
  return { ...boss, health: (boss.health ?? base.HEALTH) + EXTRA_HEALTH, tune, ...(DARK[kind] && { dark: true }) };
}

// What a level's build() returned, with its enemies and its boss made harder.
export function harder(world) {
  return { ...world, enemies: harderEnemies(world.enemies), ...(world.boss && { boss: harderBoss(world.boss) }) };
}
