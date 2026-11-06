// Builds the Style Pack pieces we model ourselves, in code, from simple
// geometry (boxes, cylinders, rounded bags, rings): sandbags, gabions,
// hedgehogs, ammo crates and drums, razor wire and a camouflage net for
// 01 Military Compound; mine carts, dynamite, hitching posts, troughs, a
// covered wagon, a wind pump and the like for 02 Frontier Dust.
//
//   node tools/content/build-kit-props.mjs
//
// Writes one GLB per piece to assets-src/tiletrigger-kit/ (flat colours, no
// textures), which tools/content/prepare-props.mjs then normalises like any
// other pack. Everything is deterministic: the same code writes the same bytes.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'assets-src/tiletrigger-kit');
/**
 * The pieces with real surfaces (content/surfaces/tiletrigger-kit.json `props`: Shingle Point's beach pieces) are
 * written with one material per surface, their colours as vertex colours on it: each copy on a map is then one GPU
 * instance and one draw per surface, not one per colour (a beach of 46 hedgehogs). The rest stay one per colour.
 */
const SURFACES = JSON.parse(readFileSync(join(ROOT, 'content/surfaces/tiletrigger-kit.json'), 'utf8'));

// ---------------------------------------------------------------- palette

const COLOURS = {
  burlap: '#b39b6b',
  burlapDark: '#9a845a',
  olive: '#56603a',
  oliveDark: '#3f4630',
  steel: '#5f656b',
  steelDark: '#3a3e43',
  concrete: '#9c9a94',
  wire: '#8f959b',
  mesh: '#7c8086',
  earth: '#8a7350',
  stencil: '#d8c060',
  net: '#4f5a36',
  netLight: '#6b7448',
  wood: '#8a5f3a',
  woodLight: '#a77a4c',
  woodDark: '#5a3c24',
  iron: '#3c3a38',
  rust: '#7a4a2e',
  red: '#b3261e',
  fuse: '#d9cfae',
  paper: '#e4d6b0',
  ink: '#3a2e22',
  water: '#4a6a78',
  canvas: '#e2d6b8',
  ore: '#6e6258',
  gold: '#c9a23a',
  straw: '#c8a85a',
  white: '#e8e4da',
  char: '#241e1a',
  ember: '#c4541c',
  // Beach defences and landing craft (Shingle Point's asset refresh).
  hullGrey: '#5c6359',
  hullDark: '#40463f',
  rustDeep: '#583624',
  woodGrey: '#77705f',
  paintGrey: '#6a726c',
  twine: '#7c6a44',
};

// ---------------------------------------------------------------- geometry

/** A part: triangles (positions, normals, indices) in one material. */
function part(colour, positions, normals, indices) {
  return { colour, positions, normals, indices };
}

/** Axis-aligned box centred on (cx, cy, cz), flat shaded. */
function box(colour, [w, h, d], [cx, cy, cz] = [0, 0, 0]) {
  const p = [];
  const n = [];
  const idx = [];
  const faces = [
    [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
    [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
    [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]],
    [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]],
    [[0, 0, 1], [[1, -1, 1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1]]],
    [[0, 0, -1], [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]]],
  ];
  for (const [normal, corners] of faces) {
    const base = p.length / 3;
    for (const [x, y, z] of corners) {
      p.push(cx + (x * w) / 2, cy + (y * h) / 2, cz + (z * d) / 2);
      n.push(...normal);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return part(colour, p, n, idx);
}

/** Cylinder along +Y from y0 to y1 (smooth sides, flat caps), `seg` sides. */
function cylinder(colour, r, y0, y1, seg = 12, r1 = r) {
  const p = [];
  const n = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    p.push(c * r, y0, s * r, c * r1, y1, s * r1);
    n.push(c, 0, s, c, 0, s);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  for (const [y, rr, up] of [[y0, r, -1], [y1, r1, 1]]) {
    const centre = p.length / 3;
    p.push(0, y, 0);
    n.push(0, up, 0);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      p.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      n.push(0, up, 0);
    }
    for (let i = 0; i < seg; i++) idx.push(...(up > 0 ? [centre, centre + i + 2, centre + i + 1] : [centre, centre + i + 1, centre + i + 2]));
  }
  return part(colour, p, n, idx);
}

/** A rounded bag (superellipsoid), half sizes a, b, c; `e` < 1 squares it off. */
function bag(colour, [a, b, c], e = 0.45, seg = 10, rings = 6) {
  const p = [];
  const n = [];
  const idx = [];
  const sp = (v, k) => Math.sign(v) * Math.abs(v) ** k;
  for (let j = 0; j <= rings; j++) {
    const v = -Math.PI / 2 + (j / rings) * Math.PI;
    for (let i = 0; i <= seg; i++) {
      const u = -Math.PI + (i / seg) * Math.PI * 2;
      const x = a * sp(Math.cos(v), e) * sp(Math.cos(u), e);
      const y = b * sp(Math.sin(v), e);
      const z = c * sp(Math.cos(v), e) * sp(Math.sin(u), e);
      p.push(x, y, z);
      // Normal of the squared-off shape: close enough to the ellipsoid's, scaled per axis.
      const nx = Math.cos(v) * Math.cos(u) / a;
      const ny = Math.sin(v) / b;
      const nz = Math.cos(v) * Math.sin(u) / c;
      const l = Math.hypot(nx, ny, nz) || 1;
      n.push(nx / l, ny / l, nz / l);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const k = j * (seg + 1) + i;
      idx.push(k, k + seg + 1, k + 1, k + 1, k + seg + 1, k + seg + 2);
    }
  }
  return part(colour, p, n, idx);
}

/** A half-cylinder roof along Z (the upper half in the XY plane), `len` long, with its ends closed. */
function vault(colour, r, len, seg = 12) {
  const p = [];
  const n = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    p.push(c * r, s * r, -len / 2, c * r, s * r, len / 2);
    n.push(c, s, 0, c, s, 0);
  }
  for (let i = 0; i < seg; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  for (const [z, f] of [[len / 2, 1], [-len / 2, -1]]) {
    const centre = p.length / 3;
    p.push(0, 0, z);
    n.push(0, 0, f);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI;
      p.push(Math.cos(a) * r, Math.sin(a) * r, z);
      n.push(0, 0, f);
    }
    for (let i = 0; i < seg; i++) idx.push(...(f > 0 ? [centre, centre + i + 1, centre + i + 2] : [centre, centre + i + 2, centre + i + 1]));
  }
  return part(colour, p, n, idx);
}

