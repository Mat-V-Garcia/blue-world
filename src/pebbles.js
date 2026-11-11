import * as THREE from 'three';

function sparkleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,250,220,1)');
  grd.addColorStop(0.25, 'rgba(255,215,110,0.8)');
  grd.addColorStop(1, 'rgba(255,190,80,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  // four-point star
  g.fillStyle = 'rgba(255,255,240,0.9)';
  g.beginPath();
  g.moveTo(32, 2); g.lineTo(36, 28); g.lineTo(62, 32); g.lineTo(36, 36);
  g.lineTo(32, 62); g.lineTo(28, 36); g.lineTo(2, 32); g.lineTo(28, 28); g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const SPARK = sparkleTexture();

export function createPebbles(scene, spots) {
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0xb86a00, emissiveIntensity: 0.45, metalness: 0.7, roughness: 0.25, flatShading: true });
  const pebbles = spots.map((s, i) => {
    const g = new THREE.Group();
    g.position.set(s.x, s.y, s.z);
    const geo = new THREE.IcosahedronGeometry(0.32, 1);
    geo.scale(1.15, 0.8, 1);
    const mesh = new THREE.Mesh(geo, gold);
    mesh.castShadow = true;
    g.add(mesh);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPARK, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    glow.scale.setScalar(1.6);
    g.add(glow);
    // tall soft beacon so far-away pebbles can be spotted
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.25, 14, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    beacon.position.y = 7;
    g.add(beacon);
    scene.add(g);
    return { group: g, mesh, glow, beacon, baseY: s.y, hint: s.hint, taken: false, phase: i };
  });

  // Burst particles
  const bursts = [];
  function burst(pos) {
    const n = 26;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) {
      p.set([pos.x, pos.y, pos.z], i * 3);
      v.push(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 6 + 2, (Math.random() - 0.5) * 6));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const mat = new THREE.PointsMaterial({ map: SPARK, size: 0.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    bursts.push({ pts, v, life: 1 });
  }

  return {
    pebbles,
    // returns the pebble collected this frame (or null)
    update(dt, t, playerPos) {
      let got = null;
      for (const pb of pebbles) {
        if (pb.taken) continue;
        pb.mesh.rotation.y += dt * 2;
        pb.mesh.rotation.x = Math.sin(t * 1.3 + pb.phase) * 0.3;
        pb.group.position.y = pb.baseY + Math.sin(t * 2 + pb.phase) * 0.12;
        pb.glow.material.opacity = 0.55 + Math.sin(t * 5 + pb.phase) * 0.3;
        const d = pb.group.position.distanceTo(playerPos);
        pb.beacon.material.opacity = THREE.MathUtils.clamp((d - 6) / 30, 0, 1) * 0.22;
        if (d < 1.1) {
          pb.taken = true;
          pb.group.visible = false;
          burst(pb.group.position);
          got = pb;
        }
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.life -= dt;
        const a = b.pts.geometry.attributes.position;
        b.v.forEach((v, k) => {
          v.y -= 9 * dt;
          a.setXYZ(k, a.getX(k) + v.x * dt, a.getY(k) + v.y * dt, a.getZ(k) + v.z * dt);
        });
        a.needsUpdate = true;
        b.pts.material.opacity = Math.max(0, b.life);
        if (b.life <= 0) { scene.remove(b.pts); bursts.splice(i, 1); }
      }
      return got;
    },
  };
}

// Little sand puffs when landing / sprinting
export function createDust(scene) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xf5d7ae, transparent: true, depthWrite: false });
  const puffs = [];
  return {
    puff(pos, count = 8, spread = 1) {
      for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), mat.clone());
        m.position.copy(pos);
        m.position.y += 0.08;
        const a = Math.random() * Math.PI * 2;
        puffs.push({ m, v: new THREE.Vector3(Math.cos(a) * spread * 1.6, 0.6 + Math.random() * 0.6, Math.sin(a) * spread * 1.6), life: 0.7 });
        scene.add(m);
      }
    },
    update(dt) {
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.life -= dt;
        p.m.position.addScaledVector(p.v, dt);
        p.v.multiplyScalar(0.92);
        p.m.scale.setScalar(1 + (0.7 - p.life) * 1.4);
        p.m.material.opacity = Math.max(0, p.life / 0.7) * 0.45;
        if (p.life <= 0) { scene.remove(p.m); puffs.splice(i, 1); }
      }
    },
  };
}
