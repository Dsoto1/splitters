/**
 * Style Pack tiles (Sprint 7, Set 1): the pieces of 01 Military Compound and
 * 02 Frontier Dust that are built from boxes, like the core buildings. Walls
 * take the theme's wall paint and furniture its solid paint, so they work in
 * any theme; the parts that should always look the part (sandbags, earth
 * berms, corrugated roofs, rails, rock) carry a library material of their own
 * (`LocalBox.surface`).
 *
 * Only types come from catalog.ts (which lists these tiles), so there is no
 * runtime import cycle; the few box helpers are repeated here.
 */
import type { LocalBox, Side, TileDefinition, TilePort } from './catalog.ts';

// ---------------------------------------------------------------- helpers

type Box = LocalBox;
const b = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, kind?: LocalBox['kind']): Box => ({ min: [x0, y0, z0], max: [x1, y1, z1], ...(kind ? { kind } : {}) });
/** A box in a library material (any theme). */
const paint = (box: Box, material: string, tint?: string): Box => ({ ...box, surface: { material: `core.${material}`, ...(tint ? { tint } : {}) } });
/** Visual only (never collides). */
const trim = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, material?: string, tint?: string): Box => {
  const t = b(x0, y0, z0, x1, y1, z1, 'trim');
  return material ? paint(t, material, tint) : t;
};
const SIDES_ALL: Side[] = ['N', 'E', 'S', 'W'];
const ALL: TilePort[] = SIDES_ALL.map((side) => ({ side, level: 0 }));

function footprint(w: number, d: number, h = 1): [number, number, number][] {
  const cells: [number, number, number][] = [];
  for (let z = 0; z < h; z++) for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) cells.push([x, y, z]);
  return cells;
}

function perimeter(w: number, d: number, level = 0): TilePort[] {
  const ports: TilePort[] = [];
  for (let x = 0; x < w; x++) ports.push({ side: 'S', level, cell: [x, 0] }, { side: 'N', level, cell: [x, d - 1] });
  for (let y = 0; y < d; y++) ports.push({ side: 'W', level, cell: [0, y] }, { side: 'E', level, cell: [w - 1, y] });
  return ports;
}

/** A straight flight of solid steps (0.25 m each) climbing along +z or +x from `from`, between a0 and a1 across. */
function flight(axis: 'x' | 'z', from: number, a0: number, a1: number, n: number, base = 0, run = 0.5): Box[] {
  return Array.from({ length: n }, (_, i) => {
    const u0 = from + i * run;
    const u1 = from + (i + 1) * run;
    const top = base + (i + 1) * 0.25;
    return axis === 'x' ? b(u0, 0, a0, u1, top, a1) : b(a0, 0, u0, a1, top, u1);
  });
}

/** A thin 1 m rail along an axis-aligned line at height y. */
function rail(x0: number, z0: number, x1: number, z1: number, y = 0, material = 'pbr_steel'): Box {
  const t = 0.06;
  const r = x0 === x1 ? b(x0 - t, y, Math.min(z0, z1), x0 + t, y + 1, Math.max(z0, z1)) : b(Math.min(x0, x1), y, z0 - t, Math.max(x0, x1), y + 1, z0 + t);
  return paint(r, material);
}

/** An opening in a wall run: [from, to] along the wall, [bottom, top] in height. */
type Opening = readonly [number, number, number, number];
const door = (c: number, w = 3, h = 3): Opening => [c - w / 2, c + w / 2, 0, h];
const win = (c: number, w = 1.5, y0 = 1.0, y1 = 2.3): Opening => [c - w / 2, c + w / 2, y0, y1];

/**
 * A wall (theme wall paint) along x at z = `at` or along z at x = `at`, from
 * a0 to a1 and y0 to y1, `t` thick, with openings cut out (sills, lintels and
 * the wall between stacked windows left in place). Opening heights are above y0.
 */
function wall(axis: 'x' | 'z', at: number, a0: number, a1: number, openings: readonly Opening[] = [], y0 = 0, y1 = 4, t = 0.3): Box[] {
  const out: Box[] = [];
  const piece = (u0: number, u1: number, v0: number, v1: number) => {
    if (u1 - u0 < 0.01 || v1 - v0 < 0.01) return;
    out.push(axis === 'x' ? b(u0, v0, at - t / 2, u1, v1, at + t / 2, 'wall') : b(at - t / 2, v0, u0, at + t / 2, v1, u1, 'wall'));
  };
  // Split the run at every opening edge; each stretch is solid except where openings cover it.
  const cuts = [...new Set([a0, a1, ...openings.flatMap((o) => [o[0], o[1]])])].filter((u) => u >= a0 && u <= a1).sort((p, q) => p - q);
  for (let i = 0; i + 1 < cuts.length; i++) {
    const [u0, u1] = [cuts[i]!, cuts[i + 1]!];
    const holes = openings.filter((o) => o[0] <= u0 + 1e-6 && o[1] >= u1 - 1e-6).map((o) => [y0 + o[2], Math.min(y1, y0 + o[3])] as const).sort((p, q) => p[0] - q[0]);
    let v = y0;
    for (const [h0, h1] of holes) {
      piece(u0, u1, v, h0);
      v = Math.max(v, h1);
    }
    piece(u0, u1, v, y1);
  }
  return out;
}

/** A building's outer walls round x0..x1, z0..z1 with openings per side (coordinates along each wall). */
function shell(x0: number, z0: number, x1: number, z1: number, open: Partial<Record<Side, readonly Opening[]>>, y0 = 0, y1 = 4, t = 0.3, heights: Partial<Record<Side, number>> = {}): Box[] {
  return [
    ...wall('x', z0 + t / 2, x0, x1, open.S, y0, heights.S ?? y1, t),
    ...wall('x', z1 - t / 2, x0, x1, open.N, y0, heights.N ?? y1, t),
    ...wall('z', x0 + t / 2, z0 + t, z1 - t, open.W, y0, heights.W ?? y1, t),
    ...wall('z', x1 - t / 2, z0 + t, z1 - t, open.E, y0, heights.E ?? y1, t),
  ];
}

/** A curved run of short turned boxes (centre cx, cz; radius r; angles from +x toward +z). */
function arc(cx: number, cz: number, r: number, a0: number, a1: number, n: number, y0: number, y1: number, t: number, kind: LocalBox['kind'] = 'solid'): Box[] {
  const out: Box[] = [];
  const step = (a1 - a0) / n;
  const len = 2 * r * Math.sin(Math.abs(step) / 2) + Math.min(0.08, t * 0.3);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i + 0.5) * step;
    const mx = cx + r * Math.cos(a);
    const mz = cz + r * Math.sin(a);
    out.push({ min: [mx - len / 2, y0, mz - t / 2], max: [mx + len / 2, y1, mz + t / 2], yaw: -(a + Math.PI / 2), kind });
  }
  return out;
}

