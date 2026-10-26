/**
 * St. John's: a look-alike of the St. John's Northwestern Military Academy
 * campus (St. John's Northwestern Academies, now "SJN") on Genesee Street in
 * Delafield, Wisconsin, across the road from Lake Nagawicka. Sources, a
 * building-by-building table and what the kit can't show are in
 * docs/references/ST_JOHNS.md. The layout is traced from the school's campus
 * map (one image pixel = 0.2 m; north up); heights, storeys, towers and
 * materials come from the National Register nomination, the Wisconsin
 * Architecture & History Inventory records, postcards and the school's pages.
 *
 * The academy's halls are Late Gothic Revival "castles" by Thomas Van Alyea in
 * grey lannonstone with dressed limestone trim, crenellated parapets, corner
 * turrets and wide doorways under Gothic arches, set in a U round the drill
 * field with the flagpole at its heart. Built from free blocks:
 *
 *   - The Welles-DeKoven range on the east of the U: DeKoven Hall (four
 *     storeys, octagonal turrets at all four corners, an arched entrance bay
 *     facing the flagpole, barracks upstairs, a lounge and reception below)
 *     joined to Welles Hall (the English Gothic refectory: long tables,
 *     banners and chandeliers, barracks above, and the big square clock
 *     tower).
 *   - Hazelwood Hall (two storeys, classroom below, barracks above) and
 *     Scott Johnston Hall (three storeys of barracks rooms, corner turret,
 *     sniper's roof) along the south of the field, joined inside.
 *   - The Knight / Stangeland Cord academic block (three storeys of
 *     fieldstone classrooms with blackboards, an entrance tower at its corner)
 *     and the 1940 Argonne Gate, a castellated arch over the walk between it
 *     and Welles on Exeter Street.
 *   - Memorial Hall (1893), the odd one out: Shingle style, brown shingles on
 *     a stone base under a steep roof, with its two capped towers.
 *   - The Victory Memorial Chapel: a tall nave with pews, an altar, stained
 *     glass glowing in the walls, a gallery over the west end, and its tower
 *     with twin turrets; the columbarium beside it.
 *   - Smythe Hall (L-shaped, two storeys of dorm rooms), Farrand Gymnasium
 *     (court markings, hoops, bleachers, the Gerber pool), Mouso Hall student
 *     centre, the infirmary, campus store, post office and facilities.
 *   - The drill field (lined out), flagpole, two bronze field guns and the
 *     Field of Flags; the Cyril W. Nave Gateway on St. John's Road off Genesee.
 *   - St. John Chrysostom (1851): red board and batten under a steep roof,
 *     its detached bell tower, the rectory and the old churchyard.
 *   - Across Genesee Street the land falls to the shore of Lake Nagawicka:
 *     a lakeside walk, boathouse, dock, rowboats and willows.
 *   - Private houses along Wisconsin Avenue, with the President's house.
 *
 * Team play: the west team holds the drill field and Hazelwood, the east
 * team the gymnasium, the church and the lakefront; the halls in the middle
 * are the fight. Sniper rifle and mounted gun on DeKoven's roof, marksman
 * rifle on Scott Johnston's, railgun upstairs in Smythe, rockets in the
 * chapel, damage boost by the pool.
 */
import { TERRAIN_MATERIALS, buildOccupancy, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('st_johns', "St. John's");
m.theme('castle');
m.backdrop('clear', 'forest', 'grass', 0.4, 0.2);
m.teams([12, 12]);
const [west, east] = m.teamIds() as [string, string];

type V3 = [number, number, number];
type Side = 'N' | 'S' | 'E' | 'W';
const P = Math.PI / 2;

// Campus map pixels to world metres: x east, z north (the map's top).
const X = (px: number) => Math.round((px - 625) * 0.2 * 10) / 10;
const Z = (py: number) => Math.round((725 - py) * 0.2 * 10) / 10;
interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
const R = (px0: number, py0: number, px1: number, py1: number): Rect => ({ x0: X(px0), x1: X(px1), z0: Z(py1), z1: Z(py0) });
const mid = (r: Rect, y = 0.1): V3 => [(r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2];

// ---------------------------------------------------------------- materials

const STONE = { material: 'cobble', tint: '#d9d5cb' }; // lannonstone: light grey-buff dolomite, random coursed
const FIELDSTONE = { material: 'pbr_castle_stone', tint: '#e6dfcd' }; // Delafield fieldstone (the 1902 classroom block)
const DRESSED = { material: 'stone_trim', tint: '#d8d3c6' }; // limestone trim
const FLOOR = { material: 'pbr_floorboards' };
const ROOF = { material: 'pbr_flagstone' };
const ASPHALT = { material: 'pbr_asphalt' };
const WALK = { material: 'pbr_flagstone', tint: '#a8a49c' };
const PAINT = { material: 'paint_matte', tint: '#eeede6' };
const SHINGLE = { material: 'oak_planks', tint: '#b8875a' }; // brown wood shingle
const SLATE = { material: 'pbr_roof', tint: '#7a8086' };
const GLASS = ['#3c5fc8', '#b33a3f', '#d6a83a', '#3f8f5a'];
type Mat = { material: string; tint?: string };

/** A solid box from min to max corner (split into pieces no bigger than blocks allow). */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: Mat, yaw = 0): void {
  if (x1 - x0 < 0.04 || z1 - z0 < 0.04 || y1 - y0 < 0.02) return;
  // Blocks are at least 0.2 m across and 0.1 m tall: thinner trim (paint lines, glass, slots) grows to that,
  // centred across and sunk downward.
  if (y1 - y0 < 0.101) y0 = y1 - 0.101;
  if (x1 - x0 < 0.201) [x0, x1] = [(x0 + x1) / 2 - 0.101, (x0 + x1) / 2 + 0.101];
  if (z1 - z0 < 0.201) [z0, z1] = [(z0 + z1) / 2 - 0.101, (z0 + z1) / 2 + 0.101];
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  if (w > 64 || d > 64 || h > 32) {
    const nx = Math.ceil(w / 64);
    const nz = Math.ceil(d / 64);
    const ny = Math.ceil(h / 32);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++)
        for (let k = 0; k < ny; k++) box(x0 + (w * i) / nx, y0 + (h * k) / ny, z0 + (d * j) / nz, x0 + (w * (i + 1)) / nx, y0 + (h * (k + 1)) / ny, z0 + (d * (j + 1)) / nz, mat, yaw);
    return;
  }
  m.block([(x0 + x1) / 2, y0, (z0 + z1) / 2], [w, h, d], 'solid', { ...mat, yaw });
}

/** A rectangle minus a hole, as up to four rectangles. */
function minus(r: Rect, hole: Rect | null): Rect[] {
  if (!hole) return [r];
  const out: Rect[] = [];
  if (hole.z0 > r.z0) out.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: hole.z0 });
  if (hole.z1 < r.z1) out.push({ x0: r.x0, x1: r.x1, z0: hole.z1, z1: r.z1 });
  if (hole.x0 > r.x0) out.push({ x0: r.x0, x1: hole.x0, z0: Math.max(r.z0, hole.z0), z1: Math.min(r.z1, hole.z1) });
  if (hole.x1 < r.x1) out.push({ x0: hole.x1, x1: r.x1, z0: Math.max(r.z0, hole.z0), z1: Math.min(r.z1, hole.z1) });
  return out;
}

const slab = (r: Rect, y0: number, y1: number, mat: Mat) => box(r.x0, y0, r.z0, r.x1, y1, r.z1, mat);
const grow = (r: Rect, d: number): Rect => ({ x0: r.x0 - d, x1: r.x1 + d, z0: r.z0 - d, z1: r.z1 + d });

// ---------------------------------------------------------------- castle halls

const T = 0.6; // wall thickness
interface Opening {
  /** Centre along the side, 0 (west/south end) to 1. */
  at: number;
  width: number;
  bottom: number;
  top: number;
}

/**
 * One storey of one wall: a run from a0 to a1 along x (N/S sides) or z (E/W
 * sides), with door and window openings cut out (piers between them, sills
 * below, lintels above).
 */
function wallRun(side: Side, r: Rect, y0: number, h: number, openings: Opening[], mat: Mat): void {
  const alongX = side === 'N' || side === 'S';
  const a0 = alongX ? r.x0 : r.z0;
  const a1 = alongX ? r.x1 : r.z1;
  const c0 = side === 'N' ? r.z1 - T : side === 'S' ? r.z0 : side === 'E' ? r.x1 - T : r.x0;
  const seg = (s0: number, s1: number, b: number, t: number) => {
    if (s1 - s0 < 0.05 || t - b < 0.05) return;
    if (alongX) box(s0, y0 + b, c0, s1, y0 + t, c0 + T, mat);
    else box(c0, y0 + b, s0, c0 + T, y0 + t, s1, mat);
  };
  const holes = openings
    .map((o) => ({ s0: a0 + (a1 - a0) * o.at - o.width / 2, s1: a0 + (a1 - a0) * o.at + o.width / 2, b: o.bottom, t: Math.min(h, o.top) }))
    .filter((o) => o.s0 > a0 + 0.3 && o.s1 < a1 - 0.3)
    .sort((p, q) => p.s0 - q.s0);
  let s = a0;
  for (const o of holes) {
    if (o.s0 < s) continue;
    seg(s, o.s0, 0, h);
    seg(o.s0, o.s1, 0, o.b);
    seg(o.s0, o.s1, o.t, h);
    s = o.s1;
  }
  seg(s, a1, 0, h);
}

/** A ring of battlements: a parapet with merlons, standing on `y`. */
function battlements(r: Rect, y: number, mat: Mat = DRESSED, parapet = 0.9, merlon = 0.7, every = 2.6): void {
  box(r.x0, y, r.z0, r.x1, y + parapet, r.z0 + 0.5, mat);
  box(r.x0, y, r.z1 - 0.5, r.x1, y + parapet, r.z1, mat);
  box(r.x0, y, r.z0 + 0.5, r.x0 + 0.5, y + parapet, r.z1 - 0.5, mat);
  box(r.x1 - 0.5, y, r.z0 + 0.5, r.x1, y + parapet, r.z1 - 0.5, mat);
  const top = y + parapet;
  for (let x = r.x0 + 0.6; x + 1 <= r.x1 - 0.6; x += every) {
    box(x, top, r.z0, x + 1, top + merlon, r.z0 + 0.5, mat);
    box(x, top, r.z1 - 0.5, x + 1, top + merlon, r.z1, mat);
  }
  for (let z = r.z0 + 0.6 + every; z + 1 <= r.z1 - 0.6 - every; z += every) {
    box(r.x0, top, z, r.x0 + 0.5, top + merlon, z + 1, mat);
    box(r.x1 - 0.5, top, z, r.x1, top + merlon, z + 1, mat);
  }
}

