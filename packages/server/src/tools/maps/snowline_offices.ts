/**
 * Snowline Offices: an office block on a snowy night (homage in spirit to
 * Counter-Strike's cs_office). Embers come in from the front lot to rescue
 * the hostages Tide hold at the back: two in the conference room, one in the
 * server room, one in an office off the middle.
 *
 * - The front: a lobby behind glass and a wide door, offices either side.
 * - Inside: two long corridors (front and back) joined by side corridors at
 *   each end and by doors through the middle row of offices; glass walls
 *   along the back corridor.
 * - The back: the conference room, a break room, the server room and the
 *   garage hall, whose wide door opens onto the parking garage.
 * - Outside: snowy alleys down both sides from the front lot to the garage,
 *   with a side door into each end of the building.
 *
 * Grid x east, y north (one cell = 8 m).
 *
 *   y8  .   P   P   P   P   P   P   P   .     P parking garage
 *   y7  .   P   P   P   P   P   P   P   .
 *   y6  a   o   C   C   G   b   s   o   a     C conference, G garage hall, b break room, s server room
 *   y5  a   =   =   =   =   =   =   =   a     back corridor
 *   y4  a   |   o   o   o   o   o   |   a     | side corridors, o offices
 *   y3  a   =   =   =   =   =   =   =   a     front corridor
 *   y2  a   o   o   L   L   o   o   o   a     L lobby
 *   y1  .   .   .   .   .   .   .   .   .     front lot (Embers)
 *   y0  .   .   .   .   .   .   .   .   .
 *       0   1   2   3   4   5   6   7   8     a alleys
 */
