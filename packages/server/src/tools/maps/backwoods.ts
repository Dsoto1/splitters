/**
 * Backwoods Lodge: a big wooden lodge on the high ground above a creek, a
 * long open backyard with a barn and fences, a road along the property edge
 * to the garage, and a long concrete drain that runs from the creek under the
 * whole yard and comes up inside the lodge's lower floor (an homage to
 * Counter-Strike's cs_militia, rebuilt from memory with our own kit).
 *
 * The defenders hold the lodge: a stone lower floor (garage, cellars, the
 * drain stairs), the main floor (rear door onto a raised back deck, front
 * door onto the porch) and the upstairs bedrooms, whose windows and balcony
 * look straight down the yard. The attackers come out of the pine woods
 * south of the creek and choose: the open yard (barn and hay for cover), the
 * road round the east edge to the garage doors, or the drain.
 *
 * Grid x east, y north (one cell = 8 m). Grade (yard, field, road) is level 1
 * (4 m); the creek bed and the drain are level 0; the main floor is level 2,
 * upstairs level 3. Terrain everywhere, tiles for the buildings and the drain.
 *
 * y       -9 -8 -7 -6 -5 -4 -3 -2 -1  0  1  2  3  4  5  6  7  8   <- x
 * 10,9     ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^   ^ pine woods
 * 8        ^  ^  ^  ^  ^  .  .  .  .  .  .  .  .  ^  ^  ^  ^  ^
 * 7        ^  ^  .  .  .  .  .  .  .  .  .  .  .  .  .  .  ^  ^
 * 6        ^  ^  .  .  .  o  w  L  L  L  S  G  =  =  =  .  ^  ^   L lodge (3 floors), G garage (wide doors east), S stairs garage -> main floor
 * 5        ^  ^  .  .  .  .  .  L  L  L  L  G  =  =  =  r  ^  ^   = driveway, r road, o outhouse, w woodpiles
 * 4        ^  ^  .  .  .  .  w  L  T  L  s  L  P  .  .  r  ^  ^   T drain stairs up into the cellar, s stairs to upstairs, P porch
 * 3        ^  ^  .  .  .  .  .  d  D  d  /  .  /  .  .  r  ^  ^   d back deck (level 2), D deck and balcony over the drain, / outdoor steps
 * 2        ^  ^  .  .  .  .  .  .  :  .  .  .  .  .  .  r  ^  ^   : drain under the yard (level 0, grass-topped cover)
 * 1        ^  ^  .  .  -  +     -  :        -  -  -  -  r  ^  ^   - yard fence along y 1.5 (gates), + fence corner
 * 0        ^  ^  B  B  .  |  .  .  :  .  .  .  y  .  |  r  ^  ^   B barn: two storeys, hayloft (sniper rifle); | fences; y hay
 * -1       ^  ^  B  B  .  n  J  :  :  .  .  .  .  H  |  r  ^  ^   J drain junction, n niche (rockets), H shed (big armour)
 * -2       ^  ^  .  .  .  |  :  .  .  .  .  .  .  .  |  r  ^  ^
 * -3       ^  ^  .  .  .  |  :  .  .  _  _  .  .  .  |  r  ^  ^   _ old stone wall
 * -4       ^  ^  .  .  .  y  :  y  .  .  .  y  .  y  |  r  ^  ^
 * -5       ~  m  ~  #  ~  ~  M  ~  ~  ~  ~  ~  ~  ~  ~  #  ~  ~   ~ creek ravine (bed at level 0), M drain mouth, m watermill
 * -6       ~  ~  ~  #  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  ~  #  ~  ~   # footbridge (west) and road bridge (east)
 * -7       ^  ^  ^  #  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  #  ^  ^
 * -8,-9    ^  ^  ^  ^  ^  ^  ^  ^  .  .  .  ^  ^  ^  ^  r  ^  ^
 * -10      ^  ^  ^  ^  ^  ^  .  t  .  *  .  t  .  ^  ^  r  ^  ^   attackers' camp: t tents, * fire
 * -11,-12  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  ^  r  ^  ^
 *
 * Routes: yard (centre, open, hay and fences, rear deck stairs), barn flank
 * (west, footbridge -> barn -> outhouse -> cellar side door), road (east,
 * road bridge -> shed -> porch or garage), drain (creek mouth -> junction ->
 * cellar stairs). Upstairs windows and the balcony cover the yard; the barn
 * hayloft window answers them.
 */
import { TERRAIN_MATERIALS, paintSlopes, terrainHeightAt, type Side, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('backwoods', 'Backwoods Lodge');
m.theme('saloon');
m.backdrop('cloudy', 'forest', 'grass', 0.4, 0.5);
m.teams([8, 8]);
const [defenders, attackers] = m.teamIds() as [string, string];

const PI = Math.PI;
const P2 = PI / 2;
const G = 3.85; // grade: the yard, the field and the road (just under level 1)
const UNDER = 3.6; // terrain hidden in the floor slab under level-1 buildings (props on those floors stay put)
const LOW = -0.4; // terrain hidden in the floor slab under the drain (level 0)
const BED = -0.15; // creek bed
const CREEK_Z = -46;

/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0): [number, number, number] => [x * 8 + dx, z * 4, y * 8 + dy];
const rect = (x: number, y: number): [number, number, number, number] => [x * 8 - 4, y * 8 - 4, x * 8 + 4, y * 8 + 4];

function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });

// ================================================================ layout data

/** The drain (level 0): mouth at the creek, north to the junction, east, then north under the yard. */
const DRAIN: [number, number][] = [
  [-3, -5], [-3, -4], [-3, -3], [-3, -2], [-3, -1], [-4, -1], [-2, -1], [-1, -1], [-1, 0], [-1, 1], [-1, 2], [-1, 3],
];
/** The drain stairs climb from (-1,3) into the lodge's lower floor; they sit under the lodge. */
const DRAIN_STAIRS: [number, number] = [-1, 4];
const UNDERGROUND = [...DRAIN, DRAIN_STAIRS];
const isUnder = (x: number, y: number) => UNDERGROUND.some(([a, b]) => a === x && b === y);

