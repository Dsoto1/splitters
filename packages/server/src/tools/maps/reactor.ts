/**
 * Reactor: a cooling plant on the edge of a container yard (homage in spirit
 * to Counter-Strike's "Nuke"). Embers come in from the yard in the west; Tide
 * hold the control room inside the plant, right between the two sites.
 *
 * - Upper site (A): the two-storey reactor hall, with a gallery round it
 *   ("heaven") that opens onto the plant roof. Into it: the "squeaky" door and
 *   the lobby/hut route from the yard, two doors from the control side, a hatch
 *   from the roof down into the mini room.
 * - Lower site (B): the coolant basement, one level down. The ramp room runs
 *   down to it from the yard, a long secret tunnel leaves the yard by a stair
 *   block, and Tide drop in by the control-room stairwell.
 * - Outside: containers and the round silo; open stairs up onto the plant roof,
 *   where the railgun waits looking down the yard and into heaven. The garage
 *   lane along the south wall leads round to the control room.
 *
 * Ground floor z0 (grid x east, y north; one cell = 8 m):
 *
 *   y6   .   y   y   y   st  [roof stairs up to z1]
 *   y5   y   y   y   y   y   c   H   M   c        H hut   M mini (hatch above)
 *   y4   y   y  (silo)   y   L   [ A  ]  |        L lobby   A reactor hall (atrium, z0-1)
 *   y3   y   y  (   )    y   Q   [    ]  T        Q squeaky   T junction to control
 *   y2   y   y   y   y   y   [ramp]  [ CT  ]  w   ramp down to B; CT control room; w stairwell
 *   y1   .   y   y   y   s   .   .   [     ]      s stair block down to the secret tunnel
 *   y0   .   .   .   g   g   g   g   g   g        g garage lane
 *        0   1   2   3   4   5   6   7   8   9
 *
 * Basement z-1: B (2 × 2) under the control room, the low end of the ramp at
 * (6,2), the stairwell at (9,2), and the secret tunnel from (4,1) along y0.
 * Roof z1: platforms over Q, L, the corner and the hut (5,3)-(6,5), plus (5,6),
 * the hatch over M, and the gallery of the reactor hall.
 */
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('reactor', 'Reactor');
m.theme('factory');
m.backdrop('cloudy', 'city', 'gravel', 0.5);
const [embers, tide] = m.teamIds() as [string, string];
const P = Math.PI / 2;

// ---------------------------------------------------------------- the yard (z0)
const yard: [number, number, string?, (0 | 1 | 2 | 3)?][] = [
  [0, 2], [0, 3, 'yard_crates', 1], [0, 4], [0, 5],
  [1, 1, 'yard_crates', 0], [1, 2], [1, 3], [1, 4, 'yard_wall', 1], [1, 5], [1, 6],
  [2, 1], [2, 2, 'yard_wall', 0], [2, 5], [2, 6, 'yard_crates', 2],
  [3, 1], [3, 2], [3, 5, 'yard_wall', 0], [3, 6],
  [4, 2], [4, 3], [4, 4], [4, 5],
];
for (const [x, y, kind = 'yard', rot = 0] of yard) m.tile(kind, x, y, 0, rot);
m.tile('round_tower', 2, 3); // the silo, doorway south
// Garage lane along the south wall, round to the control room.
for (let x = 3; x <= 8; x++) m.tile(x === 6 ? 'yard_crates' : 'yard', x, 0, 0, 1);

// ---------------------------------------------------------------- the plant (z0)
m.tile('atrium', 6, 3); // reactor hall: A site, gallery at z1
m.tile('room', 5, 3); // squeaky
m.tile('room_columns', 5, 4); // lobby
m.tile('corner', 5, 5, 0, 1); // lobby -> hut (south and east doors)
m.tile('room_pillar', 6, 5); // hut
m.tile('room', 7, 5); // mini (hatch above)
m.tile('corner', 8, 5, 0, 2); // south and west
m.tile('corridor', 8, 4);
m.tile('junction_t', 8, 3, 0, 3); // north, south and west (into the hall)
m.tile('room_large', 7, 1); // control room: Tide spawn
m.tile('ramp', 6, 2, -1, 2); // ramp room: from the yard at (5,2) down east to B
m.tile('stairwell', 9, 2, -1); // control room <-> B

// ---------------------------------------------------------------- basement (z-1)
m.tile('room_large', 7, 1, -1); // B site
m.tile('stairs', 4, 1, -1, 3); // stair block: yard (north, z0) down south to the tunnel
m.tile('corner', 4, 0, -1); // north and east
m.tile('corridor', 5, 0, -1, 1).tile('corridor_windows', 6, 0, -1, 1);
m.tile('corner', 7, 0, -1, 3); // west and north, into B

// ---------------------------------------------------------------- roof and gallery (z1)
m.tile('stairs_open', 4, 6, 0); // up from the yard (west) onto the roof (east)
for (const y of [3, 4, 5, 6]) m.tile('platform_rail', 5, y, 1);
m.tile('platform_rail', 6, 5, 1);
m.tile('drop', 7, 5, 1); // hatch into mini

// ---------------------------------------------------------------- walls
m.edge(5, 3, 0, 'N', 'wall'); // squeaky and lobby are separate rooms
m.edge(5, 4, 0, 'E', 'windows'); // lobby looks into A
m.edge(7, 5, 0, 'S', 'windows'); // mini looks into A
m.edge(7, 3, 0, 'S', 'window'); // control room looks into A
m.edge(8, 1, 0, 'S', 'wall'); // one garage door into control
m.edge(7, 1, 0, 'S', 'wide');
m.edge(5, 3, 1, 'E', 'window'); // roof -> heaven: one door, windows either side
m.edge(6, 5, 1, 'S', 'windows');
m.edge(7, 5, 1, 'S', 'wall');
m.edge(4, 4, 0, 'E', 'wide'); // lobby doors
m.edge(4, 2, 0, 'E', 'wide'); // ramp room doors

