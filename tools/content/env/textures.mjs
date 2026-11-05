// The environment's shared pictures, drawn here from seeded noise (no photos, no third-party images):
//
// - bark: 512 × 512, two vertical strips 256 px wide (broadleaf bark left, conifer bark right), each tileable on
//   its own; a colour picture and a normal map. A tree's bark u runs once round the trunk inside its strip.
// - rock: 512 × 512, tileable; colour and normal map (boulders and cliffs, box-projected).
// - leaves: 1024 × 1024 RGBA, a 4 × 4 grid of 256 px cells, each one cut-out card picture (leaf clusters, needle
//   sprays, shrub sprigs). Alpha is tested, never blended. Each card's rectangle is trimmed to its picture.
//
// The pictures are near-neutral in colour: a vertex colour per card or per vertex gives the species and season
// (summer green, autumn gold, snow), so material variants share every picture.

import sharp from 'sharp';
import { PNG } from 'pngjs';
import { rng } from './rng.mjs';
import { clamp, smoothstep, tileFbm2, tileWorley2 } from './noise.mjs';
import { dilate } from '../raster.mjs';

const srgb8 = (c) => Math.round(255 * clamp(c));

/** Tangent-space normal map (RGB) from a height field h (0..1) of w × h, tiling at the edges. */
function normalMap(H, w, h, strength) {
  const out = Buffer.alloc(w * h * 3);
  const at = (x, y) => H[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 3;
      out[i] = srgb8((-dx / l) * 0.5 + 0.5);
      out[i + 1] = srgb8((dy / l) * 0.5 + 0.5);
      out[i + 2] = srgb8((1 / l) * 0.5 + 0.5);
    }
  return out;
}

const webp = (raw, w, h, channels, opts = {}) => sharp(raw, { raw: { width: w, height: h, channels } }).webp({ quality: 84, effort: 4, ...opts }).toBuffer();

/** Bark: [colour, normal] WebP buffers, plus raw colour for the impostor rasteriser. */
export async function barkTextures(seed) {
  const W = 512;
  const Hh = 512;
  const S = 256;
  const H = new Float32Array(W * Hh);
  const col = Buffer.alloc(W * Hh * 3);
  // Broadleaf (oak): long vertical ridges split by deep furrows, broken across now and then; fine vertical grain.
  const oakCells = tileWorley2(seed + 1, 9, 3);
  const oakWarp = tileFbm2(seed + 2, 4, 3, 3);
  const oakGrain = tileFbm2(seed + 3, 48, 6, 3);
  const oakBlot = tileFbm2(seed + 6, 3, 3, 3);
  // Conifer (pine): irregular plates in layers, deep fissures, redder in the gaps.
  const pineCells = tileWorley2(seed + 4, 5, 7);
  const pineWarp = tileFbm2(seed + 5, 3, 3, 3);
  const pineFine = tileFbm2(seed + 7, 16, 16, 3);
  for (let y = 0; y < Hh; y++)
    for (let x = 0; x < W; x++) {
      const pine = x >= S;
      const u = (x % S) / S;
      const v = y / Hh;
      let h;
      let c;
      if (!pine) {
        const [f1, f2] = oakCells(u + oakWarp(u, v) * 0.06, v + oakWarp(v, u) * 0.03);
        const ridge = smoothstep(0.0, 0.3, f2 - f1);
        const grain = oakGrain(u, v);
        h = clamp(ridge ** 0.7 * (0.82 + 0.18 * grain) + 0.08 * oakBlot(u, v));
        const t = 0.22 + 0.78 * h;
        c = [t * 0.98, t * 0.95, t * 0.9];
      } else {
        const [f1, f2] = pineCells(u + pineWarp(u, v) * 0.05, v + pineWarp(v, u) * 0.05);
        const gap = f2 - f1;
        const plate = smoothstep(0.0, 0.06, gap);
        // Each plate a little domed, with a flake edge partway in.
        const layer = smoothstep(0.08, 0.1, gap) * 0.15;
        h = clamp(plate * (0.68 + 0.18 * (1 - f1) + layer) + 0.22 * pineFine(u, v));
        const t = 0.25 + 0.75 * h;
        const red = (1 - plate) * 0.3;
        c = [t * (0.98 + red), t * (0.9 - red * 0.15), t * (0.84 - red * 0.35)];
      }
      H[y * W + x] = h;
      const i = (y * W + x) * 3;
      col[i] = srgb8(c[0]);
      col[i + 1] = srgb8(c[1]);
      col[i + 2] = srgb8(c[2]);
    }
  return { color: await webp(col, W, Hh, 3), normal: await webp(normalMap(H, W, Hh, 6), W, Hh, 3, { quality: 90 }), raw: { data: col, width: W, height: Hh, channels: 3 } };
}

