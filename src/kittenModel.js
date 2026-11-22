import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toon } from './materials.js';

// Alley kittens for the back yard. They face +Z, are about 2.2 long and 1.1 tall at the
// ears: a lot bigger than the lizard, small next to a chair.

// Coats, handed out in turn: [fur, markings, chest/paws]
const COATS = [
  { name: 'tabby', fur: 0xa9825a, mark: 0x6b4c30, socks: 0xa9825a, stripes: true },
  { name: 'black', fur: 0x2e2c33, mark: 0x2e2c33, socks: 0x2e2c33 },
  { name: 'orange', fur: 0xe59a4a, mark: 0xc4722a, socks: 0xfff3e0, stripes: true },
  { name: 'grey', fur: 0x8f97a3, mark: 0x6c7480, socks: 0x8f97a3 },
  { name: 'tuxedo', fur: 0x2e2c33, mark: 0x2e2c33, socks: 0xfaf6ee, bib: true },
];
let nextCoat = 0;

// ---------- Kitten built from shapes (used until a 3D model is added) ----------
// update(dt, speed, state): state is the enemy manager's state string —
// 'scared' arches the back and fluffs the tail, 'tail' bats a front paw.
export function createSimpleKitten() {
  const coat = COATS[nextCoat++ % COATS.length];
  const fur = toon(coat.fur), mark = toon(coat.mark), socks = toon(coat.socks);
  const pink = toon(0xf2a0a8), eyeMat = new THREE.MeshBasicMaterial({ color: 0x1c1c1c }), iris = toon(0x9bd86a);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), fur);
  torso.scale.set(0.9, 0.85, 1.55); torso.position.set(0, 0.6, -0.05);
  body.add(torso);
  if (coat.bib) {
    const bib = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), socks);
    bib.scale.set(0.9, 1, 0.7); bib.position.set(0, 0.52, 0.38); body.add(bib);
  }
  if (coat.stripes) {
    for (let i = 0; i < 4; i++) {
      const st = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.035, 6, 14, Math.PI), mark);
      st.position.set(0, 0.62, -0.38 + i * 0.2); st.scale.set(1, 0.95, 1);
      body.add(st);
    }
  }

  // head: big, with ears, eyes, nose
  const head = new THREE.Group(); head.position.set(0, 0.8, 0.62);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), fur);
  skull.scale.set(1.05, 0.92, 0.95);
  head.add(skull);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 4), fur);
    ear.position.set(0.17 * s, 0.3, -0.02); ear.rotation.z = -0.25 * s;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.13, 4), pink);
    inner.position.set(0.17 * s, 0.28, 0.03); inner.rotation.z = -0.25 * s;
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), iris);
    white.position.set(0.12 * s, 0.04, 0.25); white.scale.z = 0.5;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), eyeMat);
    pupil.position.set(0.12 * s, 0.04, 0.285); pupil.scale.z = 0.5;
    head.add(ear, inner, white, pupil);
  }
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), coat.bib ? socks : fur);
  muzzle.scale.set(1.2, 0.75, 0.8); muzzle.position.set(0, -0.08, 0.25);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), pink);
  nose.position.set(0, -0.04, 0.35);
  head.add(muzzle, nose);
  body.add(head);

  // legs pivot at the shoulder/hip
  const legs = [];
  for (const [sx, z, front] of [[1, 0.32, true], [-1, 0.32, true], [1, -0.4, false], [-1, -0.4, false]]) {
    const leg = new THREE.Group(); leg.position.set(0.18 * sx, 0.46, z);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.38, 8), fur);
    upper.position.y = -0.19;
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), socks);
    paw.scale.set(1, 0.6, 1.25); paw.position.set(0, -0.41, 0.03);
    leg.add(upper, paw);
    body.add(leg);
    legs.push({ leg, front, pair: (sx > 0) === front ? 0 : Math.PI });
  }

  // tail: a chain, held up in a question-mark
  const tailSegs = [];
  let parent = body, r = 0.07;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Group();
    if (i === 0) { seg.position.set(0, 0.7, -0.58); seg.rotation.x = -0.9; } else seg.position.y = 0.16;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, 0.17, 7), i === 5 && coat.name === 'orange' ? socks : (coat.stripes && i % 2 ? mark : fur));
    m.position.y = 0.08;
    seg.add(m); parent.add(seg); tailSegs.push(seg);
    parent = seg; r *= 0.92;
  }

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  let phase = Math.random() * 10, idle = Math.random() * 10, puff = 0, bat = 0;
  return {
    root,
    update(dt, speed, state) {
      idle += dt;
      const g = Math.min(1, speed);
      phase += dt * (3 + speed * 6);
      puff = THREE.MathUtils.lerp(puff, state === 'scared' ? 1 : 0, Math.min(1, dt * 10));
      bat = THREE.MathUtils.lerp(bat, state === 'tail' && g < 0.1 ? 1 : 0, Math.min(1, dt * 8));
      for (const l of legs) l.leg.rotation.x = Math.sin(phase + l.pair) * 0.7 * g;
      // batting at the dropped tail with one front paw
      legs[0].leg.rotation.x += bat * (-1.0 + Math.sin(idle * 14) * 0.5);
      // tail: lazy swish; bolt upright and fluffed when scared
      tailSegs.forEach((s, i) => {
        if (i > 0) s.rotation.x = 0.28 * (1 - puff);
        s.rotation.z = Math.sin(idle * 2.2 - i * 0.6) * 0.16 * (1 - puff);
        s.scale.x = s.scale.z = 1 + puff * 1.1;
      });
      tailSegs[0].rotation.x = -0.9 + puff * 0.9;
      // arched back when scared; a little bounce in the walk
      torso.scale.y = 0.85 + puff * 0.25;
      body.position.y = Math.abs(Math.sin(phase)) * 0.03 * g + puff * 0.08;
      head.rotation.x = bat * 0.5 + (g < 0.05 && !bat ? Math.sin(idle * 0.8) * 0.08 : 0);
      head.rotation.y = g < 0.05 && !bat && !puff ? Math.sin(idle * 0.5) * 0.4 : 0;
    },
  };
}

// ---------- 3D kitten model (art pass) ----------
// Loads /assets/kitten.glb if it exists; main.js falls back to the kitten above when this
// rejects. Until the model is rigged for it there is no bone animation here: it bobs as
// it walks and hops when scared. The GLB is expected to face +X with Y up, like the others.
const SCALE = 2.2;
export async function loadKittenModel(url = '/assets/kitten.glb') {
  const gltf = await new GLTFLoader().loadAsync(url);
  const source = gltf.scene;
  source.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
      if (o.material) { o.material.metalness = 0; o.material.roughness = 0.8; }
    }
  });
  return function makeKitten() {
    const root = new THREE.Group();
    const turn = new THREE.Group();
    turn.rotation.y = -Math.PI / 2; // model +X -> game +Z
    turn.scale.setScalar(SCALE);
    turn.add(cloneSkinned(source));
    root.add(turn);
    let phase = Math.random() * 10;
    return {
      root,
      update(dt, speed, state) {
        phase += dt * (3 + speed * 6);
        const g = Math.min(1, speed);
        turn.position.y = Math.abs(Math.sin(phase)) * 0.05 * g + (state === 'scared' ? 0.1 : 0);
        turn.rotation.x = Math.sin(phase) * 0.05 * g;
      },
    };
  };
}
