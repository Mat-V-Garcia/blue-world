import * as THREE from 'three';
import { toon, loadTexture, tiled } from './materials.js';

export const WORLD_RADIUS = 92;

// ---------- Terrain ----------
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Dry riverbed runs diagonally across the south of the map.
export function riverZ(x) { return -45 + x * 0.38 + 6 * Math.sin(x * 0.07); }
function riverDepth(x, z) {
  const d = Math.abs(z - riverZ(x));
  return 1.7 * (1 - smooth(2.5, 6, d));
}

export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  const dunes = 1.3 * Math.sin(x * 0.07) * Math.cos(z * 0.055)
    + 0.7 * Math.sin((x + z) * 0.13)
    + 0.35 * Math.sin(x * 0.21 - z * 0.17);
  const calm = smooth(0, 14, r); // flat-ish start area
  const rim = smooth(82, 115, r) * 16;
  return dunes * calm + rim - riverDepth(x, z);
}

function buildTerrain(sandTex) {
  const size = 260, seg = 220;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(0xf2c48d), clay = new THREE.Color(0xc98a62), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
    c.copy(sand).lerp(clay, Math.min(1, riverDepth(x, z) / 1.2));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = toon(sandTex ? 0xffffff : 0xf2c48d, { vertexColors: true, map: tiled(sandTex, 64, 64) });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- Sky ----------
// Where the painted horizon (mesas meet sand) sits in sky.jpg, as a fraction up from the
// bottom. Measured for the Magnific blue-sky painting; change if the sky image changes.
const SKY_HORIZON = 0.25;
async function buildSky(scene, skyTex) {
  // Gradient dome
  // Midday blue: deep blue overhead, pale haze at the horizon (overridden by the painting).
  const topColor = new THREE.Color(0x2f6fc4), horizon = new THREE.Color(0xcfe3f2);
  const domeGeo = new THREE.SphereGeometry(480, 32, 16);
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: topColor }, bottom: { value: horizon } },
    vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vp; void main(){ float h = clamp(normalize(vp).y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
  });
  scene.add(new THREE.Mesh(domeGeo, domeMat));

  if (skyTex) {
    // Painted panorama wrapped around the horizon (twice, mirrored seam hidden by repeat).
    const t = skyTex.clone();
    t.wrapS = THREE.MirroredRepeatWrapping;
    t.repeat.set(4, 1);
    t.needsUpdate = true;
    // Sample the painting: its top row colours the dome overhead, and the band just above
    // its horizon becomes the haze colour so distant dunes melt into the painted sky.
    try {
      const img = skyTex.image;
      const cv = document.createElement('canvas');
      cv.width = 16; cv.height = 50;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, 16, 50);
      const avgRow = (y) => {
        const d = ctx.getImageData(0, y, 16, 1).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < 16; i++) { r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; }
        return new THREE.Color().setRGB(r / 4080, g / 4080, b / 4080, THREE.SRGBColorSpace);
      };
      topColor.copy(avgRow(0));
      horizon.copy(avgRow(Math.round((1 - SKY_HORIZON - 0.09) * 50))); // clear sky just above the mesas
    } catch { /* keep defaults */ }
    const R = 420, H = R * 2 * Math.PI / 4 / (16 / 9); // keep image aspect (4 mirrored repeats = seamless)
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R, H, 64, 1, true),
      new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    cyl.position.y = H / 2 - H * SKY_HORIZON; // painting's horizon sits at eye level
    scene.add(cyl);
  }
  return horizon;
}

// ---------- Props ----------
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

// Smooth bumpy outline around a rock: multiplier on the radius by angle (≈1 ± amp).
function wobble(seed, amp) {
  return (a) => 1 + amp * (0.6 * Math.sin(5 * a + seed) + 0.4 * Math.sin(3 * a + seed * 2.1));
}

