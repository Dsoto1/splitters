/**
 * Step Temple: a pillared courtyard hall at the heart of a stepped marble
 * temple, ringed by cloisters and side chambers, with galleries a storey up
 * that look down into the court and a cross of walkways over it (an homage in
 * spirit to GoldenEye's Temple). The plan turns four times round the middle:
 * each side has a cloister, a stair rising to the next corner's gallery, and
 * three side chambers that link round the outside to the next cloister.
 *
 *   ground (z0)                              upper (z1)
 *     x: -1  0  1  2  3  4  5                  x: 0  1  2  3  4
 *   y5               c  c  c
 *   y4       c  c  c  A  →  c                 y4   g  g  g  /  g
 *   y3       c  ↑  [ COURT ]  c               y3   /  .  ║  .  g
 *   y2       c  A  [ COURT ]  A  c            y2   g  ═  P  ═  g
 *   y1          c  [ COURT ]  ↓  c            y1   g  .  ║  .  /
 *   y0          c  ←  A  c  c  c              y0   g  /  g  g  g
 *   y-1         c  c  c
 *
 *   COURT  Great Hall (3 × 3): colonnades and a central dais, open to the sky
 *   A      archways from the cloisters into the court; ← ↑ → ↓ stairs (arrow = uphill, / its top)
 *   g      galleries over the cloisters, a half wall onto the court
 *   P      railed platform over the dais, joined to all four galleries by bridges (║ ═)
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

const m = new MapBuilder('step_temple', 'Step Temple');
m.theme('temple');
// Like the original, a temple lost in the jungle.
m.backdrop('clear', 'forest', 'moss', 0.55, 0.5);
const P = Math.PI / 2;
const SIDES: Side[] = ['N', 'E', 'S', 'W'];
type V3 = [number, number, number];

/**
 * The plan is drawn once for the south side and turned a quarter turn
 * anticlockwise about the court's centre cell (2, 2) for each other side.
 */
class Frame {
  constructor(readonly k: number) {}
  cell(x: number, y: number): [number, number] {
    for (let i = 0; i < this.k; i++) [x, y] = [4 - y, x];
    return [x, y];
  }
  rot(r: number): Rotation {
    return ((r + 3 * this.k) % 4) as Rotation;
  }
  side(s: Side): Side {
    return SIDES[(SIDES.indexOf(s) + 3 * this.k) % 4]!;
  }
  /** World position from cell + offset in the south frame. */
  pos(x: number, y: number, z: number, dx = 0, dy = 0, up = 0): V3 {
    let X = x * 8 + dx;
    let Z = y * 8 + dy;
    for (let i = 0; i < this.k; i++) [X, Z] = [32 - Z, X];
    return [X, z * 4 + up, Z];
  }
  yaw(y: number): number {
    return y - this.k * P;
  }
  tile(kind: string, x: number, y: number, z: number, r: number): this {
    const [cx, cy] = this.cell(x, y);
    m.tile(kind, cx, cy, z, this.rot(r));
    return this;
  }
  edge(x: number, y: number, z: number, s: Side, style: Parameters<MapBuilder['edge']>[4]): this {
    const [cx, cy] = this.cell(x, y);
    m.edge(cx, cy, z, this.side(s), style);
    return this;
  }
}

const frames = [0, 1, 2, 3].map((k) => new Frame(k));

// ---------------------------------------------------------------- structure

// The court: a 3 × 3 great hall, and a railed platform a storey above its dais.
m.tile('hall', 1, 1);
m.tile('platform_rail', 2, 2, 1);

for (const f of frames) {
  // Cloister: a stair rising west to the corner gallery, a T with the court arch, a corridor, the corner chamber.
  f.tile('stairs', 1, 0, 0, 2).tile('junction_t', 2, 0, 0, 2).tile('corridor', 3, 0, 0, 1).tile('room_pillar', 4, 0, 0, 0);
  // Side chambers outside the next corner, linking round to the next cloister.
  f.tile('room_columns', 5, 0, 0, 0).tile('room_cover', 5, 1, 0, 0).tile('room_ledge', 5, 2, 0, 0);
  // Galleries over the cloister, and the bridge out to the platform.
  f.tile('room', 2, 0, 1, 0).tile('room', 3, 0, 1, 0).tile('room', 4, 0, 1, 0);
  f.tile('bridge', 2, 1, 1, 0);
}

