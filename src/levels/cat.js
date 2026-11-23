import { build as buildYard, groundHeight } from './yard.js';

// Third boss — the big cat. The fight happens in the same back yard as the level before
// it, with the kittens gone indoors. Ten easy pebbles lie on the lawn and the path;
// picking up the last one brings the big cat over the fence. Like the kittens it only
// wants to play, so it is never hurt: every time the lizard lands on its back after a
// missed pounce it gets a little sleepier, until it curls up and naps.

// Where the big cat lands (on the path, clear of the furniture).
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

export async function build(scene) {
  const yard = await buildYard(scene);
  return {
    ...yard,
    pebbleSpots: PEBBLES.map((p) => ({ x: p.x, z: p.z, y: groundHeight(p.x, p.z) + 0.6, hint: p.hint })),
    enemies: { kind: 'kitten', count: 0 }, // the kittens are indoors; this picks the boss's model
    boss: {
      kind: 'cat', ...CAT_START, health: 6, scale: 2.2, hidden: true,
      coat: 0xf2a25a,        // a big orange cat
      emergeFrom: 9,         // it drops in over the fence
      sleeps: true,          // beaten = fast asleep, still there
      lightning: false,      // the sky only turns to sunset as it gets sleepy
      shotColor: 0xb98f66,   // hairballs
      // a cat is quicker on its feet than the tarantula, with a taller back
      tune: { WALK: 4, BODY_R: 2.0, BACK_UP: 2.6, BACK_STUCK: 1.0, WEB_TIME: 2 },
      text: {
        name: 'Big Cat',
        wake: 'Something is climbing the fence…',
        stuck: 'It flopped over! Jump on its back!',
        wait: 'Wait until it flops after a pounce!',
        webbed: 'Yuck! A hairball!',
        winTitle: 'The Big Cat is fast asleep!',
        winMsg: 'It was only playing, and now it is all tired out.',
      },
    },
  };
}
