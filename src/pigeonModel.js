import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toon } from './materials.js';

// ---------- Simple stand-in pigeon (used if the 3D model is missing) ----------
export function createSimplePigeon() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const grey = toon(0x8a93a6), dark = toon(0x5b6274), neck = toon(0x5f8f7a), feet = toon(0xd9687a), beak = toon(0x3a3a3a);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), grey);
  torso.scale.set(0.9, 0.85, 1.25); torso.position.set(0, 0.3, 0);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 6), dark);
  tail.rotation.x = -Math.PI / 2 - 0.4; tail.position.set(0, 0.32, -0.3);
  const head = new THREE.Group(); head.position.set(0, 0.48, 0.2);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), grey);
  const throat = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), neck);
  throat.position.set(0, -0.08, -0.04);
  const b = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 6), beak);
  b.rotation.x = Math.PI / 2; b.position.set(0, -0.01, 0.12);
  head.add(skull, throat, b);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), toon(0xe08a2a));
    eye.position.set(0.07 * s, 0.02, 0.06); head.add(eye);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 5), feet);
    leg.geometry.translate(0, -0.08, 0);
    leg.position.set(0.07 * s, 0.17, 0.02);
    root.add(leg); legs.push(leg);
  }
  body.add(torso, tail, head);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  let phase = 0, idle = Math.random() * 9;
  return {
    root,
    update(dt, speed) {
      idle += dt;
      phase += dt * (4 + speed * 8);
      const g = Math.min(1, speed);
      legs[0].rotation.x = Math.sin(phase) * 0.6 * g;
      legs[1].rotation.x = -Math.sin(phase) * 0.6 * g;
      // the classic pigeon head-bob while walking; occasional pecks when idle
      head.position.z = 0.2 + (g > 0.05 ? Math.sin(phase) * 0.05 : 0);
      head.rotation.x = g < 0.05 ? Math.max(0, Math.sin(idle * 1.7)) ** 10 * 0.9 : 0;
      body.rotation.z = Math.sin(phase) * 0.06 * g;
    },
  };
}

// ---------- Magnific 3D pigeon (Tripo P1, rigged) ----------
// The GLB faces +X with Y up, ~1 unit long and 0.8 tall. Bones (three.js drops the "::"):
// legs tripo0_Right_Limb_0..2 / tripo0_Left_Limb_0..2, neck tripoHead_0..3,
// wings bone_31..33 (right, +Z) and bone_34..36 (left), tail bone_1..2.
const SCALE = 1.9;
const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);

export async function loadPigeonModel(url = '/assets/pigeon.glb') {
  const gltf = await new GLTFLoader().loadAsync(url);
  const source = gltf.scene;
  source.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
      if (o.material) { o.material.metalness = 0; o.material.roughness = 0.8; }
    }
  });

  return function makePigeon() {
    const model = cloneSkinned(source);
    const root = new THREE.Group();
    const turn = new THREE.Group();
    turn.rotation.y = -Math.PI / 2; // model +X -> game +Z
    turn.scale.setScalar(SCALE);
    root.add(turn);
    turn.add(model);
    model.updateMatrixWorld(true);

    const bones = {};
    model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    const modelInv = new THREE.Matrix4().copy(model.matrixWorld).invert();
    const rig = new Map();
    const prep = (b) => {
      if (!b) return;
      const pm = new THREE.Matrix4().multiplyMatrices(modelInv, b.parent.matrixWorld);
      const pq = new THREE.Quaternion();
      pm.decompose(new THREE.Vector3(), pq, new THREE.Vector3());
      rig.set(b, { rest: b.quaternion.clone(), parentInv: pq.invert() });
    };
    const tq = new THREE.Quaternion(), ta = new THREE.Vector3(), acc = new THREE.Quaternion();
    const pose = (b, rots) => {
      if (!b) return;
      const r = rig.get(b);
      acc.identity();
      for (const [axis, ang] of rots) { ta.copy(axis).applyQuaternion(r.parentInv); tq.setFromAxisAngle(ta, ang); acc.premultiply(tq); }
      b.quaternion.copy(acc).multiply(r.rest);
    };
    const legR = bones.tripo0_Right_Limb_0, legL = bones.tripo0_Left_Limb_0;
    const kneeR = bones.tripo0_Right_Limb_1, kneeL = bones.tripo0_Left_Limb_1;
    const neck = bones.tripoHead_0, head = bones.tripoHead_2;
    const wingR = bones.bone_31, wingL = bones.bone_34, tail = bones.bone_1;
    [legR, legL, kneeR, kneeL, neck, head, wingR, wingL, tail].forEach(prep);

    let phase = Math.random() * 10, idle = Math.random() * 10, flap = 0;
    return {
      root,
      update(dt, speed) {
        idle += dt;
        const g = Math.min(1, speed);
        phase += dt * (5 + speed * 7);
        // waddle: legs swing forward/back
        const s = Math.sin(phase) * 0.55 * g;
        pose(legR, [[Z, s]]); pose(legL, [[Z, -s]]);
        pose(kneeR, [[Z, -Math.max(0, s) * 0.6]]); pose(kneeL, [[Z, -Math.max(0, -s) * 0.6]]);
        // the classic pigeon head-bob while walking; little pecks at the ground when idle
        const bob = g > 0.05 ? -Math.max(0, Math.sin(phase)) * 0.35 : 0;
        const peck = g <= 0.05 ? -(Math.max(0, Math.sin(idle * 1.6)) ** 12) * 1.1 : 0;
        pose(neck, [[Z, bob + peck]]);
        pose(head, [[Z, peck * 0.3]]);
        // wings flap when rushing at you (fast), otherwise stay folded
        flap = THREE.MathUtils.lerp(flap, speed > 2.5 ? 1 : 0, Math.min(1, dt * 6));
        const w = (Math.sin(idle * 22) * 0.5 + 0.5) * 0.9 * flap;
        pose(wingR, [[X, -w]]); pose(wingL, [[X, w]]);
        pose(tail, [[Z, Math.sin(phase) * 0.1 * g]]);
        // body sway side to side with each step
        turn.rotation.x = Math.sin(phase) * 0.06 * g;
        turn.position.y = Math.abs(Math.sin(phase)) * 0.03 * g;
      },
    };
  };
}
