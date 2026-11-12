// Yard and workshop pieces (kit-prop families of part 10; docs/PROCEDURAL_ENVIRONMENT.md §11 Phase 6): a section of
// glass pipe between two flanges (`glasspipe`: along x, open through both ends, as the valve of plant.mjs is), a
// capped pipe riser (`pipestub`: a wide pipe standing out of the ground under a collar), a workbench with a vice
// (`workbench`), a traffic cone (`cone`) and, from part 11, an anvil on its timber block (`anvil`). Each fills its
// bounds, [-w/2, w/2] × [0, h] × [-d/2, d/2].
//
// The pipe, the riser and the bench collide as finer boxes (a generator's `boxes`: tools/content/kitprops.mjs), the
// same for each variant: the glass pipe's leave its bore open from end to end, as the retired piece's did; the
// riser, whose bore was a pit a player could not climb out of, is capped a little below its rim and solid. The cone
// has no collision (its family says `collide: "none"`), as the cones it replaces had none. The anvil collides as
// four boxes (two sleepers, the block on them, the anvil), open between the sleepers and beside the anvil as the
// retired piece was under its bench and beside its anvil. The boxes are in metres: a family here has one size, its
// retired prop's.
//
// Nothing here glows or blinks: glass is pale paint with a still streak, a cone's bands are paint (CLAUDE.md,
// "Accessibility").
//
// Level 1 keeps the outline with far fewer triangles; level 2 is a stand-in of a few faces.

import { rng } from '../env/rng.mjs';
import { Mesh, annulus, bar, box, cyl, disc, hex, lathe, mix3, ovalDisc, ovalShell, quadN, scale3, triN } from './geom.mjs';
import { lerp, onX, onY, onZ, round, solid, tone } from './machines.mjs';

const DARK = '#17191b';

// ---------------------------------------------------------------- the glass pipe

/**
 * A section of glass pipe along x between two bolted flanges, open through both ends. Settings `g`: `rods` (tie
 * rods between the flanges, round the glass), `hoops` (metal hoops round the glass), `bolts` (a flange), `fill`
 * (0–1: how much of the glass shows the liquid's colour, from the bottom). `look`: `glass`, `liquid`, `flange`,
 * `rod`, `bolt`, `grime`.
 */
