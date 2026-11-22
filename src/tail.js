import * as THREE from 'three';
import { toon } from './materials.js';

// The fence lizard's escape trick: drop the tail. It stays behind wriggling (enemies go
// for it instead of the lizard) and a new one grows back a while later.
const WRIGGLE = 6;    // seconds the dropped tail keeps moving
const REGROW = 30;    // seconds from the drop until the tail is back
const GROW = 4;       // ...the last few of which it visibly grows

// groundAt(x, z, y): height of the surface below the point (so a tail dropped while
// climbing or jumping lands on whatever is underneath).
export function createTailDrop(scene, groundAt) {
  // the dropped piece: a tapered chain of segments, each one swinging on the last
  const piece = new THREE.Group();
  const segs = [];
  const mats = [toon(0x8a7a66, { transparent: true }), toon(0x5d5044, { transparent: true })];
  let parent = piece, r = 0.07;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Group();
    seg.position.z = i === 0 ? 0 : -0.14;
    const nr = r * 0.72;
    const geo = new THREE.CylinderGeometry(nr, r, 0.14, 7);
    geo.rotateX(Math.PI / 2); geo.translate(0, 0, -0.07);
    const mesh = new THREE.Mesh(geo, mats[i % 2]);
    mesh.castShadow = true;
    seg.add(mesh); parent.add(seg); segs.push(seg);
    parent = seg; r = nr;
  }

  let since = Infinity; // seconds since the drop (Infinity = tail is on)
  let shown = false;
  const hide = () => { if (shown) { scene.remove(piece); shown = false; } };

  const tail = {
    ready: true,
    grown: 1,     // 0 = no tail, 1 = full tail (drives how the lizard is drawn)
    pos: null,    // where the dropped tail is while it wriggles
    drop(pos, yaw) {
      if (!tail.ready) return false;
      tail.ready = false; tail.grown = 0; since = 0;
      tail.pos = new THREE.Vector3(pos.x, groundAt(pos.x, pos.z, pos.y), pos.z);
      piece.position.copy(tail.pos); piece.position.y += 0.07;
      piece.rotation.y = yaw;
      mats.forEach((m) => { m.opacity = 1; });
      scene.add(piece); shown = true;
      return true;
    },
    update(dt) {
      if (tail.ready) return;
      since += dt;
      if (since < WRIGGLE) {
        const wild = 1 - (since / WRIGGLE) * 0.6; // thrashes hard at first, then tires
        segs.forEach((s, i) => { s.rotation.y = Math.sin(since * 22 - i * 0.9) * 0.55 * wild; });
        mats.forEach((m) => { m.opacity = Math.min(1, WRIGGLE - since); }); // fade over the last second
      } else if (tail.pos) {
        tail.pos = null; hide();
      }
      tail.grown = Math.min(1, Math.max(0, (since - (REGROW - GROW)) / GROW));
      if (since >= REGROW) { tail.ready = true; tail.grown = 1; since = Infinity; }
    },
    reset() {
      tail.ready = true; tail.grown = 1; tail.pos = null; since = Infinity; hide();
    },
  };
  return tail;
}