/**
 * Rock: { color (RGBA WebP: albedo, roughness in alpha), normal (WebP), raw (RGB, for stand-in pictures) }.
 *
 * Drawn tri-planar in world space on medium and high (envMaterials.ts), so it must read as rock from any side and
 * at any scale without a direction of its own: a weathered granite/sandstone surface of
 * - broad tonal patches and a few fine sedimentary laminae (faint, so they don't stripe a top face),
 * - joint fractures: long straight cracks in three directions (whole numbers of periods across, so they tile),
 *   each a dark V-groove with a pale weathered lip, plus short Worley cracks here and there,
 * - mineral grain: dark and light specks at two sizes, and small solution pits,
 * - pale lichen rosettes and darker water stains in the low places.
 * Roughness follows the relief: polished, worn highs smoother (0.62), cracks, pits and lichen rough (0.95).
 */
export async function rockTextures(seed) {
  const W = 512;
  const cells = tileWorley2(seed + 11, 6, 6);
  const pits = tileWorley2(seed + 17, 22, 22);
  const big = tileFbm2(seed + 12, 3, 3, 5);
  const mid = tileFbm2(seed + 14, 8, 8, 4);
  const fine = tileFbm2(seed + 13, 32, 32, 3);
  const grain = tileFbm2(seed + 18, 96, 96, 2);
  const bands = tileFbm2(seed + 15, 2, 16, 3);
  const mask = tileFbm2(seed + 16, 4, 4, 3);
  const lichen = tileFbm2(seed + 19, 10, 10, 3);
  const warp = tileFbm2(seed + 20, 4, 4, 3);
  // Joint sets: [a, b] whole periods across u and v (so the line family tiles), the groove's half width.
  const joints = [
    [2, 1, 0.006],
    [-1, 3, 0.005],
    [3, -2, 0.004],
  ];
  const H = new Float32Array(W * W);
  const col = Buffer.alloc(W * W * 4);
  const raw = Buffer.alloc(W * W * 3);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / W;
      const b = big(u, v);
      const m = mid(u, v);
      const f = fine(u, v);
      const g = grain(u, v);
      const wu = u + 0.035 * warp(u, v);
      const wv = v + 0.035 * warp(v + 0.37, u + 0.11);
      // Joints: distance to the nearest line of each family (fract of a whole-number projection), masked so each
      // family breaks off along its length.
      let joint = 0;
      let lip = 0;
      joints.forEach(([a, c, hw], k) => {
        const s = wu * a + wv * c + k * 0.37;
        const d = Math.abs(s - Math.round(s)) / Math.hypot(a, c);
        const on = smoothstep(0.0, 0.2, mask(u + k * 0.31, v + k * 0.17));
        joint = Math.max(joint, (1 - smoothstep(hw * 0.4, hw, d)) * on);
        lip = Math.max(lip, (smoothstep(hw, hw * 2.2, d) - smoothstep(hw * 2.2, hw * 5, d)) * on);
      });
      const [f1, f2] = cells(u + b * 0.07, v + m * 0.05);
      const crack = (1 - smoothstep(0.0, 0.025, f2 - f1)) * smoothstep(0.15, 0.4, mask(u + 0.5, v + 0.5));
      const [p1] = pits(u, v);
      const pit = (1 - smoothstep(0.05, 0.16, p1)) * smoothstep(0.0, 0.35, fine(u * 2 + 0.2, v * 2));
      const lam = bands(u, v);
      const lich = smoothstep(0.36, 0.55, lichen(u, v)) * smoothstep(-0.2, 0.3, fine(u * 3, v * 3)) * (1 - joint);
      // Height: broad relief, grain, joints and cracks cut in, pits.
      const h = clamp(0.5 + 0.22 * b + 0.16 * m + 0.08 * f + 0.04 * g - 0.42 * joint - 0.3 * crack - 0.18 * pit + 0.05 * lip + 0.04 * lich);
      H[y * W + x] = h;
      // Tone: mid grey with patches; dark grains and pale feldspar specks; joints dark, their lips pale.
      const speckDark = smoothstep(0.42, 0.62, g) * 0.1;
      const speckPale = smoothstep(0.5, 0.7, -g) * 0.09;
      let t = 0.49 + 0.2 * b + 0.1 * m + 0.06 * f + 0.05 * lam - speckDark + speckPale - 0.07 * joint - 0.1 * crack - 0.1 * pit + 0.04 * lip;
      // Water stains run in the low places (dark, slightly warm).
      const stain = smoothstep(0.1, 0.45, -b) * 0.08;
      t -= stain;
      let r = t * (1.0 + 0.04 * b + stain * 0.4);
      let gg = t * (0.985 + 0.01 * m);
      let bl = t * (0.955 - 0.03 * b - stain * 0.5);
      // Lichen: pale grey-green rosettes.
      if (lich > 0) {
        const lc = [0.72, 0.74, 0.62];
        r += (lc[0] - r) * lich * 0.35;
        gg += (lc[1] - gg) * lich * 0.35;
        bl += (lc[2] - bl) * lich * 0.35;
      }
      const rough = clamp(0.8 - 0.18 * smoothstep(0.55, 0.8, h) + 0.15 * joint + 0.12 * crack + 0.12 * pit + 0.1 * lich + 0.03 * g);
      const i = (y * W + x) * 4;
      col[i] = srgb8(r);
      col[i + 1] = srgb8(gg);
      col[i + 2] = srgb8(bl);
      col[i + 3] = srgb8(rough);
      const j = (y * W + x) * 3;
      raw[j] = col[i];
      raw[j + 1] = col[i + 1];
      raw[j + 2] = col[i + 2];
    }
  return {
    color: await sharp(col, { raw: { width: W, height: W, channels: 4 } }).webp({ quality: 86, alphaQuality: 90, effort: 4 }).toBuffer(),
    normal: await webp(normalMap(H, W, W, 5), W, W, 3, { quality: 90 }),
    raw: { data: raw, width: W, height: W, channels: 3 },
  };
}