/** An octagonal tower (two turned blocks), from `y0` to `height`. */
function octagon(cx: number, cz: number, radius: number, y0: number, height: number, mat: Mat): void {
  const s = radius * 2;
  m.block([cx, y0, cz], [s, height - y0, s], 'solid', mat);
  m.block([cx, y0, cz], [s * 0.83, height - y0, s * 0.83], 'solid', { ...mat, yaw: Math.PI / 4 });
}

/** An octagonal corner turret with a corbelled, crenellated cap. */
function turret(cx: number, cz: number, radius: number, height: number, mat: Mat = STONE): void {
  octagon(cx, cz, radius, 0, height, mat);
  const s = radius * 2;
  m.block([cx, height, cz], [s + 0.6, 0.6, s + 0.6], 'solid', DRESSED);
  m.block([cx, height, cz], [(s + 0.6) * 0.83, 0.6, (s + 0.6) * 0.83], 'solid', { ...DRESSED, yaw: Math.PI / 4 });
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) m.block([cx + dx * (radius * 0.8), height + 0.6, cz + dz * (radius * 0.8)], [0.9, 0.8, 0.9], 'solid', DRESSED);
}

/** A conical cap (stepped octagons) on a round tower, from `y`. */
function cap(cx: number, cz: number, radius: number, y: number, height: number, mat: Mat): void {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const r = radius * (1 - i / n) + 0.15;
    octagon(cx, cz, r, y + (i * height) / n, y + ((i + 1) * height) / n, mat);
  }
  box(cx - 0.06, y + height, cz - 0.06, cx + 0.06, y + height + 1.2, cz + 0.06, { material: 'brass' });
}

interface HallOptions {
  storeys: number;
  storeyHeight?: number;
  /** Doors on the ground floor: side and position along it (0-1). */
  doors: [Side, number][];
  /** Doors on every upper floor too (into a joined building). */
  upperDoors?: [Side, number][];
  /** Window spacing in metres (0 = none). */
  windows?: number;
  /** Stairs up through the floors (and onto the roof with `roofAccess`): the stairwell's south-west corner. */
  stairs?: [number, number];
  roofAccess?: boolean;
  mat?: Mat;
  floor?: Mat;
  /** Corner turrets: which corners. */
  turrets?: ('NE' | 'NW' | 'SE' | 'SW')[];
  turretRadius?: number;
  /** Battlements round the roof (default true). */
  parapet?: boolean;
}

const STEPS = 16;
const RISE = 4 / STEPS;
const TREAD = 0.5;
const STAIR_W = 2.6;

/** A straight flight of 16 steps (0.25 m rise, 0.5 m tread, like the building kit's stairs) from height y, 2.6 m wide, starting at (x, z) and climbing north (+1) or south (-1). */
function flight(x: number, z: number, y: number, dir: 1 | -1, mat: Mat): Rect {
  for (let i = 0; i < STEPS; i++) {
    const z0 = dir > 0 ? z + i * TREAD : z - (i + 1) * TREAD;
    box(x, y, z0, x + STAIR_W, y + (i + 1) * RISE, z0 + TREAD, mat);
  }
  const len = STEPS * TREAD;
  return dir > 0 ? { x0: x, x1: x + STAIR_W, z0: z, z1: z + len } : { x0: x, x1: x + STAIR_W, z0: z - len, z1: z };
}

/** Where each hall's stairs run, and its doorways (furniture keeps clear of both). */
const stairwells: Rect[] = [];
const doorways: V3[] = [];
/** Floor heights for furniture: storey s of a hall stands at floorY(s). */
const floorY = (s: number, H = 4) => (s ? s * H + 0.3 : 0.1);

/**
 * A hollow Gothic hall: stone walls with windows on every storey, doors,
 * timber floors, switchback stairs, a flagstone roof inside battlements, a
 * dressed string course round every floor line, and optional corner turrets.
 */
function hall(r: Rect, o: HallOptions): void {
  const H = o.storeyHeight ?? 4;
  const mat = o.mat ?? STONE;
  const floorMat = o.floor ?? FLOOR;
  const win = o.windows ?? 5;
  const inner: Rect = { x0: r.x0 + T, x1: r.x1 - T, z0: r.z0 + T, z1: r.z1 - T };
  // Bedded into the ground: a 10 cm slab on its own confuses the bots' navmesh at the stairs.
  slab(inner, -0.4, 0.1, floorMat);
  // Switchback stairs: even flights climb north in the west strip, odd ones south in the east strip.
  const holes: (Rect | null)[] = Array(o.storeys + 1).fill(null);
  const flights = o.stairs ? o.storeys - 1 + (o.roofAccess ? 1 : 0) : 0;
  if (o.stairs) stairwells.push({ x0: o.stairs[0] - 0.8, x1: o.stairs[0] + 2 * STAIR_W + 0.8, z0: o.stairs[1] - 2.4, z1: o.stairs[1] + STEPS * TREAD + 2.4 });
  for (let s = 0; s < flights; s++) {
    const [sx, sz] = o.stairs!;
    const even = s % 2 === 0;
    const run = even ? flight(sx, sz, s * H + (s ? 0.3 : 0.1), 1, DRESSED) : flight(sx + STAIR_W, sz + STEPS * TREAD, s * H + 0.3, -1, DRESSED);
    // The opening above reaches half a metre past the steps on the open side, so the top steps keep full headroom.
    holes[s + 1] = { x0: even ? run.x0 : run.x0 - 0.5, x1: even ? run.x1 + 0.5 : run.x1, z0: run.z0, z1: run.z1 };
  }
  for (const side of ['N', 'S', 'E', 'W'] as const) {
    const length = side === 'N' || side === 'S' ? r.x1 - r.x0 : r.z1 - r.z0;
    for (let s = 0; s < o.storeys; s++) {
      const openings: Opening[] = [];
      const doorAt = (at: number): V3 => (side === 'N' || side === 'S' ? [r.x0 + at * (r.x1 - r.x0), floorY(s, H), side === 'N' ? r.z1 : r.z0] : [side === 'E' ? r.x1 : r.x0, floorY(s, H), r.z0 + at * (r.z1 - r.z0)]);
      if (s === 0) for (const [ds, at] of o.doors) if (ds === side) openings.push({ at, width: 2.8, bottom: 0, top: 3.1 }), doorways.push(doorAt(at));
      // Upper doors keep a 0.3 m sill, level with the floor beyond.
      if (s > 0) for (const [ds, at] of o.upperDoors ?? []) if (ds === side) openings.push({ at, width: 2.4, bottom: 0.3, top: 3.2 }), doorways.push(doorAt(at));
      if (win > 0) {
        const n = Math.floor(length / win);
        for (let i = 0; i < n; i++) {
          const at = (i + 0.5) / n;
          if (openings.some((d) => Math.abs(d.at - at) * length < 2.6)) continue;
          // No windows beside the stairwell: an open drop next to the steps narrows them for the bots' navmesh.
          if (o.stairs && (side === 'W' || side === 'E')) {
            const z = r.z0 + at * length;
            if (z > o.stairs[1] - 1.5 && z < o.stairs[1] + STEPS * TREAD + 1.5) continue;
          }
          openings.push({ at, width: 1.3, bottom: 1.1, top: 2.8 });
        }
      }
      wallRun(side, r, s * H, H, openings, mat);
    }
  }
  // Upper floors and the roof.
  for (let s = 1; s <= o.storeys; s++) {
    const top = s === o.storeys;
    for (const part of minus(inner, top && !o.roofAccess ? null : holes[s] ?? null)) slab(part, s * H, s * H + 0.3, top ? ROOF : floorMat);
    // A string course of dressed stone round the building at every floor line.
    if (!top && o.mat !== SHINGLE) {
      box(r.x0 - 0.15, s * H - 0.1, r.z0 - 0.15, r.x1 + 0.15, s * H + 0.2, r.z0, DRESSED);
      box(r.x0 - 0.15, s * H - 0.1, r.z1, r.x1 + 0.15, s * H + 0.2, r.z1 + 0.15, DRESSED);
      box(r.x0 - 0.15, s * H - 0.1, r.z0, r.x0, s * H + 0.2, r.z1, DRESSED);
      box(r.x1, s * H - 0.1, r.z0, r.x1 + 0.15, s * H + 0.2, r.z1, DRESSED);
    }
  }
  if (o.parapet !== false) battlements(r, o.storeys * H + 0.3);
  // Turrets stand out from the corners (only their inner edge meets the walls), so rooms keep their corners.
  const tr = o.turretRadius ?? 2;
  for (const c of o.turrets ?? []) {
    const cx = c.endsWith('E') ? r.x1 + tr * 0.7 : r.x0 - tr * 0.7;
    const cz = c.startsWith('N') ? r.z1 + tr * 0.7 : r.z0 - tr * 0.7;
    turret(cx, cz, tr, o.storeys * H + 3.2);
  }
  // A light on every floor, every 12 m or so.
  const nx = Math.max(1, Math.round((inner.x1 - inner.x0) / 12));
  const nz = Math.max(1, Math.round((inner.z1 - inner.z0) / 12));
  for (let s = 0; s < o.storeys; s++)
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++)
        m.light([inner.x0 + ((i + 0.5) * (inner.x1 - inner.x0)) / nx, s * H + H - 0.55, inner.z0 + ((j + 0.5) * (inner.z1 - inner.z0)) / nz], { color: '#ffe9c4', intensity: 0.8, range: 11 });
}

/** A square tower with battlements (solid), `h` metres tall, with lancet slots on each face. */
function tower(r: Rect, h: number, mat: Mat = STONE, y0 = 0): void {
  box(r.x0, y0, r.z0, r.x1, h, r.z1, mat);
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const dark = { material: 'dark_wood' };
  for (const [a, b] of [[0.5, 0.62], [0.68, 0.84]] as const) {
    box(cx - 0.35, h * a, r.z0 - 0.05, cx + 0.35, h * b, r.z0, dark);
    box(cx - 0.35, h * a, r.z1, cx + 0.35, h * b, r.z1 + 0.05, dark);
    box(r.x0 - 0.05, h * a, cz - 0.35, r.x0, h * b, cz + 0.35, dark);
    box(r.x1, h * a, cz - 0.35, r.x1 + 0.05, h * b, cz + 0.35, dark);
  }
  battlements({ x0: r.x0 - 0.3, x1: r.x1 + 0.3, z0: r.z0 - 0.3, z1: r.z1 + 0.3 }, h, DRESSED, 0.7, 0.9, 2);
}

