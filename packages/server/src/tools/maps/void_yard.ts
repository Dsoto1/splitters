/**
 * Void Yard: metal platforms adrift in space, joined only by jump pads
 * (homage in spirit to Quake III's The Longest Yard). Fall off and the void
 * takes you.
 *
 * - The yard (south): the big deck, with two pillars and a low wall for cover
 *   and pads out to everywhere else.
 * - The float (middle): a small deck in the line of fire, the rocket launcher
 *   on it, a pad up to the perch and one home.
 * - The perch (north, 10 m up): the railgun, looking down the whole yard; a pad
 *   drops you back to the deck.
 * - The wings (east and west, 4 m up): the team bases in team modes, a pad
 *   home and a pad up to the perch each.
 *
 * Top-down (x east, z north; metres):
 *
 *   z 44            [perch]
 *   z 20  [west]    [float]    [east]
 *   z -6        [   the yard   ]
 */
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('void_yard', 'Void Yard');
m.theme('station');
m.backdrop('space', 'none', 'none', 0.2);
m.teams([4, 4]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;

// Light metal: space gives little light, and dark decks vanish against it.
const DECK = { material: 'pbr_tread_plate', tint: '#d8dde6' };
const EDGE = { material: 'light_strip', tint: '#7fd8ff' };
/** A deck: a slab with its top at `top`, and a glowing strip round the rim. */
function deck(x: number, z: number, w: number, d: number, top: number): void {
  m.block([x, top - 2, z], [w, 2, d], 'solid', DECK);
  m.block([x, top - 2.4, z], [w - 1, 0.4, d - 1], 'solid', { material: 'pbr_steel' });
  for (const s of [-1, 1]) {
    m.block([x + s * (w / 2 - 0.1), top - 0.5, z], [0.2, 0.4, d], 'solid', EDGE);
    m.block([x, top - 0.5, z + s * (d / 2 - 0.1)], [w, 0.4, 0.2], 'solid', EDGE);
  }
}

deck(0, -6, 30, 22, 0); // the yard
deck(0, 20, 10, 8, 2); // the float
deck(0, 44, 9, 9, 10); // the perch
deck(28, 14, 10, 10, 4); // east wing
deck(-28, 14, 10, 10, 4); // west wing

// Cover on the yard.
for (const x of [-6, 6]) m.block([x, 0, -10], [2, 4, 2], 'solid', { material: 'pbr_white_panel', tint: '#b8c2d4' });
m.block([0, 0, -14], [8, 1.2, 1], 'solid', { material: 'pbr_white_panel', tint: '#b8c2d4' });
m.block([-11, 0, 0], [1, 1.2, 4], 'solid', { material: 'pbr_white_panel', tint: '#b8c2d4' }).block([11, 0, 0], [1, 1.2, 4], 'solid', { material: 'pbr_white_panel', tint: '#b8c2d4' });

// ---------------------------------------------------------------- the pads
m.padTo([0, 0, 2], [0, 2, 19], 14); // yard → float
m.padTo([0, 2, 22.5], [0, 10, 43], 20); // float → perch
m.padTo([3, 2, 17.5], [3, 0, -3], 9); // float → yard
m.padTo([0, 10, 40.5], [0, 0, -4], 18); // perch → yard
for (const s of [-1, 1]) {
  m.padTo([s * 12, 0, 2], [s * 27, 4, 13], 15); // yard → wing
  m.padTo([s * 24.5, 4, 10.5], [s * 8, 0, -4], 10); // wing → yard
  m.padTo([s * 30, 4, 18], [s * 2.5, 10, 44], 20); // wing → perch
}

// ---------------------------------------------------------------- spawns, bases, items
for (const [x, z, yaw] of [[-10, -12, 0.4], [10, -12, -0.4], [-12, -2, P], [12, -2, -P], [0, -16, 0], [0, 4, Math.PI]] as const) m.spawn([x, 0, z], yaw, null);
m.spawn([-2, 2, 21], 0, null).spawn([2, 10, 46], Math.PI, null);
for (const [s, team] of [[1, embers], [-1, tide]] as const) {
  for (const [dx, dz] of [[2, 16], [-2, 16], [2, 11], [-2, 11]] as const) m.spawn([s * 28 + s * dx, 4, dz], -s * P, team);
  m.flag(team, [s * 31, 4, 13], -s * P);
}
m.hill([0, 2, 20], 4).hill([0, 0, -6], 6).hill([0, 10, 44], 4);
m.pickup('weapon_railgun', [0, 10, 46]).pickup('ammo_cells', [-3, 10, 44]);
m.pickup('weapon_rockets', [0, 2, 20]).pickup('ammo_explosive', [-3, 0, -6]).pickup('ammo_explosive', [3, 0, -6]);
m.pickup('armor_large', [0, 0, -16.5]).pickup('powerup_damage', [-28, 4, 17], 90).pickup('powerup_speed', [28, 4, 17], 90);
m.pickup('weapon_shotgun', [-12, 0, -12]).pickup('weapon_smg', [12, 0, -12]).pickup('weapon_plasma', [0, 0, -9]);
m.pickup('health_small', [-8, 0, 2]).pickup('health_small', [8, 0, 2]).pickup('health_large', [0, 0, -2]);
m.pickup('armor_small', [-30, 4, 10]).pickup('armor_small', [30, 4, 10]).pickup('ammo', [-6, 0, -16]).pickup('ammo', [6, 0, -16]);

m.bounds('invisible');
m.meta({
  description:
    'Metal decks adrift in space, joined only by jump pads. Hold the yard, ride the pads out to the float for rockets, up to the perch for the railgun, or across to the wings; miss a landing and the void takes you.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 8],
});
await m.save();
