import * as THREE from 'three';
import { terrainHeight, footprint, clampToWorld } from './world.js';

// The second boss: a peregrine falcon over the Fullerton shops. It circles above the
// lizard, hovers and screeches, then dives at it. A dive that misses leaves it sprawled
// on the ground for a moment: that is the only time it can be hurt, by landing on its
// back. A dive at a lizard hiding under something bonks into the roof instead (safe, but
// it recovers too fast to be an easy hit). Like the tarantula it is never a solid
// collider: main.js acts on the events update() reports.
export const FALCON = {
  HEALTH: 6, FLY: 14, ALT: 11, ORBIT_R: 9, ORBIT_SPIN: 0.9,
  CIRCLE_TIME: 3, WINDUP: 0.9, DIVE_SPEED: 28, CATCH_R: 1.7,
  STUCK_MAX: 2.4, STUCK_MIN: 1.7, BONK: 1.0,
  BODY_R: 1.6,          // landing radius while it is down
  BACK_STUCK: 0.9,      // back height while it is down (reachable by a jump)
  TAIL_RANGE: 25, ANGRY_BELOW: 0.5, ANGRY: 0.7, // angry: circling and hovering take 0.7 as long
  // LEAD: how much it aims ahead of a moving lizard. 0 = at where the lizard is (running in
  // a straight line is enough to dodge); 1 = right where a lizard that keeps going will be
  // (it has to swerve or stop when the dive starts). The ring shows the spot either way.
  LEAD: 0,
};

