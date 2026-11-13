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

/**
 * Coastal Harbor (Style Pack 11). Pier decking: salt-bleached boards with dark
 * gaps between them, staggered butt joints, a nail pair at each joist.
 */
function deckingPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const n = 6;
  const board = Math.floor(u * n);
  const fu = fract(u * n);
  if (fu < 0.07) return shade(a, 0.35);
  const fv = fract(v * 2 + hash(board, 0, 121) * 0.5);
  if (fv < 0.008) return shade(a, 0.45);
  // Nails over the joists (every half repeat), a pair across the board.
  const joist = fract(v * 4);
  if ((joist < 0.02 || joist > 0.98) && (Math.abs(fu - 0.3) < 0.05 || Math.abs(fu - 0.75) < 0.05)) return shade(a, 0.4);
  const grain = Math.sin((u * 60 + noise(u, v, 8, board + 3) * 5) * Math.PI) * 0.5 + 0.5;
  const weather = mix(b, a, hash(board, Math.floor(v * 2), 123) * 0.35 + grain * 0.18);
  return shade(weather, 0.86 + fbm(u, v, 125) * 0.22);
}

/** Harbour ashlar: big granite blocks in courses of two heights, each its own grey, with weathered faces. */
function ashlarPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const tall = v < 0.6;
  const row = tall ? 0 : 1;
  const fv = tall ? v / 0.6 : (v - 0.6) / 0.4;
  const cols = tall ? 2 : 3;
  const cu = u * cols + row * 0.37;
  const block = Math.floor(cu);
  const fu = fract(cu);
  if (fu < 0.02 || fu > 0.985 || fv < 0.035 || fv > 0.975) return shade(a, 0.8 + fbm(u, v, 127) * 0.2);
  const stone = shade(mix(b, a, hash(block, row, 129) * 0.3), 0.84 + hash(block, row, 131) * 0.24);
  // Rough chiselled faces: blotches, and a darker lip along each block's lower edge.
  return shade(stone, (0.88 + fbm(u * 2, v * 2, 133) * 0.2) * (fv < 0.12 ? 0.86 : 1));
}

/** Shingle: a beach of small rounded pebbles of mixed sizes and greys (a wrapping jittered grid, as the cobbles). */
function pebblePaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const n = 14;
  const x = u * n;
  const y = v * n;
  let d1 = Infinity;
  let d2 = Infinity;
  let cell = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = Math.floor(x) + dx;
      const cy = Math.floor(y) + dy;
      const wx = ((cx % n) + n) % n;
      const wy = ((cy % n) + n) % n;
      const d = Math.hypot(x - (cx + 0.15 + hash(wx, wy, 135) * 0.7), (y - (cy + 0.15 + hash(wx, wy, 136) * 0.7)) * 1.3);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        cell = wx * 37 + wy;
      } else if (d < d2) d2 = d;
    }
  }
  if (d2 - d1 < 0.12) return shade(a, 0.6 + fbm(u, v, 137) * 0.3);
  const tone = hash(cell, 7, 138);
  const stone = tone < 0.15 ? shade(b, 1.25) : tone > 0.85 ? shade(a, 1.1) : mix(b, a, tone * 0.4);
  return shade(stone, 0.75 + Math.min(1, (d2 - d1) / 0.5) * 0.3);
}

/** Corrugated sheet: vertical ridges lit on one flank, a bolt line every half repeat, rust weeping down from the bolts. */
function corrugatedPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const ridge = Math.sin(fract(u * 10) * Math.PI * 2);
  const sheet = Math.floor(u * 2);
  const rust = clamp01(noise(u * 2, v * 0.5, 8, 139 + sheet) * 1.6 - 0.75 + (fract(v * 2) < 0.06 ? 0.6 : 0));
  const paint = shade(b, 0.82 + ridge * 0.16 + fbm(u, v, 141) * 0.06);
  if (fract(u * 2) < 0.01) return shade(paint, 0.6);
  return mix(paint, a, rust * 0.8);
}

/** Tarred lap boards: wide horizontal boards, each lapping the one below with a dark shadow line, the tar worn thin in places. */
function lapboardPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const rows = 8;
  const row = Math.floor(v * rows);
  const fv = fract(v * rows);
  const lap = fv > 0.88 ? 0.55 : 1 - (0.88 - fv) * 0.12;
  const worn = clamp01(noise(u, v * 2, 8, 143 + row) * 1.8 - 1.05);
  return shade(mix(b, a, worn * 0.6), lap * (0.9 + fbm(u * 3, v, 145) * 0.12));
}

/**
 * Lake and glacier ice (Style Pack 12): clear ice whose colour deepens and
 * pales with depth, white cracks along the edges of wrapping Voronoi cells
 * (a haze either side of each), and trapped bubbles.
 */
function icePaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const n = 5;
  const [x, y] = [u * n, v * n];
  let d1 = Infinity;
  let d2 = Infinity;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = Math.floor(x) + dx;
      const cy = Math.floor(y) + dy;
      const [wx, wy] = [((cx % n) + n) % n, ((cy % n) + n) % n];
      const d = Math.hypot(x - cx - hash(wx, wy, 131), y - cy - hash(wx, wy, 132));
      if (d < d1) [d2, d1] = [d1, d];
      else if (d < d2) d2 = d;
    }
  }
  const rim = d2 - d1;
  const depth = fbm(u, v, 133);
  let c = shade(mix(b, a, depth * 0.2), 0.82 + depth * 0.32);
  if (rim < 0.035) c = mix(c, a, 0.8 - rim * 12);
  else if (rim < 0.1) c = mix(c, a, 0.12);
  if (hash(Math.floor(u * 64), Math.floor(v * 64), 134) > 0.985) c = mix(c, a, 0.55);
  return c;
}

