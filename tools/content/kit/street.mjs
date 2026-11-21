// Street furniture (kit-prop families of Tileset 11, Urban & Civilian: docs/map-briefs/urban/URBAN_PLAN.md steps B6
// and C3 to C6): a striped shop awning (`awning`), a street bollard (`bollard`), a bike rack of hoops (`bikerack`), a
// street mailbox (`mailbox`), a newspaper box (`newsbox`), a cable spool (`spool`) and a bus stop sign (`busstop`). All generated here from seeds:
// nothing downloaded, nothing drawn from a photograph. Each fills its bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2].
//
// Sizes are for the game's scale (a player stands about 1.8 m): the bollard is knee-to-hip cover for nobody and
// stops a vehicle, the mailbox and the newspaper box are crouch cover, the spool on its rims (1.4 m) is standing
// cover. The bollard, the mailbox, the newspaper box and the spool collide as their boxes. The bike rack collides
// as its hoops only (a generator's `boxes`: tools/content/kitprops.mjs), so shots and sight pass between them, as
// they do through the Rail Fence. The awning has no collision (its family says `collide: "none"`): it hangs on a
// wall over a shop window, as the game's other awnings do; its back (−z) goes against the wall, its foot is the
// valance's hem.
//
// No marks: the mailbox and the newspaper box carry no postal service's or publisher's name, sign or colours scheme
// (plain paint, a blank plate, a blank sheet behind the window); the bus stop sign is a plain picture of a bus, with
// no words, no route number and no operator's mark or livery. Nothing glows or blinks (CLAUDE.md, "Accessibility").
//
// Level 1 keeps the outline with far fewer triangles; level 2 is a stand-in of a few faces.

import { rng } from '../env/rng.mjs';
import { noise3 } from '../env/noise.mjs';
import { Mesh, bar, box, clamp01, cyl, disc, groundShade, hex, lathe, mix3, quadN, scale3, standIn, triN } from './geom.mjs';
import { lerp, onX, onZ, round, tone } from './machines.mjs';

const DARK = '#17191b';

/** Paint over steel: chipped to bare metal and rusted where the seeded noise is high, darker towards the ground. */
function painted(seed, c, look, shader = tone) {
  const chipN = noise3(seed + 11);
  const rustN = noise3(seed + 29);
  const steel = hex('#7c7f82');
  const rust = hex(look.rustColour ?? '#6a3a20');
  const wear = look.wear ?? 0.2;
  const rusty = look.rust ?? 0.15;
  const lit = shader([1, 1, 1], look.grime ?? 0.25);
  return (p, n) => {
    let col = mix3(c, steel, clamp01((chipN(p[0] * 13, p[1] * 13, p[2] * 13) * 0.5 + 0.5 - (1 - wear * 0.6)) * 5));
    col = mix3(col, rust, clamp01((rustN(p[0] * 5, p[1] * 6, p[2] * 5) * 0.5 + 0.5 - (1 - rusty)) * 3 + (p[1] < 0.1 ? rusty * 0.7 : 0)));
    return scale3(col, lit(p, n)[0]);
  };
}

// ---------------------------------------------------------------- the street bollard

/**
 * A street bollard: a round post on a base flange. Settings `g`: `top` ('dome' or 'flat'), `bands` (painted bands
 * round the upper post, 0–3), `post` (the post's radius as a share of the half width). `look`: `body`, `band`,
 * `base` (the flange), `grime`, `wear`, `rust`.
 */
