/**
 * Riot Junction: a city intersection on a riot night (our own map). Two
 * avenues cross under orange street lights; the four blocks round them are
 * full of businesses you can go into, apartments with fire escapes up to
 * rooftops joined by planks, alleys, a parking garage and a subway platform
 * under the west avenue. Rioters hold the north and west behind burning
 * barricades of overturned cars; riot police come up from the south and east
 * behind their barriers with an armoured APC.
 *
 * - North-east: the Quik Cash convenience store on the corner with its cash
 *   vault (bomb site A) and stock room, the diner and its kitchen, the diner
 *   lot; apartments A and B behind the service alley, roofs joined by a plank
 *   (the rooftop hill is on B).
 * - South-east: the bar on the corner with its back rooms, the mechanic's
 *   garage (cars up on lifts), a pawn shop, a laundromat and apartment D
 *   along a back alley, the junkyard and the police lot.
 * - South-west: the parking garage (ramp up from the street to the open top
 *   deck, a stairwell, bomb site B on the ground floor), a check-cashing
 *   office, and the two subway entrances down to the platform.
 * - North-west: the gas station on the corner (shoot the gas cylinders by the
 *   pumps), apartments E and F joined by a plank, the rioters' camp.
 * - The streets: burning barricades across the north and west avenues
 *   (wrecks, braziers and flame jets), police barriers across the south and
 *   east, parked cars, bus stops and bins. Every shop window shoots out.
 *
 * Grid x east, y north (one cell = 8 m). Avenues: x 12..13 (north-south) and
 * y 12..13 (east-west), crossing on the 4 × 4 crossroads at x 11..14, y 11..14;
 * the cells either side of them (x 11, x 14, y 11, y 14) are pavement.
 *
 *   y25  N  N  N  N  N  N  N  N  N  N  N  |  |  N  N  N  N  N  N  N  N  N  N  N
 *   y17..24  F  F  .  E  E  . camp     .   |  |  A  A  .  B  B  .  .  .  .  .  .
 *   y15..16  .  .  .  .  .  .  .  .  .  G  G  |  |  S  S  V  D  D  K  .  lot  .     S store, V vault, D diner, K kitchen, G gas station
 *   y12..13  ======== west avenue ========  +  +  ========= east avenue ========
 *   y9..10   .  .  .  .  .  .  P  P  P  P  .  |  |  R  R  r  .  M  M  M  M  j  j  R bar, M mechanic, j junkyard
 *   y6..8    .  .  .  C  C  .  P  P  P  P  .  |  |  w  w  .  L  L  .  D  D  p  p  P parking garage, w pawn, L laundromat, p police lot
 *   y0..5    city blocks and yards        |  |  city blocks and yards
 *            0                   10 11 12 13 14 15                  25
 *
 * The subway platform runs under the west avenue (x 1..9, level -1), down
 * the stairs at (2, 11) and (8, 11).
 */
import { buildOccupancy, type EdgeStyle, type RoomOptions, type RoomType, type Side, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('riot_junction', 'Riot Junction');
m.theme('city');
m.backdrop('night', 'city', 'gravel', 0.55, 0.3);
m.teams([16, 16]);
const [rioters, police] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const PI = Math.PI;
type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [x * 8 + dx, z * 4 + up, y * 8 + dy];
const r2 = (n: number) => +n.toFixed(2);
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const SIDE_D: Record<Side, [number, number]> = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };
const SIDES: Side[] = ['N', 'E', 'S', 'W'];
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
/** A wall style on one side; windows get breakable glass (it shoots out). */
function edge(x: number, y: number, z: number, side: Side, style: EdgeStyle): void {
  m.edge(x, y, z, side, style);
  if (style === 'window') m.glass(x, y, z, side, 'breakable');
}
/** Several edges at once: "x,y,z,Side" -> style. */
function edges(list: Record<string, EdgeStyle>): void {
  for (const [k, style] of Object.entries(list)) {
    const [x, y, z, side] = k.split(',') as [string, string, string, Side];
    edge(+x, +y, +z, side, style);
  }
}
/** Rooms to dress once spawns and pickups are down: [cell or rectangle, type, density, max]. */
const DRESSING: [V3 | { x0: number; y0: number; x1: number; y1: number; z?: number }, RoomType, 'sparse' | 'normal' | 'full', number][] = [];
const LIT: V3[] = [];

// ---------------------------------------------------------------- surfaces

