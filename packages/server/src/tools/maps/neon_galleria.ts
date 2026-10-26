/**
 * Neon Galleria: an original two-storey 1980s shopping mall at night, for
 * 6–16 players (the roadmap's "80s mall" set piece).
 *
 * - The concourse runs east-west between two department-store anchors (the
 *   team bases: Halvorsen's west, Delmar & Co. east). Galleries line both
 *   sides upstairs over a long open well, crossed by a bridge at each end;
 *   two open stairways (the escalators) climb from the floor to the galleries.
 *   In the middle the fountain court sits under the skylights.
 * - Every shop front is glass either side of a sliding door: shoot the glass
 *   out, or go through the door. Each shop has a shutter button inside that
 *   pulls every door of the shop shut and locks it for 25 s (barricades for
 *   Zombies; 45 s to recharge).
 * - Shops: a record store, the pet store, jeans, books, candy and toys on the
 *   north side; shoes, pharmacy, salon, jewellery, photo, sporting goods
 *   (the guns) and ice cream on the south. Upstairs: computers, electronics,
 *   video rental, the arcade (rows of glowing cabinets) and a music store;
 *   fashion, perfume, hobbies, the bank, travel, the aerobics studio and
 *   video games. The food court (neon counters) opens off the middle of the
 *   north side with the multiplex lobby and its auditorium over it.
 * - Behind the shops: service corridors to the loading docks (a truck at
 *   each). Outside: the ring road, and to the south a two-deck parking
 *   garage (ramp, stairs, parked cars, a skybridge into the upper mall).
 * - The roof: one walkable deck over everything, with HVAC units, ducts and
 *   the skylight well (railed) over the fountain; stairs up in both anchors.
 *
 * Grid x east, y north (one cell = 8 m); levels z0 ground, z1 upper, roof at 8 m.
 *
 *  y4   r  r  r  r  r  r  r  r  r  r  r  r  r  r  r  r  r     r ring road / loading docks
 *  y3   r  .  .  .  c  c  c  F  F  F  c  c  c  .  .  .  r     c service corridor  F food court (auditorium over)
 *  y2   r  s  S  s  1  1  1  F  F  F  1  1  1  s  S  s  r     1 north shops (z0 and z1)  S stairwell
 *  y1   r  W  W  W  g  g  g  g  g  g  g  g  g  E  E  E  r     W/E anchors (two storeys)  g concourse (galleries over)
 *  y0   r  W  W  W  b  .  e  .  ~  .  e  .  b  E  E  E  r     b bridges (z1)  e stairs  ~ fountain under the skylights
 *  y-1  r  W  W  W  g  g  g  g  g  g  g  g  g  E  E  E  r
 *  y-2  r  s  s  s  2  2  2  2  v  2  2  2  2  s  s  s  r     2 south shops  v entrance (upper entry hall over)
 *  y-3  r  .  .  .  c  c  c  c  v  c  c  c  c  .  .  .  r
 *  y-4  r  r  r  r  r  r  r  r  B  r  r  r  r  r  r  r  r     B skybridge at z1
 *  y-5           P  P  P  P  P  P  P  r  r  r                  P parking garage (two decks), ramp at x4..5 y-6
 *  y-6        S  P  P  P  P  P  P  P  R  R  r
 *  y-7           P  P  P  P  P  P  P
 *      -8 -7 -6 -5 -4 -3 -2 -1  0  1  2  3  4  5  6  7  8
 */
import type { EdgeStyle, LogicAction, LogicRule, RoomOptions, Rotation, Side, TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('neon_galleria', 'Neon Galleria');
m.theme('neon');
m.factions([
  { id: 'halvorsen', name: "Halvorsen's", color: '#ff3fb4', relations: {} },
  { id: 'delmar', name: 'Delmar & Co.', color: '#30d8ff', relations: {} },
]);
m.teams([8, 8]);
const [WEST, EAST] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => +n.toFixed(2);
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];

// ---------------------------------------------------------------- surfaces

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const CONCOURSE: TileSurfaces = { floor: mat('pbr_terrazzo', '#e6d6de'), walls: mat('pbr_plaster_white', '#ece4f2'), solids: mat('pbr_marble_black'), trim: mat('light_strip', '#ff5ea8') };
const GALLERY: TileSurfaces = { floor: mat('pbr_terrazzo', '#d8cce0'), walls: mat('pbr_plaster_white', '#ece4f2'), trim: mat('light_strip', '#30d8ff') };
const SERVICE: TileSurfaces = { floor: mat('pbr_concrete_dark'), walls: mat('pbr_concrete', '#9a9aa4'), trim: mat('hazard') };
const ROAD: TileSurfaces = { floor: mat('pbr_asphalt'), walls: mat('pbr_concrete', '#8a8a94') };
const GARAGE: TileSurfaces = { floor: mat('pbr_concrete', '#8e8e96'), walls: mat('pbr_concrete', '#a4a4ac'), solids: mat('pbr_concrete', '#c8b84a'), trim: mat('hazard') };
const ANCHOR_W: TileSurfaces = { floor: mat('pbr_checker', '#f0e8f0'), walls: mat('pbr_plaster_white', '#f4d6e8'), solids: mat('pbr_marble_black'), trim: mat('brass') };
const ANCHOR_E: TileSurfaces = { floor: mat('pbr_checker', '#e8f0f4'), walls: mat('pbr_plaster_white', '#d6ecf4'), solids: mat('pbr_marble_black'), trim: mat('pbr_steel') };
const STOCK: TileSurfaces = { floor: mat('pbr_concrete'), walls: mat('pbr_concrete', '#b0aab8'), trim: mat('hazard') };
const FOOD: TileSurfaces = { floor: mat('pbr_checker', '#f4f0e8'), walls: mat('white_tiles', '#f0e6ff'), trim: mat('light_strip', '#ffe02f') };
const CINEMA: TileSurfaces = { floor: mat('pbr_carpet', '#5a1a4a'), walls: mat('pbr_plaster', '#3a1430'), trim: mat('light_strip', '#ffd24a') };
const shopSurf = (wall: string, floor: string, floorTint: string | null = null, neon = '#ff5ea8'): TileSurfaces => ({ floor: mat(floor, floorTint), walls: mat('pbr_plaster_white', wall), solids: mat('pbr_walnut'), trim: mat('light_strip', neon) });

