/**
 * St. John's: a look-alike of the St. John's Northwestern Military Academy
 * campus in Delafield, Wisconsin, laid out from the campus map (one image
 * pixel = 0.2 m; north up). The academy's halls are Late Gothic Revival
 * "castles" in grey lannonstone with towers, round corner turrets, Tudor-
 * arched entrances and battlements, most of them in a U round the drill field
 * with the flagpole at its heart; the 1851 board-and-batten St. John
 * Chrysostom church and its old cemetery sit across Church Street.
 *
 * Built from free blocks so the halls read as stone castles:
 *
 *   - DeKoven Hall (three storeys, roof with battlements and a mounted gun),
 *     Smythe Hall (L-shaped, two storeys and roof), Scott Johnston Hazelwood
 *     Hall (two storeys, round turret, roof) and Stangeland Cord Hall are
 *     hollow with floors and switchback stairs; Memorial Hall, Welles Dining
 *     Hall, the infirmary, campus store, post office and facilities are one
 *     big room each.
 *   - Noble Victory Memorial Chapel: a tall nave with pews and a west tower.
 *   - Farrand Gymnasium with the Gerber pool inside.
 *   - The Stangeland Field of Flags and parade field, the flagpole, the two
 *     low stone stands, the volleyball and tennis courts, the parking lots
 *     (with vehicles), and the streets round it all.
 *   - Private houses along Wisconsin Avenue (solid), with the President's house.
 *
 * Team play: the west team holds the parade field and Hazelwood, the east
 * team the gymnasium and the church; the halls in the middle are the fight.
 * Sniper rifle on DeKoven's roof, railgun upstairs in Smythe, rockets in the
 * chapel, damage boost by the pool.
 */
import { newTerrain } from '@chronosplit/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('st_johns', "St. John's");
m.theme('castle');
m.backdrop('cloudy', 'forest', 'grass', 0.4);
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

// ---------------------------------------------------------------- materials

const STONE = { material: 'cobble', tint: '#b9b6ad' }; // lannonstone: grey dolomite
const DRESSED = { material: 'stone_trim', tint: '#c8c4b8' };
const FLOOR = { material: 'pbr_floorboards' };
const ROOF = { material: 'pbr_flagstone' };
const ASPHALT = { material: 'pbr_asphalt' };
const WALK = { material: 'pbr_flagstone', tint: '#a8a49c' };
type Mat = { material: string; tint?: string };

/** A solid box from min to max corner (split into pieces no bigger than blocks allow). */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: Mat, yaw = 0): void {
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  if (w < 0.2 || d < 0.2 || h < 0.1) return;
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

/** A round-ish corner turret (an octagon of two turned blocks) with a crenellated cap. */
function turret(cx: number, cz: number, radius: number, height: number, mat: Mat = STONE): void {
  const s = radius * 2;
  m.block([cx, 0, cz], [s, height, s], 'solid', mat);
  m.block([cx, 0, cz], [s * 0.83, height, s * 0.83], 'solid', { ...mat, yaw: Math.PI / 4 });
  // Corbelled cap and four merlons.
  m.block([cx, height, cz], [s + 0.6, 0.6, s + 0.6], 'solid', DRESSED);
  m.block([cx, height, cz], [(s + 0.6) * 0.83, 0.6, (s + 0.6) * 0.83], 'solid', { ...DRESSED, yaw: Math.PI / 4 });
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) m.block([cx + dx * (radius * 0.8), height + 0.6, cz + dz * (radius * 0.8)], [0.9, 0.8, 0.9], 'solid', DRESSED);
}

