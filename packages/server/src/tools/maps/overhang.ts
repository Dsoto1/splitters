/**
 * Overhang: a two-storey techbase hall with a ledge over a lava pit (homage in
 * spirit to Quake II's The Edge). A small deathmatch arena for 2–8 players.
 *
 * - The atrium: open to the roof, with a dais in the middle (double damage)
 *   and arches out to the corridor loop on all four sides.
 * - The corridor loop (ground floor) round the atrium, two stairs up.
 * - The balcony (upper floor) round the atrium, railed, looking down on it.
 * - The edge: a ledge outside the balcony's north side with no railing, over
 *   the lava; the railgun waits at its far end.
 *
 * Grid x east, y north (one cell = 8 m); floors 4 m.
 *
 *   y6          e   e   e               the edge (upper floor, over the lava)
 *   y5      c   c   c   S   c           S stairs: east low, west high
 *   y4      c   A   A   A   c           A atrium (open to the roof), dais at the centre
 *   y3      c   A   A   A   c
 *   y2      c   A   A   A   c
 *   y1      c   S   c   c   c           S stairs: west low, east high
 *       0   1   2   3   4   5
 *   c corridor loop on the ground floor, balcony over it
 */
import { TERRAIN_MATERIALS, boxBounds, buildMapGeometry, newTerrain, paintSlopes, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('overhang', 'Overhang');
m.theme('factory');
m.backdrop('dusk', 'mesas', 'stone', 0.5);
const P = Math.PI / 2;
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
const at = (x: number, y: number, z = 0, dx = 0, dy = 0): [number, number, number] => [x * 8 + dx, z * 4, y * 8 + dy];

const inner = (x: number, y: number) => x >= 2 && x <= 4 && y >= 2 && y <= 4;
const RING: [number, number][] = [];
for (let x = 1; x <= 5; x++) for (let y = 1; y <= 5; y++) if (!inner(x, y)) RING.push([x, y]);
const STAIRS = new Set(['2,1', '4,5']);

// ---------------------------------------------------------------- the hall
for (const [x, y] of RING) {
  if (STAIRS.has(`${x},${y}`)) continue;
  m.tile('room', x, y, 0).tile('platform_rail', x, y, 1);
}
for (let x = 2; x <= 4; x++) for (let y = 2; y <= 4; y++) m.tile('room', x, y, 0);
m.tile('stairs', 2, 1, 0, 0); // from (1,1) below up east to (3,1) on the balcony
m.tile('stairs', 4, 5, 0, 2); // from (5,5) below up west to (3,5) on the balcony
for (let x = 2; x <= 4; x++) m.tile('platform', x, 6, 1); // the edge

// The corridor loop runs open all the way round; the atrium opens onto it through an arch each side.
for (const [x, y] of RING) {
  for (const [side, nx, ny] of [['E', x + 1, y], ['N', x, y + 1]] as const) {
    if (!RING.some(([a, b]) => a === nx && b === ny)) continue;
    if (STAIRS.has(`${x},${y}`) || STAIRS.has(`${nx},${ny}`)) continue;
    m.edge(x, y, 0, side, 'open');
    m.edge(x, y, 1, side, 'open');
  }
}
for (let x = 2; x <= 4; x++) for (let y = 2; y <= 4; y++) {
  if (x < 4) m.edge(x, y, 0, 'E', 'open');
  if (y < 4) m.edge(x, y, 0, 'N', 'open');
}
m.edge(3, 1, 0, 'N', 'arch').edge(3, 5, 0, 'S', 'arch').edge(1, 3, 0, 'E', 'arch').edge(5, 3, 0, 'W', 'arch');
for (const [x, y, side] of [[2, 1, 'N'], [4, 1, 'N'], [2, 5, 'S'], [1, 2, 'E'], [1, 4, 'E'], [5, 2, 'W'], [5, 4, 'W']] as const) m.edge(x, y, 0, side, 'wall');
// The stairs open at the foot and the head onto the loop.
m.edge(1, 1, 0, 'E', 'open').edge(3, 1, 1, 'W', 'open').edge(5, 5, 0, 'W', 'open').edge(3, 5, 1, 'E', 'open');
// The balcony's outer walls, with windows on the mesas; doors north onto the edge.
for (const [x, y] of RING) {
  if (STAIRS.has(`${x},${y}`)) continue;
  const out: ('N' | 'S' | 'E' | 'W')[] = [...(y === 1 ? ['S' as const] : []), ...(y === 5 ? ['N' as const] : []), ...(x === 1 ? ['W' as const] : []), ...(x === 5 ? ['E' as const] : [])];
  for (const side of out) m.edge(x, y, 1, side, side === 'N' && x >= 2 && x <= 4 ? 'wide' : 'windows');
}
// The edge itself: no railing, just the drop.
m.edge(2, 6, 1, 'W', 'open').edge(4, 6, 1, 'E', 'open');
for (let x = 2; x <= 4; x++) m.edge(x, 6, 1, 'N', 'open');

// Surfaces: tread plate below, grated balcony, rust and brick walls.
for (const [x, y] of RING) if (!STAIRS.has(`${x},${y}`)) paint(x, y, 1, { floor: mat('pbr_walkway'), underside: mat('pbr_rusted_plate') });
for (let x = 2; x <= 4; x++) paint(x, 6, 1, { floor: mat('pbr_rusted_plate'), underside: mat('pbr_rusted_plate') });

// ---------------------------------------------------------------- the atrium dais, the lava pit
m.block([24, 0, 24], [6, 0.6, 6], 'solid', { material: 'pbr_tread_plate' });
// Steps of 0.3 m (0.4 is too tall to walk up).
m.block([24, 0, 20.5], [3, 0.3, 1], 'solid', { material: 'pbr_tread_plate' }).block([24, 0, 27.5], [3, 0.3, 1], 'solid', { material: 'pbr_tread_plate' });
for (const [x, z] of [[18.5, 18.5], [29.5, 18.5], [18.5, 29.5], [29.5, 29.5]] as const) m.block([x, 0, z], [1.2, 8, 1.2], 'solid', { material: 'pbr_steel' });
m.block([24, -9, 52], [30, 1, 14], 'solid', { material: 'pbr_rock' });
m.water([24, -8, 52], [30, 2, 14], 'lava');
m.prop('machine', [10, 0, 10], P).prop('big_pipe', [40, 0, 26]).prop('metal_crate', [38, 0, 38], 0.3).prop('factory_box', [10, 0, 38]);
m.prop('barrel', [38.5, 0, 9]).breakable('barrel', [9, 0, 25]).breakable('gas', [39, 0, 22]);

// ---------------------------------------------------------------- spawns, items
for (const [x, y, z, yaw] of [[1, 2, 0, 0], [5, 2, 0, 0], [1, 5, 0, Math.PI], [3, 1, 0, 0], [5, 1, 1, -P], [1, 4, 1, P], [5, 4, 1, -P], [2, 1, 1, 0], [3, 3, 0, 0], [3, 5, 1, Math.PI]] as const) {
  if (STAIRS.has(`${x},${y}`)) continue;
  m.spawn(at(x, y, z, x === 3 && y === 3 ? 0 : 0, x === 3 && y === 3 ? -6 : 0), yaw, null);
}
m.pickup('weapon_railgun', at(4, 6, 1, 2, 0)).pickup('ammo_cells', at(2, 6, 1, -2, 0));
m.pickup('powerup_damage', [24, 0.6, 24], 90).pickup('weapon_rockets', at(1, 3, 0)).pickup('ammo_explosive', at(5, 3, 0));
m.pickup('weapon_shotgun', at(3, 1, 0)).pickup('weapon_auto_shotgun', at(3, 5, 0)).pickup('weapon_lmg', at(5, 1, 1)).pickup('weapon_plasma', at(1, 5, 1));
m.pickup('armor_large', at(3, 1, 1)).pickup('armor_small', at(1, 2, 1)).pickup('armor_small', at(5, 4, 1));
m.pickup('health_large', at(2, 2)).pickup('health_small', at(1, 1)).pickup('health_small', at(5, 5)).pickup('health_small', at(4, 4));
m.pickup('ammo_shells', at(1, 4)).pickup('ammo', at(5, 2)).pickup('ammo', at(2, 5, 1)).pickup('grenades', at(4, 2));
// Team bases at each end (spawns and a flag), hills through the middle.
await m.teamBases(4);
m.bounds('invisible');
m.lightRooms();

// ---------------------------------------------------------------- ground: terrain round what is built

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/**
 * Terrain under and round the built map (call after the boundary is set). `shape(x, z, d)` is the
 * natural ground, `d` metres outside the play boundary (0 inside). It is held 0.1 m under every
 * floor, slab and solid it would reach into, and nowhere climbs faster than `rise` metres per metre
 * away from those, so nothing built is buried and ground dropping to a sunken floor makes a bank,
 * not a wall. `paint` picks each cell's ground and plant cover (cells under anything built are bare).
 */
function sculpt(shape: (x: number, z: number, d: number) => number, paint: (x: number, z: number, d: number, h: number) => [TerrainMaterial, number], o: { margin?: number; rise?: number } = {}): TerrainData {
  const b = m.doc.bounds;
  if (!b) throw new Error('sculpt needs the boundary');
  const [x0, z0] = b.min;
  const [x1, z1] = b.max;
  const size = Math.min(320, Math.max(x1 - x0, z1 - z0) + 2 * (o.margin ?? 60));
  const t = newTerrain(size, 2, [Math.round((x0 + x1) / 4) * 2, Math.round((z0 + z1) / 4) * 2]);
  const outside = (x: number, z: number) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
  const solids = buildMapGeometry(m.doc).filter((q) => q.kind !== 'barrier').map(boxBounds);
  const { cols, rows } = t;
  const h: number[] = [];
  const covered: boolean[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = t.origin[0] + c * 2;
      const z = t.origin[1] + r * 2;
      let y = shape(x, z, outside(x, z));
      let under = false;
      for (const s of solids) {
        if (x > s.min[0] - 0.3 && x < s.max[0] + 0.3 && z > s.min[2] - 0.3 && z < s.max[2] + 0.3 && s.min[1] - 0.1 < y + 0.5) {
          y = Math.min(y, s.min[1] - 0.1);
          under = true;
        }
      }
      h.push(y);
      covered.push(under);
    }
  }
  // Banks: limit the climb away from anything held down (a two-pass chamfer sweep).
  const rise = o.rise ?? 0.7;
  const steps: [number, number, number][] = [[-1, 0, 2], [0, -1, 2], [-1, -1, 2.83], [1, -1, 2.83]];
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < cols * rows; k++) {
      const i = pass ? cols * rows - 1 - k : k;
      const c = i % cols;
      const r = (i - c) / cols;
      for (const [dc, dr, dist] of steps) {
        const nc = c + (pass ? -dc : dc);
        const nr = r + (pass ? -dr : dr);
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        h[i] = Math.min(h[i]!, h[nr * cols + nc]! + rise * dist);
      }
    }
  }
  const materials: number[] = [];
  const foliage: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const corners = [r * cols + c, r * cols + c + 1, (r + 1) * cols + c, (r + 1) * cols + c + 1];
      const x = t.origin[0] + c * 2 + 1;
      const z = t.origin[1] + r * 2 + 1;
      const [g, f] = paint(x, z, outside(x, z), corners.reduce((s, i) => s + h[i]!, 0) / 4);
      materials.push(TERRAIN_MATERIALS.indexOf(g));
      foliage.push(corners.some((i) => covered[i]) ? 0 : f);
    }
  }
  return paintSlopes({ ...t, heights: h.map((y) => Math.round(y * 100)), materials, foliage }, 38, 'stone');
}

