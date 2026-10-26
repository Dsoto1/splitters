/**
 * Style Pack tiles (Sprint 7, Set 1): the box-built pieces of 05 Gothic
 * Estate, 06 Jungle Ruins and 08 Suburban Chaos. Like the 01 and 02 pieces in
 * packTiles.ts, walls take the theme's wall paint and furniture its solid
 * paint; the parts that should look the part in any theme (stone, hedges,
 * rock, slate, pool tiles, asphalt) carry a library material of their own
 * (`LocalBox.surface`). Pitched roofs are tilted boxes (`LocalBox.pitch`/`roll`).
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
/** A box `size` centred on (cx, cy, cz), turned and tilted (radians). */
const tilted = (cx: number, cy: number, cz: number, size: readonly [number, number, number], o: { yaw?: number; pitch?: number; roll?: number; kind?: LocalBox['kind'] } = {}): Box => ({
  min: [cx - size[0] / 2, cy - size[1] / 2, cz - size[2] / 2],
  max: [cx + size[0] / 2, cy + size[1] / 2, cz + size[2] / 2],
  ...(o.yaw ? { yaw: o.yaw } : {}),
  ...(o.pitch ? { pitch: o.pitch } : {}),
  ...(o.roll ? { roll: o.roll } : {}),
  ...(o.kind ? { kind: o.kind } : {}),
});
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

/**
 * A straight flight of steps (0.25 m each) climbing along +x/+z (dir 1) or -x/-z (dir -1) from `from`,
 * between a0 and a1 across, from `base`. Each step is a block down to `floor` (default: the ground).
 */
function flight(axis: 'x' | 'z', dir: 1 | -1, from: number, a0: number, a1: number, n: number, base = 0, run = 0.5, floor = 0): Box[] {
  return Array.from({ length: n }, (_, i) => {
    const u0 = from + dir * i * run;
    const u1 = from + dir * (i + 1) * run;
    const top = base + (i + 1) * 0.25;
    const [lo, hi] = [Math.min(u0, u1), Math.max(u0, u1)];
    return axis === 'x' ? b(lo, floor, a0, hi, top, a1) : b(a0, floor, lo, a1, top, hi);
  });
}

/** A thin 1 m rail along an axis-aligned line at height y. */
function rail(x0: number, z0: number, x1: number, z1: number, y = 0, material = 'pbr_walnut', tint?: string): Box {
  const t = 0.06;
  const r = x0 === x1 ? b(x0 - t, y, Math.min(z0, z1), x0 + t, y + 1, Math.max(z0, z1)) : b(Math.min(x0, x1), y, z0 - t, Math.max(x0, x1), y + 1, z0 + t);
  return paint(r, material, tint);
}

/** An opening in a wall run: [from, to] along the wall, [bottom, top] in height. */
type Opening = readonly [number, number, number, number];
const door = (c: number, w = 3, h = 3): Opening => [c - w / 2, c + w / 2, 0, h];
const win = (c: number, w = 1.5, y0 = 1.0, y1 = 2.3): Opening => [c - w / 2, c + w / 2, y0, y1];

/**
 * A wall (theme wall paint, or `material`) along x at z = `at` or along z at x = `at`, from a0 to a1
 * and y0 to y1, `t` thick, with openings cut out. Opening heights are above y0.
 */
function wall(axis: 'x' | 'z', at: number, a0: number, a1: number, openings: readonly Opening[] = [], y0 = 0, y1 = 4, t = 0.3, material?: string, tint?: string): Box[] {
  const out: Box[] = [];
  const piece = (u0: number, u1: number, v0: number, v1: number) => {
    if (u1 - u0 < 0.01 || v1 - v0 < 0.01) return;
    const box = axis === 'x' ? b(u0, v0, at - t / 2, u1, v1, at + t / 2, 'wall') : b(at - t / 2, v0, u0, at + t / 2, v1, u1, 'wall');
    out.push(material ? paint(box, material, tint) : box);
  };
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
function shell(x0: number, z0: number, x1: number, z1: number, open: Partial<Record<Side, readonly Opening[]>>, y0 = 0, y1 = 4, t = 0.3, material?: string, tint?: string): Box[] {
  return [
    ...wall('x', z0 + t / 2, x0, x1, open.S, y0, y1, t, material, tint),
    ...wall('x', z1 - t / 2, x0, x1, open.N, y0, y1, t, material, tint),
    ...wall('z', x0 + t / 2, z0 + t, z1 - t, open.W, y0, y1, t, material, tint),
    ...wall('z', x1 - t / 2, z0 + t, z1 - t, open.E, y0, y1, t, material, tint),
  ];
}

/** A ring of short turned boxes (centre cx, cz; radius r; angles a0..a1 from +x toward +z). */
function arc(cx: number, cz: number, r: number, a0: number, a1: number, n: number, y0: number, y1: number, t: number, kind: LocalBox['kind'] = 'solid'): Box[] {
  const out: Box[] = [];
  const step = (a1 - a0) / n;
  const len = 2 * r * Math.sin(Math.abs(step) / 2) + Math.min(0.08, t * 0.3);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i + 0.5) * step;
    out.push({ min: [cx + r * Math.cos(a) - len / 2, y0, cz + r * Math.sin(a) - t / 2], max: [cx + r * Math.cos(a) + len / 2, y1, cz + r * Math.sin(a) + t / 2], yaw: -(a + Math.PI / 2), kind });
  }
  return out;
}

/**
 * A gable roof over x0..x1, z0..z1 (ridge along x, or along z with `ridge: 'z'`): two tilted slabs from
 * the eaves at `y` up to the ridge, `pitch` radians, overhanging by `over`; gable ends filled in stepped
 * wall courses. Returns the solid slabs and the gables.
 */
function gable(x0: number, z0: number, x1: number, z1: number, y: number, pitch: number, material: string, o: { ridge?: 'x' | 'z'; over?: number; tint?: string; gableMaterial?: string } = {}): Box[] {
  const over = o.over ?? 0.4;
  const alongX = (o.ridge ?? 'x') === 'x';
  const span = alongX ? z1 - z0 : x1 - x0;
  const half = span / 2 + over;
  const rise = Math.tan(pitch) * (span / 2);
  const slope = half / Math.cos(pitch);
  const midY = y + (Math.tan(pitch) * (span / 2 - over)) / 2 + 0.1;
  const out: Box[] = [];
  const len = (alongX ? x1 - x0 : z1 - z0) + over * 2;
  if (alongX) {
    const cx = (x0 + x1) / 2;
    out.push(paint(tilted(cx, midY, z0 - over + half / 2, [len, 0.22, slope], { pitch }), material, o.tint));
    out.push(paint(tilted(cx, midY, z1 + over - half / 2, [len, 0.22, slope], { pitch: -pitch }), material, o.tint));
  } else {
    const cz = (z0 + z1) / 2;
    out.push(paint(tilted(x0 - over + half / 2, midY, cz, [slope, 0.22, len], { roll: pitch }), material, o.tint));
    out.push(paint(tilted(x1 + over - half / 2, midY, cz, [slope, 0.22, len], { roll: -pitch }), material, o.tint));
  }
  // Gable ends: courses stepping in toward the ridge.
  const courses = Math.max(1, Math.round(rise / 0.4));
  for (let i = 0; i < courses; i++) {
    const h0 = y + (i * rise) / courses;
    const h1 = y + ((i + 1) * rise) / courses;
    const inset = ((i + 0.5) / courses) * (span / 2);
    if (alongX) {
      for (const x of [x0, x1 - 0.3]) out.push(o.gableMaterial ? paint(b(x, h0, z0 + inset, x + 0.3, h1, z1 - inset, 'wall'), o.gableMaterial) : b(x, h0, z0 + inset, x + 0.3, h1, z1 - inset, 'wall'));
    } else {
      for (const z of [z0, z1 - 0.3]) out.push(o.gableMaterial ? paint(b(x0 + inset, h0, z, x1 - inset, h1, z + 0.3, 'wall'), o.gableMaterial) : b(x0 + inset, h0, z, x1 - inset, h1, z + 0.3, 'wall'));
    }
  }
  return out;
}