/** A stepped (corbie) gable roof along x or z over `r`, starting at y. */
function steppedRoof(r: Rect, y: number, steps: number, stepH: number, alongX: boolean, mat: Mat): void {
  const span = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
  for (let i = 0; i < steps; i++) {
    const inset = (span / 2) * (i / steps);
    if (alongX) box(r.x0, y + i * stepH, r.z0 + inset, r.x1, y + (i + 1) * stepH, r.z1 - inset, mat);
    else box(r.x0 + inset, y + i * stepH, r.z0, r.x1 - inset, y + (i + 1) * stepH, r.z1, mat);
  }
}

/** A Gothic arch framing a doorway (drawn only: walk-through), facing `yaw`. */
const archway = (x: number, z: number, yaw: number, scale = 1) => m.prop('rn_arch_gothic', [x, 0, z], yaw, scale, false);

/** Stained glass: glowing coloured lancets set into a wall face, from y0 to y1, `n` along [a0, a1]. */
function lancets(side: Side, r: Rect, a0: number, a1: number, n: number, y0: number, y1: number): void {
  for (let i = 0; i < n; i++) {
    const a = a0 + ((i + 0.5) * (a1 - a0)) / n;
    const mat = { material: 'light_strip', tint: GLASS[i % GLASS.length]! };
    const w = 0.55;
    if (side === 'N') box(a - w, y0, r.z1, a + w, y1, r.z1 + 0.06, mat), box(a - w, y0, r.z1 - T - 0.06, a + w, y1, r.z1 - T, mat);
    if (side === 'S') box(a - w, y0, r.z0 - 0.06, a + w, y1, r.z0, mat), box(a - w, y0, r.z0 + T, a + w, y1, r.z0 + T + 0.06, mat);
    if (side === 'E') box(r.x1, y0, a - w, r.x1 + 0.06, y1, a + w, mat), box(r.x1 - T - 0.06, y0, a - w, r.x1 - T, y1, a + w, mat);
  }
}

// ---------------------------------------------------------------- furniture

/** Spots to keep clear of furniture: spawns, pickups, objectives and vehicles (filled in once they're placed). */
let marks: V3[] = [];
let furnished = 0;
/** One piece of furniture at (x, y, z) unless it would crowd a spawn, pickup or stairwell. */
function put(model: string, x: number, y: number, z: number, yaw = 0, scale = 1, solid = true): void {
  if (marks.some((p) => Math.hypot(p[0] - x, p[2] - z) < 1.8 && Math.abs(p[1] - y) < 2)) return;
  if (solid && stairwells.some((s) => x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1)) return;
  if (solid && doorways.some((d) => Math.hypot(d[0] - x, d[2] - z) < 2.6 && Math.abs(d[1] - y) < 2)) return;
  m.prop(model, [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)], +yaw.toFixed(4), scale, solid);
  furnished++;
}

/**
 * A barracks floor: bunks and lockers along the long walls (two cadets to a
 * bay, bays divided by lockers), a rug and a table down the middle aisle.
 */
function barracks(r: Rect, y: number, alongX: boolean): void {
  const inner = grow(r, -T);
  const len = alongX ? inner.x1 - inner.x0 : inner.z1 - inner.z0;
  const bays = Math.floor((len - 2) / 4);
  for (let i = 0; i < bays; i++) {
    const a = (alongX ? inner.x0 : inner.z0) + 2 + i * 4 + 1.4;
    for (const s of [0, 1]) {
      if (alongX) {
        const z = s ? inner.z1 - 1.25 : inner.z0 + 1.25;
        put('hm_bunk_bed', a, y, z, P, 1);
        put('hm_dresser', a + 2.1, y, s ? inner.z1 - 0.5 : inner.z0 + 0.5, s ? Math.PI : 0, 0.8);
      } else {
        const x = s ? inner.x1 - 1.25 : inner.x0 + 1.25;
        put('hm_bunk_bed', x, y, a, 0, 1);
        put('hm_dresser', s ? inner.x1 - 0.5 : inner.x0 + 0.5, y, a + 2.1, s ? -P : P, 0.8);
      }
    }
  }
  const c = mid(inner, y);
  put('hm_rug', c[0], y, c[2], alongX ? P : 0, 1.4, false);
}

/** A classroom: rows of desks and chairs facing a blackboard on the `board` wall. */
function classroom(r: Rect, y: number, board: Side, rows: number, cols: number): void {
  const inner = grow(r, -T);
  const green = { material: 'paint_matte', tint: '#2e4a3c' };
  const cx = (inner.x0 + inner.x1) / 2;
  const cz = (inner.z0 + inner.z1) / 2;
  const yb = y === 0.1 ? 0 : y - 0.3;
  if (board === 'W') box(inner.x0, yb + 1, cz - 3, inner.x0 + 0.06, yb + 2.3, cz + 3, green);
  if (board === 'E') box(inner.x1 - 0.06, yb + 1, cz - 3, inner.x1, yb + 2.3, cz + 3, green);
  if (board === 'S') box(cx - 3, yb + 1, inner.z0, cx + 3, yb + 2.3, inner.z0 + 0.06, green);
  if (board === 'N') box(cx - 3, yb + 1, inner.z1 - 0.06, cx + 3, yb + 2.3, inner.z1, green);
  // Facing the board: desks at yaw toward it, chairs behind.
  const yaw = board === 'W' ? -P : board === 'E' ? P : board === 'S' ? 0 : Math.PI;
  const dir: [number, number] = board === 'W' ? [-1, 0] : board === 'E' ? [1, 0] : board === 'S' ? [0, -1] : [0, 1];
  // Teacher's desk by the board.
  put('desk', cx + dir[0] * ((inner.x1 - inner.x0) / 2 - 2.2), y, cz + dir[1] * ((inner.z1 - inner.z0) / 2 - 2.2), yaw + Math.PI, 1);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const half = dir[0] ? (inner.x1 - inner.x0) / 2 : (inner.z1 - inner.z0) / 2;
      const along = half - 4.2 - i * 3; // rows back from the board
      const across = (j - (cols - 1) / 2) * 3.4;
      const [x, z] = dir[0] ? [cx + dir[0] * along, cz + across] : [cx + across, cz + dir[1] * along];
      put('desk', x, y, z, yaw, 0.9);
      put('hm_chair_wood', x - dir[0] * 0.9, y, z - dir[1] * 0.9, yaw + Math.PI, 1);
    }
}

// ---------------------------------------------------------------- ground and streets

const road = (r: Rect) => slab(r, 0, 0.12, ASPHALT);
road({ x0: -121, x1: 109, z0: 119.4, z1: 127.4 }); // Wisconsin Avenue
road({ x0: -121, x1: -109, z0: -141, z1: 119.4 }); // Spanjer Street
road({ x0: 101, x1: 109, z0: -141, z1: 127.4 }); // Genesee Street (County C)
road({ x0: -109, x1: 101, z0: 61, z1: 69 }); // St. John's Road
road({ x0: -44, x1: -36, z0: 69, z1: 119.4 }); // Smythe Lane
road({ x0: 29, x1: 36.6, z0: 69, z1: 119.4 }); // Farrand Lane, north
road({ x0: 29, x1: 36.6, z0: -67, z1: 61 }); // Farrand Lane and the visitor parking
road({ x0: 36.6, x1: 101, z0: -6.6, z1: 0.6 }); // Church Street
road({ x0: -109, x1: 101, z0: -79, z1: -67 }); // Exeter Street
slab({ x0: -36, x1: 29, z0: -6.6, z1: 0.6 }, 0, 0.12, WALK); // the walk past the beacon
// Centre lines down the main streets, and parking bays along the visitor lot.
for (let x = -100; x < 96; x += 6) box(x, 0.12, -73.1, x + 3, 0.13, -72.9, { material: 'paint_matte', tint: '#e2c14a' });
for (let z = -136; z < 122; z += 6) box(104.9, 0.12, z, 105.1, 0.13, z + 3, { material: 'paint_matte', tint: '#e2c14a' });
for (let z = -60; z < 56; z += 6) box(34.4, 0.12, z, 36.4, 0.14, z + 0.15, PAINT);

// ---------------------------------------------------------------- the drill field, flagpole and Field of Flags

// The two low stone stands (the brackets on the campus map): cover across the field's west side.
const stand = (x0: number, z0: number, x1: number, z1: number) => {
  box(x0, 0, z0, x1, 1.1, z1, STONE);
  box(x0 - 0.1, 1.1, z0 - 0.1, x1 + 0.1, 1.3, z1 + 0.1, DRESSED);
};
stand(-105, 0.6, -103, 24);
stand(-105, 24, -71.6, 26);
stand(-105, -35, -103, -11.6);
stand(-105, -37, -71.6, -35);
// The drill field lined out in white: a parade rectangle with a centre line.
const drill: Rect = { x0: -100, x1: -74, z0: -31, z1: 21 };
const line = (x0: number, z0: number, x1: number, z1: number) => box(x0, 0, z0, x1, 0.04, z1, PAINT);
line(drill.x0, drill.z0, drill.x1, drill.z0 + 0.15);
line(drill.x0, drill.z1 - 0.15, drill.x1, drill.z1);
line(drill.x0, drill.z0, drill.x0 + 0.15, drill.z1);
line(drill.x1 - 0.15, drill.z0, drill.x1, drill.z1);
line(drill.x0, -5.1, drill.x1, -4.95);
// The flagpole: the campus's centrepiece, on a stone base, with the colours flying.
const pole: V3 = [X(336), 0, Z(752)];
box(pole[0] - 1.6, 0, pole[2] - 1.6, pole[0] + 1.6, 0.5, pole[2] + 1.6, DRESSED);
box(pole[0] - 0.15, 0.5, pole[2] - 0.15, pole[0] + 0.15, 16, pole[2] + 0.15, { material: 'paint_gloss', tint: '#e9e9e4' });
box(pole[0] - 0.25, 16, pole[2] - 0.25, pole[0] + 0.25, 16.4, pole[2] + 0.25, { material: 'brass' });
m.prop('flag', [pole[0] + 0.4, 13.2, pole[2]], 0, 2.2, false);
// The bronze 6-pounder field guns either side of the pole, facing the field.
for (const dz of [-4.2, 4.2]) {
  box(pole[0] - 3.4, 0, pole[2] + dz - 1.3, pole[0] - 1.2, 0.35, pole[2] + dz + 1.3, DRESSED);
  m.prop('cannon', [pole[0] - 2.3, 0.35, pole[2] + dz], -P, 1.1);
  m.prop('cannonballs', [pole[0] - 1.8, 0.35, pole[2] + dz + (dz > 0 ? 1 : -1)], 0, 1);
}
// The Field of Flags: a ring of flags round the parade ground.
for (let i = 0; i < 24; i++) {
  const a = (i / 24) * Math.PI * 2;
  m.prop('flag', [pole[0] + Math.cos(a) * 16, 0, pole[2] + Math.sin(a) * 16], a, 1, false);
}
// Volleyball court: sand and a net.
slab(R(88, 922, 148, 1020), 0, 0.06, { material: 'pbr_sand' });
box(X(88), 0, Z(971) - 0.05, X(148), 2.4, Z(971) + 0.05, { material: 'grate' });

