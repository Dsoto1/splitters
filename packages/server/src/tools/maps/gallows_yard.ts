/**
 * Gallows Yard: a walled castle courtyard full of tomb blocks, with a gallows
 * platform in the middle (homage in spirit to Halo's "Hang 'Em High"). Each
 * team holds a two-storey gatehouse at one end; its roof joins a raised
 * walkway that runs the length of the far wall, over a covered arcade, and is
 * broken halfway by a narrow bridge. Open stairs climb from the courtyard to
 * the walkways, and from the arcades up onto the gallows in the middle (jump
 * pads throw you up there from the sides), where the railgun waits above the
 * crypt that hides the rocket launcher. The map is
 * rotationally symmetric, so both teams get the same deal.
 *
 * Ground z0 (grid x east, y north; one cell = 8 m), walkways z1 in [brackets]:
 *
 *   y4   c[w]  a[w]  a[w]  a[w]  a[=]  a[w]  a[w]  a[w]  S       S stairwell (z0-1) up to the gatehouse roof
 *   y3   G[r]  t     s/    r     s|    T     s/    w     G[r]    G gatehouse rooms, roof [r] above
 *   y2   D[r]  y     r     y     g[G]  y     r     y     D[r]    D dais room, g crypt under the gallows [G]; pads either side
 *   y1   G[r]  w     s/    T     s|    r     s/    t     G[r]    s/ open stairs up to the walkway
 *   y0   S     a[w]  a[w]  a[w]  a[=]  a[w]  a[w]  a[w]  c[w]    a arcade under the walkway, [=] bridge
 *        0     1     2     3     4     5     6     7     8       s| stairs up to the gallows, T terrace, r ruins, t crates
 *
 * Embers hold the west gatehouse, Tide the east one.
 */
import { TERRAIN_MATERIALS, buildMapGeometry, newTerrain, paintSlopes, terrainHeightAt, type EdgeStyle, type MapDocument, type Rotation, type Side, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
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

const m = new MapBuilder('gallows_yard', 'Gallows Yard');
m.theme('castle');
m.backdrop('dusk', 'forest', 'grass', 0.6, 0.45);
const [embers, tide] = m.teamIds() as [string, string];
const P = Math.PI / 2;

// Half-turn symmetry about the centre cell (4, 2) = world (32, 16).
const turnRot = (r: Rotation): Rotation => ((r + 2) % 4) as Rotation;
const turnSide: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };
const pair = (kind: string, x: number, y: number, z = 0, rot: Rotation = 0) => {
  m.tile(kind, x, y, z, rot);
  m.tile(kind, 8 - x, 4 - y, z, turnRot(rot));
};
const edges = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => {
  m.edge(x, y, z, side, style);
  m.edge(8 - x, 4 - y, z, turnSide[side], style);
};
type V3 = [number, number, number];
const turn = (p: V3): V3 => [64 - p[0], p[1], 32 - p[2]];
const twice = (fn: (p: V3, yaw: number, second: boolean) => void, p: V3, yaw = 0) => {
  fn(p, yaw, false);
  fn(turn(p), yaw + Math.PI, true);
};

// ---------------------------------------------------------------- gatehouses
pair('room', 0, 1);
pair('room_dais', 0, 2, 0, 3); // steps face the courtyard
pair('room', 0, 3);
pair('stairwell', 0, 0, 0, 1); // doors north on both floors
for (const y of [1, 2, 3]) pair('platform_rail', 0, y, 1); // the gatehouse roof
pair('yard', 0, 4); // arcade corner, the gatehouse's side door

// ---------------------------------------------------------------- the courtyard
for (let x = 1; x <= 7; x++) pair('yard', x, 4); // arcades along both long walls (and the far ones by symmetry)
const row1: [string, Rotation][] = [
  ['yard_wall', 1],
  ['stairs_open', 1], // up south onto the walkway
  ['terrace', 2],
  ['stairs_open', 3], // up north onto the gallows
  ['yard_ruins', 0],
  ['stairs_open', 1],
  ['yard_crates', 1],
];
row1.forEach(([kind, rot], i) => pair(kind, i + 1, 1, 0, rot));
pair('yard', 1, 2);
pair('yard_ruins', 2, 2, 0, 1);
pair('yard', 3, 2);
m.tile('yard', 4, 2); // under the gallows

