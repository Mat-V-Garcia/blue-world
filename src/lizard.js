import * as THREE from 'three';
import { toon } from './materials.js';

// Western fence lizard palette
const C = {
  body: 0x8c7f6c,     // grey-brown
  bars: 0x3a3029,     // dark wavy chevrons
  blue: 0x2fa7d9,     // belly + throat patches
  yellow: 0xd9a03c,   // under the legs
  belly: 0xcfc3a8,
  eye: 0xffffff,
  pupil: 0x1a1410,
};

function ellipsoid(rx, ry, rz, mat, seg = 18) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), mat);
  m.scale.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

// Built facing +Z, feet at y = 0.
export function createLizard() {
  const root = new THREE.Group();
  const body = new THREE.Group();   // push-ups / sway move this
  root.add(body);

  const mBody = toon(C.body), mBars = toon(C.bars), mBlue = toon(C.blue);
  const mYellow = toon(C.yellow), mBelly = toon(C.belly);

  // Torso
  const torso = ellipsoid(0.17, 0.12, 0.3, mBody);
  torso.position.set(0, 0.2, 0);
  body.add(torso);
  const underside = ellipsoid(0.15, 0.08, 0.27, mBelly);
  underside.position.set(0, 0.15, 0);
  body.add(underside);

  // Bright blue belly patches on each flank
  for (const s of [-1, 1]) {
    const patch = ellipsoid(0.05, 0.06, 0.17, mBlue);
    patch.position.set(0.125 * s, 0.16, 0.02);
    body.add(patch);
  }

  // Dark wavy chevron bars + spiky keeled scales down the back
  for (let i = 0; i < 5; i++) {
    const z = 0.2 - i * 0.1;
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.035), mBars);
      bar.position.set(0.06 * s, 0.31 - Math.abs(z) * 0.08, z - 0.025);
      bar.rotation.y = 0.55 * s;
      bar.rotation.z = -0.35 * s;
      body.add(bar);
    }
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.06, 5), mBody);
    spike.position.set(0, 0.325 - Math.abs(z) * 0.08, z + 0.03);
    spike.rotation.x = -0.5;
    body.add(spike);
  }

  // Head
  const head = new THREE.Group();
  head.position.set(0, 0.25, 0.3);
  body.add(head);
  const skull = ellipsoid(0.13, 0.1, 0.16, mBody);
  skull.position.set(0, 0.02, 0.08);
  head.add(skull);
  const snout = ellipsoid(0.09, 0.065, 0.1, mBody);
  snout.position.set(0, -0.005, 0.2);
  head.add(snout);
  const throat = ellipsoid(0.1, 0.05, 0.12, mBlue);
  throat.position.set(0, -0.055, 0.1);
  head.add(throat);
  // Big friendly eyes
  for (const s of [-1, 1]) {
    const eye = ellipsoid(0.058, 0.058, 0.058, toon(C.eye), 14);
    eye.position.set(0.09 * s, 0.075, 0.12);
    head.add(eye);
    const pupil = ellipsoid(0.032, 0.036, 0.03, toon(C.pupil), 12);
    pupil.position.set(0.125 * s, 0.08, 0.15);
    head.add(pupil);
    const glint = ellipsoid(0.01, 0.01, 0.01, new THREE.MeshBasicMaterial({ color: 0xffffff }), 8);
    glint.position.set(0.14 * s, 0.095, 0.165);
    head.add(glint);
  }

  // Little red bandana (from the Magnific concept art)
  const mRed = toon(0xc8402e);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.03, 6, 16), mRed);
  scarf.position.set(0, 0.235, 0.26);
  scarf.rotation.x = Math.PI / 2 - 0.35;
  body.add(scarf);
  const flap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.11, 3), mRed);
  flap.position.set(0, 0.13, 0.31);
  flap.rotation.x = Math.PI;
  flap.rotation.z = 0.2;
  body.add(flap);

  // Tail: chain of nested segments so sway accumulates
  const tailSegs = [];
  let parent = body;
  let r = 0.085;
  const segLen = 0.13;
  for (let i = 0; i < 9; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? 0.19 : 0, i === 0 ? -0.27 : -segLen);
    parent.add(seg);
    const nr = r * 0.78;
    const geo = new THREE.CylinderGeometry(nr, r, segLen, 8);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -segLen / 2);
    const mesh = new THREE.Mesh(geo, i % 2 ? mBars : mBody);
    mesh.castShadow = true;
    seg.add(mesh);
    tailSegs.push(seg);
    parent = seg;
    r = nr;
  }

  // Legs: sprawled lizard stance
  const legs = [];
  const legDefs = [
    { x: 1, z: 0.17, front: true }, { x: -1, z: 0.17, front: true },
    { x: 1, z: -0.18, front: false }, { x: -1, z: -0.18, front: false },
  ];
  for (const d of legDefs) {
    const hip = new THREE.Group();
    hip.position.set(0.13 * d.x, 0.18, d.z);
    body.add(hip);
    const upperGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.14, 7);
    upperGeo.rotateZ(Math.PI / 2);
    upperGeo.translate(0.07 * d.x, 0, 0);
    const upper = new THREE.Mesh(upperGeo, mBody);
    upper.castShadow = true;
    hip.add(upper);
    const knee = new THREE.Group();
    knee.position.set(0.14 * d.x, 0, 0);
    hip.add(knee);
    const lowerGeo = new THREE.CylinderGeometry(0.025, 0.033, 0.17, 7);
    lowerGeo.translate(0, -0.085, 0);
    const lower = new THREE.Mesh(lowerGeo, mYellow);
    lower.castShadow = true;
    knee.add(lower);
    const foot = ellipsoid(0.045, 0.018, 0.06, mYellow, 10);
    foot.position.set(0.015 * d.x, -0.17, 0.03);
    knee.add(foot);
    legs.push({ hip, knee, side: d.x, front: d.front });
  }

  let phase = 0;
  let pushT = 0;
  let idleT = 0;

  return {
    root,
    body,
    head,
    // speed: horizontal speed (units/s); climbing: bool; pushups: bool
    update(dt, { speed = 0, climbing = false, pushups = false, airborne = false }) {
      idleT += dt;
      const moving = speed > 0.1;
      phase += dt * (moving ? 3 + speed * 1.6 : 0);

      // Legs: diagonal pairs move together
      legs.forEach((l, i) => {
        const pair = (i === 0 || i === 3) ? 0 : Math.PI;
        const s = moving ? Math.sin(phase + pair) : 0;
        const lift = moving ? Math.max(0, Math.cos(phase + pair)) : 0;
        const dir = l.front ? 1 : -1;
        l.hip.rotation.y = THREE.MathUtils.lerp(l.hip.rotation.y, s * 0.7 * l.side * dir + (l.front ? 0.35 : -0.35) * l.side, 0.4);
        l.hip.rotation.z = THREE.MathUtils.lerp(l.hip.rotation.z, (airborne ? 0.5 : lift * 0.45) * l.side, 0.4);
        l.knee.rotation.z = (airborne ? -0.4 : -lift * 0.3) * l.side;
      });

      // Body wiggle side to side when running, like a real lizard
      body.rotation.y = moving ? Math.sin(phase) * 0.16 : THREE.MathUtils.lerp(body.rotation.y, 0, 0.1);

      // Tail sway: travelling wave
      const amp = moving ? 0.22 : 0.08;
      const tw = moving ? phase : idleT * 1.5;
      tailSegs.forEach((seg, i) => {
        seg.rotation.y = Math.sin(tw - i * 0.6) * amp;
        seg.rotation.x = climbing ? 0 : (i === 0 ? 0.12 : 0.02);
      });

      // Push-ups: the classic fence-lizard display
      if (pushups) pushT += dt; else pushT = 0;
      const pu = pushups ? Math.abs(Math.sin(pushT * 9)) : 0;
      body.position.y = THREE.MathUtils.lerp(body.position.y, pu * 0.09, 0.5);
      body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, -pu * 0.28, 0.5);

      // Idle head look-around
      head.rotation.y = moving ? 0 : Math.sin(idleT * 0.7) * 0.35 * (Math.sin(idleT * 0.23) > 0 ? 1 : 0);
      head.rotation.x = pushups ? -pu * 0.2 : 0;
    },
  };
}