// Build a rock as rings of vertices whose radius comes from rAt(y, angle) — the same
// function the collider uses. ts: ring heights as fractions of [y0, y1]. Optionally caps the top.
function shapedRock(rAt, y0, y1, ts, segs, capTop) {
  const pos = [], uv = [], idx = [];
  const rings = ts.length;
  for (let j = 0; j < rings; j++) {
    const y = y0 + (y1 - y0) * ts[j];
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const r = rAt(y, a);
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uv.push(s / segs, ts[j]);
    }
  }
  for (let j = 0; j < rings - 1; j++) {
    for (let s = 0; s < segs; s++) {
      const a = j * (segs + 1) + s, b = a + segs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1); // outward-facing
    }
  }
  if (capTop) {
    const c = pos.length / 3;
    pos.push(0, y1, 0); uv.push(0.5, 1);
    const top = (rings - 1) * (segs + 1);
    for (let s = 0; s < segs; s++) idx.push(c, top + s + 1, top + s);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export async function buildWorld(scene) {
  const [sandTex, rockTex, skyTex] = await Promise.all([
    loadTexture('sand.jpg'), loadTexture('rock.jpg'), loadTexture('sky.jpg'),
  ]);
  const horizonColor = await buildSky(scene, skyTex);
  scene.add(buildTerrain(sandTex));

  const colliders = [];
  const solids = []; // meshes the camera must not pass through
  const rockMat = (rx = 1, ry = 1) => toon(rockTex ? 0xffffff : 0xc8653a, { map: tiled(rockTex, rx, ry) });
  const add = (m) => { m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
  const rand = rng(7);

  // Mesas: big flat-topped climbs
  const mesas = [
    { x: 55, z: -50, r: 14, h: 16 }, { x: -55, z: 15, r: 16, h: 20 },
    { x: 15, z: 62, r: 10, h: 11 }, { x: -60, z: -40, r: 9, h: 9 },
  ];
  // Every rock below is built from the SAME radius function its collider uses, so what
  // you see is exactly what you bump into and climb (no walking inside rock, no gaps).
  for (const [i, m] of mesas.entries()) {
    const base = terrainHeight(m.x, m.z) - 1;
    const H = m.h + 1;
    const wob = wobble(i * 1.7, 0.05);
    const rAt = (_y, a) => m.r * wob(a);
    const mesh = add(new THREE.Mesh(shapedRock(rAt, 0, H, [0, 0.25, 0.5, 0.75, 1], 48, false), rockMat(4, 2)));
    mesh.position.set(m.x, base, m.z);
    solids.push(mesh);
    colliders.push({ type: 'circle', x: m.x, z: m.z, r: m.r * 1.08, rAt: (y, a) => rAt(y - base, a), bottom: -100, top: base + H, climbable: true });
    // sandy cap on top, same outline
    const cap = new THREE.Mesh(shapedRock((y, a) => rAt(y, a) * 0.995, 0, 0.12, [0, 1], 48, true), toon(0xe0a777));
    cap.position.set(m.x, base + H - 0.06, m.z);
    cap.receiveShadow = true;
    scene.add(cap);
  }

  // Boulders
  const boulders = [
    { x: 12, z: 8, r: 2, h: 2.5 }, { x: -14, z: -10, r: 3, h: 3.5 }, { x: 25, z: 18, r: 1.5, h: 1.8 },
    { x: -8, z: 30, r: 2.5, h: 3 }, { x: 30, z: -12, r: 2, h: 2 }, { x: -30, z: 60, r: 3, h: 4 },
    { x: 60, z: 10, r: 2.5, h: 3 }, { x: 40, z: 55, r: 2, h: 2.4 },
  ];
  for (const [i, b] of boulders.entries()) {
    const base = terrainHeight(b.x, b.z) - 0.3; // sit a little into the sand
    const H = b.h + 0.3;
    const wob = wobble(10 + i * 2.3, 0.08);
    // rounded boulder: straight-ish sides, then curving in to a flat-ish top (half width)
    const prof = (t) => (t < 0.35 ? 1 : Math.sqrt(Math.max(0, 1 - ((t - 0.35) / 0.75) ** 2)));
    const rAt = (y, a) => b.r * prof(Math.min(1, Math.max(0, y / H))) * wob(a);
    const mesh = add(new THREE.Mesh(shapedRock(rAt, 0, H, [0, 0.2, 0.35, 0.5, 0.62, 0.74, 0.84, 0.92, 1], 28, true), rockMat(1, 1)));
    mesh.position.set(b.x, base, b.z);
    solids.push(mesh);
    colliders.push({ type: 'circle', x: b.x, z: b.z, r: b.r * 1.1, rAt: (y, a) => rAt(y - base, a), bottom: -100, top: base + H, climbable: true });
  }

  // Hoodoo: tall stacked rock pillar
  {
    const hx = -22, hz = -28, base = terrainHeight(hx, hz) - 0.5;
    const parts = [[1.7, 2.0, 3.5], [1.2, 1.6, 3], [1.5, 1.1, 1.2], [2.0, 1.8, 1.3]];
    // radius at height y (relative to base): linear within each stacked section
    const rAtLocal = (yy) => {
      let y0 = 0;
      for (const [rt, rb, h] of parts) {
        if (yy <= y0 + h) return rb + (rt - rb) * Math.max(0, (yy - y0) / h);
        y0 += h;
      }
      return parts[parts.length - 1][0];
    };
    let y = base;
    for (const [rt, rb, h] of parts) {
      const mesh = add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 32), rockMat(2, 1)));
      mesh.position.set(hx, y + h / 2, hz);
      solids.push(mesh);
      y += h;
    }
    colliders.push({ type: 'circle', x: hx, z: hz, r: 2.0, rAt: (yy) => rAtLocal(yy - base), bottom: -100, top: y, climbable: true });
  }

  // Rock arch
  const arch = { x: -25, z: 45, a: 0.4 };
  {
    const g = new THREE.Group();
    g.position.set(arch.x, terrainHeight(arch.x, arch.z) - 0.5, arch.z);
    g.rotation.y = arch.a;
    scene.add(g);
    solids.push(g);
    const base = g.position.y;
    for (const s of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 8, 2.6), rockMat(1, 3));
      pillar.position.set(4.5 * s, 4, 0);
      pillar.castShadow = pillar.receiveShadow = true;
      g.add(pillar);
      const off = new THREE.Vector3(4.5 * s, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), arch.a);
      colliders.push({ type: 'box', x: arch.x + off.x, z: arch.z + off.z, hx: 1.3, hz: 1.3, angle: arch.a, bottom: -100, top: base + 10, climbable: true });
    }
    const span = new THREE.Mesh(new THREE.BoxGeometry(12.2, 2, 2.8), rockMat(4, 1));
    span.position.set(0, 9, 0);
    span.castShadow = span.receiveShadow = true;
    g.add(span);
    colliders.push({ type: 'box', x: arch.x, z: arch.z, hx: 6.1, hz: 1.4, angle: arch.a, bottom: base + 8, top: base + 10, climbable: true });
    arch.top = base + 10;
  }

  // Old wagon (you can hide underneath!)
  const wagon = { x: 32, z: 30, a: 0.7 };
  {
    const g = new THREE.Group();
    const base = terrainHeight(wagon.x, wagon.z);
    g.position.set(wagon.x, base, wagon.z);
    g.rotation.y = wagon.a;
    scene.add(g);
    solids.push(g);
    const wood = toon(0x8a5a3a), dark = toon(0x5a3a26);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 5.5), wood);
    bed.position.y = 1.5;
    bed.castShadow = bed.receiveShadow = true;
    g.add(bed);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.12, 6, 14), dark);
      wheel.position.set(1.65 * sx, 0.85, 1.8 * sz);
      wheel.rotation.y = Math.PI / 2;
      wheel.rotation.z = sz * 0.2 + (sx > 0 && sz > 0 ? 0.5 : 0);
      wheel.castShadow = true;
      g.add(wheel);
    }
    // bonnet hoops (canvas long gone)
    for (const sz of [-1.8, 0, 1.8]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.07, 5, 12, Math.PI), dark);
      hoop.position.set(0, 2.1, sz);
      hoop.rotation.y = Math.PI / 2;
      hoop.castShadow = true;
      g.add(hoop);
    }
    colliders.push({ type: 'box', x: wagon.x, z: wagon.z, hx: 1.5, hz: 2.75, angle: wagon.a, bottom: base + 0.9, top: base + 2.1, climbable: true });
    wagon.base = base;
  }

  // Fences — perfect for a fence lizard
  const fencePosts = [];
  const woodMat = toon(0x9b6b45), woodDark = toon(0x7a5235);
  const fence = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 3.2);
    const ang = Math.atan2(bx - ax, bz - az);
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
      const base = terrainHeight(x, z) - 0.2;
      const post = add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 2, 0.28), woodMat));
      solids.push(post);
      post.position.set(x, base + 1, z);
      post.rotation.y = ang + (rand() - 0.5) * 0.2;
      post.rotation.z = (rand() - 0.5) * 0.08;
      colliders.push({ type: 'box', x, z, hx: 0.16, hz: 0.16, angle: ang, bottom: -100, top: base + 2, climbable: true });
      fencePosts.push({ x, z, top: base + 2 });
      if (prev) {
        for (const h of [0.8, 1.55]) {
          const mx = (x + prev.x) / 2, mz = (z + prev.z) / 2, mb = (base + prev.base) / 2;
          const seg = Math.hypot(x - prev.x, z - prev.z);
          const rail = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, seg), woodDark));
          rail.position.set(mx, mb + h, mz);
          rail.rotation.y = ang;
          colliders.push({ type: 'box', x: mx, z: mz, hx: 0.1, hz: seg / 2, angle: ang, bottom: mb + h - 0.07, top: mb + h + 0.07, climbable: true });
        }
      }
      prev = { x, z, base };
    }
  };
  fence(-10, -20, 20, -28);
  fence(-42, -2, -32, 14);
  fence(35, 8, 48, 20);

  // Saguaro cacti (spiky: not climbable)
  const cactusMat = toon(0x6f9a4f), cactusDark = toon(0x557a3c);
  const cactus = (x, z, h) => {
    const base = terrainHeight(x, z) - 0.2;
    const g = new THREE.Group();
    g.position.set(x, base, z);
    g.rotation.y = rand() * Math.PI * 2;
    const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, h - 0.9, 4, 10), cactusMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    g.add(trunk);
    const arms = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < arms; i++) {
      const s = i === 0 ? 1 : -1, ay = h * (0.4 + rand() * 0.2), up = 1.2 + rand() * 1.2;
      const elbow = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 4, 8), cactusDark);
      elbow.rotation.z = Math.PI / 2;
      elbow.position.set(0.75 * s, ay, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, up, 4, 8), cactusMat);
      arm.position.set(1.2 * s, ay + up / 2, 0);
      elbow.castShadow = arm.castShadow = true;
      g.add(elbow, arm);
    }
    // Pink blossom on top
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), toon(0xf08fb0));
    flower.position.y = h + 0.05;
    g.add(flower);
    scene.add(g);
    solids.push(g);
    colliders.push({ type: 'circle', x, z, r: 0.55, bottom: -100, top: base + h, climbable: false });
  };
  const blocked = (x, z) => colliders.some((c) => Math.hypot(c.x - x, c.z - z) < (c.r || Math.max(c.hx, c.hz) + 1) + 3)
    || Math.hypot(x, z) < 8 || Math.abs(z - riverZ(x)) < 6;
  let placed = 0;
  while (placed < 26) {
    const a = rand() * Math.PI * 2, d = 15 + rand() * 68;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (blocked(x, z)) continue;
    cactus(x, z, 3.5 + rand() * 3.5);
    placed++;
  }
  // Cactus cluster hiding a pebble
  cactus(-34, -13, 5.5); cactus(-38, -14, 4.2); cactus(-35, -19, 6); cactus(-39, -19.5, 3.8);

  // Tumbleweeds rolling with the wind
  const tumbleweeds = [];
  const twMat = toon(0xb08a55, { wireframe: true });
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), twMat);
    t.position.set((rand() - 0.5) * 150, 0, (rand() - 0.5) * 150);
    t.userData.speed = 2 + rand() * 2.5;
    scene.add(t);
    tumbleweeds.push(t);
  }

  // ---------- Pebble spots ----------
  const surfaceTop = (x, z) => {
    let top = terrainHeight(x, z);
    for (const c of colliders) if (contains(c, x, z, 0) && c.top > top && c.bottom < -50) top = c.top;
    return top;
  };
  const midPost = fencePosts[Math.floor(fencePosts.length / 6)];
  const wagonInside = { x: wagon.x, z: wagon.z };
  const pebbleSpots = [
    { x: 6, z: -4, y: terrainHeight(6, -4) + 0.6, hint: 'An easy one!' },
    { x: -14, z: -10, y: surfaceTop(-14, -10) + 0.6, hint: 'On a boulder' },
    { x: midPost.x, z: midPost.z, y: midPost.top + 0.55, hint: 'Fence post!' },
    { x: wagonInside.x, z: wagonInside.z, y: wagon.base + 0.45, hint: 'Under the wagon' },
    { x: arch.x, z: arch.z, y: arch.top + 0.6, hint: 'Top of the arch!' },
    { x: 10, z: riverZ(10), y: terrainHeight(10, riverZ(10)) + 0.6, hint: 'In the dry riverbed' },
    { x: 15, z: 62, y: surfaceTop(15, 62) + 0.8, hint: 'Mesa summit' },
    { x: -55, z: 15, y: surfaceTop(-55, 15) + 0.8, hint: 'Tallest mesa!' },
    { x: -36.5, z: -16.5, y: terrainHeight(-36.5, -16.5) + 0.6, hint: 'Hidden in the cacti' },
    { x: -22, z: -28, y: surfaceTop(-22, -28) + 0.6, hint: 'Top of the hoodoo' },
  ];


  // Sagebrush clumps + small rocks: solid obstacles you walk (or jump) around, not climb.
  // Placed after the pebbles so none of them blocks a pebble, the start or another prop.
  const bushMat = toon(0x9aa47a), pebbleRock = toon(0xb9774f);
  const clear = (x, z, r) => Math.hypot(x, z) > 7
    && pebbleSpots.every((pb) => Math.hypot(pb.x - x, pb.z - z) > r + 2.5)
    && colliders.every((c) => Math.hypot(c.x - x, c.z - z) > (c.r ?? Math.max(c.hx, c.hz)) + r + 1.2);
  let decor = 0;
  for (let tries = 0; decor < 90 && tries < 2000; tries++) {
    const a = rand() * Math.PI * 2, d = 7 + rand() * 80;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const y = terrainHeight(x, z);
    const isBush = rand() < 0.6;
    if (isBush) {
      const R = 0.75;
      if (!clear(x, z, R)) continue;
      const bush = new THREE.Group();
      let top = 0;
      for (let k = 0; k < 4; k++) {
        const r = 0.32 + rand() * 0.25;
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), bushMat);
        // keep every lump inside the collision circle
        const ang = rand() * Math.PI * 2, off = rand() * (R - r);
        s.position.set(Math.cos(ang) * off, 0.25 + rand() * 0.2, Math.sin(ang) * off);
        s.castShadow = true;
        bush.add(s);
        top = Math.max(top, s.position.y + r);
      }
      bush.position.set(x, y, z);
      scene.add(bush);
      solids.push(bush);
      colliders.push({ type: 'circle', x, z, r: R, bottom: -100, top: y + top, climbable: false });
    } else {
      const r = 0.38 + rand() * 0.3; // tall enough (> step height) that you can't just step over
      if (!clear(x, z, r)) continue;
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), pebbleRock);
      s.position.set(x, y + 0.05, z);
      s.rotation.set(rand() * 3, rand() * 3, 0);
      s.castShadow = true;
      scene.add(s);
      solids.push(s);
      colliders.push({ type: 'circle', x, z, r: r * 0.95, bottom: -100, top: y + 0.05 + r * 0.9, climbable: false });
    }
    decor++;
  }

  return {
    colliders,
    solids,
    horizonColor,
    pebbleSpots,
    update(dt, t) {
      for (const tw of tumbleweeds) {
        tw.position.x += tw.userData.speed * dt;
        tw.position.z += Math.sin(t * 0.3 + tw.userData.speed) * dt;
        if (tw.position.x > 90) tw.position.x = -90;
        tw.rotation.z -= tw.userData.speed * dt / 0.7;
        tw.position.y = terrainHeight(tw.position.x, tw.position.z) + 0.7 + Math.abs(Math.sin(t * 3 + tw.userData.speed)) * 0.4;
      }
    },
  };
}

