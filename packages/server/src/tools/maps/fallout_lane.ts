/**
 * Fallout Lane: a tiny 1950s street on an atomic test range in the desert
 * (our own map; the picker credits its inspiration separately). Two houses
 * face each other across the lane: the yellow two-storey house north, the
 * teal bungalow with its garage south. A school bus and a box truck stand
 * in the street, the lane ends in a turning circle east and a road block
 * west, and test towers stand out in the desert. Tight and fast, 6–12
 * players: deathmatch, team deathmatch, King of the Hill and Capture the
 * Flag. The layout is point-symmetric about the middle of the street.
 *
 * - The classic spawns: Embers in the north back yard, Tide in the south.
 *   Each back yard is fenced, with a gate at each end into the side yards
 *   and a back door into its house.
 * - The yellow house: living room, foyer, kitchen (the Embers flag), dining
 *   room and laundry downstairs; three bedrooms and a bathroom upstairs,
 *   windows on the street (the marksman rifle in the master bedroom).
 * - The teal bungalow: living room (the Tide flag), kitchen, two bedrooms
 *   and a back hall, the garage with its car; a ladder at the back of the
 *   garage climbs to the flat roof (the LMG), the other high ground.
 * - Side alleys round both ends: a narrow one beside each house and a wide
 *   side yard beyond it (carport and shed north-east, playground south-west).
 * - The street: picket fences and lawns, the bus and truck in the middle
 *   (armour between them), shop-window mannequins all over (shoot them to
 *   bits; they come back). Every pane of glass breaks.
 * - The test: nine minutes in, a siren and a 30 s countdown on the HUD, then
 *   the bomb goes off out on the range: booms, a message, and the shock wave
 *   blows in every window on the street. It hurts nobody.
 *
 * Grid x east, y north (one cell = 8 m; levels z0 and z1).
 *
 *   y5   .  .  .  .  .  .  .  .  .       north back yard (Embers spawns)
 *   y4   .  .  D  s  L  .  .  .  .       D dining, s stairs, L laundry; upstairs: bath, stairs, landing
 *   y3   .  .  V  F  K  .  c  .  .       V living, F foyer, K kitchen (flag); upstairs: three bedrooms; c carport
 *   y2   .  .  .  .  .  .  .  .  ( )     lawns
 *   y1   .  .  .  .  .  .  .  .  ( )     ( ) turning circle
 *   y0   X  =  =  =  B  =  T  =  ( )     the lane: X road block, B bus, T truck
 *   y-1  .  .  .  .  .  .  .  .  ( )
 *   y-2  .  .  .  .  .  .  .  .  .
 *   y-3  .  .  p  .  V  K  G  .  .       V living (flag), K kitchen, G garage; p playground
 *   y-4  .  .  .  .  b  h  G  .  .       b bedroom, h back hall and bath
 *   y-5  .  .  .  .  .  .  .  .  .       south back yard (Tide spawns)
 *       -4 -3 -2 -1  0  1  2  3  4
 */