const LODGE = { x0: -2, x1: 2, y0: 4, y1: 6 }; // cells
const LODGE_RECT: [number, number, number, number] = [-20, 28, 20, 52];
const BARN_RECT: [number, number, number, number] = [-60, -12, -44, 4];
const SHED_RECT: [number, number, number, number] = [28, -12, 36, -4];
const ROAD_X = 48;
const BRIDGE_X = { foot: -6, road: 6 }; // cells
const CAMP: [number, number] = [0, -80];

// ================================================================ terrain

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Distance from a point to a rectangle [x0, z0, x1, z1] (0 inside). */
const rectDist = (x: number, z: number, [x0, z0, x1, z1]: readonly number[]) => Math.hypot(Math.max(x0! - x, 0, x - x1!), Math.max(z0! - z, 0, z - z1!));
const rectCheb = (x: number, z: number, [x0, z0, x1, z1]: readonly number[]) => Math.max(x0! - x, 0, x - x1!, z0! - z, 0, z - z1!);
const strictlyInside = (x: number, z: number, [x0, z0, x1, z1]: readonly number[]) => x > x0! + 0.5 && x < x1! - 0.5 && z > z0! + 0.5 && z < z1! - 0.5;

type P = [number, number];
const segDist = (x: number, z: number, [ax, az]: P, [bx, bz]: P) => {
  const vx = bx - ax;
  const vz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - ax - vx * t, z - az - vz * t);
};
const lineDist = (x: number, z: number, line: P[]) => Math.min(...line.slice(1).map((b, i) => segDist(x, z, line[i]!, b)));

/** Dirt footpaths through the woods and across the yard. */
const PATHS: P[][] = [
  [[0, -74], [-20, -66], [-48, -62], [-48, -30], [-50, -14]], // camp -> footbridge -> barn
  [[0, -74], [24, -66], [ROAD_X, -62]], // camp -> road
  [[-4, -72], [-14, -60], [-24, -52]], // camp -> down to the drain mouth
  [[-48, 6], [-44, 20], [-30, 34], [-21, 40]], // barn -> outhouse -> cellar side door
  [[12, 22], [8, 8], [0, -10], [-10, -30], [-24, -38]], // deck steps -> across the yard -> creek
];
const pathDist = (x: number, z: number) => Math.min(...PATHS.map((l) => lineDist(x, z, l)));
/** The road: south edge to the house front, then west along the driveway to the garage. */
const ROAD: P[] = [[ROAD_X, -104], [ROAD_X, 36], [44, 44], [20, 44]];
const roadDist = (x: number, z: number) => lineDist(x, z, ROAD);

const UNDER_RECTS = UNDERGROUND.map(([x, y]) => rect(x, y));
const underDist = (x: number, z: number) => Math.min(...UNDER_RECTS.map((r) => rectDist(x, z, r)));

/** The creek ravine: a flat bed 6 m wide, banks climbing at about 31 degrees (steeper trips the navmesh's ledge filter). */
const ravine = (x: number, z: number) => {
  const dz = Math.abs(z - CREEK_Z);
  // A little pool in front of the drain mouth.
  const pool = 1.5 * (1 - smooth(8, 14, Math.abs(x + 24)));
  return BED + Math.max(0, dz - 3 - (z > CREEK_Z ? pool : 0)) * 0.6;
};

function natural(x: number, z: number): number {
  let h = G;
  // Pine woods south of the creek climb toward the camp.
  h += smooth(56, 86, -z) * (1.8 + 0.9 * Math.sin(x / 14 + 1) + 0.6 * Math.cos(x / 9 - z / 13));
  // The lodge stands highest: the yard falls away gently toward the creek.
  h -= 1.3 * (1 - smooth(-40, 12, z)) * smooth(-58, -48, z);
  // The hill behind the lodge, the west woods and the bank beyond the road.
  h += smooth(58, 86, z) * (5 + 1.5 * Math.sin(x / 12));
  h += smooth(58, 82, -x) * (4 + 1.5 * Math.sin(z / 11));
  h += smooth(56, 72, x) * (3 + Math.sin(z / 9));
  // Gentle swells in the field.
  const field = smooth(-36, -28, z) * (1 - smooth(54, 62, z));
  h += field * (0.7 * Math.sin(x / 19 + 0.3) * Math.cos(z / 23) + 0.4 * Math.sin(z / 11 + x / 29));
  // Camp clearing: levelled to the woods height there.
  const campH = G + 1.8 + 0.9 * Math.sin(1) + 0.6 * Math.cos(-CAMP[1] / -13);
  h = lerp(h, campH, 1 - smooth(16, 26, Math.hypot(x - CAMP[0], z - CAMP[1])));
  // Level ground round everything built: lodge and driveway, barn, shed, the drain strip, bridge ends, the road.
  let flat = 0;
  flat = Math.max(flat, 1 - smooth(8, 16, rectDist(x, z, LODGE_RECT)));
  flat = Math.max(flat, 1 - smooth(4, 12, rectDist(x, z, [20, 16, 52, 56])));
  flat = Math.max(flat, 1 - smooth(6, 12, rectDist(x, z, BARN_RECT)));
  flat = Math.max(flat, 1 - smooth(4, 10, rectDist(x, z, SHED_RECT)));
  flat = Math.max(flat, 1 - smooth(8, 16, underDist(x, z)));
  for (const bx of Object.values(BRIDGE_X)) flat = Math.max(flat, 1 - smooth(4, 10, rectDist(x, z, [bx * 8 - 4, -64, bx * 8 + 4, -30])));
  flat = Math.max(flat, 1 - smooth(4, 18, roadDist(x, z)));
  h = lerp(h, G, flat);
  return h;
}