for (const f of frames) {
  // Into the court: an archway from the T, twin windows from the corridor.
  f.edge(2, 0, 0, 'N', 'arch').edge(3, 0, 0, 'N', 'windows');
  // Galleries: open along their length and onto the bridge, a half wall over the court, windows out.
  f.edge(2, 0, 1, 'N', 'open').edge(2, 0, 1, 'E', 'open').edge(3, 0, 1, 'E', 'open').edge(3, 0, 1, 'N', 'half');
  f.edge(2, 0, 1, 'S', 'window').edge(4, 0, 1, 'S', 'windows').edge(4, 0, 1, 'E', 'window');
  // Side chambers: wide ways between them, slits out.
  f.edge(5, 0, 0, 'N', 'wide').edge(5, 1, 0, 'N', 'wide').edge(5, 0, 0, 'E', 'slit');
}

// ---------------------------------------------------------------- props

// The court: braziers in the corners (they explode), urns along the colonnades.
for (const [x, z] of [[6.8, 6.8], [25.2, 6.8], [6.8, 25.2], [25.2, 25.2]] as const) m.prop('fire_basket', [x, 0, z], 0, 0.7);
m.prop('altar', [16, 1, 17.2], 0).prop('candles', [16, 2, 17.2], 0, 1, false);
for (const x of [12, 20]) {
  m.prop('urn', [x, 0, 10.8]).prop('urn', [x, 0, 21.2]);
}

for (const f of frames) {
  // Cloister and corner chamber.
  m.prop('pot', f.pos(3, 0, 0, 3, -3));
  m.prop('obelisk', f.pos(4, 0, 0, 2.6, -2.6));
  m.prop('urn', f.pos(4, 0, 0, -2.8, 2.8));
  // Side chambers: a shrine on the ledge, pillars and offerings in the two chambers before it.
  m.prop('cross_column', f.pos(5, 2, 0, 3, -3)).prop('cross_column', f.pos(5, 2, 0, -3, -3)).prop('obelisk', f.pos(5, 2, 0, -2.6, 2.4, 1.5));
  m.prop('banner', f.pos(5, 2, 0, 3.6, 0), f.yaw(-P), 1, false);
  m.prop('dungeon_chest', f.pos(5, 0, 0, 2.8, -3));
  m.prop('pot', f.pos(5, 1, 0, 3, -3.2)).prop('pot', f.pos(5, 1, 0, 3.2, -2.5));
  // Galleries: urns between the windows, a low stone wall as cover.
  m.prop('urn', f.pos(4, 0, 1, 3, -3)).prop('stone_wall', f.pos(3, 0, 1, 0, -1), 0);
  m.prop('lantern', f.pos(2, 0, 1, -3, -3), 0, 1, false);
}

// ---------------------------------------------------------------- spawns and pickups

for (const f of frames) {
  m.spawn(f.pos(3, 0, 0, 1, -1.5), f.yaw(-P));
  m.spawn(f.pos(5, 0, 0, 0, -2), f.yaw(0));
  m.spawn(f.pos(3, 0, 1, 1, 1), f.yaw(0));
}

// Power: the railgun on the platform over the court, heavy armour at the foot of the dais beneath it.
m.pickup('weapon_railgun', [16, 4, 16]).pickup('armor_large', [16, 0, 11.8]);
const side = [
  { weapon: 'weapon_burst_rifle', ammo: 'ammo_rifle', extra: 'grenades', armour: true },
  { weapon: 'weapon_auto_shotgun', ammo: 'ammo_shells', extra: 'health_large', armour: false },
  { weapon: 'weapon_marksman', ammo: 'ammo_sniper', extra: 'mines', armour: true },
  { weapon: 'weapon_hand_cannon', ammo: 'ammo_light', extra: 'health_large', armour: false },
];
for (const f of frames) {
  const s = side[f.k]!;
  m.pickup(s.weapon, f.pos(5, 2, 0, 2.4, 2.4, 1.5));
  m.pickup(s.ammo, f.pos(2, 0, 0, 0, -1.5));
  m.pickup(s.extra, f.pos(5, 1, 0, -2, 2.5));
  m.pickup('health_small', f.pos(4, 0, 1));
  if (s.armour) m.pickup('armor_small', f.pos(2, 0, 1, 0, 1));
  else m.pickup('ammo', f.pos(2, 0, 1, 0, 1));
}
m.pickup('weapon_laser_rifle', [16, 0, 6.5]).pickup('weapon_smg', [16, 0, 25.5]);

