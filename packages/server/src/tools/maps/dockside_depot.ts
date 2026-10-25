/**
 * Dockside Depot: a two-storey warehouse on a floodlit industrial lot at dusk
 * (homage in spirit to Counter-Strike's cs_assault). Tide hold the warehouse;
 * Embers come in off the road at the south-west corner, across a parking lot
 * full of trucks and shipping containers.
 *
 * - The warehouse: an open, two-storey hall of crates and shelving behind a
 *   big loading door (south), with a side door off the alley (west), a small
 *   personnel door (south-east) and the front door onto the east lane.
 *   Upstairs a ring of catwalks and a row of offices along the north wall: a
 *   catwalk over the loading door with windows onto the lot, a railed bridge
 *   across the hall (double damage), and two stairs down to the floor. A
 *   stair hut in the east office climbs to the roof.
 * - The roof: reached from the alley by the fire escape (two flights, our
 *   stand-in for the ladder), holding the sniper rifle among the vents. Two
 *   roof hatches drop into the upper level: one onto the south catwalk, one
 *   into the north-east office.
 * - The air duct: a cramped sheet-metal crawlway (2.3 m square) from the back
 *   strip behind the warehouse, climbing inside to come out through the wall
 *   of the north-west office. Heavy armour waits at its top.
 * - Outside: the road (Embers), the parking lot with a semi-trailer, a box
 *   truck and container stacks, the west alley with the fire escape, the back
 *   strip with the duct and the big health, and the east lane to the front door.
 *
 * Grid x east, y north (one cell = 8 m); levels z0 ground, z1 upper, z2 roof.
 *
 *   ground (z0)                              upper (z1) / roof (z2)
 *   y8  b   b  [==duct==)  b   b   b   b     duct climbs inside to z1 at (3,7) N
 *   y7  a   a | W   W   W   W   W | e       O   O   O   O   O     z1 offices (duct door at 3,7)
 *   y6  a   a | W   W   W   W   W > e       c   .   B   .   H     c catwalk  B bridge  H stair hut to roof
 *   y5  F   a | S   W   W   W   S | e       S   .   B   .   S     S stairs from the hall
 *   y4  a   a > W   W  [L]  W   d | e       c   c   c   c   c     south catwalk, windows over the lot
 *   y3  p   p   p   p   p   p   p   e
 *   y2  p   p   p  (T)  p   p  (T)  e       roof z2: deck over x2..6 y4..7, hatches at (3,4) and (5,7),
 *   y1  E   E   E   p   p   p   p   e       fire escape F (0,5) z0 -> landing (0,6) z1 -> (1,6) z1 -> roof
 *   y0  E   E   E   r   r   r   r   r
 *       0   1   2   3   4   5   6   7
 *
 *   W hall (two storeys under the bridge), L loading door, > doors (side, front), d personnel door
 *   E Embers' road, p parking lot (T trucks), a alley, F fire escape, b back strip, e east lane
 */
import { TERRAIN_MATERIALS, buildOccupancy, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial, type Side, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('dockside_depot', 'Dockside Depot');
m.theme('factory');
m.backdrop('dusk', 'city', 'gravel', 0.45);
m.teams([8, 8]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0): [number, number, number] => [x * 8 + dx, z * 4, y * 8 + dy];

function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces }] });
}

const WH = { x0: 2, x1: 6, y0: 4, y1: 7 };
const inWarehouse = (x: number, y: number) => x >= WH.x0 && x <= WH.x1 && y >= WH.y0 && y <= WH.y1;

// ---------------------------------------------------------------- the lot (z0)
// Road, parking, alley, back strip and east lane: open ground round the warehouse.
for (let x = 0; x <= 7; x++) for (let y = 0; y <= 8; y++) {
  if (inWarehouse(x, y) || (x === 0 && y === 5)) continue;
  m.tile('yard', x, y);
}
// Fire escape: a flight up the alley to a landing, a second flight onto the roof.
m.tile('stairs_open', 0, 5, 0, 3); // (0,4) z0 -> (0,6) z1
m.tile('platform_rail', 0, 6, 1); // landing
m.tile('stairs_open', 1, 6, 1, 0); // (0,6) z1 -> (2,6) z2, the roof

