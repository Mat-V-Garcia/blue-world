import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Realistic western fence lizard: Magnific 3D Generator (Tripo P1, rigged) model.
// The GLB faces +X with Y up and is ~1 unit long; we turn it to face +Z (the game's
// forward) and animate its bones procedurally, so no baked animations are needed.

const SCALE = 1.6;
// How much to lighten the skin toward warm tan (0 = original texture). Raise for lighter.
// Linear-space values: roughly a 40% screen toward a sandy beige.
const SKIN_LIFT = 0x6b5338;
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);   // model's head-to-tail axis (head at +X)
const Z = new THREE.Vector3(0, 0, 1);   // model's right side

export async function createLizardModel(url = '/assets/lizard.glb') {
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;

  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false; // skinned bounds don't follow the bones
      const m = o.material;
      if (m) {
        m.metalness = 0;
        m.roughness = 0.8;
        // Cosy, lighter skin: "screen" the texture toward a warm sandy tan. Dark scales
        // lift a lot, light/blue areas barely change, so the pattern stays readable.
        m.onBeforeCompile = (shader) => {
          shader.uniforms.skinLift = { value: new THREE.Color(SKIN_LIFT) };
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec3 skinLift;')
            .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = 1.0 - (1.0 - diffuseColor.rgb) * (1.0 - skinLift);');
        };
        m.needsUpdate = true;
      }
    }
  });

  const root = new THREE.Group();   // positioned/rotated by the game (feet at y=0, faces +Z)
  const body = new THREE.Group();   // push-ups bob this
  root.add(body);
  const turn = new THREE.Group();
  turn.rotation.y = -Math.PI / 2;   // model +X -> game +Z
  turn.scale.setScalar(SCALE);
  body.add(turn);
  turn.add(model);
  model.updateMatrixWorld(true);

  // ---- Bone rig helpers ----
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const get = (n) => bones[n] || null;

  // Rotations are given around MODEL-space axes; convert into each bone's parent space
  // using the rest pose, then apply on top of the bone's rest rotation.
  const modelInv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const rig = new Map();
  function prep(bone) {
    if (!bone || rig.has(bone)) return;
    const pm = new THREE.Matrix4().multiplyMatrices(modelInv, bone.parent.matrixWorld);
    const pq = new THREE.Quaternion();
    pm.decompose(new THREE.Vector3(), pq, new THREE.Vector3());
    rig.set(bone, { rest: bone.quaternion.clone(), parentInv: pq.invert() });
  }
  const tmpQ = new THREE.Quaternion(), tmpA = new THREE.Vector3(), accQ = new THREE.Quaternion();
  // pose(bone, [[axis, angle], ...]) — combined rotation in model space
  function pose(bone, rots) {
    if (!bone) return;
    const r = rig.get(bone);
    accQ.identity();
    for (const [axis, ang] of rots) {
      if (!ang) continue;
      tmpA.copy(axis).applyQuaternion(r.parentInv);
      tmpQ.setFromAxisAngle(tmpA, ang);
      accQ.premultiply(tmpQ);
    }
    bone.quaternion.copy(accQ).multiply(r.rest);
  }

  const legs = [
    { bone: get('tripo0_Right_Limb_0'), knee: get('tripo0_Right_Limb_1'), side: 1, front: true, pair: 0 },
    { bone: get('tripo0_Left_Limb_0'), knee: get('tripo0_Left_Limb_1'), side: -1, front: true, pair: Math.PI },
    { bone: get('tripo1_Right_Limb_0'), knee: get('tripo1_Right_Limb_1'), side: 1, front: false, pair: Math.PI },
    { bone: get('tripo1_Left_Limb_0'), knee: get('tripo1_Left_Limb_1'), side: -1, front: false, pair: 0 },
  ];
  // Tripo added a duplicate hind-left chain (bone_80..83); move it with the real one.
  const dupHind = get('bone_80');
  const spine = get('tripoSpine_0'), chest = get('tripoSpine_1');
  const pelvisTail = get('bone_1');
  const tail = ['bone_2', 'bone_3', 'tripoTail_0', 'tripoTail_1', 'tripoTail_2', 'tripoTail_3'].map(get).filter(Boolean);
  const neck = get('tripoHead_2'), snout = get('tripoHead_3');
  [...legs.flatMap((l) => [l.bone, l.knee]), dupHind, spine, chest, pelvisTail, neck, snout, ...tail].forEach(prep);

  let phase = 0, idleT = 0, pushT = 0, sway = 0;

  return {
    root,
    body,
    realistic: true,
    update(dt, { speed = 0, climbing = false, pushups = false, airborne = false, bite = 0 }) {
      idleT += dt;
      const moving = speed > 0.1;
      // stride rate tuned so feet roughly match ground speed
      phase += dt * (moving ? 4 + speed * 1.5 : 0);
      const gait = THREE.MathUtils.lerp(sway, moving ? 1 : 0, Math.min(1, dt * 8));
      sway = gait;

      // ---- Legs: sprawled lizard gait (swing around vertical, lift around body axis)
      for (const l of legs) {
        const s = Math.sin(phase + l.pair) * gait;
        const lift = Math.max(0, Math.cos(phase + l.pair)) * gait;
        const swing = (l.front ? 0.55 : 0.6) * s * l.side;          // + = forward for right legs
        const raise = (airborne ? 0.45 : lift * 0.45) * -l.side;     // lift foot off the ground
        pose(l.bone, [[Y, swing], [X, raise]]);
        pose(l.knee, [[X, (airborne ? 0.3 : lift * 0.35) * -l.side]]);
        if (!l.front && l.side < 0 && dupHind) pose(dupHind, [[Y, swing], [X, raise]]);
      }

      // ---- Body S-curve wiggle (lizards bend sideways as they run)
      const bend = Math.sin(phase) * 0.18 * gait;
      pose(spine, [[Y, bend]]);
      pose(chest, [[Y, bend * 0.6]]);
      pose(pelvisTail, [[Y, -bend * 0.8]]);

      // ---- Tail: travelling wave, gentle idle swish
      const tw = moving ? phase : idleT * 1.4;
      const amp = moving ? 0.2 : 0.07;
      tail.forEach((b, i) => pose(b, [[Y, Math.sin(tw - (i + 1) * 0.7) * amp], [Z, climbing ? 0 : -0.02]]));

      // ---- Head: look around when idle; nod during push-ups
      if (pushups) pushT += dt; else pushT = 0;
      const pu = pushups ? Math.abs(Math.sin(pushT * 9)) : 0;
      const look = moving ? 0 : Math.sin(idleT * 0.7) * 0.45 * (Math.sin(idleT * 0.23) > 0 ? 1 : 0);
      // Bite: head darts forward and snaps down (bite runs 0 -> 1 over the lunge)
      const snap = bite > 0 ? Math.sin(bite * Math.PI) : 0;
      pose(neck, [[Y, look * (1 - snap)], [Z, pu * 0.25 - snap * 0.35]]);
      pose(snout, [[Z, pushups ? pu * 0.15 : snap * 0.3 + Math.sin(idleT * 2.1) * 0.02]]);
      body.position.z = snap * 0.22; // lunge

      // ---- Push-ups: front of the body bobs up (pitch around the hips)
      body.position.y = THREE.MathUtils.lerp(body.position.y, pu * 0.07, 0.5);
      body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, -pu * 0.22, 0.5);
    },
  };
}