// Team bases at each end (spawns and a flag), hills through the middle.
await m.teamBases(6);

// ---------------------------------------------------------------- the jungle round the temple (scenery past the walls)
// The temple stands on a terraced rise in the jungle: stepped hills climb away from its walls on
// every side, thick with palms, broadleaf trees and undergrowth. Added after the team bases, so
// the play area and its spawns are unchanged.
const jungle = surround(m.doc, {
  size: 240,
  centre: [16, 16],
  hills: (x, z, d) => terrace(Math.max(0, d - 4) * (0.38 + 0.12 * roll(x, z)) + 1.4 * roll(x, z, 0.6) * Math.min(1, d / 26), 2.6) - 0.4,
  paint: (x, z, h, d) => (d < 5 ? 'dirt' : roll(x, z, 1.7) > 0.85 ? 'moss' : 'grass'),
  plants: (x, z, h, d, g) => (g === 'grass' ? (d > 16 ? 4 : 3) : g === 'moss' ? 3 : 1),
});
m.terrain(jungle.terrain);
{
  const area: [number, number, number, number] = [-100, -100, 132, 132];
  const ok = (x: number, z: number) => jungle.dist(x, z) > 2;
  const taken: [number, number][] = [];
  const TREES = ['nt_palm_tall', 'nt_palm_curved', 'nt_common_tree', 'nt_common_tree_2', 'nt_palm_tall', 'nt_willow'];
  for (const [x, z, r] of scatter(0x7e391e, 170, area, 5.5, ok, taken)) {
    m.prop(TREES[Math.floor(r * TREES.length)]!, [x, jungle.ground(x, z), z], +((r * 37) % 6.28).toFixed(2), +(0.85 + ((r * 13) % 0.4)).toFixed(2));
  }
  const UNDER = ['nt_bush_leafy', 'nt_fern_wide', 'nt_bush_berries', 'nt_bush_leafy', 'nt_boulder_moss'];
  for (const [x, z, r] of scatter(0x5eed5, 140, area, 2.4, ok, taken)) {
    const model = UNDER[Math.floor(r * UNDER.length)]!;
    m.prop(model, [x, jungle.ground(x, z), z], +((r * 41) % 6.28).toFixed(2), +(0.9 + ((r * 7) % 0.5)).toFixed(2), model === 'nt_boulder_moss');
  }
}
for (const f of frames) {
  // The court has gone wild at its edges: bushes to hide in under the walls between the corners and the arches.
  m.prop('nt_bush_leafy', f.pos(1, 1, 0, 1, -2.5), f.yaw(0.4), 1.15, false);
  m.prop('nt_bush_berries', f.pos(3, 1, 0, -1, -2.5), f.yaw(2.2), 1.1, false);
  // Fox statues guard each archway into the court, clear of the opening.
  m.prop('rn_statue_fox', f.pos(2, 1, 0, -3.9, -3), f.yaw(0));
  m.prop('rn_statue_fox', f.pos(2, 1, 0, 3.9, -3), f.yaw(0));
}
m.lightRooms();
m.meta({
  description:
    'A stepped marble temple round a pillared court, in the spirit of GoldenEye\'s Temple. Cloisters and side chambers ring the court; stairs climb to galleries that look down over half walls, and four bridges meet on a railed platform above the dais. Take the railgun from the platform and you are in everyone\'s sights; the heavy armour waits at the foot of the dais below.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 12],
});
await m.save();