import { TERRAIN_MATERIALS, newTerrain, terrainHeightAt, type EdgeStyle, type LogicAction, type LogicRule, type RoomOptions, type Side, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('fallout_lane', 'Fallout Lane');
m.theme('garden');
m.backdrop('clear', 'mesas', 'sand', 0.3);
m.teams([6, 6]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const PI = Math.PI;
type V3 = [number, number, number];
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [x * 8 + dx, z * 4 + up, y * 8 + dy];
const r2 = (n: number) => +n.toFixed(2);
/** Turn a local (x, z) offset by `yaw` (as boxes and props turn). */
const turn = (x: number, z: number, yaw: number): [number, number] => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
/** The lots' ground (the terrain sits 15 cm under the floors). */
const G = -0.15;
/** The lots (fenced all round); the boundary itself runs out past the test towers, so they stand inside it. */
const LOTS = { min: [-36, -46] as [number, number], max: [36, 46] as [number, number] };
const BOUNDS = { min: [-116, -116] as [number, number], max: [116, 116] as [number, number] };

// ---------------------------------------------------------------- surfaces

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const YELLOW = '#e9cd6c';
const TEAL = '#86c4b4';
const house = (wall: string, floor: string, floorTint: string | null = null): TileSurfaces => ({ walls: mat('pbr_plaster_white', wall), floor: mat(floor, floorTint), solids: mat('pbr_walnut'), trim: mat('pbr_plaster_white', '#f6f2e6') });
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
const ROOF: RoomOptions = { ceiling: 'roof', corners: 'posts' };
/** Windows with glass in them (the test blows them all in). */
const PANES: string[] = [];
function room(x: number, y: number, z: number, surf: TileSurfaces, sides: Partial<Record<Side, EdgeStyle>>, opts?: RoomOptions): void {
  m.tile('room', x, y, z, 0, opts);
  paint(x, y, z, surf);
  for (const [side, style] of Object.entries(sides) as [Side, EdgeStyle][]) {
    m.edge(x, y, z, side, style);
    if (style !== 'window') continue;
    const [dx, dy] = { N: [0, 4], S: [0, -4], E: [4, 0], W: [-4, 0] }[side];
    const id = `pane_${String(PANES.length + 1).padStart(2, '0')}`;
    PANES.push(id);
    m.add({ kind: 'destructible', id, name: 'Window pane', model: 'glass', position: at(x, y, z, dx, dy), yaw: side === 'N' || side === 'S' ? 0 : P, health: null, explosiveOnly: false });
  }
}

// ---------------------------------------------------------------- the yellow house (north, two storeys)

const N_LIVING = house(YELLOW, 'pbr_floorboards');
const N_KITCHEN = house(YELLOW, 'pbr_checker');
const N_BATH = house(YELLOW, 'white_tiles');
const N_BED = house(YELLOW, 'pbr_carpet', '#7a6a8a');
// Ground floor.
room(-2, 3, 0, N_LIVING, { S: 'window', W: 'window', E: 'arch', N: 'door' });
room(-1, 3, 0, N_LIVING, { S: 'door', E: 'door' });
room(0, 3, 0, N_KITCHEN, { S: 'window', E: 'door', N: 'door' });
room(-2, 4, 0, N_LIVING, { W: 'window', N: 'window' });
m.tile('stairs', -1, 4, 0, 0); // up from the dining room (west) to the landing (east)
paint(-1, 4, 0, N_LIVING);
room(0, 4, 0, N_KITCHEN, { N: 'door', E: 'window' });
// Upstairs.
room(-2, 3, 1, N_BED, { S: 'window', W: 'window', E: 'door', N: 'door' }, ROOF);
room(-1, 3, 1, N_BED, { S: 'window', E: 'door' }, ROOF);
room(0, 3, 1, N_BED, { S: 'window', E: 'window', N: 'door' }, ROOF);
room(-2, 4, 1, N_BATH, { N: 'window' }, ROOF);
room(0, 4, 1, N_LIVING, { N: 'window', E: 'window' }, ROOF);

// ---------------------------------------------------------------- the teal bungalow and its garage (south, one storey)

const S_LIVING = house(TEAL, 'pbr_floorboards', '#b08a64');
const S_KITCHEN = house(TEAL, 'pbr_delft');
const S_BED = house(TEAL, 'pbr_carpet', '#5a7a8a');
const GARAGE = house(TEAL, 'pbr_concrete', '#9a968c');
room(0, -3, 0, S_LIVING, { N: 'door', W: 'window', E: 'arch', S: 'door' }, ROOF);
room(1, -3, 0, S_KITCHEN, { N: 'window', E: 'door', S: 'door' }, ROOF);
room(0, -4, 0, S_BED, { W: 'window', S: 'window', E: 'door' }, ROOF);
room(1, -4, 0, S_BED, { S: 'door', E: 'wall' }, ROOF);
room(2, -3, 0, GARAGE, { N: 'wide', E: 'window', S: 'open' }, ROOF);
room(2, -4, 0, GARAGE, { S: 'door', E: 'window' }, ROOF);

// Roofs: a dark overhanging cap on each (the bungalow's is walkable, by the ladder at the back of the garage).
const ROOFING = { material: 'pbr_roof', tint: '#6a5a4c' };
m.block([-8, 8, 28], [25, 0.15, 17], 'solid', ROOFING);
m.block([8, 4, -28], [24, 0.15, 16], 'solid', ROOFING); // flush, so the ladder clears it
m.add({ kind: 'ladder', position: [20.25, 0, -28], yaw: P, height: 4.4, width: 0.9 });
// On the bungalow roof: a chimney and an air conditioner to hide behind.
m.block([1.5, 4.15, -26], [1.2, 1.6, 1.2], 'solid', { material: 'pbr_brick_red' });
m.block([10, 4.15, -31], [1.6, 1, 1.2], 'solid', { material: 'pbr_steel', tint: '#c8ccc8' });
m.block([-4, 8.15, 31], [1.2, 1.8, 1.2], 'solid', { material: 'pbr_brick_red' });

// ---------------------------------------------------------------- the street, paths and fences (free blocks on flat ground)

const ASPHALT = { material: 'pbr_asphalt', tint: '#4a4a4e' };
const PAVE = { material: 'pbr_concrete', tint: '#c4beb0' };
const slab = (x0: number, z0: number, x1: number, z1: number, look: { material: string; tint: string }, top = 0) => m.block([(x0 + x1) / 2, top - 0.2, (z0 + z1) / 2], [x1 - x0, 0.2, z1 - z0], 'solid', look);
slab(-36, -4.5, 20, 4.5, ASPHALT);
// The turning circle at the east end, round a planted island.
slab(20, -14, 36, 14, ASPHALT);
for (let i = 0; i < 4; i++) m.block([28, -0.2, 0], [6.2, 0.45, 2.6], 'solid', { material: 'pbr_concrete', tint: '#b8b0a0', yaw: (i * PI) / 4 });
for (let i = 0; i < 4; i++) m.block([28, -0.2, 0], [5.6, 0.5, 2.3], 'solid', { material: 'pbr_grass', yaw: (i * PI) / 4 });
// Sidewalks, front paths and the driveways.
slab(-36, 4.5, 20, 6, PAVE, 0.1);
slab(-20, -6, 36, -4.5, PAVE, 0.1);
slab(-9.5, 6, -6.5, 20, PAVE, 0.08); // north front path
slab(6.5, -20, 9.5, -6, PAVE, 0.08); // south front path
slab(12.5, -20, 19.5, -6, PAVE, 0.08); // south driveway into the garage
slab(10, 6, 18, 30, PAVE, 0.08); // north driveway to the carport

const WOOD = { material: 'pbr_planks', tint: '#8a6a48' };
const PICKET = { material: 'pbr_planks', tint: '#f0ece0' };
/** A fence from (x0, z0) to (x1, z1) (straight along x or z), `h` high, leaving `gaps` (centre, width) open. */
function fence(x0: number, z0: number, x1: number, z1: number, h: number, look: { material: string; tint: string }, gaps: [number, number][] = []): void {
  const alongX = z0 === z1;
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1);
  const a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
  let from = a0;
  const cuts = [...gaps.map(([c, w]) => [c - w / 2, c + w / 2] as const), [a1, a1] as const].sort((p, q) => p[0] - q[0]);
  for (const [g0, g1] of cuts) {
    // Runs of at most 36 m (a free block is 64 m at most).
    const n = Math.ceil((g0 - from) / 36);
    for (let i = 0; i < n && g0 > from + 0.2; i++) {
      const u0 = from + ((g0 - from) * i) / n;
      const u1 = from + ((g0 - from) * (i + 1)) / n;
      const mid = r2((u0 + u1) / 2);
      m.block(alongX ? [mid, G, z0] : [x0, G, mid], alongX ? [r2(u1 - u0), h - G, 0.2] : [0.2, h - G, r2(u1 - u0)], 'solid', look);
    }
    from = Math.max(from, g1);
  }
}
// Back yards: tall board fences along the back, and from each house's side to the edge, a gate in each.
// The perimeter is a 2.6 m board fence: higher than anyone can jump, even from the yard furniture.
fence(-36, 45.8, 36, 45.8, 2.6, WOOD);
fence(-36, -45.8, 36, -45.8, 2.6, WOOD);
fence(-36, 36, -20, 36, 1.7, WOOD, [[-28, 3]]);
fence(4, 36, 36, 36, 1.7, WOOD, [[10, 3], [30, 3]]);
fence(-36, -36, -4, -36, 1.7, WOOD, [[-10, 3], [-30, 3]]);
fence(20, -36, 36, -36, 1.7, WOOD, [[28, 3]]);
// Front: knee-high pickets along the sidewalks (hop them, or use the gaps at the paths and drives).
fence(-34, 6.3, 20, 6.3, 0.9, PICKET, [[-8, 3], [14, 8.4], [-26, 3]]);
fence(-20, -6.3, 34, -6.3, 0.9, PICKET, [[8, 3], [16, 7.4], [26, 3]]);
// Sides: the same board fence along the desert edge.
for (const x of [-35.8, 35.8]) fence(x, -45.8, x, 45.8, 2.6, WOOD);

// ---------------------------------------------------------------- the bus, the truck, the cars

const PAINT = (tint: string) => ({ material: 'paint_gloss', tint });
const TYRE = { material: 'pbr_steel', tint: '#232323' };
const GLASS_DARK = { material: 'paint_gloss', tint: '#26323a' };
/** A box of a vehicle: centre (cx, cz) turned `yaw`; local offset (lx, lz), base `y`, size [along, height, across]. */
function part(cx: number, cz: number, yaw: number, lx: number, lz: number, y: number, size: V3, look: { material: string; tint: string }, behaviour: 'solid' | 'breakable' = 'solid'): void {
  const [ox, oz] = turn(lx, lz, yaw);
  m.block([r2(cx + ox), r2(y), r2(cz + oz)], size, behaviour, { ...look, yaw: r2(yaw), ...(behaviour === 'breakable' ? { health: 40, respawn: 30 } : {}) });
}
/** The school bus: lower body, pillars between the windows (shoot through), roof, bonnet and wheels. */
function bus(cx: number, cz: number, yaw: number): void {
  const Y = PAINT('#e8b52a');
  for (const lx of [-3.4, 3.2]) for (const lz of [-1.1, 1.1]) part(cx, cz, yaw, lx, lz, 0, [1.1, 0.75, 0.4], TYRE);
  part(cx, cz, yaw, 0, 0, 0.45, [10, 1.05, 2.6], Y);
  part(cx, cz, yaw, 0, 0, 1.45, [10.04, 0.12, 2.64], PAINT('#1c1c1c'));
  for (let i = 0; i <= 8; i++) part(cx, cz, yaw, -4.85 + i * 1.2, 0, 1.5, [0.22, 1.05, 2.6], Y);
  part(cx, cz, yaw, 0.1, 0, 2.55, [10.2, 0.35, 2.7], Y);
  part(cx, cz, yaw, 5.6, 0, 0.45, [1.4, 1.15, 2.4], Y); // bonnet
  part(cx, cz, yaw, 5.05, 0, 1.6, [0.2, 0.85, 2.3], GLASS_DARK); // windscreen behind the bonnet
  part(cx, cz, yaw, -5.03, 0, 1.6, [0.2, 0.8, 2.2], GLASS_DARK);
}
/** A box truck: cab, box, wheels. */
function truck(cx: number, cz: number, yaw: number): void {
  for (const lx of [-2.4, 2.8]) for (const lz of [-1.05, 1.05]) part(cx, cz, yaw, lx, lz, 0, [1.1, 0.95, 0.4], TYRE);
  part(cx, cz, yaw, -1, 0, 0.75, [6.2, 2.7, 2.5], { material: 'pbr_white_panel', tint: '#e8e4da' });
  part(cx, cz, yaw, 3.3, 0, 0.45, [2.2, 1.35, 2.4], PAINT('#a8382c'));
  part(cx, cz, yaw, 3.1, 0, 1.8, [1.8, 0.95, 2.36], GLASS_DARK);
  part(cx, cz, yaw, 3.15, 0, 2.75, [1.9, 0.15, 2.4], PAINT('#a8382c'));
}
/** A 1950s car with fins. */
function car(cx: number, cz: number, yaw: number, tint: string): void {
  for (const lx of [-1.5, 1.5]) for (const lz of [-0.85, 0.85]) part(cx, cz, yaw, lx, lz, 0, [0.75, 0.6, 0.3], TYRE);
  part(cx, cz, yaw, 0, 0, 0.3, [4.8, 0.65, 2], PAINT(tint));
  part(cx, cz, yaw, -0.3, 0, 0.95, [2.3, 0.55, 1.8], GLASS_DARK);
  part(cx, cz, yaw, -0.3, 0, 1.5, [2.4, 0.1, 1.85], PAINT('#f2efe6'));
  for (const lz of [-0.8, 0.8]) part(cx, cz, yaw, -2.2, lz, 0.95, [0.6, 0.25, 0.2], PAINT(tint));
}
bus(-3, 0.4, 0.18);
truck(15, -0.8, -0.32);
car(14, 25, PI / 2, '#d0574a'); // under the carport
car(16, -29, P, '#6a8ab8'); // in the garage
car(-28, -1.8, -0.06, '#8fb88a'); // by the road block

// The carport (north-east side yard): four posts and a flat roof.
for (const [x, z] of [[10.4, 20.4], [17.6, 20.4], [10.4, 29.6], [17.6, 29.6]] as const) m.block([x, G, z], [0.3, 3.15, 0.3], 'solid', { material: 'pbr_steel', tint: '#e8e4da' });
m.block([14, 3, 25], [8.4, 0.2, 10.4], 'solid', { material: 'pbr_corrugated', tint: '#9ab0a8' });
// The tool shed (north-east corner) and the playhouse (south-west), both solid cover.
m.block([30, G, 28], [4, 2.75, 3], 'solid', { material: 'pbr_planks', tint: '#a0603a' });
m.block([30, 2.6, 28], [4.6, 0.2, 3.6], 'solid', ROOFING);
m.block([-30, G, -28], [3, 2.35, 3], 'solid', { material: 'pbr_planks', tint: '#d06a6a' });
m.block([-30, 2.2, -28], [3.6, 0.2, 3.6], 'solid', ROOFING);
// The road block at the west end: barriers and a sandbag line.
m.block([-34, -0.2, 0], [0.9, 1.2, 7], 'solid', { material: 'pbr_canvas', tint: '#9a8c66' });

// ---------------------------------------------------------------- mannequins (shoot them apart; they come back)

/** A shop-window mannequin standing at (x, z) facing `yaw`: legs, body, arms, head as breakable blocks. */
function mannequin(x: number, z: number, yaw: number, cloth: string, y = 0): void {
  const SKIN = { material: 'paint_matte', tint: '#e2cfb4' };
  const CLOTH = { material: 'paint_matte', tint: cloth };
  part(x, z, yaw, 0, 0, y, [0.38, 0.88, 0.22], CLOTH, 'breakable');
  part(x, z, yaw, 0, 0, y + 0.9, [0.46, 0.62, 0.26], CLOTH, 'breakable');
  part(x, z, yaw, 0, 0, y + 1.26, [0.86, 0.2, 0.2], SKIN, 'breakable');
  part(x, z, yaw, 0, 0, y + 1.56, [0.22, 0.27, 0.22], SKIN, 'breakable');
}
mannequin(-12, 13, 0.3, '#c04040', G);
mannequin(-10.5, 14.2, -0.2, '#4a6ab0', G);
mannequin(12, -13, PI + 0.3, '#3a8a5a', G);
mannequin(10.5, -14.2, PI - 0.2, '#b07a3a', G);
mannequin(-10.5, 25.5, PI, '#7a4a8a'); // the foyer
mannequin(2.6, -26.6, 0, '#8a3a4a'); // the bungalow living room
mannequin(-24, 7.4, P, '#5a5a5a', G); // at the bus stop
mannequin(24, -7.6, -P, '#2a4a6a');
mannequin(2.5, 22, -2.4, '#d08a3a', 4); // upstairs, kid's room
mannequin(-18, -22, 0.8, '#3a7a8a', G); // in the playground

// ---------------------------------------------------------------- scenario: the test

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const wait = (s: number) => act('wait', null, { value: s });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[], once = false): LogicRule => ({ id, name, enabled: true, once, when, if: [], do: does });
m.logic({
  variables: [],
  timers: [
    { id: 'timer_test_due', name: 'Test due', seconds: 540, loop: false, visible: false },
    { id: 'timer_test', name: 'Atomic test', seconds: 30, loop: false, visible: true },
  ],
  objectives: [],
  rules: [
    rule('rule_test_schedule', 'The test is scheduled', { event: 'match_start', target: null }, [act('timer_start', 'timer_test_due'), say('Welcome to Fallout Lane. The range is testing today: keep away from the windows.', 5)], true),
    rule('rule_test_siren', 'Test: siren and countdown', { event: 'timer_done', target: 'timer_test_due' }, [
      act('timer_start', 'timer_test'),
      act('sound', null, { state: 'alarm' }),
      say('ATTENTION: atomic test on the range in 30 seconds. This is not a drill.', 5),
      wait(10),
      act('sound', null, { state: 'alarm' }),
      say('Test in 20 seconds.', 3),
      wait(10),
      act('sound', null, { state: 'alarm' }),
      say('Test in 10 seconds. Duck and cover!', 3),
      wait(7),
      act('sound', null, { state: 'buzzer' }),
    ], true),
    rule('rule_test_blast', 'Test: the shock wave (no damage)', { event: 'timer_done', target: 'timer_test' }, [
      act('sound', null, { state: 'boom' }),
      say('DETONATION. Shock wave inbound!', 4),
      wait(1.5),
      act('sound', null, { state: 'boom' }),
      ...PANES.map((id) => act('destroy', id)),
      wait(1),
      act('sound', null, { state: 'boom' }),
      wait(3),
      say('The test is over. Every window on the street is gone.', 4),
    ], true),
  ],
});

