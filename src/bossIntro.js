// Boss intros: the short cutscene that plays when the tenth pebble brings a boss out.
// The game's own camera leaves the lizard, watches the boss arrive, shows its name, and
// glides back. Nothing can hurt the lizard meanwhile, and it can always be skipped.
// This file holds the timing, the words and the camera maths; main.js runs it.

// Seconds. IN: the camera's glide to the boss. REVEAL: when the boss starts to come out.
// CARD: when its name appears. HOLD_END: when the camera starts back. OUT: the glide back.
// SKIP_GUARD: presses this early are ignored (a jump held from grabbing the last pebble).
// SAFE: how long the lizard cannot be hurt once the fight starts.
export const INTRO = { IN: 1.0, REVEAL: 0.9, CARD: 1.6, HOLD_END: 4.3, OUT: 0.7, SKIP_GUARD: 0.5, SAFE: 1.2 };
export const INTRO_LENGTH = INTRO.HOLD_END + INTRO.OUT;

// Per boss. line / invertedLine: the words under its name.
// dist: how far the camera sits from where the boss arrives (on the lizard's side of it).
// height: camera height above that spot's ground (falcon: above its perch, so negative
// looks up at it). lookUp: how far above the boss's feet the camera aims.
export const INTROS = {
  tarantula: {
    line: 'Woken from under the sand',
    invertedLine: 'Red, angry and faster than before',
    dist: 10, height: 1.3, lookUp: 1.6,
  },
  falcon: {
    line: 'The fastest bird in the world',
    invertedLine: 'It strikes three times in a row',
    dist: 11, height: -4, lookUp: 0.6,
    follow: true, // it flies off its perch: the camera keeps up with it
  },
  cat: {
    line: 'She only wants to play!',
    invertedLine: 'Twice as playful: she pounces twice',
    dist: 13, height: 1.5, lookUp: 2.2,
  },
};
export const introFor = (kind) => INTROS[kind] ?? INTROS.tarantula;

const ease = (k) => { const c = Math.min(1, Math.max(0, k)); return c * c * (3 - 2 * c); };

// How much of the picture is the cutscene camera at time t: 0 = the normal camera behind
// the lizard, 1 = the boss shot. Eases in at the start and back out at the end.
export function introBlend(t) {
  if (t <= 0 || t >= INTRO_LENGTH) return 0;
  if (t < INTRO.IN) return ease(t / INTRO.IN);
  if (t > INTRO.HOLD_END) return 1 - ease((t - INTRO.HOLD_END) / INTRO.OUT);
  return 1;
}

// While the intro plays the boss only does its arriving: waiting hidden, coming out, or
// (the falcon) flying off its perch. The moment it would do anything else it is held
// still until the fight starts.
export const introLetsBossMove = (state) => state === 'hidden' || state === 'emerge' || state === 'circle';

// Where the cutscene camera sits. anchor: where the boss arrives {x, y, z} (y = the ground
// there, or the falcon's perch). player: {x, z}. t: seconds into the intro (it drifts
// sideways and creeps in a little, so the shot is never quite still).
export function introCamera(anchor, player, shot, t) {
  let dx = player.x - anchor.x, dz = player.z - anchor.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.5) { dx = 0; dz = 1; } else { dx /= d; dz /= d; }
  const k = Math.min(1, Math.max(0, t / INTRO_LENGTH));
  const a = -0.35 + 0.3 * k;                   // a slow drift round the boss
  const c = Math.cos(a), s = Math.sin(a);
  const dist = shot.dist * (1 - 0.15 * k);     // ...while creeping closer
  return {
    x: anchor.x + (dx * c - dz * s) * dist,
    y: anchor.y + shot.height,
    z: anchor.z + (dx * s + dz * c) * dist,
  };
}