// ---------------------------------------------------------------- Hazelwood and Scott Johnston halls

const hzAll = R(175, 965, 388, 1048);
const hazelwood: Rect = { ...hzAll, x1: -66 };
const scottJ: Rect = { ...hzAll, x0: -66 };
hall(hazelwood, { storeys: 2, doors: [['N', 0.2], ['N', 0.85], ['S', 0.5], ['W', 0.5], ['E', 0.5]], upperDoors: [['E', 0.5]], stairs: [hazelwood.x0 + T, hazelwood.z0 + 3.1], roofAccess: true, turrets: ['NW'] });
hall(scottJ, { storeys: 3, doors: [['N', 0.4], ['S', 0.4], ['W', 0.5]], upperDoors: [['W', 0.5]], stairs: [scottJ.x1 - T - 2 * STAIR_W, scottJ.z0 + 3.1], roofAccess: true, turrets: ['NE'], turretRadius: 2.4 });
archway(hazelwood.x0 + (hazelwood.x1 - hazelwood.x0) * 0.85, hazelwood.z1 + 0.35, Math.PI);
archway(scottJ.x0 + (scottJ.x1 - scottJ.x0) * 0.4, scottJ.z1 + 0.35, Math.PI);

// ---------------------------------------------------------------- Victory Memorial Chapel, columbarium, Smythe Hall

const chapel = R(462, 442, 610, 533);
const nave: Rect = { ...chapel, x0: chapel.x0 + 6 };
const NAVE_H = 9;
hall(nave, { storeys: 1, storeyHeight: NAVE_H, doors: [['S', 0.12], ['N', 0.12], ['E', 0.25]], windows: 4 });
steppedRoof(grow(nave, 0.3), NAVE_H + 0.3, 6, 1.1, true, SLATE);
// The tower at the west end, with its twin turrets on the corners.
const chapelTower: Rect = { x0: chapel.x0, x1: chapel.x0 + 6.6, z0: chapel.z0 + 4, z1: chapel.z1 - 4 };
tower(chapelTower, 24);
turret(chapelTower.x0 - 0.4, chapelTower.z0 - 0.4, 1.3, 27);
turret(chapelTower.x0 - 0.4, chapelTower.z1 + 0.4, 1.3, 27);
// Buttresses between the bays, and stained glass high in the side walls.
for (let i = 1; i < 5; i++) {
  const x = nave.x0 + 2 + (i * (nave.x1 - nave.x0 - 3)) / 5 - 0.4;
  box(x, 0, nave.z0 - 0.9, x + 0.8, 7.5, nave.z0, STONE);
  box(x, 0, nave.z1, x + 0.8, 7.5, nave.z1 + 0.9, STONE);
}
lancets('S', nave, nave.x0 + 2, nave.x1 - 1, 5, 3.6, 7.8);
lancets('N', nave, nave.x0 + 2, nave.x1 - 1, 5, 3.6, 7.8);
lancets('E', nave, nave.z0 + 4, nave.z1 - 4, 3, 3.4, 8.2);
// The gallery over the west end: a stair up the south side, a landing and a rail.
const ni = grow(nave, -T);
const gal = 4;
const galRun = flight(ni.x0 + 5, ni.z0 + 2.4, 0.1, 1, DRESSED);
stairwells.push({ x0: galRun.x0 - 0.8, x1: galRun.x1 + 0.8, z0: galRun.z0 - 1, z1: galRun.z1 + 3 });
box(ni.x0, gal, ni.z0, ni.x0 + 5, gal + 0.3, ni.z1, FLOOR);
box(ni.x0 + 5, gal, galRun.z1, galRun.x1, gal + 0.3, galRun.z1 + 2.2, FLOOR);
box(ni.x0 + 5, gal + 0.3, galRun.z1 + 2.2, ni.x0 + 5.2, gal + 1.3, ni.z1, { material: 'dark_wood' });
box(galRun.x1 - 0.2, gal + 0.3, galRun.z1, galRun.x1, gal + 1.3, galRun.z1 + 2.2, { material: 'dark_wood' });
box(ni.x0 + 5.2, gal + 0.3, galRun.z1 + 2, galRun.x1, gal + 1.3, galRun.z1 + 2.2, { material: 'dark_wood' });
// The sanctuary: a raised step, altar, candles and banners.
box(ni.x1 - 4.5, 0.1, ni.z0 + 3, ni.x1, 0.4, ni.z1 - 3, { material: 'marble' });
m.prop('altar', [ni.x1 - 1.6, 0.4, (ni.z0 + ni.z1) / 2], -P, 1.1);
for (const dz of [-2.2, 2.2]) m.prop('candles', [ni.x1 - 1.4, 0.4, (ni.z0 + ni.z1) / 2 + dz], 0, 1.2, false);
m.prop('cross_column', [ni.x1 - 0.6, 0.4, (ni.z0 + ni.z1) / 2], -P, 1.2);
for (const dz of [-1, 1]) m.prop('dg_banner', [ni.x1 - 0.2, 4.5, (ni.z0 + ni.z1) / 2 + dz * 4.5], -P, 1.2, false);
for (let i = 0; i < 3; i++) m.prop('hm_chandelier', [ni.x0 + 9 + i * 5, 7, (ni.z0 + ni.z1) / 2], 0, 1, false);
m.light([ni.x1 - 3, 6, (ni.z0 + ni.z1) / 2], { fixture: 'none', color: '#ffd9a0', intensity: 1.1, range: 14 });
const columbarium = R(472, 533, 585, 565);
box(columbarium.x0, 0, columbarium.z0, columbarium.x1, 2.6, columbarium.z1, DRESSED);
box(columbarium.x0 - 0.2, 2.6, columbarium.z0 - 0.2, columbarium.x1 + 0.2, 3, columbarium.z1 + 0.2, STONE);

const smytheTop = R(635, 503, 750, 560);
const smytheLeg = R(668, 560, 750, 710);
hall(smytheTop, { storeys: 2, doors: [['W', 0.5], ['N', 0.3], ['S', 0.72]], upperDoors: [['S', 0.72]], roofAccess: false, turrets: ['NW'] });
const smytheJoin = (smytheTop.x0 + (smytheTop.x1 - smytheTop.x0) * 0.72 - smytheLeg.x0) / (smytheLeg.x1 - smytheLeg.x0);
hall(smytheLeg, { storeys: 2, doors: [['N', smytheJoin], ['S', 0.5], ['W', 0.3], ['W', 0.75]], upperDoors: [['N', smytheJoin]], stairs: [smytheLeg.x0 + T, smytheLeg.z0 + 3.1], roofAccess: true });
archway(smytheLeg.x0 - 0.35, smytheLeg.z0 + (smytheLeg.z1 - smytheLeg.z0) * 0.75, -P);

// ---------------------------------------------------------------- the Welles-DeKoven range and the Knight block

const dekoven = R(673, 770, 757, 965);
hall(dekoven, { storeys: 4, doors: [['W', 0.5], ['W', 0.85], ['E', 0.5], ['N', 0.5], ['S', 0.5]], upperDoors: [['S', 0.5]], stairs: [dekoven.x0 + T, dekoven.z0 + 3.1], roofAccess: true, turrets: ['NW', 'NE'], turretRadius: 2.2 });
// The entrance bay facing the flagpole: piers either side of the arched door, rising past the parapet.
const dkMid = (dekoven.z0 + dekoven.z1) / 2;
for (const dz of [-2.4, 1.6]) box(dekoven.x0 - 1.2, 0, dkMid + dz, dekoven.x0, 18.4, dkMid + dz + 0.8, STONE);
box(dekoven.x0 - 1.2, 3.6, dkMid - 1.6, dekoven.x0, 18.4, dkMid + 1.6, STONE);
battlements({ x0: dekoven.x0 - 1.4, x1: dekoven.x0 + 0.6, z0: dkMid - 2.6, z1: dkMid + 2.6 }, 18.4, DRESSED, 0.4, 0.7, 1.6);
archway(dekoven.x0 - 1.5, dkMid, -P, 1.1);
box(dekoven.x0 - 1.25, 12, dkMid - 1, dekoven.x0 - 1.2, 14.4, dkMid + 1, { material: 'light_strip', tint: GLASS[0] });

const welles = R(638, 965, 757, 1048);
const wellesN = (dekoven.x0 + dekoven.x1) / 2;
hall(welles, { storeys: 2, doors: [['N', (wellesN - welles.x0) / (welles.x1 - welles.x0)], ['W', 0.88], ['S', 0.6]], upperDoors: [['N', (wellesN - welles.x0) / (welles.x1 - welles.x0)]], windows: 3.6, stairs: [welles.x0 + T, welles.z0 + 3.1] });
// The clock tower: square, rising high over the junction with DeKoven.
const clock: Rect = { x0: welles.x0, x1: welles.x0 + 6.4, z0: welles.z1, z1: welles.z1 + 6.4 };
tower(clock, 23);
for (const [x, z, alongX] of [[(clock.x0 + clock.x1) / 2, clock.z1 + 0.06, true], [clock.x0 - 0.06, (clock.z0 + clock.z1) / 2, false]] as const) {
  const face = (s: number, mat: Mat, d: number, yaw = 0) => m.block(alongX ? [x, 17.4 - s / 2 + 1, z + d] : [x - d, 17.4 - s / 2 + 1, z], alongX ? [s, s, 0.2] : [0.2, s, s], 'solid', { ...mat, yaw });
  face(2.6, { material: 'paint_gloss', tint: '#f2efe4' }, 0);
  box(alongX ? x - 0.08 : x - 0.18, 18.3, alongX ? z : z - 0.08, alongX ? x + 0.08 : x - 0.04, 19.3, alongX ? z + 0.2 : z + 0.08, { material: 'dark_wood' });
  box(alongX ? x : x - 0.18, 18.32, alongX ? z : z - 0.75, alongX ? x + 0.75 : x - 0.04, 18.44, alongX ? z + 0.2 : z, { material: 'dark_wood' });
}

