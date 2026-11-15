// The Arena Corner tiles (Flavius Rule's octagon, phase 2: docs/map-briefs/sandfall_colosseum/OCTAGON_PLAN.md §2,
// §3.2): a 45° corner of an arena's stands, one big tile per storey band, made from the kit's parts (box, flight,
// wallRun, turned) so tools/content/tiles.mjs checks and writes them with the rest of the kit.
//
// The geometry, in the frame of the north-east corner of an arena whose centre is the origin (x east, z north; the
// tile's anchor cell is the cell at x 12..20, z 12..20, so the tile's own frame is this one moved by (-16, -16)):
// - Straight stands meet it on two sides: the north stand along x = 12 (its rows run east-west, their fronts on
//   z = 28 + depth), the east one along z = 12 (the same turned a quarter). The diagonal front is |x| + |z| = 40,
//   22.6 m long, between the inner vertices (12, 28) and (28, 12).
// - Every point of the corner has a depth: max(z - 28, x - 28, (x + z - 40) / √2), so the tiers keep their depth all
//   the way round and meet at the mitres, lines at 22.5° from each inner vertex out to the facade.
// - Depth 0-8: the podium (2 m wall, walkway, eight rows of 0.25 m, the top walkway at 4 m), as Arena Seating.
//   Depth 8-48: rows 1 m deep and 0.5 m high (the Seating Tier's), 4 m to 24 m, each a single long box between
//   aisles. Galleries behind the seats at levels 0, 2 and 4 (depth 8-16, 24-32, 40-48), solid fill under the upper
//   tiers, the Grand Arcades' facade (depth 48-56, levels 0-5) and the attic walk on top (level 6).
// - Aisles: one up each mitre (2.4 m clear between cheek walls 0.5 m thick, under which both sides' rows end), one up
//   the diagonal's centre line, and the vomitorium on the upper tier's centre line with an aisle either side.
// - Boxes of two sectors meet at a mitre by each running to the mitre at its deeper edge: the bit past the mitre at its
//   shallower edge lies inside the neighbour's box of the same band, so there is no gap and nothing shows.
// The north wedge (x 12 to the mitre) is written out; the east wedge is its mirror image across the diagonal (`D`);
// the diagonal sector is built in its own frame (u along the rows, v the depth) and turned 45°; so each tile is its
// own mirror image across the diagonal, and a mirrored corner is a turned one (map/setPieces.ts tileDiagonalMirror).

const R2 = Math.SQRT2;
const T = Math.tan(Math.PI / 8);
const C = Math.cos(Math.PI / 8);
const S = Math.sin(Math.PI / 8);
/** Half the diagonal front (u of the inner vertex). */
const VTX = 8 * R2;
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;

/** The mitre's x in the north wedge at depth d, moved `w` m off it into the wedge. */
const xm = (d, w = 0) => 12 + T * d - w / C;
/** The mitre's u in the diagonal (its west half) at depth d, moved `w` m off it into the diagonal. */
const um = (d, w = 0) => -(VTX + T * d) + w / C;

// Frames. The north wedge: world (x, z) to the tile's frame. The diagonal: its group's own coordinates (u, v) about
// the pivot (4, 4) (world (20, 20), the middle of the diagonal front), turned 45° (+u toward the east end).
const WX = (x) => r4(x - 16);
const WZ = (d) => r4(12 + d);
const DU = (u) => r4(4 + u);
const DV = (v) => r4(4 + v);
const DIAG_PIVOT = [4, 4];
/** The north mitre's frame: a across it (+ toward the diagonal), s along it from the vertex (12, 28) = tile (-4, 12). */
const MITRE_PIVOT = [-4, 12];
const MA = (a) => r4(-4 + a);
const MS = (s) => r4(12 + s);

const box = (x0, y0, z0, x1, y1, z1, kind, extra = {}) => ({ box: [r4(x0), r4(y0), r4(z0), r4(x1), r4(y1), r4(z1)], ...(kind ? { kind } : {}), ...extra });
/** A box of the north wedge over depth d0..d1 from x = 12 to x1. */
const wedgeBox = (d0, d1, y0, y1, x1, kind) => box(WX(12), y0, WZ(d0), WX(x1), y1, WZ(d1), kind);
/** A box of the diagonal over depth v0..v1 from u0 to u1. */
const diagBox = (v0, v1, y0, y1, u0, u1, kind) => box(DU(u0), y0, DV(v0), DU(u1), y1, DV(v1), kind);

