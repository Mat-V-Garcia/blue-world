import * as THREE from 'three';
import { terrainHeight, footprint, clampToWorld } from './world.js';

// The boss: one giant tarantula. It walks at the lizard, lunges with its fangs, and
// shoots webs from a distance. It can only be hurt by landing on its back while its fangs
// are stuck in the sand after a missed lunge. It is never a solid collider: main.js acts
// on the events update() reports.
export const BOSS = {
  HEALTH: 6, WALK: 3, LUNGE_RANGE: 14, LUNGE_TRAVEL: 22, LUNGE_SPEED: 18, OVERSHOOT: 3,
  WINDUP: 0.8, STUCK_MAX: 2.5, STUCK_MIN: 1.8, RECOVER: 1.5,
  BODY_R: 2.2,          // touch / landing radius
  BACK_UP: 2.3,         // back height when standing (the model at scale 5 is 2.34 tall)
  BACK_STUCK: 1.0,      // back height while stuck (reachable by a jump)
  WEB_RANGE: 14, WEB_WINDUP: 0.6, WEB_SPEED: 16, WEB_TIME: 2.5, WEB_COOLDOWN: 3,
  PERCH_HEIGHT: 1, PERCH_TIME: 2, TAIL_RANGE: 20, ANGRY_BELOW: 0.5, ANGRY_WINDUP: 0.75,
};
const REST = 0.6;        // stands still this long after pulling free or catching the lizard
const SHORT_LUNGE = 1.5; // a lunge stopped by a rock sooner than this isn't a real miss

