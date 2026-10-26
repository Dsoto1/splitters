/**
 * Serene City: an original two-part map (our own city, names and kit) for
 * 12–24 players in Hostage Rescue, Bomb, Team Deathmatch, Capture the Flag,
 * King of the Hill and Deathmatch. A spotless utopian city of 2032 on the
 * surface, and under it a maximum-security cryogenic prison and the grimy
 * sewers where the Scraps, the city's resistance, have their hideout.
 *
 * Surface (level 0): white plazas under soft pastel light, topiary and glass
 * towers, ringed by a pristine road where self-driving pod cars (the track's
 * ambient speeders) lap all match, firefight or not.
 * - The Plaza (centre): the fountain, polite announcement kiosks (press one),
 *   the Police flag (CTF) and a hill.
 * - Chez Serene (north-west): the fancy restaurant. Every place in town is
 *   called Chez Serene: the corner shops say so too.
 * - The Museum of Arms (north-east): six display cases on plinths. Shoot a
 *   case open and the exhibit inside is yours (bomb site B, a hill).
 * - The Serene City Police precinct (south): the Police team's house, with
 *   stairs straight down into the prison.
 * - The maglev: a guideway 8 m up across the avenue, its car shuttling
 *   between two stations (lifts up from the street). It does not stop for
 *   anyone standing on the guideway.
 *
 * Underground (level -1):
 * - The Scraps' hideout (west, under the street): bunks, crates, fire baskets
 *   (the Scraps' flag, the hostage rescue zone). Sewer tunnels with murky
 *   water run east to two breaches into the prison and up two stair-houses to
 *   the street.
 * - The cryo-prison (east): the cryo vault (rows of upright pods with frosted
 *   glass fronts and blue light; the frozen scientist waits there in Hostage
 *   Rescue), the frozen-floor hall (ice: looks only, see below), the cell
 *   block corridor with force-field gates, the warden's control room (bomb
 *   site A: its console raises the gates for 10 s) and the thaw chamber
 *   (a hill): its console thaws an inmate: alarms blink, the pod opens, the
 *   blast door and the weapon cache unlock (the freeze ray) for 25 s.
 *
 * Teams: the Scraps (first: attackers in Bomb, rescuers in Hostage) and the
 * Serene City Police (second).
 *
 * Grid x east, y north (one cell = 8 m); level 0 at y 0, level -1 at y -4.
 *
 *  surface (z0)                                         underground (z-1)
 *  y 9  r  r  r  r  r  r  r  r  r  r  r  r  r     r ring road (pod cars)
 *  y 8  r  TA TA C  C  g  g  .  M  M  M  .  r     TA/TC/TE glass towers, C Chez Serene
 *  y 7  r  TA TA C  C  g  g  .  M  M  M  .  r     g topiary garden, M museum
 *  y 6  r  .  .  .  .  .  .  .  M  M  M  .  r
 *  y 5  r  .  .  .  .  .  .  .  .  .  .  .  r     == maglev guideway over y 5 (8 m)
 *  y 4  r  s1 .  .  .  .  .  .  .  .  .  .  r     s1/s2 stair-houses down to the sewer      ice 2..3 x 3..4, vault 4..6 x 3..5
 *  y 3  r  .  .  .  .  P  P  .  .  .  .  sh r     P plaza, sh corner shop                   tunnels (-4,3) (1,2..3)
 *  y 2  r  .  .  .  .  P  P  .  .  .  .  .  r                                               hideout -4..-3 x 1..2, corridor 2..6 x 2
 *  y 1  r  .  .  .  .  .  .  .  .  .  .  .  r                                               tunnels -2..1 x 1, thaw 2..3 x 0..1,
 *  y 0  r  sh .  .  s2 .  .  .  .  .  .  .  r                                               cache (4,1), junction (4,0), warden 5..6 x 0..1
 *  y-1  r  .  .  .  .  .  .  .  .  .  .  .  r                                               entry (4,-1..-2), stairs (3,-2)
 *  y-2  r  TC TC .  .  .  PD PD ps .  TE TE r     PD police precinct, ps prison stairs
 *  y-3  r  TC TC .  .  .  PD PD .  .  TE TE r
 *  y-4  r  r  r  r  r  r  r  r  r  r  r  r  r
 *      -5 -4 -3 -2 -1  0  1  2  3  4  5  6  7
 *
 * Kit note: the map format has no low-friction surface for players (only the
 * oil slicker's puddles are slick), so the frozen hall's ice is a look.
 */
import { Track, type EdgeStyle, type LogicAction, type LogicRule, type RoomOptions, type Rotation, type Side, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('serene_city', 'Serene City');
m.theme('lab');
m.backdrop('clear', 'city', 'stone', 0.35);
m.factions([
  { id: 'scraps', name: 'Scraps', color: '#d8742a', relations: {} },
  { id: 'police', name: 'Serene Police', color: '#6fb6ff', relations: {} },
]);
m.teams([12, 12]);
const [SCRAPS, POLICE] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];
const UG = -4;

// ---------------------------------------------------------------- surfaces

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const PLAZA: TileSurfaces = { floor: mat('marble', '#f6f4ef'), walls: mat('pbr_plaster_white') };
const WALK: TileSurfaces = { floor: mat('pbr_terrazzo', '#f2f1ec'), walls: mat('pbr_plaster_white') };
const GARDEN: TileSurfaces = { floor: mat('pbr_hex_paving', '#eef0e6'), walls: mat('pbr_plaster_white') };
const ROAD: TileSurfaces = { floor: mat('pbr_concrete', '#d4d6d8'), walls: mat('pbr_plaster_white') };
const RESTAURANT: TileSurfaces = { floor: mat('pbr_marble_black', '#c8c0d0'), walls: mat('pbr_plaster_white', '#f8eef2'), trim: mat('brass') };
const MUSEUM: TileSurfaces = { floor: mat('pbr_travertine', '#f0ebe0'), walls: mat('pbr_plaster_white', '#f4f2ee'), trim: mat('brass') };
const PRECINCT: TileSurfaces = { floor: mat('pbr_white_panel', '#e4ecf4'), walls: mat('orbital_panel'), trim: mat('glow_trim', '#7fb8ff') };
const STAIRHOUSE: TileSurfaces = { floor: mat('pbr_concrete', '#9a948a'), walls: mat('pbr_plaster_white', '#e8e6e0'), solids: mat('pbr_concrete', '#8a847a') };
const SEWER: TileSurfaces = { floor: mat('pbr_brick_old', '#5a5048'), walls: mat('pbr_brick_old', '#6a5a4a'), solids: mat('pbr_rusted_plate'), trim: mat('pbr_rusted_plate') };
const HIDEOUT: TileSurfaces = { floor: mat('pbr_concrete_dark', '#5a544c'), walls: mat('pbr_brick_old', '#7a6450'), trim: mat('pbr_rusted_plate') };
const PRISON: TileSurfaces = { floor: mat('grate', '#c4d0da'), walls: mat('orbital_panel', '#e8f0f6'), solids: mat('pbr_white_panel'), trim: mat('glow_trim', '#7fd8ff') };
const ICE: TileSurfaces = { floor: mat('pbr_ice'), walls: mat('orbital_panel', '#cfe6f4'), trim: mat('glow_trim', '#9fe8ff') };
const VAULT: TileSurfaces = { floor: mat('pbr_tread_plate', '#b8c8d8'), walls: mat('orbital_panel', '#dceaf4'), trim: mat('glow_trim', '#5ad8ff') };
const WARDEN: TileSurfaces = { floor: mat('pbr_carpet', '#2a3a5a'), walls: mat('pbr_white_panel'), trim: mat('glow_trim', '#7fb8ff') };
const THAW: TileSurfaces = { floor: mat('hex_tiles', '#d8e4ec'), walls: mat('orbital_panel', '#e4eef4'), trim: mat('glow_trim', '#ff9a6a') };
const CACHE: TileSurfaces = { floor: mat('pbr_steel'), walls: mat('pbr_steel', '#7a828a'), trim: mat('hazard') };