// ---------------------------------------------------------------- 05 Gothic Estate

function gothicTiles(): TileDefinition[] {
  const walnut = (box: Box, tint?: string) => paint(box, 'pbr_walnut', tint);
  const stone = (box: Box, tint = '#a0a0a8') => paint(box, 'pbr_castle_stone', tint);
  const flag = (box: Box, tint?: string) => paint(box, 'pbr_flagstone', tint);
  const hedge = (box: Box) => paint(box, 'pbr_moss', '#5a7a48');
  const iron = (box: Box) => paint(box, 'pbr_steel', '#3a3c40');
  /** A bookcase against a wall: a walnut carcass with rows of book spines on its open face (facing +z, -z, +x or -x). */
  const bookcase = (x0: number, z0: number, x1: number, z1: number, y0: number, h: number, face: 'N' | 'S' | 'E' | 'W'): Box[] => {
    const out: Box[] = [walnut(b(x0, y0, z0, x1, y0 + h, z1))];
    const colours = ['#7a2020', '#24502e', '#22305a', '#9a7a4a'];
    for (let r = 0, y = y0 + 0.3; y < y0 + h - 0.4; y += 0.5, r++) {
      const tint = colours[r % colours.length]!;
      if (face === 'N') out.push(trim(x0 + 0.08, y, z1, x1 - 0.08, y + 0.34, z1 + 0.02, 'carpet', tint));
      else if (face === 'S') out.push(trim(x0 + 0.08, y, z0 - 0.02, x1 - 0.08, y + 0.34, z0, 'carpet', tint));
      else if (face === 'E') out.push(trim(x1, y, z0 + 0.08, x1 + 0.02, y + 0.34, z1 - 0.08, 'carpet', tint));
      else out.push(trim(x0 - 0.02, y, z0 + 0.08, x0, y + 0.34, z1 - 0.08, 'carpet', tint));
    }
    return out;
  };
  /** A wrought-iron railing along x at z (bars as trim, an invisible collider), on a stone plinth, from x0 to x1. */
  const railing = (x0: number, x1: number, z: number): Box[] => {
    const out: Box[] = [flag(b(x0, 0, z - 0.25, x1, 0.45, z + 0.25), '#b0b0b4'), b(x0, 0.45, z - 0.06, x1, 2.0, z + 0.06, 'prop')];
    for (let x = x0 + 0.1; x < x1 - 0.05; x += 0.2) out.push(paint(trim(x - 0.02, 0.45, z - 0.02, x + 0.02, 1.9, z + 0.02), 'pbr_steel', '#2a2c30'));
    for (const y of [0.65, 1.7]) out.push(paint(trim(x0, y, z - 0.03, x1, y + 0.05, z + 0.03), 'pbr_steel', '#2a2c30'));
    return out;
  };
  return [
    {
      id: 'gothic.library',
      category: 'Buildings',
      displayName: 'Manor Library',
      blurb: '2 × 2 cells, two storeys: walls of bookcases, reading tables, stairs up the east wall to a railed gallery round three sides',
      cells: footprint(2, 2, 2),
      floors: [0],
      ports: perimeter(2, 2),
      open: true,
      edgeDefault: 'open',
      extraFloors: [
        walnut(b(-3.5, 3.75, -3.5, -0.6, 4, 11.5)),
        walnut(b(-0.6, 3.75, 8.6, 11.5, 4, 11.5)),
        walnut(b(8.6, 3.75, 6.2, 11.5, 4, 8.6)),
      ],
      solids: [
        ...shell(-3.8, -3.8, 11.8, 11.8, { S: [door(4), win(0), win(8), win(0, 1.5, 5, 6.8), win(8, 1.5, 5, 6.8)], N: [door(0), win(4, 1.5, 5, 6.8), win(8, 1.5, 5, 6.8)], W: [win(0), win(8), win(4, 1.5, 5, 6.8)], E: [win(6.5, 1.5, 5, 6.8)] }, 0, 8),
        // Stairs up the east wall, south to north.
        ...flight('z', 1, -1.0, 9.1, 11.5, 16, 0, 0.45).map((s) => walnut(s, '#8a6a52')),
        rail(-0.6, -3.5, -0.6, 8.6, 4),
        rail(-0.6, 8.6, 8.6, 8.6, 4),
        rail(8.6, 7.4, 8.6, 8.6, 4),
        // Bookcases round the walls below the gallery and along its north side.
        ...bookcase(-3.5, -1.6, -3.0, 2.6, 0, 3.4, 'E'),
        ...bookcase(-3.5, 5.4, -3.0, 9.4, 0, 3.4, 'E'),
        ...bookcase(1.6, 11.0, 6.4, 11.5, 0, 3.4, 'S'),
        ...bookcase(1.6, 11.0, 6.4, 11.5, 4, 3.0, 'S'),
        // Free-standing cases (cover) and two long reading tables.
        ...bookcase(1.0, 3.6, 3.0, 4.2, 0, 2.4, 'S'),
        ...bookcase(4.6, 3.6, 6.6, 4.2, 0, 2.4, 'N'),
        walnut(b(0.4, 0, -0.6, 3.6, 0.8, 0.6), '#a07a5a'),
        walnut(b(4.4, 0, 6.4, 7.6, 0.8, 7.6), '#a07a5a'),
        trim(-3.8, 7.6, -3.8, 11.8, 8, 11.8, 'dark_wood'),
        b(-3.8, 8, -3.8, 11.8, 8.3, 11.8),
        trim(-0.4, 0.01, -2.6, 8.4, 0.03, 8.4, 'carpet', '#8a3040'),
      ],
    },
    {
      id: 'gothic.crypt',
      category: 'Rooms',
      displayName: 'Crypt',
      blurb: 'A vaulted stone burial chamber, north to south: niches stacked with coffins along the walls, a tomb in the middle (put it below ground under a mausoleum)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: [
        { side: 'N', level: 0 },
        { side: 'S', level: 0 },
      ],
      open: true,
      edgeDefault: 'open',
      solids: [
        ...shell(-4, -4, 4, 4, { N: [door(0, 3, 2.8)], S: [door(0, 3, 2.8)] }, 0, 4, 0.5, 'pbr_castle_stone', '#8a8a92'),
        // Burial niches: stone shelves with coffin ends showing, two tiers along the east and west walls.
        ...[-1, 1].flatMap((s) => [-2.4, 0, 2.4].flatMap((z) => [stone(b(s > 0 ? 2.9 : -3.5, 0, z - 1.0, s > 0 ? 3.5 : -2.9, 0.7, z + 1.0)), stone(b(s > 0 ? 3.0 : -3.5, 1.5, z - 1.0, s > 0 ? 3.5 : -3.0, 1.65, z + 1.0)), trim(s > 0 ? 2.85 : -2.95, 0.75, z - 0.35, s > 0 ? 2.95 : -2.85, 1.2, z + 0.35, 'pbr_walnut', '#5a3a2a'), trim(s > 0 ? 2.95 : -3.05, 1.7, z - 0.35, s > 0 ? 3.05 : -2.95, 2.1, z + 0.35, 'pbr_walnut', '#5a3a2a')])),
        // The tomb in the middle.
        stone(b(-0.6, 0, -1.2, 0.6, 1.0, 1.2), '#c0c0c8'),
        trim(-0.7, 1.0, -1.3, 0.7, 1.12, 1.3, 'pbr_marble_black'),
        // Ribbed vault (visual) and the ceiling.
        ...[-2.6, 0, 2.6].map((z) => stone(trim(-3.5, 3.4, z - 0.15, 3.5, 3.7, z + 0.15))),
        stone(b(-4, 3.6, -4, 4, 3.95, 4), '#707078'),
        flag(trim(-3.5, 0, -3.8, 3.5, 0.02, 3.8)),
      ],
    },
    {
      id: 'gothic.mausoleum',
      category: 'Open',
      displayName: 'Mausoleum',
      blurb: 'Open ground with a stone mausoleum: a columned porch and pediment, a slate roof, a 2.4 m doorway into its tomb chamber (south)',
      cells: [
        [0, 0, 0],
        [0, 0, 1],
      ],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        // Steps up to the porch, the chamber behind.
        stone(b(-2.6, 0, -2.6, 2.6, 0.25, 3.4), '#b0b0b8'),
        ...shell(-2.4, -0.6, 2.4, 3.2, { S: [door(0, 2.4, 2.8)] }, 0.25, 4.0, 0.4, 'pbr_castle_stone', '#a0a0a8'),
        ...[-1.9, 1.9].map((x) => stone(b(x - 0.25, 0.25, -2.5, x + 0.25, 4.0, -2.0), '#c8c8cc')),
        stone(b(-2.6, 4.0, -2.7, 2.6, 4.35, 3.4), '#b0b0b8'),
        ...gable(-2.6, -2.7, 2.6, 3.4, 4.35, 0.42, 'pbr_slate_roof', { ridge: 'z', over: 0.25, gableMaterial: 'pbr_castle_stone' }),
        // The tomb inside.
        stone(b(-0.5, 0.25, 1.7, 0.5, 1.1, 2.8), '#c0c0c8'),
        trim(-0.25, 4.6, -2.75, 0.25, 5.4, -2.6, 'pbr_castle_stone', '#c8c8cc'),
        trim(-0.6, 4.95, -2.75, 0.6, 5.1, -2.6, 'pbr_castle_stone', '#c8c8cc'),
      ],
    },
    {
      id: 'gothic.cemetery',
      category: 'Open',
      displayName: 'Cemetery Plot',
      blurb: 'Open ground: gravel paths crossing north to south and east to west between four kerbed graves and their headstones (low cover)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        trim(-4, 0, -4, 4, 0.03, 4, 'pbr_grass', '#7a8a6a'),
        trim(-1.0, 0.03, -4, 1.0, 0.05, 4, 'pbr_gravel', '#a8a4a0'),
        trim(-4, 0.03, -1.0, 4, 0.05, 1.0, 'pbr_gravel', '#a8a4a0'),
        ...[-1, 1].flatMap((s) => [-2.6, 2.6].flatMap((z, i) => {
          const x0 = s > 0 ? 1.6 : -3.6;
          const x1 = s > 0 ? 3.6 : -1.6;
          const h = 0.8 + ((i + (s > 0 ? 1 : 0)) % 3) * 0.2;
          return [
            stone(b(x0, 0, z - 0.6, x1, 0.25, z + 0.6), '#b0b0b4'),
            trim(x0 + 0.15, 0.25, z - 0.45, x1 - 0.15, 0.3, z + 0.45, 'pbr_moss', '#6a7a5a'),
            stone(s > 0 ? b(x1 - 0.25, 0, z - 0.45, x1, h, z + 0.45) : b(x0, 0, z - 0.45, x0 + 0.25, h, z + 0.45), '#c0c0c4'),
          ];
        })),
      ],
    },
    {
      id: 'gothic.hedge_maze',
      category: 'Open',
      displayName: 'Hedge Maze',
      blurb: 'Open ground walled by 2.4 m box hedges: a way through on every side and a dog-leg inside (join several into a maze)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        trim(-4, 0, -4, 4, 0.03, 4, 'pbr_gravel', '#b8b0a0'),
        // Corner blocks leave 2.6 m gaps in the middle of every side.
        hedge(b(-4, 0, -4, -1.3, 2.4, -3.2)),
        hedge(b(1.3, 0, -4, 4, 2.4, -3.2)),
        hedge(b(-4, 0, 3.2, -1.3, 2.4, 4)),
        hedge(b(1.3, 0, 3.2, 4, 2.4, 4)),
        hedge(b(-4, 0, -3.2, -3.2, 2.4, -1.3)),
        hedge(b(-4, 0, 1.3, -3.2, 2.4, 3.2)),
        hedge(b(3.2, 0, -3.2, 4, 2.4, -1.3)),
        hedge(b(3.2, 0, 1.3, 4, 2.4, 3.2)),
        // The dog-leg: a hedge across the middle, open at both ends.
        hedge(b(-0.8, 0, -0.4, 0.8, 2.4, 0.4)),
      ],
    },
    {
      id: 'gothic.hedge_garden',
      category: 'Open',
      displayName: 'Formal Garden',
      blurb: 'Open ground: four low box-hedge beds round a stone fountain, gravel paths between (waist-high cover)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        trim(-4, 0, -4, 4, 0.03, 4, 'pbr_gravel', '#b8b0a0'),
        ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].flatMap(([sx, sz]) => {
          const [x0, x1] = sx! > 0 ? [1.6, 3.6] : [-3.6, -1.6];
          const [z0, z1] = sz! > 0 ? [1.6, 3.6] : [-3.6, -1.6];
          return [hedge(b(x0, 0, z0, x1, 1.0, z1)), trim(x0 + 0.3, 1.0, z0 + 0.3, x1 - 0.3, 1.05, z1 - 0.3, 'pbr_grass', '#8a6a7a')];
        }),
        ...arc(0, 0, 1.1, 0, Math.PI * 2, 12, 0, 0.6, 0.3).map((x) => stone(x, '#c8c8cc')),
        trim(-0.9, 0.3, -0.9, 0.9, 0.45, 0.9, 'light_strip', '#5a8aa8'),
        stone(b(-0.2, 0, -0.2, 0.2, 1.6, 0.2), '#c8c8cc'),
        stone(trim(-0.5, 1.6, -0.5, 0.5, 1.75, 0.5), '#c8c8cc'),
      ],
    },
    {
      id: 'gothic.iron_fence',
      category: 'Open',
      displayName: 'Iron Railings',
      blurb: 'Open ground with wrought-iron railings on a stone plinth along its north side (see and shoot through the gaps; nobody climbs them)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: railing(-4, 4, 3.6),
    },
    {
      id: 'gothic.iron_gate',
      category: 'Open',
      displayName: 'Railings Gateway',
      blurb: 'The iron railings with a 3 m gateway between stone piers (hang a door or a locked door in it)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        ...railing(-4, -2.1, 3.6),
        ...railing(2.1, 4, 3.6),
        ...[-1, 1].flatMap((s) => [stone(b(s * 1.8 - 0.3, 0, 3.3, s * 1.8 + 0.3, 2.8, 3.9), '#b0b0b4'), stone(trim(s * 1.8 - 0.36, 2.8, 3.24, s * 1.8 + 0.36, 2.95, 3.96), '#c8c8cc')]),
        iron(trim(-1.5, 3.3, 3.57, 1.5, 3.36, 3.63)),
      ],
    },
  ];
}

