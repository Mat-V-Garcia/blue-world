import * as THREE from 'three';
import { terrainHeight, footprint, worldRadius } from './world.js';

const RADIUS = 0.3;        // body radius for collisions
const HEIGHT = 0.45;       // lizard height
const STEP = 0.4;          // can step up this much without climbing
const HEAD_REACH = 0.52;   // snout probe distance ahead of the body centre
const HEAD_RADIUS = 0.17;  // ...and its size (reaches the nose tip, ~0.7 ahead)
export const CLING_GAP = RADIUS * 0.9; // how far the body centre sits from a wall while climbing
const WALK = 5.5, SPRINT = 10, CLIMB = 4.5, JUMP = 7.5, GRAVITY = 22;

export class Player {
  constructor(colliders) {
    this.colliders = colliders;
    this.pos = new THREE.Vector3(0, terrainHeight(0, 0), 0);
    this.velY = 0;
    this.yaw = 0;                // facing
    this.onGround = true;
    this.wall = null;            // collider we're clinging to
    this.wallN = new THREE.Vector2();
    this.speed = 0;
    this.landed = false;
    this.knock = new THREE.Vector2(); // knockback velocity (from getting hurt), fades out
    this.spawn = this.pos.clone();
  }

  // Got bitten: hop up and get shoved away from the attacker.
  hurt(fromX, fromZ) {
    this.wall = null;
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ, d = Math.hypot(dx, dz) || 1;
    this.knock.set((dx / d) * 9, (dz / d) * 9);
    this.velY = 5.5;
    this.onGround = false;
  }

  respawn() {
    this.pos.copy(this.spawn);
    this.velY = 0; this.wall = null; this.knock.set(0, 0); this.onGround = true;
  }

  groundAt(x, z) {
    let g = terrainHeight(x, z);
    for (const c of this.colliders) {
      if (c.top <= this.pos.y + STEP && c.top > g && footprint(c, x, z).dist <= RADIUS * 0.5) g = c.top;
    }
    return g;
  }

  // Is a circle of radius `rad` at (x, z) inside anything solid at the lizard's height?
  // Rocks can be wider at the feet or overhead, so test at both foot and head height.
  blocking(x, z, rad = RADIUS) {
    const y = this.pos.y;
    for (const c of this.colliders) {
      if (c.top <= y + STEP || c.bottom >= y + HEIGHT) continue;
      const a = footprint(c, x, z, y + 0.05), b = footprint(c, x, z, Math.min(y + HEIGHT, c.top - 0.01));
      const f = a.dist <= b.dist ? a : b;
      if (f.dist < rad) return { c, f };
    }
    return null;
  }

  // The body circle plus a small probe at the snout. The realistic lizard is long (nose
  // ~0.7 ahead of its middle), so without this the head poked into walls and cacti.
  blockedAt(x, z, dirX, dirZ) {
    return this.blocking(x, z) || this.blocking(x + dirX * HEAD_REACH, z + dirZ * HEAD_REACH, HEAD_RADIUS);
  }