// Terrain 160 x 192 m, 2 m spacing; vertices on even metres so cell edges (multiples of 8 +- 4) fall on vertices.
const T0: P = [-84, -104];
const COLS = 81;
const ROWS = 97;
let terrain: TerrainData = {
  origin: T0,
  spacing: 2,
  cols: COLS,
  rows: ROWS,
  baseY: 0,
  heights: [],
  materials: new Array((COLS - 1) * (ROWS - 1)).fill(TERRAIN_MATERIALS.indexOf('grass')),
  boundary: true,
  foliage: [],
};
const vx = (c: number) => T0[0] + c * 2;
const vz = (r: number) => T0[1] + r * 2;
/** Height before the drain is cut in, kept for the coverage check below. */
const surfaceH: number[] = [];
const heights: number[] = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const x = vx(c);
    const z = vz(r);
    let h = Math.min(natural(x, z), ravine(x, z));
    // Hidden in the floor slab under the level-1 buildings.
    if ([LODGE_RECT, BARN_RECT, SHED_RECT].some((b) => strictlyInside(x, z, b))) h = UNDER;
    surfaceH.push(h);
    // Under the drain (and 2 m round it, where the grass-topped cover blocks hide the cut).
    // Inside the drain the cut sits deeper (props on the drain floor stay put); the ring outside matches the creek bed, so the mouth steps out level.
    if (UNDER_RECTS.some((b) => strictlyInside(x, z, b))) h = Math.min(h, LOW);
    else if (UNDER_RECTS.some((b) => rectCheb(x, z, b) <= 2.01)) h = Math.min(h, BED);
    heights.push(Math.round(h * 100));
  }
}
terrain = { ...terrain, heights };

// Ground materials and plant cover.
const M = (n: TerrainMaterial) => TERRAIN_MATERIALS.indexOf(n);
const materials: number[] = [];
const foliage: number[] = [];
for (let r = 0; r < ROWS - 1; r++) {
  for (let c = 0; c < COLS - 1; c++) {
    const x = vx(c) + 1;
    const z = vz(r) + 1;
    const dz = Math.abs(z - CREEK_Z);
    const woods = z < -56 || z > 60 || x < -62 || x > 58;
    let g: TerrainMaterial = woods ? 'moss' : 'grass';
    let f = woods ? 4 : 3;
    if (rectDist(x, z, LODGE_RECT) < 6) f = 2;
    if (woods && Math.hypot(x - CAMP[0], z - CAMP[1]) < 18) (g = 'dirt'), (f = 1);
    if (pathDist(x, z) < 1.6) (g = 'dirt'), (f = 0);
    if (roadDist(x, z) < 4 || rectDist(x, z, [20, 34, 44, 54]) < 0.5) (g = 'gravel'), (f = 0);
    if (dz < 4.5) (g = 'mud'), (f = 0);
    else if (dz < 10) (g = 'dirt'), (f = 2);
    materials.push(M(g));
    foliage.push(f);
  }
}
terrain = paintSlopes({ ...terrain, materials, foliage }, 40, 'stone');
m.terrain(terrain);
const ground = (x: number, z: number) => +(terrainHeightAt(terrain, x, z) ?? G).toFixed(2);
/** A point on the ground; refuses spots over the drain or its cover (the terrain there is cut away underneath). */
const overDrain = (x: number, z: number) => [...UNDER_RECTS, ...bands].some(([x0, z0, x1, z1]) => x > x0 - 1 && x < x1 + 1 && z > z0 - 1 && z < z1 + 1);
const onGround = (x: number, z: number): [number, number, number] => {
  if (overDrain(x, z)) throw new Error(`backwoods: ${x},${z} is over the drain`);
  return [x, ground(x, z), z];
};

// ================================================================ the drain (level 0)

m.tile('corridor_clear', -3, -5).tile('corridor_clear', -3, -4).tile('corridor', -3, -3).tile('corridor_clear', -3, -2);
m.tile('junction_t', -3, -1, 0, 2); // S, W, E
m.tile('dead_end', -4, -1, 0, 1); // the niche west of the junction
m.tile('corridor', -2, -1, 0, 1);
m.tile('corner', -1, -1, 0, 3); // W, N
m.tile('corridor_clear', -1, 0).tile('corridor', -1, 1).tile('corridor_clear', -1, 2).tile('corridor_clear', -1, 3);
m.tile('stairs', DRAIN_STAIRS[0], DRAIN_STAIRS[1], 0, 3); // climbs north into the cellar
m.edge(-3, -5, 0, 'S', 'wide'); // the mouth on the creek
const concrete: TileSurfaces = { floor: mat('pbr_concrete'), walls: mat('pbr_concrete_dark'), solids: mat('pbr_concrete'), trim: mat('pbr_steel') };
for (const [x, y] of UNDERGROUND) paint(x, y, 0, concrete);

// Cover over the drain: a slab on each cell (its underside is the drain's ceiling) and solid fill
// 4.5 m wide down each closed side, hiding where the terrain drops to the drain floor. Grass on top.
const SIDE_DIR: Record<Side, P> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
const BAND = 4.5;
const bands: [number, number, number, number][] = [];
for (const [x, y] of DRAIN) {
  const mouth = x === -3 && y === -5;
  const material = mouth ? 'pbr_concrete' : 'pbr_grass';
  m.block([x * 8, 3.6, y * 8], [8, 0.4, 8], 'solid', { material });
  for (const side of ['N', 'E', 'S', 'W'] as Side[]) {
    const [dx, dy] = SIDE_DIR[side];
    if (isUnder(x + dx, y + dy) || (mouth && side === 'S')) continue;
    const [px, py]: P = [Math.abs(dy), Math.abs(dx)]; // along the side
    const ext = (s: 1 | -1) => {
      if (mouth && py === 1 && s === -1) return 0; // no wing walls across the creek bed
      return !isUnder(x + px * s, y + py * s) && !isUnder(x + px * s + dx, y + py * s + dy) ? BAND : 0;
    };
    const a0 = -4 - ext(-1);
    const a1 = 4 + ext(1);
    // Rectangle in world: outward 4..4+BAND from the centre along (dx, dy), along a0..a1.
    const cx = x * 8 + dx * (4 + BAND / 2) + px * ((a0 + a1) / 2);
    const cz = y * 8 + dy * (4 + BAND / 2) + py * ((a0 + a1) / 2);
    const w = dx !== 0 ? BAND : a1 - a0;
    const d = dy !== 0 ? BAND : a1 - a0;
    m.block([cx, -0.5, cz], [w, 4.5, d], 'solid', { material });
    bands.push([cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2]);
  }
}

