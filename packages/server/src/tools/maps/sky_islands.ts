/**
 * Sky Islands: five grassy islands floating over snowy peaks, built entirely
 * from free blocks. Shows off the set pieces: crumbling stepping-stone
 * bridges, a plank bridge that holds, a swimming pond sunk into the middle
 * island, a lava pit under trapdoors guarding the railgun, breakable cover,
 * jetpacks and a jump pad up to a sky platform. Fall off and you are gone.
 *
 *                 [N island]  jetpack
 *                      : crumbling stones
 *   [W island] :::: [ centre ] ==== [E island]
 *   lava pit,  crumble  pond,   planks   rockets
 *   trapdoors,          sky platform above
 *   railgun            : crumbling stones
 *                 [S island]  jetpack, sniper
 */
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('sky_islands', 'Sky Islands');
m.theme('garden');
m.backdrop('clear', 'peaks', 'none', 0.45);

const GRASS = 'pbr_grass';
const ROCK = 'pbr_rock';

/** An island block: rock underneath, a grass cap on top. `top` is the walking height. */
const land = (x: number, z: number, w: number, d: number, top: number, depth = 3) => {
  m.block([x, top - depth, z], [w, depth - 0.4, d], 'solid', { material: ROCK });
  m.block([x, top - 0.4, z], [w, 0.4, d], 'solid', { material: GRASS });
};

/** An island with a square hole in the middle (for a pond or a pit), from four pieces. */
const ring = (x: number, z: number, size: number, hole: number, top: number) => {
  const side = (size - hole) / 2;
  land(x - (hole + side) / 2, z, side, size, top);
  land(x + (hole + side) / 2, z, side, size, top);
  land(x, z - (hole + side) / 2, hole, side, top);
  land(x, z + (hole + side) / 2, hole, side, top);
};

// The centre island (top 3 m) with a pond sunk into it: swim in, hop out at the edge.
ring(0, 0, 22, 8, 3);
m.block([0, 0, 0], [8, 0.5, 8], 'solid', { material: 'pbr_travertine' });
m.water([0, 0.5, 0], [8, 2.3, 8], 'water');

// The outer islands.
land(0, 40, 18, 18, 4); // north
land(0, -40, 18, 18, 2); // south
land(40, 0, 18, 18, 3); // east
// West: a lava pit under four trapdoors, with steps to climb out (if you're quick).
ring(-40, 0, 18, 6, 3);
m.block([-40, -0.5, 0], [6, 0.5, 6], 'solid', { material: 'pbr_charred_wood' });
m.water([-40, 0, 0], [6, 1, 6], 'lava');
m.block([-42.2, 0, -2.2], [1.6, 1.1, 1.6], 'solid', { material: ROCK }).block([-42.2, 0, 2.2], [1.6, 2.1, 1.6], 'solid', { material: ROCK });
for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]] as const) m.block([-40 + dx, 2.7, dz], [3, 0.3, 3], 'trapdoor', { material: 'pbr_planks', delay: 0.15, respawn: 6 });

// Bridges: crumbling stepping stones north, south and west; solid planks east.
const stones = (from: [number, number, number], to: [number, number, number], n: number) => {
  // Evenly from edge to edge, so each stone nearly touches the next.
  for (let i = 1; i <= n; i++) {
    const t = (i - 0.5) / n;
    const top = from[1] + (to[1] - from[1]) * t;
    m.block([from[0] + (to[0] - from[0]) * t, top - 0.5, from[2] + (to[2] - from[2]) * t], [3.2, 0.5, 3.2], 'crumble', { material: 'pbr_castle_stone', delay: 0.9, respawn: 6 });
  }
};
stones([0, 3, 11], [0, 4, 31], 6);
stones([0, 3, -11], [0, 2, -31], 6);
stones([-11, 3, 0], [-31, 3, 0], 6);
m.block([21, 2.6, 0], [20, 0.4, 3], 'solid', { material: 'pbr_planks' });

// A sky platform over the pond, reached by the jump pad on the north side or by jetpack.
m.block([0, 12, 0], [6, 0.5, 6], 'solid', { material: 'pbr_marble_black' });
m.padTo([0, 3, 8], [0, 12, 1], 21);
// Pads home from the outer islands.
m.padTo([0, 4, 33], [6, 3, 7], 12).padTo([0, 2, -33], [-6, 3, -7], 13);

// Breakable cover.
for (const [x, z, yaw] of [[-6, 9, 0], [6, -9, 0], [44, -4, 0.4], [36, 5, -0.3], [-4, 44, 0.2], [4, -44, -0.2]] as const) m.block([x, x === 44 || x === 36 ? 3 : z > 30 ? 4 : z < -30 ? 2 : 3, z], [2.4, 1.2, 1], 'breakable', { material: 'pbr_planks', yaw, health: 90, respawn: 20 });
m.prop('pine_small', [-6, 4, 46]).add({ kind: 'prop', model: 'prop.bush_large', position: [5, 4, 36], yaw: 0, scale: 1, solid: false, tint: '#b8c878' }).prop('tree_round', [44, 3, 6]).prop('bush_leafy', [-47, 3, -8], 0.5, 1, false);

// Spawns: two per outer island, two on the centre.
const P = Math.PI;
for (const [x, y, z, yaw] of [[-5, 4, 42, P], [5, 4, 44, P], [-5, 2, -42, 0], [5, 2, -44, 0], [42, 3, -5, -P / 2], [44, 3, 4, -P / 2], [-44, 3, -6, P / 2], [-44, 3, 6, P / 2], [-8, 3, -8, 0.8], [8, 3, 8, -2.3]] as const) m.spawn([x, y, z], yaw);

// Items: jetpacks on the far islands, power weapons on the risky spots.
m.pickup('jetpack', [0, 4, 46]).pickup('jetpack', [0, 2, -46]);
m.pickup('weapon_railgun', [-40, 3, 0]).pickup('weapon_rockets', [44, 3, 0]).pickup('weapon_sniper', [6, 2, -40]);
m.pickup('powerup_damage', [0, 12.5, 0]).pickup('armor_large', [-6, 4, 40]);
m.pickup('weapon_shotgun', [8, 3, -2]).pickup('weapon_smg', [-8, 3, 2]).pickup('weapon_flamethrower', [40, 3, -6]);
m.pickup('health_small', [0, 3, 9]).pickup('health_small', [0, 3, -9]).pickup('ammo_explosive', [42, 3, 6]).pickup('ammo_sniper', [-4, 2, -40]);
// Team bases at each end (spawns and a flag), hills through the middle.
await m.teamBases(5);
m.meta({
  description: 'Five grassy islands floating over the peaks, joined by crumbling stepping stones and one plank bridge that holds. Swim in the centre pond, ride the pad to the sky platform for double damage, grab a jetpack on the far islands, and think twice before stepping on the trapdoors over the lava for the railgun.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 10],
});
await m.save();