/**
 * Sandstone ashlar (Style Pack 09 Desert City): four courses a repeat, each
 * cut into two or three blocks of its own lengths (the joints wrap), fine
 * mortar joints in the accent, each block its own shade with tooled
 * (finely streaked) faces and slightly darker arrises.
 */
function sandstoneAshlarPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const rows = 4;
  const row = Math.floor(v * rows);
  const fv = fract(v * rows);
  // Joints along the course: two or three blocks, offset per course.
  const n = hash(row, 0, 121) < 0.5 ? 2 : 3;
  const su = fract(u + hash(row, 1, 122)) * n;
  const block = Math.floor(su);
  const fu = fract(su);
  if (fv < 0.045 || fu < 0.02) return shade(a, 0.9 + fbm(u, v, 123) * 0.2);
  const rim = Math.min(fu - 0.02, 1 - fu, (fv - 0.045) * 0.6, (1 - fv) * 0.6) * 10;
  const tone = mix(b, [b[0] * 0.92 + 18, b[1] * 0.88 + 10, b[2] * 0.8], hash(block, row, 124));
  const tooled = Math.sin((u * 90 + v * 14 + noise(u, v, 8, 125) * 4) * Math.PI) * 0.025;
  return shade(tone, (0.86 + hash(block, row, 126) * 0.2) * (0.9 + Math.min(1, rim) * 0.1) + tooled + fbm(u, v, 127) * 0.08 - 0.04);
}

/**
 * Weathered lime plaster (Style Pack 09): sun-faded and blotchy, worn thin in a few small places so the coursed stone
 * (the accent) beneath shows faintly through. (It flaked in hard-edged, dark-rimmed patches over a third of the wall:
 * on a jamb or a cover block two or three of them read as dirt or a glitch. The owner, 2026-11-12, on Sandgate.)
 */
function stuccoPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const plaster = shade(mix(b, a, clamp01(fbm(u, v, 134) - 0.45) * 0.5), 0.94 + fbm(u, v, 135) * 0.1);
  const flake = noise(u, v, 4, 131) * 0.6 + noise(u, v, 16, 132) * 0.4;
  // How far worn through: nothing under 0.76, fully at 0.86 (a soft edge, no rim), and then only half way to the stone.
  const worn = clamp01((flake - 0.76) / 0.1);
  if (worn <= 0) return plaster;
  // The stone under the plaster: little courses of rubble.
  const row = Math.floor(v * 16);
  const su = u * 8 + (row % 2) * 0.5;
  const joint = fract(su) < 0.08 || fract(v * 16) < 0.12;
  const stone = joint ? shade(a, 0.8) : shade(a, 0.92 + hash(Math.floor(su), row, 133) * 0.14);
  return mix(plaster, stone, worn * 0.5);
}

/** Glazed fish-scale dome tiles (Style Pack 09): rows offset half a tile, each scale lit toward its crown, a few in the accent. */
function scalesPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const cols = 8;
  const rows = 8;
  const row = Math.floor(v * rows);
  const x = u * cols + (row % 2) * 0.5;
  const col = Math.floor(x);
  const fu = fract(x) - 0.5;
  const fv = fract(v * rows);
  // A scale is a disc whose lower part shows (the row above laps its top).
  const d = Math.hypot(fu, (fv - 0.15) * 0.9);
  if (d > 0.56) return shade(b, 0.62);
  if (d > 0.48) return shade(mix(b, [230, 230, 220], 0.3), 0.55);
  const glaze = hash(((col % cols) + cols) % cols, row, 141) < 0.12 ? a : b;
  return shade(mix(glaze, [255, 255, 255], Math.max(0, 0.3 - d) * 0.6), 0.75 + (1 - Math.min(1, d * 2)) * 0.35 + hash(((col % cols) + cols) % cols, row, 142) * 0.1);
}

/**
 * Zellige (Style Pack 09): eight-point stars (two squares, one turned 45°) in
 * the accent with a cream heart, a small cross where four stars meet in a
 * second colour picked by hash (turquoise, ochre or green), the field in the
 * base, grout between.
 */
function zelligePaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const n = 4;
  const x = fract(u * n) - 0.5;
  const y = fract(v * n) - 0.5;
  const sq = Math.max(Math.abs(x), Math.abs(y));
  const dia = (Math.abs(x) + Math.abs(y)) / Math.SQRT2;
  const star = Math.max(sq / 0.3, dia / 0.3);
  // The cross where four cells meet.
  const cx = 0.5 - Math.abs(x);
  const cy = 0.5 - Math.abs(y);
  const cross = (cx < 0.07 && cy < 0.2) || (cy < 0.07 && cx < 0.2);
  const colours: RGB[] = [
    [40, 150, 150],
    [196, 140, 50],
    [50, 120, 70],
  ];
  const second = colours[Math.floor(hash(Math.round(u * n) % n, Math.round(v * n) % n, 151) * 3)]!;
  const glazed = (c: RGB, seed: number) => shade(c, 0.88 + hash(Math.floor(u * 24), Math.floor(v * 24), seed) * 0.18);
  if (Math.abs(star - 1) < 0.07) return [118, 110, 98];
  if (star < 1) return star < 0.4 ? glazed([236, 228, 210], 152) : glazed(a, 153);
  if (cross) return glazed(second, 154);
  if (fract(u * 24) < 0.08 || fract(v * 24) < 0.08) return shade(b, 0.84);
  return glazed(b, 155);
}

