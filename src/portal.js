import * as THREE from 'three';
import { toon } from './materials.js';

// A glowing ring the lizard can walk through. Going through it (either way) flips the
// colours of the whole world; going through again flips them back.
export const PORTAL_R = 1.3; // radius of the opening

// Did a step from `prev` to `cur` pass through the ring? The ring stands at (x, z) on
// ground height y, facing along yaw. Only a short step across the ring's flat face counts,
// so walking round the outside (or being sent back to the start) does nothing.
export function crossedPortal(portal, prev, cur) {
  const nx = Math.sin(portal.yaw), nz = Math.cos(portal.yaw);
  const side = (p) => (p.x - portal.x) * nx + (p.z - portal.z) * nz;
  const a = side(prev), b = side(cur);
  if (a === 0 || a * b > 0) return false;      // still on the same side
  if (Math.abs(a) > 1 || Math.abs(b) > 1) return false; // a jump in position, not a step
  const across = (cur.x - portal.x) * nz - (cur.z - portal.z) * nx;
  if (Math.abs(across) > PORTAL_R * 0.85) return false; // went past beside the ring
  return cur.y >= portal.y - 0.5 && cur.y <= portal.y + PORTAL_R * 2;
}

export function createPortal(scene, spot, groundY) {
  const portal = { x: spot.x, z: spot.z, yaw: spot.yaw ?? 0, y: groundY };
  const group = new THREE.Group();
  group.position.set(portal.x, groundY + PORTAL_R - 0.15, portal.z); // foot of the ring sits in the ground
  group.rotation.y = portal.yaw;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(PORTAL_R + 0.12, 0.17, 10, 40),
    toon(0x8a5cff, { emissive: 0x4a1fd0, emissiveIntensity: 0.6 }),
  );
  ring.castShadow = true;
  group.add(ring);

  // the swirl inside the ring
  const swirl = new THREE.Mesh(
    new THREE.CircleGeometry(PORTAL_R + 0.05, 48),
    new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv - 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float time; varying vec2 vUv;
        void main() {
          float r = length(vUv) * 2.0, a = atan(vUv.y, vUv.x);
          float arms = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - time * 3.0);
          vec3 col = mix(vec3(0.25, 0.9, 1.0), vec3(0.95, 0.3, 1.0), arms);
          col = mix(vec3(1.0), col, smoothstep(0.0, 0.35, r)); // bright middle
          gl_FragColor = vec4(col, 0.55 + 0.35 * arms);
        }`,
    }),
  );
  group.add(swirl);
  scene.add(group);

  const prev = new THREE.Vector3();
  let hasPrev = false;
  return {
    portal, group,
    // forget where the lizard was (after a restart) so the jump back doesn't count
    reset() { hasPrev = false; },
    // true on the frame the lizard steps through
    update(dt, t, pos) {
      swirl.material.uniforms.time.value = t;
      ring.scale.setScalar(1 + 0.025 * Math.sin(t * 2.4));
      const went = hasPrev && crossedPortal(portal, prev, pos);
      prev.copy(pos); hasPrev = true;
      return went;
    },
  };
}

// Draws the frame with every colour flipped, except the lizard, which keeps its own.
// How: draw the world, flip what is on screen, then draw the lizard again on top.
// The lizard must be on layer 1 as well as layer 0 (see markUnflipped).
export function createFlip(renderer) {
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({
    color: 0xffffff, toneMapped: false, fog: false, depthTest: false, depthWrite: false,
    // result = 1 - what is already on screen
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneMinusDstColorFactor, blendDst: THREE.ZeroFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.ZeroFactor, // stay solid: only the colours flip
  })));
  return {
    on: false,
    // keep these objects (and the lights that shine on them) in their own colours
    markUnflipped(scene, root) {
      root.traverse((o) => o.layers.enable(1));
      scene.traverse((o) => { if (o.isLight) o.layers.enable(1); });
    },
    render(scene, camera) {
      renderer.render(scene, camera);
      if (!this.on) return;
      renderer.autoClear = false;
      renderer.render(quadScene, quadCam);
      renderer.shadowMap.autoUpdate = false; // keep the shadows the whole world just cast
      camera.layers.set(1);
      renderer.render(scene, camera);
      camera.layers.set(0);
      renderer.shadowMap.autoUpdate = true;
      renderer.autoClear = true;
    },
  };
}
