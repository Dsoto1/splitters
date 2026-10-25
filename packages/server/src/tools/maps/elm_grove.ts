/**
 * Elm Grove: a cul-de-sac of five homes off a main street (homage in spirit
 * to the Grove Street of San Andreas). Embers hold the turnaround at the end
 * of the grove; Tide come off the main street, past the corner shop and the
 * gas station. Two-storey houses with gardens either side of the road, side
 * yards to slip between them, and the street itself for the brave.
 *
 * Grid x east, y north (one cell = 8 m).
 *
 *   y9  .   .   .   E   E   .   .   .   .   .     E the end house
 *   y8  .   .   .   E   E   .   .   .   .   .     (Embers in the back gardens)
 *   y7  .   .   .   o   o   o   .   .   .   .     o the turnaround
 *   y6  .   .   .   .   |   D   D   .   .   .
 *   y5  .   .   B   B   |   D   D   .   .   .     houses B, D
 *   y4  .   .   B   B   |   .   .   .   .   .
 *   y3  .   .   .   .   |   C   C   .   .   .     house C
 *   y2  s   s   A   A   |   C   C   G   G   .     s corner shop, A house, G gas station
 *   y1  .   .   A   A   |   .   .   G   G   .
 *   y0  =   =   =   =   +   =   =   =   =   =     the main street (Tide)
 *       0   1   2   3   4   5   6   7   8   9
 */