/** Worn flagstones (Style Pack 09): three courses of uneven slabs (lengths by hash), dished and polished by feet. */
function flagsPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const heights = [0.3, 0.4, 0.3];
  let row = 0;
  let v0 = 0;
  while (row < 2 && v >= v0 + heights[row]!) v0 += heights[row++]!;
  const h = heights[row]!;
  const fv = (v - v0) / h;
  const n = 2 + Math.floor(hash(row, 0, 161) * 2);
  const su = fract(u + hash(row, 1, 162)) * n;
  const slab = Math.floor(su);
  const fu = fract(su);
  const jv = 0.02 / h;
  const ju = 0.02 * n;
  if (fv < jv || fu < ju) return shade(a, 0.8 + fbm(u, v, 163) * 0.25);
  const rim = Math.min((fu - ju) / ju, (1 - fu) / ju, (fv - jv) / jv, (1 - fv) / jv);
  const tone = shade(b, 0.84 + hash(slab, row, 164) * 0.22);
  return shade(mix(tone, a, clamp01(noise(u, v, 8, 165 + row) - 0.55) * 0.6), (rim < 1.5 ? 0.92 : 1) * (0.95 + fbm(u, v, 166) * 0.1));
}

/** A woven rug (Style Pack 09): an accent and cream border with a zigzag band, a field of the base with a stepped lozenge medallion and little diamonds. */
function rugPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const cream: RGB = [226, 206, 160];
  const ochre: RGB = [200, 140, 60];
  const weave = 0.92 + (fract(u * 96) < 0.5 ? 0.04 : 0) + (fract(v * 96) < 0.5 ? 0.03 : 0) + fbm(u, v, 171) * 0.06;
  const e = Math.min(u, 1 - u, v, 1 - v);
  let c: RGB = b;
  if (e < 0.03) c = a;
  else if (e < 0.05) c = cream;
  else if (e < 0.11) {
    // The border band: a running zigzag.
    const along = Math.min(u, 1 - u) < Math.min(v, 1 - v) ? v : u;
    const z = Math.abs(fract(along * 12) - 0.5) * 0.08 + 0.06;
    c = Math.abs(e - z) < 0.01 ? ochre : a;
  } else if (e < 0.125) c = cream;
  else {
    const d = Math.abs(u - 0.5) + Math.abs(v - 0.5);
    const step = Math.floor(d * 20);
    if (d < 0.3) c = step % 3 === 0 ? cream : step % 3 === 1 ? a : ochre;
    else if (d < 0.32) c = cream;
    else {
      // Little diamonds over the field.
      const mu = fract(u * 6) - 0.5;
      const mv = fract(v * 6) - 0.5;
      if (Math.abs(mu) + Math.abs(mv) < 0.12) c = hash(Math.floor(u * 6), Math.floor(v * 6), 172) < 0.5 ? cream : a;
    }
  }
  return shade(c, weave);
}

/** Mashrabiya (Style Pack 09): a diagonal lattice of turned bars in the base with a bead at every crossing, the dark accent between, a rail round the repeat. */
function latticePaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const n = 8;
  const s = fract((u + v) * n * 0.5);
  const t = fract((u - v) * n * 0.5);
  const ds = Math.abs(s - 0.5);
  const dt = Math.abs(t - 0.5);
  if (Math.min(u, 1 - u, v, 1 - v) < 0.035) return shade(b, 0.85);
  const r = Math.hypot(ds, dt);
  if (r < 0.17) return shade(b, 1.08 - r * 1.4);
  const m = Math.min(ds, dt);
  if (m < 0.075) return shade(b, 0.95 - m * 2.2 + fbm(u, v, 181) * 0.06);
  return shade(a, 0.9 + fbm(u, v, 182) * 0.2);
}

/**
 * Mossy stone slabs (Style Pack 06): a 3 × 3 grid of big slabs, each its own
 * shade, worn at the rims and chipped at the corners; moss fills the joints
 * and creeps onto the stone in patches (the accent is the moss).
 */
function slabPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const n = 3;
  const cu = Math.floor(u * n);
  const cv = Math.floor(v * n);
  const fu = fract(u * n);
  const fv = fract(v * n);
  const e = edgeDist(fu, fv);
  const growth = fbm(u, v, 121);
  // Joints (wider where a corner is chipped off), moss in them.
  const corner = Math.min(Math.hypot(fu, fv), Math.hypot(1 - fu, fv), Math.hypot(fu, 1 - fv), Math.hypot(1 - fu, 1 - fv));
  const chipped = corner < 0.08 + hash(cu, cv, 123) * 0.08;
  if (e < 0.025 || chipped) return shade(a, 0.7 + growth * 0.5);
  let stone = shade(b, 0.82 + hash(cu, cv, 125) * 0.22 + fbm(u, v, 127) * 0.12);
  // Worn rims, a crack across some slabs.
  if (e < 0.06) stone = shade(stone, 0.88);
  if (hash(cu, cv, 129) > 0.6 && Math.abs(fv - 0.3 - fu * 0.5 - Math.sin(fu * 9) * 0.03) < 0.012) stone = shade(stone, 0.6);
  // Moss creeping in from the joints.
  const creep = clamp01((growth - 0.55) * 4 - e * 3);
  return mix(stone, shade(a, 0.85 + fbm(u, v, 131) * 0.3), creep);
}