const PAVE = mat('pbr_concrete', '#8e8a84');
const ALLEY = mat('pbr_concrete_dark', '#6a6862');
const LOT = mat('pbr_asphalt', '#55555a');
const GRAVEL = mat('pbr_gravel', '#7a746a');
const BRICKWALL = mat('pbr_brick_old', '#8a7a6c');
const S = (floor: ReturnType<typeof mat>, walls: ReturnType<typeof mat>, extra: TileSurfaces = {}): TileSurfaces => ({ floor, walls, underside: mat('pbr_plaster_white', '#d8d2c6'), trim: mat('pbr_walnut', '#5a4434'), solids: mat('pbr_walnut'), ...extra });
const STORE = S(mat('white_tiles', '#e4e2da'), mat('pbr_white_panel', '#e8e6e0'), { underside: mat('pbr_white_panel') });
const VAULT = S(mat('pbr_tread_plate'), mat('pbr_steel', '#8a9098'), { underside: mat('pbr_steel', '#6a7078'), solids: mat('pbr_steel') });
const STOCK = S(mat('pbr_concrete'), mat('pbr_brick_old'), { underside: mat('pbr_concrete') });
const DINER = S(mat('pbr_checker'), mat('pbr_plaster_white', '#e8cfa0'), { trim: mat('paint_gloss', '#c8322a') });
const KITCHEN = S(mat('white_tiles'), mat('white_tiles', '#e8ecec'));
const BAR = S(mat('pbr_floorboards', '#7a5a40'), mat('pbr_brick_old', '#7a5a4c'), { underside: mat('pbr_walnut') });
const SHOP = S(mat('pbr_terrazzo'), mat('pbr_plaster_white', '#d8d0c0'));
const GARAGE = S(mat('pbr_concrete_dark'), mat('pbr_corrugated', '#9aa0a4'), { trim: mat('hazard'), solids: mat('pbr_steel'), underside: mat('pbr_steel', '#7a7e82') });
const PARKING = S(mat('pbr_concrete', '#9a968e'), mat('pbr_concrete', '#a8a49c'), { underside: mat('pbr_concrete', '#8a8680'), trim: mat('hazard'), solids: mat('pbr_concrete') });
const SUBWAY = S(mat('pbr_terrazzo', '#c8c2b4'), mat('white_tiles', '#d4dcd6'), { underside: mat('pbr_concrete', '#8a8a86'), trim: mat('paint_gloss', '#2a6a4a') });
const TRACKBED = S(mat('pbr_gravel', '#5a5650'), mat('white_tiles', '#b8c0bc'), { underside: mat('pbr_concrete', '#7a7a76') });
const FLAT = (tint: string) => S(mat('pbr_floorboards'), mat('pbr_plaster_white', tint));

// ---------------------------------------------------------------- the avenues

m.tile('city.crossroads', 11, 11);
for (let x = 0; x <= 10; x++) m.tile('city.street', x, 12);
for (let x = 15; x <= 25; x++) m.tile('city.street', x, 12);
for (let y = 0; y <= 10; y++) m.tile('city.street', 12, y, 0, 1);
for (let y = 15; y <= 25; y++) m.tile('city.street', 12, y, 0, 1);

// ---------------------------------------------------------------- apartments (three storeys, two stairwells, a roof, a fire-escape ladder)

/**
 * A 2 × 2 apartment block with its south-west cell at (x0, y0): a stairwell
 * up from the ground floor in the south-east cell, another from the first
 * floor in the north-east cell, rooms everywhere else. `doors` are ground-floor
 * doorways ("x,y,Side"); other outside walls are windows (brick on the
 * ground floor where `blind` says so).
 */
function apartment(x0: number, y0: number, tint: string, doors: string[], ladder: [number, number, number], blind: string[] = []): void {
  const rooms: [number, number, number, RoomType][] = [
    [x0, y0, 0, 'living'], [x0, y0 + 1, 0, 'kitchen'], [x0 + 1, y0 + 1, 0, 'living'],
    [x0, y0, 1, 'bedroom'], [x0, y0 + 1, 1, 'bedroom'],
    [x0, y0, 2, 'bedroom'], [x0, y0 + 1, 2, 'living'], [x0 + 1, y0, 2, 'bathroom'],
  ];
  const well = new Set([`${x0 + 1},${y0},0`, `${x0 + 1},${y0},1`, `${x0 + 1},${y0 + 1},1`, `${x0 + 1},${y0 + 1},2`]);
  m.tile('stairwell', x0 + 1, y0, 0, 0);
  m.tile('stairwell', x0 + 1, y0 + 1, 1, 0);
  paint(x0 + 1, y0, 0, FLAT(tint));
  paint(x0 + 1, y0 + 1, 1, FLAT(tint));
  const mine = new Set(rooms.map(([x, y, z]) => `${x},${y},${z}`));
  for (const [x, y, z] of rooms) {
    const top = z === 2;
    m.tile('room', x, y, z, 0, { facade: 'brick', ...(top ? { ceiling: 'roof' } : {}) } as RoomOptions);
    paint(x, y, z, z === 0 && y === y0 + 1 && x === x0 ? S(mat('pbr_checker'), mat('pbr_plaster_white', tint)) : FLAT(tint));
  }
  for (const [x, y, z, type] of rooms) {
    for (const side of SIDES) {
      const [dx, dy] = SIDE_D[side];
      const n = `${x + dx},${y + dy},${z}`;
      if (well.has(n)) continue;
      if (mine.has(n)) {
        if (side === 'N' || side === 'E') edge(x, y, z, side, 'door');
        continue;
      }
      const key = `${x},${y},${side}`;
      edge(x, y, z, side, z === 0 ? (doors.includes(key) ? 'door' : blind.includes(key) ? 'wall' : 'window') : 'window');
    }
    DRESSING.push([[x, y, z], type, 'normal', 18]);
    LIT.push([x, y, z]);
  }
  // A lid over the top of the upper stairwell, flush with the roof.
  m.block([(x0 + 1) * 8, 11.6, (y0 + 1) * 8], [8, 0.4, 8], 'solid', { material: 'pbr_concrete', tint: '#6a6660' });
  // Rooftop clutter: a water tank on legs and an air conditioner.
  m.block([x0 * 8 - 1, 12, y0 * 8 + 9], [2.2, 1.4, 2.2], 'solid', { material: 'pbr_planks', tint: '#5a4636' });
  m.block([x0 * 8 + 9, 12, y0 * 8 - 1], [1.6, 1, 1.2], 'solid', { material: 'pbr_steel', tint: '#b8bcc0' });
  const [lx, lz, yaw] = ladder;
  m.add({ kind: 'ladder', position: [lx, 0, lz], yaw, height: 12.1, width: 0.9 });
  // Fire-escape landings beside the ladder (decor you can stand on).
  const [fx, fz] = [Math.sin(yaw), Math.cos(yaw)];
  for (const h of [3.8, 7.8]) m.block([r2(lx + fz * 1.9 + fx * 0.6), h, r2(lz - fx * 1.9 + fz * 0.6)], fx === 0 ? [2.6, 0.2, 1.2] : [1.2, 0.2, 2.6], 'solid', { material: 'pbr_walkway', tint: '#3a3a3e' });
}
// North-east: A and B behind the service alley, fire escapes down to it.
apartment(15, 18, '#d8c4a8', ['15,18,W', '16,19,N'], [120, 139.6, PI]);
apartment(18, 18, '#c8b4c0', ['18,18,S', '19,19,E'], [152, 139.6, PI]);
// South-east: D beside the police lot.
apartment(21, 6, '#b8c8b0', ['21,6,W', '22,7,N'], [176, 59.6 - 16, PI], ['21,6,S']);
// North-west: F and E, the rioters' side.
apartment(2, 17, '#e0c8a0', ['2,17,S', '3,18,N'], [11.6, 136, -P]);
apartment(5, 17, '#c0b0a0', ['5,17,S', '6,18,E'], [52.4, 136, P]);
// Planks between the roofs.
const PLANK = { material: 'pbr_planks', tint: '#8a6a48' };
m.block([136, 12, 148], [9.2, 0.2, 1.3], 'solid', PLANK); // A to B over x 17
m.block([32, 12, 140], [9.2, 0.2, 1.3], 'solid', PLANK); // F to E over x 4