// ---------------------------------------------------------------- the mirror across the diagonal

/** A part mirrored across the diagonal x = z of the tile's frame (east and north swapped). */
export function mirrorPart(p) {
  const out = { ...p };
  if (p.box) {
    const [x0, y0, z0, x1, y1, z1] = p.box;
    out.box = [z0, y0, x0, z1, y1, x1];
    if (p.yaw !== undefined) out.yaw = r4(-p.yaw);
    delete out.pitch;
    delete out.roll;
    if (p.pitch !== undefined) out.roll = p.pitch;
    if (p.roll !== undefined) out.pitch = p.roll;
  } else if (p.flight) out.flight = { ...p.flight, axis: p.flight.axis === 'x' ? 'z' : 'x' };
  else if (p.wallRun) {
    const w = p.wallRun;
    const side = w.side === 'right' ? 'left' : w.side === 'centre' ? 'centre' : 'right';
    out.wallRun = { ...w, from: [w.from[1], w.from[0]], to: [w.to[1], w.to[0]], side };
    if (side === 'left') delete out.wallRun.side;
  } else if (p.turned) {
    const g = p.turned;
    out.turned = { ...(g.turns !== undefined ? { turns: -g.turns } : { yaw: -g.yaw }), pivot: [g.pivot[1], g.pivot[0]], parts: g.parts.map(mirrorPart) };
  } else throw new Error(`arena corner: no mirror for ${JSON.stringify(p)}`);
  return out;
}

/** A diagonal part mirrored across its centre line (u to -u). */
function flipU(p) {
  const out = { ...p };
  if (p.box) {
    const [x0, y0, z0, x1, y1, z1] = p.box;
    out.box = [r4(8 - x1), y0, z0, r4(8 - x0), y1, z1];
    if (p.yaw !== undefined) out.yaw = r4(-p.yaw);
    if (p.roll !== undefined) out.roll = r4(-p.roll);
  } else if (p.flight) {
    const f = p.flight;
    out.flight = f.axis === 'z' ? { ...f, across: [r4(8 - f.across[1]), r4(8 - f.across[0])] } : { ...f, dir: -f.dir, from: r4(8 - f.from) };
  } else if (p.wallRun) {
    const w = p.wallRun;
    const side = w.side === 'right' ? 'left' : w.side === 'centre' ? 'centre' : 'right';
    out.wallRun = { ...w, from: [r4(8 - w.from[0]), w.from[1]], to: [r4(8 - w.to[0]), w.to[1]], side };
    if (side === 'left') delete out.wallRun.side;
  } else throw new Error(`arena corner: no u-flip for ${JSON.stringify(p)}`);
  return out;
}

// ---------------------------------------------------------------- the profile

/** The podium (depth 0-8, from the sand): [d0, d1, top, kind]; the parapet on its wall. */
const PODIUM = [
  [0, 0.5, 2.0, 'wall'],
  [0.5, 2.0, 2.0, 'floor'],
  ...Array.from({ length: 8 }, (_, i) => [2.0 + i * 0.6, 2.6 + i * 0.6, 2.25 + i * 0.25, 'solid']),
  [6.8, 8.0, 4.0, 'floor'],
];
const PARAPET = [0.05, 0.3, 2.0, 2.75];
/** The rows over depth 8-48: row k is 1 m deep and its top 4.5 + 0.5 k; it stands on its level's floor. */
const ROWS = 40;
const rowTop = (k) => 4.5 + 0.5 * k;
/** The floor a row (or a step) at depth d stands on: the Seating Tier of that level. */
const baseAt = (d) => 4 + 4 * Math.floor((d - 8) / 8);
/** Mitre aisle: clear half-width, and the cheek walls' outer line (both sides' rows end at it). */
const AISLE = 1.2;
const CHEEK = 1.7;
/** Centre aisle half-width (the Seating Tier's), and the vomitorium's (its passage and the aisle each side of it). */
const CENTRE = 1.2;
const VOMIT = [1.6, 4];
/** The galleries: [front depth, back depth, floor]; the upper one opens through its back into the facade's arcade. */
const GALLERIES = [
  [8, 16, 0],
  [24, 32, 8],
  [40, 48, 16],
];
const WALL = 0.5;
const FACADE = [48, 56];
const GRAND = 0.8;