/** A ring (torus) in the XY plane: radius R, tube radius r. */
function ring(colour, R, r, seg = 14, tube = 4) {
  const p = [];
  const n = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const u = (i / seg) * Math.PI * 2;
    for (let j = 0; j <= tube; j++) {
      const v = (j / tube) * Math.PI * 2;
      const [cu, su, cv, sv] = [Math.cos(u), Math.sin(u), Math.cos(v), Math.sin(v)];
      p.push((R + r * cv) * cu, (R + r * cv) * su, r * sv);
      n.push(cv * cu, cv * su, sv);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < tube; j++) {
      const k = i * (tube + 1) + j;
      idx.push(k, k + tube + 1, k + 1, k + 1, k + tube + 1, k + tube + 2);
    }
  }
  return part(colour, p, n, idx);
}

/** A copy of a part turned (radians: about X, then Y, then Z... applied as Z·Y·X) and moved. */
function place(pt, { at = [0, 0, 0], rx = 0, ry = 0, rz = 0, scale = [1, 1, 1] } = {}) {
  const rot = (x, y, z) => {
    // X
    let [a, b, c] = [x, y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
    // Y
    [a, c] = [a * Math.cos(ry) + c * Math.sin(ry), -a * Math.sin(ry) + c * Math.cos(ry)];
    // Z
    [a, b] = [a * Math.cos(rz) - b * Math.sin(rz), a * Math.sin(rz) + b * Math.cos(rz)];
    return [a, b, c];
  };
  const positions = [];
  const normals = [];
  for (let i = 0; i < pt.positions.length; i += 3) {
    const [x, y, z] = rot(pt.positions[i] * scale[0], pt.positions[i + 1] * scale[1], pt.positions[i + 2] * scale[2]);
    positions.push(x + at[0], y + at[1], z + at[2]);
    const [nx, ny, nz] = rot(pt.normals[i] / scale[0], pt.normals[i + 1] / scale[1], pt.normals[i + 2] / scale[2]);
    const l = Math.hypot(nx, ny, nz) || 1;
    normals.push(nx / l, ny / l, nz / l);
  }
  return part(pt.colour, positions, normals, pt.indices.slice());
}

/** A beam from point a to point b, `t` thick (square section), as a turned box. */
function beam(colour, a, b, t) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const ry = Math.atan2(d[0], d[2]);
  const rx = -Math.atan2(d[1], Math.hypot(d[0], d[2]));
  return place(box(colour, [t, t, len]), { at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rx, ry });
}

// ---------------------------------------------------------------- pieces (metres; +Z is the front)

/** One sandbag lying along X. */
const sandbag = (x, y, z, ry = 0, len = 0.62, colour = 'burlap') => place(bag(colour, [len / 2, 0.11, 0.17], 0.45, 8, 5), { at: [x, y + 0.11, z], ry });

/** Rows of bags along X, staggered like brickwork, `rows` high. */
function bagRows(width, rows, depthRows = 1) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 0.31 : 0;
    const n = Math.round(width / 0.62);
    for (let d = 0; d < depthRows; d++) {
      for (let i = 0; i < n + (r % 2 ? -1 : 0); i++) {
        const x = -width / 2 + 0.31 + off + i * 0.62;
        out.push(sandbag(x, r * 0.2, (d - (depthRows - 1) / 2) * 0.34, 0, 0.62, (i + r + d) % 3 === 0 ? 'burlapDark' : 'burlap'));
      }
    }
  }
  return out;
}

/** Bags round an arc (radius r, from angle a0 to a1, measured from +X toward +Z). */
function bagArc(r, a0, a1, rows) {
  const out = [];
  for (let row = 0; row < rows; row++) {
    const n = Math.max(2, Math.round((r * Math.abs(a1 - a0)) / 0.6));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((i + (row % 2 ? 0.5 : 0)) / n) * (a1 - a0);
      if (row % 2 && i === n - 1) continue;
      out.push(sandbag(Math.cos(a) * r, row * 0.2, Math.sin(a) * r, -a + Math.PI / 2, 0.6, (i + row) % 3 === 0 ? 'burlapDark' : 'burlap'));
    }
  }
  return out;
}

/** A spoked wheel in the YZ plane (axle along X), centred at (x, y, z). */
function wheel(x, y, z, r, colour = 'woodDark', spokes = 8, rim = 'iron') {
  const out = [place(ring(rim, r, 0.04, 18, 4), { at: [x, y, z], ry: Math.PI / 2 })];
  out.push(place(cylinder(colour, 0.08, -0.08, 0.08, 8), { at: [x, y, z], rz: Math.PI / 2 }));
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI;
    out.push(place(box(colour, [0.04, r * 2 - 0.06, 0.04]), { at: [x, y, z], rx: a }));
  }
  return out;
}

/** A small iron wheel (mine carts): a disc. */
const disc = (x, y, z, r, colour = 'iron') => place(cylinder(colour, r, -0.04, 0.04, 12), { at: [x, y, z], rz: Math.PI / 2 });

/** A stick of dynamite along X with its fuse. */
const stick = (x, y, z, ry = 0, rz = 0) => [place(cylinder('red', 0.035, -0.11, 0.11, 8), { at: [x, y, z], rz: Math.PI / 2 + rz, ry }), place(cylinder('fuse', 0.006, 0, 0.08, 4), { at: [x + Math.cos(ry) * 0.11, y, z - Math.sin(ry) * 0.11], rz: -Math.PI / 3 })];

// ---------------------------------------------------------------- beach defences and landing craft
// Shingle Point's asset refresh (2026-11-05): its landing craft, their wrecks and its steel hedgehogs were built from
// free blocks. These pieces take their place and keep their collision: `collide: "model"` (the GLB carries its own
// boxes in the node's extras, in the frame it is modelled in, normalised with it by prepare-props.mjs).

/** A box given by its corners. */
const slab = (colour, x0, y0, z0, x1, y1, z1) => box(colour, [x1 - x0, y1 - y0, z1 - z0], [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]);