// ---------------------------------------------------------------- tiles

const cells = new Map<string, { kind: string; group: number }>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
let groups = 0;
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
const FOOTPRINT: Record<string, [number, number, number][]> = {
  hall: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0], [1, 1, 0], [2, 1, 0], [0, 2, 0], [1, 2, 0], [2, 2, 0]],
  stairwell: [[0, 0, 0], [0, 0, 1]],
  stairs_open: [[0, 0, 0], [0, 0, 1]],
  ramp: [[0, 0, 0], [-1, 0, 0], [0, 0, 1], [-1, 0, 1]], // placed turned half round (rotation 2)
};
function place(kind: string, x: number, y: number, z: number, o: { rot?: Rotation; opts?: RoomOptions; surf?: TileSurfaces } = {}): void {
  m.tile(kind, x, y, z, o.rot ?? 0, o.opts);
  const g = ++groups;
  for (const [dx, dy, dz] of FOOTPRINT[kind] ?? [[0, 0, 0]]) {
    const k = key(x + dx, y + dy, z + dz);
    if (cells.has(k)) throw new Error(`cell ${k} placed twice`);
    cells.set(k, { kind, group: g });
  }
  if (o.surf) paint(x, y, z, o.surf);
}
const ROOF: RoomOptions = { ceiling: 'roof' };
const room = (x: number, y: number, z: number, surf: TileSurfaces, opts?: RoomOptions) => place('room', x, y, z, { surf, opts });

// The concourse (z0), its galleries and bridges (z1), the stairs.
for (let x = -4; x <= 4; x++) for (let y = -1; y <= 1; y++) if (!(y === 0 && Math.abs(x) === 2)) room(x, y, 0, CONCOURSE, { corners: 'rounded' });
place('stairs_open', -2, 0, 0, { rot: 3, surf: CONCOURSE }); // up north onto the north gallery
place('stairs_open', 2, 0, 0, { rot: 1, surf: CONCOURSE }); // up south onto the south gallery
for (let x = -4; x <= 4; x++) for (const y of [-1, 1]) place('platform_rail', x, y, 1, { surf: GALLERY });
for (const x of [-4, 4]) place('bridge', x, 0, 1, { surf: GALLERY });

// Shops: north (y2) and south (y-2), both storeys.
interface Shop { name: string; cells: [number, number, number][]; surf: TileSurfaces; dress: Parameters<MapBuilder['dress']>[1] | null; neon: string }
const NEON = ['#ff3fb4', '#30d8ff', '#ffe02f', '#9a4dff', '#3dff8a', '#ff7a2f'];
const SHOPS: Shop[] = [];
const shop = (name: string, xs: number[], y: number, z: number, wall: string, floor: string, dress: Shop['dress'], floorTint: string | null = null) => {
  const neon = NEON[SHOPS.length % NEON.length]!;
  SHOPS.push({ name, cells: xs.map((x) => [x, y, z]), surf: shopSurf(wall, floor, floorTint, neon), dress, neon });
};
shop('Vinyl Vault records', [-4], 2, 0, '#2a2a3a', 'pbr_checker', 'library');
shop('Pet Paradise', [-3], 2, 0, '#c8f0d8', 'white_tiles', 'storage');
shop('Rivet Jeans', [-2], 2, 0, '#3a5a8a', 'pbr_floorboards', 'shop');
shop('Paperback Planet', [2], 2, 0, '#e8d8b8', 'pbr_carpet', 'library', '#5a3a2a');
shop('Sugar Rush candy', [3], 2, 0, '#ffc8e8', 'pbr_checker', 'bar');
shop('Toy Galaxy', [4], 2, 0, '#ffe8a0', 'pbr_carpet', 'shop', '#2a4a8a');
shop('Byte Shop computers', [-4], 2, 1, '#d8e0e8', 'pbr_terrazzo', 'server');
shop('Hi-Fi Heaven', [-3], 2, 1, '#1a1a2a', 'pbr_carpet', 'shop', '#2a2a3a');
shop('Rewind Video', [-2], 2, 1, '#3a1a5a', 'pbr_carpet', 'library', '#4a2a6a');
shop('Pixel Palace arcade', [2, 3], 2, 1, '#120b24', 'pbr_carpet', null, '#1a1a40');
shop('Encore Music', [4], 2, 1, '#8a2a2a', 'pbr_floorboards', 'shop');
shop('Step Up shoes', [-4], -2, 0, '#f0d0d8', 'pbr_floorboards', 'shop');
shop('Corner Drug', [-3], -2, 0, '#e8f4f0', 'white_tiles', 'shop');
shop('Big Hair salon', [-2], -2, 0, '#ff9ad8', 'pbr_checker', 'bathroom');
shop('Goldline jewellers', [-1], -2, 0, '#1a1a1a', 'pbr_marble_black', 'lobby');
shop('Flash Photo', [1], -2, 0, '#f0f0d0', 'pbr_terrazzo', 'office');
shop('Champion Sports', [2, 3], -2, 0, '#2a6a3a', 'pbr_floorboards', 'armoury');
shop('Twin Scoops', [4], -2, 0, '#f8e0f0', 'pbr_checker', 'bar');
shop('Vogue Street', [-4], -2, 1, '#f4c8e0', 'pbr_floorboards', 'shop');
shop('Scentsation', [-3], -2, 1, '#f0e0ff', 'pbr_marble_black', 'shop');
shop('Hobby Hut', [-2], -2, 1, '#c8e0a8', 'pbr_floorboards', 'workshop');
shop('First Mall Savings', [-1], -2, 1, '#d8d0c0', 'pbr_terrazzo', 'lobby');
shop('Jetset Travel', [1], -2, 1, '#a0d8f0', 'pbr_carpet', 'office', '#2a5a7a');
shop('Body Electric aerobics', [2, 3], -2, 1, '#ff6ad0', 'pbr_floorboards', null);
shop('Cartridge Kingdom', [4], -2, 1, '#2a1a4a', 'pbr_carpet', 'shop', '#3a2a5a');
for (const s of SHOPS) for (const [x, y, z] of s.cells) room(x, y, z, s.surf, z === 1 ? { ...ROOF, layout: 'empty' } : { layout: 'empty' });

