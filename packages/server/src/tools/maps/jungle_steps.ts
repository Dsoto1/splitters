/**
 * Jungle Steps: two temple camps at either end of an overgrown ruin, split by
 * a river gorge (homage in spirit to Counter-Strike's "Aztec"). Three ways
 * across: the long high bridge over the ravine in the west (sniper rifle in
 * the middle, an 8 m fall into the gorge if you get knocked off), the stone
 * "double doors" causeway in the middle with the river running underneath
 * it, and the sunken river route in the east, reached by stair blocks at
 * both ends (rocket launcher in the culvert, heavy armour in the nook).
 * The map is mirrored north/south, so both teams get the same deal.
 *
 * Ground level z0 (grid x east, y north; one cell = 8 m). Upper level z1 in
 * [brackets], the sunken river z-1 as ~ (S = stair block down to it):
 *
 *   y10  .   T   T   T   T   .   .   .     T  Tide camp (north)
 *    9   .  T   T   T   T   c   y   .
 *    8   .  st  ru  R   y   .   y   .     st open stairs up to the bridge
 *    7   .  r[p] r   r   y   h   y   .     r  rim, p  bridge head, h  ruin hut
 *    6   ~   ~[b]~   r   y   r   S   .
 *    5   ~   ~[b]~   ~   D   ~   ~   ~     D  double doors over the river
 *    4   ~   ~[b]~   r   y   r   S   .     b  high bridge (z1) over the ravine
 *    3   .  r[p] r   r   y   h   y   .
 *    2   .  st  ru  R   y   .   y   .     R  antechamber, ru ruins
 *    1   .  E   E   E   E   c   y   .     c  tunnel to the river path
 *    0   .  E   E   E   W   .   .   .     E  Embers camp (south), W watchtower
 *        0   1   2   3   4   5   6   7
 */