export function glassPipeMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const X = w / 2;
  const R = h / 2;
  const yc = h / 2;
  const xf = 0.6;
  const rt = 0.66;
  const rb = 0.5;
  const glassC = hex(look.glass);
  const flangeC = hex(look.flange ?? '#7a8088');
  const m = new Mesh();
  if (level >= 2) {
    box(m, [-xf, yc - rt, -rt], [xf, yc + rt, rt], scale3(glassC, 0.9), ['nx', 'px']);
    for (const s of [-1, 1]) box(m, [s > 0 ? xf : -X, 0, -R], [s > 0 ? X : -xf, h, R], scale3(flangeC, 0.8), ['ny']);
    return m;
  }
  // Solid: the glass as eight walls round its bore (under, over, each side, the four corners), each flange's four
  // pieces round the bore (its foot, its top, its two sides). Open: the bore, end to end.
  m.boxes = [
    [-X, 0.1, -0.4, X, 0.3, 0.4],
    [-X, 1.3, -0.4, X, 1.5, 0.4],
    [-X, 0.5, -0.7, X, 1.1, -0.5],
    [-X, 0.5, 0.5, X, 1.1, 0.7],
    [-X, 0.2, -0.6, X, 0.5, -0.3],
    [-X, 0.2, 0.3, X, 0.5, 0.6],
    [-X, 1.1, -0.6, X, 1.4, -0.3],
    [-X, 1.1, 0.3, X, 1.4, 0.6],
    ...[-1, 1].flatMap((s) => {
      const [x0, x1] = s > 0 ? [xf, X] : [-X, -xf];
      return [[x0, 0, -0.68, x1, 0.5, 0.68], [x0, 1.1, -0.68, x1, h, 0.68], [x0, 0.5, -R, x1, 1.1, -0.42], [x0, 0.5, 0.42, x1, 1.1, R]];
    }),
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.2;
  const S = fine ? 16 : 8;
  // The glass: pale, a still streak along its upper side, the liquid's colour on the faces below its level.
  const liquidC = hex(look.liquid ?? look.glass);
  const fill = Math.max(0, Math.min(1, g.fill ?? 0.5));
  const glass = (p, n) => {
    const c = n[1] < fill * 2 - 1 ? mix3(glassC, liquidC, 0.75) : glassC;
    const streak = n[1] > 0.3 && n[1] < 0.75 && n[2] < 0 ? 1.35 : 1;
    return scale3(c, (0.86 + 0.2 * n[1]) * streak);
  };
  const flange = round(scale3(flangeC, 1 + r.jitter(0.03)), grime, 0.95);
  const steel = round(hex(look.bolt ?? '#8b9094'), grime);
  cyl(m, 0, yc, 0, -xf, xf, rt, S, glass);
  cyl(m, 0, yc, 0, -X, X, rb, S, (p, n) => scale3(n[1] > 1 - fill * 2 ? mix3(glassC, liquidC, 0.8) : glassC, 0.3 + 0.12 * Math.abs(p[0]) / X), { inside: true });
  for (const s of [-1, 1]) {
    cyl(m, 0, yc, 0, s > 0 ? xf : -X, s > 0 ? X : -xf, R, S, flange);
    annulus(m, 0, yc, 0, s * X, rb, R, S, s, flange);
    annulus(m, 0, yc, 0, s * xf, rt, R, S, -s, flange);
    if (!fine) continue;
    const nb = Math.max(4, g.bolts ?? 8);
    for (let k = 0; k < nb; k++) {
      const a = ((k + 0.5) / nb) * Math.PI * 2;
      const [by, bz] = [yc + Math.cos(a) * 0.73, Math.sin(a) * 0.73];
      box(m, [s > 0 ? xf - 0.04 : -xf, by - 0.03, bz - 0.03], [s > 0 ? xf : -xf + 0.04, by + 0.03, bz + 0.03], steel, [s > 0 ? 'px' : 'nx']);
    }
  }
  if (!fine) return m;
  // Tie rods between the flanges, hoops round the glass.
  const rod = round(hex(look.rod ?? '#8b9094'), grime);
  const nr = Math.max(0, g.rods ?? 4);
  for (let k = 0; k < nr; k++) {
    const a = ((k + 0.5) / nr) * Math.PI * 2;
    bar(m, [-xf, yc + Math.cos(a) * 0.73, Math.sin(a) * 0.73], [xf, yc + Math.cos(a) * 0.73, Math.sin(a) * 0.73], 0.035, rod);
  }
  const nh = Math.max(0, Math.min(2, g.hoops ?? 0));
  for (let k = 0; k < nh; k++) {
    const x = nh === 1 ? 0 : lerp(-0.25, 0.25, k);
    cyl(m, 0, yc, 0, x - 0.035, x + 0.035, rt + 0.02, S, flange);
    for (const e of [-1, 1]) annulus(m, 0, yc, 0, x + e * 0.035, rt, rt + 0.02, S, e, flange);
  }
  return m;
}

// ---------------------------------------------------------------- the pipe riser

/**
 * A wide pipe standing out of the ground under a taller collar, capped a little below its rim. Settings `g`: `top`
 * ('grate', 'lid' or 'water'), `lugs` (blocks under the collar), `band` (a painted band round the collar's foot:
 * its height, m; 0 for none). `look`: `paint`, `collar`, `band`, `cap` (the lid, or the water), `trim`, `grime`.
 */
