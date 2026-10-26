/**
 * Felicity Yard: a walled yard between two brick buildings, a garage and a
 * loading dock, with service tunnels underneath (homage in spirit to Perfect
 * Dark's Felicity). The north block is two storeys of offices whose windows
 * look down on the yard; a railed walkway crosses the yard's east side from
 * its upper floor to the south block's. A vent housing in the middle of the
 * yard drops you into the pump room, where the rockets are; the tunnels loop
 * from the garage under the south block to the loading dock.
 *
 * Level 0 (x east, y north; one character = one 8 m cell):
 *
 *   y  2   [GARAGE ][ offices: room  columns  cover  room ][STAIRS]
 *   y  1   [  2x2  ][ yard     yard   crates  yard*      ][ dock ]
 *   y  0   [ST1 v ][ alley ][ yard   VENT    yard   yard*      ][ dock ]
 *   y -1   [crates][ alley ][ lowwall yard   yard   yard*      ][ST2 v]
 *   y -2   [ south block: six rooms ..................... ][STAIRS]
 *                                                  * walkway overhead (level 1)
 * Level 1: offices over the north block, a railed roof terrace on the garage
 *   (sniper rifle), the walkway (heavy armour), two rooms and a terrace on
 *   the south block.
 * Level -1: ST1 (garage) -> tunnel south -> along under the south block ->
 *   ST2 (up into the dock); a branch north to the pump room under the vent.
 */
