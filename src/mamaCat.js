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
  // measured on the model at scale 6.5: 6.5 long, 2.6 wide, back 3.0 up (1.5 when she lies on her side)
  BODY_R: 2.2, BACK_UP: 3.0, BACK_FLOP: 1.0,
  // Landing on her while she is flopped or playing. Generous on purpose: anywhere along her
  // body counts (HIT_R is half her length), from just off the ground (HIT_LOW) to well above
  // her (HIT_HIGH), and on the way up as well as on the way down.
  HIT_R: 3.3, HIT_LOW: 0.2, HIT_HIGH: 2.6,
  SLEEPY_BELOW: 0.5, YAWN: 1.0, EMERGE: 1.5,
  DOUBLE: false,                    // true: every missed pounce is followed by a second, not only when she is sleepy
};
const REST = 1.0; // stands still this long after catching the lizard

// makeModel(): { root, update(dt, speed, state, { pace, look }) }, 1 unit long, facing +Z.
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
  let heading = 0, aim = 0;                  // the way she last walked; the way a paw or a pounce is aimed
  const from = new THREE.Vector2(), target = new THREE.Vector2();
  let bait = null;                           // the dropped tail she is after
  // getting round furniture: which way she slides along it, and how long she has gone nowhere
  let slide = 1, stuckT = 0, tries = 0, nearest = Infinity, hop = false; // hop: a short leap over what blocks her (no flop after it)
  const anchor = new THREE.Vector2();        // where the lizard was at the last check
  let pose = { roll: 0, sy: 1 };

  const sleepy = () => cat.health / cat.maxHealth < C.SLEEPY_BELOW;
  const heightOver = (p) => p.pos.y - terrainHeight(p.pos.x, p.pos.z);
  // tucked under furniture too low for her to follow
  const hiding = (p) => {
    const g = terrainHeight(p.pos.x, p.pos.z);
    return colliders.some((c) => c.bottom >= p.pos.y + 0.3 && c.bottom - g <= C.LOW_ROOF && footprint(c, p.pos.x, p.pos.z).dist <= 0);
  };
  const turn = (to, dt, rate = 6) => {
    const d = Math.atan2(Math.sin(to - cat.yaw), Math.cos(to - cat.yaw));
    cat.yaw += d * Math.min(1, dt * rate);
  };
  const turnTo = (x, z, dt) => turn(Math.atan2(x - cat.pos.x, z - cat.pos.z), dt);
  // one step in direction (ux, uz), sliding round anything too tall to step over
  function step(ux, uz, pace, dt) {
    const len = pace * dt;
    let nx = cat.pos.x + ux * len, nz = cat.pos.z + uz * len;
    const g = terrainHeight(nx, nz);
    for (const c of colliders) {
      if (c.top <= g + 0.5 || c.bottom >= g + C.BACK_UP + 1.5) continue; // low enough to step over, or a roof above her ears
      const f = footprint(c, nx, nz, g + 0.3);
      if (f.dist < C.BODY_R) {
        nx += f.nx * (C.BODY_R - f.dist) - f.nz * len * 0.6 * slide;
        nz += f.nz * (C.BODY_R - f.dist) + f.nx * len * 0.6 * slide;
      }
    }
    [nx, nz] = clampToWorld(nx, nz, C.BODY_R);
    speed = Math.hypot(nx - cat.pos.x, nz - cat.pos.z) / Math.max(dt, 1e-4);
    if (speed > 0.2) heading = Math.atan2(nx - cat.pos.x, nz - cat.pos.z);
    cat.pos.x = nx; cat.pos.z = nz;
  }
  const stalk = (pause = 0) => { cat.state = 'stalk'; rest = pause; stalkT = 0; ring.visible = false; stuckT = 0; tries = 0; nearest = Infinity; };
  // Walking after the lizard. If a second and a half of it brings her no nearer to a lizard
  // that is staying put, she is caught on the furniture: first she tries sliding round it
  // the other way, and if that is no better she hops over it.
  function walk(ux, uz, pace, dt, px, pz) {
    step(ux, uz, pace, dt);
    stuckT += dt;
    if (stuckT < 1.5) return;
    const d = Math.hypot(px - cat.pos.x, pz - cat.pos.z), ran = Math.hypot(px - anchor.x, pz - anchor.y);
    stuckT = 0; anchor.set(px, pz);
    if (d < nearest - 0.5 || ran > 2) { nearest = Math.min(nearest, d); if (ran > 2) nearest = d; tries = 0; return; }
    if (++tries === 1) { slide = -slide; return; }
    tries = 0; nearest = Infinity; hop = true; crouch(px, pz, C.CROUCH * 0.6);
  }
  // getting up with the lizard still on or under her: it is tipped off, not hurt
  const getUp = (ev, player, pause = 0) => {
    if (Math.hypot(player.pos.x - cat.pos.x, player.pos.z - cat.pos.z) < C.BODY_R) ev.bounced = true;
    grace = 1; stalk(pause);
  };
  // crouch facing the lizard; the leap goes to where it is now (never further than she can jump, never out of the yard)
  function crouch(px, pz, secs) {
    let dx = px - cat.pos.x, dz = pz - cat.pos.z;
    const d = Math.hypot(dx, dz) || 1e-6;
    const k = Math.min(1, (hop ? Math.min(C.POUNCE_MAX, Math.max(0, d - C.SWIPE_RANGE)) : C.POUNCE_MAX) / d); // a hop stops short of the lizard
    const [tx, tz] = clampToWorld(cat.pos.x + dx * k, cat.pos.z + dz * k, C.BODY_R);
    target.set(tx, tz);
    aim = Math.atan2(dx, dz);
    cat.state = 'crouch'; timer = secs; pending = 'pounce';
    ring.position.set(tx, terrainHeight(tx, tz) + 0.06, tz); ring.visible = true;
  }

  function reset() {
    cat.pos.set(sx, terrainHeight(sx, sz), sz);
    cat.yaw = 0; cat.health = cat.maxHealth; cat.state = 'hidden';
    timer = 0; rest = 0; speed = 0; stalkT = 0; pending = null;
    pounceCD = 0; air = 0; second = false; grace = 0; bait = null;
    slide = 1; stuckT = 0; tries = 0; nearest = Infinity; hop = false;
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
    if (pos.y - terrainHeight(pos.x, pos.z) >= C.REACH_UP) return false; // up on a perch where she can't get at it
    bait = pos.clone(); cat.state = 'trot'; timer = 4; pending = null; ring.visible = false; hop = false;
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
      stalkT += dt;
      if (rest > 0) rest -= dt;
      else if (hid) {
        // it is under the furniture: walk over, lie down and fish for it
        if (d <= C.FISH_DIST + C.BODY_R) { cat.state = 'fish'; timer = C.FISH_TIME; pending = 'fish'; }
        else walk(dx / d, dz / d, C.STALK, dt, px, pz);
      } else if (high >= C.REACH_UP) {
        // out of reach: sit below and wait
        if (d > C.CIRCLE_R - 1) walk(dx / d, dz / d, C.STALK, dt, px, pz);
      } else if (d <= C.SWIPE_RANGE) {
        cat.state = 'swipeWind'; timer = C.SWIPE_WINDUP; pending = 'swipe';
        aim = Math.atan2(dx, dz); // the paw goes where the lizard is now
      } else if (pounceCD <= 0 && d >= C.POUNCE_MIN && d <= C.POUNCE_MAX && high < 1) {
        second = false; hop = false;
        if (sleepy()) { cat.state = 'yawn'; timer = C.YAWN; ev.yawnNow = true; } else crouch(px, pz, C.CROUCH);
      } else {
        // a circle round the lizard that tightens until she is close enough to swipe
        const R = Math.max(C.SWIPE_RANGE - 0.5, C.CIRCLE_R - stalkT * 1.2);
        const inward = Math.max(-1, Math.min(1, d - R)), round = d < C.CIRCLE_R + 2 ? 0.6 : 0;
        const ux = (dx / d) * inward - (dz / d) * round, uz = (dz / d) * inward + (dx / d) * round;
        const n = Math.hypot(ux, uz) || 1;
        walk(ux / n, uz / n, d > C.POUNCE_MAX + 4 ? C.TROT : C.STALK, dt, px, pz); // she trots to catch up from right across the yard
      }
      // her body points the way she walks (her head watches the lizard); standing, she turns to face it
      if (cat.state === 'stalk') { if (speed > 0.2) turn(heading, dt, 8); else turnTo(px, pz, dt); }
    } else if (cat.state === 'swipeWind') {
      turn(aim, dt, 14);
      timer -= dt;
      if (timer <= 0) { cat.state = 'swipe'; timer = C.SWIPE_TIME; }
    } else if (cat.state === 'swipe') {
      let a = Math.atan2(dx, dz) - cat.yaw;
      a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      const jumped = !player.climbing && player.onGround === false && high >= C.SWIPE_CLEAR; // clinging to a wall is not a jump
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
      turn(aim, dt, 12);
      timer -= dt;
      if (hid && !hop) stalk();
      else if (timer <= 0) { cat.state = 'pounce'; air = 0; from.set(cat.pos.x, cat.pos.z); cat.yaw = Math.atan2(target.x - cat.pos.x, target.y - cat.pos.z); }
    } else if (cat.state === 'pounce') {
      air = Math.min(1, air + dt / C.AIR);
      cat.pos.x = from.x + (target.x - from.x) * air; cat.pos.z = from.y + (target.y - from.y) * air;
      speed = C.TROT;
      if (air >= 1) {
        air = 0; ring.visible = false; pounceCD = C.POUNCE_CD;
        dx = px - cat.pos.x; dz = pz - cat.pos.z; d = Math.hypot(dx, dz) || 1e-6;
        if (canHurt && d < C.LAND_R && high < C.BACK_UP - 0.6 && !hid) { ev.caught = cat.pos.clone(); hop = false; stalk(REST); }
        else if (hop) { hop = false; stalk(0.5); } // only getting over the furniture: she lands on her feet
        else if ((C.DOUBLE || sleepy()) && !second) { second = true; crouch(px, pz, C.CROUCH * 0.6); } // sleepy and wild: straight into another
        else { cat.state = 'flop'; timer = C.FLOP; ev.stuckNow = true; }
      }
    } else if (cat.state === 'flop') {
      timer -= dt;
      if (timer <= 0) getUp(ev, player);
    } else if (cat.state === 'recover') {
      timer -= dt;
      if (timer <= 0) getUp(ev, player, 0.8); // a breath before she starts again
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
    const down = s === 'flop' || s === 'play';
    const airborne = player.velY < 0 || (player.onGround === false && player.velY > 0);
    if (d < (down ? C.HIT_R : C.BODY_R) && !ev.caught && !ev.bounced) {
      if (down) {
        if (airborne && up >= C.HIT_LOW && up <= C.HIT_HIGH && !ev.stuckNow) {
          ev.hit = true; cat.health -= 1;
          if (cat.health <= 0) { cat.health = 0; cat.state = 'defeated'; ev.defeated = true; ring.visible = false; }
          else { cat.state = 'recover'; timer = C.RECOVER; }
        }
      } else if (onFeet) {
        if (player.velY < 0 && Math.abs(up - C.BACK_UP) <= 0.6) ev.bounced = true;
        else if (up < C.BACK_UP - 0.6 && canHurt && grace <= 0 && !hid) { ev.caught = cat.pos.clone(); stalk(REST); }
      }
    }

    if (pending && cat.state !== 'stalk') ev.windupNow = pending;
    pending = null;

    // --- where and how she is drawn ---
    const now = cat.state;
    // (lying down to play, fish or sleep is the model's own pose)
    const want = now === 'flop' ? { roll: 1.35, sy: 1 } : now === 'crouch' ? { roll: 0, sy: 0.78 } : { roll: 0, sy: 1 };
    const k = Math.min(1, dt * (now === 'defeated' ? 1.2 : 9));
    pose.roll += (want.roll - pose.roll) * k; pose.sy += (want.sy - pose.sy) * k;
    rig.position.copy(cat.pos);
    if (now === 'emerge') rig.position.y += FROM * (timer / C.EMERGE) ** 2;
    if (now === 'pounce') rig.position.y += C.ARC * Math.sin(Math.PI * air);
    rig.rotation.y = cat.yaw;
    tilt.rotation.z = pose.roll; tilt.scale.y = pose.sy;
    // speed as a share of her stalking pace (what the kitten stand-in expects), then the real
    // pace in world units and the angle from her nose round to the lizard
    v.update(dt, speed / C.STALK, now, { pace: speed, look: Math.atan2(Math.sin(Math.atan2(px - cat.pos.x, pz - cat.pos.z) - cat.yaw), Math.cos(Math.atan2(px - cat.pos.x, pz - cat.pos.z) - cat.yaw)) });
    return ev;
  };
  return cat;
}