// ---------------------------------------------------------------- the warehouse floor (z0)
for (let x = WH.x0; x <= WH.x1; x++) for (let y = WH.y0; y <= WH.y1; y++) {
  if ((x === 2 && y === 5) || (x === 6 && y === 5)) continue;
  m.tile('yard', x, y);
}
m.tile('stairs', 2, 5, 0, 3); // west stairs: from (2,4) up north to the west catwalk
m.tile('stairs', 6, 5, 0, 1); // east stairs: from (6,6) up south to the south catwalk

// ---------------------------------------------------------------- upper level (z1)
m.fill('platform_rail', 2, 4, 6, 4, 1); // south catwalk over the loading door
m.tile('platform_rail', 2, 6, 1); // west catwalk
m.tile('bridge', 4, 5, 1).tile('bridge', 4, 6, 1); // bridge across the hall
m.fill('room', 2, 7, 6, 7, 1); // offices along the north wall
m.tile('stairs', 6, 6, 1, 1); // stair hut: east office (6,7) up south onto the roof (6,5)

// ---------------------------------------------------------------- roof (z2)
for (let x = WH.x0; x <= WH.x1; x++) for (let y = WH.y0; y <= WH.y1; y++) {
  if (x === 6 && y === 6) continue; // stair hut
  const hatch = (x === 3 && y === 4) || (x === 5 && y === 7);
  m.tile(hatch ? 'drop' : 'platform_rail', x, y, 2);
}

// ---------------------------------------------------------------- walls: the warehouse
const wh = (x: number, y: number, z: number, side: Side, style: Parameters<typeof m.edge>[4]) => m.edge(x, y, z, side, style);
// Ground floor shell: loading door, personnel door, side door, front door.
for (let x = WH.x0; x <= WH.x1; x++) {
  wh(x, WH.y0, 0, 'S', x === 4 ? 'arch' : x === 6 ? 'door' : 'wall');
  wh(x, WH.y1, 0, 'N', 'wall');
}
for (let y = WH.y0; y <= WH.y1; y++) {
  wh(WH.x0, y, 0, 'W', y === 4 ? 'door' : 'wall');
  wh(WH.x1, y, 0, 'E', y === 6 ? 'wide' : 'wall');
}
// West stairs: open at the foot and the head, a half wall / railing toward the hall.
wh(2, 5, 0, 'S', 'open').edge(2, 5, 1, 'N', 'open');
wh(2, 5, 0, 'E', 'half').edge(2, 5, 1, 'E', 'railing').edge(2, 5, 1, 'S', 'railing');
// East stairs, the mirror image.
wh(6, 5, 0, 'N', 'open').edge(6, 5, 1, 'S', 'open');
wh(6, 5, 0, 'W', 'half').edge(6, 5, 1, 'W', 'railing');
// Upper level shell: windows over the lot, the duct door into the north-west office.
for (let x = WH.x0; x <= WH.x1; x++) wh(x, 4, 1, 'S', x === 4 ? 'window' : 'windows');
wh(2, 4, 1, 'W', 'wall').edge(6, 4, 1, 'E', 'window').edge(2, 6, 1, 'W', 'window');
wh(2, 7, 1, 'W', 'wall').edge(6, 7, 1, 'E', 'window');
for (let x = WH.x0; x <= WH.x1; x++) wh(x, 7, 1, 'N', x === 3 ? 'door' : 'window');
// Offices look down into the hall.
wh(3, 7, 1, 'S', 'windows').edge(5, 7, 1, 'S', 'windows');
// Stair hut on the roof: a door south onto the roof deck.
wh(6, 6, 2, 'S', 'door');
// Roof hatches: open to the deck, railed at the roof edge.
wh(3, 4, 2, 'N', 'open').edge(3, 4, 2, 'E', 'open').edge(3, 4, 2, 'W', 'open').edge(3, 4, 2, 'S', 'railing');
wh(5, 7, 2, 'S', 'open').edge(5, 7, 2, 'E', 'open').edge(5, 7, 2, 'W', 'open').edge(5, 7, 2, 'N', 'railing');