/** How many bays a run of this length has (about 8 m each, as the straight bays). */
const bays = (len) => Math.max(1, Math.round(len / 8));

/** The strips of a shallow barrel vault along the gallery (x in the wedge, u in the diagonal), across depth c0..c1. */
function vaultStrips(c0, c1, spring, crown, along, kind = 'wall', pieces = 12, t = 0.2) {
  // map/catalog.ts vault(), axis x: strips along x, side by side across z (here depth), pitched to follow the curve.
  const c = (c1 - c0) / 2;
  const mid = (c0 + c1) / 2;
  const rise = crown - spring;
  const r = (c * c + rise * rise) / (2 * rise);
  const centre = crown - r;
  const sweep = Math.asin(Math.min(1, c / r));
  const step = (2 * sweep) / pieces;
  const half = r * Math.tan(step / 2);
  const out = [];
  for (let i = 0; i < pieces; i++) {
    const a = -sweep + (i + 0.5) * step;
    const u = mid + (r + t / 2) * Math.sin(a);
    const y = centre + (r + t / 2) * Math.cos(a);
    // Each strip runs to the mitre at its deeper edge.
    out.push({ d0: u - half, d1: u + half, y0: y - t / 2, y1: y + t / 2, pitch: -a, deep: u + half, kind });
  }
  return out;
}

// ---------------------------------------------------------------- one sector each

/**
 * The parts of one tile: `wedge` (the north wedge, tile frame), `mitre` (the north mitre aisle, in its frame), `diag`
 * (the diagonal's west half, its frame) and `axis` (diagonal parts on the centre line, symmetric themselves).
 */
function sectors() {
  return { wedge: [], mitre: [], diag: [], axis: [] };
}

/** A box over depth d0..d1 in every sector, each running to the mitre (moved `w` off it) at d1; `inner`: where the diagonal's half stops (0: it is one box across the centre line). */
function band(t, d0, d1, y0, y1, kind, w = 0, inner = 0) {
  t.wedge.push(wedgeBox(d0, d1, y0, y1, xm(d1, w), kind));
  if (inner === 0) t.axis.push(diagBox(d0, d1, y0, y1, um(d1, w), -um(d1, w), kind));
  else t.diag.push(diagBox(d0, d1, y0, y1, um(d1, w), -inner, kind));
}

/** A row's lip (trim): 2 cm over its top and 4 cm in front of it, as the Seating Tier's. */
function lip(t, k, inner) {
  const d0 = 8 + k;
  const top = rowTop(k);
  const front = k % 8 === 0 ? d0 : d0 - 0.04;
  t.wedge.push(wedgeBox(front, d0 + 0.1, top - 0.07, top + 0.02, xm(d0 + 1, CHEEK), 'trim'));
  t.diag.push(diagBox(front, d0 + 0.1, top - 0.07, top + 0.02, um(d0 + 1, CHEEK), -inner - 0.02, 'trim'));
}

/** Rows k0..k1 (inclusive) with their lips, the centre aisle (or vomitorium) and the mitre aisle over them. */
function rows(t, k0, k1) {
  for (let k = k0; k <= k1; k++) {
    const d0 = 8 + k;
    const vomit = d0 >= 32 && d0 < 40;
    const inner = vomit ? VOMIT[1] : CENTRE;
    band(t, d0, d0 + 1, baseAt(d0), rowTop(k), 'solid', CHEEK, inner);
    lip(t, k, inner);
    // The mitre aisle's cheek walls (both sides), each over the stretch of the mitre where row k ends under it.
    const s0 = (d0 - S * CHEEK) / C;
    const s1 = s0 + 1 / C;
    for (const [a0, a1] of [[-CHEEK, -AISLE], [AISLE, CHEEK]]) t.mitre.push(box(MA(a0), baseAt(d0), MS(s0), MA(a1), rowTop(k) + 0.25, MS(s1), 'wall'));
  }
  // The aisles: 16 steps of 0.25 m a band of 8 rows, each band's steps standing on its floor.
  for (let d = 8 + k0; d < 9 + k1; d += 8) {
    const base = 4 + (d - 8) * 0.5;
    t.mitre.push({ flight: { axis: 'z', dir: 1, from: MS(d / C), across: [MA(-AISLE), MA(AISLE)], steps: 16, base, run: r4(0.5 / C), floor: baseAt(d) } });
    if (d >= 32 && d < 40) {
      // The vomitorium (core.cavea_vomitorium's): a passage 3.2 m wide and 3 m high from the gallery out under the top
      // two rows, a broad aisle stair either side of it.
      t.diag.push({ flight: { axis: 'z', dir: 1, from: DV(d), across: [DU(-VOMIT[1]), DU(-VOMIT[0])], steps: 16, base, floor: baseAt(d) } });
      t.axis.push(diagBox(d + 6, d + 7, base + 3, base + 3.5, -VOMIT[0], VOMIT[0], 'solid'));
      t.axis.push(diagBox(d + 7, d + 8, base + 3, base + 4, -VOMIT[0], VOMIT[0], 'solid'));
      t.axis.push(diagBox(d + 5.96, d + 6.02, base + 2.86, base + 3, -VOMIT[0] - 0.1, VOMIT[0] + 0.1, 'trim'));
    } else t.axis.push({ flight: { axis: 'z', dir: 1, from: DV(d), across: [DU(-CENTRE), DU(CENTRE)], steps: 16, base, floor: baseAt(d) } });
  }
}

