import type { MaterialDefinition, PatternId } from '@chronosplit/shared';

/**
 * Our own procedural pattern painters for the hand-made material library.
 * Each returns a seamlessly tiling RGBA image; the same pixels feed GPU
 * textures and the palette thumbnails, so what you pick is what you get.
 */

type RGB = [number, number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const fract = (v: number) => v - Math.floor(v);

/** Integer hash -> [0,1). */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Tileable value noise: lattice wraps every `period` cells. */
function noise(u: number, v: number, period: number, seed = 1): number {
  const x = u * period;
  const y = v * period;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const w = (a: number) => ((a % period) + period) % period;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(w(xi), w(yi), seed);
  const b = hash(w(xi + 1), w(yi), seed);
  const c = hash(w(xi), w(yi + 1), seed);
  const d = hash(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}

const fbm = (u: number, v: number, seed = 1) => noise(u, v, 4, seed) * 0.5 + noise(u, v, 8, seed + 1) * 0.3 + noise(u, v, 16, seed + 2) * 0.2;

/** Distance (in cell units) to the nearest edge of a unit cell, for grout/seam lines. */
const edgeDist = (fu: number, fv: number) => Math.min(fu, 1 - fu, fv, 1 - fv);

type Painter = (u: number, v: number, base: RGB, accent: RGB) => RGB;

const PAINTERS: Record<PatternId, Painter> = {
  grid: (u, v, b, a) => {
    const e = edgeDist(u, v);
    const mid = Math.min(Math.abs(u - 0.5), Math.abs(v - 0.5));
    return e < 0.012 ? a : mid < 0.004 ? mix(b, a, 0.5) : b;
  },
  plain: (u, v, b) => shade(b, 0.97 + fbm(u, v) * 0.06),
  noise: (u, v, b, a) => mix(b, a, clamp01(fbm(u, v) * 1.4 - 0.2)),
  bricks: (u, v, b, a) => {
    const rows = 8;
    const row = Math.floor(v * rows);
    const bu = fract(u * 4 + (row % 2) * 0.5);
    const bv = fract(v * rows);
    if (bu < 0.04 || bv < 0.12) return shade(a, 0.9 + fbm(u, v, 3) * 0.2);
    const brick = Math.floor(u * 4 + (row % 2) * 0.5);
    return shade(b, 0.82 + hash(brick, row, 5) * 0.28 + fbm(u, v, 7) * 0.1);
  },
  blocks: (u, v, b, a) => {
    const row = Math.floor(v * 3);
    const bu = fract(u * 2 + (row % 2) * 0.5);
    const bv = fract(v * 3);
    if (bu < 0.025 || bv < 0.04) return a;
    const block = Math.floor(u * 2 + (row % 2) * 0.5);
    return mix(shade(b, 0.88 + hash(block, row, 11) * 0.2), a, fbm(u, v, 13) * 0.35);
  },
  planks: (u, v, b, a) => {
    const plank = Math.floor(u * 5);
    const pu = fract(u * 5);
    if (pu < 0.04) return shade(a, 0.7);
    const end = fract(v + hash(plank, 0, 17) * 0.7);
    if (end < 0.012) return shade(a, 0.75);
    const grain = Math.sin((u * 40 + noise(u, v, 8, plank) * 6) * Math.PI) * 0.5 + 0.5;
    return mix(shade(b, 0.9 + hash(plank, 1, 19) * 0.2), a, grain * 0.35);
  },
  tiles: (u, v, b, a) => (edgeDist(fract(u * 4), fract(v * 4)) < 0.05 ? a : shade(b, 0.96 + fbm(u, v, 23) * 0.08)),
  checker: (u, v, b, a) => {
    const c = (Math.floor(u * 2) + Math.floor(v * 2)) % 2 === 0;
    return shade(c ? b : a, 0.95 + fbm(u, v, 29) * 0.1);
  },
  plates: (u, v, b, a) => {
    const fu = fract(u * 2);
    const fv = fract(v * 2);
    if (edgeDist(fu, fv) < 0.012) return shade(b, 0.55);
    const rivet = [0.08, 0.92].some((ru) => [0.08, 0.92].some((rv) => Math.hypot(fu - ru, fv - rv) < 0.025));
    if (rivet) return a;
    return shade(b, 0.92 + fbm(u, v, 31) * 0.12);
  },
  grate: (u, v, b, a) => {
    const fu = fract(u * 8);
    const fv = fract(v * 8);
    return fu > 0.22 && fu < 0.78 && fv > 0.22 && fv < 0.78 ? a : shade(b, 0.9 + fbm(u, v, 37) * 0.15);
  },
  panels: (u, v, b, a) => {
    const fu = fract(u * 2);
    const fv = fract(v);
    const e = edgeDist(fu, fv);
    if (e < 0.012) return shade(b, 0.5);
    if (e < 0.03) return shade(b, 1.12);
    if (Math.abs(fv - 0.75) < 0.01 && fu > 0.2 && fu < 0.8) return a;
    return shade(b, 0.96 + fbm(u, v, 41) * 0.06);
  },
  stripes: (u, v, b, a) => (fract((u + v) * 3) < 0.5 ? b : a),
  hex: (u, v, b, a) => {
    // Pointy hex grid via axial rounding; 4 hexes across keeps it tileable.
    const x = u * 4;
    const y = v * 4 * (2 / Math.sqrt(3));
    const r = Math.round(y);
    const q = Math.round(x - (r % 2) * 0.5);
    let best = Infinity;
    let second = Infinity;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dq = -1; dq <= 1; dq++) {
        const rr = r + dr;
        const cx = q + dq + (((rr % 2) + 2) % 2) * 0.5;
        const d = Math.hypot(x - cx, (y - rr) * (Math.sqrt(3) / 2));
        if (d < best) {
          second = best;
          best = d;
        } else if (d < second) second = d;
      }
    }
    return second - best < 0.06 ? a : shade(b, 0.95 + fbm(u, v, 43) * 0.1);
  },
  marble: (u, v, b, a) => {
    const t = Math.sin((u * 3 + v * 2 + fbm(u, v, 47) * 3) * Math.PI * 2);
    const vein = Math.pow(1 - Math.abs(t), 6);
    return mix(shade(b, 0.97 + fbm(u, v, 53) * 0.05), a, vein * 0.8);
  },
  weave: (u, v, b, a) => {
    const n = 24;
    const cu = Math.floor(u * n);
    const cv = Math.floor(v * n);
    const over = (cu + cv) % 2 === 0;
    const f = over ? fract(u * n) : fract(v * n);
    return mix(b, a, 0.25 + Math.sin(f * Math.PI) * -0.25 + (over ? 0 : 0.25));
  },
};