// ---------- Collider maths (shared with player) ----------
// Returns { dist, nx, nz }: distance from point to collider footprint (0 when inside)
// and outward normal.
// y (optional): height to test at, for rocks whose width changes with height
// (defaults to just below the top).
export function footprint(c, x, z, y) {
  if (c.type === 'circle') {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz) || 1e-6;
    const r = c.rAt ? c.rAt(Math.min(y ?? c.top - 0.01, c.top - 0.01), Math.atan2(dz, dx)) : c.r;
    return { dist: Math.max(0, d - r), nx: dx / d, nz: dz / d };
  }
  const cs = Math.cos(c.angle), sn = Math.sin(c.angle);
  const dx = x - c.x, dz = z - c.z;
  // local frame: rotation.y = angle maps local (lx,lz) -> world
  const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
  const qx = Math.max(-c.hx, Math.min(c.hx, lx)), qz = Math.max(-c.hz, Math.min(c.hz, lz));
  let ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
  if (d < 1e-6) { // inside: push out along nearest face
    const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
    if (px < pz) { ex = Math.sign(lx) || 1; ez = 0; } else { ex = 0; ez = Math.sign(lz) || 1; }
    d = 1;
    const wx = ex * cs + ez * sn, wz = -ex * sn + ez * cs;
    return { dist: 0, nx: wx, nz: wz };
  }
  const wx = (ex * cs + ez * sn) / d, wz = (-ex * sn + ez * cs) / d;
  return { dist: d, nx: wx, nz: wz };
}

export function contains(c, x, z, pad) { return footprint(c, x, z).dist <= pad; }