// makeModel(): { root, update(dt, speed, mode) } (the falcon model, or the simple stand-in).
// cfg: { perch: {x, y, z}, health?, scale?, yaw? }  It sits on its perch until emerge().
//   tune?: overrides for the numbers in FALCON
export function createFalcon(scene, colliders, makeModel, cfg = {}) {
  const B = { ...FALCON, ...cfg.tune };
  const v = makeModel();
  const rig = new THREE.Group(), tilt = new THREE.Group();
  v.root.scale.setScalar(cfg.scale ?? 1);
  tilt.add(v.root); rig.add(tilt); scene.add(rig);

  // its shadow on the ground, and the ring that shows where a dive will land
  const flat = (geo, color, opacity) => {
    const m = new THREE.Mesh(geo.rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.visible = false; scene.add(m); return m;
  };
  const shadow = flat(new THREE.CircleGeometry(1.4, 20), 0x000000, 0.3);
  const ring = flat(new THREE.RingGeometry(B.CATCH_R - 0.25, B.CATCH_R, 28), 0xe0342a, 0.85);

  const perch = cfg.perch ?? { x: 0, y: 12, z: 0 };
  const boss = {
    pos: new THREE.Vector3(), yaw: 0, health: 0, maxHealth: cfg.health ?? B.HEALTH,
    state: 'hidden', bodyR: B.BODY_R, rig,
    ring, // (main.js keeps it red in the inverted level)
  };
  let timer = 0, orbit = 0, speed = 0, bait = null, pendingWindup = false;
  const tgt = new THREE.Vector3(), dir = new THREE.Vector3(), tmp = new THREE.Vector3();
  let len = 0, travelled = 0;
  let pose = { rx: 0, rz: 0, sy: 1 };
  // how fast the lizard is moving over the ground (for aiming ahead of it)
  const last = new THREE.Vector3(), vel = new THREE.Vector2();
  let seen = false;
  // where to dive: the lizard, or ahead of it by as far as it will get while the dive is on its way
  const aim = (player) => {
    const p = player.pos;
    tgt.copy(p);
    if (!B.LEAD) return;
    const t = tmp.subVectors(p, boss.pos).length() / B.DIVE_SPEED * B.LEAD;
    const [x, z] = clampToWorld(p.x + vel.x * t, p.z + vel.y * t, 1);
    tgt.set(x, Math.max(p.y, terrainHeight(x, z)), z);
  };

  const angry = () => boss.health / boss.maxHealth < B.ANGRY_BELOW;
  const pace = () => (angry() ? B.ANGRY : 1);
  const faceTo = (x, z, dt) => {
    let d = Math.atan2(x - boss.pos.x, z - boss.pos.z) - boss.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    boss.yaw += d * Math.min(1, dt * 6);
  };
  function flyTo(x, y, z, dt) {
    tmp.set(x - boss.pos.x, y - boss.pos.y, z - boss.pos.z);
    const d = tmp.length();
    if (d < 0.05) return;
    if (Math.hypot(tmp.x, tmp.z) > 0.5) faceTo(x, z, dt);
    boss.pos.addScaledVector(tmp, Math.min(d, B.FLY * dt) / d);
    speed = B.FLY;
  }
  const circle = () => { boss.state = 'circle'; timer = B.CIRCLE_TIME * pace(); bait = null; };
  function startWindup() { boss.state = 'windup'; timer = B.WINDUP * pace(); pendingWindup = true; }
  function down(ev, secs) { boss.state = 'stuck'; timer = secs; ev.stuckNow = true; }
  // somewhere on the ground with room for it: nothing tall within its body
  const clear = (x, z) => {
    const g = terrainHeight(x, z);
    return !colliders.some((c) => c.top > g + 0.4 && footprint(c, x, z, g + 0.3).dist < B.BODY_R * 0.7);
  };

  function place(dt) {
    const s = boss.state;
    const want = s === 'windup' ? { rx: -0.4, rz: 0, sy: 1 }
      : s === 'dive' ? { rx: Math.asin(Math.min(1, Math.max(-1, -dir.y))), rz: 0, sy: 1 }
        : s === 'stuck' ? { rx: 0.25, rz: 0, sy: 0.45 }
          : s === 'circle' ? { rx: 0, rz: 0.3, sy: 1 }
            : { rx: 0, rz: 0, sy: 1 };
    const k = Math.min(1, dt * 9);
    pose.rx += (want.rx - pose.rx) * k; pose.rz += (want.rz - pose.rz) * k; pose.sy += (want.sy - pose.sy) * k;
    rig.position.copy(boss.pos);
    rig.rotation.y = boss.yaw;
    tilt.rotation.x = pose.rx; tilt.rotation.z = pose.rz + (s === 'stuck' ? Math.sin(timer * 30) * 0.04 : 0);
    tilt.scale.y = pose.sy;
    const g = terrainHeight(boss.pos.x, boss.pos.z);
    const air = s !== 'hidden' && rig.visible;
    shadow.visible = air;
    if (air) {
      shadow.position.set(boss.pos.x, g + 0.05, boss.pos.z);
      shadow.scale.setScalar(Math.max(0.35, 1 - (boss.pos.y - g) / 30));
    }
    ring.visible = s === 'windup' || s === 'dive';
    if (ring.visible) ring.position.set(tgt.x, tgt.y + 0.06, tgt.z);
    const flying = s === 'circle' || s === 'windup' || s === 'defeated';
    v.update(dt, speed / 2.5, s === 'dive' ? 'dive' : flying ? 'fly' : undefined);
  }

  function reset() {
    boss.pos.set(perch.x, perch.y, perch.z);
    boss.yaw = cfg.yaw ?? 0; boss.health = boss.maxHealth; boss.state = 'hidden';
    timer = 0; orbit = 0; speed = 0; bait = null; pendingWindup = false;
    pose = { rx: 0, rz: 0, sy: 1 };
    seen = false; vel.set(0, 0);
    rig.visible = true;
    place(1);
  }
  reset();

  boss.reset = reset;
  // Leave the perch and start the fight. False if it already has.
  boss.emerge = () => {
    if (boss.state !== 'hidden') return false;
    circle();
    return true;
  };
  // A dropped tail: dive at it instead (and hit the ground there). False if it took no notice.
  boss.baitWith = (pos) => {
    if (boss.state !== 'circle' && boss.state !== 'windup') return false;
    if (Math.hypot(pos.x - boss.pos.x, pos.z - boss.pos.z) > B.TAIL_RANGE) return false;
    bait = pos.clone();
    tgt.copy(bait);
    startWindup();
    return true;
  };
  boss.update = (dt, player, canHurt) => {
    const ev = { caught: null, hit: false, bounced: false, defeated: false, stuckNow: false, bonked: false, windupNow: null, shotNow: false, webbed: false, splat: null };
    if (boss.state === 'hidden') { place(dt); return ev; }
    const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
    speed = 0;
    if (seen && dt > 0) {
      const vx = (px - last.x) / dt, vz = (pz - last.z) / dt;
      // a jump in position (back to the start) is not running
      if (Math.hypot(vx, vz) < 15) vel.lerp(tmp.set(vx, vz, 0), Math.min(1, dt * 10)); else vel.set(0, 0);
    }
    last.copy(player.pos); seen = true;

    if (boss.state === 'circle') {
      orbit += B.ORBIT_SPIN * dt;
      const wy = py + B.ALT;
      flyTo(px + Math.sin(orbit) * B.ORBIT_R, wy, pz + Math.cos(orbit) * B.ORBIT_R, dt);
      // the wait only counts once it is up there and near enough to dive
      if (boss.pos.y >= wy - 2 && Math.hypot(px - boss.pos.x, pz - boss.pos.z) < 16) timer -= dt;
      if (timer <= 0) { aim(player); startWindup(); }
    } else if (boss.state === 'windup') {
      // hovers, following the lizard with its eyes; the spot is fixed when the dive starts
      if (!bait) aim(player);
      faceTo(tgt.x, tgt.z, dt);
      timer -= dt;
      if (timer <= 0) {
        dir.subVectors(tgt, boss.pos);
        len = dir.length() || 1; dir.divideScalar(len);
        travelled = 0;
        if (Math.hypot(dir.x, dir.z) > 0.01) boss.yaw = Math.atan2(dir.x, dir.z);
        boss.state = 'dive';
      }
    } else if (boss.state === 'dive') {
      const step = Math.min(B.DIVE_SPEED * (angry() ? 1.15 : 1) * dt, len - travelled);
      boss.pos.addScaledVector(dir, step); travelled += step;
      speed = B.DIVE_SPEED;
      const p = boss.pos, g = terrainHeight(p.x, p.z);
      const roof = len - travelled > 0.5
        && colliders.find((c) => p.y > c.bottom && p.y < c.top - 0.15 && footprint(c, p.x, p.z, p.y).dist <= 0.1);
      if (canHurt && Math.hypot(p.x - px, p.y - (py + 0.2), p.z - pz) < B.CATCH_R) {
        ev.caught = p.clone(); // got the lizard: back up into the sky, no opening
        circle();
      } else if (roof) {
        // Bonk! It hit something on the way down (the lizard was under cover, or tight
        // against a wall). It tumbles to the ground just short of it and shakes it off fast.
        const h = Math.hypot(dir.x, dir.z) || 1;
        let x = p.x, z = p.z;
        for (let i = 0; i < 30 && !clear(x, z); i++) { x -= (dir.x / h) * 0.4; z -= (dir.z / h) * 0.4; }
        [x, z] = clampToWorld(x, z, B.BODY_R);
        p.set(x, terrainHeight(x, z), z);
        ev.bonked = true;
        down(ev, B.BONK);
      } else if (travelled >= len - 1e-6 || p.y <= g) {
        // missed: sprawled where it hit (the ground, or the roof the lizard stood on)
        p.y = Math.max(p.y, g);
        down(ev, B.STUCK_MIN + (B.STUCK_MAX - B.STUCK_MIN) * (boss.health - 1) / Math.max(1, boss.maxHealth - 1));
      }
    } else if (boss.state === 'stuck') {
      timer -= dt;
      if (timer <= 0) circle();
    } else if (boss.state === 'defeated') {
      // beaten: it gives up and flies away over the rooftops
      timer += dt;
      boss.pos.y += 7 * dt;
      boss.pos.x += Math.sin(boss.yaw) * 12 * dt; boss.pos.z += Math.cos(boss.yaw) * 12 * dt;
      speed = B.FLY;
      if (timer > 4) rig.visible = false;
    }

    // --- the lizard landing on its back while it is down (touching it then is harmless) ---
    if (boss.state === 'stuck' && !ev.stuckNow) {
      const up = py - boss.pos.y;
      if (Math.hypot(px - boss.pos.x, pz - boss.pos.z) < B.BODY_R && player.velY < 0 && up >= 0.4 && up <= B.BACK_STUCK + 1) {
        ev.hit = true;
        boss.health -= 1;
        if (boss.health <= 0) { boss.health = 0; boss.state = 'defeated'; ev.defeated = true; timer = 0; }
        else circle();
      }
    }

    if (pendingWindup && boss.state === 'windup') ev.windupNow = 'dive';
    pendingWindup = false;
    place(dt);
    return ev;
  };
  return boss;
}
