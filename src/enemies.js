import * as THREE from 'three';
import { terrainHeight, footprint, WORLD_RADIUS } from './world.js';
import { toon } from './materials.js';

// ---------- Tuning ----------
const COUNT = 6;
const SPIDER_RADIUS = 0.45;    // body radius for touching / stomping
const SPIDER_HEIGHT = 0.42;
const WANDER_SPEED = 1.4;
const CHASE_SPEED = 3.8;       // slower than the lizard's walk (5.5), so you can always escape
const NOTICE_RANGE = 8.5;      // starts chasing inside this
const GIVE_UP_RANGE = 15;      // stops chasing past this (from home)
const RESPAWN_TIME = 30;       // seconds after being defeated
const BITE_RANGE = 1.35;       // how far in front of the lizard a bite reaches

// Spots spread around the level, away from the start and from pebbles.
const HOMES = [
  [18, -6], [-28, 24], [34, 42], [-40, -22], [48, -18], [5, 40], [-12, -45], [-62, 40],
];

// ---------- Simple stand-in spider (used if the 3D model is missing) ----------
export function createSimpleSpider() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const fur = toon(0xc49a5a), dark = toon(0x4a3426), eye = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), fur);
  abdomen.scale.set(1, 0.8, 1.15);
  abdomen.position.set(0, 0.26, -0.22);
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), fur);
  thorax.scale.set(1, 0.7, 1);
  thorax.position.set(0, 0.24, 0.1);
  body.add(abdomen, thorax);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), eye);
    e.position.set(0.05 * s, 0.32, 0.25);
    body.add(e);
  }
  const legs = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? 1 : -1, k = i % 4;
    const hip = new THREE.Group();
    hip.position.set(0.12 * side, 0.24, 0.2 - k * 0.1);
    hip.rotation.y = side * (Math.PI / 2) - side * (k - 1.5) * 0.45;
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.32, 6), dark);
    upper.geometry.rotateX(Math.PI / 2); upper.geometry.translate(0, 0, 0.16);
    const knee = new THREE.Group(); knee.position.set(0, 0, 0.32);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.36, 6), dark);
    lower.geometry.rotateX(Math.PI / 2); lower.geometry.translate(0, 0, 0.18);
    hip.add(upper); hip.add(knee); knee.add(lower);
    hip.rotation.x = -0.5; knee.rotation.x = 1.25;
    body.add(hip);
    legs.push({ hip, knee, side, k, baseY: hip.rotation.y });
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  let phase = 0;
  return {
    root,
    update(dt, speed) {
      phase += dt * (2 + speed * 4);
      for (const l of legs) {
        const p = phase + (l.k % 2 ? Math.PI : 0) + (l.side > 0 ? 0 : Math.PI);
        l.hip.rotation.y = l.baseY + Math.sin(p) * 0.3 * Math.min(1, speed);
        l.hip.rotation.x = -0.5 - Math.max(0, Math.cos(p)) * 0.3 * Math.min(1, speed);
      }
      body.position.y = Math.abs(Math.sin(phase * 2)) * 0.02 * Math.min(1, speed);
    },
  };
}