const cord = R(458, 965, 613, 1048);
hall(cord, { storeys: 3, doors: [['N', 0.3], ['N', 0.75], ['S', 0.5], ['E', 0.5]], stairs: [cord.x1 - T - 2 * STAIR_W, cord.z0 + 3.1], roofAccess: false, mat: FIELDSTONE });
// The entrance tower on its south-west corner.
tower({ x0: cord.x0 - 6, x1: cord.x0, z0: cord.z0 - 1.2, z1: cord.z0 + 4.8 }, 16, FIELDSTONE);
// The Argonne Gate (1940): a castellated arch across the walk between Knight (Cord) and Welles.
const gate: Rect = { x0: cord.x1, x1: welles.x0, z0: cord.z0 + 1, z1: cord.z0 + 3 };
box(gate.x0 - 0.6, 3.6, gate.z0, gate.x1 + 0.6, 5.2, gate.z1, STONE);
battlements({ x0: gate.x0 - 0.8, x1: gate.x1 + 0.8, z0: gate.z0 - 0.2, z1: gate.z1 + 0.2 }, 5.2, DRESSED, 0.5, 0.7, 1.6);
archway((gate.x0 + gate.x1) / 2, gate.z0 - 0.35, 0, 0.95);

// The beacon: a lamp column at the crossing.
box(X(693) - 0.5, 0, Z(740) - 0.5, X(693) + 0.5, 4, Z(740) + 0.5, DRESSED);
box(X(693) - 0.7, 4, Z(740) - 0.7, X(693) + 0.7, 4.8, Z(740) + 0.7, { material: 'light_strip', tint: '#ffd68a' });

// ---------------------------------------------------------------- Memorial Hall (1893): Shingle style

const memorial = R(458, 852, 537, 950);
hall(memorial, { storeys: 1, storeyHeight: 6, doors: [['E', 0.5], ['W', 0.5], ['N', 0.5]], windows: 4, mat: SHINGLE, parapet: false });
// A stone base course, a steep shingled roof and the two round towers with their conical caps.
box(memorial.x0 - 0.2, 0, memorial.z0 - 0.2, memorial.x1 + 0.2, 1, memorial.z0, FIELDSTONE);
steppedRoof(grow(memorial, 0.5), 6.3, 7, 0.9, false, { material: 'pbr_roof', tint: '#5b4436' });
for (const z of [memorial.z0 + 1.2, memorial.z1 - 1.2]) {
  octagon(memorial.x0 - 1.8, z, 2.4, 0, 9, SHINGLE);
  octagon(memorial.x0 - 1.8, z, 2.5, 0, 1, FIELDSTONE);
  cap(memorial.x0 - 1.8, z, 2.7, 9, 5, { material: 'pbr_roof', tint: '#4b3a30' });
}

// ---------------------------------------------------------------- Farrand Gymnasium and Gerber Pool

const gym = R(828, 584, 1094, 703);
const gymNotch = R(1022, 555, 1094, 584);
hall(gym, { storeys: 1, storeyHeight: 9, doors: [['S', 0.25], ['S', 0.6], ['W', 0.25], ['N', 0.3]], windows: 6, mat: { material: 'pbr_brick_old', tint: '#b9aa95' } });
box(gymNotch.x0, 0, gymNotch.z0, gymNotch.x1, 7, gymNotch.z1, STONE);
battlements(gymNotch, 7);
// Gerber pool at the east end: a raised deck round the water.
const pool: Rect = { x0: X(1022), x1: gym.x1 - 2, z0: gym.z0 + 3, z1: gym.z1 - 3 };
for (const part of minus({ x0: pool.x0 - 2, x1: gym.x1 - T, z0: pool.z0 - 1.5, z1: pool.z1 + 1.5 }, pool)) slab(part, 0, 1.4, { material: 'white_tiles' });
m.water([(pool.x0 + pool.x1) / 2, 0, (pool.z0 + pool.z1) / 2], [pool.x1 - pool.x0, 1.3, pool.z1 - pool.z0]);
// Lane lines on the pool floor.
for (let i = 1; i < 4; i++) box(pool.x0 + 1, 0, pool.z0 + (i * (pool.z1 - pool.z0)) / 4 - 0.1, pool.x1 - 1, 0.03, pool.z0 + (i * (pool.z1 - pool.z0)) / 4 + 0.1, { material: 'paint_matte', tint: '#24407a' });
// Ways out of the water: steps up the west end, a ladder at the east end.
const poolMid = (pool.z0 + pool.z1) / 2;
for (let i = 0; i < 6; i++) box(pool.x0 + i * 0.5, 0, poolMid - 1.5, pool.x0 + (i + 1) * 0.5, 1.4 - i * (1.1 / 6), poolMid + 1.5, { material: 'white_tiles' });
m.add({ kind: 'ladder', position: [pool.x1, 0.1, poolMid], yaw: -P, height: 1.3, width: 1 });
// Steps up to the deck from the gym floor.
for (let i = 0; i < 6; i++) box(pool.x0 - 2 - (6 - i) * 0.5, 0, pool.z1 - 4, pool.x0 - 2 - (5 - i) * 0.5, (i + 1) * (1.4 / 6), pool.z1 - 1, { material: 'white_tiles' });
// The basketball court: maple floor, lines, a hoop at each end, bleachers along the north wall.
const court: Rect = { x0: gym.x0 + 2.5, x1: pool.x0 - 5, z0: gym.z0 + 3, z1: gym.z1 - 5 };
slab(court, 0.1, 0.12, { material: 'pbr_floorboards', tint: '#d9b27c' });
const cl = { material: 'paint_matte', tint: '#f4f1ea' };
box(court.x0, 0.12, court.z0, court.x1, 0.13, court.z0 + 0.1, cl);
box(court.x0, 0.12, court.z1 - 0.1, court.x1, 0.13, court.z1, cl);
box(court.x0, 0.12, court.z0, court.x0 + 0.1, 0.13, court.z1, cl);
box(court.x1 - 0.1, 0.12, court.z0, court.x1, 0.13, court.z1, cl);
const courtMid = (court.x0 + court.x1) / 2;
const courtZ = (court.z0 + court.z1) / 2;
box(courtMid - 0.05, 0.12, court.z0, courtMid + 0.05, 0.13, court.z1, cl);
for (const [x, s] of [[court.x0, 1], [court.x1, -1]] as const) {
  box(Math.min(x, x + s * 5.8), 0.125, courtZ - 2.45, Math.max(x, x + s * 5.8), 0.135, courtZ + 2.45, { material: 'paint_matte', tint: '#8a2f2f' });
  // Post, backboard and rim.
  box(x - s * 0.9 - 0.12, 0.12, courtZ - 0.12, x - s * 0.9 + 0.12, 3.95, courtZ + 0.12, { material: 'steel_plate' });
  box(Math.min(x - s * 0.9, x + s * 0.3), 3.6, courtZ - 0.1, Math.max(x - s * 0.9, x + s * 0.3), 3.75, courtZ + 0.1, { material: 'steel_plate' });
  box(x + s * 0.3 - 0.05, 2.9, courtZ - 0.9, x + s * 0.3 + 0.05, 3.95, courtZ + 0.9, { material: 'paint_gloss', tint: '#f6f6f2' });
  box(Math.min(x + s * 0.35, x + s * 0.8), 3.05, courtZ - 0.25, Math.max(x + s * 0.35, x + s * 0.8), 3.1, courtZ + 0.25, { material: 'paint_gloss', tint: '#d4572a' });
}
// (in two runs either side of the north door)
const gymN = gym.x0 + (gym.x1 - gym.x0) * 0.3;
for (const [a, b] of [[court.x0 + 1, gymN - 2], [gymN + 2, court.x1 - 1]] as const)
  for (let i = 0; i < 3; i++) box(a, 0.1, gym.z1 - T - 3 + i, b, 0.1 + (i + 1) * 0.4, gym.z1 - T - 2 + i, { material: 'pbr_planks', tint: '#a07a4e' });
for (const [x, z] of [[gym.x0 + 12, gym.z0 + 6], [gym.x0 + 28, gym.z0 + 6], [gym.x0 + 12, gym.z1 - 8], [gym.x0 + 28, gym.z1 - 8]] as const)
  m.light([x, 8.4, z], { fixture: 'bulb', color: '#f2f6ff', intensity: 1, range: 14 });

// ---------------------------------------------------------------- St. John Chrysostom church, rectory and churchyard

const church = R(823, 897, 1040, 995);
const churchNave: Rect = { x0: church.x0 + 6, x1: church.x1 - 4, z0: church.z0 + 2, z1: church.z1 - 2 };
const siding = { material: 'paint_matte', tint: '#a63a2d' }; // red-painted board and batten
hall(churchNave, { storeys: 1, storeyHeight: 5, doors: [['W', 0.5], ['S', 0.3]], windows: 3, mat: siding, parapet: false });
steppedRoof(grow(churchNave, 0.5), 5.3, 8, 0.95, true, { material: 'dark_wood' });
// The detached bell tower west of the church: board and batten, an open belfry under a small gable.
const belfry: Rect = { x0: church.x0 - 2.5, x1: church.x0 + 1.5, z0: (church.z0 + church.z1) / 2 - 2, z1: (church.z0 + church.z1) / 2 + 2 };
box(belfry.x0, 0, belfry.z0, belfry.x1, 7, belfry.z1, siding);
for (const [x, z] of [[belfry.x0, belfry.z0], [belfry.x1 - 0.4, belfry.z0], [belfry.x0, belfry.z1 - 0.4], [belfry.x1 - 0.4, belfry.z1 - 0.4]] as const) box(x, 7, z, x + 0.4, 9.4, z + 0.4, siding);
steppedRoof(grow(belfry, 0.4), 9.4, 4, 0.7, false, { material: 'dark_wood' });
const cn = grow(churchNave, -T);
m.light([cn.x1 - 3, 4, (cn.z0 + cn.z1) / 2], { fixture: 'bulb', color: '#ffd9a0', intensity: 0.9, range: 12 });
// The rectory (1857), on Exeter Street.
const rectory = R(1040, 1015, 1117, 1048);
box(rectory.x0, 0, rectory.z0, rectory.x1, 4.5, rectory.z1, { material: 'paint_matte', tint: '#e7e0cf' });
steppedRoof(grow(rectory, 0.4), 4.5, 4, 0.8, true, { material: 'pbr_roof', tint: '#4d5560' });
box(rectory.x0 + 2, 0, rectory.z0 - 1.6, rectory.x0 + 6, 0.4, rectory.z0, { material: 'oak_planks' });

