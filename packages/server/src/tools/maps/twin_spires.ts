/**
 * Twin Spires: a long, narrow causeway hanging in open space with a spire at
 * each end (homage in spirit to the classic tower-versus-tower sniping map
 * floating above a planet). Each team spawns in its own spire: three storeys
 * of rooms linked by switchback stairwells, windows facing the enemy, and a
 * railed sniper deck on top (sniper rifle there, marksman rifle a floor down).
 * Between the spires a single lane runs out to a raised bridge with ramps at
 * both ends; two flanking walkways pass under and beside it. No walls, no
 * railings on the causeway: step off the edge and the void takes you.
 * Railgun on top of the bridge, rocket launcher underneath it.
 *
 * Grid x east, y north (one cell = 8 m). Spires are four storeys (z0 rooms, z1 rooms,
 * z2 rooms, z3 deck), stairwells T alternate north/south of the central room column.
 *
 *   y1   T  p  .  .  w  w  w  w  w  w  w  w  w  .  .  p  T
 *   y0   S  p  l  l  l  R  R  B  B  B  R  R  l  l  l  p  S     B bridge (z1) over an underpass (z0)
 *   y-1  T  p  .  .  w  w  w  w  w  w  w  w  w  .  .  p  T     R ramps up to the bridge, w walkways
 *       -8 -7 -6 -5 -4 -3 -2 -1  0  1  2  3  4  5  6  7  8     S spire room column, p plaza, l lane
 */
import type { Side } from '@chronosplit/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('twin_spires', 'Twin Spires');
m.theme('station');
m.teams([8, 8]);
const [west, east] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;

// ---------------------------------------------------------------- the spires
for (const sx of [-8, 8]) {
  const front: Side = sx < 0 ? 'E' : 'W';
  const back: Side = sx < 0 ? 'W' : 'E';
  // Room column (z0-z2), an armoury beside the ground floor, three stairwells winding up.
  for (const z of [0, 1, 2]) m.tile('room', sx, 0, z);
  m.tile('room', sx, -1, 0);
  m.tile('stairwell', sx, 1, 0, 3); // z0 -> z1, doors south
  m.tile('stairwell', sx, -1, 1, 1); // z1 -> z2, doors north
  m.tile('stairwell', sx, 1, 2, 3); // z2 -> z3, doors south onto the deck
  // Sniper deck on top.
  m.tile('platform_rail', sx, 0, 3).tile('platform_rail', sx, -1, 3);
  // Openings: a wide doorway out of the ground floor, windows up the face, slits at the back.
  m.edge(sx, 0, 0, front, 'wide');
  m.edge(sx, 0, 1, front, 'windows').edge(sx, 0, 2, front, 'window');
  m.edge(sx, 0, 1, back, 'slit').edge(sx, 0, 2, back, 'slit').edge(sx, -1, 0, back, 'slit');
  for (const z of [0, 1, 2]) m.edge(sx, 1, z, front, 'slit');
  // Plaza in front of the spire.
  m.fill('platform', sx + Math.sign(-sx), -1, sx + Math.sign(-sx), 1);
}

// ---------------------------------------------------------------- the causeway
m.fill('platform', -6, 0, -5, 0).fill('platform', 5, 0, 6, 0);
m.fill('platform', -4, -1, 4, -1).fill('platform', -4, 1, 4, 1);
m.tile('platform', -4, 0).tile('platform', 4, 0);
// Ramps up to the bridge, the bridge, and the underpass below it.
m.tile('ramp', -3, 0, 0, 0).tile('ramp', 3, 0, 0, 2);
m.fill('platform', -1, 0, 1, 0, 1);
m.fill('platform', -1, 0, 1, 0, 0);
// Ramps are open-sided: no walls between them and the walkways.
for (const x of [-3, -2, 2, 3]) for (const z of [0, 1]) m.edge(x, 0, z, 'N', 'open').edge(x, 0, z, 'S', 'open');
m.edge(-3, 0, 1, 'W', 'open').edge(-2, 0, 0, 'E', 'open').edge(3, 0, 1, 'E', 'open').edge(2, 0, 0, 'W', 'open');
// No door frames where the ramps meet the lane and the bridge.
m.edge(-3, 0, 0, 'W', 'open').edge(-2, 0, 1, 'E', 'open').edge(3, 0, 0, 'E', 'open').edge(2, 0, 1, 'W', 'open');

// ---------------------------------------------------------------- spawns (each team in its own spire)
for (const [team, sx, face] of [[west, -8, P], [east, 8, -P]] as const) {
  const X = sx * 8;
  const d = Math.sign(sx);
  m.spawn([X - d * 1, 0, -2], face, team).spawn([X, 0, -10], face, team).spawn([X + d * 2, 4, 1], face, team);
  m.spawn([X + d * 2, 8, 1], face, team).spawn([X - d * 8, 0, -10], face, team).spawn([X - d * 8, 0, 10], face, team);
  m.spawn([X - d * 8, 0, 0], face, team);
}

