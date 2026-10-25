/**
 * Complex: a buried concrete works laid out in homage to GoldenEye 007's
 * multiplayer Complex (our own tiles, props and name; the layout only). Two
 * high hangars face each other across a central hall crossed by a raised
 * walkway; long corridors with hard corners run round and between them, a
 * storey of upper corridors rides on top of the inner ones, and a pit in the
 * hall floor drops to tunnels underneath. Everything loops: open stairs climb
 * each hangar to its gallery, long ramps and stairwells link the corridor
 * levels at the corners, and a stairwell behind each hangar leads down to the
 * tunnels.
 *
 * The plan is point-symmetric about the centre of the hall (cell (x, y) on the
 * west mirrors (7 - x, 5 - y) on the east), apart from the walkway, which
 * crosses straight over at y3.
 *
 *   ground (z0), x → 0..7                         upper (z1)
 *   y6                   W                         y6                  W
 *   y5   c───c───T═[ramp→]c───c───c                y5        ═[ramp]═ T
 *   y4   ┌ H  H┐ |  h   h  | H  H┐                 y4   g g  L  .   .  |
 *   y3   ⇡ H  H  |  ▮   ▮  X H  ⇣ ┘ (stairs)       y3   g ↑  T━━B━━━B━━T  ↓ g
 *   y2   │ ↑  H  X  ○   ○  | H  H ⇡                y2     ↑  |  .   .  |    g
 *   y1   └ H  H┘ |  h   h  | H  H┘                 y1        |  .   .  L  g g
 *   y0   c───c───T═[←ramp]═T───c───c               y0        T═[ramp]═
 *   y-1          W
 *        0   1   2   3   4   5   6   7
 *
 *   H   hangars (2 × 4, two storeys, roofed at 8 m); ↑/↓ open stairs to the galleries g
 *   h   central hall (2 × 4, two storeys): ○ pits to the tunnels, ▮ pillars under the walkway B
 *   |X  inner corridors (X crossroads into hangar and hall), windows and slits both sides
 *   W   stairwells: south-west and north-east link the corridor levels;
 *       ⇡/⇣ behind each hangar go down to the tunnels
 *   tunnels (z-1): west from (0,3) and east from (7,2) to a 2 × 2 chamber under the pits
 */
import type { Side } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('complex', 'Complex');
m.theme('bunker');
m.backdrop('overcast', 'hills', 'gravel', 0.6);
const P = Math.PI / 2;
type V3 = [number, number, number];
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0): V3 => [x * 8 + dx, z * 4, y * 8 + dy];
/** The point-symmetric twin of a world position (half-turn about the hall's centre, world 28, 20). */
const twin = (p: V3): V3 => [56 - p[0], p[1], 40 - p[2]];
const OPP: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };
/** A tile and its twin across the centre. */
function pair(kind: string, x: number, y: number, z: number, rot: 0 | 1 | 2 | 3): void {
  m.tile(kind, x, y, z, rot);
  m.tile(kind, 7 - x, 5 - y, z, ((rot + 2) % 4) as 0 | 1 | 2 | 3);
}
/** A wall style and its twin. */
function edge2(x: number, y: number, z: number, side: Side, style: Parameters<MapBuilder['edge']>[4]): void {
  m.edge(x, y, z, side, style);
  m.edge(7 - x, 5 - y, z, OPP[side], style);
}
const cool = '#e4ecff';

// ---------------------------------------------------------------- outer corridors (z0)

pair('corner', 0, 0, 0, 0); // hangar door north, corridor east
pair('corridor', 1, 0, 0, 1);
pair('junction_t', 2, 0, 0, 3); // west, north up the inner corridor, south into the stairwell
pair('junction_t', 5, 0, 0, 0); // west onto the ramp, north, east
pair('corridor', 6, 0, 0, 1);
pair('corner', 7, 0, 0, 3); // west, and north into the east hangar
// Long ramps up from the outer corridor to the upper corridors (south: east → west; north: west → east).
m.tile('ramp', 4, 0, 0, 2).tile('ramp', 3, 5, 0, 0);
// Stairwells between the corridor levels.
pair('stairwell', 2, -1, 0, 1);

// ---------------------------------------------------------------- inner corridors (z0)

for (const y of [1, 3, 4]) pair('corridor_clear', 2, y, 0, 0);
pair('junction_x', 2, 2, 0, 0); // doorways into the west hangar and the hall

// ---------------------------------------------------------------- hangars (z0, two storeys)