// Food court (z0) under the multiplex lobby and auditorium (z1).
for (let x = -1; x <= 1; x++) for (const y of [2, 3]) room(x, y, 0, FOOD, { layout: 'empty' });
for (let x = -1; x <= 1; x++) {
  room(x, 2, 1, CINEMA, { ...ROOF, layout: 'empty' }); // lobby
  room(x, 3, 1, CINEMA, { ...ROOF, layout: 'empty' }); // auditorium
}
// The entrance: vestibule (z0), the upper entry hall (z1) off the skybridge.
room(0, -2, 0, CONCOURSE, { layout: 'empty' });
room(0, -3, 0, CONCOURSE, { layout: 'empty' });
room(0, -2, 1, GALLERY, { ...ROOF, layout: 'empty' });
room(0, -3, 1, GALLERY, { ...ROOF, layout: 'empty' });
// Service corridors.
for (const x of [-4, -3, -2, 2, 3, 4]) room(x, 3, 0, SERVICE, { ...ROOF, layout: 'empty' });
for (const x of [-4, -3, -2, -1, 1, 2, 3, 4]) room(x, -3, 0, SERVICE, { ...ROOF, layout: 'empty' });

// The anchors: a great hall on each storey, stock rooms and stairs behind.
for (const [s, surf] of [[-1, ANCHOR_W], [1, ANCHOR_E]] as const) {
  const x0 = s < 0 ? -7 : 5;
  const mid = s * 6;
  place('hall', x0, -1, 0, { surf, opts: { layout: 'column_rows', corners: 'columns' } });
  place('hall', x0, -1, 1, { surf, opts: { layout: 'empty', ceiling: 'roof', corners: 'columns' } });
  place('stairwell', mid, 2, 0, { rot: 3, surf: STOCK }); // doors south into both halls
  place('stairwell', mid, -2, 1, { rot: 1, surf: STOCK }); // upper hall up to the roof, doors north
  for (const x of [mid - 1, mid + 1]) {
    room(x, 2, 0, STOCK, { layout: 'empty' });
    room(x, 2, 1, STOCK, { ...ROOF, layout: 'empty' });
    room(x, -2, 1, STOCK, { ...ROOF, layout: 'empty' });
  }
  for (const x of [mid - 1, mid, mid + 1]) room(x, -2, 0, STOCK, { layout: 'empty' });
}

// Parking garage: two decks, stairs on the west, a ramp on the east.
for (let x = -3; x <= 3; x++) for (let y = -7; y <= -5; y++) {
  room(x, y, 0, GARAGE, { layout: Math.abs(x) === 2 && y === -6 ? 'pillar' : 'empty' });
  room(x, y, 1, GARAGE, { layout: 'empty' });
}
place('stairwell', -4, -6, 0, { rot: 2, surf: GARAGE }); // doors east onto both decks
place('ramp', 5, -6, 0, { rot: 2, surf: GARAGE }); // up west from the road onto the top deck
place('bridge', 0, -4, 1, { surf: GALLERY }); // the skybridge

// Outside: the ring road and loading docks, and the way round to the ramp.
for (let x = -8; x <= 8; x++) for (let y = -4; y <= 4; y++) if (!cells.has(key(x, y, 0))) place('yard', x, y, 0, { surf: ROAD });
for (const [x, y] of [[6, -5], [6, -6], [5, -5], [4, -5]] as const) place('yard', x, y, 0, { surf: ROAD });

// ---------------------------------------------------------------- walls and openings

const sideId = (x: number, y: number, z: number, side: Side): string => (side === 'N' ? `${x},${y},${z}:N` : side === 'E' ? `${x},${y},${z}:E` : side === 'S' ? `${x},${y - 1},${z}:N` : `${x - 1},${y},${z}:E`);
const links = new Map<string, [number, number, number, Side, EdgeStyle]>();
const link = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => links.set(sideId(x, y, z, side), [x, y, z, side, style]);
const DIRS: Record<Side, [number, number]> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };

// Concourse: open all through, wide arches into the anchors.
for (let x = -4; x <= 4; x++) for (let y = -1; y <= 1; y++) {
  if (x < 4) link(x, y, 0, 'E', 'open');
  if (y < 1) link(x, y, 0, 'N', 'open');
}
for (const y of [-1, 0, 1]) {
  link(-4, y, 0, 'W', y === 0 ? 'wide' : 'arch');
  link(4, y, 0, 'E', y === 0 ? 'wide' : 'arch');
}
// Upstairs: the galleries and bridges open into the upper halls.
for (const y of [-1, 0, 1]) {
  link(-4, y, 1, 'W', y === 0 ? 'wide' : 'arch');
  link(4, y, 1, 'E', y === 0 ? 'wide' : 'arch');
}
// Shop fronts: open sides (the glass, sills and doors are built below).
for (const s of SHOPS) for (const [x, y, z] of s.cells) link(x, y, z, y > 0 ? 'S' : 'N', 'open');
for (const s of SHOPS) if (s.cells.length > 1) link(s.cells[0]![0], s.cells[0]![1], s.cells[0]![2], 'E', 'open');
// Shops' back doors onto the service corridors (ground floor).
for (const s of SHOPS) for (const [x, y, z] of s.cells) if (z === 0) link(x, y, z, y > 0 ? 'N' : 'S', 'door');
// Food court: open to the concourse, a door each side into the corridors, a service door north.
for (let x = -1; x <= 1; x++) {
  link(x, 2, 0, 'S', 'open');
  link(x, 2, 0, 'N', 'open');
  if (x < 1) {
    link(x, 2, 0, 'E', 'open');
    link(x, 3, 0, 'E', 'open');
  }
}
link(-1, 3, 0, 'W', 'door');
link(1, 3, 0, 'E', 'door');
link(0, 3, 0, 'N', 'door');
// Multiplex: the lobby opens onto the north gallery, doors into the auditorium.
for (let x = -1; x <= 1; x++) {
  link(x, 2, 1, 'S', x === 0 ? 'wide' : 'arch');
  if (x < 1) {
    link(x, 2, 1, 'E', 'open');
    link(x, 3, 1, 'E', 'open');
  }
  link(x, 3, 1, 'S', x === 0 ? 'wall' : 'door');
}
// Entrance: vestibule from the road, the upper entry hall from the skybridge.
link(0, -2, 0, 'N', 'wide');
link(0, -2, 0, 'S', 'open');
link(0, -3, 0, 'S', 'door');
link(0, -3, 0, 'W', 'door');
link(0, -3, 0, 'E', 'door');
link(0, -2, 1, 'N', 'wide');
link(0, -2, 1, 'S', 'open');
link(0, -3, 1, 'S', 'open');
// Service corridors: open along, doors out to the docks and the road.
for (const x of [-4, -3, 2, 3]) link(x, 3, 0, 'E', 'open');
for (const x of [-4, -3, -2, 1, 2, 3]) link(x, -3, 0, 'E', 'open');
link(-4, 3, 0, 'W', 'door');
link(4, 3, 0, 'E', 'door');
link(-3, 3, 0, 'N', 'wide');
link(3, 3, 0, 'N', 'wide');
link(-4, -3, 0, 'W', 'door');
link(4, -3, 0, 'E', 'door');
link(-3, -3, 0, 'S', 'door');
link(3, -3, 0, 'S', 'door');
// Anchors.
for (const s of [-1, 1] as const) {
  const mid = s * 6;
  const out: Side = s < 0 ? 'W' : 'E';
  for (const z of [0, 1]) {
    link(mid, 1, z, 'N', 'door'); // the stairwell
    link(mid - 1, 1, z, 'N', 'door');
    link(mid + 1, 1, z, 'N', 'door');
  }
  link(mid, -1, 1, 'S', 'door'); // stairs to the roof
  link(mid, -2, 2, 'N', 'door'); // and out onto it
  link(mid - 1, -1, 1, 'S', 'door');
  link(mid + 1, -1, 1, 'S', 'door');
  for (const x of [mid - 1, mid, mid + 1]) link(x, -1, 0, 'S', 'door');
  link(mid - 1, -2, 0, 'E', 'open');
  link(mid, -2, 0, 'E', 'open');
  // Outside doors: the main doors at the end, the loading doors north and south.
  link(mid + s, 0, 0, out, 'door');
  link(mid + s, -1, 0, out, 'window');
  link(mid + s, 1, 0, out, 'window');
  for (const y of [-1, 0, 1]) link(mid + s, y, 1, out, 'windows');
  link(mid - s, 2, 0, 'N', 'wide');
  link(mid, -2, 0, 'S', 'wide');
}
// Garage.
for (let x = -3; x <= 3; x++) for (let y = -7; y <= -5; y++) for (const z of [0, 1]) {
  if (x < 3) link(x, y, z, 'E', 'open');
  if (y < -5) link(x, y, z, 'N', 'open');
  if (y === -7) link(x, y, z, 'S', 'half');
  if (y === -5) link(x, y, z, 'N', z === 0 ? 'open' : x === 0 ? 'open' : 'half');
  if (x === -3 && y !== -6) link(x, y, z, 'W', 'half');
  if (x === 3) link(x, y, z, 'E', y === -6 && z === 1 ? 'open' : z === 0 && y === -5 ? 'open' : 'half');
}
link(-3, -6, 0, 'W', 'door');
link(-3, -6, 1, 'W', 'door');

for (const [x, y, z, side, style] of links.values()) m.edge(x, y, z, side, style);
// Every other side of a room or hall against another tile is a plain wall (rooms would otherwise get a doorway).
const SEAL = new Set(['room', 'hall']);
const sealed = new Set<string>();
for (const [k, here] of cells) {
  if (!SEAL.has(here.kind)) continue;
  const [x, y, z] = k.split(',').map(Number) as [number, number, number];
  for (const side of ['N', 'E', 'S', 'W'] as const) {
    const [dx, dy] = DIRS[side];
    const there = cells.get(key(x + dx, y + dy, z));
    const id = sideId(x, y, z, side);
    if (!there || there.group === here.group || links.has(id) || sealed.has(id)) continue;
    sealed.add(id);
    m.edge(x, y, z, side, 'wall');
  }
}

// ---------------------------------------------------------------- shop fronts: glass either side of a sliding door