// Check: every terrain cell the drain cut lowered is hidden under the drain, its cover or the lodge.
{
  const covers = [...UNDER_RECTS, ...bands, LODGE_RECT];
  const hidden = (x: number, z: number) => covers.some(([x0, z0, x1, z1]) => x >= x0 - 0.01 && x <= x1 + 0.01 && z >= z0 - 0.01 && z <= z1 + 0.01);
  let exposed = 0;
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const corners: P[] = [[c, r], [c + 1, r], [c, r + 1], [c + 1, r + 1]];
      const cut = corners.some(([cc, rr]) => surfaceH[rr * COLS + cc]! - heights[rr * COLS + cc]! / 100 > 0.6);
      if (!cut) continue;
      if (!corners.every(([cc, rr]) => hidden(vx(cc), vz(rr)))) {
        exposed++;
        if (exposed <= 5) console.log(`backwoods: drain cut exposed at terrain cell ${vx(c)},${vz(r)}`);
      }
    }
  }
  if (exposed) console.log(`backwoods: ${exposed} exposed terrain cells over the drain`);
}

// ================================================================ the lodge

// Lower floor (z1): garage, cellars, the drain stairs arriving from below, stairs up from the garage.
m.tile('room', -2, 4, 1).tile('room', 0, 4, 1).tile('room', 1, 4, 1).tile('room', 2, 4, 1);
m.tile('room', -2, 5, 1).tile('room', -2, 6, 1).tile('room_large', -1, 5, 1).tile('room', 1, 5, 1);
m.tile('stairs', 1, 6, 1, 2); // garage (east) up to the living room (west)
m.tile('room_long', 2, 5, 1); // the garage
m.edge(2, 5, 1, 'E', 'wide').edge(2, 6, 1, 'E', 'wide');
m.edge(-2, 5, 1, 'W', 'door'); // cellar side door
for (const x of [-2, 0, 1, 2]) m.edge(x, 4, 1, 'S', 'window');
m.edge(-2, 6, 1, 'W', 'window');
const stone: TileSurfaces = { walls: mat('pbr_castle_stone'), floor: mat('pbr_flagstone'), trim: mat('pbr_charred_wood') };
for (const [x, y] of [[-2, 4], [0, 4], [1, 4], [2, 4], [-2, 5], [-2, 6], [-1, 5], [1, 5]] as P[]) paint(x, y, 1, stone);
paint(2, 5, 1, { walls: mat('pbr_castle_stone'), floor: mat('pbr_concrete'), solids: mat('pbr_planks') });
paint(1, 6, 1, { walls: mat('pbr_castle_stone') });
paint(DRAIN_STAIRS[0], DRAIN_STAIRS[1], 0, { walls: mat('pbr_castle_stone') });

// Main floor (z2): study, mudroom (rear door), dining, front hall (front door), living room, kitchen, parlour.
m.tile('room', -2, 4, 2).tile('room', -1, 4, 2).tile('room', 0, 4, 2).tile('room', 2, 4, 2);
m.tile('room', -2, 5, 2).tile('room', -2, 6, 2).tile('room_large', -1, 5, 2).tile('room', 1, 5, 2).tile('room', 2, 5, 2).tile('room', 2, 6, 2);
m.tile('stairs', 1, 4, 2, 2); // front hall (east) up to the landing (west)
// Back deck on the yard side with steps down; the porch at the front door with steps down to the drive.
m.fill('platform_rail', -2, 3, 0, 3, 2);
m.tile('stairs_open', 1, 3, 1, 2);
m.tile('platform_rail', 3, 4, 2);
m.tile('stairs_open', 3, 3, 1, 3);
m.edge(-2, 4, 2, 'S', 'windows').edge(0, 4, 2, 'S', 'windows');
for (const y of [4, 5, 6]) m.edge(-2, y, 2, 'W', 'window');
for (const x of [-2, -1, 0, 2]) m.edge(x, 6, 2, 'N', 'window');
m.edge(2, 5, 2, 'E', 'windows').edge(2, 6, 2, 'E', 'window');
paint(-2, 3, 2, { floor: mat('pbr_planks') });
paint(-1, 3, 2, { floor: mat('pbr_planks') });
paint(0, 3, 2, { floor: mat('pbr_planks') });
paint(3, 4, 2, { floor: mat('pbr_planks') });

// Upstairs (z3): bedrooms, bathroom, the attic hall; windows all round, a balcony over the deck.
m.tile('room', -2, 4, 3).tile('room', -1, 4, 3).tile('room', 0, 4, 3).tile('room', 2, 4, 3);
m.tile('room', -2, 5, 3).tile('room', -2, 6, 3).tile('room_large', -1, 5, 3).tile('room', 1, 5, 3).tile('room', 1, 6, 3);
m.tile('room', 2, 5, 3).tile('room', 2, 6, 3);
m.tile('balcony', -1, 3, 3, 2);
for (const x of [-2, 0, 2]) m.edge(x, 4, 3, 'S', 'windows');
for (const y of [4, 5, 6]) m.edge(-2, y, 3, 'W', 'window').edge(2, y, 3, 'E', 'window');
for (const x of [-2, -1, 0, 1, 2]) m.edge(x, 6, 3, 'N', 'window');
m.edge(-2, 5, 3, 'N', 'wall');
for (const [x, y] of [[-2, 4], [-1, 4], [0, 4], [2, 4], [-2, 5], [-2, 6], [-1, 5], [1, 5], [1, 6], [2, 5], [2, 6]] as P[]) paint(x, y, 3, { floor: mat('pbr_carpet', '#9a7a5a') });
paint(-2, 6, 3, { floor: mat('pbr_checker'), walls: mat('pbr_plaster_white') }); // bathroom

