/**
 * Ridge Camp: a stone keep built round an open courtyard, stacked in four
 * heights (homage in spirit to the classic multi-level stone arenas of the
 * late nineties). The courtyard is open to the sky; a U of railed ledges runs
 * round it one level up (stairs on the west, a long ramp on the east), and a
 * high deck over the north cloister holds the railgun: only the courtyard's
 * jump pad gets you there. South of the courtyard, three stairways drop into
 * a sunken pit where the rocket launcher waits.
 *
 * Grid x east, y north (one cell = 8 m); levels: z-1 pit, z0 floor, z1 ledges, z2 deck.
 *
 *   y2   NW  N   N   N   NE      z0 cloister rooms / z1 balcony U / z2 deck over N N N (railgun)
 *   y1   Wr  C   C   C   Er      Wr/Er rooms under the ledges, C courtyard (open sky, pad at C N)
 *   y0   S^  C   C   C   R^      S^ stairs up north to the west ledge, R^ long ramp up to the east ledge
 *   y-1  Wc  C   C   C   R^      Wc columned room
 *   y-2  s^  o   s^  o   s^      s^ stairs from the pit, o courtyard lips railed over the pit
 *   y-3  P   P   P   P   P       P sunken pit (z-1, rockets)
 *        -2  -1  0   1   2
 */
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('ridge_camp', 'Ridge Camp');
m.theme('castle');
m.backdrop('sunrise', 'mountains', 'grass', 0.5);
const P = Math.PI / 2;

// ---------------------------------------------------------------- floor (z0)
m.fill('yard', -1, -1, 1, 1);
// West wing: columned room, stairs climbing north to the ledge, room under the ledge.
m.tile('room_columns', -2, -1).tile('stairs', -2, 0, 0, 3).tile('room', -2, 1);
// East wing: a long ramp climbing north (fed by the pit stairs), room under the ledge.
m.tile('ramp', 2, -1, 0, 3).tile('room', 2, 1);
// North cloister under the balcony, with corner rooms.
m.tile('room', -2, 2).fill('room_pillar', -1, 2, 1, 2).tile('room', 2, 2);
// Courtyard lips over the pit.
m.tile('yard', -1, -2).tile('yard', 1, -2);

// ---------------------------------------------------------------- pit (z-1)
m.fill('yard', -2, -3, 2, -3, -1);
for (const x of [-2, 0, 2]) m.tile('stairs', x, -2, -1, 3);

// ---------------------------------------------------------------- ledges (z1) and deck (z2)
m.tile('platform_rail', -2, 1, 1).tile('platform_rail', -2, 2, 1);
m.fill('platform_rail', -1, 2, 1, 2, 1);
m.tile('platform_rail', 2, 2, 1).tile('platform_rail', 2, 1, 1);
m.fill('platform_rail', -1, 2, 1, 2, 2);

// ---------------------------------------------------------------- walls and openings
// Courtyard sides: arches into the wings and the cloister.
m.edge(-2, -1, 0, 'E', 'arch').edge(-2, 1, 0, 'E', 'arch').edge(2, 1, 0, 'W', 'arch');
for (const x of [-1, 0, 1]) m.edge(x, 2, 0, 'S', 'arch');
m.edge(-1, 2, 0, 'E', 'open').edge(0, 2, 0, 'E', 'open');
// Stairs and ramp open onto the courtyard: half walls below, railings above.
m.edge(-2, 0, 0, 'E', 'half').edge(-2, 0, 1, 'E', 'railing');
m.edge(2, -1, 0, 'W', 'half').edge(2, -1, 1, 'W', 'open').edge(2, 0, 1, 'W', 'railing');
// Railings round the pit mouth.
m.edge(-1, -2, 0, 'S', 'railing').edge(1, -2, 0, 'S', 'railing');
for (const x of [-1, 1]) m.edge(x, -2, 0, 'W', 'railing').edge(x, -2, 0, 'E', 'railing');
for (const x of [-2, 0, 2]) m.edge(x, -2, 0, 'S', 'railing');
// Tall outer walls: pit, ledges and deck backs.
for (let x = -2; x <= 2; x++) m.edge(x, -3, -1, 'S', 'high');
m.edge(-2, -3, -1, 'W', 'high').edge(2, -3, -1, 'E', 'high');
m.edge(-2, 1, 1, 'W', 'wall').edge(-2, 2, 1, 'W', 'wall').edge(2, 1, 1, 'E', 'wall').edge(2, 2, 1, 'E', 'wall');
for (let x = -2; x <= 2; x++) m.edge(x, 2, 1, 'N', 'wall');
for (let x = -1; x <= 1; x++) m.edge(x, 2, 2, 'N', 'wall');
// Window slits from the corner rooms onto the courtyard ends of the cloister.
m.edge(-2, 2, 0, 'E', 'arch').edge(2, 2, 0, 'W', 'arch');

// ---------------------------------------------------------------- jump pad: courtyard -> high deck
m.pad([0, 0, 5], 0, 20, 9);