export function bollardMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const R = w / 2;
  const bodyC = hex(look.body);
  const bandC = hex(look.band ?? '#e8e6de');
  const baseC = hex(look.base ?? look.body);
  const rp = R * (g.post ?? 0.74);
  if (level >= 2) {
    const m = new Mesh();
    box(m, [-rp * 0.8, 0, -rp * 0.8], [rp * 0.8, h, rp * 0.8], (p, n) => scale3(bodyC, n[1] > 0.5 ? 1 : groundShade(p[1], 0.3, 0.75)), ['ny']);
    return m;
  }
  const m = new Mesh();
  const fine = level === 0;
  const S = fine ? 12 : 8;
  const body = painted(seed, bodyC, look, round);
  const band = painted(seed + 1, bandC, look, round);
  const base = painted(seed + 2, scale3(baseC, 0.8), look, round);
  // The flange (the full width: the piece fills its bounds), then the post, banded, then its top.
  const prof = [[R, 0], [R, 0.022], [rp, 0.03]];
  const rows = ['base', 'base'];
  const nb = Math.max(0, Math.min(3, g.bands ?? 0));
  const flat = (g.top ?? 'dome') === 'flat';
  const shoulder = flat ? h - 0.03 : h - rp * 0.7;
  let y = shoulder - 0.06 - nb * 0.2 + (nb ? 0.1 : 0);
  for (let k = 0; k < nb; k++) {
    prof.push([rp, y], [rp, y + 0.1]);
    rows.push('body', 'band');
    y += 0.2;
  }
  prof.push([rp, shoulder]);
  rows.push('body');
  if (flat) {
    prof.push([rp * 0.86, h]);
    rows.push('body');
  } else {
    const steps = fine ? 4 : 2;
    for (let k = 1; k <= steps; k++) {
      const a = (k / steps) * (Math.PI / 2) * 0.92;
      prof.push([rp * Math.cos(a), shoulder + (h - shoulder) * Math.sin(a) / Math.sin((Math.PI / 2) * 0.92)]);
      rows.push('body');
    }
  }
  const creases = prof.map((_, i) => i).filter((i) => i <= 3 + nb * 2);
  lathe(m, prof, S, (p, n, row) => (rows[row] === 'band' ? band(p, n) : rows[row] === 'base' ? base(p, n) : body(p, n)), { hard: creases });
  disc(m, prof[prof.length - 1][0], h, S, (p) => scale3(body(p, [0, 1, 0]), 1.04));
  return m;
}

// ---------------------------------------------------------------- the bike rack

/**
 * A bike rack: `hoops` steel hoops standing across the piece (each in a z–y plane), bolted to two flat rails on the
 * ground. Settings `g`: `hoops` (how many), `tube` (the tube's width, m), `bend` (the corner radius, m). `look`:
 * `body`, `rail`, `grime`, `wear`, `rust`. It collides as its hoops (two legs and a top bar each): the family's own
 * boxes, the same for every look, so nothing here that collides is drawn from the seed.
 */
export function bikeRackMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const n = Math.max(2, g.hoops ?? 3);
  const t = g.tube ?? 0.05;
  const bend = Math.min(g.bend ?? 0.16, Z - t, h / 2);
  const m = new Mesh();
  const xs = Array.from({ length: n }, (_, i) => lerp(-X + t / 2, X - t / 2, i / (n - 1)));
  // Solid: each hoop's two legs and its top bar. Open: between the hoops, and under each one.
  m.boxes = [];
  for (const x of xs) {
    m.boxes.push([x - t / 2, 0, -Z, x + t / 2, h, -Z + t], [x - t / 2, 0, Z - t, x + t / 2, h, Z], [x - t / 2, h - t, -Z + t, x + t / 2, h, Z - t]);
  }
  const body = painted(seed, hex(look.body), look);
  const rail = painted(seed + 5, hex(look.rail ?? look.body), look);
  const arc = level === 0 ? 4 : level === 1 ? 1 : 0;
  for (const x of xs) {
    // The hoop's centre line: up one leg, round the bend, across, round and down.
    const zc = Z - t / 2;
    const yc = h - t / 2;
    const pts = [[x, 0, -zc]];
    if (arc === 0) pts.push([x, yc, -zc], [x, yc, zc]);
    else {
      for (const s of [-1, 1]) {
        for (let k = 0; k <= arc; k++) {
          const a = (k / arc) * (Math.PI / 2);
          const [ca, sa] = s < 0 ? [Math.cos(a), Math.sin(a)] : [Math.sin(a), Math.cos(a)];
          pts.push([x, yc - bend + sa * bend, s * (zc - bend + ca * bend)]);
        }
      }
    }
    pts.push([x, 0, zc]);
    for (let k = 0; k + 1 < pts.length; k++) bar(m, pts[k], pts[k + 1], t, body, { up: [1, 0, 0] });
  }
  // The ground rails (drawn only: 3 cm high, nothing to stop a foot or a round).
  if (level < 2) for (const s of [-1, 1]) box(m, [-X, 0, Math.min(s * Z, s * (Z - 0.07))], [X, 0.03, Math.max(s * Z, s * (Z - 0.07))], rail, ['ny']);
  return m;
}

// ---------------------------------------------------------------- the bus stop sign

