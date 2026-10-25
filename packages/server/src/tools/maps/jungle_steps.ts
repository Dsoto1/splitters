/**
 * Jungle Steps: two temple camps at either end of an overgrown ruin, split by
 * a river gorge (homage in spirit to Counter-Strike's "Aztec"). Three ways
 * across: the long high bridge over the ravine in the west (sniper rifle in
 * the middle, an 8 m fall into the gorge if you get knocked off), the stone
 * "double doors" causeway in the middle with the river running underneath
 * it, and the sunken river route in the east, reached by stair blocks at
 * both ends (rocket launcher in the culvert, heavy armour in the nook).
 * The map is mirrored north/south, so both teams get the same deal.
 *
 * Ground level z0 (grid x east, y north; one cell = 8 m). Upper level z1 in
 * [brackets], the sunken river z-1 as ~ (S = stair block down to it):
 *
 *   y10  .   T   T   T   T   .   .   .     T  Tide camp (north)
 *    9   .  T   T   T   T   c   y   .
 *    8   .  st  ru  R   y   .   y   .     st open stairs up to the bridge
 *    7   .  r[p] r   r   y   h   y   .     r  rim, p  bridge head, h  ruin hut
 *    6   ~   ~[b]~   r   y   r   S   .
 *    5   ~   ~[b]~   ~   D   ~   ~   ~     D  double doors over the river
 *    4   ~   ~[b]~   r   y   r   S   .     b  high bridge (z1) over the ravine
 *    3   .  r[p] r   r   y   h   y   .
 *    2   .  st  ru  R   y   .   y   .     R  antechamber, ru ruins
 *    1   .  E   E   E   E   c   y   .     c  tunnel to the river path
 *    0   .  E   E   E   W   .   .   .     E  Embers camp (south), W watchtower
 *        0   1   2   3   4   5   6   7
 */
import type { Rotation, Side } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('jungle_steps', 'Jungle Steps');
m.theme('ruins');
const [embers, tide] = m.teamIds() as [string, string];

// The map mirrors across y = 5 (world z = 40): south half as written, north half flipped.
const MY = 10;
const flipRot = (r: Rotation): Rotation => ((r + 2) % 4) as Rotation;
const flipSide = (s: Side): Side => (s === 'N' ? 'S' : s === 'S' ? 'N' : s);
const P = Math.PI / 2;
const pair = (kind: string, x: number, y: number, z = 0, rot: Rotation = 0) => {
  m.tile(kind, x, y, z, rot);
  m.tile(kind, x, MY - y, z, flipRot(rot));
};
const edges = (x: number, y: number, z: number, side: Side, style: Parameters<MapBuilder['edge']>[4]) => {
  m.edge(x, y, z, side, style);
  m.edge(x, MY - y, z, flipSide(side), style);
};
type V3 = [number, number, number];
const mirror = (p: V3): V3 => [p[0], p[1], 80 - p[2]];
const both = (fn: (p: V3, yaw: number, north: boolean) => void, p: V3, yaw = 0) => {
  fn(p, yaw, false);
  fn(mirror(p), Math.PI - yaw, true);
};

// ---------------------------------------------------------------- camps (z0)
pair('yard', 1, 0);
pair('yard_ruins', 2, 0, 0, 1);
pair('yard', 3, 0);
pair('tower', 4, 0); // lookout along the east side
pair('yard_crates', 1, 1, 0, 3);
pair('yard', 2, 1);
pair('terrace', 3, 1, 0, 1); // a 1 m stone step-up on the east side of the camp
pair('yard', 4, 1);

// ---------------------------------------------------------------- west: stairs up to the high bridge
pair('stairs_open', 1, 2, 0, 3); // climbs from the camp (south) to the bridge head (north)
pair('platform_rail', 1, 3, 1); // bridge head, roofing the rim below
m.tile('bridge', 1, 4, 1).tile('bridge', 1, 5, 1).tile('bridge', 1, 6, 1);

// ---------------------------------------------------------------- the rim of the gorge and the middle lane (z0)
pair('yard_ruins', 2, 2);
pair('room_pillar', 3, 2); // antechamber: four doors
pair('yard', 4, 2);
pair('yard', 1, 3); // under the bridge head
pair('terrace', 2, 3); // stone step-up overlooking the ravine
pair('yard', 3, 3);
pair('yard_wall', 4, 3, 0, 1);
pair('yard', 3, 4);
pair('yard', 4, 4);
pair('yard', 5, 4);
m.tile('corridor_clear', 4, 5); // the double doors causeway, river underneath

// ---------------------------------------------------------------- east: tunnel, river path and the ruin hut (z0)
pair('corridor', 5, 1, 0, 1);
pair('yard', 6, 1);
pair('yard_crates', 6, 2, 0, 2);
pair('yard', 6, 3);
pair('room_columns', 5, 3); // ruin hut, four columns

// ---------------------------------------------------------------- the gorge and the river (z-1)
for (const x of [0, 1, 2]) pair('yard', x, 4, -1);
for (let x = 0; x <= 7; x++) m.tile(x === 1 ? 'yard_ruins' : 'yard', x, 5, -1);
pair('stairs', 6, 4, -1, 1); // stair blocks: river (north) up to the east path (south)

