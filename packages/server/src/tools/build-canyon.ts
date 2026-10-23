/**
 * Builds maps/canyon.json, "Rockfall Canyon": a big outdoor Team Deathmatch
 * map on sculpted terrain, in the spirit of the classic two-base box canyon.
 * It is made through the same edit commands the MapMaker issues (terrain,
 * tiles, walls, props, spawns, pickups), so it opens and edits like any
 * other map. Rerun after changing the layout:
 * `pnpm --filter @chronosplit/server build-canyon`.
 *
 * Top-down (x east, z north; metres):
 *
 *   z +80   [ Tide base: three bunkers, ramps to a railed roof ]
 *   z +40     boulder field          . west ridge ledge (5 m)
 *   z   0   hill  · ruins ·  hill    . watchtower
 *   z -40     boulder field          . dirt trail winds base to base
 *   z -80   [ Embers base ]
 *
 * Rock walls 20 m and more close the canyon on all sides; steep faces are
 * painted stone, trails dirt, the floor grass with gravel round the bases.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  EditHistory,
  TERRAIN_MATERIALS,
  addSpawnCommand,
  loadMap,
  mapTeams,
  newMapDocument,
  newTerrain,
  paintSlopes,
  placeTileCommand,
  serializeMap,
  setEdgeCommand,
  setThemeCommand,
  terrainHeightAt,
  validateMap,
  type EdgeStyle,
  type Faction,
  type MapEntity,
  type Rotation,
  type Side,
  type TerrainData,
  type TerrainMaterial,
} from '@chronosplit/shared';

const OUT = fileURLToPath(new URL('../../../../maps/canyon.json', import.meta.url));

let counter = 0;
const id = (prefix: string) => `${prefix}_${String(++counter).padStart(3, '0')}`;

const doc0 = newMapDocument('Rockfall Canyon', new Date('2026-10-23T00:00:00.000Z'));
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

// ---------------------------------------------------------------- terrain shape

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bump = (x: number, z: number, cx: number, cz: number, r: number, h: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));
/** Centre line of the canyon: it bends gently as it runs north. */
const centre = (z: number) => 6 * Math.sin(z / 37);
/** Places kept flat for buildings: [x0, z0, x1, z1]. */
const FLAT: [number, number, number, number][] = [
  [-20, -94, 20, -66], // Embers base
  [-20, 66, 20, 94], // Tide base
  [19, -5, 29, 5], // ruins
  [-29, -13, -19, -3], // watchtower
];
const flatWeight = (x: number, z: number) =>
  Math.max(0, ...FLAT.map(([x0, z0, x1, z1]) => (1 - smooth(0, 12, Math.max(x0 - x, x - x1, 0))) * (1 - smooth(0, 12, Math.max(z0 - z, z - z1, 0)))));

function height(x: number, z: number): number {
  const dx = Math.abs(x - centre(z));
  // Rolling floor with two big central hills and a few knolls for cover.
  let h = 0.9 * Math.sin(x / 11 + 0.7) * Math.cos(z / 15) + 0.6 * Math.sin(z / 23 + x / 31);
  h += bump(x, z, -6, 18, 13, 4.5) + bump(x, z, 8, -20, 12, 3.8) + bump(x, z, 28, 40, 7, 2.2) + bump(x, z, -24, -44, 7, 2);
  // A 5 m ledge along the west wall: high ground for flankers, with sloped ends to climb.
  const ledge = smooth(-38, -33, -x) * (1 - smooth(34, 48, Math.abs(z))) * 5;
  h = Math.max(h, ledge * (1 - smooth(40, 44, dx)) + h * 0);
  // Canyon walls, broken up so the skyline is not a straight line.
  const wall = smooth(36, 52, dx) * (21 + 4 * Math.sin(z / 9) + 3 * Math.cos(z / 13 + x / 7));
  const ends = smooth(98, 114, Math.abs(z)) * (19 + 3 * Math.sin(x / 8));
  h = Math.max(h, 0) + wall + ends;
  // Level ground under the bases and buildings (terrain sits 15 cm under tile floors).
  return h * (1 - flatWeight(x, z));
}

const base = newTerrain(240, 2, [0, 0], 'grass');
let terrain: TerrainData = { ...base, baseY: -0.15 };
const heights = terrain.heights.map((_, i) => {
  const c = i % terrain.cols;
  const r = Math.floor(i / terrain.cols);
  return Math.round(height(terrain.origin[0] + c * terrain.spacing, terrain.origin[1] + r * terrain.spacing) * 100);
});
terrain = { ...terrain, heights };