import { TERRAIN_MATERIALS, buildMapGeometry, newTerrain, paintSlopes, terrainHeightAt, type MapDocument, type Rotation, type Side, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
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

const m = new MapBuilder('jungle_steps', 'Jungle Steps');
m.theme('ruins');
const [embers, tide] = m.teamIds() as [string, string];

// The map mirrors across y = 5 (world z = 40): south half as written, north half flipped.
const MY = 10;
const flipRot = (r: Rotation): Rotation => ((r + 2) % 4) as Rotation;
const flipSide = (s: Side): Side => (s === 'N' ? 'S' : s === 'S' ? 'N' : s);
const P = Math.PI / 2;
const pair = (kind: string, x: number, y: number, z = 0, rot: Rotation = 0) => {
  m.tile(kind, x, y, z, rot);
  m.tile(kind, x, MY - y, z, flipRot(rot));
};
const edges = (x: number, y: number, z: number, side: Side, style: Parameters<MapBuilder['edge']>[4]) => {
  m.edge(x, y, z, side, style);
  m.edge(x, MY - y, z, flipSide(side), style);
};
type V3 = [number, number, number];
const mirror = (p: V3): V3 => [p[0], p[1], 80 - p[2]];
const both = (fn: (p: V3, yaw: number, north: boolean) => void, p: V3, yaw = 0) => {
  fn(p, yaw, false);
  fn(mirror(p), Math.PI - yaw, true);
};

// ---------------------------------------------------------------- camps (z0)
pair('yard', 1, 0);
pair('yard_ruins', 2, 0, 0, 1);
pair('yard', 3, 0);
pair('tower', 4, 0); // lookout along the east side
pair('yard_crates', 1, 1, 0, 3);
pair('yard', 2, 1);
pair('terrace', 3, 1, 0, 1); // a 1 m stone step-up on the east side of the camp
pair('yard', 4, 1);

// ---------------------------------------------------------------- west: stairs up to the high bridge
pair('stairs_open', 1, 2, 0, 3); // climbs from the camp (south) to the bridge head (north)
pair('platform_rail', 1, 3, 1); // bridge head, roofing the rim below
m.tile('bridge', 1, 4, 1).tile('bridge', 1, 5, 1).tile('bridge', 1, 6, 1);

// ---------------------------------------------------------------- the rim of the gorge and the middle lane (z0)
pair('yard_ruins', 2, 2);
pair('room_pillar', 3, 2); // antechamber: four doors
pair('yard', 4, 2);
pair('yard', 1, 3); // under the bridge head
pair('terrace', 2, 3); // stone step-up overlooking the ravine
pair('yard', 3, 3);
pair('yard_wall', 4, 3, 0, 1);
pair('yard', 3, 4);
pair('yard', 4, 4);
pair('yard', 5, 4);
m.tile('corridor_clear', 4, 5); // the double doors causeway, river underneath

// ---------------------------------------------------------------- east: tunnel, river path and the ruin hut (z0)
pair('corridor', 5, 1, 0, 1);
pair('yard', 6, 1);
pair('yard_crates', 6, 2, 0, 2);
pair('yard', 6, 3);
pair('room_columns', 5, 3); // ruin hut, four columns

// ---------------------------------------------------------------- the gorge and the river (z-1)
for (const x of [0, 1, 2]) pair('yard', x, 4, -1);
for (let x = 0; x <= 7; x++) m.tile(x === 1 ? 'yard_ruins' : 'yard', x, 5, -1);
pair('stairs', 6, 4, -1, 1); // stair blocks: river (north) up to the east path (south)

// ---------------------------------------------------------------- walls
// Low stone parapets along the gorge, with a gap to drop in on each side.
edges(1, 3, 0, 'N', 'half');
edges(2, 3, 0, 'N', 'half');
edges(3, 4, 0, 'W', 'open');
edges(3, 4, 0, 'N', 'half');
edges(5, 4, 0, 'N', 'half');
// Windows out of the causeway along the river; arches and low walls to break up the rim.
m.edge(4, 5, 0, 'E', 'window').edge(4, 5, 0, 'W', 'window');
edges(3, 3, 0, 'E', 'half');
edges(3, 4, 0, 'E', 'arch');
edges(2, 2, 0, 'E', 'arch');
edges(4, 2, 0, 'S', 'wide');
// Windows out of the antechamber and the ruin hut over the lanes.
edges(5, 3, 0, 'W', 'window');
edges(3, 2, 0, 'N', 'arch');

// ---------------------------------------------------------------- spawns: Embers south, Tide north
const camp: [number, number, number][] = [
  [6, -2, 0.2],
  [14, -1, 0],
  [24, -1, -0.2],
  [7, 10, 0.3],
  [17, 10, 0],
  [33, 10, -0.4],
];
for (const [x, z, yaw] of camp) {
  m.spawn([x, 0, z], yaw, embers);
  m.spawn(mirror([x, 0, z]), Math.PI - yaw, tide);
}

// ---------------------------------------------------------------- pickups
// Contested power: sniper rifle mid-bridge, rockets in the culvert under the causeway, heavy armour in the river nook.
m.pickup('weapon_sniper', [8, 4, 40]);
m.pickup('weapon_rockets', [32, -4, 40]);
m.pickup('armor_large', [58, -4, 40]);
m.pickup('health_large', [8, -4, 40]); // bottom of the gorge, under the bridge
m.pickup('ammo_explosive', [44, -4, 40]);
const sideItems: [string, V3][] = [
  ['weapon_burst_rifle', [16, 0, 16]], // ruins by the stairs
  ['weapon_sawed_off', [24, 0, 18]], // antechamber
  ['weapon_marksman', [8, 4, 25]], // bridge head
  ['weapon_smg', [48, 0, 16]], // east path
  ['ammo_sniper', [8, 0, 24]], // under the bridge head
  ['health_small', [26, 0, 30]], // rim
  ['health_small', [48, 0, 6]], // east yard
  ['armor_small', [38, 0, 24]], // ruin hut
  ['grenades', [32, 0, 30]], // middle lane
  ['ammo', [16, 0, 7]], // camp
  ['health_small', [0, -4, 32]], // gorge corner
];
for (const [item, p] of sideItems) both((q) => m.pickup(item, q), p);

// ---------------------------------------------------------------- props: jungle, rocks and fallen stones
const solid: [string, V3, number, number][] = [
  ['palm', [3, 0, 3], 0, 1],
  ['tree_tall', [30, 0, -2.5], 0, 1],
  ['rock_large', [27, 0, 3], 0.5, 1],
  ['column', [12, 0, 27], 0, 1], // broken column on the rim
  ['stone_wall_damaged', [21, 0, 28], 0, 1.2],
  ['rocks_tall', [3, -4, 35], 0.4, 0.8], // gorge
  ['rock_large', [14, -4, 34], 1.2, 1.3],
  ['log', [13, -4, 37], 0.4, 1.2],
  ['palm_bent', [49, 0, 21], 2.4, 1],
  ['crate_large', [54, 0, 10], 0.2, 1],
  ['stone_wall', [36, 0, 33], P, 1],
  ['obelisk', [36, 0, 16], 0, 1],
  ['pillar', [6, 0, 30], 0, 1],
  ['stump', [44, 0, 9], 0, 1],
];
for (const [model, p, yaw, scale] of solid) both((q, yw) => m.prop(model, q, yw, scale), p, yaw);
const dressing: [string, V3, number][] = [
  ['grass_tuft', [10, 0, 2], 0],
  ['plant_small', [20, 0, 5], 0],
  ['grass_tuft', [30, 0, 33], 1],
  ['plant_small', [46, 0, 30], 0],
  ['grass_tuft', [18, -4, 30], 0],
  ['lantern', [26, 0, 14], 0],
];
for (const [model, p, yaw] of dressing) both((q, yw) => m.prop(model, q, yw, 1, false), p, yaw);
// The river: reeds and a sunk boat in the middle.
m.prop('rowboat', [44, -4, 41], 1.4).prop('rock_medium', [52, -4, 38]).prop('rock_medium', [20, -4, 42]);
m.prop('rocks_tall', [14, -4, 45], 2, 0.7);
m.prop('grass_tuft', [24, -4, 38], 0, 1, false).prop('grass_tuft', [38, -4, 42], 0, 1, false);

m.bounds('invisible');

// ---------------------------------------------------------------- the jungle round the ruin (scenery past the walls)
// Terraced jungle hills climb away from the walls on every side; the river valley runs on out of
// the gorge to the east and west. Fitted after the boundary, so the play area is unchanged; palms
// and undergrowth fill the strip between the outer walls and the boundary.
const jungle = surround(m.doc, {
  size: 220,
  centre: [28, 40],
  hills: (x, z, d) => {
    const up = Math.max(0, d - 4) * (0.42 + 0.12 * roll(x, z)) + 1.2 * roll(x, z, 0.6) * Math.min(1, d / 24);
    let h = terrace(up, 2.4) - 0.05;
    // The river valley out of the gorge.
    if (x < -4 || x > 60) h = Math.min(h, -4.4 + Math.max(0, Math.abs(z - 40) - 7) * 0.55);
    return h;
  },
  paint: (x, z, h, d) => (h < -3 ? 'mud' : d < 5 ? 'dirt' : roll(x, z, 1.7) > 0.9 ? 'moss' : 'grass'),
  plants: (x, z, h, d, g) => (g === 'grass' ? (d > 14 ? 4 : 3) : g === 'moss' ? 3 : g === 'mud' ? 1 : 1),
});
m.terrain(jungle.terrain);
{
  const bx = m.doc.bounds!;
  // Between the outer walls and the boundary: crowns lean in over the walls.
  const outside = (x: number, z: number) => jungle.dist(x, z) > 1.8;
  const area: [number, number, number, number] = [bx.min[0] + 0.8, bx.min[1] + 0.8, bx.max[0] - 0.8, bx.max[1] - 0.8];
  const taken: [number, number][] = [];
  const TREES = ['nt_palm_tall', 'nt_palm_curved', 'palm', 'palm_bent', 'nt_common_tree', 'nt_common_tree_2', 'nt_palm_tall', 'tree_tall'];
  for (const [x, z, r] of scatter(0x7a11e, 60, area, 5, outside, taken)) {
    m.prop(TREES[Math.floor(r * TREES.length)]!, [x, jungle.ground(x, z), z], +(r * 37).toFixed(2) % 6.28, +(0.85 + ((r * 13) % 0.4)).toFixed(2));
  }
  const UNDER = ['nt_bush_leafy', 'bush_large', 'nt_fern_wide', 'nt_bush_berries', 'fern', 'bush_leafy'];
  for (const [x, z, r] of scatter(0xfe4, 60, area, 2.2, outside, taken)) {
    m.prop(UNDER[Math.floor(r * UNDER.length)]!, [x, jungle.ground(x, z), z], +(r * 41).toFixed(2) % 6.28, +(0.9 + ((r * 7) % 0.5)).toFixed(2), false);
  }
}
// Bushes to hide in on the flanks: the east path, under the bridge head, the rim and the gorge floor (mirrored).
const hide: [string, V3, number][] = [
  ['nt_bush_leafy', [50.6, 0, 10.6], 0.4], // east yard corner
  ['bush_large', [50.2, 0, 8.4], 1.1],
  ['nt_bush_berries', [50.4, 0, 25.2], 2.2], // east path by the hut
  ['nt_bush_leafy', [49.6, 0, 27.4], 0.3],
  ['nt_bush_leafy', [4.6, 0, 21], 1.7], // under the bridge head
  ['bush_large', [5.2, 0, 26.6], 0.2],
  ['nt_bush_berries', [21, 0, 26.6], 0.9], // rim, behind the half wall
  ['nt_bush_leafy', [-2.4, -4, 29.6], 2.8], // gorge corner
  ['bush_large', [19.6, -4, 30.4], 0.6], // gorge, by the tuft
];
for (const [model, p, yaw] of hide) both((q, yw) => m.prop(model, q, yw, 1.15, false), p, yaw);
// Ruin pieces: a broken column on the rim, an urn in the corner of the lane.
both((q, yw) => m.prop('rn_column_broken', q, yw, 1.2), [21, 0, 34.4], 0.3);
both((q, yw) => m.prop('rn_urn', q, yw), [27.2, 0, 26.8], 0);
m.teams([5, 5]);
// Furniture in the bare rooms, for what they are in this theme.
m.furnish();
m.lightRooms();
m.meta({
  description:
    'An overgrown temple ruin split by a river gorge. Embers camp in the south, Tide in the north. Cross by the long high bridge over the ravine (sniper rifle halfway, an 8 m fall if you get knocked off), the stone double-doors causeway in the middle, or the sunken river route through the gorge, reached by stair blocks at either end, where rockets wait in the culvert and heavy armour in the far nook.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [4, 12],
});
await m.save();
