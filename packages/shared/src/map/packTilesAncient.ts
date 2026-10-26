/**
 * Style Pack tiles for 03 Imperial Arena (Roman) and 09 Sands of Egypt
 * (Sprint 7): box-built like the core buildings and the other packs' tiles
 * (packTiles.ts). The stone that must look the part in any theme (limestone
 * seating, marble columns, painted hieroglyph walls, sandstone pylons)
 * carries its own library material (`LocalBox.surface`); plain walls take the
 * theme's wall paint.
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
const trim = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, material: string, tint?: string): Box => paint(b(x0, y0, z0, x1, y1, z1, 'trim'), material, tint);
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

/** Steps of 0.25 m climbing along +x/-x or +z/-z from `from`, between a0 and a1 across, each a block down to `floor`. */
function flight(axis: 'x' | 'z', dir: 1 | -1, from: number, a0: number, a1: number, n: number, base = 0, run = 0.5, floor = 0): Box[] {
  return Array.from({ length: n }, (_, i) => {
    const u0 = from + dir * i * run;
    const u1 = from + dir * (i + 1) * run;
    const top = base + (i + 1) * 0.25;
    return axis === 'x' ? b(Math.min(u0, u1), floor, a0, Math.max(u0, u1), top, a1) : b(a0, floor, Math.min(u0, u1), a1, top, Math.max(u0, u1));
  });
}

/**
 * A round column standing at x, z from y0, `h` tall and `r` round: a square
 * plinth, a shaft of three boxes turned 30° apart (it reads as fluted), and a
 * capital. Solid: shots and players stop at it.
 */
function column(x: number, z: number, y0: number, h: number, r: number, material: string, capital = material, tint?: string): Box[] {
  const out: Box[] = [paint(b(x - r * 1.3, y0, z - r * 1.3, x + r * 1.3, y0 + 0.3, z + r * 1.3), capital, tint)];
  for (const yaw of [0, Math.PI / 6, Math.PI / 3]) out.push({ ...paint(b(x - r * 0.87, y0 + 0.3, z - r * 0.87, x + r * 0.87, y0 + h - 0.35, z + r * 0.87), material, tint), ...(yaw ? { yaw } : {}) });
  out.push(paint(b(x - r * 1.25, y0 + h - 0.35, z - r * 1.25, x + r * 1.25, y0 + h, z + r * 1.25), capital, tint));
  return out;
}

/**
 * The stone over a round-headed opening in a wall: the opening runs from
 * c - r to c + r along the wall (x at z0..z1, or z at x0..x1), springing at
 * `spring`; slices of wall fill from the curve up to `top`.
 */
function arch(axis: 'x' | 'z', c: number, r: number, spring: number, top: number, t0: number, t1: number, material: string, n = 10): Box[] {
  const out: Box[] = [];
  for (let i = 0; i < n; i++) {
    const u0 = c - r + (i * 2 * r) / n;
    const u1 = c - r + ((i + 1) * 2 * r) / n;
    const m = Math.min(Math.abs(u0 - c), Math.abs(u1 - c));
    const y = spring + Math.sqrt(Math.max(0, r * r - m * m));
    if (y >= top) continue;
    out.push(paint(axis === 'x' ? b(u0, y, t0, u1, top, t1) : b(t0, y, u0, t1, top, u1), material));
  }
  return out;
}

// ---------------------------------------------------------------- 03 Imperial Arena

/**
 * The arena's seating (cavea), in bands by distance from the arena's edge:
 * the 2 m podium wall (too high to jump up from the sand), the podium
 * walkway, eight rows of seats of 0.25 m (walk up them) and the top walkway
 * at 4 m, level with the floor above (the outer arcades' upper walkway).
 */
const CAVEA: readonly (readonly [d0: number, d1: number, top: number, material: string])[] = [
  [0, 0.5, 2.0, 'pbr_white_marble'],
  [0.5, 2.0, 2.0, 'pbr_travertine'],
  ...Array.from({ length: 8 }, (_, i) => [2.0 + i * 0.6, 2.6 + i * 0.6, 2.25 + i * 0.25, i % 2 ? 'pbr_travertine' : 'pbr_limestone'] as const),
  [6.8, 8.0, 4.0, 'pbr_travertine'],
];
/** The marble parapet along the podium: jump it into the arena (0.75 m), or lean on it. */
const PARAPET = [0.05, 0.3, 2.0, 2.75] as const;

/** Straight seating along x, the arena to the south (local -z), cut away over x0..x1 (a passage) when given. */
function caveaStraight(cut?: readonly [number, number]): Box[] {
  const out: Box[] = [];
  const spans: [number, number][] = cut ? [[-4, cut[0]], [cut[1], 4]] : [[-4, 4]];
  for (const [d0, d1, top, mat] of CAVEA) for (const [x0, x1] of spans) out.push(paint(b(x0, 0, -4 + d0, x1, top, -4 + d1), mat));
  for (const [x0, x1] of spans) out.push(paint(b(x0, PARAPET[2], -4 + PARAPET[0], x1, PARAPET[3], -4 + PARAPET[1]), 'pbr_white_marble'));
  return out;
}

/**
 * Seating round an outer corner of the arena (the sand to the south and to
 * the west): each band is an L about the arena's corner, so rows from the
 * straight sections on either side meet in mitres.
 */