// ---------------------------------------------------------------- south of Exeter Street

const staffParking = R(96, 1135, 252, 1242);
slab(staffParking, 0, 0.12, ASPHALT);
for (let x = staffParking.x0 + 1; x < staffParking.x1 - 2; x += 3.2) box(x, 0.12, staffParking.z1 - 5.5, x + 0.15, 0.14, staffParking.z1 - 0.5, PAINT);

// Mouso Hall Student Center.
const mousoA = R(280, 1163, 315, 1228);
const mousoB = R(280, 1228, 380, 1280);
hall(mousoB, { storeys: 1, storeyHeight: 5, doors: [['N', 0.7], ['S', 0.5]], windows: 4 });
box(mousoA.x0, 0, mousoA.z0, mousoA.x1, 5, mousoA.z1, STONE);
battlements(mousoA, 5, DRESSED, 0.5, 0.6, 2.2);

const facilities = R(207, 1290, 350, 1340);
hall(facilities, { storeys: 1, storeyHeight: 6, doors: [['N', 0.25], ['N', 0.7], ['E', 0.5]], windows: 0, mat: { material: 'pbr_corrugated', tint: '#7f8a86' }, parapet: false });
for (let i = 0; i < 4; i++) m.prop('cargo_crate', [facilities.x0 + 4 + i * 5, 0.1, facilities.z0 + 2.5], 0, 1);

const infirmary = R(418, 1176, 600, 1242);
hall(infirmary, { storeys: 1, storeyHeight: 5, doors: [['N', 0.5], ['W', 0.5], ['E', 0.5]], turrets: ['NW'] });
const store = R(510, 1242, 600, 1295);
hall(store, { storeys: 1, storeyHeight: 4.5, doors: [['W', 0.5], ['E', 0.5]], windows: 4 });
m.prop('checkout', [store.x0 + 4, 0.1, store.z1 - 3], 0, 1).prop('shelf_boxes', [store.x0 + 9, 0.1, store.z0 + 3], 0, 1).prop('shelf_bags', [store.x0 + 13, 0.1, store.z0 + 3], 0, 1);

// Tennis courts: green hard courts, nets and a tall wire fence (bullets go through, players don't).
const tennis = R(625, 1142, 742, 1225);
slab(tennis, 0, 0.08, { material: 'paint_matte', tint: '#3f7a52' });
for (const zc of [tennis.z0 + (tennis.z1 - tennis.z0) * 0.25, tennis.z0 + (tennis.z1 - tennis.z0) * 0.75]) box(tennis.x0 + 2, 0.08, zc - 0.05, tennis.x1 - 2, 1, zc + 0.05, { material: 'grate' });
box(tennis.x0, 0, tennis.z0, tennis.x1, 3.5, tennis.z0 + 0.1, { material: 'grate' });
box(tennis.x0, 0, tennis.z1 - 0.1, tennis.x1, 3.5, tennis.z1, { material: 'grate' });
box(tennis.x0, 0, tennis.z0 + 0.1, tennis.x0 + 0.1, 3.5, tennis.z1 - 0.1, { material: 'grate' });
box(tennis.x1 - 0.1, 0, tennis.z0 + 4, tennis.x1, 3.5, tennis.z1 - 0.1, { material: 'grate' });

const postOffice = R(900, 1184, 1040, 1250);
hall(postOffice, { storeys: 1, storeyHeight: 5, doors: [['N', 0.5], ['W', 0.5]], windows: 4, mat: { material: 'pbr_brick_red' }, parapet: false });
steppedRoof(grow(postOffice, 0.3), 5.3, 3, 0.8, true, { material: 'pbr_roof' });

// ---------------------------------------------------------------- the Cyril W. Nave Gateway on St. John's Road

for (const z of [58.2, 69.8]) {
  box(96.4, 0, z, 99.2, 6.4, z + 2, STONE);
  battlements({ x0: 96.2, x1: 99.4, z0: z - 0.2, z1: z + 2.2 }, 6.4, DRESSED, 0.3, 0.6, 1.2);
}
box(97.6, 5.2, 60.2, 98, 5.6, 69.8, { material: 'paint_gloss', tint: '#1d1f22' });
box(97.65, 4.2, 62.5, 97.95, 5.2, 67.5, { material: 'paint_gloss', tint: '#1d1f22' });
box(97.55, 4.4, 64.4, 98.05, 5, 65.6, { material: 'brass' });

// ---------------------------------------------------------------- Lake Nagawicka, across Genesee Street

const WATER = -0.5;
/** The shoreline: where the bank meets the water, wavering a little. */
const shoreX = (z: number) => 120 + 2.5 * Math.sin(z / 19) + 1.5 * Math.cos(z / 7.3);
// The lake runs on past the map's edges, so it reads as open water.
m.water([150, -3.6, -4], [68, WATER + 3.6, 400]);
// A gravel walk along the top of the bank.
slab({ x0: 110.4, x1: 112.4, z0: -136, z1: 126 }, -0.1, 0.06, { material: 'pbr_gravel' });
// The boathouse on the shore and the dock running out from it.
const boathouse: Rect = { x0: 112.8, x1: 119.2, z0: 10, z1: 19 };
hall(boathouse, { storeys: 1, storeyHeight: 4, doors: [['W', 0.5], ['E', 0.5]], windows: 3, mat: { material: 'paint_matte', tint: '#ece8dc' }, parapet: false });
steppedRoof(grow(boathouse, 0.4), 4.3, 4, 0.7, false, { material: 'pbr_roof', tint: '#2f4a3c' });
const dock: Rect = { x0: boathouse.x1 - T, x1: 136, z0: 13.2, z1: 15.8 };
slab(dock, -0.1, 0.12, { material: 'oak_planks' });
slab({ x0: 132, x1: 136, z0: 15.8, z1: 20 }, -0.1, 0.12, { material: 'oak_planks' });
for (let x = dock.x0 + 2; x <= dock.x1; x += 4) for (const z of [dock.z0 - 0.1, dock.z1 - 0.2]) box(x, -3.5, z, x + 0.3, 0.12, z + 0.3, { material: 'dark_wood' });
for (const [x, z, yaw] of [[126, 17.2, 0.1], [130, 11, -0.2], [139, 18, 1.2]] as const) m.prop('rowboat', [x, WATER - 0.05, z], yaw, 1.3, false);

// ---------------------------------------------------------------- private homes along Wisconsin Avenue

const houseCols = [[98, 202, 306], [465, 569, 673], [828, 932, 1036]];
const houseRows = [143, 294];
const facades: Mat[] = [{ material: 'pbr_plaster_white', tint: '#ece6d8' }, { material: 'pbr_brick_red' }, { material: 'pbr_plaster_white', tint: '#b7c4c9' }, { material: 'pbr_plaster_white', tint: '#d8c49a' }, STONE];
const yards: Rect[] = [];
let h = 0;
for (let b = 0; b < 3; b++)
  for (const py of houseRows)
    for (let c = 0; c < 3; c++) {
      if (b === 2 && py === 294 && c === 2) continue; // an empty lot
      const px = houseCols[b]![c]!;
      const lot = R(px, py, px + 76, py + 76);
      yards.push(lot);
      const president = b === 2 && py === 294 && c === 0;
      const inset = president ? 0.8 : 2;
      const house: Rect = { x0: lot.x0 + inset, x1: lot.x1 - inset, z0: lot.z0 + inset + 1, z1: lot.z1 - inset };
      const facade = president ? STONE : facades[h++ % facades.length]!;
      box(house.x0, 0, house.z0, house.x1, 6, house.z1, facade);
      if (president) battlements(house, 6);
      else steppedRoof(grow(house, 0.4), 6, 4, 0.75, true, { material: 'pbr_roof', tint: h % 2 ? '#5d4a3e' : '#4d5560' });
      // A porch and a tree in the yard.
      box(house.x0 + 2, 0, house.z0 - 1.6, house.x0 + 5, 0.4, house.z0, { material: 'oak_planks' });
      m.prop(h % 2 ? 'oak' : 'nt_common_tree', [lot.x1 - 1.5, 0, lot.z0 + 1], h, 0.9);
    }

// ---------------------------------------------------------------- street trees and lamps

const treeKinds = ['oak', 'nt_common_tree', 'tree_detailed', 'oak_dark', 'nt_common_tree_2', 'tree_round'];
let t = 0;
const tree = (x: number, z: number, kinds = treeKinds) => m.prop(kinds[t++ % kinds.length]!, [x, 0, z], t * 1.7, 0.9 + (t % 3) * 0.12);
for (let x = -100; x <= 96; x += 14) tree(x, 116.5); // Wisconsin Avenue
for (let z = -60; z <= 58; z += 13) tree(-106.5, z); // Spanjer Street, by the field
for (let x = 42; x <= 96; x += 12) tree(x, 3.5); // Church Street
for (let x = 44; x <= 96; x += 13) tree(x, -24); // by the church
for (const [x, z] of [[-30, 26], [-8, 26], [-34, 4], [-20, -14], [0, -14], [-4, -42], [44, 50], [70, 40], [96, 50]] as const) tree(x, z);
// Evergreens in the churchyard.
for (const [x, z] of [[38, -60], [86, -40], [99, -52]] as const) tree(x, z, ['pine_round', 'pine']);
for (let x = -96; x <= 92; x += 24) m.prop('lantern_post', [x, 0, -69.5], 0, 1); // Exeter Street
for (let z = -114; z <= 102; z += 24) m.prop('lightpost', [100, 0, z], P, 1); // Genesee Street

// The old churchyard: rows of headstones south and east of the church, iron railings along Exeter Street.
const stones = ['gravestone_round', 'gravestone_cross', 'gravestone_round', 'gravestone_broken'];
let n = 0;
for (let x = 42; x <= 80; x += 3.4) for (const z of [-58, -62]) m.prop(stones[n++ % stones.length]!, [x, 0, z], Math.PI + (n % 5) * 0.04, 1);
for (let x = 88; x <= 98; x += 3.4) for (let z = -50; z <= -34; z += 4) m.prop(stones[n++ % stones.length]!, [x, 0, z], -P, 1);
m.prop('obelisk', [62, 0, -55], 0, 1).prop('obelisk', [93, 0, -42], 0, 0.9);
for (let x = 39; x <= 82; x += 1.82) m.prop('iron_fence', [x + 0.91, 0, -65.6], 0, 1);

// ---------------------------------------------------------------- vehicles and guns

