/**
 * Razor Edge: an industrial base built round an open atrium (layout homage to
 * Quake II's The Edge, q2dm1, under our own name). Dark brown-grey metal,
 * orange work lights, a storm overhead. Deathmatch and team deathmatch, 4–10.
 *
 * - The atrium (3 × 3, open to the sky): a raised platform in the middle, a
 *   railed bridge across its north side a storey up, and the railgun ledge
 *   high on its south wall on two steel legs.
 * - The lift: a jump pad on the atrium floor throws you up onto the west
 *   gallery; another on the south gallery throws you up to the railgun ledge.
 * - The galleries: a railed walkway all round the atrium a storey up, over
 *   the side corridors, reached by the lift, the bridge and a stair from each wing.
 * - The side corridors: a loop round the atrium on the ground floor, with
 *   wide arches in, and doors out to the wings and the halls.
 * - The water channel (a storey down, open overhead): runs the length of the
 *   south side with stairs down from both wings; rockets in the middle, and a
 *   railed drop into it from the south hall.
 * - The slime pit (east wing): a hole in the floor over a pool of acid; the
 *   heavy armour sits on a pillar in the middle, reached along a narrow plank.
 *   Fall in and climb the ladder up the pillar, burning.
 *
 * Grid x east, y north (one cell = 8 m); levels z-1 channel and slime pool,
 * z0 ground floor, z1 galleries and bridge (4 m), the railgun ledge at 8 m.
 *
 *   y3    c  n  n  n  n  n  c         n north hall, c corners
 *   y2    w  r  r  r  r  r  e         r ring corridor (z0) under the gallery (z1); w/e wings
 *   y1    /  r  A  A  A  r  e         A atrium (bridge at z1 along y1); / west stair up north
 *   y0    w  r  A  P  A  r  S         P raised platform, S slime pit
 *   y-1   w  r  A  A  A  r  \         \ east stair up south
 *   y-2   w  r  r  r  r  r  e
 *   y-3   v  s  s  s  s  s  v         s south hall, v stairs down to the channel
 *   y-4   ~  ~  ~  ~  ~  ~  ~         ~ water channel (z-1)
 *        -3 -2 -1  0  1  2  3
 */
import type { EdgeStyle, RoomOptions, Side, TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('razor_edge', 'Razor Edge');
m.theme('factory');
m.backdrop('storm', 'mountains', 'dirt', 0.45);
m.teams([5, 5]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const PI = Math.PI;
type V3 = [number, number, number];
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [x * 8 + dx, z * 4 + up, y * 8 + dy];
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
function place(kind: string, x: number, y: number, z: number, surf: TileSurfaces, rot: 0 | 1 | 2 | 3 = 0, opts?: RoomOptions): void {
  m.tile(kind, x, y, z, rot, opts);
  paint(x, y, z, surf);
}
const edges = (x: number, y: number, z: number, list: [Side, EdgeStyle][]) => list.forEach(([s, e]) => m.edge(x, y, z, s, e));

// ---------------------------------------------------------------- surfaces: brown-grey metal, hazard trim
const METAL: TileSurfaces = { floor: mat('pbr_tread_plate', '#8a8076'), walls: mat('pbr_rusted_plate', '#8a7a6a'), solids: mat('pbr_steel', '#6a645c'), underside: mat('pbr_corrugated', '#5a544c'), trim: mat('hazard') };
const ATRIUM: TileSurfaces = { floor: mat('pbr_concrete_dark', '#7a7064'), walls: mat('pbr_space_metal', '#8e8478'), solids: mat('pbr_rusted_plate', '#8a6a4a'), underside: mat('pbr_steel', '#4a4640'), trim: mat('hazard') };
const RING: TileSurfaces = { floor: mat('pbr_walkway', '#8a8278'), walls: mat('pbr_corrugated', '#7a7268'), solids: mat('pbr_steel', '#5e5850'), underside: mat('pbr_steel', '#4a4640'), trim: mat('pbr_steel', '#3a3632') };
const GALLERY: TileSurfaces = { floor: mat('pbr_walkway', '#9a8e80'), walls: mat('pbr_space_metal', '#8e8478'), trim: mat('hazard') };
const WING: TileSurfaces = { floor: mat('pbr_concrete_dark', '#6e665c'), walls: mat('pbr_brick_old', '#7a6a5c'), solids: mat('pbr_rusted_plate'), underside: mat('pbr_corrugated', '#4e4a44'), trim: mat('pbr_steel', '#3a3632') };
const CHANNEL: TileSurfaces = { floor: mat('pbr_concrete_dark', '#5a564e'), walls: mat('pbr_concrete', '#6e6a62'), solids: mat('pbr_concrete', '#5e5a52'), trim: mat('pbr_rusted_plate') };
const ROOF: RoomOptions = { ceiling: 'beams', corners: 'chamfered' };

const isAtrium = (x: number, y: number) => Math.abs(x) <= 1 && Math.abs(y) <= 1;
const isRing = (x: number, y: number) => Math.max(Math.abs(x), Math.abs(y)) === 2;

// ---------------------------------------------------------------- the atrium and the ring corridor (z0)
for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) {
  if (isAtrium(x, y)) place('room', x, y, 0, ATRIUM, 0, x === 0 && y === 0 ? { layout: 'platform', corners: 'chamfered' } : { corners: 'chamfered' });
  else place('room', x, y, 0, RING, 0, { corners: 'chamfered' });
}
for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) {
  // East and north sides of each cell: open within the atrium and along the ring, walls (or arches) between them.
  for (const [side, nx, ny] of [['E', x + 1, y], ['N', x, y + 1]] as const) {
    if (nx > 2 || ny > 2) continue;
    const a = isAtrium(x, y);
    const b = isAtrium(nx, ny);
    if (a === b) m.edge(x, y, 0, side, a ? 'open' : isRing(x, y) && isRing(nx, ny) ? 'open' : 'wall');
    else m.edge(x, y, 0, side, (side === 'E' && y === 0) || (side === 'N' && x === 0) ? 'wide' : 'slit');
  }
}

