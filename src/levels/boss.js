import * as THREE from 'three';
import { toon, loadTexture, tiled } from '../materials.js';
import { setGround, buildSky, rng, wobble, shapedRock } from '../world.js';

// Boss level — the giant tarantula's arena: a round, nearly flat patch of the same desert
// as Level 1, walled in by tall rock, with a few boulders to hide behind.

export const ARENA_R = 40;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Gentle ripples only (lunges and dodges need fair footing); the sand banks up under the wall.
export function terrainHeight(x, z) {
  const ripples = 0.12 * Math.sin(x * 0.21) * Math.cos(z * 0.17) + 0.08 * Math.sin((x + z) * 0.33);
  return ripples + smooth(38, 60, Math.hypot(x, z)) * 10;
}

// Low cover: blocks webs and stops a lunge. h is the height of the top above the sand.
export const BOULDERS = [
  { x: 14, z: -8, r: 2.2, h: 2.3 }, { x: -16, z: -6, r: 2.4, h: 2.5 }, { x: -12, z: 16, r: 2.0, h: 2.1 },
  { x: 10, z: 20, r: 2.3, h: 2.4 }, { x: 24, z: 6, r: 1.9, h: 2.0 },
];

// The ten golden pebbles. Only when the last one is picked up does the tarantula come out.
// up: how far above the sand it sits (the ones on boulders match the boulder heights).
export const PEBBLES = [
  { x: 0, z: -22, up: 0, hint: 'An easy one!' },
  { x: 14, z: -8, up: 2.3, hint: 'On a boulder' },
  { x: -16, z: -6, up: 2.5, hint: 'Tallest boulder' },
  { x: -28, z: -18, up: 0, hint: 'By the wall' },
  { x: -30, z: 10, up: 0, hint: 'Out west' },
  { x: -12, z: 16, up: 2.1, hint: 'Boulder hop' },
  { x: 10, z: 20, up: 2.4, hint: 'Up top' },
  { x: 0, z: 32, up: 0, hint: 'The far side' },
  { x: 30, z: -14, up: 0, hint: 'Near the cactus' },
  { x: 24, z: 6, up: 2.0, hint: 'Smallest boulder' },
];

function buildTerrain(sandTex) {
  const size = 200, seg = 120;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, toon(sandTex ? 0xffffff : 0xf2c48d, { map: tiled(sandTex, 48, 48), color: sandTex ? 0xf7d2a4 : 0xf2c48d }));
  mesh.receiveShadow = true;
  return mesh;
}

export async function build(scene) {
  setGround({ height: terrainHeight, radius: ARENA_R });
  const [sandTex, rockTex, skyTex] = await Promise.all([
    loadTexture('sand.jpg'), loadTexture('rock.jpg'), loadTexture('sky.jpg'),
  ]);
  const sky = {};
  const horizonColor = await buildSky(scene, skyTex, sky);
  scene.add(buildTerrain(sandTex));

  const colliders = [], solids = [];
  const rockMat = (rx = 1, ry = 1) => toon(rockTex ? 0xffffff : 0xc8653a, { map: tiled(rockTex, rx, ry) });
  const add = (m) => { m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
  const rand = rng(41);

  // The wall: a ring of tall mesas shoulder to shoulder just outside the arena. Each is
  // built from the same radius function its collider uses.
  const N = 18, RING = 49;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + 0.1;
    const x = Math.sin(a) * RING, z = Math.cos(a) * RING;
    const r = 9.2 + rand() * 1.6, h = 6 + rand() * 4; // low enough to leave plenty of sky for the storm
    const base = terrainHeight(x, z) - 2, H = h + 2;
    const wob = wobble(i * 1.9, 0.06);
    const rAt = (_y, ang) => r * wob(ang);
    const mesh = add(new THREE.Mesh(shapedRock(rAt, 0, H, [0, 0.3, 0.6, 1], 36, true), rockMat(4, 2)));
    mesh.position.set(x, base, z);
    solids.push(mesh);
    colliders.push({ type: 'circle', x, z, r: r * 1.06, rAt: (y, ang) => rAt(y - base, ang), bottom: -100, top: base + H, climbable: false });
  }

  // Boulders (same rounded shape as Level 1's)
  for (const [i, b] of BOULDERS.entries()) {
    const base = terrainHeight(b.x, b.z) - 0.3, H = b.h + 0.3;
    const wob = wobble(20 + i * 2.3, 0.08);
    const prof = (t) => (t < 0.35 ? 1 : Math.sqrt(Math.max(0, 1 - ((t - 0.35) / 0.75) ** 2)));
    const rAt = (y, a) => b.r * prof(Math.min(1, Math.max(0, y / H))) * wob(a);
    const mesh = add(new THREE.Mesh(shapedRock(rAt, 0, H, [0, 0.2, 0.35, 0.5, 0.62, 0.74, 0.84, 0.92, 1], 28, true), rockMat(1, 1)));
    mesh.position.set(b.x, base, b.z);
    solids.push(mesh);
    colliders.push({ type: 'circle', x: b.x, z: b.z, r: b.r * 1.1, rAt: (y, a) => rAt(y - base, a), bottom: -100, top: base + H, climbable: true });
  }

  // A few cacti and dead bushes right at the foot of the wall, for looks
  const cactusMat = toon(0x6f9a4f), bushMat = toon(0x9a7a4a);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.5 + rand() * 0.3, d = 38.6 + rand() * 0.8;
    const x = Math.sin(a) * d, z = Math.cos(a) * d, y = terrainHeight(x, z);
    if (i % 3 === 2) {
      const bush = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), bushMat));
      bush.position.set(x, y + 0.45, z); bush.scale.y = 0.7;
      solids.push(bush);
      colliders.push({ type: 'circle', x, z, r: 0.65, bottom: -100, top: y + 0.95, climbable: false });
      continue;
    }
    const h = 3 + rand() * 2.5;
    const trunk = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.45, h - 0.9, 4, 10), cactusMat));
    trunk.position.set(x, y + h / 2, z);
    solids.push(trunk);
    colliders.push({ type: 'circle', x, z, r: 0.5, bottom: -100, top: y + h, climbable: false });
  }

  return {
    colliders,
    solids,
    horizonColor,
    sky,                                     // handles the storm recolours
    // collecting all ten wakes the boss; the level is won by beating it
    pebbleSpots: PEBBLES.map((p) => ({ x: p.x, z: p.z, y: terrainHeight(p.x, p.z) + p.up + 0.6, hint: p.hint })),
    spawn: { x: 0, z: -32, yaw: 0 },
    enemies: { kind: 'tarantula', count: 0 }, // no small ones (a level that says nothing gets six)
    boss: { x: 0, z: 0, health: 6, scale: 5, hidden: true }, // under the sand until the tenth pebble
    update() {},
  };
}
