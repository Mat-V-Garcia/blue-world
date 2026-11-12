import * as THREE from 'three';
import { toon, loadTexture, tiled } from '../materials.js';
import { setGround, buildSky, rng, footprint } from '../world.js';

// Level 2 — Fullerton Shops: a sunny Southern California outdoor shopping center
// (inspired by Fullerton, CA; all shop names are made up). Scale: the lizard is ~1.6
// long, so everything human-sized feels big — the "little lizard, big world" idea.

const RADIUS = 66;          // how far the lizard can roam
const CURB = 0.3;           // sidewalks are raised this much (an easy step up)

// Sidewalk / plaza areas [x0, x1, z0, z1]; everything else is parking-lot asphalt.
const SIDEWALKS = [
  [-48, 12, 0, 46],         // main plaza in front of the north shops
  [-62, -40, -32, 46],      // walk in front of the west shops
];
const onSidewalk = (x, z) => SIDEWALKS.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
export function groundHeight(x, z) { return onSidewalk(x, z) ? CURB : 0; }

// A drawn clock face for the tower
function clockTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c96f3e'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#fff8ea'; g.beginPath(); g.arc(128, 128, 100, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3a2a20'; g.lineWidth = 8; g.stroke();
  g.fillStyle = '#3a2a20';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath(); g.arc(128 + Math.sin(a) * 82, 128 - Math.cos(a) * 82, i % 3 ? 4 : 8, 0, Math.PI * 2); g.fill();
  }
  g.lineCap = 'round';
  g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 - 45, 128 - 30); g.stroke(); // 10
  g.lineWidth = 6; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 55, 128 - 45); g.stroke(); // :10
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Wire basket look for shopping carts (transparent grid)
function wireTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#d8dde4'; g.lineWidth = 4;
  for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 3); return t;
}

