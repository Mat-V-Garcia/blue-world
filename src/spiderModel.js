import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Desert blonde tarantula from Magnific's 3D Generator (Tripo P1, rigged).
// The GLB faces +X, Y up, ~1 unit across including legs. Tripo found 7 leg chains
// (3 bones each); we find them by shape, not by name, and animate them in code.

const SCALE = 1.1;
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);

export async function loadSpiderModel(url = '/assets/tarantula.glb') {
  const gltf = await new GLTFLoader().loadAsync(url);
  const source = gltf.scene;
  source.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
      if (o.material) { o.material.metalness = 0; o.material.roughness = 0.85; }
    }
  });

  // factory: one independent, animated tarantula per call
  return function makeSpider() {
    const model = cloneSkinned(source);
    const root = new THREE.Group();
    const turn = new THREE.Group();
    turn.rotation.y = -Math.PI / 2; // model +X -> game +Z
    turn.scale.setScalar(SCALE);
    root.add(turn);
    turn.add(model);
    model.updateMatrixWorld(true);

    const modelInv = new THREE.Matrix4().copy(model.matrixWorld).invert();
    const worldPos = (b) => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).applyMatrix4(modelInv);

    // A leg = a bone whose chain is 3 long and whose tip ends far from the body centre.
    const legs = [];
    model.traverse((b) => {
      if (!b.isBone || b.children.length !== 1 || !b.children[0].isBone) return;
      const mid = b.children[0], tip = mid.children.find((c) => c.isBone);
      if (!tip) return;
      if (b.parent && b.parent.isBone && legs.some((l) => l.bone === b.parent || l.mid === b.parent)) return;
      const tp = worldPos(tip);
      if (Math.hypot(tp.x, tp.z) < 0.25) return; // not reaching out: not a leg
      legs.push({ bone: b, mid, tip: tp, side: Math.sign(tp.z) || 1 });
    });
    // order legs front-to-back per side, then alternate them in two groups (tetrapod gait)
    for (const side of [-1, 1]) {
      legs.filter((l) => l.side === side).sort((a, b) => b.tip.x - a.tip.x)
        .forEach((l, k) => { l.group = (k + (side > 0 ? 1 : 0)) % 2; });
    }

    // rest pose + model-space rotation helper (same approach as the lizard)
    const rig = new Map();
    const prep = (bone) => {
      const pm = new THREE.Matrix4().multiplyMatrices(modelInv, bone.parent.matrixWorld);
      const pq = new THREE.Quaternion();
      pm.decompose(new THREE.Vector3(), pq, new THREE.Vector3());
      rig.set(bone, { rest: bone.quaternion.clone(), parentInv: pq.invert() });
    };
    legs.forEach((l) => { prep(l.bone); prep(l.mid); });
    const tq = new THREE.Quaternion(), ta = new THREE.Vector3(), acc = new THREE.Quaternion();
    const pose = (bone, rots) => {
      const r = rig.get(bone);
      acc.identity();
      for (const [axis, ang] of rots) {
        ta.copy(axis).applyQuaternion(r.parentInv);
        tq.setFromAxisAngle(ta, ang);
        acc.premultiply(tq);
      }
      bone.quaternion.copy(acc).multiply(r.rest);
    };

    let phase = Math.random() * 10, idle = Math.random() * 10;
    return {
      root,
      update(dt, speed) {
        idle += dt;
        const g = Math.min(1, speed);
        phase += dt * (3 + speed * 5);
        for (const l of legs) {
          const p = phase + l.group * Math.PI;
          const swing = Math.sin(p) * 0.35 * g;
          const lift = Math.max(0, Math.cos(p)) * 0.4 * g;
          // idle: legs twitch now and then, like a real tarantula tasting the ground
          const twitch = g < 0.1 ? Math.max(0, Math.sin(idle * 1.3 + l.tip.x * 9)) ** 8 * 0.25 : 0;
          pose(l.bone, [[Y, swing * l.side], [X, -(lift + twitch) * l.side]]);
          pose(l.mid, [[X, (lift * 0.6) * l.side]]);
        }
        turn.position.y = Math.abs(Math.sin(phase * 2)) * 0.015 * g; // little bob while scuttling
      },
    };
  };
}