// Roof: a stepped gable (ridge east-west) of clay tiles over the top floor, with a stone chimney.
for (let k = 0; k < 6; k++) {
  const d = 13 - 2.1 * k;
  m.block([0, 16 + 0.7 * k, 40], [42, 0.7, 2 * d], 'solid', { material: 'pbr_roof' });
}
m.block([-14, 16, 47], [1.8, 5.6, 1.8], 'solid', { material: 'pbr_brick_old' });
// Foot steps for the outdoor flights (their first step is 0.4 m above the grass).
m.block([12.6, 3.6, 24], [1.2, 0.5, 4.4], 'solid', { material: 'pbr_planks' });
m.block([24, 3.6, 19.4], [4.4, 0.5, 1.2], 'solid', { material: 'pbr_planks' });

// ================================================================ barn, shed, outhouse, bridges

// Barn: an atrium (two storeys, gallery all round with stairs up), big doors front and back.
m.tile('atrium', -7, -1, 1);
m.edge(-7, -1, 1, 'S', 'wide').edge(-6, 0, 1, 'N', 'wide').edge(-6, 0, 1, 'E', 'door').edge(-7, 0, 1, 'W', 'door');
m.edge(-6, 0, 2, 'E', 'window').edge(-6, 0, 2, 'N', 'window').edge(-6, -1, 2, 'S', 'window').edge(-7, 0, 2, 'N', 'window').edge(-7, -1, 2, 'W', 'window');
paint(-7, -1, 1, { walls: mat('pbr_planks', '#b0503c'), floor: mat('pbr_planks'), trim: mat('pbr_plaster_white') });
for (let k = 0; k < 6; k++) {
  const w = 9.2 - 1.45 * k;
  m.block([-52, 12 + 0.7 * k, -4], [2 * w, 0.7, 18], 'solid', { material: 'pbr_roof', tint: '#8a5a48' });
}
// Shed by the road.
m.tile('room', 4, -1, 1);
m.edge(4, -1, 1, 'S', 'door').edge(4, -1, 1, 'N', 'door').edge(4, -1, 1, 'E', 'window');
paint(4, -1, 1, { walls: mat('pbr_planks'), floor: mat('pbr_planks') });
m.block([32, 8, -8], [9.4, 0.3, 9.4], 'solid', { material: 'pbr_corrugated' });
// Outhouse beside the cellar path.
m.block([-30, 3.7, 48], [1.8, 2.5, 1.8], 'solid', { material: 'pbr_planks' });
m.block([-30, 6.2, 48], [2.3, 0.15, 2.3], 'solid', { material: 'pbr_corrugated' });
// Footbridge (west) and road bridge (east) over the creek.
for (const y of [-7, -6, -5]) m.tile('bridge', BRIDGE_X.foot, y, 1).tile('bridge', BRIDGE_X.road, y, 1);
for (const y of [-7, -6, -5]) {
  paint(BRIDGE_X.foot, y, 1, { floor: mat('pbr_planks'), solids: mat('pbr_charred_wood') });
  paint(BRIDGE_X.road, y, 1, { floor: mat('pbr_planks'), solids: mat('pbr_charred_wood') });
}

// ================================================================ water

m.water([-4, BED, CREEK_Z], [144, 0.5, 7], 'water');

// ================================================================ spawns

// Defenders: through the lodge (cellar, garage, main floor, upstairs).
for (const [x, y, z, yaw] of [
  [-8, 4, 44, PI], [16, 4, 40, -P2], [-4, 8, 46, PI], [-18.5, 8, 43, PI],
  [16, 8, 32, PI], [-16, 12, 33, 0], [0, 12, 48, PI], [16, 12, 47, PI],
] as const) m.spawn([x, y, z], yaw, defenders);
// Attackers: the camp in the woods.
for (const [x, z, yaw] of [[-12, -80, 0], [-5, -86, 0], [5, -86, 0], [12, -80, 0], [-18, -72, 0.4], [18, -72, -0.4], [-6, -70, 0], [6, -70, 0]] as const) {
  m.spawn(onGround(x, z), yaw, attackers);
}
// Anyone (deathmatch): barn, shed, drain junction, the road, the west field, the hill behind the lodge.
m.spawn([-52, 4, -2], P2).spawn([30, 4, -6], 0).spawn([-24, 0, -8], P2);
m.spawn(onGround(48, 0), PI).spawn(onGround(-66, 22), P2).spawn(onGround(-4, 64), PI);

// ================================================================ pickups

// Lodge (the defenders' side): close-range kit and the marksman rifle upstairs.
m.pickup('weapon_shotgun', [-4, 4, 44]).pickup('ammo_shells', [-16, 4, 48]);
m.pickup('health_small', [16, 4, 37]).pickup('ammo_light', [17, 4, 50]);
m.pickup('weapon_smg', [-4, 8, 40]).pickup('health_small', [-14, 8, 46]).pickup('grenades', [16, 8, 42]);
m.pickup('weapon_marksman', [-16, 12, 48]).pickup('armor_small', [16, 12, 42]).pickup('ammo_rifle', [-4, 12, 44]);
// The drain: the rocket launcher in the niche off the junction, health at the mouth.
m.pickup('weapon_rockets', [-32, 0, -8]).pickup('ammo_explosive', [-8, 0, 8]).pickup('health_small', [-24, 0, -36]);
// Barn: sniper rifle in the hayloft by the window facing the lodge, big health on the floor.
m.pickup('weapon_sniper', [-45.5, 8, 2.5]).pickup('ammo_sniper', [-58.5, 8, -10.5]).pickup('health_large', [-52, 4, -4]);
// Shed: the big armour. Field: rifle by the hay cart, grenade launcher behind the old wall.
m.pickup('armor_large', [32, 4, -8]);
m.pickup('weapon_rifle', onGround(10, -10)).pickup('weapon_launcher', onGround(6, -21.5)).pickup('ammo_rifle', onGround(22, 4));
m.pickup('health_small', onGround(-30, 14)).pickup('ammo', onGround(36, 20));
// Creek: plasma under the road bridge, the LMG by the footbridge.
m.pickup('weapon_plasma', onGround(ROAD_X - 2, CREEK_Z)).pickup('ammo_cells', onGround(ROAD_X + 2, CREEK_Z + 1.5));
m.pickup('weapon_lmg', onGround(-56, -60)).pickup('health_small', onGround(-40, -60));
// Camp (the attackers' side): rifles, ammo, armour.
m.pickup('weapon_burst_rifle', onGround(-8, -78)).pickup('weapon_smg', onGround(8, -78));
m.pickup('ammo_rifle', onGround(0, -88)).pickup('armor_small', onGround(0, -72)).pickup('grenades', onGround(-14, -86));
m.pickup('health_small', onGround(ROAD_X, -84));

