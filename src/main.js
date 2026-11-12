import * as THREE from 'three';
import { terrainHeight, footprint } from './world.js';
import { LEVELS, currentLevelId, unlockedLevel, unlockLevel } from './levels/index.js';
import { loadPigeonModel, createSimplePigeon } from './pigeonModel.js';
import { createLizard } from './lizard.js';
import { createLizardModel } from './lizardModel.js';
import { createTarantulas, createSimpleSpider } from './enemies.js';
import { loadSpiderModel } from './spiderModel.js';
import { createTouchControls, isTouchDevice } from './touch.js';
import { Player, CLING_GAP } from './player.js';
import { createPebbles, createDust } from './pebbles.js';
import { sfx } from './audio.js';

const TOTAL = 10;
const $ = (id) => document.getElementById(id);

// ---------- Renderer / scene ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// Tablets: render at a slightly lower resolution and shadow quality to keep it smooth
const LIGHT_MODE = matchMedia("(pointer: coarse)").matches;
renderer.setPixelRatio(Math.min(devicePixelRatio, LIGHT_MODE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
// Clear midday air: pale blue haze, pushed far out (colour replaced by the painted sky's horizon)
scene.fog = new THREE.Fog(0xcfe3f2, 70, 260);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 1200);

// Blue World daytime: cool blue skylight from above, warm sand bounce from below, bright white-gold sun
scene.add(new THREE.HemisphereLight(0xcfe4ff, 0xd9a877, 1.45));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.7);
sun.castShadow = true;
sun.shadow.mapSize.set(LIGHT_MODE ? 1024 : 2048, LIGHT_MODE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(-0.45, 0.85, -0.35).normalize(); // high midday sun

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---------- Input ----------
const keys = {};
let jumpPressed = false;
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { if (!keys.Space) jumpPressed = true; e.preventDefault(); }
  if (e.code === 'KeyF' && !keys.KeyF) bitePressed = true;
  keys[e.code] = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
// If the window loses focus while a key is held we never get its keyup, which left
// actions (like push-ups) stuck on. Release everything when focus goes away.
const releaseAll = () => { for (const k in keys) keys[k] = false; jumpPressed = false; bitePressed = false; touch?.releaseAll(); };
addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) releaseAll(); });

let camYaw = Math.PI, camPitch = 0.22, camDist = 3.8;
let lastMouse = -10;        // time of last mouse look (auto-follow waits after this)
let moveBasisYaw = camYaw;  // camera yaw the current key combo is measured against
let lastKeyCombo = '';
const lockPointer = () => {
  if (touch.state.enabled) return; // tablets look around by dragging instead
  try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* drag-to-look fallback */ }
};
let stickBasisAng = null;

// ---------- Touch (tablet) controls ----------
const touch = createTouchControls({
  onLook(dx, dy) {
    if (state !== 'play') return;
    camYaw -= dx * 0.007;
    camPitch = THREE.MathUtils.clamp(camPitch + dy * 0.005, -0.25, 1.3);
    lastMouse = t; // pause auto-follow while the player looks around
  },
});
if (isTouchDevice() && matchMedia('(pointer: coarse)').matches) touch.enable();
// a touchscreen laptop: switch to touch mode the first time a finger is used
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') touch.enable(); });
const fsBtn = document.getElementById('btn-fs');
const fsTarget = document.documentElement;
if (!(fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen)) fsBtn.style.display = 'none';
fsBtn.addEventListener('click', () => {
  if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else (fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen).call(fsTarget)?.catch?.(() => {});
});
let dragging = false;
canvas.addEventListener('mousedown', () => {
  dragging = true;
  if (state === 'play' && document.pointerLockElement !== canvas) lockPointer();
});
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => {
  if (state !== 'play') return;
  if (document.pointerLockElement === canvas || dragging) {
    camYaw -= e.movementX * 0.0035;
    if (Math.abs(e.movementX) > 0) { lastMouse = t; moveBasisYaw = camYaw; }
    camPitch = THREE.MathUtils.clamp(camPitch + e.movementY * 0.003, -0.25, 1.3);
  }
});
canvas.addEventListener('wheel', (e) => { camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.004, 2.2, 10); }, { passive: true });
document.addEventListener('pointerlockchange', () => {
  $('paused').classList.toggle('hidden', document.pointerLockElement === canvas || state !== 'play');
});

// ---------- Game objects ----------
let state = 'loading';
let world, player, lizard, pebbles, dust, tarantulas;
let collected = 0, elapsed = 0;
// Health: 3 hearts. A touch costs one; they refill slowly if you stay out of trouble.
const MAX_HEARTS = 3, INVULN_TIME = 1.6, REGEN_DELAY = 8, REGEN_EVERY = 10;
let hearts = MAX_HEARTS, invuln = 0, sinceHit = 99, regenT = 0;
let biteT = 0, biteCD = 0, bitePressed = false;
const camTarget = new THREE.Vector3();
const camRay = new THREE.Raycaster();
const camDir = new THREE.Vector3();