// ---------- Tarantula manager ----------
// makeSpider(): returns { root, update(dt, speed) } — either the 3D model or the stand-in.
export function createTarantulas(scene, colliders, pebbleSpots, makeSpider) {
  const clearOf = (x, z) => colliders.every((c) => footprint(c, x, z).dist > 1.2)
    && pebbleSpots.every((p) => Math.hypot(p.x - x, p.z - z) > 4);
  const homes = HOMES.filter(([x, z]) => clearOf(x, z)).slice(0, COUNT);

  const spiders = homes.map(([hx, hz], i) => {
    const v = makeSpider();
    scene.add(v.root);
    const s = {
      v, home: new THREE.Vector2(hx, hz), pos: new THREE.Vector3(hx, terrainHeight(hx, hz), hz),
      yaw: Math.random() * Math.PI * 2, target: new THREE.Vector2(hx, hz), retarget: 0,
      state: 'wander', alive: true, deadT: 0, squash: 0, speed: 0, seed: i, pause: 0,
    };
    return s;
  });

  const dustMat = new THREE.MeshBasicMaterial({ color: 0xf5d7ae, transparent: true, depthWrite: false });
  const poofs = [];
  function poof(pos) {
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), dustMat.clone());
      m.position.copy(pos).add(new THREE.Vector3(0, 0.2, 0));
      const a = Math.random() * Math.PI * 2;
      poofs.push({ m, v: new THREE.Vector3(Math.cos(a) * 2, 1 + Math.random(), Math.sin(a) * 2), life: 0.6 });
      scene.add(m);
    }
  }

  function defeat(s) {
    s.alive = false;
    s.deadT = 0;
    s.squash = 0.001;
    poof(s.pos);
  }

  function moveTo(s, tx, tz, speed, dt) {
    const dx = tx - s.pos.x, dz = tz - s.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { s.speed = 0; return d; }
    const step = Math.min(d, speed * dt);
    let nx = s.pos.x + (dx / d) * step, nz = s.pos.z + (dz / d) * step;
    // walk around rocks, cacti, bushes etc. (spiders don't climb)
    for (const c of colliders) {
      if (c.bottom > -50) continue;
      const f = footprint(c, nx, nz, s.pos.y + 0.1);
      if (f.dist < SPIDER_RADIUS) {
        nx += f.nx * (SPIDER_RADIUS - f.dist);
        nz += f.nz * (SPIDER_RADIUS - f.dist);
        // slide sideways round the obstacle
        nx += -f.nz * step * 0.6; nz += f.nx * step * 0.6;
      }
    }
    const r = Math.hypot(nx, nz);
    if (r > WORLD_RADIUS - 2) { nx *= (WORLD_RADIUS - 2) / r; nz *= (WORLD_RADIUS - 2) / r; }
    s.speed = Math.hypot(nx - s.pos.x, nz - s.pos.z) / Math.max(dt, 1e-4);
    const want = Math.atan2(nx - s.pos.x, nz - s.pos.z);
    let dy = want - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    s.yaw += dy * Math.min(1, dt * 8);
    s.pos.x = nx; s.pos.z = nz;
    s.pos.y = terrainHeight(nx, nz);
    return d;
  }

  return {
    spiders,
    // Returns 'stomp' | 'hurt' | null for this frame. hurtFrom gets the attacker position.
    update(dt, player, canBeHurt) {
      let result = null, from = null;
      for (const s of spiders) {
        if (!s.alive) {
          s.deadT += dt;
          s.squash = Math.min(1, s.squash + dt * 4);
          s.v.root.scale.set(1 + s.squash * 0.4, Math.max(0.05, 1 - s.squash * 0.9), 1 + s.squash * 0.4);
          if (s.deadT > 0.6) s.v.root.visible = false;
          const far = Math.hypot(player.pos.x - s.home.x, player.pos.z - s.home.y) > 18;
          if (s.deadT > RESPAWN_TIME && far) {
            s.alive = true; s.v.root.visible = true; s.v.root.scale.set(1, 1, 1);
            s.pos.set(s.home.x, terrainHeight(s.home.x, s.home.y), s.home.y);
            s.state = 'wander';
          }
          continue;
        }

        // --- think ---
        const toP = Math.hypot(player.pos.x - s.pos.x, player.pos.z - s.pos.z);
        const fromHome = Math.hypot(player.pos.x - s.home.x, player.pos.z - s.home.y);
        const playerLow = player.pos.y - terrainHeight(player.pos.x, player.pos.z) < 1.5; // can't reach you up high
        if (s.state !== 'chase' && toP < NOTICE_RANGE && playerLow) s.state = 'chase';
        if (s.state === 'chase' && (fromHome > GIVE_UP_RANGE || !playerLow)) s.state = 'return';

        if (s.pause > 0) {
          // just bit you: scuttle back a little, then pause, before coming again
          s.pause -= dt;
          if (s.pause > 0.8) {
            const ax = s.pos.x - player.pos.x, az = s.pos.z - player.pos.z, ad = Math.hypot(ax, az) || 1;
            moveTo(s, s.pos.x + (ax / ad) * 2, s.pos.z + (az / ad) * 2, WANDER_SPEED * 1.6, dt);
          } else s.speed = 0;
        } else if (s.state === 'chase') {
          // close in, but stop at touching distance instead of walking on top of you
          if (toP > SPIDER_RADIUS + 0.25) moveTo(s, player.pos.x, player.pos.z, CHASE_SPEED, dt);
          else s.speed = 0;
        } else if (s.state === 'return') {
          if (moveTo(s, s.home.x, s.home.y, WANDER_SPEED * 1.5, dt) < 0.5) s.state = 'wander';
        } else {
          s.retarget -= dt;
          if (s.retarget <= 0) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * 5;
            s.target.set(s.home.x + Math.cos(a) * r, s.home.y + Math.sin(a) * r);
            s.retarget = 2 + Math.random() * 3;
          }
          if (moveTo(s, s.target.x, s.target.y, WANDER_SPEED, dt) < 0.1) s.speed = 0;
        }

        // --- touch the lizard? ---
        const dh = Math.hypot(player.pos.x - s.pos.x, player.pos.z - s.pos.z);
        const above = player.pos.y - s.pos.y;
        if (dh < SPIDER_RADIUS + 0.3 && above < SPIDER_HEIGHT + 0.15 && above > -0.4) {
          if (player.velY < -1.5 && above > SPIDER_HEIGHT * 0.45) {
            defeat(s); result = 'stomp';
          } else if (canBeHurt && !result) {
            result = 'hurt'; from = s.pos.clone();
            s.pause = 1.6;
          }
        }

        s.v.root.position.copy(s.pos);
        s.v.root.rotation.y = s.yaw;
        s.v.update(dt, s.speed / 2.5);
      }
      for (let i = poofs.length - 1; i >= 0; i--) {
        const p = poofs[i];
        p.life -= dt;
        p.m.position.addScaledVector(p.v, dt);
        p.v.multiplyScalar(0.9);
        p.m.material.opacity = Math.max(0, p.life / 0.6) * 0.6;
        if (p.life <= 0) { scene.remove(p.m); poofs.splice(i, 1); }
      }
      return { result, from };
    },
    // Lizard bites: any spider just in front of the snout is defeated. Returns how many.
    bite(pos, yaw) {
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      let n = 0;
      for (const s of spiders) {
        if (!s.alive) continue;
        const dx = s.pos.x - pos.x, dz = s.pos.z - pos.z, d = Math.hypot(dx, dz);
        if (d < BITE_RANGE + SPIDER_RADIUS && Math.abs(s.pos.y - pos.y) < 0.8 && (dx * fx + dz * fz) / (d || 1) > 0.35) {
          defeat(s); n++;
        }
      }
      return n;
    },
    reset() {
      for (const s of spiders) {
        s.alive = true; s.v.root.visible = true; s.v.root.scale.set(1, 1, 1);
        s.pos.set(s.home.x, terrainHeight(s.home.x, s.home.y), s.home.y); s.state = 'wander'; s.pause = 0;
      }
    },
  };
}