// ---------------------------------------------------------------- walkways and the gallows (z1)
for (const x of [0, 1, 2, 3, 5, 6, 7]) pair('platform_rail', x, 4, 1);
pair('bridge', 4, 4, 1, 1);
m.tile('platform_rail', 4, 2, 1); // the gallows

// ---------------------------------------------------------------- walls
for (let x = 0; x <= 7; x++) edges(x, 4, 1, 'N', 'wall'); // outer wall above the arcade
edges(0, 4, 1, 'W', 'wall');
for (const y of [1, 2, 3]) {
  edges(0, y, 1, 'W', 'wall');
  edges(0, y, 0, 'E', 'arch');
}
for (const x of [2, 4, 6]) {
  edges(x, 1, 0, 'E', 'open'); // open stairs stand free in the courtyard
  edges(x, 1, 0, 'W', 'open');
}
m.edge(4, 2, 1, 'E', 'open').edge(4, 2, 1, 'W', 'open'); // drop off the gallows sideways
m.edge(4, 2, 0, 'E', 'arch').edge(4, 2, 0, 'W', 'arch'); // the crypt under the gallows

// ---------------------------------------------------------------- jump pads up onto the gallows, from either side
twice((q, yaw) => m.pad(q, yaw, 16, 9.3), [20, 0, 16], P);

// ---------------------------------------------------------------- spawns: Embers west gatehouse, Tide east
const gate: [number, number, number, number][] = [
  [-2, 0, 7, P],
  [2, 0, 9, P],
  [2.5, 0, 13, P],
  [-2, 0, 23, P],
  [2, 0, 25, P],
  [-1, 4, 9, P],
  [-1, 4, 22, P],
];
for (const [x, y, z, yaw] of gate) {
  m.spawn([x, y, z], yaw, embers);
  m.spawn(turn([x, y, z]), yaw + Math.PI, tide);
}

// ---------------------------------------------------------------- pickups
m.pickup('weapon_railgun', [32, 4, 16]); // on the gallows
m.pickup('weapon_rockets', [32, 0, 16]); // under it
const items: [string, V3][] = [
  ['armor_small', [32, 4, 32]], // on the bridge
  ['health_large', [32, 0, 32]], // under the bridge
  ['weapon_sawed_off', [12, 0, 1]], // arcade
  ['weapon_burst_rifle', [0, 0, 27]], // gatehouse
  ['weapon_marksman', [8, 4, 32]], // walkway by the home gatehouse
  ['weapon_plasma', [40, 4, 32]], // walkway near the far end
  ['health_small', [11, 0, 16]],
  ['health_small', [-1, 4, 16]], // gatehouse roof
  ['ammo', [-2, 0, 16]],
  ['grenades', [26, 0, 20]],
  ['ammo_explosive', [44, 0, 31]],
  ['ammo_cells', [20, 4, 0]],
];
for (const [item, p] of items) twice((q) => m.pickup(item, q), p);

// ---------------------------------------------------------------- tomb blocks, colonnade and dressing
const tombs: [string, V3, number, number][] = [
  ['crypt', [23, 0, 11], 0, 0.9], // tall tomb by the terrace
  ['stone_wall', [10, 0, 12], P, 2], // slab in front of the gatehouse
  ['crypt', [25, 0, 25], 0.2, 0.35], // low step
  ['gravestone_cross', [15, 0, 16], P, 2.5],
  ['crypt', [9, 0, 21], 0, 0.6], // chest-high block
  ['gravestone_round', [27, 0, 10], 0, 2.2],
  ['obelisk', [6, 0, 31], 0, 1], // arcade corner
  ['column', [24, 0, 29.5], 0, 1], // colonnade
  ['column', [8, 0, 29.5], 0, 1],
  ['coffin_old', [21, 0, 3], P, 1],
];
for (const [model, p, yaw, scale] of tombs) twice((q, yw) => m.prop(model, q, yw, scale), p, yaw);
const dressing: [string, V3, number][] = [
  ['banner', [3.6, 4, 16], -P], // on the gatehouse roof
  ['fire_basket', [-2.2, 0, 2], 0],
  ['candles', [0, 0.75, 16.5], 0],
  ['grave', [16, 0, 30], 0],
  ['lantern', [28, 0, 33], 0],
];
for (const [model, p, yaw] of dressing) twice((q, yw) => m.prop(model, q, yw, model === 'fire_basket' ? 0.6 : 1, model === 'fire_basket'), p, yaw);
m.prop('flag', [35, 4, 19], 0, 0.8, false); // on the gallows

