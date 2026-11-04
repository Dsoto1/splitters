// The airliner cabin kit (MapMaker category "Airliner Cabin"): fuselage sections that snap end to end inside the
// owner's Meshy airliner shell (`airliner_shell`, content/props/meshy-owned-airliner.json), and the fittings that go
// in them, modelled here in code from plain geometry (tools/content/pieces.mjs). No pack and no generative AI
// service made them: the code is the source. The sections follow the shell's own cross-section, measured by
// tools/content/fuselage-profile.mjs into assets-src/tiletrigger-cabin/fuselage.json, a few centimetres inside it.
//
//   node tools/content/prepare-cabin.mjs
//
// Writes assets-src/tiletrigger-cabin/<id>.glb (licence "Owned", License.txt there) and assembly.json (where each
// section goes when the shell stands at the origin; docs/BUILDING_KIT.md, "Airliner"). Every GLB carries its
// collision boxes in its first node's extras (`collide: "model"` in content/props/tiletrigger-cabin.json), so
// players, shots and bots meet the walls, floor, seats and doorways as drawn.
//
// The frame: the shell's, as the game draws it at yaw 0. Nose to +Z, y up from the ground the shell stands on.
// Sections are modelled where they sit in the shell (the straight ones round z = 0), fittings at the origin
// facing +Z (forward). prepare-props then centres each on its footprint and stands it on y = 0.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import { FLOOR, OPENINGS } from './fuselage-profile.mjs';
import { Piece, piecesDocument } from './pieces.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'assets-src/tiletrigger-cabin');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
mkdirSync(SRC, { recursive: true });
const PROFILE = JSON.parse(readFileSync(join(SRC, 'fuselage.json'), 'utf8'));
const RAYS = PROFILE.rays;

// ---------------------------------------------------------------- dimensions (metres, shell frame)

/** The flat ceiling over the cabin, 2.55 m up (lower where the nose closes in). */
const CEIL = FLOOR + 2.55;
/** Skin: this far inside the shell. Inside face of the sidewall panels: this much further in. */
const SKIN = 0.04;
const WALL = 0.08;
/** Window band (sill and head above the floor) and pitch along the cabin; the first window this far into a 0.9 m bay. */
const WIN = [FLOOR + 1.12, FLOOR + 1.62];
const WIN_W = 0.3;
const BAY = 0.9;
/** Openings (y from, y to): the main doors, the over-wing exits (a 0.25 m sill, one step). */
const DOOR = OPENINGS.l1.slice(2);
const EXIT = OPENINGS.exit.slice(2);
/** Where everything goes along the shell (z of the joints); straight pieces fill [STRAIGHT_AFT, NOSE_JOINT]. */
const NOSE_JOINT = 23.65;
const TAIL_JOINT = -14.15;
const TAIL_END = -25.6;
const NOSE_END = 33.4;
/** The doors in the shell (z from, z to): L1/R1 in the nose piece, L2/R2 in the door section, the over-wing exits, the rear doors. */
const L1 = OPENINGS.l1.slice(0, 2);
const REAR = OPENINGS.rear.slice(0, 2);
const DOOR_W = OPENINGS.l2[0] - OPENINGS.l2[1];
const EXIT_W = OPENINGS.exit[0] - OPENINGS.exit[1];
/** Section lengths: whole window bays. */
const S4 = 4 * BAY;
const S2 = 2 * BAY;

// ---------------------------------------------------------------- palette

const hex = (h) => [1, 3, 5].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2 * 1000) / 1000);
const glow = (h, k = 1) => hex(h).map((v) => Math.min(1, Math.round(v * k * 1000) / 1000));
const MATS = {
  skin: { color: hex('#e8eaec'), rough: 0.35, metal: 0.1 },
  panel: { color: hex('#e6e1d6'), rough: 0.6 },
  panelLow: { color: hex('#cfc8ba'), rough: 0.65 },
  deck: { color: hex('#5c6066'), rough: 0.7 },
  trim: { color: hex('#9a978f'), rough: 0.5 },
  ceiling: { color: hex('#eeebe4'), rough: 0.7 },
  carpet: { color: hex('#3a4a66'), rough: 0.98 },
  carpetAisle: { color: hex('#2c3850'), rough: 0.98 },
  carpetBand: { color: hex('#8a6a3a'), rough: 0.98 },
  fabric: { color: hex('#24406e'), rough: 0.95 },
  fabricDark: { color: hex('#1a2c4c'), rough: 0.95 },
  headrest: { color: hex('#d9d4c8'), rough: 0.9 },
  leather: { color: hex('#3c3a3a'), rough: 0.55 },
  shellPlastic: { color: hex('#c4c0b8'), rough: 0.5 },
  wood: { color: hex('#6a4a30'), rough: 0.5 },
  metal: { color: hex('#8c9096'), rough: 0.35, metal: 0.7 },
  steel: { color: hex('#b8bcc0'), rough: 0.25, metal: 0.85 },
  dark: { color: hex('#2a2c30'), rough: 0.7 },
  console: { color: hex('#3a3e44'), rough: 0.6 },
  screen: { color: hex('#10161c'), rough: 0.2, emissive: glow('#2a6aa0', 0.35) },
  screenAmber: { color: hex('#1a1208'), rough: 0.2, emissive: glow('#c08020', 0.3) },
  light: { color: hex('#fff6e8'), emissive: glow('#fff0d8', 0.95) },
  sign: { color: hex('#1a3a20'), emissive: glow('#40d060', 0.8) },
  exitSign: { color: hex('#401010'), emissive: glow('#ff4030', 0.8) },
  glass: { color: hex('#9ab8c8'), rough: 0.05, metal: 0.2, alpha: 0.28 },
  rubber: { color: hex('#1c1c1e'), rough: 0.9 },
  yellow: { color: hex('#e0b020'), rough: 0.6 },
  red: { color: hex('#b02a22'), rough: 0.6 },
  white: { color: hex('#f2f2f0'), rough: 0.4 },
  curtain: { color: hex('#5a6a8a'), rough: 0.95 },
};
const piece = (name) => new Piece(name, MATS);

// ---------------------------------------------------------------- the shell's rings

