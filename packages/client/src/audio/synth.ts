/**
 * In-house weapon sound synthesiser. Each sound is a hand-written recipe of
 * layered noise and oscillators (crack, body, thump, mechanics, room tail),
 * rendered at load time into a sample buffer. Seeds make every variant
 * deterministic, so a recipe always produces the same sound.
 *
 * This is ordinary signal processing written by us, in the same spirit as the
 * procedural map materials. Recorded CC0 gunshots can replace any recipe later
 * by switching its entry in content/sounds.json to file variants.
 */

export const SYNTH_RATE = 44100;

export type SynthRecipe = 'pistol' | 'rifle' | 'shotgun' | 'sniper' | 'launcher' | 'swing' | 'dryfire' | 'flame' | 'beep' | 'alarm';

export const SYNTH_RECIPES: readonly SynthRecipe[] = ['pistol', 'rifle', 'shotgun', 'sniper', 'launcher', 'swing', 'dryfire', 'flame', 'beep', 'alarm'];

/** Small seeded PRNG (mulberry32) returning [-1, 1). */
function noiseSource(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** RBJ biquad, coefficients recomputed on demand so the cutoff can sweep. */
class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(private readonly type: 'lowpass' | 'highpass' | 'bandpass') {}

  set(freq: number, q: number): this {
    const w = (2 * Math.PI * Math.min(freq, SYNTH_RATE * 0.45)) / SYNTH_RATE;
    const cos = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    let b0: number, b1: number, b2: number;
    if (this.type === 'lowpass') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
    else if (this.type === 'highpass') [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
    else [b0, b1, b2] = [alpha, 0, -alpha];
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
    return this;
  }

  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Exponential decay envelope with a short linear attack. */
const env = (t: number, attack: number, decay: number) => (t < 0 ? 0 : t < attack ? t / attack : Math.exp(-(t - attack) / decay));

interface GunParams {
  length: number;
  /** Broadband transient at the very start. */
  crack: { gain: number; decay: number };
  /** Filtered noise blast. */
  body: { gain: number; cutoff: number; decay: number };
  /** Low sine "punch" sweeping down in pitch. */
  thump: { gain: number; from: number; to: number; decay: number };
  /** Darker, longer noise standing in for room reflections. */
  tail: { gain: number; cutoff: number; decay: number };
  /** Mechanical clicks (slide, bolt, pump): [time s, gain, centre Hz]. */
  clicks: [number, number, number][];
  /** Discrete echoes of the whole shot: [delay s, gain]. */
  echoes: [number, number][];
}

const GUNS: Record<'pistol' | 'rifle' | 'shotgun' | 'sniper', GunParams> = {
  pistol: {
    length: 0.45,
    crack: { gain: 0.9, decay: 0.003 },
    body: { gain: 0.8, cutoff: 3200, decay: 0.035 },
    thump: { gain: 0.7, from: 190, to: 60, decay: 0.05 },
    tail: { gain: 0.18, cutoff: 1400, decay: 0.12 },
    clicks: [[0.07, 0.25, 3800]],
    echoes: [[0.09, 0.18]],
  },
  rifle: {
    length: 0.4,
    crack: { gain: 1.0, decay: 0.0025 },
    body: { gain: 0.85, cutoff: 4800, decay: 0.028 },
    thump: { gain: 0.65, from: 150, to: 55, decay: 0.055 },
    tail: { gain: 0.2, cutoff: 1800, decay: 0.11 },
    clicks: [[0.045, 0.18, 4500]],
    echoes: [[0.07, 0.15]],
  },
  shotgun: {
    length: 0.9,
    crack: { gain: 0.8, decay: 0.004 },
    body: { gain: 1.0, cutoff: 2200, decay: 0.085 },
    thump: { gain: 1.0, from: 120, to: 40, decay: 0.12 },
    tail: { gain: 0.3, cutoff: 1100, decay: 0.22 },
    // Pump: back, then forward.
    clicks: [
      [0.42, 0.35, 1800],
      [0.55, 0.45, 2400],
    ],
    echoes: [[0.11, 0.2]],
  },
  sniper: {
    length: 1.6,
    crack: { gain: 1.0, decay: 0.002 },
    body: { gain: 0.9, cutoff: 6000, decay: 0.045 },
    thump: { gain: 0.9, from: 95, to: 35, decay: 0.15 },
    tail: { gain: 0.28, cutoff: 900, decay: 0.45 },
    // Bolt cycle.
    clicks: [
      [0.75, 0.3, 2600],
      [0.92, 0.35, 3400],
    ],
    echoes: [
      [0.14, 0.3],
      [0.31, 0.18],
      [0.52, 0.1],
    ],
  },
};

function renderGun(p: GunParams, seed: number): Float32Array<ArrayBuffer> {
  const n = Math.ceil(p.length * SYNTH_RATE);
  const dry = new Float32Array(n);
  const rnd = noiseSource(seed);
  const vary = 1 + rnd() * 0.06; // per-variant colour
  const bodyLp = new Biquad('lowpass').set(p.body.cutoff * vary, 0.8);
  const tailLp = new Biquad('lowpass').set(p.tail.cutoff * vary, 0.7);
  const crackHp = new Biquad('highpass').set(1500, 0.7);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SYNTH_RATE;
    const w = rnd();
    let s = crackHp.run(w) * p.crack.gain * env(t, 0.0003, p.crack.decay) * 2;
    s += bodyLp.run(w) * p.body.gain * env(t, 0.0015, p.body.decay) * 2.2;
    s += tailLp.run(rnd()) * p.tail.gain * env(t, 0.01, p.tail.decay) * 2.5;
    const f = p.thump.to + (p.thump.from - p.thump.to) * Math.exp(-t / (p.thump.decay * 0.5));
    phase += (2 * Math.PI * f) / SYNTH_RATE;
    s += Math.sin(phase) * p.thump.gain * env(t, 0.002, p.thump.decay);
    dry[i] = s;
  }
  for (const [at, gain, centre] of p.clicks) addClick(dry, at, gain, centre, rnd);
  const out = dry.slice();
  for (const [delay, gain] of p.echoes) {
    const d = Math.round(delay * SYNTH_RATE);
    const lp = new Biquad('lowpass').set(2000, 0.7);
    for (let i = d; i < n; i++) out[i]! += lp.run(dry[i - d]!) * gain;
  }
  return finish(out);
}

/** A short resonant metallic click. */
function addClick(buf: Float32Array, at: number, gain: number, centre: number, rnd: () => number): void {
  const start = Math.round(at * SYNTH_RATE);
  const len = Math.round(0.03 * SYNTH_RATE);
  const bp = new Biquad('bandpass').set(centre, 6);
  const bp2 = new Biquad('bandpass').set(centre * 1.63, 8);
  for (let i = 0; i < len && start + i < buf.length; i++) {
    const t = i / SYNTH_RATE;
    const w = rnd() * env(t, 0.0002, 0.0015);
    buf[start + i]! += (bp.run(w) * 6 + bp2.run(w) * 4) * gain * env(t, 0.0002, 0.008);
  }
}

/** Grenade launcher: a muffled "foomp" with an airy hiss, no supersonic crack. */
function renderLauncher(seed: number): Float32Array<ArrayBuffer> {
  const n = Math.ceil(0.8 * SYNTH_RATE);
  const out = new Float32Array(n);
  const rnd = noiseSource(seed);
  const lp = new Biquad('lowpass').set(700 * (1 + rnd() * 0.08), 0.9);
  const hiss = new Biquad('bandpass').set(3000, 0.8);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SYNTH_RATE;
    const f = 45 + 70 * Math.exp(-t / 0.06);
    phase += (2 * Math.PI * f) / SYNTH_RATE;
    let s = Math.sin(phase) * env(t, 0.006, 0.14) * 1.1;
    s += lp.run(rnd()) * env(t, 0.004, 0.08) * 2.5;
    s += hiss.run(rnd()) * env(t - 0.01, 0.03, 0.18) * 0.9;
    out[i] = s;
  }
  addClick(out, 0.002, 0.3, 1200, rnd);
  return finish(out);
}