// ---------------------------------------------------------------- wings, halls and corners (z0)
const outer: [number, number][] = [];
for (let i = -3; i <= 3; i++) outer.push([i, 3], [-3, i], [3, i], [i, -3]);
const STAIRS = new Set(['-3,1', '3,-1', '-3,-3', '3,-3']);
const seen = new Set<string>();
for (const [x, y] of outer) {
  const k = `${x},${y}`;
  if (seen.has(k) || STAIRS.has(k)) continue;
  seen.add(k);
  if (x === 3 && y === 0) place('pit', 3, 0, 0, WING);
  else place('room', x, y, 0, WING, 0, ROOF);
}
place('stairs', -3, 1, 0, WING, 3); // west wing (-3,0) up north to the landing (-3,2) z1
place('stairs', 3, -1, 0, WING, 1); // east wing: from the pit walkway (3,0) up south to the landing (3,-2) z1
place('stairs', -3, -3, -1, CHANNEL, 3); // channel (-3,-4) z-1 up north into the west wing (-3,-2)
place('stairs', 3, -3, -1, CHANNEL, 3); // channel (3,-4) z-1 up north into the east wing (3,-2)
// Wings, halls and corners run open into each other.
for (const [x, y, side] of [
  [-3, -2, 'N'], [-3, -1, 'N'], [-3, 2, 'N'], [-3, 3, 'E'], [-2, 3, 'E'], [-1, 3, 'E'], [0, 3, 'E'], [1, 3, 'E'], [2, 3, 'E'],
  [3, 2, 'S'], [3, 1, 'S'], [-2, -3, 'E'], [-1, -3, 'E'], [0, -3, 'E'], [1, -3, 'E'],
] as const) m.edge(x, y, 0, side, 'open');
// Doors from the ring out to the wings and halls.
for (const [x, y, side, style] of [
  [-2, 0, 'W', 'door'], [-2, -1, 'W', 'door'], [-2, -2, 'W', 'door'], [-2, 1, 'W', 'wall'], [-2, 2, 'W', 'wall'],
  [2, 1, 'E', 'door'], [2, 0, 'E', 'door'], [2, 2, 'E', 'wall'], [2, -1, 'E', 'wall'], [2, -2, 'E', 'door'],
  [-1, 2, 'N', 'door'], [1, 2, 'N', 'door'], [0, 2, 'N', 'wall'], [-2, 2, 'N', 'wall'], [2, 2, 'N', 'wall'],
  [-1, -2, 'S', 'door'], [1, -2, 'S', 'door'], [0, -2, 'S', 'wide'], [-2, -2, 'S', 'wall'], [2, -2, 'S', 'wall'],
] as const) m.edge(x, y, 0, side, style);
// The south hall looks down into the channel: a railed drop in the middle, windows either side.
for (let x = -2; x <= 2; x++) m.edge(x, -3, 0, 'S', x === 0 ? 'railing' : Math.abs(x) === 1 ? 'window' : 'wall');