/** A small deterministic random sequence (the same pieces every build). */
function seq(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Parts plus the collision boxes [x0, y0, z0, x1, y1, z1] they carry (collide "model"). */
const withCollision = (parts, boxes) => Object.assign(parts, { collision: boxes });

/**
 * A landing craft (an LCVP's steel well, ramp raised), +Z toward the bow. The collision is the blocks the map used:
 * the ramp 5.8 × `bowH` × 0.4 at z 0, the two hull sides 0.4 thick from z -9.8 to -2.0 at x ±2.5..2.9 (heights `sideH`,
 * -x then +x), open between ramp and sides (the way out) and at the stern; `step`: the bow skid in front of the ramp.
 * Everything drawn stays inside those boxes (a few centimetres of strakes and ribs aside), so the boxes are the bounds.
 */
function landingCraft({ bowH, sideH, step, wreck }) {
  // Few materials (each is one draw for every copy on a map): the craft hull, dark and rust; a wreck rust and dark rust.
  const hull = wreck ? 'rust' : 'hullGrey';
  const dark = wreck ? 'rustDeep' : 'hullDark';
  const streak = wreck ? 'rustDeep' : 'rust';
  const metal = dark;
  const rnd = seq(wreck ? 71 : 29);
  const out = [];
  // The ramp: the outer plate, ribs and stiffeners behind it, cheeks at its edges, a lip on top, hinge drums at its foot.
  out.push(slab(hull, -2.78, 0, 0.06, 2.78, bowH - 0.1, 0.2), slab(dark, -2.9, bowH - 0.1, -0.2, 2.9, bowH, 0.2));
  out.push(slab(dark, -2.9, 0, -0.2, -2.78, bowH - 0.1, 0.2), slab(dark, 2.78, 0, -0.2, 2.9, bowH - 0.1, 0.2));
  for (let i = 0; i < 6; i++) {
    const x = -2.3 + i * 0.92;
    out.push(slab(dark, x - 0.05, 0.12, -0.2, x + 0.05, bowH - 0.1, 0.06));
  }
  for (let y = 0.95; y < bowH - 0.4; y += 1.0) out.push(slab(dark, -2.78, y - 0.05, -0.16, 2.78, y + 0.05, 0.06));
  for (const x of [-1.7, 1.7]) out.push(place(cylinder(metal, 0.14, -0.45, 0.45, 10), { at: [x, 0.22, -0.02], rz: Math.PI / 2 }));
  // Weathering on the ramp's face: a darker band at the foot, rust running down from the lip.
  out.push(slab(dark, -2.78, 0, 0.2, 2.78, 0.5 + rnd() * 0.2, 0.205));
  for (let i = 0; i < 7; i++) {
    const x = -2.5 + rnd() * 5;
    const len = 0.6 + rnd() * (bowH * 0.45);
    out.push(slab(streak, x - 0.04 - rnd() * 0.05, bowH - 0.1 - len, 0.2, x + 0.04, bowH - 0.1, 0.206));
  }
  // The hull sides: plating, a gunwale cap, frames inside, a rubbing strake and a dark boot-top outside, end posts.
  for (const [k, h] of [[-1, sideH[0]], [1, sideH[1]]]) {
    const [xa, xb] = k < 0 ? [-2.9, -2.5] : [2.5, 2.9];
    const inner = k < 0 ? xb : xa;
    const outer = k < 0 ? xa : xb;
    // A wreck's top edge is torn: lower here and there (a few centimetres, never above its box).
    const segs = 12;
    for (let i = 0; i < segs; i++) {
      const z0 = -9.8 + (i * 7.8) / segs;
      const z1 = -9.8 + ((i + 1) * 7.8) / segs;
      const top = wreck ? h - 0.08 - (rnd() < 0.45 ? rnd() * 0.22 : 0) : h - 0.08;
      out.push(slab(hull, xa, 0, z0, xb, top, z1));
      if (!wreck || top > h - 0.1) out.push(slab(dark, xa, top, z0, xb, h, z1));
    }
    for (let z = -9.3; z < -2.2; z += 0.9) out.push(slab(dark, inner - k * 0.07, 0.1, z - 0.04, inner, h - 0.12, z + 0.04));
    out.push(slab(dark, outer, h * 0.64 - 0.07, -9.8, outer + k * 0.05, h * 0.64 + 0.05, -2.0));
    out.push(slab(dark, outer, 0, -9.8, outer + k * 0.006, 0.55, -2.0));
    out.push(slab(dark, xa, 0, -2.14, xb, h - 0.08, -2.0), slab(dark, xa, 0, -9.8, xb, h - 0.08, -9.66));
    for (let i = 0; i < 6; i++) {
      const z = -9.4 + rnd() * 7;
      const len = 0.5 + rnd() * h * 0.5;
      out.push(slab(streak, outer, h - 0.1 - len, z - 0.05, outer + k * 0.008, h - 0.1, z + 0.03 + rnd() * 0.05));
    }
  }
  // The well's floor (under the sand where a craft is beached; seen where the tide has scoured round it).
  out.push(slab(dark, -2.5, 0, -9.8, 2.5, 0.06, -0.2));
  if (step) {
    // The bow skid under the raised ramp: a heavy steel shoe, a tread plate on top, a rope fender along its nose,
    // braced back to the ramp's foot.
    out.push(slab(dark, -2.3, 0, 0.45, 2.3, 1.05, 1.35), slab(hull, -2.3, 1.05, 0.45, 2.3, 1.17, 1.35));
    out.push(place(cylinder(dark, 0.1, -2.2, 2.2, 10), { at: [0, 0.78, 1.24], rz: Math.PI / 2 }));
    for (const x of [-1.8, 1.8]) out.push(slab(metal, x - 0.08, 0.15, 0.2, x + 0.08, 0.85, 0.45));
    // Gun rings over the stern quarters.
    for (const k of [-1, 1]) out.push(place(ring(metal, 0.32, 0.03, 16, 4), { at: [k * 2.7, sideH[k < 0 ? 0 : 1] + 0.03, -8.9], rx: Math.PI / 2 }));
  } else {
    // A wreck: scorch streaks up the ramp and a buckled plate hanging inside the well.
    for (let i = 0; i < 5; i++) {
      const x = -1.6 + i * 0.45 + rnd() * 0.2;
      out.push(slab(dark, x - 0.03 - rnd() * 0.06, 0.3 + rnd() * 0.3, 0.2, x + 0.03, 0.9 + rnd() * bowH * 0.5, 0.204));
    }
    out.push(place(slab(dark, -0.9, -0.9, -0.03, 0.9, 0.9, 0.03), { at: [1.2, 1.2, -6.5], ry: 0.5, rx: 0.4 }));
  }
  const boxes = [
    [-2.9, 0, -0.2, 2.9, bowH, 0.2],
    [-2.9, 0, -9.8, -2.5, sideH[0], -2.0],
    [2.5, 0, -9.8, 2.9, sideH[1], -2.0],
  ];
  if (step) boxes.push([-2.3, 0, 0.45, 2.3, 1.17, 1.35]);
  return withCollision(out, boxes);
}

/**
 * An angle iron (L section, legs `leg`, `t` thick) from a to b, turned `roll` about its own length. Used for the
 * Czech hedgehog's three beams.
 */
function angleIron(colour, a, b, leg, t, roll) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const ry = Math.atan2(d[0], d[2]);
  const rx = -Math.atan2(d[1], Math.hypot(d[0], d[2]));
  const o = -leg / 3;
  const legs = [box(colour, [leg, t, len], [o + leg / 2, o + t / 2, 0]), box(colour, [t, leg, len], [o + t / 2, o + leg / 2, 0])];
  return legs.map((p) => place(place(p, { rz: roll }), { at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rx, ry }));
}

