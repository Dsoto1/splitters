/**
 * Grand Marquee: an original 1930s art-deco movie palace at night, for 8–16
 * players (the roadmap's "movie theater" set piece).
 *
 * - Outside: the street front under the marquee canopy (a jump pad onto it),
 *   the ticket booth, parked cars, and an alley all the way round to the
 *   stage door and the loading dock at the back.
 * - The grand lobby (two storeys): twin curving stairs up to the mezzanine,
 *   the concession stand under it, the Starlight Lounge (west) and the
 *   candy bar for Screen 2 (east).
 * - The main auditorium (40 × 40 m): twelve raked rows of stalls rising from
 *   the orchestra pit to the cross-aisle under the balcony; the balcony
 *   (three stepped tiers) at 8 m; box seats on both side walls; the stage in
 *   front of the giant screen behind its fire curtain; the wings, with
 *   ladders (the fly ropes) up the fly floors to the catwalk over the stage
 *   and the lighting bridge across the house.
 * - The projection booth: high at the back over the balcony (the sniper's
 *   seat), with a button that runs the film: the fire curtain drops away from
 *   the glowing screen, the house lights go down, the screen flickers and the
 *   house doors shut and lock for 20 s.
 * - Carpeted side halls on three storeys either side of the house; backstage
 *   crossover, scene shop, wardrobe and prop store; a corridor of dressing
 *   rooms upstairs; the fly gallery on top.
 * - Screen 2: a smaller raked auditorium off the east hall.
 * - The rooftop at 12 m (stairs up beside the booth), with the neon sign; the
 *   front roof over the lobby at 8 m looks down on the marquee.
 *
 * Grid x east, y north (one cell = 8 m); levels z0, z1, z2, roof at 12 m.
 *
 *  y9   a  a  a  a  a  a  a  a  a  a  a  a  a     a alley
 *  y8   a  W  W  K  K  D  P  P  G  G  a  a  a     W wardrobe, K scene shop, D dock, P props, G green room (dressing rooms over)
 *  y7   a  d  b  b  b  b  b  b  b  d  a  a  a     b backstage crossover, d dressing rooms (corridor over, fly gallery z2)
 *  y6   a  r  h  A  A  A  A  A  h  s  a  a  a     A main auditorium (stage, y6), h side halls (z0-z2), r/s rooms (stairs over)
 *  y5   a  /  h  A  A  A  A  A  h  /  a  a  a     / stairwells z0-z1 (and z1-z2 at y6)
 *  y4   a  o  h  A  A  A  A  A  h  2  2  a  a     o offices, 2 Screen 2
 *  y3   a  o  h  A  A  A  A  A  h  2  2  a  a
 *  y2   a  w  h  A  A  A  A  A  h  2  2  a  a     w restrooms
 *  y1   L  L  l  l  l  l  l  l  l  c  c  a  a     l lobby (mezzanine z1, booth and foyers z2), L lounge, c candy bar
 *  y0   L  L  l  l  l  l  l  l  l  c  c  a  a
 *  y-1  s  s  s  s  s  s  s  s  s  s  s  s  s     s sidewalk (marquee, ticket booth)
 *  y-2  t  t  t  t  t  t  t  t  t  t  t  t  t     t street
 *      -5 -4 -3 -2 -1  0  1  2  3  4  5  6
 */
import type { EdgeStyle, LogicAction, LogicRule, RoomOptions, Rotation, Side, TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('grand_marquee', 'Grand Marquee');
m.theme('manor');
m.factions([
  { id: 'ushers', name: 'Ushers', color: '#d8263a', relations: {} },
  { id: 'stagehands', name: 'Stagehands', color: '#e8b830', relations: {} },
]);
m.teams([8, 8]);
const [USHERS, CREW] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Mat = { material: string; tint?: string };
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => +n.toFixed(2);
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];

// ---------------------------------------------------------------- surfaces

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const LOBBY: TileSurfaces = { floor: mat('pbr_terrazzo', '#d8c49a'), walls: mat('pbr_walnut', '#8a5a34'), solids: mat('pbr_marble_black'), trim: mat('brass') };
const MEZZ: TileSurfaces = { floor: mat('pbr_carpet', '#7a1a26'), walls: mat('pbr_walnut', '#8a5a34'), trim: mat('brass') };
const HOUSE: TileSurfaces = { floor: mat('pbr_carpet', '#5a1420'), walls: mat('pbr_plaster', '#6a2a2a'), solids: mat('pbr_marble_black'), trim: mat('brass') };
const HALL: TileSurfaces = { floor: mat('pbr_carpet', '#6e1822'), walls: mat('pbr_plaster_white', '#e4cfa4'), trim: mat('brass') };
const BOOTH: TileSurfaces = { floor: mat('pbr_tread_plate'), walls: mat('pbr_concrete', '#8a8680'), trim: mat('pbr_steel') };
const FOYER: TileSurfaces = { floor: mat('pbr_carpet', '#2a2a4a'), walls: mat('pbr_walnut'), trim: mat('brass') };
const BACK: TileSurfaces = { floor: mat('pbr_floorboards'), walls: mat('pbr_brick_old', '#6a5248'), trim: mat('pbr_steel') };
const DRESSING: TileSurfaces = { floor: mat('pbr_floorboards', '#a08060'), walls: mat('pbr_plaster_white', '#f0dcc8'), trim: mat('pbr_walnut') };
const LOUNGE: TileSurfaces = { floor: mat('pbr_checker'), walls: mat('pbr_walnut', '#3a2418'), trim: mat('brass') };
const CANDY: TileSurfaces = { floor: mat('pbr_checker', '#f0d8e0'), walls: mat('pbr_plaster_white', '#f4c8d4'), trim: mat('brass') };
const WC: TileSurfaces = { floor: mat('white_tiles', '#e0e8e4'), walls: mat('pbr_delft', '#c8dce0'), trim: mat('brass') };
const OFFICE: TileSurfaces = { floor: mat('pbr_carpet', '#2c3a2c'), walls: mat('pbr_walnut'), trim: mat('brass') };
const SCREEN2: TileSurfaces = { floor: mat('pbr_carpet', '#1a2a5a'), walls: mat('pbr_plaster', '#2a3050'), trim: mat('light_strip', '#7ac8ff') };
const STAIR: TileSurfaces = { floor: mat('pbr_terrazzo', '#c8b8a0'), walls: mat('pbr_plaster_white', '#e4cfa4'), solids: mat('pbr_marble_black'), trim: mat('brass') };
const STREET: TileSurfaces = { floor: mat('pbr_asphalt'), walls: mat('pbr_brick_red', '#7a4a3a') };
const WALK: TileSurfaces = { floor: mat('pbr_hex_paving', '#b0a090'), walls: mat('pbr_brick_red', '#7a4a3a') };