/** A frontier porch on the south side: a plank boardwalk (one 0.25 m step), a roof on posts. */
function porch(x0: number, x1: number, depth: number, roofY: number, posts: readonly number[]): Box[] {
  const z1 = -4 + depth;
  return [
    paint(b(x0, 0, -4, x1, 0.25, z1), 'pbr_weathered_planks'),
    paint(b(x0, roofY, -4, x1, roofY + 0.2, z1), 'pbr_weathered_planks', '#c8b090'),
    ...posts.map((x) => paint(b(x - 0.1, 0.25, -3.95, x + 0.1, roofY, -3.75), 'pbr_charred_wood')),
  ];
}


// ---------------------------------------------------------------- 01 Military Compound

/** Trench dimensions: earth berms 1.25 m high (a step short of a jump), a 0.3 m sandbag lip, a 3 m channel. */
const BERM = 1.25;
const LIP = 0.3;
const LIP_W = 0.45;
const CH = 1.5;
const earth = (x0: number, z0: number, x1: number, z1: number, top = BERM) => paint(b(x0, 0, z0, x1, top, z1), 'pbr_dusty_road', '#b8a080');
const lip = (x0: number, z0: number, x1: number, z1: number) => paint(b(x0, BERM, z0, x1, BERM + LIP, z1), 'pbr_burlap', '#e0c898');
/** Plank revetment on a berm's face toward the channel (visual). */
const revet = (x0: number, z0: number, x1: number, z1: number) => trim(x0, 0, z0, x1, BERM, z1, 'pbr_weathered_planks', '#a89070');
/** Duckboards down the channel (visual). */
const duck = (x0: number, z0: number, x1: number, z1: number) => trim(x0, 0, z0, x1, 0.05, z1, 'pbr_weathered_planks');

function trench(id: string, displayName: string, blurb: string, solids: Box[]): TileDefinition {
  return { id: `military.${id}`, category: 'Open', displayName, blurb, cells: [[0, 0, 0]], floors: [0], ports: ALL, open: true, edgeDefault: 'open', solids };
}

/** A berm along the west of the channel (x -4..-CH), from z0 to z1, its lip and revetment facing east. */
const westBerm = (z0: number, z1: number, lipZ0 = z0, lipZ1 = z1) => [earth(-4, z0, -CH, z1), lip(-CH - LIP_W, lipZ0, -CH, lipZ1), revet(-CH, z0, -CH + 0.06, z1)];
const eastBerm = (z0: number, z1: number, lipZ0 = z0, lipZ1 = z1) => [earth(CH, z0, 4, z1), lip(CH, lipZ0, CH + LIP_W, lipZ1), revet(CH - 0.06, z0, CH, z1)];

function trenches(): TileDefinition[] {
  const corner = (sx: 1 | -1, sz: 1 | -1): Box[] => {
    // A corner block of berm (the channel crosses beside it), lipped on its two faces toward the channel.
    const [x0, x1] = sx > 0 ? [CH, 4] : [-4, -CH];
    const [z0, z1] = sz > 0 ? [CH, 4] : [-4, -CH];
    const fx = sx > 0 ? CH : -CH;
    const fz = sz > 0 ? CH : -CH;
    return [
      earth(x0, z0, x1, z1),
      lip(Math.min(fx, fx + sx * LIP_W), z0, Math.max(fx, fx + sx * LIP_W), z1),
      lip(x0, Math.min(fz, fz + sz * LIP_W), x1, Math.max(fz, fz + sz * LIP_W)),
      revet(Math.min(fx, fx - sx * 0.06), z0, Math.max(fx, fx - sx * 0.06), z1),
      revet(x0, Math.min(fz, fz - sz * 0.06), x1, Math.max(fz, fz - sz * 0.06)),
    ];
  };
  // A berm wall across the north (x -4..4, z CH..4), lipped on its south face.
  const northBerm = (x0 = -4, x1 = 4): Box[] => [earth(x0, CH, x1, 4), lip(x0, CH, x1, CH + LIP_W), revet(x0, CH - 0.06, x1, CH)];
  return [
    trench('trench', 'Trench', 'A 3 m trench between earth berms with a sandbag lip: join pieces into a network (open ends lead out)', [...westBerm(-4, 4), ...eastBerm(-4, 4), duck(-0.6, -4, 0.6, 4)]),
    trench('trench_corner', 'Trench Corner', 'The trench turns from south to east', [
      earth(-4, -4, -CH, 4),
      lip(-CH - LIP_W, -4, -CH, CH),
      revet(-CH, -4, -CH + 0.06, CH),
      ...northBerm(-CH, 4),
      ...corner(1, -1),
      duck(-0.6, -4, 0.6, 0.6),
      duck(-0.6, -0.6, 4, 0.6),
    ]),
    trench('trench_t', 'Trench Junction', 'Three ways: south, east and west', [...northBerm(), ...corner(-1, -1), ...corner(1, -1), duck(-0.6, -4, 0.6, 0.6), duck(-4, -0.6, 4, 0.6)]),
    trench('trench_cross', 'Trench Crossing', 'Four ways', [...corner(-1, -1), ...corner(1, -1), ...corner(-1, 1), ...corner(1, 1), duck(-0.6, -4, 0.6, 4), duck(-4, -0.6, 4, 0.6)]),
    trench('trench_end', 'Trench Mouth', 'The trench opens out to the north; steps down the berm ends get you up on top', [
      earth(-4, -4, -CH, 1.5),
      lip(-CH - LIP_W, -4, -CH, 1.5),
      revet(-CH, -4, -CH + 0.06, 1.5),
      earth(CH, -4, 4, 1.5),
      lip(CH, -4, CH + LIP_W, 1.5),
      revet(CH - 0.06, -4, CH, 1.5),
      // Each berm end steps down to the ground northward (four 0.25 m steps under the 1.25 m top).
      ...[0, 1, 2, 3, 4].flatMap((i) => [paint(b(-4, 0, 1.5 + i * 0.5, -CH, BERM - (i + 1) * 0.25, 2 + i * 0.5), 'pbr_dusty_road', '#b8a080'), paint(b(CH, 0, 1.5 + i * 0.5, 4, BERM - (i + 1) * 0.25, 2 + i * 0.5), 'pbr_dusty_road', '#b8a080')]).filter((x) => x.max[1] > 0.01),
      duck(-0.6, -4, 0.6, 4),
    ]),
    trench('trench_steps', 'Trench Fire Step', 'A straight trench with plank steps cut up through the east berm, to go over the top', [
      ...westBerm(-4, 4),
      ...eastBerm(-4, -1.2),
      ...eastBerm(1.2, 4),
      // Five plank steps cut up through the east berm.
      ...flight('x', CH, -1.2, 1.2, 5, 0, 0.5).map((s) => paint(s, 'pbr_weathered_planks')),
      duck(-0.6, -4, 0.6, 4),
    ]),
    trench('trench_dugout', 'Trench Dugout', 'A straight trench roofed over in the middle with timber and sandbags', [
      ...westBerm(-4, 4, -4, 4),
      ...eastBerm(-4, 4, -4, 4),
      paint(b(-CH - 0.3, 2.3, -2.2, CH + 0.3, 2.55, 2.2), 'pbr_weathered_planks'),
      paint(b(-CH - 0.3, 2.55, -2.0, CH + 0.3, 2.9, 2.0), 'pbr_burlap', '#d8c090'),
      ...[-2.0, 2.0].flatMap((z) => [paint(b(-CH, 0, z - 0.12, -CH + 0.25, 2.3, z + 0.12), 'pbr_charred_wood'), paint(b(CH - 0.25, 0, z - 0.12, CH, 2.3, z + 0.12), 'pbr_charred_wood')]),
      duck(-0.6, -4, 0.6, 4),
    ]),
  ];
}