/**
 * Carved temple stone (Style Pack 06): courses of blocks, every other course a
 * frieze of step-frets (the stepped hook spiral of the old temples) cut in
 * shadow; the accent is the carving's depth.
 */
function fretPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const rows = 4;
  const row = Math.floor(v * rows);
  const fv = fract(v * rows);
  const blocks = row % 2 === 0 ? 2 : 4;
  const bu = fract(u * blocks + (row % 2) * 0.5);
  const block = Math.floor(u * blocks + (row % 2) * 0.5);
  if (bu < 0.02 || fv < 0.05) return shade(a, 0.75 + fbm(u, v, 141) * 0.2);
  const stone = shade(b, 0.86 + hash(block, row, 143) * 0.16 + fbm(u, v, 145) * 0.1);
  if (row % 2 === 0) return stone;
  // The fret: in each block a hook stepping in from the left and a mirrored one from the right.
  const x = (fract(u * 4 + 0.5) * 2 - 1) * 1.05;
  const y = ((fv - 0.05) / 0.95) * 2 - 1;
  const ax = Math.abs(x);
  const s = x < 0 ? -1 : 1;
  const yy = y * s;
  const groove =
    (Math.abs(yy + 0.62) < 0.13 && ax < 0.85) ||
    (Math.abs(ax - 0.85) < 0.12 && yy > -0.75 && yy < 0.55) ||
    (Math.abs(yy - 0.55) < 0.12 && ax > 0.2 && ax < 0.85) ||
    (Math.abs(ax - 0.2) < 0.12 && yy > -0.1 && yy < 0.55) ||
    (Math.abs(yy + 0.1) < 0.12 && ax > 0.2 && ax < 0.55);
  if (!groove) return stone;
  return mix(shade(a, 0.9), stone, 0.2 + fbm(u, v, 147) * 0.15);
}

/**
 * Relief panels (Style Pack 06): a frame round each block and, raised in it, a
 * masked face, a sun disc with rays or a coiled serpent (picked per block),
 * lit from above: the upper rims bright, the lower ones in shadow.
 */
function reliefPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const cu = Math.floor(u * 2);
  const cv = Math.floor(v * 2);
  const fu = fract(u * 2);
  const fv = fract(v * 2);
  const stone = shade(b, 0.88 + hash(cu, cv, 151) * 0.12 + fbm(u, v, 153) * 0.1);
  const e = edgeDist(fu, fv);
  if (e < 0.02) return shade(a, 0.7);
  if (e < 0.09) return e < 0.05 ? shade(stone, 1.08) : shade(stone, 0.86);
  const x = (fu - 0.5) * 2.4;
  const y = (fv - 0.5) * 2.4;
  const r = Math.hypot(x, y);
  const kind = Math.floor(hash(cu, cv, 155) * 3);
  // Height of the raised carving at (x, y): 0 = the panel's ground.
  const h = (px: number, py: number): number => {
    const pr = Math.hypot(px, py);
    if (kind === 0) {
      // A masked face: brow band, eyes, nose, mouth, ear spools.
      if (Math.abs(py - 0.45) < 0.12 && Math.abs(px) < 0.75) return 1;
      if (Math.hypot(Math.abs(px) - 0.35, py - 0.15) < 0.15) return 0.5;
      if (Math.abs(px) < 0.1 && py > -0.25 && py < 0.2) return 1;
      if (Math.abs(py + 0.45) < 0.08 && Math.abs(px) < 0.4) return 1;
      if (Math.hypot(Math.abs(px) - 0.85, py) < 0.18) return 1;
      return Math.abs(px) < 0.7 && py > -0.7 && py < 0.65 ? 0.35 : 0;
    }
    if (kind === 1) {
      // A sun: a disc, a ring, rays between.
      if (pr < 0.3) return 1;
      if (Math.abs(pr - 0.45) < 0.06) return 0.8;
      const ang = Math.atan2(py, px);
      return pr > 0.55 && pr < 0.95 && Math.abs(fract((ang / (Math.PI * 2)) * 12) - 0.5) < 0.18 ? 0.7 : 0;
    }
    // A coiled serpent: a spiral body and a head.
    const ang = Math.atan2(py, px) / (Math.PI * 2) + 0.5;
    const turn = pr / 0.3 - ang;
    if (pr < 0.95 && Math.abs(fract(turn) - 0.5) < 0.22 && pr > 0.08) return 0.8;
    return Math.hypot(px - 0.7, py + 0.65) < 0.2 ? 1 : 0;
  };
  const here = h(x, y);
  if (here <= 0) return shade(stone, r > 1.1 ? 0.9 : 0.94);
  // Light from above (v runs up the wall): the carving's upper edges catch it, the lower ones fall into shadow.
  const above = h(x, y + 0.08);
  const below = h(x, y - 0.08);
  const lit = above < here ? 1.18 : below < here ? 0.72 : 1.0;
  return shade(mix(stone, shade(b, 1.05), here * 0.3), lit);
}

/** Temple inlay (Style Pack 06): square tiles, a gold frame round a teal field, a gold lozenge with dots at its points. */
function inlayPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const n = 2;
  const fu = fract(u * n);
  const fv = fract(v * n);
  const e = edgeDist(fu, fv);
  const wear = 0.9 + fbm(u, v, 161) * 0.18;
  if (e < 0.03) return shade([40, 36, 30], 0.9 + fbm(u, v, 163) * 0.2);
  const gold = shade(a, wear * (1 + Math.sin((u + v) * 40) * 0.05));
  if (e < 0.1) return e > 0.085 ? shade(gold, 0.75) : gold;
  const x = Math.abs(fu - 0.5);
  const y = Math.abs(fv - 0.5);
  const d = x + y;
  if (Math.abs(d - 0.28) < 0.035) return gold;
  if (d < 0.08) return gold;
  if (Math.hypot(x - 0.28, y) < 0.035 || Math.hypot(x, y - 0.28) < 0.035) return gold;
  if (Math.abs(d - 0.18) < 0.012) return shade(b, 0.7);
  return shade(b, wear);
}