/**
 * A bus stop sign: a round pole on a base plate at the piece's west side (−x), a flag sign at its top reaching east
 * (a plate in the x–y plane, read from both sides, ±z) with a plain picture of a bus, and a timetable case lower on
 * the pole with a blank sheet. No words, no route number, no operator's mark. Settings `g`: `flag` (the plate's
 * height, m), `shape` ('square', or 'round' for a disc), `case` (false for no timetable case). `look`: `pole`,
 * `plate`, `picture`, `rim`, `paper`, `grime`, `wear`, `rust`. It collides as its pole and its flag only (the
 * family's own boxes, the same for every look), so a player walks under the flag and shots pass beside the pole.
 */
export function busStopMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const pr = 0.03;
  const px = -X + Z;
  const fh = g.flag ?? 0.5;
  const ft = 0.012;
  const [fx0, fx1, fy0, fy1] = [px + pr, X, h - 0.06 - fh, h - 0.06];
  const m = new Mesh();
  // Solid: the pole and the flag. Open: under the flag, and all round the pole.
  m.boxes = [[px - pr, 0, -pr, px + pr, h, pr], [fx0, fy0, -ft, fx1, fy1, ft]];
  const poleC = hex(look.pole ?? '#8f9498');
  const plateC = hex(look.plate);
  const pictC = hex(look.picture ?? '#f2f0e8');
  const rimC = hex(look.rim ?? look.picture ?? '#f2f0e8');
  if (level >= 2) {
    box(m, [px - pr, 0, -pr], [px + pr, h, pr], (p) => scale3(poleC, groundShade(p[1], 0.3, 0.75)), ['ny']);
    box(m, [fx0, fy0, -ft], [fx1, fy1, ft], scale3(plateC, 0.9), []);
    return m;
  }
  const fine = level === 0;
  const pole = painted(seed, poleC, look, round);
  const plate = painted(seed + 7, plateC, { ...look, wear: (look.wear ?? 0.2) * 0.5 });
  // The base plate out to the bounds in z, the pole, its cap.
  box(m, [px - Z, 0, -Z], [px + Z, 0.02, Z], painted(seed + 3, scale3(poleC, 0.8), look), ['ny']);
  cyl(m, 1, 0, px, 0.02, h - 0.02, pr, fine ? 8 : 4, pole);
  box(m, [px - pr, h - 0.02, -pr], [px + pr, h, pr], scale3(poleC, 0.85), ['ny']);
  // The flag, and two clamps holding it to the pole.
  box(m, [fx0, fy0, -ft], [fx1, fy1, ft], plate, []);
  if (fine) for (const y of [fy0 + 0.08, fy1 - 0.08]) box(m, [px - pr - 0.008, y - 0.02, -pr - 0.008], [fx0 + 0.03, y + 0.02, pr + 0.008], scale3(poleC, 0.7), []);
  // The picture, the same on both faces: a rim, and a bus seen from its side (body, a band of windows, a door, two wheels).
  const fw = fx1 - fx0;
  const cx = (fx0 + fx1) / 2;
  const cy = (fy0 + fy1) / 2;
  const u = Math.min(fw, fh);
  for (const s of [-1, 1]) {
    const z = s * ft;
    const q = (x0, y0, x1, y1, c) => onZ(m, cx + x0 * u, cy + y0 * u, cx + x1 * u, cy + y1 * u, z, s, c);
    if (fine) {
      const e = 0.035;
      q(-fw / u / 2 + e, fh / u / 2 - 2 * e, fw / u / 2 - e, fh / u / 2 - e, rimC);
      q(-fw / u / 2 + e, -fh / u / 2 + e, fw / u / 2 - e, -fh / u / 2 + 2 * e, rimC);
      q(-fw / u / 2 + e, -fh / u / 2 + 2 * e, -fw / u / 2 + 2 * e, fh / u / 2 - 2 * e, rimC);
      q(fw / u / 2 - 2 * e, -fh / u / 2 + 2 * e, fw / u / 2 - e, fh / u / 2 - 2 * e, rimC);
    }
    // Body (its roof a little narrower), then what is cut out of it in the plate's colour.
    q(-0.34, -0.14, 0.34, 0.16, pictC);
    q(-0.31, 0.16, 0.31, 0.2, pictC);
    if (fine) {
      for (const x of [-0.29, -0.13, 0.03]) q(x, 0.02, x + 0.13, 0.13, plateC);
      q(0.2, -0.1, 0.3, 0.13, plateC);
      q(-0.34, -0.05, 0.17, -0.03, plateC);
    }
    for (const x of [-0.2, 0.18]) {
      q(x - 0.06, -0.21, x + 0.06, -0.09, pictC);
      if (fine) q(x - 0.025, -0.175, x + 0.025, -0.125, plateC);
    }
  }
  // The timetable case: a shallow box on the pole's east side with a blank sheet on both faces.
  if (g.case !== false) {
    const [cx0, cx1, cy0, cy1] = [px + pr, px + pr + 0.3, 1.05, 1.5];
    box(m, [cx0, cy0, -0.02], [cx1, cy1, 0.02], painted(seed + 9, scale3(poleC, 0.75), look), []);
    if (fine) for (const s of [-1, 1]) onZ(m, cx0 + 0.025, cy0 + 0.025, cx1 - 0.025, cy1 - 0.025, s * 0.02, s, scale3(hex(look.paper ?? '#e9e6da'), 0.95));
  }
  return m;
}