// ================================================================ props

const prop = (model: string, p: [number, number, number], yaw = 0, scale = 1, solid = true) => m.prop(model, p, yaw, scale, solid);
const g = (x: number, z: number) => onGround(x, z);

// Lower floor: garage, cellars, workshop.
prop('workbench', [13.2, 4, 38.5], P2).prop('shelf_boxes', [13.4, 4, 42.5], P2).prop('barrel', [13.2, 4, 51]).prop('barrel', [14.2, 4, 51]);
prop('crate_small', [19, 4, 51]).prop('crate_small', [19.1, 4.6, 51]);
m.breakable('generator', [17.6, 4, 30.5], 0);
prop('washer', [11, 4, 29.4]).prop('washer', [10, 4, 29.4]);
prop('dungeon_barrel', [-18.9, 4, 50.9]).prop('dungeon_barrel', [-17.7, 4, 50.9]).prop('dungeon_barrel', [-18.9, 4, 49.7]);
prop('bookcase_wide', [-10.3, 4, 51.1]).prop('crate_bottles', [-8.4, 4, 50.8], 0.2).prop('crate_large', [2.2, 4, 49.5], 0.3);
prop('crate_bottles', [-3, 4, 29.4]).prop('dungeon_barrel', [2.8, 4, 29.6]);
prop('workbench', [-18.8, 4, 31], P2).prop('anvil', [-16, 4, 29.5]).prop('log_stack', [-14, 4, 34.2], 0, 0.8);
prop('lantern', [-11.4, 2.4, 24], 0, 1, false).prop('lantern', [-4, 6.8, 43.6], 0, 1, false);
// Main floor: living room, kitchen, dining, study, halls, parlour.
prop('rug', [-4, 8, 44], 0, 1.4, false).prop('sofa_long', [-4, 8, 49.5], PI).prop('armchair', [-9, 8, 44], P2).prop('tv_cabinet', [-4, 8, 37], 0);
prop('bookcase', [3.1, 8, 50], -P2);
prop('fridge', [-18.9, 8, 50.8], P2).prop('stove', [-17.2, 8, 50.9], PI).prop('kitchen_cabinet', [-16.25, 8, 50.9], PI).prop('kitchen_cabinet', [-15.3, 8, 50.9], PI);
prop('table', [-16, 8, 46.6]).prop('chair', [-17.4, 8, 46.6]).prop('chair', [-14.6, 8, 46.6]);
prop('table_cloth', [-16, 8, 40], P2).prop('chair', [-17.2, 8, 39]).prop('chair', [-14.8, 8, 41]);
prop('desk', [-16, 8, 29], 0).prop('chair', [-16, 8, 30.2], PI).prop('bookcase', [-19.1, 8, 33], P2);
prop('coat_rack', [-11, 8, 34.5], 0, 1, false);
prop('table', [0, 8, 33.5], 0).prop('chair', [-1, 8, 32.5]).prop('chair', [1, 8, 32.5]);
prop('coat_rack', [19, 8, 34.6], 0, 1, false);
prop('armchair', [18.5, 8, 46], -P2).prop('side_table', [18.8, 8, 44], -P2).prop('bookcase', [13, 8, 51.1], PI);
// Upstairs: bedrooms, bathroom, the attic hall.
prop('bed', [-16, 12, 30.5], 0).prop('side_table', [-18.5, 12, 29], 0).prop('bunk_bed', [-10.8, 12, 31], 0).prop('bed', [16, 12, 30.5], 0);
prop('bathtub', [-18.4, 12, 49.5], P2).prop('toilet', [-13.5, 12, 50.9], PI);
prop('bed', [-16, 12, 41], P2).prop('desk', [13.2, 12, 49], P2).prop('bunk_bed', [19, 12, 50]).prop('rug', [-4, 12, 44], P2, 1, false);
prop('crate_small', [-10.6, 12, 50.6]).prop('chest', [3, 12, 50.8], PI);
// Deck posts, chairs, porch.
for (const x of [-19.4, -12, -4, 3.4]) prop('stone_pillar_town', [x, x === -12 || x === -4 ? 4 : G, 20.4], 0, 1.15);
prop('chair', [-17, 8, 21.5], PI).prop('chair', [1.5, 8, 21.8], PI).prop('barrel', [-19, 8, 21]);
prop('stone_pillar_town', [27.6, G, 28.4], 0, 1.15).prop('stone_pillar_town', [27.6, G, 35.6], 0, 1.15).prop('lantern_post', [21, 8, 35.2]);
// Woodpiles and the chopping block against the lodge; the outhouse lantern.
prop('woodpile', g(-22, 48), P2).prop('woodpile', g(-22, 31), P2).prop('log_stack', g(-24.5, 25), 0.3).prop('stump', g(-26, 32), 0, 1.6);
prop('lantern', [-30, 6.35, 46.9], 0, 1, false);
// Driveway: the cart, barrels under the porch, lamp posts by the road.
prop('cart', g(34, 46), P2 + 0.2).prop('barrel', g(22, 34.5)).prop('barrel', g(22.8, 33.6));
prop('lightpost', g(42.5, 26)).prop('lightpost', g(43.4, -30.6));
// Barn: hay inside and out, the hay cart, a woodpile.
prop('hay_bale', [-58.6, 4, 2], P2).prop('hay_bale', [-58.6, 4, 0.4], P2).prop('hay_bale', [-58.6, 4.8, 1.2], P2);
prop('hay_bale', [-58.8, 8, -4], P2).prop('woodpile', [-46, 4, -4.5], P2, 0.8);
prop('cart_high', g(-42, -21), 0.3).prop('hay_bale', g(-39, 6)).prop('hay_bale', g(-38.6, 7.6), 0.4);
// Shed: tools and planks.
prop('workbench', [34.9, 4, -9], -P2).prop('planks_stack', [29.5, 4, -10], 0, 0.7);
// The yard: hay bales, an old stone wall, logs and the hay cart, so both flanks get cover.
for (const [x, z, yaw] of [[-13, -29, 0.2], [-11.5, -30.4, 0.2], [-12.3, -29.7, 1.6], [16, -28, -0.3], [17.4, -26.8, -0.3], [24, -2, 0.8], [-34, -30, 0], [30, -32, 0.5]] as const) {
  prop('hay_bale', g(x, z), yaw);
}
prop('hay_bale', [-12, ground(-12, -29.5) + 0.8, -29.5], 0.2);
for (const [x, model] of [[2, 'stone_wall'], [4.2, 'stone_wall_damaged'], [6.6, 'stone_wall'], [9, 'stone_wall']] as const) prop(model, g(x, -24), 0);
prop('cart_high', g(10, -13), 0.5).prop('log_big', g(-28, 3), 0.7).prop('log_big', g(18, 9.5), -0.4);
prop('rock_large', g(-44, -32), 0.8, 1.4).prop('rock_medium', g(34, -35), 0.2, 1.3).prop('rock_large', g(28, -22), 0.4, 1.2);
// Lone field trees.
prop('oak', g(-26, 8), 0.4, 1.1).prop('oak', g(24, -16), 1.2, 1.05).prop('tree_detailed', g(-34, 24), 2.1).prop('oak', g(32, 30), 0.9, 0.95);
// The old watermill on the creek, west of the footbridge, and its stack of planks.
prop('watermill', g(-66, -36.5), P2).prop('planks_stack', g(-60, -32), 0.3, 0.8);
// Drain: pipes, a valve wheel, junk and lamps.
prop('big_pipe', [-26.4, 0, -16], 0, 0.9).prop('pipe_valve', [-21.2, 0, -18], 0, 0.8);
prop('lantern', [-27.2, 2, -36], 0, 1, false).prop('lantern', [-24, 2.6, -4.8], 0, 1, false).prop('lantern', [-11.2, 2, 0], 0, 1, false).prop('lantern', [-4.8, 2, 16], 0, 1, false);
prop('barrel', [-35, 0, -5]).prop('crate_small', [-35, 0, -11], 0.3);
// Creek: logs and rocks on the mud, posts under the bridges.
prop('log', g(8, CREEK_Z + 1), 1.4).prop('rock_medium', g(26, CREEK_Z - 2), 0.4).prop('rock_medium', g(-40, CREEK_Z + 2.4), 1.1, 0.7);
for (const bx of Object.values(BRIDGE_X)) for (const dx of [-1.3, 1.3]) for (const dz of [-3.5, 3.5]) prop('stone_pillar_town', g(bx * 8 + dx, CREEK_Z + dz));
// Camp: tents, the fire, log benches, crates.
prop('tent', g(-16, -90), 0.3).prop('tent', g(16, -90), -0.3).prop('tent', g(-22, -80), 1.2);
prop('campfire_stones', g(0, -80));
prop('log', g(-3.6, -80), 0).prop('log', g(3.6, -80), 0).prop('log', g(0, -83.6), P2);
prop('crate_large', g(20, -82), 0.4).prop('crate_small', g(21.5, -79.6)).prop('cargo_crate', g(-24, -88), 0.2).prop('lantern_post', g(10, -76));
// Camp kit: a pot on the fire, packs by the tents, a fuel can by the crates, torches at the camp's mouth.
prop('sv_cook_pot', g(0.6, -79.6), 0.5, 1, false).prop('sv_backpack', g(-13.6, -88.6), 1.2, 1, false).prop('sv_backpack', g(13.8, -88.2), -0.8, 1, false);
prop('sv_gas_can', g(18.4, -83.4), 0.3).prop('sv_torch_stand', g(-6, -76.5)).prop('sv_torch_stand', g(6, -76.5));