// ---------------------------------------------------------------- tiles

const cells = new Map<string, { kind: string; group: string }>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
let solo = 0;
function place(kind: string, x: number, y: number, z: number, o: { rot?: Rotation; opts?: RoomOptions; surf?: TileSurfaces; group?: string } = {}): void {
  m.tile(kind, x, y, z, o.rot ?? 0, o.opts);
  const group = o.group ?? `solo${++solo}`;
  const foot: [number, number, number][] = kind === 'stairwell' ? [[0, 0, 0], [0, 0, 1]] : [[0, 0, 0]];
  for (const [dx, dy, dz] of foot) {
    const k = key(x + dx, y + dy, z + dz);
    if (cells.has(k)) throw new Error(`cell ${k} placed twice`);
    cells.set(k, { kind, group });
  }
  if (o.surf) paint(x, y, z, o.surf);
}
const ROOF: RoomOptions = { ceiling: 'roof', layout: 'empty' };
const OPEN: RoomOptions = { layout: 'empty' };
const room = (x: number, y: number, z: number, surf: TileSurfaces, group?: string, opts: RoomOptions = OPEN) => place('room', x, y, z, { surf, group, opts });

// z0: lobby, auditorium, side halls, wings and back of house.
for (let x = -3; x <= 3; x++) for (const y of [0, 1]) room(x, y, 0, LOBBY, 'lobby', { layout: 'empty', corners: 'rounded' });
for (let x = -2; x <= 2; x++) for (let y = 2; y <= 6; y++) room(x, y, 0, HOUSE, 'house');
for (const s of [-1, 1]) for (let y = 2; y <= 6; y++) for (const z of [0, 1, 2]) room(s * 3, y, z, HALL, `hall${s}_${z}`, z === 2 ? ROOF : OPEN);
for (let x = -5; x <= -4; x++) for (const y of [0, 1]) room(x, y, 0, LOUNGE, 'lounge', { ...ROOF, corners: 'columns' });
for (let x = 4; x <= 5; x++) for (const y of [0, 1]) room(x, y, 0, CANDY, 'candy', ROOF);
room(-4, 2, 0, WC, undefined, ROOF);
room(-4, 3, 0, OFFICE, undefined, ROOF);
room(-4, 4, 0, OFFICE, undefined, ROOF);
for (let x = 4; x <= 5; x++) for (let y = 2; y <= 4; y++) room(x, y, 0, SCREEN2, 'screen2');
for (const s of [-1, 1]) {
  place('stairwell', s * 4, 5, 0, { rot: s < 0 ? 2 : 0, surf: STAIR }); // doors toward the side hall, z0 and z1
  room(s * 4, 6, 0, BACK, undefined, OPEN); // green room (west) / scene dock (east), the upper stairwell over it
  place('stairwell', s * 4, 6, 1, { rot: s < 0 ? 2 : 0, surf: STAIR }); // z1 to z2
  room(s * 4, 7, 0, DRESSING, undefined, OPEN); // star dressing rooms
}
for (let x = -3; x <= 3; x++) room(x, 7, 0, BACK, 'crossover');
const BACKROW: [number, number, string][] = [[-4, -3, 'wardrobe'], [-2, -1, 'shop'], [0, 0, 'dock'], [1, 2, 'props'], [3, 4, 'green']];
for (const [a, b, g] of BACKROW) for (let x = a; x <= b; x++) room(x, 8, 0, BACK, g);

// z1: the mezzanine over the lobby's back row, the dressing-room corridor and the dressing rooms.
for (let x = -3; x <= 3; x++) place('platform_rail', x, 1, 1, { surf: MEZZ, group: 'mezz' });
for (let x = -4; x <= 4; x++) room(x, 7, 1, DRESSING, 'dcorr');
for (let x = -4; x <= 4; x++) room(x, 8, 1, DRESSING, undefined, ROOF);

// z2: the projection booth and foyers over the mezzanine, stairs to the roof, the fly gallery.
for (let x = -1; x <= 1; x++) room(x, 1, 2, BOOTH, 'booth', ROOF);
for (const s of [-1, 1]) {
  room(s * 2, 1, 2, FOYER, undefined, ROOF);
  place('stairwell', s * 3, 1, 2, { rot: s < 0 ? 2 : 0, surf: STAIR }); // up to the roof, doors toward the foyer
}
for (let x = -3; x <= 3; x++) room(x, 7, 2, BACK, 'fly', ROOF);

// Outside: sidewalk and street to the south, the alley all round.
for (let x = -6; x <= 6; x++) for (let y = -3; y <= 9; y++) if (!cells.has(key(x, y, 0))) place('yard', x, y, 0, { surf: y <= -2 ? STREET : WALK, group: 'out' });

// ---------------------------------------------------------------- walls and openings

const sideId = (x: number, y: number, z: number, side: Side): string => (side === 'N' ? `${x},${y},${z}:N` : side === 'E' ? `${x},${y},${z}:E` : side === 'S' ? `${x},${y - 1},${z}:N` : `${x - 1},${y},${z}:E`);
const links = new Map<string, [number, number, number, Side, EdgeStyle]>();
const link = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => links.set(sideId(x, y, z, side), [x, y, z, side, style]);
const DIRS: Record<Side, [number, number]> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
const toward = (s: number): Side => (s < 0 ? 'W' : 'E');
const away = (s: number): Side => (s < 0 ? 'E' : 'W');

