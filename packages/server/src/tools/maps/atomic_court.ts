/**
 * Atomic Court: a tiny 1950s cul-de-sac in the desert (homage in spirit to
 * Call of Duty's Nuketown). Two two-storey houses face each other across the
 * street, a yellow one north and a teal one south, each with a garage beside
 * it, a lawn out front and a fenced backyard. A school bus and a box truck
 * stand in the middle of the street. The map is point-symmetric about the bus.
 *
 * Grid x east, y north (one cell = 8 m).
 *
 *   y8  .   .   .   .   .   .   .   .   .     north backyard (Embers)
 *   y7  .   .   .   N   N   .   .   .   .     N yellow house
 *   y6  .   g   g   N   N   .   .   .   .     g garage
 *   y5  .   .   .   .   .   .   .   .   .     lawns
 *   y4  =   =   =   =   =   =   =   =   =     the street: bus and truck
 *   y3  .   .   .   .   .   .   .   .   .     lawns
 *   y2  .   .   .   .   S   S   g   g   .     S teal house
 *   y1  .   .   .   .   S   S   .   .   .
 *   y0  .   .   .   .   .   .   .   .   .     south backyard (Tide)
 *       0   1   2   3   4   5   6   7   8
 */
import { TERRAIN_MATERIALS, buildOccupancy, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('atomic_court', 'Atomic Court');
m.theme('garden');
m.backdrop('clear', 'mesas', 'sand', 0.35);
m.teams([6, 6]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === 0);
  if (!t) throw new Error(`no tile at ${x},${y}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}

// ---------------------------------------------------------------- houses and garages
m.tile('house', 3, 6).tile('shop', 1, 6);
m.tile('house', 4, 1).tile('shop', 6, 2);
const built = new Set(['3,6', '4,6', '3,7', '4,7', '1,6', '2,6', '4,1', '5,1', '4,2', '5,2', '6,2', '7,2']);
for (let x = 0; x <= 8; x++) for (let y = 0; y <= 8; y++) {
  if (built.has(`${x},${y}`)) continue;
  m.tile(y === 4 ? 'street' : 'yard', x, y, 0, y === 4 ? 1 : 0);
}
const house = (tint: string): TileSurfaces => ({ walls: mat('pbr_plaster_white', tint), floor: mat('pbr_floorboards'), solids: mat('pbr_walnut'), trim: mat('pbr_plaster_white') });
paint(3, 6, house('#e6cf72'));
paint(4, 1, house('#86c4b4'));
paint(1, 6, { ...house('#e6cf72'), floor: mat('pbr_concrete') });
paint(6, 2, { ...house('#86c4b4'), floor: mat('pbr_concrete') });
for (let x = 0; x <= 8; x++) paint(x, 4, { floor: mat('pbr_asphalt') });
// The lots' sides of the house walls take the house colours too.
for (let x = 0; x <= 8; x++) for (let y = 0; y <= 8; y++) {
  if (built.has(`${x},${y}`) || y === 4) continue;
  paint(x, y, { walls: mat('pbr_plaster_white', y > 4 ? '#e6cf72' : '#86c4b4') });
}
// Picket fences round the lots; the street ends in a fence too (it's a cul-de-sac).
for (let i = 0; i <= 8; i++) {
  m.edge(0, i, 0, 'W', 'fence').edge(8, i, 0, 'E', 'fence');
  m.edge(i, 0, 0, 'S', 'fence').edge(i, 8, 0, 'N', 'fence');
}

// ---------------------------------------------------------------- the street: bus, truck and cars
const TYRES = { material: 'pbr_steel', tint: '#2a2a2a' };
const DARK = { material: 'paint_gloss', tint: '#1c2228' };
/** The school bus, east–west across the middle of the street. */
m.block([34, 0.6, 32], [10, 2.4, 2.6], 'solid', { material: 'paint_gloss', tint: '#e8b923' });
m.block([34, 1.7, 32], [9.4, 0.8, 2.66], 'solid', DARK);
m.block([39.6, 0.4, 32], [1.4, 1.6, 2.5], 'solid', { material: 'paint_gloss', tint: '#e8b923' });
for (const dx of [-3.2, 3.6]) m.block([34 + dx, 0, 32], [1.2, 0.6, 2.4], 'solid', TYRES);
/** A box truck, the other way. */
m.block([22, 1, 32], [7, 2.8, 2.5], 'solid', { material: 'pbr_white_panel' });
m.block([26.9, 0, 32], [2.6, 2.6, 2.5], 'solid', { material: 'paint_gloss', tint: '#9c2a24' });
for (const dx of [-2.5, 2.5]) m.block([22 + dx, 0, 32], [1.2, 1, 2.3], 'solid', TYRES);
function car(cx: number, cz: number, tint: string): void {
  m.block([cx, 0.25, cz], [2, 0.85, 4.4], 'solid', { material: 'paint_gloss', tint });
  m.block([cx, 1.1, cz], [1.8, 0.6, 2.2], 'solid', DARK);
  m.block([cx, 0, cz], [1.9, 0.25, 3.6], 'solid', TYRES);
}
car(12, 41, '#c4473a'); // in the north drive
car(52, 23, '#3a6fb0'); // in the south drive

// ---------------------------------------------------------------- yards
// Lawns: a tree, a mailbox post, a sign. Backyards: picnic tables, a shed, a parasol.
m.prop('tree_round', [36, 0, 41]).prop('tree_round', [28, 0, 23]).prop('bush_large', [4, 0, 37]).prop('bush_large', [60, 0, 27]);
m.prop('signpost', [21, 0, 37.5], 0).prop('signpost', [43, 0, 26.5], Math.PI);
m.prop('table', [20, 0, 65], 0).prop('parasol', [20, 0, 65], 0, 1, false).prop('table', [44, 0, -1], 0).prop('parasol', [44, 0, -1], 0, 1, false);
m.prop('bench', [8, 0, 62], P).prop('bench', [56, 0, 2], -P).prop('trashcan', [38, 0, 61]).prop('trashcan', [26, 0, 3]);
m.prop('bush', [62, 0, 52]).prop('bush', [2, 0, 12]).prop('tree_tall', [66, 0, 64]).prop('tree_tall', [-2, 0, 0]);
// Garden sheds: the north one in the east side lot, the south one in the west.
m.block([60, 0, 58], [3, 2.6, 2.4], 'solid', { material: 'pbr_planks', tint: '#a0703a' });
m.block([4, 0, 6], [3, 2.6, 2.4], 'solid', { material: 'pbr_planks', tint: '#a0703a' });
m.prop('crate_large', [52, 0, 50], 0.3).prop('crate_large', [12, 0, 14], 0.3).prop('barrel', [60, 0, 46]).prop('barrel', [4, 0, 18]);
m.breakable('gas', [16, 0, 50]).breakable('gas', [48, 0, 14]);
m.furnish('home');

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

// ---------------------------------------------------------------- spawns, flags, hills
for (const [x, z] of [[8, 66], [16, 66], [28, 66], [36, 66], [52, 64], [64, 66]] as const) m.spawn([x, 0, z], Math.PI, embers);
for (const [x, z] of [[56, -2], [48, -2], [36, -2], [28, -2], [12, 0], [0, -2]] as const) m.spawn([x, 0, z], 0, tide);
for (const [x, z, yaw] of [[0, 30, P], [64, 34, -P], [44, 44, Math.PI], [20, 20, 0], [64, 52, -P], [0, 12, P]] as const) m.spawn([x, 0, z], yaw, null);
m.flag(embers, [24, 0, 66], Math.PI).flag(tide, [40, 0, -2], 0);
m.hill([32, 0, 27], 5).hill([28, 4, 48], 4).hill([36, 4, 10], 4);

// ---------------------------------------------------------------- pickups
m.pickup('weapon_smg', [8, 0, 52]).pickup('weapon_smg', [56, 0, 12]);
m.pickup('weapon_shotgun', [24, 0, 50]).pickup('weapon_shotgun', [40, 0, 14]);
m.pickup('weapon_rifle', [12, 0, 28]).pickup('weapon_rifle', [52, 0, 36]);
m.pickup('weapon_sniper', [24, 4, 54]).pickup('ammo_sniper', [40, 4, 10]);
m.pickup('armor_large', [32, 0, 36]).pickup('health_large', [32, 0, 28.5]);
m.pickup('ammo', [4, 0, 44]).pickup('ammo', [60, 0, 20]).pickup('grenades', [44, 0, 52]).pickup('grenades', [20, 0, 12]);
m.pickup('health_small', [16, 0, 60]).pickup('health_small', [48, 0, 4]).pickup('armor_small', [64, 0, 40]).pickup('armor_small', [0, 0, 24]);

m.bounds('invisible');

// The desert round the court: a flat sandy verge, then dunes and mesas rising to the rim.
ground = sculpt(56, 6, (x, z, d) => sm(6, 34, d) * (7 + 3 * Math.sin(x / 13 + 1) * Math.cos(z / 17) + 2 * Math.sin((x + z) / 9)) + sm(30, 52, d) * 6, (x, z, d, h) => {
  if (h > 9) return ['stone', 0];
  if (d < 10) return ['dirt', 1];
  return [Math.sin(x / 7) * Math.cos(z / 9) > 0.3 ? 'dirt' : 'sand', Math.sin(x / 5 + z / 7) > 0.6 ? 1 : 0];
});
// Cacti and dead trees on the verge outside the fences.
for (let x = -2; x <= 66; x += 11) {
  plant(x % 2 ? 'nt_saguaro' : 'nt_cactus_round', x + rnd() * 3, -6.2, { r: 0.6 });
  plant(x % 3 ? 'nt_cactus_flowers' : 'nt_saguaro', x + rnd() * 3, 70.2, { r: 0.6 });
}
for (const z of [6, 22, 44, 58]) plant('nt_cactus_round', -6.2, z + rnd() * 3, { r: 0.6 }), plant('nt_cactus_flowers', 70.2, z + rnd() * 3, { r: 0.6 });
plant('nt_dead_tree', -6, 34, { r: 0.6 });
plant('nt_dead_tree', 70, 30, { r: 0.6 });
// Hedges to hide in along the flanks: the side lots and the ends of the lawns, never on the street or the flags.
const HEDGE = ['nt_bush_leafy', 'nt_bush_berries', 'bush_large'];
for (const [x, z, n] of [[2, 46, 3], [62, 18, 3], [58, 54, 4], [6, 10, 4], [2, 26, 2], [62, 38, 2], [44, 58, 2], [20, 6, 2]] as const) clump(x, z, n, 3, HEDGE);
homeFurniture(3, 6);
homeFurniture(4, 1);
m.lightRooms();
m.meta({
  description:
    'A tiny cul-de-sac in the desert: two two-storey houses face each other across a street blocked by a school bus and a truck, each with a garage, a lawn and a fenced backyard. Fast and close, for 2–12 players; the flags are in the backyards and King of the Hill moves between the bus and the two upstairs landings.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [2, 12],
});
await m.save();