function militaryTiles(): TileDefinition[] {
  const wallCap = (x0: number, z0: number, x1: number, z1: number): Box[] => [trim(x0, 4, z0 - 0.05, x1, 4.15, z1 + 0.05, 'pbr_concrete'), trim(x0, 4.15, (z0 + z1) / 2 - 0.2, x1, 4.55, (z0 + z1) / 2 + 0.2, 'grate', '#8f959b')];
  const wallCapZ = (x0: number, z0: number, x1: number, z1: number): Box[] => [trim(x0 - 0.05, 4, z0, x1 + 0.05, 4.15, z1, 'pbr_concrete'), trim((x0 + x1) / 2 - 0.2, 4.15, z0, (x0 + x1) / 2 + 0.2, 4.55, z1, 'grate', '#8f959b')];
  const roof = (x0: number, z0: number, x1: number, z1: number, y: number, material = 'pbr_grey_corrugated') => paint(b(x0, y, z0, x1, y + 0.25, z1), material);
  const canvas = (box: Box) => paint(box, 'pbr_canvas');
  return [
    {
      id: 'military.barracks',
      category: 'Buildings',
      displayName: 'Barracks',
      blurb: '2 × 1 cells: rows of bunks either side of the aisle, lockers, a table, a corrugated roof',
      cells: footprint(2, 1),
      floors: [0],
      ports: [
        { side: 'S', level: 0, cell: [0, 0] },
        { side: 'N', level: 0, cell: [1, 0] },
        { side: 'E', level: 0, cell: [1, 0] },
      ],
      edgeDefaults: { '0,0,0:N': 'window', '1,0,0:S': 'window', '0,0,0:W': 'window' },
      solids: [
        ...[-1.5, 2.5].map((x) => canvas(b(x - 1, 0, 2.55, x + 1, 1.8, 3.6))),
        canvas(b(10.5 - 1, 0, 2.55, 10.5 + 1, 1.8, 3.6)),
        ...[5.5, 10].map((x) => canvas(b(x - 1, 0, -3.6, x + 1, 1.8, -2.55))),
        paint(b(-3.65, 0, -1.6, -3.1, 2.1, 1.6), 'pbr_steel', '#9aa47a'),
        paint(b(3.2, 0, -0.5, 5.8, 0.8, 0.5), 'crate_wood'),
        roof(-4, -4, 12, 4, 4),
        trim(-4, 4.25, -4, 12, 4.5, -3.8, 'pbr_olive_corrugated', '#c8d0b0'),
        trim(-4, 4.25, 3.8, 12, 4.5, 4, 'pbr_olive_corrugated', '#c8d0b0'),
      ],
    },
    {
      id: 'military.guard_tower',
      category: 'Vertical',
      displayName: 'Guard Tower',
      blurb: 'Open ground with stairs up to a sandbagged lookout 3 m up (over a 4 m wall) under a corrugated roof',
      cells: [
        [0, 0, 0],
        [0, 0, 1],
      ],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      // The lookout: a landing at the head of the stairs (north-west) and the deck east of them.
      extraFloors: [b(-3.8, 2.75, 1.6, 3.8, 3, 3.8), b(-1.2, 2.75, 0.4, 3.8, 3, 1.6)],
      solids: [
        ...flight('z', -3.8, -3.8, -1.2, 12, 0, 0.45).map((s) => paint(s, 'pbr_tread_plate')),
        ...[[-1.0, 0.6], [3.6, 0.6], [3.6, 3.6], [-3.6, 3.6]].map(([x, z]) => paint(b(x! - 0.18, 0, z! - 0.18, x! + 0.18, 2.75, z! + 0.18), 'pbr_steel')),
        // Sandbag parapet round the deck (the stairs come up at the west end).
        paint(b(-1.2, 3, 0.4, 3.8, 3.7, 0.8), 'pbr_burlap', '#e0c898'),
        paint(b(3.4, 3, 0.8, 3.8, 3.7, 3.8), 'pbr_burlap', '#e0c898'),
        paint(b(-3.8, 3, 3.4, 3.4, 3.7, 3.8), 'pbr_burlap', '#e0c898'),
        paint(b(-3.8, 3, 2.2, -3.4, 3.7, 3.4), 'pbr_burlap', '#e0c898'),
        // Roof on four posts.
        ...[[-1.1, 0.5], [3.7, 0.5], [3.7, 3.7], [-3.7, 3.7]].map(([x, z]) => paint(b(x! - 0.08, 3.7, z! - 0.08, x! + 0.08, 5.6, z! + 0.08), 'pbr_steel')),
        roof(-3.9, 0.3, 3.9, 3.9, 5.6, 'pbr_olive_corrugated'),
        trim(3.2, 5.85, 3.2, 3.6, 6.3, 3.6, 'pbr_steel'),
      ],
    },
    {
      id: 'military.pillbox',
      category: 'Buildings',
      displayName: 'Pillbox',
      blurb: 'A one-cell concrete strongpoint: firing slits all round, a thick roof, sandbags inside',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: [{ side: 'S', level: 0 }],
      edgeDefault: 'slit',
      solids: [
        paint(b(-3.4, 0, -1.2, -1.4, 0.9, -0.7), 'pbr_burlap', '#e0c898'),
        paint(b(1.4, 0, 1.0, 3.4, 0.9, 1.5), 'pbr_burlap', '#e0c898'),
        b(-4, 4, -4, 4, 4.9, 4),
        trim(-4.05, 4.9, -4.05, 4.05, 5.05, 4.05, 'pbr_concrete'),
      ],
    },
    {
      id: 'military.wall',
      category: 'Open',
      displayName: 'Compound Wall',
      blurb: 'Open ground with a 4 m concrete wall topped with wire along its north side: line them up round a compound',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [b(-4, 0, 3.0, 4, 4, 3.8, 'wall'), ...wallCap(-4, 3.0, 4, 3.8)],
    },
    {
      id: 'military.wall_corner',
      category: 'Open',
      displayName: 'Compound Wall Corner',
      blurb: 'The compound wall turning a corner (north and east sides)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [b(-4, 0, 3.0, 3.8, 4, 3.8, 'wall'), b(3.0, 0, -4, 3.8, 4, 3.0, 'wall'), ...wallCap(-4, 3.0, 3.8, 3.8), ...wallCapZ(3.0, -4, 3.8, 3.0), paint(b(2.8, 0, 2.8, 4, 4.6, 4), 'pbr_concrete')],
    },
    {
      id: 'military.gate',
      category: 'Open',
      displayName: 'Compound Gate',
      blurb: 'The compound wall with a 3 m gateway between pillars under a gantry: hang a blast door in it',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        b(-4, 0, 3.0, -2.1, 4, 3.8, 'wall'),
        b(2.1, 0, 3.0, 4, 4, 3.8, 'wall'),
        ...wallCap(-4, 3.0, -2.1, 3.8),
        ...wallCap(2.1, 3.0, 4, 3.8),
        paint(b(-2.1, 0, 2.7, -1.5, 5.2, 4), 'pbr_concrete'),
        paint(b(1.5, 0, 2.7, 2.1, 5.2, 4), 'pbr_concrete'),
        paint(b(-2.1, 4.4, 3.0, 2.1, 5.0, 3.8), 'pbr_steel'),
        trim(-2.15, 0, 2.65, -1.45, 1.2, 2.7, 'hazard'),
        trim(1.45, 0, 2.65, 2.15, 1.2, 2.7, 'hazard'),
        trim(-2.1, 4.45, 2.95, 2.1, 4.7, 3.0, 'hazard'),
      ],
    },
    ...trenches(),
    {
      id: 'military.gantry',
      category: 'Vertical',
      displayName: 'Catwalk Gantry',
      blurb: '1 × 2 cells: steel stairs up to a railed catwalk 4 m up on legs, meeting the level above at its north end',
      cells: footprint(1, 2, 2),
      floors: [0],
      ports: [...perimeter(1, 2), { side: 'N', level: 1, cell: [0, 1] }],
      open: true,
      edgeDefault: 'open',
      extraFloors: [paint(b(-1.2, 3.75, 3.4, 1.2, 4, 12), 'pbr_walkway')],
      solids: [
        ...flight('z', -3.8, -1.2, 1.2, 16, 0, 0.45).map((s) => paint(s, 'pbr_tread_plate')),
        rail(-1.2, 3.4, -1.2, 11.9, 4),
        rail(1.2, 3.4, 1.2, 11.9, 4),
        ...[6, 9, 11.6].flatMap((z) => [paint(b(-1.15, 0, z - 0.15, -0.85, 3.75, z + 0.15), 'pbr_steel'), paint(b(0.85, 0, z - 0.15, 1.15, 3.75, z + 0.15), 'pbr_steel')]),
        ...[6, 9, 11.6].map((z) => trim(-1.2, 3.45, z - 0.1, 1.2, 3.75, z + 0.1, 'pbr_steel')),
      ],
    },
    {
      id: 'military.helipad',
      category: 'Open',
      displayName: 'Helipad',
      blurb: '2 × 2 cells of open ground with a raised landing pad, its H and circle, and edge lights',
      cells: footprint(2, 2),
      floors: [0],
      ports: perimeter(2, 2),
      open: true,
      edgeDefault: 'open',
      solids: [
        paint(b(-2, 0, -2, 10, 0.15, 10), 'pbr_concrete_dark'),
        trim(1.6, 0.15, 0.8, 2.4, 0.19, 7.2, 'paint_matte', '#f2c14e'),
        trim(5.6, 0.15, 0.8, 6.4, 0.19, 7.2, 'paint_matte', '#f2c14e'),
        trim(2.4, 0.15, 3.6, 5.6, 0.19, 4.4, 'paint_matte', '#f2c14e'),
        ...arc(4, 4, 5.3, 0, Math.PI * 2, 24, 0.15, 0.18, 0.3, 'trim').map((x) => paint(x, 'paint_matte', '#e8e8e8')),
        ...[[-1.8, -1.8], [9.8, -1.8], [9.8, 9.8], [-1.8, 9.8], [4, -1.8], [4, 9.8], [-1.8, 4], [9.8, 4]].map(([x, z]) => trim(x! - 0.12, 0.15, z! - 0.12, x! + 0.12, 0.35, z! + 0.12, 'light_strip', '#7dff9a')),
      ],
    },
    {
      id: 'military.vehicle_shed',
      category: 'Buildings',
      displayName: 'Vehicle Shed',
      blurb: '2 × 1 cells: an open-fronted shed under a corrugated roof, with a workbench along the back',
      cells: footprint(2, 1),
      floors: [0],
      ports: perimeter(2, 1),
      open: true,
      edgeDefault: 'open',
      solids: [
        b(-4, 0, 3.4, 12, 4.5, 3.8, 'wall'),
        b(-4, 0, 0, -3.6, 4.5, 3.4, 'wall'),
        b(11.6, 0, 0, 12, 4.5, 3.4, 'wall'),
        ...[-3.8, 4, 11.8].map((x) => paint(b(x - 0.15, 0, -3.85, x + 0.15, 4.5, -3.55), 'pbr_steel')),
        roof(-4, -4, 12, 3.8, 4.5),
        paint(b(6, 0, 2.6, 9, 0.9, 3.4), 'crate_wood'),
        trim(-4, 4.2, -3.85, 12, 4.5, -3.55, 'hazard'),
      ],
    },
  ];
}

