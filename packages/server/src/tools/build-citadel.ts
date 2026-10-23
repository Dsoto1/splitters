/**
 * Builds maps/citadel.json, a two-storey castle Deathmatch map that shows off
 * the building kit, props, breakables and the full arsenal, through the same
 * edit commands the MapMaker issues. Rerun after changing the layout:
 * `pnpm --filter @chronosplit/server build-citadel`.
 *
 * Ground floor (grid x east, y north; one cell = 8 m), upper floor in brackets:
 *
 *   y4  . R  N  N  T  .     R  colonnade room      N  north halls [roof terraces]
 *   y3  . W  A  A  E  .     W  west halls [upper rooms, windows]   E  east halls [upper rooms]
 *   y2  . W  A  A  E  .     A  two-storey atrium with a balcony all round
 *   y1  . T  S  S  R  .     S  south halls [roof terraces]   T  stairwells (both floors)
 *       0 1  2  3  4  5
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EditHistory, addSpawnCommand, loadMap, newMapDocument, placeTileCommand, serializeMap, setEdgeCommand, setThemeCommand, validateMap, type EdgeStyle, type MapEntity, type Rotation, type Side } from '@chronosplit/shared';

const OUT = fileURLToPath(new URL('../../../../maps/citadel.json', import.meta.url));

let counter = 0;
const id = (prefix: string) => `${prefix}_${String(++counter).padStart(3, '0')}`;

const doc0 = newMapDocument('Citadel', new Date('2026-10-23T00:00:00.000Z'));
const history = new EditHistory({ ...doc0, classicStructure: { ...doc0.classicStructure, tiles: [] }, entities: [] });
const run = (label: string, command: Parameters<EditHistory['execute']>[1]) => history.execute(label, command);

function tile(kind: string, x: number, y: number, z = 0, rotation: Rotation = 0): void {
  const r = placeTileCommand(history.doc, `core.${kind}`, x, y, z, rotation);
  if ('error' in r) throw new Error(`${kind} at ${x},${y},${z}: ${r.error}`);
  run('Place tile', { kind: 'addTiles', tiles: [{ ...r.placement, id: id('tile') }] });
}

function edge(x: number, y: number, z: number, side: Side, style: EdgeStyle): void {
  const cmd = setEdgeCommand(history.doc, { cell: [x, y, z], side }, style);
  if ('error' in cmd) throw new Error(`edge ${x},${y},${z}:${side}: ${cmd.error}`);
  run('Wall', cmd);
}

const entities: MapEntity[] = [];
const prop = (model: string, x: number, y: number, z: number, yaw = 0, scale = 1) =>
  entities.push({ id: id('prop'), kind: 'prop', model: `prop.${model}`, position: [x, y, z], yaw, scale, solid: true, tint: null });
const decor = (model: string, x: number, y: number, z: number, yaw = 0) =>
  entities.push({ id: id('prop'), kind: 'prop', model: `prop.${model}`, position: [x, y, z], yaw, scale: 1, solid: false, tint: null });
const breakable = (model: 'glass' | 'boards' | 'gas' | 'generator' | 'barrel' | 'crate', x: number, y: number, z: number, yaw = 0) =>
  entities.push({ id: id(model), kind: 'destructible', model, position: [x, y, z], yaw, health: null, explosiveOnly: false });

// ---------------------------------------------------------------- structure

tile('atrium', 2, 2);
// Ground floor ring.
tile('room', 1, 2);
tile('room', 1, 3);
tile('room', 4, 2);
tile('room_pillar', 4, 3);
tile('room', 2, 1);
tile('room_cover', 3, 1, 0, 2);
tile('room_dais', 2, 4, 0, 2);
tile('room', 3, 4);
tile('room_columns', 4, 1);
tile('room_columns', 1, 4);
// Stairwells in two corners, opening onto the west and east halls on both floors.
tile('stairwell', 1, 1, 0, 1);
tile('stairwell', 4, 4, 0, 3);
// Upper floor: rooms over the side halls, roof terraces over the north and south halls.
tile('room', 1, 2, 1);
tile('room', 1, 3, 1);
tile('room', 4, 2, 1);
tile('room', 4, 3, 1);
for (const x of [2, 3]) {
  tile('platform_rail', x, 4, 1);
  tile('platform_rail', x, 1, 1);
}

// Walls: windows out of the halls and upper rooms, archways into the atrium.
for (const y of [2, 3]) {
  edge(1, y, 0, 'W', 'windows');
  edge(4, y, 0, 'E', 'windows');
  edge(1, y, 1, 'W', 'window');
  edge(4, y, 1, 'E', 'window');
  edge(1, y, 0, 'E', 'arch');
  edge(4, y, 0, 'W', 'arch');
}
for (const x of [2, 3]) {
  edge(x, 1, 0, 'N', 'wide');
  edge(x, 4, 0, 'S', 'wide');
  edge(x, 1, 0, 'S', 'slit');
  edge(x, 4, 0, 'N', 'slit');
}
edge(1, 4, 0, 'N', 'windows');
edge(4, 1, 0, 'S', 'windows');

// ---------------------------------------------------------------- props and breakables

// Atrium floor: cover around the edges, a keg to set off, banners.
prop('crate_large', 14, 0, 22, 0.3);
prop('crate_small', 15.2, 0, 23.4);
prop('barrel', 26, 0, 22.5);
prop('powder_keg', 26.5, 0, 24);
prop('altar', 20, 0, 22.5);
decor('candles', 20, 1, 22.5);
for (const [x, z, yaw] of [[12.6, 20, Math.PI / 2], [27.4, 20, -Math.PI / 2]] as const) decor('banner', x, 4, z, yaw);
// West halls: a dining hall and a library.
prop('table_cloth', 8, 0, 15, Math.PI / 2);
prop('chair', 7, 0, 14);
prop('chair', 9, 0, 16, Math.PI);
prop('bookcase', 4.9, 0, 22, Math.PI / 2);
prop('bookcase', 4.9, 0, 26, Math.PI / 2);
prop('armchair', 10.8, 0, 26.2, -Math.PI / 2);
decor('rug', 8, 0, 16);
// East halls: a workshop and a powder store.
prop('workbench', 34.6, 0, 16, -Math.PI / 2);
prop('anvil', 33, 0, 13.5);
prop('crate_large', 34.2, 0, 26.5);
prop('crate_open', 33, 0, 21.5);
breakable('gas', 34.8, 0, 22.8);
breakable('gas', 34.8, 0, 23.6);
// South halls: a generator to blow up, and boards across the inner doorway.
breakable('generator', 14, 0, 6, Math.PI / 2);
breakable('boards', 20, 0, 8, Math.PI / 2);
prop('cargo_crate', 26, 0, 6, 0.2);
prop('dungeon_barrel', 24, 0, 5.2);
// North halls: a crypt corner.
prop('coffin', 15, 0, 34.5, Math.PI / 2);
prop('gravestone_cross', 17.5, 0, 34.8);
decor('candles', 13, 0, 34.5);
prop('fire_basket', 25.5, 0, 34.5);
// Corner rooms.
prop('crate_small', 31.5, 0, 5.3);
prop('hay_bale', 8, 0, 34.6);
// Upper rooms: barracks and a map room, with glass in the windows.
prop('bunk_bed', 5.4, 4, 13.5, Math.PI / 2);
prop('desk', 10.5, 4, 26.5);
prop('office_chair', 10.5, 4, 25.3, Math.PI);
prop('holo_table', 32, 4, 24);
prop('bunk_bed', 34.6, 4, 13.5, -Math.PI / 2);
for (const z of [16, 24]) {
  breakable('glass', 4.25, 4, z, Math.PI / 2);
  breakable('glass', 35.75, 4, z, Math.PI / 2);
}
// Roof terraces: cannons pointing out, sandbag-like cover.
prop('cannon', 17, 4, 35, 0);
prop('cannon', 23, 4, 35, 0);
prop('cannon', 17, 4, 5, Math.PI);
prop('cannon', 23, 4, 5, Math.PI);
prop('crate_large', 20, 4, 33, Math.PI / 2);
prop('crate_large', 20, 4, 7, Math.PI / 2);
run('Add props', { kind: 'addEntities', entities });

// ---------------------------------------------------------------- spawns and pickups

for (const [x, y, z, yaw] of [
  [8, 0, 18, Math.PI / 2], [7, 0, 26.5, Math.PI / 2], [32, 0, 18, -Math.PI / 2], [30, 0, 26.5, -Math.PI / 2],
  [18, 0, 8, 0], [19, 0, 30, Math.PI], [8, 4, 17, Math.PI / 2], [32, 4, 18.5, -Math.PI / 2],
  [16, 4, 31, Math.PI], [24, 4, 9, 0],
] as const) {
  const { command } = addSpawnCommand([x, y, z], yaw);
  const spawn = (command as { entities: MapEntity[] }).entities[0]!;
  run('Add spawn', { kind: 'addEntities', entities: [{ ...spawn, id: id('spawn') } as MapEntity] });
}

const pickups: [string, number, number, number][] = [
  ['weapon_rockets', 20, 0, 19],
  ['weapon_sniper', 22, 4, 32],
  ['weapon_plasma', 32, 4, 16],
  ['weapon_smg', 8, 0, 22],
  ['weapon_shotgun', 24, 0, 9],
  ['weapon_rifle', 13, 0, 29.5],
  ['weapon_launcher', 8, 4, 24],
  ['armor_large', 26.8, 4, 20],
  ['armor_small', 13.2, 4, 20],
  ['health_large', 32, 0, 8],
  ['health_small', 8, 0, 32],
  ['health_small', 32, 4, 26],
  ['grenades', 30, 0, 22],
  ['mines', 8, 0, 13.5],
  ['ammo_explosive', 18, 4, 32],
  ['ammo_cells', 30, 4, 24],
  ['ammo_rifle', 16, 0, 10],
  ['ammo_shells', 24, 0, 30],
  ['ammo_light', 10.5, 0, 26.5],
  ['ammo_sniper', 18, 4, 8],
  ['powerup_damage', 20, 0, 26],
];
run('Add pickups', {
  kind: 'addEntities',
  entities: pickups.map(([item, x, y, z]) => ({ id: id('pickup'), kind: 'pickup' as const, item: `core.${item}`, position: [x, y, z] as [number, number, number], respawnSeconds: null })),
});

// ---------------------------------------------------------------- map settings

run('Change theme', setThemeCommand(history.doc, 'core.castle'));
run('Edit map', {
  kind: 'setMetadata',
  before: history.doc.metadata,
  after: {
    id: 'citadel',
    author: 'ChronoSplit',
    description:
      'A castle keep around a two-storey atrium. Halls with arched openings ring the ground floor; stairwells in two corners climb to barracks, a map room and roof terraces with cannons. Rockets wait in the atrium, the sniper rifle on the north roof. Shoot out the window panes, break the boards, and mind the powder kegs.',
    recommendedPlayers: { min: 2, max: 10 },
    supportedModes: ['core.deathmatch'],
  },
});

const doc = history.doc;
const loaded = loadMap(JSON.parse(serializeMap(doc)));
if (!loaded.ok) throw new Error(`map does not load: ${JSON.stringify(loaded.issues)}`);
const issues = validateMap(loaded.map);
for (const i of issues) console.log(`${i.severity.padEnd(10)} ${i.code} ${i.message}`);
if (issues.some((i) => i.severity === 'error')) process.exit(1);
writeFileSync(OUT, serializeMap(loaded.map));
console.log(`wrote ${OUT}: ${doc.classicStructure.tiles.length} tiles, ${doc.entities.length} entities`);
