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

// A burst of filtered noise (hisses, thunder).
function noise(start, dur, gain = 0.15, freq = 800, type = 'lowpass') {
  const a = ac();
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + start + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + start);
}

export const sfx = {
  screech() { tone(2300, 0, 0.22, 'sawtooth', 0.07, 1500); tone(2500, 0.2, 0.35, 'sawtooth', 0.07, 1200); },
  meow() { tone(520, 0, 0.18, 'sawtooth', 0.06, 900); tone(900, 0.16, 0.4, 'sawtooth', 0.06, 420); },
  hiss() { noise(0, 0.5, 0.1, 3500, 'highpass'); },
  web() { noise(0, 0.18, 0.08, 2000, 'bandpass'); tone(900, 0, 0.18, 'sine', 0.05, 300); },
  webbed() { tone(500, 0, 0.12, 'triangle', 0.1, 250); tone(250, 0.1, 0.2, 'triangle', 0.08, 120); },
  stuck() { tone(140, 0, 0.18, 'square', 0.08, 60); noise(0, 0.2, 0.1, 500); },
  bossHit() { tone(180, 0, 0.2, 'sawtooth', 0.12, 60); tone(520, 0.05, 0.25, 'triangle', 0.12, 880); },
  thunder() { noise(0, 1.3, 0.22, 220); noise(0.12, 0.9, 0.12, 90); },
  unlock() { ac(); },
  pickup(n) {
    const base = 660 * Math.pow(2, (n % 5) / 12);
    tone(base, 0, 0.25, 'triangle', 0.18);
    tone(base * 1.5, 0.07, 0.3, 'triangle', 0.15);
    tone(base * 2, 0.14, 0.4, 'sine', 0.12);
  },
  jump() { tone(300, 0, 0.15, 'sine', 0.08, 520); },
  land() { tone(120, 0, 0.08, 'triangle', 0.08, 70); },
  scare() { tone(700, 0, 0.09, 'square', 0.06, 1400); tone(1400, 0.08, 0.16, 'triangle', 0.08, 500); },
  tail() { tone(520, 0, 0.07, 'triangle', 0.1, 260); tone(180, 0.05, 0.12, 'sine', 0.1, 90); },
  pushup() { tone(200, 0, 0.06, 'square', 0.03, 260); },
  bite() { tone(900, 0, 0.05, 'square', 0.06, 300); tone(500, 0.04, 0.05, 'square', 0.05, 200); },
  stomp() { tone(220, 0, 0.12, 'triangle', 0.15, 80); tone(660, 0.08, 0.15, 'sine', 0.1, 990); },
  hurt() { tone(420, 0, 0.18, 'sawtooth', 0.08, 180); tone(300, 0.1, 0.2, 'triangle', 0.08, 140); },
  win() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.12, 0.35, 'triangle', 0.16));
  },
};
