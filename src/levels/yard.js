import * as THREE from 'three';
import { toon, loadTexture } from '../materials.js';
import { setGround, buildSky, rng } from '../world.js';

// Level 3 — The Back Yard: the family's own back yard on a tidy, sunny day.
// Same scale as the shops: the lizard is ~1.6 long, so a chair is a climb and the
// swing set is a tower. +z is the far end (the green house and its porch), -x is the
// white house, +x is the fence. Kittens live here: they can't be beaten, only scared
// (push-ups) or fooled (drop the tail).

const X0 = -24, X1 = 24, Z0 = -46.6, Z1 = 46;   // where the lizard can go
const PORCH_Z = 40, PORCH_H = 0.4;              // the porch deck is one step up
export function groundHeight(x, z) { return z >= PORCH_Z ? PORCH_H : 0; }

// Small drawn textures, so the yard doesn't need image files yet.
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}
// clean painted boards: horizontal (clapboard) or vertical (fence)
const boards = (base, line, vertical) => (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.strokeStyle = line; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    const p = (i / 4) * (vertical ? w : h);
    g.beginPath();
    if (vertical) { g.moveTo(p, 0); g.lineTo(p, h); } else { g.moveTo(0, p); g.lineTo(w, p); }
    g.stroke();
  }
};
const speckle = (base, dots, n) => (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const r = rng(7);
  for (let i = 0; i < n; i++) {
    g.fillStyle = dots[i % dots.length];
    g.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3);
  }
};

