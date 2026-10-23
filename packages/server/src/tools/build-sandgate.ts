/**
 * Builds maps/sandgate.json, a desert-town Team Deathmatch map, through the
 * same edit commands the MapMaker issues (place tile, add spawn, set team,
 * add pickup, set mode and theme), so the result is an ordinary MapMaker map
 * that opens, edits and undoes like any other. Rerun after changing the
 * layout: `pnpm --filter @chronosplit/server build-sandgate`.
 *
 * Layout (grid x east, y north; one cell = 8 m):
 *
 *   y8  . . T T T T T T T . .    T  Tide spawn street
 *   y7  W W W . . m . . E E E    W  west square     E  east square
 *   y6  W W W . . m y H E E E    m  mid street      H  pillared house
 *   y5  W W W c c m . . E E E    c  short corridor  y  yard
 *   y4  . L . . . m . . t . .    L  long street     t  covered tunnel
 *   y3  . L . . . D . . t . .    D  mid doors building
 *   y2  . L . . . m t t t . .
 *   y1  . L . . . m . . t . .
 *   y0  . R S S S S S S t . .    R  long doors room  S  Embers spawn street
 *       0 1 2 3 4 5 6 7 8 9 10
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  EditHistory,
  addSpawnCommand,
  loadMap,
  mapTeams,
  newMapDocument,
  placeTileCommand,
  serializeMap,
  setThemeCommand,
  validateMap,
  type Faction,
  type MapEntity,
  type Rotation,
} from '@chronosplit/shared';

const OUT = fileURLToPath(new URL('../../../../maps/sandgate.json', import.meta.url));

// Stable IDs, so rebuilding the map produces the same file.
let counter = 0;
const id = (prefix: string) => `${prefix}_${String(++counter).padStart(3, '0')}`;

const doc0 = newMapDocument('Sandgate', new Date('2026-10-23T00:00:00.000Z'));
const history = new EditHistory({ ...doc0, classicStructure: { ...doc0.classicStructure, tiles: [] }, entities: [] });
const run = (label: string, command: Parameters<EditHistory['execute']>[1]) => history.execute(label, command);

function tile(kind: string, x: number, y: number, z = 0, rotation: Rotation = 0): void {
  const r = placeTileCommand(history.doc, `core.${kind}`, x, y, z, rotation);
  if ('error' in r) throw new Error(`${kind} at ${x},${y},${z}: ${r.error}`);
  run('Place tile', { kind: 'addTiles', tiles: [{ ...r.placement, id: id('tile') }] });
}

// ---------------------------------------------------------------- streets and squares (open ground)

// Embers spawn street (south) and Tide spawn street (north).
for (let x = 2; x <= 7; x++) tile(x === 3 ? 'yard_crates' : x === 6 ? 'yard_crates' : 'yard', x, 0, 0, x === 6 ? 2 : 0);
for (let x = 2; x <= 8; x++) tile(x === 4 ? 'yard_crates' : x === 7 ? 'yard_crates' : 'yard', x, 8, 0, x === 7 ? 1 : 0);

// Long: through the long doors room into a 40 m street with a low wall halfway.
tile('room', 1, 0);
for (let y = 1; y <= 4; y++) tile(y === 3 ? 'yard_wall' : 'yard', 1, y);

// West square (3 × 3), opening onto long and the Tide street.
const west: [number, number, string, Rotation][] = [
  [0, 5, 'yard', 0], [1, 5, 'yard_crates', 2], [2, 5, 'yard', 0],
  [0, 6, 'yard', 0], [1, 6, 'yard', 0], [2, 6, 'yard_wall', 1],
  [0, 7, 'yard_crates', 0], [1, 7, 'yard', 0], [2, 7, 'yard', 0],
];
for (const [x, y, k, r] of west) tile(k, x, y, 0, r);

// East square (3 × 3), reached through the tunnels or from the Tide street.
const east: [number, number, string, Rotation][] = [
  [8, 5, 'yard', 0], [9, 5, 'yard_wall', 0], [10, 5, 'yard', 0],
  [8, 6, 'yard', 0], [9, 6, 'yard_crates', 3], [10, 6, 'yard', 0],
  [8, 7, 'yard', 0], [9, 7, 'yard', 0], [10, 7, 'yard_crates', 1],
];
for (const [x, y, k, r] of east) tile(k, x, y, 0, r);

// Mid street, broken by the mid doors building and a crate stack.
tile('yard_wall', 5, 1);
tile('yard', 5, 2);
tile('room', 5, 3); // mid doors: doorways north and south only
tile('yard', 5, 4);
tile('yard_crates', 5, 5, 0, 1);
tile('yard', 5, 6);
tile('yard', 5, 7);

// ---------------------------------------------------------------- connectors

// Short: a corridor from mid to the west square.
tile('corridor', 3, 5, 0, 1);
tile('corridor', 4, 5, 0, 1);
// From mid to the east square through a pillared house.
tile('yard', 6, 6);
tile('room_pillar', 7, 6);

// Tunnels: from the Embers street east and north to the east square, with a branch to mid.
tile('corner', 8, 0, 0, 3);
tile('corridor', 8, 1);
tile('junction_t', 8, 2, 0, 3);
tile('corridor', 8, 3);
tile('corridor', 8, 4);
tile('corridor', 7, 2, 0, 1);
tile('corridor', 6, 2, 0, 1);

// Roofs: the tunnels are covered, and the doors rooms and the house are two storeys.
for (const [x, y] of [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [7, 2], [6, 2], [1, 0], [5, 3], [7, 6], [3, 5], [4, 5]] as const) tile('room', x, y, 1);

// ---------------------------------------------------------------- spawns

const [embers, tide] = mapTeams(history.doc) as [Faction, Faction];
function spawns(team: string, cells: [number, number][], yaw: number): void {
  for (const [gx, gy] of cells) {
    for (const dx of [-2, 2]) {
      const { command } = addSpawnCommand([gx * 8 + dx, 0, gy * 8 + (yaw === 0 ? -2 : 2)], yaw);
      const spawn = (command as { entities: MapEntity[] }).entities[0]!;
      run('Add spawn', { kind: 'addEntities', entities: [{ ...spawn, id: id('spawn'), faction: team } as MapEntity] });
    }
  }
}
spawns(embers.id, [[2, 0], [4, 0], [5, 0], [7, 0]], 0);
spawns(tide.id, [[2, 8], [3, 8], [5, 8], [6, 8]], Math.PI);

// ---------------------------------------------------------------- pickups

const pickups: [string, number, number][] = [
  ['weapon_sniper', 8, 18], // halfway down long
  ['weapon_rifle', 40, 32], // mid, north of the doors
  ['weapon_shotgun', 64, 16], // tunnel junction
  ['weapon_launcher', 24, 38], // short corridor
  ['armor_large', 80, 48], // east square
  ['armor_small', 8, 48], // west square
  ['health_large', 56, 45], // the house
  ['health_small', 8, 2], // long doors
  ['health_small', 66, 32], // upper tunnel
  ['ammo', 40, 24], // mid doors
  ['ammo', 32, 2], // Embers street
  ['ammo', 32, 62], // Tide street
  ['powerup_damage', 40, 46], // mid, by the crates
];
run('Add pickups', {
  kind: 'addEntities',
  entities: pickups.map(([item, x, z]) => ({ id: id('pickup'), kind: 'pickup' as const, item: `core.${item}`, position: [x, 0, z] as [number, number, number], respawnSeconds: null })),
});

// ---------------------------------------------------------------- map settings

run('Change theme', setThemeCommand(history.doc, 'core.desert'));
run('Edit map', {
  kind: 'setMetadata',
  before: history.doc.metadata,
  after: {
    id: 'sandgate',
    author: 'ChronoSplit',
    description:
      'A sun-baked desert town for Team Deathmatch. Embers spawn in the south, Tide in the north. A long street runs up the west side, mid doors split the centre, covered tunnels wind up the east, and two crate-filled squares wait at the north end.',
    recommendedPlayers: { min: 4, max: 16 },
    supportedModes: ['core.tdm', 'core.deathmatch'],
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
