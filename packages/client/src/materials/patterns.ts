import type { MaterialDefinition, PatternId } from '@tiletrigger/shared';
import { versioned } from '../assetUrl.ts';

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

/**
 * Hieroglyphs (Style Pack 09): columns of signs between register lines,
 * every sign a little shape of our own (sun disc, eye, ankh, bird, water,
 * reed, loaf, seated figure, cartouche…) picked by hash, so walls read as
 * inscribed without copying any real text. Carved: the accent cut into the
 * base. Painted: ochre red, turquoise and the accent.
 */
function glyphPaint(u: number, v: number, b: RGB, a: RGB, painted: boolean): RGB {
  const COLS = 6;
  const ROWS = 5;
  // A register line every repeat (top band), column rules between the columns.
  const band = fract(v);
  const stone = shade(b, 0.93 + fbm(u, v, 71) * 0.12);
  if (band < 0.035 || (band > 0.06 && band < 0.075)) return painted ? [178, 72, 40] : shade(a, 0.9);
  const cu = Math.floor(u * COLS);
  const fu = fract(u * COLS);
  if (fu < 0.035) return painted ? shade(a, 0.8) : mix(stone, a, 0.55);
  const vv = (band - 0.075) / 0.925;
  const cv = Math.floor(vv * ROWS);
  const x = fu * 2 - 1;
  const y = fract(vv * ROWS) * 2 - 1;
  const kind = Math.floor(hash(cu, cv, 83) * 10);
  const ring = (cx: number, cy: number, r: number, w: number) => Math.abs(Math.hypot(x - cx, y - cy) - r) < w;
  const disc = (cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  const rect = (x0: number, y0: number, x1: number, y1: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  let hit = false;
  let fill = 0;
  switch (kind) {
    case 0: // Sun disc with a uraeus line under it.
      hit = disc(0, -0.15, 0.45, 0.45) || rect(-0.6, 0.45, 0.6, 0.55);
      fill = 1;
      break;
    case 1: // The eye: lid, pupil and the tear line.
      hit = (ring(0, 0, 0.5, 0.07) && y < 0.15 && Math.abs(x) < 0.55) || disc(0, 0, 0.2, 0.2) || (rect(-0.05, 0.2, 0.05, 0.7) && x < 0.1) || rect(0.15, 0.35, 0.55, 0.45);
      break;
    case 2: // Ankh: a loop over a cross.
      hit = ring(0, -0.5, 0.25, 0.08) || rect(-0.07, -0.25, 0.07, 0.85) || rect(-0.45, -0.2, 0.45, -0.08);
      fill = 2;
      break;
    case 3: // A bird in profile: body, head, beak, legs.
      hit = disc(0.05, 0.05, 0.42, 0.24) || disc(-0.35, -0.3, 0.16, 0.16) || rect(-0.7, -0.33, -0.48, -0.27) || rect(0.0, 0.25, 0.06, 0.7) || rect(0.2, 0.25, 0.26, 0.7) || (y > -0.05 && y < 0.15 && x > 0.4 && x < 0.75);
      fill = 0;
      break;
    case 4: // Water: three zigzag lines.
      for (const r of [-0.4, 0, 0.4]) if (Math.abs(y - r - Math.abs(fract(x * 2.5) - 0.5) * 0.3) < 0.06 && Math.abs(x) < 0.75) hit = true;
      fill = 2;
      break;
    case 5: // A reed leaf.
      hit = disc(0, -0.1, 0.16, 0.6) || rect(-0.04, 0.4, 0.04, 0.8);
      fill = 2;
      break;
    case 6: // A loaf (half disc).
      hit = disc(0, 0.35, 0.55, 0.45) && y < 0.35;
      fill = 1;
      break;
    case 7: // A seated figure: head, body, knees.
      hit = disc(-0.15, -0.6, 0.17, 0.17) || rect(-0.3, -0.42, 0.05, 0.35) || rect(-0.3, 0.2, 0.45, 0.4) || rect(0.3, 0.2, 0.45, 0.8) || rect(-0.3, 0.6, 0.45, 0.8);
      fill = 0;
      break;
    case 8: // A cartouche: an oval loop with a bar under it and a sign in it.
      hit = (Math.abs(((x / 0.45) ** 2 + (y / 0.85) ** 2) - 1) < 0.25 && Math.abs(x) < 0.5) || rect(-0.5, 0.85, 0.5, 0.95) || disc(0, 0, 0.12, 0.12);
      fill = 1;
      break;
    default: // A horned viper.
      hit = (Math.abs(y - 0.25 - Math.sin(x * 4) * 0.12) < 0.08 && Math.abs(x) < 0.7) || disc(-0.62, 0.1, 0.12, 0.1) || rect(-0.62, -0.15, -0.56, 0.05);
      fill = 0;
  }
  if (!hit) return stone;
  if (!painted) return mix(shade(a, 0.95), stone, 0.15 + fbm(u, v, 73) * 0.15);
  const palette: RGB[] = [a, [178, 72, 40], [52, 150, 150]];
  return shade(palette[fill]!, 0.92 + fbm(u, v, 79) * 0.12);
}

/**
 * Cobblestones (Style Pack 10): a jittered grid of stones (Voronoi cells that
 * wrap at the repeat), each its own shade, darkening toward its rim so it
 * reads as rounded, set in dark mortar.
 */
function cobblePaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const n = 7;
  const x = u * n;
  const y = v * n;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let d1 = Infinity;
  let d2 = Infinity;
  let cell = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx;
      const cy = yi + dy;
      const wx = ((cx % n) + n) % n;
      const wy = ((cy % n) + n) % n;
      const px = cx + 0.2 + hash(wx, wy, 91) * 0.6;
      const py = cy + 0.2 + hash(wx, wy, 92) * 0.6;
      const d = Math.hypot(x - px, (y - py) * 1.1);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        cell = wx * 31 + wy;
      } else if (d < d2) d2 = d;
    }
  }
  const rim = d2 - d1;
  if (rim < 0.09) return shade(a, 0.85 + fbm(u, v, 93) * 0.3);
  const warm: RGB = [b[0] * 0.8 + 30, b[1] * 0.8 + 24, b[2] * 0.8 + 18];
  const stone = shade(mix(b, warm, hash(cell, 3, 94)), 0.78 + hash(cell, 1, 95) * 0.34);
  return shade(stone, 0.72 + Math.min(1, rim / 0.45) * 0.3 + fbm(u, v, 96) * 0.08);
}

