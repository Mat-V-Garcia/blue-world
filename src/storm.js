import * as THREE from 'three';

// The boss fight's weather. One number drives it: 0 = clear blue desert day, 1 = dark red
// thunderstorm. The sky, haze and lights blend between the two, and from half way up
// lightning strikes beyond the arena wall.
const RED = {
  top: 0x3a0508, bottom: 0x8a2a1c, painting: 0xb8483a,
  hemi: 0xff8a6a, ground: 0x6a2a1a, hemiI: 1.1, sun: 0xff7a4a, sunI: 1.9,
};
const MIN_GAP = 1.5;   // lightning is never closer together than this (no strobing)
const FLASH = 0.8, FLASH_TIME = 0.25, BOLT_TIME = 0.2;

export function stormLevel(health, maxHealth) {
  return Math.min(1, Math.max(0, 1 - health / maxHealth));
}

// Seconds until the next bolt (rand in 0..1), or null while the storm is too mild.
export function lightningGap(storm, rand) {
  if (storm < 0.5) return null;
  const k = Math.min(1, (storm - 0.5) / (5 / 6 - 0.5));
  const lo = 5 + (1.5 - 5) * k, hi = 9 + (4 - 9) * k;
  return Math.max(MIN_GAP, lo + rand * (hi - lo));
}

// sky: { top, bottom, painting } from buildSky (may be null); fog: scene.fog;
// hemi / sun: the scene's HemisphereLight and DirectionalLight.
// lightning: false gives the colours only (the cat boss's sunset).
export function createStorm(scene, { sky, fog, hemi, sun, lightning = true }, rand = Math.random) {
  const pairs = []; // [colour to drive, its calm value, its storm value]
  const pair = (c, hex) => { if (c) pairs.push([c, c.clone(), new THREE.Color(hex)]); };
  pair(sky?.top, RED.top); pair(sky?.bottom, RED.bottom); pair(sky?.painting?.color, RED.painting);
  pair(fog?.color, RED.bottom); pair(hemi.color, RED.hemi); pair(hemi.groundColor, RED.ground); pair(sun.color, RED.sun);
  const hemiI = hemi.intensity, sunI = sun.intensity;

  const boltMat = new THREE.MeshBasicMaterial({ color: 0xfff0dc, fog: false });
  let target = 0, next = null, flash = 0, bolt = null, boltT = 0;

  // lookYaw (optional): the way the camera faces, so bolts land where they can be seen
  function strike(lookYaw) {
    const a = lookYaw === undefined ? rand() * Math.PI * 2 : lookYaw + (rand() - 0.5) * 1.6, R = 300;
    bolt = new THREE.Group();
    let x = 0, y = 150;
    while (y > 12) { // a jagged line of short segments coming down
      const ny = y - (14 + rand() * 16), nx = x + (rand() - 0.5) * 30;
      const len = Math.hypot(nx - x, ny - y);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(2.4, len + 1, 2.4), boltMat);
      seg.position.set((x + nx) / 2, (y + ny) / 2, 0);
      seg.rotation.z = Math.atan2(-(nx - x), ny - y); // box's long (Y) axis along the segment
      bolt.add(seg);
      x = nx; y = ny;
    }
    bolt.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
    bolt.rotation.y = a;
    scene.add(bolt);
    boltT = BOLT_TIME; flash = 1;
  }

  const storm = {
    level: 0,
    set(t) { target = Math.min(1, Math.max(0, t)); },
    update(dt, lookYaw) {
      const d = target - storm.level;
      storm.level += Math.sign(d) * Math.min(Math.abs(d), dt); // eases at 1 per second
      const k = storm.level;
      for (const [c, calm, red] of pairs) c.copy(calm).lerp(red, k);
      flash = Math.max(0, flash - dt / FLASH_TIME);
      hemi.intensity = hemiI + (RED.hemiI - hemiI) * k + flash * FLASH;
      sun.intensity = sunI + (RED.sunI - sunI) * k;

      if (bolt && (boltT -= dt) <= 0) { scene.remove(bolt); bolt.children.forEach((m) => m.geometry.dispose()); bolt = null; }
      let struck = false;
      if (k < 0.5 || !lightning) next = null;
      else if (next === null) next = lightningGap(k, rand());
      else if ((next -= dt) <= 1e-9) { strike(lookYaw); struck = true; next = lightningGap(k, rand()); }
      return { bolt: struck };
    },
    reset() {
      target = 0; storm.level = 0; next = null; flash = 0;
      if (bolt) { scene.remove(bolt); bolt = null; }
    },
  };
  return storm;
}
