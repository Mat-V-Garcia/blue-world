import * as THREE from 'three';

// Shared world kit used by every level: the active level's ground, the painted sky,
// rock-shape helpers and collider maths. Levels live in ./levels/.

// The active level sets these (see setGround); player, enemies and camera read them.
const ground = { height: () => 0, radius: 92 };
export function setGround({ height, radius }) { ground.height = height; ground.radius = radius; }
export function terrainHeight(x, z) { return ground.height(x, z); }
export function worldRadius() { return ground.radius; }

// ---------- Sky ----------
// Where the painted horizon (mesas meet sand) sits in sky.jpg, as a fraction up from the
// bottom. Measured for the Magnific blue-sky painting; change if the sky image changes.
const SKY_HORIZON = 0.25;
export async function buildSky(scene, skyTex) {
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
export function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

// Smooth bumpy outline around a rock: multiplier on the radius by angle (≈1 ± amp).
export function wobble(seed, amp) {
  return (a) => 1 + amp * (0.6 * Math.sin(5 * a + seed) + 0.4 * Math.sin(3 * a + seed * 2.1));
}

// Build a rock as rings of vertices whose radius comes from rAt(y, angle) — the same
// function the collider uses. ts: ring heights as fractions of [y0, y1]. Optionally caps the top.
export function shapedRock(rAt, y0, y1, ts, segs, capTop) {
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

