import * as THREE from 'three';

// Shared soft toon ramp: 4 bands keeps the chunky "cosy cartoon" look.
const ramp = new Uint8Array([90, 150, 210, 255]);
export const gradientMap = new THREE.DataTexture(ramp, ramp.length, 1, THREE.RedFormat);
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

export function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
}

const loader = new THREE.TextureLoader();
const cache = {};

// Loads a texture from /assets; resolves to null if the file is missing so the game
// still runs with flat colours.
export function loadTexture(name) {
  if (!cache[name]) {
    cache[name] = new Promise((resolve) => {
      loader.load(`/assets/${name}`, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        resolve(t);
      }, undefined, () => resolve(null));
    });
  }
  return cache[name];
}

export function tiled(tex, rx, ry) {
  if (!tex) return null;
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}