// The hall stands on a rock shelf: under the edge the ground falls sheer into the lava crater, and all
// round it climbs through scree to the mesas.
const ground = sculpt(
  (x, z, d) => -0.1 + smooth(6, 30, d) * (8 + 4 * Math.sin(x / 17 + 0.5) * Math.cos(z / 13) + 2 * Math.sin(z / 7 - x / 11)) + smooth(30, 55, d) * 10 * smooth(0.1, 0.5, Math.cos(x / 21) * Math.sin(z / 18 + 1) + 0.4),
  (x, z, d, y) => {
    if (y < -1) return ['stone', 0];
    if (d < 3) return ['gravel', 0];
    const scree = Math.sin(x / 8 + z / 11) * Math.cos(z / 13 - x / 7) > 0.2;
    return y > 12 ? ['stone', 0] : scree ? ['gravel', 0] : ['dirt', 1];
  },
  { rise: 20 },
);
m.terrain(ground);
// Propane cylinders stacked by the gas drum in the east corridor.
m.prop('sv_propane', [39.7, 0, 20.4], 0.4);
m.meta({
  description:
    'A two-storey techbase hall: an atrium open to the roof with double damage on its dais, a corridor loop round it, a railed balcony above, and the edge — a ledge with no railing outside the balcony, over a lava pit, where the railgun waits. A small arena for 2–8 players.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [2, 8],
});
await m.save();