import { TERRAIN_MATERIALS, buildOccupancy, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial, type Side, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('snowline_offices', 'Snowline Offices');
m.theme('lab');
m.backdrop('snowy', 'city', 'snow', 0.6);
m.teams([6, 6]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, surfaces: TileSurfaces, z = 0): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
type Style = Parameters<typeof m.edge>[4];

// ---------------------------------------------------------------- the building: every cell a room, walls set below
const inside = (x: number, y: number) => x >= 1 && x <= 7 && y >= 2 && y <= 6;
/** Corridors, the lobby and the garage hall: tiled, and left unfurnished. */
const isHall = (x: number, y: number) => y === 3 || y === 5 || (y === 2 && (x === 3 || x === 4)) || ((x === 1 || x === 7) && y === 4) || (x === 4 && y === 6);
// The block's outside walls in painted plaster.
for (let x = 0; x <= 8; x++) for (let y = 0; y <= 8; y++) m.tile(inside(x, y) ? 'room' : 'yard', x, y, 0, 0, inside(x, y) ? { facade: 'plaster' } : undefined);
// A flat roof over the whole block.
m.fill('platform', 1, 2, 7, 6, 1);

// Outside walls: windows, except the doors.
const doors: Record<string, Style> = {
  '3,2,S': 'wide', '4,2,S': 'windows', '5,2,S': 'door', // the front: the lobby's doors, a side office door
  '1,3,W': 'door', '7,5,E': 'door', // side doors from the alleys
  '4,6,N': 'wide', '2,6,N': 'wall', '3,6,N': 'wall', '6,6,N': 'wall', // the garage door; blind walls at the back
};
for (let x = 1; x <= 7; x++) for (let y = 2; y <= 6; y++) {
  const sides: [Side, boolean][] = [['S', y === 2], ['N', y === 6], ['W', x === 1], ['E', x === 7]];
  for (const [side, out] of sides) if (out) m.edge(x, y, 0, side, doors[`${x},${y},${side}`] ?? 'windows');
}
// Inside: corridors run open; offices get doors, glass or walls.
const east: Record<string, Style> = {
  '1,2': 'wall', '2,2': 'door', '3,2': 'open', '4,2': 'door', '5,2': 'wall', '6,2': 'door',
  '1,4': 'door', '2,4': 'wall', '3,4': 'door', '4,4': 'wall', '5,4': 'door', '6,4': 'door',
  '1,6': 'wall', '2,6': 'open', '3,6': 'wall', '4,6': 'door', '5,6': 'wall', '6,6': 'door',
};
for (let x = 1; x <= 6; x++) {
  for (const y of [3, 5]) m.edge(x, y, 0, 'E', 'open');
  for (const y of [2, 4, 6]) m.edge(x, y, 0, 'E', east[`${x},${y}`]!);
}
const north: Record<string, Style> = {
  '1,2': 'door', '2,2': 'door', '3,2': 'arch', '4,2': 'arch', '5,2': 'door', '6,2': 'wall', '7,2': 'door',
  '1,3': 'open', '2,3': 'door', '3,3': 'wall', '4,3': 'door', '5,3': 'wall', '6,3': 'door', '7,3': 'open',
  '1,4': 'open', '2,4': 'windows', '3,4': 'door', '4,4': 'windows', '5,4': 'door', '6,4': 'windows', '7,4': 'open',
  '1,5': 'door', '2,5': 'door', '3,5': 'windows', '4,5': 'wide', '5,5': 'door', '6,5': 'door', '7,5': 'wall',
};
for (let x = 1; x <= 7; x++) for (let y = 2; y <= 5; y++) m.edge(x, y, 0, 'N', north[`${x},${y}`]!);

// Surfaces: carpet in the offices, tiles in the corridors and lobby, snow and asphalt outside.
for (let x = 0; x <= 8; x++) for (let y = 0; y <= 8; y++) {
  if (inside(x, y)) {
    paint(x, y, { floor: isHall(x, y) ? mat('pbr_terrazzo') : mat('pbr_carpet', '#5a6478'), walls: mat('pbr_plaster_white', '#e4e0d6') });
  } else paint(x, y, { floor: y >= 7 && x >= 1 && x <= 7 ? mat('pbr_asphalt') : mat('pbr_snow'), walls: mat('pbr_concrete') });
}
// The roof: white ceiling panels underneath, gravel on top.
for (let x = 1; x <= 7; x++) for (let y = 2; y <= 6; y++) paint(x, y, { underside: mat('pbr_plaster_white', '#ecebe6'), solids: mat('pbr_plaster_white', '#ecebe6'), floor: mat('pbr_gravel') }, 1);
// The lot and the garage are walled in.
for (let i = 0; i <= 8; i++) {
  m.edge(0, i, 0, 'W', 'high').edge(8, i, 0, 'E', 'high');
  m.edge(i, 0, 0, 'S', 'fence').edge(i, 8, 0, 'N', 'high');
}

// ---------------------------------------------------------------- outside: cars in the lot and the garage
const TYRES = { material: 'pbr_steel', tint: '#2a2a2a' };
const DARK = { material: 'paint_gloss', tint: '#1c2228' };
function car(cx: number, cz: number, ns: boolean, tint: string): void {
  const [w, l] = ns ? [2, 4.4] : [4.4, 2];
  m.block([cx, 0.25, cz], [w, 0.85, l], 'solid', { material: 'paint_gloss', tint });
  m.block([cx, 1.1, cz], ns ? [1.8, 0.6, 2.2] : [2.2, 0.6, 1.8], 'solid', DARK);
  m.block([cx, 0, cz], ns ? [1.9, 0.25, 3.6] : [3.6, 0.25, 1.9], 'solid', TYRES);
}
car(12, 4, true, '#3a6fb0');
car(52, 3, true, '#c8c8c8');
car(10, 60, true, '#7a2a24');
car(18, 66, true, '#2a2a2e');
car(46, 66, true, '#3e6b3a');
car(54, 60, true, '#c9a227');
m.prop('barrier', [28, 0, -2], 0).prop('barrier', [44, 0, -2], 0).prop('lightpost', [-2, 0, 4]).prop('lightpost', [66, 0, 4]);
m.prop('lightpost', [-2, 0, 40]).prop('lightpost', [66, 0, 40]).prop('trashcan', [3, 0, 12]).prop('skip', [65, 0, 52], 0);
m.prop('crate_large', [-1, 0, 28]).prop('cargo_crate', [65, 0, 24], 0.2).prop('metal_crate', [30, 0, 62]).prop('barrel', [38, 0, 62]);
m.prop('tree_cone', [20, 0, -2]).prop('tree_cone', [36, 0, 2]).prop('bush_cone', [60, 0, 10]);

// ---------------------------------------------------------------- inside: the glass front (the rooms are dressed below)
m.breakable('glass', [28, 0, 12.1], 0);

// ---------------------------------------------------------------- spawns, hostages, pickups
for (const [x, z] of [[20, -2], [26, 0], [32, -2], [38, 0], [44, -2], [32, 3]] as const) m.spawn([x, 0, z], 0, embers);
for (const [x, z, yaw] of [[30.5, 47, Math.PI], [33.5, 47, Math.PI], [32, 50.5, Math.PI], [40, 45, Math.PI], [8, 41, 0], [56, 41, 0]] as const) m.spawn([x, 0, z], yaw, tide);
for (const [x, z, yaw] of [[-2, 20, P], [66, 30, -P], [8, 24, 0], [56, 24, 0], [32, 64, Math.PI], [16, 32, 0]] as const) m.spawn([x, 0, z], yaw, null);
m.hostage([20, 0, 50.5], Math.PI).hostage([24, 0, 50.2], Math.PI).hostage([48, 0, 47], -P).hostage([24, 0, 32], 0);
m.rescue([32, 0, 0], 6);
m.pickup('weapon_smg', [4, 0, 4]).pickup('weapon_shotgun', [60, 0, 4]).pickup('weapon_rifle', [-1, 0, 48]).pickup('weapon_rifle', [65, 0, 36]);
m.pickup('weapon_auto_shotgun', [32, 0, 40]).pickup('armor_large', [48, 0, 24]).pickup('armor_small', [16, 0, 40]).pickup('health_large', [40, 0, 24]);
m.pickup('health_small', [8, 0, 16]).pickup('health_small', [56, 0, 48]).pickup('ammo', [24, 0, 24]).pickup('ammo', [40, 0, 40]);
m.pickup('ammo_shells', [8, 0, 32]).pickup('grenades', [32, 0, 60]).pickup('grenades', [56, 0, 16]);

// ---------------------------------------------------------------- inside: every room dressed for what it is (after the spawns and hostages, which it keeps clear)
m.dress({ x0: 2, y0: 6, x1: 3, y1: 6 }, 'conference', { density: 'full' }); // the hostages' conference room
m.dress([6, 6, 0], 'server', { density: 'full' }).dress([5, 6, 0], 'kitchen').dress([1, 6, 0], 'office').dress([7, 6, 0], 'storage');
m.dress({ x0: 3, y0: 2, x1: 4, y1: 2 }, 'lobby');
for (const [x, y] of [[1, 2], [2, 2], [5, 2], [6, 2], [2, 4], [3, 4], [5, 4]] as const) m.dress([x, y, 0], 'office');
m.dress([7, 2, 0], 'storage').dress([4, 4, 0], 'library').dress([6, 4, 0], 'bathroom');

// Office lighting: a cool white panel in every office and corridor.
m.lightRooms({ color: '#eef3ff', intensity: 1.1 });
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

m.bounds('invisible');
// Round the block: a ploughed verge, then snowbanks and pine-covered hills.
ground = sculpt(56, 6, (x, z, d) => sm(6, 30, d) * (5 + 2 * Math.sin(x / 10) * Math.cos(z / 13) + 1.2 * Math.sin((x + z) / 6)) + sm(26, 52, d) * 9, (x, z, d, h) => {
  if (d < 8) return ['gravel', 0];
  return [h > 15 && Math.sin(x / 5 + z / 4) > 0.3 ? 'stone' : 'snow', 0];
});
for (let x = -2; x <= 66; x += 12) plant('nt_pine_snow_tall', x + rnd() * 3, -6.3, { r: 0.8 }), plant('nt_pine_snow_tall', x + rnd() * 3, 70.3, { r: 0.8 });
for (let z = 6; z <= 64; z += 14) plant('nt_pine_snow_tall', -6.3, z, { r: 0.8 }), plant('nt_birch_snow', 70.3, z, { r: 0.8 });
// Snow-laden bushes down the side alleys and round the lot: cover on the flanking routes to the side doors.
for (const [x, z] of [[1, 8], [-1, 30], [2, 40], [63, 10], [62, 22], [66, 46], [1, 54], [63, 56], [16, 3], [48, 4]] as const) clump(x, z, 2, 2, ['nt_bush_snow', 'nt_bush_snow', 'bush_cone']);
m.meta({
  description:
    'An office block on a snowy night. Tide hold the hostages at the back (the conference room, the server room and an office off the middle); Embers come in from the front lot through the lobby, by the side doors off the snowy alleys, or round through the parking garage and its wide door. Corridors front and back, glass walls, and a maze of offices between.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [4, 12],
});
await m.save();