// Ground materials: gravel aprons round the bases, a dirt trail, mud in the dips, moss on the hills.
const mat = (m: TerrainMaterial) => TERRAIN_MATERIALS.indexOf(m);
const trail = (z: number) => centre(z) * 0.6 + 11 * Math.sin(z / 21);
const materials = terrain.materials.map((m, i) => {
  const c = i % (terrain.cols - 1);
  const r = Math.floor(i / (terrain.cols - 1));
  const x = terrain.origin[0] + (c + 0.5) * terrain.spacing;
  const z = terrain.origin[1] + (r + 0.5) * terrain.spacing;
  const y = terrainHeightAt(terrain, x, z)! - terrain.baseY;
  if (flatWeight(x, z) > 0.6 && Math.abs(z) > 60) return mat('gravel');
  if (flatWeight(x, z) > 0.6) return mat('dirt');
  if (y > 9) return mat('stone');
  if (Math.abs(x - trail(z)) < 2.6 && Math.abs(z) < 70) return mat('dirt');
  if (y < -0.9) return mat('mud');
  if (y > 3.6 && Math.abs(x) < 34) return mat('moss');
  return m;
});
terrain = paintSlopes({ ...terrain, materials }, 33, 'stone');
run('Create terrain', { kind: 'setTerrain', before: null, after: terrain });

const ground = (x: number, z: number) => terrainHeightAt(terrain, x, z) ?? 0;

// ---------------------------------------------------------------- bases

/**
 * One base: three bunkers in a row, open to the canyon at the front, with
 * back doors, windows on the flanks and open stairs at both ends up to a
 * railed roof. `gy` is the grid row; `front` is the side facing mid.
 */
function buildBase(gy: number, front: Side): void {
  const back: Side = front === 'N' ? 'S' : 'N';
  tile('room', -1, gy);
  tile('room_cover', 0, gy, 0, front === 'N' ? 0 : 2);
  tile('room', 1, gy);
  for (const x of [-1, 0, 1]) tile('platform_rail', x, gy, 1);
  // Stairs climb inwards to the roof: the east flight rises west, the west flight rises east.
  tile('stairs_open', 2, gy, 0, 2);
  tile('stairs_open', -2, gy, 0, 0);
  for (const x of [-1, 0, 1]) edge(x, gy, 0, front, x === 0 ? 'wide' : 'arch');
  edge(0, gy, 0, back, 'door');
  edge(-1, gy, 0, back, 'windows');
  edge(1, gy, 0, back, 'windows');
}
buildBase(-10, 'N');
buildBase(10, 'S');

// Mid: a ruined courtyard on the east and a watchtower on the west.
tile('yard_ruins', 3, 0);
tile('tower', -3, -1, 0, 1);

// ---------------------------------------------------------------- boulders, trees and cover

const entities: MapEntity[] = [];
const prop = (model: string, x: number, z: number, yaw = 0, scale = 1, sink = 0.25) =>
  entities.push({ id: id('prop'), kind: 'prop', model: `prop.${model}`, position: [x, +(ground(x, z) - sink * scale).toFixed(2), z], yaw: +yaw.toFixed(3), scale, solid: true, tint: null });

// Deterministic scatter, so a rebuild gives the same file.
let seed = 1234567;
const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
const clear = (x: number, z: number) =>
  flatWeight(x, z) < 0.05 && Math.abs(x - trail(z)) > 4 && Math.abs(x - centre(z)) < 34 && Math.abs(z) < 96 && !(x < -32 && Math.abs(z) < 44);
const placed: [number, number, number][] = [];
const free = (x: number, z: number, r: number) => placed.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > r + pr + 3);