/** A wall run in the north wedge along depth d from x0 to x1 (thickness on its left), and its diagonal twin(s). */
function wedgeRun(t, d, x0, x1, style, y, extra = {}) {
  t.wedge.push({ wallRun: { from: [WX(x0), WZ(d)], to: [WX(x1), WZ(d)], style, bays: style === 'wall' ? 1 : bays(Math.abs(x1 - x0)), y, outer: false, ...extra } });
}
function diagRun(t, d, u0, u1, style, y, extra = {}) {
  const run = { wallRun: { from: [DU(u0), DV(d)], to: [DU(u1), DV(d)], style, bays: style === 'wall' ? 1 : bays(Math.abs(u1 - u0)), y, outer: false, ...extra } };
  (Math.abs(u0 + u1) < 1e-9 ? t.axis : t.diag).push(run);
}

/** A gallery: front wall at depth f (its face toward the sand on f), back wall at b, a vault, its floor slab when asked. */
function gallery(t, f, b, y, opts = {}) {
  // Front: a plain wall, its thickness behind the line (toward the gallery), to the mitre at its back face.
  wedgeRun(t, f, 12, xm(f + WALL), 'wall', y);
  if (opts.vomitorium) {
    diagRun(t, f, um(f + WALL), -VOMIT[1], 'wall', y);
    diagRun(t, f, -VOMIT[1], VOMIT[1], 'arch_round', y, { plain: true });
  } else diagRun(t, f, um(f + WALL), -um(f + WALL), 'wall', y);
  // Back: Round arches (blind against the fill, or open into the facade's arcade), thickness in front of the line.
  const end = opts.backTo ?? b;
  wedgeRun(t, b, xm(end), 12, 'arch_round', y, { plain: true });
  diagRun(t, b, -um(end), um(end), 'arch_round', y, { plain: true });
  // The vault (as a vaulted room's: springing 3.02 m, crown 3.29 m, 0.5 m in from each wall).
  for (const s of vaultStrips(f + WALL, b - WALL, y + 3.02, y + 3.29)) {
    const mid = (s.y0 + s.y1) / 2;
    const h = (s.y1 - s.y0) / 2;
    const cz = (s.d0 + s.d1) / 2;
    const hz = (s.d1 - s.d0) / 2;
    const x1 = xm(s.deep);
    t.wedge.push(box(WX(12), mid - h, WZ(cz - hz), WX(x1), mid + h, WZ(cz + hz), 'wall', { pitch: r4(s.pitch) }));
    t.axis.push(box(DU(um(s.deep)), mid - h, DV(cz - hz), DU(-um(s.deep)), mid + h, DV(cz + hz), 'wall', { pitch: r4(s.pitch) }));
  }
  if (opts.floor) band(t, f, b, y - 0.5, y, 'floor');
}