const LEVEL_ID = currentLevelId();
const LEVEL = LEVELS[LEVEL_ID - 1];

async function init() {
  setupTitle();
  const levelModule = await LEVEL.load();
  world = await levelModule.build(scene);
  if (world.horizonColor) scene.fog.color.copy(world.horizonColor);
  try {
    lizard = await createLizardModel();
  } catch (err) {
    console.warn('Realistic lizard model failed to load, using the simple one', err);
    lizard = createLizard();
  }
  scene.add(lizard.root);
  dust = createDust(scene);
  // Each level picks its enemy: tarantulas in the desert, pigeons at the shops.
  const foe = world.enemies || { kind: 'tarantula' };
  const [loadModel, simple] = foe.kind === 'pigeon' ? [loadPigeonModel, createSimplePigeon] : [loadSpiderModel, createSimpleSpider];
  let makeEnemy = simple;
  try {
    makeEnemy = await loadModel();
  } catch (err) {
    console.warn(`${foe.kind} model failed to load, using the simple one`, err);
  }
  tarantulas = createTarantulas(scene, world.colliders, world.pebbleSpots, makeEnemy, foe);
  reset();
  state = 'title';
  renderer.setAnimationLoop(loop);
  if (new URLSearchParams(location.search).has('go')) start();
}

function reset() {
  if (pebbles) pebbles.pebbles.forEach((p) => scene.remove(p.group));
  pebbles = createPebbles(scene, world.pebbleSpots);
  player = new Player(world.colliders);
  player.yaw = Math.PI * 0.25;
  if (world.spawn) { // each level can choose where the lizard starts
    player.pos.set(world.spawn.x, terrainHeight(world.spawn.x, world.spawn.z), world.spawn.z);
    player.spawn.copy(player.pos);
    player.yaw = world.spawn.yaw ?? player.yaw;
  }
  camYaw = player.yaw + Math.PI;
  moveBasisYaw = camYaw;
  lastKeyCombo = '';
  collected = 0;
  elapsed = 0;
  $('count').textContent = '0';
  camTarget.copy(player.pos);
  hearts = MAX_HEARTS; invuln = 0; sinceHit = 99;
  drawHearts();
  tarantulas?.reset();
}

function drawHearts() {
  $('hearts').innerHTML = Array.from({ length: MAX_HEARTS }, (_, i) =>
    `<span class="heart${i < hearts ? '' : ' empty'}">♥</span>`).join('');
}

function getHurt(from) {
  hearts--;
  invuln = INVULN_TIME;
  sinceHit = 0; regenT = 0;
  player.hurt(from.x, from.z);
  sfx.hurt();
  drawHearts();
  const h = $('hearts');
  h.classList.add('shake');
  setTimeout(() => h.classList.remove('shake'), 400);
  if (hearts <= 0) {
    // out of hearts: back to the start, pebbles kept
    toast('Ouch! Back to the start');
    $('flash').classList.add('show');
    setTimeout(() => {
      player.respawn();
      camYaw = player.yaw + Math.PI; moveBasisYaw = camYaw;
      camTarget.copy(player.pos);
      hearts = MAX_HEARTS; invuln = 2.5;
      drawHearts();
      $('flash').classList.remove('show');
    }, 450);
  } else {
    toast('Ouch!');
  }
}

function start() {
  sfx.unlock();
  $('title').classList.add('hidden');
  $('win').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('hint').style.opacity = 1;
  state = 'play';
  camYaw = player.yaw + Math.PI; // start right behind the lizard (title screen orbits)
  moveBasisYaw = camYaw;
  lockPointer();
  setTimeout(() => { $('hint').style.opacity = 0; }, 14000);
}
$('play').onclick = start;
$('again').onclick = () => { reset(); start(); };
$('next').onclick = () => goToLevel(LEVEL_ID + 1, true);

// Switching level reloads the page with ?level=N (keeps memory clean); &go starts it.
function goToLevel(id, autostart) {
  const q = new URLSearchParams({ level: String(id) });
  if (autostart) q.set('go', '1');
  location.search = q.toString();
}