function caveaCorner(): Box[] {
  const out: Box[] = [];
  const band = (d0: number, d1: number, y0: number, y1: number, mat: string) => {
    out.push(paint(b(-4 + d0, y0, -4, -4 + d1, y1, -4 + d1), mat), paint(b(-4, y0, -4 + d0, -4 + d0, y1, -4 + d1), mat));
  };
  for (const [d0, d1, top, mat] of CAVEA) band(d0, d1, 0, top, mat);
  band(PARAPET[0], PARAPET[1], PARAPET[2], PARAPET[3], 'pbr_white_marble');
  return out;
}

function imperialTiles(): TileDefinition[] {
  const LIME = 'pbr_limestone';
  const MARBLE = 'pbr_white_marble';
  const TRAV = 'pbr_travertine';
  const RUBBLE = 'pbr_opus_incertum';
  const wood = (box: Box) => paint(box, 'pbr_weathered_planks');
  const iron = (box: Box) => paint(box, 'grate', '#5a524a');
  const seat = (id: string, displayName: string, blurb: string, solids: Box[], extra: Partial<TileDefinition> = {}): TileDefinition => ({
    id: `imperial.${id}`,
    category: 'Large',
    displayName,
    blurb,
    cells: [
      [0, 0, 0],
      [0, 0, 1],
    ],
    floors: [0],
    ports: [...ALL, { side: 'N', level: 1 }],
    open: true,
    edgeDefault: 'open',
    solids,
    ...extra,
  });
  /** One storey of an arcade's outer face (local north): half piers at both ends, a round arch between them. */
  const arcadeStorey = (y0: number, withRail: boolean): Box[] => [
    paint(b(-4, y0, 2.6, -2.6, y0 + 4, 3.6), LIME),
    paint(b(2.6, y0, 2.6, 4, y0 + 4, 3.6), LIME),
    ...arch('x', 0, 2.6, y0 + 0.8, y0 + 3.5, 2.6, 3.6, LIME),
    paint(b(-4, y0 + 3.5, 2.6, 4, y0 + 4.0, 4.0), TRAV),
    ...column(-3.7, 3.72, y0, 3.5, 0.21, MARBLE),
    ...column(3.7, 3.72, y0, 3.5, 0.21, MARBLE),
    ...(withRail ? [paint(b(-2.6, y0, 2.9, 2.6, y0 + 0.9, 3.2), TRAV)] : []),
  ];
  return [
    seat('seating', 'Arena Seating', 'Tiers of seats rising from a 2 m podium wall over the sand (south) to a walkway 4 m up: line the arena with them', caveaStraight()),
    seat('seating_corner', 'Arena Seating Corner', 'Seating turning a corner round the arena (the sand to the south and west)', caveaCorner(), { ports: [...ALL, { side: 'N', level: 1 }, { side: 'E', level: 1 }] }),
    seat('gate', 'Gladiator Gate', 'Seating cut by a 3 m passage onto the sand, roofed at the top walkway: hang a portcullis in the opening at its south end', [
      ...caveaStraight([-1.6, 1.6]),
      // The passage roof (level with the top walkway) and the gatehouse block over the opening.
      paint(b(-1.6, 3.2, -2.0, 1.6, 4.0, 4.0), TRAV),
      paint(b(-2.2, 3.0, -3.9, 2.2, 4.0, -2.0), LIME),
      paint(b(-2.3, 3.6, -4.0, 2.3, 4.0, -3.9), MARBLE),
      // Rubble-faced passage walls and a timber ceiling.
      trim(-1.62, 0, -2.0, -1.6, 3.2, 4.0, RUBBLE),
      trim(1.6, 0, -2.0, 1.62, 3.2, 4.0, RUBBLE),
      ...[-1.0, 1.0, 3.0].map((z) => trim(-1.6, 2.95, z - 0.12, 1.6, 3.2, z + 0.12, 'pbr_weathered_planks')),
    ]),
    seat('emperor_box', "Emperor's Box", 'Seating with the pulvinar in the middle: a raised marble box under a canopy on four columns, steps up to the top walkway behind it', [
      // Seats either side of the box.
      ...CAVEA.flatMap(([d0, d1, top, mat]) => [paint(b(-4, 0, -4 + d0, -3, top, -4 + d1), mat), paint(b(3, 0, -4 + d0, 4, top, -4 + d1), mat)]),
      ...[-1, 1].map((s) => paint(b(s < 0 ? -4 : 3, PARAPET[2], -4 + PARAPET[0], s < 0 ? -3 : 4, PARAPET[3], -4 + PARAPET[1]), MARBLE)),
      // The box: a 3 m podium front, the floor 3 m up, steps up to 4 m behind it.
      paint(b(-3, 0, -3.95, 3, 3.0, 0.5), MARBLE),
      trim(-3, 3.0, -1.5, 3, 3.02, 0.5, 'pbr_carpet', '#7a2a6a'),
      ...flight('z', 1, 0.5, -3, 3, 4, 3.0, 0.5),
      paint(b(-3, 0, 2.5, 3, 4.0, 4.0), TRAV),
      paint(b(-3, 3.0, -4.0, 3, 3.8, -3.75), MARBLE),
      paint(b(-3, 3.0, -3.75, -2.8, 3.8, 0.5), MARBLE),
      paint(b(2.8, 3.0, -3.75, 3, 3.8, 0.5), MARBLE),
      trim(-3.05, 2.6, -4.0, 3.05, 2.9, -3.95, 'gold_leaf'),
      // Four columns and the canopy.
      ...[[-2.6, -3.4], [2.6, -3.4], [-2.6, 0.2], [2.6, 0.2]].flatMap(([x, z]) => column(x!, z!, 3.0, 3.4, 0.22, MARBLE)),
      paint(b(-3.1, 6.4, -3.9, 3.1, 6.7, 0.7), TRAV),
      trim(-3.2, 6.7, -4.0, 3.2, 6.85, 0.8, 'pbr_canvas', '#6a2a6a'),
      trim(-3.2, 6.2, -4.0, 3.2, 6.4, -3.9, 'gold_leaf'),
    ]),
    {
      id: 'imperial.arcade',
      category: 'Buildings',
      displayName: 'Outer Arcade',
      blurb: "Two storeys of arches on the outside of the arena (local north): a covered walk below, an upper walkway 4 m up meeting the seating's top walkway",
      cells: [
        [0, 0, 0],
        [0, 0, 1],
      ],
      floors: [0],
      ports: [...ALL, ...ALL.map((p) => ({ ...p, level: 1 }))],
      open: true,
      edgeDefault: 'open',
      extraFloors: [paint(b(-4, 3.5, -4, 4, 4.0, 2.6), TRAV)],
      solids: [...arcadeStorey(0, false), ...arcadeStorey(4, true), paint(b(-4, 8.0, 2.6, 4, 8.6, 4.0), LIME)],
    },
    {
      id: 'imperial.arcade_stair',
      category: 'Vertical',
      displayName: 'Arcade Stair',
      blurb: 'An outer arcade bay with stairs up to its upper walkway (climbing east)',
      cells: [
        [0, 0, 0],
        [0, 0, 1],
      ],
      floors: [0],
      ports: [...ALL, ...ALL.map((p) => ({ ...p, level: 1 }))],
      open: true,
      edgeDefault: 'open',
      extraFloors: [paint(b(-4, 3.5, -4, 4, 4.0, -0.4), TRAV)],
      solids: [...arcadeStorey(0, false), ...arcadeStorey(4, true), paint(b(-4, 8.0, 2.6, 4, 8.6, 4.0), LIME), ...flight('x', 1, -4, -0.4, 2.5, 16).map((s) => paint(s, TRAV))],
    },
    {
      id: 'imperial.colonnade',
      category: 'Open',
      displayName: 'Colonnade',
      blurb: 'A covered portico along the north side of open ground: a row of marble columns, a roof and a back wall (forums, temple precincts)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        paint(b(-4, 0, 1.6, 4, 0.25, 4), TRAV),
        ...[-2.7, 0, 2.7].flatMap((x) => column(x, 2.3, 0.25, 4.6, 0.32, MARBLE)),
        paint(b(-4, 4.85, 1.8, 4, 5.4, 2.8), TRAV),
        paint(b(-4, 5.4, 1.6, 4, 5.7, 4), 'pbr_roof'),
        b(-4, 0, 3.6, 4, 5.4, 4, 'wall'),
      ],
    },
    {
      id: 'imperial.triumphal_arch',
      category: 'Open',
      displayName: 'Triumphal Arch',
      blurb: 'A monumental arch to walk through (north to south): two piers with columns, a round arch and an inscribed attic',
      cells: [
        [0, 0, 0],
        [0, 0, 1],
      ],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        paint(b(-3.8, 0, -1.4, -1.7, 6.2, 1.4), MARBLE),
        paint(b(1.7, 0, -1.4, 3.8, 6.2, 1.4), MARBLE),
        ...arch('x', 0, 1.7, 3.0, 6.2, -1.4, 1.4, MARBLE),
        paint(b(-4, 6.2, -1.6, 4, 6.6, 1.6), TRAV),
        paint(b(-3.8, 6.6, -1.4, 3.8, 8.2, 1.4), MARBLE),
        trim(-2.6, 6.9, -1.45, 2.6, 7.9, -1.4, 'gold_leaf', '#d8b860'),
        trim(-2.6, 6.9, 1.4, 2.6, 7.9, 1.45, 'gold_leaf', '#d8b860'),
        ...[-3.3, -2.2, 2.2, 3.3].flatMap((x) => [...column(x, -1.7, 0, 6.2, 0.26, MARBLE), ...column(x, 1.7, 0, 6.2, 0.26, MARBLE)]),
      ],
    },
    {
      id: 'imperial.aqueduct',
      category: 'Open',
      displayName: 'Aqueduct',
      blurb: 'Two tiers of arches running north to south with a water channel along the top, 9.6 m up; walk under the arches',
      cells: footprint(1, 1, 3),
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        paint(b(-1.2, 0, -4, 1.2, 6.6, -3.3), LIME),
        paint(b(-1.2, 0, 3.3, 1.2, 6.6, 4), LIME),
        ...arch('z', 0, 3.3, 3.0, 6.6, -1.2, 1.2, LIME, 12),
        paint(b(-1.3, 6.6, -4, 1.3, 6.9, 4), TRAV),
        paint(b(-1.1, 6.9, -4, 1.1, 9.3, -3.65), LIME),
        paint(b(-1.1, 6.9, -0.35, 1.1, 9.3, 0.35), LIME),
        paint(b(-1.1, 6.9, 3.65, 1.1, 9.3, 4), LIME),
        ...arch('z', -2.0, 1.65, 7.6, 9.3, -1.1, 1.1, LIME, 8),
        ...arch('z', 2.0, 1.65, 7.6, 9.3, -1.1, 1.1, LIME, 8),
        paint(b(-1.2, 9.3, -4, 1.2, 9.6, 4), TRAV),
        paint(b(-1.2, 9.6, -4, -0.85, 10.4, 4), LIME),
        paint(b(0.85, 9.6, -4, 1.2, 10.4, 4), LIME),
      ],
    },
    {
      id: 'imperial.forum',
      category: 'Large',
      displayName: 'Forum',
      blurb: '2 × 2 cells of paved square with a rostrum (steps up to a speakers’ platform) and four statue plinths',
      cells: footprint(2, 2),
      floors: [0],
      ports: perimeter(2, 2),
      open: true,
      edgeDefault: 'open',
      solids: [
        trim(-4, 0, -4, 12, 0.03, 12, LIME),
        trim(1.5, 0.03, 1.5, 6.5, 0.05, 6.5, 'mosaic'),
        // The rostrum, its steps facing south.
        paint(b(2, 0, 4.2, 6, 1.5, 6.6), MARBLE),
        ...flight('z', 1, 1.8, 2.6, 5.4, 6, 0, 0.4).map((s) => paint(s, TRAV)),
        paint(b(2, 1.5, 6.3, 6, 2.4, 6.6), MARBLE),
        ...[[-2, -2], [10, -2], [-2, 10], [10, 10]].map(([x, z]) => paint(b(x! - 0.8, 0, z! - 0.8, x! + 0.8, 1.3, z! + 0.8), MARBLE)),
      ],
    },
    {
      id: 'imperial.temple',
      category: 'Buildings',
      displayName: 'Temple',
      blurb: '1 × 2 cells: a temple on a 2 m podium, steps up the south front to a portico of columns, the cella behind its doorway',
      cells: footprint(1, 2, 3),
      floors: [0],
      ports: perimeter(1, 2),
      open: true,
      edgeDefault: 'open',
      solids: [
        ...flight('z', 1, -4, -3.8, 3.8, 8, 0, 0.5).map((s) => paint(s, TRAV)),
        paint(b(-3.8, 0, 0, 3.8, 2.0, 11.8), TRAV),
        ...[-3, -1.45, 1.45, 3].flatMap((x) => column(x, 0.8, 2.0, 5.6, 0.34, MARBLE)),
        ...[-3, 3].flatMap((x) => column(x, 2.8, 2.0, 5.6, 0.34, MARBLE)),
        // The cella: marble walls with a 3 m door on the south.
        paint(b(-3.6, 2.0, 3.6, -1.5, 7.6, 4.0), MARBLE),
        paint(b(1.5, 2.0, 3.6, 3.6, 7.6, 4.0), MARBLE),
        paint(b(-1.5, 5.2, 3.6, 1.5, 7.6, 4.0), MARBLE),
        paint(b(-3.6, 2.0, 4.0, -3.2, 7.6, 11.6), MARBLE),
        paint(b(3.2, 2.0, 4.0, 3.6, 7.6, 11.6), MARBLE),
        paint(b(-3.6, 2.0, 11.2, 3.6, 7.6, 11.6), MARBLE),
        paint(b(-1.2, 2.0, 9.0, 1.2, 3.2, 10.8), MARBLE),
        // Entablature, the stepped roof and its pediment.
        paint(b(-3.9, 7.6, 0.3, 3.9, 8.2, 11.8), TRAV),
        ...[0, 1, 2, 3].map((i) => paint(b(-3.9 + i * 0.95, 8.2 + i * 0.5, 0.3, 3.9 - i * 0.95, 8.7 + i * 0.5, 11.9), 'pbr_roof')),
        trim(-3.0, 8.25, 0.25, 3.0, 9.4, 0.3, MARBLE),
        trim(-1.5, 8.4, 0.22, 1.5, 9.1, 0.25, 'gold_leaf'),
      ],
    },
    {
      id: 'imperial.tunnel',
      category: 'Corridors',
      displayName: 'Hypogeum Tunnel',
      blurb: 'A rubble-walled passage north to south under the arena: timber ribs, torch brackets, a drain down the middle',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: [
        { side: 'N', level: 0 },
        { side: 'S', level: 0 },
      ],
      solids: [
        paint(b(-3.75, 0, -4, -1.8, 3.5, 4), RUBBLE),
        paint(b(1.8, 0, -4, 3.75, 3.5, 4), RUBBLE),
        ...[-3, -1, 1, 3].map((z) => wood(b(-1.8, 3.1, z - 0.15, 1.8, 3.5, z + 0.15))),
        ...[-3, 1].flatMap((z) => [wood(b(-1.8, 0, z - 0.15, -1.6, 3.1, z + 0.15)), wood(b(1.6, 0, z - 0.15, 1.8, 3.1, z + 0.15))]),
        trim(-0.25, 0, -4, 0.25, 0.02, 4, 'pbr_concrete_dark'),
        trim(-1.8, 2.2, -1.1, -1.7, 2.5, -0.9, 'pbr_steel'),
        trim(1.7, 2.2, 2.9, 1.8, 2.5, 3.1, 'pbr_steel'),
      ],
    },
    {
      id: 'imperial.hypogeum',
      category: 'Rooms',
      displayName: 'Hypogeum Pens',
      blurb: 'A crossing under the arena with a barred beast pen in each corner (see and shoot through the bars)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      solids: [
        ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].flatMap(([sx, sz]) => {
          const x0 = sx! > 0 ? 1.4 : -3.75;
          const x1 = sx! > 0 ? 3.75 : -1.4;
          const z0 = sz! > 0 ? 1.4 : -3.75;
          const z1 = sz! > 0 ? 3.75 : -1.4;
          const fx = sx! > 0 ? x0 : x1;
          const fz = sz! > 0 ? z0 : z1;
          return [
            iron(b(Math.min(fx, fx + sx! * 0.1), 0, z0, Math.max(fx, fx + sx! * 0.1), 3.5, z1)),
            iron(b(x0, 0, Math.min(fz, fz + sz! * 0.1), x1, 3.5, Math.max(fz, fz + sz! * 0.1))),
            trim(x0, 0, z0, x1, 0.05, z1, 'pbr_dusty_road'),
          ];
        }),
        ...[[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].map(([x, z]) => wood(b(x! - 0.2, 0, z! - 0.2, x! + 0.2, 3.5, z! + 0.2))),
      ],
    },
    {
      id: 'imperial.hypogeum_lift',
      category: 'Rooms',
      displayName: 'Hypogeum Lift Shaft',
      blurb: 'A room under an Arena Hatch: timber beams over a 3 m shaft and a capstan in the corner; put a Lift Cage in the middle to rise into the arena',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      solids: [
        // Posts against the walls carrying beams over the shaft (clear of the walk round the cage).
        ...[[-3.35, -1.8], [3.35, -1.8], [-3.35, 1.8], [3.35, 1.8]].map(([x, z]) => wood(b(x! - 0.15, 0, z! - 0.15, x! + 0.15, 3.5, z! + 0.15))),
        trim(-3.5, 3.2, -1.95, 3.5, 3.45, -1.65, 'pbr_weathered_planks'),
        trim(-3.5, 3.2, 1.65, 3.5, 3.45, 1.95, 'pbr_weathered_planks'),
        // The capstan the beast-handlers turn.
        wood(b(-3.45, 0, -3.45, -2.85, 1.1, -2.85)),
        trim(-3.5, 0.9, -3.2, -2.4, 1.0, -3.1, 'pbr_weathered_planks'),
        trim(-3.2, 0.9, -3.5, -3.1, 1.0, -2.4, 'pbr_weathered_planks'),
      ],
    },
    {
      id: 'imperial.arena_hatch',
      category: 'Open',
      displayName: 'Arena Hatch',
      blurb: 'Arena floor with a 3.2 m hole in the middle over a Hypogeum Lift Shaft: the Lift Cage rises through it',
      cells: [[0, 0, 0]],
      floors: [],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      extraFloors: [b(-4, -0.5, -4, 4, 0, -1.6), b(-4, -0.5, 1.6, 4, 0, 4), b(-4, -0.5, -1.6, -1.6, 0, 1.6), b(1.6, -0.5, -1.6, 4, 0, 1.6)],
      solids: [trim(-1.75, 0, -1.75, 1.75, 0.04, -1.6, 'pbr_weathered_planks'), trim(-1.75, 0, 1.6, 1.75, 0.04, 1.75, 'pbr_weathered_planks'), trim(-1.75, 0, -1.6, -1.6, 0.04, 1.6, 'pbr_weathered_planks'), trim(1.6, 0, -1.6, 1.75, 0.04, 1.6, 'pbr_weathered_planks')],
    },
  ];
}

