/**
 * Pump Tower: a tall concrete works stacked round an open shaft (a layout homage
 * to GoldenEye's multiplayer Stack; our own name, tiles and dressing).
 * Five floors of rooms and corridors ring a 2 × 2 shaft that runs from the
 * machinery floor at the bottom to the control rooms at the top. Railings,
 * windows and a few open edges look into the shaft (drop in to get down
 * fast); a catwalk crosses it halfway up. The stairwells alternate corners,
 * so every climb is a run round the floor: up from the south-west on even
 * floors, from the north-east on odd ones.
 *
 *   every floor (z0–z4), x → -1..3                 shaft edges (into the shaft)
 *   y4              N                               R railing, W windows,
 *   y3      c   s   s   c                           O open edge (drop),
 *   y2      s   ░   ░   s                           D door (z0 machinery floor)
 *   y1      s   ░   ░   s
 *   y0  S   c   s   s   c
 *      -1   0   1   2   3
 *
 *   c  corner rooms (the power weapon in the south-east one on z2)
 *   s  corridors (ground floor and top floor: rooms)
 *   ░  the shaft: the machinery floor on z0, open above; catwalk on z2 at x1
 *   S  south-west stairwells, z0→z1 and z2→z3 (doors east)
 *   N  north-east stairwells, z1→z2 and z3→z4 (doors south); a sealed pump
 *      room under them on z0, seen through bars
 */
import type { Side, TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('pump_tower', 'Pump Tower');
m.theme('bunker');
m.backdrop('overcast', 'mountains', 'gravel', 0.6);
m.teams([6, 6]);
const [bottom, top] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const PI = Math.PI;
/** World position of cell (x, y) on level z, plus an offset in metres (dy is north). */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0): [number, number, number] => [x * 8 + dx, z * 4, y * 8 + dy];
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}

const TOP = 4;
/** The ring round the shaft, in walking order (anticlockwise from the south-west corner). */
const RING: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1]];
const isCorner = (x: number, y: number) => (x === 0 || x === 3) && (y === 0 || y === 3);
/** The side of each middle ring cell that faces the shaft. */
const SHAFT_SIDE: Record<string, Side> = { '1,0': 'N', '2,0': 'N', '1,3': 'S', '2,3': 'S', '0,1': 'E', '0,2': 'E', '3,1': 'W', '3,2': 'W' };
/** The side of (ax, ay) that faces its ring neighbour (bx, by). */
const toward = (ax: number, ay: number, bx: number, by: number): Side => (bx > ax ? 'E' : bx < ax ? 'W' : by > ay ? 'N' : 'S');

// ---------------------------------------------------------------- the structure

// The machinery floor at the bottom of the shaft (its four columns are the pump housings).
m.tile('room_large', 1, 1, 0);
for (let z = 0; z <= TOP; z++) {
  for (const [x, y] of RING) {
    if (isCorner(x, y)) {
      // The power room (z2, south-east) has columns; the rest are plain rooms.
      const kind = z === 2 && x === 3 && y === 0 ? 'room_columns' : 'room';
      m.tile(kind, x, y, z, 0, z === TOP ? { ceiling: 'roof' } : undefined);
    } else if (z === 0 || z === TOP) {
      m.tile('room', x, y, z, 0, z === TOP ? { ceiling: 'roof' } : undefined);
    } else if (z === 2 && x === 1) {
      // The catwalk's landings: T-junctions opening onto the shaft.
      m.tile('junction_t', x, y, z, y === 0 ? 0 : 2);
    } else {
      const ew = y === 0 || y === 3;
      m.tile(z === 3 && x === 3 ? 'corridor_windows' : 'corridor', x, y, z, ew ? 1 : 0);
    }
  }
}
// The catwalk across the shaft on z2.
m.tile('bridge', 1, 1, 2).tile('bridge', 1, 2, 2);
// Stairwells at alternating corners: south-west from even floors, north-east from odd ones.
m.tile('stairwell', -1, 0, 0, 2).tile('stairwell', -1, 0, 2, 2);
m.tile('room', 3, 4, 0).tile('stairwell', 3, 4, 1, 3).tile('stairwell', 3, 4, 3, 3);

// ---------------------------------------------------------------- walls