// ---------------------------------------------------------------- walls: the lot
// Neighbouring buildings west and north, a tall fence along the road and the east side.
for (let y = 0; y <= 8; y++) m.edge(0, y, 0, 'W', 'high').edge(7, y, 0, 'E', y >= 6 ? 'high' : 'fence');
for (let x = 0; x <= 7; x++) m.edge(x, 0, 0, 'S', 'fence').edge(x, 8, 0, 'N', 'high');
m.edge(1, 5, 0, 'W', 'open'); // alley beside the foot of the fire escape
// A low wall between the road and the lot, with gaps.
for (const x of [3, 5, 6]) m.edge(x, 0, 0, 'N', 'half');
// The Embers' corner: a fence along the east side of their road, gate at the road.
m.edge(2, 1, 0, 'E', 'fence');

// ---------------------------------------------------------------- paint
const ASPHALT: TileSurfaces = { floor: { material: 'core.pbr_asphalt', tint: null } };
const SHED: TileSurfaces = { floor: { material: 'core.pbr_concrete', tint: null }, walls: { material: 'core.pbr_corrugated', tint: '#9aa6ac' } };
for (let x = 0; x <= 7; x++) for (let y = 0; y <= 8; y++) {
  if (inWarehouse(x, y) || (x === 0 && y === 5)) continue;
  const nextToShed = (x === 1 && y >= 4 && y <= 7) || (y === 3 && x >= 2 && x <= 6) || (y === 8 && x >= 2 && x <= 6) || (x === 7 && y >= 4 && y <= 7);
  paint(x, y, 0, nextToShed ? { ...ASPHALT, walls: SHED.walls } : ASPHALT);
}
for (let x = WH.x0; x <= WH.x1; x++) for (let y = WH.y0; y <= WH.y1; y++) {
  if (!((x === 2 && y === 5) || (x === 6 && y === 5))) paint(x, y, 0, SHED);
  const roof = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === 2);
  if (roof) paint(x, y, 2, { floor: { material: 'core.pbr_concrete_dark', tint: null } });
}
for (let x = WH.x0; x <= WH.x1; x++) {
  paint(x, 4, 1, { floor: { material: 'core.pbr_walkway', tint: null }, walls: SHED.walls });
  paint(x, 7, 1, { floor: { material: 'core.pbr_floorboards', tint: null }, walls: { material: 'core.pbr_plaster', tint: null } });
}
paint(2, 6, 1, { floor: { material: 'core.pbr_walkway', tint: null }, walls: SHED.walls });

// ---------------------------------------------------------------- the air duct (free blocks)
// Interior 2.3 m wide and 2.3 m high: in at the back strip (x 6), climbing 4 m (x 10-18), out through the wall at (3,7) z1.
const DUCT = { material: 'pbr_steel' };
const Z0 = 60.5; // inner face of the warehouse's north wall
const Z1 = 62.8; // inside of the duct's north wall
const ZC = (Z0 + Z1) / 2;
const H = 2.3; // headroom
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => m.block([(x0 + x1) / 2, y0, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], 'solid', DUCT);
// Mouth and the flat run in.
box(6, 10, H, H + 0.3, 60.2, Z1 + 0.3);
// The climb: 16 steps of 0.25 m, the roof stepping up with them.
for (let i = 0; i < 16; i++) {
  const x0 = 10 + i * 0.5;
  const top = (i + 1) * 0.25;
  box(x0, x0 + 0.5, 0, top, Z0, Z1);
  box(x0, x0 + 0.5, top + H, top + H + 0.3, 60.2, Z1 + 0.3);
}
// The top run, at the upper floor's height, to the office door.
box(18, 27.5, 0, 4, Z0, Z1);
box(18, 27.8, 4 + H, 4 + H + 0.3, 60, Z1 + 0.3);
// Sides: south wall where the duct runs outside the warehouse, north wall all along, end cap.
box(6, 12, 0, 4 + 0.3, 60.2, Z0);
box(6, 10, 0, H + 0.3, Z1, Z1 + 0.3);
box(10, 27.8, 0, 4 + H + 0.3, Z1, Z1 + 0.3);
box(27.5, 27.8, 0, 4 + H, 60, Z1);