// ---------------------------------------------------------------- tiles

type CellInfo = { kind: string; group: number };
const cells = new Map<string, CellInfo>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
let groups = 0;
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
const FOOT: Record<string, [number, number, number][]> = {
  room_large: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
  plaza: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
  hall: [0, 1, 2].flatMap((dx) => [0, 1, 2].map((dy) => [dx, dy, 0] as [number, number, number])),
  stairs: [[0, 0, 0], [0, 0, 1]],
  tower: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
  shop: [[0, 0, 0]],
};
function place(kind: string, x: number, y: number, z: number, o: { rot?: Rotation; opts?: RoomOptions; surf?: TileSurfaces; foot?: string } = {}): void {
  m.tile(kind, x, y, z, o.rot ?? 0, o.opts);
  const g = ++groups;
  for (const [dx, dy, dz] of FOOT[o.foot ?? kind] ?? [[0, 0, 0]]) {
    const k = key(x + dx, y + dy, z + dz);
    if (cells.has(k)) throw new Error(`cell ${k} placed twice`);
    cells.set(k, { kind: o.foot ?? kind, group: g });
  }
  if (o.surf) paint(x, y, z, o.surf);
}
const ROOF: RoomOptions = { ceiling: 'roof', layout: 'empty' };
const UNDER: RoomOptions = { layout: 'empty' };
const room = (x: number, y: number, z: number, surf: TileSurfaces, opts: RoomOptions = UNDER) => place('room', x, y, z, { surf, opts });

// Surface buildings.
place('neon.tower_a', -4, 7, 0, { foot: 'tower' }); // north-west glass tower
place('neon.tower_c', -4, -3, 0, { foot: 'tower' }); // south-west
place('neon.tower_e', 5, -3, 0, { foot: 'tower' }); // south-east
place('neon.shop_a', -4, 0, 0, { foot: 'shop', rot: 1 });
place('neon.shop_a', 6, 3, 0, { foot: 'shop', rot: 3 });
place('room_large', -2, 7, 0, { surf: RESTAURANT, opts: { ...ROOF, facade: 'plaster', corners: 'rounded' } }); // Chez Serene
place('hall', 3, 6, 0, { surf: MUSEUM, opts: { ...ROOF, facade: 'plaster', corners: 'columns' } }); // Museum of Arms
place('room_large', 1, -3, 0, { surf: PRECINCT, opts: { ...ROOF, facade: 'hull' } }); // police precinct
place('plaza', 0, 2, 0, { surf: PLAZA });
// Stair-houses: down from the street to the sewer (s1, s2) and from the precinct to the prison.
place('stairs', -4, 4, -1, { rot: 3, surf: STAIRHOUSE }); // up north onto the avenue
place('stairs', -1, 0, -1, { rot: 1, surf: STAIRHOUSE }); // up south onto the street
place('stairs', 3, -2, -1, { rot: 2, surf: PRISON }); // up west into the precinct

// Underground: the sewer and the hideout.
place('room_large', -4, 1, -1, { surf: HIDEOUT, opts: { layout: 'empty', corners: 'posts' } });
const TUNNELS: [number, number][] = [[-4, 3], [-2, 1], [-1, 1], [0, 1], [1, 1], [1, 2], [1, 3], [1, 0]];
for (const [x, y] of TUNNELS) room(x, y, -1, SEWER);
// Underground: the cryo-prison.
room(4, -2, -1, PRISON); // entry from the precinct stairs
room(4, -1, -1, PRISON); // entry corridor (gate)
room(4, 0, -1, PRISON); // junction
room(4, 1, -1, CACHE); // weapon cache
place('room_large', 2, 0, -1, { surf: THAW, opts: UNDER }); // thaw chamber
place('room_large', 5, 0, -1, { surf: WARDEN, opts: UNDER }); // warden's control room
for (let x = 2; x <= 6; x++) room(x, 2, -1, PRISON); // cell-block corridor
place('room_large', 2, 3, -1, { surf: ICE, opts: UNDER }); // frozen-floor hall
place('hall', 4, 3, -1, { surf: VAULT, opts: UNDER }); // cryo vault

// The ring road and every other surface cell: open ground.
const RING = (x: number, y: number) => x === -5 || x === 7 || y === -4 || y === 9;
const GARDEN_CELL = (x: number, y: number) => x >= 0 && x <= 2 && y >= 7;
for (let x = -5; x <= 7; x++) {
  for (let y = -4; y <= 9; y++) {
    if (cells.has(key(x, y, 0))) continue;
    const plaza = x >= -1 && x <= 2 && y >= 1 && y <= 4;
    place('yard', x, y, 0, { surf: RING(x, y) ? ROAD : GARDEN_CELL(x, y) ? GARDEN : plaza ? PLAZA : WALK });
  }
}

// ---------------------------------------------------------------- walls and openings

const sideId = (x: number, y: number, z: number, side: Side): string => (side === 'N' ? `${x},${y},${z}:N` : side === 'E' ? `${x},${y},${z}:E` : side === 'S' ? `${x},${y - 1},${z}:N` : `${x - 1},${y},${z}:E`);
const links = new Map<string, [number, number, number, Side, EdgeStyle]>();
const link = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => links.set(sideId(x, y, z, side), [x, y, z, side, style]);
const DIRS: Record<Side, [number, number]> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };

// Chez Serene.
link(-2, 7, 0, 'S', 'door');
link(-1, 7, 0, 'S', 'windows');
link(-2, 8, 0, 'N', 'windows');
link(-1, 8, 0, 'N', 'windows');
link(-1, 7, 0, 'E', 'door');
link(-1, 8, 0, 'E', 'windows');
// The museum.
link(3, 6, 0, 'S', 'windows');
link(4, 6, 0, 'S', 'wide');
link(5, 6, 0, 'S', 'windows');
link(3, 7, 0, 'W', 'door');
link(3, 6, 0, 'W', 'window');
link(3, 8, 0, 'W', 'window');
link(5, 7, 0, 'E', 'door');
link(5, 6, 0, 'E', 'window');
link(5, 8, 0, 'E', 'window');
for (const x of [3, 4, 5]) link(x, 8, 0, 'N', 'window');
// The precinct.
link(1, -2, 0, 'N', 'door');
link(2, -2, 0, 'N', 'windows');
link(1, -3, 0, 'W', 'door');
link(1, -2, 0, 'W', 'windows');
link(2, -2, 0, 'E', 'door'); // top of the prison stairs
link(2, -3, 0, 'E', 'windows');
link(1, -3, 0, 'S', 'windows');
link(2, -3, 0, 'S', 'windows');

// The sewer.
link(-3, 1, -1, 'E', 'arch');
link(-2, 1, -1, 'E', 'open');
link(-1, 1, -1, 'E', 'open');
link(0, 1, -1, 'E', 'open');
link(1, 1, -1, 'N', 'open');
link(1, 2, -1, 'N', 'open');
link(1, 1, -1, 'S', 'open');
link(-4, 2, -1, 'N', 'door');
link(-4, 3, -1, 'N', 'door'); // foot of stair-house s1
link(-1, 1, -1, 'S', 'door'); // foot of stair-house s2
link(1, 3, -1, 'E', 'broken'); // the Scraps' breach into the frozen hall
link(1, 0, -1, 'E', 'broken'); // and into the thaw chamber
// The prison.
link(4, -2, -1, 'W', 'door'); // foot of the precinct stairs
link(4, -2, -1, 'N', 'open');
link(4, -1, -1, 'N', 'door'); // gate S
link(4, 0, -1, 'W', 'door');
link(4, 0, -1, 'E', 'door');
link(4, 1, -1, 'W', 'door'); // the weapon cache (locked)
link(2, 1, -1, 'N', 'door'); // thaw chamber blast door (locked)
link(5, 1, -1, 'N', 'windows');
link(6, 1, -1, 'N', 'door');
link(2, 2, -1, 'E', 'open');
link(3, 2, -1, 'E', 'wide'); // gate W
link(4, 2, -1, 'E', 'open');
link(5, 2, -1, 'E', 'wide'); // gate E
link(2, 2, -1, 'N', 'door');
link(3, 2, -1, 'N', 'window');
link(4, 2, -1, 'N', 'wide'); // gate V, into the vault
link(6, 2, -1, 'N', 'door');
link(3, 4, -1, 'E', 'wide');
link(3, 3, -1, 'E', 'window');

for (const [x, y, z, side, style] of links.values()) m.edge(x, y, z, side, style);
// Every other side of a room against another tile is a plain wall (rooms would otherwise get a doorway).
const SEAL = new Set(['room', 'room_large', 'hall']);
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

// ---------------------------------------------------------------- the ring road and its pod cars