const lerp = (a, b, t) => a + (b - a) * t;
/** The shell's ring at z (metres): { cy, r[RAYS] }; the straight part uses the smallest ring over it. In the tail the fin stands out of the top, so rings there are held to the round body below it. */
function shellRing(z, straight) {
  if (straight) return PROFILE.constant;
  const st = PROFILE.stations;
  let i = st.findIndex((s) => s.z >= z);
  if (i <= 0) i = Math.max(1, i < 0 ? st.length - 1 : 1);
  const [a, b] = [st[i - 1], st[i]];
  const t = Math.min(1, Math.max(0, (z - a.z) / (b.z - a.z || 1)));
  // The joints meet the constant ring exactly, so a section's end matches its neighbour's.
  const ring = { cy: lerp(a.cy, b.cy, t), r: a.r.map((v, k) => lerp(v, b.r[k], t)) };
  return z < 0 ? tame(ring) : ring;
}
/** A tail ring: no taller above its widest than a round body (the fin root counts as the fin). */
function tame({ cy, r }) {
  const hw = Math.max(r[0], r[RAYS / 2]);
  const top = Math.min(r[RAYS / 4], hw * 1.08);
  return { cy, r: r.map((v, k) => {
    const a = (k / RAYS) * 2 * Math.PI;
    if (Math.sin(a) <= 0) return v;
    const e = 1 / Math.hypot(Math.cos(a) / hw, Math.sin(a) / top);
    return Math.min(v, e);
  }) };
}
/** Radius of the ring at angle a (radians), interpolated between rays. */
function radiusAt(ring, a) {
  const u = ((((a / (2 * Math.PI)) * RAYS) % RAYS) + RAYS) % RAYS;
  const k = Math.floor(u);
  return lerp(ring.r[k % RAYS], ring.r[(k + 1) % RAYS], u - k);
}
/** A point on the ring at angle a, `inset` metres in. */
const at = (ring, a, inset) => {
  const r = radiusAt(ring, a) - inset;
  return [Math.cos(a) * r, ring.cy + Math.sin(a) * r];
};
/** The angle (right side, -pi/2..pi/2) where the ring `inset` in reaches height y; null if it doesn't. */
function angleAtHeight(ring, y, inset) {
  let [lo, hi] = [-Math.PI / 2 + 1e-4, Math.PI / 2 - 1e-4];
  if (at(ring, lo, inset)[1] > y || at(ring, hi, inset)[1] < y) return null;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (at(ring, m, inset)[1] < y) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
/** Half-width of the inside panels at height y (0 where the ring doesn't reach it). */
function insideHalf(ring, y) {
  const a = angleAtHeight(ring, y, SKIN + WALL);
  return a === null ? 0 : at(ring, a, SKIN + WALL)[0];
}

// ---------------------------------------------------------------- geometry helpers

const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((q) => q / l);
};
/** A quad a-b-c-d facing whichever way its winding says (counter-clockwise seen from the front). */
const face = (p, mat, a, b, c, d) => p.quad(mat, a, b, c, d, norm(cross(sub(b, a), sub(d, a))));
/** A quad facing whichever way is nearer `want`. */
const toward = (p, mat, q, want) => {
  const n = cross(sub(q[1], q[0]), sub(q[3], q[0]));
  if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0) face(p, mat, ...q);
  else face(p, mat, q[3], q[2], q[1], q[0]);
};
/** The same quad facing the other way. */
const back = (p, mat, a, b, c, d) => face(p, mat, d, c, b, a);

