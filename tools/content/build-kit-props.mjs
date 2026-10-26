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

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'assets-src/tiletrigger-kit');

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
  // One primitive per colour.
  const byColour = new Map();
  for (const p of build()) {
    const list = byColour.get(p.colour) ?? [];
    list.push(p);
    byColour.set(p.colour, list);
  }
  for (const [colour, parts] of [...byColour.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const pos = [];
    const nor = [];
    const idx = [];
    for (const p of parts) {
      const base = pos.length / 3;
      pos.push(...p.positions);
      nor.push(...p.normals);
      idx.push(...p.indices.map((i) => i + base));
    }
    const material = doc.createMaterial(colour).setBaseColorFactor([...linear(COLOURS[colour]), 1]).setRoughnessFactor(0.85).setMetallicFactor(/steel|iron|wire|mesh/.test(colour) ? 0.4 : 0);
    const prim = doc
      .createPrimitive()
      .setMaterial(material)
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos.map((v) => Math.round(v * 10000) / 10000))))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor.map((v) => Math.round(v * 10000) / 10000))))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)));
    mesh.addPrimitive(prim);
  }
  doc.getRoot().getAsset().generator = 'tiletrigger build-kit-props';
  writeFileSync(join(OUT, `${name}.glb`), await io.writeBinary(doc));
  console.log(name);
}
