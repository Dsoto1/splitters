/**
 * Kanto Plaza: a glass office tower at sunset (homage in spirit to Die Hard's
 * Nakatomi Plaza). Tide hold the tower; Embers come in off the plaza to bring
 * out the hostages held on the executive floor.
 *
 * - The lobby (z0, travertine): a reception desk under the glass front, revolving doors
 *   onto the plaza, a service door out back to the loading dock.
 * - Floors 1–2: open-plan offices round the core, glass all round.
 * - Floor 3: the executive floor, offices and the boardroom (hostages).
 * - The roof (z4): a railed deck with the helipad (rockets, double damage).
 * - The core: two switchback stairwells (west doors), one taking you up from
 *   even floors and one from odd ones, so every climb is a run round the
 *   ring; the last climbs out onto the roof. Beside them, the lift lobby and
 *   the washrooms on every floor.
 *
 * Grid x east, y north (one cell = 8 m); floors 4 m.
 *
 *   y4  p   p   p   p   p   p     p the plaza (police cars south, loading dock north)
 *   y3  p   o   o   o   o   p     o offices (ring)
 *   y2  p   o   B   D   o   p     A/B stairwells (A up from z0, z2; B up from z1, z3)
 *   y1  p   o   A   C   o   p     C lift lobby, D washrooms
 *   y0  p   o   o   o   o   p
 *   y-1 p   p   p   p   p   p     Embers
 *      -1   0   1   2   3   4
 */