// Title screen: this level's name, story and picture, plus a picker for unlocked levels.
function setupTitle() {
  document.title = LEVEL_ID === 1 ? 'Blue World' : `Blue World · ${LEVEL.name}`;
  $('level-name').textContent = `Level ${LEVEL_ID} · ${LEVEL.name}`;
  $('level-intro').textContent = LEVEL.intro;
  document.querySelector('#title .art').style.backgroundImage = `url('${LEVEL.title}')`;
  const open = unlockedLevel();
  $('levels').innerHTML = LEVELS.map((l) => {
    const locked = l.id > open, here = l.id === LEVEL_ID;
    return `<button class="lvl${here ? ' here' : ''}" data-id="${l.id}" ${locked ? 'disabled' : ''}>`
      + `${locked ? '🔒' : l.id} <span>${l.name}</span></button>`;
  }).join('');
  $('levels').querySelectorAll('button:not([disabled])').forEach((b) => {
    b.onclick = () => { if (Number(b.dataset.id) !== LEVEL_ID) goToLevel(Number(b.dataset.id), false); };
  });
  $('levels').classList.toggle('hidden', LEVELS.length < 2);
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------- Loop ----------
const clock = new THREE.Clock();
let t = 0, pushTick = 0, dustTick = 0;

function loop() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  t += dt;
  const playing = state === 'play';

  // movement relative to camera
  let ix = 0, iz = 0;
  touch.show(playing && touch.state.enabled);
  if (playing) {
    let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    let r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    // While the same keys are held, keep heading the same way in the world even as the
    // camera swings round behind the lizard (otherwise A/D/S would run in circles).
    const combo = `${f},${r}`;
    if (combo !== lastKeyCombo) { moveBasisYaw = camYaw; lastKeyCombo = combo; }
    // Touch joystick: same idea — keep the heading while the thumb points the same way,
    // re-aim from the camera when the thumb swings to a new direction or lets go.
    const st = touch.state;
    if (st.active && (st.x || st.y)) {
      const ang = Math.atan2(st.x, st.y);
      let dA = ang - stickBasisAng; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
      if (stickBasisAng === null || Math.abs(dA) > 0.6) { moveBasisYaw = camYaw; stickBasisAng = ang; }
      f = st.y; r = st.x;
    } else if (stickBasisAng !== null) { stickBasisAng = null; lastKeyCombo = ''; }
    const by = moveBasisYaw;
    const fx = -Math.sin(by), fz = -Math.cos(by);
    ix = fx * f + Math.cos(by) * r;
    iz = fz * f - Math.sin(by) * r;
    const len = Math.hypot(ix, iz);
    if (len > 0) { ix /= len; iz /= len; }
  }
  if (touch.consumeJump()) jumpPressed = true;
  if (touch.consumeBite()) bitePressed = true;
  const pushups = playing && (keys.KeyE || touch.state.pushups) && player.onGround && !player.climbing && Math.hypot(ix, iz) === 0;
  const wasGround = player.onGround;
  player.update(dt, { x: ix, z: iz, sprint: keys.ShiftLeft || keys.ShiftRight || touch.state.sprint, jump: playing && jumpPressed });
  if (jumpPressed && wasGround && !player.onGround) sfx.jump();
  jumpPressed = false;

  // ---- Bite (F): quick lunge; defeats a tarantula right in front of the snout
  biteCD -= dt;
  if (biteT > 0) biteT = Math.min(1, biteT + dt / 0.28);
  if (biteT >= 1) biteT = 0;
  if (playing && bitePressed && biteCD <= 0 && !player.climbing) {
    biteT = 0.001; biteCD = 0.45;
    sfx.bite();
    if (tarantulas.bite(player.pos, player.yaw)) { sfx.stomp(); toast('Chomp!'); }
  }
  bitePressed = false;

  // ---- Tarantulas: stomp them from above, or get hurt if they touch you
  const spiderHit = tarantulas.update(dt, player, playing && invuln <= 0 && state === 'play');
  if (spiderHit.result === 'stomp') {
    player.velY = 8.5; player.onGround = false; // bounce off
    sfx.stomp(); toast('Squish!');
  } else if (spiderHit.result === 'hurt') {
    getHurt(spiderHit.from);
  }
  invuln = Math.max(0, invuln - dt);
  sinceHit += dt;
  if (playing && hearts < MAX_HEARTS && sinceHit > REGEN_DELAY) {
    regenT += dt;
    if (regenT > REGEN_EVERY) { regenT = 0; hearts++; drawHearts(); }
  }
  lizard.root.visible = invuln > 0 ? Math.floor(t * 14) % 2 === 0 : true; // flash while safe

  if (player.landed) { dust.puff(player.pos, 10, 1); sfx.land(); }
  if (player.onGround && player.speed > 8) {
    dustTick += dt;
    if (dustTick > 0.12) { dustTick = 0; dust.puff(player.pos, 2, 0.4); }
  }
  if (pushups) { pushTick += dt; if (pushTick > 0.35) { pushTick = 0; sfx.pushup(); } }

  // lizard pose
  const L = lizard.root;
  L.position.copy(player.pos);
  if (player.climbing) {
    // physics keeps the body centre a little off the wall; press the belly flat against it
    L.position.x -= player.wallN.x * (CLING_GAP - 0.05);
    L.position.z -= player.wallN.y * (CLING_GAP - 0.05);
  }
  L.rotation.order = 'YXZ';
  L.rotation.y = player.yaw;
  let pitch = 0;
  if (player.climbing) pitch = -Math.PI / 2;
  else if (player.onGround) {
    const ax = Math.sin(player.yaw) * 0.4, az = Math.cos(player.yaw) * 0.4;
    const p = player.pos;
    pitch = -Math.atan2(terrainHeight(p.x + ax, p.z + az) - terrainHeight(p.x - ax, p.z - az), 0.8);
    if (Math.abs(p.y - terrainHeight(p.x, p.z)) > 0.1) pitch = 0; // standing on a prop
  }
  L.rotation.x = THREE.MathUtils.lerp(L.rotation.x, pitch, Math.min(1, dt * 12));
  lizard.update(dt, { speed: player.speed, climbing: player.climbing, pushups, airborne: !player.onGround && !player.climbing, bite: biteT });

  // world + pebbles
  world.update(dt, t);
  dust.update(dt);
  const got = pebbles.update(dt, t, new THREE.Vector3(player.pos.x, player.pos.y + 0.25, player.pos.z));
  if (got && playing) {
    collected++;
    $('count').textContent = collected;
    const c = document.querySelector('.counter');
    c.classList.add('bump');
    setTimeout(() => c.classList.remove('bump'), 150);
    sfx.pickup(collected);
    toast(collected === TOTAL ? 'All the pebbles!' : `+1 · ${got.hint}`);
    if (collected === TOTAL) {
      state = 'win';
      sfx.win();
      setTimeout(() => {
        document.exitPointerLock?.();
        $('wintime').textContent = fmt(elapsed);
        const hasNext = LEVEL_ID < LEVELS.length;
        if (hasNext) unlockLevel(LEVEL_ID + 1);
        $('next').classList.toggle('hidden', !hasNext);
        $('win-msg').textContent = hasNext ? `Level ${LEVEL_ID + 1} · ${LEVELS[LEVEL_ID].name} is unlocked!` : 'You finished every level. Do a victory push-up!';
        $('win').classList.remove('hidden');
      }, 1200);
    }
  }
  if (playing) { elapsed += dt; $('timer').textContent = fmt(elapsed); }

  // camera
  if (state === 'title') camYaw += dt * 0.15; // slow orbit behind the title card
  // Auto-follow: ease the camera round behind the lizard while it moves, so you can
  // always see where you're going. Mouse look pauses this for a moment.
  if (playing && player.speed > 0.5 && t - lastMouse > 0.8) {
    const behind = player.yaw + Math.PI;
    let d = behind - camYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const rate = 2.2 * Math.min(1, player.speed / 5.5); // radians/sec-ish
    camYaw += d * Math.min(1, rate * dt);
  }
  camTarget.lerp(new THREE.Vector3(player.pos.x, player.pos.y + 0.55, player.pos.z), Math.min(1, dt * 10));
  const cp = Math.cos(camPitch);
  const off = new THREE.Vector3(Math.sin(camYaw) * cp, Math.sin(camPitch), Math.cos(camYaw) * cp).multiplyScalar(camDist);
  const want = camTarget.clone().add(off);
  // keep the camera above the sand AND above any rock, mesa or prop top it passes over
  let floor = terrainHeight(want.x, want.z);
  for (const c of world.colliders) {
    if (c.top > floor && c.top < camTarget.y + 1.5 && footprint(c, want.x, want.z).dist < 0.3) floor = c.top;
  }
  floor += 0.35;
  if (want.y < floor) want.y = floor;
  // Don't let the camera pass through rocks, cacti, posts, the wagon or the arch:
  // look back from the lizard to the camera and pull in in front of the first thing hit.
  camRay.set(camTarget, camDir.subVectors(want, camTarget).normalize());
  camRay.far = camTarget.distanceTo(want);
  const hit = world.solids.length ? camRay.intersectObjects(world.solids, true)[0] : null;
  if (hit) {
    want.copy(camTarget).addScaledVector(camDir, Math.max(0.3, hit.distance - 0.3));
    camera.position.copy(want); // snap: easing in would slide through the rock
  } else {
    camera.position.lerp(want, Math.min(1, dt * 14));
  }
  camera.lookAt(camTarget);

  // shadow camera follows the lizard
  sun.position.copy(player.pos).addScaledVector(SUN_DIR, 80);
  sun.target.position.copy(player.pos);

  renderer.render(scene, camera);
}

init();
// handy for debugging / testing in the console
window.__game = { get player() { return player; }, get pebbles() { return pebbles; }, get camYaw() { return camYaw; }, get keys() { return keys; }, get tarantulas() { return tarantulas; }, get hearts() { return hearts; }, start };