const HANGAR: [number, number][] = [[0, 1], [1, 1], [1, 2], [0, 3], [1, 3], [0, 4], [1, 4]];
for (const [x, y] of HANGAR) pair('room', x, y, 0, 0);
pair('stairs_open', 0, 2, 0, 3); // from the floor at the south end up north onto the gallery
// Gallery: an L of railed platforms along the back and north walls, out to the upper corridor.
for (const [x, y] of [[0, 3], [0, 4], [1, 4]] as const) pair('platform_rail', x, y, 1, 0);

// ---------------------------------------------------------------- central hall (z0, two storeys)

m.tile('room', 3, 1).tile('room', 4, 1).tile('room', 3, 4).tile('room', 4, 4);
m.tile('pit', 3, 2).tile('pit', 4, 2); // the floor falls away to the chamber below
m.tile('room_pillar', 3, 3).tile('room_pillar', 4, 3); // pillars under the walkway
// The walkway crossing the hall a storey up, between the two upper corridors.
m.tile('bridge', 3, 3, 1, 1).tile('bridge', 4, 3, 1, 1);

// ---------------------------------------------------------------- upper corridors (z1)

pair('junction_t', 2, 0, 1, 1); // ramp top (east), stairwell (south), north
pair('corridor_clear', 2, 1, 1, 0);
m.tile('corridor_clear', 2, 2, 1, 0).tile('corridor_clear', 5, 2, 1, 0);
m.tile('junction_t', 2, 3, 1, 1).tile('junction_t', 5, 3, 1, 3); // the walkway's landings
pair('corner', 2, 4, 1, 2); // south, and west onto the gallery

// ---------------------------------------------------------------- tunnels (z-1)

pair('stairwell', -1, 3, -1, 2); // behind each hangar: hangar floor ↔ tunnel
for (const x of [0, 1, 2]) pair('corridor', x, 3, -1, 1);
m.fill('room', 3, 2, 4, 3, -1); // the chamber under the pits

// ---------------------------------------------------------------- walls

const isHangar = (x: number, y: number) => (x === 0 && y === 2) || HANGAR.some(([a, b]) => a === x && b === y);
// One open floor in each hangar, the hall and the chamber.
for (let x = 0; x < 1; x++) for (let y = 1; y <= 4; y++) if (isHangar(x, y) && isHangar(x + 1, y)) edge2(x, y, 0, 'E', 'open');
for (let x = 0; x <= 1; x++) for (let y = 1; y < 4; y++) if (isHangar(x, y) && isHangar(x, y + 1)) edge2(x, y, 0, 'N', 'open');
for (let y = 1; y <= 4; y++) m.edge(3, y, 0, 'E', 'open');
for (let y = 1; y < 4; y++) m.edge(3, y, 0, 'N', 'open').edge(4, y, 0, 'N', 'open');
m.edge(3, 2, -1, 'E', 'open').edge(3, 3, -1, 'E', 'open').edge(3, 2, -1, 'N', 'open').edge(4, 2, -1, 'N', 'open');

// Hangar shells: two storeys round the outside, single-storey walls wherever a gallery or upper corridor
// supplies the storey above. The doorways (south-west corner, north-west corner, tunnel stairwell, the
// crossroads) are left to meet their ports.
edge2(0, 1, 0, 'W', 'high');
edge2(0, 2, 0, 'W', 'high');
edge2(0, 3, 1, 'W', 'wall'); // over the tunnel stairwell door
edge2(0, 4, 0, 'W', 'wall');
edge2(0, 4, 1, 'W', 'wall');
edge2(1, 1, 0, 'S', 'high');
edge2(0, 4, 1, 'N', 'wall'); // over the north door
edge2(1, 4, 0, 'N', 'wall');
edge2(1, 4, 1, 'N', 'wall');
// The east side faces the inner corridor: glass and firing slits on both storeys.
edge2(1, 1, 0, 'E', 'window');
edge2(1, 3, 0, 'E', 'slit');
edge2(1, 4, 0, 'E', 'window');
edge2(2, 1, 1, 'W', 'window');
edge2(2, 2, 1, 'W', 'window');
edge2(2, 3, 1, 'W', 'slit');
edge2(2, 4, 1, 'W', 'wide'); // upper corridor onto the gallery

// The hall: doorways and slits from the inner corridors, windows from the upper ones.
edge2(3, 1, 0, 'W', 'slit');
edge2(3, 3, 0, 'W', 'slit');
edge2(3, 4, 0, 'W', 'door');
edge2(2, 1, 1, 'E', 'window');
m.edge(2, 2, 1, 'E', 'slit').edge(5, 2, 1, 'W', 'slit');
edge2(2, 4, 1, 'E', 'window');

