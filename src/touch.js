// On-screen controls for tablets (and phones):
//  - left half: a floating joystick appears under your thumb (push far to run)
//  - right half: drag to look around
//  - buttons: Jump, Bite, Push-ups
// Uses pointer events, so several fingers work at once.

const DEADZONE = 0.15;
const RUN_AT = 0.85;      // stick pushed this far = sprint
const STICK_RADIUS = 60;  // px

export function isTouchDevice() {
  return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

export function createTouchControls({ onLook }) {
  const layer = document.getElementById('touch');
  const base = document.getElementById('stick-base');
  const knob = document.getElementById('stick-knob');

  const state = { x: 0, y: 0, sprint: false, active: false, jump: false, bite: false, pushups: false, enabled: false };
  let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;

  function enable() {
    if (state.enabled) return;
    state.enabled = true;
    document.body.classList.add('touch-mode');
  }

  function setStick(dx, dy) {
    const d = Math.hypot(dx, dy), k = d > STICK_RADIUS ? STICK_RADIUS / d : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    let m = Math.min(1, d / STICK_RADIUS);
    if (m < DEADZONE) { state.x = 0; state.y = 0; state.sprint = false; return; }
    m = (m - DEADZONE) / (1 - DEADZONE);
    state.x = (dx / d) * m;      // right +
    state.y = -(dy / d) * m;     // forward +
    state.sprint = Math.min(1, d / STICK_RADIUS) >= RUN_AT;
  }

  layer.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    enable();
    if (e.target.closest('.tbtn')) return; // buttons handle themselves
    e.preventDefault();
    if (e.clientX < innerWidth * 0.45 && stickId === null) {
      stickId = e.pointerId; sx = e.clientX; sy = e.clientY;
      base.style.left = `${sx}px`; base.style.top = `${sy}px`;
      base.classList.add('show');
      state.active = true;
      setStick(0, 0);
    } else if (lookId === null) {
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
    }
    layer.setPointerCapture?.(e.pointerId);
  });
  layer.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) setStick(e.clientX - sx, e.clientY - sy);
    else if (e.pointerId === lookId) {
      onLook(e.clientX - lx, e.clientY - ly);
      lx = e.clientX; ly = e.clientY;
    }
  });
  const end = (e) => {
    if (e.pointerId === stickId) {
      stickId = null; state.active = false; state.x = 0; state.y = 0; state.sprint = false;
      base.classList.remove('show');
      knob.style.transform = '';
    } else if (e.pointerId === lookId) lookId = null;
  };
  layer.addEventListener('pointerup', end);
  layer.addEventListener('pointercancel', end);

  // Buttons
  const bind = (id, down, up) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); enable(); el.classList.add('down'); down(); });
    const release = () => { el.classList.remove('down'); up?.(); };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
  };
  bind('btn-jump', () => { state.jump = true; });
  bind('btn-bite', () => { state.bite = true; });
  bind('btn-push', () => { state.pushups = true; }, () => { state.pushups = false; });

  // Stop iPad Safari from zooming / scrolling the page during play
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => { if (e.target.closest('#touch, #game')) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault());

  return {
    state,
    show(on) { layer.classList.toggle('hidden', !on); },
    consumeJump() { const j = state.jump; state.jump = false; return j; },
    consumeBite() { const b = state.bite; state.bite = false; return b; },
    releaseAll() {
      stickId = null; lookId = null;
      Object.assign(state, { x: 0, y: 0, sprint: false, active: false, jump: false, bite: false, pushups: false });
      base.classList.remove('show');
      knob.style.transform = '';
    },
    enable,
  };
}