// ---------------------------------------------------------------- north-east: the convenience store, its vault, the diner

m.tile('room_large', 15, 15, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'storefront' });
paint(15, 15, 0, STORE);
m.tile('room', 17, 15, 0, 0, { ceiling: 'roof', facade: 'brick' });
paint(17, 15, 0, VAULT);
m.tile('room', 17, 16, 0, 0, { ceiling: 'roof', facade: 'brick' });
paint(17, 16, 0, STOCK);
edges({
  '15,15,0,W': 'window', '15,16,0,W': 'window', '15,15,0,S': 'door', '16,15,0,S': 'window',
  '15,16,0,N': 'wall', '16,16,0,N': 'door', '16,15,0,E': 'door', '16,16,0,E': 'wall',
  '17,15,0,S': 'wall', '17,15,0,E': 'wall', '17,15,0,N': 'door', '17,16,0,N': 'door', '17,16,0,E': 'wall',
});
m.tile('room_large', 18, 15, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'plaster' });
paint(18, 15, 0, DINER);
m.tile('room', 20, 15, 0, 0, { ceiling: 'roof', facade: 'plaster' });
m.tile('room', 20, 16, 0, 0, { ceiling: 'roof', facade: 'plaster' });
paint(20, 15, 0, KITCHEN);
paint(20, 16, 0, KITCHEN);
edges({
  '18,15,0,S': 'window', '19,15,0,S': 'door', '18,16,0,N': 'window', '19,16,0,N': 'window',
  '19,15,0,E': 'half', '19,16,0,E': 'door', '20,15,0,N': 'open',
  '20,15,0,S': 'window', '20,15,0,E': 'wall', '20,16,0,E': 'door', '20,16,0,N': 'door',
});
DRESSING.push([{ x0: 15, y0: 15, x1: 16, y1: 16 }, 'shop', 'full', 40], [[17, 15, 0], 'storage', 'normal', 10], [[17, 16, 0], 'storage', 'full', 16]);
DRESSING.push([{ x0: 18, y0: 15, x1: 19, y1: 16 }, 'dining', 'full', 40], [{ x0: 20, y0: 15, x1: 20, y1: 16 }, 'kitchen', 'full', 24]);
// The diner's sign on its roof, the store's over the corner.
m.block([152, 4, 120.6], [10, 1.6, 0.4], 'solid', { material: 'paint_gloss', tint: '#d83a3a' });
m.block([124, 4, 119.4], [7, 1.2, 0.4], 'solid', { material: 'paint_gloss', tint: '#2a8a4a' });

// ---------------------------------------------------------------- south-east: the bar, the mechanic, the back alley

m.tile('room_large', 15, 9, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'brick' });
paint(15, 9, 0, BAR);
m.tile('room', 17, 9, 0, 0, { ceiling: 'roof', facade: 'brick' });
m.tile('room', 17, 10, 0, 0, { ceiling: 'roof', facade: 'brick' });
paint(17, 9, 0, STOCK);
paint(17, 10, 0, KITCHEN);
edges({
  '15,10,0,N': 'window', '16,10,0,N': 'door', '15,10,0,W': 'window', '15,9,0,W': 'door',
  '15,9,0,S': 'wall', '16,9,0,S': 'window', '16,10,0,E': 'door', '16,9,0,E': 'wall',
  '17,9,0,N': 'door', '17,9,0,S': 'door', '17,10,0,N': 'window', '17,9,0,E': 'wall', '17,10,0,E': 'wall',
});
DRESSING.push([{ x0: 15, y0: 9, x1: 16, y1: 10 }, 'bar', 'full', 40], [[17, 9, 0], 'storage', 'full', 14], [[17, 10, 0], 'kitchen', 'normal', 14]);
m.block([124, 4, 87.4], [7, 1.2, 0.4], 'solid', { material: 'paint_gloss', tint: '#e0306a' });
// The mechanic's: two big bays, roller doors on the avenue (one jammed half up), a yard door to the junkyard.
m.tile('room_large', 19, 9, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'plaster' });
m.tile('room_large', 21, 9, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'plaster' });
paint(19, 9, 0, GARAGE);
paint(21, 9, 0, GARAGE);
edges({
  '20,9,0,E': 'open', '20,10,0,E': 'open',
  '19,10,0,N': 'shutter', '20,10,0,N': 'wide', '21,10,0,N': 'window', '22,10,0,N': 'shutter',
  '19,9,0,S': 'door', '20,9,0,S': 'wall', '21,9,0,S': 'wall', '22,9,0,S': 'door',
  '19,9,0,W': 'wall', '19,10,0,W': 'window', '22,9,0,E': 'wide', '22,10,0,E': 'window',
});
DRESSING.push([{ x0: 19, y0: 9, x1: 22, y1: 10 }, 'workshop', 'normal', 30]);
// Pawn shop and laundromat on the back alley.
m.tile('room_large', 15, 6, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'storefront' });
paint(15, 6, 0, SHOP);
edges({ '15,7,0,N': 'window', '16,7,0,N': 'door', '15,6,0,W': 'window', '15,7,0,W': 'window', '16,6,0,E': 'door', '16,7,0,E': 'wall', '15,6,0,S': 'wall', '16,6,0,S': 'wall' });
m.tile('room_large', 18, 6, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'plaster' });
paint(18, 6, 0, S(mat('white_tiles', '#d8e4e8'), mat('pbr_plaster_white', '#b8d0d8')));
edges({ '18,7,0,N': 'window', '19,7,0,N': 'window', '18,6,0,W': 'door', '19,6,0,E': 'door', '18,6,0,S': 'wall', '19,6,0,S': 'window', '18,7,0,W': 'wall', '19,7,0,E': 'wall' });
DRESSING.push([{ x0: 15, y0: 6, x1: 16, y1: 7 }, 'shop', 'full', 30], [{ x0: 18, y0: 6, x1: 19, y1: 7 }, 'storage', 'normal', 20]);