const LOOP: { len: number; at: (t: number) => [number, number] }[] = [];
const line = (ax: number, az: number, bx: number, bz: number) => LOOP.push({ len: Math.hypot(bx - ax, bz - az), at: (t) => [ax + (bx - ax) * t, az + (bz - az) * t] });
const R = 6;
const arc = (cx: number, cz: number, a0: number, a1: number) => LOOP.push({ len: Math.abs(a1 - a0) * R, at: (t) => [cx + R * Math.cos(a0 + (a1 - a0) * t), cz + R * Math.sin(a0 + (a1 - a0) * t)] });
// Centre line: x -40 and 56, z -32 and 72 (the ring of road cells), corners of 6 m radius.
line(-34, -32, 50, -32);
arc(50, -26, -P, 0);
line(56, -26, 56, 66);
arc(50, 66, 0, P);
line(50, 72, -34, 72);
arc(-34, 66, P, S);
line(-40, 66, -40, -26);
arc(-34, -26, S, S + P);
const LOOP_LEN = LOOP.reduce((s, p) => s + p.len, 0);
const loopAt = (d: number): [number, number] => {
  d = ((d % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
  for (const p of LOOP) {
    if (d <= p.len) return p.at(d / p.len);
    d -= p.len;
  }
  return LOOP[0]!.at(0);
};
const roadPoints: V3[] = [];
const nPts = Math.round(LOOP_LEN / 6);
for (let i = 0; i < nPts; i++) {
  const [x, z] = loopAt(20 + (i * LOOP_LEN) / nPts);
  roadPoints.push([r2(x), 0, r2(z)]);
}
m.track(Track.parse({ points: roadPoints, width: 7, loop: true, laps: 3, grid: 2, vehicle: 'speeder', combat: false, surface: 'asphalt', curbs: false, ambient: 3, ambientVehicle: 'speeder', pit: [-40, 0, 20] }));

// ---------------------------------------------------------------- the maglev (8 m up over the avenue, y 5)

const WHITE_PANEL: Look = { material: 'pbr_white_panel', tint: '#f4f6f8' };
const STEEL: Look = { material: 'pbr_steel', tint: '#c8ccd0' };
const CYAN: Look = { material: 'neon_tube', tint: '#7fe6ff' };
const PINK: Look = { material: 'neon_tube', tint: '#ffb8de' };
const GZ = 40; // guideway centre line (z)
const DECK = 8; // guideway top
for (const x of [-15, 31]) {
  m.block([x, DECK - 0.6, GZ], [46, 0.6, 4], 'solid', WHITE_PANEL);
  m.block([x, DECK - 0.75, GZ], [46, 0.15, 1.2], 'solid', CYAN); // glowing underside strip
}
for (const x of [-12, 4, 20, 30]) m.block([x, 0, GZ], [1.2, DECK - 0.6, 1.2], 'solid', WHITE_PANEL);
// Stations on the south side: platforms 8 m up, a lift at the inner end of each, a pitched canopy.
function station(x0: number, x1: number, liftX: number, id: string, name: string): void {
  const cx = (x0 + x1) / 2;
  const w = x1 - x0;
  m.block([cx, DECK - 0.4, 36], [w, 0.4, 4], 'solid', { material: 'pbr_terrazzo', tint: '#f4f2ee' });
  m.block([cx, DECK, 34.08], [w, 1.1, 0.2], 'solid', STEEL); // railing along the south edge
  const outer = liftX > cx ? x0 : x1;
  m.block([outer + (liftX > cx ? 0.08 : -0.08), DECK, 36], [0.2, 1.1, 4], 'solid', STEEL); // railing at the outer end
  m.block([cx, DECK + 1.1, 34.08], [w, 0.1, 0.24], 'solid', PINK);
  // Posts down to the street, clear of the stair-house under the west platform.
  for (const px of [x0 + 0.4, cx, x1 - 0.4]) m.block([r2(px), 0, 37.6], [0.4, DECK - 0.4, 0.4], 'solid', STEEL);
  m.block([r2(liftX > cx ? x1 - 0.4 : x0 + 0.4), 0, 34.4], [0.4, DECK - 0.4, 0.4], 'solid', STEEL);
  // Canopy: posts and a glass roof pitched down toward the street.
  for (const px of [x0 + 0.4, x1 - 0.4]) m.block([r2(px), DECK, 34.4], [0.2, 3, 0.2], 'solid', STEEL);
  m.block([cx, DECK + 3, 36], [w + 0.4, 0.15, 4.4], 'solid', { material: 'pbr_glass_facade', tint: '#dff2ff', pitch: 0.18 });
  // The lift: a 3 m cab riding from the street to the platform.
  m.block([liftX, -0.3, 36], [3, 0.3, 3], 'solid', { id: `${id}_cab`, material: 'pbr_tread_plate', tint: '#e0e4e8' });
  m.mover(id, [liftX, -0.3, 36], [`${id}_cab`], [[0, 0, 0], [0, DECK, 0]], { speed: 3, wait: 3, name });
  m.prop('nc_holo_kiosk', [liftX, 0, 31.6], S);
}
station(-34, -22, -20.4, 'mover_lift_w', 'West maglev lift');
station(38, 50, 36.5, 'mover_lift_e', 'East maglev lift');
// The car: floor, roof on posts, cyan strips; a nose at each end rides along (not solid). It shuttles between the stations.
{
  const x0 = -28;
  const parts: string[] = [];
  const part = (id: string, pos: V3, size: V3, look: Look) => {
    m.block(pos, size, 'solid', { ...look, id });
    parts.push(id);
  };
  part('maglev_floor', [x0, DECK, GZ], [10, 0.3, 3.4], { material: 'pbr_tread_plate', tint: '#d8dde2' });
  part('maglev_roof', [x0, DECK + 2.9, GZ], [10.2, 0.25, 3.6], WHITE_PANEL);
  part('maglev_stripe', [x0, DECK + 2.75, GZ], [10.3, 0.15, 3.7], CYAN);
  for (const [dx, dz] of [[-4.9, -1.6], [4.9, -1.6], [-4.9, 1.6], [4.9, 1.6]] as const) part(`maglev_post_${dx > 0 ? 'e' : 'w'}${dz > 0 ? 'n' : 's'}`, [x0 + dx, DECK + 0.3, GZ + dz], [0.2, 2.45, 0.2], STEEL);
  m.add({ kind: 'prop', id: 'maglev_nose_e', model: 'prop.nc_skytrain_front', position: [x0 + 7.7, DECK, GZ], yaw: P, scale: 1, solid: false, tint: '#f2f6fa' });
  m.add({ kind: 'prop', id: 'maglev_nose_w', model: 'prop.nc_skytrain_front', position: [x0 - 7.7, DECK, GZ], yaw: -P, scale: 1, solid: false, tint: '#f2f6fa' });
  m.mover('mover_maglev', [x0, DECK, GZ], parts, [[0, 0, 0], [72, 0, 0]], { mode: 'pingpong', speed: 6, wait: 5, name: 'Maglev', props: ['maglev_nose_e', 'maglev_nose_w'] });
}

// ---------------------------------------------------------------- the museum of arms: display cases

const CASES: [string, V3][] = [
  ['weapon_gilded_pistol', [25, 0, 50]],
  ['weapon_hand_cannon', [32, 0, 50]],
  ['weapon_sawed_off', [39, 0, 50]],
  ['weapon_marksman', [25, 0, 62]],
  ['weapon_launcher', [32, 0, 62]],
  ['weapon_flamethrower', [39, 0, 62]],
];
CASES.forEach(([item, [x, , z]], i) => {
  const n = i + 1;
  m.block([x, 0, z], [1.1, 0.5, 1.1], 'solid', { material: 'pbr_marble_black', tint: '#e8e4dc' }); // plinth
  m.block([x, 0.5, z], [1.05, 1.1, 1.05], 'breakable', { id: `case_${n}`, material: 'pbr_glass_facade', tint: '#d8f0ff', health: 40, respawn: null });
  m.block([x, 1.6, z], [1.1, 0.1, 1.1], 'solid', { material: 'brass' }); // case lid trim (left floating when the glass goes: a look)
  m.add({ kind: 'pickup', id: `pickup_case_${n}`, item: `core.${item}`, position: [x, 0.5, z], respawnSeconds: 45 });
});
// Wall displays: swords, armour, antique artillery, a horse statue on a pedestal.
for (const x of [24, 32, 40]) m.prop('dg_sword_mount', [x, 1.6, 67.6], S, 1, false);
m.prop('ge_suit_of_armour', [21, 0, 66.6], S * 0.75).prop('ge_suit_of_armour', [43, 0, 66.6], -S * 0.75);
m.prop('cannon', [21.6, 0, 56], P).prop('cannon', [42.4, 0, 56], -P);
m.prop('dg_pedestal', [32, 0, 66.2], S).prop('display_wall', [21, 0, 46], P * 0.5).prop('display_wall', [43, 0, 46], -P * 0.5);
m.prop('banner_red', [20.4, 1, 52], P, 1, false).prop('banner_red', [43.6, 1, 60], -P, 1, false);

// ---------------------------------------------------------------- the cryo vault: rows of upright pods

const POD: Look = { material: 'orbital_panel', tint: '#e8f0f6' };
const FROST: Look = { material: 'pbr_glass_facade', tint: '#c8ecff' };
const GLOW: Look = { material: 'glow_trim', tint: '#5ad8ff' };
/** An upright cryo pod at (x, z) facing north (f = 1) or south (f = -1); `open` leaves the front off. */
function pod(x: number, z: number, f: 1 | -1, o: { glassId?: string; open?: boolean; y?: number } = {}): void {
  const y = o.y ?? UG;
  m.block([x, y, z], [1.5, 2.6, 0.9], 'solid', POD);
  m.block([x, y + 2.6, z], [1.6, 0.14, 1.0], 'solid', GLOW);
  m.block([x, y, r2(z + f * 0.5)], [1.6, 0.12, 0.2], 'solid', GLOW);
  if (!o.open) m.block([x, y + 0.2, r2(z + f * 0.52)], [1.2, 2.2, 0.2], 'solid', { ...FROST, ...(o.glassId ? { id: o.glassId } : {}) });
}
// Two back-to-back double rows across the vault (x 28..52, z 20..44), lanes between and round them.
for (const x of [33, 37, 41, 45]) {
  pod(x, 26.6, -1);
  pod(x, 27.6, 1);
  pod(x, 36.6, -1);
  pod(x, 37.6, 1, { open: x === 41 }); // the scientist's pod stands open
}
m.prop('os_cryo_pod', [50, UG, 31], -P).prop('os_cryo_pod', [50, UG, 33.4], -P).prop('os_cryo_pod', [30, UG, 41.5], 0);
m.prop('os_console_corner', [50.6, UG, 42.6], -P).prop('os_coolant_pipe', [50.6, UG, 22], 0).prop('os_floor_cables', [41, UG, 32], 0.3);

// ---------------------------------------------------------------- the frozen hall, thaw chamber, cache, warden, gates

// Frozen hall (x 12..28, z 20..36): ice blocks for cover, frozen crates.
const ICEBLOCK: Look = { material: 'pbr_ice', tint: '#e4f6ff' };
m.block([17, UG, 28], [2.2, 1.4, 1.4], 'solid', { ...ICEBLOCK, yaw: 0.3 });
m.block([23, UG, 31.5], [1.6, 1.8, 1.6], 'solid', { ...ICEBLOCK, yaw: -0.2 });
m.block([22.5, UG, 24.5], [2.6, 0.9, 1.2], 'solid', { ...ICEBLOCK, yaw: 0.6, roll: 0.12 });
m.prop('os_cargo_crate', [14.2, UG, 33.6], 0.2, 1, true).prop('sf_barrel', [26, UG, 34.6]).prop('os_coolant_pipe', [13, UG, 22], P);

// Thaw chamber (x 12..28, z -4..12): the thaw pod against the south wall, its console beside it.
pod(20, -3, 1, { glassId: 'pod_thaw_glass' });
m.prop('os_terminal', [15.5, UG, -3.3], 0).prop('os_power_unit', [24.5, UG, -2.8], 0).prop('os_canister_rack', [13, UG, 6], P).prop('os_floor_cables', [18, UG, 0.5], 0.4);
m.add({ kind: 'button', id: 'btn_thaw', name: 'Thaw console', position: [15.5, UG + 1.2, -3.6], yaw: 0, label: 'Begin thaw cycle', once: false, cooldownSeconds: 5, startEnabled: true });

// The weapon cache (x 28..36, z 4..12) behind a vault door from the thaw chamber.
m.add({ kind: 'door', id: 'door_cache', name: 'Weapon cache', position: [28, UG, 8], yaw: P, style: 'vault', startOpen: false, locked: true, auto: false });
m.add({ kind: 'door', id: 'door_thaw_n', name: 'Thaw chamber blast door', position: [16, UG, 12], yaw: 0, style: 'blast', startOpen: false, locked: true, auto: false });
m.add({ kind: 'door', id: 'door_vault_e', name: 'Cryo vault (east)', position: [48, UG, 20], yaw: 0, style: 'blast', startOpen: false, locked: false, auto: true });
m.add({ kind: 'door', id: 'door_warden', name: 'Warden\'s office', position: [48, UG, 12], yaw: 0, startOpen: false, locked: false, auto: true });
m.prop('ammo_stack', [34.6, UG, 11], S).prop('ammo_crate', [34.8, UG, 5.6], -P).prop('sf_chest', [30, UG, 11.2], S);

// The warden's control room (x 36..52, z -4..12).
m.prop('computer_bank', [44, UG, 11.2], S).prop('os_console_corner', [50.6, UG, 10.6], S).prop('holo_table', [44, UG, 4], 0);
m.prop('desk', [40, UG, -1.6], 0).prop('office_chair', [40, UG, -0.6], S).prop('screen_panel', [51.4, UG, 0], -P).prop('os_terminal', [38, UG, 11.4], S);
m.add({ kind: 'button', id: 'btn_warden', name: 'Gate control', position: [51.6, UG + 1.2, 4], yaw: -P, label: 'Raise the force gates', once: false, cooldownSeconds: 30, startEnabled: true });

// Force-field gates (down until the warden raises them): emitters either side of each.
const GATES: { id: string; at: V3; w: number; yaw: number }[] = [
  { id: 'field_gate_w', at: [28, UG, 16], w: 5.4, yaw: P },
  { id: 'field_gate_e', at: [44, UG, 16], w: 5.4, yaw: P },
  { id: 'field_gate_v', at: [32, UG, 20], w: 5.4, yaw: 0 },
  { id: 'field_gate_s', at: [32, UG, -4], w: 3.4, yaw: 0 },
];
for (const g of GATES) {
  m.field(g.at, g.w, 3.4, { yaw: g.yaw, id: g.id, tint: '#7fd8ff', hidden: true });
  const [ox, oz] = g.yaw ? [0, g.w / 2 + 0.45] : [g.w / 2 + 0.45, 0];
  for (const s of [-1, 1]) m.prop('os_field_emitter', [r2(g.at[0] + s * ox), UG, r2(g.at[2] + s * oz)], g.yaw, 1, false);
}
// The corridor and the entry: crates, pipes, signage.
m.prop('os_cargo_crate', [20, UG, 18.6], 0).prop('os_frame_module', [52 - 2, UG, 17.4], 0).prop('jersey_barrier_striped', [32, UG, -14], 0).prop('os_wall_column', [35, UG, -19], 0);

// ---------------------------------------------------------------- the sewer and the Scraps' hideout

m.water([-8, UG, 8], [24, 0.3, 1.6], 'water', '#4a5a3a');
m.water([8, UG, 16], [1.6, 0.3, 24], 'water', '#4a5a3a');
m.water([-32, UG, 24], [1.6, 0.3, 7], 'water', '#4a5a3a');
for (const [x, z] of [[-14, 11], [2, 5], [10, 26]] as const) m.prop('pipe_valve', [x, UG, z], -P);
m.prop('big_pipe', [-6, UG, 11], 0).prop('sv_trashcan_metal', [6, UG, 1]).prop('dumpster', [11, UG, 30.5], P).prop('brick_rubble', [10.5, UG, 22.6], 0.5);
// Hideout dressing that sets the tone (the dress pass adds the rest): fire baskets, a war table, tents.
m.prop('fire_basket', [-28, UG, 12], 0, 0.5).prop('dungeon_table', [-24, UG, 17], 0).prop('tent_canvas', [-34, UG, 6], P).prop('sv_radio', [-23, UG, 17.4], 0, 1, false);
m.prop('hesco_wall', [-22.5, UG, 6], P).prop('sandbag_wall', [-21.5, UG, 14.5], P).prop('camo_net', [-33.5, UG, 17.5], 0);

// ---------------------------------------------------------------- the city: plaza, garden, restaurant, precinct

// Plaza kiosks: polite announcements on a button.
const KIOSKS: { id: string; pos: V3; yaw: number; label: string }[] = [
  { id: 'btn_kiosk_1', pos: [-6, 0, 12], yaw: P, label: 'Hear an announcement' },
  { id: 'btn_kiosk_2', pos: [22, 0, 30], yaw: -P, label: 'Hear an announcement' },
  { id: 'btn_kiosk_3', pos: [8, 0, -6], yaw: 0, label: 'Hear an announcement' },
];
for (const k of KIOSKS) {
  m.prop('nc_holo_kiosk', k.pos, k.yaw);
  m.add({ kind: 'button', id: k.id, name: 'Announcement kiosk', position: [r2(k.pos[0] + Math.sin(k.yaw) * 1.1), 1.2, r2(k.pos[2] + Math.cos(k.yaw) * 1.1)], yaw: k.yaw, label: k.label, once: false, cooldownSeconds: 6, startEnabled: true });
}
// Topiary, hedges and benches round the plaza and along the avenues.
for (const [x, z] of [[-6, 4], [-6, 28], [22, 4], [22, 22], [-14, 44], [-2, 44], [14, 44], [-22, -6], [-30, 4], [36, -6], [52, 44], [-14, 20]] as const) m.prop('ge_topiary', [x, 0, z], 0);
for (const [x, z, yaw] of [[-10, 36], [26, 36], [-26, -12, P], [46, -6, P], [12, -12]] as [number, number, number?][]) m.prop('hedge', [x, 0, z], yaw ?? 0);
for (const [x, z, yaw] of [[2, 30, 0], [14, 30, 0], [-4, 20, P], [20, 12, -P]] as const) m.prop('graveyard_bench', [x, 0, z], yaw);
m.prop('rn_statue_stag', [-14, 0, 28], P).prop('rn_statue_fox', [30, 0, 22], -P);
// The topiary garden (x -4..20, z 52..68): a square fountain, hedge arch, beds.
m.prop('fountain_square', [8, 0, 60], 0).prop('ge_hedge_arch', [8, 0, 52.4], 0).prop('ge_hedge_wall', [1.5, 0, 66.4], 0).prop('ge_hedge_wall', [14.5, 0, 66.4], 0);
for (const [x, z] of [[0, 54], [16, 54], [18.6, 66], [-2.6, 58]] as const) m.prop('ge_topiary', [x, 0, z], 0);
for (const [x, z, f] of [[1, 57, 'flower_purple'], [15, 57, 'flower_red'], [2, 63, 'flower_yellow'], [14, 63, 'flower_purple']] as const) m.prop(f, [x, 0, z], 0, 2, false);
// Street furniture: streetlights round the ring, parasols, planters.
for (const [x, z, yaw] of [[-35, -12, P], [-35, 20, P], [-35, 52, P], [51, 4, -P], [51, 52, -P], [-20, 67, S], [28, 67, S], [-20, -27, 0], [36, -27, 0], [12, -27, 0]] as const) m.prop('nc_streetlight', [x, 0, z], yaw);
for (const [x, z] of [[-10, 44], [-6, 50]] as const) m.prop('parasol', [x, 0, z], 0);
m.prop('hm_potted_palm', [-22, 0, 50], 0).prop('hm_potted_palm', [-2.5, 0, 50], 0).prop('potted_plant', [44.6, 0, 42], 0).prop('potted_plant', [19.4, 0, 42], 0);
// The precinct's forecourt: police barriers (Military pack), a floodlight, a cruiser bay.
m.prop('jersey_barrier', [24, 0, -8], 0).prop('jersey_barrier_striped', [28, 0, -8], 0).prop('road_barrier', [-2, 0, -22], P).prop('floodlight', [22.6, 0, -26], 0).prop('concrete_block', [26, 0, -20]);

// Signs: every place is Chez Serene. Billboards with polite words on the towers.
const SIGNS: [string, string, V3, number, string, [number, number]?][] = [
  ['sign_restaurant', 'CHEZ SERENE', [-12, 4.6, 51.6], S, '#ffb8de', [5, 1]],
  ['sign_shop_w', 'CHEZ SERENE', [-27.6, 5, 0], P, '#c8ffe4', [3.4, 0.8]],
  ['sign_shop_e', 'CHEZ SERENE', [43.6, 5, 24], -P, '#dcd0ff', [3.4, 0.8]],
  ['sign_museum', 'MUSEUM OF ARMS', [32, 4.6, 43.6], S, '#ffe0a8', [5, 1]],
  ['sign_police', 'SERENE CITY POLICE', [12, 4.6, -11.6], 0, '#7fb8ff', [6, 1]],
];
for (const [id, text, pos, yaw, color, size] of SIGNS) m.light(pos, { id, fixture: 'sign', text, color, yaw, intensity: 1.1, range: 8, ...(size ? { size } : {}) });
const BOARDS: [string, string, V3, number, string, [number, number]][] = [
  ['board_nw', 'BE WELL', [-20, 16, 52.4], 0, '#ffc8e4', [9, 4.5]],
  ['board_sw', 'STAY SERENE', [-20, 16, -11.6], 0, '#c8ffe4', [9, 4.5]],
  ['board_se', 'THANK YOU FOR COMPLYING', [44, 16, -11.6], 0, '#dcd0ff', [10, 4]],
];
for (const [id, text, pos, yaw, color, size] of BOARDS) m.light(pos, { id, fixture: 'billboard', text, color, yaw, intensity: 1.4, range: 16, size });

// A welcome at the restaurant door, once a match.
m.add({ kind: 'zone', id: 'zone_restaurant', name: 'Chez Serene', position: [-12, 0, 60], size: [14, 3, 14], who: 'any', count: 1, startEnabled: true });

// ---------------------------------------------------------------- logic

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const wait = (s: number) => act('wait', null, { value: s });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[], o: { once?: boolean } = {}): LogicRule => ({ id, name, enabled: true, once: o.once ?? false, when, if: [], do: does });
const pressed = (target: string) => ({ event: 'button_pressed' as const, target });
const ALARMS = ['lamp_alarm_thaw_w', 'lamp_alarm_thaw_e', 'lamp_alarm_corridor'];
const GATE_IDS = GATES.map((g) => g.id);
const ANNOUNCE = [
  'Serene City welcomes you. Please enjoy a violence-free day. Be well.',
  'Reminder: all restaurants are Chez Serene. Reservations are encouraged.',
  'Public conduct notice: verbal impropriety will be fined one credit. Thank you.',
];
m.logic({
  variables: [],
  timers: [{ id: 'timer_pa', name: 'Public announcement', seconds: 75, loop: true, visible: false }],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome', { event: 'match_start', target: null }, [say('Serene City. Be well. The museum cases are not for touching.', 4), act('timer_start', 'timer_pa'), ...CASES.map((_, i) => act('disable', `pickup_case_${i + 1}`))]),
    rule('rule_pa', 'Public announcement', { event: 'timer_done', target: 'timer_pa' }, [act('sound', null, { state: 'chime' }), say('This is a public announcement: Serene City thanks you for your compliance.', 3)]),
    ...KIOSKS.map((k, i) => rule(`rule_kiosk_${i + 1}`, `Kiosk ${i + 1}`, pressed(k.id), [act('sound', null, { state: 'chime' }), say(ANNOUNCE[i]!, 4)])),
    ...CASES.map((_, i) =>
      rule(`rule_case_${i + 1}`, `Display case ${i + 1} broken`, { event: 'destroyed', target: `case_${i + 1}` }, [act('enable', `pickup_case_${i + 1}`), act('sound', null, { state: 'buzzer' }), say('Vandalism is a civic violation. A fine has been issued.', 2)]),
    ),
    rule('rule_restaurant', 'Chez Serene', { event: 'zone_enter', target: 'zone_restaurant' }, [say('Welcome to Chez Serene. Every restaurant is Chez Serene.', 3)], { once: true }),
    rule('rule_thaw', 'Thaw an inmate', pressed('btn_thaw'), [
      act('disable', 'btn_thaw'),
      act('sound', null, { state: 'alarm' }),
      say('THAW CYCLE ENGAGED. An inmate is loose: the weapon cache and the blast door are open!', 4),
      act('light_flash', 'lamp_thaw_pod', { value: 2 }),
      act('block_drop', 'pod_thaw_glass'),
      ...GATE_IDS.map((id) => act('block_drop', id)),
      wait(25),
      act('block_restore', 'pod_thaw_glass'),
      say('The prison is secure. Thank you for your patience.', 2),
      wait(20),
      act('enable', 'btn_thaw'),
    ]),
    rule('rule_thaw_alarms', 'Thaw: alarms', pressed('btn_thaw'), [
      ...ALARMS.flatMap((id) => [act('light_on', id), act('light_blink', id, { value: 3, state: 'on' })]),
      wait(25),
      ...ALARMS.flatMap((id) => [act('light_blink', id, { value: 0, state: 'off' }), act('light_off', id)]),
    ]),
    rule('rule_thaw_doors', 'Thaw: doors and cache', pressed('btn_thaw'), [
      ...['door_cache', 'door_thaw_n'].flatMap((d) => [act('door_unlock', d), act('door_open', d)]),
      wait(25),
      ...['door_cache', 'door_thaw_n'].flatMap((d) => [act('door_close', d), act('door_lock', d)]),
    ]),
    rule('rule_gates', 'Raise the force gates', pressed('btn_warden'), [
      act('sound', null, { state: 'buzzer' }),
      say('Cell-block force gates raised for 10 seconds.', 2),
      ...GATE_IDS.map((id) => act('block_restore', id)),
      act('light_on', 'lamp_alarm_corridor'),
      wait(10),
      ...GATE_IDS.map((id) => act('block_drop', id)),
      act('light_off', 'lamp_alarm_corridor'),
    ]),
  ],
});