export function pipeStubMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const R = w / 2;
  const paintC = hex(look.paint);
  const collarC = hex(look.collar ?? look.paint);
  const m = new Mesh();
  if (level >= 2) {
    box(m, [-0.76, 0, -0.76], [0.76, h, 0.76], scale3(mix3(paintC, collarC, 0.5), 0.85), ['ny']);
    return m;
  }
  // Solid: the pipe as an eight-sided block, its collar as a wider one, capped. Open: nothing (the bore is capped).
  m.boxes = [
    [-0.4, 0, -0.95, 0.4, 0.5, 0.95],
    [-0.95, 0, -0.4, 0.95, 0.5, 0.4],
    [-0.7, 0, -0.7, 0.7, 0.5, 0.7],
    [-0.42, 0.5, -R, 0.42, h, R],
    [-R, 0.5, -0.42, R, h, 0.42],
    [-0.78, 0.5, -0.78, 0.78, h, 0.78],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.3;
  const S = fine ? 16 : 8;
  const rl = 0.95;
  const ri = R - 0.2;
  const dep = 0.14;
  const top = g.top ?? 'grate';
  const body = round(scale3(paintC, 1 + r.jitter(0.02)), grime);
  const collar = round(collarC, grime * 0.7);
  const band = round(hex(look.band ?? look.collar ?? look.paint), grime * 0.5);
  const hb = fine ? Math.max(0, Math.min(0.3, g.band ?? 0.12)) : 0;
  const prof = [[rl, 0], [rl, 0.5], [R, 0.5], ...(hb ? [[R, 0.5 + hb]] : []), [R, h], [ri, h], [ri, h - dep]];
  const rows = [body, collar, ...(hb ? [band] : []), collar, collar, (p) => scale3(collarC, 0.3 + 0.2 * (p[1] - h + dep) / dep)];
  lathe(m, prof, S, (p, n, row) => rows[row](p, n), { hard: prof.map((_, i) => i) });
  const capC = hex(look.cap ?? (top === 'water' ? '#20383a' : top === 'grate' ? DARK : look.paint));
  disc(m, ri, h - dep, S, scale3(capC, top === 'grate' ? 1 : 0.95));
  if (!fine) return m;
  const trim = scale3(hex(look.trim ?? '#8b9094'), 0.85);
  const y = h - dep;
  if (top === 'grate') {
    for (let k = 0; k < 6; k++) {
      const t = lerp(-0.6, 0.6, k / 5);
      const half = Math.sqrt(Math.max(0, (ri - 0.04) ** 2 - t * t));
      onY(m, t - 0.035, -half, t + 0.035, half, y, trim);
    }
    onY(m, -ri + 0.06, -0.035, ri - 0.06, 0.035, y + 0.002, trim);
  } else if (top === 'lid') {
    onY(m, -0.4, -0.4, 0.4, 0.4, y, scale3(capC, 0.72));
    onY(m, -0.18, -0.04, 0.18, 0.04, y + 0.002, trim);
    for (let k = 0; k < 4; k++) {
      const a = ((k + 0.5) / 4) * Math.PI * 2;
      onY(m, Math.cos(a) * 0.72 - 0.05, Math.sin(a) * 0.72 - 0.05, Math.cos(a) * 0.72 + 0.05, Math.sin(a) * 0.72 + 0.05, y, trim);
    }
  } else {
    // Still water: a paler patch, off centre (paint; nothing moves).
    onY(m, -0.45, -0.3, 0.1, 0.2, y, scale3(capC, 1.5));
    onY(m, 0.15, 0.25, 0.5, 0.42, y, scale3(capC, 1.3));
  }
  const nl = Math.max(0, g.lugs ?? 4);
  for (let k = 0; k < nl; k++) {
    const a = ((k + 0.5) / nl) * Math.PI * 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    bar(m, [c * (rl + 0.03), 0.34, s * (rl + 0.03)], [c * (rl + 0.03), 0.5, s * (rl + 0.03)], 0.09, collar, { up: [c, 0, s] });
  }
  return m;
}

// ---------------------------------------------------------------- the workbench

/**
 * A workbench: a cabinet under a thick top that overhangs it (further at +x), a vice on the −x end with its
 * screw out to the bounds, things left on the top. Settings `g`: `front` ('drawers' or 'doors': the cabinet's −z
 * face), `drawers` (how many), `kit` ('toolbox', 'cans' or 'board': what lies on the top). `look`: `wood` (the
 * top), `cabinet`, `vice`, `tool` (the toolbox or the cans), `trim`, `grime`.
 */