// Lobby: the glass doors in the middle of the front, two-storey walls either side.
for (let x = -3; x <= 3; x++) link(x, 0, 0, 'S', Math.abs(x) <= 1 ? 'door' : 'high');
for (const s of [-1, 1]) {
  link(s * 3, 0, 0, toward(s), 'high');
  link(s * 3, 1, 0, toward(s), 'arch'); // into the lounge / candy bar
  link(s * 3, 1, 0, 'N', 'door'); // into the side hall
  link(s * 3, 1, 1, toward(s), 'wall');
  link(s * 3, 1, 1, 'N', 'door'); // mezzanine to the upper side hall
}
for (let x = -2; x <= 2; x++) link(x, 1, 0, 'N', 'wall');
// Mezzanine: railed over the lobby (open where the curving stairs land), the house doors north.
for (let x = -3; x <= 3; x++) {
  link(x, 1, 1, 'S', Math.abs(x) === 1 ? 'open' : 'railing');
  if (Math.abs(x) <= 2) link(x, 1, 1, 'N', Math.abs(x) === 1 ? 'door' : 'wall');
}
// Lounge and candy bar onto the street.
for (const s of [-1, 1]) {
  link(s * 4, 0, 0, 'S', 'door');
  link(s * 5, 0, 0, 'S', 'window');
  link(s * 5, 1, 0, toward(s), 'door');
  link(s * 5, 0, 0, toward(s), 'window');
}
// Side halls: doors into the house (pit, wings, box seats, the back of the stalls, the balcony, the catwalks).
for (const s of [-1, 1]) {
  const x = s * 3;
  link(x, 5, 0, away(s), 'door'); // the orchestra pit
  link(x, 6, 0, away(s), 'door'); // the wing
  link(x, 6, 0, 'N', 'door'); // backstage
  link(x, 2, 1, away(s), 'door'); // the back of the stalls
  link(x, 5, 1, away(s), 'door'); // box seats
  link(x, 6, 1, 'N', 'door'); // dressing-room corridor
  link(x, 2, 2, away(s), 'door'); // balcony
  link(x, 4, 2, away(s), 'door'); // lighting bridge
  link(x, 6, 2, away(s), 'door'); // stage catwalk
  link(x, 6, 2, 'N', 'door'); // fly gallery
  // Stairwells.
  link(s * 4, 5, 0, away(s), 'door');
  link(s * 4, 5, 1, away(s), 'door');
  link(s * 4, 6, 1, away(s), 'door');
  link(s * 4, 6, 2, away(s), 'door');
  link(s * 3, 1, 2, away(s), 'door');
  link(s * 3, 1, 3, away(s), 'door'); // out onto the roof
  // Rooms off the halls.
  link(s * 4, 6, 0, away(s), 'door');
  link(s * 4, 6, 0, 'N', 'door');
  link(s * 4, 7, 0, away(s), 'door');
  link(s * 4, 7, 0, 'N', 'door');
}
link(-3, 2, 0, 'W', 'door'); // restrooms
link(-3, 3, 0, 'W', 'door'); // ushers' office
link(-4, 3, 0, 'N', 'door');
link(-4, 4, 0, 'W', 'door'); // the manager's office, out to the alley
link(-4, 2, 0, 'W', 'door');
link(3, 2, 0, 'E', 'door'); // Screen 2
link(5, 2, 0, 'E', 'door');
link(3, 4, 0, 'E', 'wall');
// Backstage: into the wings either side of the screen, the scene shop, the dock and the props.
for (const s of [-1, 1]) link(s * 2, 7, 0, 'S', 'door');
link(-2, 7, 0, 'N', 'door');
link(0, 7, 0, 'N', 'wide');
link(1, 7, 0, 'N', 'door');
link(-3, 7, 0, 'N', 'door');
link(3, 7, 0, 'N', 'door');
link(0, 8, 0, 'N', 'wide'); // loading dock
link(-4, 8, 0, 'N', 'door'); // stage door
link(4, 8, 0, 'N', 'door');
// Dressing rooms off the corridor; the fly gallery looks down on the stage either side of the screen.
for (let x = -4; x <= 4; x++) link(x, 7, 1, 'N', 'door');
for (const s of [-1, 1]) {
  link(s * 2, 7, 2, 'S', 'window'); // looking down into the wings
  link(s, 7, 2, 'S', 'wall');
}
link(0, 7, 2, 'S', 'wall');
// Projection booth: windows over the balcony to the screen; foyers onto the balcony and the front roof.
for (let x = -1; x <= 1; x++) link(x, 1, 2, 'N', x === 0 ? 'window' : 'windows');
link(0, 1, 2, 'S', 'door');
link(-1, 1, 2, 'S', 'wall');
link(1, 1, 2, 'S', 'window');
for (const s of [-1, 1]) {
  link(s * 2, 1, 2, 'N', 'door');
  link(s * 2, 1, 2, 'S', 'door');
  link(s * 1, 1, 2, toward(s), 'door');
}
// Screen 2: two-storey walls outside.
for (const x of [4, 5]) link(x, 2, 0, 'S', 'high');
link(5, 4, 0, 'N', 'high');
link(4, 4, 0, 'N', 'wall');
for (const y of [3, 4]) link(5, y, 0, 'E', 'high');
// The alley: walls round the block.
for (let x = -6; x <= 6; x++) {
  link(x, -3, 0, 'S', 'high');
  link(x, 9, 0, 'N', 'high');
}
for (let y = -3; y <= 9; y++) {
  link(-6, y, 0, 'W', y <= -2 ? 'fence' : 'high');
  link(6, y, 0, 'E', y <= -2 ? 'fence' : 'high');
}

for (const [x, y, z, side, style] of links.values()) m.edge(x, y, z, side, style);
// Every other side between tiles: open inside a group, walls between groups.
const done = new Set<string>(links.keys());
for (const [k, here] of cells) {
  if (here.kind !== 'room' && here.kind !== 'platform_rail') continue;
  const [x, y, z] = k.split(',').map(Number) as [number, number, number];
  for (const side of ['N', 'E', 'S', 'W'] as const) {
    const [dx, dy] = DIRS[side];
    const there = cells.get(key(x + dx, y + dy, z));
    const id = sideId(x, y, z, side);
    if (!there || done.has(id)) continue;
    done.add(id);
    if (there.kind === 'yard' && here.kind === 'room') continue; // the building's outside wall (auto)
    m.edge(x, y, z, side, there.group === here.group ? 'open' : 'wall');
  }
}

// ---------------------------------------------------------------- free blocks