// makeModel(): { root, update(dt, speed) } (the tarantula model or the simple stand-in).
// cfg: { x, z, health?, scale? }
export function createBoss(scene, colliders, makeModel, cfg = {}) {
  const B = BOSS, SCALE = cfg.scale ?? 5;
  const v = makeModel();
  const rig = new THREE.Group(), tilt = new THREE.Group();
  v.root.scale.setScalar(SCALE);
  tilt.add(v.root); rig.add(tilt); scene.add(rig);

  const sx = cfg.x ?? 0, sz = cfg.z ?? 0;
  const boss = {
    pos: new THREE.Vector3(), yaw: 0, health: 0, maxHealth: cfg.health ?? B.HEALTH,
    state: 'approach', webs: [],
    rig, // the model's group (for checks and debugging)
  };
  let timer = 0, rest = 0, speed = 0, pendingWindup = null;
  let webCD = 1, perch = 0, shots = 0, followUp = false; // followUp: lunge next (just webbed the lizard)
  const webMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const webGeo = new THREE.IcosahedronGeometry(0.28, 1);
  const target = new THREE.Vector2(), dir = new THREE.Vector2();
  let lungeLen = 0, travelled = 0;
  let pose = { rx: 0, sy: 1, y: 0 };

  const angry = () => boss.health / boss.maxHealth < B.ANGRY_BELOW;
  const face = (x, z, dt) => {
    let d = Math.atan2(x - boss.pos.x, z - boss.pos.z) - boss.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    boss.yaw += d * Math.min(1, dt * 6);
  };
  // rocks tall enough to stop it (it steps over anything lower)
  const rockAt = (x, z) => {
    const g = terrainHeight(x, z);
    for (const c of colliders) if (c.top > g + 0.5 && footprint(c, x, z).dist < B.BODY_R) return c;
    return null;
  };
  function walkTo(x, z, dt) {
    const dx = x - boss.pos.x, dz = z - boss.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { speed = 0; return; }
    const step = Math.min(d, B.WALK * dt);
    let nx = boss.pos.x + (dx / d) * step, nz = boss.pos.z + (dz / d) * step;
    const g = terrainHeight(nx, nz);
    for (const c of colliders) {
      if (c.top <= g + 0.5) continue;
      const f = footprint(c, nx, nz);
      if (f.dist < B.BODY_R) { // push out and slide round it
        nx += f.nx * (B.BODY_R - f.dist) - f.nz * step * 0.6;
        nz += f.nz * (B.BODY_R - f.dist) + f.nx * step * 0.6;
      }
    }
    [nx, nz] = clampToWorld(nx, nz, B.BODY_R);
    speed = Math.hypot(nx - boss.pos.x, nz - boss.pos.z) / Math.max(dt, 1e-4);
    boss.pos.x = nx; boss.pos.z = nz;
  }
  function startWindup(x, z) {
    boss.state = 'windup';
    target.set(x, z);
    timer = B.WINDUP * (angry() ? B.ANGRY_WINDUP : 1);
    pendingWindup = 'lunge';
  }
  function startWebWind() {
    boss.state = 'webwind';
    timer = B.WEB_WINDUP * (angry() ? B.ANGRY_WINDUP : 1);
    pendingWindup = 'web';
  }
  function shoot(player) {
    const from = new THREE.Vector3(boss.pos.x + Math.sin(boss.yaw) * B.BODY_R * 0.8, boss.pos.y + 1.5, boss.pos.z + Math.cos(boss.yaw) * B.BODY_R * 0.8);
    const to = new THREE.Vector3(player.pos.x, player.pos.y + 0.2, player.pos.z);
    const mesh = new THREE.Mesh(webGeo, webMat);
    scene.add(mesh);
    boss.webs.push({ pos: from.clone(), from, to, k: 0, dur: Math.max(0.2, Math.hypot(to.x - from.x, to.z - from.z) / B.WEB_SPEED), mesh });
  }
  function clearWebs() { for (const w of boss.webs) scene.remove(w.mesh); boss.webs.length = 0; }
  function stick(ev) {
    boss.state = 'stuck';
    timer = B.STUCK_MIN + (B.STUCK_MAX - B.STUCK_MIN) * (boss.health - 1) / Math.max(1, boss.maxHealth - 1);
    ev.stuckNow = true;
  }

  function reset() {
    boss.pos.set(sx, terrainHeight(sx, sz), sz);
    boss.yaw = 0; boss.health = boss.maxHealth; boss.state = 'approach';
    timer = 0; rest = 0; speed = 0; pendingWindup = null;
    webCD = 1; perch = 0; shots = 0; followUp = false;
    clearWebs();
    pose = { rx: 0, sy: 1, y: 0 };
    rig.visible = true;
  }
  reset();

  boss.reset = reset;
  // A dropped tail: lunge at it instead (and get stuck there). False if it took no notice.
  boss.baitWith = (pos) => {
    const s = boss.state;
    if (s === 'lunge' || s === 'stuck' || s === 'recover' || s === 'defeated') return false;
    if (Math.hypot(pos.x - boss.pos.x, pos.z - boss.pos.z) > B.TAIL_RANGE) return false;
    followUp = false; rest = 0;
    startWindup(pos.x, pos.z);
    return true;
  };
  boss.update = (dt, player, canHurt) => {
    const ev = { caught: null, hit: false, bounced: false, defeated: false, stuckNow: false, windupNow: null, shotNow: false, webbed: false, splat: null };
    const px = player.pos.x, pz = player.pos.z;
    const dist = Math.hypot(px - boss.pos.x, pz - boss.pos.z);
    speed = 0;

    if (boss.state === 'approach') {
      face(px, pz, dt);
      const perched = perch >= B.PERCH_TIME;
      if (rest > 0) rest -= dt;
      else if (followUp) {
        if (dist <= B.LUNGE_TRAVEL) { followUp = false; startWindup(px, pz); } else walkTo(px, pz, dt);
      } else if ((dist > B.WEB_RANGE || perched) && webCD <= 0) startWebWind();
      else if (dist <= B.LUNGE_RANGE) startWindup(px, pz);
      else walkTo(px, pz, dt);
    } else if (boss.state === 'webwind') {
      face(px, pz, dt);
      timer -= dt;
      if (timer <= 0) {
        shoot(player); ev.shotNow = true; shots++;
        if (angry() && shots % 2 === 1) startWebWind(); // angry: two in a row
        else { webCD = B.WEB_COOLDOWN; boss.state = 'approach'; }
      }
    } else if (boss.state === 'windup') {
      face(target.x, target.y, dt);
      timer -= dt;
      if (timer <= 0) {
        const dx = target.x - boss.pos.x, dz = target.y - boss.pos.z, d = Math.hypot(dx, dz) || 1;
        dir.set(dx / d, dz / d);
        boss.yaw = Math.atan2(dir.x, dir.y);
        lungeLen = Math.min(d + B.OVERSHOOT, B.LUNGE_TRAVEL);
        travelled = 0;
        boss.state = 'lunge';
      }
    } else if (boss.state === 'lunge') {
      const step = Math.min(B.LUNGE_SPEED * dt, lungeLen - travelled);
      const nx = boss.pos.x + dir.x * step, nz = boss.pos.z + dir.y * step;
      const [cx, cz] = clampToWorld(nx, nz, B.BODY_R);
      const rock = rockAt(nx, nz);
      speed = B.LUNGE_SPEED;
      if (rock) {
        // Stopped by a boulder. A lizard sitting on that boulder gets snapped at;
        // otherwise the fangs are stuck (unless it had barely set off).
        const onIt = footprint(rock, px, pz).dist <= 0.3 && player.pos.y > terrainHeight(px, pz) + 0.5;
        if (onIt && canHurt) { ev.caught = boss.pos.clone(); boss.state = 'approach'; rest = REST * 2; }
        else if (travelled >= SHORT_LUNGE) stick(ev);
        else { boss.state = 'approach'; rest = REST; }
      } else if (cx !== nx || cz !== nz) {
        boss.pos.x = cx; boss.pos.z = cz; stick(ev); // ran into the arena wall
      } else {
        boss.pos.x = nx; boss.pos.z = nz; travelled += step;
        if (travelled >= lungeLen - 1e-6) stick(ev);
      }
    } else if (boss.state === 'stuck' || boss.state === 'recover') {
      timer -= dt;
      if (timer <= 0) { rest = boss.state === 'stuck' ? REST : 0; boss.state = 'approach'; }
    }
    boss.pos.y = terrainHeight(boss.pos.x, boss.pos.z);
    webCD -= dt;
    perch = player.pos.y - terrainHeight(px, pz) > B.PERCH_HEIGHT ? perch + dt : 0;

    // --- webs in flight ---
    for (let i = boss.webs.length - 1; i >= 0; i--) {
      const w = boss.webs[i];
      w.k = Math.min(1, w.k + dt / w.dur);
      w.pos.lerpVectors(w.from, w.to, w.k);
      w.pos.y += Math.sin(w.k * Math.PI) * 0.6; // gentle arc, low enough for boulders to block
      w.mesh.position.copy(w.pos);
      let gone = colliders.some((c) => w.pos.y > c.bottom && w.pos.y < c.top && footprint(c, w.pos.x, w.pos.z).dist < 0.2);
      if (!gone && canHurt && boss.state !== 'defeated' && Math.hypot(w.pos.x - px, w.pos.z - pz) < 0.7 && Math.abs(w.pos.y - player.pos.y - 0.2) < 1) {
        ev.webbed = true; followUp = true; gone = true;
      }
      if (!gone && w.k >= 1) { ev.splat = new THREE.Vector3(w.to.x, terrainHeight(w.to.x, w.to.z), w.to.z); gone = true; }
      if (gone) { scene.remove(w.mesh); boss.webs.splice(i, 1); }
    }

    // --- the lizard touching it or landing on it ---
    const dh = Math.hypot(px - boss.pos.x, pz - boss.pos.z);
    const up = player.pos.y - boss.pos.y;
    const st = boss.state;
    if (dh < B.BODY_R && st !== 'defeated' && st !== 'recover' && !ev.caught) {
      if (st === 'stuck') {
        if (player.velY < 0 && up >= 0.4 && up <= B.BACK_STUCK + 1 && !ev.stuckNow) {
          ev.hit = true;
          boss.health -= 1;
          if (boss.health <= 0) { boss.health = 0; boss.state = 'defeated'; ev.defeated = true; timer = 0; clearWebs(); }
          else { boss.state = 'recover'; timer = B.RECOVER; }
        }
      } else if (player.velY < 0 && Math.abs(up - B.BACK_UP) <= 0.6) {
        ev.bounced = true;
      } else if (up < B.BACK_UP - 0.6 && canHurt) {
        ev.caught = boss.pos.clone();
        if (st === 'lunge') boss.state = 'approach'; // caught you: not a miss, no stuck fangs
        rest = REST * 2;
      }
    }

    if (pendingWindup && boss.state !== 'approach') { ev.windupNow = pendingWindup; }
    pendingWindup = null;

    // --- pose ---
    const s = boss.state;
    const want = s === 'windup' ? { rx: -0.45, sy: 1, y: 0.5 }
      : s === 'stuck' ? { rx: 0.28, sy: 0.36, y: 0 }
        : s === 'webwind' ? { rx: 0.3, sy: 1, y: 0.2 }
          : s === 'defeated' ? { rx: 0, sy: 0.3, y: -B.BACK_UP * 1.4 }
          : { rx: 0, sy: 1, y: 0 };
    const k = Math.min(1, dt * (s === 'defeated' ? 0.8 : 9));
    pose.rx += (want.rx - pose.rx) * k; pose.sy += (want.sy - pose.sy) * k; pose.y += (want.y - pose.y) * k;
    if (s === 'defeated') { timer += dt; if (timer > 3) rig.visible = false; }
    rig.position.copy(boss.pos); rig.position.y += pose.y;
    rig.rotation.y = boss.yaw;
    tilt.rotation.x = pose.rx + (s === 'stuck' ? Math.sin(timer * 30) * 0.03 : 0); // strains while stuck
    tilt.scale.y = pose.sy;
    v.update(dt, s === 'stuck' ? 1.5 : speed / 2.5);
    return ev;
  };
  return boss;
}
