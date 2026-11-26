import { build as buildYard, groundHeight } from './yard.js';

// Third boss — Mama Cat, the kittens' mother. The fight happens in the same back yard as
// the level before it, with the kittens gone indoors. Ten easy pebbles lie on the lawn and
// the path; picking up the last one brings her over the fence. Like the kittens she only
// wants to play, so she is never hurt: every time the lizard lands on her back (after a
// missed pounce, or while she plays with its dropped tail) she gets a little sleepier,
// until she curls up and naps. Her rules are in ../mamaCat.js.

// Where she lands (on the path, clear of the furniture).
export const CAT_START = { x: -2.5, z: -10 };

export const PEBBLES = [
  { x: -2.5, z: -28, hint: 'An easy one!' },
  { x: -15, z: -18, hint: 'On the lawn' },
  { x: 6, z: -12, hint: 'By the swings' },
  { x: 19.5, z: -8, hint: 'Near the fence' },
  { x: -2.5, z: 12, hint: 'Along the path' },
  { x: 7, z: 14, hint: 'Out in the open' },
  { x: -11, z: 24, hint: 'Past the gazebo' },
  { x: -2.5, z: 31, hint: 'Nearly at the porch' },
  { x: -18, z: 34, hint: 'The far corner' },
  { x: -2.5, z: -20, hint: 'Back down the path' },
];

export const BOSS = {
  kind: 'cat', ...CAT_START, health: 6,
  scale: 6.5,            // nose to rump, in lizard-world units (the lizard is 1.6)
  emergeFrom: 9,         // she drops in over the fence
  sleeps: true,          // beaten = fast asleep, still there
  lightning: false,      // the sky only turns to sunset as she gets sleepy
  // A little gentler than her standard numbers (CAT in ../mamaCat.js): about 10% slower,
  // a longer warning before each attack and a longer flop. The inverted Mama Cat does not
  // get these: she is built from the standard numbers (see ./inverted.js).
  tune: {
    STALK: 2.9, TROT: 5.4,                         // standard 3.2, 6
    SWIPE_WINDUP: 0.7, CROUCH: 1.0, POUNCE_CD: 2.8, // standard 0.6, 0.9, 2.5
    FLOP: 2.3, PLAY: 3.3,                          // standard 2.0, 3.0
  },
  text: {
    name: 'Mama Cat',
    wake: "The kittens' mama is climbing the fence…",
    stuck: 'She flopped over! Jump on her back!',
    wait: 'Wait until she flops, or trick her with your tail!',
    winTitle: 'Mama Cat is fast asleep!',
    winMsg: 'She was only playing, and now she is all tired out.',
  },
};

export async function build(scene) {
  const yard = await buildYard(scene);
  return {
    ...yard,
    pebbleSpots: PEBBLES.map((p) => ({ x: p.x, z: p.z, y: groundHeight(p.x, p.z) + 0.6, hint: p.hint })),
    enemies: { kind: 'kitten', count: 0 }, // the kittens are indoors (their model is her stand-in if hers fails to load)
    boss: BOSS,
  };
}