// ---------------------------------------------------------------- the water channel and the slime pool (z-1)
for (let x = -3; x <= 3; x++) {
  place('room', x, -4, -1, CHANNEL, 0, { corners: 'square' });
  if (x < 3) m.edge(x, -4, -1, 'E', 'open');
  m.edge(x, -4, -1, 'S', 'high');
  if (Math.abs(x) < 3) m.edge(x, -4, -1, 'N', 'wall');
}
m.edge(-3, -4, -1, 'W', 'high').edge(3, -4, -1, 'E', 'high');
m.water([0, -4, -32], [55, 1, 7], 'water');
place('room', 3, 0, -1, { ...CHANNEL, floor: mat('pbr_rusted_plate', '#5a6a3a') });
m.water([24, -4, 0], [7, 1.2, 7], 'acid');
// The armour pillar in the middle of the pit, a plank out to it, a ladder up its south face.
const PILLAR = { material: 'pbr_rusted_plate', tint: '#7a6a5a' };
m.block([24, -4, 0], [2.4, 4, 2.4], 'solid', PILLAR);
m.block([24, -0.3, 1.6], [2, 0.3, 0.9], 'solid', { material: 'pbr_walkway', tint: '#9a8e80' });
m.add({ kind: 'ladder', position: [24, -4, -1.25], yaw: PI, height: 4.2, width: 0.9 });

// ---------------------------------------------------------------- galleries, landings and the bridge (z1)
for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) if (isRing(x, y)) place('platform_rail', x, y, 1, GALLERY);
for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) {
  if (!isRing(x, y)) continue;
  for (const side of ['N', 'S', 'E', 'W'] as const) {
    const [nx, ny] = side === 'N' ? [x, y + 1] : side === 'S' ? [x, y - 1] : side === 'E' ? [x + 1, y] : [x - 1, y];
    if (isRing(nx, ny)) m.edge(x, y, 1, side, 'open');
    else if (isAtrium(nx, ny)) m.edge(x, y, 1, side, ny === 1 && Math.abs(nx) === 1 && (side === 'E' || side === 'W') ? 'open' : 'railing');
    else m.edge(x, y, 1, side, 'high');
  }
}
for (const x of [-1, 0, 1]) place('bridge', x, 1, 1, GALLERY, 1);
place('platform_rail', -3, 2, 1, GALLERY);
place('platform_rail', 3, -2, 1, GALLERY);
edges(-3, 2, 1, [['E', 'open'], ['S', 'open'], ['N', 'high'], ['W', 'high']]);
edges(3, -2, 1, [['W', 'open'], ['N', 'open'], ['S', 'high'], ['E', 'high']]);

// ---------------------------------------------------------------- the railgun ledge (8 m) and the pads
const STEEL = { material: 'pbr_steel', tint: '#5a544c' };
m.block([0, 7.6, -10], [6, 0.4, 3.2], 'solid', { material: 'pbr_tread_plate', tint: '#8a8076' });
for (const x of [-2.6, 2.6]) m.block([x, 0, -10], [0.6, 7.6, 0.6], 'solid', STEEL);
m.block([0, 8, -11.5], [6, 1, 0.2], 'solid', { material: 'hazard' });
m.padTo([0, 4, -17.5], [0, 8, -9.6], 16); // south gallery -> the railgun ledge
m.padTo([-6, 0, -4], [-16.5, 4, -4], 17); // the lift: atrium floor -> west gallery

// ---------------------------------------------------------------- spawns and pickups
for (const [x, y, z, yaw] of [[-24, 0, -16, P], [-24, 0, 0, P], [-24, 0, 16, P], [-16, 0, 24, PI], [-16, 4, 16, P]] as const) m.spawn([x, y, z], yaw, embers);
for (const [x, y, z, yaw] of [[24, 0, 16, -P], [24, 0, -16, -P], [24, 0, 24, -P], [16, 0, -24, 0], [16, 4, -16, -P]] as const) m.spawn([x, y, z], yaw, tide);
for (const [x, y, z, yaw] of [[-8, 0, 8, 2.4], [8, 0, -8, -0.8], [0, 0, -16, 0], [0, 0, 16, PI], [-8, -4, -32, P], [8, 0, 24, PI], [16, 4, 16, -P], [-16, 4, -16, P]] as const) m.spawn([x, y, z], yaw, null);
m.pickup('weapon_railgun', [0, 8, -10]).pickup('ammo_cells', [16, 4, 0]);
m.pickup('armor_large', [24, 0, 0]);
m.pickup('weapon_rockets', [0, -4, -32]).pickup('weapon_rockets', [-24, 0, -8]).pickup('ammo_explosive', [-24, 0, 24]).pickup('ammo_explosive', [24, 0, -24]);
m.pickup('powerup_damage', [0, 4, 8], 90);
m.pickup('health_large', [0, 0, 24]).pickup('health_large', [0, 0, -24]);
m.pickup('weapon_shotgun', [-16, 0, 0]).pickup('weapon_smg', [16, 0, 8]).pickup('weapon_plasma', [0, 1.5, 0]);
m.pickup('weapon_launcher', [24, 0, 8]).pickup('weapon_auto_shotgun', [-16, 0, -24]).pickup('weapon_lmg', [0, 4, 16]);
m.pickup('armor_small', [-16, 4, 0]).pickup('armor_small', [16, 4, -8]).pickup('armor_small', [16, -4, -32]);
m.pickup('health_small', [-8, 0, -8]).pickup('health_small', [8, 0, 8]).pickup('health_small', [-24, 0, -4]).pickup('health_small', [24, 0, 3]);
m.pickup('health_small', [-16, 0, 16]).pickup('health_small', [16, 0, -16]).pickup('ammo', [-8, 0, 24]).pickup('ammo', [8, 0, -24]);
m.pickup('ammo_shells', [-24, 4, 16]).pickup('ammo_shells', [24, 4, -16]).pickup('ammo_cells', [-16, 0, -16]);

