/**
 * Glasswork Office: a two-wing office block on a snowy winter night (layout
 * homage to Counter-Strike's cs_office, under our own name). Tide hold the
 * building and four hostages; Embers come in from the snowy parking lot and
 * the garage at the back to bring them out.
 *
 * - The front: the lobby with the reception desk behind a sliding glass
 *   double door off the snowy front plaza, offices and a cubicle bay either side.
 * - The main hallway (east-west, behind the lobby) with the vending machines
 *   and the water cooler; side doors from the snow at both ends.
 * - The long hall: a north-south corridor down the west wing from the main
 *   hallway to the back hallway, past the break room and the server room.
 * - The middle: an open cubicle farm behind half walls, the projector room and
 *   the manager's office.
 * - The conference room (east, 2 × 2): big glass windows onto the east yard,
 *   the main hallway and the projector room; sliding double doors. Every pane
 *   in the building can be shot out.
 * - The back: the back hallway, the double back doors onto the parking lot,
 *   the storeroom through to the parking garage, and a stair up to the
 *   upstairs offices (windows over the lot), which the fire escape in the
 *   snowy east yard also reaches.
 *
 * Grid x east, y north (one cell = 8 m); levels z0 and z1 (upstairs offices).
 *
 *   y10  w  w  w  p  p  p  p  p  p  p  p  e      p front plaza, w west yard, e east yard
 *   y9   w  w  w  p  p  p  p  p  p  p  p  e
 *   y8   w  w  w  o  o  L  L  L  o  c  c  e      L lobby (front door at x6), c cubicle bay
 *   y7   w  w  w  =  =  =  =  =  =  =  =  e      = main hallway (vending machines)
 *   y6   w  w  w  |  K  c  c  c  P  C  C  e      | long hall, K break room, P projector, C conference
 *   y5   w  w  w  |  S  c  c  c  M  C  C  e      S server room, M manager's office
 *   y4   G  G  G  =  =  =  =  =  =  =  =  F      = back hallway, F fire escape (up south)
 *   y3   G  G  G  s  o  B  B  /  o  o  o  e      s storeroom, B back doors, / stairs up; z1 offices over x8..10
 *   y2   G  G  G  l  l  l  l  l  l  l  l  e      G parking garage
 *   y1   l  l  l  l  l  l  l  l  l  l  l  e      l parking lot (Embers)
 *   y0   l  l  l  l  l  l  l  l  l  l  l  e
 *        0  1  2  3  4  5  6  7  8  9 10 11
 */