/** A box of `size` centred on `c`, tilted `rx` about x (radians; positive tips its top toward +z and lowers its +z end), then turned `ry` about y. */
function obox(p, mat, c, size, { rx = 0, ry = 0 } = {}) {
  const [hx, hy, hz] = size.map((v) => v / 2);
  const rot = ([x, y, z]) => {
    let [a, b, d] = [x, y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
    [a, d] = [a * Math.cos(ry) + d * Math.sin(ry), -a * Math.sin(ry) + d * Math.cos(ry)];
    return [a, b, d];
  };
  const v = (x, y, z) => sub(rot([x, y, z]), c.map((q) => -q));
  const faces = [
    [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz], [1, 0, 0]],
    [[-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, -hy, -hz], [-1, 0, 0]],
    [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [0, 1, 0]],
    [[-hx, -hy, hz], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [0, -1, 0]],
    [[hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], [-hx, -hy, hz], [0, 0, 1]],
    [[-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [hx, -hy, -hz], [0, 0, -1]],
  ];
  for (const [a, b, cc, d, n] of faces) p.quad(mat, v(...a), v(...b), v(...cc), v(...d), rot(n));
}

// ---------------------------------------------------------------- fuselage sections

/**
 * A fuselage section from z0 (front) to z1 (aft): skin round the outside, sidewall panels from the floor up to the
 * ceiling, the floor (carpet, a darker runner down each aisle), the flat ceiling with light strips, windows (glass
 * on the panels: through them the shell's inside faces, drawn one-sided, let the world show), and `openings`
 * ({ side: -1 | 1, z: [front, aft], y: [sill, head] }) cut through panels and skin with a lined frame. Returns its
 * collision boxes: floor, sidewalls in three bands (seat, window, bin height) less the openings, the ceiling.
 * `straight` sections use the constant ring; the nose and tail follow the shell's taper station by station.
 */
function fuselage(p, { z0, z1, straight, openings = [], windows = true, glass = null, capFront = false, capAft = false, ceilingLights = true, deck = null }) {
  const step = straight ? Math.abs(z0 - z1) : 0.6;
  // The cuts along the section: stations, plus every window's and opening's edges.
  const cuts = new Set([z0, z1]);
  for (let z = z0; z > z1 + 1e-6; z -= step) cuts.add(Math.round(z * 1000) / 1000);
  const wins = [];
  if (windows) {
    for (let z = z0 - BAY / 2; z > z1 + 0.2; z -= BAY) {
      const w = [z + WIN_W / 2, z - WIN_W / 2];
      if (openings.some((o) => w[0] > o.z[1] - 0.35 && w[1] < o.z[0] + 0.35)) continue;
      if (!straight && shellRing(z, false).r[0] < 2.6) continue;
      wins.push(w);
      cuts.add(w[0]).add(w[1]);
    }
  }
  for (const o of openings) cuts.add(o.z[0]).add(o.z[1]).add(o.z[0] + 0.08).add(o.z[1] - 0.08);
  const zs = [...cuts].filter((z) => z <= z0 + 1e-9 && z >= z1 - 1e-9).sort((a, b) => b - a);
  const levels = [WIN[0], WIN[1], CEIL, ...openings.flatMap((o) => o.y)];
  const inWindow = (za, zb, ya, yb) => wins.some(([f, a]) => za <= f + 1e-6 && zb >= a - 1e-6) && ya >= WIN[0] - 1e-6 && yb <= WIN[1] + 1e-6;
  const inOpening = (side, za, zb, ya, yb) => openings.some((o) => o.side === side && za <= o.z[0] + 1e-6 && zb >= o.z[1] - 1e-6 && ya >= o.y[0] - 1e-6 && yb <= o.y[1] + 1e-6);
  const inGlass = (za, zb, ya, yb) => glass && za <= glass.z[0] + 1e-6 && zb >= glass.z[1] - 1e-6 && ya >= glass.y - 1e-6;
  for (let s = 0; s + 1 < zs.length; s++) {
    const [za, zb] = [zs[s], zs[s + 1]];
    const [ra, rb] = [shellRing(za, straight), shellRing(zb, straight)];
    // Skin: the full ring (every other ray: it is seen only where no shell covers it), facing out.
    for (let k = 0; k < RAYS; k += 2) {
      const [a0, a1] = [(k / RAYS) * 2 * Math.PI, ((k + 2) / RAYS) * 2 * Math.PI];
      const pa0 = at(ra, a0, SKIN), pa1 = at(ra, a1, SKIN), pb0 = at(rb, a0, SKIN), pb1 = at(rb, a1, SKIN);
      const ym = (pa0[1] + pa1[1]) / 2;
      // The skin is open where an opening goes through it.
      const side = Math.cos((a0 + a1) / 2) > 0 ? 1 : -1;
      if (openings.some((o) => o.side === side && za <= o.z[0] + 1e-6 && zb >= o.z[1] - 1e-6 && ym > o.y[0] - 0.02 && ym < o.y[1] + 0.02)) continue;
      face(p, 'skin', [pa0[0], pa0[1], za], [pb0[0], pb0[1], zb], [pb1[0], pb1[1], zb], [pa1[0], pa1[1], za]);
    }
    // Panels: per side, from the floor up to the ceiling (or over the top where the nose closes in below it).
    const inner = (ring) => {
      const aF = angleAtHeight(ring, FLOOR, SKIN + WALL);
      if (aF === null) return null;
      const top = ring.cy + radiusAt(ring, Math.PI / 2) - SKIN - WALL;
      const aC = top > CEIL + 0.02 ? angleAtHeight(ring, CEIL, SKIN + WALL) : Math.PI / 2;
      const n = 8;
      const as = Array.from({ length: n + 1 }, (_, i) => aF + ((aC - aF) * i) / n);
      for (const y of levels) {
        const a = angleAtHeight(ring, y, SKIN + WALL);
        if (a !== null && a > aF + 1e-4 && a < aC - 1e-4) as.push(a);
      }
      return { as: [...new Set(as.map((a) => Math.round(a * 1e6) / 1e6))].sort((x, y) => x - y), closed: aC === Math.PI / 2 };
    };
    const ia = inner(ra);
    const ib = inner(rb);
    if (!ia || !ib) continue;
    const n = Math.min(ia.as.length, ib.as.length);
    // Both rings with the same angles: the smaller set (a joint between differently-cut segments shows no crack worth a fix).
    const as = (ia.as.length <= ib.as.length ? ia : ib).as;
    const closed = ia.closed && ib.closed;
    for (const side of [1, -1]) {
      for (let j = 0; j + 1 < n; j++) {
        const pt = (ring, a) => {
          const [x, y] = at(ring, a, SKIN + WALL);
          return [side * x, y];
        };
        const a0 = pt(ra, as[j]), a1 = pt(ra, as[j + 1]), b0 = pt(rb, as[j]), b1 = pt(rb, as[j + 1]);
        const [ya, yb] = [Math.min(a0[1], b0[1]), Math.max(a1[1], b1[1])];
        if (inOpening(side, za, zb, ya, yb)) continue;
        const onDeck = deck !== null && zb >= deck - 1e-6;
        const mat = inWindow(za, zb, ya, yb) || inGlass(za, zb, ya, yb) ? 'glass' : onDeck ? (ya < FLOOR + 1.0 ? 'console' : 'deck') : ya > WIN[1] + 0.3 ? 'panel' : ya < WIN[0] - 0.4 ? 'panelLow' : 'panel';
        const quad = [[a0[0], a0[1], za], [a1[0], a1[1], za], [b1[0], b1[1], zb], [b0[0], b0[1], zb]];
        // Facing the cabin: inward on the right (+x), mirrored on the left.
        if (side > 0) face(p, mat, ...quad);
        else back(p, mat, ...quad);
      }
      // Window frames: a grey surround on each window, just inside the panel.
      for (const [f, a] of wins) {
        if (f > za + 1e-6 || a < zb - 1e-6 || za - zb > WIN_W + 0.01) continue;
        if (Math.abs(za - f) > 1e-6) continue;
        const [x0, y0] = at(ra, angleAtHeight(ra, WIN[0], SKIN + WALL), SKIN + WALL);
        const [x1, y1] = at(ra, angleAtHeight(ra, WIN[1], SKIN + WALL), SKIN + WALL);
        const d = -0.015 * side;
        const X = (x) => side * x - d;
        for (const [ya, yb, xa, xb] of [[y0 - 0.06, y0, x0, x0], [y1, y1 + 0.06, x1, x1]]) {
          const q = [[X(xa), ya, f + 0.04], [X(xb), yb, f + 0.04], [X(xb), yb, a - 0.04], [X(xa), ya, a - 0.04]];
          if (side > 0) face(p, 'trim', ...q);
          else back(p, 'trim', ...q);
        }
        for (const [zz, w] of [[f, 1], [a, -1]]) {
          const q = [[X(x0), y0 - 0.06, zz + 0.04 * w], [X(x1), y1 + 0.06, zz + 0.04 * w], [X(x1), y1 + 0.06, zz - 0.02 * w], [X(x0), y0 - 0.06, zz - 0.02 * w]];
          if (side * w > 0) face(p, 'trim', ...q);
          else back(p, 'trim', ...q);
        }
      }
    }
    // Floor: carpet wall to wall, a darker runner down each aisle and a gold band at every section joint.
    const fa = insideHalf(ra, FLOOR) + 0.02;
    const fb = insideHalf(rb, FLOOR) + 0.02;
    p.quad('carpet', [-fa, FLOOR, za], [fa, FLOOR, za], [fb, FLOOR, zb], [-fb, FLOOR, zb], [0, 1, 0]);
    for (const x of [-1.32, 1.32]) if (fb > 2) p.quad('carpetAisle', [x - 0.5, FLOOR + 0.004, za], [x + 0.5, FLOOR + 0.004, za], [x + 0.5, FLOOR + 0.004, zb], [x - 0.5, FLOOR + 0.004, zb], [0, 1, 0]);
    // Ceiling: flat, with a light strip over each aisle.
    if (!closed) {
      const ca = insideHalf(ra, CEIL) + 0.02;
      const cb = insideHalf(rb, CEIL) + 0.02;
      p.quad('ceiling', [-cb, CEIL, zb], [cb, CEIL, zb], [ca, CEIL, za], [-ca, CEIL, za], [0, -1, 0]);
      if (ceilingLights) for (const x of [-1.32, 1.32]) p.quad('light', [x - 0.09, CEIL - 0.006, zb], [x + 0.09, CEIL - 0.006, zb], [x + 0.09, CEIL - 0.006, za], [x - 0.09, CEIL - 0.006, za], [0, -1, 0]);
    }
  }
  // Openings: a lined frame through the wall (sides, head and sill) out to the shell's skin, and a yellow sill edge.
  for (const o of openings) {
    const ring = shellRing((o.z[0] + o.z[1]) / 2, straight);
    const xIn = (y) => insideHalf(ring, y);
    const xOut = (y) => {
      const a = angleAtHeight(ring, y, -0.02);
      return a === null ? 0 : at(ring, a, -0.02)[0];
    };
    const s = o.side;
    const ys = Array.from({ length: 9 }, (_, i) => lerp(o.y[0], o.y[1], i / 8));
    for (const [zz, w] of [[o.z[0], -1], [o.z[1], 1]]) {
      for (let i = 0; i + 1 < ys.length; i++) {
        const q = [[s * xIn(ys[i]), ys[i], zz], [s * xOut(ys[i]), ys[i], zz], [s * xOut(ys[i + 1]), ys[i + 1], zz], [s * xIn(ys[i + 1]), ys[i + 1], zz]];
        // The jambs face into the opening.
        if (s * w > 0) face(p, 'trim', ...q);
        else back(p, 'trim', ...q);
      }
    }
    const yh = o.y[1];
    const qh = [[s * xIn(yh), yh, o.z[0]], [s * xIn(yh), yh, o.z[1]], [s * xOut(yh), yh, o.z[1]], [s * xOut(yh), yh, o.z[0]]];
    if (s > 0) back(p, 'trim', ...qh);
    else face(p, 'trim', ...qh);
    const yl = o.y[0];
    const ql = [[s * xIn(yl) - s * 0.03, yl, o.z[0]], [s * xIn(yl) - s * 0.03, yl, o.z[1]], [s * xOut(yl), yl, o.z[1]], [s * xOut(yl), yl, o.z[0]]];
    if (s > 0) face(p, 'yellow', ...ql);
    else back(p, 'yellow', ...ql);
    if (yl > FLOOR + 0.01) {
      // The over-wing sill: a step up, faced toward the cabin.
      const xi = xIn(yl) - 0.03;
      p.box('trim', [s > 0 ? xi - 0.5 : -xi, FLOOR, o.z[1]], [s > 0 ? xi : -xi + 0.5, yl, o.z[0]]);
    }
    // An exit sign over every opening.
    const xs = xIn(Math.min(CEIL - 0.1, yh + 0.15)) - 0.03;
    p.box(yl > FLOOR + 0.01 ? 'exitSign' : 'sign', [s * xs - 0.02, Math.min(CEIL - 0.2, yh + 0.05), (o.z[0] + o.z[1]) / 2 - 0.25], [s * xs + 0.02, Math.min(CEIL - 0.05, yh + 0.2), (o.z[0] + o.z[1]) / 2 + 0.25]);
  }
  const capRing = (z, mat, facing) => {
    const ring = shellRing(z, straight);
    const c = [0, ring.cy, z];
    for (let k = 0; k < RAYS; k++) {
      const [a0, a1] = [(k / RAYS) * 2 * Math.PI, ((k + 1) / RAYS) * 2 * Math.PI];
      const p0 = at(ring, a0, SKIN), p1 = at(ring, a1, SKIN);
      const t = [c, [p0[0], p0[1], z], [p1[0], p1[1], z]];
      p.tri(mat, ...(facing > 0 ? t : [t[0], t[2], t[1]]), [0, 0, facing]);
    }
  };
  if (capFront) capRing(z0, 'skin', 1);
  if (capAft) capRing(z1, 'skin', -1);
  return fuselageBoxes({ z0, z1, straight, openings });
}

/** Collision for a section (see fuselage), in segments of at most 1.2 m along a taper. */
function fuselageBoxes({ z0, z1, straight, openings }) {
  const out = [];
  const segs = straight ? [[z0, z1]] : [];
  if (!straight) for (let z = z0; z > z1 + 1e-6; z -= 1.2) segs.push([z, Math.max(z1, z - 1.2)]);
  for (const [za, zb] of segs) {
    const rings = [0, 0.25, 0.5, 0.75, 1].map((t) => shellRing(lerp(za, zb, t), straight));
    const minIn = (y) => Math.min(...rings.map((r) => insideHalf(r, y)));
    const maxOut = Math.max(...rings.map((r) => Math.max(...r.r))) ;
    const top = Math.min(...rings.map((r) => r.cy + radiusAt(r, Math.PI / 2) - SKIN - WALL));
    const ceil = Math.min(CEIL, top);
    const floorHalf = Math.max(...rings.map((r) => insideHalf(r, FLOOR)));
    out.push([-floorHalf, FLOOR - 0.3, zb, floorHalf, FLOOR, za]);
    // Sidewalls in bands; each band's face where the panels come furthest in. An opening leaves its part of a band out.
    const bands = [FLOOR, FLOOR + 1.1, FLOOR + 1.95, ceil].filter((y, i, a) => i === 0 || y > a[i - 1] + 0.05);
    for (let b = 0; b + 1 < bands.length; b++) {
      const [y0, y1] = [bands[b], bands[b + 1]];
      const x = Math.min(minIn(y0 + 0.02), minIn(y1 - 0.02), minIn((y0 + y1) / 2));
      if (x <= 0.3) continue;
      for (const side of [1, -1]) {
        // The band's z span less the openings on this side that reach into it; what an opening leaves above it stays.
        let spans = [[za, zb, y0, y1]];
        for (const o of openings) {
          if (o.side !== side || o.z[1] >= za || o.z[0] <= zb || o.y[1] <= y0 || o.y[0] >= y1) continue;
          const next = [];
          for (const [a, c, ya, yc] of spans) {
            if (o.z[1] >= a || o.z[0] <= c) {
              next.push([a, c, ya, yc]);
              continue;
            }
            if (a > o.z[0]) next.push([a, o.z[0], ya, yc]);
            if (o.z[1] > c) next.push([o.z[1], c, ya, yc]);
            if (o.y[1] < yc) next.push([Math.min(a, o.z[0]), Math.max(c, o.z[1]), o.y[1], yc]);
            if (o.y[0] > ya) next.push([Math.min(a, o.z[0]), Math.max(c, o.z[1]), ya, o.y[0]]);
          }
          spans = next;
        }
        for (const [a, c, ya, yc] of spans) out.push(side > 0 ? [x, ya, c, maxOut, yc, a] : [-maxOut, ya, c, -x, yc, a]);
      }
    }
    if (ceil > FLOOR + 1.9) out.push([-maxOut, ceil, zb, maxOut, ceil + 0.3, za]);
  }
  return out;
}

// ---------------------------------------------------------------- cabin fittings

/** Seat rows: `n` seats of `w` (cushion) between armrests, facing +Z, the row's front edge at z = +depth/2. */
function seatRow(p, n, { w = 0.43, arm = 0.05, depth = 0.74, fabric = 'fabric' } = {}) {
  const width = n * w + (n + 1) * arm;
  const x0 = -width / 2;
  const back = -depth / 2 + 0.1;
  // Frame: two legs and a cross beam.
  for (const x of [x0 + 0.18, -x0 - 0.18]) p.box('metal', [x - 0.03, 0, -0.25], [x + 0.03, 0.38, 0.22]);
  p.box('metal', [x0 + 0.05, 0.3, -0.05], [-x0 - 0.05, 0.36, 0.02]);
  p.box('metal', [x0 + 0.05, 0.02, -0.3], [-x0 - 0.05, 0.05, 0.25]);
  for (let i = 0; i < n; i++) {
    const cx = x0 + arm + w / 2 + i * (w + arm);
    // Cushion, backrest (reclined a little), headrest cover, and the plastic back shell with its tray table.
    obox(p, fabric, [cx, 0.43, 0.06], [w, 0.12, 0.5]);
    obox(p, fabric, [cx, 0.8, back + 0.04], [w, 0.7, 0.12], { rx: -0.16 });
    obox(p, 'headrest', [cx, 1.08, back - 0.005], [w - 0.04, 0.16, 0.13], { rx: -0.16 });
    obox(p, 'shellPlastic', [cx, 0.78, back - 0.04], [w + 0.01, 0.66, 0.03], { rx: -0.16 });
    obox(p, 'trim', [cx, 0.78, back - 0.065], [w - 0.1, 0.3, 0.02], { rx: -0.16 });
  }
  for (let i = 0; i <= n; i++) {
    const ax = x0 + arm / 2 + i * (w + arm);
    p.box('shellPlastic', [ax - arm / 2, 0.36, -0.22], [ax + arm / 2, 0.62, 0.22]);
    p.box('dark', [ax - arm / 2, 0.62, -0.2], [ax + arm / 2, 0.64, 0.2]);
  }
  return width;
}

/** A row's collision: one box to the backrest's top, `inset` short of each end where an aisle runs past (bots keep 0.6 m off it). */
const rowBox = (width, depth, insetL, insetR, h = 1.12) => [[-width / 2 + insetL, 0, -depth / 2, width / 2 - insetR, h, depth / 2]];

const FITTINGS = {
  ac_economy_triple() {
    const p = piece('ac_economy_triple');
    const w = seatRow(p, 3);
    return { p, boxes: rowBox(w, 0.74, 0.2, 0.2) };
  },
  ac_economy_pair() {
    // Window pair: the aisle is at +x as built; turn it 180° for the other side of the cabin (or mirror by rotation).
    const p = piece('ac_economy_pair');
    const w = seatRow(p, 2);
    return { p, boxes: rowBox(w, 0.74, 0.2, 0.2) };
  },
  ac_business_seat() {
    // A business recliner in its own shell: wide leather seat, a side console with a reading light, a footrest.
    const p = piece('ac_business_seat');
    const [w, d] = [0.82, 1.5];
    p.box('shellPlastic', [-w / 2, 0, -d / 2], [w / 2, 0.06, d / 2]);
    p.box('shellPlastic', [-w / 2, 0.06, -d / 2], [-w / 2 + 0.05, 0.92, d / 2 - 0.5]);
    p.box('shellPlastic', [-w / 2, 0.06, -d / 2], [w / 2, 0.92, -d / 2 + 0.06]);
    p.box('wood', [-w / 2 - 0.005, 0.92, -d / 2 - 0.005], [-w / 2 + 0.055, 0.96, d / 2 - 0.5]);
    p.box('wood', [-w / 2 - 0.005, 0.92, -d / 2 - 0.005], [w / 2 + 0.005, 0.96, -d / 2 + 0.065]);
    p.box('console', [w / 2 - 0.2, 0.06, -d / 2 + 0.06], [w / 2, 0.68, d / 2 - 0.3]);
    p.box('wood', [w / 2 - 0.2, 0.68, -d / 2 + 0.06], [w / 2, 0.7, d / 2 - 0.3]);
    p.box('screen', [w / 2 - 0.15, 0.71, -0.1], [w / 2 - 0.05, 0.72, 0.05]);
    obox(p, 'leather', [-0.11, 0.47, 0.0], [0.5, 0.14, 0.62]);
    obox(p, 'leather', [-0.11, 0.86, -d / 2 + 0.22], [0.5, 0.74, 0.16], { rx: -0.2 });
    obox(p, 'headrest', [-0.11, 1.17, -d / 2 + 0.17], [0.42, 0.16, 0.12], { rx: -0.2 });
    for (const x of [-0.39, 0.17]) p.box('leather', [x - 0.03, 0.36, -0.35], [x + 0.03, 0.62, 0.3]);
    obox(p, 'leather', [-0.11, 0.3, 0.52], [0.44, 0.08, 0.36], { rx: 0.35 });
    p.box('metal', [-0.3, 0.06, -0.2], [0.08, 0.36, 0.2]);
    return { p, boxes: [[-w / 2 + 0.06, 0, -d / 2, w / 2 - 0.06, 1.12, d / 2 - 0.25]] };
  },
  ac_cockpit_seat() {
    // A pilot's seat: high back with a sheepskin-grey cover, armrests, on a rail.
    const p = piece('ac_cockpit_seat');
    p.box('metal', [-0.25, 0, -0.35], [0.25, 0.05, 0.35]);
    p.box('dark', [-0.08, 0.05, -0.1], [0.08, 0.36, 0.1]);
    obox(p, 'leather', [0, 0.46, 0.04], [0.52, 0.14, 0.52]);
    obox(p, 'leather', [0, 0.92, -0.24], [0.52, 0.86, 0.14], { rx: -0.12 });
    obox(p, 'headrest', [0, 1.3, -0.27], [0.36, 0.2, 0.14], { rx: -0.12 });
    for (const x of [-0.3, 0.3]) p.box('console', [x - 0.04, 0.6, -0.2], [x + 0.04, 0.66, 0.2]);
    return { p, boxes: [[-0.3, 0, -0.35, 0.3, 1.1, 0.3]] };
  },
  ac_overhead_bins() {
    return bins('ac_overhead_bins', S4);
  },
  ac_overhead_bins_short() {
    return bins('ac_overhead_bins_short', S2);
  },
  ac_galley() {
    // A galley block across the cabin's middle: trolley bays, ovens, a worktop and a coffee maker, stainless steel.
    const p = piece('ac_galley');
    const [w, d, h] = [2.0, 0.9, 2.1];
    p.box('steel', [-w / 2, 0, -d / 2], [w / 2, 0.04, d / 2]);
    for (let i = 0; i < 4; i++) {
      const x = -w / 2 + 0.02 + i * 0.5;
      p.box('steel', [x, 0.04, -d / 2], [x + 0.46, 1.02, d / 2 - 0.04]);
      p.box('dark', [x + 0.03, 0.1, d / 2 - 0.045], [x + 0.43, 0.98, d / 2 - 0.035]);
      p.box('metal', [x + 0.18, 0.6, d / 2 - 0.035], [x + 0.28, 0.64, d / 2 - 0.01]);
    }
    p.box('steel', [-w / 2, 1.02, -d / 2], [w / 2, 1.06, d / 2]);
    p.box('steel', [-w / 2, 1.06, -d / 2], [w / 2, h, -d / 2 + 0.35]);
    for (let i = 0; i < 4; i++) {
      const x = -w / 2 + 0.05 + i * 0.5;
      p.box('dark', [x, 1.3, -d / 2 + 0.35], [x + 0.4, 1.62, -d / 2 + 0.36]);
      p.box('screenAmber', [x + 0.3, 1.66, -d / 2 + 0.35], [x + 0.38, 1.7, -d / 2 + 0.365]);
      p.box('steel', [x, 1.75, -d / 2 + 0.35], [x + 0.4, 2.05, -d / 2 + 0.36]);
    }
    p.cylinder('dark', [0.6, 1.06, -0.05], 0.09, 0, 0.3, { seg: 10 });
    p.box('light', [-w / 2, h - 0.02, -d / 2 + 0.35], [w / 2, h, -d / 2 + 0.4]);
    return { p, boxes: [[-w / 2, 0, -d / 2, w / 2, 1.06, d / 2], [-w / 2, 1.06, -d / 2, w / 2, h, -d / 2 + 0.35]] };
  },
  ac_lavatory() {
    // A lavatory module: laminate walls, a folding door (shut) with its occupied sign, a light over the door.
    const p = piece('ac_lavatory');
    const [w, d, h] = [1.0, 1.0, 2.1];
    p.box('panel', [-w / 2, 0, -d / 2], [w / 2, h, d / 2 - 0.04]);
    p.box('trim', [-w / 2 + 0.12, 0.02, d / 2 - 0.04], [w / 2 - 0.12, 1.95, d / 2 - 0.02]);
    p.box('panelLow', [-w / 2 + 0.16, 0.06, d / 2 - 0.02], [w / 2 - 0.16, 1.9, d / 2]);
    p.box('trim', [-0.01, 0.06, d / 2], [0.01, 1.9, d / 2 + 0.005]);
    p.box('metal', [0.18, 0.95, d / 2], [0.26, 1.0, d / 2 + 0.03]);
    p.box('sign', [0.1, 1.2, d / 2], [0.3, 1.28, d / 2 + 0.01]);
    p.box('light', [-0.25, 2.0, d / 2 - 0.04], [0.25, 2.05, d / 2 - 0.02]);
    p.box('trim', [-w / 2, h - 0.04, -d / 2], [w / 2, h, d / 2]);
    return { p, boxes: [[-w / 2, 0, -d / 2, w / 2, h, d / 2]] };
  },
  ac_partition() {
    // A class divider: a low cabinet wall with a curtain rail and the curtain drawn back to the sides.
    const p = piece('ac_partition');
    const w = 1.5;
    p.box('panel', [-w / 2, 0, -0.06], [w / 2, 1.2, 0.06]);
    p.box('wood', [-w / 2, 1.2, -0.08], [w / 2, 1.24, 0.08]);
    p.box('trim', [-w / 2, 0, -0.065], [w / 2, 0.1, 0.065]);
    p.box('screen', [-0.3, 0.75, 0.06], [0.3, 1.05, 0.065]);
    return { p, boxes: [[-w / 2, 0, -0.08, w / 2, 1.24, 0.08]] };
  },
  ac_boarding_stairs() {
    // A boarding stair truck up to the cabin floor (6.79 m): 27 steps of 0.25 m, a railed platform at the top,
    // the truck's cab and chassis under the flight. Steps climb toward +Z (the platform's open end meets the door).
    const p = piece('ac_boarding_stairs');
    const n = 27;
    const rise = FLOOR / n;
    const run = 0.45;
    const w = 1.6;
    const flight = n * run;
    const z0 = -flight / 2 - 0.8;
    const boxes = [];
    for (let i = 0; i < n; i++) {
      const y = (i + 1) * rise;
      const z = z0 + i * run;
      p.box('metal', [-w / 2, y - 0.06, z], [w / 2, y, z + run]);
      p.box('yellow', [-w / 2, y - 0.005, z + run - 0.05], [w / 2, y + 0.004, z + run]);
      boxes.push([-w / 2, 0, z, w / 2, y, z + run]);
    }
    const top = n * rise;
    const zt = z0 + flight;
    p.box('metal', [-w / 2, top - 0.15, zt], [w / 2, top, zt + 1.6]);
    boxes.push([-w / 2, 0, zt, w / 2, top, zt + 1.6]);
    // Stringers and rails.
    for (const s of [-1, 1]) {
      const x = s * (w / 2 + 0.03);
      const len = Math.hypot(flight, top);
      const ang = Math.atan2(top, flight);
      obox(p, 'white', [x, top / 2 + 0.2, z0 + flight / 2], [0.06, 0.3, len - 0.8], { rx: -ang });
      obox(p, 'metal', [x, top / 2 + 0.95, z0 + flight / 2], [0.05, 0.05, len], { rx: -ang });
      for (let i = 0; i <= n; i += 3) p.box('metal', [x - 0.02, (i + 1) * rise, z0 + i * run + 0.2], [x + 0.02, (i + 1) * rise + 0.95, z0 + i * run + 0.24]);
      p.box('metal', [x - 0.025, top + 0.95, zt], [x + 0.025, top + 1.0, zt + 1.6]);
      for (const z of [zt, zt + 0.8]) p.box('metal', [x - 0.02, top, z], [x + 0.02, top + 0.95, z + 0.04]);
      boxes.push(s > 0 ? [w / 2, top, zt, w / 2 + 0.08, top + 1.0, zt + 1.6] : [-w / 2 - 0.08, top, zt, -w / 2, top + 1.0, zt + 1.6]);
    }
    // Chassis, cab and wheels under the flight.
    p.box('white', [-1.1, 0.5, z0 - 0.6], [1.1, 0.9, zt + 1.2]);
    p.box('white', [-1.1, 0.9, z0 - 0.6], [1.1, 2.6, z0 + 1.4]);
    p.box('glass', [-1.0, 1.7, z0 - 0.62], [1.0, 2.4, z0 - 0.58]);
    p.box('yellow', [-1.12, 0.6, z0 - 0.62], [1.12, 0.75, zt + 1.22]);
    for (const z of [z0 + 0.4, zt - 1.0]) for (const s of [-1, 1]) p.cylinder('rubber', [s * 0.95, 0.42, z], 0.42, -0.14, 0.14, { seg: 14, axis: 'x' });
    boxes.push([-1.1, 0, z0 - 0.6, 1.1, 2.6, z0 + 1.4]);
    return { p, boxes };
  },
};

/** Overhead bins over a `len` m section: a row along each side (doors shut, a grey latch strip, a reading-light panel under), a centre row over the middle seats. */
function bins(name, len) {
  const p = piece(name);
  const ring = PROFILE.constant;
  const y0 = FLOOR + 1.95;
  const boxes = [];
  for (const s of [-1, 1]) {
    const xi = s * 1.9;
    const xw = s * (insideHalf(ring, y0) - 0.01);
    const xc = s * (insideHalf(ring, CEIL - 0.02) - 0.01);
    // Bin door (sloping face), underside, the wall-side panel behind them.
    toward(p, 'white', [[xi, y0, len / 2], [xi, y0, -len / 2], [xi + s * 0.12, CEIL, -len / 2], [xi + s * 0.12, CEIL, len / 2]], [-s, -0.3, 0]);
    toward(p, 'panel', [[xi, y0, len / 2], [xw, y0, len / 2], [xw, y0, -len / 2], [xi, y0, -len / 2]], [0, -1, 0]);
    p.box('trim', [Math.min(xi, xi + s * 0.04) - 0.005, y0 + 0.28, -len / 2], [Math.max(xi, xi + s * 0.04) + 0.005, y0 + 0.32, len / 2]);
    for (let z = -len / 2; z < len / 2 - 0.01; z += BAY) {
      p.box('trim', [Math.min(xi, xi + s * 0.13) - 0.006, y0, z - 0.008], [Math.max(xi, xi + s * 0.13) + 0.006, CEIL, z + 0.008]);
      p.box('light', [Math.min(xi, xi + s * 0.25), y0 - 0.006, z + 0.3], [Math.max(xi, xi + s * 0.25), y0, z + 0.4]);
      p.box('dark', [Math.min(xi + s * 0.3, xi + s * 0.42), y0 - 0.006, z + 0.28], [Math.max(xi + s * 0.3, xi + s * 0.42), y0, z + 0.42]);
    }
    boxes.push(s > 0 ? [1.9, y0, -len / 2, Math.abs(xc) + 0.4, CEIL, len / 2] : [-Math.abs(xc) - 0.4, y0, -len / 2, -1.9, CEIL, len / 2]);
    void xc;
  }
  // The centre bins over the middle seats, hung from the ceiling.
  const cw = 0.72;
  p.box('white', [-cw, y0 + 0.05, -len / 2], [cw, CEIL, len / 2]);
  p.box('trim', [-cw - 0.005, y0 + 0.3, -len / 2], [cw + 0.005, y0 + 0.34, len / 2]);
  for (let z = -len / 2; z < len / 2 - 0.01; z += BAY) {
    p.box('trim', [-cw - 0.006, y0 + 0.05, z - 0.008], [cw + 0.006, CEIL, z + 0.008]);
    p.box('light', [-0.3, y0 + 0.044, z + 0.3], [0.3, y0 + 0.05, z + 0.4]);
  }
  boxes.push([-cw, y0 + 0.05, -len / 2, cw, CEIL, len / 2]);
  // Built in the shell frame (y from the ground): stand it on the floor for the palette.
  for (const part of p.parts.values()) for (let i = 1; i < part.pos.length; i += 3) part.pos[i] -= y0;
  return { p, boxes: boxes.map(([a, b, c, d, e, f]) => [a, b - y0, c, d, e - y0, f]) };
}

// ---------------------------------------------------------------- sections

const opening = (side, z, y) => ({ side, z, y });
const both = (z, y) => [opening(1, z, y), opening(-1, z, y)];

const SECTIONS = {
  ac_section_straight() {
    const p = piece('ac_section_straight');
    const boxes = fuselage(p, { z0: S4 / 2, z1: -S4 / 2, straight: true });
    return { p, boxes, at: { z0: S4 / 2, z1: -S4 / 2 } };
  },
  ac_section_short() {
    const p = piece('ac_section_short');
    const boxes = fuselage(p, { z0: S2 / 2, z1: -S2 / 2, straight: true });
    return { p, boxes, at: { z0: S2 / 2, z1: -S2 / 2 } };
  },
  ac_section_door() {
    // A door each side, centred: the shell's L2 and R2.
    const p = piece('ac_section_door');
    const boxes = fuselage(p, { z0: S4 / 2, z1: -S4 / 2, straight: true, openings: both([DOOR_W / 2, -DOOR_W / 2], DOOR) });
    return { p, boxes, at: { z0: S4 / 2, z1: -S4 / 2 } };
  },
  ac_section_wing() {
    // Over the wing root: an exit each side onto the wing, centred, up a 0.25 m sill.
    const p = piece('ac_section_wing');
    const boxes = fuselage(p, { z0: S4 / 2, z1: -S4 / 2, straight: true, openings: both([EXIT_W / 2, -EXIT_W / 2], EXIT) });
    const sill = EXIT[0];
    for (const s of [1, -1]) boxes.push(s > 0 ? [insideHalf(PROFILE.constant, sill) - 0.53, FLOOR, -EXIT_W / 2, 3.2, sill, EXIT_W / 2] : [-3.2, FLOOR, -EXIT_W / 2, -insideHalf(PROFILE.constant, sill) + 0.53, sill, EXIT_W / 2]);
    return { p, boxes, at: { z0: S4 / 2, z1: -S4 / 2 } };
  },
  ac_section_nose() {
    // The nose: the flight deck behind the windscreen (instrument panel, glareshield, centre pedestal, overhead
    // panel; the pilots' seats are fittings), its bulkhead with an open doorway, a forward galley and lavatory, and
    // the L1/R1 doors with the cross aisle between them.
    const p = piece('ac_section_nose');
    const z0 = NOSE_END;
    const z1 = NOSE_JOINT;
    const boxes = fuselage(p, { z0, z1, straight: false, openings: both(L1, DOOR), capFront: true, glass: { z: [33.5, 29.6], y: FLOOR + 1.22 }, deck: 28.3 });
    const ring = (z) => shellRing(z, false);
    const half = (z, y) => insideHalf(ring(z), y);
    // Instrument panel and glareshield across the nose, screens on it.
    const zp = 31.2;
    const hp = half(zp, FLOOR + 1.1) - 0.02;
    p.box('console', [-hp, FLOOR, zp], [hp, FLOOR + 1.1, zp + 0.5]);
    p.box('dark', [-hp, FLOOR + 1.1, zp - 0.15], [hp, FLOOR + 1.22, zp + 0.4]);
    for (const x of [-1.05, -0.55, 0.0, 0.55, 1.05]) p.box(x === 0 ? 'screenAmber' : 'screen', [x - 0.2, FLOOR + 0.62, zp - 0.005], [x + 0.2, FLOOR + 0.98, zp]);
    // Centre pedestal with throttles.
    p.box('console', [-0.3, FLOOR, zp - 1.3], [0.3, FLOOR + 0.75, zp]);
    p.box('screen', [-0.2, FLOOR + 0.75, zp - 0.5], [0.2, FLOOR + 0.76, zp - 0.15]);
    for (const x of [-0.08, 0.08]) obox(p, 'metal', [x, FLOOR + 0.86, zp - 0.75], [0.05, 0.22, 0.05], { rx: 0.3 });
    // Side consoles under the side windows.
    for (const s of [-1, 1]) {
      const hx = half(zp - 1.2, FLOOR + 0.7);
      p.box('console', [s > 0 ? hx - 0.35 : -hx, FLOOR, zp - 1.9], [s > 0 ? hx : -hx + 0.35, FLOOR + 0.7, zp - 0.2]);
    }
    // Overhead panel.
    const zo = 30.0;
    const yo = Math.min(CEIL, ring(zo).cy + radiusAt(ring(zo), Math.PI / 2) - SKIN - WALL) - 0.02;
    p.box('console', [-0.45, yo - 0.12, zo - 0.6], [0.45, yo, zo + 0.6]);
    for (let i = 0; i < 6; i++) p.box(i % 2 ? 'screenAmber' : 'sign', [-0.38 + i * 0.13, yo - 0.125, zo - 0.4], [-0.3 + i * 0.13, yo - 0.12, zo - 0.35]);
    // Flight deck bulkhead with a doorway (0.9 m wide, 2.05 m high) in the middle.
    const zb = 28.3;
    const hb = half(zb, FLOOR + 1.0);
    const tb = Math.min(CEIL, ring(zb).cy + radiusAt(ring(zb), Math.PI / 2) - SKIN - WALL);
    p.box('panel', [-hb, FLOOR, zb - 0.08], [-0.45, tb, zb + 0.08]);
    p.box('panel', [0.45, FLOOR, zb - 0.08], [hb, tb, zb + 0.08]);
    p.box('panel', [-0.45, FLOOR + 2.05, zb - 0.08], [0.45, tb, zb + 0.08]);
    p.box('trim', [-0.5, FLOOR, zb - 0.09], [-0.45, FLOOR + 2.1, zb + 0.09]);
    p.box('trim', [0.45, FLOOR, zb - 0.09], [0.5, FLOOR + 2.1, zb + 0.09]);
    p.box('trim', [-0.5, FLOOR + 2.05, zb - 0.09], [0.5, FLOOR + 2.1, zb + 0.09]);
    boxes.push([-hb - 0.1, FLOOR, zb - 0.08, -0.45, tb, zb + 0.08], [0.45, FLOOR, zb - 0.08, hb + 0.1, tb, zb + 0.08], [-0.45, FLOOR + 2.05, zb - 0.08, 0.45, tb, zb + 0.08]);
    boxes.push([-hp, FLOOR, zp, hp, FLOOR + 1.22, zp + 1.2], [-0.3, FLOOR, zp - 1.3, 0.3, FLOOR + 0.75, zp]);
    // Forward galley (right) and lavatory (left) between the bulkhead and the doors.
    const zg = 26.85;
    const hg = half(zg, FLOOR + 1.0);
    p.box('steel', [0.6, FLOOR, zg - 0.6], [hg, FLOOR + 1.02, zg + 0.6]);
    p.box('steel', [0.6, FLOOR + 1.02, zg + 0.25], [hg, FLOOR + 2.1, zg + 0.6]);
    for (let i = 0; i < 3; i++) p.box('dark', [0.7 + i * 0.5, FLOOR + 0.08, zg - 0.605], [1.1 + i * 0.5, FLOOR + 0.95, zg - 0.6]);
    p.box('panel', [-hg, FLOOR, zg - 0.6], [-0.6, FLOOR + 2.1, zg + 0.6]);
    p.box('panelLow', [-1.3, FLOOR + 0.06, zg - 0.62], [-0.7, FLOOR + 1.9, zg - 0.6]);
    p.box('sign', [-1.1, FLOOR + 1.3, zg - 0.625], [-0.9, FLOOR + 1.38, zg - 0.62]);
    boxes.push([0.6, FLOOR, zg - 0.6, hg + 0.1, FLOOR + 2.1, zg + 0.6], [-hg - 0.1, FLOOR, zg - 0.6, -0.6, FLOOR + 2.1, zg + 0.6]);
    return { p, boxes, at: { z0, z1 } };
  },
  ac_section_tail() {
    // The tail: where the body narrows, a last few seat rows' worth of cabin, the rear doors, the aft galley across
    // the cabin, two lavatories and the pressure bulkhead closing it.
    const p = piece('ac_section_tail');
    const z0 = TAIL_JOINT;
    const z1 = TAIL_END;
    const boxes = fuselage(p, { z0, z1, straight: false, openings: both(REAR, DOOR), capAft: true });
    const half = (z, y) => insideHalf(shellRing(z, false), y);
    // Aft galley across the middle, behind the rear doors.
    const zg = -24.3;
    const hg = half(zg, FLOOR + 1.0);
    p.box('steel', [-hg, FLOOR, zg - 0.5], [hg, FLOOR + 1.02, zg + 0.4]);
    p.box('steel', [-hg, FLOOR + 1.02, zg - 0.5], [hg, FLOOR + 2.1, zg - 0.15]);
    for (let i = 0; i < 6; i++) p.box('dark', [-1.5 + i * 0.5, FLOOR + 0.08, zg + 0.4], [-1.1 + i * 0.5, FLOOR + 0.95, zg + 0.405]);
    for (let i = 0; i < 4; i++) p.box('screenAmber', [-1.0 + i * 0.5, FLOOR + 1.6, zg - 0.15], [-0.9 + i * 0.5, FLOOR + 1.64, zg - 0.145]);
    // The pressure bulkhead behind it.
    const tb = shellRing(z1, false);
    const hb = insideHalf(tb, FLOOR + 1.2);
    const topb = Math.min(CEIL, tb.cy + radiusAt(tb, Math.PI / 2) - SKIN - WALL);
    p.box('panel', [-hb, FLOOR, z1], [hb, topb, z1 + 0.06]);
    boxes.push([-hg - 0.1, FLOOR, zg - 0.5, hg + 0.1, FLOOR + 1.02, zg + 0.4], [-hg - 0.1, FLOOR + 1.02, zg - 0.5, hg + 0.1, FLOOR + 2.1, zg - 0.15], [-hb - 0.2, FLOOR, z1, hb + 0.2, topb, z1 + 0.06]);
    // Lavatories ahead of the rear doors, against each side.
    const zl = -20.6;
    for (const s of [-1, 1]) {
      const hl = half(zl, FLOOR + 1.0);
      const [xa, xb] = s > 0 ? [hl - 1.0, hl] : [-hl, -hl + 1.0];
      p.box('panel', [xa, FLOOR, zl - 0.5], [xb, FLOOR + 2.1, zl + 0.5]);
      p.box('panelLow', [s > 0 ? xa - 0.02 : xb, FLOOR + 0.06, zl - 0.35], [s > 0 ? xa : xb + 0.02, FLOOR + 1.9, zl + 0.35]);
      p.box('sign', [s > 0 ? xa - 0.025 : xb, FLOOR + 1.3, zl - 0.1], [s > 0 ? xa - 0.02 : xb + 0.025, FLOOR + 1.38, zl + 0.1]);
      boxes.push([xa, FLOOR, zl - 0.5, s > 0 ? xb + 0.1 : xb, FLOOR + 2.1, zl + 0.5].map((v, i) => (i === 0 && s < 0 ? v - 0.1 : v)));
    }
    return { p, boxes, at: { z0, z1 } };
  },
};

// ---------------------------------------------------------------- build

const assembly = { $comment: 'Where each section sits when the airliner shell stands at the origin, yaw 0 (written by tools/content/prepare-cabin.mjs): the position to give the prop (its footprint centre, its bottom).', floor: FLOOR, sections: {} };
for (const [id, make] of Object.entries({ ...SECTIONS, ...FITTINGS })) {
  const { p, boxes } = make();
  const doc = piecesDocument([p], 'tiletrigger prepare-cabin');
  // The collision boxes ride along in the node's extras, in the frame the piece was modelled in; prepare-props
  // normalises them with the model (collide: "model"). glTF x is the game's mirrored, so mirror them here.
  const node = doc.getRoot().listNodes()[0];
  node.setExtras({ collision: boxes.map(([x0, y0, z0, x1, y1, z1]) => [-x1, y0, z0, -x0, y1, z1].map((v) => Math.round(v * 1000) / 1000)) });
  await doc.transform(dedup(), prune());
  writeFileSync(join(SRC, `${id}.glb`), Buffer.from(await io.writeBinary(doc)));
  const all = [...p.parts.values()].flatMap((q) => q.pos);
  const ax = (k) => all.filter((_, i) => i % 3 === k);
  const [lo, hi] = [[0, 1, 2].map((k) => Math.min(...ax(k))), [0, 1, 2].map((k) => Math.max(...ax(k)))];
  const tris = [...p.parts.values()].reduce((s, q) => s + q.idx.length / 3, 0);
  if (id in SECTIONS) assembly.sections[id] = { centre: [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2].map((v) => Math.round(v * 1000) / 1000), length: Math.round((hi[2] - lo[2]) * 1000) / 1000 };
  console.log(id, 'size', [0, 1, 2].map((k) => (hi[k] - lo[k]).toFixed(3)).join(' x '), 'minY', lo[1].toFixed(3), 'tris', tris, 'boxes', boxes.length);
}
writeFileSync(join(SRC, 'assembly.json'), `${JSON.stringify(assembly, null, 2)}\n`);
console.log(`wrote ${Object.keys(SECTIONS).length + Object.keys(FITTINGS).length} prop sources to assets-src/tiletrigger-cabin`);