// ---------------------------------------------------------------- the street mailbox

/**
 * A street mailbox: a steel box with a rounded top on four short legs, a pull-down door proud of its front (+z), a
 * hinged collection door below it and a blank plate. No service's name, sign or livery: plain paint. Settings `g`:
 * `legs` (their height, m). `look`: `body`, `trim` (the doors' edges and the legs), `plate`, `grime`, `wear`, `rust`.
 */
export function mailboxMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const bodyC = hex(look.body);
  if (level >= 2) return standIn(size, scale3(bodyC, 0.95), scale3(bodyC, 0.8));
  const m = new Mesh();
  const fine = level === 0;
  const body = painted(seed, bodyC, look);
  const trim = painted(seed + 3, hex(look.trim ?? look.body), look);
  const legH = g.legs ?? 0.2;
  // The body stops 3 cm short of the front: the pull-down door stands proud of it, out to the bounds.
  const zf = Z - 0.03;
  const rz = (zf + Z) / 2;
  const zc = (zf - Z) / 2;
  const yc = h - rz;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [x0, x1] = sx < 0 ? [-X + 0.02, -X + 0.07] : [X - 0.07, X - 0.02];
    const [z0, z1] = sz < 0 ? [-Z + 0.02, -Z + 0.07] : [zf - 0.07, zf - 0.02];
    box(m, [x0, 0, z0], [x1, legH, z1], trim, ['ny', 'py']);
  }
  box(m, [-X, legH, -Z], [X, yc, zf], body, ['py']);
  // The rounded top: half a cylinder along x.
  const S = fine ? 8 : 4;
  const at = (x, k) => [x, yc + Math.sin((k / S) * Math.PI) * rz, zc + Math.cos((k / S) * Math.PI) * rz];
  for (let k = 0; k < S; k++) {
    const mid = ((k + 0.5) / S) * Math.PI;
    quadN(m, at(-X, k), at(X, k), at(X, k + 1), at(-X, k + 1), [0, Math.sin(mid), Math.cos(mid)], body);
    for (const sx of [-1, 1]) triN(m, [sx * X, yc, zc], at(sx * X, k), at(sx * X, k + 1), [sx, 0, 0], body);
  }
  // The pull-down door with its handle, out to the front bound.
  box(m, [-X + 0.07, yc - 0.2, zf], [X - 0.07, yc - 0.02, Z - 0.012], trim, ['nz']);
  box(m, [-0.1, yc - 0.15, Z - 0.012], [0.1, yc - 0.12, Z], scale3(hex('#b9bcc0'), 0.9), ['nz']);
  if (fine) {
    // The collection door: a frame of four strips, a lock; a blank plate above it (no words, no sign).
    const [x0, x1, y0, y1] = [-X + 0.07, X - 0.07, legH + 0.08, yc - 0.42];
    const e = 0.022;
    const edge = (p, n) => scale3(trim(p, n), 0.8);
    onZ(m, x0, y0, x1, y0 + e, zf, 1, edge);
    onZ(m, x0, y1 - e, x1, y1, zf, 1, edge);
    onZ(m, x0, y0 + e, x0 + e, y1 - e, zf, 1, edge);
    onZ(m, x1 - e, y0 + e, x1, y1 - e, zf, 1, edge);
    box(m, [x1 - 0.09, (y0 + y1) / 2 - 0.03, zf], [x1 - 0.04, (y0 + y1) / 2 + 0.03, zf + 0.012], scale3(hex('#b9bcc0'), 0.8), ['nz']);
    onZ(m, -0.13, yc - 0.37, 0.13, yc - 0.25, zf, 1, scale3(hex(look.plate ?? '#e4e1d6'), 0.95));
  }
  return m;
}