  // input: { x, z } world-space wish direction (unit or zero), sprint, jump
  update(dt, input) {
    this.landed = false;
    const wish = new THREE.Vector2(input.x, input.z);
    const has = wish.lengthSq() > 0.01;
    const speed = input.sprint ? SPRINT : WALK;

    // ---- Climbing / clinging ----
    if (this.wall) {
      const c = this.wall;
      const f = footprint(c, this.pos.x, this.pos.z, this.pos.y + 0.3); // wall surface at body height
      const into = has ? -(wish.x * f.nx + wish.y * f.nz) : 0; // >0 means pushing into wall
      if (input.jump) {
        this.wall = null;
        this.velY = JUMP * 0.8;
        this.pos.x += f.nx * 0.4; this.pos.z += f.nz * 0.4;
        this.yaw = Math.atan2(f.nx, f.nz);
      } else if (into < -0.3 || f.dist > HEAD_REACH + HEAD_RADIUS + 0.15) { // climbs can start from the snout touching
        this.wall = null; // let go
        this.pos.x += f.nx * 0.15; this.pos.z += f.nz * 0.15;
      } else {
        this.yaw = Math.atan2(-f.nx, -f.nz);
        this.wallN.set(f.nx, f.nz);
        if (into > 0.3) this.pos.y += CLIMB * dt;
        this.speed = into > 0.3 ? CLIMB : 0;
        // keep snug against the wall
        // ease in toward the wall, but pop straight out if inside rock (e.g. an overhang)
        const want = CLING_GAP, k = f.dist < want ? 1 : 0.5;
        this.pos.x += f.nx * (want - f.dist) * k;
        this.pos.z += f.nz * (want - f.dist) * k;
        if (this.pos.y > c.top - STEP * 0.5) {
          // mantle onto the top
          this.pos.y = c.top + 0.01;
          const mx = this.pos.x - f.nx * (RADIUS * 2 + 0.2), mz = this.pos.z - f.nz * (RADIUS * 2 + 0.2);
          // narrow tops (fence posts/rails): land in the middle instead of overshooting
          if (footprint(c, mx, mz).dist > RADIUS * 0.4) { this.pos.x = c.x; this.pos.z = c.z; }
          else { this.pos.x = mx; this.pos.z = mz; }
          this.wall = null;
          this.velY = 0;
        }
        const g = terrainHeight(this.pos.x, this.pos.z);
        if (this.pos.y <= g) { this.pos.y = g; this.wall = null; }
        return;
      }
    }

    // ---- Horizontal movement ----
    const move = has ? wish.clone().normalize().multiplyScalar(speed * dt) : new THREE.Vector2();
    if (this.knock.lengthSq() > 0.01) {
      move.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.exp(-5 * dt));
    }
    if (has) this.yaw = lerpAngle(this.yaw, Math.atan2(wish.x, wish.y), Math.min(1, dt * 12));
    let nx = this.pos.x + move.x, nz = this.pos.z + move.y;
    const len = Math.hypot(move.x, move.y) || 1;
    const dx = move.x / len, dz = move.y / len;
    const hit = has ? this.blockedAt(nx, nz, dx, dz) : this.blocking(nx, nz);
    if (hit) {
      if (hit.c.climbable && has) {
        // start climbing
        this.wall = hit.c;
        this.velY = 0;
        nx = this.pos.x; nz = this.pos.z;
      } else {
        // slide along the obstacle
        if (!this.blockedAt(nx, this.pos.z, Math.sign(dx), 0)) nz = this.pos.z;
        else if (!this.blockedAt(this.pos.x, nz, 0, Math.sign(dz))) nx = this.pos.x;
        else { nx = this.pos.x; nz = this.pos.z; }
      }
    }
    // never end up inside a non-climbable obstacle (cactus, bush, rock): push back out
    for (const c of this.colliders) {
      if (c.climbable || c.top <= this.pos.y + STEP || c.bottom >= this.pos.y + HEIGHT) continue;
      const f = footprint(c, nx, nz, this.pos.y + 0.05);
      if (f.dist < RADIUS) { nx += f.nx * (RADIUS - f.dist); nz += f.nz * (RADIUS - f.dist); }
    }
    // stay inside the world
    const r = Math.hypot(nx, nz);
    if (r > worldRadius()) { nx *= worldRadius() / r; nz *= worldRadius() / r; }
    const moved = Math.hypot(nx - this.pos.x, nz - this.pos.z);
    this.speed = moved / Math.max(dt, 1e-4);
    this.pos.x = nx; this.pos.z = nz;

    // ---- Vertical ----
    const ground = this.groundAt(this.pos.x, this.pos.z);
    if (this.onGround && input.jump) {
      this.velY = JUMP;
      this.onGround = false;
    }
    this.velY -= GRAVITY * dt;
    this.pos.y += this.velY * dt;
    // head bump on overhangs (e.g. under the wagon / arch)
    for (const c of this.colliders) {
      if (c.bottom > -50 && this.velY > 0 && footprint(c, this.pos.x, this.pos.z).dist < RADIUS
        && this.pos.y + HEIGHT > c.bottom && this.pos.y < c.bottom) {
        this.pos.y = c.bottom - HEIGHT; this.velY = 0;
      }
    }
    const stickDown = this.onGround && this.velY <= 0 && this.pos.y - ground < 0.6;
    if (this.pos.y <= ground || stickDown) {
      if (!this.onGround && this.velY < -6) this.landed = true;
      this.pos.y = ground;
      this.velY = 0;
      this.onGround = true;
    } else if (this.pos.y > ground + 0.05) {
      this.onGround = false;
    }
  }

  get climbing() { return !!this.wall; }
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
