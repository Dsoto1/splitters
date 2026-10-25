/**
 * Lantern Quarter: a two-storey restaurant on a neon-lit night street (homage
 * in spirit to the restaurant-and-street map of the classic time-travelling
 * shooter). The dining hall is a double-height atrium with a gallery all
 * round and a staircase up; the kitchen behind it has a serving hatch, a back
 * door and the back stairs. Upstairs: the gallery, two private dining rooms
 * with a balcony over the street, and the office (rocket launcher). Outside,
 * the street runs past three shopfronts, and an alley loops round the back of
 * the restaurant from one end of the street to the other.
 *
 * Grid x east, y north (one cell = 8 m); [brackets] = upstairs (z1).
 *
 *   y3    a   a   a   a   a          a  back alley (loops round: west, north and east)
 *   y2    a   K   K   T   a          K  kitchen [office]   T  back stairwell (both floors)
 *   y1    a   D   D   R   a          D  dining atrium (two storeys, gallery all round)
 *   y0    a   D   D   R   a          R  tea rooms [private dining rooms]
 *   y-1   s   s   s   s   s   s   s  s  street, [balconies] over it at x0 and x2
 *   y-2   S   S   .   S   S   .   S  S  shops
 *        -2  -1   0   1   2   3   4
 */
import { TERRAIN_MATERIALS, buildOccupancy, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('lantern_quarter', 'Lantern Quarter');
m.theme('neon');
const P = Math.PI / 2;

// ---------------------------------------------------------------- street and shops
m.fill('yard', -2, -1, 4, -1);
const SHOP = { facade: 'storefront' } as const;
for (const x of [-2, -1, 1, 2, 4]) m.tile('room', x, -2, 0, 0, SHOP);
m.edge(-2, -2, 0, 'N', 'windows').edge(-1, -2, 0, 'N', 'wide').edge(1, -2, 0, 'N', 'wide').edge(2, -2, 0, 'N', 'windows').edge(4, -2, 0, 'N', 'door');
m.edge(-2, -2, 0, 'E', 'arch').edge(1, -2, 0, 'E', 'arch');
for (const x of [0, 3]) m.edge(x, -1, 0, 'S', 'high');
m.edge(-2, -1, 0, 'W', 'high').edge(-2, -1, 0, 'N', 'high').edge(4, -1, 0, 'E', 'high').edge(4, -1, 0, 'N', 'high');

// ---------------------------------------------------------------- the restaurant
m.tile('atrium', 0, 0);
const BRICK = { facade: 'brick' } as const; // the restaurant's outside walls
m.tile('room', 0, 2, 0, 0, BRICK).tile('room', 1, 2, 0, 0, BRICK); // kitchen
m.tile('stairwell', 2, 2, 0, 0); // back stairs, doors west on both floors
m.tile('room', 2, 0, 0, 0, BRICK).tile('room', 2, 1, 0, 0, BRICK); // tea rooms
m.tile('room', 0, 2, 1, 0, BRICK).tile('room', 1, 2, 1, 0, BRICK); // office and store room above the kitchen
m.tile('room', 2, 0, 1, 0, BRICK).tile('room', 2, 1, 1, 0, BRICK); // private dining rooms
m.tile('balcony', 0, -1, 1, 2).tile('balcony_round', 2, -1, 1, 2);
// Front: a wide entrance, display windows, the tea-room door; windows upstairs.
m.edge(0, 0, 0, 'S', 'wide').edge(1, 0, 0, 'S', 'windows').edge(1, 0, 1, 'S', 'windows');
// West side onto the alley: a side door and windows on both floors.
m.edge(0, 0, 0, 'W', 'windows').edge(0, 0, 1, 'W', 'window').edge(0, 1, 1, 'W', 'window');
// Kitchen: serving hatch into the dining hall, a back door, a window; the two halves open.
m.edge(1, 1, 0, 'N', 'window').edge(0, 2, 0, 'N', 'window').edge(0, 2, 0, 'E', 'open');
m.edge(0, 2, 1, 'W', 'window').edge(1, 2, 1, 'N', 'window');
// Tea rooms: arches from the dining hall, one room on both floors, windows and a side door east.
m.edge(1, 0, 0, 'E', 'arch').edge(1, 1, 0, 'E', 'arch').edge(2, 0, 0, 'N', 'open').edge(2, 0, 1, 'N', 'open');
m.edge(2, 0, 0, 'E', 'window').edge(2, 0, 1, 'E', 'windows').edge(2, 1, 1, 'E', 'windows');

// ---------------------------------------------------------------- the alley loop
m.fill('yard', -1, 0, -1, 3).fill('yard', 0, 3, 3, 3).fill('yard', 3, 0, 3, 2);
for (let y = 0; y <= 3; y++) m.edge(-1, y, 0, 'W', 'high').edge(3, y, 0, 'E', 'high');
for (let x = -1; x <= 3; x++) m.edge(x, 3, 0, 'N', 'high');

// ---------------------------------------------------------------- spawns
m.spawn([-16, 0, -8], P).spawn([32, 0, -8], -P).spawn([-16, 0, -17], 0).spawn([12, 0, -17], 0).spawn([32, 0, -17], 0);
m.spawn([-8, 0, 14], Math.PI).spawn([16, 0, 24], -P).spawn([24, 0, 4], 0);
m.spawn([6, 0, 17], -P).spawn([17, 0, 9], Math.PI).spawn([2, 4, 18], Math.PI).spawn([18, 4, 3], Math.PI).spawn([-2, 4, 10.8], P);

// ---------------------------------------------------------------- pickups
// Power: rockets in the upstairs office, the spin gun in the end shop.
m.pickup('weapon_rockets', [6, 4, 16]).pickup('ammo_explosive', [-2, 4, 16]);
m.pickup('weapon_lmg', [32, 0, -19]).pickup('ammo_rifle', [-12, 0, -19]);
// Dining hall: health on the floor, heavy armour on the gallery.
m.pickup('health_large', [8, 0, 6]).pickup('armor_large', [4, 4, 10.8]);
// Kitchen: shotgun and the flamethrower; tea rooms: SMG; private rooms: marksman rifle.
m.pickup('weapon_shotgun', [0, 0, 18]).pickup('weapon_flamethrower', [8, 0, 13]).pickup('ammo_fuel', [10, 0, 19]);
m.pickup('weapon_smg', [16, 0, 0]).pickup('weapon_marksman', [16, 4, 8]).pickup('armor_small', [16, 4, -5.5]);
// Street and alleys.
m.pickup('weapon_rifle', [-4, 0, -8]).pickup('weapon_launcher', [24, 0, -8]).pickup('ammo_shells', [8, 0, -10]);
m.pickup('health_small', [-8, 0, 24]).pickup('health_small', [24, 0, 24]).pickup('health_small', [-8, 0, -16]).pickup('health_small', [16, 0, -16]);
m.pickup('grenades', [-8, 0, 0]).pickup('ammo_light', [24, 0, 12]).pickup('armor_small', [8, 0, 24]);

// ---------------------------------------------------------------- props
// Dining hall: round tables with chairs, a long table by the window, lanterns.
for (const [x, z] of [[-1, 8], [6, 8], [-1, 3]] as const) {
  m.prop('table_round', [x, 0, z]).prop('chair_cushion', [x - 1.3, 0, z], P).prop('chair_cushion', [x + 1.3, 0, z], -P);
  m.prop('lantern', [x, 0.8, z], 0, 0.8, false);
}
m.prop('table_cloth', [9.5, 0, -2.6]).prop('chair', [8.5, 0, -1.6], Math.PI).prop('chair', [10.5, 0, -1.6], Math.PI);
m.prop('potted_plant', [-3.2, 0, -3.2]).prop('potted_plant', [11.2, 0, 11.2]).prop('rug', [4, 0.01, 5], 0, 1.4, false);
// Gallery: a table and plants.
m.prop('table', [10.8, 4, 4], P).prop('potted_plant', [-3, 4, 11]).prop('floor_lamp', [11, 4, 11], 0, 1, false);
// Kitchen: stoves and cabinets along the back wall, a prep bench, fridge, sacks and barrels.
for (const x of [-2.5, -1.5, 3, 4]) m.prop(x < 0 ? 'stove' : 'kitchen_cabinet', [x, 0, 19.4], Math.PI);
m.prop('stove', [9.5, 0, 19.4], Math.PI).prop('kitchen_cabinet', [10.5, 0, 19.4], Math.PI).prop('fridge', [11, 0, 13.2], -P);
m.prop('workbench', [4, 0, 15]).prop('workbench', [5.2, 0, 15]).prop('barrel', [-3, 0, 13]).prop('crate_bottles', [-2, 0, 13]);
// Tea rooms: low tables, cushions, a screen of shelves.
m.prop('table', [16, 0, -1.5]).prop('bench', [16, 0, -3], 0, 2).prop('table', [16, 0, 10], P).prop('sofa', [19, 0, 10], -P);
m.prop('bookcase_wide', [13, 0, 4], P).prop('potted_plant', [19, 0, -3]);
// Upstairs: private dining, office desk and shelves, store room boxes.
m.prop('table_cloth', [16, 4, 1], P).prop('chair_cushion', [14.8, 4, 1], P).prop('chair_cushion', [17.2, 4, 1], -P);
m.prop('sofa_long', [18.8, 4, 9], -P).prop('tv_cabinet', [13.4, 4, 9], P);
m.prop('desk', [8, 4, 19.2], Math.PI).prop('office_chair', [8, 4, 18]).prop('bookcase', [11.4, 4, 15], -P).prop('coat_rack', [4.5, 4, 19]);
m.prop('cardboard_box', [-3, 4, 19]).prop('cardboard_open', [-2.2, 4, 19.2]).prop('crate_small', [-3.2, 4, 13]);
// Street: market stalls under parasols, crates, lamp posts, a skip.
m.prop('lightpost_double', [-8, 0, -4.6], P).prop('lightpost_double', [16, 0, -4.6], P).prop('lightpost', [32, 0, -4.6], P);
m.prop('parasol', [-12, 0, -9], 0, 1, false).prop('display_table', [-12, 0, -9]).prop('parasol', [20, 0, -8], 0, 1, false).prop('display_table', [20, 0, -8]);
m.prop('crate_large', [3, 0, -10.5], P).prop('crate_small', [4.2, 0, -10.5]).prop('barrel', [28, 0, -11]).prop('barrel_open', [28.8, 0, -10.6]);
m.prop('skip', [-16, 0, -4.8], P).prop('trashcan', [11, 0, -4.8]).prop('cone', [34, 0, -4.8]);
// Shops: counters and stock.
m.prop('desk_corner', [-18, 0, -18.5]).prop('bookcase_wide', [-8, 0, -19.4]).prop('crate_bottles', [-11, 0, -14]);
m.prop('display_table', [8, 0, -17]).prop('cardboard_box', [10, 0, -19]).prop('cardboard_box', [10.4, 0, -18.5]).prop('bookcase_wide', [16, 0, -19.4]);
m.prop('kitchen_cabinet', [34, 0, -19], 0).prop('crate_open', [30, 0, -13]);
// Alleys: bins, crates, barrels, the odd lantern.
m.prop('container', [-10, 0, 1]).prop('dungeon_barrel', [-6, 0, 6]).prop('crate_large', [-10.5, 0, 18]).prop('trashcan', [-6, 0, 27]);
m.prop('cardboard_open', [2, 0, 27]).prop('crate_large', [12, 0, 25.5], P).prop('barrel', [20, 0, 26]).prop('container_wide', [27, 0, 26]);
m.prop('crate_small', [26.5, 0, 15]).prop('barrel', [21.5, 0, 6]).prop('lantern', [-11, 2.5, 8], 0, 1, false).prop('lantern', [27, 2.5, 12], 0, 1, false);

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
// Team bases at each end (spawns and a flag), hills through the middle.
await m.teamBases(6);
// Round the quarter: a level verge behind the walls, then wooded hills over the rooftops.
ground = sculpt(56, 6, (x, z, d) => sm(6, 32, d) * (6 + 2.5 * Math.sin(x / 11 + 1) * Math.cos(z / 14)) + sm(28, 52, d) * 8, (x, z, d, h) => {
  if (h > 13) return ['moss', 3];
  if (d < 9) return ['gravel', 0];
  return [Math.sin(x / 7 - z / 9) > 0.6 ? 'dirt' : 'grass', 3];
});
// The back alley is going wild: bushes in its corners and against the walls, cover for whoever comes round the back.
const HEDGE = ['nt_bush_leafy', 'bush', 'nt_fern_wide'];
for (const [x, z] of [[-10.5, 26.5], [26.5, 26.5], [-10.5, 4], [26.5, 18], [4, 26.5], [-10.5, 20]] as const) clump(x, z, 2, 1.5, HEDGE);
for (const [x, z] of [[-6, 30], [22, -22.5], [38, 12]] as const) plant('nt_birch', x, z, { r: 0.8 });
m.lightRooms();
m.meta({
  description:
    'A two-storey restaurant on a neon-lit night street: a double-height dining hall with a gallery all round, a kitchen with a serving hatch and back stairs, private dining rooms with balconies over the street and the office upstairs (rockets). Outside, shopfronts line the street and an alley loops round the back from one end to the other. An homage in spirit to the classic restaurant-and-street map.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 12],
});
await m.save();