// ---------------------------------------------------------------- objectives

// Hostage Rescue: the frozen scientist waits by her open pod in the vault; the Scraps bring her to the hideout.
m.hostage([41, UG, 40], S);
m.rescue([-24, UG, 8], 4);
// Bomb: the warden's control room (A, the cryo control) and the museum (B).
m.add({ kind: 'bombsite', position: [44, UG, 6], label: 'A', radius: 4 });
m.add({ kind: 'bombsite', position: [32, 0, 56], label: 'B', radius: 4 });
// Capture the Flag: the city plaza (Police) against the underground hideout (Scraps).
m.flag(POLICE, [8, 0, 28], S);
m.flag(SCRAPS, [-32, UG, 15], 0);
// King of the Hill: the thaw chamber, the museum, the plaza.
m.hill([21, UG, 5], 4).hill([32, 0, 56], 5).hill([8, 0, 12], 5);

// ---------------------------------------------------------------- spawns

// Scraps: the hideout and the sewer.
for (const [p, yaw] of [
  [[-33, UG, 10], P], [[-29, UG, 6], P], [[-25, UG, 12], P], [[-30, UG, 19], P], [[-26, UG, 15.6], S], [[-34, UG, 13], P],
  [[-16, UG, 6], P], [[-8, UG, 5.5], P], [[0, UG, 10], P], [[-32, UG, 26], 0], [[6, UG, 6], 0], [[-30, UG, 22], S],
] as [V3, number][]) m.spawn(p, yaw, SCRAPS);
// Police: the precinct, its forecourt and the prison entry.
for (const [p, yaw] of [
  [[8, 0, -24], 0], [[12, 0, -24], 0], [[16, 0, -24], 0], [[8, 0, -17], 0], [[16, 0, -17], 0], [[12, 0, -20.5], 0],
  [[4, 0, -8], 0], [[12, 0, -6], 0], [[20, 0, -5], 0], [[30, UG, -16], 0], [[34, UG, -9], 0], [[30, UG, -7], 0],
] as [V3, number][]) m.spawn(p, yaw, POLICE);
// Everyone else (free-for-all): all over the city and below it.
for (const [p, yaw] of [
  [[-28, 0, 44], P], [[-30, 0, 12], 0], [[-14, 0, 4], 0], [[-22, 0, 28], P], [[2, 0, 48], 0], [[28, 0, 30], -P],
  [[44, 0, 8], -P], [[48, 0, 36], S], [[18, 0, 62], -P], [[-12, 0, 58], 0], [[32, 0, 54], S], [[-30, 0, -10], 0],
  [[16, UG, 30], 0], [[44, UG, 30], S], [[16, UG, 16], P], [[20, UG, 2], 0], [[40, UG, 2], 0], [[8, UG, 24], S],
] as [V3, number][]) m.spawn(p, yaw);