// Round each floor: doors into the corner rooms, the corridors run open between them.
for (let z = 0; z <= TOP; z++) {
  for (let i = 0; i < RING.length; i++) {
    const [ax, ay] = RING[i]!;
    const [bx, by] = RING[(i + 1) % RING.length]!;
    const corner = isCorner(ax, ay) || isCorner(bx, by);
    const style = z === 0 ? (corner ? 'wide' : 'open') : z === TOP ? 'door' : corner ? 'door' : 'open';
    m.edge(ax, ay, z, toward(ax, ay, bx, by), style);
  }
}
// Into the shaft, floor by floor (z0 opens onto the machinery floor).
const SHAFT: Record<number, Record<string, 'railing' | 'windows' | 'window' | 'open' | 'wide' | 'door' | 'arch'>> = {
  0: { '1,0': 'wide', '2,0': 'arch', '1,3': 'arch', '2,3': 'wide', '0,1': 'wide', '0,2': 'door', '3,1': 'door', '3,2': 'wide' },
  1: { '1,0': 'railing', '2,0': 'open', '1,3': 'railing', '2,3': 'windows', '0,1': 'windows', '0,2': 'open', '3,1': 'railing', '3,2': 'railing' },
  2: { '1,0': 'wide', '2,0': 'railing', '1,3': 'wide', '2,3': 'railing', '0,1': 'railing', '0,2': 'windows', '3,1': 'open', '3,2': 'windows' },
  3: { '1,0': 'windows', '2,0': 'railing', '1,3': 'railing', '2,3': 'open', '0,1': 'open', '0,2': 'railing', '3,1': 'windows', '3,2': 'railing' },
  4: { '1,0': 'windows', '2,0': 'open', '1,3': 'railing', '2,3': 'windows', '0,1': 'windows', '0,2': 'railing', '3,1': 'windows', '3,2': 'windows' },
};
for (let z = 0; z <= TOP; z++) for (const [key, style] of Object.entries(SHAFT[z]!)) {
  const [x, y] = key.split(',').map(Number) as [number, number];
  m.edge(x, y, z, SHAFT_SIDE[key]!, style);
}
m.edge(1, 1, 2, 'N', 'open');
// Windows out of the corner rooms; the top floor's control rooms look out all round.
for (let z = 1; z <= TOP; z++) m.edge(3, 0, z, 'S', 'window').edge(0, 3, z, 'N', 'window');
for (const [x, y] of [[1, 0], [2, 0]] as const) m.edge(x, y, TOP, 'S', 'windows');
for (const [x, y] of [[1, 3], [2, 3]] as const) m.edge(x, y, TOP, 'N', 'windows');
for (const [x, y] of [[0, 1], [0, 2]] as const) m.edge(x, y, TOP, 'W', 'windows');
for (const [x, y] of [[3, 1], [3, 2]] as const) m.edge(x, y, TOP, 'E', 'windows');
m.edge(0, 0, TOP, 'S', 'window').edge(3, 3, TOP, 'E', 'window');
// The sealed pump room under the north-east stairwells: bars onto the ground floor.
m.edge(3, 3, 0, 'N', 'bars');

// Surfaces: tread plate on the machinery floor, steel on the catwalk, panelled control rooms.
for (const [x, y] of RING) paint(x, y, 0, { floor: mat('pbr_tread_plate'), walls: mat('pbr_concrete', '#b8bcc0') });
paint(1, 1, 0, { floor: mat('pbr_tread_plate', '#9a9890'), walls: mat('pbr_concrete', '#a9adb0'), solids: mat('pbr_rusted_plate') });
paint(3, 4, 0, { floor: mat('pbr_tread_plate'), solids: mat('pbr_rusted_plate') });
paint(1, 1, 2, { floor: mat('pbr_steel'), solids: mat('pbr_steel') });
paint(1, 2, 2, { floor: mat('pbr_steel'), solids: mat('pbr_steel') });
for (const [x, y] of RING) paint(x, y, TOP, { floor: mat('pbr_tread_plate', '#8c9196'), walls: mat('pbr_steel', '#9aa3ab'), underside: mat('pbr_concrete') });

// ---------------------------------------------------------------- dressing

