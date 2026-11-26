import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Mama Cat (Magnific: Tripo P1 mesh, then a quadruped rig). The GLB stands with its feet
// on y = 0, 0.71 tall, about 1 long, and the body runs at a slant across X and Z (head
// towards -Z and +X) because the concept picture was a three-quarter view; the loader
// measures the slant from the spine and turns her to face +Z.
// Skeleton (three.js drops the "::" from the names):
//   spine        tripoSpine_0 (hips) .. tripoSpine_3 (shoulders)
//   neck, head   tripoHead_0, tripoHead_1 (tripoHead_2..3 and the small bone_8..39 are the face)
//   front legs   tripo0_Left_Limb_0..3 and tripo0_Right_Limb_1..4 (shoulder, elbow, wrist, paw)
//   hind legs    tripo1_Right_Limb_1..3 and bone_54..56 (hip, knee, paw), both under tripo1_Right_Limb_0
//   tail         bone_57, bone_58, tripoTail_0..3, bone_63, bone_64
const UP = new THREE.Vector3(0, 1, 0);

export async function loadMamaCatModel(url = '/assets/mamacat.glb') {
  const gltf = await new GLTFLoader().loadAsync(url);
  const source = gltf.scene;
  source.updateMatrixWorld(true);
  const at = (name) => source.getObjectByName(name).getWorldPosition(new THREE.Vector3());
  // which way she faces, and how long she is along that line
  const FWD = at('tripoHead_0').sub(at('tripoSpine_0')).setY(0).normalize();
  const SIDE = new THREE.Vector3().crossVectors(UP, FWD); // her left
  let lo = Infinity, hi = -Infinity;
  const p = new THREE.Vector3();
  source.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false; // skinned bounds don't follow the bones
    o.material.metalness = 0; o.material.roughness = 0.85;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 7) { const k = p.fromBufferAttribute(pos, i).dot(FWD); lo = Math.min(lo, k); hi = Math.max(hi, k); }
  });
  const LENGTH = hi - lo, MID = (hi + lo) / 2;

  return function makeMamaCat() {
    const model = cloneSkinned(source);
    const root = new THREE.Group(), turn = new THREE.Group();
    turn.rotation.y = -Math.atan2(FWD.x, FWD.z); // her nose -> game +Z
    turn.scale.setScalar(1 / LENGTH);            // 1 unit long; the level scales her up
    model.position.copy(FWD).multiplyScalar(-MID); // centred nose to rump
    root.add(turn); turn.add(model);
    model.updateMatrixWorld(true);

    const bones = {};
    model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    const modelInv = new THREE.Matrix4().copy(model.matrixWorld).invert();
    const rig = new Map();
    const tq = new THREE.Quaternion(), ta = new THREE.Vector3(), acc = new THREE.Quaternion();
    // pose(bone, [[axis, angle], ...]): turn a bone from its rest pose about axes given in the model's own space
    const pose = (b, rots) => {
      if (!b) return;
      let r = rig.get(b);
      if (!r) {
        const pq = new THREE.Quaternion();
        new THREE.Matrix4().multiplyMatrices(modelInv, b.parent.matrixWorld).decompose(new THREE.Vector3(), pq, new THREE.Vector3());
        rig.set(b, r = { rest: b.quaternion.clone(), parentInv: pq.invert() });
      }
      acc.identity();
      for (const [axis, ang] of rots) { ta.copy(axis).applyQuaternion(r.parentInv); tq.setFromAxisAngle(ta, ang); acc.premultiply(tq); }
      b.quaternion.copy(acc).multiply(r.rest);
    };
    const pick = (...names) => names.map((n) => bones[n]).filter(Boolean);
    const frontL = pick('tripo0_Left_Limb_0', 'tripo0_Left_Limb_1'), frontR = pick('tripo0_Right_Limb_1', 'tripo0_Right_Limb_2');
    const hindL = pick('bone_54', 'bone_55'), hindR = pick('tripo1_Right_Limb_1', 'tripo1_Right_Limb_2');
    const tail = pick('bone_57', 'bone_58', 'tripoTail_0', 'tripoTail_1', 'tripoTail_2', 'tripoTail_3', 'bone_63', 'bone_64');
    const hips = bones.tripoSpine_0;
    const neck = bones.tripoHead_0, head = bones.tripoHead_1;
    // a leg: swing the whole leg about her side-to-side axis (+ = paw forward), bend the lower half back
    const leg = ([upper, lower], swing, bend = 0, out = 0) => { pose(upper, [[SIDE, -swing], [FWD, out]]); pose(lower, [[SIDE, bend]]); };

    const LIE = 0.27; // how far her body drops when she lies down (her legs are about this long)
    let phase = 0, t = Math.random() * 10;
    const w = {}; // how much of each pose is showing, 0..1, eased
    const ease = (key, on, dt, rate = 9) => (w[key] = THREE.MathUtils.lerp(w[key] ?? 0, on ? 1 : 0, Math.min(1, dt * rate)));
    return {
      root,
      update(dt, speed, state) {
        t += dt;
        const g = Math.min(1.6, speed);
        phase += dt * (2.5 + g * 5);
        const stalk = ease('stalk', state === 'stalk', dt, 4);
        const lift = ease('lift', state === 'swipeWind', dt, 12);
        const swipe = ease('swipe', state === 'swipe', dt, 30);
        const bat = ease('bat', state === 'play' || state === 'fish', dt);
        const crouch = ease('crouch', state === 'crouch', dt);
        const leap = ease('leap', state === 'pounce', dt, 14);
        const flop = ease('flop', state === 'flop', dt);
        const shake = ease('shake', state === 'recover', dt);
        const yawn = ease('yawn', state === 'yawn', dt, 5);
        const asleep = ease('asleep', state === 'defeated', dt, 1.5);
        const low = Math.max(bat, asleep); // lying on her front

        // legs: a diagonal walk; stretched out in a leap; out in front when lying; loose when flopped
        const s = Math.sin(phase) * 0.55 * Math.min(1, g) * (1 - leap) * (1 - low);
        const batting = bat * (Math.sin(t * 12) * 0.35 - 0.5); // one paw lifts off the ground and pats
        const reach = leap * 1.0 + low * 1.4 + flop * 0.3;
        leg(frontR, s + reach + lift * 1.5 + swipe * 0.9 + batting, Math.max(0, -s) * 0.7 + lift * 0.9, -swipe * 0.9);
        leg(frontL, -s + reach, Math.max(0, s) * 0.7);
        leg(hindL, s - leap * 0.9 + crouch * 0.5 + low * 1.4 - flop * 0.3, Math.max(0, -s) * 0.6);
        leg(hindR, -s - leap * 0.9 + crouch * 0.5 + low * 1.4 - flop * 0.3, Math.max(0, s) * 0.6);
        turn.position.y = -low * LIE; // belly on the ground

        // back: shoulders down and a wiggle of the hips before a pounce
        pose(hips, [[UP, crouch * Math.sin(t * 16) * 0.12]]);

        // head: low and watching when stalking, shaken after a bump, thrown back in a yawn, tucked in asleep
        // (on this rig a turn about SIDE lifts the head when positive, the opposite of the legs and tail)
        const idleLook = stalk * (1 - Math.min(1, g)) * Math.sin(t * 0.7) * 0.15;
        const nod = -stalk * 0.2 - bat * 0.45 + yawn * 0.45 - asleep * 0.75 + leap * 0.25 - crouch * 0.2;
        pose(neck, [[SIDE, nod], [UP, idleLook + shake * Math.sin(t * 22) * 0.35]]);
        pose(head, [[SIDE, nod * 0.5], [FWD, flop * 0.3 + yawn * Math.sin(t * 3) * 0.1]]);

        // tail: slow sway, quick twitch of the tip when stalking, up for a pounce, curled round asleep
        tail.forEach((b, i) => {
          const tip = i / (tail.length - 1);
          const sway = Math.sin(t * 2 - i * 0.6) * 0.1 * (1 - asleep);
          const twitch = stalk * tip * Math.sin(t * 9 - i) * 0.18;
          pose(b, [[UP, sway + twitch + asleep * 0.42], [SIDE, -(crouch + leap) * 0.16 + flop * 0.05]]);
        });

        // breathing, slow and deep once she is asleep
        turn.scale.setScalar((1 + Math.sin(t * (1.2 + (1 - asleep) * 1.5)) * (0.008 + asleep * 0.012)) / LENGTH);
      },
    };
  };
}