// ---------------------------------------------------------------- pickups

// The weapon cache: the freeze ray, rockets and heavy armour (open only while a thaw runs).
m.pickup('weapon_freeze_ray', [32, UG, 9]).pickup('weapon_rockets', [32, UG, 6]).pickup('armor_large', [34.5, UG, 8]).pickup('ammo_explosive', [30, UG, 6]);
// The prison.
m.pickup('weapon_lmg', [48, UG, 1]).pickup('ammo_rifle', [38, UG, 2]).pickup('weapon_plasma', [26, UG, 33]).pickup('ammo_cells', [14, UG, 24]);
m.pickup('weapon_smg', [40, UG, 16]).pickup('health_large', [33, UG, 32]).pickup('health_small', [24, UG, 16]).pickup('grenades', [14, UG, 10]);
m.pickup('armor_small', [46, UG, 42]).pickup('health_small', [28, UG, -1]).pickup('ammo_light', [32, UG, -16]).pickup('health_small', [32, UG, -8]);
// The sewer and the hideout: scavenged gear.
m.pickup('weapon_shotgun', [-21.5, UG, 10]).pickup('weapon_nailgun', [-4, UG, 6]).pickup('ammo_shells', [-35, UG, 18]).pickup('health_large', [-35, UG, 7]);
m.pickup('ammo', [8, UG, 2]).pickup('health_small', [8, UG, 28]).pickup('armor_small', [-30, UG, 26]).pickup('grenades', [-12, UG, 10]);
// The surface.
m.pickup('weapon_sniper', [-28, DECK, 36.5]).pickup('ammo_sniper', [44, DECK, 36.5]);
m.pickup('weapon_rifle', [8, 0, 20]).pickup('weapon_burst_rifle', [-12, 0, 28]).pickup('weapon_auto_shotgun', [17, 0, 60]).pickup('weapon_smg', [-12, 0, 62]);
m.pickup('weapon_railgun', [8, 0, 70.5]).pickup('ammo_cells', [-30, 0, 70]).pickup('weapon_rifle', [12, 0, -21]).pickup('ammo_rifle', [4, 0, -14]);
m.pickup('armor_large', [36, 0, 26]).pickup('powerup_damage', [8, 0, 36], 90);
m.pickup('ammo_rifle', [-20, 0, 12]).pickup('ammo_shells', [28, 0, 12]).pickup('ammo_light', [44, 0, 60]).pickup('ammo', [-28, 0, 48]).pickup('grenades', [20, 0, -4]);
for (const p of [[-38, 0, 30], [54, 0, 20], [8, 0, -30], [8, 0, 74], [-28, 0, -4], [44, 0, -2], [24, 0, 52], [-6, 0, 36], [36, 0, 64]] as V3[]) m.pickup('health_small', p);
m.pickup('armor_small', [-20, 0, -20]).pickup('armor_small', [52, 0, 64]).pickup('health_large', [-6, 0, 22]);