// The machinery floor: pumps, a conveyor and crates round the shaft's corners, the middle kept clear for the hill.
m.prop('machine', at(1, 1, 0, -2.2, -2.4), 0).prop('hopper_tall', at(2, 1, 0, 2.4, -2.4), 0, 1.2);
m.prop('hopper_tall', at(1, 2, 0, -2.4, 2.4), 0, 1.2).prop('machine_window', at(2, 2, 0, 2.2, 2.4), PI);
m.prop('conveyor', at(1, 1, 0, 3.6, -2.8), 0).prop('pipe_valve', at(2, 1, 0, 2.8, 1.2));
m.prop('crate_large', at(1, 2, 0, -2.8, -0.4)).prop('metal_crate', at(2, 2, 0, 2.8, -0.6));
m.breakable('gas', at(2, 1, 0, -0.5, -3)).breakable('barrel', at(1, 2, 0, 0.5, 3));
// Ground-floor ring: crates and drums, a forklift's worth of containers in the corners.
m.prop('container', at(3, 0, 0, 1.8, -1.8), 0).prop('cargo_crate', at(0, 3, 0, -2.4, 2.4), P);
m.prop('crate_large', at(0, 0, 0, -2.6, -2.8)).prop('crate_small', at(0, 0, 0, -1.2, -3));
m.prop('barrel', at(3, 3, 0, 3, 1.5)).prop('dungeon_barrel', at(3, 3, 0, 3, 0.3)).prop('factory_box_long', at(2, 3, 0, 0, 3), 0);
m.prop('warning_sign', at(1, 0, 0, 0, -3.3)).prop('big_pipe', at(3, 1, 0, 3, 0));
m.breakable('crate', at(2, 0, 0, -2, -3)).breakable('gas', at(0, 2, 0, -3.2, 2));
// The pump room behind bars.
m.prop('machine', at(3, 4, 0, 0, 1), PI).prop('pipe_valve', at(3, 4, 0, -2.5, 2)).prop('hopper', at(3, 4, 0, 2.5, 2));
// Middle floors: stores and kit.
m.prop('shelf_boxes', at(3, 0, 1, 2.6, -3.1)).prop('metal_crate', at(0, 3, 1, -2.8, 2.8)).prop('barrel', at(3, 3, 1, 3, -3));
m.prop('crate_small', at(0, 0, 1, -2.8, -2.8)).breakable('barrel', at(2, 3, 1, 2, 3));
m.prop('crate_large', at(3, 0, 2, 2.8, 2.8)).prop('factory_box', at(3, 0, 2, -2.6, -2.8)).prop('warning_sign', at(3, 0, 2, 3.3, 0), -P);
m.prop('shelf_bags', at(0, 3, 2, -2.8, 3)).prop('cardboard_box', at(3, 3, 2, 2.8, -2.8)).breakable('gas', at(0, 0, 2, -3, -3));
m.prop('metal_crate', at(3, 0, 3, 2.8, -2.8)).prop('crate_small', at(0, 3, 3, -2.8, 2.8)).prop('shelf_boxes', at(3, 3, 3, 2.6, -3.1));
m.breakable('crate', at(0, 0, 3, -2.8, -2.8));
// The control rooms at the top: consoles, screens and desks.
m.prop('computer_bank', at(0, 0, 4, -2.6, -3), 0).prop('screen_panel', at(0, 0, 4, -3.3, 0), P);
m.prop('computer_wide', at(3, 0, 4, 2.4, -3), 0).prop('office_chair', at(3, 0, 4, 2.4, -1.8), PI).prop('lever', at(3, 0, 4, 3.2, 2.5));
m.prop('computer_bank', at(3, 3, 4, 3, -1.5), -P).prop('desk', at(3, 3, 4, -2.4, 3)).prop('computer', at(3, 3, 4, -2.4, 3.1));
m.prop('holo_table', at(0, 3, 4, -2.4, 2.4)).prop('computer_wide', at(0, 3, 4, 2.6, 3), PI).prop('office_chair', at(0, 3, 4, 2.6, 1.8), 0);
m.prop('screen_panel', at(1, 0, 4, 0, -3.4), 0).prop('screen_panel', at(2, 3, 4, 0, 3.4), PI);
m.prop('desk', at(3, 2, 4, 2.6, 0), -P).prop('office_chair', at(3, 2, 4, 1.4, 0), P);

// ---------------------------------------------------------------- spawns

for (const [x, y, z, dx, dy, yaw] of [
  [0, 1, 0, 0, 2.5, P], [3, 2, 0, 0, -2.5, -P], [2, 0, 0, 2.5, 0, 0], [1, 2, 0, -2, -3, P],
  [1, 0, 1, 2, 0, 0], [3, 3, 1, -2, -1.5, -P], [0, 2, 1, 0, -2.5, P],
  [0, 0, 2, 1.5, 2, 0], [2, 3, 2, 2, 0, PI], [3, 1, 2, 0, -2.5, -P],
  [1, 3, 3, -2, 0, PI], [3, 0, 3, -2, 2, P], [0, 1, 3, 0, -2.5, P],
  [2, 0, 4, 2, 0, 0], [3, 2, 4, 0, -2.5, -P], [1, 3, 4, -2, 0, PI],
] as const) m.spawn(at(x, y, z, dx, dy), yaw);
// Team groups: one on the machinery floor, one in the control rooms.
for (const [x, y, dx, dy, yaw] of [[0, 0, 2, 2, P], [3, 0, -2, 2.5, -P], [1, 3, 0, -2, 0], [3, 3, -2.5, -2.5, PI], [1, 1, -2.5, 2, P], [2, 2, 2, -2.2, -P]] as const) m.spawn(at(x, y, 0, dx, dy), yaw, bottom);
for (const [x, y, dx, dy, yaw] of [[0, 0, 2, 2, 0], [3, 0, -2, 2, 0], [0, 3, 2, -2, PI], [3, 3, -2, -2, PI], [1, 0, -2, 0, 0], [3, 1, 0, 2, -P]] as const) m.spawn(at(x, y, TOP, dx, dy), yaw, top);