/** Square timbers: a balk `w` square and `len` long along Z at (x, y, z) (y its underside). */
function timber(w, len, [x, y, z], ry = 0, colour = 'woodGrey') {
  const out = [box(colour, [w, w, len], [0, w / 2, 0])];
  return out.map((p) => place(p, { at: [x, y, z], ry }));
}

const PIECES = {
  // ------------------------------------------------ 01 Military Compound
  sandbag_wall: () => bagRows(2.48, 4, 2),
  sandbag_wall_low: () => bagRows(2.48, 2, 2),
  sandbag_corner: () => [
    ...bagRows(1.86, 4, 1).map((p) => place(p, { at: [0.31, 0, -0.62] })),
    ...bagRows(1.24, 4, 1).map((p) => place(p, { at: [-0.62, 0, 0.31], ry: Math.PI / 2 })),
  ],
  sandbag_nest: () => bagArc(1.8, 0, Math.PI, 4),
  hesco_wall: () => {
    // Two wire-mesh gabions filled with earth.
    const out = [];
    for (const x of [-0.55, 0.55]) {
      out.push(box('earth', [1.02, 1.3, 1.02], [x, 0.65, 0]));
      for (const y of [0.02, 0.45, 0.88, 1.31]) out.push(box('mesh', [1.08, 0.04, 1.08], [x, y, 0]));
      for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push(box('mesh', [0.05, 1.34, 0.05], [x + dx * 0.53, 0.67, dz * 0.53]));
      out.push(box('burlapDark', [0.9, 0.06, 0.9], [x, 1.33, 0]));
    }
    return out;
  },
  hedgehog: () => {
    // Three steel beams square to each other, crossed through the middle and
    // stood on three of their ends (the (1, 1, 1) diagonal straight up).
    const L = 2.2;
    const h = 1 / Math.sqrt(3);
    const s = Math.sqrt(2 / 3);
    const cy = (L / 2) * h + 0.06;
    return [0, 1, 2].map((i) => {
      const t = (i * 2 * Math.PI) / 3;
      const d = [s * Math.cos(t), h, s * Math.sin(t)];
      return beam(i === 1 ? 'rust' : 'steelDark', [-d[0] * L / 2, cy - (d[1] * L) / 2, -d[2] * L / 2], [d[0] * L / 2, cy + (d[1] * L) / 2, d[2] * L / 2], 0.13);
    });
  },
  dragon_tooth: () => [place(cylinder('concrete', 0.55, 0, 0.9, 4, 0.12), { ry: Math.PI / 4 }), box('concrete', [0.85, 0.1, 0.85], [0, 0.05, 0])],
  ammo_crate: () => [
    box('olive', [0.9, 0.42, 0.48], [0, 0.21, 0]),
    box('oliveDark', [0.94, 0.06, 0.52], [0, 0.42, 0]),
    box('stencil', [0.5, 0.08, 0.01], [0, 0.22, 0.245]),
    box('steelDark', [0.12, 0.06, 0.03], [-0.47, 0.3, 0]),
    box('steelDark', [0.12, 0.06, 0.03], [0.47, 0.3, 0]),
  ],
  ammo_stack: () => {
    const crate = PIECES.ammo_crate();
    return [...crate.map((p) => place(p, { at: [-0.48, 0, 0] })), ...crate.map((p) => place(p, { at: [0.48, 0, 0] })), ...crate.map((p) => place(p, { at: [0, 0.45, 0], ry: 0.12 }))];
  },
  fuel_drum: () => [
    cylinder('olive', 0.3, 0, 0.9, 14),
    place(ring('oliveDark', 0.3, 0.015, 14, 3), { at: [0, 0.3, 0], rx: Math.PI / 2 }),
    place(ring('oliveDark', 0.3, 0.015, 14, 3), { at: [0, 0.6, 0], rx: Math.PI / 2 }),
    box('stencil', [0.3, 0.12, 0.01], [0, 0.45, 0.3]),
    cylinder('steelDark', 0.05, 0.9, 0.93, 8),
  ],
  burn_barrel: () => [
    // An open oil drum burning scrap wood: rusted, scorched round the rim, charred logs over the embers. The flame
    // itself is the pack's campfire effect (content/props/tiletrigger-kit.json "flame").
    cylinder('rust', 0.3, 0, 0.86, 14),
    cylinder('iron', 0.305, 0.74, 0.86, 14),
    place(ring('iron', 0.3, 0.016, 14, 3), { at: [0, 0.3, 0], rx: Math.PI / 2 }),
    place(ring('iron', 0.3, 0.016, 14, 3), { at: [0, 0.58, 0], rx: Math.PI / 2 }),
    place(ring('steelDark', 0.3, 0.02, 14, 3), { at: [0, 0.86, 0], rx: Math.PI / 2 }),
    cylinder('char', 0.27, 0.86, 0.875, 12),
    cylinder('ember', 0.16, 0.875, 0.885, 10),
    beam('char', [-0.22, 0.8, 0.05], [0.12, 1.02, -0.04], 0.07),
    beam('char', [0.2, 0.8, 0.12], [-0.06, 1.0, -0.1], 0.06),
    beam('woodDark', [0.04, 0.8, -0.22], [0.02, 1.04, 0.1], 0.06),
    // Air holes punched round the foot.
    ...[0, 1, 2, 3, 4, 5].map((i) => place(box('char', [0.07, 0.05, 0.02], [0, 0.1, 0.301]), { ry: (i * Math.PI) / 3 })),
  ],
  razor_wire: () => {
    // A concertina coil 3 m long on a few pickets.
    const out = [];
    for (let i = 0; i < 16; i++) out.push(place(ring('wire', 0.42, 0.012, 14, 3), { at: [-1.5 + i * 0.2, 0.44, 0], ry: Math.PI / 2 + (i % 2 ? 0.25 : -0.25) }));
    for (const x of [-1.4, 0, 1.4]) out.push(box('steelDark', [0.05, 1.0, 0.05], [x, 0.5, 0.25]), box('steelDark', [0.05, 1.0, 0.05], [x, 0.5, -0.25]));
    return out;
  },
  camo_net: () => {
    // A net on four poles, sagging between them, with leafy patches.
    const out = [];
    for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [1.9, 1.9], [-1.9, 1.9]]) out.push(box('woodDark', [0.1, 2.6, 0.1], [x, 1.3, z]));
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const x = -1.9 + i * 0.95;
        const z = -1.9 + j * 0.95;
        const sag = 0.25 * Math.sin((i / 4) * Math.PI) * Math.sin((j / 4) * Math.PI);
        out.push(place(box((i + j) % 2 ? 'net' : 'netLight', [1.0, 0.04, 1.0]), { at: [x, 2.55 - sag, z], rx: (j - 2) * 0.06, rz: (2 - i) * 0.06 }));
      }
    }
    return out;
  },
  // ------------------------------------------------ beach defences and landing craft (01 Military Compound)
  // The landing craft the assault comes ashore in: ramp up, sides 2.97 m, the bow skid in front of the ramp.
  landing_craft: () => landingCraft({ bowH: 3.87, sideH: [2.97, 2.97], step: true, wreck: false }),
  // A wrecked one, rusted and torn, sunk in the sand at any depth: ramp 3.69 m, one side 0.2 m higher, the other
  // 0.5 m lower (the shape of the map's six hulks; how deep it sits is how tall it stands).
  landing_craft_wreck: () => landingCraft({ bowH: 3.69, sideH: [3.19, 3.89], step: false, wreck: true }),
  hedgehog_beach: () => {
    // A Czech hedgehog as the beaches had them: three rolled-steel angles 2.5 m long, square to each other, riveted
    // through gussets where they cross and stood on three of their ends (about 1.5 m tall). Collision: each beam as
    // six short boxes along it, so shots and players pass between the beams.
    const L = 2.5;
    const h = 1 / Math.sqrt(3);
    const s = Math.sqrt(2 / 3);
    const cy = (L / 2) * h + 0.04;
    const out = [];
    const boxes = [];
    for (let i = 0; i < 3; i++) {
      const t = (i * 2 * Math.PI) / 3 + 0.3;
      const d = [s * Math.cos(t), h, s * Math.sin(t)];
      const a = [(-d[0] * L) / 2, cy - (d[1] * L) / 2, (-d[2] * L) / 2];
      const b = [(d[0] * L) / 2, cy + (d[1] * L) / 2, (d[2] * L) / 2];
      out.push(...angleIron(i === 1 ? 'rustDeep' : 'rust', a, b, 0.16, 0.022, i * 2.1 + 0.6));
      out.push(place(box('rustDeep', [0.26, 0.03, 0.26]), { at: [a[0], 0.015, a[2]], ry: t }));
      const at = (u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
      for (let k = 0; k < 6; k++) {
        const [p, q] = [at(k / 6), at((k + 1) / 6)];
        const r = 0.08;
        boxes.push([Math.min(p[0], q[0]) - r, Math.max(0, Math.min(p[1], q[1]) - r), Math.min(p[2], q[2]) - r, Math.max(p[0], q[0]) + r, Math.max(p[1], q[1]) + r, Math.max(p[2], q[2]) + r]);
      }
    }
    out.push(place(box('rustDeep', [0.34, 0.34, 0.03]), { at: [0, cy, 0], rx: 0.6, ry: 0.4 }), place(box('rustDeep', [0.3, 0.3, 0.03]), { at: [0, cy, 0], rx: -0.5, ry: 2.2 }));
    for (let i = 0; i < 6; i++) out.push(place(cylinder('rustDeep', 0.025, -0.04, 0.04, 6), { at: [Math.cos(i) * 0.1, cy + Math.sin(i * 1.7) * 0.1, Math.sin(i) * 0.1], rx: i }));
    return withCollision(out, boxes);
  },
  sandbag_stack: () => {
    // A square stack of bags, each course crossing the one below (about 1.05 m square and 1 m high): cover that
    // shooting wears down (breakable).
    const out = [];
    for (let r = 0; r < 5; r++)
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 3; j++) {
          const u = (i - 0.5) * 0.52;
          const v = (j - 1) * 0.34;
          const [x, z, ry] = r % 2 ? [v, u, Math.PI / 2] : [u, v, 0];
          out.push(sandbag(x, r * 0.2, z, ry + (((i + j + r) % 3) - 1) * 0.04, 0.52));
        }
    return out;
  },
  timber_baulk: () => {
    // A squared beach-obstacle timber lying in the sand (0.5 m square, 1.8 m long), strapped and bolted, sea-greyed.
    const out = timber(0.5, 1.8, [0, 0, 0]);
    for (const z of [-0.55, 0.55]) out.push(slab('iron', -0.26, 0, z - 0.04, 0.26, 0.51, z + 0.04), place(cylinder('iron', 0.035, 0.5, 0.53, 8), { at: [0, 0, z + 0.12] }));
    return out;
  },
  timber_stack: () => {
    // Beach-obstacle timbers stacked as a crib (2.4 × 1 × 1.3 m): four along, two bearers across, three on top.
    const out = [];
    for (const [i, z] of [-0.495, -0.165, 0.165, 0.495].entries()) out.push(...timber(0.32, 2.4 - (i % 2) * 0.12, [(i % 2) * 0.05, 0, z], Math.PI / 2));
    for (const x of [-0.95, 0.95]) out.push(...timber(0.32, 1.32, [x, 0.32, 0], 0, 'woodDark'));
    for (const [i, z] of [-0.34, 0, 0.34].entries()) out.push(...timber(0.32, 2.3 - i * 0.1, [-0.04 + i * 0.03, 0.64, z], Math.PI / 2, i === 1 ? 'woodDark' : 'woodGrey'));
    out.push(slab('woodDark', -0.6, 0, -0.66, -0.54, 0.97, 0.66), slab('woodDark', 0.54, 0, -0.66, 0.6, 0.97, 0.66));
    return out;
  },
  dory: () => {
    // A double-ended wooden boat (2.8 m, 1.5 m beam) beached on its keel: painted outside, bare wood inside, two
    // thwarts and an oar. Breakable, like the rowing boat it stands in for.
    const out = [];
    const N = 10;
    const L = 1.4;
    const st = Array.from({ length: N + 1 }, (_, i) => {
      const x = -L + (2 * L * i) / N;
      const f = Math.abs(x / L);
      const w = Math.max(0.03, 0.75 * (1 - f ** 2.4) ** 0.55);
      return { x, w, wb: Math.max(0.02, w * 0.5), top: 0.6 + 0.1 * f * f, bot: 0.14 * f * f };
    });
    const quad = (colour, a, b, c, d, hint) => {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const l = Math.hypot(...n) || 1;
      n = n.map((k) => k / l);
      const flip = n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0;
      const pts = flip ? [a, d, c, b] : [a, b, c, d];
      const nn = flip ? n.map((k) => -k) : n;
      return part(colour, pts.flat(), [nn, nn, nn, nn].flat(), [0, 1, 2, 0, 2, 3]);
    };
    for (let i = 0; i < N; i++) {
      const [p, q] = [st[i], st[i + 1]];
      for (const k of [-1, 1]) {
        // Outside (two strakes: the lap line between them), inside an inch in.
        const mid = (s) => [s.x, s.bot + (s.top - s.bot) * 0.5, k * (s.wb + (s.w - s.wb) * 0.55)];
        out.push(quad('paintGrey', [p.x, p.bot, k * p.wb], [q.x, q.bot, k * q.wb], mid(q), mid(p), [0, -0.3, k]));
        out.push(quad('paintGrey', mid(p), mid(q), [q.x, q.top, k * q.w], [p.x, p.top, k * p.w], [0, 0, k]));
        const inn = (s, y, w) => [s.x, y, k * Math.max(0.01, w - 0.035)];
        out.push(quad('wood', inn(p, p.bot + 0.04, p.wb), inn(q, q.bot + 0.04, q.wb), inn(q, q.top, q.w), inn(p, p.top, p.w), [0, 0.3, -k]));
        out.push(beam('woodDark', [p.x, p.top, k * p.w], [q.x, q.top, k * q.w], 0.05));
        out.push(beam('woodDark', mid(p), mid(q), 0.025));
      }
      out.push(quad('paintGrey', [p.x, p.bot, -p.wb], [q.x, q.bot, -q.wb], [q.x, q.bot, q.wb], [p.x, p.bot, p.wb], [0, -1, 0]));
      out.push(quad('wood', [p.x, p.bot + 0.04, -p.wb + 0.03], [q.x, q.bot + 0.04, -q.wb + 0.03], [q.x, q.bot + 0.04, q.wb - 0.03], [p.x, p.bot + 0.04, p.wb - 0.03], [0, 1, 0]));
    }
    out.push(beam('woodDark', [-L - 0.02, 0.72, 0], [-L + 0.25, 0.0, 0], 0.07), beam('woodDark', [L + 0.02, 0.72, 0], [L - 0.25, 0.0, 0], 0.07));
    for (const x of [-0.45, 0.4]) {
      const w = st[Math.round(((x + L) / (2 * L)) * N)].w;
      out.push(slab('woodDark', x - 0.12, 0.4, -w + 0.06, x + 0.12, 0.45, w - 0.06));
    }
    out.push(beam('wood', [-1.0, 0.2, -0.25], [0.95, 0.42, 0.32], 0.05), place(box('wood', [0.4, 0.02, 0.13]), { at: [1.05, 0.44, 0.35], ry: -0.28 }));
    return out;
  },
  straw_bale: () => {
    // A square bale of straw (1.3 × 0.75 × 0.9 m), two twine bands round it. Breakable.
    const out = [place(bag('straw', [0.65, 0.375, 0.45], 0.16, 12, 8), { at: [0, 0.375, 0] })];
    for (const x of [-0.33, 0.33]) out.push(place(bag('twine', [0.02, 0.379, 0.454], 0.16, 6, 8), { at: [x, 0.375, 0] }));
    return out;
  },
  // ------------------------------------------------ 02 Frontier Dust
  mine_cart: () => cart(false),
  ore_cart: () => cart(true),
  dynamite_crate: () => {
    const out = [box('woodLight', [0.8, 0.5, 0.55], [0, 0.25, 0]), box('woodDark', [0.82, 0.06, 0.57], [0, 0.03, 0]), box('woodDark', [0.82, 0.06, 0.57], [0, 0.47, 0]), box('red', [0.5, 0.14, 0.01], [0, 0.27, 0.28])];
    for (let i = 0; i < 6; i++) out.push(...stick(-0.25 + i * 0.1, 0.55, (i % 2) * 0.06 - 0.03, Math.PI / 2 + (i % 3) * 0.1));
    return out;
  },
  dynamite_bundle: () => {
    const out = [];
    for (const [y, z] of [[0.035, -0.04], [0.035, 0.04], [0.1, 0]]) out.push(...stick(0, y, z));
    out.push(place(ring('ink', 0.075, 0.008, 10, 3), { at: [-0.05, 0.06, 0], ry: Math.PI / 2 }), place(ring('ink', 0.075, 0.008, 10, 3), { at: [0.05, 0.06, 0], ry: Math.PI / 2 }));
    return out;
  },
  hitching_post: () => [
    box('wood', [0.14, 1.1, 0.14], [-1.1, 0.55, 0]),
    box('wood', [0.14, 1.1, 0.14], [1.1, 0.55, 0]),
    box('woodLight', [2.5, 0.12, 0.12], [0, 1.0, 0]),
    place(ring('iron', 0.06, 0.012, 8, 3), { at: [-0.5, 0.9, 0.07] }),
    place(ring('iron', 0.06, 0.012, 8, 3), { at: [0.5, 0.9, 0.07] }),
  ],
  water_trough: () => [
    box('wood', [2.0, 0.08, 0.6], [0, 0.34, 0]),
    box('wood', [2.0, 0.42, 0.06], [0, 0.55, 0.27]),
    box('wood', [2.0, 0.42, 0.06], [0, 0.55, -0.27]),
    box('woodDark', [0.06, 0.42, 0.6], [0.97, 0.55, 0]),
    box('woodDark', [0.06, 0.42, 0.6], [-0.97, 0.55, 0]),
    box('water', [1.88, 0.02, 0.48], [0, 0.66, 0]),
    box('woodDark', [0.12, 0.3, 0.6], [-0.8, 0.15, 0]),
    box('woodDark', [0.12, 0.3, 0.6], [0.8, 0.15, 0]),
  ],
  wagon_wheel: () => wheel(0, 0.62, 0, 0.6).map((p) => place(p, { ry: Math.PI / 2, at: [0, 0, 0] })),
  wanted_board: () => [
    box('woodDark', [0.12, 2.1, 0.12], [-0.55, 1.05, 0]),
    box('woodDark', [0.12, 2.1, 0.12], [0.55, 1.05, 0]),
    box('wood', [1.4, 0.9, 0.06], [0, 1.45, 0.02]),
    box('woodDark', [1.6, 0.1, 0.25], [0, 1.95, 0.04]),
    box('paper', [0.34, 0.46, 0.01], [-0.35, 1.45, 0.06]),
    box('paper', [0.34, 0.46, 0.01], [0.32, 1.5, 0.06]),
    box('ink', [0.2, 0.2, 0.012], [-0.35, 1.5, 0.062]),
    box('ink', [0.2, 0.2, 0.012], [0.32, 1.55, 0.062]),
    box('ink', [0.26, 0.04, 0.012], [-0.35, 1.32, 0.062]),
    box('ink', [0.26, 0.04, 0.012], [0.32, 1.37, 0.062]),
  ],
  outhouse: () => [
    box('woodLight', [1.3, 2.2, 1.3], [0, 1.1, 0]),
    place(box('woodDark', [1.5, 0.08, 1.6]), { at: [0, 2.32, 0], rx: 0.18 }),
    box('wood', [0.8, 1.9, 0.04], [0, 0.98, 0.66]),
    place(ring('ink', 0.06, 0.02, 8, 3), { at: [0, 1.65, 0.69] }),
    box('iron', [0.04, 0.1, 0.04], [0.3, 1.0, 0.69]),
  ],
  rail_buffer: () => [
    box('woodDark', [2.4, 0.5, 0.35], [0, 0.95, 0]),
    box('red', [2.4, 0.12, 0.36], [0, 1.0, 0.01]),
    box('woodDark', [0.3, 1.2, 0.3], [-0.8, 0.6, -0.1]),
    box('woodDark', [0.3, 1.2, 0.3], [0.8, 0.6, -0.1]),
    beam('wood', [-0.8, 0.05, -1.2], [-0.8, 0.9, -0.15], 0.22),
    beam('wood', [0.8, 0.05, -1.2], [0.8, 0.9, -0.15], 0.22),
    box('iron', [0.25, 0.25, 0.1], [-0.6, 0.95, 0.22]),
    box('iron', [0.25, 0.25, 0.1], [0.6, 0.95, 0.22]),
  ],
  mine_frame: () => [
    box('woodDark', [0.3, 3.2, 0.3], [-1.75, 1.6, 0]),
    box('woodDark', [0.3, 3.2, 0.3], [1.75, 1.6, 0]),
    box('wood', [4.1, 0.35, 0.36], [0, 3.37, 0]),
    beam('woodDark', [-1.75, 2.6, 0], [-1.2, 3.2, 0], 0.16),
    beam('woodDark', [1.75, 2.6, 0], [1.2, 3.2, 0], 0.16),
    box('paper', [0.9, 0.3, 0.04], [0, 3.37, 0.2]),
    box('ink', [0.7, 0.08, 0.045], [0, 3.37, 0.2]),
  ],
  tumbleweed: () => {
    const out = [];
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39996;
      const b = Math.acos(1 - (2 * (i + 0.5)) / 14);
      out.push(place(ring(i % 2 ? 'straw' : 'woodLight', 0.34, 0.012, 10, 3), { at: [0, 0.38, 0], rx: b, ry: a }));
    }
    return out;
  },
  covered_wagon: () => {
    const out = [box('wood', [1.7, 0.5, 3.6], [0, 1.05, 0]), box('woodDark', [1.75, 0.08, 3.65], [0, 0.82, 0])];
    // The canvas: a vault over the bed, its hoops showing at the ends.
    out.push(place(vault('canvas', 0.86, 3.3, 14), { at: [0, 1.3, 0], scale: [1, 1.2, 1] }));
    out.push(place(ring('woodDark', 0.86, 0.03, 14, 3), { at: [0, 1.3, 1.66], scale: [1, 1.2, 1] }), place(ring('woodDark', 0.86, 0.03, 14, 3), { at: [0, 1.3, -1.66], scale: [1, 1.2, 1] }));
    for (const [z, r] of [[-1.35, 0.6], [1.3, 0.48]]) for (const x of [-0.95, 0.95]) out.push(...wheel(x, r, z, r));
    out.push(beam('woodDark', [0, 0.7, 1.8], [0, 0.4, 3.2], 0.1));
    return out;
  },
  wind_pump: () => {
    const out = [];
    const H = 7.5;
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push(beam('woodDark', [x * 1.1, 0, z * 1.1], [x * 0.3, H, z * 0.3], 0.14));
    for (const y of [1.8, 3.6, 5.4]) {
      const s = 1.1 - (0.8 * y) / H;
      out.push(box('wood', [2 * s + 0.1, 0.08, 0.08], [0, y, s]), box('wood', [2 * s + 0.1, 0.08, 0.08], [0, y, -s]), box('wood', [0.08, 0.08, 2 * s + 0.1], [s, y, 0]), box('wood', [0.08, 0.08, 2 * s + 0.1], [-s, y, 0]));
    }
    out.push(box('wood', [0.9, 0.12, 0.9], [0, H, 0]));
    out.push(place(cylinder('iron', 0.12, 0, 0.6, 8), { at: [0, H + 0.4, 0.1], rx: Math.PI / 2 }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      out.push(place(box(i % 2 ? 'white' : 'steel', [0.22, 1.2, 0.03]), { at: [Math.cos(a) * 0.75, H + 0.4 + Math.sin(a) * 0.75, 0.72], rz: a - Math.PI / 2, ry: 0.25 }));
    }
    out.push(place(ring('steelDark', 0.75, 0.02, 16, 3), { at: [0, H + 0.4, 0.72] }));
    out.push(box('steel', [0.06, 0.5, 1.6], [0, H + 0.4, -0.8]), box('steel', [0.04, 0.9, 0.7], [0, H + 0.4, -1.6]));
    out.push(cylinder('steelDark', 0.05, 0, H, 6));
    return out;
  },
};