// ---------------------------------------------------------------- room dressing

m.dress([-2, 7, 0], 'dining', { density: 'normal' });
m.dress([1, -3, 0], 'office', { density: 'sparse' });
m.dress([-4, 1, -1], 'barracks', { density: 'sparse' });

// ---------------------------------------------------------------- light: soft pastels up top, cold blue below, amber in the sewer

const light = m.light.bind(m);
// The plaza and the avenues: pastel lamps.
for (const [x, z, c] of [[0, 16, '#ffc8dc'], [16, 16, '#c8ffe4'], [0, 32, '#dcd0ff'], [16, 32, '#ffe0c0']] as const) light([x, 4.5, z], { fixture: 'none', color: c, intensity: 0.9, range: 14 });
light([8, 3, 60], { fixture: 'none', color: '#c8ffe4', intensity: 0.8, range: 12 });
// Under the guideway.
for (const x of [-16, 24]) light([x, DECK - 0.9, GZ], { fixture: 'strip', color: '#bfefff', intensity: 0.8, range: 10, yaw: 0 });
// Interiors.
for (const z of [56, 64]) light([-12, 3.4, z], { fixture: 'chandelier', color: '#ffe0c8', intensity: 1, range: 10 });
for (const [x, z] of [[25, 50], [39, 50], [25, 62], [39, 62]] as const) light([x, 3.5, z], { fixture: 'ceiling', color: '#fff4e0', intensity: 0.9, range: 9 });
for (const x of [8, 16]) light([x, 3.45, -20], { fixture: 'ceiling', color: '#e8f2ff', intensity: 1, range: 10 });
// The sewer and the hideout.
for (const [x, z] of [[-32, 8], [-24, 16]] as const) light([x, UG + 3.2, z], { fixture: 'bulb', color: '#ffb066', intensity: 0.7, range: 10 });
light([-28, UG + 1.2, 12], { fixture: 'none', color: '#ff8a3a', intensity: 1.1, range: 8, blink: 0 });
for (const [x, z] of [[-32, 24], [-16, 8], [0, 8], [8, 0], [8, 20]] as const) light([x, UG + 3.3, z], { fixture: 'bulb', color: '#ffb066', intensity: 0.55, range: 9 });
for (const [x, y, z] of [[-32, UG + 3.4, 32], [-8, UG + 3.4, 0], [24, UG + 3.4, -16]] as const) light([x, y + 4, z], { fixture: 'bulb', color: '#f0f4ff', intensity: 0.6, range: 8 });
// The prison: cold white and blue.
for (const [x, z] of [[32, -16], [32, -8], [32, 0], [32, 8]] as const) light([x, UG + 3.45, z], { fixture: 'ceiling', color: '#e8f6ff', intensity: 0.9, range: 9 });
for (const x of [16, 32, 48]) light([x, UG + 3.4, 16], { fixture: 'strip', color: '#cfeeff', intensity: 0.9, range: 10, yaw: P });
for (const [x, z] of [[16, 4], [24, 4]] as const) light([x, UG + 3.45, z], { fixture: 'ceiling', color: '#f4f8ff', intensity: 0.9, range: 10 });
light([20, UG + 2.2, -1.6], { id: 'lamp_thaw_pod', fixture: 'none', color: '#9fe8ff', intensity: 1, range: 6 });
light([13, UG + 3.2, 11.6], { id: 'lamp_alarm_thaw_w', fixture: 'wall', color: '#ff3020', intensity: 1.3, range: 12, yaw: S, off: true });
light([27, UG + 3.2, -3.6], { id: 'lamp_alarm_thaw_e', fixture: 'wall', color: '#ff3020', intensity: 1.3, range: 12, yaw: 0, off: true });
light([24, UG + 3.2, 19.6], { id: 'lamp_alarm_corridor', fixture: 'wall', color: '#ff3020', intensity: 1.2, range: 14, yaw: S, off: true });
for (const [x, z] of [[40, 0], [48, 8]] as const) light([x, UG + 3.45, z], { fixture: 'ceiling', color: '#dfeaff', intensity: 0.8, range: 9 });
for (const [x, z] of [[16, 28], [24, 28]] as const) light([x, UG + 3.3, z], { fixture: 'none', color: '#bfe8ff', intensity: 1, range: 10 });
for (const [x, z] of [[35, 23], [47, 23], [35, 32], [47, 32], [35, 41], [47, 41]] as const) light([x, UG + 3.3, z], { fixture: 'none', color: '#5ad8ff', intensity: 1, range: 9 });
light([32, UG + 3.45, 8], { fixture: 'bulb', color: '#ffd8a0', intensity: 0.7, range: 7 });

m.bounds('invisible', 0, { min: [-44, -36], max: [60, 76] }, 40);
m.border('skyline');
m.meta({
  description:
    'A spotless utopian city of 2032 over a maximum-security cryo-prison. Up top: white plazas in soft pastel light, topiary, glass towers, Chez Serene (every restaurant is Chez Serene), polite announcement kiosks, a Museum of Arms whose display cases you shoot open for the exhibits, a maglev shuttling 8 m over the avenue, and self-driving pod cars lapping the ring road whatever is going on. Below: the Scraps\' grimy sewer hideout breaks into the prison: the cryo vault\'s frosted pods, the frozen hall, force-field gates the warden can raise, and the thaw chamber, whose console sets the alarms off, opens a pod and unlocks the freeze-ray cache. Hostage Rescue: bring the frozen scientist from the vault to the hideout. Bomb: the cryo control room and the museum.',
  modes: ['core.hostage', 'core.bomb', 'core.tdm', 'core.ctf', 'core.koth', 'core.deathmatch'],
  players: [12, 24],
});
await m.save();
