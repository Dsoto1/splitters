// The environment generator's only source of randomness: a seeded PRNG (sfc32, seeded through splitmix32), so a
// species' seed and the generator version reproduce its output byte for byte. Math.random is banned in
// tools/content/env (tools/content/test/environment.test.mjs checks it).

function splitmix32(a) {
  return () => {
    a |= 0;
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

/** Hash a string (and numbers) to a 32-bit seed: sub-streams per part ("oak", seed, "leaves"). */
export function hashSeed(...parts) {
  let h = 0x811c9dc5;
  for (const ch of parts.map(String).join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A seeded random stream: `next()` in [0, 1), plus helpers. `fork(name)` gives an independent stream for one part
 * of a model, so changing how many numbers one part draws never shifts another part.
 */
export function rng(seed) {
  const sm = splitmix32(seed >>> 0);
  let a = sm();
  let b = sm();
  let c = sm();
  let d = sm();
  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  const r = {
    next,
    /** Uniform in [lo, hi). */
    range: (lo, hi) => lo + (hi - lo) * next(),
    /** Whole number in [lo, hi]. */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    /** Symmetric jitter in [-s, s). */
    jitter: (s) => (next() * 2 - 1) * s,
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    /** A unit vector, uniform on the sphere. */
    unit: () => {
      const z = next() * 2 - 1;
      const t = next() * Math.PI * 2;
      const s = Math.sqrt(1 - z * z);
      return [s * Math.cos(t), z, s * Math.sin(t)];
    },
    fork: (name) => rng(hashSeed(seed, name)),
  };
  return r;
}