import { TERRAIN_MATERIALS, buildOccupancy, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('kanto_plaza', 'Kanto Plaza');
m.theme('lab');
m.backdrop('sunset', 'city', 'gravel', 0.45);
m.teams([8, 8]);
const [embers, tide] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
/** World position of cell (x, y) on floor z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0): [number, number, number] => [x * 8 + dx, z * 4, y * 8 + dy];

const RING: [number, number][] = [];
for (let x = 0; x <= 3; x++) for (let y = 0; y <= 3; y++) if (!(x >= 1 && x <= 2 && y >= 1 && y <= 2)) RING.push([x, y]);
const TOP = 3; // the highest office floor

// ---------------------------------------------------------------- the plaza
for (let x = -1; x <= 4; x++) for (let y = -1; y <= 4; y++) if (x < 0 || x > 3 || y < 0 || y > 3) m.tile('yard', x, y);
for (let x = -1; x <= 4; x++) for (let y = -1; y <= 4; y++) if (x < 0 || x > 3 || y < 0 || y > 3) paint(x, y, 0, { floor: mat(y === 4 ? 'pbr_asphalt' : 'pbr_hex_paving') });

// ---------------------------------------------------------------- the tower
for (let z = 0; z <= TOP; z++) {
  for (const [x, y] of RING) m.tile('room', x, y, z);
  // The core: stairwells alternate, so each takes you up one floor from its own side.
  if (z % 2 === 0) m.tile('stairwell', 1, 1, z);
  else m.tile('stairwell', 1, 2, z);
  m.tile('room', 2, 1, z).tile('room', 2, 2, z);
}
m.tile('room', 1, 2, 0); // the security office beside the first stairwell, on the ground floor
// The roof deck, with the last stairwell's hut on it at (1,2).
for (let x = 0; x <= 3; x++) for (let y = 0; y <= 3; y++) if (!(x === 1 && y === 2)) m.tile('platform_rail', x, y, TOP + 1);

// Glass all round; on the ground floor the revolving doors (south) and the service door (north).
const outside = (x: number, y: number): ('N' | 'S' | 'E' | 'W')[] => [...(y === 0 ? ['S' as const] : []), ...(y === 3 ? ['N' as const] : []), ...(x === 0 ? ['W' as const] : []), ...(x === 3 ? ['E' as const] : [])];
for (let z = 0; z <= TOP; z++) for (const [x, y] of RING) for (const side of outside(x, y)) {
  const door = z === 0 && ((side === 'S' && (x === 1 || x === 2)) || (side === 'N' && x === 3) || (side === 'W' && y === 3));
  m.edge(x, y, z, side, door ? (side === 'S' ? 'wide' : 'door') : 'windows');
}
// Open-plan floors: the ring runs open, except round the corners of the executive floor (its offices).
for (let z = 0; z <= TOP; z++) {
  for (const [x, y] of RING) {
    if (x < 3 && RING.some(([a, b]) => a === x + 1 && b === y)) m.edge(x, y, z, 'E', z === TOP && (y === 0 || y === 3) && (x === 0 || x === 2) ? 'door' : 'open');
    if (y < 3 && RING.some(([a, b]) => a === x && b === y + 1)) m.edge(x, y, z, 'N', z === TOP && (x === 0 || x === 3) && (y === 0 || y === 2) ? 'door' : 'open');
  }
  // The core's rooms: the lift lobby opens onto the ring to the south and east; the washrooms by a door.
  m.edge(2, 1, z, 'S', 'wide').edge(2, 1, z, 'E', 'wide').edge(2, 1, z, 'N', 'door');
  m.edge(2, 2, z, 'E', 'door').edge(2, 2, z, 'N', 'wall');
}
m.edge(1, 2, 0, 'N', 'door').edge(1, 2, 0, 'S', 'wall').edge(1, 2, 0, 'E', 'wall');

// Surfaces: a marble lobby, carpeted offices, white walls and ceilings, glass grey outside.
for (let z = 0; z <= TOP; z++) {
  const floor = z === 0 ? mat('pbr_travertine') : z === TOP ? mat('pbr_floorboards') : mat('pbr_terrazzo');
  const ceiling = mat('pbr_plaster_white', '#e8e6e0');
  for (const [x, y] of RING) paint(x, y, z, { floor, walls: mat('pbr_white_panel', '#cfd8e2'), trim: mat('pbr_steel'), underside: ceiling });
  for (const [x, y] of [[2, 1], [2, 2]] as const) paint(x, y, z, { floor: mat('pbr_terrazzo'), walls: mat('pbr_white_panel'), underside: ceiling });
  paint(1, z % 2 === 0 ? 1 : 2, z, { walls: mat('pbr_white_panel'), solids: mat('pbr_concrete'), underside: ceiling });
}
paint(1, 2, 0, { floor: mat('pbr_terrazzo'), walls: mat('pbr_white_panel') });
for (let x = 0; x <= 3; x++) for (let y = 0; y <= 3; y++) if (!(x === 1 && y === 2)) paint(x, y, TOP + 1, { floor: mat('pbr_concrete'), underside: mat('pbr_white_panel'), solids: mat('pbr_white_panel') });

// ---------------------------------------------------------------- dressing
// The lobby: reception desk, sofas, plants; a Christmas tree by the doors.
m.block([12, 0, 9], [6, 1.1, 1.2], 'solid', { material: 'pbr_walnut' });
m.prop('sofa', [2, 0, 3], P).prop('sofa_long', [26, 0, 26], Math.PI).prop('potted_plant', [-2.6, 0, -2.6]).prop('potted_plant', [26.6, 0, -2.6]);
m.prop('tree_cone', [-6, 0, -10], 0, 1.2).prop('floor_lamp', [27, 0, 3]).prop('table_round', [26, 0, 12]).prop('armchair', [26, 0, 14.5], Math.PI);
// The boardroom (executive floor, north-west corner): the long table.
m.prop('table', [0, 12, 24.5], 0).prop('table', [2.2, 12, 24.5], 0).prop('chair', [0, 12, 23.2], 0).prop('chair', [2.2, 12, 25.8], Math.PI);
// The roof: the helipad (south-east), vents and a crate.
m.block([20, 16, 4], [9, 0.1, 9], 'solid', { material: 'paint_gloss', tint: '#3a3d42' });
// The H: two uprights and the bar.
for (const dx of [-1.5, 1.5]) m.block([20 + dx, 16.1, 4], [0.8, 0.1, 5], 'solid', { material: 'paint_gloss', tint: '#e8e4d8' });
m.block([20, 16.1, 4], [2.2, 0.1, 0.8], 'solid', { material: 'paint_gloss', tint: '#e8e4d8' });
m.prop('machine', [-1.5, 16, 24], P).prop('big_pipe', [26, 16, 25]).prop('metal_crate', [2, 16, 4]);
// The plaza: police cars at the kerb, barriers, lamps; trucks at the loading dock.
const TYRES = { material: 'pbr_steel', tint: '#2a2a2a' };
function car(cx: number, cz: number, ns: boolean, tint: string, roof = '#1c2228'): void {
  const [w, l] = ns ? [2, 4.4] : [4.4, 2];
  m.block([cx, 0.25, cz], [w, 0.85, l], 'solid', { material: 'paint_gloss', tint });
  m.block([cx, 1.1, cz], ns ? [1.8, 0.6, 2.2] : [2.2, 0.6, 1.8], 'solid', { material: 'paint_gloss', tint: roof });
  m.block([cx, 0, cz], ns ? [1.9, 0.25, 3.6] : [3.6, 0.25, 1.9], 'solid', TYRES);
}
car(0, -9, false, '#1c1c22', '#e8e8e8');
car(18, -10, false, '#e8e8e8', '#1c1c22');
car(30, -8, true, '#1c1c22', '#e8e8e8');
m.block([8, 1, 36], [7, 2.8, 2.5], 'solid', { material: 'pbr_white_panel' });
m.block([3.1, 0, 36], [2.6, 2.8, 2.5], 'solid', { material: 'paint_gloss', tint: '#2a4a7a' });
m.prop('barrier', [8, 0, -6], 0).prop('barrier', [24, 0, -6], 0).prop('barrier_high', [-6, 0, 12], P).prop('barrier_high', [32, 0, 16], P);
for (const [x, z] of [[-6, -6], [32, -6], [-6, 32], [32, 32]] as const) m.prop('lightpost', [x, 0, z]);
m.prop('cargo_crate', [22, 0, 36], 0.2).prop('factory_box', [28, 0, 35]).prop('skip', [-5, 0, 26], P).prop('bench', [12, 0, -6.6], 0);
m.breakable('glass', [12, 0, -4.2]).breakable('gas', [33, 0, 36]);
m.furnish('office', (x, y, z) => z === 0 || (x >= 1 && x <= 2 && y >= 1 && y <= 2));

// ---------------------------------------------------------------- spawns, objectives, pickups
for (const [x, z] of [[-4, -6], [2, -6], [6, -4], [12, -6], [16, -4], [22, -6], [28, -6], [32, -4]] as const) m.spawn([x, 0, z], 0, embers);
for (const [x, y, z, yaw] of [[0, 0, 2, 0], [3, 0, 2, 0], [0, 3, 2, Math.PI], [3, 3, 2, Math.PI], [0, 0, 3, 0], [3, 0, 3, 0], [0, 2, 3, P], [3, 2, 3, -P]] as const) m.spawn(at(x, y, z), yaw, tide);
for (const [x, y, z, yaw] of [[0, 1, 1, P], [3, 2, 1, -P], [2, 1, 2, 0], [0, 0, 0, 0], [3, 3, 0, Math.PI], [4, 1, 0, -P], [-1, 2, 0, P], [3, 3, 4, Math.PI]] as const) m.spawn(at(x, y, z), yaw, null);
// Hostage Rescue: four on the executive floor (the boardroom and the corner offices); out to the plaza.
m.hostage(at(0, 3, TOP, 1, -2), Math.PI).hostage(at(0, 3, TOP, -1, -2), Math.PI).hostage(at(3, 3, TOP, 0, -1), Math.PI).hostage(at(3, 0, TOP, 0, 1), 0);
m.rescue([12, 0, -6], 5);
m.hill(at(1, 0, 0, 4, 2), 5).hill(at(1, 0, 2, 4, 0), 5).hill([20, 16.1, 4], 5);
m.pickup('weapon_smg', at(0, 0, 0)).pickup('weapon_shotgun', at(3, 3, 0)).pickup('weapon_rifle', at(0, 2, 1)).pickup('weapon_rifle', at(3, 1, 1));
m.pickup('weapon_burst_rifle', at(2, 1, 2)).pickup('weapon_sniper', at(0, 0, 4)).pickup('weapon_rockets', [22.5, 16.1, 6.5], 60).pickup('powerup_damage', at(3, 3, 4), 90);
m.pickup('armor_large', at(2, 1, 3)).pickup('armor_small', at(0, 3, 1)).pickup('armor_small', at(3, 0, 2)).pickup('health_large', at(2, 1, 1));
m.pickup('health_small', at(1, 0, 3)).pickup('health_small', at(2, 3, 2)).pickup('health_small', at(4, 1, 0)).pickup('ammo', at(1, 3, 1)).pickup('ammo', at(2, 0, 2));
m.pickup('ammo_rifle', at(1, 0, 1)).pickup('ammo_shells', at(2, 3, 3)).pickup('ammo_sniper', at(3, 1, 4)).pickup('grenades', at(-1, 0, 0)).pickup('grenades', at(1, 3, 3));

// Office lighting: a cool white panel in every room of the tower.
m.lightRooms({ color: '#f2f5ff', intensity: 1.1 });
// ---------------------------------------------------------------- ground and planting (after the boundary is set)
const sm = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/**
 * Terrain under and round what is built: sunk 3.6 m under every built cell
 * (below the lowest level built there, so nothing standing or hung over a
 * floor counts as floating), level within `flat` m of
 * the tiles, free blocks and entities, then `shape(x, z, d)` further out (d:
 * metres from the nearest of them). `cover(x, z, d, h)` gives each terrain
 * cell's ground and plant cover (0–4); cells under or against the buildings
 * stay bare so no grass pokes through a floor. Reaches `margin` m past the boundary.
 */
function sculpt(margin: number, flat: number, shape: (x: number, z: number, d: number) => number, cover: (x: number, z: number, d: number, h: number) => [TerrainMaterial, number]): TerrainData {
  const b = m.doc.bounds!;
  const x0 = Math.floor((b.min[0] - margin) / 4) * 4;
  const z0 = Math.floor((b.min[1] - margin) / 4) * 4;
  const cols = Math.min(161, Math.ceil((b.max[0] + margin - x0) / 2) + 1);
  const rows = Math.min(161, Math.ceil((b.max[1] + margin - z0) / 2) + 1);
  const low = new Map<string, number>();
  const rects: [number, number, number, number][] = [];
  for (const key of buildOccupancy(m.doc).cells.keys()) {
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number];
    const col = `${gx},${gy}`;
    if (!low.has(col)) rects.push([gx * 8 - 4, gy * 8 - 4, gx * 8 + 4, gy * 8 + 4]);
    low.set(col, Math.min(low.get(col) ?? Infinity, gz));
  }
  const points: [number, number][] = [];
  for (const e of m.doc.entities) {
    if (e.kind === 'block') {
      const r = Math.hypot(e.size[0], e.size[2]) / 2;
      rects.push([e.position[0] - r, e.position[2] - r, e.position[0] + r, e.position[2] + r]);
    } else points.push([e.position[0], e.position[2]]);
  }
  const dist = (x: number, z: number) => {
    let d = Infinity;
    for (const [ax, az, bx, bz] of rects) d = Math.min(d, Math.hypot(Math.max(ax - x, 0, x - bx), Math.max(az - z, 0, z - bz)));
    for (const [px, pz] of points) d = Math.min(d, Math.hypot(px - x, pz - z));
    return d;
  };
  const heights: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * 2;
      const z = z0 + r * 2;
      // The cells this vertex touches: under any of them the ground drops away under the lowest level.
      // On the outer edge of ground-floor cells it meets the floor's top, so the ground outside stays level.
      let under = Infinity;
      let edge = false;
      for (const gx of new Set([Math.floor((x + 4) / 8), Math.ceil((x - 4) / 8)])) for (const gy of new Set([Math.floor((z + 4) / 8), Math.ceil((z - 4) / 8)])) {
        const lz = low.get(`${gx},${gy}`);
        if (lz !== undefined && lz <= 0) under = Math.min(under, lz * 4 - 3.6);
        else edge = true;
      }
      if (edge && under === -3.6) under = 0;
      const d = dist(x, z);
      const h = under < Infinity ? under : d <= flat ? 0 : shape(x, z, d);
      heights.push(Math.round(h * 100));
    }
  }
  const t: TerrainData = { origin: [x0, z0], spacing: 2, cols, rows, baseY: 0, heights, materials: [], boundary: true, foliage: [] };
  const materials: number[] = [];
  const foliage: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const x = x0 + c * 2 + 1;
      const z = z0 + r * 2 + 1;
      const d = dist(x, z);
      const [g, f] = cover(x, z, d, terrainHeightAt(t, x, z) ?? 0);
      materials.push(TERRAIN_MATERIALS.indexOf(g));
      foliage.push(d < 2 ? 0 : f);
    }
  }
  const out = paintSlopes({ ...t, materials, foliage }, 38, 'stone');
  m.terrain(out);
  return out;
}
/** What stays clear of dressing: spawns, pickups and objectives (with their radius), doors, buttons, squads, vehicles. */
const KEEP_CLEAR = new Set(['spawn', 'pickup', 'flag', 'hill', 'hostage', 'rescue', 'bombsite', 'zone', 'button', 'door', 'encounter', 'ladder', 'pad', 'mount']);
/** Room for a piece of dressing `r` m round (x, y, z): inside the boundary, clear of the above, other props and free blocks. */
function free(x: number, y: number, z: number, r = 1): boolean {
  const b = m.doc.bounds!;
  if (x < b.min[0] + 0.5 || x > b.max[0] - 0.5 || z < b.min[1] + 0.5 || z > b.max[1] - 0.5) return false;
  return m.doc.entities.every((e) => {
    if (Math.abs(e.position[1] - y) > 2.5 && e.kind !== 'zone') return true;
    const d = Math.hypot(e.position[0] - x, e.position[2] - z);
    if (e.kind === 'block') return Math.abs(e.position[0] - x) > e.size[0] / 2 + r || Math.abs(e.position[2] - z) > e.size[2] / 2 + r;
    if (e.kind === 'prop' || e.kind === 'destructible') return d > r + 0.8;
    if (!KEEP_CLEAR.has(e.kind)) return true;
    const reach = e.kind === 'zone' ? Math.max(e.size[0], e.size[2]) / 2 : 'radius' in e && e.kind !== 'encounter' ? e.radius : 1.5;
    return d > reach + r + 1;
  });
}
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let ground: TerrainData | null = null;
const groundY = (x: number, z: number) => (ground ? +(Math.max(0, terrainHeightAt(ground, x, z) ?? 0)).toFixed(2) : 0);
let cells: ReturnType<typeof buildOccupancy>['cells'] | null = null;
/** Out in the open at (x, y, z), and the same a metre round: on no tile, or on a yard, street or plaza (never in a building). */
function outdoors(x: number, y: number, z: number): boolean {
  cells ??= buildOccupancy(m.doc).cells;
  return [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].every(([dx, dz]) => {
    const c = cells!.get(`${Math.round((x + dx!) / 8)},${Math.round((z + dz!) / 8)},${Math.floor((y + 0.01) / 4)}`);
    return !c || /yard$|street|plaza|intersection|crossroads/.test(c.placement.tile);
  });
}
/** Plant one piece on the ground (or on a floor at `y`; `inside` for furniture) if there is room; returns whether it went in. */
function plant(model: string, x: number, z: number, o: { y?: number; yaw?: number; scale?: number; r?: number; inside?: boolean } = {}): boolean {
  const y = o.y ?? groundY(x, z);
  if (!o.inside && !outdoors(x, y, z)) return false;
  if (!free(x, y, z, o.r ?? 1)) return false;
  m.prop(model, [+x.toFixed(2), y, +z.toFixed(2)], +(o.yaw ?? rnd() * 6.28).toFixed(2), +(o.scale ?? 0.85 + rnd() * 0.35).toFixed(2));
  // Keep later checks honest: what is planted now counts as taken.
  (m as unknown as { flush(): void }).flush();
  return true;
}
/** A clump of `n` bushes (players can hide in them) round (x, z), `spread` m across. */
function clump(x: number, z: number, n: number, spread: number, kinds: string[], y?: number): void {
  for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
    const a = rnd() * 6.28;
    const s = Math.sqrt(rnd()) * spread;
    if (plant(kinds[(i + tries) % kinds.length]!, x + Math.cos(a) * s, z + Math.sin(a) * s, { y, r: 0.6 })) i++;
  }
}