export function workbenchMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const woodC = hex(look.wood);
  const cabC = hex(look.cabinet ?? look.wood);
  const m = new Mesh();
  if (level >= 2) {
    solid(m, [-0.4, 0, -0.45, 0.5, 0.6, 0.45], scale3(cabC, 0.85), ['ny', 'py']);
    solid(m, [-0.5, 0.6, -Z, X, 0.9, Z], scale3(woodC, 0.95));
    return m;
  }
  // Solid: the cabinet, the top and its apron, the vice and what lies on the top (one low block, as it was).
  m.boxes = [
    [-0.4, 0, -0.45, 0.5, 0.6, 0.45],
    [-0.5, 0.6, -Z, X, 0.9, Z],
    [-X, 0.8, -0.35, X, h, 0.35],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.3;
  const wood = (k = 1) => tone(scale3(woodC, k * (1 + r.jitter(0.03))), grime * 0.6);
  const cab = tone(cabC, grime);
  const viceC = hex(look.vice ?? '#3d5a78');
  const vice = tone(viceC, grime * 0.5);
  const trim = scale3(hex(look.trim ?? '#8b9094'), 0.85);
  solid(m, [-0.4, 0, -0.45, 0.5, 0.6, 0.45], cab, ['ny', 'py']);
  solid(m, [-0.46, 0.6, -0.49, 0.53, 0.78, 0.49], wood(0.8), ['py']);
  solid(m, [-0.5, 0.78, -Z, X, 0.9, Z], wood());
  // The vice: its clamp under the end of the top, its two jaws, its screw out to the bounds.
  solid(m, [-X + 0.03, 0.8, -0.08, -0.5, 0.9, 0.08], vice, ['px']);
  solid(m, [-0.4, 0.9, -0.1, -0.3, h, 0.1], vice, ['ny']);
  solid(m, [-0.5, 0.9, -0.1, -0.44, h, 0.1], vice, ['ny']);
  bar(m, [-X, 0.94, 0], [-0.5, 0.94, 0], 0.04, tone(hex(look.trim ?? '#8b9094'), 0), { ends: true });
  // What lies on the top.
  const kit = g.kit ?? 'toolbox';
  const toolC = hex(look.tool ?? '#a8261e');
  if (kit === 'toolbox') {
    solid(m, [0.08, 0.9, -0.17, 0.5, h - 0.012, 0.17], tone(toolC, grime * 0.4), ['ny']);
    if (fine) {
      onY(m, 0.2, -0.025, 0.38, 0.025, h - 0.012, trim);
      onZ(m, 0.25, 0.925, 0.33, 0.955, -0.17, -1, trim);
    }
  } else if (kit === 'cans') {
    for (const [x, z, rad, k] of [[0.38, 0.12, 0.07, 1], [0.2, -0.08, 0.06, 0.8], [0.42, -0.14, 0.05, 1.15]]) cyl(m, 1, z, x, 0.9, h - 0.012, rad, fine ? 8 : 4, round(scale3(toolC, k), grime * 0.4), { caps: '1' });
  } else {
    solid(m, [-0.15, 0.9, -0.32, 0.5, 0.94, -0.12], wood(1.15), ['ny']);
    solid(m, [0.05, 0.9, 0.05, 0.45, h - 0.012, 0.25], tone(toolC, grime * 0.4), ['ny']);
    if (fine) onY(m, -0.05, -0.27, 0.35, -0.17, 0.94, trim);
  }
  if (!fine) return m;
  // The cabinet's front (−z): drawers, or two doors; a panel in its back.
  const dark = scale3(mix3(cabC, hex(DARK), 0.55), 1);
  if ((g.front ?? 'drawers') === 'drawers') {
    const n = Math.max(1, g.drawers ?? 3);
    for (let k = 0; k < n; k++) {
      const [y0, y1] = [lerp(0.06, 0.56, k / n) + 0.012, lerp(0.06, 0.56, (k + 1) / n) - 0.012];
      onZ(m, -0.34, y0, 0.44, y1, -0.45, -1, scale3(cabC, 1.12));
      onZ(m, -0.06, (y0 + y1) / 2 - 0.012, 0.16, (y0 + y1) / 2 + 0.012, -0.452, -1, trim);
    }
  } else {
    for (const s of [-1, 1]) {
      onZ(m, s > 0 ? 0.06 : -0.34, 0.06, s > 0 ? 0.44 : 0.04, 0.56, -0.45, -1, scale3(cabC, 1.12));
      onZ(m, s > 0 ? 0.09 : -0.01, 0.26, s > 0 ? 0.11 : 0.01, 0.4, -0.452, -1, trim);
    }
  }
  onZ(m, -0.3, 0.1, 0.4, 0.5, 0.45, 1, dark);
  for (const s of [-1, 1]) onX(m, -0.35, 0.1, 0.35, 0.5, s > 0 ? 0.5 : -0.4, s, scale3(cabC, 0.86));
  return m;
}

// ---------------------------------------------------------------- the traffic cone

/**
 * A traffic cone on its foot. Settings `g`: `foot` ('square' or 'octagon'), `bands` (0–2 painted bands). `look`:
 * `body`, `band`, `foot`, `grime`. It has no collision (the family's `collide: "none"`).
 */