// ---------------------------------------------------------------- furniture (Home kit), room by room

/** Furniture in cell (cx, cy) on level z at local (lx, lz), facing yaw (0 faces north). */
const put = (model: string, cx: number, cy: number, z: number, lx: number, lz: number, yaw = 0, solid = true, up = 0) => m.prop(model, at(cx, cy, z, lx, lz, up), r2(yaw), 1, solid);
// Yellow house, living room: sofa and armchairs round a rug, the television by the west window, a fireplace.
put('hm_rug_round', -2, 3, 0, -0.8, 0.8, 0, false);
put('hm_couch', -2, 3, 0, 1.2, 1.2, -P);
put('hm_armchair', -2, 3, 0, -1.8, -2.2, -0.5);
put('tv_cabinet', -2, 3, 0, -3.5, 2.4, P);
put('tv', -2, 3, 0, -3.5, 2.4, P, true, 0.6);
put('hm_floor_lamp', -2, 3, 0, -3.3, -3.3);
put('hm_houseplant_tall', -2, 3, 0, 3.2, -3.2);
// Foyer: coat rack and a side table.
put('coat_rack', -1, 3, 0, 3.1, -3.1);
put('hm_side_table', -1, 3, 0, -2.6, 3.3);
put('hm_houseplant', -1, 3, 0, 2.8, 3.2);
// Kitchen: oven, sink and cabinets along the front, the fridge in the corner, a dinette.
put('hm_oven', 0, 3, 0, -2.2, -3.4);
put('hm_kitchen_counter', 0, 3, 0, -2.85, -3.4);
put('hm_kitchen_sink', 0, 3, 0, 2.1, -3.4);
put('hm_kitchen_counter', 0, 3, 0, 2.7, -3.4);
put('hm_kitchen_cabinet', 0, 3, 0, 3.0, 3.0, -P);
put('hm_fridge', 0, 3, 0, -3.3, 3.2, P);
put('hm_table_round', 0, 3, 0, 0, 0.2);
for (const [lx, lz, yaw] of [[-1.75, 0.2, P], [1.75, 0.2, -P]] as const) put('hm_chair_wood', 0, 3, 0, lx, lz, yaw);
// Dining room: the long table and a bookcase.
put('table_cloth', -2, 4, 0, -0.5, 0, 0);
for (const [lx, lz, yaw] of [[-1.4, -1.2, 0], [-1.4, 1.2, PI], [0.4, -1.2, 0], [0.4, 1.2, PI]] as const) put('hm_chair_wood', -2, 4, 0, lx, lz, yaw);
put('hm_bookshelf', -2, 4, 0, -3.6, 2.6, P);
put('hm_houseplant', -2, 4, 0, -3.2, -3.2);
// Laundry: washers along the west wall, shelves, bins.
put('hm_washer', 0, 4, 0, -3.3, -1.8, P);
put('hm_washer', 0, 4, 0, -3.3, -0.9, P);
put('hm_shelf_large', 0, 4, 0, -2.4, 3.6, PI);
put('hm_bin_large', 0, 4, 0, 3.2, -3.2);
// Upstairs: the master bedroom (marksman rifle), the second bedroom, the kid's room, the bathroom, the landing.
put('hm_bed_king', -2, 3, 1, -1.9, -1.2, P);
put('hm_nightstand', -2, 3, 1, -3.3, -0.6, P);
put('hm_dresser', -2, 3, 1, 2.2, -3.4);
put('hm_floor_lamp', -2, 3, 1, 3.3, 3.3);
put('hm_bed_single', -1, 3, 1, -2.2, 2.4, PI);
put('hm_nightstand', -1, 3, 1, -0.7, 3.3, PI);
put('hm_chest_drawers', -1, 3, 1, 1.75, 3.4, PI);
put('hm_bunk_bed', 0, 3, 1, 2.8, 2.6, PI);
put('crate_small', 0, 3, 1, -2.8, -2.8);
put('hm_desk_lamp', 0, 3, 1, -2.8, -2.8, 0, false, 0.6);
put('hm_bathtub', -2, 4, 1, -3.3, 0.6);
put('hm_toilet', -2, 4, 1, 3.2, 3.2, PI);
put('hm_bathroom_sink', -2, 4, 1, 1.4, 3.4, PI);
put('hm_houseplant', 0, 4, 1, 3.2, -3.2);
put('hm_bookshelf', 0, 4, 1, 3.6, 2.6, -P);
// Bungalow: living room (sofa facing the TV), kitchen, two bedrooms, back hall with the bathroom fittings, garage.
put('hm_rug', 0, -3, 0, -2.4, 1.4, P, false);
put('hm_couch_large', 0, -3, 0, -2.6, -0.5, 0);
put('hm_armchair', 0, -3, 0, 1.8, 2.4, PI + 0.5);
put('tv_cabinet', 0, -3, 0, -2.6, 3.5, PI);
put('tv', 0, -3, 0, -2.6, 3.5, PI, true, 0.6);
put('hm_fireplace', 0, -3, 0, -3.5, -2.4, P);
put('hm_floor_lamp', 0, -3, 0, 3.3, -3.3);
put('hm_oven', 1, -3, 0, -2.2, 3.4, PI);
put('hm_kitchen_sink', 1, -3, 0, 2.1, 3.4, PI);
put('hm_kitchen_counter', 1, -3, 0, 2.7, 3.4, PI);
put('hm_fridge', 1, -3, 0, 3.3, -3.0, -P);
put('hm_table_round', 1, -3, 0, 0, -0.3);
for (const [lx, lz, yaw] of [[-1.75, -0.3, P], [1.75, -0.3, -P]] as const) put('hm_chair_wood', 1, -3, 0, lx, lz, yaw);
put('hm_bed_king', 0, -4, 0, -2.2, -1.9, 0);
put('hm_nightstand', 0, -4, 0, -0.3, -3.3);
put('hm_dresser', 0, -4, 0, 2.6, 3.4, PI);
put('hm_bed_single', 1, -4, 0, -2.6, 2.6, PI);
put('hm_shower', 1, -4, 0, 3.0, 3.0);
put('hm_toilet', 1, -4, 0, 3.3, 0.6, -P);
put('hm_bathroom_sink', 1, -4, 0, 3.4, -1.8, -P);
put('workbench', 2, -4, 0, 3.2, -0.5, -P);
put('shelf_boxes', 2, -3, 0, 3.0, -1.2, -P);
put('barrel', 2, -4, 0, -3.1, -2.4);
put('sv_gas_can', 2, -4, 0, 3.2, 1.1, 0, false);

