/**
 * Crossroads: a downtown block on a sunny afternoon, built from the Buildings
 * tiles. An avenue runs north–south and a street east–west, crossing in the
 * middle; each corner block holds its own buildings.
 *
 * - South (Embers): the end of the avenue, a corner shop (west) and a
 *   sandbagged bunker and a house (east). The rescue point is here.
 * - North-west: the gas station (bomb site A, open under its canopy) and a
 *   two-storey house behind it, hostages upstairs.
 * - North-east: the warehouse (bomb site B on the floor), a mezzanine with
 *   hostages, and a fire escape up the back to its upper door.
 * - North (Tide): the far end of the avenue.
 * Cars parked along the kerbs, bus-stop benches, bins and barriers give cover
 * on the open streets.
 *
 * Grid x east, y north (one cell = 8 m).
 *
 *   y9  .   H   H   .   |   .   .   .   .   .     Tide
 *   y8  .   H   H   .   |   .   .   F   .   .     H house, F fire escape
 *   y7  .   G   G   .   |   .   W   W   W   .     G gas station (A)
 *   y6  .   G   G   .   |   .   W   W   W   .     W warehouse (B)
 *   y5  .   .   .   .   |   .   .   .   .   .
 *   y4  =   =   =   =   +   =   =   =   =   =     cross street
 *   y3  .   .   .   .   |   .   .   .   h   h     h house
 *   y2  .   .   .   .   |   .   .   .   h   h
 *   y1  .   S   S   .   |   .   B   B   .   .     S shop, B bunker
 *   y0  .   .   .   .   |   .   .   .   .   .     Embers
 *       0   1   2   3   4   5   6   7   8   9
 */