interface HallOptions {
  storeys: number;
  storeyHeight?: number;
  /** Doors on the ground floor: side and position along it (0-1). Tudor-arch wide. */
  doors: [Side, number][];
  /** Window spacing in metres (0 = none). */
  windows?: number;
  /** Stairs up through the floors (and onto the roof with `roofAccess`): the stairwell's south-west corner. */
  stairs?: [number, number];
  roofAccess?: boolean;
  mat?: Mat;
  floor?: Mat;
  /** Corner turrets: which corners. */
  turrets?: ('NE' | 'NW' | 'SE' | 'SW')[];
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

/**
 * A hollow Gothic hall: stone walls with windows on every storey, Tudor-arch
 * doors, timber floors, switchback stairs, a flagstone roof inside
 * battlements, and optional corner turrets.
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
      if (s === 0) for (const [ds, at] of o.doors) if (ds === side) openings.push({ at, width: 2.8, bottom: 0, top: 3.1 });
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
    // A string course of dressed stone between storeys, outside.
    if (!top) box(r.x0 - 0.15, s * H - 0.1, r.z0 - 0.15, r.x1 + 0.15, s * H + 0.2, r.z0, DRESSED);
  }
  // Round the roof: battlements.
  battlements(r, o.storeys * H + 0.3);
  // Turrets stand out from the corners (only their inner edge meets the walls), so rooms keep their corners.
  for (const c of o.turrets ?? []) {
    const cx = c.endsWith('E') ? r.x1 + 1.4 : r.x0 - 1.4;
    const cz = c.startsWith('N') ? r.z1 + 1.4 : r.z0 - 1.4;
    turret(cx, cz, 2, o.storeys * H + 3.2);
  }
}

/** A square tower with battlements (solid), `h` metres tall. */
function tower(r: Rect, h: number, mat: Mat = STONE): void {
  box(r.x0, 0, r.z0, r.x1, h, r.z1, mat);
  // Tall lancet windows suggested by dark slots on each face.
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  box(cx - 0.4, h * 0.55, r.z0 - 0.05, cx + 0.4, h * 0.8, r.z0, { material: 'dark_wood' });
  box(cx - 0.4, h * 0.55, r.z1, cx + 0.4, h * 0.8, r.z1 + 0.05, { material: 'dark_wood' });
  box(r.x0 - 0.05, h * 0.55, cz - 0.4, r.x0, h * 0.8, cz + 0.4, { material: 'dark_wood' });
  box(r.x1, h * 0.55, cz - 0.4, r.x1 + 0.05, h * 0.8, cz + 0.4, { material: 'dark_wood' });
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

// ---------------------------------------------------------------- ground and streets

const terrain = newTerrain(320, 2, [-6, -6], 'grass');
m.terrain(terrain);

const road = (r: Rect) => slab(r, 0, 0.12, ASPHALT);
road({ x0: -121, x1: 109, z0: 119.4, z1: 127.4 }); // Wisconsin Avenue
road({ x0: -121, x1: -109, z0: -141, z1: 119.4 }); // Spanjer Street
road({ x0: 101, x1: 109, z0: -141, z1: 119.4 }); // Genesee Street
road({ x0: -109, x1: 101, z0: 61, z1: 69 }); // St. John's Road
road({ x0: -44, x1: -36, z0: 69, z1: 119.4 }); // Smythe Lane
road({ x0: 29, x1: 36.6, z0: 69, z1: 119.4 }); // Farrand Lane
road({ x0: 29, x1: 36.6, z0: -67, z1: 61 }); // Visitor parking
road({ x0: 36.6, x1: 101, z0: -6.6, z1: 0.6 }); // Church Street
road({ x0: -109, x1: 101, z0: -79, z1: -67 }); // Exeter Street
slab({ x0: -36, x1: 29, z0: -6.6, z1: 0.6 }, 0, 0.12, WALK); // the walk past the beacon
// Parking bays marked out along the visitor lot.
for (let z = -60; z < 56; z += 6) box(34.4, 0.12, z, 36.4, 0.14, z + 0.15, { material: 'paint_matte', tint: '#e8e6dc' });

// ---------------------------------------------------------------- Stangeland Field of Flags and the parade field

// The two low stone stands (the brackets on the campus map): cover across the field's west side.
const stand = (x0: number, z0: number, x1: number, z1: number) => {
  box(x0, 0, z0, x1, 1.1, z1, STONE);
  box(x0 - 0.1, 1.1, z0 - 0.1, x1 + 0.1, 1.3, z1 + 0.1, DRESSED);
};
stand(-105, 0.6, -103, 24);
stand(-105, 24, -71.6, 26);
stand(-105, -35, -103, -11.6);
stand(-105, -37, -71.6, -35);
// The flagpole: the campus's centrepiece, on a stone base, with the colours flying.
const pole: V3 = [X(336), 0, Z(752)];
box(pole[0] - 1.6, 0, pole[2] - 1.6, pole[0] + 1.6, 0.5, pole[2] + 1.6, DRESSED);
box(pole[0] - 0.15, 0.5, pole[2] - 0.15, pole[0] + 0.15, 14, pole[2] + 0.15, { material: 'paint_gloss', tint: '#e9e9e4' });
m.prop('flag', [pole[0] + 0.4, 11.5, pole[2]], 0, 2.2, false);
// The Field of Flags: a ring of flags round the parade ground.
for (let i = 0; i < 24; i++) {
  const a = (i / 24) * Math.PI * 2;
  m.prop('flag', [pole[0] + Math.cos(a) * 16, 0, pole[2] + Math.sin(a) * 16], a, 1, false);
}
// Volleyball court: sand and a net.
slab(R(88, 922, 148, 1020), 0, 0.06, { material: 'pbr_sand' });
box(X(88), 0, Z(971) - 0.05, X(148), 2.4, Z(971) + 0.05, { material: 'grate' });

// ---------------------------------------------------------------- Scott Johnston Hazelwood Hall

const hazelwood = R(175, 965, 388, 1048);
hall(hazelwood, { storeys: 2, doors: [['N', 0.5], ['N', 0.15], ['S', 0.5], ['E', 0.5], ['W', 0.5]], stairs: [hazelwood.x0 + T, hazelwood.z0 + 3.1], roofAccess: true, turrets: ['NE', 'NW'] });
tower({ x0: X(260), x1: X(300), z0: hazelwood.z1 - 1, z1: hazelwood.z1 + 4 }, 13);
// Barracks inside: bunks and lockers.
for (let i = 0; i < 6; i++) m.prop('bunk_bed', [hazelwood.x0 + 8 + i * 5, 4.3, hazelwood.z1 - 2], Math.PI, 1);
for (let i = 0; i < 4; i++) m.prop('desk', [hazelwood.x0 + 12 + i * 7, 0.1, hazelwood.z0 + 2], 0, 1);

// ---------------------------------------------------------------- Noble Victory Memorial Chapel, columbarium, Smythe Hall

const chapel = R(462, 442, 610, 533);
const nave: Rect = { ...chapel, x0: chapel.x0 + 6 };
hall(nave, { storeys: 1, storeyHeight: 9, doors: [['S', 0.5], ['E', 0.5]], windows: 4 });
steppedRoof({ x0: nave.x0 - 0.3, x1: nave.x1 + 0.3, z0: nave.z0 - 0.3, z1: nave.z1 + 0.3 }, 9.3, 5, 1.1, true, { material: 'pbr_roof', tint: '#6b6f74' });
tower({ x0: chapel.x0, x1: chapel.x0 + 6.6, z0: chapel.z0 + 4, z1: chapel.z1 - 4 }, 19);
// Pews either side of the aisle, and the altar.
for (let i = 0; i < 6; i++) {
  m.prop('bench', [nave.x0 + 5 + i * 3.4, 0.1, nave.z0 + 3.5], P, 1.2);
  m.prop('bench', [nave.x0 + 5 + i * 3.4, 0.1, nave.z1 - 3.5], P, 1.2);
}
box(nave.x0 + 1.2, 0.1, (nave.z0 + nave.z1) / 2 - 1.5, nave.x0 + 2.7, 1.1, (nave.z0 + nave.z1) / 2 + 1.5, { material: 'marble' });
const columbarium = R(472, 533, 585, 565);
box(columbarium.x0, 0, columbarium.z0, columbarium.x1, 2.6, columbarium.z1, DRESSED);
box(columbarium.x0 - 0.2, 2.6, columbarium.z0 - 0.2, columbarium.x1 + 0.2, 3, columbarium.z1 + 0.2, STONE);

const smytheTop = R(635, 503, 750, 560);
const smytheLeg = R(668, 560, 750, 710);
hall(smytheTop, { storeys: 2, doors: [['W', 0.5], ['N', 0.3], ['S', 0.72]], roofAccess: false, turrets: ['NW'] });
hall(smytheLeg, { storeys: 2, doors: [['N', 0.5], ['S', 0.5], ['W', 0.3], ['W', 0.75]], stairs: [smytheLeg.x0 + T, smytheLeg.z0 + 3.1], roofAccess: true });
// Upstairs in Smythe: an office with the railgun.
m.prop('desk', [smytheLeg.x0 + 6, 4.3, smytheLeg.z1 - 4], 0, 1).prop('bookcase', [smytheLeg.x1 - 1.4, 4.3, smytheLeg.z1 - 6], -P, 1);

// ---------------------------------------------------------------- DeKoven Hall and the courtyard halls

const dekoven = R(673, 770, 757, 965);
hall(dekoven, { storeys: 3, doors: [['W', 0.5], ['W', 0.85], ['E', 0.5], ['N', 0.5], ['S', 0.5]], stairs: [dekoven.x0 + T, dekoven.z0 + 3.1], roofAccess: true, turrets: ['NW', 'NE', 'SW', 'SE'] });
// The great tower over the north entrance.
tower({ x0: dekoven.x0 + 4, x1: dekoven.x1 - 4, z0: dekoven.z1 - 1, z1: dekoven.z1 + 5 }, 19);
// Reception just inside the west door.
m.prop('desk_corner', [dekoven.x0 + 3, 0.1, (dekoven.z0 + dekoven.z1) / 2 + 3], P, 1).prop('office_chair', [dekoven.x0 + 4.4, 0.1, (dekoven.z0 + dekoven.z1) / 2 + 3], -P, 1);
for (let i = 0; i < 5; i++) m.prop('bed', [dekoven.x1 - 2, 4.3, dekoven.z0 + 8 + i * 6], -P, 1);
for (let i = 0; i < 5; i++) m.prop('bed', [dekoven.x1 - 2, 8.3, dekoven.z0 + 8 + i * 6], -P, 1);

const memorial = R(458, 852, 537, 950);
hall(memorial, { storeys: 1, storeyHeight: 6, doors: [['E', 0.5], ['W', 0.5], ['N', 0.5]], windows: 4, mat: { material: 'pbr_castle_stone', tint: '#b8b2a6' }, turrets: ['NE'] });
for (let i = 0; i < 4; i++) m.prop('bookcase_wide', [memorial.x0 + 1.2, 0.1, memorial.z0 + 4 + i * 4], P, 1);

const cord = R(458, 965, 613, 1048);
hall(cord, { storeys: 2, doors: [['N', 0.3], ['N', 0.75], ['S', 0.5], ['E', 0.5]], stairs: [cord.x1 - T - 2 * STAIR_W, cord.z0 + 3.1], roofAccess: false });
for (let i = 0; i < 4; i++) m.prop('desk', [cord.x0 + 4 + i * 6, 4.3, cord.z0 + 8], 0, 1);

const welles = R(638, 965, 757, 1048);
hall(welles, { storeys: 1, storeyHeight: 6, doors: [['N', 0.25], ['N', 0.7], ['W', 0.5], ['S', 0.5]], windows: 4 });
// The dining hall: long tables down the room.
for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) m.prop('table', [welles.x0 + 6 + i * 6, 0.1, welles.z0 + 5 + j * 6], 0, 1.4);
// The beacon: a lamp column at the crossing.
box(X(693) - 0.5, 0, Z(740) - 0.5, X(693) + 0.5, 4, Z(740) + 0.5, DRESSED);
box(X(693) - 0.7, 4, Z(740) - 0.7, X(693) + 0.7, 4.8, Z(740) + 0.7, { material: 'light_strip', tint: '#ffd68a' });

// ---------------------------------------------------------------- Farrand Gymnasium and Gerber Pool

const gym = R(828, 584, 1094, 703);
const gymNotch = R(1022, 555, 1094, 584);
hall(gym, { storeys: 1, storeyHeight: 9, doors: [['S', 0.25], ['S', 0.6], ['W', 0.5], ['N', 0.3]], windows: 6, mat: { material: 'pbr_brick_old', tint: '#b9aa95' } });
box(gymNotch.x0, 0, gymNotch.z0, gymNotch.x1, 7, gymNotch.z1, STONE);
battlements(gymNotch, 7);
// Gerber pool at the east end: a raised deck round the water.
const pool: Rect = { x0: X(1022), x1: gym.x1 - 2, z0: gym.z0 + 3, z1: gym.z1 - 3 };
for (const part of minus({ x0: pool.x0 - 2, x1: gym.x1 - T, z0: pool.z0 - 1.5, z1: pool.z1 + 1.5 }, pool)) slab(part, 0, 1.4, { material: 'white_tiles' });
m.water([(pool.x0 + pool.x1) / 2, 0, (pool.z0 + pool.z1) / 2], [pool.x1 - pool.x0, 1.3, pool.z1 - pool.z0]);
// Ways out of the water: steps up the west end, a ladder at the east end.
const poolMid = (pool.z0 + pool.z1) / 2;
for (let i = 0; i < 6; i++) box(pool.x0 + i * 0.5, 0, poolMid - 1.5, pool.x0 + (i + 1) * 0.5, 1.4 - i * (1.1 / 6), poolMid + 1.5, { material: 'white_tiles' });
m.add({ kind: 'ladder', position: [pool.x1, 0.1, poolMid], yaw: -P, height: 1.3, width: 1 });
// Steps up to the deck from the gym floor.
for (let i = 0; i < 6; i++) box(pool.x0 - 2 - (6 - i) * 0.5, 0, pool.z1 - 4, pool.x0 - 2 - (5 - i) * 0.5, (i + 1) * (1.4 / 6), pool.z1 - 1, { material: 'white_tiles' });
// Basketball court lines and hoops.
for (const x of [gym.x0 + 2, X(1000)]) box(x, 0, (gym.z0 + gym.z1) / 2 - 1, x + 0.3, 3.4, (gym.z0 + gym.z1) / 2 + 1, { material: 'steel_plate' });

// ---------------------------------------------------------------- St. John Chrysostom church and cemetery

const church = R(823, 897, 1040, 995);
const churchNave: Rect = { x0: church.x0 + 6, x1: church.x1 - 4, z0: church.z0 + 2, z1: church.z1 - 2 };
const siding = { material: 'pbr_siding', tint: '#8f3a2e' }; // board and batten
hall(churchNave, { storeys: 1, storeyHeight: 6, doors: [['W', 0.5], ['S', 0.5]], windows: 3, mat: siding });
steppedRoof({ x0: churchNave.x0 - 0.4, x1: churchNave.x1 + 0.4, z0: churchNave.z0 - 0.4, z1: churchNave.z1 + 0.4 }, 6.3, 6, 0.9, true, { material: 'dark_wood' });
// Bell tower and spire at the west end.
const belfry = { x0: church.x0 + 1.5, x1: church.x0 + 6, z0: (church.z0 + church.z1) / 2 - 2.25, z1: (church.z0 + church.z1) / 2 + 2.25 };
box(belfry.x0, 0, belfry.z0, belfry.x1, 11, belfry.z1, siding);
for (let i = 0; i < 6; i++) {
  const inset = i * 0.38;
  box(belfry.x0 + inset, 11 + i * 1.2, belfry.z0 + inset, belfry.x1 - inset, 11 + (i + 1) * 1.2, belfry.z1 - inset, { material: 'dark_wood' });
}
for (let i = 0; i < 3; i++) m.prop('bench', [churchNave.x0 + 4 + i * 4, 0.1, (churchNave.z0 + churchNave.z1) / 2], P, 1.1);
// The old cemetery: rows of headstones south and east of the church.
const headstone = (x: number, z: number, i: number) => box(x - 0.35, 0, z - 0.12, x + 0.35, 0.9 + (i % 3) * 0.25, z + 0.12, { material: 'stone_trim', tint: i % 2 ? '#a7a39a' : '#8f8c85' });
let n = 0;
for (let x = 42; x <= 96; x += 3) for (const z of [-58, -62]) headstone(x, z, n++);
for (let x = 87; x <= 98; x += 3) for (let z = -50; z <= -34; z += 4) headstone(x, z, n++);
const shed = R(1040, 1015, 1117, 1048);
box(shed.x0, 0, shed.z0, shed.x1, 3.2, shed.z1, STONE);
battlements(shed, 3.2, DRESSED, 0.4, 0.5, 2);

// ---------------------------------------------------------------- south of Exeter Street

const staffParking = R(96, 1135, 252, 1242);
slab(staffParking, 0, 0.12, ASPHALT);
for (let x = staffParking.x0 + 1; x < staffParking.x1 - 2; x += 3.2) box(x, 0.12, staffParking.z1 - 5.5, x + 0.15, 0.14, staffParking.z1 - 0.5, { material: 'paint_matte', tint: '#e8e6dc' });

const mousoA = R(280, 1163, 315, 1228);
const mousoB = R(280, 1228, 380, 1280);
hall(mousoB, { storeys: 1, storeyHeight: 5, doors: [['N', 0.7], ['S', 0.5]], windows: 4 });
box(mousoA.x0, 0, mousoA.z0, mousoA.x1, 5, mousoA.z1, STONE);
battlements(mousoA, 5, DRESSED, 0.5, 0.6, 2.2);

const facilities = R(207, 1290, 350, 1340);
hall(facilities, { storeys: 1, storeyHeight: 6, doors: [['N', 0.25], ['N', 0.7], ['E', 0.5]], windows: 0, mat: { material: 'pbr_corrugated', tint: '#7f8a86' } });
for (let i = 0; i < 4; i++) m.prop('cargo_crate', [facilities.x0 + 4 + i * 5, 0.1, facilities.z0 + 2.5], 0, 1);

const infirmary = R(418, 1176, 600, 1242);
hall(infirmary, { storeys: 1, storeyHeight: 5, doors: [['N', 0.5], ['W', 0.5], ['E', 0.5]], turrets: ['NW'] });
for (let i = 0; i < 5; i++) m.prop('bed', [infirmary.x0 + 4 + i * 6, 0.1, infirmary.z0 + 2], 0, 1);
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
hall(postOffice, { storeys: 1, storeyHeight: 5, doors: [['N', 0.5], ['W', 0.5]], windows: 4, mat: { material: 'pbr_brick_red' } });
steppedRoof({ x0: postOffice.x0 - 0.3, x1: postOffice.x1 + 0.3, z0: postOffice.z0 - 0.3, z1: postOffice.z1 + 0.3 }, 5.3, 3, 0.8, true, { material: 'pbr_roof' });

// ---------------------------------------------------------------- private homes along Wisconsin Avenue

const houseCols = [[98, 202, 306], [465, 569, 673], [828, 932, 1036]];
const houseRows = [143, 294];
const facades: Mat[] = [{ material: 'pbr_siding', tint: '#ece6d8' }, { material: 'pbr_brick_red' }, { material: 'pbr_siding', tint: '#b7c4c9' }, { material: 'pbr_siding', tint: '#d8c49a' }, STONE];
let h = 0;
for (let b = 0; b < 3; b++)
  for (const py of houseRows)
    for (let c = 0; c < 3; c++) {
      if (b === 2 && py === 294 && c === 2) continue; // an empty lot
      const px = houseCols[b]![c]!;
      const lot = R(px, py, px + 76, py + 76);
      const president = b === 2 && py === 294 && c === 0;
      const inset = president ? 0.8 : 2;
      const house: Rect = { x0: lot.x0 + inset, x1: lot.x1 - inset, z0: lot.z0 + inset + 1, z1: lot.z1 - inset };
      const facade = president ? STONE : facades[h++ % facades.length]!;
      box(house.x0, 0, house.z0, house.x1, 6, house.z1, facade);
      if (president) battlements(house, 6);
      else steppedRoof({ x0: house.x0 - 0.4, x1: house.x1 + 0.4, z0: house.z0 - 0.4, z1: house.z1 + 0.4 }, 6, 4, 0.75, true, { material: 'pbr_roof', tint: h % 2 ? '#5d4a3e' : '#4d5560' });
      // A porch and a couple of trees in the yard.
      box(house.x0 + 2, 0, house.z0 - 1.6, house.x0 + 5, 0.4, house.z0, { material: 'oak_planks' });
      m.prop('tree_round', [lot.x1 - 1.5, 0, lot.z0 + 1], h, 1.1);
    }

// ---------------------------------------------------------------- trees and lamps

const treeKinds = ['tree_round', 'tree_fat', 'tree_detailed', 'tree_round_dark'];
let t = 0;
const tree = (x: number, z: number) => m.prop(treeKinds[t++ % treeKinds.length]!, [x, 0, z], t * 1.7, 1 + (t % 3) * 0.15);
for (let x = -100; x <= 96; x += 14) tree(x, 116.5); // Wisconsin Avenue
for (let z = -60; z <= 58; z += 13) tree(-106.5, z); // Spanjer Street, by the field
for (let x = 42; x <= 96; x += 12) tree(x, 3.5); // Church Street
for (let x = 44; x <= 96; x += 13) tree(x, -24); // by the church
for (const [x, z] of [[-30, 26], [-8, 26], [-34, 4], [-20, -14], [0, -14], [-4, -42], [44, 50], [70, 40], [96, 50]] as const) tree(x, z);
for (let x = -96; x <= 92; x += 24) m.prop('lantern_post', [x, 0, -69.5], 0, 1); // Exeter Street

// ---------------------------------------------------------------- vehicles and guns

m.mount('buggy', [staffParking.x0 + 8, 0.12, staffParking.z0 + 6], P);
m.mount('buggy', [staffParking.x0 + 16, 0.12, staffParking.z0 + 6], P);
m.mount('hauler', [32.8, 0.12, 40], 0);
m.mount('buggy', [32.8, 0.12, -40], Math.PI);
m.mount('speeder', [-60, 0.12, 123], P);
m.mount('turret_mg', [dekoven.x0 + 3, 12.3, (dekoven.z0 + dekoven.z1) / 2], -P);

const mid = (r: Rect, y = 0.1): V3 => [(r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2];
m.pickup('weapon_sniper', [dekoven.x1 - 3, 12.3, dekoven.z1 - 4]).pickup('ammo_sniper', [dekoven.x1 - 3, 12.3, dekoven.z0 + 4]);
m.pickup('weapon_railgun', [smytheLeg.x0 + 4, 4.3, smytheLeg.z1 - 3]).pickup('ammo_cells', [smytheLeg.x1 - 3, 4.3, smytheLeg.z0 + 4]);
m.pickup('weapon_rockets', mid(nave)).pickup('ammo_explosive', [nave.x1 - 4, 0.1, nave.z0 + 2]);
m.pickup('weapon_shotgun', [gym.x0 + 6, 0.1, gym.z1 - 4]).pickup('armor_large', mid({ ...gym, x1: X(1010) }));
m.pickup('powerup_damage', [pool.x0 - 1, 1.4, (pool.z0 + pool.z1) / 2], 90);
m.pickup('weapon_rifle', [hazelwood.x0 + 6, 0.1, hazelwood.z0 + 6]).pickup('weapon_marksman', [hazelwood.x1 - 4, 8.3, hazelwood.z1 - 3]);
m.pickup('weapon_smg', mid(memorial)).pickup('health_large', [memorial.x1 - 2, 0.1, memorial.z0 + 2]);
m.pickup('weapon_burst_rifle', mid(welles)).pickup('health_small', [welles.x0 + 2, 0.1, welles.z1 - 2]);
m.pickup('weapon_auto_shotgun', mid(churchNave));
m.pickup('health_large', mid(infirmary)).pickup('health_small', [infirmary.x1 - 2, 0.1, infirmary.z1 - 2]);
m.pickup('weapon_lmg', mid(store));
m.pickup('weapon_launcher', mid(postOffice)).pickup('ammo_explosive', mid(facilities));
m.pickup('grenades', [-96, 0, 20]).pickup('grenades', [-96, 0, -30]).pickup('armor_small', [pole[0], 0.5, pole[2] + 2]);
m.pickup('ammo_rifle', [cord.x0 + 3, 0.1, cord.z1 - 2]).pickup('ammo_rifle', [dekoven.x0 + 2, 4.3, dekoven.z1 - 4]).pickup('armor_small', [-10, 0.12, -3]);
m.pickup('ammo_shells', [60, 0.12, -3]).pickup('ammo', [32.8, 0.12, 0]).pickup('health_small', [-40, 0, 40]);

// ---------------------------------------------------------------- spawns, flags and hills

for (const [x, z, yaw] of [[-96, 10, P], [-96, -20, P], [-88, 34, P], [-88, -44, P], [-80, -6, P], [-68, -30, P], [-68, 18, P], [-75, -56, 0], [-60, -56, 0], [-100, 48, P], [-90, -88, 0], [-60, 50, P]] as const) m.spawn([x, 0, z], yaw, west);
for (const [x, z, yaw] of [[48, -12, -P], [64, -14, -P], [80, -16, -P], [96, -12, -P], [96, 12, -P], [96, 36, -P], [56, 44, Math.PI], [80, 46, Math.PI], [94, -66, -P], [60, -86, 0], [44, -30, -P], [98, -30, -P]] as const) m.spawn([x, 0, z], yaw, east);
for (const [x, z, yaw] of [[-20, 50, 0], [10, 50, Math.PI], [-50, 90, 0], [0, 90, 0], [60, 90, Math.PI], [-80, 90, 0], [-20, -20, 0], [-2, -58, 0], [-30, -95, 0], [40, -95, P], [80, -120, 0], [-100, -120, P], [-50, -125, 0], [20, -130, 0], [-10, 30, 0], [70, -40, P]] as const) m.spawn([x, 0, z], yaw);

m.flag(west, [pole[0] + 4, 0, pole[2]], P).flag(east, [68, 0.12, -3], -P);
m.hill([X(693), 0.12, Z(740) - 3], 5).hill([pole[0], 0, pole[2] + 8], 6).hill([-8, 0, -30], 5);

m.bounds('invisible', 3, { min: [-124, -138], max: [112, 130] });
m.meta({
  description:
    "A look-alike of the St. John's Northwestern Military Academy campus in Delafield, Wisconsin: grey lannonstone halls built like castles, with towers, turrets and battlements, set round the Stangeland Field of Flags and its flagpole. Climb DeKoven Hall to its roof for the sniper rifle and the mounted gun, take the railgun from upstairs in Smythe Hall, rockets from the Noble Victory chapel, and the damage boost from the Gerber pool in the gymnasium. The west team holds the parade field and Hazelwood Hall, the east team the gym and the old church across Church Street.",
  modes: ['core.tdm', 'core.deathmatch', 'core.ctf', 'core.koth', 'core.elim'],
  players: [8, 32],
});
await m.save();