// ---------------------------------------------------------------- yards: trees, hedges, picnic tables, the playground

put('tree_round', -3, 2, 0, 0, 0);
put('tree_round', 3, -2, 0, 0, 0);
m.prop('oak', [26, 0, 20], 0.4).prop('oak', [-26, 0, -20], 3.5);
for (const [x, z] of [[-17, 18], [3, 18.5], [17, -18], [-3, -18.5], [-34, 16], [34, -16]] as const) m.prop('bush', [x, 0, z], (x * 7) % 6, 1, false);
for (const [x, z] of [[-26, 17], [26, -17], [-2, 10], [2, -10]] as const) m.prop('bush_large', [x, 0, z], (z * 3) % 6, 1, false);
// Back yards: a picnic table under a parasol, a barbecue, bins, a doghouse.
m.prop('table', [-12, 0, 41], 0).prop('parasol', [-12, 0, 41], 0, 1, false).prop('bench', [-12, 0, 39.9], 0).prop('bench', [-12, 0, 42.1], PI);
m.prop('table', [12, 0, -41], 0).prop('parasol', [12, 0, -41], 0, 1, false).prop('bench', [12, 0, -39.9], 0).prop('bench', [12, 0, -42.1], PI);
m.prop('fire_basket', [2, 0, 43.5], 0, 0.5).prop('fire_basket', [-2, 0, -43.5], 0, 0.5);
m.prop('trashcan', [2, 0, 37.2]).prop('trashcan', [-2, 0, -37.2]).prop('hm_bin_large', [-17.5, 0, 37.4]).prop('hm_bin_large', [17.5, 0, -37.4]);
m.block([24, G, 42], [1.8, 1.35, 1.6], 'solid', { material: 'pbr_planks', tint: '#b07040' });
m.block([-24, G, -42], [1.8, 1.35, 1.6], 'solid', { material: 'pbr_planks', tint: '#b07040' });
m.prop('crate_large', [-33, 0, 38], 0.3).prop('crate_large', [33, 0, -38], 0.3);
m.breakable('gas', [22, 0, 37.2]).breakable('gas', [-22, 0, -37.2]);
// The playground (south-west side yard): sandbox walls, a swing frame and a slide tower.
m.block([-22, G, -14], [4, 0.55, 0.3], 'solid', WOOD).block([-22, G, -18], [4, 0.55, 0.3], 'solid', WOOD).block([-24, G, -16], [0.3, 0.55, 4.3], 'solid', WOOD).block([-20, G, -16], [0.3, 0.55, 4.3], 'solid', WOOD);
for (const z of [-24, -20]) m.block([-14, G, z], [0.2, 2.75, 0.2], 'solid', PAINT('#c84a3a'));
m.block([-14, 2.6, -22], [0.2, 0.2, 4.2], 'solid', PAINT('#c84a3a'));
m.block([-28, G, -20], [2, 1.65, 2], 'solid', PAINT('#3a7ac8'));
// The north-east side yard: lawn chairs and a wheelbarrow-cart by the shed.
m.prop('chair', [24, 0, 18], 2.6, 1, false).prop('chair', [25.5, 0, 17], 2.2, 1, false).prop('cart', [21, 0, 33], 0.4);
m.prop('chair', [-24, 0, -18], -0.5, 1, false).prop('cart', [-21, 0, -33], PI + 0.4);
// The street: a bus stop sign, the road block's barriers and signs, a hydrant, mailboxes.
m.prop('signpost', [-22, 0, 6.1], 0, 1, false).prop('warning_sign', [-33, 0, 5], P, 1, false).prop('cone', [-32, 0, -4], 0).prop('cone', [-32, 0, 2.5], 0);
m.prop('cone', [33, 0, 12]).prop('cone', [33, 0, -12]).prop('lightpost', [-14, 0, 5.4], PI, 1, false).prop('lightpost', [14, 0, -5.4], 0, 1, false);
for (const [x, z] of [[-11, 6.8], [11, -6.8]] as const) m.block([x, G, z], [0.2, 1.25, 0.2], 'solid', WOOD).block([x, 1.1, z], [0.45, 0.35, 0.7], 'solid', PAINT('#4a5a6a'));