/** A mine cart: a tapered iron tub on four small wheels, empty or heaped with ore. */
function cart(full) {
  const out = [
    box('rust', [0.9, 0.08, 1.3], [0, 0.32, 0]),
    place(box('iron', [1.0, 0.62, 0.06]), { at: [0, 0.66, 0.68], rx: 0.12 }),
    place(box('iron', [1.0, 0.62, 0.06]), { at: [0, 0.66, -0.68], rx: -0.12 }),
    place(box('rust', [0.06, 0.62, 1.4]), { at: [0.5, 0.66, 0], rz: -0.12 }),
    place(box('rust', [0.06, 0.62, 1.4]), { at: [-0.5, 0.66, 0], rz: 0.12 }),
    box('iron', [1.12, 0.06, 0.06], [0, 0.98, 0.72]),
    box('iron', [1.12, 0.06, 0.06], [0, 0.98, -0.72]),
    box('steelDark', [0.7, 0.1, 0.2], [0, 0.22, 0.45]),
    box('steelDark', [0.7, 0.1, 0.2], [0, 0.22, -0.45]),
  ];
  for (const z of [-0.45, 0.45]) for (const x of [-0.46, 0.46]) out.push(disc(x, 0.17, z, 0.17));
  if (full) for (let i = 0; i < 9; i++) out.push(place(bag(i % 4 === 0 ? 'gold' : 'ore', [0.16, 0.12, 0.14], 0.8, 6, 4), { at: [(i % 3) * 0.28 - 0.28, 0.98 + (i === 4 ? 0.12 : 0), Math.floor(i / 3) * 0.36 - 0.36], ry: i }));
  return out;
}