// Fences: the yard fence across the property (gates for the paths and the deck steps), the road fence, the creek fence.
const fenceLine = (x0: number, z0: number, x1: number, z1: number, gaps: [number, number][] = [], model = 'fence', step = 1.15) => {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const yaw = Math.atan2(-(z1 - z0), x1 - x0);
  for (let s = step / 2; s < len; s += step) {
    const x = x0 + ((x1 - x0) * s) / len;
    const z = z0 + ((z1 - z0) * s) / len;
    if (gaps.some(([a, b]) => s >= a && s <= b)) continue;
    const onCover = bands.some(([bx0, bz0, bx1, bz1]) => x > bx0 && x < bx1 && z > bz0 && z < bz1) || UNDER_RECTS.some(([bx0, bz0, bx1, bz1]) => x > bx0 && x < bx1 && z > bz0 && z < bz1);
    prop(model, [+x.toFixed(2), onCover ? 4 : ground(x, z), +z.toFixed(2)], yaw);
  }
};
fenceLine(-44, 12, 40, 12, [[13, 18], [33, 41], [50, 58]]); // gates at x -31..-26, -11..-3, 6..14
fenceLine(42, -34, 42, 10, [[18, 24]]);
fenceLine(-76, -36, -38, -36, [[4, 14.5], [24, 30]]);
fenceLine(-36, -24, -36, 12, [[14, 22]]);

// Woods: pines and oaks on the hills round the property, bushes and ferns under them, rocks and logs.
let seed = 0x5eed1e;
const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
const FENCES: P[][] = [[[-44, 12], [40, 12]], [[42, -34], [42, 10]], [[-76, -36], [-38, -36]], [[-36, -24], [-36, 12]]];
const keepOut: [number, number, number][] = [
  [CAMP[0], CAMP[1], 15],
  [-66, -36.5, 5], // the watermill
  ...m.doc.entities.filter((e) => e.kind === 'spawn' || e.kind === 'pickup').map((e) => [e.position[0], e.position[2], 3] as [number, number, number]),
];
const trees: [number, number, number][] = [];
const clear = (x: number, z: number, r: number) =>
  x > -74 && x < 66 && z > -94 && z < 78 &&
  pathDist(x, z) > 2.5 + r && roadDist(x, z) > 7 + r && Math.abs(z - CREEK_Z) > 10 + r &&
  rectDist(x, z, LODGE_RECT) > 12 + r && rectDist(x, z, [20, 16, 52, 56]) > 2 + r && rectDist(x, z, BARN_RECT) > 6 + r && rectDist(x, z, SHED_RECT) > 5 + r &&
  underDist(x, z) > 6 + r && !Object.values(BRIDGE_X).some((bx) => Math.abs(x - bx * 8) < 6 + r && z > -66 && z < -28) &&
  keepOut.every(([kx, kz, kr]) => Math.hypot(kx - x, kz - z) > kr + r) && FENCES.every((f) => lineDist(x, z, f) > 1.5 + r) &&
  trees.every(([tx, tz, tr]) => Math.hypot(tx - x, tz - z) > tr + r + 1.2);