// ---------------------------------------------------------------- south-west: the parking garage, the check-cashing office

// Ramp up from the street (west, at x 5) to the open top deck.
m.tile('ramp', 6, 7, 0, 0);
paint(6, 7, 0, PARKING);
m.tile('stairwell', 9, 9, 0, 0);
paint(9, 9, 0, PARKING);
const DECK: [number, number][] = [[8, 7], [9, 7], [6, 8], [7, 8], [8, 8], [9, 8], [6, 9], [7, 9], [8, 9]];
const deckSet = new Set(DECK.map(([x, y]) => `${x},${y}`));
for (const z of [0, 1]) {
  for (const [x, y] of DECK) {
    m.tile('room', x, y, z, 0, { layout: 'empty', corners: 'columns' });
    paint(x, y, z, PARKING);
  }
  for (const [x, y] of DECK) {
    for (const side of SIDES) {
      const [dx, dy] = SIDE_D[side];
      const n = `${x + dx},${y + dy}`;
      if (n === '9,9' || n === '6,7' || n === '7,7') continue; // the stairwell and the ramp build their own
      if (deckSet.has(n)) {
        if (side === 'N' || side === 'E') m.edge(x, y, z, side, 'open');
        continue;
      }
      m.edge(x, y, z, side, z === 1 ? 'half' : 'wall');
    }
  }
}
edges({ '6,8,0,W': 'wide', '8,7,0,S': 'wide', '9,7,0,E': 'wide', '6,9,0,N': 'wide', '9,8,0,E': 'door' });
// Check cashing: one big room off the pavement of the west avenue.
m.tile('room_large', 2, 7, 0, 0, { layout: 'empty', ceiling: 'roof', facade: 'storefront' });
paint(2, 7, 0, SHOP);
edges({ '2,8,0,N': 'window', '3,8,0,N': 'door', '3,7,0,E': 'window', '3,8,0,E': 'window', '2,7,0,S': 'door', '3,7,0,S': 'wall', '2,7,0,W': 'wall', '2,8,0,W': 'window' });
DRESSING.push([{ x0: 2, y0: 7, x1: 3, y1: 8 }, 'office', 'full', 30]);

// ---------------------------------------------------------------- the subway under the west avenue

for (const x of [2, 8]) {
  m.tile('stairs', x, 11, -1, 1); // down north from the pavement to the platform
  paint(x, 11, -1, SUBWAY);
}
for (let x = 1; x <= 9; x++) {
  m.tile('room', x, 12, -1, 0, { layout: 'empty' });
  paint(x, 12, -1, SUBWAY);
  m.tile('room', x, 13, -1, 0, { layout: 'empty' });
  paint(x, 13, -1, TRACKBED);
}
for (let x = 1; x <= 9; x++) {
  m.edge(x, 12, -1, 'N', 'open');
  if (x < 9) m.edge(x, 12, -1, 'E', 'open').edge(x, 13, -1, 'E', 'open');
  m.edge(x, 13, -1, 'N', 'wall');
  if (x !== 2 && x !== 8) m.edge(x, 12, -1, 'S', 'wall');
}
m.edge(1, 12, -1, 'W', 'wall').edge(1, 13, -1, 'W', 'wall').edge(9, 12, -1, 'E', 'wall').edge(9, 13, -1, 'E', 'wall');
// The platform edge (a step down to the track bed) and the train standing at it.
for (const x of [22, 58]) m.block([x, -4, 101.2], [36, 0.2, 1], 'solid', { material: 'paint_matte', tint: '#e8c832' });
// Two metro cars (Elbolillo's Metro set, CC0, flat-coloured), scaled to clear the ceiling.
for (const x of [22, 52]) m.prop('mt_subway_car', [x, -4, 106], P, 0.85);
// Platform furniture against the back wall, clear of the stairs (x 12..20 and 60..68): seats, bins, machines.
for (const x of [28, 40, 52]) m.prop('mt_bench', [x, -4, 92.6], 0);
for (const x of [34, 46]) m.prop('mt_bin', [x, -4, 92.8], 0);
m.prop('mt_vending_machine', [23.5, -4, 92.7], 0).prop('mt_ticket_machine', [57, -4, 92.6], 0);
for (let x = 6; x <= 74; x += 3.4) m.prop('rail_track', [r2(x), -4, 106], P, 1, false);

