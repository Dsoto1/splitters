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
//
// Phase 3 adds the gate: the ground and attic storeys' gate option and the gatehouse tower (see "the gate" below).
// Phase 5 adds a stair from the ground gallery up into the middle one in each half of the diagonal ("the gallery
// stairs" below), in the ground storey (plain and gate) and the middle one's floor.

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
  } else if (opts.gate) {
    // The gate passage through it: the wall either side, a lintel over the passage level with its roof.
    diagRun(t, f, um(f + WALL), -PASS, 'wall', y);
    t.axis.push(diagBox(f, f + WALL, y + 3.2, y + 4, -PASS, PASS, 'wall'));
  } else diagRun(t, f, um(f + WALL), -um(f + WALL), 'wall', y);
  // Back: Round arches (blind against the fill, or open into the facade's arcade), thickness in front of the line.
  const end = opts.backTo ?? b;
  wedgeRun(t, b, xm(end), 12, 'arch_round', y, { plain: true });
  // (The ground gallery's has five bays, plain or gate: one arch on the centre line, the gate passage's way on into the
  // fill, and the second from each mitre the way up the gallery stair.)
  diagRun(t, b, -um(end), um(end), 'arch_round', y, { plain: true, ...(opts.backBays ? { bays: opts.backBays } : {}) });
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
function arcade(t, y, floor, opts = {}) {
  const [f, b] = FACADE;
  // The inner face (on depth 48, thickness behind it) runs to the mitre at 48.8, as the upper gallery's back (the gate's
  // ground storey: nine bays, so an arch stands on the centre line where the passage comes out of the fill).
  wedgeRun(t, f, 12, xm(f + GRAND), 'arch_grand', y, { plain: true });
  diagRun(t, f, um(f + GRAND), -um(f + GRAND), 'arch_grand', y, { plain: true, ...(opts.innerBays ? { bays: opts.innerBays } : {}) });
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

// ---------------------------------------------------------------- the gate (phase 3)

// The gate corner (plan §3.2 gate row, §3.3, owner 3a, 4b): a Gladiator Gate on the diagonal's centre line, its
// passage 3.2 m wide from the sand out under the stand to the facade; a stair well either side of it down to level -1
// (to the hypogeum ring's corner); a short stair up the podium wall either side of the gate's mouth. All in the
// diagonal's frame (u along the front, v the depth), west half written out, the east half its mirror (flipU).

/** Half the passage, and its headroom through the fill. */
const PASS = 1.6;
const PASS_H = 3.4;
/**
 * The podium stairs: against the podium wall on the sand, `out` m deep; eight steps from u `foot` (by the gate's pier)
 * climb away from the gate to a landing at 2 m (to `end`), level with the wall's top and the walkway behind it; the
 * parapet is left off over the top of the flight and the landing (from `gap`).
 */
const PODIUM_STAIR = { foot: 3.0, top: 7.0, end: 8.0, gap: 6.0, out: 2.4 };
/**
 * The stair wells (west one; u negative): a flight 2.4 m wide beside the passage, from the passage's floor (its head at
 * depth `top`, a landing to `land` opening into the passage) down to level -1 at depth `foot`, where a landing (in the
 * tile's own frame, square to the grid) leads into the cell side of the hypogeum's corner cell (tile cell 2, 2, -1).
 */
const WELL = { a: 2.1, b: 4.5, wall: 0.5, foot: 21, top: 29, land: 31.4 };
/**
 * The clear height over the well's head landing (the passage's floor, 0) and so over its every step: a room's (a 4 m
 * level under a 0.3 m floor), as the clock tower's. (The fill over the flight's lower half once stood at 0, 2.5 m over
 * its middle steps, and its edge met a large body's head going down: owner, 2026-11-19, a stair that needed a crouch.)
 */
const WELL_H = 3.7;
/** Holes in the fill: the passage, each well's headroom over its whole flight, and the well's door onto the passage. */
const GATE_HOLES = [
  { u0: -PASS, u1: 0, v0: 16, v1: FACADE[0], y0: 0, y1: PASS_H },
  { u0: -WELL.b, u1: -WELL.a, v0: WELL.foot, v1: WELL.land, y0: 0, y1: WELL_H },
  { u0: -WELL.a, u1: -PASS, v0: WELL.top, v1: WELL.land, y0: 0, y1: PASS_H },
];
/**
 * The gatehouse tower (owner 2a), turned 45° with the diagonal and standing against the facade's outer face over the
 * gate's outer end: as wide as the facade's middle three bays (its sides on the piers between bays), from depth 56 out
 * to 66.1. The passage runs through its foot; a switchback either side (lane A by the passage climbs outward, lane B
 * comes back), a landing across the whole tower at every 4 m on the facade side (through the facade's arches into the
 * arcade storeys at 8 and 16 m, onto the attic walk at 24 m and its roof at 28 m), the lookout at 32 m.
 */
const TOWER = { half: -um(FACADE[1]) / 3, v0: FACADE[1], l1: 58.8, l2: 62.8, back: 65.6, v1: 66.1, top: 32, parapet: 1.2 };

/** Diagonal (u, v) to the tile's frame (x, z). */
const D2T = (u, v) => [r4(4 + (u + v) / R2), r4(4 + (v - u) / R2)];

/** A podium band; with the gate cut by the passage, and the parapet left off over the top of each podium stair. */
function podiumBand(t, d0, d1, y0, y1, kind, gate) {
  if (!gate) return band(t, d0, d1, y0, y1, kind);
  t.wedge.push(wedgeBox(d0, d1, y0, y1, xm(d1), kind));
  const parapet = y0 >= PARAPET[2] - 1e-9;
  const spans = parapet ? [[um(d1), -PODIUM_STAIR.end], [-PODIUM_STAIR.gap, -PASS]] : [[um(d1), -PASS]];
  for (const [u0, u1] of spans) t.diag.push(diagBox(d0, d1, y0, y1, u0, u1, kind));
}

/**
 * A band of fill (as band()) with holes carved out of its diagonal part: holes are boxes in the diagonal's west half
 * ({u0, u1, v0, v1, y0, y1}, mirrored for the east half). The rest is cut into as few boxes as a greedy merge finds
 * (along u, then v, then y); a box reaching the centre line is one box across it. With no holes, exactly band().
 */
function carvedBand(t, d0, d1, y0, y1, kind, holes) {
  t.wedge.push(wedgeBox(d0, d1, y0, y1, xm(d1), kind));
  const U0 = um(d1);
  const hs = holes
    .map((h) => ({ u0: Math.max(h.u0, U0), u1: Math.min(h.u1, 0), v0: Math.max(h.v0, d0), v1: Math.min(h.v1, d1), y0: Math.max(h.y0, y0), y1: Math.min(h.y1, y1) }))
    .filter((h) => h.u1 - h.u0 > 1e-9 && h.v1 - h.v0 > 1e-9 && h.y1 - h.y0 > 1e-9);
  if (!hs.length) return void t.axis.push(diagBox(d0, d1, y0, y1, U0, -U0, kind));
  const cuts = (lo, hi, k0, k1) => [...new Set([lo, hi, ...hs.flatMap((h) => [h[k0], h[k1]])])].sort((a, b) => a - b);
  const U = cuts(U0, 0, 'u0', 'u1');
  const V = cuts(d0, d1, 'v0', 'v1');
  const Y = cuts(y0, y1, 'y0', 'y1');
  const mid = (A, i) => (A[i] + A[i + 1]) / 2;
  const solid = (i, j, k) => !hs.some((h) => mid(U, i) > h.u0 && mid(U, i) < h.u1 && mid(V, j) > h.v0 && mid(V, j) < h.v1 && mid(Y, k) > h.y0 && mid(Y, k) < h.y1);
  const used = new Set();
  const free = (i, j, k) => i < U.length - 1 && j < V.length - 1 && k < Y.length - 1 && solid(i, j, k) && !used.has(`${i},${j},${k}`);
  for (let k = 0; k < Y.length - 1; k++) for (let j = 0; j < V.length - 1; j++) for (let i = 0; i < U.length - 1; i++) {
    if (!free(i, j, k)) continue;
    let i1 = i;
    while (free(i1 + 1, j, k)) i1++;
    const row = (jj, kk) => Array.from({ length: i1 - i + 1 }, (_, n) => free(i + n, jj, kk)).every(Boolean);
    let j1 = j;
    while (row(j1 + 1, k)) j1++;
    let k1 = k;
    while (Array.from({ length: j1 - j + 1 }, (_, n) => row(j + n, k1 + 1)).every(Boolean)) k1++;
    for (let kk = k; kk <= k1; kk++) for (let jj = j; jj <= j1; jj++) for (let ii = i; ii <= i1; ii++) used.add(`${ii},${jj},${kk}`);
    const [u0, u1] = [U[i], U[i1 + 1]];
    if (Math.abs(u1) < 1e-9) t.axis.push(diagBox(V[j], V[j1 + 1], Y[k], Y[k1 + 1], u0, -u0, kind));
    else t.diag.push(diagBox(V[j], V[j1 + 1], Y[k], Y[k1 + 1], u0, u1, kind));
  }
}

/** The gate's own parts: the passage's roof and floors, the gatehouse over its mouth, the podium stairs, the wells. */
function gateParts(t) {
  // The passage roof through the podium (level with the top walkway), the gatehouse block over the opening (3 m clear:
  // a portcullis hangs in it, 1 m in from the podium's face), its marble lip and the timber beams under the roof: the
  // Gladiator Gate's.
  t.axis.push(diagBox(2.0, 8.0, 3.2, 4.0, -PASS, PASS, 'solid'));
  t.axis.push(diagBox(0.1, 2.0, 3.0, 4.0, -2.2, 2.2, 'solid'));
  t.axis.push(diagBox(0, 0.1, 3.6, 4.0, -2.3, 2.3, 'trim'));
  for (const v of [3, 5, 7]) t.axis.push(diagBox(v - 0.12, v + 0.12, 2.95, 3.2, -PASS, PASS, 'trim'));
  // Its floor (the gallery's and the arcade's floors carry it across those): 2 cm low at the mouth, where its corners
  // lie over the sand tiles in the half cells either side.
  t.axis.push(diagBox(0, PASS, -0.52, -0.02, -PASS, PASS, 'floor'));
  t.axis.push(diagBox(PASS, 8, -0.5, 0, -PASS, PASS, 'floor'));
  t.axis.push(diagBox(16, FACADE[0], -0.5, 0, -PASS, PASS, 'floor'));
  // The podium stair (owner 4b): eight steps of 0.25 m up from the sand along the wall, and a landing level with its top.
  const s = PODIUM_STAIR;
  t.diag.push({ flight: { axis: 'x', dir: -1, from: DU(-s.foot), across: [DV(-s.out), DV(0)], steps: 8 } });
  t.diag.push(diagBox(-s.out, 0, 0, 2, -s.end, -s.top, 'solid'));
  // The stair well (owner 3a): the flight from level -1 up to the passage's floor, its head landing, its walls.
  const w = WELL;
  t.diag.push({ flight: { axis: 'z', dir: 1, from: DV(w.foot), across: [DU(-w.b), DU(-w.a)], steps: 16, base: -4, floor: -4 } });
  t.diag.push(diagBox(w.top, w.land, -4, 0, -w.b, -w.a, 'floor'));
  t.diag.push(diagBox(w.foot, w.land, -4, 0, -w.b - w.wall, -w.b, 'wall'));
  t.diag.push(diagBox(w.foot + 0.2, w.land, -4, 0, -w.a, -PASS, 'wall'));
  // The foot landing, square to the grid in the tile's frame (the cell north of the hypogeum's corner cell, 2, 2, -1,
  // whose north side it meets: x 14.2 to 17.8 is that side's 3.6 m opening), and its walls up to the fill.
  t.wedge.push(box(14.2, -4.2, 20, 17.8, -4, 22.6, 'floor'));
  t.wedge.push(box(13.7, -4, 20, 14.2, 0, 23.1, 'wall'));
  t.wedge.push(box(14.2, -4, 22.6, 16.5, 0, 23.1, 'wall'));
  // (Under the passage's floor slab, which is its ceiling there.)
  t.wedge.push(box(17.8, -4, 20, 18.3, -0.5, 20.8, 'wall'));
}

/** The ground's surface taken out round each stair well (map/groundBore.ts), and the wells drawn on plans. */
function gateBore() {
  const cut = [13.7, -4.5, 20, 25.1, 0.5, 29.8];
  const w = WELL;
  const lines = [
    [...D2T(-w.b, w.foot), ...D2T(-w.b, w.land)],
    [...D2T(-w.a, w.foot + 0.2), ...D2T(-w.a, w.land)],
    [14.2, 20, 14.2, 22.6],
    // (Where the landing's north wall meets the flight's west side.)
    [14.2, 22.6, r4(22.6 - 2 * w.b / R2), 22.6],
  ];
  const swap = (q) => [q[1], q[0], q[3], q[2]];
  return {
    cut: [cut, [cut[2], cut[1], cut[0], cut[5], cut[4], cut[3]]],
    plan: [...lines, ...lines.map(swap)].map((q) => q.map(r4)),
  };
}

/** The gatehouse tower's parts (its own tile, in the same frame as the corner's). */
function towerParts() {
  const t = sectors();
  const { half: H, v0: V0, l1: L1, l2: L2, back: VB, v1: V1, top: TOP, parapet: PH } = TOWER;
  const IN = H - WALL;
  const MID = (WELL.a + IN) / 2;
  const PH0 = 3.5;
  // The ground floor, the gate's way out through the outer wall.
  t.axis.push(diagBox(V0, VB, -0.5, 0, -IN, IN, 'floor'));
  t.axis.push(diagBox(VB, V1, -0.5, 0, -PASS, PASS, 'floor'));
  // The side walls (on the facade's piers), the outer wall with the passage's arch, the passage's walls, the core
  // between the two switchbacks over the passage, the parapet on the arena side of the lookout.
  t.diag.push(diagBox(V0, V1, 0, TOP + PH, -H, -IN, 'wall'));
  t.diag.push(diagBox(VB, V1, 0, TOP + PH, -IN, -PASS, 'wall'));
  t.axis.push(diagBox(VB, V1, PH0, TOP + PH, -PASS, PASS, 'wall'));
  t.diag.push(diagBox(L1, VB, 0, PH0, -WELL.a, -PASS, 'wall'));
  t.axis.push(diagBox(L1, VB, PH0, TOP, -WELL.a, WELL.a, 'solid'));
  t.axis.push(diagBox(V0, V0 + WALL, TOP, TOP + PH, -IN, IN, 'wall'));
  // Eight storeys of 4 m: lane A (by the passage) up 2 m outward, the half landing, lane B up 2 m back, the landing
  // across the tower. Steps 0.25 by 0.5 m, each 0.6 m deep under its tread (3.4 m clear over the flight below); the
  // ground storey's are solid to the floor.
  for (let k = 0; k < 8; k++) {
    const y = 4 * k;
    for (let i = 0; i < 8; i++) {
      const a = y + 0.25 * (i + 1);
      t.diag.push(diagBox(L1 + 0.5 * i, L1 + 0.5 * (i + 1), k ? a - 0.6 : 0, a, -MID, -WELL.a, 'solid'));
      const b = y + 2 + 0.25 * (i + 1);
      t.diag.push(diagBox(L2 - 0.5 * (i + 1), L2 - 0.5 * i, k ? b - 0.6 : 0, b, -IN, -MID, 'solid'));
    }
    t.diag.push(diagBox(L2, VB, k ? y + 1.5 : 0, y + 2, -IN, -WELL.a, 'floor'));
    // (At 28 m the landing reaches over the attic's parapet line to its roof.)
    t.axis.push(diagBox(y + 4 === 28 ? FACADE[1] - WALL : V0, L1, y + 3.5, y + 4, -IN, IN, 'floor'));
  }
  // Merlons on the lookout's parapets (drawn only).
  for (let u = 0.8; u < IN - 0.3; u += 1.6) {
    t.diag.push(diagBox(V0, V0 + WALL, TOP + PH, TOP + PH + 0.6, -u - 0.35, -u + 0.35, 'trim'));
    t.diag.push(diagBox(VB, V1, TOP + PH, TOP + PH + 0.6, -u - 0.35, -u + 0.35, 'trim'));
  }
  for (let v = V0 + 0.8; v < V1 - 0.3; v += 1.6) t.diag.push(diagBox(v - 0.35, v + 0.35, TOP + PH, TOP + PH + 0.6, -H, -IN, 'trim'));
  towerFaces(t);
  return t;
}

/**
 * The tower's outside faces (owner, phase 3's 3a): arrow slits and a string course, drawn only (no collision). A slit
 * is a dark strip 0.2 by 1.6 m standing 3 cm proud of the face, in each storey band between the arcade storeys; the
 * string course a band 0.3 m high, 0.15 m proud, round all four faces under the lookout's parapet (its floor's edge).
 */
function towerFaces(t) {
  const { half: H, v0: V0, v1: V1, top: TOP } = TOWER;
  const { proud: P, w: SW, h: SH, at: HEIGHTS, cols: COLS, side: SIDE } = SLITS;
  const dark = { surface: { material: 'core.pbr_castle_stone', tint: '#2a241e' } };
  for (const y of HEIGHTS) {
    const [y0, y1] = [y - SH / 2, y + SH / 2];
    // The outer face (v = V1), a slit either side of the passage; each side face (u = -H), one in its middle.
    for (const u of COLS) t.diag.push({ ...diagBox(V1, V1 + P, y0, y1, -u - SW / 2, -u + SW / 2, 'trim'), ...dark });
    t.diag.push({ ...diagBox(SIDE - SW / 2, SIDE + SW / 2, y0, y1, -H - P, -H, 'trim'), ...dark });
  }
  // The string course: the outer and inner faces' bands run over the corners; the sides' between them.
  const [c0, c1] = [TOP - 0.3, TOP];
  const SC = STRING_COURSE;
  t.axis.push(diagBox(V1, V1 + SC, c0, c1, -H - SC, H + SC, 'trim'));
  t.axis.push(diagBox(V0 - SC, V0, c0, c1, -H - SC, H + SC, 'trim'));
  t.diag.push(diagBox(V0, V1, c0, c1, -H - SC, -H, 'trim'));
}

/** The arrow slits: how far proud, width and height, the heights of their middles (between the landings), the outer face's columns (u off the centre line), the side faces' slit (its depth). */
const SLITS = { proud: 0.03, w: 0.2, h: 1.6, at: [6, 14, 22, 29.5], cols: [7.5], side: 61 };
/** How far the string course stands proud of the faces. */
const STRING_COURSE = 0.15;

// ---------------------------------------------------------------- the gallery stairs (phase 5)

// The way up from the ground gallery into the middle one (owner's phase-4 answer 1a: without it the middle gallery
// ring was sealed). One in each half of the diagonal (so each tile stays its own mirror image), in the ground storey
// for the plain corner and the gate alike: through the ground gallery's back wall at its second arch from the mitre,
// 16 steps up along the depth through the fill to a landing at 4 m under the middle gallery's front wall, then 16 steps
// along the gallery toward the centre line, up through a hole in its floor (the mid tile's), a parapet round the hole.
// The diagonal's frame, west half (the east half is its mirror, flipU).

/**
 * The stair: `u0`..`u1` the lower flight's width (inside the arch at u -14.35, its 3.2 m opening; 0.25 m clear of the
 * north wedge's fill, which reaches u -15.6 at depth 18.3), from the back wall `v0` to the landing at `land`; the upper
 * flight between the middle gallery's front wall's face `w0` and `w1`, from u1 to `top`; the parapet `rail` thick and
 * `railH` high; the ground gallery's back wall in `bays` bays (the gate's five, so the arch is where both have it).
 */
const GSTAIR = { u0: -15.35, u1: -12.95, v0: 16, land: 24, w0: 24.5, w1: 26.9, top: -4.95, rail: 0.2, railH: 1, bays: 5 };
/** The fill carved out over the lower flight, the landing and the upper flight (the fill under them is their floor). */
const STAIR_HOLES = [
  { u0: GSTAIR.u0, u1: GSTAIR.u1, v0: GSTAIR.v0, v1: GSTAIR.land, y0: 0, y1: 7 },
  { u0: GSTAIR.u0, u1: GSTAIR.u1, v0: GSTAIR.land, v1: GSTAIR.w1, y0: 4, y1: 7.5 },
  { u0: GSTAIR.u1, u1: GSTAIR.top, v0: GSTAIR.w0, v1: GSTAIR.w1, y0: 4, y1: 7.5 },
];
/** The hole in the middle gallery's floor over the upper flight. */
const STAIR_TOP = { u0: GSTAIR.u1, u1: GSTAIR.top, v0: GSTAIR.w0, v1: GSTAIR.w1, y0: 7.5, y1: 8 };

/** The two flights (ground storey). */
function stairParts(t) {
  const s = GSTAIR;
  t.diag.push({ flight: { axis: 'z', dir: 1, from: DV(s.v0), across: [DU(s.u0), DU(s.u1)], steps: 16 } });
  t.diag.push({ flight: { axis: 'x', dir: 1, from: DU(s.u1), across: [DV(s.w0), DV(s.w1)], steps: 16, base: 4, floor: 4 } });
}

/** The parapet round the hole in the middle gallery's floor: along its side toward the gallery and across its foot (8 m up, in the mid tile's own heights). */
function stairRail(t) {
  const s = GSTAIR;
  t.diag.push(diagBox(s.w1, s.w1 + s.rail, 8, 8 + s.railH, s.u1 - s.rail, s.top, 'wall'));
  t.diag.push(diagBox(s.w0, s.w1, 8, 8 + s.railH, s.u1 - s.rail, s.u1, 'wall'));
}

// ---------------------------------------------------------------- the four tiles

function groundParts(gate = false) {
  const t = sectors();
  // The podium, the parapet on its wall.
  for (const [d0, d1, top, kind] of PODIUM) podiumBand(t, d0, d1, 0, top, kind, gate);
  podiumBand(t, PARAPET[0], PARAPET[1], PARAPET[2], PARAPET[3], 'wall', gate);
  // The podium's gallery and the first tier of rows over it.
  gallery(t, 8, 16, 0, { floor: true, gate, backBays: GSTAIR.bays });
  rows(t, 0, 7);
  // Fill under the upper tiers (the mid gallery's floor slab is the mid tile's); the gallery stairs, and the gate's
  // passage and stair wells, are carved out of it.
  const holes = gate ? [...STAIR_HOLES, ...GATE_HOLES] : STAIR_HOLES;
  carvedBand(t, 16, 24, 0, 8, 'solid', holes);
  carvedBand(t, 24, 32, 0, 7.5, 'solid', holes);
  carvedBand(t, 32, 48, 0, 8, 'solid', holes);
  arcade(t, 0, 'ground', gate ? { innerBays: 9 } : {});
  stairParts(t);
  if (gate) gateParts(t);
  return t;
}

function midParts() {
  const t = sectors();
  // The gallery's floor, the gallery stair's hole in it and the parapet round the hole.
  carvedBand(t, 24, 32, 7.5, 8, 'floor', [STAIR_TOP]);
  stairRail(t);
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

function atticParts(gate = false) {
  const t = sectors();
  const [f, b] = FACADE;
  // The walk's floor between the arcade's walls (their tops make the rest), the outer wall with its windows, the roof
  // and a parapet round it.
  band(t, f + GRAND, b - GRAND, 23.5, 24, 'floor');
  wedgeRun(t, b, xm(b), 12, 'window', 24, { outer: true });
  // With the gate the walk and the roof open into the gatehouse tower over the middle three of the facade's nine bays
  // (the tower's sides stand on the piers between bays, so the windows either side stay where they were).
  if (gate) diagRun(t, b, -TOWER.half, um(b), 'window', 24, { outer: true, bays: 3 });
  else diagRun(t, b, -um(b), um(b), 'window', 24, { outer: true });
  band(t, f, b - WALL, 27.5, 28, 'floor');
  if (gate) {
    t.wedge.push(wedgeBox(b - WALL, b, 28, 28.6, xm(b), 'wall'));
    t.diag.push(diagBox(b - WALL, b, 28, 28.6, um(b), -TOWER.half, 'wall'));
  } else band(t, b - WALL, b, 28, 28.6, 'wall');
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

/**
 * Ports on the sides that meet the straight stands (west of the first column, south of the first row), and on the
 * ground the sides that face the two half-sand cells (0, 1) and (1, 0), the gate's mouth among them: open ground meets
 * open ground there with no wall between (else the sand's Courtyard tiles wall them off, up through the podium).
 */
function portsOf(cells) {
  const out = [];
  const facesSand = (dx, dy, side) => (side === 'W' ? (dx === 1 && dy === 1) || (dx === 2 && dy === 0) : (dx === 1 && dy === 1) || (dx === 0 && dy === 2));
  for (const [dx, dy, level] of cells) {
    if (dx === 0 || (level === 0 && facesSand(dx, dy, 'W'))) out.push({ side: 'W', level, cell: [dx, dy] });
    if (dy === 0 || (level === 0 && facesSand(dx, dy, 'S'))) out.push({ side: 'S', level, cell: [dx, dy] });
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
  ['ground', 'Arena Corner (Ground)', 'The ground storeys of a 45° corner of the stands (levels 0-1): the 2 m podium wall, its walkway and seats on the diagonal, the vaulted gallery behind them turning the corner with a stair up into the middle gallery either side of the diagonal, the first tier of rows, solid fill under the upper tiers and the facade\'s ground arcade', groundParts],
  ['mid', 'Arena Corner (Middle)', 'The middle tier of a 45° corner of the stands (levels 2-3): rows round the corner with an aisle up each mitre and the centre line, the gallery under their back half turning the corner (the stairs up from the ground gallery come up through its floor), the facade\'s second arcade', midParts],
  ['upper', 'Arena Corner (Upper)', 'The upper tier of a 45° corner of the stands (levels 4-5): rows round the corner, a vomitorium on the centre line from the gallery behind, aisles up each mitre and either side of it, the facade\'s third arcade', upperParts],
  ['attic', 'Arena Corner (Attic)', 'The attic walk round a 45° corner of the stands (levels 6-7): the walkway behind the highest seats, windows in the outer wall, the roof', atticParts],
];

const DESIGN = 'Flavius Rule\'s octagon (docs/map-briefs/sandfall_colosseum/OCTAGON_PLAN.md): made by tools/content/kit/arenaCorner.mjs. The anchor cell is the corner of the sand (the tile covers the cells 0..8 east and north of it). The rows are the Seating Tier\'s (0.5 m by 1 m) and the podium Arena Seating\'s, so they meet the straight bays flush; seats in the solids slot, lips in trim, walls and vaults in walls, walkways and slabs in floor. Arches collide plain (piers and lintel; owner 2026-11-14, 6a).';

/** A storey tile (plain, or with the gate option). */
function storeyTile(key, displayName, blurb, parts, gate = false) {
  const levels = LEVELS[key];
  const base = levels[0][0];
  const cells = cellsOf(levels).map(([x, y, z]) => [x, y, z - base]);
  return {
    id: `core.arena_corner_${key}${gate ? '_gate' : ''}`,
    category: 'Vertical',
    displayName,
    blurb: `${blurb}. Stack the four (setpiece.arena_corner${gate ? '_gate' : ''}) between straight Arena Bays to the west and south.`,
    ...(gate ? { optionOf: { tile: `core.arena_corner_${key}`, option: 'gate' } } : {}),
    cells,
    floors: [],
    ports: portsOf(cells),
    open: true,
    edgeDefault: 'open',
    solids: assemble(parts(gate)).map((p) => lower(p, base * 4)),
    ...(gate && key === 'ground' ? { bore: gateBore() } : {}),
    notes: { design: gate ? `${DESIGN} The gate option (phase 3, MapMaker's tile inspector: a tile of its own, so maps need no new field): ${GATE_NOTES[key]}` : DESIGN.replace("octagon (", "octagon, phase 2 (") },
  };
}

const GATE_NOTES = {
  ground: 'a Gladiator Gate on the diagonal (passage 3.2 m wide and 3 m clear under the gatehouse, where a portcullis hangs 1 m in from the podium\'s face, then 3.4 m through the fill), out through the facade\'s middle arch; a stair well either side of it from the passage down to level -1, whose foot landing meets the north side (and, mirrored, the east side) of tile cell 2, 2, -1, the hypogeum ring\'s corner, through a 3.6 m opening; a short stair of eight steps up the podium wall either side of the mouth, open with the portcullis down (owner 4b); the plain storey\'s two gallery stairs up into the middle gallery (phase 5). The wells hang a level under the tile\'s cells (no cell at level -1 is claimed: put the hypogeum\'s tunnels there); its bore takes the ground out round them.',
  attic: 'the walk and the roof open into the gatehouse tower (core.arena_corner_tower) over the facade\'s middle three bays: no windows or parapet there.',
};

/** The tower's cells: those of levels 0-7 the corner leaves free (wholly past the facade) and all of level 8, under its footprint. */
function towerCells() {
  const out = [];
  const inTower = (x, z) => Math.abs((x - z) / R2) <= TOWER.half && (x + z - 40) / R2 >= TOWER.v0 && (x + z - 40) / R2 <= TOWER.v1;
  for (let level = 0; level <= 8; level++) {
    for (let dy = 0; dy <= 8; dy++) {
      for (let dx = 0; dx <= 8; dx++) {
        let tower = 0;
        let corner = 0;
        for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
          const x = 12 + dx * 8 + (i + 0.5) / 2;
          const z = 12 + dy * 8 + (j + 0.5) / 2;
          if (inTower(x, z)) tower++;
          if (depthAt(x, z) < FACADE[1]) corner++;
        }
        if (tower > 0 && (level === 8 || corner === 0)) out.push([dx, dy, level]);
      }
    }
  }
  return out;
}

function towerTile() {
  return {
    id: 'core.arena_corner_tower',
    category: 'Vertical',
    displayName: 'Arena Corner Gatehouse',
    blurb: "A gatehouse tower turned 45° against the facade of an Arena Corner, over its gate's outer end: the gate passage through its foot, a switchback either side up to a landing at every 4 m (the arcade storeys at 8 and 16 m, the attic walk at 24 m and its roof at 28 m) and a lookout at 32 m. In setpiece.arena_corner_gate; anchor on the sand's corner cell like the corner",
    cells: towerCells(),
    floors: [],
    ports: [],
    open: true,
    edgeDefault: 'open',
    solids: assemble(towerParts()),
    notes: { design: `${DESIGN.replace(' The rows are', ' Its own tile (not part of the gate option, whose cells are the plain corner\'s), so it claims only what the corner leaves free: the outer court\'s cells under it at levels 0-7 and all of level 8; it stands with its inner face on the facade\'s outer face (depth 56 m), so the storey tiles keep the facade, and only the attic needs the gate option (the walk and roof open into it). The rows are')}` },
  };
}

/** The Arena Corner kit tiles, in content/tiles/core.json's form: the four storeys, the gate options of the ground and the attic, the gatehouse tower. */
export function arenaCornerTiles() {
  const plain = TILES.map(([key, displayName, blurb, parts]) => storeyTile(key, displayName, blurb, parts));
  const gate = TILES.filter(([key]) => key === 'ground' || key === 'attic').map(([key, displayName, , parts]) =>
    storeyTile(key, displayName.replace(')', ', Gate)'), GATE_BLURBS[key], parts, true),
  );
  return [...plain, ...gate, towerTile()];
}

const GATE_BLURBS = {
  ground: 'The ground storeys of a 45° corner of the stands with a Gladiator Gate on its diagonal: a passage 3.2 m wide from the sand out under the stand and through the facade (hang a portcullis in its mouth), a stair well either side of it down to the hypogeum a level below, a short stair up the podium wall either side of the gate, a stair up into the middle gallery either side of the diagonal',
  attic: 'The attic walk round a 45° corner of the stands, open in the middle into the gatehouse tower over the gate (core.arena_corner_tower)',
};