// ---------------------------------------------------------------- trucks and containers (free blocks)
const TRAILER = { material: 'pbr_corrugated', tint: '#c9ccd0' };
const CAB = { material: 'paint_gloss', tint: '#9c2a24' };
const DARK = { material: 'pbr_steel', tint: '#3a3a3a' };
/** A semi-trailer and its cab, lying north-south with the cab at the south end. */
function semi(cx: number, cz: number): void {
  m.block([cx, 1.2, cz], [2.6, 3, 12], 'solid', TRAILER);
  for (const dz of [-4.5, 4]) m.block([cx, 0, cz + dz], [2.4, 1.2, 1.4], 'solid', DARK);
  m.block([cx, 0, cz - 8.1], [2.6, 3.1, 3.2], 'solid', CAB);
  m.block([cx, 0, cz - 10.3], [2.4, 1.6, 1.2], 'solid', CAB);
}
/** A box truck lying east-west, cab at the west end. */
function boxTruck(cx: number, cz: number): void {
  m.block([cx, 1, cz], [7, 2.8, 2.5], 'solid', { material: 'pbr_white_panel' });
  for (const dx of [-2.5, 2.5]) m.block([cx + dx, 0, cz], [1.2, 1, 2.3], 'solid', DARK);
  m.block([cx - 4.9, 0, cz], [2.6, 2.8, 2.5], 'solid', { material: 'paint_gloss', tint: '#2a4a7a' });
}
/** A shipping container: `ns` lies north-south. */
function container(cx: number, y: number, cz: number, ns: boolean, tint: string): void {
  m.block([cx, y, cz], ns ? [2.5, 2.6, 6.1] : [6.1, 2.6, 2.5], 'solid', { material: 'pbr_corrugated', tint });
}
semi(22, 17); // the semi parked beside the loading door
boxTruck(49, 12); // the box truck in the east of the lot
container(7, 0, 17, true, '#8a3a2a'); // west container stack (climb the crates beside it)
container(7, 2.6, 18.5, true, '#2c5a8a');
container(38, 0, 23, false, '#3a6a44'); // container near the loading door
container(57.5, 0, 50, true, '#8a3a2a'); // east lane
container(34, 0, 66, false, '#2c5a8a'); // back strip

// ---------------------------------------------------------------- spawns
// Embers: the road and their corner of the lot.
for (const [x, z, yaw] of [[-1, -1, 0], [6, 1, 0], [14, -1, 0.3], [0, 8, 0.4], [9, 9, 0.3], [15, 7, 0.2], [26, -1, -0.2], [34, 1, -0.3]] as const) m.spawn([x, 0, z], yaw, embers);
// Tide: the hall, the offices and the south catwalk.
m.spawn(at(5, 6, 0, 0, 2), Math.PI, tide).spawn(at(4, 7, 0, 0, 1), Math.PI, tide).spawn(at(6, 7, 0, -1, 1), -2.4, tide).spawn(at(2, 6, 0, 1, 2), 2.4, tide);
m.spawn(at(2, 7, 1, 1, 0), Math.PI, tide).spawn(at(4, 7, 1, 2, 1), Math.PI, tide).spawn(at(6, 7, 1, -2, -1), Math.PI, tide).spawn(at(5, 4, 1, 0, 0), Math.PI, tide);
// Free-for-all extras: alley, back strip, east lane, lot, roof.
m.spawn(at(1, 7, 0, 0, 0), Math.PI, null).spawn(at(5, 8, 0, 2, 1), -P, null).spawn(at(7, 4, 0, -1, 0), Math.PI, null);
m.spawn(at(6, 2, 0, 2, 4), -P, null).spawn(at(4, 5, 2, 2, 0), Math.PI, null).spawn(at(7, 1, 0, 0, 0), -P, null);