export async function build(scene) {
  setGround({ height: groundHeight, radius: 60, bounds: { x0: X0, x1: X1, z0: Z0, z1: Z1 } });
  const skyTex = await loadTexture('sky.jpg');
  const horizonColor = await buildSky(scene, skyTex);
  const rand = rng(23);
  const colliders = [], solids = [];
  const add = (m, solid = true) => { m.traverse?.((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(m); if (solid) solids.push(m); return m; };
  const boxCol = (x, z, hx, hz, bottom, top, climbable, angle = 0) => colliders.push({ type: 'box', x, z, hx, hz, angle, bottom, top, climbable });
  const circCol = (x, z, r, bottom, top, climbable, rAt) => colliders.push({ type: 'circle', x, z, r, bottom, top, climbable, ...(rAt && { rAt }) });
  // box mesh sitting on y0..y1
  const box = (w, h, d, mat, x, y0, z, solid = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y0 + h / 2, z);
    return add(m, solid);
  };
  const cyl = (rt, rb, h, mat, x, y0, z, solid = true, seg = 14) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y0 + h / 2, z);
    return add(m, solid);
  };
  // local (lx, lz) of something turned by rot about (x, z) -> world
  const at = (x, z, rot, lx, lz) => [x + lx * Math.cos(rot) + lz * Math.sin(rot), z - lx * Math.sin(rot) + lz * Math.cos(rot)];

  const white = toon(0xfbf9f4), cream = toon(0xf3ead8), wood = toon(0xa9744a), darkWood = toon(0x7d5234);
  const iron = toon(0xf4f4f0), metal = toon(0x5b4a40), terracotta = toon(0xc4673f), leaf = toon(0x3f8a3c);

  // ---------- Ground: striped patio, concrete path, lawn ----------
  const flat = (x0, x1, z0, z1, mat, y = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = true; scene.add(m);
    return m;
  };
  // patio: pale concrete with curved terracotta-brick bands sweeping across it
  const patioTex = canvasTex(512, 1024, (g, w, h) => {
    speckle('#e9e4da', ['#dfd9cd', '#f1ede5'], 900)(g, w, h);
    g.strokeStyle = '#c9785a'; g.lineWidth = 26;
    for (let r = 240; r < 1400; r += 235) { g.beginPath(); g.arc(-60, h + 80, r, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = '#b5654a'; g.lineWidth = 2; // brick joints
    for (let r = 240; r < 1400; r += 235) for (let a = -1.6; a < 0.1; a += 34 / r) {
      g.beginPath(); g.moveTo(-60 + Math.cos(a) * (r - 13), h + 80 + Math.sin(a) * (r - 13)); g.lineTo(-60 + Math.cos(a) * (r + 13), h + 80 + Math.sin(a) * (r + 13)); g.stroke();
    }
  });
  flat(X0, -5, -48, PORCH_Z, toon(0xffffff, { map: patioTex }));
  flat(-5, 0, -48, PORCH_Z, toon(0xffffff, { map: canvasTex(128, 128, speckle('#dcd8cf', ['#d2cec4', '#e6e2da'], 260), 1, 16) }));
  flat(0, X1, -48, PORCH_Z, toon(0xffffff, { map: canvasTex(128, 128, speckle('#6fb04f', ['#63a546', '#7aba58', '#69aa4a'], 500), 8, 28) }));
  flat(12, 20, -34.5, -25.5, toon(0xe4dfd4), 0.02); // little paved pad under the bench

  // ---------- The white house (left) ----------
  box(3, 14, 96, toon(0xffffff, { map: canvasTex(64, 64, boards('#fbfaf6', '#e3e0d8', false), 1, 14) }), -25.5, 0, 0);
  boxCol(-25.5, 0, 1.5, 48, -100, 14, false);
  box(4, 0.5, 96, toon(0x8d9299), -25, 14, 0, false); // eave
  for (const wz of [-22, 12]) { // windows: white frames, blue glass
    box(0.12, 6.4, 7.4, white, -23.95, 3.2, wz, false);
    box(0.14, 5.6, 3.1, toon(0x8fb9d6), -23.93, 3.6, wz - 1.75, false);
    box(0.14, 5.6, 3.1, toon(0x8fb9d6), -23.93, 3.6, wz + 1.75, false);
  }

  // ---------- The fence (right): white boards, wide enough to walk along the top ----------
  const FENCE_H = 6;
  box(1, FENCE_H, 96, toon(0xffffff, { map: canvasTex(64, 64, boards('#fbfaf6', '#dedbd2', true), 60, 1) }), 23.5, 0, 0);
  boxCol(23.5, 0, 0.5, 48, -100, FENCE_H, true);

  // ---------- Near end: brick edging and a clipped hedge ----------
  box(48, 0.3, 0.6, terracotta, 0, 0, -46.3);
  boxCol(0, -46.3, 24, 0.3, -100, 0.3, false);
  box(48, 2.8, 1.4, toon(0x4c8a3f), 0, 0, -47.3);
  boxCol(0, -47.3, 24, 0.7, -100, 2.8, false);

  // ---------- Far end: the green house and its porch ----------
  const green = toon(0xb7e08a), orange = toon(0xe58a3c);
  box(48, PORCH_H, 8, toon(0xc79a6b), 0, 0, 44);            // porch deck (ground height does the step)
  box(52, 12, 2, toon(0xffffff, { map: canvasTex(64, 64, boards('#b9e290', '#a3cf7a', false), 1, 12) }), 0, 0, 47);
  boxCol(0, 47, 26, 1, -100, 12, false);
  box(52.4, 0.6, 2.4, orange, 0, 12, 47, false);            // trim band under the gable
  const gable = new THREE.Shape([new THREE.Vector2(-26.5, 0), new THREE.Vector2(26.5, 0), new THREE.Vector2(0, 9)]);
  const gableMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 2, bevelEnabled: false }), green);
  gableMesh.position.set(0, 12.6, 46); add(gableMesh, false);
  for (const s of [-1, 1]) { // orange barge boards along the roof edges
    const edge = new THREE.Mesh(new THREE.BoxGeometry(28.3, 0.7, 2.6), orange);
    edge.position.set(s * 13.25, 17.3, 47); edge.rotation.z = -s * Math.atan2(9, 26.5);
    add(edge, false);
  }
  // French doors and two windows on the house front
  box(8.4, 7.6, 0.12, white, 0, PORCH_H, 45.95, false);
  for (const dx of [-2.05, 2.05]) box(3.5, 6.6, 0.14, toon(0x9cc3dc), dx, PORCH_H + 0.5, 45.93, false);
  for (const wx of [-14, 14]) { box(6, 4.6, 0.12, white, wx, 3.2, 45.95, false); box(5.2, 3.8, 0.14, toon(0x9cc3dc), wx, 3.6, 45.93, false); }
  // porch roof on four painted posts, with lattice under the front edge
  box(31, 0.4, 6.4, toon(0xc9703a), 0, 8.6, 43.2);
  boxCol(0, 43.2, 15.5, 3.2, 8.6, 9.0, false);
  for (const px of [-14.5, -5, 5, 14.5]) {
    box(0.6, 8.6 - PORCH_H, 0.6, orange, px, PORCH_H, 40.5);
    boxCol(px, 40.5, 0.3, 0.3, -100, 8.6, false); // smooth painted posts
  }
  const lattice = canvasTex(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64); g.strokeStyle = '#d9a06a'; g.lineWidth = 7;
    for (let i = -64; i <= 64; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
  }, 22, 1);
  const lat = new THREE.Mesh(new THREE.PlaneGeometry(29, 1.3), new THREE.MeshBasicMaterial({ map: lattice, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
  lat.position.set(0, 7.95, 40.5); scene.add(lat);
  // neat potted plants on the porch
  const pot = (x, z, r, h, plantR, base = groundHeight(x, z)) => {
    cyl(r, r * 0.75, h, terracotta, x, base, z);
    const p = add(new THREE.Mesh(new THREE.SphereGeometry(plantR, 12, 10), leaf));
    p.position.set(x, base + h + plantR * 0.7, z);
    circCol(x, z, Math.max(r, plantR), -100, base + h + plantR * 1.7, false);
  };
  pot(-9, 43.6, 0.75, 1.2, 0.95); pot(9, 43.6, 0.75, 1.2, 0.95); pot(19, 44, 0.9, 1.4, 1.1);

  // ---------- Gazebo on the patio (clean cream canopy) ----------
  const GX = -14, GZ = 0, GH = 6, EAVE = 8.4, RISE = 2.5;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.5, EAVE, 0.5, metal, GX + sx * GH, 0, GZ + sz * GH);
    boxCol(GX + sx * GH, GZ + sz * GH, 0.25, 0.25, -100, EAVE, true);
  }
  for (const s of [-1, 1]) {
    box(GH * 2 + 0.5, 0.4, 0.4, metal, GX, EAVE - 0.4, GZ + s * GH, false);
    box(0.4, 0.4, GH * 2 + 0.5, metal, GX + s * GH, EAVE - 0.4, GZ, false);
  }
  const HALF = GH + 0.5;
  const canopy = add(new THREE.Mesh(new THREE.ConeGeometry(HALF * Math.SQRT2, RISE, 4, 1, true), toon(0xf6eedd, { side: THREE.DoubleSide })));
  canopy.rotation.y = Math.PI / 4; canopy.position.set(GX, EAVE + RISE / 2, GZ);
  // walkable roof: square steps that follow the slope of the canopy up to the peak
  const TIERS = 14;
  let gazeboTop = EAVE;
  for (let i = 0; i < TIERS; i++) {
    gazeboTop = EAVE + RISE * (i + 0.5) / TIERS;
    const h = HALF * (1 - i / TIERS);
    boxCol(GX, GZ, h, h, gazeboTop - 0.1, gazeboTop, true);
  }

  // ---------- Patio furniture ----------
  // low table under the gazebo: the lizard fits underneath, a kitten doesn't
  const TX = -14, TZ = 0, TTOP = 1.25;
  box(3.2, 0.25, 2.2, darkWood, TX, 1.0, TZ);
  boxCol(TX, TZ, 1.6, 1.1, 1.0, TTOP, true);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.2, 1.0, 0.2, darkWood, TX + sx * 1.4, 0, TZ + sz * 0.9);
    boxCol(TX + sx * 1.4, TZ + sz * 0.9, 0.1, 0.1, -100, 1.0, false);
  }
  cyl(0.5, 0.42, 0.06, toon(0xdfe9a8), TX + 0.5, TTOP, TZ - 0.2, false, 18);        // plate
  cyl(0.24, 0.2, 0.5, toon(0xd8433a), TX + 0.95, TTOP, TZ + 0.45, true, 12);       // red cup
  circCol(TX + 0.95, TZ + 0.45, 0.24, TTOP, TTOP + 0.5, false);

  const chair = (x, z, rot) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.25, 2), wood); seat.position.y = 1.125;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 0.25), wood); back.position.set(0, 2.35, -0.875);
    g.add(seat, back);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 0.2), wood); leg.position.set(sx * 0.85, 0.5, sz * 0.85); g.add(leg);
      boxCol(...at(x, z, rot, sx * 0.85, sz * 0.85), 0.1, 0.1, -100, 1.0, false, rot);
    }
    add(g);
    boxCol(x, z, 1, 1, 1.0, 1.25, true, rot);
    boxCol(...at(x, z, rot, 0, -0.875), 1, 0.125, 1.25, 3.45, true, rot);
  };
  chair(-20, -38, Math.PI * 0.25); chair(-16.5, -40, -Math.PI * 0.2);

  // big grey exercise ball: round, smooth, walk around it
  const BR = 1.8, BX = -19.5, BZ = -32.5;
  const ball = add(new THREE.Mesh(new THREE.SphereGeometry(BR, 20, 14), toon(0x8b9099)));
  ball.position.set(BX, BR, BZ);
  circCol(BX, BZ, BR, -100, BR * 2, false, (y) => Math.sqrt(Math.max(0.04, BR * BR - (y - BR) * (y - BR))));

  // white planter urn with a tidy shrub
  cyl(1.0, 0.55, 2.2, white, -22, 0, -43, true, 16);
  cyl(0.75, 0.75, 0.25, white, -22, 0, -43, false, 16);
  const shrub = add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), leaf)); shrub.position.set(-22, 3.0, -43);
  circCol(-22, -43, 1.1, -100, 4.1, false);

  // wicker plant stand by the path
  cyl(0.9, 0.8, 1.8, toon(0xd9d2c0), -6.6, 0, -30, true, 12);
  const fern = add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 10), leaf)); fern.scale.y = 0.7; fern.position.set(-6.6, 2.4, -30);
  circCol(-6.6, -30, 1.0, -100, 3.1, false);

  // hanging hammock chair on its stand, against the white house
  const HX = -21, HZ = 18;
  box(0.4, 0.2, 3.4, metal, HX, 0, HZ);                      // foot bar (low enough to step over)
  boxCol(HX, HZ, 0.2, 1.7, -100, 0.2, false);
  box(0.36, 7.4, 0.36, metal, HX - 1.6, 0, HZ);              // upright
  boxCol(HX - 1.6, HZ, 0.18, 0.18, -100, 7.4, false);
  box(2.6, 0.3, 0.3, metal, HX - 0.5, 7.1, HZ, false);       // arm
  cyl(0.03, 0.03, 2.9, cream, HX + 0.5, 4.2, HZ, false, 5); // rope
  const pod = add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), cream));
  pod.scale.set(1.3, 1.5, 1.2); pod.position.set(HX + 0.5, 2.7, HZ);
  boxCol(HX + 0.5, HZ, 1.3, 1.2, 1.2, 4.2, false);

  // ---------- Lemon tree ----------
  const LX = 9, LZ = 33, LCY = 8, LTOP = LCY + 3.4;
  cyl(0.4, 0.55, 5.6, toon(0x77573a), LX, 0, LZ, true, 8);
  circCol(LX, LZ, 0.55, -100, LTOP, true); // climb the trunk right up through the leaves
  const crown = add(new THREE.Mesh(new THREE.SphereGeometry(4, 18, 14), toon(0x3c8436)));
  crown.scale.y = 0.85; crown.position.set(LX, LCY, LZ);
  // ...and out onto the top: shallow steps that follow the dome of leaves
  for (const [r, drop] of [[1.2, 0], [2.0, 0.25], [2.7, 0.55], [3.2, 0.9]]) circCol(LX, LZ, r, LTOP - drop - 0.1, LTOP - drop, true);
  const lemon = toon(0xf6d93a);
  for (let i = 0; i < 22; i++) {
    const a = rand() * Math.PI * 2, e = rand() * 1.0 - 0.45;
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), lemon);
    l.scale.set(0.85, 1.1, 0.85);
    l.position.set(LX + Math.cos(a) * 3.9 * Math.cos(e), LCY + Math.sin(e) * 3.3, LZ + Math.sin(a) * 3.9 * Math.cos(e));
    add(l, false);
  }

  // ---------- Closed patio umbrella on its base ----------
  cyl(1.0, 1.1, 0.35, toon(0xe9e4da), 3.5, 0, 27, true, 16);
  circCol(3.5, 27, 1.05, -100, 0.35, false);
  cyl(0.12, 0.12, 9.4, metal, 3.5, 0.35, 27, false, 8);
  cyl(0.2, 0.55, 5.2, toon(0x7a5a48), 3.5, 4.2, 27, true, 10);
  circCol(3.5, 27, 0.55, -100, 9.75, false);

  // ---------- Playhouse on legs, with a ladder and a slide ----------
  const PX = 12, PZ = 22, DECK = 4.0, PROOF = 7.9;
  box(6, 0.25, 6, white, PX, DECK - 0.25, PZ);
  boxCol(PX, PZ, 3, 3, DECK - 0.25, DECK, true);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.5, DECK - 0.25, 0.5, white, PX + sx * 2.75, 0, PZ + sz * 2.75);
    boxCol(PX + sx * 2.75, PZ + sz * 2.75, 0.25, 0.25, -100, DECK - 0.25, false);
  }
  // low shelf between the legs: a crawl space only a lizard fits under
  box(5, 0.2, 5, toon(0xe9e4da), PX, 0.8, PZ);
  boxCol(PX, PZ, 2.5, 2.5, 0.8, 1.0, true);
  // little house on the deck: three walls and a roof, open toward the ladder
  const wallMat = toon(0xfdfcf8);
  box(6, PROOF - 0.4 - DECK, 0.3, wallMat, PX, DECK, PZ + 2.85);
  boxCol(PX, PZ + 2.85, 3, 0.15, DECK, PROOF, false);
  for (const s of [-1, 1]) {
    // the fence-side wall is short, leaving a doorway onto the slide
    const len = s > 0 ? 2.0 : 5.2, wz = PZ + 3 - len / 2;
    box(0.3, PROOF - 0.4 - DECK, len, wallMat, PX + s * 2.85, DECK, wz);
    boxCol(PX + s * 2.85, wz, 0.15, len / 2, DECK, PROOF, false);
  }
  box(6.6, 0.4, 6.2, toon(0x63b57a), PX, PROOF - 0.4, PZ + 0.2);
  boxCol(PX, PZ + 0.2, 3.3, 3.1, PROOF - 0.4, PROOF, false);
  // ladder up the open side
  for (const s of [-1, 1]) box(0.2, DECK, 0.3, white, PX + s * 0.9, 0, PZ - 3.2);
  for (let y = 0.7; y < DECK; y += 0.8) box(1.8, 0.16, 0.24, white, PX, y, PZ - 3.2, false);
  boxCol(PX, PZ - 3.2, 1.0, 0.15, -100, DECK, true);
  // slide down the fence side: a chunky green wedge. A way down only: it is too steep and
  // slippery to walk up (the ladder is the way up).
  const SL = 6.5, SW = 1.6, SX0 = PX + 3;
  const wedge = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(SL, 0), new THREE.Vector2(0, DECK)]);
  const slide = add(new THREE.Mesh(new THREE.ExtrudeGeometry(wedge, { depth: SW, bevelEnabled: false }), toon(0x4fae6a)));
  slide.position.set(SX0, 0, PZ - SW / 2);
  const STEPS = 16; // small steps that follow the slope (each well under the lizard's step height)
  for (let i = 0; i < STEPS; i++) {
    const w = SL / STEPS;
    boxCol(SX0 + (i + 0.5) * w, PZ, w / 2, SW / 2, -100, DECK * (1 - (i + 0.5) / STEPS), false);
  }

  // ---------- Swing set: white A-frame, two swings and the green glider ----------
  const WX = 14, WZ = 0, BEAM = 9, SPREAD = 3.2, WHALF = 7;
  box(0.4, 0.4, WHALF * 2 + 0.6, white, WX, BEAM - 0.2, WZ, false);
  const legLen = Math.hypot(SPREAD, BEAM), lean = Math.atan2(SPREAD, BEAM);
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, legLen, 0.4), white);
    leg.position.set(WX + sx * SPREAD / 2, BEAM / 2, WZ + sz * WHALF); leg.rotation.z = sx * lean;
    add(leg);
    // the leg leans, so its collider is a short stack that steps inward as it rises
    for (let k = 0; k < 4; k++) {
      const y0 = k * 1.5, mid = (y0 + 0.75) / BEAM;
      boxCol(WX + sx * SPREAD * (1 - mid), WZ + sz * WHALF, 0.32, 0.25, k ? y0 : -100, y0 + 1.5, false);
    }
  }
  const chain = toon(0x9aa0a8);
  const SEAT = 1.35;
  const swing = (z) => {
    box(1.6, 0.15, 0.6, toon(0xd8433a), WX, SEAT - 0.15, z);
    boxCol(WX, z, 0.8, 0.3, SEAT - 0.15, SEAT, true);
    for (const s of [-1, 1]) cyl(0.04, 0.04, BEAM - 0.4 - SEAT, chain, WX + s * 0.7, SEAT, z, false, 5);
  };
  swing(WZ - 4); swing(WZ - 0.8);
  // glider: two little seats facing each other
  const GLZ = WZ + 3.8, glider = toon(0x2f9a6b);
  box(1.3, 0.25, 2.8, glider, WX, 1.0, GLZ);
  for (const s of [-1, 1]) box(1.3, 1.1, 0.25, glider, WX, 1.25, GLZ + s * 1.27);
  boxCol(WX, GLZ, 0.65, 1.4, 1.0, 2.35, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.04, 0.04, BEAM - 0.4 - 2.35, chain, WX + sx * 0.55, 2.35, GLZ + sz * 1.27, false, 5);

  // ---------- Green ride-on toy on the lawn ----------
  const RX = 4.5, RZ = 9;
  box(1.5, 0.9, 2.4, toon(0x58b860), RX, 0.4, RZ);
  box(1.1, 0.5, 0.9, toon(0x58b860), RX, 1.3, RZ - 0.6);
  box(1.3, 0.2, 0.2, toon(0x333a3f), RX, 1.9, RZ + 0.8, false);
  box(0.16, 0.7, 0.16, toon(0x333a3f), RX, 1.3, RZ + 0.8, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), toon(0x333a3f)), false);
    w.rotation.z = Math.PI / 2; w.position.set(RX + sx * 0.8, 0.42, RZ + sz * 0.8);
  }
  boxCol(RX, RZ, 0.95, 1.2, -100, 1.3, false);
  boxCol(RX, RZ - 0.6, 0.55, 0.45, 1.3, 1.8, false);

  // ---------- Wagon wheel leaning on the fence, and a sunburst ornament ----------
  const KX = 22.75, KZ = 4, KR = 2.4, KTOP = KR * 2 + 0.2;
  const rim = add(new THREE.Mesh(new THREE.TorusGeometry(KR, 0.2, 8, 28), white));
  rim.rotation.y = Math.PI / 2; rim.position.set(KX, KR + 0.2, KZ);
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.12, KR * 2, 0.14), white);
    sp.position.set(KX, KR + 0.2, KZ); sp.rotation.x = (i / 6) * Math.PI; add(sp, false);
  }
  const hub = add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), white), false);
  hub.rotation.z = Math.PI / 2; hub.position.set(KX, KR + 0.2, KZ);
  boxCol(KX, KZ, 0.25, 1.3, -100, KTOP, true);
  // the rim curves down either side of the top: lower steps cover the rest of the wheel
  for (const s of [-1, 1]) {
    boxCol(KX, KZ + s * 1.65, 0.25, 0.35, -100, KTOP - 0.75, true);
    boxCol(KX, KZ + s * 2.3, 0.25, 0.3, -100, KTOP - 1.7, true);
  }
  const sun = add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.08, 16), toon(0x6d7b85)), false);
  sun.rotation.z = Math.PI / 2; sun.position.set(22.96, 4.2, -9);

  // ---------- Shed, mailbox, snake plants, bench, bike (near right corner) ----------
  const SHX = 18, SHZ = -41, SHTOP = 6.9;
  box(8, SHTOP - 0.4, 7, toon(0xffffff, { map: canvasTex(64, 64, boards('#cfe6cf', '#b9d6ba', true), 8, 1) }), SHX, 0, SHZ);
  box(8.3, 0.4, 7.3, toon(0xeef3ee), SHX, SHTOP - 0.4, SHZ);
  boxCol(SHX, SHZ, 4, 3.5, -100, SHTOP, true);
  box(0.1, 5, 2.6, white, SHX - 4.03, 0, SHZ, false);                 // door
  box(0.12, 0.3, 0.3, toon(0x6d7b85), SHX - 4.1, 2.4, SHZ + 0.9, false); // handle
  // mailbox on a post
  const MX = 12.2, MZ = -36.2;
  box(0.36, 3.2, 0.36, white, MX, 0, MZ);
  box(0.9, 0.9, 1.7, white, MX, 3.2, MZ);
  boxCol(MX, MZ, 0.45, 0.85, -100, 4.1, false);
  box(0.06, 0.5, 0.4, toon(0xd8433a), MX + 0.48, 3.8, MZ + 0.4, false); // little red flag
  // snake plants in terracotta pots on stools, lined up along the fence
  const snakePlant = (x, z, stool) => {
    let y = 0;
    if (stool) { box(1.3, stool, 1.3, darkWood, x, 0, z); y = stool; }
    cyl(0.6, 0.45, 1.0, terracotta, x, y, z, true, 12);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, h = 2.2 + rand() * 1.2;
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.2, h, 4), toon(i % 2 ? 0x3f7f46 : 0x5aa055));
      blade.scale.z = 0.35; blade.rotation.y = a;
      blade.position.set(x + Math.cos(a) * 0.22, y + 1.0 + h / 2, z - Math.sin(a) * 0.22);
      add(blade, false);
    }
    const half = stool ? 0.65 : 0.6;
    boxCol(x, z, half, half, -100, y + 4.4, false);
  };
  snakePlant(21.6, -27, 1.0); snakePlant(21.6, -23.5, 0); snakePlant(21.6, -14.5, 1.4); snakePlant(21.6, -11, 0);
  // white wrought-iron bench with blue cushions, facing the path
  const bench = (x, z, rot) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
    const blue = toon(0x8fc0de);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.6, 2), blue); seat.position.y = 1.2;
    const back = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.9, 0.5), blue); back.position.set(0, 2.45, -0.75);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.12, 2.2), iron); frame.position.y = 0.86;
    g.add(seat, back, frame);
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 2.1), iron); arm.position.set(sx * 2.7, 1.95, 0); g.add(arm);
      boxCol(...at(x, z, rot, sx * 2.7, 0), 0.125, 1.05, 1.5, 2.4, true, rot);
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), iron); leg.position.set(sx * 2.6, 0.4, sz * 0.9); g.add(leg);
        boxCol(...at(x, z, rot, sx * 2.6, sz * 0.9), 0.1, 0.1, -100, 0.8, false, rot);
      }
    }
    add(g);
    boxCol(x, z, 2.8, 1.1, 0.8, 1.5, true, rot);
    boxCol(...at(x, z, rot, 0, -0.75), 2.6, 0.25, 1.5, 3.4, true, rot);
  };
  bench(16, -30, -Math.PI / 2);
  // child's bike parked by the hedge
  const bike = new THREE.Group(); bike.position.set(8, 0, -44.6); bike.rotation.y = Math.PI / 2;
  for (const s of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.14, 8, 20), white); wheel.rotation.y = Math.PI / 2; wheel.position.set(0, 1.14, s * 1.5);
    bike.add(wheel);
  }
  const purple = toon(0xb48ad8);
  const bar = (w, h, d, x, y, z, rx = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), purple); m.position.set(x, y, z); m.rotation.x = rx; bike.add(m); };
  bar(0.16, 0.16, 3.0, 0, 1.6, 0); bar(0.16, 1.6, 0.16, 0, 2.2, 1.4); bar(0.16, 1.3, 0.16, 0, 2.0, -0.6);
  bar(1.3, 0.14, 0.14, 0, 3.0, 1.4); bar(0.5, 0.2, 0.9, 0, 2.7, -0.6);
  add(bike);
  boxCol(8, -44.6, 2.6, 0.3, -100, 3.0, false);

  // ---------- Beyond the yard: neighbours' roofs and trees ----------
  const far = toon(0x4c8a3f);
  for (let i = 0; i < 26; i++) {
    const side = i % 3; // 0: past the fence, 1: past the hedge, 2: behind the houses
    const along = -70 + rand() * 140, out = 12 + rand() * 40;
    const [x, z] = side === 0 ? [X1 + out, along] : side === 1 ? [along, -48 - out] : [along, 52 + out];
    if (i % 2) {
      const w = 14 + rand() * 10, h = 9 + rand() * 6;
      const hs = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.8), toon([0xf3e6cf, 0xe8d9d0, 0xdbe6ee, 0xf1e0b8][i % 4]));
      hs.position.set(x, h / 2, z); scene.add(hs);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.8, 4.5, 4), toon(0xa85f45));
      roof.rotation.y = Math.PI / 4; roof.position.set(x, h + 2.25, z); scene.add(roof);
    } else {
      const t = new THREE.Mesh(new THREE.SphereGeometry(5 + rand() * 4, 10, 8), far);
      t.position.set(x, 6 + rand() * 5, z); scene.add(t);
    }
  }

  // ---------- Pebbles ----------
  const pebbleSpots = [
    { x: GX, z: GZ, y: gazeboTop + 0.6, hint: 'On the gazebo roof' },
    { x: PX, z: PZ + 1, y: DECK + 0.6, hint: 'Up in the playhouse' },
    { x: WX, z: WZ - 4, y: SEAT + 0.6, hint: 'On the swing' },
    { x: LX, z: LZ, y: LTOP + 0.6, hint: 'Top of the lemon tree' },
    { x: 21.4, z: -19, y: 0.55, hint: 'Among the snake plants' },
    { x: KX, z: KZ, y: KTOP + 0.6, hint: 'On the wagon wheel' },
    { x: 16, z: -30, y: 0.45, hint: 'Under the bench' },
    { x: SHX, z: SHZ, y: SHTOP + 0.6, hint: 'On the shed roof' },
    { x: TX - 0.9, z: TZ + 0.2, y: TTOP + 0.6, hint: 'On the patio table' },
    { x: 23.5, z: 14, y: FENCE_H + 0.6, hint: 'Along the fence top' },
  ];

  return {
    colliders,
    solids,
    horizonColor,
    pebbleSpots,
    spawn: { x: -2.5, z: -42, yaw: 0 }, // on the path, looking up the yard to the porch
    enemies: {
      kind: 'kitten', defeatable: false, scareable: true,
      homes: [[-2.5, -10], [-15, -18], [-11, 24], [6, -12], [7, 14], [-2.5, 31], [19.5, -8], [-18, 34]],
      edgeMargin: 0.7, // walls all round: kittens must be able to reach the edges
      count: 5, chaseSpeed: 6, wanderSpeed: 1.6, notice: 9, radius: 0.7, height: 1.1,
    },
    update() {},
  };
}