m.mount('buggy', [staffParking.x0 + 8, 0.12, staffParking.z0 + 6], P);
m.mount('buggy', [staffParking.x0 + 16, 0.12, staffParking.z0 + 6], P);
m.mount('hauler', [32.8, 0.12, 40], 0);
m.mount('buggy', [32.8, 0.12, -40], Math.PI);
m.mount('speeder', [-60, 0.12, 123], P);
m.mount('turret_mg', [dekoven.x0 + 3, 16.3, dkMid + 6], -P);

m.pickup('weapon_sniper', [dekoven.x1 - 3, 16.3, dekoven.z1 - 4]).pickup('ammo_sniper', [dekoven.x1 - 3, 16.3, dekoven.z0 + 4]);
m.pickup('weapon_railgun', [smytheLeg.x0 + 4, 4.3, smytheLeg.z1 - 3]).pickup('ammo_cells', [smytheLeg.x1 - 3, 4.3, smytheLeg.z0 + 4]);
m.pickup('weapon_rockets', mid(nave)).pickup('ammo_explosive', [ni.x0 + 2, gal + 0.3, ni.z1 - 2]);
m.pickup('weapon_shotgun', [gym.x0 + 6, 0.12, courtZ + 4]).pickup('armor_large', [courtMid, 0.12, courtZ]);
m.pickup('powerup_damage', [pool.x0 - 1, 1.4, (pool.z0 + pool.z1) / 2], 90);
m.pickup('weapon_rifle', [hazelwood.x1 - 4, 0.1, (hazelwood.z0 + hazelwood.z1) / 2]).pickup('weapon_marksman', [scottJ.x0 + 4, 12.3, scottJ.z1 - 3]);
m.pickup('weapon_smg', mid(memorial)).pickup('health_large', [memorial.x1 - 2, 0.1, memorial.z0 + 2]);
m.pickup('weapon_burst_rifle', [welles.x0 + 12, 0.1, welles.z1 - 2]).pickup('health_small', [welles.x1 - 2, 0.1, welles.z1 - 2]);
m.pickup('weapon_auto_shotgun', mid(churchNave));
m.pickup('health_large', mid(infirmary)).pickup('health_small', [infirmary.x1 - 2, 0.1, infirmary.z1 - 2]);
m.pickup('weapon_lmg', mid(store));
m.pickup('weapon_launcher', mid(postOffice)).pickup('ammo_explosive', mid(facilities));
m.pickup('grenades', [-96, 0, 20]).pickup('grenades', [-96, 0, -30]).pickup('armor_small', [pole[0] + 2.5, 0.5, pole[2]]);
m.pickup('ammo_rifle', [cord.x0 + 3, 0.1, cord.z1 - 2]).pickup('ammo_rifle', [dekoven.x0 + 2, 4.3, dekoven.z1 - 4]).pickup('armor_small', [-10, 0.12, -3]);
m.pickup('ammo_shells', [60, 0.12, -3]).pickup('ammo', [32.8, 0.12, 0]).pickup('health_small', [-40, 0, 40]);
m.pickup('health_small', mid(boathouse)).pickup('ammo_rifle', [dock.x1 - 1, 0.12, (dock.z0 + dock.z1) / 2]);

// ---------------------------------------------------------------- spawns, flags and hills

for (const [x, z, yaw] of [[-96, 10, P], [-96, -20, P], [-88, 34, P], [-88, -44, P], [-80, -6, P], [-68, -30, P], [-68, 18, P], [-75, -56, 0], [-60, -56, 0], [-100, 48, P], [-90, -88, 0], [-60, 50, P]] as const) m.spawn([x, 0, z], yaw, west);
for (const [x, z, yaw] of [[48, -12, -P], [64, -14, -P], [80, -16, -P], [96, -12, -P], [96, 12, -P], [96, 36, -P], [56, 44, Math.PI], [80, 46, Math.PI], [94, -68, -P], [60, -86, 0], [44, -30, -P], [98, -30, -P]] as const) m.spawn([x, 0, z], yaw, east);
for (const [x, z, yaw] of [[-20, 50, 0], [10, 50, Math.PI], [-50, 90, 0], [0, 90, 0], [60, 90, Math.PI], [-80, 90, 0], [-20, -20, 0], [-2, -58, 0], [-30, -95, 0], [40, -95, P], [80, -120, 0], [-100, -120, P], [-50, -125, 0], [20, -130, 0], [-10, 30, 0], [111.4, -40, -P], [111.4, 40, -P]] as const) m.spawn([x, 0, z], yaw);

m.flag(west, [pole[0] + 4, 0, pole[2]], P).flag(east, [68, 0.12, -3], -P);
m.hill([X(693), 0.12, Z(740) - 3], 5).hill([pole[0], 0, pole[2] + 8], 6).hill([-8, 0, -30], 5);

// ---------------------------------------------------------------- interiors (after the spawns and pickups, which they keep clear of)

m.bounds('invisible', 3, { min: [-124, -138], max: [150, 130] });
(m as unknown as { flush(): void }).flush();
marks = m.doc.entities.filter((e) => ['spawn', 'pickup', 'flag', 'hill', 'mount', 'ladder'].includes(e.kind)).map((e) => e.position as V3);

// Hazelwood: a classroom below, barracks above. Scott Johnston: barracks rooms on all three floors.
classroom({ ...hazelwood, x0: hazelwood.x0 + 7 }, floorY(0), 'E', 3, 3);
barracks(hazelwood, floorY(1), true);
for (let s = 0; s < 3; s++) barracks({ ...scottJ, x1: scottJ.x1 - 6 }, floorY(s), false);
// The chapel: pews either side of the aisle, facing the altar.
for (let i = 0; i < 4; i++) for (const dz of [-3.1, 3.1]) put('stall_bench', ni.x0 + 8.6 + i * 2.2, 0.1, (ni.z0 + ni.z1) / 2 + dz, 0, 1.15);
for (let i = 0; i < 3; i++) put('stall_bench', ni.x0 + 1.4 + i * 1.3, gal + 0.3, (ni.z0 + ni.z1) / 2 - 4.5, 0, 1);
// St. John Chrysostom: pews and the altar.
for (let i = 0; i < 7; i++) for (const dz of [-2.6, 2.6]) put('stall_bench', cn.x0 + 5 + i * 3.2, 0.1, (cn.z0 + cn.z1) / 2 + dz, 0, 1);
put('altar', cn.x1 - 1.4, 0.1, (cn.z0 + cn.z1) / 2, -P, 1);
// Smythe: dorm rooms (beds, desks, wardrobes) on both floors; the study with the railgun upstairs.
for (const s of [0, 1]) {
  const y = floorY(s);
  for (let i = 0; i < 5; i++) {
    const z = smytheLeg.z0 + 13 + i * 3.4;
    put('hm_bed_single', smytheLeg.x1 - 2, y, z, -P, 1);
    put('hm_nightstand', smytheLeg.x1 - 1, y, z + 1.6, -P, 0.8);
  }
  for (let i = 0; i < 4; i++) put('hm_bed_single', smytheTop.x0 + 3 + i * 4.4, y, smytheTop.z1 - 2, Math.PI, 1);
  put('hm_desk_lamp', smytheTop.x1 - 3, y, smytheTop.z0 + 2, 0, 1, false);
}
put('desk', smytheLeg.x0 + 6, 4.3, smytheLeg.z1 - 4, 0, 1);
put('bookcase', smytheLeg.x1 - 1.2, 4.3, smytheLeg.z1 - 6, -P, 1);
put('hm_chair_office', smytheLeg.x0 + 6, 4.3, smytheLeg.z1 - 4.9, Math.PI, 1);
// DeKoven: reception and a lounge on the ground floor, barracks on the three floors above.
const dk = grow(dekoven, -T);
put('desk_corner', dk.x0 + 2.4, 0.1, dkMid + 4, P, 1);
put('office_chair', dk.x0 + 3.6, 0.1, dkMid + 4, -P, 1);
put('hm_fireplace', dk.x1 - 0.4, 0.1, dkMid + 8, -P, 1.2);
put('hm_couch_large', dk.x1 - 3.6, 0.1, dkMid + 8, P, 1);
put('hm_armchair', dk.x1 - 2.4, 0.1, dkMid + 5.4, Math.PI, 1);
put('hm_rug_round', dk.x1 - 4, 0.1, dkMid + 8, 0, 0.8, false);
put('hm_potted_palm', dk.x0 + 1.2, 0.1, dkMid - 3.5, 0, 0.8);
for (const [x, z] of [[dk.x0 + 1, dk.z1 - 1], [dk.x1 - 1, dk.z1 - 1]] as const) put('hm_houseplant_tall', x, 0.1, z, 0, 1);
for (const s of [1, 2, 3]) barracks({ ...dekoven, z0: dekoven.z0 + 14 }, floorY(s), false);
// Welles: the refectory (long tables, chairs, banners and chandeliers), barracks above.
const wl = grow(welles, -T);
for (let i = 0; i < 4; i++)
  for (const z of [wl.z0 + 3.4, wl.z0 + 9]) {
    const x = wl.x0 + 9 + i * 3.8;
    put('dg_table_long', x, 0.1, z, 0, 1);
    for (const dz of [-0.9, 0.9]) for (const s of [-1, 1]) put('hm_chair_wood', x + s * 1.05, 0.1, z + dz, s > 0 ? -P : P, 1);
  }
for (const x of [wl.x0 + 11, wl.x0 + 18]) m.prop('hm_chandelier', [x, 3.1, (wl.z0 + wl.z1) / 2], 0, 0.8, false);
for (const x of [wl.x0 + 7, wl.x0 + 11, wl.x0 + 21]) m.prop('dg_banner', [x, 1.4, wl.z0 + 0.15], 0, 1, false);
barracks({ ...welles, x0: welles.x0 + 6 }, floorY(1), true);
// The Knight / Stangeland Cord block: classrooms on every floor.
for (const s of [0, 1, 2]) classroom({ ...cord, x1: cord.x1 - 7 }, floorY(s), 'W', 3, 4);
// Memorial Hall: the academy's museum and library under the old gymnasium roof.
for (let i = 0; i < 4; i++) put('bookcase_wide', memorial.x0 + 1.4, 0.1, memorial.z0 + 4 + i * 4, P, 1);
for (let i = 0; i < 2; i++) put('dg_pedestal', memorial.x1 - 3, 0.1, memorial.z0 + 6 + i * 6, 0, 1);
put('hm_table_round', memorial.x0 + 7, 0.1, memorial.z0 + 6, 0, 1);
for (const dz of [-1.2, 1.2]) put('hm_chair_wood', memorial.x0 + 7, 0.1, memorial.z0 + 6 + dz, dz > 0 ? Math.PI : 0, 1);
for (const z of [memorial.z0 + 7, memorial.z1 - 6]) put('dg_banner', memorial.x1 - 0.7, 1.6, z, -P, 1, false);
// Mouso Hall: sofas, a TV and a games table.
put('hm_couch_l', mousoB.x0 + 4, 0.1, mousoB.z0 + 3, 0, 1);
put('tv_cabinet', mousoB.x0 + 4, 0.1, mousoB.z1 - 1.2, Math.PI, 1);
put('hm_table_round', mousoB.x1 - 5, 0.1, (mousoB.z0 + mousoB.z1) / 2, 0, 1);
// The infirmary's beds and the boathouse's boats.
for (let i = 0; i < 5; i++) put('hm_bed_single', infirmary.x0 + 4 + i * 6, 0.1, infirmary.z0 + 2, 0, 1);
put('rowboat', boathouse.x0 + 3.2, 0.1, boathouse.z0 + 2.4, P, 1, false);
put('rowboat', boathouse.x0 + 3.2, 0.1, boathouse.z1 - 2.4, P, 1, false);