// ---------------------------------------------------------------- leaves atlas

const CELL = 256;
const GRID = 4;
export const ATLAS_SIZE = CELL * GRID;

/**
 * The atlas cells and what each holds. Card pictures are drawn to fill their cell; the card rectangle (uv) is
 * trimmed to the drawn pixels.
 */
export const ATLAS_CELLS = {
  'oak.0': [0, 0], 'oak.1': [1, 0], 'oak.2': [2, 0], 'oak.3': [3, 0],
  'needle.0': [0, 1], 'needle.1': [1, 1], 'needle.2': [2, 1], 'needle.3': [3, 1],
  'shrub.0': [0, 2], 'shrub.1': [1, 2], 'shrub.2': [2, 2], 'shrub.3': [3, 2],
  'flower.0': [0, 3], 'flower.1': [1, 3], 'flower.2': [2, 3], 'fern.0': [3, 3],
};

/** A filled leaf: centre (x, y) px, direction a (radians), length, half width, lobes (oak) and a brightness. */
function leaf(img, ox, oy, x0, y0, a, L, Wd, lobes, shade, r) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const R = L + Wd;
  for (let y = Math.floor(y0 - R); y <= Math.ceil(y0 + R); y++)
    for (let x = Math.floor(x0 - R); x <= Math.ceil(x0 + R); x++) {
      if (x < 0 || y < 0 || x >= CELL || y >= CELL) continue;
      const dx = x + 0.5 - x0;
      const dy = y + 0.5 - y0;
      const s = (dx * ca + dy * sa) / L; // 0 at the stalk, 1 at the tip
      const t = -dx * sa + dy * ca;
      if (s < 0 || s > 1) continue;
      let w = Wd * Math.sin(Math.PI * Math.min(1, s * 1.05)) ** 0.75;
      if (lobes) w *= 0.72 + 0.28 * Math.abs(Math.sin(s * Math.PI * lobes));
      if (Math.abs(t) > w) continue;
      const edge = Math.abs(t) / Math.max(1e-3, w);
      const rib = Math.abs(t) < 0.9 ? 0.82 : 1;
      const vein = 1 - 0.08 * smoothstep(0.85, 1, Math.abs(Math.sin((s * 7 + edge * 1.5) * Math.PI)));
      const b = shade * (0.78 + 0.22 * (1 - edge)) * rib * vein * (0.97 + 0.03 * Math.sin(s * 9));
      const i = ((oy + y) * ATLAS_SIZE + ox + x) * 4;
      img[i] = srgb8(b * (0.98 + r.jitter(0.015)));
      img[i + 1] = srgb8(b);
      img[i + 2] = srgb8(b * 0.9);
      img[i + 3] = 255;
    }
}