// ---------------------------------------------------------------- the newspaper box

/**
 * A newspaper box: a steel cabinet on a post and a base plate, a window door on its front (+z) with a blank sheet
 * behind the glass, a pull handle and a coin box. No publisher's name or sign: plain paint, nothing printed on the
 * sheet. Settings `g`: `cabinet` (the height its cabinet starts at, m). `look`: `body`, `trim`, `glass`, `paper`,
 * `grime`, `wear`, `rust`.
 */
export function newsBoxMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const bodyC = hex(look.body);
  const y0 = g.cabinet ?? 0.42;
  const m = new Mesh();
  if (level >= 2) {
    box(m, [-X, y0, -Z], [X, h, Z], (p, n) => scale3(bodyC, n[1] > 0.5 ? 0.95 : 0.8), []);
    box(m, [-0.07, 0, -0.07], [0.07, y0, 0.07], scale3(bodyC, 0.6), ['ny', 'py']);
    return m;
  }
  const fine = level === 0;
  const body = painted(seed, bodyC, look);
  const trim = painted(seed + 3, hex(look.trim ?? '#2a2c30'), look);
  const zf = Z - 0.03;
  // The base plate (the full footprint), the post, the cabinet.
  box(m, [-X, 0, -Z], [X, 0.03, Z], trim, ['ny']);
  box(m, [-0.07, 0.03, -0.07], [0.07, y0, 0.07], trim, ['ny', 'py']);
  box(m, [-X, y0, -Z], [X, h, zf], body);
  // The window door, proud of the front: its frame, the glass, the sheet behind it.
  const [dx0, dx1, dy0, dy1] = [-X + 0.04, X - 0.04, y0 + 0.1, h - 0.16];
  const fr = 0.04;
  box(m, [dx0, dy0, zf], [dx1, dy0 + fr, Z - 0.008], body, ['nz']);
  box(m, [dx0, dy1 - fr, zf], [dx1, dy1, Z - 0.008], body, ['nz']);
  box(m, [dx0, dy0 + fr, zf], [dx0 + fr, dy1 - fr, Z - 0.008], body, ['nz', 'ny', 'py']);
  box(m, [dx1 - fr, dy0 + fr, zf], [dx1, dy1 - fr, Z - 0.008], body, ['nz', 'ny', 'py']);
  const glass = hex(look.glass ?? '#3d5560');
  onZ(m, dx0 + fr, dy0 + fr, dx1 - fr, dy1 - fr, zf, 1, (p) => scale3(glass, 0.75 + 0.3 * clamp01((p[1] - dy0) / (dy1 - dy0))));
  // A blank folded sheet in the window (nothing is printed on it), and a pull handle out to the front bound.
  onZ(m, dx0 + fr + 0.03, dy0 + fr + 0.03, dx1 - fr - 0.03, dy1 - fr - 0.1, zf + 0.002, 1, scale3(hex(look.paper ?? '#d9d6ca'), 0.92));
  box(m, [-0.11, dy1 - fr - 0.005, Z - 0.008], [0.11, dy1 - fr + 0.025, Z], scale3(hex('#b9bcc0'), 0.9), ['nz']);
  if (fine) {
    onZ(m, dx0 + fr + 0.03, dy0 + fr + 0.03 + (dy1 - dy0) * 0.3, dx1 - fr - 0.03, dy0 + fr + 0.036 + (dy1 - dy0) * 0.3, zf + 0.004, 1, scale3(hex(look.paper ?? '#d9d6ca'), 0.7));
    // The coin box on the head, a slot in it; a blank band where a title card would go.
    box(m, [X - 0.17, h - 0.13, zf], [X - 0.05, h - 0.03, Z - 0.006], trim, ['nz']);
    onZ(m, X - 0.125, h - 0.1, X - 0.095, h - 0.06, Z - 0.006, 1, hex(DARK));
    onZ(m, -X + 0.05, h - 0.12, X - 0.2, h - 0.04, zf, 1, (p, n) => scale3(body(p, n), 1.25));
  }
  return m;
}

// ---------------------------------------------------------------- the cable spool