const SILL = { material: 'pbr_marble_black' };
const FRAME = { material: 'pbr_steel', tint: '#d8d8e0' };
const doorOf = new Map<string, string[]>();
let paneN = 0;
let doorN = 0;
for (const s of SHOPS) {
  const ids: string[] = [];
  for (const [x, y, z] of s.cells) {
    const dir = y > 0 ? -1 : 1; // toward the concourse
    const line = y * 8 + dir * 4;
    const base = z * 4;
    const cx = x * 8;
    for (const sx of [-1, 1]) {
      m.block([cx + sx * 2.75, base, r2(line - dir * 0.25)], [2.5, 1, 0.3], 'solid', SILL);
      m.block([cx + sx * 2.75, base + 2.4, r2(line - dir * 0.25)], [2.5, 0.6, 0.3], 'solid', FRAME);
      m.add({ kind: 'destructible', id: `pane_${String(++paneN).padStart(2, '0')}`, name: 'Shop window', model: 'glass', position: [cx + sx * 2.75, base, r2(line + dir * 0.2)], yaw: 0, health: null, explosiveOnly: false });
    }
    m.block([cx, base + 3, line], [8, 1, 0.4], 'solid', FRAME);
    // The neon sign over the door, on the concourse side.
    m.block([cx, base + 3.2, r2(line + dir * 0.28)], [4.2, 0.5, 0.2], 'solid', { material: 'light_strip', tint: s.neon });
    const id = `door_shop_${String(++doorN).padStart(2, '0')}`;
    m.add({ kind: 'door', id, name: `${s.name} door`.slice(0, 40), position: [cx, base, line], yaw: 0, startOpen: false, locked: false, auto: true });
    ids.push(id);
    // A coloured glow out over the concourse.
    m.light([cx, base + 3.4, r2(line + dir * 1.2)], { fixture: 'wall', color: s.neon, intensity: 1.2, range: 7, yaw: dir > 0 ? 0 : S });
    if (z === 0) {
      // The back door onto the service corridor.
      const back = y * 8 - dir * 4;
      const bid = `door_back_${String(++doorN).padStart(2, '0')}`;
      m.add({ kind: 'door', id: bid, name: `${s.name} back door`.slice(0, 40), position: [cx, 0, back], yaw: 0, startOpen: false, locked: false, auto: true });
      ids.push(bid);
    }
  }
  doorOf.set(s.name, ids);
}

// Main entrance and anchor doors (glass doors that slide for anyone).
const door = (id: string, name: string, pos: V3, yaw: number) => m.add({ kind: 'door', id, name, position: pos, yaw, startOpen: false, locked: false, auto: true });
door('door_entrance', 'Mall entrance', [0, 0, -28], 0);
door('door_west_main', "Halvorsen's main doors", [-60, 0, 0], P);
door('door_east_main', 'Delmar main doors', [60, 0, 0], P);

// ---------------------------------------------------------------- shutters (the Zombies barricades)

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const wait = (s: number) => act('wait', null, { value: s });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[], o: { once?: boolean } = {}): LogicRule => ({ id, name, enabled: true, once: o.once ?? false, when, if: [], do: does });
const rules: LogicRule[] = [];
SHOPS.forEach((s, i) => {
  const [x, y, z] = s.cells[0]!;
  const dir = y > 0 ? -1 : 1;
  const id = `btn_shutter_${String(i + 1).padStart(2, '0')}`;
  // On the west wall, a couple of metres in from the glass.
  m.add({ kind: 'button', id, name: `${s.name} shutter`.slice(0, 40), position: [x * 8 - 3.7, z * 4, r2(y * 8 + dir * 1.6)], yaw: P, label: 'Pull the shutters down', once: false, cooldownSeconds: 1, startEnabled: true });
  m.light([x * 8 - 3.55, z * 4 + 2.3, r2(y * 8 + dir * 1.6)], { fixture: 'wall', color: '#ff3a2a', intensity: 0.8, range: 3.5, yaw: P });
  const ds = doorOf.get(s.name)!;
  rules.push(
    rule(`rule_shutter_${i + 1}`, `${s.name} shutters`.slice(0, 60), { event: 'button_pressed', target: id }, [
      act('disable', id),
      act('sound', null, { state: 'buzzer' }),
      ...ds.flatMap((d) => [act('door_close', d), act('door_lock', d)]),
      say(`${s.name}: shutters down.`, 2),
      wait(25),
      ...ds.flatMap((d) => [act('door_unlock', d), act('door_open', d)]),
      say(`${s.name}: shutters up.`, 2),
      wait(20),
      act('enable', id),
    ]),
  );
});
m.logic({
  variables: [],
  timers: [{ id: 'timer_close', name: 'Closing time', seconds: 20, loop: false, visible: false }],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome', { event: 'match_start', target: null }, [say('Welcome to the Neon Galleria. Open till late.', 4), act('timer_start', 'timer_close')]),
    rule('rule_close', 'Closing time', { event: 'timer_done', target: 'timer_close' }, [act('sound', null, { state: 'chime' }), say('The Galleria is now closed. Shop buttons pull the shutters down.', 4)]),
    ...rules,
  ],
});

// ---------------------------------------------------------------- free blocks: fountain, skylights, roof, arcade, set dressing