/** A line (twig, stalk, needle) from (x0, y0) to (x1, y1) of half width hw. */
function line(img, ox, oy, x0, y0, x1, y1, hw, shade) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  for (let y = Math.floor(Math.min(y0, y1) - hw - 1); y <= Math.ceil(Math.max(y0, y1) + hw + 1); y++)
    for (let x = Math.floor(Math.min(x0, x1) - hw - 1); x <= Math.ceil(Math.max(x0, x1) + hw + 1); x++) {
      if (x < 0 || y < 0 || x >= CELL || y >= CELL) continue;
      const t = clamp(((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / l2);
      const d = Math.hypot(x + 0.5 - (x0 + dx * t), y + 0.5 - (y0 + dy * t));
      if (d > hw * (1 - 0.5 * t) + 0.35) continue;
      const i = ((oy + y) * ATLAS_SIZE + ox + x) * 4;
      const b = shade * (0.85 + 0.15 * (1 - d / (hw + 0.35)));
      img[i] = srgb8(b);
      img[i + 1] = srgb8(b);
      img[i + 2] = srgb8(b * 0.88);
      img[i + 3] = 255;
    }
}

/** A filled disc of colour `rgb` (a flower's eye), a little darker at the rim and speckled. */
function disc(img, ox, oy, x0, y0, R, rgb, r) {
  for (let y = Math.floor(y0 - R); y <= Math.ceil(y0 + R); y++)
    for (let x = Math.floor(x0 - R); x <= Math.ceil(x0 + R); x++) {
      if (x < 0 || y < 0 || x >= CELL || y >= CELL) continue;
      const d = Math.hypot(x + 0.5 - x0, y + 0.5 - y0) / R;
      if (d > 1) continue;
      const b = (0.85 + 0.15 * (1 - d)) * (0.9 + 0.1 * r.next());
      const i = ((oy + y) * ATLAS_SIZE + ox + x) * 4;
      img[i] = srgb8(rgb[0] * b);
      img[i + 1] = srgb8(rgb[1] * b);
      img[i + 2] = srgb8(rgb[2] * b);
      img[i + 3] = 255;
    }
}

function drawCell(img, key, seed) {
  const [cx, cy] = ATLAS_CELLS[key];
  const ox = cx * CELL;
  const oy = cy * CELL;
  const r = rng(seed);
  const kind = key.split('.')[0];
  // The cell's bottom middle is where the card joins the branch (cards are placed with that point on a twig).
  const root = [CELL / 2, CELL - 3];
  if (kind === 'oak' || kind === 'shrub') {
    // A twig fanning into three to five shoots, leaves along each and clustered at the ends: a rounded spray.
    const oak = kind === 'oak';
    // Shoots radiate from a short stem's end, so the spray is a rounded mass with little bare card round it.
    const c = [CELL / 2 + r.jitter(6), CELL * 0.58 + r.jitter(6)];
    line(img, ox, oy, root[0], CELL * 0.86, c[0], c[1], 3, 0.42);
    const shoots = [];
    const n0 = oak ? 7 : 6;
    for (let k = 0; k < n0; k++) {
      const a = -Math.PI / 2 + (k / (n0 - 1) - 0.5) * Math.PI * 1.55 + r.jitter(0.12);
      const reach = (k === 0 || k === n0 - 1 ? 62 : 80) * (0.9 + 0.15 * r.next());
      shoots.push([c, [c[0] + Math.cos(a) * reach, c[1] + Math.sin(a) * reach * 0.92]]);
    }
    for (const [a0, a1] of shoots) line(img, ox, oy, a0[0], a0[1], a1[0], a1[1], 2, 0.42);
    for (const [a0, a1] of shoots) {
      const L = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
      const dir = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
      const n = Math.max(4, Math.round(L / (oak ? 11 : 9)));
      for (let k = 0; k <= n * 2; k++) {
        const s = 0.12 + 0.88 * (Math.floor(k / 2) / n);
        const bx = a0[0] + Math.cos(dir) * L * s;
        const by = a0[1] + Math.sin(dir) * L * s;
        const side = k % 2 ? 1 : -1;
        const a = dir + (k === n * 2 ? r.jitter(0.3) : side * r.range(0.45, 1.1));
        const len = (oak ? 54 : 42) * (0.75 + 0.4 * r.next()) * (1 - 0.2 * s);
        const stalk = oak ? 5 : 3;
        const sx = bx + Math.cos(a) * stalk;
        const sy = by + Math.sin(a) * stalk;
        line(img, ox, oy, bx, by, sx, sy, 1.2, 0.45);
        leaf(img, ox, oy, sx, sy, a, len, len * (oak ? 0.34 : 0.4), oak ? 4.5 : 0, 0.7 + 0.3 * r.next(), r);
      }
    }
  } else if (key === 'flower.0' || key === 'flower.1') {
    // Flower heads seen face on. 0: a daisy (many narrow white rays round a yellow disc); 1: a buttercup (five broad
    // round petals, a green-gold eye). Petals near-white, so the variant's vertex colour sets their colour.
    const c = [CELL / 2, CELL / 2];
    const daisy = key === 'flower.0';
    const n = daisy ? 22 : 5;
    const a0 = r.next() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * Math.PI * 2 + r.jitter(daisy ? 0.06 : 0.1);
      const L = (daisy ? 118 : 112) * (0.9 + 0.1 * r.next());
      leaf(img, ox, oy, c[0], c[1], a, L, daisy ? 11 : 58, 0, 0.9 + 0.08 * r.next(), r);
    }
    disc(img, ox, oy, c[0], c[1], daisy ? 26 : 22, daisy ? [0.93, 0.74, 0.18] : [0.62, 0.66, 0.2], r);
  } else if (key === 'flower.2') {
    // A clover or knapweed head: a round tuft of small florets (light, so the vertex colour sets it).
    const c = [CELL / 2, CELL / 2];
    for (let k = 0; k < 260; k++) {
      const a = r.next() * Math.PI * 2;
      const d = Math.sqrt(r.next()) * 96;
      const x = c[0] + Math.cos(a) * d;
      const y = c[1] + Math.sin(a) * d;
      const a2 = a + r.jitter(1.4);
      const l2 = 14 + 22 * r.next();
      line(img, ox, oy, x, y, x + Math.cos(a2) * l2, y + Math.sin(a2) * l2, 5, 0.72 + 0.26 * r.next());
    }
  } else if (key === 'fern.0') {
    // A bracken frond: a rachis from the bottom middle to the tip, pinnae in pairs, longest a third of the way up,
    // each lobed into pinnules. Dense, so the trimmed card is mostly frond.
    const top = [CELL / 2 + r.jitter(4), 4];
    line(img, ox, oy, root[0], root[1], top[0], top[1], 3.2, 0.42);
    const pairs = 15;
    for (let k = 0; k < pairs; k++) {
      const s = 0.04 + (k / pairs) * 0.94;
      const b = [root[0] + (top[0] - root[0]) * s, root[1] + (top[1] - root[1]) * s];
      const reach = 118 * Math.sin(Math.PI * Math.min(1, (s + 0.2) / 1.05)) ** 0.9 * (0.94 + 0.08 * r.next());
      for (const side of [-1, 1]) {
        const a = -Math.PI / 2 + side * (1.25 - 0.25 * s + r.jitter(0.05));
        const e = [b[0] + Math.cos(a) * reach, b[1] + Math.sin(a) * reach];
        line(img, ox, oy, b[0], b[1], e[0], e[1], 1.6, 0.45);
        // Pinnules along the pinna, each a small blunt leaf.
        const m = Math.max(3, Math.round(reach / 9));
        for (let j = 0; j < m; j++) {
          const t = (j + 0.5) / m;
          const px = b[0] + Math.cos(a) * reach * t;
          const py = b[1] + Math.sin(a) * reach * t;
          const len = 15 * (1 - 0.6 * t) + 4;
          for (const ps of [-1, 1]) leaf(img, ox, oy, px, py, a + ps * (1.05 + r.jitter(0.2)), len * (0.85 + 0.3 * r.next()), len * 0.42, 0, 0.72 + 0.22 * r.next(), r);
        }
      }
    }
  } else {
    // A flat needle spray (fir-like): an axis with side shoots, each a dense bottlebrush of needles.
    const top = [CELL / 2 + r.jitter(10), 8];
    const shoots = [[root, top]];
    for (let k = 0; k < 9; k++) {
      const s = 0.12 + 0.085 * k;
      const b = [root[0] + (top[0] - root[0]) * s, root[1] + (top[1] - root[1]) * s];
      const side = k % 2 ? 1 : -1;
      const reach = (s > 0.7 ? 72 : 96) + r.jitter(6);
      shoots.push([b, [b[0] + side * reach * 0.86, b[1] - reach * 0.5]]);
    }
    for (const [a0, a1] of shoots) {
      line(img, ox, oy, a0[0], a0[1], a1[0], a1[1], 2.2, 0.38);
      const dir = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
      const L = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
      for (let d = 1; d < L; d += 1.3) {
        const bx = a0[0] + Math.cos(dir) * d;
        const by = a0[1] + Math.sin(dir) * d;
        for (const side of [-1, 1]) {
          const a = dir + side * (0.7 + r.jitter(0.25));
          const nl = (24 + r.next() * 10) * (1 - 0.4 * (d / L));
          line(img, ox, oy, bx, by, bx + Math.cos(a) * nl, by + Math.sin(a) * nl, 1.3, 0.58 + 0.34 * r.next());
        }
      }
    }
  }
}