/** Two storeys of the facade's arcade from y: grand arches on both faces, its vault, its floor slab. */
function arcade(t, y, floor) {
  const [f, b] = FACADE;
  // The inner face (on depth 48, thickness behind it) runs to the mitre at 48.8, as the upper gallery's back.
  wedgeRun(t, f, 12, xm(f + GRAND), 'arch_grand', y, { plain: true });
  diagRun(t, f, um(f + GRAND), -um(f + GRAND), 'arch_grand', y, { plain: true });
  // The outer face (on depth 56, dressed outside).
  wedgeRun(t, b, xm(b), 12, 'arch_grand', y, { plain: true, outer: true });
  diagRun(t, b, -um(b), um(b), 'arch_grand', y, { plain: true, outer: true });
  for (const s of vaultStrips(f + GRAND, b - GRAND, y + 6.9, y + 7.29)) {
    const mid = (s.y0 + s.y1) / 2;
    const h = (s.y1 - s.y0) / 2;
    const cz = (s.d0 + s.d1) / 2;
    const hz = (s.d1 - s.d0) / 2;
    t.wedge.push(box(WX(12), mid - h, WZ(cz - hz), WX(xm(s.deep)), mid + h, WZ(cz + hz), 'wall', { pitch: r4(s.pitch) }));
    t.axis.push(box(DU(um(s.deep)), mid - h, DV(cz - hz), DU(-um(s.deep)), mid + h, DV(cz + hz), 'wall', { pitch: r4(s.pitch) }));
  }
  // The floor: on the ground over the whole band, upstairs between the two walls (they carry it).
  if (floor === 'ground') band(t, f, b, y - 0.5, y, 'floor');
  else band(t, f + GRAND, b - GRAND, y - 0.5, y, 'floor');
}

// ---------------------------------------------------------------- the four tiles

function groundParts() {
  const t = sectors();
  // The podium, the parapet on its wall.
  for (const [d0, d1, top, kind] of PODIUM) band(t, d0, d1, 0, top, kind);
  band(t, PARAPET[0], PARAPET[1], PARAPET[2], PARAPET[3], 'wall');
  // The podium's gallery and the first tier of rows over it.
  gallery(t, 8, 16, 0, { floor: true });
  rows(t, 0, 7);
  // Fill under the upper tiers (the mid gallery's floor slab is the mid tile's).
  band(t, 16, 24, 0, 8, 'solid');
  band(t, 24, 32, 0, 7.5, 'solid');
  band(t, 32, 48, 0, 8, 'solid');
  arcade(t, 0, 'ground');
  return t;
}

function midParts() {
  const t = sectors();
  band(t, 24, 32, 7.5, 8, 'floor');
  gallery(t, 24, 32, 8);
  rows(t, 8, 23);
  band(t, 32, 40, 8, 16, 'solid');
  band(t, 40, 48, 8, 15.5, 'solid');
  arcade(t, 8, 'upper');
  return t;
}

function upperParts() {
  const t = sectors();
  band(t, 40, 48, 15.5, 16, 'floor');
  gallery(t, 40, 48, 16, { vomitorium: true, backTo: FACADE[0] + GRAND });
  rows(t, 24, 39);
  arcade(t, 16, 'upper');
  return t;
}

function atticParts() {
  const t = sectors();
  const [f, b] = FACADE;
  // The walk's floor between the arcade's walls (their tops make the rest), the outer wall with its windows, the roof
  // and a parapet round it.
  band(t, f + GRAND, b - GRAND, 23.5, 24, 'floor');
  wedgeRun(t, b, xm(b), 12, 'window', 24, { outer: true });
  diagRun(t, b, -um(b), um(b), 'window', 24, { outer: true });
  band(t, f, b - WALL, 27.5, 28, 'floor');
  band(t, b - WALL, b, 28, 28.6, 'wall');
  return t;
}

// ---------------------------------------------------------------- cells, ports, assembly

/** Depths a tile has on each of its levels. */
const LEVELS = {
  ground: [[0, [0, 56]], [1, [8, 56]]],
  mid: [[2, [16, 56]], [3, [24, 56]]],
  upper: [[4, [32, 56]], [5, [40, 56]]],
  attic: [[6, [48, 56]], [7, [48, 56]]],
};
const depthAt = (x, z) => Math.max(z - 28, x - 28, (x + z - 40) / R2);

/** The tile's cells: those whose ground (x and z from 12) holds some of the band on each level (the half-sand cells on the diagonal stay free at level 0, so a map's sand tiles can stay under the podium's edge). */
function cellsOf(levels) {
  const out = [];
  for (const [level, [lo, hi]] of levels) {
    for (let dy = 0; dy <= 8; dy++) {
      for (let dx = 0; dx <= 8; dx++) {
        let n = 0;
        for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
          const x = 12 + dx * 8 + (i + 0.5) / 2;
          const z = 12 + dy * 8 + (j + 0.5) / 2;
          const d = depthAt(x, z);
          if (d > lo && d < hi) n++;
        }
        // Any of the band (but the half-sand cells either side of the diagonal's front: only the podium's edge).
        if (n > 0 && !(level === 0 && n < 128 && Math.min(dx, dy) === 0)) out.push([dx, dy, level]);
      }
    }
  }
  return out;
}