import { TERRAIN_MATERIALS, buildOccupancy, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('elm_grove', 'Elm Grove');
m.theme('garden');
m.backdrop('sunset', 'hills', 'grass', 0.45);
m.teams([8, 8]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === 0);
  if (!t) throw new Error(`no tile at ${x},${y}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}

// ---------------------------------------------------------------- houses, shop, gas station
const HOUSES: [number, number, string][] = [[2, 1, '#e8b4a0'], [2, 4, '#a8c8e0'], [5, 2, '#e6d690'], [5, 5, '#b8d8a8'], [3, 8, '#d8b8d8']];
const built = new Set<string>();
for (const [x, y] of HOUSES) {
  m.tile('house', x, y);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) built.add(`${x + dx},${y + dy}`);
}
m.tile('shop', 0, 2).tile('gas_station', 7, 1);
for (const c of ['0,2', '1,2', '7,1', '8,1', '7,2', '8,2']) built.add(c);
for (let x = 0; x <= 9; x++) for (let y = 0; y <= 9; y++) {
  if (built.has(`${x},${y}`)) continue;
  if (x === 4 && y === 0) m.tile('intersection', x, y);
  else if (y === 0) m.tile('street', x, y, 0, 1);
  else if (x === 4 && y <= 6) m.tile('street', x, y, 0, 0);
  else m.tile('yard', x, y);
}
for (const [x, y, tint] of HOUSES) paint(x, y, { walls: mat('pbr_plaster_white', tint), floor: mat('pbr_floorboards'), solids: mat('pbr_walnut'), trim: mat('pbr_plaster_white') });
paint(0, 2, { walls: mat('pbr_brick_red'), floor: mat('pbr_terrazzo') });
// The streets' and gardens' side of the house walls: cream render, not the theme's brick.
for (let x = 0; x <= 9; x++) for (let y = 1; y <= 9; y++) if (!built.has(`${x},${y}`)) paint(x, y, { walls: mat('pbr_plaster_white', '#e8e0cc') });
for (let x = 0; x <= 9; x++) if (x !== 4) paint(x, 0, { floor: mat('pbr_asphalt') });
for (let y = 1; y <= 6; y++) paint(4, y, { floor: mat('pbr_asphalt') });
for (const x of [3, 4, 5]) paint(x, 7, { floor: mat('pbr_asphalt') });
paint(7, 1, { floor: mat('pbr_concrete') });
// Fences round the back gardens; the main street runs on out of the map.
for (let i = 0; i <= 9; i++) {
  if (!built.has(`0,${i}`) && i > 0) m.edge(0, i, 0, 'W', 'fence');
  if (!built.has(`9,${i}`) && i > 0) m.edge(9, i, 0, 'E', 'fence');
  if (!built.has(`${i},9`)) m.edge(i, 9, 0, 'N', 'fence');
  m.edge(i, 0, 0, 'S', 'high');
}
m.edge(0, 0, 0, 'W', 'open').edge(9, 0, 0, 'E', 'open');
// The grove's houses look onto the road: windows along it, a front door into each east house.
for (let y = 1; y <= 6; y++) {
  if (built.has(`3,${y}`) && y !== 1 && y !== 4) m.edge(4, y, 0, 'W', 'window');
  if (built.has(`5,${y}`)) m.edge(4, y, 0, 'E', y === 2 || y === 5 ? 'door' : 'window');
}
// Garden fences between some neighbours, so the side yards are lanes, not a field.
m.edge(1, 4, 0, 'N', 'fence').edge(0, 4, 0, 'N', 'fence').edge(7, 4, 0, 'N', 'fence').edge(8, 4, 0, 'N', 'fence');
m.edge(7, 7, 0, 'E', 'fence').edge(1, 7, 0, 'E', 'fence');

// ---------------------------------------------------------------- cars, gardens, street furniture
const TYRES = { material: 'pbr_steel', tint: '#2a2a2a' };
const DARK = { material: 'paint_gloss', tint: '#1c2228' };
function car(cx: number, cz: number, ns: boolean, tint: string): void {
  const [w, l] = ns ? [2, 4.4] : [4.4, 2];
  m.block([cx, 0.25, cz], [w, 0.85, l], 'solid', { material: 'paint_gloss', tint });
  m.block([cx, 1.1, cz], ns ? [1.8, 0.6, 2.2] : [2.2, 0.6, 1.8], 'solid', DARK);
  m.block([cx, 0, cz], ns ? [1.9, 0.25, 3.6] : [3.6, 0.25, 1.9], 'solid', TYRES);
}
car(30.5, 14, true, '#5a2a7a'); // lowrider purple
car(33.5, 26, true, '#2a7a3a'); // grove green
car(30.5, 40, true, '#c8c8c8');
car(27, 57, false, '#9c2a24');
car(14, 1.5, false, '#2a4a7a');
car(52, -1.5, false, '#d8d2c4');
car(66, 13, true, '#c9a227'); // at the pumps
for (const [x, z] of [[10, 30], [56, 44], [70, 30], [14, 66], [60, 64], [-1, 52], [76, 58], [44, 14]] as const) m.prop('tree_round', [x, 0, z]);
for (const [x, z] of [[8, 46], [52, 70], [70, 46]] as const) m.prop('table', [x, 0, z], 0).prop('bench', [x, 0, z - 1.4], 0);
m.prop('stove', [10, 0, 44], 0).prop('parasol', [52, 0, 70], 0, 1, false).prop('bush_large', [42, 0, 30]).prop('bush_large', [20, 0, 30]);
m.prop('trashcan', [27, 0, 3.6]).prop('trashcan', [37, 0, 12]).prop('bench', [20, 0, 3.5], Math.PI).prop('shopping_cart', [6, 0, 8], 0.5);
m.prop('skip', [74, 0, 6], P).prop('barrier', [36.5, 0, 50], P).prop('cone', [27.5, 0, 50], 0, 1, false).prop('signpost', [36.6, 0, 4.6], Math.PI);
m.prop('crate_large', [44, 0, 42], 0.3).prop('barrel', [76, 0, 38]).prop('dungeon_barrel', [-2, 0, 40]).prop('cardboard_box', [2, 0, 26]);
m.breakable('gas', [62, 0, 10]).breakable('gas', [70, 0, 14]).breakable('glass', [4, 0, 12.2]);
m.furnish('home');

// ---------------------------------------------------------------- spawns, flags, hills
for (const [x, z] of [[4, 64], [10, 70], [16, 74], [44, 66], [52, 74], [60, 70], [68, 74], [24, 58]] as const) m.spawn([x, 0, z], Math.PI, embers);
for (const [x, z] of [[4, 0], [12, 0], [20, 0], [28, 1], [40, 0], [48, 0], [60, 0], [72, 0]] as const) m.spawn([x, 0, z], 0, tide);
for (const [x, z, yaw] of [[0, 24, P], [72, 24, -P], [40, 34, 0], [8, 56, 0], [72, 62, Math.PI], [56, 30, 0]] as const) m.spawn([x, 0, z], yaw, null);
m.flag(embers, [32, 0, 58], Math.PI).flag(tide, [32, 0, -1], 0);
m.hill([32, 0, 30], 6).hill([8, 0, 30], 5).hill([60, 0, 32], 5);

// ---------------------------------------------------------------- pickups
m.pickup('weapon_smg', [8, 0, 20]).pickup('weapon_smg', [60, 0, 54]).pickup('weapon_shotgun', [44, 0, 34]).pickup('weapon_shotgun', [20, 0, 26]);
m.pickup('weapon_rifle', [72, 0, 40]).pickup('weapon_rifle', [0, 0, 44]).pickup('weapon_sniper', [20, 4, 40]).pickup('weapon_rockets', [32, 0, 46], 60);
m.pickup('armor_large', [56, 0, 20]).pickup('armor_small', [24, 0, 70]).pickup('armor_small', [48, 0, 4]).pickup('health_large', [12, 0, 50]);
m.pickup('health_small', [68, 0, 54]).pickup('health_small', [0, 0, 8]).pickup('ammo', [40, 0, 58]).pickup('ammo', [24, 0, 4]);
m.pickup('ammo_rifle', [72, 0, 20]).pickup('ammo_shells', [8, 0, 38]).pickup('ammo_sniper', [48, 4, 48]).pickup('grenades', [36, 0, 22]).pickup('grenades', [56, 0, 62]);

// ---------------------------------------------------------------- ground and planting (after the boundary is set)
const sm = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/**
 * Terrain under and round what is built: sunk 3.6 m under every built cell
 * (below the lowest level built there, so nothing standing or hung over a
 * floor counts as floating), level within `flat` m of
 * the tiles, free blocks and entities, then `shape(x, z, d)` further out (d:
 * metres from the nearest of them). `cover(x, z, d, h)` gives each terrain
 * cell's ground and plant cover (0–4); cells under or against the buildings
 * stay bare so no grass pokes through a floor. Reaches `margin` m past the boundary.
 */
function sculpt(margin: number, flat: number, shape: (x: number, z: number, d: number) => number, cover: (x: number, z: number, d: number, h: number) => [TerrainMaterial, number]): TerrainData {
  const b = m.doc.bounds!;
  const x0 = Math.floor((b.min[0] - margin) / 4) * 4;
  const z0 = Math.floor((b.min[1] - margin) / 4) * 4;
  const cols = Math.min(161, Math.ceil((b.max[0] + margin - x0) / 2) + 1);
  const rows = Math.min(161, Math.ceil((b.max[1] + margin - z0) / 2) + 1);
  const low = new Map<string, number>();
  const rects: [number, number, number, number][] = [];
  for (const key of buildOccupancy(m.doc).cells.keys()) {
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number];
    const col = `${gx},${gy}`;
    if (!low.has(col)) rects.push([gx * 8 - 4, gy * 8 - 4, gx * 8 + 4, gy * 8 + 4]);
    low.set(col, Math.min(low.get(col) ?? Infinity, gz));
  }
  const points: [number, number][] = [];
  for (const e of m.doc.entities) {
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
      // The cells this vertex touches: under any of them the ground drops away under the lowest level.
      // On the outer edge of ground-floor cells it meets the floor's top, so the ground outside stays level.
      let under = Infinity;
      let edge = false;
      for (const gx of new Set([Math.floor((x + 4) / 8), Math.ceil((x - 4) / 8)])) for (const gy of new Set([Math.floor((z + 4) / 8), Math.ceil((z - 4) / 8)])) {
        const lz = low.get(`${gx},${gy}`);
        if (lz !== undefined && lz <= 0) under = Math.min(under, lz * 4 - 3.6);
        else edge = true;
      }
      if (edge && under === -3.6) under = 0;
      const d = dist(x, z);
      const h = under < Infinity ? under : d <= flat ? 0 : shape(x, z, d);
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
const groundY = (x: number, z: number) => (ground ? +(Math.max(0, terrainHeightAt(ground, x, z) ?? 0)).toFixed(2) : 0);
let cells: ReturnType<typeof buildOccupancy>['cells'] | null = null;
/** Out in the open at (x, y, z), and the same a metre round: on no tile, or on a yard, street or plaza (never in a building). */
function outdoors(x: number, y: number, z: number): boolean {
  cells ??= buildOccupancy(m.doc).cells;
  return [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].every(([dx, dz]) => {
    const c = cells!.get(`${Math.round((x + dx!) / 8)},${Math.round((z + dz!) / 8)},${Math.floor((y + 0.01) / 4)}`);
    return !c || /yard$|street|plaza|intersection|crossroads/.test(c.placement.tile);
  });
}
/** Plant one piece on the ground (or on a floor at `y`; `inside` for furniture) if there is room; returns whether it went in. */
function plant(model: string, x: number, z: number, o: { y?: number; yaw?: number; scale?: number; r?: number; inside?: boolean } = {}): boolean {
  const y = o.y ?? groundY(x, z);
  if (!o.inside && !outdoors(x, y, z)) return false;
  if (!free(x, y, z, o.r ?? 1)) return false;
  m.prop(model, [+x.toFixed(2), y, +z.toFixed(2)], +(o.yaw ?? rnd() * 6.28).toFixed(2), +(o.scale ?? 0.85 + rnd() * 0.35).toFixed(2));
  // Keep later checks honest: what is planted now counts as taken.
  (m as unknown as { flush(): void }).flush();
  return true;
}
/** A clump of `n` bushes (players can hide in them) round (x, z), `spread` m across. */
function clump(x: number, z: number, n: number, spread: number, kinds: string[], y?: number): void {
  for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
    const a = rnd() * 6.28;
    const s = Math.sqrt(rnd()) * spread;
    if (plant(kinds[(i + tries) % kinds.length]!, x + Math.cos(a) * s, z + Math.sin(a) * s, { y, r: 0.6 })) i++;
  }
}
/** Furniture for a House tile (turned 0) at cell (cx, cy): the kitchen, the living room and the bedroom upstairs, against the walls. */
function homeFurniture(cx: number, cy: number): void {
  const put = (model: string, lx: number, y: number, lz: number, yaw: number, r = 0.5) => plant(model, cx * 8 + lx, cy * 8 + lz, { y, yaw, scale: 1, r, inside: true });
  put('hm_fridge', 11.05, 0, 3.1, -Math.PI / 2);
  put('hm_rug', 0, 0.01, -0.6, 0);
  put('hm_floor_lamp', 3.2, 0, -3.2, 0);
  put('hm_bookshelf', -3.3, 0, 2.2, Math.PI / 2);
  put('hm_houseplant_tall', 3.2, 0, 3.2, 0);
  put('hm_nightstand', -0.55, 4, -3.1, 0);
  put('hm_houseplant', 10.9, 4, 0.6, 0);
}

m.bounds('invisible');
// The hills round the grove: a level verge past the fences, then grassy slopes climbing to wooded ridges, with a ditch along the far side of the main street.
ground = sculpt(56, 7, (x, z, d) => {
  const hills = sm(7, 40, d) * (8 + 3 * Math.sin(x / 15 + 0.5) * Math.cos(z / 19) + 1.5 * Math.cos((x - z) / 11));
  const ditch = z < -8 ? -1.2 * sm(7, 11, d) * (1 - sm(14, 18, d)) : 0;
  return hills + ditch + sm(34, 54, d) * 5;
}, (x, z, d, h) => {
  if (h > 12) return ['moss', 4];
  if (h < -0.3) return ['mud', 2];
  if (d < 10) return ['grass', 2];
  return [Math.sin(x / 9 + z / 13) > 0.75 ? 'dirt' : 'grass', 3 + (Math.cos(x / 7) * Math.sin(z / 5) > 0.2 ? 1 : 0)];
});
// Trees along the verge outside the back fences and at the ends of the main street.
for (let x = -2; x <= 74; x += 10) plant(['nt_common_tree', 'nt_birch', 'nt_common_tree_2'][Math.round(x / 10) % 3]!, x + rnd() * 3, 78.2, { r: 0.8 });
for (let z = 10; z <= 72; z += 12) plant(z % 24 ? 'nt_birch' : 'nt_willow', -6.2, z + rnd() * 2, { r: 0.8 }), plant(z % 24 ? 'nt_common_tree_2' : 'nt_birch', 78.4, z + rnd() * 2, { r: 0.8 });
// Hedges to hide in: the side yards and back gardens the flankers use, the garden corners off the road. None on the road, the flags or the hills.
const HEDGE = ['nt_bush_leafy', 'nt_bush_berries', 'bush_large', 'bush'];
for (const [x, z] of [[2, 30], [-1, 48], [9, 60], [70, 26], [76, 48], [62, 72], [58, 28], [14, 40], [36, 70], [74, 70], [2, 74], [22, 50], [50, 34], [66, 40]] as const) clump(x, z, 3, 3, HEDGE);
for (const [x, y] of HOUSES) homeFurniture(x, y);
m.lightRooms();
m.meta({
  description:
    'A cul-de-sac of five homes off a main street at sunset. Embers hold the turnaround at the end of the grove, Tide come off the main street past the corner shop and the gas station. Two-storey houses with gardens either side of the road, side yards to slip between them, and the road itself for the brave.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [6, 16],
});
await m.save();