const STONE = { material: 'pbr_marble_black' };
const TILE = { material: 'pbr_terrazzo', tint: '#c8b8d0' };
// The fountain court: a basin, a tiered middle, water.
for (const [dx, dz, w, d] of [[0, 3.3, 7, 0.4], [0, -3.3, 7, 0.4], [3.3, 0, 0.4, 6.2], [-3.3, 0, 0.4, 6.2]] as const) m.block([dx, 0, dz], [w, 0.55, d], 'solid', STONE);
m.block([0, 0, 0], [6.2, 0.1, 6.2], 'solid', { material: 'white_tiles', tint: '#4ac8e8' });
m.water([0, 0.1, 0], [6.2, 0.4, 6.2], 'water');
m.block([0, 0, 0], [1.4, 1.6, 1.4], 'solid', STONE);
m.block([0, 1.6, 0], [2.6, 0.2, 2.6], 'solid', STONE);
m.block([0, 1.8, 0], [0.6, 1.1, 0.6], 'solid', { material: 'light_strip', tint: '#30d8ff' });
// Planters and benches round the court.
for (const [x, z] of [[-6, -6], [6, 6], [-6, 6], [6, -6]] as const) m.block([x, 0, z], [1.6, 0.7, 1.6], 'solid', TILE);
// The roof: one deck at 8 m over the concourse, with the skylight well over the middle.
const ROOFING = { material: 'pbr_roof', tint: '#4a4a56' };
for (const x of [-18, 18]) for (const z of [-8, 8]) m.block([x, 7.7, z], [36, 0.3, 8], 'solid', ROOFING);
// Skylight well (open to the night): beams across, rails round it.
for (let x = -32; x <= 32; x += 4) m.block([x, 7.8, 0], [0.3, 0.2, 8], 'solid', FRAME);
for (const x of [-18, 18]) for (const z of [-4.1, 4.1]) m.block([x, 8, z], [36, 1, 0.2], 'solid', FRAME);
for (const x of [-36.1, 36.1]) m.block([x, 8, 0], [0.2, 1, 8.4], 'solid', FRAME);
// The anchors' skylight lanterns.
for (const s of [-1, 1]) {
  m.block([s * 48, 8, 0], [6, 0.8, 6], 'solid', FRAME);
  m.block([s * 48, 8.8, 0], [5.4, 0.6, 5.4], 'solid', { material: 'pbr_glass_facade', tint: '#c8d8ff' });
}
// HVAC on the roof: units with fans, ducts between them.
const HVAC = { material: 'pbr_steel', tint: '#a8acb4' };
for (const [x, z] of [[-24, 16], [-8, 20], [16, 16], [28, 20], [-28, -16], [-12, -20], [12, -16], [24, -20], [-48, 12], [48, 12], [-56, -4], [56, 4]] as const) {
  m.block([x, 8, z], [3.2, 1.9, 2.4], 'solid', HVAC);
  m.prop('sf_fan', [x, 9.9, z], 0, 1, false);
}
for (const [x, z, w, d] of [[-16, 18, 12, 1], [22, 18, 10, 1], [-20, -18, 12, 1], [18, -18, 10, 1]] as const) m.block([x, 8, z], [w, 1, d], 'solid', { material: 'pbr_corrugated', tint: '#9aa0a8' });

// The arcade: rows of cabinets, glowing screens and marquees.
const CAB = { material: 'paint_gloss', tint: '#1a1430' };
let ci = 0;
for (const cx of [16, 24]) {
  for (const dz of [-1.8, 1.8]) {
    for (const dx of [-2.6, -1.3, 0, 1.3, 2.6]) {
      const x = cx + dx;
      const z = 20 + dz;
      const face = dz < 0 ? -1 : 1; // back to back: screens face out of the pair
      const neon = NEON[ci++ % NEON.length]!;
      m.block([x, 4, z], [1, 1.8, 0.9], 'solid', CAB);
      m.block([x, 5.1, r2(z + face * 0.46)], [0.8, 0.55, 0.2], 'solid', { material: 'light_strip', tint: neon });
      m.block([x, 5.85, r2(z + face * 0.3)], [1, 0.3, 0.35], 'solid', { material: 'light_strip', tint: NEON[(ci + 2) % NEON.length]! });
    }
  }
}
for (const x of [13.2, 26.8]) for (const z of [17.2, 22.8]) m.light([x, 7.4, z], { fixture: 'bulb', color: NEON[Math.round(x + z) % NEON.length]!, intensity: 1.1, range: 7 });

// Food court counters (north wall), with neon menu boards.
const COUNTER = { material: 'paint_gloss', tint: '#f4f0f8' };
for (const [x, neon] of [[-8, '#ff3fb4'], [0, '#ffe02f'], [8, '#3dff8a']] as const) {
  m.block([x, 0, 26.6], [6, 1.1, 1.2], 'solid', COUNTER);
  m.block([x, 2.4, 27.6], [5, 1, 0.2], 'solid', { material: 'light_strip', tint: neon });
  m.light([x, 3.4, 26], { fixture: 'strip', color: neon, intensity: 1.4, range: 9 });
}
// Multiplex: raked seating in the auditorium, the screen on the north wall, a ticket booth in the lobby.
// Raked seating climbs to the back (north); the screen hangs on the south wall between the doors.
for (let i = 0; i < 4; i++) m.block([0, 4, r2(23.6 + i * 1.1)], [20, r2(0.25 * (i + 1)), 1.1], 'solid', { material: 'pbr_carpet', tint: '#6a1a3a' });
m.block([0, 4.8, 20.4], [7, 2.8, 0.2], 'solid', { material: 'light_strip', tint: '#e8e8ff' });
m.block([0, 4, 17.5], [4, 1.2, 1.4], 'solid', { material: 'paint_gloss', tint: '#c8202a' });
m.block([0, 6.6, 12.25], [12, 0.8, 0.2], 'solid', { material: 'light_strip', tint: '#ffd24a' }); // marquee over the lobby
// Loading docks: a box truck backed up to each set of dock doors.
for (const s of [-1, 1]) {
  const x = s * 24;
  m.block([x, 1.1, 37], [3, 3, 9], 'solid', { material: 'pbr_corrugated', tint: '#e8e8ec' });
  m.block([x, 0, 43], [2.8, 2.9, 2.6], 'solid', { material: 'paint_gloss', tint: s < 0 ? '#2a6ad8' : '#d84a2a' });
  for (const dz of [-3, 3]) m.block([x, 0, 37 + dz], [3.1, 1.1, 1.2], 'solid', { material: 'pbr_steel', tint: '#2a2a2a' });
}
// Parked cars in the garage (both decks): Designersoup's low-poly cars (CC0) in turn.
const CAR_MODELS = ['car_beetle', 'car_racer', 'car_offroader', 'car_pickup'] as const;
let carN = 0;
const car = (x: number, z: number, y: number, yaw: number) => {
  m.prop(CAR_MODELS[carN++ % CAR_MODELS.length]!, [x, y, z], yaw);
};
for (const y of [0, 4]) {
  for (const x of [-22, -14, -6, 6, 14, 22]) {
    if (!(y === 0 && (x === -6 || x === 14))) car(x, -60, y, 0);
    if (!(y === 4 && (x === -22 || x === 6))) car(x, -52 + 4.5, y, 0);
  }
}