// Free-standing lintels over the two hangar doors with nothing built above them, closing the second storey.
for (const p of [[0, 4, 4], twin([0, 4, 4])] as const) m.block([p[0], p[1], p[2]], [8, 4, 0.3], 'solid', { material: 'pbr_concrete' });
// Roofs at 8 m over the hangars, the hall and the upper corridors (and the ramps beside the hall).
m.block([28, 8, 20], [64, 0.4, 32], 'solid', { material: 'pbr_concrete_dark' });
m.block([24, 8, 0], [24, 0.4, 8], 'solid', { material: 'pbr_concrete_dark' });
m.block([32, 8, 40], [24, 0.4, 8], 'solid', { material: 'pbr_concrete_dark' });

// ---------------------------------------------------------------- props

/** A prop and its twin, turned half round. */
function prop2(model: string, p: V3, yaw = 0, scale = 1): void {
  m.prop(model, p, yaw, scale);
  m.prop(model, twin(p), yaw + Math.PI, scale);
}
function break2(model: 'crate' | 'barrel' | 'gas', p: V3): void {
  m.breakable(model, p).breakable(model, twin(p));
}
// Hangars: crate stacks, a blast barrier and drums for cover, clear of the doors and the stair foot.
prop2('crate_large', at(0, 1, 0, -2.8, 2));
prop2('barrier_high', at(1, 1, 0, -2, 2));
prop2('factory_box', at(1, 1, 0, 2, 2.5), 0.3);
prop2('cargo_crate', at(1, 2, 0, -2, 0), 0, 1.4);
prop2('container_tall', at(1, 3, 0, 2.5, 2.8));
prop2('dg_crate', at(0, 3, 0, -2.8, -2.8), 0.2);
prop2('dg_barrel', at(0, 4, 0, -2.8, 2.8));
prop2('sv_propane', at(1, 4, 0, 2.8, 2.8), 0.6);
prop2('sv_gas_can', at(0, 4, 0, 2.6, 3.3), 0.4);
break2('barrel', at(1, 1, 0, 2.8, -2.8));
break2('gas', at(1, 2, 0, 2.8, -2.8));
// Galleries: a crate to duck behind at each corner.
prop2('metal_crate', at(0, 4, 1, -2.8, 2.8));
prop2('crate_small', at(1, 4, 1, 2.6, 3));
// Hall: crates and drums at each end, propane by the doors.
prop2('cargo_crate', at(3, 1, 0, -1.5, -1));
prop2('barrel', at(3, 1, 0, 2.5, -2.5));
prop2('crate_large', at(4, 1, 0, 1, 0.5), P);
prop2('sv_propane', at(4, 1, 0, 3, -3), 1.1);
prop2('pipe_valve', at(3, 3, 0, -2.6, -2.6));
// Corridors: drums and boxes against the walls.
prop2('dg_barrel', at(0, 0, 0, -2.8, -2.8));
prop2('factory_box_long', at(6, 0, 0, 0.5, -3.1));
prop2('warning_sign', at(2, 1, 0, 3.2, 3));
prop2('cardboard_box', at(1, 0, 0, 3.2, -3.2), 0.4);
// Upper corridors: terminals by the walkway landings.
m.prop('screen_panel', at(2, 3, 1, -2.6, 2.8), P).prop('computer_bank', at(5, 3, 1, 2.2, -2.6), 0);
// Tunnels and the chamber.
prop2('dg_crate', at(3, 3, -1, -2.8, 2.8), 0.3);
prop2('dg_barrel', at(3, 2, -1, -3, -3));
prop2('sv_gas_can', at(4, 3, -1, 3.2, 3.2), 0.2);
prop2('crate_large', at(1, 3, -1, -2.5, -3.1), P);
break2('crate', at(4, 3, -1, -3, 2.8));

// ---------------------------------------------------------------- spawns

// Free-for-all: sixteen across all three levels, in twins.
for (const [x, y, z, dx, dy, yaw] of [
  [1, 0, 0, -2, -1.5, P],
  [2, 1, 0, 0, -1.5, 0],
  [2, 1, 1, 0, 0, 0],
  [1, 4, 0, 0, 0, P],
  [3, 1, 0, 1, 2, 0],
  [1, 3, -1, 0, -1.5, P],
  [0, 4, 1, 1, 1, P],
  [2, 4, 1, 0, -1, Math.PI],
] as const) {
  const p = at(x, y, z, dx, dy);
  m.spawn(p, yaw).spawn(twin(p), yaw + Math.PI);
}
// Team deathmatch: one team on each hangar floor, facing the inner corridor.
m.teams([6, 6]);
const [west, east] = m.teamIds() as [string, string];
for (const [x, y, dx, dy] of [[0, 1, 0, -2], [1, 1, 0, -2], [1, 2, 2, 0], [1, 3, 0, 0], [0, 3, 1, 0], [0, 4, 1, 1]] as const) {
  const p = at(x, y, 0, dx, dy);
  m.spawn(p, P, west).spawn(twin(p), -P, east);
}