/** Root cover (Style Pack 06): dark earth and leaf litter crossed by knotted roots, each lit along its top. */
function rootPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const earth = shade(b, 0.8 + fbm(u, v, 171) * 0.35);
  // Leaf litter: scattered small leaves in greens and browns.
  const lu = fract(u * 9);
  const lv = fract(v * 9);
  const [lx, ly] = [Math.floor(u * 9), Math.floor(v * 9)];
  const leafHere = hash(lx, ly, 173) > 0.55 && Math.hypot((lu - 0.5) * 1.6, lv - 0.5) < 0.3;
  let c: RGB = leafHere ? (hash(lx, ly, 175) > 0.5 ? [86, 98, 44] : [120, 84, 46]) : earth;
  // Roots: wavy lines across at several angles (whole periods across the repeat, so it tiles).
  for (let k = 0; k < 4; k++) {
    const phase = hash(k, 1, 177) * 6.283;
    const along = k % 2 === 0 ? u : v;
    const across = k % 2 === 0 ? v : u;
    const centre = fract(hash(k, 2, 179) + Math.sin(along * 6.283 * (k + 1) + phase) * 0.08 + noise(along, 0.37 * k, 4, 180 + k) * 0.06);
    const width = 0.018 + hash(k, 3, 181) * 0.02;
    const dd = Math.abs(fract(across - centre + 0.5) - 0.5);
    if (dd < width) {
      const top = fract(across - centre + 1) < 0.5 ? 1.15 : 0.8;
      c = shade(a, (0.85 + fbm(u, v, 183 + k) * 0.25) * top * (1 - (dd / width) * 0.35));
    }
  }
  return c;
}

/** Palm thatch (Style Pack 06): rows of long straw strands, each row overhanging the next, darker where they lap. */
function thatchPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const rows = 5;
  const fv = fract(v * rows);
  const row = Math.floor(v * rows);
  const strand = noise(u, 0.5 + row * 0.13, 64, 191 + row);
  const c = mix(b, a, clamp01(strand * 0.9 + (1 - fv) * 0.35));
  const lap = fv < 0.12 ? 0.6 + fv * 3 : 1;
  return shade(c, lap * (0.88 + fbm(u, v, 193) * 0.2));
}

/**
 * Sandbags (set pieces part 3: trench revetment and parapets): six courses of burlap bags a repeat, three to a course
 * in stretcher bond. Each bag is a rounded pillow (lit on its crown, shaded toward its edges), its own shade of the
 * base, a fine weave over it and a pinched, tied end; the dark joints between bags are the accent.
 */
function sandbagPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const rows = 6;
  // Courses sag and wander a little: the joints between them aren't ruled lines.
  const vv = v * rows + (noise(u, v, 8, 223) - 0.5) * 0.22;
  const row = Math.floor(vv);
  const fv = vv - row;
  const cu = u * 3 + (row % 2) * 0.5 + (hash(row, 0, 211) - 0.5) * 0.1;
  const bag = Math.floor(cu);
  const fu = fract(cu);
  // Each bag its own length and fill: a squashed superellipse, square-ish ends, rounded top and bottom, a lumpy outline.
  const fat = 0.92 + hash(bag, row, 225) * 0.12;
  const x = ((fu - 0.5) * 2) / (0.97 + hash(bag, row, 227) * 0.05);
  const y = ((fv - 0.5) * 2) / fat + (noise(u, v, 16, 229) - 0.5) * 0.18;
  const r = Math.abs(x) ** 5 + Math.abs(y) ** 2.4;
  if (r >= 1) return shade(a, 0.5 + fbm(u, v, 213) * 0.3);
  const crown = Math.sqrt(1 - r);
  // Light from above: the upper half of each bag a touch brighter, its lower lip in shadow.
  const light = 0.6 + crown * 0.44 + (y < 0 ? 0.06 : -0.07) * crown;
  // The tied end (one end of each bag): a pinched, darker gather.
  const tie = (hash(bag, row, 215) < 0.5 ? x : -x) > 0.8 ? 0.8 + fbm(u * 3, v * 3, 231) * 0.1 : 1;
  // Folds and creases across the cloth, and its weave.
  const crease = 1 - Math.max(0, Math.sin((x * 2.3 + y * 0.8 + hash(bag, row, 233) * 6) * Math.PI) - 0.85) * 0.6;
  const weave = 0.96 + Math.sin(u * 900) * Math.sin(v * 900) * 0.04;
  const cloth = mix(b, a, 0.1 + hash(bag, row, 217) * 0.26 + fbm(u * 2, v * 2, 219) * 0.16);
  return shade(cloth, light * tie * crease * weave * (0.9 + fbm(u, v, 221) * 0.16));
}

/**
 * Urban & Civilian (Tileset 11, plan step B): four painted patterns of our own. Nothing here is copied from a photo or
 * from anyone's artwork.
 * Parking bays: asphalt with white bay lines, one repeat two bays wide (lines every half repeat) and one bay deep (a
 * head line across at the repeat's edge), the paint worn where tyres run.
 */
function parkingPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  // Asphalt: fine aggregate, a few pale stones, darker patches of old oil.
  const grit = hash(Math.floor(u * 256), Math.floor(v * 256), 301);
  let road = shade(b, 0.86 + grit * 0.2 + fbm(u, v, 303) * 0.12);
  if (grit > 0.965) road = mix(road, a, 0.28);
  road = shade(road, 1 - clamp01(noise(u, v, 4, 305) * 0.6 + noise(u, v, 16, 306) * 0.4 - 0.6) * 0.7);
  const LINE = 0.012;
  const du = Math.min(u, Math.abs(u - 0.5), 1 - u);
  const dv = Math.min(v, 1 - v);
  if (du > LINE && dv > LINE) return road;
  // Paint: thinner toward its edges and scuffed through in patches.
  const edge = clamp01((LINE - Math.min(du, dv)) / 0.004);
  const worn = clamp01((noise(u, v, 16, 307) * 0.6 + noise(u, v, 64, 309) * 0.4 - 0.34) / 0.2);
  return mix(road, shade(a, 0.9 + fbm(u, v, 311) * 0.1), edge * (0.35 + worn * 0.6));
}

/** Tactile paving: 2 × 2 slabs a repeat, each with 6 × 6 round studs lit from one side, grime in the joints and round the studs. */
function tactilePaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const fu = fract(u * 2);
  const fv = fract(v * 2);
  const slab = hash(Math.floor(u * 2), Math.floor(v * 2), 321);
  if (edgeDist(fu, fv) < 0.018) return shade(a, 0.7 + fbm(u, v, 323) * 0.2);
  const face = shade(b, 0.84 + slab * 0.08 + fbm(u, v, 325) * 0.1);
  const dx = fract(fu * 6) - 0.5;
  const dy = fract(fv * 6) - 0.5;
  const r = Math.hypot(dx, dy) / 0.3;
  if (r < 1) {
    // A low dome: brighter on its crown and on the side the light comes from.
    const crown = Math.sqrt(1 - r * r);
    return shade(b, 0.9 + slab * 0.06 + crown * 0.14 + (dy - dx) * 0.22);
  }
  // Grime gathers against the studs, most on the side away from the light.
  const ring = clamp01(1 - (r - 1) / 0.45);
  return mix(face, a, ring * (0.22 + clamp01((dx - dy) * 1.6) * 0.3));
}

/** A brick wall four courses to the metre (the look of `bricks`, twice as many a repeat); returns the brick and whether this is mortar. */
function brickUnder(u: number, v: number, brick: RGB, mortar: RGB, seed: number): { c: RGB; joint: boolean; tone: number } {
  const rows = 16;
  const row = Math.floor(v * rows);
  const cu = u * 8 + (row % 2) * 0.5;
  const joint = fract(cu) < 0.045 || fract(v * rows) < 0.13;
  if (joint) return { c: shade(mortar, 0.88 + fbm(u, v, seed) * 0.2), joint, tone: 0.8 };
  const tone = 0.8 + hash(Math.floor(cu) % 8, row, seed + 1) * 0.3 + fbm(u, v, seed + 2) * 0.1;
  return { c: shade(brick, tone), joint, tone };
}

/** Distance from (px, py) to the segment a-b; `px` is first brought to the copy of the point nearest `ax` (the pattern wraps in u). */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const x = ax + (px - ax - Math.round(px - ax));
  const ex = bx - ax;
  const ey = by - ay;
  const t = clamp01(((x - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey));
  return Math.hypot(x - ax - ex * t, py - ay - ey * t);
}
const lineDist = (px: number, py: number, pts: readonly (readonly [number, number])[]): number => {
  let d = 9;
  for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, segDist(px, py, pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1]));
  return d;
};
/** Distance to the edge of a union of discs [x, y, r] (negative inside). */
const blobDist = (px: number, py: number, discs: readonly (readonly [number, number, number])[]): number => {
  let d = 9;
  for (const [x, y, r] of discs) d = Math.min(d, Math.hypot(px - x - Math.round(px - x), py - y) - r);
  return d;
};

// Spray paint (fixed: a wall is tagged in can colours whatever the brick is).
const SPRAY = { teal: hex('#2fb0a4'), pink: hex('#d9367f'), yellow: hex('#efc21c'), white: hex('#eeeae0'), blue: hex('#3a62c8'), ink: hex('#17171d') };
// The pieces, in the repeat's own 0-1 square (v up: the wall's foot is v = 0). Shapes only: no letters, numerals, words or marks.
const G_CLOUD: readonly (readonly [number, number, number])[] = [[0.17, 0.4, 0.085], [0.26, 0.47, 0.1], [0.36, 0.42, 0.09], [0.3, 0.34, 0.085], [0.21, 0.31, 0.06], [0.42, 0.36, 0.055]];
const G_SHINE: readonly (readonly [number, number, number])[] = [[0.22, 0.5, 0.018], [0.25, 0.525, 0.012]];
const G_BOLT: readonly (readonly [number, number])[] = [[0.56, 0.6], [0.66, 0.42], [0.62, 0.42], [0.74, 0.24], [0.7, 0.24], [0.79, 0.12]];
const G_WAVE: readonly (readonly [number, number])[] = Array.from({ length: 41 }, (_, i) => [0.5 + (i / 40) * 0.44, 0.74 + Math.sin((i / 40) * Math.PI * 5) * 0.035 * (1 - i / 60)] as const);
/** A scribble: a quick zigzag run left to right, getting smaller, as from shaking the can. It forms no letter. */
const G_SCRAWL: readonly (readonly [number, number])[] = Array.from({ length: 15 }, (_, i) => [0.06 + (i / 14) * 0.36, 0.665 + (i % 2 === 0 ? -1 : 1) * 0.04 * (1 - i / 22) + (i / 14) * 0.02] as const);
const G_UNDER: readonly (readonly [number, number])[] = [[0.05, 0.585], [0.2, 0.575], [0.36, 0.59], [0.44, 0.62]];
const G_DOTS: readonly (readonly [number, number, number])[] = [[0.86, 0.5, 0.034], [0.93, 0.4, 0.022], [0.88, 0.33, 0.014]];
const G_RING: readonly [number, number, number] = [0.52, 0.27, 0.05];
// Runs of paint below the pieces: [u, top v, length].
const G_DRIPS: readonly (readonly [number, number, number, keyof typeof SPRAY])[] = [[0.2, 0.26, 0.09, 'teal'], [0.31, 0.26, 0.15, 'teal'], [0.37, 0.33, 0.06, 'teal'], [0.72, 0.24, 0.07, 'pink'], [0.86, 0.47, 0.11, 'yellow'], [0.52, 0.22, 0.05, 'blue']];