// ---------------------------------------------------------------- 06 Jungle Ruins

function jungleTiles(): TileDefinition[] {
  const temple = (box: Box, tint = '#d0d0b0') => paint(box, 'pbr_castle_stone', tint);
  const rock = (box: Box, tint?: string) => paint(box, 'pbr_jungle_rock', tint);
  const moss = (box: Box) => paint(box, 'pbr_moss');
  const bark = (box: Box) => paint(box, 'pbr_walnut', '#a08a70');
  const plank = (box: Box) => paint(box, 'pbr_weathered_planks', '#a89070');
  /** A tier of the stepped temple: a square x/z a..c (the stairs' corridor 6.5..9.5 left out in front of `notch`), `top` high. */
  const tier = (a: number, c: number, top: number, notch: number): Box[] => [
    temple(b(a, 0, a, 6.5, top, c)),
    temple(b(9.5, 0, a, c, top, c)),
    temple(b(6.5, 0, notch, 9.5, top, c)),
    moss(trim(a, top, a, c, top + 0.04, a + 0.5)),
  ];
  /** Rough rock fill: a box with a lumpy face of smaller boxes stepping out of it. */
  const crag = (x0: number, z0: number, x1: number, z1: number, h: number, seed: number): Box[] => {
    const out = [rock(b(x0, 0, z0, x1, h, z1))];
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 4; i++) {
      const x = x0 + rnd() * (x1 - x0 - 1);
      const z = z0 + rnd() * (z1 - z0 - 1);
      out.push(rock(b(x, h, z, x + 1 + rnd(), h + 0.3 + rnd() * 0.8, z + 1 + rnd()), '#8a8a7a'));
    }
    return out;
  };
  return [
    {
      id: 'jungle.ziggurat',
      category: 'Large',
      displayName: 'Stepped Temple',
      blurb: '3 × 3 cells: three terraces 2, 4 and 6 m up and a shrine on top, a stair up the middle of the south face (the terraces ring the temple)',
      cells: footprint(3, 3, 3),
      floors: [0],
      ports: perimeter(3, 3),
      open: true,
      edgeDefault: 'open',
      solids: [
        // Terraces (each leaves the stair corridor open up to where the stair reaches its height).
        ...tier(-3, 19, 2, 0.0),
        ...tier(0, 16, 4, 3.6),
        ...tier(3, 13, 6, 7.2),
        // The stair: 24 steps of 0.25 m, 0.45 m deep, from the ground to the top terrace.
        ...flight('z', 1, -3.6, 6.5, 9.5, 24, 0, 0.45).map((s) => temple(s, '#c0c0a0')),
        // Stair cheeks (low stone balustrades, visual).
        ...[6.2, 9.5].map((x) => temple(trim(x, 0, -3.6, x + 0.3, 0.5, 7.2), '#a8a890')),
        // The shrine: walls round x 5..11, z 8..12.6 with a doorway south, a stepped roof.
        ...shell(5, 9.2, 11, 12.9, { S: [door(8, 2.6, 2.6)] }, 6, 9, 0.5, 'pbr_castle_stone', '#c8c8a8'),
        temple(b(4.6, 9, 8.8, 11.4, 9.5, 13), '#b8b8a0'),
        temple(trim(5.6, 9.5, 9.6, 10.4, 10.2, 12.2), '#b8b8a0'),
        temple(trim(6.8, 10.2, 10.4, 9.2, 10.7, 11.4), '#b8b8a0'),
        trim(6.6, 8.6, 8.9, 9.4, 8.9, 8.95, 'pbr_jungle_rock'),
        temple(b(7.0, 6, 11.6, 9.0, 7.0, 12.4), '#a8a890'),
      ],
    },
    {
      id: 'jungle.temple_gate',
      category: 'Open',
      displayName: 'Temple Gateway',
      blurb: 'A massive stone wall east to west across the middle with a 3.4 m gateway under a carved lintel',
      cells: [[0, 0, 0], [0, 0, 1]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        temple(b(-4, 0, -0.8, -1.7, 5, 0.8)),
        temple(b(1.7, 0, -0.8, 4, 5, 0.8)),
        temple(b(-1.7, 3.6, -0.9, 1.7, 5, 0.9), '#c0c0a0'),
        ...[-1, 1].map((s) => temple(b(s * 2.05 - 0.45, 0, -1.1, s * 2.05 + 0.45, 5.6, 1.1), '#b8b8a0')),
        ...[-1.0, 0, 1.0].map((x) => paint(trim(x - 0.3, 3.95, -0.95, x + 0.3, 4.55, -0.9), 'pbr_jungle_rock')),
        moss(trim(-4, 5, -0.8, 4, 5.08, 0.8)),
      ],
    },
    {
      id: 'jungle.temple_wall',
      category: 'Open',
      displayName: 'Ruined Temple Wall',
      blurb: 'Open ground with a crumbling temple wall along its north side, broken down to waist height in the middle',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        temple(b(-4, 0, 3.0, -1.5, 4.2, 4)),
        temple(b(-1.5, 0, 3.0, 0.6, 1.1, 4)),
        temple(b(0.6, 0, 3.0, 2.2, 2.6, 4)),
        temple(b(2.2, 0, 3.0, 4, 3.6, 4)),
        temple(b(-1.0, 0, 1.6, 0.4, 0.6, 2.6), '#b8b8a0'),
        moss(trim(-4, 4.2, 3.0, -1.5, 4.26, 4)),
        moss(trim(2.2, 3.6, 3.0, 4, 3.66, 4)),
        paint(trim(-3.6, 1.6, 2.97, -2.0, 3.2, 3.0), 'pbr_jungle_rock'),
      ],
    },
    {
      id: 'jungle.cliff',
      category: 'Open',
      displayName: 'Cliff',
      blurb: 'An 8 m rock cliff filling the north half (its top is open ground two levels up: join Cliff tiles and open tiles up there)',
      cells: [[0, 0, 0], [0, 0, 1]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        rock(b(-4, 0, 0.5, 4, 8, 4)),
        rock(b(-4, 0, -0.2, -2.4, 5.5, 0.5), '#8a8a7a'),
        rock(b(2.4, 0, -0.4, 4, 3.2, 0.5), '#8a8a7a'),
        moss(trim(-4, 8, 0.5, 4, 8.05, 1.5)),
        moss(trim(-4, 5.5, -0.2, -2.4, 5.55, 0.5)),
      ],
    },
    {
      id: 'jungle.cliff_corner',
      category: 'Open',
      displayName: 'Cliff Corner',
      blurb: 'The cliff turning a corner: rock filling the north and east',
      cells: [[0, 0, 0], [0, 0, 1]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [rock(b(-4, 0, 0.5, 4, 8, 4)), rock(b(0.5, 0, -4, 4, 8, 0.5)), rock(b(-0.4, 0, -0.4, 0.5, 4.5, 0.5), '#8a8a7a'), rock(b(-4, 0, 0, -2.2, 2.4, 0.5), '#8a8a7a'), moss(trim(0.5, 8, -4, 1.4, 8.05, 4))],
    },
    {
      id: 'jungle.cliff_ramp',
      category: 'Vertical',
      displayName: 'Rock Stair',
      blurb: 'Rough rock steps climbing 4 m from west to east against a rock wall on the north (one level up)',
      cells: [[0, 0, 0], [0, 0, 1]],
      floors: [0],
      ports: [
        { side: 'W', level: 0 },
        { side: 'S', level: 0 },
        { side: 'E', level: 1 },
      ],
      open: true,
      edgeDefault: 'open',
      extraFloors: [rock(b(3.6, 3.5, -4, 4, 4, 4))],
      solids: [
        ...flight('x', 1, -4, -4, 2.5, 16, 0, 0.475).map((s) => rock(s, '#a09a88')),
        rock(b(-4, 0, 2.5, 4, 6.5, 4)),
        rock(b(3.6, 0, -4, 4, 3.5, 2.5)),
        moss(trim(-4, 6.5, 2.5, 4, 6.55, 4)),
      ],
    },
    {
      id: 'jungle.cave',
      category: 'Corridors',
      displayName: 'Cave Passage',
      blurb: 'A rough 4 m cave passage through rock, north to south',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: [
        { side: 'S', level: 0 },
        { side: 'N', level: 0 },
      ],
      open: true,
      edgeDefault: 'open',
      solids: [
        rock(b(-4, 0, -4, -2.0, 5, 4)),
        rock(b(2.0, 0, -4, 4, 5, 4)),
        rock(b(-2.0, 3.6, -4, 2.0, 5, 4)),
        rock(b(-2.0, 0, -1.4, -1.4, 2.2, 1.2), '#7a7a6a'),
        rock(b(1.3, 0, 1.0, 2.0, 1.4, 3.2), '#7a7a6a'),
        rock(b(-2.0, 2.8, -4, -1.2, 3.6, -1.0), '#7a7a6a'),
        rock(b(1.0, 3.0, 0.5, 2.0, 3.6, 4), '#7a7a6a'),
        trim(-2, 0, -4, 2, 0.03, 4, 'pbr_forest', '#7a6a50'),
      ],
    },
    {
      id: 'jungle.cave_mouth',
      category: 'Corridors',
      displayName: 'Cave Mouth',
      blurb: 'A cave opening in a rocky hillside, the passage running north (join Cave Passages behind it)',
      cells: [[0, 0, 0], [0, 0, 1]],
      floors: [0],
      ports: [
        { side: 'S', level: 0 },
        { side: 'N', level: 0 },
      ],
      open: true,
      edgeDefault: 'open',
      solids: [
        rock(b(-4, 0, -1.2, -2.0, 6.5, 4)),
        rock(b(2.0, 0, -1.2, 4, 6.5, 4)),
        rock(b(-2.0, 3.6, -1.2, 2.0, 6.5, 4)),
        rock(b(-4, 0, -2.8, -2.4, 3.6, -1.2), '#8a8a7a'),
        rock(b(2.4, 0, -2.8, 4, 4.4, -1.2), '#8a8a7a'),
        rock(b(-4, 0, -4, -3.0, 1.4, -2.8), '#8a8a7a'),
        moss(trim(-3.6, 6.5, -1.2, 3.6, 6.56, 4)),
        paint(trim(-2.0, 3.0, -1.25, 2.0, 3.6, -1.2), 'pbr_moss', '#6a8a40'),
      ],
    },
    {
      id: 'jungle.waterfall_basin',
      category: 'Open',
      displayName: 'Waterfall Basin',
      blurb: 'A rock face on the north with a hidden recess behind where the falls come down, a ledge before it and a 4 m basin sunk 1.5 m, steps up its west side (add Water and the Waterfall prop)',
      cells: [[0, 0, 0], [0, 0, 1]],
      floors: [],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      extraFloors: [
        rock(b(-4, -0.5, -4, 4, 0, -2.5), '#9a9a88'),
        rock(b(-4, -0.5, -2.5, -2, 0, 0), '#9a9a88'),
        rock(b(2, -0.5, -2.5, 4, 0, 0), '#9a9a88'),
        rock(b(-4, -0.5, 0, 4, 0, 4), '#9a9a88'),
        rock(b(-2, -2.0, -2.5, 2, -1.5, 0), '#6a6a5a'),
      ],
      solids: [
        // The basin's sides, and steps up its west side.
        rock(b(-2.1, -2.0, -2.6, -2.0, 0, 0.1)),
        rock(b(2.0, -2.0, -2.6, 2.1, 0, 0.1)),
        rock(b(-2.0, -2.0, -2.6, 2.0, 0, -2.5)),
        rock(b(-2.0, -2.0, 0, 2.0, 0, 0.1)),
        ...[0, 1, 2, 3, 4].map((i) => rock(b(-2.0 + i * 0.5, -2.0, -2.5, -1.5 + i * 0.5, -0.25 * (i + 1), 0), '#8a8a7a')),
        // The rock face with the recess behind the falls (x -1.5..1.5), a ledge before it.
        rock(b(-4, 0, 3.5, 4, 8, 4)),
        rock(b(-4, 0, 2.2, -1.5, 8, 3.5)),
        rock(b(1.5, 0, 2.2, 4, 8, 3.5)),
        rock(b(-1.5, 3.0, 2.2, 1.5, 8, 3.5)),
        moss(trim(-4, 8, 2.2, 4, 8.05, 4)),
      ],
    },
    {
      id: 'jungle.river',
      category: 'Open',
      displayName: 'River Channel',
      blurb: 'A 4 m river bed sunk 1 m, north to south, with steps down its west bank at the south end and its east bank at the north end (add Water to fill it)',
      cells: [[0, 0, 0]],
      floors: [],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      extraFloors: [rock(b(-4, -0.5, -4, -2, 0, 4), '#9a9a88'), rock(b(2, -0.5, -4, 4, 0, 4), '#9a9a88'), rock(b(-2, -1.5, -4, 2, -1.0, 4), '#6a6a58')],
      solids: [
        rock(b(-2.1, -1.5, -4, -2.0, 0, 4)),
        rock(b(2.0, -1.5, -4, 2.1, 0, 4)),
        // Steps down the west bank: 0.25, 0.5, 0.75 m below the bank, then the bed.
        ...[0, 1, 2].map((i) => rock(b(-2.0 + i * 0.6, -1.5, -4, -1.4 + i * 0.6, -0.25 * (i + 1), -1), '#8a8a7a')),
        ...[0, 1, 2].map((i) => rock(b(1.4 - i * 0.6, -1.5, 1, 2.0 - i * 0.6, -0.25 * (i + 1), 4), '#8a8a7a')),
        moss(trim(-4, 0, -4, -2.1, 0.03, 4)),
        moss(trim(2.1, 0, -4, 4, 0.03, 4)),
      ],
    },
    {
      id: 'jungle.giant_tree',
      category: 'Vertical',
      displayName: 'Giant Tree',
      blurb: 'A giant jungle tree: plank stairs climb twice round its trunk (start at the south-west corner) to a lookout 7.5 m up on its north and west sides, under the canopy',
      cells: footprint(1, 1, 3),
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: (() => {
        const out: Box[] = [];
        // The trunk (inside 1.25 m of the middle), roots flaring at its foot (visual).
        out.push(...arc(0, 0, 1.0, 0, Math.PI * 2, 10, 0, 11.5, 0.5).map((x) => bark(x)), bark(b(-0.9, 0, -0.9, 0.9, 11.5, 0.9)));
        for (const a of [0.7, 2.3, 3.9, 5.5]) out.push(paint(tilted(Math.cos(a) * 1.5, 0.25, Math.sin(a) * 1.5, [1.2, 0.5, 0.4], { yaw: -a, kind: 'trim' }), 'pbr_walnut', '#a08a70'));
        // Plank flights (five 0.25 m steps, 0.5 m deep) along each side of a ring 1.3–3.9 m out, landings at the corners.
        const I = 1.3;
        const O = 3.9;
        const slab = (x0: number, z0: number, x1: number, z1: number, top: number) => plank(b(x0, top - 0.3, z0, x1, top, z1));
        let h = 0;
        const sides = ['S', 'E', 'N', 'W', 'S', 'E'] as const;
        for (const side of sides) {
          for (let i = 0; i < 5; i++) {
            h += 0.25;
            const u0 = -I + i * 0.52;
            const u1 = u0 + 0.52;
            if (side === 'S') out.push(slab(u0, -O, u1, -I, h));
            else if (side === 'E') out.push(slab(I, u0, O, u1, h));
            else if (side === 'N') out.push(slab(-u1, I, -u0, O, h));
            else out.push(slab(-O, -u1, -I, -u0, h));
          }
          // The landing at the corner the flight arrives at.
          if (side === 'S') out.push(slab(I, -O, O, -I, h));
          else if (side === 'E') out.push(slab(I, I, O, O, h));
          else if (side === 'N') out.push(slab(-O, I, -I, O, h));
          else out.push(slab(-O, -O, -I, -I, h));
        }
        // The lookout at 7.5 m: the north side, the north-west corner and the west side (the second lap arrives at the north-east corner).
        out.push(slab(-I, I, I, O, 7.5), slab(-O, I, -I, O, 7.5), slab(-O, -I, -I, I, 7.5));
        // The canopy (visual).
        for (const [x, y, z, r] of [[0, 12.5, 0, 3.6], [2.6, 11.8, 1.2, 2.4], [-2.4, 11.6, -1.4, 2.4], [0.8, 11.4, -2.6, 2.2], [-1.2, 12.0, 2.6, 2.2]] as const) out.push(paint(trim(x - r, y - 0.9, z - r, x + r, y + 0.9, z + r), 'pbr_moss', '#4a7a2a'));
        return out;
      })(),
    },
    {
      id: 'jungle.ruined_court',
      category: 'Open',
      displayName: 'Overgrown Court',
      blurb: 'Open paved ground with broken pillars, a fallen column drum and moss (scattered cover)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        trim(-4, 0, -4, 4, 0.03, 4, 'pbr_mossy_cobble'),
        temple(b(-3.2, 0, -3.2, -2.2, 3.4, -2.2)),
        temple(b(2.2, 0, -3.2, 3.2, 1.6, -2.2)),
        temple(b(-3.2, 0, 2.2, -2.2, 0.9, 3.2)),
        temple(b(2.2, 0, 2.2, 3.2, 2.6, 3.2)),
        temple(tilted(1.2, 0.45, -1.0, [1.8, 0.9, 0.9], { yaw: 0.3 }), '#b8b8a0'),
        moss(trim(-3.3, 3.4, -3.3, -2.1, 3.46, -2.1)),
        moss(trim(-1.4, 0.03, 1.0, 0.6, 0.06, 2.6)),
      ],
    },
  ];
}