/** Ports on the sides that meet the straight stands (west of the first column, south of the first row). */
function portsOf(cells) {
  const out = [];
  for (const [dx, dy, level] of cells) {
    if (dx === 0) out.push({ side: 'W', level, cell: [dx, dy] });
    if (dy === 0) out.push({ side: 'S', level, cell: [dx, dy] });
  }
  return out;
}

/** A part moved down by dy (each tile is built at the corner's own heights, then set on its own level). */
function lower(p, dy) {
  if (!dy) return p;
  if (p.box) return { ...p, box: p.box.map((v, i) => (i === 1 || i === 4 ? r4(v - dy) : v)) };
  if (p.flight) return { ...p, flight: { ...p.flight, base: r4((p.flight.base ?? 0) - dy), floor: r4((p.flight.floor ?? 0) - dy) } };
  if (p.wallRun) return { ...p, wallRun: { ...p.wallRun, y: r4((p.wallRun.y ?? 0) - dy) } };
  if (p.turned) return { ...p, turned: { ...p.turned, parts: p.turned.parts.map((q) => lower(q, dy)) } };
  throw new Error(`arena corner: can't lower ${JSON.stringify(p)}`);
}

function assemble(t) {
  const mitre = { turned: { turns: 0.25, pivot: MITRE_PIVOT, parts: t.mitre } };
  const diag = { turned: { turns: 0.5, pivot: DIAG_PIVOT, parts: [...t.diag, ...t.diag.map(flipU), ...t.axis] } };
  return [...t.wedge, ...t.wedge.map(mirrorPart), ...(t.mitre.length ? [mitre, mirrorPart(mitre)] : []), diag];
}

const TILES = [
  ['ground', 'Arena Corner (Ground)', 'The ground storeys of a 45° corner of the stands (levels 0-1): the 2 m podium wall, its walkway and seats on the diagonal, the vaulted gallery behind them turning the corner, the first tier of rows, solid fill under the upper tiers and the facade\'s ground arcade', groundParts],
  ['mid', 'Arena Corner (Middle)', 'The middle tier of a 45° corner of the stands (levels 2-3): rows round the corner with an aisle up each mitre and the centre line, the gallery under their back half turning the corner, the facade\'s second arcade', midParts],
  ['upper', 'Arena Corner (Upper)', 'The upper tier of a 45° corner of the stands (levels 4-5): rows round the corner, a vomitorium on the centre line from the gallery behind, aisles up each mitre and either side of it, the facade\'s third arcade', upperParts],
  ['attic', 'Arena Corner (Attic)', 'The attic walk round a 45° corner of the stands (levels 6-7): the walkway behind the highest seats, windows in the outer wall, the roof', atticParts],
];

/** The Arena Corner kit tiles, in content/tiles/core.json's form. */
export function arenaCornerTiles() {
  return TILES.map(([key, displayName, blurb, parts]) => {
    const levels = LEVELS[key];
    const base = levels[0][0];
    const cells = cellsOf(levels).map(([x, y, z]) => [x, y, z - base]);
    return {
      id: `core.arena_corner_${key}`,
      category: 'Vertical',
      displayName,
      blurb: `${blurb}. Stack the four (setpiece.arena_corner) between straight Arena Bays to the west and south.`,
      cells,
      floors: [],
      ports: portsOf(cells),
      open: true,
      edgeDefault: 'open',
      solids: assemble(parts()).map((p) => lower(p, base * 4)),
      notes: {
        design: 'Flavius Rule\'s octagon, phase 2 (docs/map-briefs/sandfall_colosseum/OCTAGON_PLAN.md): made by tools/content/kit/arenaCorner.mjs. The anchor cell is the corner of the sand (the tile covers the cells 0..8 east and north of it). The rows are the Seating Tier\'s (0.5 m by 1 m) and the podium Arena Seating\'s, so they meet the straight bays flush; seats in the solids slot, lips in trim, walls and vaults in walls, walkways and slabs in floor. Arches collide plain (piers and lintel; owner 2026-11-14, 6a).',
      },
    };
  });
}
