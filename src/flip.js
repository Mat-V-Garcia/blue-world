import * as THREE from 'three';

// The inverted levels: the frame is drawn with every colour flipped, except the lizard,
// which keeps its own.
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
  // Lights out (the inverted Mama Cat's fight): the finished picture is blacked out, then
  // the few things marked with markDark are drawn again on top (layer 2).
  const darkMat = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0, toneMapped: false, fog: false, depthTest: false, depthWrite: false,
  });
  const darkScene = new THREE.Scene();
  darkScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), darkMat));
  return {
    on: false,
    dark: 0,          // 0 = lights on .. 1 = pitch dark
    onDarkPass: null, // called with true just before the lit things are drawn, false just after
    // keep these objects (and the lights that shine on them) in their own colours
    markUnflipped(scene, root) {
      root.traverse((o) => o.layers.enable(1));
      scene.traverse((o) => { if (o.isLight) o.layers.enable(1); });
    },
    // these objects can still be seen when it is dark
    markDark(scene, root) {
      root.traverse((o) => o.layers.enable(2));
      scene.traverse((o) => { if (o.isLight) o.layers.enable(2); });
    },
    render(scene, camera) {
      renderer.render(scene, camera);
      if (!this.on && this.dark <= 0) return;
      renderer.autoClear = false;
      renderer.shadowMap.autoUpdate = false; // keep the shadows the whole world just cast
      if (this.on) {
        renderer.render(quadScene, quadCam);
        camera.layers.set(1);
        renderer.render(scene, camera);
      }
      if (this.dark > 0) {
        darkMat.opacity = Math.min(1, this.dark);
        renderer.render(darkScene, quadCam);
        this.onDarkPass?.(true);
        camera.layers.set(2);
        renderer.render(scene, camera);
        this.onDarkPass?.(false);
      }
      camera.layers.set(0);
      renderer.shadowMap.autoUpdate = true;
      renderer.autoClear = true;
    },
  };
}

// Face only: while `on` is 1, a red-skinned enemy is drawn only within `r` of the point `at`
// (given in the camera's own space). main.js switches it on for the dark pass, so that all
// that shows of Mama Cat in the dark is her face.
export const faceMask = { on: { value: 0 }, at: { value: new THREE.Vector3() }, r: { value: 1 } };

// In the flipped world the enemies don't flip like everything else: they turn red and
// black. Light parts of an enemy go red, dark parts go black. (They also have to be
// marked unflipped, like the lizard, so the flip leaves these colours alone.)
export function createRedSkin() {
  const reds = new Map(); // an enemy's own material -> its red-and-black copy
  const redOf = (mat) => {
    if (!reds.has(mat)) {
      const m = mat.clone();
      m.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          float redSkinL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(vec3(0.012), vec3(1.0, 0.04, 0.02), smoothstep(RED_LO, RED_HI, redSkinL));
          if (uFaceOn > 0.5 && distance(-vViewPosition, uFaceAt) > uFaceR) discard;`)
          .replace('void main() {', `#define RED_LO ${RED_RAMP[0].toFixed(3)}\n#define RED_HI ${RED_RAMP[1].toFixed(3)}
uniform float uFaceOn; uniform vec3 uFaceAt; uniform float uFaceR;\nvoid main() {`);
        shader.uniforms.uFaceOn = faceMask.on; shader.uniforms.uFaceAt = faceMask.at; shader.uniforms.uFaceR = faceMask.r;
      };
      m.customProgramCacheKey = () => 'redskin';
      reds.set(mat, m);
    }
    return reds.get(mat);
  };
  return {
    // switch one enemy (its whole model) to red and black, or back to its own colours
    apply(root, on) {
      root.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        o.userData.ownMaterial ??= o.material;
        const own = o.userData.ownMaterial;
        o.material = !on ? own : Array.isArray(own) ? own.map(redOf) : redOf(own);
      });
    },
  };
}
// How bright a part of the enemy must be to count as black (below the first number)
// or fully red (above the second).
const RED_RAMP = [0.03, 0.3];