// ---------------------------------------------------------------- write

const linear = (hex) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.2);
const io = new NodeIO();
mkdirSync(OUT, { recursive: true });
for (const [name, build] of Object.entries(PIECES)) {
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene(name);
  const node = doc.createNode(name);
  scene.addChild(node);
  const mesh = doc.createMesh(name);
  node.setMesh(mesh);
  // One primitive per colour; a piece with surfaces, one per surface (its colours as vertex colours).
  const rules = SURFACES.props?.[name];
  const groupOf = (colour) => (rules ? (rules.materials?.[colour] ?? rules.default) : colour);
  const byGroup = new Map();
  const parts = build();
  // Pieces with their own collision (collide "model") carry the boxes in the node's extras, in this frame.
  if (parts.collision) node.setExtras({ collision: parts.collision.map((b) => b.map((v) => Math.round(v * 1000) / 1000)) });
  for (const p of parts) {
    const list = byGroup.get(groupOf(p.colour)) ?? [];
    list.push(p);
    byGroup.set(groupOf(p.colour), list);
  }
  const groups = [...byGroup.values()].map((parts) => {
    // Named after its colour with the most triangles: the surfaces map reads a material's name (surfaces.mjs).
    const tris = new Map();
    for (const p of parts) tris.set(p.colour, (tris.get(p.colour) ?? 0) + p.indices.length);
    const colour = [...tris].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    return { colour, parts, painted: tris.size > 1 };
  });
  for (const { colour, parts, painted } of groups.sort((a, b) => a.colour.localeCompare(b.colour))) {
    const pos = [];
    const nor = [];
    const col = [];
    const idx = [];
    for (const p of parts) {
      const base = pos.length / 3;
      pos.push(...p.positions);
      nor.push(...p.normals);
      // Linear colour in bytes (a quarter of the floats' size; flat colours need no more).
      if (painted) for (let i = 0; i < p.positions.length / 3; i++) col.push(...linear(COLOURS[p.colour]).map((v) => Math.round(v * 255)), 255);
      idx.push(...p.indices.map((i) => i + base));
    }
    // Painted with vertex colours: a white material, so each part shows its own colour as it is.
    const material = doc.createMaterial(colour).setBaseColorFactor(painted ? [1, 1, 1, 1] : [...linear(COLOURS[colour]), 1]).setRoughnessFactor(0.85).setMetallicFactor(/steel|iron|wire|mesh/.test(colour) ? 0.4 : 0);
    const prim = doc
      .createPrimitive()
      .setMaterial(material)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos.map((v) => Math.round(v * 10000) / 10000))))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor.map((v) => Math.round(v * 10000) / 10000))))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)));
    if (painted) prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setArray(new Uint8Array(col)).setNormalized(true));
    mesh.addPrimitive(prim);
  }
  doc.getRoot().getAsset().generator = 'tiletrigger build-kit-props';
  writeFileSync(join(OUT, `${name}.glb`), await io.writeBinary(doc));
  console.log(name);
}