// ---------------------------------------------------------------- spawns
m.spawn([-16, 0, -10], P).spawn([-16, 0, 10], P).spawn([16, 0, 10], -P);
m.spawn([-4, 0, 18], Math.PI).spawn([12, 0, 16], -2.4).spawn([-18, 0, 18], 2.4);
m.spawn([-16, -4, -24], P).spawn([16, -4, -24], -P);
m.spawn([-16, 4, 6], P).spawn([16, 4, 6], -P);
m.spawn([-8, 0, -16], 0).spawn([8, 0, -16], 0);

// ---------------------------------------------------------------- pickups
// Power: railgun on the deck (pad only), rockets at the bottom of the pit.
m.pickup('weapon_railgun', [0, 8, 16]).pickup('ammo_sniper', [-8, 8, 16]).pickup('ammo_sniper', [8, 8, 16]);
m.pickup('weapon_rockets', [0, -4, -24]).pickup('ammo_explosive', [-10, -4, -24]).pickup('ammo_explosive', [10, -4, -24]);
// Armour on the balcony under the deck, the big health in the north-east corner, the damage boost in the west room.
m.pickup('armor_large', [0, 4, 16]).pickup('armor_small', [-16, 4, 16]).pickup('armor_small', [16, 4, 16]);
m.pickup('health_large', [16, 0, 16]).pickup('powerup_damage', [-16, 0, -14]);
m.pickup('health_small', [-8, 0, 0]).pickup('health_small', [8, 0, 0]).pickup('health_small', [-16, -4, -28]).pickup('health_small', [16, -4, -28]);
// Weapons round the floor.
m.pickup('weapon_shotgun', [-16, 0, -4]).pickup('weapon_plasma', [16, 0, 4]).pickup('weapon_launcher', [10.5, 0, 16]);
m.pickup('weapon_rifle', [0, 0, -10]).pickup('weapon_disc_launcher', [-16, 0, 18]).pickup('weapon_burst_rifle', [-8, 4, 18]);
m.pickup('ammo_shells', [-20, 0, -8]).pickup('ammo_cells', [20, 0, 6]).pickup('ammo_rifle', [-8, 0, -16]).pickup('grenades', [8, 0, -16]);

// ---------------------------------------------------------------- props
// Courtyard cover: crates, broken walls, a well of barrels.
m.prop('crate_large', [-6, 0, -3], 0.35).prop('crate_large', [6, 0, -1], -0.4).prop('crate_small', [-6.8, 1.1, -3.4], 0.2);
m.prop('stone_wall', [-3, 0, 9], 0).prop('stone_wall_damaged', [3, 0, 9], 0).prop('stone_wall', [0, 0, -5], 0);
m.prop('dungeon_barrel', [-9, 0, 8]).prop('dungeon_barrel', [9.5, 0, -8]).prop('hay_bale', [9, 0, 8.5], 0.6);
m.prop('fire_basket', [0, 0, -14], 0, 0.45);
// Columns holding up the deck over the balcony, banners on the deck wall.
for (const x of [-12, -4, 4, 12]) m.prop('column', [x, 4, 13.2], 0, 1.05);
m.prop('banner', [-6, 8, 19.5], 0, 1, false).prop('banner', [6, 8, 19.5], 0, 1, false);
m.prop('banner', [-8, 0, 19.5], 0, 1, false).prop('banner', [8, 0, 19.5], 0, 1, false);
// Rooms: tables, chests, weapon racks.
m.prop('dungeon_table', [-17, 0, 1 + 7], P).prop('dungeon_chair', [-15, 0, 8]).prop('chest', [19, 0, 13], -P).prop('anvil', [18, 0, 18.5]);
m.prop('woodpile', [-18, 0, 13.5], P).prop('shield', [-19.5, 1.2, -6], P, 1, false).prop('dungeon_chest', [-19, 0, -14]);
// Pit: barrels and powder kegs (they go off), braziers.
m.prop('powder_keg', [-6, -4, -27]).prop('powder_keg', [6, -4, -21]).prop('dungeon_barrel', [-4.5, -4, -27.5]).prop('dungeon_barrel', [4.5, -4, -20.5]);
m.prop('crate_large', [-12, -4, -21], P).prop('crate_large', [12, -4, -27], P);
m.prop('lightpost', [-19, -4, -28]).prop('lightpost', [19, -4, -28]);
// Torches on the ledges.
m.prop('lantern', [-19, 4, 4], 0, 1, false).prop('lantern', [19, 4, 4], 0, 1, false);

m.bounds('invisible');
// Furniture in the bare rooms, for what they are in this theme.
m.furnish();
// Team bases at each end (spawns and a flag), hills through the middle.
await m.teamBases(5);
m.lightRooms();
m.meta({
  description:
    'A stone keep round an open courtyard, four storeys of fighting: a sunken pit with the rocket launcher, the courtyard and its cloister, a U of railed ledges reached by stairs and a long ramp, and a high deck over the north colonnade that only the jump pad reaches, holding the railgun. An homage in spirit to the great multi-level stone arenas.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 10],
});
await m.save();