// ---------------------------------------------------------------- spawns, flags, hills

for (const x of [-30, -20, -6, 6, 20, 30]) m.spawn([x, 0, 42], PI, embers);
for (const x of [30, 20, 6, -6, -20, -30]) m.spawn([x, 0, -42], 0, tide);
// Shared spawns (deathmatch): side yards, back yards' corners, both houses.
for (const [x, y, z, yaw] of [[-28, 0, 26, P], [28, 0, -26, -P], [28, 0, 16, PI], [-28, 0, -16, 0], [-14, 4, 30, P], [3, 0, -31, PI], [33, 0, 40, -P], [-33, 0, -40, P], [-3, 0, 33, -P], [-6, 0, -12, PI]] as const) m.spawn([x, y, z], yaw);
m.flag(embers, at(0, 3, 0, 0, 2.2), PI).flag(tide, at(0, -3, 0, 1.8, 0.6), 0);
m.hill([6, 0, 0], 5).hill([-26, 0, -12], 5).hill([26, 0, 12], 5);

// ---------------------------------------------------------------- pickups

m.pickup('armor_large', [6, 0, 1.5]).pickup('grenades', [-3, 0, 4]).pickup('grenades', [3, 0, -4.2]);
m.pickup('weapon_marksman', at(-2, 3, 1, 1.4, 0)).pickup('weapon_lmg', [6, 4.15, -30]);
m.pickup('weapon_shotgun', at(0, 4, 0, 1, -0.5)).pickup('weapon_shotgun', at(1, -4, 0, -1, 0.5));
m.pickup('weapon_smg', [-28, 0, 30]).pickup('weapon_smg', [28, 0, -30]);
m.pickup('weapon_rifle', [-14, 0, 13]).pickup('weapon_rifle', [14, 0, -13]);
m.pickup('weapon_burst_rifle', [26, 0, 24]).pickup('weapon_burst_rifle', [-26, 0, -24]);
m.pickup('weapon_launcher', [33, 0, 30]).pickup('weapon_launcher', [-33, 0, -30]);
m.pickup('health_large', [30, 0, 6]).pickup('health_large', [-30, 0, -6]);
m.pickup('health_small', at(-1, 3, 1, 1, -1)).pickup('health_small', at(1, -3, 0, -1, 1.5)).pickup('health_small', [-30, 0, 13]).pickup('health_small', [30, 0, -13]);
m.pickup('armor_small', at(0, 3, 1, -1.5, 0.5)).pickup('armor_small', at(2, -3, 0, -1.5, 2));
m.pickup('ammo', [0, 0, 41]).pickup('ammo', [0, 0, -41]).pickup('ammo_sniper', at(0, 4, 1, -1, -1)).pickup('ammo_rifle', [-8, 0, 11]).pickup('ammo_rifle', [8, 0, -11]);