let nBlocks = 0;
/** A solid box from min to max corner. */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mt: Mat, o: { yaw?: number } = {}): void {
  nBlocks++;
  // Blocks are at least 0.2 m across and 0.1 m thick: thin pieces grow about their middle.
  if (x1 - x0 < 0.2) [x0, x1] = [(x0 + x1) / 2 - 0.1, (x0 + x1) / 2 + 0.1];
  if (z1 - z0 < 0.2) [z0, z1] = [(z0 + z1) / 2 - 0.1, (z0 + z1) / 2 + 0.1];
  if (y1 - y0 < 0.1) y0 = y1 - 0.1;
  m.block([r2((x0 + x1) / 2), r2(y0), r2((z0 + z1) / 2)], [r2(x1 - x0), r2(y1 - y0), r2(z1 - z0)], 'solid', { material: mt.material, tint: mt.tint, yaw: o.yaw });
}
const VELVET: Mat = { material: 'pbr_carpet', tint: '#8a1424' };
const RISER: Mat = { material: 'pbr_carpet', tint: '#4a1018' };
const SEAT: Mat = { material: 'paint_gloss', tint: '#b01c2c' };
const BRASS: Mat = { material: 'brass' };
const MARBLE: Mat = { material: 'pbr_marble_black' };
const STAGE: Mat = { material: 'pbr_floorboards', tint: '#6a4a30' };
const STEEL: Mat = { material: 'pbr_walkway' };
const GOLD_GLOW: Mat = { material: 'light_strip', tint: '#ffd27a' };
const SCREEN: Mat = { material: 'light_strip', tint: '#f4f0ff' };
const CONCRETE: Mat = { material: 'pbr_concrete', tint: '#8a8680' };

// The stalls: seven deep rows climbing south from the orchestra pit to the cross-aisle (4 m), each
// row two 0.25 m steps up from the one in front; seats along the back of each row, aisles between.
const SEATS: [number, number][] = [[-16.5, -1.5], [1.5, 16.5]];
const ROW = 3.4;
/** Where to stand on stall row k: [floor height, z]. */
const rowAt = (k: number): [number, number] => [1 + 0.5 * k, r2(38 - ROW * k - ROW / 2)];
for (let k = 0; k < 7; k++) {
  const front = 38 - ROW * k;
  const back = k === 6 ? 12 : 38 - ROW * (k + 1);
  const top = 1 + 0.5 * k;
  if (k === 0) box(-20, 0, back, 20, top, front, VELVET);
  else {
    box(-20, 0, back, 20, top, front - 0.5, k % 2 ? RISER : VELVET);
    box(-20, 0, front - 0.5, 20, top - 0.25, front, k % 2 ? VELVET : RISER);
  }
  if (k < 6) for (const [a, b] of SEATS) box(a, top, back, b, top + 0.45, back + 0.6, SEAT);
}
// The orchestra pit (x ±12 clear) sunk between the front row and the stage; steps down at both ends.
// Either side of it, the side platforms and the wings stand at the front row's height (1 m).
const mirror = (s: number, a: number, b: number): [number, number] => (s < 0 ? [-b, -a] : [a, b]);
for (const s of [-1, 1]) {
  for (const [a, b, z0, z1] of [[14, 18, 38, 50], [14, 14.5, 50, 52], [17.5, 18, 50, 52], [18, 20, 42, 46]] as const) {
    const [x0, x1] = mirror(s, a, b);
    box(x0, 0, z0, x1, 1, z1, VELVET);
  }
  for (let j = 0; j < 4; j++) {
    const x0 = 12 + 0.5 * j;
    box(s < 0 ? -x0 - 0.5 : x0, 0, 38, s < 0 ? -x0 : x0 + 0.5, r2(0.25 * (j + 1)), 42, RISER);
  }
  // Steps up from the side doors (pit door, wing door) and the backstage door.
  for (let j = 0; j < 4; j++) {
    const x0 = 20 - 0.5 * j;
    const [a, b] = s < 0 ? [-x0, -x0 + 0.5] : [x0 - 0.5, x0];
    box(a, 0, 38, b, r2(0.25 * (j + 1)), 42, RISER);
    box(a, 0, 46, b, r2(0.25 * (j + 1)), 49.4, RISER);
    box(s < 0 ? -17.5 : 14.5, 0, r2(52 - 0.5 * (j + 1)), s < 0 ? -14.5 : 17.5, r2(0.25 * (j + 1)), r2(52 - 0.5 * j), RISER);
  }
  // Two steps from the wing up onto the stage.
  for (let j = 0; j < 2; j++) box(s < 0 ? -15 + 0.5 * j : 14 + 0.5 * (1 - j), 1, 43, s < 0 ? -14.5 + 0.5 * j : 14.5 + 0.5 * (1 - j), r2(1.25 + 0.25 * j), 48, STAGE);
}
// The stage (1.5 m) in front of the screen.
box(-14, 0, 42, 14, 1.5, 52, STAGE);
box(-14.2, 0, 41.8, 14.2, 1.5, 42, BRASS); // the brass lip
// The fly floors: solid pin-rail towers in the back corners of the wings, 8 m up, a ladder (the fly ropes) up each.
for (const s of [-1, 1]) {
  const [a, b] = s < 0 ? [-20, -18] : [18, 20];
  box(a, 0, 49.4, b, 8, 52, CONCRETE);
  m.add({ kind: 'ladder', position: [s * 17.95, 1, 50.7], yaw: s < 0 ? P : -P, height: 7, width: 0.9 });
}
// The screen, framed in brass, with red drapes either side.
box(-14, 3, 51.6, 14, 11, 51.8, SCREEN);
box(-14.6, 2.8, 51.8, 14.6, 3, 52, BRASS);
for (const s of [-1, 1]) box(s < 0 ? -14 : 12.6, 1.5, 51, s < 0 ? -12.6 : 14, 11, 51.6, { material: 'pbr_carpet', tint: '#9a1a28' });
// The proscenium arch: gilded piers either side of the stage and a header over it.
for (const s of [-1, 1]) box(s < 0 ? -14.4 : 13.4, 0, 50.6, s < 0 ? -13.4 : 14.4, 11.6, 52, BRASS);
box(-14.4, 11, 50.6, 14.4, 11.6, 52, BRASS);
// Catwalks at 8 m: over the stage (to the fly floors and the fly gallery) and the lighting bridge across the house.
box(-20, 7.7, 46.4, 20, 8, 49.6, STEEL);
box(-20, 7.7, 30.4, 20, 8, 33.6, STEEL);
// The balcony: three tiers stepping down to its parapet, seats on each.
box(-20, 7.6, 12, 20, 8, 16, VELVET);
box(-20, 7.35, 16, 20, 7.75, 19, RISER);
box(-20, 7.1, 19, 20, 7.5, 22, VELVET);
for (const [a, b] of SEATS) {
  box(a, 7.75, 16, b, 8.2, 16.6, SEAT);
  box(a, 7.5, 19, b, 7.95, 19.6, SEAT);
}
box(-20, 7.1, 21.7, 20, 8.5, 22, MARBLE);
box(-20, 8.5, 21.65, 20, 8.6, 22.05, GOLD_GLOW);
// Box seats on the side walls by the stage (4 m), gilded parapets.
for (const s of [-1, 1]) {
  const [a, b] = s < 0 ? [-20, -17] : [17, 20];
  box(a, 3.7, 37, b, 4, 43, VELVET);
  box(s < 0 ? -17.15 : 17, 4, 37, s < 0 ? -17 : 17.15, 5, 43, BRASS);
  box(a, 4, 37, b, 5, 37.15, BRASS);
  box(a, 4, 42.85, b, 5, 43, BRASS);
  box(a, 3.2, 37, b, 3.7, 43, GOLD_GLOW);
}
// The roof over the house (12 m), walkable, flush with the roofs round it.
box(-20, 11.6, 12, 20, 12, 52, { material: 'pbr_roof', tint: '#3a3236' });
// Deco wall sconces and gilded ribs up the house walls.
for (const s of [-1, 1]) for (const z of [18, 26, 34]) box(s < 0 ? -20 : 19.8, 4.5, z - 0.3, s < 0 ? -19.8 : 20, 11, z + 0.3, GOLD_GLOW);

