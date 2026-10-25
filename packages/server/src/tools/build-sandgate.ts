/**
 * Builds maps/sandgate.json, a desert-town Team Deathmatch map, through the
 * same edit commands the MapMaker issues (place tile, add spawn, set team,
 * add pickup, set mode and theme), so the result is an ordinary MapMaker map
 * that opens, edits and undoes like any other. Rerun after changing the
 * layout: `pnpm --filter @tiletrigger/server build-sandgate`.
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
  TERRAIN_MATERIALS,
  buildMapGeometry,
  newTerrain,
  paintSlopes,
  settledPropY,
  terrainHeightAt,
  type Faction,
  type MapDocument,
  type MapEntity,
  type Rotation,
  type TerrainData,
  type TerrainMaterial,
} from '@tiletrigger/shared';

const OUT = fileURLToPath(new URL('../../../../maps/sandgate.json', import.meta.url));

// Stable IDs, so rebuilding the map produces the same file.
let counter = 0;
const id = (prefix: string) => `${prefix}_${String(++counter).padStart(3, '0')}`;

const doc0 = newMapDocument('Sandgate', new Date('2026-10-23T00:00:00.000Z'));
const history = new EditHistory({ ...doc0, classicStructure: { ...doc0.classicStructure, tiles: [] }, entities: [] });
const run = (label: string, command: Parameters<EditHistory['execute']>[1]) => history.execute(label, command);

// ---------------------------------------------------------------- terrain round the structure
// Scenery ground round the tiles: it sits a little under each floor along the walls (a flat apron
// `margin` m wide), well down under the footprints (so nothing on a floor is judged floating),
// and rises into hills away from the buildings. The play space itself is unchanged.
type Rect4 = [number, number, number, number, number]; // x0, z0, x1, z1, floor top
function surround(
  doc: MapDocument,
  o: {
    size: number;
    centre: [number, number];
    margin?: number;
    /** Desired ground height at (x, z), `d` metres from the nearest footprint (clamped to the apron). */
    hills: (x: number, z: number, d: number) => number;
    paint: (x: number, z: number, h: number, d: number) => TerrainMaterial;
    plants: (x: number, z: number, h: number, d: number, g: TerrainMaterial) => number;
  },
): { terrain: TerrainData; ground: (x: number, z: number) => number; dist: (x: number, z: number) => number } {
  const margin = o.margin ?? 4;
  const rects: Rect4[] = [];
  for (const b of buildMapGeometry(doc)) {
    if (b.kind !== 'floor' && b.kind !== 'wall') continue;
    rects.push([b.min[0], b.min[2], b.max[0], b.max[2], b.kind === 'floor' ? b.max[1] : b.min[1]]);
  }
  const rd = (x: number, z: number, r: Rect4) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3]));
  const dist = (x: number, z: number) => rects.reduce((a, r) => Math.min(a, rd(x, z, r)), Infinity);
  // Gameplay marks near an outer wall: the ground behind the wall drops well away, so the navmesh
  // never snaps a spawn or pickup onto the scenery outside.
  const marks = doc.entities.filter((e) => e.kind !== 'prop').map((e) => e.position);
  const cap = (x: number, z: number) => {
    let c = Infinity;
    for (const p of marks) if (Math.hypot(p[0] - x, p[2] - z) < 3.2) c = Math.min(c, p[1] - 3.4);
    let deep = Infinity;
    for (const r of rects) {
      if (x > r[0] + 0.6 && x < r[2] - 0.6 && z > r[1] + 0.6 && z < r[3] - 0.6) deep = Math.min(deep, r[4] - 3.5);
      c = Math.min(c, r[4] - 0.4 + 0.8 * Math.max(0, rd(x, z, r) - margin));
    }
    return Math.min(c, deep);
  };
  let t = newTerrain(o.size, 2, o.centre, 'grass');
  const heights: number[] = [];
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      const x = t.origin[0] + c * 2;
      const z = t.origin[1] + r * 2;
      heights.push(Math.round(Math.min(cap(x, z), o.hills(x, z, dist(x, z))) * 100));
    }
  }
  t = { ...t, heights };
  const materials: number[] = [];
  const foliage: number[] = [];
  for (let r = 0; r < t.rows - 1; r++) {
    for (let c = 0; c < t.cols - 1; c++) {
      const x = t.origin[0] + c * 2 + 1;
      const z = t.origin[1] + r * 2 + 1;
      const d = dist(x, z);
      const h = terrainHeightAt(t, x, z) ?? 0;
      const g = o.paint(x, z, h, d);
      materials.push(TERRAIN_MATERIALS.indexOf(g));
      // No plants growing up through floors along the walls.
      foliage.push(d < 2 ? 0 : o.plants(x, z, h, d, g));
    }
  }
  t = paintSlopes({ ...t, materials, foliage }, 38, 'stone');
  return { terrain: t, ground: (x, z) => +(terrainHeightAt(t, x, z) ?? 0).toFixed(2), dist };
}
/** Gentle rolling noise (deterministic). */
const roll = (x: number, z: number, s = 1) =>
  Math.sin(x * 0.071 * s + 1.3) * Math.cos(z * 0.053 * s + 0.4) + 0.6 * Math.sin((x + z) * 0.037 * s + 2.1) + 0.35 * Math.cos((x - z) * 0.11 * s);
