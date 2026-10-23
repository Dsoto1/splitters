/**
 * Gallows Yard: a walled castle courtyard full of tomb blocks, with a gallows
 * platform in the middle (homage in spirit to Halo's "Hang 'Em High"). Each
 * team holds a two-storey gatehouse at one end; its roof joins a raised
 * walkway that runs the length of the far wall, over a covered arcade, and is
 * broken halfway by a narrow bridge. Open stairs climb from the courtyard to
 * the walkways, and from the arcades up onto the gallows in the middle (jump
 * pads throw you up there from the sides), where the railgun waits above the
 * crypt that hides the rocket launcher. The map is
 * rotationally symmetric, so both teams get the same deal.
 *
 * Ground z0 (grid x east, y north; one cell = 8 m), walkways z1 in [brackets]:
 *
 *   y4   c[w]  a[w]  a[w]  a[w]  a[=]  a[w]  a[w]  a[w]  S       S stairwell (z0-1) up to the gatehouse roof
 *   y3   G[r]  t     s/    r     s|    T     s/    w     G[r]    G gatehouse rooms, roof [r] above
 *   y2   D[r]  y     r     y     g[G]  y     r     y     D[r]    D dais room, g crypt under the gallows [G]; pads either side
 *   y1   G[r]  w     s/    T     s|    r     s/    t     G[r]    s/ open stairs up to the walkway
 *   y0   S     a[w]  a[w]  a[w]  a[=]  a[w]  a[w]  a[w]  c[w]    a arcade under the walkway, [=] bridge
 *        0     1     2     3     4     5     6     7     8       s| stairs up to the gallows, T terrace, r ruins, t crates
 *
 * Embers hold the west gatehouse, Tide the east one.
 */
import type { EdgeStyle, Rotation, Side } from '@chronosplit/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('gallows_yard', 'Gallows Yard');
m.theme('castle');
const [embers, tide] = m.teamIds() as [string, string];
const P = Math.PI / 2;

// Half-turn symmetry about the centre cell (4, 2) = world (32, 16).
const turnRot = (r: Rotation): Rotation => ((r + 2) % 4) as Rotation;
const turnSide: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };
const pair = (kind: string, x: number, y: number, z = 0, rot: Rotation = 0) => {
  m.tile(kind, x, y, z, rot);
  m.tile(kind, 8 - x, 4 - y, z, turnRot(rot));
};
const edges = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => {
  m.edge(x, y, z, side, style);
  m.edge(8 - x, 4 - y, z, turnSide[side], style);
};
type V3 = [number, number, number];
const turn = (p: V3): V3 => [64 - p[0], p[1], 32 - p[2]];
const twice = (fn: (p: V3, yaw: number, second: boolean) => void, p: V3, yaw = 0) => {
  fn(p, yaw, false);
  fn(turn(p), yaw + Math.PI, true);
};

// ---------------------------------------------------------------- gatehouses
pair('room', 0, 1);
pair('room_dais', 0, 2, 0, 3); // steps face the courtyard
pair('room', 0, 3);
pair('stairwell', 0, 0, 0, 1); // doors north on both floors
for (const y of [1, 2, 3]) pair('platform_rail', 0, y, 1); // the gatehouse roof
pair('yard', 0, 4); // arcade corner, the gatehouse's side door

// ---------------------------------------------------------------- the courtyard
for (let x = 1; x <= 7; x++) pair('yard', x, 4); // arcades along both long walls (and the far ones by symmetry)
const row1: [string, Rotation][] = [
  ['yard_wall', 1],
  ['stairs_open', 1], // up south onto the walkway
  ['terrace', 2],
  ['stairs_open', 3], // up north onto the gallows
  ['yard_ruins', 0],
  ['stairs_open', 1],
  ['yard_crates', 1],
];
row1.forEach(([kind, rot], i) => pair(kind, i + 1, 1, 0, rot));
pair('yard', 1, 2);
pair('yard_ruins', 2, 2, 0, 1);
pair('yard', 3, 2);
m.tile('yard', 4, 2); // under the gallows

// ---------------------------------------------------------------- walkways and the gallows (z1)
for (const x of [0, 1, 2, 3, 5, 6, 7]) pair('platform_rail', x, 4, 1);
pair('bridge', 4, 4, 1, 1);
m.tile('platform_rail', 4, 2, 1); // the gallows

