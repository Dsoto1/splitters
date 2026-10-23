/**
 * Skyward Yard: floating decks in open space, joined by jump pads (homage to
 * Quake III's "The Longest Yard"). Fall off and you are gone. The railgun
 * waits on the highest perch, the rockets on the main deck.
 *
 *   level 2:            [N perch]                         (railgun)
 *   level 1:   [W tower]                [E tower]
 *   level 0:        [ main deck 5 × 3 ]
 *   level 2:            [S perch]                         (armour)
 */
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('skyward', 'Skyward Yard');
m.theme('station');
// Main deck: open platforms, railings only round the very ends.
m.fill('platform', -2, -1, 2, 1);
// Side towers a level up, and two perches two levels up, all railed.
for (const x of [-5, 5]) m.tile('platform_rail', x, 0, 1);
for (const y of [-4, 4]) m.tile('platform_rail', 0, y, 2);
// Pads: deck edge -> towers (west/east), deck middle -> perches (north/south), perches/towers back down by dropping.
const P = Math.PI / 2;
m.pad([-18, 0, 0], -P, 14, 17.5).pad([18, 0, 0], P, 14, 17.5);
m.pad([0, 0, 10], 0, 18, 15).pad([0, 0, -10], Math.PI, 18, 15);
// Cover on the deck.
m.prop('crate_large', [-6, 0, 4], 0.3).prop('crate_large', [6, 0, -4], -0.3).prop('crate_small', [8, 0, 6]).prop('crate_small', [-8, 0, -6]);
m.prop('metal_panel', [0, 0, 0], P);
// Spawns round the deck and on the towers.
for (const [x, z, yaw] of [[-12, -6, 0], [12, 6, Math.PI], [-12, 6, Math.PI], [12, -6, 0], [0, -6, 0], [0, 6, Math.PI]] as const) m.spawn([x, 0, z], yaw);
m.spawn([-40, 4, 0], P).spawn([40, 4, 0], -P);
// Weapons: power on the perches and towers, basics on the deck.
m.pickup('weapon_railgun', [0, 8, 32]).pickup('armor_large', [0, 8, -32]);
m.pickup('weapon_rockets', [0, 0, 6]).pickup('weapon_plasma', [-40, 4, 2]).pickup('weapon_disc_launcher', [40, 4, -2]);
m.pickup('weapon_shotgun', [-12, 0, 0]).pickup('weapon_burst_rifle', [12, 0, 0]).pickup('health_small', [-4, 0, -6]).pickup('health_small', [4, 0, 6]);
m.pickup('ammo_explosive', [-6, 0, -6]).pickup('ammo_cells', [6, 0, 6]).pickup('powerup_damage', [0, 0, -6]);
m.meta({
  description: 'Floating decks in open space, joined by jump pads. Ride the pads up to the towers and the high perches (railgun north, heavy armour south); fall off and you are gone. Homage to the classic arena in the sky.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 8],
});
await m.save();