export function coneMesh(seed, size, g, look, level) {
  const [w, h] = size;
  const X = w / 2;
  const bodyC = hex(look.body);
  const bandC = hex(look.band ?? '#e8e6de');
  const footC = hex(look.foot ?? look.body);
  const m = new Mesh();
  const t = 0.045;
  const [rb, rt] = [X * 0.7, X * 0.13];
  if (level >= 2) {
    const lo = [[-rb, 0, -rb], [rb, 0, -rb], [rb, 0, rb], [-rb, 0, rb]];
    const hi = [[-rt, h, -rt], [rt, h, -rt], [rt, h, rt], [-rt, h, rt]];
    const out = [[0, 0.2, -1], [1, 0.2, 0], [0, 0.2, 1], [-1, 0.2, 0]];
    for (let k = 0; k < 4; k++) quadN(m, lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k], out[k], scale3(bodyC, 0.9));
    return m;
  }
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.2;
  const S = fine ? 12 : 6;
  const foot = tone(scale3(footC, 1 + r.jitter(0.03)), grime, 0.9);
  if (fine && (g.foot ?? 'square') === 'octagon') {
    const k = X / Math.cos(Math.PI / 8);
    ovalShell(m, [[1, 0], [1, t]], 8, foot, { rx: k, rz: k, phase: Math.PI / 8, smooth: false });
    ovalDisc(m, k, k, t, 8, foot, { phase: Math.PI / 8 });
  } else {
    box(m, [-X, 0, -X], [X, t, X], foot, ['ny']);
  }
  // The cone: its body, its painted bands, its flat tip.
  const at = (f) => [lerp(rb, rt, f), lerp(t, h, f)];
  const nb = Math.max(0, Math.min(fine ? 2 : 1, g.bands ?? 1));
  const marks = nb === 2 ? [[0.36, 0.52], [0.66, 0.8]] : nb === 1 ? [[0.45, 0.72]] : [];
  const prof = [at(0)];
  const rows = [];
  for (const [a, b] of marks) {
    prof.push(at(a), at(b));
    rows.push('body', 'band');
  }
  prof.push(at(1));
  rows.push('body');
  const body = round(bodyC, grime);
  const band = round(bandC, grime * 0.5);
  lathe(m, prof, S, (p, n, row) => (rows[row] === 'band' ? band(p, n) : body(p, n)), { hard: prof.map((_, i) => i) });
  disc(m, rt, h, S, scale3(bodyC, 0.8));
  if (fine) lathe(m, [[rb + 0.035, t], [rb + 0.035, t + 0.02], [rb, t + 0.02]], S, body, { hard: [1] });
  return m;
}

// ---------------------------------------------------------------- the anvil

/**
 * A section tapering along x from `a` to `b`, each [x, yc, zc, ry, rz] (its centre and half heights), `seg` sides (4:
 * a rectangle; 8: an octagon); closed at `b` when `cap`.
 */
function taper(m, a, b, seg, colour, cap = true) {
  const k = Math.cos(Math.PI / seg);
  const ring = ([x, yc, zc, ry, rz]) => Array.from({ length: seg }, (_, i) => {
    const t = Math.PI / seg + (i / seg) * Math.PI * 2;
    return [x, yc + (Math.sin(t) * ry) / k, zc + (Math.cos(t) * rz) / k];
  });
  const [p, q] = [ring(a), ring(b)];
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    const t = Math.PI / seg + ((i + 0.5) / seg) * Math.PI * 2;
    quadN(m, p[i], p[j], q[j], q[i], [0, Math.sin(t), Math.cos(t)], colour);
  }
  if (cap) for (let i = 1; i + 1 < seg; i++) triN(m, q[0], q[i], q[i + 1], [b[0] - a[0], 0, 0], colour);
}

/**
 * An anvil on a timber block that stands on two sleepers: its foot, its waist, its body under a worn face, a horn
 * out to +x and a heel out to −x, iron straps round the block, a tool left on it. Settings `g`: `baulks` (the
 * timbers side by side in the block), `straps` (0–2), `horn` ('round' or 'square'), `kit` ('hammer', 'tongs' or
 * 'none'). `look`: `iron`, `face` (the worn top), `wood`, `strap`, `tool` (the hammer's handle), `grime`.
 */