// ---------------------------------------------------------------- spawns
// Embers: the west end of the yard. Tide: the control room and the corridor to A.
for (const [x, z, yaw] of [[-1, 15, P], [-1, 23, P], [-2, 33, P], [-1, 41, P], [7, 47, 2.2], [9, 13, 0.8], [6, 27, P]] as const) m.spawn([x, 0, z], yaw, embers);
for (const [x, z, yaw] of [[54, 6, 0], [60, 5, 0], [66, 7, -0.5], [54, 18, 0], [66, 18, -P], [60, 14, P], [66, 33, Math.PI]] as const) m.spawn([x, 0, z], yaw, tide);

// ---------------------------------------------------------------- pickups
// Power: railgun on the roof (contested from the yard stairs and from heaven), rockets halfway along the secret tunnel.
m.pickup('weapon_railgun', [40, 4, 36]);
m.pickup('weapon_rockets', [44, -4, 0]);
m.pickup('armor_large', [62, -4, 12]); // B site
m.pickup('health_large', [52, 0, 30]); // A floor
m.pickup('weapon_burst_rifle', [16, 0, 8]);
m.pickup('weapon_marksman', [22, 0, 30]); // inside the silo
m.pickup('weapon_auto_shotgun', [45, 0, 42]); // hut
m.pickup('weapon_smg', [40, 0, 26]); // squeaky
m.pickup('weapon_flak', [44, -2, 16]); // ramp room
m.pickup('weapon_lmg', [56, 4, 35]); // heaven, north gallery
m.pickup('weapon_sawed_off', [64, 0, 32]); // corridor to A
m.pickup('armor_small', [56, 0, 42]); // mini
m.pickup('armor_small', [8, 0, 47]); // yard north-west
m.pickup('health_small', [30, 0, 41]);
m.pickup('health_small', [40, 0, 0]); // garage lane
m.pickup('health_small', [72, -2, 16]); // stairwell landing side
m.pickup('health_small', [32, -4, 4]); // tunnel corner
m.pickup('ammo', [8, 0, 24]);
m.pickup('ammo', [60, 0, 10]);
m.pickup('ammo_explosive', [56, -4, 0]);
m.pickup('ammo_rifle', [44, 4, 42]); // roof
m.pickup('grenades', [24, 0, 12]);
m.pickup('grenades', [58, -4, 18]);

// ---------------------------------------------------------------- props
// The yard: container stacks, tanks and pallets.
m.prop('cargo_crate', [12, 0, 18], 0.1, 2).prop('factory_box', [14.5, 0, 15], 0.1, 1); // climbable stack
m.prop('cargo_crate', [30, 0, 14], P, 2);
m.prop('container_tall', [10, 0, 37], 0, 1.8).prop('container_tall', [13, 0, 38], 0.3, 1.2);
m.prop('hopper_tall', [10, 0, 47], 0, 1); // a tank in the north-west corner
m.prop('cargo_crate', [18, 0, 46], P, 1.6);
m.prop('factory_box_long', [34, 0, 33], P, 1.2);
m.prop('skip', [34, 0, 21], 0, 1.2);
m.prop('barrel', [26, 0, 9]).prop('barrel', [26.8, 0, 9.7]);
m.breakable('gas', [33, 0, 40]);
m.prop('lightpost', [3, 0, 30], P).prop('warning_sign', [35, 0, 15]).prop('cone', [33, 0, 17], 0, 1, false);
// Garage lane.
m.prop('cargo_crate', [36, 0, -2], P, 1.3).prop('barrier', [52, 0, 1]).prop('pipe_valve', [66, 0, -2.5]);
// Plant: control room, reactor hall, hut, mini, B and the tunnel.
m.prop('computer_bank', [62, 0, 18.4], Math.PI).prop('screen_panel', [54, 0, 18.5], Math.PI).prop('office_chair', [55, 0, 17], 0, 1, false);
m.prop('machine', [53, 0, 34], 0).prop('pipe_valve', [57, 0, 27]); // A: cover round the reactor floor
m.prop('crate_large', [46, 0, 37], 0.2);
m.breakable('generator', [59, 0, 43], P);
m.prop('hopper_tall', [60, -4, 15], 0, 0.8).prop('conveyor', [55, -4, 9], P).prop('barrier', [65, -4, 5]); // B
m.breakable('barrel', [66.5, -4, 18.5]);
m.prop('pipe_valve', [48, -4, 2.5]).prop('factory_box', [38, -4, -2]);
m.prop('metal_panel', [44, 4, 30], P); // roof cover
m.prop('crate_small', [42.5, 4, 46]);

m.bounds('invisible');
m.teams([5, 5]);
// Furniture in the bare rooms, for what they are in this theme.
m.furnish();
m.meta({
  description:
    'A cooling plant on the edge of a container yard, built in the spirit of the classic reactor-plant bomb map. Embers push in from the yard; Tide hold the control room between the two sites. Upstairs is the two-storey reactor hall with its gallery; downstairs, the coolant basement, reached by the ramp room, a long secret tunnel or the control stairwell. Climb onto the roof for the railgun and a hatch down into the plant.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [4, 12],
});
await m.save();
