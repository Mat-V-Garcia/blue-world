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
  // the ring that marks where a pounce will land
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(C.LAND_R * 0.82, C.LAND_R, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x2a2030, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  ring.visible = false; scene.add(ring);
  cat.ring = ring;

  let timer = 0, rest = 0, speed = 0, stalkT = 0, pending = null;
  let pounceCD = 0, air = 0, second = false; // air: 0..1 through a leap; second: the sleepy follow-up pounce
  let grace = 0;                             // just got up: her side can't hurt for this long
  const from = new THREE.Vector2(), target = new THREE.Vector2();
  let bait = null;                           // the dropped tail she is after
  let pose = { roll: 0, sy: 1 };

  const sleepy = () => cat.health / cat.maxHealth < C.SLEEPY_BELOW;
  const heightOver = (p) => p.pos.y - terrainHeight(p.pos.x, p.pos.z);
  // tucked under furniture too low for her to follow
  const hiding = (p) => {
    const g = terrainHeight(p.pos.x, p.pos.z);
    return colliders.some((c) => c.bottom >= p.pos.y + 0.3 && c.bottom - g <= C.LOW_ROOF && footprint(c, p.pos.x, p.pos.z).dist <= 0);
  };
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
  const stalk = (pause = 0) => { cat.state = 'stalk'; rest = pause; stalkT = 0; ring.visible = false; };
  // getting up with the lizard still on or under her: it is tipped off, not hurt
  const getUp = (ev, player, pause = 0) => {
    if (Math.hypot(player.pos.x - cat.pos.x, player.pos.z - cat.pos.z) < C.BODY_R) ev.bounced = true;
    grace = 1; stalk(pause);
  };
  // crouch facing the lizard; the leap goes to where it is now (never further than she can jump, never out of the yard)
  function crouch(px, pz, secs) {
    let dx = px - cat.pos.x, dz = pz - cat.pos.z;
    const d = Math.hypot(dx, dz) || 1e-6, k = Math.min(1, C.POUNCE_MAX / d);
    const [tx, tz] = clampToWorld(cat.pos.x + dx * k, cat.pos.z + dz * k, C.BODY_R);
    target.set(tx, tz);
    cat.yaw = Math.atan2(dx, dz);
    cat.state = 'crouch'; timer = secs; pending = 'pounce';
    ring.position.set(tx, terrainHeight(tx, tz) + 0.06, tz); ring.visible = true;
  }

  function reset() {
    cat.pos.set(sx, terrainHeight(sx, sz), sz);
    cat.yaw = 0; cat.health = cat.maxHealth; cat.state = 'hidden';
    timer = 0; rest = 0; speed = 0; stalkT = 0; pending = null;
    pounceCD = 0; air = 0; second = false; grace = 0; bait = null;
    pose = { roll: 0, sy: 1 };
    rig.visible = false; ring.visible = false;
  }
  reset();
  cat.reset = reset;

  // She comes over the fence. Returns false if she is already out.
  cat.emerge = () => {
    if (cat.state !== 'hidden') return false;
    cat.state = 'emerge'; timer = C.EMERGE; rig.visible = true;
    return true;
  };

  // A dropped tail: she can't resist it. Returns false if she is too busy or too far.
  cat.baitWith = (pos) => {
    const s = cat.state;
    if (s !== 'stalk' && s !== 'swipeWind' && s !== 'crouch' && s !== 'yawn' && s !== 'fish') return false;
    if (Math.hypot(pos.x - cat.pos.x, pos.z - cat.pos.z) > C.TAIL_RANGE) return false;
    bait = pos.clone(); cat.state = 'trot'; timer = 4; pending = null; ring.visible = false;
    return true;
  };

  cat.update = (dt, player, canHurt) => {
    const ev = { caught: null, hit: false, bounced: false, defeated: false, stuckNow: false, windupNow: null, yawnNow: false };
    if (cat.state === 'hidden') return ev;
    const px = player.pos.x, pz = player.pos.z;
    let dx = px - cat.pos.x, dz = pz - cat.pos.z, d = Math.hypot(dx, dz) || 1e-6;
    const high = heightOver(player), hid = hiding(player);
    speed = 0; pounceCD -= dt; grace -= dt;

    if (cat.state === 'emerge') {
      turnTo(px, pz, dt);
      timer -= dt;
      if (timer <= 0) stalk();
    } else if (cat.state === 'stalk') {
      turnTo(px, pz, dt);
      stalkT += dt;
      if (rest > 0) rest -= dt;
      else if (hid) {
        // it is under the furniture: walk over, lie down and fish for it
        if (d <= C.FISH_DIST + C.BODY_R) { cat.state = 'fish'; timer = C.FISH_TIME; pending = 'fish'; }
        else step(dx / d, dz / d, C.STALK, dt);
      } else if (high >= C.REACH_UP) {
        // out of reach: sit below and wait
        if (d > C.CIRCLE_R - 1) step(dx / d, dz / d, C.STALK, dt);
      } else if (d <= C.SWIPE_RANGE) {
        cat.state = 'swipeWind'; timer = C.SWIPE_WINDUP; pending = 'swipe';
        cat.yaw = Math.atan2(dx, dz); // the paw goes where she is looking now
      } else if (pounceCD <= 0 && d >= C.POUNCE_MIN && d <= C.POUNCE_MAX && high < 1) {
        second = false;
        if (sleepy()) { cat.state = 'yawn'; timer = C.YAWN; ev.yawnNow = true; } else crouch(px, pz, C.CROUCH);
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
    } else if (cat.state === 'yawn') {
      timer -= dt;
      if (timer <= 0) crouch(px, pz, C.CROUCH);
    } else if (cat.state === 'crouch') {
      timer -= dt;
      if (hid) stalk();
      else if (timer <= 0) { cat.state = 'pounce'; air = 0; from.set(cat.pos.x, cat.pos.z); }
    } else if (cat.state === 'pounce') {
      air = Math.min(1, air + dt / C.AIR);
      cat.pos.x = from.x + (target.x - from.x) * air; cat.pos.z = from.y + (target.y - from.y) * air;
      speed = C.TROT;
      if (air >= 1) {
        air = 0; ring.visible = false; pounceCD = C.POUNCE_CD;
        dx = px - cat.pos.x; dz = pz - cat.pos.z; d = Math.hypot(dx, dz) || 1e-6;
        if (canHurt && d < C.LAND_R && high < C.BACK_UP - 0.6) { ev.caught = cat.pos.clone(); stalk(REST); }
        else if (sleepy() && !second) { second = true; crouch(px, pz, C.CROUCH * 0.6); } // sleepy and wild: straight into another
        else { cat.state = 'flop'; timer = C.FLOP; ev.stuckNow = true; }
      }
    } else if (cat.state === 'flop') {
      timer -= dt;
      if (timer <= 0) getUp(ev, player);
    } else if (cat.state === 'recover') {
      timer -= dt;
      if (timer <= 0) getUp(ev, player);
    } else if (cat.state === 'trot') {
      const bx = bait.x - cat.pos.x, bz = bait.z - cat.pos.z, bd = Math.hypot(bx, bz) || 1e-6;
      turnTo(bait.x, bait.z, dt);
      timer -= dt;
      if (bd <= C.BODY_R * 0.9 || timer <= 0) { cat.state = 'play'; timer = C.PLAY; } // (or as near as the furniture lets her)
      else step(bx / bd, bz / bd, C.TROT, dt);
    } else if (cat.state === 'play') {
      turnTo(bait.x, bait.z, dt);
      timer -= dt;
      if (timer <= 0) { bait = null; getUp(ev, player); }
    } else if (cat.state === 'fish') {
      turnTo(px, pz, dt);
      timer -= dt;
      if (!hid) stalk(0.5);
      else if (timer <= 0) { if (canHurt) ev.caught = cat.pos.clone(); stalk(REST); } // batted out from under it
    }
    cat.pos.y = terrainHeight(cat.pos.x, cat.pos.z);

    // --- the lizard touching her or landing on her ---
    const s = cat.state, up = player.pos.y - cat.pos.y;
    const onFeet = s === 'stalk' || s === 'swipeWind' || s === 'swipe' || s === 'crouch' || s === 'yawn';
    if (d < C.BODY_R && !ev.caught && !ev.bounced) {
      if (s === 'flop' || s === 'play') {
        if (player.velY < 0 && up >= 0.4 && up <= C.BACK_FLOP + 1 && !ev.stuckNow) {
          ev.hit = true; cat.health -= 1;
          if (cat.health <= 0) { cat.health = 0; cat.state = 'defeated'; ev.defeated = true; ring.visible = false; }
          else { cat.state = 'recover'; timer = C.RECOVER; }
        }
      } else if (onFeet) {
        if (player.velY < 0 && Math.abs(up - C.BACK_UP) <= 0.6) ev.bounced = true;
        else if (up < C.BACK_UP - 0.6 && canHurt && grace <= 0) { ev.caught = cat.pos.clone(); stalk(REST); }
      }
    }

    if (pending && cat.state !== 'stalk') ev.windupNow = pending;
    pending = null;

    // --- where and how she is drawn ---
    const now = cat.state;
    const want = now === 'flop' ? { roll: 1.35, sy: 1 }
      : now === 'defeated' ? { roll: 0, sy: 0.55 }
        : now === 'crouch' ? { roll: 0, sy: 0.78 }
          : now === 'play' || now === 'fish' ? { roll: 0, sy: 0.5 }
          : { roll: 0, sy: 1 };
    const k = Math.min(1, dt * (now === 'defeated' ? 1.2 : 9));
    pose.roll += (want.roll - pose.roll) * k; pose.sy += (want.sy - pose.sy) * k;
    rig.position.copy(cat.pos);
    if (now === 'emerge') rig.position.y += FROM * (timer / C.EMERGE) ** 2;
    if (now === 'pounce') rig.position.y += C.ARC * Math.sin(Math.PI * air);
    rig.rotation.y = cat.yaw;
    tilt.rotation.z = pose.roll; tilt.scale.y = pose.sy;
    v.update(dt, speed / C.STALK, now);
    return ev;
  };
  return cat;
}
