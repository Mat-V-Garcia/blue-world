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
const LOOK = 1; // which way a turn about UP swings her head on this rig (checked by eye)

// Magnific's mesh carries a few hundred stray faces that point inwards (their winding
// disagrees with their own normals). They show as pale, oddly lit patches that look like
// holes in her coat; the real surface is intact underneath, so they are simply dropped.
function dropInsideOutFaces(geo) {
  const P = geo.attributes.position, N = geo.attributes.normal, I = geo.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), face = new THREE.Vector3();
  const keep = [];
  for (let t = 0; t < I.count; t += 3) {
    const i = I.getX(t), j = I.getX(t + 1), k = I.getX(t + 2);
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, j); c.fromBufferAttribute(P, k);
    face.crossVectors(b.sub(a), c.sub(a));
    n.fromBufferAttribute(N, i).add(a.fromBufferAttribute(N, j)).add(a.fromBufferAttribute(N, k));
    if (face.dot(n) >= 0) keep.push(i, j, k);
  }
  geo.setIndex(keep);
}

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
    dropInsideOutFaces(o.geometry);
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
    const LEG = 0.3;  // leg length as a share of her body length: sets how far each step carries her
    // A cat's walk is four beats, one paw at a time: left hind, left fore, right hind, right
    // fore, each a quarter of a stride after the last, with each paw on the ground about
    // two thirds of the time. As she speeds up into a trot the diagonal pairs close up and
    // move together, half the time in the air. [hind left, fore left, hind right, fore right]
    const WALK = [0, 0.25, 0.5, 0.75], TROT = [0, 0.5, 0.5, 1.0];
    const smooth = (x) => x * x * (3 - 2 * x);
    // where one paw is in its step: swing (+ forward of the shoulder or hip, - behind) and how far it is lifted
    function paw(u, duty, reach) {
      if (u < duty) return { swing: reach * (1 - 2 * u / duty), lift: 0 };  // on the ground, carried back under her
      const k = (u - duty) / (1 - duty);
      return { swing: reach * (2 * smooth(k) - 1), lift: Math.sin(Math.PI * k) }; // picked up and brought forward
    }
    let stride = 0, t = Math.random() * 10; // stride: how many whole strides she has taken
    const w = {}; // how much of each pose is showing, 0..1, eased
    const ease = (key, on, dt, rate = 9) => (w[key] = THREE.MathUtils.lerp(w[key] ?? 0, on ? 1 : 0, Math.min(1, dt * rate)));
    return {
      root,
      update(dt, speed, state, { pace = speed * 3.2, look = 0 } = {}) {
        t += dt;
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
        const walking = state === 'stalk' || state === 'trot';
        const go = ease('go', walking && pace > 0.3, dt, 7); // 0 standing .. 1 stepping out

        // the stride keeps time with the ground she covers, so her paws don't slide
        const trot = ease('trotting', pace > 4.6, dt, 5);
        const duty = 0.66 - 0.16 * trot, reach = 0.36 + 0.14 * trot;
        const perStride = (2 * LEG * Math.sin(reach) / duty) * root.scale.x; // world units per whole stride
        if (walking) stride += dt * pace / perStride;
        const step = (i) => { const u = stride + WALK[i] + (TROT[i] - WALK[i]) * trot; return paw(u - Math.floor(u), duty, reach * go); };
        const [hl, fl, hr, fr] = [0, 1, 2, 3].map(step);
        const up = go * (1 - leap) * (1 - low); // how much of the walk shows through the other poses

        // legs: the walk; stretched out in a leap; out in front when lying; loose when flopped
        const batting = bat * (Math.sin(t * 12) * 0.35 - 0.5); // one paw lifts off the ground and pats
        const out = leap * 1.0 + low * 1.4 + flop * 0.3;
        const back = -leap * 0.9 + crouch * 0.5 + low * 1.4 - flop * 0.3;
        // a lifted fore paw folds at the elbow and reaches; a lifted hind paw folds at the hock
        leg(frontR, fr.swing * up + fr.lift * up * 0.12 + out + lift * 1.5 + swipe * 0.9 + batting, fr.lift * up * 0.75 + lift * 0.9, -swipe * 0.9);
        leg(frontL, fl.swing * up + fl.lift * up * 0.12 + out, fl.lift * up * 0.75);
        leg(hindL, hl.swing * up + hl.lift * up * 0.15 + back, hl.lift * up * 0.6);
        leg(hindR, hr.swing * up + hr.lift * up * 0.15 + back, hr.lift * up * 0.6);
        // her body dips a little as each pair of paws takes her weight, and lies on the ground to play or sleep
        const cyc = stride * Math.PI * 2;
        turn.position.y = -low * LIE - Math.abs(Math.sin(cyc)) * 0.008 * up * (1 + trot * 1.5);

        // back: shoulders down and a wiggle of the hips before a pounce
        pose(hips, [[UP, crouch * Math.sin(t * 16) * 0.12 + Math.sin(cyc) * 0.035 * up], [FWD, Math.sin(cyc) * 0.03 * up]]);

        // head: low and watching when stalking, shaken after a bump, thrown back in a yawn, tucked in asleep
        // (on this rig a turn about SIDE lifts the head when positive, the opposite of the legs and tail)
        // she keeps her eyes on the lizard while her body walks its own line (as far as a neck turns)
        const watch = (stalk + yawn) * THREE.MathUtils.clamp(look, -1.1, 1.1) * LOOK;
        const nod = -stalk * 0.2 - bat * 0.45 + yawn * 0.45 - asleep * 0.75 + leap * 0.25 - crouch * 0.2;
        pose(neck, [[SIDE, nod + Math.sin(cyc * 2) * 0.03 * up], [UP, watch * 0.6 + shake * Math.sin(t * 22) * 0.35]]);
        pose(head, [[SIDE, nod * 0.5], [UP, watch * 0.4], [FWD, flop * 0.3 + yawn * Math.sin(t * 3) * 0.1]]);

        // tail: slow sway, quick twitch of the tip when stalking, up for a pounce, curled round asleep
        tail.forEach((b, i) => {
          const tip = i / (tail.length - 1);
          const sway = (Math.sin(t * 2 - i * 0.6) * 0.1 * (1 - up) + Math.sin(cyc - i * 0.5) * 0.07 * up) * (1 - asleep);
          const twitch = stalk * tip * Math.sin(t * 9 - i) * 0.18;
          pose(b, [[UP, sway + twitch + asleep * 0.42], [SIDE, -(crouch + leap) * 0.16 + flop * 0.05]]);
        });

        // breathing, slow and deep once she is asleep
        turn.scale.setScalar((1 + Math.sin(t * (1.2 + (1 - asleep) * 1.5)) * (0.008 + asleep * 0.012)) / LENGTH);
      },
    };
  };
}