// Lobby: twin curving stairs up to the mezzanine (16 steps round a quarter circle each).
const R = 6.4;
for (const s of [-1, 1]) {
  const cx = s * 15;
  const cz = 4;
  for (let i = 0; i < 16; i++) {
    const a0 = Math.PI * 1.5 + ((i + 0.5) / 16) * P * (s < 0 ? 1 : -1); // west stair turns from heading east to north, east one mirrored
    const px = cx + Math.cos(a0) * R;
    const pz = cz + Math.sin(a0) * R;
    const len = ((R + 1.2) * P) / 16 + 0.12;
    nBlocks++;
    m.block([r2(px), 0, r2(pz)], [r2(len), r2(0.25 * (i + 1)), 2.4], 'solid', { material: 'pbr_marble_black', yaw: r2(-a0 + P) });
  }
  // Brass newel posts at the foot.
  box(cx - s * 0.6 - 0.25, 0, -1.05, cx - s * 0.6 + 0.25, 1.3, -0.55, BRASS);
}
// The concession stand under the mezzanine: a long marble counter, glowing menu boards.
box(-9, 0, 8.6, 9, 1.1, 9.8, MARBLE);
box(-9.1, 1.1, 8.5, 9.1, 1.2, 9.9, BRASS);
box(-8, 2.2, 11.6, 8, 3.4, 11.8, GOLD_GLOW);
// Over the front doors, inside: the filler up to the front roof, a deco sunburst of glowing ribs.
box(-12, 4, -4.2, 12, 8, -3.8, MARBLE);
for (let i = -3; i <= 3; i++) box(i * 1.6 - 0.15, 4.6, -3.8, i * 1.6 + 0.15, 7.6 - Math.abs(i) * 0.4, -3.7, GOLD_GLOW);
// The front roof over the lobby (8 m), its parapet with a gap down onto the marquee.
box(-28, 7.6, -4, 28, 8, 4, { material: 'pbr_roof', tint: '#3a3236' });
box(-28, 8, -4.2, -3, 9, -3.8, MARBLE);
box(3, 8, -4.2, 28, 9, -3.8, MARBLE);
// Lounge, candy bar: counters.
box(-44, 0, 9.5, -36, 1.1, 10.6, { material: 'pbr_walnut' });
box(36, 0, 9.5, 44, 1.1, 10.6, { material: 'paint_gloss', tint: '#f4c8d4' });
box(36, 2.2, 11.6, 44, 3.2, 11.8, { material: 'light_strip', tint: '#ff7ab0' });

// The marquee: a canopy over the sidewalk ringed in bulbs, the letter boards on three sides.
box(-14, 4.5, -10, 14, 5.1, -4.2, { material: 'paint_gloss', tint: '#1a1a20' });
box(-14.2, 5.1, -10.2, 14.2, 6.7, -9.9, { material: 'light_strip', tint: '#fff2c0' });
for (const s of [-1, 1]) box(s < 0 ? -14.2 : 13.9, 5.1, -10.2, s < 0 ? -13.9 : 14.2, 6.7, -4.2, { material: 'light_strip', tint: '#fff2c0' });
box(-13.6, 5.3, -10.3, 13.6, 6.5, -10.2, { material: 'paint_gloss', tint: '#1a1a20' });
box(-14.3, 4.3, -10.3, 14.3, 4.5, -4.2, GOLD_GLOW);
// The ticket booth: a little deco kiosk in front of the doors.
box(-1.6, 0, -9, 1.6, 0.9, -6.4, BRASS);
box(-1.5, 0.9, -8.9, 1.5, 2.6, -6.5, { material: 'pbr_glass_facade', tint: '#c8d8e8' });
box(-1.7, 2.6, -9.1, 1.7, 3.2, -6.3, BRASS);
box(-0.6, 3.2, -8.3, 0.6, 3.9, -7.1, GOLD_GLOW);
// Parked cars along the street.
const CAR_COLOURS = ['#7a1a1a', '#1a1a1a', '#2a3a5a', '#e8dcc0', '#3a5a3a'];
[-40, -22, 22, 40].forEach((x, i) => {
  const col = CAR_COLOURS[i % CAR_COLOURS.length]!;
  m.block([x, 0.3, -14], [4.6, 0.8, 2], 'solid', { material: 'paint_gloss', tint: col });
  m.block([x - 0.3, 1.1, -14], [2.4, 0.65, 1.8], 'solid', { material: 'paint_gloss', tint: '#20242a' });
  m.block([x, 0, -14], [3.8, 0.3, 1.8], 'solid', { material: 'pbr_steel', tint: '#1a1a1a' });
  nBlocks += 3;
});