// ---------------------------------------------------------------- 09 Sands of Egypt

function egyptTiles(): TileDefinition[] {
  const SAND = 'pbr_sandstone_blocks';
  const ROUGH = 'pbr_rough_sandstone';
  const GLYPH = 'hieroglyphs';
  const PAINTED = 'hieroglyphs_painted';
  /** A painted panel on a face: along x at z (facing ±z) or along z at x. */
  const panel = (axis: 'x' | 'z', at: number, u0: number, u1: number, y0: number, y1: number, facing: 1 | -1, material = PAINTED): Box => {
    const t0 = facing > 0 ? at : at - 0.02;
    const t1 = facing > 0 ? at + 0.02 : at;
    return axis === 'x' ? trim(u0, y0, t0, u1, y1, t1, material) : trim(t0, y0, u0, t1, y1, u1, material);
  };
  /** A cavetto cornice: a gilded roll and an overhang along the top of a face. */
  const cornice = (x0: number, z0: number, x1: number, z1: number, y: number): Box[] => [trim(x0, y - 0.25, z0, x1, y, z1, 'gold_leaf', '#c8a050'), paint(b(x0 - 0.25, y, z0 - 0.25, x1 + 0.25, y + 0.5, z1 + 0.25), SAND)];
  const papyrusColumn = (x: number, z: number, h: number, r: number): Box[] => [
    ...column(x, z, 0, h - 0.9, r, PAINTED, SAND),
    ...[0, Math.PI / 4].map((yaw) => ({ ...paint(b(x - r * 1.35, h - 0.9, z - r * 1.35, x + r * 1.35, h - 0.3, z + r * 1.35), 'pbr_rough_sandstone', '#80c0b0'), ...(yaw ? { yaw } : {}) })),
    paint(b(x - r * 1.1, h - 0.3, z - r * 1.1, x + r * 1.1, h, z + r * 1.1), SAND),
  ];
  return [
    {
      id: 'egypt.pylon',
      category: 'Large',
      displayName: 'Temple Pylon',
      blurb: '3 × 1 cells: two massive towers either side of a 3.2 m gate (north to south), painted reliefs on the front; stairs at the back of each tower up to a terrace 4 m up behind the battlements',
      cells: footprint(3, 1, 3),
      floors: [0],
      ports: perimeter(3, 1),
      open: true,
      edgeDefault: 'open',
      solids: [
        // The towers: 4 m of masonry, then the front 2.5 m rising on to 8 m (battered), a terrace behind it.
        paint(b(-4, 0, -3.9, 6.4, 4, 1.6), SAND),
        paint(b(9.6, 0, -3.9, 20, 4, 1.6), SAND),
        paint(b(-4, 4, -3.9, 6.4, 6, -1.5), SAND),
        paint(b(9.6, 4, -3.9, 20, 6, -1.5), SAND),
        paint(b(-3.7, 6, -3.7, 6.4, 8, -1.5), SAND),
        paint(b(9.6, 6, -3.7, 19.7, 8, -1.5), SAND),
        // Over the gate: the lintel up to the tops of the towers, and a bridge joining the terraces.
        paint(b(6.4, 3.6, -3.9, 9.6, 8, -1.5), SAND),
        paint(b(6.4, 3.6, -1.5, 9.6, 4.0, 1.6), ROUGH),
        trim(6.4, 3.4, -3.95, 9.6, 3.6, -1.45, 'gold_leaf'),
        ...cornice(-3.7, -3.7, 19.7, -3.5, 8.0),
        // Painted reliefs on the front (south) of each tower and a glyph band over the gate.
        panel('x', -3.9, -3.2, 5.8, 0.8, 3.6, -1),
        panel('x', -3.9, 10.2, 19.2, 0.8, 3.6, -1),
        panel('x', -3.7, -3.0, 5.8, 4.6, 7.4, -1, GLYPH),
        panel('x', -3.7, 10.2, 19.0, 4.6, 7.4, -1, GLYPH),
        panel('x', -3.9, 6.6, 9.4, 4.4, 7.6, -1),
        // Flagpole niches.
        ...[0, 3, 13, 16].map((x) => trim(x - 0.25, 0, -3.98, x + 0.25, 6, -3.9, 'pbr_rough_sandstone', '#a08060')),
        // Stairs up the back of each tower toward the gate, and a landing beside it onto the terrace.
        ...flight('x', 1, -4, 1.6, 4.0, 16).map((s) => paint(s, ROUGH)),
        paint(b(4, 0, 1.6, 6.4, 4.0, 4.0), ROUGH),
        ...flight('x', -1, 20, 1.6, 4.0, 16).map((s) => paint(s, ROUGH)),
        paint(b(9.6, 0, 1.6, 12, 4.0, 4.0), ROUGH),
      ],
    },
    {
      id: 'egypt.hypostyle',
      category: 'Large',
      displayName: 'Hypostyle Hall',
      blurb: 'Two storeys of forest of columns: four painted papyrus columns under an 8 m stone roof; join them into a hall',
      cells: footprint(1, 1, 2),
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        ...[[-2, -2], [2, -2], [-2, 2], [2, 2]].flatMap(([x, z]) => papyrusColumn(x!, z!, 7.4, 0.62)),
        paint(b(-4, 7.4, -2.5, 4, 8.0, -1.5), SAND),
        paint(b(-4, 7.4, 1.5, 4, 8.0, 2.5), SAND),
        paint(b(-4, 8.0, -4, 4, 8.4, 4), ROUGH),
        trim(-4, 7.98, -4, 4, 8.0, 4, 'lapis'),
        ...[-3, -1, 1, 3].flatMap((x) => [-3, -1, 1, 3].map((z) => trim(x - 0.08, 7.96, z - 0.08, x + 0.08, 7.98, z + 0.08, 'gold_leaf'))),
      ],
    },
    {
      id: 'egypt.sanctuary',
      category: 'Rooms',
      displayName: 'Sanctuary',
      blurb: 'The holy of holies: painted walls, a naos shrine on a stepped dais at the back (north), offering tables',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: [{ side: 'S', level: 0 }],
      solids: [
        panel('z', -3.5, -3.5, 3.5, 0.3, 3.4, 1),
        panel('z', 3.5, -3.5, 3.5, 0.3, 3.4, -1),
        panel('x', 3.5, -3.5, 3.5, 0.3, 3.4, -1),
        ...flight('z', 1, 0.5, -2.2, 2.2, 3, 0, 0.5).map((s) => paint(s, SAND)),
        paint(b(-2.2, 0, 2.0, 2.2, 0.75, 3.75), SAND),
        paint(b(-1.2, 0.75, 2.2, 1.2, 3.2, 3.5), 'pbr_rough_sandstone', '#c0a070'),
        trim(-0.6, 0.85, 2.18, 0.6, 2.6, 2.2, 'lapis'),
        ...cornice(-1.2, 2.2, 1.2, 3.5, 3.2),
        ...[-2.8, 2.8].map((x) => paint(b(x - 0.4, 0, -1.0, x + 0.4, 0.9, 0.0), SAND)),
      ],
    },
    {
      id: 'egypt.pyramid',
      category: 'Large',
      displayName: 'Step Pyramid',
      blurb: '4 × 4 cells: five 2 m tiers up to a platform 10 m up with a gilded capstone; a stair cut into the north face',
      cells: footprint(4, 4, 3),
      floors: [0],
      ports: perimeter(4, 4),
      open: true,
      edgeDefault: 'open',
      // The platform on top (either side of the stair's cut, and beyond its head), as floor.
      extraFloors: [b(5.6, 9.8, 5.6, 10.4, 10, 18.4), b(13.6, 9.8, 5.6, 18.4, 10, 18.4), b(10.4, 9.8, 5.6, 13.6, 10, 8)],
      solids: (() => {
        const out: Box[] = [];
        const IN = 2.4;
        const [s0, s1] = [10.4, 13.6];
        for (let k = 0; k < 5; k++) {
          const lo = -4 + IN * k;
          const hi = 28 - IN * k;
          const y0 = 2 * k;
          const y1 = 2 * k + 2;
          const mat = k % 2 ? SAND : ROUGH;
          // Either side of the stair, full depth; in the stair's span, only the south part (the stair and platform fill the rest).
          out.push(paint(b(lo, y0, lo, s0, y1, hi), mat), paint(b(s1, y0, lo, hi, y1, hi), mat));
          if (lo < 5.6) out.push(paint(b(s0, y0, lo, s1, y1, 5.6), mat));
          out.push(trim(lo - 0.02, y1 - 0.3, lo - 0.02, hi + 0.02, y1 - 0.25, hi + 0.02, 'gold_leaf', '#b89048'));
        }
        // The platform under the stair's head, then the stair: 40 steps of 0.25 m up from the north edge, cut into the face.
        out.push(paint(b(s0, 0, 5.6, s1, 10, 8), SAND));
        for (let i = 0; i < 40; i++) out.push(paint(b(s0, 0, 28 - 0.5 * (i + 1), s1, 0.25 * (i + 1), 28 - 0.5 * i), i % 2 ? ROUGH : SAND));
        // Gilded capstone (stepped) on the platform, east of the stair's head.
        out.push(paint(b(15.2, 10, 10.5, 18.2, 10.8, 13.5), 'gold_leaf'), paint(b(15.9, 10.8, 11.2, 17.5, 11.6, 12.8), 'gold_leaf'), paint(b(16.4, 11.6, 11.7, 17.0, 12.2, 12.3), 'gold_leaf'));
        return out;
      })(),
    },
    {
      id: 'egypt.tomb_entrance',
      category: 'Vertical',
      displayName: 'Tomb Entrance',
      blurb: 'Place on the level below the ground: a mastaba with a doorway (south, at ground level) over stairs down to the tomb level, which leads on north',
      cells: [
        [0, 0, 0],
        [0, 0, 1],
      ],
      floors: [0],
      ports: [
        { side: 'N', level: 0 },
        { side: 'S', level: 1 },
      ],
      solids: [
        ...Array.from({ length: 16 }, (_, i) => paint(b(-3.75, 0, -4 + i * 0.5, 3.75, 4 - i * 0.25, -3.5 + i * 0.5), i % 2 ? SAND : ROUGH)),
        panel('z', -3.5, -2, 4, 0.3, 3.2, 1),
        panel('z', 3.5, -2, 4, 0.3, 3.2, -1),
        paint(b(-4, 8.0, -4, 4, 8.5, 4), SAND),
        ...cornice(-3.75, -3.75, 3.75, -3.6, 8.5),
      ],
    },
    {
      id: 'egypt.tomb_corridor',
      category: 'Corridors',
      displayName: 'Tomb Corridor',
      blurb: 'A 3.2 m passage north to south cut through the rock, painted walls, a starry lapis ceiling: lay traps along it',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: [
        { side: 'N', level: 0 },
        { side: 'S', level: 0 },
      ],
      solids: [
        paint(b(-3.75, 0, -4, -1.6, 3.5, 4), ROUGH),
        paint(b(1.6, 0, -4, 3.75, 3.5, 4), ROUGH),
        panel('z', -1.6, -4, 4, 0.2, 3.1, 1),
        panel('z', 1.6, -4, 4, 0.2, 3.1, -1),
        trim(-1.6, 3.1, -4, -1.4, 3.5, 4, SAND),
        trim(1.4, 3.1, -4, 1.6, 3.5, 4, SAND),
        trim(-1.6, 3.45, -4, 1.6, 3.5, 4, 'lapis'),
        ...[-3, -1, 1, 3].map((z) => trim(-0.06, 3.43, z - 0.06, 0.06, 3.45, z + 0.06, 'gold_leaf')),
      ],
    },
    {
      id: 'egypt.tomb_chamber',
      category: 'Rooms',
      displayName: 'Burial Chamber',
      blurb: 'A chamber with a raised dais against the north wall for the sarcophagus, painted pilasters and walls, a starry ceiling',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      solids: [
        // Painted pilasters engaged in the walls, and the two-step dais at the back.
        ...[-1.8, 1.8].flatMap((u) => [paint(b(-3.5, 0, u - 0.3, -3.2, 3.5, u + 0.3), PAINTED), paint(b(3.2, 0, u - 0.3, 3.5, 3.5, u + 0.3), PAINTED)]),
        ...[-2.6, 2.6].map((u) => paint(b(u - 0.3, 0, 3.2, u + 0.3, 3.5, 3.5), PAINTED)),
        paint(b(-1.6, 0, 0, 1.6, 0.25, 3.5), SAND),
        paint(b(-1.25, 0.25, 0.5, 1.25, 0.5, 3.5), SAND),
        panel('x', -3.5, -3.5, 3.5, 0.3, 3.3, 1),
        panel('x', 3.5, -3.5, 3.5, 0.3, 3.3, -1),
        panel('z', -3.5, -3.5, 3.5, 0.3, 3.3, 1),
        panel('z', 3.5, -3.5, 3.5, 0.3, 3.3, -1),
        trim(-3.5, 3.45, -3.5, 3.5, 3.5, 3.5, 'lapis'),
        ...[-3, -1.5, 0, 1.5, 3].flatMap((x) => [-3, -1.5, 0, 1.5, 3].map((z) => trim(x - 0.06, 3.43, z - 0.06, x + 0.06, 3.45, z + 0.06, 'gold_leaf'))),
      ],
    },
    {
      id: 'egypt.quay',
      category: 'Open',
      displayName: 'Nile Quay',
      blurb: 'A stone embankment: ground to the south, ten steps down to the river bed 2.5 m below on the north (flood it with a Water body)',
      cells: [[0, 0, 0]],
      floors: [],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      extraFloors: [b(-4, -3.0, -4, 4, -2.5, 4)],
      solids: [
        paint(b(-4, -2.5, -4, 4, 0, 0), SAND),
        ...Array.from({ length: 9 }, (_, i) => paint(b(-4, -2.5, 0.4 * i, 4, -0.25 * (i + 1), 0.4 * (i + 1)), i % 2 ? ROUGH : SAND)),
        trim(-4, -0.05, -0.3, 4, 0.02, 0, 'gold_leaf', '#a08050'),
        ...[-2, 2].map((x) => paint(b(x - 0.2, 0, -0.6, x + 0.2, 0.9, -0.2), ROUGH)),
      ],
    },
    {
      id: 'egypt.river',
      category: 'Open',
      displayName: 'River Bed',
      blurb: 'The bed of the Nile, 2.5 m below the ground: lay a row beside Nile Quays and fill it with a Water body; boats float on movers',
      cells: [[0, 0, 0]],
      floors: [],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      extraFloors: [b(-4, -3.0, -4, 4, -2.5, 4)],
      solids: [trim(-2.5, -2.5, -1.0, -0.5, -2.45, 2.0, 'pbr_dusty_road', '#6a7040')],
    },
    {
      id: 'egypt.avenue',
      category: 'Open',
      displayName: 'Sphinx Avenue',
      blurb: 'A paved processional way north to south between two plinths: stand sphinxes on them and line them up',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [trim(-2.4, 0, -4, 2.4, 0.04, 4, SAND), ...[-3.3, 3.3].map((x) => paint(b(x - 0.65, 0, -3.3, x + 0.65, 0.6, 3.3), ROUGH))],
    },
    {
      id: 'egypt.house',
      category: 'Buildings',
      displayName: 'Mud-Brick House',
      blurb: 'A village house by the river: a doorway south, small windows, a stair up the east side to the roof terrace',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        // Mud-brick walls 2.75 m high: a doorway south, windows north and west.
        ...[
          b(-3.6, 0, -3.6, -2.1, 2.75, -3.3),
          b(-0.3, 0, -3.6, 1.6, 2.75, -3.3),
          b(-2.1, 2.4, -3.6, -0.3, 2.75, -3.3),
          b(-3.6, 0, 3.3, -1.5, 2.75, 3.6),
          b(-0.7, 0, 3.3, 1.6, 2.75, 3.6),
          b(-1.5, 0, 3.3, -0.7, 1.2, 3.6),
          b(-1.5, 2.0, 3.3, -0.7, 2.75, 3.6),
          b(-3.6, 0, -3.3, -3.3, 2.75, -0.6),
          b(-3.6, 0, 0.6, -3.3, 2.75, 3.3),
          b(-3.6, 0, -0.6, -3.3, 1.2, 0.6),
          b(-3.6, 2.0, -0.6, -3.3, 2.75, 0.6),
          b(1.3, 0, -3.3, 1.6, 2.75, 3.3),
        ].map((w) => paint(w, 'pbr_adobe')),
        // The roof terrace (3 m up) with a parapet, open on the east where the stair comes up.
        paint(b(-3.6, 2.75, -3.6, 1.6, 3.0, 3.6), 'pbr_weathered_planks', '#b09070'),
        paint(b(-3.6, 3.0, -3.6, 1.6, 3.5, -3.35), 'pbr_adobe'),
        paint(b(-3.6, 3.0, -3.35, -3.35, 3.5, 3.6), 'pbr_adobe'),
        paint(b(-3.35, 3.0, 3.35, 0.4, 3.5, 3.6), 'pbr_adobe'),
        // The stair up the east side and its landing level with the terrace.
        ...flight('z', 1, -3.6, 1.6, 3.95, 12, 0, 0.5).map((s) => paint(s, 'pbr_adobe', '#d0b090')),
        paint(b(1.6, 0, 2.4, 3.95, 3.0, 3.95), 'pbr_adobe', '#d0b090'),
        ...[[-2.6, 2.6], [0.6, 2.6]].map(([x, z]) => paint(b(x! - 0.3, 0, z! - 0.3, x! + 0.3, 0.8, z! + 0.3), 'pbr_rough_sandstone', '#c08060')),
      ],
    },
  ];
}

/** The 03 Imperial Arena and 09 Sands of Egypt tiles, in palette order. */
export function ancientPackTiles(): TileDefinition[] {
  return [...imperialTiles(), ...egyptTiles()];
}
