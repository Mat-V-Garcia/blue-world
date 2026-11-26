import * as THREE from 'three';
import { terrainHeight, footprint, clampToWorld } from './world.js';

// The third boss: Mama Cat, the kittens' mother. She only wants to play, so she is never
// hurt. She stalks the lizard in a closing circle, swipes a paw at it up close and
// pounces from further off. A pounce that misses leaves her flopped on her side, and a
// dropped tail keeps her busy: those are the moments to land on her back. Six landings
// and she curls up asleep. Like the other bosses she is never a solid collider: main.js
// acts on the events update() reports.
export const CAT = {
  HEALTH: 6,
  STALK: 3.2, CIRCLE_R: 7,          // stalking speed; how far out she starts to circle
  SWIPE_RANGE: 4.5, SWIPE_REACH: 5, SWIPE_ARC: 1.0, // starts a swipe this close; the paw reaches this far, this wide (radians each side)
  SWIPE_WINDUP: 0.6, SWIPE_TIME: 0.25, SWIPE_CLEAR: 0.6, SWIPE_REST: 0.8, // SWIPE_CLEAR: a jump this high clears the paw
  POUNCE_MIN: 6, POUNCE_MAX: 16, POUNCE_CD: 2.5, CROUCH: 0.9, AIR: 0.8, ARC: 4, LAND_R: 2.4,
  FLOP: 2.0, RECOVER: 1.5,
  TROT: 6, PLAY: 3.0, TAIL_RANGE: 20,
  FISH_DIST: 3.5, FISH_TIME: 3.0, LOW_ROOF: 1.5, // LOW_ROOF: furniture this low hides the lizard from her
  REACH_UP: 4,                      // a lizard perched lower than this can still be swiped
  BODY_R: 2.6, BACK_UP: 3.4, BACK_FLOP: 1.0,
  SLEEPY_BELOW: 0.5, YAWN: 1.0, EMERGE: 1.5,
};
const REST = 1.0; // stands still this long after catching the lizard