// ---------------------------------------------------------------- north-west: the gas station

m.tile('gas_station', 9, 15, 0, 0);
// Elbolillo's fuel pumps (CC0, flat-coloured) over the tile's pump blocks, hoses to the bays; the tile keeps the collision.
for (const [x, z] of [[73.9, 121.1], [78.1, 121.1], [73.9, 123.9], [78.1, 123.9]] as const) m.prop('gs_fuel_pump', [x, 0.2, z], P, 1, false);
// The kiosk: shop shelving on the back wall and a slush machine by the side door; a dumpster out on the forecourt's north side.
m.prop('gs_shop_shelving', [83.1, 0, 124.6], -P).prop('gs_slush_machine', [80.2, 0, 122.6], P).prop('gs_dumpster', [75, 0, 131], 0);
paint(9, 15, 0, S(mat('pbr_concrete', '#b0aca4'), mat('pbr_white_panel', '#e8e4dc'), { solids: mat('paint_gloss', '#c8322a') }));
// Gas cylinders by the pumps and fuel drums by the kiosk: shoot them and the forecourt goes up.
for (const [x, z] of [[73, 121.1], [79, 121.1], [73, 123.9], [79, 123.9]] as const) m.add({ kind: 'destructible', name: 'Gas cylinder', model: 'gas', position: [x, 0.2, z], yaw: 0, health: null, explosiveOnly: false });
for (const [x, z] of [[84.2, 121], [84.2, 124], [70, 129]] as const) m.breakable('barrel', [x, 0, z]);
m.add({ kind: 'ladder', position: [69.15, 0, 120], yaw: -P, height: 5.4, width: 0.9 }); // up the canopy

// ---------------------------------------------------------------- city blocks round the edge (solid; their fronts face in)

m.tile('city.highrise', 3, 0, 0, 0); // x 3..5, y 0..2
m.tile('city.brownstone', 7, 0, 0, 0); // x 7..8, y 0..1
m.tile('city.midrise', 0, 3, 0, 1); // x 0..1, y 2..3, front east
m.tile('city.brownstone', 0, 6, 0, 1); // x 0..1, y 5..6
m.tile('city.highrise', 15, 2, 0, 0); // x 15..17, y 2..4
m.tile('city.midrise', 19, 3, 0, 0); // x 19..20, y 3..4
m.tile('city.brownstone', 22, 1, 0, 0); // x 22..23, y 1..2
m.tile('city.highrise', 8, 25, 0, 2); // x 6..8, y 23..25, front south
m.tile('city.brownstone', 3, 25, 0, 2); // x 2..3, y 24..25
m.tile('city.midrise', 0, 21, 0, 1); // x 0..1, y 20..21
m.tile('city.midrise', 16, 25, 0, 2); // x 15..16, y 24..25
m.tile('city.highrise', 21, 25, 0, 2); // x 19..21, y 23..25
m.tile('city.brownstone', 25, 22, 0, 3); // x 24..25, y 22..23, front west
m.tile('city.brownstone', 25, 18, 0, 3); // x 24..25, y 18..19

// ---------------------------------------------------------------- pavements, alleys and lots

const GROUND: Record<string, ReturnType<typeof mat>> = {};
const region = (x0: number, y0: number, x1: number, y1: number, g: ReturnType<typeof mat>) => {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) GROUND[`${x},${y}`] = g;
};
region(21, 15, 25, 16, LOT); // the diner lot
region(23, 5, 25, 7, LOT); // the police lot
region(23, 9, 25, 10, GRAVEL); // the junkyard
region(0, 19, 10, 22, GRAVEL); // the rioters' camp
region(7, 15, 8, 17, PAVE); // round the gas station
region(0, 0, 25, 0, ALLEY);
const taken = new Set<string>();
const occupancy = buildOccupancy(m.doc).cells;
for (const k of occupancy.keys()) {
  const [x, y, z] = k.split(',').map(Number) as V3;
  if (z === 0) taken.add(`${x},${y}`);
}
for (let x = 0; x <= 25; x++) for (let y = 0; y <= 25; y++) {
  if (taken.has(`${x},${y}`)) continue;
  m.tile('yard', x, y);
  const pave = x === 11 || x === 14 || y === 11 || y === 14;
  paint(x, y, 0, { floor: pave ? PAVE : GROUND[`${x},${y}`] ?? ALLEY, walls: BRICKWALL });
}
// High brick walls round the outside, except where the avenues run out.
for (let i = 0; i <= 25; i++) {
  const avenue = i >= 12 && i <= 13;
  if (avenue) continue;
  for (const [x, y, side] of [[0, i, 'W'], [25, i, 'E'], [i, 0, 'S'], [i, 25, 'N']] as [number, number, Side][]) {
    if (!taken.has(`${x},${y}`)) m.edge(x, y, 0, side, 'high');
  }
}

// ---------------------------------------------------------------- cars, wrecks and barricades (free blocks)