const woodsAt = (x: number, z: number) => z < -55 || z > 58 || x < -60 || x > 56;
const TREES = ['pine', 'nt_pine_tall', 'pine_tall', 'nt_birch', 'pine_round', 'pine_crooked', 'nt_common_tree', 'oak', 'nt_pine_tall', 'nt_birch'];
for (let n = 0; n < 6000 && trees.length < 230; n++) {
  const x = -76 + rand() * 144;
  const z = -96 + rand() * 176;
  const edge = woodsAt(x, z);
  // Thin out toward the field: a ragged forest edge.
  if (!edge) continue;
  const r = 1.4 + rand() * 0.8;
  if (!clear(x, z, r)) continue;
  trees.push([x, z, r]);
  const model = TREES[Math.floor(rand() * TREES.length)]!;
  prop(model, [+x.toFixed(2), ground(x, z), +z.toFixed(2)], +(rand() * 6.28).toFixed(2), +(0.85 + rand() * 0.45).toFixed(2));
}
const UNDERGROWTH = ['bush', 'nt_bush_leafy', 'fern', 'nt_bush_berries', 'grass_tall', 'nt_fern_wide'];
let under = 0;
for (let n = 0; n < 4000 && under < 150; n++) {
  const x = -76 + rand() * 144;
  const z = -96 + rand() * 176;
  if (!woodsAt(x, z) || !clear(x, z, 0.6)) continue;
  under++;
  trees.push([x, z, -0.6]); // undergrowth can crowd trees
  prop(UNDERGROWTH[Math.floor(rand() * UNDERGROWTH.length)]!, [+x.toFixed(2), ground(x, z), +z.toFixed(2)], +(rand() * 6.28).toFixed(2), +(0.8 + rand() * 0.6).toFixed(2), false);
}
let litter = 0;
for (let n = 0; n < 3000 && litter < 60; n++) {
  const x = -76 + rand() * 144;
  const z = -96 + rand() * 176;
  if (!woodsAt(x, z) || !clear(x, z, 1)) continue;
  litter++;
  trees.push([x, z, 1]);
  const pick = rand();
  const model = pick < 0.15 ? 'nt_boulder_moss' : pick < 0.35 ? 'rock_large' : pick < 0.6 ? 'rock_medium' : pick < 0.8 ? 'log_big' : 'stump';
  prop(model, [+x.toFixed(2), ground(x, z), +z.toFixed(2)], +(rand() * 6.28).toFixed(2), +(0.9 + rand() * 0.6).toFixed(2));
}
// Flowers and tufts in the yard (walk-through).
let flowers = 0;
for (let n = 0; n < 2000 && flowers < 40; n++) {
  const x = -56 + rand() * 96;
  const z = -34 + rand() * 60;
  if (woodsAt(x, z) || !clear(x, z, 0.3) || underDist(x, z) < 6) continue;
  flowers++;
  const pick = rand();
  prop(pick < 0.3 ? 'flower_yellow' : pick < 0.5 ? 'nt_wildflowers' : pick < 0.7 ? 'flower_purple' : 'grass_tall', [+x.toFixed(2), ground(x, z), +z.toFixed(2)], +(rand() * 6.28).toFixed(2), 1, false);
}

// Bush clumps to hide in on the flanks and approaches: the barn flank, the east field by the road
// fence, the yard side of the creek and the woods' edge on the attackers' side.
{
  let bseed = 0xb0511e5;
  const brand = () => (bseed = (Math.imul(bseed, 1103515245) + 12345) >>> 0) / 4294967296;
  const CLUMPS: P[] = [[-38, 14], [-53, 24], [37, -22], [37, 2], [-16, -32], [20, -32], [-30, -58], [30, -58]];
  const BUSHES = ['nt_bush_leafy', 'nt_bush_berries', 'bush_large', 'nt_bush_leafy'];
  for (const [cx, cz] of CLUMPS) {
    let placed = 0;
    for (let n = 0; n < 40 && placed < 4; n++) {
      const a = brand() * 6.28;
      const d = placed === 0 ? 0 : 1.2 + brand() * 1.4;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (overDrain(x, z) || !clear(x, z, 0.6)) continue;
      placed++;
      trees.push([x, z, -0.6]);
      prop(BUSHES[Math.floor(brand() * BUSHES.length)]!, [+x.toFixed(2), ground(x, z), +z.toFixed(2)], +(brand() * 6.28).toFixed(2), +(1.05 + brand() * 0.3).toFixed(2), false);
    }
  }
}

// ================================================================ map settings

m.bounds('invisible', 4, { min: [-76, -96], max: [68, 80] });
// The woods close in all round: a dense tree wall past the boundary.
m.border('forest');
// Furniture in the bare rooms, for what they are in this theme.
m.furnish();
m.lightRooms();
m.meta({
  description:
    'A big wooden lodge on the high ground above a creek. Defenders hold the house: a stone lower floor with the garage and cellars, the main floor with its back deck and front porch, and upstairs bedrooms whose windows and balcony watch the whole yard. Attackers come out of the pine woods across the creek and pick a way in: straight up the yard past the barn and the hay bales, round the road to the garage doors, or through the long drain from the creek that comes up in the cellar. Sniper rifle in the barn hayloft, rockets in the drain, big armour in the shed.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [8, 16],
});
await m.save();