// ---------------------------------------------------------------- walls
for (let x = 0; x <= 7; x++) edges(x, 4, 1, 'N', 'wall'); // outer wall above the arcade
edges(0, 4, 1, 'W', 'wall');
for (const y of [1, 2, 3]) {
  edges(0, y, 1, 'W', 'wall');
  edges(0, y, 0, 'E', 'arch');
}
for (const x of [2, 4, 6]) {
  edges(x, 1, 0, 'E', 'open'); // open stairs stand free in the courtyard
  edges(x, 1, 0, 'W', 'open');
}
m.edge(4, 2, 1, 'E', 'open').edge(4, 2, 1, 'W', 'open'); // drop off the gallows sideways
m.edge(4, 2, 0, 'E', 'arch').edge(4, 2, 0, 'W', 'arch'); // the crypt under the gallows

// ---------------------------------------------------------------- jump pads up onto the gallows, from either side
twice((q, yaw) => m.pad(q, yaw, 16, 9.3), [20, 0, 16], P);

// ---------------------------------------------------------------- spawns: Embers west gatehouse, Tide east
const gate: [number, number, number, number][] = [
  [-2, 0, 7, P],
  [2, 0, 9, P],
  [2.5, 0, 13, P],
  [-2, 0, 23, P],
  [2, 0, 25, P],
  [-1, 4, 9, P],
  [-1, 4, 22, P],
];
for (const [x, y, z, yaw] of gate) {
  m.spawn([x, y, z], yaw, embers);
  m.spawn(turn([x, y, z]), yaw + Math.PI, tide);
}

// ---------------------------------------------------------------- pickups
m.pickup('weapon_railgun', [32, 4, 16]); // on the gallows
m.pickup('weapon_rockets', [32, 0, 16]); // under it
const items: [string, V3][] = [
  ['armor_small', [32, 4, 32]], // on the bridge
  ['health_large', [32, 0, 32]], // under the bridge
  ['weapon_sawed_off', [12, 0, 1]], // arcade
  ['weapon_burst_rifle', [0, 0, 27]], // gatehouse
  ['weapon_marksman', [8, 4, 32]], // walkway by the home gatehouse
  ['weapon_plasma', [40, 4, 32]], // walkway near the far end
  ['health_small', [11, 0, 16]],
  ['health_small', [-1, 4, 16]], // gatehouse roof
  ['ammo', [-2, 0, 16]],
  ['grenades', [26, 0, 20]],
  ['ammo_explosive', [44, 0, 31]],
  ['ammo_cells', [20, 4, 0]],
];
for (const [item, p] of items) twice((q) => m.pickup(item, q), p);

// ---------------------------------------------------------------- tomb blocks, colonnade and dressing
const tombs: [string, V3, number, number][] = [
  ['crypt', [23, 0, 11], 0, 0.9], // tall tomb by the terrace
  ['stone_wall', [10, 0, 12], P, 2], // slab in front of the gatehouse
  ['crypt', [25, 0, 25], 0.2, 0.35], // low step
  ['gravestone_cross', [15, 0, 16], P, 2.5],
  ['crypt', [9, 0, 21], 0, 0.6], // chest-high block
  ['gravestone_round', [27, 0, 10], 0, 2.2],
  ['obelisk', [6, 0, 31], 0, 1], // arcade corner
  ['column', [24, 0, 29.5], 0, 1], // colonnade
  ['column', [8, 0, 29.5], 0, 1],
  ['coffin_old', [21, 0, 3], P, 1],
];
for (const [model, p, yaw, scale] of tombs) twice((q, yw) => m.prop(model, q, yw, scale), p, yaw);
const dressing: [string, V3, number][] = [
  ['banner', [3.6, 4, 16], -P], // on the gatehouse roof
  ['fire_basket', [-2.2, 0, 2], 0],
  ['candles', [0, 0.75, 16.5], 0],
  ['grave', [16, 0, 30], 0],
  ['lantern', [28, 0, 33], 0],
];
for (const [model, p, yaw] of dressing) twice((q, yw) => m.prop(model, q, yw, model === 'fire_basket' ? 0.6 : 1, model === 'fire_basket'), p, yaw);
m.prop('flag', [35, 4, 19], 0, 0.8, false); // on the gallows

m.bounds('invisible');
m.teams([4, 4]);
m.meta({
  description:
    "A walled castle courtyard crowded with tomb blocks of every height, made in the spirit of the classic tombstone-courtyard arena. Embers and Tide each hold a gatehouse at one end; its roof runs into a raised walkway along the far wall, over a covered arcade and across a narrow bridge. Open stairs climb out of the graves, and jump pads throw you up onto the gallows in the middle, where the railgun waits above the rocket launcher.",
  modes: ['core.tdm', 'core.deathmatch'],
  players: [2, 10],
});
await m.save();