const TYRE = { material: 'pbr_steel', tint: '#1e1e1e' };
const CHAR = { material: 'pbr_charred_wood', tint: '#2a2624' };
const RUST = { material: 'pbr_rusted_plate', tint: '#5a3a2a' };
const turn = (x: number, z: number, yaw: number): [number, number] => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
function part(cx: number, cz: number, yaw: number, lx: number, lz: number, y: number, size: V3, look: Look): void {
  const [ox, oz] = turn(lx, lz, yaw);
  m.block([r2(cx + ox), r2(y), r2(cz + oz)], size, 'solid', { ...look, yaw: r2(yaw) });
}
/** Designersoup's low-poly cars (CC0), taken in turn. */
const CAR_MODELS = ['car_beetle', 'car_racer', 'car_offroader', 'car_pickup'] as const;
let carN = 0;
/** A parked car along local x (a car prop; they face +Z, so a quarter turn more). */
function car(cx: number, cz: number, yaw: number, y = 0): void {
  m.prop(CAR_MODELS[carN++ % CAR_MODELS.length]!, [r2(cx), r2(y), r2(cz)], r2(yaw + P));
}
/** A burnt-out car on its roof: roof down, body up, wheels in the air. */
function wreck(cx: number, cz: number, yaw: number): void {
  part(cx, cz, yaw, -0.2, 0, 0, [2.3, 0.55, 1.75], CHAR);
  part(cx, cz, yaw, 0, 0, 0.55, [4.4, 0.75, 1.95], RUST);
  for (const lx of [-1.4, 1.4]) for (const lz of [-0.8, 0.8]) part(cx, cz, yaw, lx, lz, 1.3, [0.7, 0.3, 0.6], TYRE);
}
/** A police sawhorse barrier: two legs and a striped board (stops nobody's bullets but your shins). */
function sawhorse(cx: number, cz: number, yaw: number): void {
  for (const lx of [-1, 1]) part(cx, cz, yaw, lx, 0, 0, [0.2, 0.9, 0.6], { material: 'paint_matte', tint: '#e8e8e8' });
  part(cx, cz, yaw, 0, 0, 0.75, [2.6, 0.3, 0.2], { material: 'paint_gloss', tint: '#2a4ab0' });
}
let traps = 0;
function flames(x: number, y: number, z: number, yaw: number, offset: number): void {
  m.add({ kind: 'trap', id: `flame_${++traps}`, name: 'Burning barricade', trap: 'flames', position: [x, y, z], yaw, activation: 'cycle', onSeconds: 2.5, offSeconds: 3.5, offsetSeconds: offset, startEnabled: true, damage: 12 });
}
const FIRES: V3[] = [];
function brazier(x: number, z: number): void {
  m.prop('fire_basket', [x, 0, z], 0, 0.55);
  FIRES.push([x, 1.4, z]);
}
// Parked cars along the kerbs (the avenues' roads run 4 m in from the cell edges).
car(30, 93.4, 0);
car(62, 106.6, PI);
car(150, 93.4, 0.05);
car(168, 106.6, PI);
car(93.4, 64, P);
car(106.6, 70, -P);
car(93.4, 164, P);
car(106.6, 170, -P);
// The diner lot and the police lot.
car(176, 122, P);
car(186, 126, P + 0.1);
car(196, 122, P);
car(188, 42, 0);
car(188, 56, 0);
// Up on the mechanic's lifts.
for (const [x, z] of [[156, 78], [172, 78]] as const) {
  for (const dx of [-1.4, 1.4]) m.block([x + dx, 0, z], [0.3, 2.1, 0.3], 'solid', { material: 'pbr_steel', tint: '#c8a832' });
  m.block([x, 1.9, z], [2.4, 0.2, 4.8], 'solid', { material: 'pbr_steel', tint: '#c8a832' });
  car(x, z, P, 2.1);
}
car(164, 76, P); // on the floor between them, bonnet up
// Junkyard: wrecks, rust and tyre stacks.
wreck(190, 76, 0.3);
wreck(198, 82, -0.6);
for (const [x, z] of [[184, 84], [186, 84.2], [196, 72]] as const) m.block([x, 0, z], [0.9, 1.2, 0.9], 'solid', TYRE);
// Garage cars, both decks.
car(68, 70, 0);
car(72, 62, 0);
car(52, 72, P, 4);
car(68, 72, P, 4);
car(72, 56, 0, 4);

// The burning barricade across the north avenue (y 18, z ≈ 146): wrecks, braziers, tyres, a vehicle-wide gap.
wreck(91, 146, 0.2);
wreck(109, 145, -0.15);
for (const [x, z] of [[96, 147], [103.5, 147.5]] as const) m.block([x, 0, z], [2.6, 1.1, 1], 'solid', { material: 'pbr_planks', tint: '#3a2e24' });
brazier(86, 148);
brazier(114, 148);
flames(87, 0, 145, P, 0);
flames(113, 0, 144, -P, 2);
for (const x of [84, 117]) m.block([x, 0, 145], [3, 1.2, 1.2], 'solid', TYRE);
// The burning barricade across the west avenue (x 5.5, x ≈ 44): the same, facing east.
wreck(44, 90, P + 0.2);
wreck(45, 109, P - 0.1);
for (const [x, z] of [[45, 95.5], [45.5, 103]] as const) m.block([x, 0, z], [1, 1.1, 2.6], 'solid', { material: 'pbr_planks', tint: '#3a2e24' });
brazier(42, 86);
brazier(42, 113);
flames(43, 0, 87, 0, 1);
flames(43, 0, 112, PI, 3);
// Rioters' camp (north-west): tents, fires, a burning car.
wreck(40, 168, 1.1);
for (const [x, z] of [[18, 160], [60, 176], [30, 172]] as const) brazier(x, z);
m.prop('sv_tent', [20, 0, 180], 0.4).prop('tent_canvas', [52, 0, 160], 1.2).prop('sv_tent', [72, 0, 172], -0.3);