/** Up to `count` spots in `area` that pass `ok`, at least `gap` m apart (and from `taken`), seeded. */
function scatter(seed: number, count: number, area: [number, number, number, number], gap: number, ok: (x: number, z: number) => boolean, taken: [number, number][] = []): [number, number, number][] {
  let s = seed >>> 0;
  const rand = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
  const out: [number, number, number][] = [];
  for (let n = 0; n < count * 40 && out.length < count; n++) {
    const x = area[0] + rand() * (area[2] - area[0]);
    const z = area[1] + rand() * (area[3] - area[1]);
    const r = rand();
    if (!ok(x, z) || taken.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < gap)) continue;
    taken.push([x, z]);
    out.push([+x.toFixed(2), +z.toFixed(2), r]);
  }
  return out;
}
/** Smoothed steps: terraces `step` m high. */
const terrace = (h: number, step: number) => {
  const k = Math.floor(h / step);
  const f = h / step - k;
  const e = Math.min(1, Math.max(0, (f - 0.7) / 0.3));
  return (k + e * e * (3 - 2 * e)) * step;
};

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

// ---------------------------------------------------------------- bomb sites

// Bomb mode: the two north squares are the sites (Embers attack from the south, Tide defend).
run('Add bomb sites', {
  kind: 'addEntities',
  entities: [
    { id: id('site'), kind: 'bombsite', position: [12, 0, 54], label: 'A', radius: 6 },
    { id: id('site'), kind: 'bombsite', position: [74, 0, 54], label: 'B', radius: 6 },
  ],
});

// ---------------------------------------------------------------- the desert round the town (scenery past the walls)

// Dunes roll away from the town walls on every side, with palms, cacti and rocks out in the sand,
// and a few dry bushes to hide in at the far corners of long and the two squares (well clear of the
// bomb sites). Everything players walk on stays as it was: the ground only starts outside the walls.
{
  const desert = surround(history.doc, {
    size: 260,
    centre: [40, 32],
    hills: (x, z, d) => Math.max(0, d - 5) * (0.3 + 0.1 * roll(x, z)) + 2.2 * Math.max(0, roll(x, z, 0.8)) * Math.min(1, d / 30) - 0.4,
    paint: (x, z, h, d) => (d < 4 ? 'gravel' : roll(x, z, 2.1) > 1.1 ? 'dirt' : 'sand'),
    plants: (x, z, h, d, g) => (g === 'dirt' ? 1 : 0),
  });
  run('Terrain', { kind: 'setTerrain', before: history.doc.terrain, after: desert.terrain });
  const scenery: MapEntity[] = [];
  const add = (model: string, x: number, y: number | null, z: number, yaw: number, scale: number, solid: boolean) => {
    const e = { id: id('prop'), kind: 'prop' as const, model: `prop.${model}`, position: [x, 0, z] as [number, number, number], yaw: +yaw.toFixed(2), scale, solid, tint: null };
    e.position[1] = y ?? settledPropY(desert.terrain, e) ?? 0;
    scenery.push(e);
  };
  const ok = (x: number, z: number) => desert.dist(x, z) > 2.5;
  const taken: [number, number][] = [];
  const area: [number, number, number, number] = [-80, -88, 160, 152];
  const TREES = ['nt_palm_tall', 'nt_saguaro', 'nt_palm_curved', 'nt_saguaro', 'cactus_tall'];
  for (const [x, z, r] of scatter(0x5a9d, 70, area, 7, ok, taken)) add(TREES[Math.floor(r * TREES.length)]!, x, null, z, r * 37 % 6.28, +(0.9 + (r * 13) % 0.35).toFixed(2), true);
  const SMALL = ['nt_cactus_round', 'nt_cactus_flowers', 'nt_rock_flat', 'nt_boulder', 'bush'];
  for (const [x, z, r] of scatter(0xd0e5, 80, area, 3, ok, taken)) add(SMALL[Math.floor(r * SMALL.length)]!, x, null, z, r * 41 % 6.28, +(0.9 + (r * 7) % 0.5).toFixed(2), SMALL[Math.floor(r * SMALL.length)] !== 'bush');
  // Dry bushes to hide in, inside: two down long, one in each square's far corner.
  for (const [x, z, yaw] of [[4.9, 10.5, 0.4], [11.1, 31.5, 2.2], [-2.6, 37.6, 1.1], [82.6, 37.6, 0.3]] as const) add('bush', x, 0, z, yaw, 1.2, false);
  run('Add scenery', { kind: 'addEntities', entities: scenery });
}

// ---------------------------------------------------------------- map settings

run('Change theme', setThemeCommand(history.doc, 'core.desert'));
run('Edit map', {
  kind: 'setMetadata',
  before: history.doc.metadata,
  after: {
    id: 'sandgate',
    author: 'Tile Trigger',
    description:
      'A sun-baked desert town for Team Deathmatch. Embers spawn in the south, Tide in the north. A long street runs up the west side, mid doors split the centre, covered tunnels wind up the east, and two crate-filled squares wait at the north end: bomb sites A and B in Bomb mode.',
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