// ---------------------------------------------------------------- pickups

/** A pickup and its twin. */
function pick2(item: string, p: V3): void {
  m.pickup(item, p).pickup(item, twin(p));
}
// Power: heavy armour in the middle of the walkway; the rocket launcher at the bottom of the pit.
m.pickup('armor_large', [28, 4, 24]);
m.pickup('weapon_rockets', [28, -4, 17]);
pick2('ammo_explosive', at(2, 3, -1, 0, -1));
// Guns round the loop.
pick2('weapon_smg', at(0, 4, 1, -1, -1)); // galleries
pick2('weapon_smg', at(0, 3, -1, 0, -1)); // tunnels
pick2('weapon_shotgun', at(2, 2, 0)); // crossroads
pick2('weapon_rifle', at(4, 1, 0, -2, -2)); // hall floor
pick2('weapon_rifle', at(2, 0, 1, 0, 1)); // ramp tops
pick2('weapon_burst_rifle', at(1, 5, 0, -1, 1)); // north-west / south-east corridors
// Armour, health, ammo and grenades.
pick2('armor_small', at(1, 2, 0, 0, -3));
pick2('health_large', at(3, 3, 0, -2.5, 2.5));
pick2('health_small', at(0, 0, 0));
pick2('health_small', at(2, 2, 1));
pick2('ammo_light', at(1, 4, 1, 1, 0));
pick2('ammo_rifle', at(2, 4, 0, 0, 1));
pick2('ammo_shells', at(1, 5, 0, 1.5, 1));
pick2('ammo', at(2, 0, 0));
pick2('ammo', at(3, 3, -1, 0, 1));
pick2('grenades', at(7, 0, 0));
// King of the Hill: the hall floor between the pits and the pillars.
m.hill([28, 0, 22], 5);

// ---------------------------------------------------------------- lights

const hall = (x: number, y: number) => x >= 3 && x <= 4 && y >= 1 && y <= 4;
const hangarOpen = (x: number, y: number) => isHangar(x, y) || isHangar(7 - x, 5 - y);
m.lightRooms({ color: cool, intensity: 1.15, skip: (x, y, z) => (z === 0 && hall(x, y)) || (z === -1 && y === 2 && (x === 3 || x === 4)) });
const extra = { color: cool, intensity: 1.15 };
// Inner corridors, junctions and the stair landings under the upper storey.
for (const [x, y] of [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]] as const) {
  const p = at(x, y, 0);
  m.light([p[0], 3.45, p[2]], extra).light([56 - p[0], 3.45, 40 - p[2]], extra);
}
// Upper corridors and the ramp tops, under the roof.
for (const [x, y] of [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [3, 0], [4, 0]] as const) {
  const p = at(x, y, 1);
  m.light([p[0], 7.45, p[2]], extra).light([56 - p[0], 7.45, 40 - p[2]], extra);
}
// Hangars and hall: hard white lamps hung from the roof.
for (let x = 0; x <= 7; x++) for (let y = 1; y <= 4; y++) {
  if (!hall(x, y) && !hangarOpen(x, y)) continue;
  m.light([x * 8, 7.2, y * 8], { fixture: 'bulb', color: cool, intensity: 1.3, range: 13 });
}
// The chamber under the pits, lit from its walls.
for (const p of [at(3, 2, -1, -3.4, 0), at(4, 2, -1, 3.4, 0)]) m.light([p[0], -1.2, p[2]], { fixture: 'wall', color: cool, intensity: 1.1, range: 9, yaw: p[0] < 28 ? P : -P });

m.meta({
  description:
    'A buried concrete complex laid out in homage to the classic four-player Complex: two high hangars with galleries face each other across a central hall, where a raised walkway crosses over the pillars and a pit drops to tunnels underneath. Long hard-cornered corridors loop round everything on two levels, with windows and firing slits into every big room; ramps and stairwells at the corners tie the levels together. Heavy armour waits on the walkway, a rocket launcher at the bottom of the pit.',
  modes: ['core.deathmatch', 'core.tdm', 'core.koth'],
  players: [2, 12],
});
await m.save();