// ---------------------------------------------------------------- walls
// Low stone parapets along the gorge, with a gap to drop in on each side.
edges(1, 3, 0, 'N', 'half');
edges(2, 3, 0, 'N', 'half');
edges(3, 4, 0, 'W', 'open');
edges(3, 4, 0, 'N', 'half');
edges(5, 4, 0, 'N', 'half');
// Windows out of the causeway along the river; arches and low walls to break up the rim.
m.edge(4, 5, 0, 'E', 'window').edge(4, 5, 0, 'W', 'window');
edges(3, 3, 0, 'E', 'half');
edges(3, 4, 0, 'E', 'arch');
edges(2, 2, 0, 'E', 'arch');
edges(4, 2, 0, 'S', 'wide');
// Windows out of the antechamber and the ruin hut over the lanes.
edges(5, 3, 0, 'W', 'window');
edges(3, 2, 0, 'N', 'arch');

// ---------------------------------------------------------------- spawns: Embers south, Tide north
const camp: [number, number, number][] = [
  [6, -2, 0.2],
  [14, -1, 0],
  [24, -1, -0.2],
  [7, 10, 0.3],
  [17, 10, 0],
  [33, 10, -0.4],
];
for (const [x, z, yaw] of camp) {
  m.spawn([x, 0, z], yaw, embers);
  m.spawn(mirror([x, 0, z]), Math.PI - yaw, tide);
}

// ---------------------------------------------------------------- pickups
// Contested power: sniper rifle mid-bridge, rockets in the culvert under the causeway, heavy armour in the river nook.
m.pickup('weapon_sniper', [8, 4, 40]);
m.pickup('weapon_rockets', [32, -4, 40]);
m.pickup('armor_large', [58, -4, 40]);
m.pickup('health_large', [8, -4, 40]); // bottom of the gorge, under the bridge
m.pickup('ammo_explosive', [44, -4, 40]);
const sideItems: [string, V3][] = [
  ['weapon_burst_rifle', [16, 0, 16]], // ruins by the stairs
  ['weapon_sawed_off', [24, 0, 18]], // antechamber
  ['weapon_marksman', [8, 4, 25]], // bridge head
  ['weapon_smg', [48, 0, 16]], // east path
  ['ammo_sniper', [8, 0, 24]], // under the bridge head
  ['health_small', [26, 0, 30]], // rim
  ['health_small', [48, 0, 6]], // east yard
  ['armor_small', [38, 0, 24]], // ruin hut
  ['grenades', [32, 0, 30]], // middle lane
  ['ammo', [16, 0, 7]], // camp
  ['health_small', [0, -4, 32]], // gorge corner
];
for (const [item, p] of sideItems) both((q) => m.pickup(item, q), p);

// ---------------------------------------------------------------- props: jungle, rocks and fallen stones
const solid: [string, V3, number, number][] = [
  ['palm', [3, 0, 3], 0, 1],
  ['tree_tall', [30, 0, -2.5], 0, 1],
  ['rock_large', [27, 0, 3], 0.5, 1],
  ['column', [12, 0, 27], 0, 1], // broken column on the rim
  ['stone_wall_damaged', [21, 0, 28], 0, 1.2],
  ['rocks_tall', [3, -4, 35], 0.4, 0.8], // gorge
  ['rock_large', [14, -4, 34], 1.2, 1.3],
  ['log', [13, -4, 37], 0.4, 1.2],
  ['palm_bent', [49, 0, 21], 2.4, 1],
  ['crate_large', [54, 0, 10], 0.2, 1],
  ['stone_wall', [36, 0, 33], P, 1],
  ['obelisk', [36, 0, 16], 0, 1],
  ['pillar', [6, 0, 30], 0, 1],
  ['stump', [44, 0, 9], 0, 1],
];
for (const [model, p, yaw, scale] of solid) both((q, yw) => m.prop(model, q, yw, scale), p, yaw);
const dressing: [string, V3, number][] = [
  ['grass_tuft', [10, 0, 2], 0],
  ['plant_small', [20, 0, 5], 0],
  ['grass_tuft', [30, 0, 33], 1],
  ['plant_small', [46, 0, 30], 0],
  ['grass_tuft', [18, -4, 30], 0],
  ['lantern', [26, 0, 14], 0],
];
for (const [model, p, yaw] of dressing) both((q, yw) => m.prop(model, q, yw, 1, false), p, yaw);
// The river: reeds and a sunk boat in the middle.
m.prop('rowboat', [44, -4, 41], 1.4).prop('rock_medium', [52, -4, 38]).prop('rock_medium', [20, -4, 42]);
m.prop('rocks_tall', [14, -4, 45], 2, 0.7);
m.prop('grass_tuft', [24, -4, 38], 0, 1, false).prop('grass_tuft', [38, -4, 42], 0, 1, false);

m.bounds('invisible');
m.teams([5, 5]);
// Furniture in the bare rooms, for what they are in this theme.
m.furnish();
m.lightRooms();
m.meta({
  description:
    'An overgrown temple ruin split by a river gorge, made in the spirit of the classic jungle-temple bomb map. Embers camp in the south, Tide in the north. Cross by the long high bridge over the ravine (sniper rifle halfway, an 8 m fall if you get knocked off), the stone double-doors causeway in the middle, or the sunken river route through the gorge, reached by stair blocks at either end, where rockets wait in the culvert and heavy armour in the far nook.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [4, 12],
});
await m.save();