// ---------------------------------------------------------------- pickups
for (const sx of [-8, 8]) {
  const X = sx * 8;
  const d = Math.sign(sx);
  // Deck: sniper rifle and rounds. Top room: marksman rifle.
  m.pickup('weapon_sniper', [X, 12, -4]).pickup('ammo_sniper', [X, 12, -10]).pickup('health_small', [X, 12, 2]);
  m.pickup('weapon_marksman', [X - d * 2, 8, -2]).pickup('armor_small', [X + d * 2, 4, -2]);
  // Armoury and plaza basics.
  m.pickup('weapon_rifle', [X, 0, -6]).pickup('ammo_rifle', [X + d * 2, 0, -10]).pickup('grenades', [X - d * 2, 0, -10]);
  m.pickup('weapon_smg', [X - d * 8, 0, 6]).pickup('health_small', [X - d * 8, 0, -6]);
  // Lane: shotgun halfway out.
  m.pickup('weapon_shotgun', [X - d * 20, 0, 0]).pickup('ammo_shells', [X - d * 28, 0, 10]);
}
// Contested middle: railgun on the bridge, rockets under it, armour and health on the walkways.
m.pickup('weapon_railgun', [0, 4, 0]).pickup('weapon_rockets', [0, 0, 0]);
m.pickup('ammo_explosive', [-8, 0, -1]).pickup('ammo_explosive', [8, 0, 1]);
m.pickup('armor_large', [0, 0, 8]).pickup('health_large', [0, 0, -8]);
m.pickup('ammo_sniper', [-16, 0, 10]).pickup('ammo_sniper', [16, 0, -10]);

// ---------------------------------------------------------------- props
// Bridge top: two low barriers; underpass and walkways: crates and panels.
m.prop('barrier', [-4, 4, 1.5]).prop('barrier', [4, 4, -1.5]);
m.prop('cargo_crate', [-5, 0, 1], 0.2).prop('cargo_crate', [5, 0, -1], -0.2);
m.prop('metal_panel', [-14, 0, 9], 0).prop('metal_panel', [14, 0, -9], 0);
m.prop('container', [-24, 0, -10]).prop('container', [24, 0, 10]).prop('crate_large', [-26, 0, 9], 0.3).prop('crate_large', [26, 0, -9], -0.3);
m.prop('barrier_high', [-8, 0, 10]).prop('barrier_high', [8, 0, -10]);
m.prop('crate_small', [-30, 0, 2]).prop('crate_small', [30, 0, -2]).prop('container_tall', [-44, 0, -1.5]).prop('container_tall', [44, 0, 1.5]);
for (const sx of [-8, 8]) {
  const X = sx * 8;
  const d = Math.sign(sx);
  // Plaza cover and spire dressing.
  m.prop('barrier', [X - d * 10, 0, -3]).prop('barrier', [X - d * 10, 0, 3]).prop('cargo_crate', [X - d * 7, 0, 9], 0.4);
  // Spire furniture stands against the outer wall, clear of the stairwell doorways (north and south).
  m.prop('flag', [X - d * 2.5, 12, -11], d > 0 ? -P : P, 1, false).prop('screen_panel', [X + d * 3, 4, 0], -d * P).prop('computer_bank', [X + d * 2.2, 0, 2.5], -d * P);
  m.prop('holo_table', [X + d * 2.4, 8, 0]).prop('space_chair', [X + d * 1.6, 4, 1.6]).prop('container_wide', [X + d * 2.5, 0, -6]);
}

// ---------------------------------------------------------------- objectives
// Capture the Flag: each team's flag stands on the plaza at the foot of its own spire.
m.flag(west, [-54, 0, 0], P).flag(east, [54, 0, 0], -P);
// King of the Hill: the bridge, the north walkway, the underpass, the south walkway.
m.hill([0, 4, 0], 4).hill([-16, 0, 8], 4).hill([0, 0, 0], 4).hill([16, 0, -8], 4);

m.lightRooms();
m.meta({
  description:
    'Two spires at either end of a narrow causeway hanging in open space. Each team spawns in its own spire, climbs the switchback stairwells past the windows to a railed sniper deck, and fights for the railgun on the central bridge and the rockets beneath it. No walls and no railings on the causeway: one step too far and the void takes you. An homage in spirit to the classic tower-to-tower sniping duel above a planet.',
  modes: ['core.tdm', 'core.deathmatch', 'core.ctf', 'core.koth'],
  players: [4, 14],
});
await m.save();