// The rooftop neon sign (12 m): a tall blade with GRAND in stacked letters, a ring of bulbs, and the deco crown.
box(-0.6, 12, 4.6, 0.6, 24, 7.4, { material: 'paint_gloss', tint: '#1a1420' });
['#ff3a5a', '#ffb02a', '#ffe84a', '#3ad8ff', '#c84aff'].forEach((c, i) => {
  for (const s of [-1, 1]) box(s < 0 ? -0.75 : 0.6, 13 + i * 2.1, 4.9, s < 0 ? -0.6 : 0.75, 14.7 + i * 2.1, 7.1, { material: 'light_strip', tint: c });
});
box(-0.8, 24, 4.4, 0.8, 24.4, 7.6, GOLD_GLOW);
box(-0.3, 24.4, 5.7, 0.3, 26, 6.3, { material: 'light_strip', tint: '#ff3a5a' });
// Neon band round the front of the upper roof.
box(-20, 11.2, 3.75, 20, 11.5, 3.9, { material: 'light_strip', tint: '#ff3a5a' });
// Screen 2: raked rows climbing north, its screen on the south wall.
const NAVY: Mat = { material: 'pbr_carpet', tint: '#1a2a5a' };
for (let k = 0; k < 6; k++) {
  const front = 18 + 3 * k;
  const back = k === 5 ? 36 : front + 3;
  const top = 0.5 * (k + 1);
  box(28, 0, front, 44, r2(top - 0.25), front + 0.5, k % 2 ? NAVY : RISER);
  box(28, 0, front + 0.5, 44, top, back, k % 2 ? RISER : NAVY);
  if (k < 5) for (const [a, b] of [[31, 34.5], [37.5, 41]] as const) box(a, top, back - 0.6, b, top + 0.45, back, { material: 'paint_gloss', tint: '#2a4aa0' });
}
box(30, 1.5, 12.2, 42, 6.5, 12.4, { material: 'light_strip', tint: '#bfe4ff' });
box(28, 7.6, 12, 44, 8, 36, { material: 'pbr_roof', tint: '#3a3236' });

// ---------------------------------------------------------------- doors and the film

const door = (id: string, name: string, pos: V3, yaw: number) => m.add({ kind: 'door', id, name, position: pos, yaw, startOpen: false, locked: false, auto: true });
for (const x of [-1, 0, 1]) door(`door_front_${x + 2}`, 'Front doors', at(x, 0, 0, 0, -4), 0);
const HOUSE_DOORS: string[] = [];
for (const s of [-1, 1]) {
  const side = s < 0 ? 'west' : 'east';
  const list: [string, string, V3, number][] = [
    [`door_stalls_${side}`, `Stalls ${side} door`, [s * 8, 4, 12], 0],
    [`door_aisle_${side}`, `Cross-aisle ${side} door`, [s * 20, 4, 16], P],
    [`door_pit_${side}`, `Pit ${side} door`, [s * 20, 0, 40], P],
  ];
  for (const [id, name, pos, yaw] of list) {
    door(id, name, pos, yaw);
    HOUSE_DOORS.push(id);
  }
}
/** The house lights "Run the film" dims (their IDs; the lights themselves are placed with the others below). */
const HOUSE_LIGHTS = Array.from({ length: 11 }, (_, k) => `light_house_${k + 1}`);
let houseLights = 0;
const houseLight = () => HOUSE_LIGHTS[houseLights++]!;
m.add({ kind: 'button', id: 'btn_film', name: 'Projector', position: [-8, 8, 4.3], yaw: 0, label: 'Run the film', once: false, cooldownSeconds: 1, startEnabled: true });
const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[]): LogicRule => ({ id, name, enabled: true, once: false, when, if: [], do: does });
m.logic({
  variables: [],
  timers: [{ id: 'timer_film', name: 'Now showing', seconds: 20, loop: false, visible: true }],
  objectives: [],
  rules: [
    rule('rule_start', 'Midnight screening', { event: 'match_start', target: null }, [say('Tonight at the Grand Marquee: the midnight screening.', 4), act('disable', 'pickup_encore')]),
    rule('rule_film', 'Run the film', { event: 'button_pressed', target: 'btn_film' }, [
      act('disable', 'btn_film'),
      act('sound', null, { state: 'chime' }),
      say('Now showing: the house doors are shut and locked for the feature.', 3),
      ...HOUSE_DOORS.flatMap((d) => [act('door_close', d), act('door_lock', d)]),
      act('timer_start', 'timer_film'),
      act('wait', null, { value: 20 }),
      ...HOUSE_DOORS.map((d) => act('door_unlock', d)),
      act('sound', null, { state: 'buzzer' }),
      act('enable', 'pickup_encore'),
      say('The End. House doors open, and an encore waits on the stage.', 3),
      act('wait', null, { value: 25 }),
      act('enable', 'btn_film'),
    ]),
    // The house lights go down for the feature and the screen flickers with the film; they come up at The End.
    rule('rule_house_lights', 'House lights down', { event: 'button_pressed', target: 'btn_film' }, [
      ...HOUSE_LIGHTS.map((l) => act('light_off', l)),
      act('light_color', 'light_screen', { text: '#f4f8ff' }),
      act('light_blink', 'light_screen', { state: 'on', value: 1.5 }),
      act('wait', null, { value: 20 }),
      ...HOUSE_LIGHTS.map((l) => act('light_on', l)),
      act('light_blink', 'light_screen', { state: 'off' }),
      act('light_color', 'light_screen'),
    ]),
    rule('rule_encore', 'Encore taken', { event: 'pickup_taken', target: 'pickup_encore' }, [act('disable', 'pickup_encore')]),
  ],
});

// ---------------------------------------------------------------- objectives, spawns, pickups

// Capture the Flag: the Stagehands' flag on the stage, the Ushers' in the projection booth.
m.flag(CREW, [0, 1.5, 47], S);
m.flag(USHERS, [4, 8, 7], 0);
// King of the Hill: the stage, the balcony, the booth.
m.hill([0, 1.5, 45.5], 6).hill([0, 8, 14], 5).hill([0, 8, 8], 4);