m.bounds('invisible');
// Round the plaza: a level verge, then landscaped banks and the dry hills behind the city at sunset.
ground = sculpt(60, 6, (x, z, d) => sm(6, 30, d) * (4 + 1.5 * Math.sin(x / 9) * Math.cos(z / 12)) + sm(26, 56, d) * (9 + 4 * Math.sin(x / 23 + z / 31)), (x, z, d, h) => {
  if (h > 12) return [Math.sin(x / 6 + z / 9) > 0 ? 'dirt' : 'stone', 1];
  if (d < 9) return ['gravel', 0];
  return ['grass', d < 24 ? 2 : 1];
});
// Palms at the plaza's corners and on the verge, hedges in planters along the tower's flanks (cover on the way round to the side doors).
for (const [x, z] of [[-9, -10], [34, -10.5], [-10, 34], [-14, 4], [38, 20], [12, 39.5], [-14, 28], [38, -14]] as const) plant(Math.abs(x + z) % 2 ? 'nt_palm_tall' : 'nt_palm_curved', x, z, { r: 0.8 });
const HEDGE = ['bush_cone', 'bush_large', 'nt_bush_leafy'];
for (const [x, z] of [[-9, 6], [-9, 22], [33, 4], [33, 26], [16, 33.5], [-2, 34]] as const) clump(x, z, 3, 2, HEDGE);
// A tall plant in the corner of each lift lobby.
for (let z = 0; z <= TOP; z++) plant('hm_houseplant_tall', 12.8, 11.2, { y: z * 4, inside: true, scale: 1, r: 0.4 });
m.meta({
  description:
    'A glass office tower at sunset. Tide hold Kanto Plaza; Embers come in off the plaza through the revolving doors or round by the loading dock, and fight up through open-plan floors and two switchback stairwells to the executive floor, where the hostages are, and on to the roof and its helipad.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [8, 16],
});
await m.save();