// ---------------------------------------------------------------- pickups

// Ground floor: an smg and a shotgun, ammo all round.
m.pickup('weapon_smg', at(1, 0, 0)).pickup('weapon_shotgun', at(3, 2, 0, 0, 1)).pickup('ammo_rifle', at(0, 1, 0, 0, -1));
m.pickup('ammo', at(0, 3, 0)).pickup('grenades', at(3, 0, 0, -1, 0)).pickup('health_small', at(2, 3, 0, -2, 0)).pickup('armor_small', at(2, 2, 0, 1, 1));
// z1
m.pickup('weapon_rifle', at(0, 2, 1, 0, 1)).pickup('ammo_shells', at(2, 0, 1, -2, 0)).pickup('ammo_rifle', at(3, 1, 1));
m.pickup('health_small', at(3, 3, 1)).pickup('grenades', at(1, 3, 1)).pickup('ammo_light', at(0, 0, 1));
// z2: the rocket launcher in the south-east corner room; the catwalk carries armour.
m.pickup('weapon_rockets', at(3, 0, 2), 60).pickup('ammo_explosive', at(0, 3, 2)).pickup('weapon_smg', at(0, 1, 2));
m.pickup('health_large', at(2, 3, 2, -2, 0)).pickup('ammo', at(1, 1, 2, 0, 2)).pickup('armor_small', at(1, 2, 2, 0, -2)).pickup('ammo_light', at(2, 0, 2));
// z3
m.pickup('weapon_burst_rifle', at(1, 3, 3, 1, 0)).pickup('weapon_auto_shotgun', at(3, 2, 3)).pickup('ammo_rifle', at(0, 0, 3));
m.pickup('health_small', at(2, 0, 3)).pickup('ammo_shells', at(3, 3, 3)).pickup('ammo', at(0, 2, 3));
// The top: body armour in the north-west control room, the marksman rifle over the shaft.
m.pickup('armor_large', at(0, 3, TOP), 45).pickup('weapon_marksman', at(3, 0, TOP)).pickup('ammo_sniper', at(1, 0, TOP, 1, 0));
m.pickup('health_large', at(3, 2, TOP, 0, 1)).pickup('ammo', at(0, 1, TOP)).pickup('grenades', at(2, 3, TOP)).pickup('ammo_rifle', at(3, 3, TOP));

// King of the Hill: the bottom of the shaft, the catwalk, the control rooms.
m.hill(at(1, 1, 0, 4, 4), 5).hill(at(1, 1, 2, 0, 4), 3).hill(at(0, 2, TOP, 0, 2), 4);

// ---------------------------------------------------------------- light

// Cool white panels in every room and corridor with a floor above, the same in the roofed control rooms.
m.lightRooms({ color: '#d8e6ff', intensity: 1.05 });
for (const [x, y] of RING) m.light([x * 8, TOP * 4 + 3.45, y * 8], { color: '#d8e6ff', intensity: 1.05 });
// The shaft: a cold wash down its length and work lamps over the machinery.
for (const z of [1, 3]) m.light([12, z * 4 + 2, 12], { fixture: 'none', color: '#c4d6f2', intensity: 0.9, range: 16 });
m.light([12, 3.6, 12], { fixture: 'none', color: '#e8eeff', intensity: 1.1, range: 14 });
m.bounds('invisible');
m.meta({
  description:
    'A tall concrete works stacked round an open shaft. Five floors of rooms and corridors ring the shaft, with railings, glass and open edges to drop through; a catwalk crosses it halfway up. Stairwells alternate corners, so every climb is a run round the floor. Rockets wait in a corner room midway up, body armour in the control rooms at the top, and the machinery floor at the bottom is the hill.',
  modes: ['core.deathmatch', 'core.tdm', 'core.koth'],
  players: [2, 12],
});
await m.save();
