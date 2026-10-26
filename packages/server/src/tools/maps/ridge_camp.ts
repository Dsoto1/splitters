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
import { TERRAIN_MATERIALS, buildMapGeometry, newTerrain, paintSlopes, terrainHeightAt, type MapDocument, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

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

const m = new MapBuilder('ridge_camp', 'Ridge Camp');
m.theme('castle');
m.backdrop('sunrise', 'mountains', 'grass', 0.5, 0.35);
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

// Bushes to hide in round the courtyard's edges, by the half walls and the side arches.
for (const [x, z, yaw, model] of [
  [-10.8, -3, 0.4, 'nt_bush_leafy'],
  [10.8, 3, 2.1, 'nt_bush_berries'],
  [10.6, -11, 0.2, 'nt_bush_leafy'],
] as const) m.prop(model, [x, 0, z], yaw, 1.15, false);
// Furniture in the bare rooms, for what they are in this theme.
m.furnish();
// Team bases at each end (spawns and a flag), hills through the middle.
await m.teamBases(5);

// ---------------------------------------------------------------- the ridge round the keep (scenery past the walls)
// Grass hills climb away from the walls, steepest behind the keep to the north where the ridge
// rises to bare rock. Fitted after the boundary and the team bases, so the play area is unchanged; pines and birches
// stand between the outer walls and the boundary.
const ridge = surround(m.doc, {
  size: 200,
  centre: [0, -4],
  hills: (x, z, d) => Math.max(0, d - 4) * (0.5 + 0.15 * roll(x, z)) + 1.6 * roll(x, z, 0.7) * Math.min(1, d / 28) + Math.max(0, z - 26) * 0.28 - 0.05,
  paint: (x, z, h, d) => (d < 5 ? 'gravel' : h > 16 ? 'stone' : roll(x, z, 1.9) > 1 ? 'dirt' : 'grass'),
  plants: (x, z, h, d, g) => (g === 'grass' ? 3 : g === 'dirt' ? 1 : 0),
});
m.terrain(ridge.terrain);
{
  const bx = m.doc.bounds!;
  const area: [number, number, number, number] = [bx.min[0] + 0.8, bx.min[1] + 0.8, bx.max[0] - 0.8, bx.max[1] - 0.8];
  const ok = (x: number, z: number) => ridge.dist(x, z) > 1.8;
  const taken: [number, number][] = [];
  const TREES = ['nt_pine_tall', 'nt_pine_small', 'nt_birch', 'pine', 'nt_birch', 'nt_pine_tall'];
  for (const [x, z, r] of scatter(0x41d6e, 34, area, 5.5, ok, taken)) {
    m.prop(TREES[Math.floor(r * TREES.length)]!, [x, ridge.ground(x, z), z], +((r * 37) % 6.28).toFixed(2), +(0.85 + ((r * 13) % 0.35)).toFixed(2));
  }
  const UNDER = ['nt_bush_leafy', 'bush', 'nt_bush_berries', 'nt_fern_wide', 'nt_rock_moss'];
  for (const [x, z, r] of scatter(0xb05, 34, area, 2.4, ok, taken)) {
    const model = UNDER[Math.floor(r * UNDER.length)]!;
    m.prop(model, [x, ridge.ground(x, z), z], +((r * 41) % 6.28).toFixed(2), +(0.9 + ((r * 7) % 0.4)).toFixed(2), model === 'nt_rock_moss');
  }
}
m.lightRooms();
m.meta({
  description:
    'A stone keep round an open courtyard, four storeys of fighting: a sunken pit with the rocket launcher, the courtyard and its cloister, a U of railed ledges reached by stairs and a long ramp, and a high deck over the north colonnade that only the jump pad reaches, holding the railgun. An homage in spirit to the great multi-level stone arenas.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 10],
});
await m.save();