// ---------------------------------------------------------------- dressing: pipes, machines, crates
const props: [string, number, number, number, number][] = [
  // atrium corners
  ['big_pipe', -9.5, 0, 9.5, 0], ['big_pipe', 9.5, 0, -9.5, 0], ['sf_crate_large', 9.8, 0, 9.8, 0.3], ['sf_crate_large', 9.4, 1.12, 9.6, 0.1], ['sf_barrel', -10, 0, -10, 0], ['sf_barrel', -9.2, 0, -10.4, 0],
  // ring corridor
  ['sf_pipe_rack', -16, 0, 19.2, 0], ['sf_pipe_rack', 16, 0, -19.2, 0], ['sf_column_pipes', -19, 0, -19, 0], ['sf_column_pipes', 19, 0, 19, 0], ['sf_vent', 0, 0, 16, 0], ['sf_vent', 0, 0, -16, 0],
  // wings and halls
  ['machine', -26.5, 0, -1, 0], ['machine', 26.5, 0, 17, PI], ['screen_panel', -26.8, 0, 9, P], ['sf_computer', 27, 0, -14, -P], ['metal_crate', -26.5, 0, 26.5, 0], ['metal_crate', 26.5, 0, 26.5, 0],
  ['hopper', -12, 0, 26, 0], ['hopper', 12, 0, -26, 0], ['sf_crate_large', 12, 0, 26.6, 0], ['sf_crate_large', -12, 0, -26.6, 0], ['sf_barrel', 5, 0, 27, 0], ['sf_barrel', -5, 0, -27, 0],
  ['factory_box', -26.5, 0, -19, 0], ['crate_large', 26.5, 0, 9.5, 0.2], ['pipe_valve', -6, 0, 27, 0], ['pipe_valve', 6, 0, -27, PI],
  // the channel
  ['sf_pipe_rack', -10, -4, -35.2, 0], ['sf_pipe_rack', 10, -4, -35.2, 0], ['sf_barrel', 20, -4, -35, 0], ['sf_barrel', -20, -4, -35, 0],
  // galleries
  ['sf_crate_large', -18.5, 4, -18.5, 0], ['sf_crate_large', 18.5, 4, 18.5, 0], ['sf_barrel', 19, 4, -19, 0], ['sf_barrel', -19, 4, 19, 0],
];
for (const [model, x, y, z, yaw] of props) m.prop(model, [x, y, z], yaw);

// ---------------------------------------------------------------- orange work lights
const ORANGE = '#ff9a3c';
for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) {
  if (isAtrium(x, y) || STAIRS.has(`${x},${y}`)) continue;
  m.light(at(x, y, 0, 0, 0, 3.3), { color: ORANGE, intensity: 1.1, range: 10, fixture: 'bulb' });
}
for (const [x, z] of [[-8, -8], [8, 8], [-8, 8], [8, -8]] as const) m.light([x, 6, z], { color: ORANGE, intensity: 1.3, range: 14, fixture: 'none' });
m.light([0, 10, -10], { color: '#ffd08a', intensity: 1.2, range: 10, fixture: 'none' });
for (let x = -3; x <= 3; x += 2) m.light(at(x, -4, -1, 0, -3, 3), { color: ORANGE, intensity: 1, range: 10, fixture: 'wall' });
m.light([24, -1.5, 0], { color: '#a6ff5a', intensity: 1.2, range: 9, fixture: 'none' }); // the slime's glow

m.bounds('invisible');
m.meta({
  description:
    'An industrial base round an open atrium under a storm. A raised platform in the middle, a bridge across the north side, galleries all round a storey up, and the railgun ledge high on the south wall: ride the pad on the south gallery to reach it, or the lift pad from the atrium floor to the west gallery. Side corridors loop round the atrium; a water channel runs below the south hall with the rocket launcher, and the heavy armour stands on a pillar over the slime pit in the east wing.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [4, 10],
});
// The map's picture: the automatic camera frames a poor view here (tools/content/capture-map-shots.mjs).
m.thumbnailCamera([-16, 7.2, -16], [-7.48, 6.03, -10.89]);
await m.save();