// Ushers: the lobby and the mezzanine.
for (const [p, yaw] of [
  [[-20, 0, -1], 0], [[20, 0, -1], 0], [[-5, 0, 0], 0], [[5, 0, 0], 0], [[-24, 0, 6], 0], [[24, 0, 6], 0],
  [[-20, 4, 8], P], [[20, 4, 8], -P],
] as [V3, number][]) m.spawn(p, yaw, USHERS);
// Stagehands: the crossover, the dock and the dressing-room corridor.
for (const [p, yaw] of [
  [[-12, 0, 56], S], [[12, 0, 56], S], [[-4, 0, 58], S], [[4, 0, 58], S], [[0, 0, 66], S], [[-12, 0, 66], S],
  [[-8, 4, 56], S], [[8, 4, 56], S],
] as [V3, number][]) m.spawn(p, yaw, CREW);
// Everyone's (deathmatch and Zombies).
for (const [p, yaw] of [
  [[0, 0, -16], 0], [[-40, 0, -6], 0], [[40, 0, -6], 0], [[-44, 0, 40], 0], [[44, 0, 60], S], [[0, 0, 74], S],
  [[-40, 0, 4], P], [[40, 0, 4], -P], [[-24, 0, 30], 0], [[24, 0, 30], 0], [[-24, 4, 34], 0], [[24, 4, 26], S],
  [[-24, 8, 40], 0], [[24, 8, 24], S], [[-16, 8, 8], 0], [[16, 8, 8], 0], [[-16, 4, 64], S], [[16, 4, 64], S],
  [[0, 4, 13], 0], [[-8, ...rowAt(4)] as unknown as V3, 0], [[8, ...rowAt(2)] as unknown as V3, 0], [[36, 1.5, 25], S], [[-32, 0, 16], P], [[0, 12.01, 32], S],
] as [V3, number][]) m.spawn(p, yaw);

// Pickups. The booth: the sniper; the catwalk: rockets; the pit: shotguns.
m.pickup('weapon_sniper', [10, 8, 7]).pickup('ammo_sniper', [-4, 8, 9]);
m.pickup('weapon_rockets', [0, 8, 48]).pickup('ammo_explosive', [0, 8, 32]);
m.pickup('weapon_auto_shotgun', [-6, 0, 40]).pickup('ammo_shells', [6, 0, 40]);
m.pickup('weapon_rifle', [-20, 0, 0]).pickup('weapon_rifle', [0, 0, 60]).pickup('ammo_rifle', [20, 0, 0]).pickup('ammo_rifle', [-20, 0, 60]);
m.pickup('weapon_smg', [-24, 0, 44]).pickup('weapon_smg', [24, 0, 20]).pickup('ammo', [-24, 4, 20]).pickup('ammo', [24, 4, 44]);
m.pickup('weapon_marksman', [-18.5, 4, 40]).pickup('weapon_burst_rifle', [18.5, 4, 40]);
m.pickup('weapon_lmg', [0, 4, 13]).pickup('weapon_hand_cannon', [0, 1.5, 44]);
m.pickup('weapon_flamethrower', [-36, 0, 52]).pickup('ammo_fuel', [36, 0, 52]);
m.pickup('weapon_shotgun', [40, 2, 31]).pickup('weapon_machine_pistol', [-40, 0, 8]);
m.pickup('weapon_laser_rifle', [0, 12, 40]).pickup('ammo_cells', [-24, 12, 30]);
m.pickup('powerup_damage', [0, 12, 60], 90);
m.add({ kind: 'pickup', id: 'pickup_encore', name: 'Encore', item: 'core.powerup_speed', position: [-6, 1.5, 49], respawnSeconds: 30 });
m.pickup('armor_large', [0, 7.5, 20]).pickup('armor_small', [-18.5, 8, 50.7]).pickup('armor_small', [18.5, 8, 50.7]).pickup('armor_small', [-32, 4, 64]);
m.pickup('health_large', [0, 0, 6]).pickup('health_large', [0, 4, 60]);
m.pickup('health_small', [-24, 0, 24]).pickup('health_small', [24, 0, 36]).pickup('health_small', [-24, 8, 28]).pickup('health_small', [24, 8, 36]);
m.pickup('health_small', [-32, 4, 40]).pickup('health_small', [32, 4, 40]).pickup('health_small', [10, 0, -16]).pickup('health_small', [-16, 0, 66]);
m.pickup('grenades', [-12, 4, 6]).pickup('grenades', [12, 4, 6]).pickup('grenades', [16, 0, 58]).pickup('grenades', [0, 0, -7 - 3]);
m.pickup('ammo_light', [-36, 0, 2]).pickup('ammo_shells', [36, 0, 2]);
// A pad from the sidewalk up onto the marquee canopy (17 m/s of lift clears the bulb ring round its edge).
m.padTo([-18, 0, -12], [-10, 5.1, -7], 17);
// Fire extinguisher-red barrels and a gas bottle in the scene shop and on the dock.
m.breakable('barrel', [-12, 0, 68]).breakable('barrel', [-11, 0, 69]).breakable('gas', [4, 0, 69]);

// ---------------------------------------------------------------- dressing