// ---------------------------------------------------------------- objectives, spawns, pickups

// Capture the Flag: the back of each anchor's ground floor.
m.flag(WEST, at(-7, 0, 0, -2, 0), P);
m.flag(EAST, at(7, 0, 0, 2, 0), -P);
// King of the Hill: the fountain, the food court, the roof.
m.hill([0, 0, -6.5], 5).hill(at(0, 2, 0, 0, 4), 6).hill([0, 8, 20], 6);

// Team spawns: each anchor, both floors.
for (const [s, team] of [[-1, WEST], [1, EAST]] as const) {
  const yaw = s < 0 ? P : -P;
  for (const [dx, dy] of [[-4, -6], [-4, 6], [4, -6], [4, 6]] as const) m.spawn(at(s * 6, 0, 0, dx, dy), yaw, team);
  for (const [dx, dy] of [[-6, 0], [0, -6], [0, 6], [6, 0]] as const) m.spawn(at(s * 6, 0, 1, dx, dy), yaw, team);
}
// Everyone's (deathmatch and Zombies): the concourse, galleries, shops, food court, garage, roof.
for (const [p, yaw] of [
  [at(-3, 1, 0, 0, 0), S], [at(3, -1, 0, 0, 0), 0], [at(-1, -1, 0, 0, -1), 0], [at(1, 1, 0, 0, 1), S],
  [at(-3, -1, 1, 0, 0), P], [at(3, 1, 1, 0, 0), -P], [at(0, 1, 1, 0, 0), S], [at(0, -1, 1, 0, 0), 0],
  [at(0, 3, 0, -2, 0), S], [at(-1, -2, 1, 0, 1), 0], [at(4, 2, 0, 0, 1), S],
  [at(-1, -6, 0, 0, 0), 0], [at(2, -6, 1, 0, 0), 0], [at(-2, -6, 1, 0, 0), 0],
  [[-20, 8, 4.5], 0], [[20, 8, -4.5], S], [at(-3, 3, 0, 0, 0), P], [at(3, -3, 0, 0, 0), -P],
] as [V3, number][]) m.spawn(p, yaw);

// Pickups. Sporting goods: the guns.
m.pickup('weapon_shotgun', at(2, -2, 0, 0, 0)).pickup('weapon_rifle', at(3, -2, 0, 0, 0)).pickup('ammo_shells', at(2, -2, 0, 2, -2)).pickup('ammo_rifle', at(3, -2, 0, -2, -2));
m.pickup('weapon_marksman', at(3, -2, 0, 2, 2));
// Around the concourse and galleries.
m.pickup('health_large', [0, 0, 6.5]).pickup('armor_large', [0, 8, 0.01 + 20]);
m.pickup('weapon_smg', at(-3, 0, 0)).pickup('weapon_burst_rifle', at(3, 0, 0)).pickup('ammo', at(-1, 1, 0, 2, 2)).pickup('ammo', at(1, -1, 0, -2, -2));
m.pickup('health_small', at(-4, 1, 1)).pickup('health_small', at(4, -1, 1)).pickup('grenades', at(-1, -1, 1)).pickup('grenades', at(1, 1, 1));
m.pickup('weapon_sniper', [-20, 8, -16]).pickup('ammo_sniper', [20, 8, 16]);
m.pickup('weapon_rockets', at(0, 3, 1, 0, 0)); // the auditorium
m.pickup('ammo_explosive', at(0, 2, 1, 3, 0));
m.pickup('weapon_auto_shotgun', at(2, 2, 1, 0, -2)).pickup('powerup_damage', at(3, 2, 1, 2, -2), 90); // the arcade
m.pickup('weapon_lmg', at(0, -6, 0)).pickup('ammo_rifle', at(-3, -7, 1)).pickup('health_small', at(3, -5, 0)).pickup('armor_small', at(-3, -5, 1));
m.pickup('health_small', at(0, 2, 0, 0, 2)).pickup('health_small', at(-2, -3, 0)).pickup('health_small', at(2, 3, 0));
m.pickup('weapon_hand_cannon', at(-1, -2, 0)).pickup('ammo_light', at(1, -2, 0));
m.pickup('weapon_flamethrower', at(-1, -2, 1)).pickup('ammo_fuel', at(1, -2, 1)); // the bank vault and the travel agent
m.pickup('weapon_nailgun', at(-2, -2, 1)).pickup('health_large', at(-3, 2, 0)); // hobbies, the pet store
m.pickup('armor_small', at(-4, 2, 1)).pickup('ammo_cells', at(-3, 2, 1)).pickup('weapon_laser_rifle', at(-2, 2, 1));
m.pickup('ammo_shells', at(4, 2, 0)).pickup('health_small', at(-4, -2, 0)).pickup('ammo', at(4, -2, 1));
for (const [s] of [[-1], [1]] as const) {
  m.pickup('weapon_rifle', at(s * 6, 0, 0, s * 2, 0)).pickup('health_large', at(s * 6, 2, 0, s * 8, 0)).pickup('ammo_rifle', at(s * 6, -2, 0));
  m.pickup('armor_small', at(s * 6, 0, 1, 0, 0)).pickup('grenades', at(s * 6, -2, 1, s * 8, 0));
}
// Explosive drums in the service corridors and the garage.
m.breakable('barrel', at(-2, 3, 0, 2.5, 2.5)).breakable('barrel', at(2, -3, 0, -2.5, -2.5)).breakable('gas', at(4, -7, 0, -10.5, 2));
// Mounts: a go-kart in the toy store's corner of the road, a van and a jeep in the garage.
m.mount('ice_cream_truck', at(-2, -6, 0, 0, 2), 0).mount('gun_jeep', at(2, -6, 0, 0, -2), S).mount('kart', at(0, 4, 0, 4, 0), P);