/**
 * Graffiti on brick: a brick wall (base; mortar in the accent) with spray paint over the middle of each repeat: a
 * filled cloud with an outline and a highlight, a jagged bolt, a wavy line, a zigzag scribble with an underline, dots, a ring,
 * and runs of paint below them. Abstract shapes only: no letters, words, logos or real marks. The paint lies thin, so
 * the courses show through it and it has worn off in places.
 */
function graffitiPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  const wall = brickUnder(u, v, b, a, 341);
  // Soot and damp toward the foot of the wall.
  const under = shade(wall.c, 0.9 + clamp01(v * 3) * 0.1);
  let paint: RGB | null = null;
  let cover = 0;
  const lay = (c: RGB, k: number) => {
    if (k <= 0) return;
    paint = paint && k < 1 ? mix(paint, c, k) : c;
    cover = Math.max(cover, k);
  };
  // Overspray: a soft haze round the cloud and the bolt.
  const cloud = blobDist(u, v, G_CLOUD);
  const bolt = lineDist(u, v, G_BOLT);
  lay(SPRAY.teal, clamp01(1 - cloud / 0.05) * 0.3);
  lay(SPRAY.pink, clamp01(1 - (bolt - 0.024) / 0.035) * 0.3);
  // Runs.
  for (const [x, top, len, c] of G_DRIPS) {
    const dx = Math.abs(u - x - Math.round(u - x));
    const w = 0.0055 * (0.6 + clamp01((v - (top - len)) / len) * 0.6);
    if (v < top && v > top - len && dx < w) lay(SPRAY[c], 1);
    if (Math.hypot(dx, v - (top - len)) < 0.008) lay(SPRAY[c], 1);
  }
  // The cloud: outline, fill, highlight.
  if (cloud < 0.012) lay(SPRAY.ink, 1);
  if (cloud < 0) lay(mix(SPRAY.teal, SPRAY.blue, clamp01((0.42 - v) * 4)), 1);
  if (blobDist(u, v, G_SHINE) < 0) lay(SPRAY.white, 1);
  // The bolt: outline and fill.
  if (bolt < 0.032) lay(SPRAY.ink, 1);
  if (bolt < 0.022) lay(SPRAY.pink, 1);
  // Dots and a ring.
  const dots = blobDist(u, v, G_DOTS);
  if (dots < 0.008) lay(SPRAY.ink, 1);
  if (dots < 0) lay(SPRAY.yellow, 1);
  const ring = Math.abs(Math.hypot(u - G_RING[0] - Math.round(u - G_RING[0]), v - G_RING[1]) - G_RING[2]);
  if (ring < 0.009) lay(SPRAY.blue, 1);
  // The wavy line, the scrawl and its underline: one pass of the can each, soft at the edges.
  lay(SPRAY.yellow, clamp01((0.011 - lineDist(u, v, G_WAVE)) / 0.004));
  lay(SPRAY.white, clamp01((0.0085 - lineDist(u, v, G_SCRAWL)) / 0.003));
  lay(SPRAY.white, clamp01((0.007 - lineDist(u, v, G_UNDER)) / 0.003));
  if (!paint || cover <= 0) return under;
  // Paint over brick: the brick's own light and dark show through, the joints stay darker, and it has flaked in spots.
  const flaked = clamp01((noise(u, v, 32, 343) * 0.6 + noise(u, v, 64, 345) * 0.4 - 0.7) / 0.08);
  const on = shade(paint, (wall.joint ? 0.72 : 0.78 + wall.tone * 0.22) * (0.94 + fbm(u, v, 347) * 0.1));
  return mix(under, on, cover * (1 - flaked * 0.85));
}

/**
 * Damaged plaster with brick showing: painted plaster (base), stained and hairline-cracked, fallen away in a few
 * ragged patches to the brick behind (accent), with a band of grey undercoat round each patch (a soft edge, no dark rim).
 */
