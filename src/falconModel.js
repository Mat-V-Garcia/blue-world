import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createSimplePigeon } from './pigeonModel.js';

// The peregrine falcon boss.

// ---------- Simple stand-in (used if the 3D model is missing): a big dark pigeon ----------
export function createSimpleFalcon() {
  const p = createSimplePigeon();
  const tint = new THREE.Color(0x8fa0c8);
  p.root.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(tint); } });
  p.root.scale.setScalar(6);
  const root = new THREE.Group();
  root.add(p.root);
  return { root, update: (dt, speed) => p.update(dt, speed) };
}

// ---------- Magnific 3D falcon (Tripo P1, rigged) ----------
// The GLB faces +X with Y up: 0.77 long, 0.55 tall, wings half open along Z (1.0 across).
// Bones (three.js drops the "::"): legs tripo0_Left_Limb_0.. / tripo0_Right_Limb_0..,
// neck tripoHead_0..1, tail tripoTail_0..3, and the wings WING_L / WING_R below.
const SCALE = 5;
const WING_L = 'bone_23', WING_R = 'bone_44';
const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);

export async function loadFalconModel(url = '/assets/falcon.glb') {
  const gltf = await new GLTFLoader().loadAsync(url);
  const source = gltf.scene;
  source.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
      if (o.material) { o.material.metalness = 0; o.material.roughness = 0.8; }
    }
  });

  return function makeFalcon() {
    const model = cloneSkinned(source);
    const root = new THREE.Group();
    const turn = new THREE.Group();
    turn.rotation.y = -Math.PI / 2; // model +X -> game +Z
    turn.scale.setScalar(SCALE);
    // it stands upright; in the air it leans forward about the middle of its body
    const MID = 0.27 * SCALE;
    const lean = new THREE.Group();
    lean.position.y = MID;
    root.add(lean);
    lean.add(turn);
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
    // rotate a bone about axes given in the model's own frame (X forward, Z out to its right)
    const pose = (b, rots) => {
      if (!b) return;
      const r = rig.get(b);
      acc.identity();
      for (const [axis, ang] of rots) { ta.copy(axis).applyQuaternion(r.parentInv); tq.setFromAxisAngle(ta, ang); acc.premultiply(tq); }
      b.quaternion.copy(acc).multiply(r.rest);
    };
    const neck = bones.tripoHead_0, tail = bones.tripoTail_0;
    const wingL = bones[WING_L], wingR = bones[WING_R];
    [neck, tail, wingL, wingR].forEach(prep);

    let t = Math.random() * 10, flap = 0, tuck = 0, tip = 0;
    return {
      root,
      bones, // for debugging
      // mode: 'fly' = wings beating; 'dive' = wings pulled in; none = standing
      update(dt, _speed, mode) {
        t += dt;
        flap = THREE.MathUtils.lerp(flap, mode === 'fly' ? 1 : 0, Math.min(1, dt * 6));
        tuck = THREE.MathUtils.lerp(tuck, mode === 'dive' ? 1 : 0, Math.min(1, dt * 10));
        const beat = Math.sin(t * 9) * 0.55 * flap;
        pose(wingL, [[X, beat]]); pose(wingR, [[X, -beat]]);
        // a falcon dives with its wings pulled tight to its body
        model.scale.z = 1 - 0.55 * tuck;
        // standing: the head looks about; flying: the tail steers a little
        pose(neck, [[THREE.Object3D.DEFAULT_UP, mode ? 0 : Math.sin(t * 1.3) * 0.35]]);
        pose(tail, [[Z, Math.sin(t * 9) * 0.12 * flap]]);
        turn.position.y = -MID + Math.sin(t * 9 + 1) * 0.12 * flap; // the body rides each wingbeat
        // head first: nearly flat when flying, flat out in a dive
        tip = THREE.MathUtils.lerp(tip, mode === 'dive' ? 1.45 : mode === 'fly' ? 1.0 : 0, Math.min(1, dt * 7));
        lean.rotation.x = tip;
      },
    };
  };
}