// Police lines: sawhorse barriers across the south avenue (y 6) and the east avenue (x 20), gaps for the APC.
for (const x of [89, 92.5, 107.5, 111]) sawhorse(x, 52, 0);
for (const z of [89, 92.5, 107.5, 111]) sawhorse(162, z, P);
m.prop('barrier', [96, 0, 50], 0).prop('barrier', [104, 0, 50], 0).prop('barrier', [160, 0, 96], 0).prop('barrier', [160, 0, 104], 0);
for (const [x, z] of [[100, 46], [98, 54], [166, 100], [158, 98]] as const) m.prop('cone', [x, 0, z], 0, 1, false);

// ---------------------------------------------------------------- vehicles

m.add({ kind: 'mount', model: 'armored_rover', position: [100, 0, 20], yaw: 0, faction: police, respawnSeconds: null, skin: 'urban' });
m.add({ kind: 'mount', model: 'armored_rover', position: [188, 0, 100], yaw: -P, faction: police, respawnSeconds: null, skin: 'urban' });
m.add({ kind: 'mount', model: 'buggy', position: [198, 0, 46], yaw: -P, faction: police, respawnSeconds: null, skin: 'urban' });
m.add({ kind: 'mount', model: 'gun_jeep', position: [100, 0, 184], yaw: PI, faction: rioters, respawnSeconds: null });
m.add({ kind: 'mount', model: 'buggy', position: [16, 0, 100], yaw: P, faction: rioters, respawnSeconds: null });
m.add({ kind: 'mount', model: 'buggy', position: [36, 0, 156], yaw: P, faction: rioters, respawnSeconds: null });

// ---------------------------------------------------------------- spawns

// Rioters: the north avenue past the barricade, the camp, the west avenue past its barricade.
for (const [x, z] of [[96, 196], [104, 196], [92, 188], [108, 188], [96, 176], [104, 176], [24, 164], [44, 176], [64, 164], [8, 176]] as const) m.spawn([x, 0, z], PI, rioters);
for (const [x, z] of [[4, 96], [4, 104], [12, 92], [12, 108], [24, 96], [24, 104]] as const) m.spawn([x, 0, z], P, rioters);
// Police: the south avenue behind their line, the police lot, the east avenue.
for (const [x, z] of [[96, 4], [104, 4], [92, 12], [108, 12], [96, 30], [104, 30], [182, 38], [182, 52], [194, 58], [202, 36]] as const) m.spawn([x, 0, z], 0, police);
for (const [x, z] of [[196, 96], [196, 104], [188, 92], [188, 108], [176, 96], [176, 104]] as const) m.spawn([x, 0, z], -P, police);
// Everyone, for deathmatch and zombies.
for (const [x, z, yaw] of [[124, 124, 0], [150, 124, 0], [128, 76, 0], [176, 64, PI], [40, 64, 0], [24, 56, P], [72, 128, P], [16, 136, 0], [136, 140, -P], [192, 136, PI], [8, 32, P], [72, 32, 0], [148, 52, 0], [84, 52, -P]] as const) m.spawn([x, 0, z], yaw, null);

// ---------------------------------------------------------------- objectives

m.flag(rioters, [32, 0, 164], PI);
m.flag(police, [200, 0, 60], -P);
m.hill([100, 0, 100], 8); // the middle of the intersection
m.hill([76, 0, 122], 6); // the gas station forecourt
m.hill([148, 12, 148], 5); // apartment B's roof
m.add({ kind: 'bombsite', position: at(17, 15), label: 'A', radius: 3 }); // the cash vault
m.add({ kind: 'bombsite', position: at(8, 8), label: 'B', radius: 5 }); // the parking garage

// ---------------------------------------------------------------- pickups

m.pickup('weapon_rockets', [100, 0, 100], 60);
m.pickup('weapon_sniper', [124, 12, 152]).pickup('ammo_sniper', [146, 12, 144]); // apartment roofs
m.pickup('weapon_sniper', [20, 12, 136]).pickup('weapon_marksman', [56, 4, 64]); // F's roof, the top deck
m.pickup('weapon_rifle', at(15, 16, 0, 2, -2)).pickup('weapon_shotgun', at(17, 16)).pickup('weapon_smg', at(18, 16, 0, 2, -2));
m.pickup('weapon_auto_shotgun', at(16, 10, 0, -2, -2)).pickup('weapon_lmg', at(20, 9, 0, 0, 2)).pickup('weapon_burst_rifle', at(15, 7, 0, 2, -2));
m.pickup('weapon_launcher', at(8, 8, 1)).pickup('weapon_smg', at(3, 8, 0, -2, -2)).pickup('weapon_shotgun', at(5, 13, -1));
m.pickup('weapon_rifle', at(10, 17)).pickup('weapon_hand_cannon', at(5, 18, 1)).pickup('weapon_machine_pistol', at(22, 6, 2));
m.pickup('weapon_flamethrower', [60, 0, 160]).pickup('ammo_fuel', [24, 0, 184]);
m.pickup('armor_large', at(9, 15, 0, 9.6, 5.6)).pickup('armor_large', at(19, 6, 0, 0, 2)).pickup('armor_small', at(16, 18, 2)).pickup('armor_small', at(2, 18, 2));
m.pickup('armor_small', at(7, 12, -1)).pickup('armor_small', at(21, 10, 0)).pickup('armor_small', at(24, 15)).pickup('armor_small', at(10, 5));
m.pickup('health_large', at(18, 19, 1)).pickup('health_large', at(3, 12, -1)).pickup('health_large', at(23, 8));
for (const [x, y, z] of [[15, 19, 0], [19, 18, 2], [5, 17, 2], [21, 7, 0], [17, 10, 0], [20, 16, 0], [9, 8, 0], [11, 3, 0], [14, 22, 0], [11, 20, 0], [14, 3, 0], [4, 10, 0], [22, 20, 0], [23, 3, 0]] as const) m.pickup('health_small', at(x, y, z));
for (const [x, y] of [[11, 7], [14, 18], [18, 11], [7, 14], [21, 17], [4, 15], [18, 4], [9, 4], [24, 11], [1, 11]] as const) m.pickup(['ammo', 'ammo_rifle', 'ammo_shells', 'ammo_explosive'][(x + y) % 4]!, at(x, y));
for (const [x, y] of [[14, 16], [11, 9], [20, 11], [8, 20], [19, 17]] as const) m.pickup('grenades', at(x, y));