// ---------------------------------------------------------------- pickups
// Roof: sniper rifle among the vents. Hall bridge: double damage. Duct top: heavy armour. Back strip: big health.
m.pickup('weapon_sniper', at(4, 6, 2, 0, 0)).pickup('ammo_sniper', at(2, 4, 2, 0, 0));
m.pickup('powerup_damage', at(4, 5, 1, 0, 0));
m.pickup('armor_large', [21, 4, ZC]);
m.pickup('health_large', at(6, 8, 0, 0, 1));
// Rockets in the lot between the trucks, explosives on either flank.
m.pickup('weapon_rockets', at(4, 2, 0, -2, -2)).pickup('ammo_explosive', at(0, 3, 0, 0, 0)).pickup('ammo_explosive', at(7, 7, 0, -1, 0));
// Weapons round the map.
m.pickup('weapon_rifle', at(1, 1, 0, 2, -2)).pickup('weapon_rifle', at(4, 6, 0, 0, -1)); // Embers' corner, hall floor
m.pickup('weapon_smg', at(4, 7, 1, -2, 0)); // centre office
m.pickup('weapon_shotgun', at(5, 7, 0, 0, 0)); // back of the hall
m.pickup('weapon_auto_shotgun', at(0, 8, 0, 0, 0)); // duct mouth
m.pickup('weapon_launcher', at(0, 7, 0, 0, 0)); // alley
m.pickup('weapon_marksman', at(7, 5, 0, 0, 0)); // east lane
m.pickup('weapon_burst_rifle', at(2, 2, 0, 0, 0)); // west lot
m.pickup('weapon_lmg', at(6, 4, 1, 0, 0)); // south-east catwalk
// Armour, health and ammo.
m.pickup('armor_small', at(5, 7, 1, 0, 0)).pickup('armor_small', at(1, 3, 0, 0, 0)).pickup('armor_small', at(7, 2, 0, 0, 0));
m.pickup('health_small', at(1, 6, 0, 0, 0)).pickup('health_small', at(5, 0, 0, 0, 0)).pickup('health_small', at(5, 5, 0, 0, 0));
m.pickup('health_small', at(2, 7, 1, 0, 0)).pickup('health_small', at(6, 1, 0, 0, 0)).pickup('health_small', at(6, 7, 2, 0, 0));
m.pickup('ammo', at(2, 1, 0, -2, 0)).pickup('ammo', at(3, 5, 0, 0, 0)).pickup('ammo_rifle', at(3, 8, 0, 0, 2)).pickup('ammo_shells', at(3, 7, 1, 2, -2));
m.pickup('grenades', at(3, 0, 0, 0, 0)).pickup('grenades', at(6, 7, 1, 0, 0));

// ---------------------------------------------------------------- props
// The hall: shelving rows, crate stacks, a conveyor by the loading door.
for (const [x, z] of [[22, 46], [22, 50], [42, 46], [42, 50]] as const) m.prop('shelf_boxes', [x, 0, z], P);
m.prop('shelf_end', [22, 0, 53.5], P).prop('shelf_bags', [42, 0, 53.5], P);
m.prop('cargo_crate', [27, 0, 38], 0.2).prop('cargo_crate', [37, 0, 37], -0.3).prop('crate_large', [37.5, 1.2, 37], -0.3);
m.prop('factory_box', [26.5, 0, 57], 0).prop('factory_box', [26.5, 0, 54.6], 0.1).prop('factory_box', [26.5, 1.2, 55.8], 0.05);
m.prop('conveyor', [32, 0, 32.5], 0).prop('crate_large', [42, 0, 30], 0).prop('dungeon_barrel', [17, 0, 29]).prop('barrel', [18, 0, 29.5]);
m.prop('workbench', [50.5, 0, 58.5]).prop('metal_crate', [51, 0, 50]).prop('planks_stack', [26, 0, 46], P);
// Offices: desks, filing, a kitchen corner.
m.prop('desk', [27, 4, 57.5], Math.PI).prop('office_chair', [27, 4, 56.4]);
m.prop('desk', [32, 4, 57.5], Math.PI).prop('office_chair', [32, 4, 56.4]).prop('bookcase', [37, 4, 59.2], Math.PI).prop('bookcase', [36, 4, 59.2], Math.PI);
m.prop('sofa', [16, 4, 59], Math.PI).prop('tv', [13, 4, 56], P).prop('fridge', [43, 4, 59], Math.PI).prop('kitchen_cabinet', [41.8, 4, 59], Math.PI);
m.prop('screen_panel', [50.8, 4, 56], -P).prop('trashcan', [29, 4, 59]);
// Catwalk: a few boxes for cover by the windows.
m.prop('cardboard_box', [21, 4, 30]).prop('cardboard_open', [22, 4, 30.4], 0.4).prop('crate_large', [44, 4, 30.5], P);
// Roof: vents and units among which the sniper hides.
m.prop('machine', [21, 8, 52], 0).prop('big_pipe', [28, 8, 37]).prop('big_pipe', [40, 8, 45]).prop('metal_crate', [36, 8, 52]).prop('pipe_valve', [26, 8, 56]);
m.prop('machine_window', [44, 8, 34], P);
// The lot: crates, barrels, barriers, a dumpster, floodlights.
m.prop('cargo_crate', [9.5, 0, 12.5], 0.1).prop('crate_large', [10, 1.2, 12.8], 0.1); // steps up the container stack
m.prop('factory_box', [16, 0, 26], 0.2).prop('barrel', [30, 0, 8]).prop('barrel', [31, 0, 8.6]).prop('barrel_open', [30.4, 0, 9.5]);
m.prop('barrier', [42, 0, 4]).prop('barrier', [46, 0, 4.5]).prop('barrier_high', [56, 0, 26], 0.3).prop('cargo_crate', [55, 0, 6], -0.3);
m.prop('cone', [18, 0, 4], 0, 1, false).prop('cone', [20, 0, 3.6], 0, 1, false).prop('warning_sign', [25, 0, 5]);
m.prop('skip', [3, 0, 26], 0).prop('trashcan', [1, 0, 49]).prop('cardboard_box', [2, 0, 50]).prop('dungeon_barrel', [-2, 0, 58]);
m.prop('crate_large', [6, 0, 34], 0).prop('cargo_crate', [52, 0, 64], 0.2).prop('pipe_valve', [58, 0, 36]).prop('hopper_tall', [57, 0, 62]);
for (const [x, z, yaw] of [[-2.8, 2, P], [28, -3, 0], [58, 15, -P], [-2.8, 30, P], [-2.8, 62, P], [58, 40, -P]] as const) m.prop('lightpost', [x, 0, z], yaw);
m.breakable('gas', [40, 0, 2]);
m.breakable('generator', [-2, 0, 66], P);