// makeModel(): { root, update(dt, speed, state) }, 1 unit long, facing +Z.
// cfg: { x, z, health?, scale?, emergeFrom? (height she drops in from), tune? (overrides for CAT) }
export function createMamaCat(scene, colliders, makeModel, cfg = {}) {
  const C = { ...CAT, ...cfg.tune }, SCALE = cfg.scale ?? 6.5, FROM = cfg.emergeFrom ?? 9;
  const v = makeModel();
  const rig = new THREE.Group(), tilt = new THREE.Group();
  v.root.scale.setScalar(SCALE);
  tilt.add(v.root); rig.add(tilt); scene.add(rig);

  const sx = cfg.x ?? 0, sz = cfg.z ?? 0;
  const cat = {
    pos: new THREE.Vector3(), yaw: 0, health: 0, maxHealth: cfg.health ?? C.HEALTH,
    state: 'hidden', bodyR: C.BODY_R, rig,
  };
  let timer = 0, rest = 0, speed = 0, stalkT = 0, pending = null;

  const groundUnder = (p) => p.pos.y - terrainHeight(p.pos.x, p.pos.z);
  const turnTo = (x, z, dt) => {
    let d = Math.atan2(x - cat.pos.x, z - cat.pos.z) - cat.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    cat.yaw += d * Math.min(1, dt * 6);
  };
  // one step in direction (ux, uz), sliding round anything too tall to step over
  function step(ux, uz, pace, dt) {
    const len = pace * dt;
    let nx = cat.pos.x + ux * len, nz = cat.pos.z + uz * len;
    const g = terrainHeight(nx, nz);
    for (const c of colliders) {
      if (c.top <= g + 0.5) continue;
      const f = footprint(c, nx, nz, g + 0.3);
      if (f.dist < C.BODY_R) {
        nx += f.nx * (C.BODY_R - f.dist) - f.nz * len * 0.6;
        nz += f.nz * (C.BODY_R - f.dist) + f.nx * len * 0.6;
      }
    }
    [nx, nz] = clampToWorld(nx, nz, C.BODY_R);
    speed = Math.hypot(nx - cat.pos.x, nz - cat.pos.z) / Math.max(dt, 1e-4);
    cat.pos.x = nx; cat.pos.z = nz;
  }
  const stalk = (pause = 0) => { cat.state = 'stalk'; rest = pause; stalkT = 0; };

  function reset() {
    cat.pos.set(sx, terrainHeight(sx, sz), sz);
    cat.yaw = 0; cat.health = cat.maxHealth; cat.state = 'hidden';
    timer = 0; rest = 0; speed = 0; stalkT = 0; pending = null;
    rig.visible = false;
  }
  reset();
  cat.reset = reset;

  // She comes over the fence. Returns false if she is already out.
  cat.emerge = () => {
    if (cat.state !== 'hidden') return false;
    cat.state = 'emerge'; timer = C.EMERGE; rig.visible = true;
    return true;
  };

  cat.update = (dt, player, canHurt) => {
    const ev = { caught: null, hit: false, bounced: false, defeated: false, stuckNow: false, windupNow: null, yawnNow: false };
    if (cat.state === 'hidden') return ev;
    const px = player.pos.x, pz = player.pos.z;
    const dx = px - cat.pos.x, dz = pz - cat.pos.z, d = Math.hypot(dx, dz) || 1e-6;
    const high = groundUnder(player);
    speed = 0;

    if (cat.state === 'emerge') {
      turnTo(px, pz, dt);
      timer -= dt;
      if (timer <= 0) stalk();
    } else if (cat.state === 'stalk') {
      turnTo(px, pz, dt);
      stalkT += dt;
      if (rest > 0) rest -= dt;
      else if (d <= C.SWIPE_RANGE) {
        cat.state = 'swipeWind'; timer = C.SWIPE_WINDUP; pending = 'swipe';
        cat.yaw = Math.atan2(dx, dz); // the paw goes where she is looking now
      } else {
        // a circle round the lizard that tightens until she is close enough to swipe
        const R = Math.max(C.SWIPE_RANGE - 0.5, C.CIRCLE_R - stalkT * 1.2);
        const inward = Math.max(-1, Math.min(1, d - R)), round = d < C.CIRCLE_R + 2 ? 0.6 : 0;
        const ux = (dx / d) * inward - (dz / d) * round, uz = (dz / d) * inward + (dx / d) * round;
        const n = Math.hypot(ux, uz) || 1;
        step(ux / n, uz / n, C.STALK, dt);
      }
    } else if (cat.state === 'swipeWind') {
      timer -= dt;
      if (timer <= 0) { cat.state = 'swipe'; timer = C.SWIPE_TIME; }
    } else if (cat.state === 'swipe') {
      let a = Math.atan2(dx, dz) - cat.yaw;
      a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      const jumped = player.onGround === false && high >= C.SWIPE_CLEAR;
      if (canHurt && d <= C.SWIPE_REACH && a <= C.SWIPE_ARC && !jumped && high < C.REACH_UP) {
        ev.caught = cat.pos.clone(); stalk(REST);
      } else {
        timer -= dt;
        if (timer <= 0) stalk(C.SWIPE_REST);
      }
    }
    cat.pos.y = terrainHeight(cat.pos.x, cat.pos.z);

    // --- the lizard touching her or landing on her ---
    const up = player.pos.y - cat.pos.y;
    if (d < C.BODY_R && cat.state !== 'emerge' && !ev.caught) {
      if (player.velY < 0 && Math.abs(up - C.BACK_UP) <= 0.6) ev.bounced = true;
      else if (up < C.BACK_UP - 0.6 && canHurt) { ev.caught = cat.pos.clone(); stalk(REST); }
    }

    if (pending && cat.state !== 'stalk') ev.windupNow = pending;
    pending = null;

    // --- where she is drawn ---
    rig.position.copy(cat.pos);
    if (cat.state === 'emerge') rig.position.y += FROM * (timer / C.EMERGE) ** 2;
    rig.rotation.y = cat.yaw;
    v.update(dt, speed / C.STALK, cat.state);
    return ev;
  };
  return cat;
}
