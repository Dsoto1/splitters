/**
 * Builds maps/citadel.json, a two-storey castle Deathmatch map that shows off
 * the building kit, props, breakables and the full arsenal, through the same
 * edit commands the MapMaker issues. Rerun after changing the layout:
 * `pnpm --filter @tiletrigger/server build-citadel`.
 *
 * Ground floor (grid x east, y north; one cell = 8 m), upper floor in brackets.
 * The keep (cells 1–4) stands in an outer bailey of courtyards (cells 0 and 5)
 * behind a high curtain wall:
 *
 *   y4  . R  N  N  T  .     R  colonnade room      N  north halls [roof terraces]
 *   y3  . W  A  A  E  .     W  west halls [upper rooms, windows]   E  east halls [upper rooms]
 *   y2  . W  A  A  E  .     A  two-storey atrium with a balcony all round
 *   y1  . T  S  S  R  .     S  south halls [roof terraces]   T  stairwells (both floors)
 *       0 1  2  3  4  5
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  EditHistory,
  TERRAIN_MATERIALS,
  addSpawnCommand,
  buildMapGeometry,
  loadMap,
  newMapDocument,
  newTerrain,
  paintSlopes,
  placeTileCommand,
  serializeMap,
  setEdgeCommand,
  setThemeCommand,
  settledPropY,
  terrainHeightAt,
  validateMap,
  type EdgeStyle,
  type MapDocument,
  type MapEntity,
  type Rotation,
  type Side,
  type TerrainData,
  type TerrainMaterial,
} from '@tiletrigger/shared';

const OUT = fileURLToPath(new URL('../../../../maps/citadel.json', import.meta.url));

let counter = 0;
const id = (prefix: string) => `${prefix}_${String(++counter).padStart(3, '0')}`;

const doc0 = newMapDocument('Citadel', new Date('2026-10-23T00:00:00.000Z'));
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

// The outer bailey: a ring of courtyards round the keep (cells 0 and 5), behind a high curtain wall.
// The keep's windows and slits stay walls, so its corner rooms and stairwells are the gates.
const bailey: [string, number, number][] = [];
for (let i = 0; i <= 5; i++) {
  bailey.push([i % 2 ? 'yard_crates' : 'yard', i, 0], [i % 2 ? 'yard' : 'yard_ruins', i, 5]);
  if (i > 0 && i < 5) bailey.push([i === 2 ? 'yard_wall' : 'yard', 0, i], [i === 3 ? 'yard_wall' : 'yard_crates', 5, i]);
}
for (const [kind, x, y] of bailey) tile(kind, x, y);
for (let i = 0; i <= 5; i++) {
  edge(i, 0, 0, 'S', 'high');
  edge(i, 5, 0, 'N', 'high');
  edge(0, i, 0, 'W', 'high');
  edge(5, i, 0, 'E', 'high');
}

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
  // The bailey.
  [0, 0, 0, Math.PI / 4], [40, 0, 0, -Math.PI / 4], [0, 0, 40, (3 * Math.PI) / 4], [40, 0, 40, (-3 * Math.PI) / 4],
  [20, 0, -1, 0], [20, 0, 41, Math.PI],
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
  // The bailey.
  ['weapon_marksman', 0, 0, 20],
  ['weapon_auto_shotgun', 40, 0, 20],
  ['armor_small', 20, 0, 0],
  ['health_small', 20, 0, 40],
  ['ammo_rifle', 1, 0, 9],
  ['ammo_shells', 39, 0, 31],
];
run('Add pickups', {
  kind: 'addEntities',
  entities: pickups.map(([item, x, y, z]) => ({ id: id('pickup'), kind: 'pickup' as const, item: `core.${item}`, position: [x, y, z] as [number, number, number], respawnSeconds: null })),
});

// ---------------------------------------------------------------- the hill under the castle (scenery past the curtain wall)

// The castle crowns a grassy knoll: the ground falls away from the curtain wall, then rolls out into
// wooded hills. Everything inside the wall stays as it was; banners hang on the curtain wall's inner face.
{
  const knoll = surround(history.doc, {
    size: 220,
    centre: [20, 20],
    hills: (x, z, d) => -Math.min(6, Math.max(0, d - 4) * 0.35) + Math.max(0, d - 34) * 0.32 + 1.6 * roll(x, z, 0.7) * Math.min(1, d / 30) - 0.4,
    paint: (x, z, h, d) => (d < 4 ? 'gravel' : d < 6 ? 'dirt' : roll(x, z, 2.2) > 0.9 ? 'moss' : 'grass'),
    plants: (x, z, h, d, g) => (g === 'grass' ? (d > 20 ? 3 : 2) : g === 'moss' ? 2 : 0),
  });
  run('Terrain', { kind: 'setTerrain', before: history.doc.terrain, after: knoll.terrain });
  const scenery: MapEntity[] = [];
  const add = (model: string, x: number, y: number | null, z: number, yaw: number, scale: number, solid: boolean) => {
    const e = { id: id('prop'), kind: 'prop' as const, model: `prop.${model}`, position: [x, 0, z] as [number, number, number], yaw: +yaw.toFixed(2), scale, solid, tint: null };
    e.position[1] = y ?? settledPropY(knoll.terrain, e) ?? 0;
    scenery.push(e);
  };
  const ok = (x: number, z: number) => knoll.dist(x, z) > 5;
  const taken: [number, number][] = [];
  const area: [number, number, number, number] = [-84, -84, 124, 124];
  const TREES = ['nt_common_tree', 'oak', 'nt_birch', 'nt_pine_tall', 'nt_common_tree_2', 'oak_dark'];
  for (const [x, z, r] of scatter(0xc17a, 90, area, 6, ok, taken)) add(TREES[Math.floor(r * TREES.length)]!, x, null, z, (r * 37) % 6.28, +(0.85 + ((r * 13) % 0.35)).toFixed(2), true);
  const SMALL = ['nt_bush_leafy', 'bush', 'nt_bush_berries', 'nt_boulder', 'nt_rock_moss'];
  for (const [x, z, r] of scatter(0xc5b, 70, area, 2.6, ok, taken)) {
    const model = SMALL[Math.floor(r * SMALL.length)]!;
    add(model, x, null, z, (r * 41) % 6.28, +(0.9 + ((r * 7) % 0.4)).toFixed(2), model.includes('rock') || model.includes('boulder'));
  }
  add('dg_banner', 12, 0, -3.5, Math.PI, 1, false);
  add('dg_banner', 28, 0, 43.5, 0, 1, false);
  run('Add scenery', { kind: 'addEntities', entities: scenery });
}

// ---------------------------------------------------------------- map settings

run('Change theme', setThemeCommand(history.doc, 'core.castle'));
run('Edit map', {
  kind: 'setMetadata',
  before: history.doc.metadata,
  after: {
    id: 'citadel',
    author: 'Tile Trigger',
    description:
      'A castle keep around a two-storey atrium, inside an outer bailey of courtyards behind a curtain wall; the corner rooms and stairwells are its gates. Halls with arched openings ring the ground floor; stairwells in two corners climb to barracks, a map room and roof terraces with cannons. Rockets wait in the atrium, the sniper rifle on the north roof. Shoot out the window panes, break the boards, and mind the powder kegs.',
    recommendedPlayers: { min: 4, max: 12 },
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