// ---------------------------------------------------------------- ground and planting (after the boundary is set)
const sm = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/**
 * Terrain under and round what is built: level within `flat` m of the free
 * blocks and entities (the lake's water excepted), then `shape(x, z, d)`
 * further out (d: metres from the nearest of them). `override` sets the
 * height outright where it returns a number (the lake shore and bed).
 * `cover(x, z, d, h)` gives each terrain cell's ground and plant cover (0–4).
 * Spans [x0, x0 + 320] by [z0, z1].
 */
function sculpt(x0: number, z0: number, z1: number, flat: number, shape: (x: number, z: number, d: number) => number, override: (x: number, z: number) => number | null, cover: (x: number, z: number, d: number, h: number) => [TerrainMaterial, number]): TerrainData {
  const cols = 161;
  const rows = Math.min(161, Math.ceil((z1 - z0) / 2) + 1);
  const rects: [number, number, number, number][] = [];
  const points: [number, number][] = [];
  for (const e of m.doc.entities) {
    if (e.kind === 'water' || e.kind === 'light') continue;
    if (e.kind === 'block') {
      const r = Math.hypot(e.size[0], e.size[2]) / 2;
      rects.push([e.position[0] - r, e.position[2] - r, e.position[0] + r, e.position[2] + r]);
    } else points.push([e.position[0], e.position[2]]);
  }
  const dist = (x: number, z: number) => {
    let d = Infinity;
    for (const [ax, az, bx, bz] of rects) d = Math.min(d, Math.hypot(Math.max(ax - x, 0, x - bx), Math.max(az - z, 0, z - bz)));
    for (const [px, pz] of points) d = Math.min(d, Math.hypot(px - x, pz - z));
    return d;
  };
  const heights: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * 2;
      const z = z0 + r * 2;
      const o = override(x, z);
      const d = o === null ? dist(x, z) : 0;
      const h = o ?? (d <= flat ? 0 : shape(x, z, d));
      heights.push(Math.round(h * 100));
    }
  }
  const t: TerrainData = { origin: [x0, z0], spacing: 2, cols, rows, baseY: 0, heights, materials: [], boundary: true, foliage: [] };
  const materials: number[] = [];
  const foliage: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const x = x0 + c * 2 + 1;
      const z = z0 + r * 2 + 1;
      const d = dist(x, z);
      const [g, f] = cover(x, z, d, terrainHeightAt(t, x, z) ?? 0);
      materials.push(TERRAIN_MATERIALS.indexOf(g));
      foliage.push(d < 2 ? 0 : f);
    }
  }
  const out = paintSlopes({ ...t, materials, foliage }, 38, 'stone');
  m.terrain(out);
  return out;
}
/** What stays clear of dressing: spawns, pickups and objectives (with their radius), doors, buttons, squads, vehicles. */
const KEEP_CLEAR = new Set(['spawn', 'pickup', 'flag', 'hill', 'hostage', 'rescue', 'bombsite', 'zone', 'button', 'door', 'encounter', 'ladder', 'pad', 'mount']);
/** Room for a piece of dressing `r` m round (x, y, z): inside the boundary, clear of the above, other props and free blocks. */
function free(x: number, y: number, z: number, r = 1): boolean {
  const b = m.doc.bounds!;
  if (x < b.min[0] + 0.5 || x > b.max[0] - 0.5 || z < b.min[1] + 0.5 || z > b.max[1] - 0.5) return false;
  return m.doc.entities.every((e) => {
    if (e.kind === 'water' || e.kind === 'light') return true;
    if (Math.abs(e.position[1] - y) > 2.5 && e.kind !== 'zone') return true;
    const d = Math.hypot(e.position[0] - x, e.position[2] - z);
    if (e.kind === 'block') return Math.abs(e.position[0] - x) > e.size[0] / 2 + r || Math.abs(e.position[2] - z) > e.size[2] / 2 + r;
    if (e.kind === 'prop' || e.kind === 'destructible') return d > r + 0.8;
    if (!KEEP_CLEAR.has(e.kind)) return true;
    const reach = e.kind === 'zone' ? Math.max(e.size[0], e.size[2]) / 2 : 'radius' in e && e.kind !== 'encounter' ? e.radius : 1.5;
    return d > reach + r + 1;
  });
}
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let ground: TerrainData | null = null;
const groundY = (x: number, z: number) => (ground ? +(terrainHeightAt(ground, x, z) ?? 0).toFixed(2) : 0);
/** Plant one piece on the ground if there is room; returns whether it went in. */
function plant(model: string, x: number, z: number, o: { yaw?: number; scale?: number; r?: number } = {}): boolean {
  const y = groundY(x, z);
  if (y < WATER + 0.05) return false;
  if (!free(x, y, z, o.r ?? 1)) return false;
  m.prop(model, [+x.toFixed(2), y, +z.toFixed(2)], +(o.yaw ?? rnd() * 6.28).toFixed(2), +(o.scale ?? 0.85 + rnd() * 0.35).toFixed(2));
  // Keep later checks honest: what is planted now counts as taken.
  (m as unknown as { flush(): void }).flush();
  return true;
}
/** A clump of `n` bushes (players can hide in them) round (x, z), `spread` m across. */
function clump(x: number, z: number, n: number, spread: number, kinds: string[]): void {
  for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
    const a = rnd() * 6.28;
    const s = Math.sqrt(rnd()) * spread;
    if (plant(kinds[(i + tries) % kinds.length]!, x + Math.cos(a) * s, z + Math.sin(a) * s, { r: 0.6 })) i++;
  }
}

// The ground: level round every building, road, path and set piece; low swells on the open lawns; and past the
// boundary the wooded hills of the Lake Country, rising to a ridge on three sides. East of Genesee Street the bank
// falls to the shore of Lake Nagawicka, and the lake bed shelves away under the water.
const outside = (x: number, z: number) => Math.hypot(Math.max(-124 - x, 0, x - 150), Math.max(-138 - z, 0, z - 130));
const lakeside = (x: number) => sm(100, 112, x);
const bed = (x: number, z: number): number | null => {
  if (x < 112) return null;
  // The boathouse stands on a level pad at the top of the bank.
  if (x <= boathouse.x1 + 1 && z > boathouse.z0 - 1.5 && z < boathouse.z1 + 1.5) return 0;
  const s = shoreX(z);
  if (x <= s) return (WATER + 0.06) * sm(112, s, x);
  return WATER - 0.04 - 2.9 * sm(s, s + 10, x) + 2.2 * sm(164, 176, x);
};
ground = sculpt(
  -144,
  -160,
  152,
  8,
  (x, z, d) => (1 - lakeside(x)) * (sm(8, 20, d) * (0.7 + 0.5 * Math.sin(x / 9 + 1) * Math.cos(z / 11)) + sm(0, 22, outside(x, z)) * (9 + 3 * Math.sin(x / 17) + 2 * Math.cos(z / 13))),
  bed,
  (x, z, d, h) => {
    if (x > 112) {
      if (h < WATER - 0.1) return ['mud', 0];
      if (h < WATER + 0.25) return ['sand', 0];
      return ['grass', 2];
    }
    if (outside(x, z) > 6) return [h > 10 && Math.sin(x / 5 + z / 6) > 0.4 ? 'moss' : 'grass', 4];
    if (d < 6) return ['grass', 1];
    return [Math.sin(x / 13) * Math.cos(z / 17) > 0.8 ? 'dirt' : 'grass', d > 14 ? 3 : 2];
  },
);
// Hedges and shrubberies by the lawn trees and along the field's tree line: cover on the flanks between the halls.
const SHRUBS = ['nt_bush_leafy', 'nt_bush_berries', 'bush_large', 'bush'];
for (const [x, z] of [[-26, 30], [-12, 22], [-38, 8], [-24, -18], [4, -18], [-8, -46], [48, 54], [74, 36], [92, 54], [-104, 40], [-104, -50], [-104, 2], [46, -20], [86, -20], [60, 8], [-60, -60], [0, -62]] as const) clump(x, z, 3, 3, SHRUBS);
// Along the lake: willows and birches on the bank, reeds at the water's edge, bushes for cover by the walk.
for (let z = -128; z <= 124; z += 11) {
  const s = shoreX(z);
  plant(z % 2 ? 'nt_willow' : 'nt_birch', s - 3 - rnd() * 2, z + rnd() * 4, { r: 1.5 });
  plant('grass_tall', s - 0.4, z + 5, { r: 0.4 });
}
for (const z of [-100, -64, -22, 34, 70, 104]) clump(114, z, 3, 2.5, ['nt_bush_leafy', 'bush_large']);
console.log(`st_johns: ${furnished} pieces of furniture`);
m.meta({
  description:
    "A look-alike of the St. John's Northwestern Military Academy campus in Delafield, Wisconsin, on Lake Nagawicka: grey lannonstone halls built like castles, with towers, turrets and battlements, set in a U round the drill field and its flagpole. Fight through the barracks of DeKoven, Hazelwood and Scott Johnston, the long tables of the Welles refectory under its clock tower, the classrooms of the Knight block and the pews of the Victory Memorial Chapel. Take the sniper rifle from DeKoven's roof, the railgun from upstairs in Smythe, rockets from the chapel and the damage boost from the Gerber pool. The west team holds the drill field and Hazelwood; the east team the gym, the old red church and the lakefront across Genesee Street.",
  modes: ['core.tdm', 'core.deathmatch', 'core.ctf', 'core.koth', 'core.elim'],
  players: [8, 32],
});
await m.save();