/**
 * A cable spool standing on its rims: two round timber flanges on a drum along x, cable wound on it or bare.
 * Settings `g`: `cable` (the winding's radius as a share of the flange's, 0 for an empty spool), `flange` (a
 * flange's thickness, m), `core` (the bare drum's radius as a share). `look`: `wood`, `cable` (hex), `steel` (the
 * hub plates and bolts), `jitter`, `grime`.
 */
export function spoolMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const X = w / 2;
  const R = h / 2;
  const ft = g.flange ?? 0.07;
  const wood = hex(look.wood);
  const cableC = hex(look.cable ?? '#1b1b1d');
  const wound = (g.cable ?? 0.78) > 0;
  const rc = R * (wound ? g.cable ?? 0.78 : g.core ?? 0.36);
  const m = new Mesh();
  if (level >= 2) {
    const k = R * 0.92;
    for (const s of [-1, 1]) box(m, [s > 0 ? X - ft : -X, R - k, -k], [s > 0 ? X : -X + ft, R + k, k], scale3(wood, 0.8), []);
    box(m, [-X + ft, R - rc * 0.8, -rc * 0.8], [X - ft, R + rc * 0.8, rc * 0.8], scale3(wound ? cableC : wood, 0.8), ['nx', 'px']);
    return m;
  }
  const fine = level === 0;
  const r = rng(seed);
  const n = noise3(seed + 7);
  const grime = look.grime ?? 0.3;
  const tint = 1 + r.jitter(look.jitter ?? 0.06);
  // Timber: darker towards the ground and in blots; the boards' ends on the rim a little paler.
  const timber = (k) => (p, nn) => scale3(wood, k * tint * groundShade(p[1], 0.25, 1 - grime * 0.4) * (1 - grime * 0.4 * clamp01(n(p[0] * 3, p[1] * 3, p[2] * 3) * 0.5 + 0.2)) * (Math.abs(nn[0]) > 0.5 ? 1 : 0.86));
  const S = fine ? 16 : 8;
  // The flanges: each stops 12 mm short of the bound, where its battens and hub plate stand proud.
  const proud = 0.012;
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [-X + proud, -X + ft] : [X - ft, X - proud];
    cyl(m, 0, R, 0, x0, x1, R, S, timber(1), { caps: '01' });
    // Two battens crossing on the outer face, bolted, and a steel hub plate out to the bound.
    const bw = 0.085;
    const batten = timber(0.84);
    const k = R * 0.9;
    const [b0, b1] = s < 0 ? [-X + 0.004, -X + proud] : [X - proud, X - 0.004];
    const inner = s < 0 ? 'px' : 'nx';
    box(m, [b0, R - k, -bw], [b1, R + k, bw], batten, [inner]);
    const steel = scale3(hex(look.steel ?? '#5c6064'), 0.9);
    box(m, [s < 0 ? -X : X - proud, R - 0.1, -0.1], [s < 0 ? -X + proud : X, R + 0.1, 0.1], (p, nn) => scale3(steel, Math.abs(nn[0]) > 0.5 ? 1 : 0.8), [inner]);
    if (fine) {
      box(m, [b0, R - bw, -k], [b1, R + bw, -bw], batten, [inner, 'pz']);
      box(m, [b0, R - bw, bw], [b1, R + bw, k], batten, [inner, 'nz']);
      const face = s < 0 ? b0 : b1;
      for (const [by, bz] of [[k * 0.8, 0], [-k * 0.8, 0], [0, k * 0.8], [0, -k * 0.8]]) onX(m, bz - 0.022, R + by - 0.022, bz + 0.022, R + by + 0.022, face, s, steel);
    }
  }
  // The drum between them: the cable in turns (each its own shade), or the bare core's staves.
  const turns = fine ? (wound ? 8 : 1) : 1;
  const Sc = fine ? 12 : 8;
  for (let k = 0; k < turns; k++) {
    const x0 = lerp(-X + ft, X - ft, k / turns);
    const x1 = lerp(-X + ft, X - ft, (k + 1) / turns);
    const shadeK = wound ? 0.86 + (k % 2) * 0.16 + r.jitter(0.04) : 0.8;
    const c = wound ? cableC : wood;
    cyl(m, 0, R, 0, x0, x1, rc * (wound && k % 2 ? 0.985 : 1), Sc, (p, nn) => scale3(c, shadeK * (0.8 + 0.25 * nn[1]) * groundShade(p[1], 0.3, 0.8)));
  }
  return m;
}