/** Knife swing: band-passed noise whose centre sweeps up and back down. */
function renderSwing(seed: number): Float32Array<ArrayBuffer> {
  const n = Math.ceil(0.26 * SYNTH_RATE);
  const out = new Float32Array(n);
  const rnd = noiseSource(seed);
  const bp = new Biquad('bandpass');
  const peak = 2200 + rnd() * 500;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const shape = Math.sin(Math.PI * Math.pow(u, 0.7));
    if (i % 16 === 0) bp.set(500 + peak * shape, 1.6);
    out[i] = bp.run(rnd()) * shape * shape * 2.5;
  }
  return finish(out);
}

/** Empty-magazine trigger click. */
function renderDryfire(seed: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.ceil(0.08 * SYNTH_RATE));
  const rnd = noiseSource(seed);
  addClick(out, 0.001, 1, 4200, rnd);
  addClick(out, 0.018, 0.5, 2900, rnd);
  return finish(out);
}

/** Flame jet: a low, flickering roar of filtered noise that swells and dies away. */
function renderFlame(seed: number): Float32Array<ArrayBuffer> {
  const n = Math.ceil(1.6 * SYNTH_RATE);
  const out = new Float32Array(n);
  const rnd = noiseSource(seed);
  const lp = new Biquad('lowpass').set(900, 0.7);
  const crackle = new Biquad('bandpass').set(2500, 1.5);
  for (let i = 0; i < n; i++) {
    const t = i / SYNTH_RATE;
    const swell = Math.min(1, t / 0.08) * Math.exp(-Math.max(0, t - 0.9) / 0.25);
    const flicker = 0.75 + 0.25 * Math.sin(t * 37 + Math.sin(t * 11) * 3);
    const pop = rnd() > 0.9985 ? 3 : 0;
    out[i] = (lp.run(rnd()) * 3 * flicker + crackle.run(rnd() * (0.3 + pop))) * swell;
  }
  return finish(out);
}