// ---------------------------------------------------------------- 02 Frontier Dust

function frontierTiles(): TileDefinition[] {
  const wood = (box: Box, tint?: string) => paint(box, 'pbr_walnut', tint);
  const plank = (box: Box, tint?: string) => paint(box, 'pbr_weathered_planks', tint);
  const steel = (box: Box) => paint(box, 'pbr_steel', '#6a6e72');
  const rock = (box: Box) => paint(box, 'pbr_travertine', '#c89878');
  /** Iron bars from a0 to a1 (0.3 m apart) along x at z = at, or along z at x = at; y0..y1. */
  const bars = (a0: number, a1: number, at: number, y0 = 0, y1 = 2.6, axis: 'x' | 'z' = 'x'): Box[] => {
    const out: Box[] = [];
    const bx = (u0: number, v0: number, u1: number, v1: number, w: number) => steel(axis === 'x' ? b(u0, v0, at - w, u1, v1, at + w) : b(at - w, v0, u0, at + w, v1, u1));
    for (let u = a0 + 0.15; u < a1 - 0.05; u += 0.3) out.push(bx(u - 0.03, y0, u + 0.03, y1, 0.03));
    out.push(bx(a0, y1 - 0.08, a1, y1, 0.05));
    return out;
  };
  /** A false-front sign board (visual) on the south face at z, centred on cx. */
  const sign = (cx: number, w: number, y: number, z: number, tint: string): Box[] => [trim(cx - w / 2, y, z - 0.12, cx + w / 2, y + 1.0, z, 'paint_matte', tint), trim(cx - w / 2 - 0.1, y - 0.1, z - 0.16, cx + w / 2 + 0.1, y, z, 'pbr_charred_wood'), trim(cx - w / 2 - 0.1, y + 1.0, z - 0.16, cx + w / 2 + 0.1, y + 1.1, z, 'pbr_charred_wood')];
  const roof = (x0: number, z0: number, x1: number, z1: number, y: number) => plank(b(x0, y, z0, x1, y + 0.25, z1), '#9a8a74');
  /** Rail-line trim: ballast, sleepers and two rails along z (gauge to suit the Kenney train props). */
  const railLine = (z0: number, z1: number, x = 0): Box[] => {
    const out: Box[] = [trim(x - 1.7, 0, z0, x + 1.7, 0.05, z1, 'pbr_gravel', '#a89880')];
    for (let z = z0 + 0.4; z < z1; z += 0.8) out.push(trim(x - 1.3, 0.05, z - 0.12, x + 1.3, 0.1, z + 0.12, 'pbr_weathered_planks', '#8a7458'));
    out.push(trim(x - 0.98, 0.1, z0, x - 0.86, 0.17, z1, 'pbr_steel'), trim(x + 0.86, 0.1, z0, x + 0.98, 0.17, z1, 'pbr_steel'));
    return out;
  };
  const road = (x0: number, z0: number, x1: number, z1: number) => trim(x0, 0, z0, x1, 0.04, z1, 'pbr_dusty_road');
  const P = 2.6; // porch depth
  const Z0 = -4 + P; // front wall line behind the porch
  return [
    {
      id: 'frontier.saloon',
      category: 'Buildings',
      displayName: 'Saloon',
      blurb: '2 × 2 cells, two storeys behind a porch and false front: a double-height bar room with tables and a piano, stairs up to a gallery and rooms over the street',
      cells: footprint(2, 2, 2),
      floors: [0],
      ports: perimeter(2, 2),
      open: true,
      edgeDefault: 'open',
      extraFloors: [plank(b(-0.9, 3.75, Z0 + 0.3, 11.5, 4, 5.0)), plank(b(-3.5, 3.75, Z0 + 0.3, -0.9, 4, 1.8))],
      solids: [
        ...porch(-4, 12, P, 3.6, [-3.8, 1.8, 6.2, 11.8]),
        ...shell(-3.8, Z0, 11.8, 11.8, { S: [win(0), door(4), win(8), win(0, 1.5, 5, 6.4), win(4, 1.5, 5, 6.4), win(8, 1.5, 5, 6.4)], W: [win(4), win(9, 1.5, 5, 6.4)], E: [door(2), win(6), win(6, 1.5, 5, 6.4)], N: [win(-1.6, 1.2), win(4, 1.5, 5, 6.4)] }, 0, 8, 0.3, { S: 10.4 }),
        // Stairs up the west wall from the back of the bar room to the gallery over the street, railed along its edge.
        ...Array.from({ length: 16 }, (_, i) => plank(b(-3.5, 0, 9.0 - (i + 1) * 0.45, -0.9, (i + 1) * 0.25, 9.0 - i * 0.45))),
        rail(-0.9, 5.0, 11.5, 5.0, 4, 'pbr_walnut'),
        // The bar with the back bar behind it, tables, the piano.
        wood(b(2.0, 0, 8.6, 10.0, 1.1, 9.4)),
        wood(b(1.0, 0, 11.0, 10.0, 2.2, 11.5), '#c8a080'),
        ...[[2.0, 1.5], [6.5, 2.5], [9.5, 5.5], [4.0, 5.8]].map(([x, z]) => wood(b(x! - 0.55, 0, z! - 0.55, x! + 0.55, 0.8, z! + 0.55), '#d8b890')),
        wood(b(8.6, 0, -1.0, 10.6, 1.3, -0.4)),
        // Upstairs: three rooms over the street off the gallery.
        ...wall('x', 2.4, -0.9, 11.5, [[0, 2, 0, 2.6], [4, 6, 0, 2.6], [8.5, 10.5, 0, 2.6]], 4, 7.6, 0.2),
        ...wall('z', 2.5, Z0 + 0.3, 2.3, [], 4, 7.6, 0.2),
        ...wall('z', 7.5, Z0 + 0.3, 2.3, [], 4, 7.6, 0.2),
        wood(b(5.2, 4, -1.0, 7.2, 4.5, 0.6), '#b08070'),
        wood(b(9.4, 4, -1.0, 11.4, 4.5, 0.6), '#b08070'),
        roof(-3.8, Z0, 11.8, 11.8, 8),
        // False front: sign board and a cornice along the top.
        ...sign(4, 7, 8.4, Z0 - 0.15, '#7a2a1e'),
        trim(-3.85, 10.4, Z0 - 0.2, 11.85, 10.6, Z0 + 0.3, 'pbr_charred_wood'),
      ],
    },
    {
      id: 'frontier.bank',
      category: 'Buildings',
      displayName: 'Bank',
      blurb: '2 × 1 cells behind a porch: a lobby, a barred teller counter and a thick-walled vault with a 3 m doorway for a vault door',
      cells: footprint(2, 1),
      floors: [0],
      ports: perimeter(2, 1),
      open: true,
      edgeDefault: 'open',
      solids: [
        ...porch(-4, 12, P, 3.4, [-3.8, 3.4, 8.0, 11.8]),
        ...shell(-3.8, Z0, 11.8, 3.8, { S: [door(1.5), win(6.3)], W: [win(1.2)], N: [win(-1.0, 1.2, 1.6, 2.4), win(4.0, 1.2, 1.6, 2.4)] }, 0, 4.4, 0.3, { S: 6.6 }),
        // Teller counter with bars, a 2 m gate at its north end.
        wood(b(4.4, 0, Z0 + 0.3, 5.0, 1.1, 1.4)),
        ...bars(Z0 + 0.3, 1.4, 4.7, 1.1, 2.6, 'z'),
        wood(b(5.8, 0, Z0 + 0.4, 7.2, 0.8, Z0 + 1.1)),
        // The vault: thick steel-lined walls, its doorway facing the teller room (west).
        ...wall('z', 8.3, Z0 + 0.3, 3.5, [[0.0, 3.0, 0, 3]], 0, 4.4, 0.6).map((x) => paint(x, 'pbr_bunker_panels')),
        steel(b(10.8, 0, Z0 + 0.4, 11.5, 2.2, 3.4)),
        steel(b(8.7, 0, 2.8, 10.6, 1.0, 3.4)),
        roof(-3.8, Z0, 11.8, 3.8, 4.4),
        ...sign(4, 6, 4.9, Z0 - 0.15, '#2a4a3a'),
        trim(-3.85, 6.5, Z0 - 0.2, 11.85, 6.7, Z0 + 0.3, 'pbr_charred_wood'),
      ],
    },
    {
      id: 'frontier.jail',
      category: 'Buildings',
      displayName: 'Jail',
      blurb: "2 × 1 cells: the sheriff's office, and three barred cells off a corridor",
      cells: footprint(2, 1),
      floors: [0],
      ports: perimeter(2, 1),
      open: true,
      edgeDefault: 'open',
      solids: [
        ...porch(-4, 12, P, 3.4, [-3.8, 3.0, 11.8]),
        ...shell(-3.8, Z0, 11.8, 3.8, { S: [door(0), win(6.5)], W: [win(1.2)], N: [win(5.5, 0.8, 1.8, 2.4), win(8.0, 0.8, 1.8, 2.4), win(10.4, 0.8, 1.8, 2.4)] }, 0, 4.2, 0.3, { S: 6.2 }),
        // Office: the sheriff's desk and a gun rack.
        wood(b(-2.8, 0, 1.6, -0.8, 0.8, 2.6)),
        wood(b(-3.5, 0.9, -0.4, -3.3, 2.2, 1.2)),
        // Partition with a doorway into the cell corridor; the three cells behind bars.
        ...wall('z', 4.3, Z0 + 0.3, 3.5, [[Z0 + 0.4, 1.3, 0, 3]], 0, 4.2, 0.2),
        ...[[4.4, 6.6], [6.8, 9.0], [9.2, 11.5]].flatMap(([x0, x1]) => [...bars(x0!, (x0! + x1!) / 2 - 0.6, 1.3), ...bars((x0! + x1!) / 2 + 0.6, x1!, 1.3), steel(b((x0! + x1!) / 2 - 0.6, 2.5, 1.25, (x0! + x1!) / 2 + 0.6, 2.6, 1.35))]),
        ...wall('z', 6.7, 1.3, 3.5, [], 0, 4.2, 0.2),
        ...wall('z', 9.1, 1.3, 3.5, [], 0, 4.2, 0.2),
        ...[5.5, 7.9, 10.35].map((x) => wood(b(x - 0.9, 0, 2.7, x + 0.9, 0.5, 3.4), '#8a7a6a')),
        roof(-3.8, Z0, 11.8, 3.8, 4.2),
        ...sign(4, 5, 4.6, Z0 - 0.15, '#3a3a3a'),
        trim(-3.85, 6.1, Z0 - 0.2, 11.85, 6.3, Z0 + 0.3, 'pbr_charred_wood'),
      ],
    },
    {
      id: 'frontier.store',
      category: 'Buildings',
      displayName: 'General Store',
      blurb: '2 × 1 cells behind a porch: display windows, a counter, shelves round the walls, barrels and crates',
      cells: footprint(2, 1),
      floors: [0],
      ports: perimeter(2, 1),
      open: true,
      edgeDefault: 'open',
      solids: [
        ...porch(-4, 12, P, 3.4, [-3.8, 2.2, 5.8, 11.8]),
        ...shell(-3.8, Z0, 11.8, 3.8, { S: [win(0, 3, 0.8, 2.6), door(4), win(8.5, 3, 0.8, 2.6)], E: [win(1.2)] }, 0, 4.2, 0.3, { S: 6.4 }),
        wood(b(5.5, 0, 0.3, 9.5, 1.0, 0.9)),
        wood(b(-3.5, 0, 3.0, 10.5, 2.4, 3.5), '#c8a080'),
        wood(b(-3.5, 0, Z0 + 0.3, -3.0, 2.4, 2.4), '#c8a080'),
        b(-0.5, 0, 0.4, 0.5, 1.0, 1.4),
        b(1.6, 0, 1.4, 2.4, 0.8, 2.2),
        roof(-3.8, Z0, 11.8, 3.8, 4.2),
        ...sign(4, 7, 4.7, Z0 - 0.15, '#2a3a5a'),
        trim(-3.85, 6.3, Z0 - 0.2, 11.85, 6.5, Z0 + 0.3, 'pbr_charred_wood'),
      ],
    },
    {
      id: 'frontier.church',
      category: 'Buildings',
      displayName: 'Chapel',
      blurb: '1 × 2 cells: a plank chapel with pews, an altar on a dais and a bell tower over the door',
      cells: footprint(1, 2),
      floors: [0],
      ports: perimeter(1, 2),
      open: true,
      edgeDefault: 'open',
      solids: [
        plank(b(-3, 0, -4, 3, 0.25, -2.0)),
        ...shell(-3.6, -2.0, 3.6, 11.6, { S: [door(0, 3, 3.2)], W: [win(1.5, 1.2, 1.2, 3.2), win(5, 1.2, 1.2, 3.2), win(8.5, 1.2, 1.2, 3.2)], E: [win(1.5, 1.2, 1.2, 3.2), win(5, 1.2, 1.2, 3.2), win(8.5, 1.2, 1.2, 3.2)] }, 0, 5, 0.3),
        ...[1.5, 3.0, 4.5, 6.0, 7.5].flatMap((z) => [wood(b(-3.0, 0, z - 0.25, -1.2, 0.9, z + 0.25), '#b89070'), wood(b(1.2, 0, z - 0.25, 3.0, 0.9, z + 0.25), '#b89070')]),
        plank(b(-3.3, 0, 9.2, 3.3, 0.25, 11.3)),
        wood(b(-1, 0.25, 10.0, 1, 1.25, 10.8), '#e8e0d0'),
        roof(-3.6, -2.0, 3.6, 11.6, 5),
        // Bell tower over the door: walls, a belfry open on four sides, a spire.
        ...shell(-1.6, -2.0, 1.6, 1.2, { S: [[-1, 1, 1.5, 3.2]], N: [[-1, 1, 1.5, 3.2]], E: [[-0.8, 0.8, 1.5, 3.2]], W: [[-0.8, 0.8, 1.5, 3.2]] }, 5.25, 9, 0.25),
        plank(b(-1.7, 9, -2.1, 1.7, 9.3, 1.3)),
        plank(b(-1.2, 9.3, -1.6, 1.2, 10.3, 0.8)),
        plank(b(-0.7, 10.3, -1.1, 0.7, 11.5, 0.3)),
        trim(-0.08, 11.5, -0.48, 0.08, 12.6, -0.32, 'pbr_charred_wood'),
        trim(-0.45, 12.0, -0.48, 0.45, 12.14, -0.32, 'pbr_charred_wood'),
        trim(-0.5, 6.4, -0.75, 0.5, 7.3, 0.05, 'brass'),
      ],
    },
    {
      id: 'frontier.livery',
      category: 'Buildings',
      displayName: 'Livery Stable',
      blurb: '2 × 2 cells: a barn with a wide door, horse stalls along the back and a hay loft up the stairs',
      cells: footprint(2, 2),
      floors: [0],
      ports: perimeter(2, 2),
      open: true,
      edgeDefault: 'open',
      extraFloors: [plank(b(-3.5, 2.75, 5.0, 11.5, 3, 11.5))],
      solids: [
        ...shell(-3.8, -3.8, 11.8, 11.8, { S: [[1.0, 7.0, 0, 4.2], win(10)], N: [door(4)], W: [win(0)] }, 0, 5.6, 0.3),
        // Stairs along the east wall up to the loft, railed along its edge.
        ...flight('z', -1.0, 8.9, 11.5, 12, 0, 0.5).map((s) => plank(s)),
        rail(-3.5, 5.0, 8.9, 5.0, 3, 'pbr_walnut'),
        // Stalls: low partitions open to the aisle.
        ...[0, 4, 8].flatMap((x) => wall('z', x, 6.6, 11.5, [], 0, 1.4, 0.15)),
        ...[[2, 10.5], [6, 10.5]].map(([x, z]) => paint(b(x! - 1.0, 0, z! - 0.5, x! + 1.0, 0.6, z! + 0.5), 'pbr_weathered_planks', '#c8a860')),
        // Hay bales up in the loft.
        ...[[-2, 9.5], [0.5, 10.5], [3, 9.5]].map(([x, z]) => paint(b(x! - 0.7, 3, z! - 0.5, x! + 0.7, 3.8, z! + 0.5), 'canvas', '#e8c870')),
        roof(-3.8, -3.8, 11.8, 11.8, 5.6),
        trim(-3.85, 4.4, -4.0, 11.85, 4.6, -3.65, 'pbr_charred_wood'),
      ],
    },
    {
      id: 'frontier.station',
      category: 'Buildings',
      displayName: 'Rail Station',
      blurb: '2 × 1 cells: a ticket office and a covered boardwalk platform along the north edge, where the rails run',
      cells: footprint(2, 1),
      floors: [0],
      ports: perimeter(2, 1),
      open: true,
      edgeDefault: 'open',
      solids: [
        // The office (south-west), a door each side and a ticket window onto the platform.
        ...shell(-3.8, -3.8, 5.0, 0.2, { S: [door(0)], N: [door(2.6), win(-1.5, 1.2)], E: [win(-1.8)] }, 0, 3.6, 0.3),
        wood(b(-3.5, 0, -0.6, -0.4, 1.1, -0.1)),
        roof(-3.9, -3.9, 5.1, 0.3, 3.6),
        // The platform: a plank boardwalk under a canopy on posts.
        plank(b(-4, 0, 0.2, 12, 0.25, 4)),
        ...[-3.6, 2.0, 8.0, 11.6].map((x) => paint(b(x - 0.12, 0.25, 3.5, x + 0.12, 3.6, 3.74), 'pbr_charred_wood')),
        paint(b(5.0, 0.25, 0.2, 5.24, 3.6, 0.44), 'pbr_charred_wood'),
        paint(b(-4, 3.6, 0.2, 12, 3.8, 4), 'pbr_grey_corrugated', '#c8b8a0'),
        wood(b(6.2, 0.25, 0.7, 8.6, 0.7, 1.2), '#b89070'),
        ...sign(0.6, 4, 3.9, -3.8, '#5a3a1e'),
      ],
    },
    {
      id: 'frontier.water_tower',
      category: 'Open',
      displayName: 'Water Tower',
      blurb: 'Open ground under a plank water tank on four timber legs (add a ladder to climb it)',
      cells: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 0, 2],
      ],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      extraFloors: [plank(b(-2.6, 5.8, -2.6, 2.6, 6.1, 2.6))],
      solids: [
        ...[[-2.2, -2.2], [2.2, -2.2], [2.2, 2.2], [-2.2, 2.2]].map(([x, z]) => paint(b(x! - 0.18, 0, z! - 0.18, x! + 0.18, 5.8, z! + 0.18), 'pbr_charred_wood')),
        ...[1.9, 3.9].flatMap((y) => [trim(-2.2, y, -2.3, 2.2, y + 0.15, -2.1, 'pbr_charred_wood'), trim(-2.2, y, 2.1, 2.2, y + 0.15, 2.3, 'pbr_charred_wood'), trim(-2.3, y, -2.2, -2.1, y + 0.15, 2.2, 'pbr_charred_wood'), trim(2.1, y, -2.2, 2.3, y + 0.15, 2.2, 'pbr_charred_wood')]),
        ...arc(0, 0, 2.3, 0, Math.PI * 2, 16, 6.1, 9.2, 0.25).map((x) => plank(x, '#c8a070')),
        ...[6.6, 7.8, 9.0].flatMap((y) => arc(0, 0, 2.45, 0, Math.PI * 2, 16, y, y + 0.1, 0.06, 'trim').map((x) => paint(x, 'pbr_steel', '#4a4a4a'))),
        plank(b(-2.0, 9.2, -2.0, 2.0, 9.45, 2.0), '#9a8a74'),
        plank(b(-1.3, 9.45, -1.3, 1.3, 9.75, 1.3), '#9a8a74'),
        plank(b(-0.6, 9.75, -0.6, 0.6, 10.1, 0.6), '#9a8a74'),
        trim(2.3, 7.4, -0.12, 3.3, 7.6, 0.12, 'pbr_steel', '#4a4a4a'),
      ],
    },
    {
      id: 'frontier.mine_entrance',
      category: 'Corridors',
      displayName: 'Mine Entrance',
      blurb: 'A timbered tunnel mouth in a rocky hillside, running north (join Mine Tunnels behind it)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: [
        { side: 'S', level: 0 },
        { side: 'N', level: 0 },
      ],
      open: true,
      edgeDefault: 'open',
      solids: [
        rock(b(-4, 0, -1.5, -1.8, 5.5, 4)),
        rock(b(1.8, 0, -1.5, 4, 5.5, 4)),
        rock(b(-1.8, 3.4, -1.5, 1.8, 5.5, 4)),
        rock(b(-4, 0, -3.0, -2.2, 3.2, -1.5)),
        rock(b(2.2, 0, -3.0, 4, 3.2, -1.5)),
        rock(b(-4, 0, -4, -2.8, 1.4, -3.0)),
        rock(b(2.8, 0, -4, 4, 1.4, -3.0)),
        rock(b(-3.2, 5.5, -0.5, 3.2, 6.6, 4)),
        // The timber portal, and timber sets inside.
        wood(b(-1.8, 0, -1.9, -1.45, 3.4, -1.5), '#8a6a4a'),
        wood(b(1.45, 0, -1.9, 1.8, 3.4, -1.5), '#8a6a4a'),
        wood(b(-2.0, 3.4, -1.95, 2.0, 3.8, -1.45), '#8a6a4a'),
        ...[0.8, 3.2].flatMap((z) => [trim(-1.8, 0, z - 0.15, -1.62, 3.4, z + 0.15, 'pbr_walnut', '#8a6a4a'), trim(1.62, 0, z - 0.15, 1.8, 3.4, z + 0.15, 'pbr_walnut', '#8a6a4a'), trim(-1.8, 3.2, z - 0.15, 1.8, 3.4, z + 0.15, 'pbr_walnut', '#8a6a4a')]),
        ...[-0.75, 0.75].map((x) => trim(x - 0.05, 0, -4, x + 0.05, 0.1, 4, 'pbr_steel')),
      ],
    },
    {
      id: 'frontier.mine_tunnel',
      category: 'Corridors',
      displayName: 'Mine Tunnel',
      blurb: 'A 3.6 m tunnel through rock, north to south, shored up with timber sets and laid with cart rails',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: [
        { side: 'S', level: 0 },
        { side: 'N', level: 0 },
      ],
      open: true,
      edgeDefault: 'open',
      solids: [
        rock(b(-4, 0, -4, -1.8, 5.5, 4)),
        rock(b(1.8, 0, -4, 4, 5.5, 4)),
        rock(b(-1.8, 3.4, -4, 1.8, 5.5, 4)),
        ...[-2.67, 0, 2.67].flatMap((z) => [trim(-1.8, 0, z - 0.15, -1.62, 3.4, z + 0.15, 'pbr_walnut', '#8a6a4a'), trim(1.62, 0, z - 0.15, 1.8, 3.4, z + 0.15, 'pbr_walnut', '#8a6a4a'), trim(-1.8, 3.2, z - 0.15, 1.8, 3.4, z + 0.15, 'pbr_walnut', '#8a6a4a')]),
        ...[-0.75, 0.75].map((x) => trim(x - 0.05, 0, -4, x + 0.05, 0.1, 4, 'pbr_steel')),
        trim(-0.1, 2.9, -0.1, 0.1, 3.2, 0.1, 'light_strip', '#ffcf7a'),
      ],
    },
    {
      id: 'frontier.main_street',
      category: 'Open',
      displayName: 'Main Street',
      blurb: 'Open ground laid as a dusty road (join them up; drop props and buildings along it)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [road(-4, -4, 4, 4)],
    },
    {
      id: 'frontier.boardwalk_street',
      category: 'Open',
      displayName: 'Boardwalk Street',
      blurb: 'A dusty road north to south with raised plank boardwalks and hitching rails either side',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        road(-2.6, -4, 2.6, 4),
        plank(b(-4, 0, -4, -2.6, 0.25, 4)),
        plank(b(2.6, 0, -4, 4, 0.25, 4)),
        ...[-1, 1].flatMap((s) => [wood(b(s * 2.45 - 0.07, 0, -1.6, s * 2.45 + 0.07, 1.1, -1.46)), wood(b(s * 2.45 - 0.07, 0, 1.46, s * 2.45 + 0.07, 1.1, 1.6)), wood(b(s * 2.45 - 0.06, 0.95, -1.6, s * 2.45 + 0.06, 1.07, 1.6))]),
      ],
    },
    {
      id: 'frontier.rail_line',
      category: 'Open',
      displayName: 'Rail Line',
      blurb: 'Open ground with a railroad track north to south (sleepers and rails are flush: walk or drive over them)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: railLine(-4, 4),
    },
    {
      id: 'frontier.rail_crossing',
      category: 'Open',
      displayName: 'Rail Crossing',
      blurb: 'A dusty road crossing the railroad, with a crossing sign',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        road(-4, -2.6, -1.7, 2.6),
        road(1.7, -2.6, 4, 2.6),
        ...railLine(-4, 4),
        trim(-1.7, 0.05, -2.6, 1.7, 0.18, 2.6, 'pbr_weathered_planks'),
        wood(b(-3.4, 0, -3.4, -3.2, 3.2, -3.2)),
        // The crossbuck.
        { ...trim(-3.95, 2.5, -3.38, -2.65, 2.7, -3.22, 'paint_matte', '#e8e0d0'), yaw: 0.7 },
        { ...trim(-3.95, 2.5, -3.38, -2.65, 2.7, -3.22, 'paint_matte', '#e8e0d0'), yaw: -0.7 },
      ],
    },
    {
      id: 'frontier.corral',
      category: 'Open',
      displayName: 'Corral',
      blurb: '2 × 2 cells of open ground fenced with timber rails, a gate gap on the south side',
      cells: footprint(2, 2),
      floors: [0],
      ports: perimeter(2, 2),
      open: true,
      edgeDefault: 'open',
      solids: (() => {
        const out: Box[] = [];
        const x0 = -3.6;
        const x1 = 11.6;
        const fence = (axis: 'x' | 'z', at: number, a0: number, a1: number) => {
          for (let u = a0; u <= a1 + 1e-6; u += (a1 - a0) / Math.round((a1 - a0) / 2.5)) out.push(wood(axis === 'x' ? b(u - 0.1, 0, at - 0.1, u + 0.1, 1.3, at + 0.1) : b(at - 0.1, 0, u - 0.1, at + 0.1, 1.3, u + 0.1), '#c8a888'));
          for (const y of [0.55, 1.05]) out.push(wood(axis === 'x' ? b(a0, y, at - 0.05, a1, y + 0.14, at + 0.05) : b(at - 0.05, y, a0, at + 0.05, y + 0.14, a1), '#c8a888'));
        };
        fence('x', x1, x0, x1);
        fence('z', x0, x0, x1);
        fence('z', x1, x0, x1);
        fence('x', x0, x0, 2.5);
        fence('x', x0, 5.5, x1);
        return out;
      })(),
    },
  ];
}

/** Every Style Pack tile, in palette order. */
export function stylePackTiles(): TileDefinition[] {
  return [...militaryTiles(), ...frontierTiles()];
}