export function anvilMesh(seed, size, g, look, level) {
  const [w, h, d] = size;
  const X = w / 2;
  const Z = d / 2;
  const [ys, yb] = [0.16, 0.46];
  const xs = 0.18;
  const za = 0.1;
  const ironC = hex(look.iron);
  const woodC = hex(look.wood);
  const m = new Mesh();
  if (level >= 2) {
    solid(m, [-X, 0, -Z, X, yb, Z], scale3(woodC, 0.85), ['ny']);
    solid(m, [-X, yb, -za, X, h, za], scale3(ironC, 0.9), ['ny']);
    return m;
  }
  // Solid: the two sleepers, the block, the anvil from heel to horn. Open: between the sleepers under the block;
  // over the block each side of the anvil.
  m.boxes = [
    [-X, 0, -Z, -xs, ys, Z],
    [xs, 0, -Z, X, ys, Z],
    [-X, ys, -Z, X, yb, Z],
    [-X, yb, -0.14, X, h, 0.14],
  ];
  const r = rng(seed);
  const fine = level === 0;
  const grime = look.grime ?? 0.3;
  const wood = (k = 1) => tone(scale3(woodC, k * (1 + r.jitter(0.04))), grime * 0.6);
  const endGrain = (c) => (p, n) => scale3(c(p, n), Math.abs(n[2]) > 0.5 ? 1.25 : 1);
  const iron = tone(ironC, grime * 0.4);
  const faceC = hex(look.face ?? '#8b9094');
  // The sleepers, along z out to the bounds; the block on them, a little inside the bounds for its straps.
  for (const s of [-1, 1]) solid(m, [s > 0 ? xs : -X, 0, -Z, s > 0 ? X : -xs, ys, Z], endGrain(wood(0.8)), ['ny']);
  const [bx, bz] = [X - 0.02, Z - 0.02];
  const nk = fine ? Math.max(1, Math.min(4, g.baulks ?? 3)) : 1;
  for (let k = 0; k < nk; k++) solid(m, [lerp(-bx, bx, k / nk), ys, -bz, lerp(-bx, bx, (k + 1) / nk), yb, bz], endGrain(wood()), fine ? [] : ['ny']);
  // The anvil: its foot, its waist drawn in, its body, the heel a little lower than the face, the horn.
  solid(m, [-0.2, yb, -0.13, 0.2, yb + 0.06, 0.13], iron, ['ny']);
  const body = (p, n) => (n[1] > 0.5 ? scale3(faceC, 0.95) : iron(p, n));
  solid(m, [-0.11, yb + 0.06, -0.075, 0.11, 0.63, 0.075], iron, ['ny', 'py']);
  solid(m, [-0.2, 0.63, -za, 0.2, h, za], body);
  solid(m, [-X, 0.7, -za, -0.2, h - 0.004, za], iron, ['px']);
  const round8 = (g.horn ?? 'round') === 'round' && fine;
  taper(m, [0.2, 0.72, 0, 0.08, za * 0.9], [X, h - 0.025, 0, 0.025, 0.02], round8 ? 8 : 4, iron);
  if (!fine) return m;
  // The hardy hole and the pritchel hole in the heel (paint).
  onY(m, -X + 0.05, -0.025, -X + 0.1, 0.025, h - 0.004, scale3(hex(DARK), 1));
  onY(m, -X + 0.13, -0.012, -X + 0.155, 0.012, h - 0.004, scale3(hex(DARK), 1));
  // Staples over the foot's corners, into the block.
  const strapC = hex(look.strap ?? '#3a3d42');
  const strap = tone(strapC, grime * 0.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid(m, [sx * 0.2 - 0.02, yb, sz * 0.15 - 0.03, sx * 0.2 + 0.02, yb + 0.075, sz * 0.15 + 0.03], strap, ['ny']);
  // Iron straps round the block.
  const ns = Math.max(0, Math.min(2, g.straps ?? 2));
  for (let k = 0; k < ns; k++) {
    const z = ns === 1 ? 0 : lerp(-0.2, 0.2, k);
    solid(m, [-bx - 0.012, ys + 0.002, z - 0.03, bx + 0.012, yb + 0.006, z + 0.03], strap, ['ny']);
  }
  // What is left on the block, beside the anvil.
  const kit = g.kit ?? 'hammer';
  const toolC = hex(look.tool ?? '#8a5f3a');
  if (kit === 'hammer') {
    bar(m, [-0.22, yb + 0.03, 0.25], [0.12, yb + 0.03, 0.25], 0.035, tone(toolC, 0), { ends: true });
    solid(m, [0.1, yb + 0.006, 0.19, 0.17, yb + 0.07, 0.31], iron, ['ny']);
  } else if (kit === 'tongs') {
    const steel = tone(scale3(strapC, 1.3), 0);
    bar(m, [-0.26, yb + 0.02, -0.21], [0.24, yb + 0.02, -0.29], 0.025, steel, { ends: true });
    bar(m, [-0.26, yb + 0.03, -0.29], [0.24, yb + 0.03, -0.21], 0.025, steel, { ends: true });
  }
  return m;
}
