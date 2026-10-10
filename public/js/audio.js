// Tiny WebAudio synth — no sound files to download. iOS needs a user gesture to unlock.
let ctx = null;
let master = null;
let muted = false;
let noiseBuf = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (!c) return;
  // Play a silent blip inside the gesture so iOS Safari fully unlocks output.
  const o = c.createOscillator();
  const g = c.createGain();
  g.gain.value = 0;
  o.connect(g).connect(master);
  o.start();
  o.stop(c.currentTime + 0.01);
}

export function setMuted(m) {
  muted = m;
}
export const isMuted = () => muted;

function tone(freq, dur, { type = 'sine', vol = 0.3, delay = 0, slide = null, attack = 0.01 } = {}) {
  if (muted) return;
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.3, delay = 0, freq = 1200, q = 1 } = {}) {
  if (muted) return;
  const c = ensure();
  if (!c) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

const NOTES = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5, E6: 1318.5, G6: 1568 };

export const sfx = {
  tap: () => tone(880, 0.08, { type: 'triangle', vol: 0.18 }),
  pop: () => tone(500, 0.12, { type: 'sine', vol: 0.3, slide: 1100 }),
  boing: () => tone(220, 0.35, { type: 'sine', vol: 0.3, slide: 660 }),
  whoosh: () => noise(0.35, { vol: 0.25, freq: 900, q: 0.6 }),
  door: () => {
    tone(NOTES.E5, 0.18, { type: 'triangle', vol: 0.25 });
    tone(NOTES.C5, 0.3, { type: 'triangle', vol: 0.25, delay: 0.16 });
  },
  ding: () => {
    tone(NOTES.C6, 0.5, { type: 'sine', vol: 0.25 });
    tone(NOTES.G6, 0.6, { type: 'sine', vol: 0.12, delay: 0.02 });
  },
  chomp: () => {
    noise(0.09, { vol: 0.5, freq: 2200, q: 0.8 });
    noise(0.09, { vol: 0.4, freq: 1600, q: 0.8, delay: 0.13 });
    tone(180, 0.1, { type: 'square', vol: 0.06, delay: 0.02 });
  },
  sparkle: () => [NOTES.E6, NOTES.G6, NOTES.C6 * 2].forEach((f, i) => tone(f, 0.2, { vol: 0.1, delay: i * 0.06 })),
  star: (i) => tone(NOTES.C5 * Math.pow(2, (i * 2) / 12), 0.2, { type: 'triangle', vol: 0.22 }),
  emote: () => tone(660, 0.14, { type: 'triangle', vol: 0.2, slide: 990 }),
  rec: () => {
    tone(1200, 0.08, { type: 'square', vol: 0.06 });
    tone(1600, 0.08, { type: 'square', vol: 0.06, delay: 0.1 });
  },
  fanfare: () => {
    const seq = [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6, NOTES.G5, NOTES.C6];
    const times = [0, 0.12, 0.24, 0.36, 0.56, 0.68];
    seq.forEach((f, i) => tone(f, i === seq.length - 1 ? 0.6 : 0.18, { type: 'triangle', vol: 0.26, delay: times[i] }));
    seq.forEach((f, i) => tone(f / 2, 0.2, { type: 'sine', vol: 0.12, delay: times[i] }));
  },
  join: () => {
    tone(NOTES.G5, 0.15, { type: 'triangle', vol: 0.2 });
    tone(NOTES.C6, 0.25, { type: 'triangle', vol: 0.2, delay: 0.12 });
  },
  drumroll: () => {
    for (let i = 0; i < 11; i++) noise(0.05, { vol: 0.16 + i * 0.02, freq: 500 + i * 40, q: 1.4, delay: i * 0.055 });
  },
  // food reactions (keyed by reaction name)
  spicy: () => {
    noise(0.6, { vol: 0.2, freq: 3400, q: 0.7 });
    tone(420, 0.5, { type: 'sawtooth', vol: 0.07, slide: 1500 });
  },
  sour: () => {
    tone(1250, 0.28, { type: 'triangle', vol: 0.18, slide: 520 });
    tone(1400, 0.3, { type: 'triangle', vol: 0.14, slide: 600, delay: 0.14 });
  },
  cold: () => {
    for (let i = 0; i < 7; i++) tone(1500 + (i % 2) * 320, 0.05, { vol: 0.12, delay: i * 0.065 });
  },
  yuck: () => {
    tone(280, 0.45, { type: 'sawtooth', vol: 0.09, slide: 105 });
    tone(190, 0.3, { type: 'square', vol: 0.04, slide: 90, delay: 0.2 });
  },
};

// ------------------------------------------------------------- speech
let voice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  voice = voices.find((v) => /en[-_]US/i.test(v.lang) && /samantha|female|zira|aria|google us/i.test(v.name))
    || voices.find((v) => /^en/i.test(v.lang)) || null;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function speak(text) {
  if (muted || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 1.0;
    u.pitch = 1.35;
    u.volume = 1;
    speechSynthesis.speak(u);
  } catch {
    /* speech is optional */
  }
}