import { TERRAIN_MATERIALS, buildOccupancy, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('crossroads', 'Crossroads');
m.theme('city');
m.backdrop('clear', 'city', 'gravel', 0.4);
m.teams([8, 8]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0): [number, number, number] => [x * 8 + dx, z * 4, y * 8 + dy];

// ---------------------------------------------------------------- buildings
m.tile('shop', 1, 1);
m.tile('bunker', 6, 1);
m.tile('house', 8, 2);
m.tile('gas_station', 1, 6);
m.tile('house', 1, 8);
m.tile('warehouse', 6, 6);
m.tile('stairs_open', 7, 8, 0, 1); // from (7,9) up south to the warehouse's upper door
const built = new Set(['1,1', '2,1', '6,1', '7,1', '8,2', '9,2', '8,3', '9,3', '1,6', '2,6', '1,7', '2,7', '1,8', '2,8', '1,9', '2,9', '6,6', '7,6', '8,6', '6,7', '7,7', '8,7', '7,8']);

// ---------------------------------------------------------------- streets and lots
for (let x = 0; x <= 9; x++) for (let y = 0; y <= 9; y++) {
  if (built.has(`${x},${y}`)) continue;
  if (x === 4 && y === 4) m.tile('intersection', x, y);
  else if (x === 4) m.tile('street', x, y, 0, 0);
  else if (y === 4) m.tile('street', x, y, 0, 1);
  else m.tile('yard', x, y);
}

// No wall round the edge: the streets run on into the city beyond.
for (let i = 0; i <= 9; i++) {
  if (!built.has(`0,${i}`)) m.edge(0, i, 0, 'W', 'open');
  if (!built.has(`9,${i}`)) m.edge(9, i, 0, 'E', 'open');
  if (!built.has(`${i},0`)) m.edge(i, 0, 0, 'S', 'open');
  if (!built.has(`${i},9`)) m.edge(i, 9, 0, 'N', 'open');
}

// ---------------------------------------------------------------- cars (free blocks)
const TYRES = { material: 'pbr_steel', tint: '#2a2a2a' };
const GLASS = { material: 'paint_gloss', tint: '#2c3640' };
/** A parked car: `ns` lies north–south. */
function car(cx: number, cz: number, ns: boolean, tint: string): void {
  const [w, l] = ns ? [2, 4.4] : [4.4, 2];
  m.block([cx, 0.25, cz], [w, 0.85, l], 'solid', { material: 'paint_gloss', tint });
  m.block([cx, 1.1, cz], ns ? [1.8, 0.6, 2.2] : [2.2, 0.6, 1.8], 'solid', GLASS);
  m.block([cx, 0, cz], ns ? [1.9, 0.25, 3.6] : [3.6, 0.25, 1.9], 'solid', TYRES);
}
// Along the avenue (road x 29.4..34.6), leaving a lane each way.
car(30.5, 9, true, '#9c2a24');
car(33.5, 20, true, '#2a4a7a');
car(30.5, 44, true, '#d8d2c4');
car(33.5, 58, true, '#3e6b3a');
car(30.6, 66, true, '#c9a227');
// Along the cross street (road z 29.4..34.6).
car(9, 30.5, false, '#2a2a2e');
car(20, 33.5, false, '#7a2a6a');
car(44, 30.5, false, '#d8d2c4');
car(60, 33.5, false, '#9c2a24');
car(70, 30.6, false, '#2a4a7a');
// A box truck backed up to the warehouse.
m.block([72, 1, 46], [2.5, 2.8, 7], 'solid', { material: 'pbr_white_panel' });
m.block([72, 0, 40.6], [2.5, 2.8, 2.6], 'solid', { material: 'paint_gloss', tint: '#2a4a7a' });
for (const dz of [-2.5, 2.5]) m.block([72, 0, 46 + dz], [2.3, 1, 1.2], 'solid', TYRES);

// ---------------------------------------------------------------- spawns
for (const [x, z] of [[24, -2], [27, 1], [32, -2], [37, 1], [40, -2], [44, 2], [20, 2], [32, 3]] as const) m.spawn([x, 0, z], 0, embers);
for (const [x, z] of [[24, 72], [27, 69], [32, 74], [37, 70], [40, 74], [44, 72], [23, 70], [48, 74]] as const) m.spawn([x, 0, z], Math.PI, tide);
m.spawn(at(0, 2), P, null).spawn(at(9, 0), -P, null).spawn(at(0, 6), P, null).spawn(at(9, 8), -P, null).spawn(at(5, 5), 0, null).spawn(at(3, 3), Math.PI, null);

// ---------------------------------------------------------------- objectives
m.add({ kind: 'bombsite', position: [12, 0, 52], label: 'A', radius: 6 });
m.add({ kind: 'bombsite', position: [52, 0, 50], label: 'B', radius: 6 });
// Hostage Rescue: two upstairs in the north-west house, two on the warehouse mezzanine; Embers bring them to the south end.
m.hostage([8, 4, 63], Math.PI).hostage([15, 4, 63], Math.PI).hostage([52, 4, 57], Math.PI).hostage([62, 4, 57], Math.PI);
m.rescue([32, 0, 0], 5);

// ---------------------------------------------------------------- pickups
m.pickup('weapon_smg', at(0, 0)).pickup('weapon_shotgun', at(9, 1));
m.pickup('weapon_rifle', at(3, 5)).pickup('weapon_burst_rifle', at(5, 3));
m.pickup('weapon_sniper', at(8, 7, 1, 0, 2)); // on the warehouse mezzanine
m.pickup('weapon_rockets', at(4, 4, 0, 0, 0), 45); // in the middle of the crossroads
m.pickup('armor_large', at(1, 8, 1, 4, -2)).pickup('armor_small', at(6, 2)).pickup('armor_small', at(3, 7));
m.pickup('health_large', at(7, 5)).pickup('health_small', at(1, 2, 0, 0, 2)).pickup('health_small', at(0, 9)).pickup('health_small', at(9, 9));
m.pickup('ammo', at(2, 0)).pickup('ammo', at(7, 0)).pickup('ammo_rifle', at(0, 5)).pickup('ammo_rifle', at(8, 5));
m.pickup('ammo_shells', at(5, 7)).pickup('ammo_sniper', at(7, 9)).pickup('grenades', at(3, 2)).pickup('grenades', at(5, 9));

// ---------------------------------------------------------------- props
// Street furniture: bus stops, bins, planters, barriers by the crossing.
m.prop('bench', [37.5, 0.15, 13], -P).prop('bench', [26.5, 0.15, 52], P).prop('trashcan', [37.4, 0.15, 17]).prop('trashcan', [26.6, 0.15, 47]);
m.prop('trashcan', [13, 0.15, 37.4]).prop('trashcan', [51, 0.15, 26.6]).prop('potted_plant', [37.5, 0.15, 37.5]).prop('potted_plant', [26.5, 0.15, 26.5]);
m.prop('barrier', [38, 0, 24], P).prop('barrier', [26, 0, 40], P).prop('cone', [31, 0, 25], 0, 1, false).prop('cone', [33, 0, 39], 0, 1, false);
m.prop('signpost', [37.6, 0.15, 26.4], Math.PI).prop('awning', [16, 0, 4.6], 0).prop('shopping_cart', [5, 0, 2], 0.4);
// The lots: a skip and pallets behind the shop, crates round the bunker, a tree line on the west edge.
m.prop('skip', [10, 0, 22], 0).prop('cardboard_box', [14, 0, 21]).prop('factory_box', [18, 0, 18], 0.2);
m.prop('crate_large', [44, 0, 14], 0.2).prop('cargo_crate', [62, 0, 2], -0.3).prop('barrel', [42, 0, 4]).prop('barrel', [43, 0, 4.8]);
m.prop('crate_large', [40, 0, 54]).prop('cargo_crate', [44, 0, 42], 0.3).prop('barrel_open', [76, 0, 60]).prop('skip', [66, 0, 70], P);
m.prop('cargo_crate', [20, 0, 42], 0.1).prop('barrier_high', [6, 0, 42], 0).prop('dungeon_barrel', [18, 0, 46]);
for (const z of [12, 22, 44, 58]) m.prop('tree_round', [-2.5, 0, z], 0);
for (const [x, z] of [[-2.5, 30], [76.5, 22], [76.5, 54], [8, 76.5], [56, 76.5]] as const) m.prop('lightpost', [x, 0, z], 0);
m.breakable('gas', [6, 0, 58]);
m.breakable('glass', [14, 0, 10.2]);

// ---------------------------------------------------------------- interiors, dressed for what they are (clear of the doors, spawns, pickups and hostages)
m.dress([1, 1, 0], 'shop', { density: 'full' }).dress([6, 1, 0], 'armoury');
for (const [x, y] of [[8, 2], [1, 8]] as const) m.dress([x, y, 0], 'living', { density: 'full' }).dress([x, y, 1], 'bedroom', { density: 'full' });
m.dress([6, 6, 0], 'warehouse').dress([6, 7, 1], 'storage');

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
// Past the block: a level verge where the streets run out, then rough ground, earth banks and grassy rises on the edge of town.
ground = sculpt(56, 9, (x, z, d) => sm(9, 36, d) * (4.5 + 2 * Math.sin(x / 12) * Math.cos(z / 15) + 1.2 * Math.sin((x + 2 * z) / 8)) + sm(30, 52, d) * 7, (x, z, d, h) => {
  if (h > 10) return ['grass', 4];
  if (d < 12) return ['gravel', 0];
  if (d < 18) return ['dirt', 1];
  return [Math.cos(x / 11) * Math.sin(z / 9) > 0.4 ? 'dirt' : 'grass', 3];
});
// Street trees on the verge, and hedges in the lots for flankers (corners and backs of the lots, off the streets and objectives).
for (const [x, z] of [[-6, 4], [-6, 52], [-6, 70], [78, 6], [78, 40], [78, 72], [18, 78.5], [64, 78.5], [14, -6], [52, -6], [70, -6]] as const) plant(['nt_common_tree_2', 'nt_birch', 'nt_common_tree'][Math.abs(Math.round(x + z)) % 3]!, x, z, { r: 0.8 });
const HEDGE = ['bush_large', 'nt_bush_leafy', 'bush'];
for (const [x, z] of [[2, 18], [20, 22], [60, 14], [70, 2], [4, 38], [58, 42], [44, 60], [22, 74], [70, 64], [60, 76], [42, 22], [2, 56]] as const) clump(x, z, 3, 2.5, HEDGE);
homeFurniture(8, 2);
homeFurniture(1, 8);
m.lightRooms();
m.meta({
  description:
    'A downtown block where an avenue crosses a street. Embers come up from the south past a corner shop and a sandbagged bunker; Tide hold the north. Bomb site A is the gas station under its canopy, B the warehouse floor; in Hostage Rescue the hostages wait upstairs in the house and on the warehouse mezzanine. Parked cars, bus stops and barriers are the cover on the open streets, and a fire escape climbs to the warehouse’s upper door.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [8, 16],
});
await m.save();