// ---------------------------------------------------------------- light

m.bounds('invisible', 0, BOUNDS);
m.lightRooms({ color: '#ffe6bc' });
for (let x = -2; x <= 0; x++) for (const y of [3, 4]) m.light(at(x, y, 1, 0, 0, 3.45), { color: '#ffe6bc' });
for (const [x, y] of [[0, -3], [1, -3], [0, -4], [1, -4], [2, -3], [2, -4]] as const) m.light(at(x, y, 0, 0, 0, 3.45), { color: x === 2 ? '#f0f4ff' : '#ffe6bc' });
m.light([-1, 0, 15], { fixture: 'wall', color: '#fff0c8', range: 6, yaw: PI }); // porch lights
m.light([0, 0, -15], { fixture: 'wall', color: '#fff0c8', range: 6, yaw: 0 });

// ---------------------------------------------------------------- the desert: flat lots, dunes and mesas beyond, test towers

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const SIZE = 240;
const base = newTerrain(SIZE, 2, [0, 0]);
const outside = (x: number, z: number) => Math.hypot(Math.max(LOTS.min[0] - x, 0, x - LOTS.max[0]), Math.max(LOTS.min[1] - z, 0, z - LOTS.max[1]));
const heights: number[] = [];
for (let r = 0; r < base.rows; r++) {
  for (let c = 0; c < base.cols; c++) {
    const x = base.origin[0] + c * 2;
    const z = base.origin[1] + r * 2;
    const d = outside(x, z);
    const dunes = 1.6 * Math.sin(x / 9 + 0.7) * Math.cos(z / 13) + 1.1 * Math.sin((x - z) / 7);
    const mesa = 12 * smooth(0.25, 0.55, Math.sin(x / 31 + 1.3) * Math.cos(z / 27 - 0.4) + 0.2);
    heights.push(Math.round((-0.15 + smooth(3, 22, d) * (2.2 + dunes) + smooth(40, 70, d) * mesa) * 100));
  }
}
const materials: number[] = [];
const foliage: number[] = [];
for (let r = 0; r < base.rows - 1; r++) {
  for (let c = 0; c < base.cols - 1; c++) {
    const x = base.origin[0] + c * 2 + 1;
    const z = base.origin[1] + r * 2 + 1;
    const d = outside(x, z);
    const front = Math.abs(z) > 6 && Math.abs(z) < 20 && Math.abs(x) < 34; // lawns
    const back = Math.abs(z) > 36 && Math.abs(z) < 46; // back yards
    let g: TerrainMaterial = 'sand';
    let f = 0;
    if (d < 0.5 && front) [g, f] = ['grass', 2];
    else if (d < 0.5 && back) [g, f] = Math.sin(x / 5) * Math.cos(z / 3) > 0.4 ? ['dirt', 1] : ['grass', 1];
    else if (d < 0.5) [g, f] = Math.sin(x / 6 + z / 9) > 0.2 ? ['grass', 1] : ['dirt', 1];
    else [g, f] = Math.sin(x / 7 + z / 11) > 0.3 ? ['dirt', 1] : ['sand', 0];
    materials.push(TERRAIN_MATERIALS.indexOf(g));
    foliage.push(f);
  }
}
const ground: TerrainData = { ...base, heights, materials, foliage };
m.terrain(ground);
const groundAt = (x: number, z: number) => r2(terrainHeightAt(ground, x, z) ?? 0);
/** A lattice test tower out on the range: four legs, rings every 6 m, a shot cab on top. */
function testTower(x: number, z: number, h: number): void {
  const g = groundAt(x, z) - 0.5;
  const STEEL = { material: 'pbr_steel', tint: '#8a8478' };
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const) for (const k of [0, 1]) m.block([x + dx, r2(g + (k * (h + 0.5)) / 2), z + dz], [0.35, r2((h + 0.5) / 2), 0.35], 'solid', STEEL);
  for (let y = 6; y < h; y += 6) for (const [dx, dz, w, d] of [[0, -2, 4.3, 0.2], [0, 2, 4.3, 0.2], [-2, 0, 0.2, 4.3], [2, 0, 0.2, 4.3]] as const) m.block([x + dx, g + y, z + dz], [w, 0.2, d], 'solid', STEEL);
  m.block([x, g + h, z], [5, 0.3, 5], 'solid', STEEL);
  m.block([x, g + h + 0.3, z], [3.4, 3, 3.4], 'solid', { material: 'pbr_corrugated', tint: '#c8c0ac' });
}
testTower(-78, 92, 30);
testTower(96, 64, 36);
testTower(-100, -70, 26);
// Cacti and rocks on the desert outside the fences.
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 26; i++) {
  const a = rnd() * PI * 2;
  const d = 48 + rnd() * 50;
  const x = r2(Math.cos(a) * d * 0.9);
  const z = r2(Math.sin(a) * d);
  if (Math.abs(x) < 40 && Math.abs(z) < 50) continue;
  m.prop(['nt_saguaro', 'nt_cactus_round', 'rock_large', 'nt_cactus_flowers'][i % 4]!, [x, groundAt(x, z), z], r2(rnd() * 6.28), r2(0.9 + rnd() * 0.5), false);
}

m.meta({
  description:
    'A tiny 1950s street on an atomic test range: a yellow two-storey house and a teal bungalow with a garage face each other across a lane blocked by a school bus and a truck. Spawn in your back yard, fight through the houses, the side alleys and the lawns, climb to the bungalow roof, shoot the mannequins to bits, and duck when the test siren goes off.',
  modes: ['core.tdm', 'core.deathmatch', 'core.koth', 'core.ctf'],
  players: [6, 12],
});
await m.save();