import { TERRAIN_MATERIALS, buildOccupancy, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('felicity_yard', 'Felicity Yard');
m.theme('factory');
const P2 = Math.PI / 2;
const S = Math.PI; // facing south (-z)

// ---------------------------------------------------------------- level 0

// Garage (2 × 2) in the north-west corner, with the stairs down beside it.
// Brick buildings: every room above ground wears a brick facade on its outside walls.
const BRICK = { facade: 'brick' } as const;
m.tile('room_large', -3, 1, 0, 0, BRICK);
// North block, ground floor, and its stairwell at the east end.
m.tile('room', -1, 2, 0, 0, BRICK).tile('room_columns', 0, 2, 0, 0, BRICK).tile('room_cover', 1, 2, 0, 0, BRICK).tile('room', 2, 2, 0, 0, BRICK);
m.tile('stairwell', 3, 2, 0, 0);
// The yard, the vent housing in its middle, and the west alley.
m.tile('yard', -1, 1, 0).tile('yard', 0, 1, 0).tile('yard_crates', 1, 1, 0).tile('yard', 2, 1, 0);
m.tile('yard_wall', -1, -1, 0).fill('yard', 0, -1, 2, -1).tile('yard', -1, 0, 0).tile('yard', 1, 0, 0).tile('yard', 2, 0, 0);
m.tile('drop', 0, 0, 0);
m.tile('yard', -2, 0, 0).tile('yard', -2, -1, 0).tile('yard_crates', -3, -1, 0);
// Loading dock on the east side.
m.tile('room', 3, 0, 0, 0, BRICK).tile('room', 3, 1, 0, 0, BRICK);
// South block and its stairwell.
for (const [x, kind] of [[-3, 'room'], [-2, 'room'], [-1, 'room_pillar'], [0, 'room'], [1, 'room_cover'], [2, 'room']] as const) m.tile(kind, x, -2, 0, 0, BRICK);
m.tile('stairwell', 3, -2, 0, 0);

// ---------------------------------------------------------------- level -1 (and the stairs down)

// ST1: from the garage's south door down to the tunnel; ST2: from the tunnel up into the dock.
m.tile('stairs', -3, 0, -1, 3);
m.tile('stairs', 3, -1, -1, 3);
m.tile('corridor', -3, -1, -1, 0);
m.tile('corner', -3, -2, -1, 0);
m.tile('corridor', -2, -2, -1, 1).tile('corridor_clear', -1, -2, -1, 1).tile('junction_t', 0, -2, -1, 0).tile('corridor_clear', 1, -2, -1, 1).tile('corridor', 2, -2, -1, 1);
m.tile('corner', 3, -2, -1, 3);
// Branch north to the pump room under the vent.
m.tile('corridor_clear', 0, -1, -1, 0).tile('room', 0, 0, -1);

// ---------------------------------------------------------------- level 1

// Offices over the north block; a railed terrace on the garage roof.
for (let x = -1; x <= 2; x++) m.tile('room', x, 2, 1, 0, BRICK);
m.fill('platform_rail', -3, 1, -2, 2, 1);
// The walkway across the yard's east side, office to south block.
m.fill('bridge', 2, -1, 2, 1, 1);
// South block upstairs: two rooms and a railed terrace.
m.tile('room', 1, -2, 1, 0, BRICK).tile('room', 2, -2, 1, 0, BRICK);
m.tile('platform_rail', -1, -2, 1).tile('platform_rail', 0, -2, 1);

// ---------------------------------------------------------------- walls and openings

// Offices look down on the yard.
for (const x of [-1, 0, 1]) m.edge(x, 2, 1, 'S', 'windows');
m.edge(2, 2, 1, 'E', 'window');
m.edge(-1, 2, 1, 'N', 'window').edge(1, 2, 1, 'N', 'window');
// Ground floor onto the yard.
m.edge(0, 2, 0, 'S', 'wide').edge(1, 2, 0, 'S', 'window').edge(2, 2, 0, 'S', 'arch');
// The garage door and its side door.
m.edge(-2, 1, 0, 'E', 'wide').edge(-2, 1, 0, 'S', 'wide');
// Loading dock: open to the yard.
m.edge(3, 0, 0, 'W', 'wide').edge(3, 1, 0, 'W', 'arch');
// South block: windows on the yard, arches at the alley.
m.edge(0, -2, 0, 'N', 'window').edge(-2, -2, 0, 'N', 'arch');
m.edge(1, -2, 1, 'N', 'windows').edge(1, -2, 1, 'W', 'door');
m.edge(-3, -2, 0, 'N', 'door');

// ---------------------------------------------------------------- spawns

const sp: [number, number, number, number][] = [
  [-24, 0, 14, P2], [-20, 0, 6.5, P2], // garage
  [-8, 0, 17, S], [16, 0, 18, S], // offices, ground floor
  [0, 4, 18, S], [17, 4, 18, S], // offices, upstairs
  [-16, 0, -18, 0], [6, 0, -13.5, 0], // south block
  [16, 4, -18, 0], // south block upstairs
  [24, 0, 10, -P2], // loading dock
  [-24, -4, -16, P2], // tunnel corner
  [2, -4, -2, 0], // pump room
  [8, 0, -6, 0], // yard
];
for (const [x, y, z, yaw] of sp) m.spawn([x, y, z], yaw);

// ---------------------------------------------------------------- pickups

// Power: rockets in the pump room (drop in through the vent), heavy armour on the walkway, the sniper rifle on the garage roof.
m.pickup('weapon_rockets', [-2, -4, 2]).pickup('ammo_explosive', [16, -4, -16]);
m.pickup('armor_large', [16, 4, 0]);
m.pickup('weapon_sniper', [-24, 4, 18]).pickup('ammo_sniper', [-16, 4, 10]);
// Offices.
m.pickup('weapon_rifle', [0, 0, 16]).pickup('weapon_plasma', [-8, 4, 18]).pickup('health_large', [8, 4, 18]).pickup('ammo_cells', [17, 4, 14]);
// South block.
m.pickup('weapon_smg', [0, 0, -16]).pickup('health_small', [-24, 0, -16]).pickup('weapon_hand_cannon', [8, 4, -16]).pickup('ammo_light', [-8, 0, -18]);
// Dock, yard, alley and tunnels.
m.pickup('weapon_launcher', [24, 0, 0]).pickup('ammo_rifle', [22, 0, 8]);
m.pickup('weapon_burst_rifle', [-8, 0, -8]).pickup('grenades', [8, 0, 8]).pickup('health_small', [8, 0, -8]).pickup('armor_small', [-8, 0, 8]);
m.pickup('mines', [-16, 0, -8]).pickup('ammo_rifle', [-22.5, 2, -6.5]);
m.pickup('weapon_shotgun', [8, -4, -16]).pickup('ammo_shells', [-24, -4, -8]).pickup('health_small', [-2, -4, -10]);

// ---------------------------------------------------------------- props

// Yard: crates, pipes and barrels for cover.
m.prop('cargo_crate', [-9, 0, 2], 0.3).prop('crate_large', [-10.5, 0, -1.5], 0).prop('crate_small', [-9.6, 0, -3], 0.4);
m.prop('factory_box', [5, 0, 5], 0.1).prop('pipe_valve', [13.5, 0, -2]).prop('pipe_glass', [13.5, 0, 2]);
m.prop('container_tall', [-11, 0, 10.5]).prop('crate_large', [4.5, 0, 11], P2);
m.breakable('barrel', [-2, 0, -10]).breakable('barrel', [10, 0, -10.5]).breakable('gas', [13, 0, -6]);
m.prop('cone', [-15, 0, 2]).prop('cone', [-14, 0, -4]).prop('warning_sign', [-17, 0, -3]);
// Garage.
m.prop('machine', [-20, 0, 17.5], P2).prop('workbench', [-14.5, 0, 18.5]).prop('factory_box_long', [-23, 0, 5.5]).prop('crate_large', [-13.5, 0, 14], 0.2);
m.breakable('barrel', [-26.5, 0, 18]).prop('barrel_open', [-26.5, 0, 16.6]);
// Offices.
m.prop('computer_bank', [-11, 0, 19.2]).prop('screen_panel', [-5, 0, 19.2]).prop('cardboard_box', [18, 0, 19]).prop('cardboard_open', [19, 0, 17.6]);
m.prop('desk', [-6, 4, 19], S).prop('office_chair', [-6, 4, 17.6], 0).prop('bookcase', [-11, 4, 19.4], S).prop('computer', [3, 4, 19], S);
m.prop('desk_corner', [10, 4, 19], S).prop('potted_plant', [19, 4, 19.4]).prop('table', [1, 4, 14.5]);
// South block.
m.prop('factory_box', [-20, 0, -14], 0.4).prop('cargo_crate', [-10, 0, -19], 0).prop('container', [-2.5, 0, -19]).prop('crate_bottles', [18.5, 0, -19]);
m.prop('desk', [11, 4, -19], 0).prop('bunk_bed', [19, 4, -14.5], 0).prop('tv_cabinet', [14, 4, -19.3], 0);
m.prop('crate_large', [-6, 4, -14], 0.6).prop('crate_small', [2, 4, -18]);
// Dock.
m.prop('conveyor', [25, 0, 3.5], P2).prop('factory_box', [25.5, 0, 9.5]).prop('cardboard_box', [21.5, 0, 13]).prop('skip', [26, 0, -2.5]);
// Pump room and tunnels.
m.prop('hopper', [2.4, -4, 2.4]).prop('pipe_valve', [-2.6, -4, 2.8]).prop('lever', [2.5, -4, -2.6]);
m.prop('pipe_valve', [-17, -4, -18.6]).prop('pipe_glass', [11.6, -4, -18.6]).prop('crate_small', [-25.5, -4, -10]);

// ---------------------------------------------------------------- map settings

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

m.bounds('invisible', 2);
// Furniture in the bare rooms, for what they are in this theme.
m.furnish();
// Team bases at each end (spawns and a flag), hills through the middle.
await m.teamBases(6);
// Round the walls: a level apron, then waste ground and grassy banks.
ground = sculpt(60, 5, (x, z, d) => sm(5, 30, d) * (5 + 2 * Math.sin(x / 9) * Math.cos(z / 11) + 1.2 * Math.cos((x + z) / 6)) + sm(26, 54, d) * 8, (x, z, d, h) => {
  if (d < 8) return ['gravel', 0];
  if (h > 10) return ['grass', 3];
  return [Math.cos(x / 7) * Math.sin(z / 6) > 0.3 ? 'dirt' : 'grass', 2];
});
for (const [x, z] of [[-29, -14], [-29, 12], [29, -14], [29, 14], [-12, 21], [14, -21]] as const) plant(Math.abs(x) % 2 ? 'nt_dead_tree' : 'nt_birch', x, z, { r: 0.6 });
// Scrub taking over the alley and the yard's corners: somewhere to wait for the walkway to clear.
for (const [x, z] of [[-18, -6], [-14, -11], [-5, 12], [12, 12], [18, -11], [-18, 2]] as const) clump(x, z, 2, 1.8, ['nt_bush_leafy', 'bush', 'nt_fern_wide']);
m.lightRooms();
m.meta({
  description:
    'A walled yard between brick buildings. The north block is two storeys of offices with windows over the yard; a railed walkway crosses to the south block upstairs, carrying the heavy armour. The garage roof holds the sniper rifle, the vent housing in the middle of the yard drops into the pump room and the rockets, and service tunnels loop from the garage under the south block to the loading dock.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 12],
});
await m.save();