// ---------------------------------------------------------------- 08 Suburban Chaos

function suburbanTiles(): TileDefinition[] {
  const white = (box: Box) => paint(box, 'paint_matte', '#f2f0ea');
  const deck = (box: Box) => paint(box, 'pbr_concrete', '#d8d4cc');
  const asphalt = (x0: number, z0: number, x1: number, z1: number) => trim(x0, 0, z0, x1, 0.03, z1, 'pbr_asphalt', '#8a8a8a');
  const kitchen = (box: Box) => paint(box, 'pbr_white_panel', '#e8e4dc');
  const wood = (box: Box, tint?: string) => paint(box, 'pbr_walnut', tint);
  return [
    {
      id: 'suburban.house',
      category: 'Buildings',
      displayName: 'Family House',
      blurb: '2 × 1 cells, two storeys under a slate gable roof: living room and kitchen, stairs along the back wall to a landing, two bedrooms upstairs',
      cells: footprint(2, 1, 3),
      floors: [0],
      ports: perimeter(2, 1),
      open: true,
      edgeDefault: 'open',
      extraFloors: [wood(b(-3.5, 3.75, -3.5, 11.5, 4, 1.1), '#c8a888'), wood(b(-3.5, 3.75, 1.1, 2.6, 4, 3.5), '#c8a888'), wood(b(9.8, 3.75, 1.1, 11.5, 4, 3.5), '#c8a888')],
      solids: [
        ...shell(-3.8, -3.8, 11.8, 3.8, { S: [door(1), win(-2.2), win(6.5), win(9.8), win(-1.5, 1.5, 5, 6.3), win(2.5, 1.5, 5, 6.3), win(8, 1.5, 5, 6.3)], N: [door(0.6), win(-2.6, 1.2), win(-1, 1.5, 5, 6.3), win(2.4, 1.5, 5, 6.3)], W: [win(0), win(0, 1.5, 5, 6.3)], E: [win(-1.5), win(0, 1.5, 5, 6.3)] }, 0, 8),
        // Downstairs: living room (west) and kitchen (east) through a wide doorway.
        ...wall('z', 4.1, -3.5, 0.6, [[-2.6, -0.2, 0, 3]], 0, 3.75, 0.2),
        ...[kitchen(b(9.0, 0, -3.5, 11.5, 0.95, -2.9)), kitchen(b(10.9, 0, -2.9, 11.5, 0.95, 0.2)), kitchen(b(6.2, 0, -1.6, 8.2, 0.95, -0.7))],
        trim(9.0, 0.95, -3.5, 11.5, 1.0, -2.9, 'pbr_marble_black'),
        wood(b(-3.4, 0, 1.6, -1.0, 0.85, 3.5), '#6a5a8a'),
        wood(b(-2.4, 0, -1.4, -0.6, 0.45, -0.2), '#8a6a4a'),
        // The stairs along the back wall, west to east, railed along the landing.
        ...flight('x', 1, 2.6, 1.1, 3.5, 16, 0, 0.45).map((s) => wood(s, '#a07a5a')),
        rail(2.6, 1.1, 8.4, 1.1, 4, 'paint_matte', '#f2f0ea'),
        // Upstairs: two bedrooms either side of a partition.
        ...wall('z', 4.0, -3.5, 1.1, [[-2.2, 0.6, 0, 2.4]], 4, 7.75, 0.2),
        wood(b(-3.4, 4, -3.4, -1.4, 4.6, -0.6), '#e0d8c8'),
        wood(b(9.6, 4, -3.4, 11.4, 4.6, -1.2), '#e0d8c8'),
        // Ceiling, then the gable roof.
        b(-3.8, 7.75, -3.8, 11.8, 8, 3.8),
        ...gable(-3.8, -3.8, 11.8, 3.8, 8, 0.5, 'pbr_slate_roof', { over: 0.2 }),
        // Porch canopy over the front door (visual) and a chimney.
        white(trim(-0.6, 3.0, -5.0, 2.6, 3.15, -3.8)),
        paint(b(9.6, 8, 1.2, 10.6, 11.0, 2.2), 'pbr_brick_red'),
      ],
    },
    {
      id: 'suburban.garage',
      category: 'Buildings',
      displayName: 'Garage',
      blurb: 'A one-car garage: a 3.6 × 2.8 m door opening south (hang a Garage Door in it), a back door north, a workbench and shelves, a gable roof',
      cells: [[0, 0, 0], [0, 0, 1]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        ...shell(-3.8, -3.8, 3.8, 3.8, { S: [door(0, 3.6, 2.8)], N: [door(1.3, 2.6, 2.4)] }, 0, 3.6),
        b(-3.8, 3.6, -3.8, 3.8, 3.8, 3.8),
        ...gable(-3.8, -3.8, 3.8, 3.8, 3.8, 0.5, 'pbr_slate_roof', { ridge: 'z', over: 0.1 }),
        wood(b(-3.5, 0, 2.7, -0.5, 0.95, 3.5), '#8a6a4a'),
        paint(b(-3.5, 0, -1.6, -3.0, 2.2, 1.6), 'pbr_steel', '#7a8088'),
        trim(-1.8, 2.8, -3.95, 1.8, 3.0, -3.8, 'paint_matte', '#f2f0ea'),
        trim(-1.4, 0.01, -3.5, 1.4, 0.03, 2.5, 'pbr_concrete_dark'),
      ],
    },
    {
      id: 'suburban.pool',
      category: 'Open',
      displayName: 'Swimming Pool',
      blurb: '1 × 2 cells: a 3.6 × 12 m pool sunk 1.8 m in a paved deck, steps down at the shallow (south) end, a diving board north (add Water to fill it)',
      cells: footprint(1, 2),
      floors: [],
      ports: perimeter(1, 2),
      open: true,
      edgeDefault: 'open',
      extraFloors: [deck(b(-4, -0.5, -4, 4, 0, -2)), deck(b(-4, -0.5, 10, 4, 0, 12)), deck(b(-4, -0.5, -2, -1.8, 0, 10)), deck(b(1.8, -0.5, -2, 4, 0, 10)), paint(b(-1.8, -2.3, -2, 1.8, -1.8, 10), 'pbr_pool_tiles')],
      solids: [
        paint(b(-1.9, -2.3, -2.1, -1.8, 0, 10.1), 'pbr_pool_tiles'),
        paint(b(1.8, -2.3, -2.1, 1.9, 0, 10.1), 'pbr_pool_tiles'),
        paint(b(-1.8, -2.3, -2.1, 1.8, 0, -2.0), 'pbr_pool_tiles'),
        paint(b(-1.8, -2.3, 10.0, 1.8, 0, 10.1), 'pbr_pool_tiles'),
        // Steps down into the shallow end (south), 0.25 m each.
        ...Array.from({ length: 7 }, (_, i) => paint(b(-1.8, -2.3, -2 + i * 0.5, 1.8, -0.25 * (i + 1), -1.5 + i * 0.5), 'pbr_pool_tiles', '#d8f0f8')),
        // Coping round the pool (visual), the diving board.
        ...[trim(-2.05, 0, -2.25, 2.05, 0.06, -2.0), trim(-2.05, 0, 10.0, 2.05, 0.06, 10.25), trim(-2.05, 0, -2.0, -1.8, 0.06, 10.0), trim(1.8, 0, -2.0, 2.05, 0.06, 10.0)].map((x) => paint(x, 'pbr_concrete', '#f0ece4')),
        deck(b(-0.4, 0, 10.4, 0.4, 0.5, 11.4)),
        white(b(-0.3, 0.5, 8.6, 0.3, 0.6, 11.4)),
      ],
    },
    {
      id: 'suburban.playground',
      category: 'Open',
      displayName: 'Playground',
      blurb: 'Open ground on a rubber surface: a climbing tower with steps up to a deck 1.5 m up and a slide down the east side, a sandpit',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        trim(-4, 0, -4, 4, 0.03, 4, 'pbr_tread_plate', '#c86a4a'),
        // Tower: a deck on four posts, steps up from the south, a slide east.
        paint(b(-2.0, 1.3, -0.2, 0.0, 1.5, 1.8), 'pbr_weathered_planks', '#e0c090'),
        ...[[-1.9, -0.1], [-0.1, -0.1], [-1.9, 1.7], [-0.1, 1.7]].map(([x, z]) => paint(b(x! - 0.08, 0, z! - 0.08, x! + 0.08, 2.6, z! + 0.08), 'paint_gloss', '#2a5aa8')),
        ...flight('z', 1, -3.2, -1.7, -0.3, 6, 0, 0.5).map((s) => paint(s, 'paint_gloss', '#e8c020')),
        paint(tilted(1.35, 0.78, 0.8, [2.9, 0.12, 1.0], { roll: -0.52 }), 'paint_gloss', '#e8c020'),
        paint(trim(-2.05, 2.5, -0.25, 0.05, 2.65, 1.85), 'paint_gloss', '#c0302a'),
        // Sandpit.
        paint(b(1.0, 0, -3.4, 3.6, 0.3, -3.2), 'pbr_weathered_planks'),
        paint(b(1.0, 0, -1.4, 3.6, 0.3, -1.2), 'pbr_weathered_planks'),
        paint(b(1.0, 0, -3.2, 1.2, 0.3, -1.4), 'pbr_weathered_planks'),
        paint(b(3.4, 0, -3.2, 3.6, 0.3, -1.4), 'pbr_weathered_planks'),
        trim(1.2, 0.03, -3.2, 3.4, 0.2, -1.4, 'pbr_sand'),
      ],
    },
    {
      id: 'suburban.store',
      category: 'Buildings',
      displayName: 'Corner Store',
      blurb: '2 × 1 cells: a convenience store with a glass front, aisles of shelves, a counter by the door and fridges along the back',
      cells: footprint(2, 1),
      floors: [0],
      ports: perimeter(2, 1),
      open: true,
      edgeDefault: 'open',
      solids: [
        ...shell(-3.8, -3.8, 11.8, 3.8, { S: [win(-0.8, 4.2, 0.8, 2.8), door(3.4, 2.6, 2.8), win(8.6, 4.8, 0.8, 2.8)], N: [door(10.2, 1.4, 2.4)], W: [win(0, 2.4)] }, 0, 4.2),
        b(-3.8, 4.2, -3.8, 11.8, 4.5, 3.8),
        // The counter by the door.
        wood(b(5.6, 0, -3.2, 6.4, 1.05, -1.9), '#b0a090'),
        // Three aisles of shelves (chest high: see over, duck behind).
        ...[-1.2, 2.2, 7.4].map((x) => paint(b(x - 0.45, 0, 0.2, x + 0.45, 1.5, 1.9), 'pbr_white_panel', '#e8e4dc')),
        // Fridges along the back, glowing.
        paint(b(-3.5, 0, 2.8, 8.6, 2.1, 3.5), 'pbr_steel', '#c8ccd0'),
        trim(-3.4, 0.3, 2.78, 8.5, 1.9, 2.8, 'light_strip', '#d8f0ff'),
        // Sign over the front.
        trim(-3.6, 3.0, -4.15, 11.6, 4.1, -3.8, 'paint_gloss', '#c0302a'),
        trim(-2.0, 3.2, -4.2, 10.0, 3.9, -4.15, 'light_strip', '#fff2c0'),
      ],
    },
    {
      id: 'suburban.gas_station',
      category: 'Large',
      displayName: 'Gas Station',
      blurb: '2 × 2 cells: a forecourt under a canopy on four columns, two pump islands (put Petrol Pumps on them), a kiosk at the back',
      cells: footprint(2, 2),
      floors: [0],
      ports: perimeter(2, 2),
      open: true,
      edgeDefault: 'open',
      solids: [
        asphalt(-4, -4, 12, 12),
        ...[[-0.5, -0.5], [8.5, -0.5], [-0.5, 5.5], [8.5, 5.5]].map(([x, z]) => white(b(x! - 0.3, 0, z! - 0.3, x! + 0.3, 5, z! + 0.3))),
        white(b(-1.4, 5, -1.4, 9.4, 5.5, 6.4)),
        trim(-1.45, 5.0, -1.45, 9.45, 5.5, -1.4, 'paint_gloss', '#c0302a'),
        trim(-1.45, 5.0, 6.4, 9.45, 5.5, 6.45, 'paint_gloss', '#c0302a'),
        trim(-1.2, 4.95, -1.2, 9.2, 5.0, 6.2, 'light_strip', '#f8f8ff'),
        ...[1.5, 6.5].map((x) => deck(b(x - 0.6, 0, 0.4, x + 0.6, 0.15, 4.6))),
        // The kiosk.
        ...shell(1.0, 8.4, 11.6, 11.8, { S: [door(4, 2.2, 2.6), win(8.6, 3, 0.9, 2.4), win(1.8, 1.4)] }, 0, 3.6),
        b(1.0, 3.6, 8.4, 11.6, 3.9, 11.8),
        wood(b(6.5, 0, 9.4, 9.0, 1.05, 10.0), '#b0a090'),
        paint(b(1.4, 0, 10.9, 4.8, 1.8, 11.4), 'pbr_white_panel', '#e8e4dc'),
      ],
    },
    {
      id: 'suburban.street',
      category: 'Open',
      displayName: 'Suburban Street',
      blurb: 'A two-lane road east to west with kerbs and pavements either side (join them up; drop houses along them)',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        asphalt(-4, -2.6, 4, 2.6),
        ...[-1.6, 1.4].map((x) => trim(x - 0.6, 0.03, -0.06, x + 0.6, 0.04, 0.06, 'paint_matte', '#f0d040')),
        deck(b(-4, 0, -4, 4, 0.15, -2.6)),
        deck(b(-4, 0, 2.6, 4, 0.15, 4)),
        trim(-4, 0.15, -2.75, 4, 0.16, -2.6, 'pbr_concrete', '#a8a4a0'),
        trim(-4, 0.15, 2.6, 4, 0.16, 2.75, 'pbr_concrete', '#a8a4a0'),
      ],
    },
    {
      id: 'suburban.backyard',
      category: 'Open',
      displayName: 'Back Yard',
      blurb: 'A lawn with a 1.8 m board fence along its north side, a gate gap in the middle',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        trim(-4, 0, -4, 4, 0.03, 4, 'pbr_grass'),
        paint(b(-4, 0, 3.6, -0.8, 1.8, 3.75), 'pbr_weathered_planks', '#c8a880'),
        paint(b(0.8, 0, 3.6, 4, 1.8, 3.75), 'pbr_weathered_planks', '#c8a880'),
        ...[-4, -2, -0.8, 0.8, 2, 4].map((x) => paint(b(Math.max(-4, x - 0.06), 0, 3.75, Math.min(4, x + 0.06), 1.9, 3.9), 'pbr_walnut')),
        trim(1.6, 0.03, -3.0, 3.4, 0.08, -1.4, 'pbr_flagstone'),
      ],
    },
  ];
}

/** The 05 Gothic Estate, 06 Jungle Ruins and 08 Suburban Chaos tiles, in palette order. */
export function boxPackTiles2(): TileDefinition[] {
  return [...gothicTiles(), ...jungleTiles(), ...suburbanTiles()];
}
