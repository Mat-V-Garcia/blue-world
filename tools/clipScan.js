// Dev-only helper: find places where the lizard can stand INSIDE a prop.
// Run from the browser console while `npm run dev` is up:
//   (await import('/tools/clipScan.js')).scan('/src/levels/yard.js')
// It builds the level into a throwaway scene and, on a 0.25 grid over the play area,
// at the ground and at every collider top the lizard could stand on, reports each mesh
// that contains a point 0.12 or 0.35 above that standing height.
// One line per mesh: geometry type @ world position, hit count, standing heights.
// Some reported spots can't actually be reached (e.g. the top of a non-climbable post);
// check before fixing.
import * as THREE from 'three';
import { Player } from '/src/player.js';
import { footprint, clampToWorld, terrainHeight } from '/src/world.js';

export async function scan(levelPath, { step = 0.25, reach = 80 } = {}) {
  const level = await import(/* @vite-ignore */ levelPath);
  const scene = new THREE.Scene();
  const world = await level.build(scene);
  scene.updateMatrixWorld(true);

  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const t = o.geometry.type, p = o.geometry.parameters || {};
    if (t === 'PlaneGeometry' || t === 'CircleGeometry') return;       // ground, water, decals
    if ((p.radius ?? p.radiusTop ?? 0) > 100) return;                    // sky
    const box = new THREE.Box3().setFromObject(o);
    const c = box.getCenter(new THREE.Vector3());
    if (Math.hypot(c.x, c.z) > reach * 1.5) return;
    for (const m of [].concat(o.material)) m.side = THREE.DoubleSide;    // so rays see back faces
    meshes.push({ o, t, box, open: !!p.openEnded });
  });

  // inside a closed mesh = a ray from the point crosses its surface an odd number of times
  const ray = new THREE.Raycaster();
  const up = new THREE.Vector3(0.0131, 1, 0.0077).normalize(); // slightly off-axis: avoids edges
  const inside = (m, pt) => {
    if (!m.box.containsPoint(pt)) return false;
    ray.set(pt, up); ray.far = 500;
    const hits = ray.intersectObject(m.o, false);
    if (m.open) return hits.length > 0 && hits[0].distance < 0.05; // thin shells: only if touching
    return hits.length % 2 === 1;
  };

  const player = new Player(world.colliders);
  const found = new Map();
  const pt = new THREE.Vector3();
  for (let x = -reach; x <= reach; x += step) for (let z = -reach; z <= reach; z += step) {
    const [cx, cz] = clampToWorld(x, z);
    if (cx !== x || cz !== z) continue;
    const g = terrainHeight(x, z);
    const heights = [g];
    for (const c of world.colliders) if (c.top < 40 && c.top > g && footprint(c, x, z).dist <= 0) heights.push(c.top);
    for (const y of heights) {
      player.pos.set(x, y, z);
      if (player.blocking(x, z)) continue;
      if (player.groundAt(x, z) > y) continue; // a low step here would lift the lizard: it never stands at y
      for (const dy of [0.12, 0.35]) {
        pt.set(x, y + dy, z);
        for (const m of meshes) {
          if (!inside(m, pt)) continue;
          const c = m.box.getCenter(new THREE.Vector3());
          const key = `${m.t} @ ${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)}`;
          const e = found.get(key) || { n: 0, ys: new Set() };
          e.n++; e.ys.add(y.toFixed(2)); found.set(key, e);
        }
      }
    }
  }
  return [...found].map(([k, e]) => `${k}  hits=${e.n}  standing at y=${[...e.ys].join('/')}`);
}