// ---------------------------------------------------------------- street furniture

const LAMPS: [number, number, number][] = [];
for (const v of [6, 32, 48, 140, 172, 192]) LAMPS.push([v, 87.2, 0], [v, 112.8, PI]);
for (const v of [6, 30, 64, 140, 164, 196]) LAMPS.push([87.2, v, P], [112.8, v, -P]);
for (const [x, z, yaw] of LAMPS) m.prop('lightpost_double', [x, 0, z], yaw);
for (const [x, z, yaw] of [[22, 87.5, 0], [150, 112.5, PI], [87.5, 160, P], [112.5, 40, -P]] as const) m.prop('bench', [x, 0, z], yaw, 2.6);
for (const [x, z] of [[26, 87.4], [176, 112.6], [87.4, 24], [112.6, 170], [114, 114], [86, 86], [114, 86], [86, 114]] as const) m.prop('sv_trashcan_metal', [x, 0, z], 0);
for (const [x, z] of [[124, 136.5], [172, 136.5], [130, 66], [136, 56], [180, 66], [26, 46], [60, 36], [32, 152]] as const) m.prop('skip', [x, 0, z], P);
for (const [x, z] of [[134, 138], [144, 62], [182, 72], [30, 50]] as const) m.prop('cardboard_box', [x, 0, z], 0.3);
m.prop('shopping_cart', [118, 0, 114], 0.6).prop('shopping_cart', [100, 0, 132], 2.1).prop('debris', [96, 0, 120], 0.3, 1, false).prop('debris', [80, 0, 100], 1.2, 1, false);
m.prop('sv_propane', [86, 0, 129], 0).prop('sv_propane', [87, 0, 129], 0);
for (const [x, z] of [[100, 120], [124, 100], [76, 100], [100, 80]] as const) m.prop('dg_woodfire', [x, 0, z], 0, 1.2);
FIRES.push([100, 0.8, 120], [124, 0.8, 100], [76, 0.8, 100], [100, 0.8, 80]);
m.breakable('barrel', [132, 0, 64]).breakable('barrel', [36, 0, 52]).breakable('gas', [190, 0, 66]);

// ---------------------------------------------------------------- dressing (after spawns, pickups and objectives, which it keeps clear)

for (const [room, type, density, max] of DRESSING) m.dress(room, type, { density, max });

// ---------------------------------------------------------------- lights: sodium street lamps, fire glow, warm windows

for (const [x, z, yaw] of LAMPS) m.light([r2(x + Math.sin(yaw) * 0.7), 3.2, r2(z + Math.cos(yaw) * 0.7)], { color: '#ff9a3c', intensity: 1.4, range: 18, fixture: 'none' });
for (const f of FIRES) m.light(f, { color: '#ff6a1a', intensity: 1.8, range: 12, fixture: 'none' });
for (const [x, y, z] of LIT) m.light(at(x, y, z, 0, 0, 3.4), { color: '#ffd8a0', intensity: 0.8, range: 8, fixture: 'bulb' });
for (const t of m.doc.classicStructure.tiles) {
  if (t.tile !== 'core.room_large' || t.z !== 0) continue;
  for (const [dx, dy] of [[0, 0], [8, 0], [0, 8], [8, 8]] as const) m.light(at(t.x, t.y, 0, dx, dy, 3.45), { color: t.y === 15 && t.x === 15 ? '#e8f4ff' : '#ffd9a8', intensity: 1, range: 9, fixture: t.y === 9 && t.x >= 19 ? 'strip' : 'ceiling' });
}
for (const [x, y] of [[17, 15], [17, 16], [20, 15], [20, 16], [17, 9], [17, 10]] as const) m.light(at(x, y, 0, 0, 0, 3.45), { color: '#fff0d8', intensity: 0.9, range: 9 });
for (let x = 1; x <= 9; x += 2) m.light(at(x, 12, -1, 0, 2, 3.3), { color: '#d8f0e0', intensity: 1, range: 12, fixture: 'strip' });
for (const [x, y] of DECK) m.light(at(x, y, 0, 0, 0, 3.4), { color: '#f0f4d8', intensity: 0.8, range: 9, fixture: 'strip' });
m.light([76, 4.8, 122], { color: '#f4f8ff', intensity: 1.5, range: 14, fixture: 'strip' });

m.bounds('invisible');
m.meta({
  description:
    'A city intersection on a riot night. Rioters hold the north and west behind burning barricades of overturned cars; riot police push up from the south and east behind their barriers with an armoured APC. On the corners: the Quik Cash convenience store and its cash vault, the diner, the bar, the gas station (shoot the cylinders by the pumps) and the mechanic’s garage with cars up on lifts. Behind them: apartments with fire escapes up to rooftops joined by planks, alleys, a pawn shop and a laundromat, a parking garage with an open top deck, and a subway platform under the west avenue. Every shop window shoots out. Bomb sites: the vault (A) and the parking garage (B).',
  modes: ['core.tdm', 'core.ctf', 'core.koth', 'core.bomb', 'core.deathmatch', 'core.zombies'],
  players: [16, 32],
});
await m.save();