const cache = new Map<string, Uint8Array>();

/** RGBA pixels for a material's pattern (cached per material). */
export function materialPixels(def: MaterialDefinition, size = 128): Uint8Array {
  const key = `${def.id}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const paint = PAINTERS[def.pattern];
  const base = hex(def.base);
  const accent = hex(def.accent);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = paint((x + 0.5) / size, (y + 0.5) / size, base, accent);
      const i = (y * size + x) * 4;
      data[i] = Math.max(0, Math.min(255, c[0]));
      data[i + 1] = Math.max(0, Math.min(255, c[1]));
      data[i + 2] = Math.max(0, Math.min(255, c[2]));
      data[i + 3] = 255;
    }
  }
  cache.set(key, data);
  return data;
}

/** Palette thumbnail as a data URL (DOM only; GPU textures use the raw pixels). */
export function materialThumbnail(def: MaterialDefinition, tint: string | null = null, size = 48): string {
  // Scanned sets show their own photo (the tint shows on the map).
  if (def.texture) return `${import.meta.env.BASE_URL}textures/${def.texture}_color.jpg`;
  const px = materialPixels(def, size);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const t = tint ? hex(tint) : null;
  for (let i = 0; i < px.length; i += 4) {
    img.data[i] = t ? (px[i]! * t[0]) / 255 : px[i]!;
    img.data[i + 1] = t ? (px[i + 1]! * t[1]) / 255 : px[i + 1]!;
    img.data[i + 2] = t ? (px[i + 2]! * t[2]) / 255 : px[i + 2]!;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}
