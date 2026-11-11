// Tiny synthesized sound effects (no audio files needed).
let ctx = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type = 'sine', gain = 0.2, slideTo = null) {
  const a = ac();
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime + start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + start + dur);
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.05);
}

export const sfx = {
  unlock() { ac(); },
  pickup(n) {
    const base = 660 * Math.pow(2, (n % 5) / 12);
    tone(base, 0, 0.25, 'triangle', 0.18);
    tone(base * 1.5, 0.07, 0.3, 'triangle', 0.15);
    tone(base * 2, 0.14, 0.4, 'sine', 0.12);
  },
  jump() { tone(300, 0, 0.15, 'sine', 0.08, 520); },
  land() { tone(120, 0, 0.08, 'triangle', 0.08, 70); },
  pushup() { tone(200, 0, 0.06, 'square', 0.03, 260); },
  bite() { tone(900, 0, 0.05, 'square', 0.06, 300); tone(500, 0.04, 0.05, 'square', 0.05, 200); },
  stomp() { tone(220, 0, 0.12, 'triangle', 0.15, 80); tone(660, 0.08, 0.15, 'sine', 0.1, 990); },
  hurt() { tone(420, 0, 0.18, 'sawtooth', 0.08, 180); tone(300, 0.1, 0.2, 'triangle', 0.08, 140); },
  win() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.12, 0.35, 'triangle', 0.16));
  },
};