/**
 * The leaves atlas: { webp, raw RGBA, cards: { key: { uv: [u0, v0, u1, v1] (glTF uv, v down), aspect, coverage } } }.
 */
export async function leafAtlas(seed) {
  const img = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);
  for (const key of Object.keys(ATLAS_CELLS)) drawCell(img, key, seed + Object.keys(ATLAS_CELLS).indexOf(key) * 31);
  const cards = {};
  for (const [key, [cx, cy]] of Object.entries(ATLAS_CELLS)) {
    let x0 = CELL;
    let y0 = CELL;
    let x1 = 0;
    let y1 = 0;
    let filled = 0;
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++) {
        if (!img[((cy * CELL + y) * ATLAS_SIZE + cx * CELL + x) * 4 + 3]) continue;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
        filled++;
      }
    // Card rectangle: the drawn pixels' bounds (cards are placed round their centre, so nothing pins an edge).
    const area = (x1 - x0) * (y1 - y0);
    cards[key] = {
      uv: [(cx * CELL + x0) / ATLAS_SIZE, (cy * CELL + y0) / ATLAS_SIZE, (cx * CELL + x1) / ATLAS_SIZE, (cy * CELL + y1) / ATLAS_SIZE],
      aspect: (x1 - x0) / (y1 - y0),
      /** Share of the card's rectangle the picture covers (alpha-tested pixels drawn, not wasted overdraw). */
      coverage: Math.round((filled / area) * 1000) / 1000,
    };
  }
  const raw = Buffer.from(img);
  dilate(raw, ATLAS_SIZE, ATLAS_SIZE, 6);
  const webpBuf = await sharp(raw, { raw: { width: ATLAS_SIZE, height: ATLAS_SIZE, channels: 4 } }).webp({ quality: 82, alphaQuality: 100, effort: 4 }).toBuffer();
  return { webp: webpBuf, raw: { data: raw, width: ATLAS_SIZE, height: ATLAS_SIZE, channels: 4 }, cards };
}

/** A small RGBA picture as PNG (impostor cards embedded in GLBs). */
export function png(data, width, height) {
  const p = new PNG({ width, height });
  p.data = Buffer.from(data);
  return PNG.sync.write(p, { colorType: 6 });
}