export async function build(scene) {
  setGround({ height: groundHeight, radius: RADIUS });
  const [asphaltTex, sidewalkTex, stuccoTex, shops1, shops2, skyTex] = await Promise.all([
    loadTexture('asphalt.jpg'), loadTexture('sidewalk.jpg'), loadTexture('stucco.jpg'),
    loadTexture('shops1.jpg'), loadTexture('shops2.jpg'), loadTexture('sky.jpg'),
  ]);
  const horizonColor = await buildSky(scene, skyTex);
  const rand = rng(11);
  const colliders = [], solids = [];
  const add = (m, solid = true) => { m.traverse?.((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(m); if (solid) solids.push(m); return m; };
  // Box collider helper (axis-aligned unless angle given)
  const boxCol = (x, z, hx, hz, bottom, top, climbable, angle = 0) => colliders.push({ type: 'box', x, z, hx, hz, angle, bottom, top, climbable });
  const circCol = (x, z, r, bottom, top, climbable) => colliders.push({ type: 'circle', x, z, r, bottom, top, climbable });

  // ---------- Ground: asphalt lot + raised sidewalks with curbs ----------
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), toon(asphaltTex ? 0xffffff : 0x7b7d82, { map: tiled(asphaltTex, 30, 30) }));
  lot.rotation.x = -Math.PI / 2;
  lot.receiveShadow = true;
  scene.add(lot);
  const curbMat = toon(0xd9d2c4);
  for (const [x0, x1, z0, z1] of SIDEWALKS) {
    const w = x1 - x0, d = z1 - z0;
    const walk = new THREE.Mesh(new THREE.BoxGeometry(w, CURB, d), [curbMat, curbMat,
      toon(sidewalkTex ? 0xffffff : 0xe8dcc4, { map: tiled(sidewalkTex, w / 7, d / 7) }), curbMat, curbMat, curbMat]);
    walk.position.set(x0 + w / 2, CURB / 2, z0 + d / 2);
    walk.receiveShadow = true;
    scene.add(walk);
  }
  // Painted parking bays
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf4f1e8 });
  const bay = (x, z, len = 15) => {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.35, len), lineMat);
    l.rotation.x = -Math.PI / 2; l.position.set(x, 0.02, z); scene.add(l);
  };
  const rows = [{ z: -14, xs: [8, 60] }, { z: -38, xs: [8, 60] }, { z: -26, xs: [-38, -4] }, { z: 22, xs: [16, 60] }];
  for (const r of rows) for (let x = r.xs[0]; x <= r.xs[1]; x += 8) bay(x, r.z);

  // ---------- Shops (Magnific storefronts on the front faces) ----------
  const stucco = (rx, ry) => toon(stuccoTex ? 0xffffff : 0xf1e2c8, { map: tiled(stuccoTex, rx, ry) });
  const roofMat = toon(0xc7b9a3);
  const shopFront = (tex, fallback) => (tex ? new THREE.MeshBasicMaterial({ map: tex }) : toon(fallback));
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  const shop = (cx, cz, w, d, front, tex) => {
    const H = 14;
    const mats = [stucco(d / 6, H / 6), stucco(d / 6, H / 6), roofMat, roofMat, stucco(w / 6, H / 6), stucco(w / 6, H / 6)];
    mats[front] = shopFront(tex, 0xf4c9a0);
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, H, d), mats));
    m.position.set(cx, H / 2, cz);
    boxCol(cx, cz, w / 2, d / 2, -100, H, false); // glass + stucco: too smooth to climb
    // tiled roof trim along the front edge
    const trim = new THREE.Mesh(new THREE.BoxGeometry(front === 5 ? w + 0.6 : 1.2, 0.9, front === 5 ? 1.2 : d + 0.6), toon(0xb5532f));
    trim.position.set(front === 0 ? cx + w / 2 : cx, H + 0.2, front === 5 ? cz - d / 2 : cz);
    add(trim, false);
    return H;
  };
  // North row, facing the plaza (front = -z)
  const SH = shop(-34.5, 53, 25, 14, 5, shops1);
  shop(-9.5, 53, 25, 14, 5, shops2);
  // West row, facing east (front = +x)
  shop(-69, 21.5, 14, 25, 0, shops2);
  shop(-69, -3.5, 14, 25, 0, shops1);
  // Plain stucco corner block
  const corner = add(new THREE.Mesh(new THREE.BoxGeometry(14, 12, 14), stucco(2, 2)));
  corner.position.set(-69, 6, 53);
  boxCol(-69, 53, 7, 7, -100, 12, false);
  // Drainpipe up to the north roof (climbable!)
  const pipe = add(new THREE.Mesh(new THREE.BoxGeometry(0.6, SH, 0.6), toon(0x8c949c)));
  pipe.position.set(2.4, SH / 2, 45.7); // on the front wall, inside the roof edge (roof spans x -22..3)
  boxCol(2.4, 45.7, 0.3, 0.3, -100, SH, true);

  // ---------- Clock tower (the big climb) ----------
  const TX = -50, TZ = 38;
  const shaft = add(new THREE.Mesh(new THREE.BoxGeometry(6, 24, 6), stucco(1, 4)));
  shaft.position.set(TX, 12, TZ);
  boxCol(TX, TZ, 3, 3, -100, 24, true);
  const clockMat = new THREE.MeshBasicMaterial({ map: clockTexture() });
  const lantern = add(new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), [clockMat, clockMat, roofMat, roofMat, clockMat, clockMat]));
  lantern.position.set(TX, 26, TZ);
  boxCol(TX, TZ, 2, 2, 24, 28, false); // clock faces: the ledge below is as high as you go
  const spire = add(new THREE.Mesh(new THREE.ConeGeometry(3.3, 4, 4), toon(0xb5532f)));
  spire.position.set(TX, 30, TZ); spire.rotation.y = Math.PI / 4;
  circCol(TX, TZ, 2.3, 28, 32, false);

  // ---------- Fountain ----------
  const FX = -22, FZ = 14;
  const basin = add(new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.8, 1.0, 32), toon(0xe6d8c0)));
  basin.position.set(FX, CURB + 0.5, FZ);
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), new THREE.MeshStandardMaterial({ color: 0x4fb7e0, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2; water.position.set(FX, CURB + 1.01, FZ);
  scene.add(water);
  circCol(FX, FZ, 4.7, -100, CURB + 1.0, true);
  const column = add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 4.2, 16), toon(0xe6d8c0)));
  column.position.set(FX, CURB + 3.1, FZ);
  circCol(FX, FZ, 0.75, -100, CURB + 5.2, true);
  for (const [r, y] of [[1.4, 2.6], [0.9, 4.2]]) { // little decorative bowls (inside the column's reach)
    const bowl = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.4, 0.4, 20), toon(0xe6d8c0)), false);
    bowl.position.set(FX, CURB + y, FZ);
  }
  const cap = add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 0.3, 16), toon(0xd8c7a8)));
  cap.position.set(FX, CURB + 5.35, FZ);
  // water jets
  const jets = [];
  for (let i = 0; i < 6; i++) {
    const j = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.8 }));
    scene.add(j); jets.push({ m: j, a: (i / 6) * Math.PI * 2, t: i / 6 });
  }

  // ---------- Palms in planters ----------
  const palm = (x, z, h) => {
    const base = groundHeight(x, z);
    const pl = add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 3.2), toon(0xd7b48a)));
    pl.position.set(x, base + 0.65, z);
    boxCol(x, z, 1.6, 1.6, -100, base + 1.3, true);
    const trunk = add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, h, 10), toon(0x8a6b4a)));
    trunk.position.set(x, base + h / 2, z);
    circCol(x, z, 0.6, -100, base + h, true);
    const crown = new THREE.Group(); crown.position.set(x, base + h, z);
    for (let i = 0; i < 8; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.9, 6, 4), toon(0x4f8f3a));
      f.geometry.translate(0, 3, 0);
      f.rotation.set(0, (i / 8) * Math.PI * 2, 1.9 + (i % 2) * 0.25);
      crown.add(f);
    }
    add(crown, false);
    return base + h;
  };
  const palmTop = palm(-40, 30, 18);
  palm(-4, 30, 16); palm(8, 6, 17); palm(-54, -20, 15); palm(-54, 6, 18);

  // ---------- Orange tree (Fullerton's citrus history) ----------
  const OX = -32, OZ = 4;
  const ob = groundHeight(OX, OZ);
  const op = add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.3, 20), toon(0xd7b48a)));
  op.position.set(OX, ob + 0.65, OZ);
  circCol(OX, OZ, 2.6, -100, ob + 1.3, true);
  const ot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.0, 8), toon(0x6e5138)));
  ot.position.set(OX, ob + 2.6, OZ);
  circCol(OX, OZ, 0.5, -100, ob + 7.8, true); // climb the trunk right up through the leaves
  const canopy = add(new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), toon(0x3f7d34)));
  canopy.scale.set(1, 0.75, 1); canopy.position.set(OX, ob + 5.6, OZ);
  circCol(OX, OZ, 2.4, ob + 7.7, ob + 7.8, true); // ...and step out onto the top of the canopy
  const orangeMat = toon(0xf28a1e);
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, e = rand() * 1.2 - 0.3;
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), orangeMat);
    o.position.set(OX + Math.cos(a) * 3.1 * Math.cos(e), ob + 5.6 + Math.sin(e) * 2.3, OZ + Math.sin(a) * 3.1 * Math.cos(e));
    add(o, false);
  }

  // ---------- Café tables with umbrellas ----------
  const cafe = (x, z, color) => {
    const b = groundHeight(x, z);
    const top = add(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.25, 18), toon(0xf4f1ea)));
    top.position.set(x, b + 2.4, z);
    boxCol(x, z, 1.1, 1.1, b + 2.15, b + 2.55, true); // walk underneath, climb on top
    const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 2.3, 8), toon(0x55504a)), false);
    leg.position.set(x, b + 1.15, z);
    const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.8, 8), toon(0xdedad2)));
    pole.position.set(x, b + 4.45, z);
    // leg + pole are one column from the ground right up through the umbrella: climb it
    // and step out onto the top (or hop off onto the tabletop on the way)
    circCol(x, z, 0.3, -100, b + 7.2, true);
    const shade = add(new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.0, 12, 1, true), toon(color, { side: THREE.DoubleSide })));
    shade.position.set(x, b + 6.8, z);
    circCol(x, z, 3.0, b + 7.1, b + 7.2, true); // thin walkable top surface only
    for (const s of [-1, 1]) { // chairs (solid, not climbable — skinny metal)
      const ch = add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 1.1), toon(0x55504a)));
      ch.position.set(x + s * 2.4, b + 0.8, z);
      boxCol(x + s * 2.4, z, 0.55, 0.55, -100, b + 1.6, false);
    }
    return b + 7.2;
  };
  const umbrellaTop = cafe(-12, 38, 0xe0763a);
  cafe(-24, 38, 0x2fa7d9);

  // ---------- Benches (crawl underneath or hop up) ----------
  const bench = (x, z, rot) => {
    const b = groundHeight(x, z);
    const g = new THREE.Group(); g.position.set(x, b, z); g.rotation.y = rot;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 1.6), toon(0x9b6b45)); seat.position.y = 1.35;
    const back = new THREE.Mesh(new THREE.BoxGeometry(5, 1.4, 0.25), toon(0x9b6b45)); back.position.set(0, 2.2, -0.75);
    g.add(seat, back);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 1.4), toon(0x3e3a36)); leg.position.set(s * 2.2, 0.6, 0); g.add(leg); }
    add(g);
    const cs = Math.cos(rot), sn = Math.sin(rot);
    boxCol(x, z, 2.5, 0.8, b + 1.15, b + 1.5, true, rot);
    boxCol(x - 0.75 * sn, z - 0.75 * cs, 2.5, 0.15, b + 1.5, b + 2.9, true, rot); // backrest (local z = -0.75)
    return b + 1.5;
  };
  const benchTop = bench(-30, 26, 0);
  bench(-4, 22, 0); bench(-44, -8, Math.PI / 2); bench(-44, 16, Math.PI / 2);

  // ---------- Lamp posts ----------
  for (const [x, z] of [[-16, 2], [6, 30], [-46, 0], [20, -26], [40, -26], [-20, -26]]) {
    const b = groundHeight(x, z);
    const post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 10, 8), toon(0x3e4a52)));
    post.position.set(x, b + 5, z);
    circCol(x, z, 0.3, -100, b + 10, true);
    const lamp = add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), toon(0xfff3c4)), false);
    lamp.position.set(x, b + 10.3, z);
  }

  // ---------- Cars (run underneath, or climb up the bumper) ----------
  const carColors = [0xd64a3b, 0x2c9fa3, 0xf2efe6, 0xf2c14e, 0x3d6fb6, 0xe0763a, 0x7c8a93];
  const winMat = toon(0x2b4660);
  const cars = [];
  const car = (x, z, color) => {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.2, 12), toon(color)); body.position.y = 1.9;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.0, 6.5), toon(color)); cab.position.set(0, 4.0, -0.6);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(4.9, 1.4, 6.0), winMat); glass.position.set(0, 4.0, -0.6);
    g.add(body, cab, glass);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.8, 14), toon(0x2a2a2a));
      w.rotation.z = Math.PI / 2; w.position.set(sx * 2.5, 1.0, sz * 3.8); g.add(w);
    }
    for (const sx of [-1, 1]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.15), toon(0xfff6d0)); hl.position.set(sx * 1.8, 2.3, 6.02); g.add(hl); }
    add(g);
    boxCol(x, z, 2.7, 6, 0.8, 3.0, true);            // body: clearance 0.8 to scurry under
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxCol(x + sx * 2.5, z + sz * 3.8, 0.4, 1.0, -100, 1.9, true); // tyres: a way up
    boxCol(x, z - 0.6, 2.4, 3.25, 3.0, 5.0, true);   // cabin
    cars.push({ x, z });
  };
  const carSpots = [[12, -14], [28, -14], [36, -14], [52, -14], [20, -38], [36, -38], [44, -38], [-34, -26], [-18, -26], [-10, -26], [24, 22], [48, 22]];
  carSpots.forEach(([x, z], i) => car(x, z, carColors[i % carColors.length]));

  // ---------- Shopping carts (stand on the basket, or hide underneath) ----------
  const wire = new THREE.MeshBasicMaterial({ map: wireTexture(), transparent: true, side: THREE.DoubleSide, alphaTest: 0.3 });
  const cartTops = [];
  const cart = (x, z, rot) => {
    const b = groundHeight(x, z);
    const g = new THREE.Group(); g.position.set(x, b, z); g.rotation.y = rot;
    const basket = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 3.2), wire); basket.position.y = 2.1;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 0.25), toon(0xd64a3b)); handle.position.set(0, 3.3, -1.75);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 3.0), toon(0xc9ced6)); frame.position.y = 0.5;
    g.add(basket, handle, frame);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), toon(0x333333)); w.position.set(sx * 0.8, 0.22, sz * 1.3); g.add(w); }
    add(g);
    boxCol(x, z, 1.1, 1.6, b + 1.2, b + 3.0, true, rot);
    // corner posts from the wheels up to the basket: a way to climb in
    const cs = Math.cos(rot), sn = Math.sin(rot);
    for (const [lx, lz] of [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.4], [0.9, 1.4]]) {
      boxCol(x + lx * cs + lz * sn, z - lx * sn + lz * cs, 0.12, 0.12, -100, b + 1.2, true, rot);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 6), toon(0xc9ced6));
      post.position.set(lx, 0.6, lz); g.add(post);
    }
    cartTops.push(b + 3.0);
  };
  cart(4, -6, 0.3); cart(-10, -8, -0.6); cart(-27, 31, 1.2); cart(30, -26, 1.5); cart(-14, 33, 0.2);

  // ---------- Trash cans (smooth metal: walk around) ----------
  for (const [x, z] of [[-6, 4], [-36, 34], [-45, -24], [14, 30]]) {
    const b = groundHeight(x, z);
    const can = add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.8, 2.6, 14), toon(0x2f6b4f)));
    can.position.set(x, b + 1.3, z);
    circCol(x, z, 0.9, -100, b + 2.6, false);
  }

  // ---------- Edge of the world: hedges and far-off buildings ----------
  const hedgeMat = toon(0x4c7a3a);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2, x = Math.cos(a) * (RADIUS + 2), z = Math.sin(a) * (RADIUS + 2);
    if (x < -58 && z > -36) continue; // shops already close off the west/north corner
    const h = new THREE.Mesh(new THREE.BoxGeometry(9, 2.6, 2.4), hedgeMat);
    h.position.set(x, 1.3, z); h.rotation.y = -a + Math.PI / 2;
    add(h, false);
  }
  for (let i = 0; i < 22; i++) {
    const a = rand() * Math.PI * 2, d = 95 + rand() * 30;
    const w = 14 + rand() * 18, H = 10 + rand() * 18;
    const bld = new THREE.Mesh(new THREE.BoxGeometry(w, H, w * 0.7), stucco(2, 2));
    bld.position.set(Math.cos(a) * d, H / 2, Math.sin(a) * d); bld.rotation.y = rand() * 3;
    scene.add(bld);
    const tree = new THREE.Mesh(new THREE.SphereGeometry(4 + rand() * 3, 10, 8), hedgeMat);
    tree.position.set(Math.cos(a + 0.12) * (d - 12), 4, Math.sin(a + 0.12) * (d - 12));
    scene.add(tree);
  }

  // ---------- Pebbles ----------
  const top = (x, z) => {
    let t = groundHeight(x, z);
    for (const c of colliders) if (footprint(c, x, z).dist <= 0 && c.top > t && c.top < 40) t = c.top;
    return t;
  };
  const car0 = cars[2], car1 = cars[8];
  const pebbleSpots = [
    { x: -30, z: 26, y: groundHeight(-30, 26) + 0.55, hint: 'Under the bench!' },
    { x: FX, z: FZ, y: CURB + 5.5 + 0.6, hint: 'Top of the fountain' },
    { x: -27, z: 31, y: cartTops[2] + 0.6, hint: 'In a shopping cart' },
    { x: car0.x, z: car0.z - 0.6, y: 5.0 + 0.6, hint: 'Car roof!' },
    { x: car1.x, z: car1.z, y: 0.5, hint: 'Hiding under a car' },
    { x: -12, z: 38, y: umbrellaTop + 0.6, hint: 'On the café umbrella' },
    { x: TX + 2.5, z: TZ, y: 24 + 0.6, hint: 'Clock tower ledge!' },
    { x: OX, z: OZ, y: ob + 7.8 + 0.6, hint: 'Up the orange tree' },
    { x: -40, z: 30, y: palmTop + 0.6, hint: 'Top of a palm tree!' },
    { x: -20, z: 50, y: SH + 0.6, hint: 'On the shop roof' },
  ];
  void benchTop; void top;

  return {
    colliders,
    solids,
    horizonColor,
    pebbleSpots,
    spawn: { x: 2, z: -2, yaw: Math.PI * 0.85 }, // looking into the plaza
    enemies: {
      kind: 'pigeon',
      homes: [[-26, 22], [-8, 12], [14, -28], [22, -26], [-26, -12], [32, 6], [-50, 24], [44, -30]],
      count: 6, chaseSpeed: 3.4, wanderSpeed: 1.2, notice: 8, radius: 0.6, height: 1.25,
    },
    update(dt, t) {
      for (const j of jets) {
        j.t = (j.t + dt * 0.6) % 1;
        const r = 0.6 + j.t * 3.2;
        j.m.position.set(FX + Math.cos(j.a) * r, CURB + 5.2 + Math.sin(j.t * Math.PI) * 1.4 - j.t * 4.2, FZ + Math.sin(j.a) * r);
        j.m.visible = j.m.position.y > CURB + 1.0;
      }
    },
  };
}