// Hostage Rescue (cs_assault style): four hostages held in the hall and the offices; Embers bring them out to the lot.
m.hostage([30, 0, 44], Math.PI).hostage([34, 0, 44], Math.PI).hostage([29.5, 4, 55.5], 0).hostage([35, 4, 55.5], 0);
m.rescue([14, 0, 6], 5);

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
// Round the lot: a level apron, then spoil heaps and earth banks, rough grass on the hills behind the docks.
ground = sculpt(56, 6, (x, z, d) => sm(6, 28, d) * (5 + 2.5 * Math.sin(x / 9 + 1) * Math.cos(z / 12) + 1.5 * Math.sin((x - z) / 7)) + sm(26, 52, d) * 7, (x, z, d, h) => {
  if (d < 9) return ['gravel', 0];
  if (h > 11) return ['grass', 2];
  return [Math.sin(x / 6) * Math.cos(z / 8) > 0 ? 'dirt' : 'gravel', 1];
});
for (const [x, z] of [[-6, 10], [-6, 44], [62, 2], [62, 30], [62, 62], [20, 70], [48, 70], [40, -6]] as const) plant(Math.abs(x + z) % 3 ? 'nt_dead_tree' : 'nt_common_tree_2', x, z, { r: 0.8 });
// Weeds gone wild in the alley, the back strip and the east lane: places to lie low on the way round the warehouse.
for (const [x, z] of [[-2, 40], [10, 44], [-2, 62], [44, 66], [16, 66], [58, 30], [60, 42], [4, 30]] as const) clump(x, z, 2, 2, ['nt_bush_leafy', 'bush', 'nt_fern_wide']);
plant('sv_trashcan_metal', 50.5, 66.5, { yaw: Math.PI, scale: 1, r: 0.4 });
plant('sv_propane', 59, 57, { yaw: 0.3, scale: 1, r: 0.5 });
m.lightRooms();
m.meta({
  description:
    'A two-storey warehouse on a floodlit industrial lot at dusk. Tide hold the warehouse: an open hall of crates and shelving behind the loading door, catwalks and offices upstairs, a bridge across the middle. Embers come in off the road through the parking lot of trucks and containers, by the side door from the alley, the front door off the east lane, up the fire escape to the roof and down its hatches, or through the cramped air duct into the offices. In Hostage Rescue, Embers bring the four hostages out to the lot.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [8, 16],
});
await m.save();