m.dress({ x0: -5, y0: 0, x1: -4, y1: 1, z: 0 }, 'bar', { density: 'normal', max: 20 });
m.dress({ x0: 4, y0: 0, x1: 5, y1: 1, z: 0 }, 'shop', { density: 'sparse', max: 14 });
m.dress([-4, 2, 0], 'bathroom', { density: 'full' });
m.dress([-4, 3, 0], 'office', { density: 'normal' });
m.dress([-4, 4, 0], 'library', { density: 'normal' });
m.dress([-4, 6, 0], 'living', { density: 'normal', seed: 'green-room' });
m.dress([4, 6, 0], 'storage', { density: 'normal' });
m.dress([-4, 7, 0], 'bedroom', { density: 'normal', seed: 'star-west' });
m.dress([4, 7, 0], 'bedroom', { density: 'normal', seed: 'star-east' });
m.dress({ x0: -4, y0: 8, x1: -3, y1: 8, z: 0 }, 'shop', { density: 'normal', seed: 'wardrobe', max: 16 });
m.dress({ x0: -2, y0: 8, x1: -1, y1: 8, z: 0 }, 'workshop', { density: 'normal', max: 14 });
m.dress([0, 8, 0], 'warehouse', { density: 'sparse' });
m.dress({ x0: 1, y0: 8, x1: 2, y1: 8, z: 0 }, 'storage', { density: 'full', max: 16 });
m.dress({ x0: 3, y0: 8, x1: 4, y1: 8, z: 0 }, 'living', { density: 'normal', seed: 'green-east', max: 14 });
const DRESSING_ROOMS = ['bedroom', 'bathroom', 'living', 'office', 'bedroom', 'library', 'bathroom', 'living', 'bedroom'] as const;
DRESSING_ROOMS.forEach((type, i) => m.dress([i - 4, 8, 1], type, { density: 'normal', seed: `dressing-${i}`, max: 10 }));
m.dress({ x0: -1, y0: 1, x1: 1, y1: 1, z: 2 }, 'server', { density: 'sparse', max: 8 });
m.dress([-2, 1, 2], 'lobby', { density: 'sparse', max: 6 });
m.dress([2, 1, 2], 'lobby', { density: 'sparse', max: 6 });
// The pit: the orchestra's chairs and the conductor's podium; potted palms and ash bins round the lobby.
for (const x of [-9, -7, -5, -3, 3, 5, 7, 9]) for (const z of [39.2, 41]) m.prop('chair', [x, 0, z], 0, 1, false);
m.prop('speaker', [-11.2, 0, 41.2], 0).prop('speaker', [11.2, 0, 41.2], 0);
for (const x of [-26, 26]) m.prop('hm_potted_palm', [x, 0, -2.5]);
for (const x of [-10.5, 10.5]) m.prop('hm_potted_palm', [x, 0, -2.5]);
m.prop('bench', [-25, 0, 2], P, 1.5, false).prop('bench', [25, 0, 2], -P, 1.5, false);
m.prop('freezers_upright', [-6, 0, 11.4], S).prop('freezers_upright', [6, 0, 11.4], S).prop('bottle_return', [0, 0, 11.4], S);
m.prop('hm_chandelier', [0, 4.8, -0.5], 0, 2, false).prop('hm_chandelier', [-14, 5.2, 0], 0, 1.6, false).prop('hm_chandelier', [14, 5.2, 0], 0, 1.6, false);
m.prop('lightpost_double', [-28, 0, -10.5], 0).prop('lightpost_double', [28, 0, -10.5], 0);
m.prop('trashcan', [-20, 0, -10.5]).prop('trashcan', [20, 0, -10.5]).prop('hm_bin_large', [-30, 0, 72]).prop('skip', [24, 0, 74], 0);
m.prop('computer_bank', [-4, 8, 11.2], S).prop('machine', [4, 8, 10.6], S).prop('machine_window', [-1, 8, 10.6], S);

// ---------------------------------------------------------------- lights

m.lightRooms({ color: '#ffd8a0', intensity: 0.9, skip: (x, y, z) => z === 0 && y === 0 && Math.abs(x) <= 3 });
// The house: low gold glow along the walls, a warm wash on the stage, the screen's cold light.
// The house lights (wall glow and the bulbs over the stalls) have IDs: "Run the film" dims them; the screen's light flickers.
for (const s of [-1, 1]) for (const z of [18, 26, 34]) m.light([s * 19.2, 7, z], { fixture: 'none', color: '#ffc870', intensity: 1, range: 10, id: houseLight() });
for (const x of [-10, 0, 10]) m.light([x, 7.4, 44], { fixture: 'bulb', color: '#fff0d0', intensity: 1.4, range: 12 });
m.light([0, 7, 49.5], { fixture: 'none', color: '#d8e0ff', intensity: 1.6, range: 18, id: 'light_screen' });
for (const x of [-12, 0, 12]) m.light([x, 11, 24], { fixture: 'bulb', color: '#ffd8a0', intensity: 1.2, range: 14, id: houseLight() });
for (const x of [-8, 8]) m.light([x, 11, 36], { fixture: 'bulb', color: '#ffd8a0', intensity: 1, range: 12, id: houseLight() });
m.light([0, 7, 13], { fixture: 'none', color: '#ffb060', intensity: 0.9, range: 10 });
// The lobby: chandeliers and the concession glow.
for (const x of [-14, 0, 14]) m.light([x, 6.8, -0.5], { fixture: 'none', color: '#ffe0b0', intensity: 1.4, range: 14 });
m.light([0, 3, 7.5], { fixture: 'strip', color: '#ffd27a', intensity: 1.2, range: 10 });
for (const x of [-20, 20]) m.light([x, 3.4, 8], { fixture: 'ceiling', color: '#ffd8a0', intensity: 0.9, range: 9 });
// Screen 2.
m.light([36, 6.8, 24], { fixture: 'bulb', color: '#9ac8ff', intensity: 1.1, range: 14 });
m.light([36, 3.5, 14], { fixture: 'none', color: '#bfe4ff', intensity: 1.2, range: 10 });
// The marquee, the sign and the street.
for (const x of [-10, 0, 10]) m.light([x, 4, -8], { fixture: 'none', color: '#fff2c0', intensity: 1.6, range: 12 });
m.light([0, 20, 4], { fixture: 'none', color: '#ff5a8a', intensity: 2, range: 22 });
m.light([0, 14, 8], { fixture: 'none', color: '#3ad8ff', intensity: 1.2, range: 14 });
for (const x of [-28, 28]) m.light([x, 4.6, -10.5], { fixture: 'none', color: '#ffb060', intensity: 1.2, range: 14 });
for (const [x, z] of [[-44, 30], [44, 50], [-44, 66], [0, 72], [30, 72], [-30, 72]] as const) m.light([x, 3.6, z], { fixture: 'wall', color: '#ffb060', intensity: 1, range: 12 });
// The rooftop.
for (const [x, z] of [[-16, 24], [16, 40], [-16, 52], [16, 8]] as const) m.light([x, 13, z], { fixture: 'none', color: '#9a7aff', intensity: 0.8, range: 14 });

m.bounds('invisible', 4, undefined, 30);
m.backdrop('night', 'city', 'stone', 0.45);
m.meta({
  description:
    'A 1930s art-deco movie palace at night. Ushers hold the lobby and the projection booth; Stagehands come from backstage. The street front under the marquee and the ticket booth; the grand lobby with twin curving stairs, the concession stand and the lounge; the main house with twelve raked rows of stalls, the orchestra pit, box seats, a three-tier balcony and the stage in front of the giant screen; the wings, fly-floor ladders and catwalks over the stage and the house; dressing rooms, scene shop and wardrobe behind; Screen 2 off the east hall; the rooftop and its neon sign. The booth button runs the film: the fire curtain drops from the glowing screen, the house lights go down and the house doors lock for 20 s. King of the Hill: the stage, the balcony, the booth.',
  modes: ['core.tdm', 'core.ctf', 'core.koth', 'core.deathmatch', 'core.zombies'],
  players: [8, 16],
});
await m.save();
console.log(`grand_marquee: ${nBlocks} blocks`);
