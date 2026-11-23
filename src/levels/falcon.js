import { build as buildShops, groundHeight } from './mall.js';

// Second boss — the peregrine falcon. The fight happens in the same Fullerton shopping
// center as the level before it: same shops, cars and plaza, no pigeons. Ten easy pebbles
// lie out in the open; picking up the last one brings the falcon down off the clock tower.

// The top of the clock tower's spire, where the falcon waits and watches.
export const PERCH = { x: -50, y: 32, z: 38 };

// up: how far above the ground it floats (0.5 fits under a car or a bench).
export const PEBBLES = [
  { x: 10, z: -4, up: 0.6, hint: 'An easy one!' },
  { x: 20, z: -14, up: 0.6, hint: 'Between the cars' },
  { x: 36, z: -14, up: 0.5, hint: 'Hiding under a car' },
  { x: 44, z: -26, up: 0.6, hint: 'Across the lot' },
  { x: 0, z: -26, up: 0.6, hint: 'By the parking bays' },
  { x: -26, z: -12, up: 0.6, hint: 'Out in the open' },
  { x: -38, z: 14, up: 0.6, hint: 'On the plaza' },
  { x: -12, z: 22, up: 0.6, hint: 'Near the fountain' },
  { x: -30, z: 26, up: 0.55, hint: 'Under the bench!' },
  { x: 30, z: 6, up: 0.6, hint: 'The far corner' },
];

export async function build(scene) {
  const shops = await buildShops(scene);
  return {
    ...shops,
    pebbleSpots: PEBBLES.map((p) => ({ x: p.x, z: p.z, y: groundHeight(p.x, p.z) + p.up, hint: p.hint })),
    enemies: { kind: 'falcon', count: 0 }, // the pigeons have all fled; this picks the boss's model
    boss: {
      kind: 'falcon', perch: PERCH, health: 6, scale: 1, yaw: Math.PI * 0.75,
      text: {
        name: 'Peregrine Falcon',
        wake: 'A shadow passes overhead…',
        stuck: 'It missed! Jump on its back!',
        wait: 'Wait until it dives and misses!',
        winTitle: 'You beat the Peregrine Falcon!',
        winMsg: 'The falcon flies away and the shops are safe again.',
      },
    },
  };
}