function spalledPaint(u: number, v: number, b: RGB, a: RGB): RGB {
  // Rain streaks run down the wall; the whole coat is a little uneven.
  const streak = clamp01(noise(u, v * 0.25, 16, 361) - 0.55) * 0.5;
  let plaster = shade(b, 0.92 + fbm(u, v, 363) * 0.1 - streak * 0.18);
  const f = noise(u, v, 4, 365) * 0.55 + noise(u, v, 8, 367) * 0.3 + noise(u, v, 32, 369) * 0.15;
  // Hairline cracks near the patches.
  const crack = Math.abs(noise(u, v, 8, 371) - 0.5);
  if (crack < 0.007 && f > 0.47) plaster = shade(plaster, 0.8);
  const OPEN = 0.66;
  if (f < OPEN - 0.05) return plaster;
  // The undercoat: coarse grey render, left standing round the hole.
  const grit = hash(Math.floor(u * 256), Math.floor(v * 256), 373);
  const render = shade(mix(b, [128, 124, 116], 0.6), 0.84 + grit * 0.16);
  if (f < OPEN) return mix(plaster, render, clamp01((f - (OPEN - 0.05)) / 0.012));
  // Brick, dusted with plaster, the mortar a sandy grey.
  const wall = brickUnder(u, v, a, mix(b, [120, 112, 100], 0.65), 375);
  const brick = mix(wall.c, b, 0.1 + fbm(u, v, 379) * 0.14);
  return mix(render, brick, clamp01((f - OPEN) / 0.012));
}

const PAINTERS: Record<PatternId, Painter> = {
  sandbags: sandbagPaint,
  parking_bays: parkingPaint,
  tactile: tactilePaint,
  graffiti: graffitiPaint,
  spalled_plaster: spalledPaint,
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
  // Style Pack 12 Snow Outpost.
  snow: (u, v, b, a) => {
    // Drift ripples across the repeat, broken up by noise; a few grains glint.
    const ripple = 0.5 + 0.5 * Math.sin((v * 6 + noise(u, v, 4, 123) * 1.5) * Math.PI * 2);
    const c = mix(a, b, clamp01(0.4 + fbm(u, v, 121) * 0.5 + ripple * 0.2));
    return hash(Math.floor(u * 128), Math.floor(v * 128), 125) > 0.992 ? shade(c, 1.1) : c;
  },
  ice: icePaint,
  prefab: (u, v, b, a) => {
    // Four panels a repeat: seams and the top and bottom channels in the accent, a pressed rib, rivets.
    const fu = fract(u * 4);
    const fv = fract(v);
    if (fu < 0.025 || fu > 0.975 || fv < 0.035 || fv > 0.965) return shade(a, 0.9);
    const rib = Math.abs(fu - 0.5) < 0.035 ? 1.08 : Math.abs(fu - 0.5) < 0.05 ? 0.86 : 1;
    const rivet = (Math.abs(fv - 0.08) < 0.012 || Math.abs(fv - 0.92) < 0.012) && Math.abs(fract(fu * 4) - 0.5) < 0.08;
    return shade(b, (rivet ? 0.7 : rib) * (0.94 + fbm(u, v, 141) * 0.1));
  },
  snowcrete: (u, v, b, a) => {
    // Concrete, snow drifted in patches and lodged in its pores.
    const patch = clamp01((noise(u, v, 4, 153) - 0.55) * 6);
    const speck = hash(Math.floor(u * 96), Math.floor(v * 96), 155) > 0.9 ? 0.5 : 0;
    return mix(shade(b, 0.85 + fbm(u, v, 151) * 0.3), a, Math.max(patch, speck) * 0.9);
  },
  frostrock: (u, v, b, a) => {
    // Rock strata (each layer its own shade), rime along the top of each ledge and in flecks.
    const w = v * 5 + noise(u, v, 4, 161) * 0.8;
    const layer = (((Math.floor(w) % 5) + 5) % 5);
    const c = shade(b, 0.75 + hash(layer, 1, 163) * 0.35 + fbm(u, v, 165) * 0.15);
    const band = fract(w);
    return mix(c, a, (band > 0.82 ? clamp01((band - 0.82) * 8) * 0.85 : 0) + (fbm(u, v, 167) > 0.7 ? 0.25 : 0));
  },
  decking: deckingPaint,
  ashlar: ashlarPaint,
  pebbles: pebblePaint,
  corrugated: corrugatedPaint,
  lapboards: lapboardPaint,
  // Two horizontal bands a repeat (a lighthouse's red and white).
  bands: (u, v, b, a) => shade(fract(v) < 0.5 ? b : a, 0.92 + fbm(u, v, 147) * 0.1),
  sandstone_ashlar: sandstoneAshlarPaint,
  stucco: stuccoPaint,
  scales: scalesPaint,
  zellige: zelligePaint,
  flags: flagsPaint,
  rug: rugPaint,
  lattice: latticePaint,
  slabs: slabPaint,
  fret: fretPaint,
  relief: reliefPaint,
  inlay: inlayPaint,
  roots: rootPaint,
  thatch: thatchPaint,
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

/** Fine patterns (hieroglyphs, mosaics, cobbles, half-timbering, roof tiles, decking, shingle, ice, prefab panels, sandstone ashlar, dome tiles, zellige, rugs, lattices, temple carvings, inlay, roots, slabs, bay lines, studs, graffiti, fallen plaster) are painted at twice the usual size so their shapes read. */
const FINE_PATTERNS = new Set<PatternId>(['glyphs', 'glyphs_painted', 'mosaic', 'cobbles', 'timber', 'pantiles', 'decking', 'pebbles', 'ice', 'prefab', 'sandstone_ashlar', 'scales', 'zellige', 'rug', 'lattice', 'fret', 'relief', 'inlay', 'roots', 'slabs', 'sandbags', 'parking_bays', 'tactile', 'graffiti', 'spalled_plaster']);
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