import type { EdgeStyle, RoomOptions, Side, TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('glasswork_office', 'Glasswork Office');
m.theme('lab');
m.backdrop('night', 'city', 'snow', 0.6, 0.35);
m.teams([8, 8]);
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
const OFFSET: Record<Side, [number, number]> = { N: [0, 4], S: [0, -4], E: [4, 0], W: [-4, 0] };
let doors = 0;
/** A wall style on one side; windows get breakable glass (it shoots out), `slide` doorways a sliding door. */
function edge(x: number, y: number, z: number, side: Side, style: EdgeStyle | 'slide'): void {
  m.edge(x, y, z, side, style === 'slide' ? 'door' : style);
  const [dx, dy] = OFFSET[side];
  const yaw = side === 'N' || side === 'S' ? 0 : P;
  if (style === 'window') m.glass(x, y, z, side, 'breakable');
  if (style === 'slide') m.add({ kind: 'door', id: `door_${++doors}`, name: 'Glass double door', position: at(x, y, z, dx, dy), yaw, startOpen: false, locked: false, auto: true });
}

// ---------------------------------------------------------------- what each cell is
const KIND: Record<string, string> = {};
const row = (y: number, kinds: string[]) => kinds.forEach((k, i) => (KIND[`${i + 3},${y}`] = k));
row(8, ['off', 'off', 'lob', 'lob', 'lob', 'off', 'cub2', 'cub2']);
row(7, ['hall', 'hall', 'hall', 'hall', 'hall', 'hall', 'hall', 'hall']);
row(6, ['lh', 'kit', 'cub', 'cub', 'cub', 'proj', 'conf', 'conf']);
row(5, ['lh', 'srv', 'cub', 'cub', 'cub', 'mgr', 'conf', 'conf']);
row(4, ['hall', 'hall', 'hall', 'hall', 'hall', 'hall', 'hall', 'hall']);
row(3, ['sto', 'off', 'back', 'back', 'stairs', 'off', 'off', 'off']);
const kind = (x: number, y: number) => KIND[`${x},${y}`];
const inside = (x: number, y: number) => !!kind(x, y);
const garage = (x: number, y: number) => x >= 0 && x <= 2 && y >= 2 && y <= 4;

// ---------------------------------------------------------------- surfaces
const OFFICE: TileSurfaces = { floor: mat('pbr_carpet', '#4e5a6e'), walls: mat('pbr_plaster_white', '#e6e2d8'), solids: mat('pbr_walnut'), underside: mat('pbr_white_panel', '#ecebe6'), trim: mat('pbr_walnut', '#8a6a4a') };
const HALL: TileSurfaces = { ...OFFICE, floor: mat('pbr_terrazzo', '#c8c2b4') };
const LOBBY: TileSurfaces = { ...OFFICE, floor: mat('pbr_marble_black'), walls: mat('pbr_walnut', '#b08a62') };
const KITCHEN: TileSurfaces = { ...OFFICE, floor: mat('pbr_checker') };
const SERVER: TileSurfaces = { ...OFFICE, floor: mat('pbr_tread_plate'), walls: mat('pbr_white_panel', '#c8ccd2') };
const CONF: TileSurfaces = { ...OFFICE, floor: mat('pbr_carpet', '#6a3a3a'), walls: mat('pbr_walnut') };
const BACK: TileSurfaces = { ...OFFICE, floor: mat('pbr_concrete'), walls: mat('pbr_concrete', '#b8b6b0') };
const GARAGE: TileSurfaces = { floor: mat('pbr_concrete_dark'), walls: mat('pbr_concrete', '#9a9890'), solids: mat('pbr_concrete'), underside: mat('pbr_concrete', '#8a8880'), trim: mat('hazard') };
const SNOW: TileSurfaces = { floor: mat('pbr_snow'), walls: mat('pbr_brick_old', '#8a8078') };
const LOT: TileSurfaces = { floor: mat('pbr_asphalt', '#b4b8c0'), walls: mat('pbr_brick_old', '#8a8078') };
const SURF: Record<string, TileSurfaces> = { off: OFFICE, cub: OFFICE, cub2: OFFICE, mgr: OFFICE, proj: OFFICE, hall: HALL, lh: HALL, lob: LOBBY, kit: KITCHEN, srv: SERVER, conf: CONF, back: BACK, sto: BACK, stairs: BACK };
const ROOF: RoomOptions = { ceiling: 'roof', facade: 'brick' };

// ---------------------------------------------------------------- tiles
for (let x = 0; x <= 11; x++) for (let y = 0; y <= 10; y++) {
  if (inside(x, y)) {
    if (kind(x, y) === 'stairs') m.tile('stairs', x, y, 0, 0); // back doors (west) up east to the upstairs offices
    else m.tile('room', x, y, 0, 0, ROOF);
    paint(x, y, 0, SURF[kind(x, y)!]!);
  } else if (garage(x, y)) {
    m.tile('room', x, y, 0, 0, { ceiling: 'roof', corners: 'posts' });
    paint(x, y, 0, GARAGE);
  } else if (x === 11 && y === 4) {
    m.tile('stairs_open', 11, 4, 0, 1); // fire escape: from the yard at (11,5) up south to the landing
    paint(11, 4, 0, SNOW);
  } else {
    m.tile('yard', x, y);
    paint(x, y, 0, y <= 1 || (y === 2 && x >= 3 && x <= 10) ? LOT : SNOW);
  }
}
// Upstairs offices over the back row, and the fire-escape landing.
for (const x of [8, 9, 10]) {
  m.tile('room', x, 3, 1, 0, ROOF);
  paint(x, 3, 1, OFFICE);
}
m.tile('platform_rail', 11, 3, 1);
paint(11, 3, 1, { floor: mat('pbr_walkway'), trim: mat('pbr_steel', '#3a3e44') });

// ---------------------------------------------------------------- walls inside the building
const SAME = new Set(['hall', 'lh', 'lob', 'cub', 'cub2', 'conf', 'back']);
const join = (a: string, b: string) => (a === b && SAME.has(a)) || ((a === 'hall' || a === 'lh') && (b === 'hall' || b === 'lh'));
/** Openings between unlike cells (east side of x,y or north side of x,y); the rest are walls. */
const EAST: Record<string, EdgeStyle | 'slide'> = {
  '3,8': 'door', '8,8': 'door',
  '3,6': 'door', '7,6': 'wall', '8,6': 'window', // projector room looks into the conference room
  '3,5': 'door', '7,5': 'door',
  '3,3': 'door', '4,3': 'door', '6,3': 'open', '7,3': 'wall', '8,3': 'door', '9,3': 'door',
};
const NORTH: Record<string, EdgeStyle | 'slide'> = {
  // y7 -> front row
  '3,7': 'door', '4,7': 'door', '5,7': 'window', '6,7': 'slide', '7,7': 'window', '8,7': 'door', '9,7': 'arch',
  // y6 -> main hallway
  '4,6': 'door', '5,6': 'half', '6,6': 'wide', '7,6': 'half', '8,6': 'door', '9,6': 'window', '10,6': 'slide',
  // y5 -> y6
  '8,5': 'door',
  // back hallway -> y5
  '4,4': 'door', '5,4': 'half', '6,4': 'wide', '7,4': 'half', '8,4': 'door', '9,4': 'slide', '10,4': 'window',
  // back row -> back hallway
  '3,3': 'door', '4,3': 'door', '5,3': 'wide', '6,3': 'wide', '7,3': 'wall', '8,3': 'door', '10,3': 'door',
};
for (let x = 3; x <= 10; x++) for (let y = 3; y <= 8; y++) {
  const k = kind(x, y)!;
  if (x < 10 && !(k === 'stairs')) {
    const n = kind(x + 1, y)!;
    edge(x, y, 0, 'E', EAST[`${x},${y}`] ?? (join(k, n) ? 'open' : 'wall'));
  }
  if (y < 8) {
    const n = kind(x, y + 1)!;
    if (n === 'stairs' || k === 'stairs') continue;
    edge(x, y, 0, 'N', NORTH[`${x},${y}`] ?? (join(k, n) ? 'open' : 'wall'));
  }
}
m.edge(7, 3, 0, 'N', 'wall').edge(7, 3, 0, 'E', 'wall');

// ---------------------------------------------------------------- the building's outside walls
const OUT: Record<string, EdgeStyle | 'slide'> = {
  // west face
  '3,3,W': 'door', '3,4,W': 'wall', '3,5,W': 'window', '3,6,W': 'window', '3,7,W': 'door', '3,8,W': 'window',
  // east face
  '10,3,E': 'window', '10,4,E': 'door', '10,5,E': 'window', '10,6,E': 'window', '10,7,E': 'door', '10,8,E': 'window',
  // back (south) face: the double back doors
  '3,3,S': 'wall', '4,3,S': 'window', '5,3,S': 'slide', '6,3,S': 'slide', '7,3,S': 'wall', '8,3,S': 'window', '9,3,S': 'wall', '10,3,S': 'window',
  // front (north) face: the lobby's glass front and its sliding doors
  '3,8,N': 'window', '4,8,N': 'window', '5,8,N': 'window', '6,8,N': 'slide', '7,8,N': 'window', '8,8,N': 'window', '9,8,N': 'window', '10,8,N': 'window',
};
for (const [key, style] of Object.entries(OUT)) {
  const [x, y, side] = key.split(',') as [string, string, Side];
  edge(+x, +y, 0, side, style);
}
// Upstairs offices: windows over the lot, a door out to the fire-escape landing.
edge(8, 3, 1, 'S', 'window');
edge(9, 3, 1, 'S', 'window');
edge(10, 3, 1, 'S', 'window');
for (const x of [8, 9, 10]) m.edge(x, 3, 1, 'N', 'wall');
m.edge(8, 3, 1, 'E', 'door').edge(9, 3, 1, 'E', 'open').edge(10, 3, 1, 'E', 'door');
m.edge(11, 3, 1, 'S', 'railing').edge(11, 3, 1, 'E', 'railing').edge(11, 3, 1, 'N', 'open');
// Fire escape: open on the yard side, against the building on the west.
m.edge(11, 4, 0, 'N', 'open').edge(11, 4, 0, 'E', 'railing').edge(11, 4, 0, 'W', 'wall');
m.edge(11, 4, 1, 'E', 'railing').edge(11, 4, 1, 'W', 'wall').edge(11, 4, 1, 'S', 'open');

// ---------------------------------------------------------------- the garage
for (let x = 0; x <= 2; x++) {
  m.edge(x, 2, 0, 'S', x === 1 ? 'wide' : x === 0 ? 'wide' : 'wall');
  m.edge(x, 4, 0, 'N', x === 1 ? 'door' : 'wall');
  if (x < 2) m.edge(x, 2, 0, 'E', 'open').edge(x, 3, 0, 'E', 'open').edge(x, 4, 0, 'E', 'open');
  m.edge(x, 2, 0, 'N', 'open').edge(x, 3, 0, 'N', 'open');
}
m.edge(2, 2, 0, 'E', 'wide').edge(2, 4, 0, 'E', 'wall');
for (let y = 2; y <= 4; y++) m.edge(0, y, 0, 'W', 'wall');

// ---------------------------------------------------------------- the grounds: walls round the lot and the yards
for (let y = 0; y <= 10; y++) m.edge(0, y, 0, 'W', y >= 2 && y <= 4 ? 'wall' : 'high');
for (let y = 0; y <= 10; y++) if (y !== 4) m.edge(11, y, 0, 'E', 'high');
for (let x = 0; x <= 11; x++) m.edge(x, 0, 0, 'S', 'fence').edge(x, 10, 0, 'N', 'high');
for (const x of [4, 5, 7, 8]) m.edge(x, 9, 0, 'N', 'half'); // planters across the plaza

// ---------------------------------------------------------------- cars (blocks)
const TYRES = { material: 'pbr_steel', tint: '#2a2a2a' };
const SNOWCAP = { material: 'pbr_snow' };
/** Designersoup's low-poly cars (CC0), taken in turn. */
const CAR_MODELS = ['car_beetle', 'car_racer', 'car_offroader', 'car_pickup'] as const;
let carN = 0;
/** A parked car, north-south or east-west: Designersoup's cars in turn. */
function car(cx: number, cz: number, ns: boolean): void {
  m.prop(CAR_MODELS[carN++ % CAR_MODELS.length]!, [cx, 0, cz], ns ? 0 : P);
}
car(14, 2, true);
car(26, 8, false);
car(50, 3, true);
car(62, 9, false);
car(76, 2, true);
car(2, 22, true); // in the garage
car(10, 30, true);
// A van parked on the plaza.
m.block([60, 0.3, 78], [6, 2.4, 2.4], 'solid', { material: 'pbr_white_panel' });
m.block([60, 0, 78], [4.6, 0.3, 2.2], 'solid', TYRES);
m.block([60, 2.7, 78], [5.8, 0.12, 2.2], 'solid', SNOWCAP);

// ---------------------------------------------------------------- spawns, hostages, pickups
// Embers: the parking lot at the back.
for (const [x, z] of [[20, -2], [30, -2], [40, -2], [56, -2], [36, 4], [44, 4], [68, -2], [6, -2]] as const) m.spawn([x, 0, z], 0, embers);
// Tide: the lobby, the main hallway and the front offices.
m.spawn(at(5, 8, 0, 0, 1), PI, tide).spawn(at(7, 8, 0, 0, 1), PI, tide).spawn(at(6, 8, 0, -2, 2), PI, tide).spawn(at(4, 7, 0, 0, 0), P, tide);
m.spawn(at(8, 7, 0, 0, 0), -P, tide).spawn(at(3, 8, 0, 0, 1), PI, tide).spawn(at(8, 8, 0, 0, 1), PI, tide).spawn(at(10, 7, 0, 0, 0), -P, tide);
// Free-for-all extras.
m.spawn(at(1, 7, 0), P, null).spawn(at(11, 8, 0), -P, null).spawn(at(4, 10, 0), PI, null).spawn(at(9, 3, 1, 0, -1), 0, null);
m.spawn(at(1, 3, 0, 2, 0), 0, null).spawn(at(6, 4, 0), 0, null);
// Four hostages: two in the conference room, one in the projector room, one in the manager's office.
m.hostage(at(9, 6, 0, 1, 0), 0).hostage(at(10, 5, 0, -1, 1), P).hostage(at(8, 6, 0, 0, 1), PI).hostage(at(8, 5, 0, 0, -1), 0);
m.rescue([40, 0, 2], 6).rescue(at(1, 3, 0, 0, 0), 4);
// Weapons and kit.
m.pickup('weapon_sniper', at(9, 3, 1, 2, 1)).pickup('ammo_sniper', at(10, 3, 1, -1, 1));
m.pickup('weapon_rifle', at(1, 8, 0)).pickup('weapon_rifle', at(11, 6, 0)).pickup('weapon_smg', at(6, 7, 0, 0, 0));
m.pickup('weapon_shotgun', at(3, 5, 0)).pickup('weapon_auto_shotgun', at(6, 5, 0)).pickup('weapon_burst_rifle', at(2, 0, 0));
m.pickup('weapon_marksman', at(6, 10, 0)).pickup('weapon_lmg', at(9, 0, 0)).pickup('weapon_machine_pistol', at(5, 3, 0, 0, 1));
m.pickup('armor_large', at(4, 5, 0)).pickup('armor_small', at(0, 2, 0, 2, 0)).pickup('armor_small', at(9, 8, 0));
m.pickup('health_large', at(4, 6, 0)).pickup('health_small', at(11, 2, 0)).pickup('health_small', at(0, 9, 0));
m.pickup('health_small', at(3, 3, 0)).pickup('health_small', at(10, 4, 0)).pickup('health_small', at(8, 3, 1));
m.pickup('ammo', at(7, 1, 0)).pickup('ammo', at(5, 4, 0)).pickup('ammo_rifle', at(3, 7, 0)).pickup('ammo_shells', at(9, 7, 0));
m.pickup('grenades', at(1, 10, 0)).pickup('grenades', at(10, 10, 0)).pickup('grenades', at(4, 4, 0));

// ---------------------------------------------------------------- set pieces by hand
// Vending machines and the water cooler along the main hallway.
m.prop('freezers_upright', at(5, 7, 0, 0, -2.85), 0).prop('freezers_upright', at(7, 7, 0, 0, -2.85), 0).prop('bottle_return', at(8, 7, 0, 3, -2.9), 0);
m.prop('bottle_return', at(4, 7, 0, -2.6, -2.9), 0).prop('potted_plant', at(3, 7, 0, -3, 3)).prop('potted_plant', at(10, 7, 0, 3, -3)).prop('hm_bin_large', at(9, 7, 0, 0, -3));
m.prop('potted_plant', at(3, 4, 0, -3, -3)).prop('potted_plant', at(10, 4, 0, 3, 3)).prop('trashcan', at(7, 4, 0, 0, 3));
// Cubicle farm: rows of desks with computers, back to back.
for (const x of [5, 7]) for (const dz of [-1.6, 1.6]) {
  const [cx, , cz] = at(x, 5, 0, 0, 4);
  m.prop('desk', [cx - 1.6, 0, cz + dz], dz < 0 ? 0 : PI).prop('desk', [cx + 1.6, 0, cz + dz], dz < 0 ? 0 : PI);
  m.prop('computer', [cx - 1.6, 0.8, cz + dz * 1.0], dz < 0 ? PI : 0, 0.45, false).prop('office_chair', [cx + 1.6, 0, cz + dz * 1.65], dz < 0 ? PI : 0);
}
// Garage: crates, a workbench and oil drums.
m.prop('workbench', at(0, 4, 0, -2.5, 2.4), PI).prop('metal_crate', at(2, 4, 0, 2, 2)).prop('barrel', at(1, 2, 0, -2, -2.5)).prop('barrel', at(1, 2, 0, -1.2, -2.8));
m.prop('shelf_boxes', at(2, 3, 0, 2.6, 0), -P).prop('cardboard_box', at(2, 2, 0, 2.5, 2));
// Outside: lamp posts, snowy pines and bushes, the dumpster and barriers.
for (const [x, z, yaw] of [[-2.6, 6, P], [92, 6, -P], [26, 82, PI], [58, 82, PI], [-2.6, 60, P], [92, 54, -P]] as const) m.prop('lightpost', [x, 0, z], yaw);
for (const [x, z] of [[-1, 74], [12, 82], [86, 82], [-1, 50], [14, 46]] as const) m.prop('nt_pine_snow_tall', [x, 0, z], (x * 7) % 6, 0.8);
for (const [x, z] of [[36, 74], [52, 74], [6, 64], [90, 30], [90, 66], [20, 70]] as const) m.prop('nt_bush_snow', [x, 0, z], (x + z) % 6, 1.2, false);
m.prop('nt_rock_snow', [12, 0, 58], 0.5).prop('nt_rock_snow', [74, 0, 70], 2);
m.prop('skip', [90, 0, 14], 0).prop('barrier', [24, 0, 15]).prop('barrier', [56, 0, 15]).prop('sv_trashcan_metal', [84, 0, 20], 0);
m.breakable('generator', [90, 0, 46], -P);

// ---------------------------------------------------------------- dressing (after spawns, hostages and pickups, which it keeps clear)
m.dress({ x0: 9, y0: 5, x1: 10, y1: 6 }, 'conference', { density: 'full' });
m.dress([5, 8, 0], 'lobby', { density: 'full' }).dress([7, 8, 0], 'lobby');
m.dress([4, 6, 0], 'kitchen', { density: 'full' }).dress([4, 5, 0], 'server', { density: 'full' });
m.dress([8, 6, 0], 'classroom', { density: 'normal' }); // the projector room
m.dress([8, 5, 0], 'office', { density: 'full' });
for (const [x, y] of [[3, 8], [4, 8], [8, 8], [4, 3], [8, 3], [9, 3], [10, 3]] as const) m.dress([x, y, 0], 'office', { density: 'full' });
m.dress({ x0: 9, y0: 8, x1: 10, y1: 8 }, 'office', { density: 'full' }); // the front cubicle bay
m.dress([3, 3, 0], 'storage', { density: 'full' });
for (const x of [8, 9, 10]) m.dress([x, 3, 1], 'office');
m.dress({ x0: 0, y0: 2, x1: 2, y1: 4 }, 'workshop', { density: 'sparse' });

// ---------------------------------------------------------------- lights: warm inside, cold outside
for (let x = 3; x <= 10; x++) for (let y = 3; y <= 8; y++) if (kind(x, y) !== 'stairs') m.light(at(x, y, 0, 0, 0, 3.45), { color: '#ffd9a8', intensity: 1.1, range: 10 });
for (const x of [8, 9, 10]) m.light(at(x, 3, 1, 0, 0, 3.45), { color: '#ffd9a8', intensity: 1, range: 9 });
for (let x = 0; x <= 2; x++) for (let y = 2; y <= 4; y++) m.light(at(x, y, 0, 0, 0, 3.45), { color: '#e8f0ff', intensity: 0.9, range: 9, fixture: 'strip' });
for (const [x, z] of [[-1.6, 6], [91, 6], [26, 81], [58, 81], [-1.6, 60], [91, 54]] as const) m.light([x, 3.2, z], { color: '#bcd4ff', intensity: 1.2, range: 16, fixture: 'none' });
m.light([40, 4, 8], { color: '#bcd4ff', intensity: 1, range: 18, fixture: 'none' });

m.bounds('invisible');
m.meta({
  description:
    'A two-wing office block on a snowy winter night. Tide hold the building: the lobby and reception, the main hallway with the vending machines, the long hall, the cubicle farm, the break room, the server room, the projector room and the glass-walled conference room. Embers come in from the snowy parking lot and the garage at the back, by the back doors, the side doors, or up the fire escape to the upstairs offices. Every pane of glass can be shot out. In Hostage Rescue, Embers bring the four hostages out to the lot or the garage.',
  modes: ['core.hostage', 'core.tdm', 'core.deathmatch', 'core.elim'],
  players: [8, 16],
});
await m.save();