// ---------------------------------------------------------------- the shop awning

/**
 * A striped shop awning: canvas sloping from the wall (−z, at the top) out to a front bar, a valance hanging from it
 * down to the piece's foot, closed sides, two steel arms. Settings `g`: `stripes` (how many, across the width),
 * `drop` (the valance's height, m; its hem is cut to a point a stripe). `look`: `canvas`, `stripe` (alternate stripes),
 * `frame`, `fade` (0–1: sun-bleached towards the front), `grime`. No collision (the family's `collide: "none"`).
 */
export function awningMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const canvas = hex(look.canvas);
  const stripe = hex(look.stripe ?? look.canvas);
  const frameC = hex(look.frame ?? '#6a6e72');
  const drop = g.drop ?? 0.22;
  const fade = look.fade ?? 0.15;
  const grime = look.grime ?? 0.2;
  const m = new Mesh();
  const r = rng(seed);
  const n = noise3(seed + 13);
  const pale = hex('#d8d4c8');
  // Canvas: bleached towards the front edge, streaked by rain, darker underneath.
  const cloth = (c, k = 1) => (p) => scale3(mix3(c, pale, fade * clamp01((p[2] + Z) / d)), k * (1 - grime * 0.35 * clamp01(n(p[0] * 2, p[1] * 2, p[2] * 6) * 0.5 + 0.3)));
  const stripes = level >= 2 ? 1 : Math.max(2, g.stripes ?? 8);
  const tones = Array.from({ length: Math.max(2, g.stripes ?? 8) }, () => 1 + r.jitter(0.03));
  const both = level >= 2 ? scale3([canvas[0] + stripe[0], canvas[1] + stripe[1], canvas[2] + stripe[2]], 0.5) : null;
  const points = level === 0;
  const hem = points ? drop * 0.36 : 0;
  for (let k = 0; k < stripes; k++) {
    const x0 = lerp(-X, X, k / stripes);
    const x1 = lerp(-X, X, (k + 1) / stripes);
    const c = both ?? scale3(k % 2 ? stripe : canvas, tones[k]);
    // The slope, and its underside.
    quadN(m, [x0, h, -Z], [x1, h, -Z], [x1, drop, Z], [x0, drop, Z], [0, 1, 0.5], cloth(c));
    if (level === 0) quadN(m, [x0, h - 0.004, -Z], [x1, h - 0.004, -Z], [x1, drop - 0.004, Z - 0.004], [x0, drop - 0.004, Z - 0.004], [0, -1, -0.5], cloth(c, 0.55));
    // The valance: front and back, its hem straight or cut to a point a stripe.
    for (const s of level === 0 ? [1, -1] : [1]) {
      const z = s > 0 ? Z : Z - 0.004;
      const col = cloth(c, s > 0 ? 0.92 : 0.6);
      quadN(m, [x0, hem, z], [x1, hem, z], [x1, drop, z], [x0, drop, z], [0, 0, s], col);
      if (points) triN(m, [x0, hem, z], [x1, hem, z], [(x0 + x1) / 2, 0, z], [0, 0, s], col);
    }
  }
  // The closed sides.
  for (const s of [-1, 1]) {
    const col = cloth(scale3(canvas, 0.85));
    triN(m, [s * X, h, -Z], [s * X, drop, Z], [s * X, drop, -Z], [s, 0, 0], col);
    if (level === 0) triN(m, [s * (X - 0.004), h, -Z], [s * (X - 0.004), drop, Z], [s * (X - 0.004), drop, -Z], [-s, 0, 0], cloth(scale3(canvas, 0.5)));
  }
  if (level >= 2) return m;
  // The frame: an arm each side under the canvas's lower edge, the front bar, the wall bar.
  const t = 0.035;
  const steel = (p, nn) => scale3(frameC, (nn[1] > 0.5 ? 1.1 : 0.85) * (1 - grime * 0.3));
  for (const s of [-1, 1]) bar(m, [s * (X - 0.03), drop + t / 2, -Z + t / 2], [s * (X - 0.03), drop + t / 2, Z - t], t, steel, { ends: true });
  bar(m, [-X + 0.01, drop + t / 2, Z - t], [X - 0.01, drop + t / 2, Z - t], t, steel);
  if (level === 0) bar(m, [-X + 0.01, h - t, -Z + t / 2], [X - 0.01, h - t, -Z + t / 2], t, steel);
  return m;
}