/** Three short warning beeps (proximity mines and traps arming). */
function renderBeep(): Float32Array<ArrayBuffer> {
  const n = Math.ceil(0.36 * SYNTH_RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SYNTH_RATE;
    const k = t % 0.12;
    const on = k < 0.06 ? Math.min(1, k / 0.003, (0.06 - k) / 0.003) : 0;
    out[i] = Math.sin(2 * Math.PI * 1900 * t) * on * 0.8;
  }
  return finish(out);
}

/** Two-tone siren for the alarm cue. */
function renderAlarm(): Float32Array<ArrayBuffer> {
  const n = Math.ceil(2.4 * SYNTH_RATE);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SYNTH_RATE;
    const f = 620 + 260 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.9));
    phase += (2 * Math.PI * f) / SYNTH_RATE;
    // A square-ish wave reads as "klaxon" better than a pure sine.
    const v = Math.tanh(Math.sin(phase) * 3) * 0.6 + Math.sin(phase * 2) * 0.15;
    out[i] = v * Math.min(1, t / 0.05, (2.4 - t) / 0.2);
  }
  return finish(out);
}

/** Soft-clip, normalise to a fixed peak and fade the last few ms to avoid a pop. */
function finish(buf: Float32Array<ArrayBuffer>): Float32Array<ArrayBuffer> {
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    buf[i] = Math.tanh(buf[i]! * 1.2);
    peak = Math.max(peak, Math.abs(buf[i]!));
  }
  const scale = peak > 0 ? 0.9 / peak : 0;
  const fade = Math.min(buf.length, Math.round(0.005 * SYNTH_RATE));
  for (let i = 0; i < buf.length; i++) {
    const tailGain = i >= buf.length - fade ? (buf.length - 1 - i) / fade : 1;
    buf[i]! *= scale * tailGain;
  }
  return buf;
}

/** Render one variant of a recipe as mono samples at {@link SYNTH_RATE}. */
export function synthesize(recipe: SynthRecipe, variant: number): Float32Array<ArrayBuffer> {
  const seed = 0x5eed + variant * 7919 + recipe.length * 104729 + recipe.charCodeAt(0) * 31;
  switch (recipe) {
    case 'pistol':
    case 'rifle':
    case 'shotgun':
    case 'sniper':
      return renderGun(GUNS[recipe], seed);
    case 'launcher':
      return renderLauncher(seed);
    case 'swing':
      return renderSwing(seed);
    case 'dryfire':
      return renderDryfire(seed);
    case 'flame':
      return renderFlame(seed);
    case 'beep':
      return renderBeep();
    case 'alarm':
      return renderAlarm();
  }
}