// Big boulders: the canyon's main cover, clustered in two fields either side of mid.
for (let n = 0; n < 400 && placed.length < 34; n++) {
  const z = (rand() < 0.5 ? -1 : 1) * (18 + rand() * 50);
  const x = centre(z) + (rand() - 0.5) * 62;
  const scale = +(1.8 + rand() * 1.8).toFixed(2);
  const r = scale * 1.1;
  if (!clear(x, z) || !free(x, z, r)) continue;
  placed.push([x, z, r]);
  prop(rand() < 0.65 ? 'rock_large' : 'rock_medium', +x.toFixed(2), +z.toFixed(2), rand() * Math.PI * 2, scale);
}
// Rock spires along the foot of the walls.
for (let n = 0; n < 200 && placed.length < 50; n++) {
  const z = (rand() - 0.5) * 180;
  const side = rand() < 0.5 ? -1 : 1;
  const x = centre(z) + side * (31 + rand() * 4);
  if (flatWeight(x, z) > 0.05 || !free(x, z, 4) || (x < -30 && Math.abs(z) < 46)) continue;
  placed.push([x, z, 4]);
  prop('rocks_tall', +x.toFixed(2), +z.toFixed(2), rand() * Math.PI * 2, +(1.4 + rand()).toFixed(2), 0.4);
}
// Pines on the hills and the ledge, small rocks and logs scattered for detail.
for (const [x, z] of [[-10, 24], [-2, 12], [10, -26], [5, -14], [-35, 20], [-35, -12], [-36, 32], [30, 36]] as const) prop(rand() < 0.5 ? 'pine' : 'pine_crooked', x, z, rand() * 6, 1.2, 0.1);
for (let n = 0; n < 300 && placed.length < 80; n++) {
  const z = (rand() - 0.5) * 170;
  const x = centre(z) + (rand() - 0.5) * 64;
  if (!clear(x, z) || !free(x, z, 0.6)) continue;
  placed.push([x, z, 0.6]);
  const pick = rand();
  prop(pick < 0.5 ? 'rock_small' : pick < 0.75 ? 'rock_flat' : 'log', +x.toFixed(2), +z.toFixed(2), rand() * Math.PI * 2, pick < 0.75 ? 1.5 : 1, 0.1);
}
// Base yards: crates and barricades out front.
for (const s of [-1, 1]) {
  const z = s * 68;
  prop('crate_large', -9, z, 0.2, 1, 0);
  prop('crate_small', -7.6, z + s * 1.2, 0, 1, 0);
  prop('metal_panel', 9, z, 0, 1, 0);
  prop('metal_panel', 0, s * 64, 0, 1, 0);
  entities.push({ id: id('barrel'), kind: 'destructible', model: 'barrel', position: [6, 0, s * 70], yaw: 0, health: null, explosiveOnly: false });
}
run('Add props', { kind: 'addEntities', entities });

// ---------------------------------------------------------------- spawns and pickups

const [embers, tide] = mapTeams(history.doc) as [Faction, Faction];
const spawnAt = (team: string, x: number, z: number, yaw: number) => {
  const { command } = addSpawnCommand([x, 0, z], yaw);
  const spawn = (command as { entities: MapEntity[] }).entities[0]!;
  run('Add spawn', { kind: 'addEntities', entities: [{ ...spawn, id: id('spawn'), faction: team, position: [x, 0, z] } as MapEntity] });
};
for (const [x, dz] of [[-9, 2], [-7, -2], [0, 2], [1, -2], [8, 2], [7, -2], [-13, 8], [13, 8]] as const) {
  spawnAt(embers!.id, x, -80 + dz - (dz > 4 ? 16 : 0), 0);
  spawnAt(tide!.id, x, 80 - dz + (dz > 4 ? 16 : 0), Math.PI);
}

const pickups: [string, number, number][] = [
  // Each base: rifle, SMG, ammo and grenades; the sniper rifle on the roof.
  ['weapon_rifle', -8, -76], ['weapon_smg', 8, -76], ['ammo_rifle', -2, -82], ['grenades', 2, -82],
  ['weapon_rifle', 8, 76], ['weapon_smg', -8, 76], ['ammo_rifle', 2, 82], ['grenades', -2, 82],
  // Mid and the flanks: the power weapons.
  ['weapon_rockets', 24, 0], ['weapon_sniper', -24, -8], ['weapon_plasma', -6, 18], ['weapon_shotgun', 8, -20],
  ['powerup_damage', -36, 0], ['armor_large', 0, 0], ['mines', 28, 40], ['weapon_launcher', -24, -44],
  ['health_large', -20, 30], ['health_large', 20, -30], ['ammo_sniper', -34, 24], ['ammo_explosive', 30, 6],
  ['ammo_cells', -12, 30], ['ammo_shells', 16, -40], ['health_small', 4, 36], ['health_small', -4, -36],
];
const roof: [string, number, number][] = [['weapon_sniper', 0, -80], ['weapon_sniper', 0, 80], ['armor_small', -8, -80], ['armor_small', 8, 80]];
run('Add pickups', {
  kind: 'addEntities',
  entities: [
    ...pickups.map(([item, x, z]) => ({ id: id('pickup'), kind: 'pickup' as const, item: `core.${item}`, position: [x, Math.max(0, +ground(x, z).toFixed(2)), z] as [number, number, number], respawnSeconds: null })),
    ...roof.map(([item, x, z]) => ({ id: id('pickup'), kind: 'pickup' as const, item: `core.${item}`, position: [x, 4, z] as [number, number, number], respawnSeconds: null })),
  ],
});

// ---------------------------------------------------------------- map settings

run('Change theme', setThemeCommand(history.doc, 'core.canyon'));
run('Edit map', {
  kind: 'setMetadata',
  before: history.doc.metadata,
  after: {
    id: 'canyon',
    author: 'ChronoSplit',
    description:
      'A long grassy canyon between sheer rock walls. Embers hold the south bunkers, Tide the north; each base has a railed roof with a sniper rifle. Boulder fields and two big hills cover the middle, a 5 m ledge runs up the west wall, and rockets wait in the ruins on the east side.',
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