// ---------------------------------------------------------------- dressing and lights

for (const s of SHOPS) {
  if (!s.dress) continue;
  if (s.cells.length > 1) m.dress({ x0: s.cells[0]![0], y0: s.cells[0]![1], x1: s.cells[s.cells.length - 1]![0], y1: s.cells[0]![1], z: s.cells[0]![2] }, s.dress, { density: 'sparse', max: 14 });
  else m.dress(s.cells[0]!, s.dress, { density: 'sparse', max: 10 });
}
m.dress({ x0: -1, y0: 2, x1: 1, y1: 3, z: 0 }, 'dining', { density: 'sparse', max: 18 });
for (const s of [-1, 1]) {
  m.dress({ x0: s * 6 - 1, y0: -1, x1: s * 6 + 1, y1: 1, z: 0 }, 'shop', { density: 'sparse', max: 18 });
  m.dress({ x0: s * 6 - 1, y0: -1, x1: s * 6 + 1, y1: 1, z: 1 }, 'shop', { density: 'sparse', max: 14 });
  m.dress([s * 6 + s, 2, 0], 'storage', { density: 'sparse', max: 8 });
  m.dress({ x0: s * 6 - 1, y0: -2, x1: s * 6 + 1, y1: -2, z: 0 }, 'warehouse', { density: 'sparse', max: 10 });
}
// Concourse: benches, plants, bins (fixed, so the escalators and fountain stay clear).
for (const x of [-28, -12, 12, 28]) for (const z of [-9.5, 9.5]) {
  m.prop('bench', [x, 0, z], 0, 2.5, false).prop('hm_potted_palm', [x + 3, 0, z]).prop('trashcan', [x - 2, 0, z]);
}
m.prop('hm_potted_palm', [-6, 0.7, -6]).prop('hm_potted_palm', [6, 0.7, 6]).prop('hm_potted_palm', [-6, 0.7, 6]).prop('hm_potted_palm', [6, 0.7, -6]);

// Lights: panels in every roofed room, neon strips under the galleries, lamps over the well, sodium on the road.
m.lightRooms({ color: '#fff4e8', intensity: 0.9 });
for (let x = -4; x <= 4; x++) for (const y of [-1, 1]) m.light(at(x, y, 0, 0, 0, 3.6), { fixture: 'strip', color: x % 2 ? '#ff5ea8' : '#30d8ff', intensity: 0.9, range: 9 });
for (let x = -4; x <= 4; x++) m.light(at(x, 0, 1, 0, 0, 3.4), { fixture: 'bulb', color: '#f0e8ff', intensity: 1.2, range: 13 });
for (let x = -4; x <= 4; x += 2) for (const y of [-1, 1]) m.light(at(x, y, 1, 0, 0, 3.4), { fixture: 'ceiling', color: '#ffe8f4', intensity: 0.8, range: 8 });
m.light([0, 2.6, 0], { fixture: 'none', color: '#30d8ff', intensity: 1.6, range: 10 });
for (const s of [-1, 1]) for (const z of [0, 1]) m.light(at(s * 6, 0, z, 0, 0, 3.4), { fixture: 'bulb', color: s < 0 ? '#ffd0ec' : '#d0f0ff', intensity: 1.4, range: 16 });
for (let x = -8; x <= 8; x += 4) for (const y of [-4, 4]) m.light(at(x, y, 0, 0, 0, 5), { fixture: 'none', color: '#ffb060', intensity: 1.2, range: 14 });
for (const x of [-3, 0, 3]) for (const y of [-7, -5]) for (const z of [0, 1]) m.light(at(x, y, z, 0, 0, z === 0 ? 3.5 : 3.2), { fixture: z === 0 ? 'strip' : 'none', color: '#e8f0d8', intensity: 0.8, range: 10 });
for (const [x, z] of [[-48, 0], [48, 0], [0, 20], [-20, 8], [20, -8]] as const) m.light([x, 9.5, z], { fixture: 'none', color: '#9a6aff', intensity: 1, range: 14 });
m.prop('lightpost', at(-8, -4, 0, 2, 2)).prop('lightpost', at(8, -4, 0, -2, 2)).prop('lightpost', at(-8, 4, 0, 2, -2)).prop('lightpost', at(8, 4, 0, -2, -2));

m.bounds('invisible', 4, undefined, 24);
m.backdrop('night', 'city', 'stone', 0.45);
m.meta({
  description:
    "A two-storey 1980s shopping mall at night. Halvorsen's and Delmar & Co. anchor the ends (the team bases and flags); between them the concourse runs under galleries and skylights, with escalator stairs, bridges and the fountain court in the middle. Every shop front is glass you can shoot out: records, pets, books, candy, toys, shoes, jewellers, sporting goods with the guns, an arcade full of glowing cabinets, video rental, a multiplex over the neon food court. Every shop has a shutter button that locks its doors for 25 s, so in Zombies you can barricade in. Service corridors run to the loading docks, a two-deck garage with parked cars sits across the road, and the roof is one deck of HVAC units round the skylight well. King of the Hill: the fountain, the food court and the roof.",
  modes: ['core.tdm', 'core.deathmatch', 'core.ctf', 'core.koth', 'core.zombies'],
  players: [6, 16],
});
await m.save();
