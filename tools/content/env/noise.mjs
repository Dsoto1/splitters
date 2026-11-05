// Seeded gradient noise for the environment generator: 3D for shapes (rock surfaces, crown envelopes), and 2D
// tileable noise for textures (bark, rock and leaf pictures repeat without seams). Deterministic: the permutation
// comes from tools/content/env/rng.mjs.

import { rng } from './rng.mjs';

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

const G3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1], [1, 1, 0], [-1, 1, 0], [0, -1, 1], [0, -1, -1],
];

/** Seeded 3D Perlin noise in about [-1, 1]. */
export function noise3(seed) {
  const r = rng(seed);
  const p = new Uint8Array(512);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const g = (h, x, y, z) => {
    const v = G3[h & 15];
    return v[0] * x + v[1] * y + v[2] * z;
  };
  return (x, y, z) => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const Z = Math.floor(z);
    x -= X;
    y -= Y;
    z -= Z;
    const xi = X & 255;
    const yi = Y & 255;
    const zi = Z & 255;
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = p[xi] + yi;
    const AA = p[A] + zi;
    const AB = p[A + 1] + zi;
    const B = p[xi + 1] + yi;
    const BA = p[B] + zi;
    const BB = p[B + 1] + zi;
    return lerp(
      lerp(lerp(g(p[AA], x, y, z), g(p[BA], x - 1, y, z), u), lerp(g(p[AB], x, y - 1, z), g(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(g(p[AA + 1], x, y, z - 1), g(p[BA + 1], x - 1, y, z - 1), u), lerp(g(p[AB + 1], x, y - 1, z - 1), g(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w,
    );
  };
}

/** Fractal sum of `n` octaves of 3D noise. */
export function fbm3(seed, octaves = 4, lacunarity = 2, gain = 0.5) {
  const layers = Array.from({ length: octaves }, (_, i) => noise3(seed + i * 7919));
  return (x, y, z) => {
    let a = 1;
    let f = 1;
    let s = 0;
    let norm = 0;
    for (const n of layers) {
      s += a * n(x * f, y * f, z * f);
      norm += a;
      a *= gain;
      f *= lacunarity;
    }
    return s / norm;
  };
}

/**
 * Seeded 2D gradient noise that repeats every `px` × `py` lattice cells (so a texture drawn with it at a whole
 * number of cells across tiles without a seam).
 */
export function tileNoise2(seed, px, py) {
  const r = rng(seed);
  const grads = Array.from({ length: px * py }, () => {
    const a = r.next() * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)];
  });
  const gr = (i, j) => grads[(((j % py) + py) % py) * px + (((i % px) + px) % px)];
  return (x, y) => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const fx = x - X;
    const fy = y - Y;
    const d = (i, j) => {
      const g = gr(X + i, Y + j);
      return g[0] * (fx - i) + g[1] * (fy - j);
    };
    const u = fade(fx);
    const v = fade(fy);
    return lerp(lerp(d(0, 0), d(1, 0), u), lerp(d(0, 1), d(1, 1), u), v) * 1.4;
  };
}

/** Fractal tileable 2D noise on [0,1)² (u, v): base `cells` lattice cells across, doubling per octave. */
export function tileFbm2(seed, cellsX, cellsY, octaves = 4, gain = 0.5) {
  const layers = Array.from({ length: octaves }, (_, i) => tileNoise2(seed + i * 104729, cellsX << i, cellsY << i));
  return (u, v) => {
    let a = 1;
    let s = 0;
    let norm = 0;
    layers.forEach((n, i) => {
      s += a * n(u * (cellsX << i), v * (cellsY << i));
      norm += a;
      a *= gain;
    });
    return s / norm;
  };
}

/** Tileable Worley (cellular) distance on [0,1)²: F1 and F2 to `n` × `m` jittered feature points. */
export function tileWorley2(seed, n, m) {
  const r = rng(seed);
  const pts = Array.from({ length: n * m }, () => [r.next(), r.next()]);
  return (u, v) => {
    const x = u * n;
    const y = v * m;
    const X = Math.floor(x);
    const Y = Math.floor(y);
    let f1 = 9;
    let f2 = 9;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const cx = X + i;
        const cy = Y + j;
        const p = pts[(((cy % m) + m) % m) * n + (((cx % n) + n) % n)];
        const d = Math.hypot(cx + p[0] - x, cy + p[1] - y);
        if (d < f1) {
          f2 = f1;
          f1 = d;
        } else if (d < f2) f2 = d;
      }
    return [f1, f2];
  };
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export { lerp };
