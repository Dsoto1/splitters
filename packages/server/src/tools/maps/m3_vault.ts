/**
 * The Vault, grown from a corridor of five rooms into a deathmatch map with
 * loops. The heist stays exactly as it was (control room button → vault door →
 * breach the wall → vault), and nothing new touches the antechamber or the
 * vault, so the door and the wall are still the only way in.
 *
 * Grid (x east, y north; one cell = 8 m). Existing cells in capitals:
 *
 *   y 1   r   p   ARMORY
 *   y 0   c   START  CORR  CONTROL  ANTE  VAULT
 *   y-1   |   L   L   k
 *   y-2   v   L   L   d
 *        x-1  0   1   2    3     4
 *
 *   L large hall (2×2)   k columned room   d dais room   r/p north rooms
 *   c columned room, | corridor, v low-cover room: the west loop
 */
import { MapBuilder } from '../mapkit.ts';

const m = MapBuilder.extend('m3_vault');

// South: a large hall below the start room, and two rooms beside it up into the control room.
m.tile('room_large', 0, -2);
m.tile('room_columns', 2, -1);
m.tile('room_dais', 2, -2, 0, 3);
// North: two rooms joining the start room to the armory.
m.tile('room', 0, 1);
m.tile('room_pillar', 1, 1);
// West: a loop from the start room down to the hall.
m.tile('room_columns', -1, 0);
m.tile('corridor', -1, -1);
m.tile('room_cover', -1, -2);

// Spawns spread over the new rooms (deathmatch for up to 10).
m.spawn([-2, 0, 8], Math.PI);
m.spawn([10, 0, 10], -Math.PI / 2);
m.spawn([-10, 0, -2], Math.PI / 2);
m.spawn([-8, 0, -18], 0);
m.spawn([1, 0, -17], 0);
m.spawn([13.5, 0, -16], Math.PI / 2);

// Pickups: a weapon in the hall, a sniper on the dais, supplies on the loops.
m.pickup('weapon_smg', [4, 0, -12]);
m.pickup('weapon_sniper', [16, 0, -8]);
m.pickup('health_small', [-8, 0, 2]);
m.pickup('ammo', [-8, 0, -8]);
m.pickup('armor_small', [8, 0, 11]);
m.pickup('health_small', [14, 0, -14]);

// Cover in the hall.
m.breakable('crate', [1.5, 0, -9]).breakable('crate', [6.5, 0, -15]).breakable('barrel', [7, 0, -9.5]);

m.lightRooms();
m.meta({
  description: 'Break into the vault: find the control, blow the wall, grab the prize. Loops through a south hall, a west passage and the north rooms keep the fight moving.',
  modes: ['core.deathmatch'],
  players: [2, 10],
});

await m.save();