m.bounds('invisible');

// ---------------------------------------------------------------- the hills round the castle (scenery past the walls)
// Wooded hills roll away from the curtain wall, and a dead wood crowds the strip under it.
// Fitted after the boundary, so the play area is unchanged.
const hills = surround(m.doc, {
  size: 220,
  centre: [32, 16],
  hills: (x, z, d) => Math.max(0, d - 4) * (0.36 + 0.12 * roll(x, z)) + 1.8 * roll(x, z, 0.6) * Math.min(1, d / 30) - 0.4,
  paint: (x, z, h, d) => (d < 5 ? 'dirt' : roll(x, z, 1.6) > 0.95 ? 'mud' : roll(x, z, 2.3) > 0.7 ? 'moss' : 'grass'),
  plants: (x, z, h, d, g) => (g === 'grass' ? (d > 14 ? 3 : 2) : g === 'moss' ? 2 : 0),
});
m.terrain(hills.terrain);
{
  const bx = m.doc.bounds!;
  const area: [number, number, number, number] = [bx.min[0] + 0.8, bx.min[1] + 0.8, bx.max[0] - 0.8, bx.max[1] - 0.8];
  const ok = (x: number, z: number) => hills.dist(x, z) > 1.8;
  const taken: [number, number][] = [];
  const TREES = ['nt_dead_tree', 'rn_dead_tree', 'nt_common_tree_autumn', 'nt_willow_dead', 'oak_dark', 'nt_birch_autumn'];
  for (const [x, z, r] of scatter(0x9a110, 36, area, 5.5, ok, taken)) {
    m.prop(TREES[Math.floor(r * TREES.length)]!, [x, hills.ground(x, z), z], +((r * 37) % 6.28).toFixed(2), +(0.85 + ((r * 13) % 0.35)).toFixed(2));
  }
  const UNDER = ['nt_bush_leafy', 'bush', 'nt_rock_moss', 'nt_fern_wide', 'nt_stump_moss'];
  for (const [x, z, r] of scatter(0xd05e, 36, area, 2.4, ok, taken)) {
    const model = UNDER[Math.floor(r * UNDER.length)]!;
    m.prop(model, [x, hills.ground(x, z), z], +((r * 41) % 6.28).toFixed(2), +(0.9 + ((r * 7) % 0.4)).toFixed(2), model === 'nt_rock_moss' || model === 'nt_stump_moss');
  }
}
// Overgrown corners by each gatehouse's doors: bushes to lurk in on the approach (both ends).
twice((q, yw) => m.prop('nt_bush_leafy', q, yw, 1.1, false), [5.6, 0, 12.4], 0.5);
twice((q, yw) => m.prop('nt_bush_berries', q, yw, 1.1, false), [5.6, 0, 19.6], 2);
// Castle dressing: banners on the walkway wall, urns among the tombs.
twice((q, yw) => m.prop('dg_banner', q, yw, 1, false), [16, 4, 35.5], 0);
twice((q, yw) => m.prop('rn_urn_broken', q, yw), [17.4, 0, 18.6], 0.4);
m.teams([4, 4]);
// Furniture in the bare rooms, for what they are in this theme.
m.furnish();
m.lightRooms();
m.meta({
  description:
    "A walled castle courtyard crowded with tomb blocks of every height, made in the spirit of the classic tombstone-courtyard arena. Embers and Tide each hold a gatehouse at one end; its roof runs into a raised walkway along the far wall, over a covered arcade and across a narrow bridge. Open stairs climb out of the graves, and jump pads throw you up onto the gallows in the middle, where the railgun waits above the rocket launcher.",
  modes: ['core.tdm', 'core.deathmatch'],
  players: [2, 10],
});
await m.save();