/** Pantiles (Style Pack 10): columns of barrel-curved clay tiles, rows lapping down the slope, each tile its own fired shade. */
function pantilePaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const cols = 6;
  const rows = 8;
  const cu = Math.floor(u * cols);
  const fu = fract(u * cols);
  const row = Math.floor(v * rows);
  const fv = fract(v * rows);
  // The curve across the tile (light on the crown, dark in the trough) and the lapped lower edge's shadow.
  const crown = Math.sin(fu * Math.PI);
  const lap = fv < 0.14 ? 0.55 + fv * 2.5 : 1;
  const tile = mix(b, a, hash(cu, row, 97) * 0.35 + (fu < 0.06 || fu > 0.94 ? 0.5 : 0));
  return shade(tile, (0.62 + crown * 0.45) * lap * (0.92 + fbm(u, v, 98) * 0.14));
}

/**
 * Half-timbering (Style Pack 10), one storey a repeat: a sill and a head
 * beam, a rail at sill height, posts every metre and a long brace in every
 * other bay, plaster between. Oak accent, plaster base.
 */
function timberPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const oak = (k: number) => shade(a, 0.85 + Math.sin((u * 7 + v * 31 + fbm(u, v, 101) * 3) * Math.PI) * 0.08 + k);
  const plaster = shade(b, 0.92 + fbm(u, v, 103) * 0.12);
  const bay = Math.floor(u * 4);
  const fu = fract(u * 4);
  // Sill and head (they meet across the repeat), the rail a quarter up.
  if (v < 0.045 || v > 0.955) return oak(-0.05);
  if (Math.abs(v - 0.27) < 0.022) return oak(0);
  // Posts.
  if (fu < 0.07 || fu > 0.93) return oak(0.02);
  // A brace across the bay above the rail, leaning one way then the other.
  if (v > 0.29 && bay % 2 === 0) {
    const t = (v - 0.29) / (0.955 - 0.29);
    const along = bay % 4 === 0 ? t : 1 - t;
    if (Math.abs(fu - along) < 0.075) return oak(-0.02);
  }
  // Short struts below the rail in the other bays.
  if (v < 0.25 && bay % 2 === 1 && Math.abs(fu - 0.5) < 0.05) return oak(0);
  // Plaster panels darken a touch against the timbers.
  const edge = Math.min(fu - 0.07, 0.93 - fu);
  return edge < 0.03 ? shade(plaster, 0.9) : plaster;
}

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
  glyphs: (u, v, b, a) => glyphPaint(u, v, b, a, false),
  glyphs_painted: (u, v, b, a) => glyphPaint(u, v, b, a, true),
  mosaic: (u, v, b, a) => {
    // Tesserae 1/32 of a repeat, grouted; a key-pattern (meander) border band round a field with a lozenge in it.
    const n = 32;
    const cu = Math.floor(u * n);
    const cv = Math.floor(v * n);
    const fu = fract(u * n);
    const fv = fract(v * n);
    const grout = fu < 0.1 || fv < 0.1;
    const edge = Math.min(cu, cv, n - 1 - cu, n - 1 - cv);
    let c: RGB = b;
    if (edge === 0 || edge === 5) c = a;
    else if (edge >= 1 && edge <= 4) {
      // A meander: the key repeats every 4 tesserae along the band.
      const along = (edge === Math.min(cu, n - 1 - cu) ? cv : cu) % 4;
      const across = edge - 1;
      const key = across === 0 || (across === 3 && along !== 3) || (along === 0 && across < 3) || (across === 2 && along === 2);
      if (key) c = a;
    } else {
      const d = Math.abs(cu - n / 2 + 0.5) + Math.abs(cv - n / 2 + 0.5);
      if (d < 4) c = mix(a, [230, 180, 60], 0.5);
      else if (d < 6) c = a;
      else if (d > 9 && d < 11) c = shade(a, 0.7);
    }
    if (grout) return shade(mix(b, [120, 110, 95], 0.6), 0.8);
    return shade(c, 0.88 + hash(cu, cv, 61) * 0.2);
  },
  cobbles: cobblePaint,
  setts: (u, v, b, a) => {
    // Rows of oblong granite setts, each row shifted half a stone.
    const rows = 6;
    const row = Math.floor(v * rows);
    const su = u * 3 + (row % 2) * 0.5;
    const stone = Math.floor(su);
    const fu = fract(su);
    const fv = fract(v * rows);
    if (fu < 0.05 || fv < 0.09) return shade(a, 0.85 + fbm(u, v, 107) * 0.3);
    const rim = Math.min(fu - 0.05, 1 - fu, fv - 0.09, 1 - fv) * 4;
    return shade(b, (0.8 + hash(stone, row, 109) * 0.3) * (0.82 + Math.min(1, rim) * 0.18) + fbm(u, v, 111) * 0.08);
  },
  diamonds: (u, v, b, a) => {
    // Square tiles on the diagonal, alternating terracotta and cream, grouted.
    const s = (u + v) * 3;
    const t = (u - v) * 3;
    const fs = fract(s);
    const ft = fract(t);
    if (fs < 0.06 || ft < 0.06) return shade(mix(b, a, 0.5), 0.6);
    const c = (((Math.floor(s) + Math.floor(t)) % 2) + 2) % 2 === 0 ? b : a;
    return shade(c, 0.9 + hash(Math.floor(s), Math.floor(t), 113) * 0.12 + fbm(u, v, 115) * 0.06);
  },
  pantiles: pantilePaint,
  timber: timberPaint,
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

/** Fine patterns (hieroglyphs, mosaics, cobbles, half-timbering, roof tiles) are painted at twice the usual size so their shapes read. */
const FINE_PATTERNS = new Set<PatternId>(['glyphs', 'glyphs_painted', 'mosaic', 'cobbles', 'timber', 'pantiles']);
export const patternSize = (def: MaterialDefinition): number => (FINE_PATTERNS.has(def.pattern) ? 256 : 128);

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
  if (def.texture) return versioned(`${import.meta.env.BASE_URL}textures/${def.texture}_color.jpg`);
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
