/**
 * Rail Stockyard: a goods yard at dusk, ringed by two brick sheds and a
 * covered loading dock with a catwalk on top (an homage in spirit to Half-Life
 * deathmatch's Stalkyard, rebuilt from memory with our own pieces). Weave
 * between rolling stock in the open yard, drop into the sunken loading pit,
 * duck through the culvert under the yard, or run the catwalk loop between the
 * sheds' upper floors. The railgun sits on a crane perch over the pit; the
 * only way out to it is a bare girder from the west shed's roof, in full view
 * of the whole yard.
 *
 * Grid x east, y north (one cell = 8 m); levels: z-1 pit and culvert, z0 yard,
 * z1 upper floors and catwalk, z2 west roof, girder and perch.
 *
 *   ground (z0)                                      upper (z1) / roof (z2)
 *   y7   .  d  d  d  d  d  d  d  d  d  .              .  c==c==c==c==c==c==c==c==c  .
 *   y6  [L  L] y  ^  y  b  y  ^  y [O  O]           [u  w] .  ^  .  b  .  ^  . [o  o]
 *   y5  [L  L] y  t==t  .  t==t  y [O  O]           [u  u]                     [o  o]
 *   y4  [A  A] y  y  P  P  P  >  y [A  A]           [A  A]                     [A  A]
 *   y3  [A  A] y  <  P  P  P  y  y [A  A]           [A  A]=====girder====[R]     (z2)
 *   y2   .  y  y  y  y  c  y  y  y  y  .
 *   y1   .  y  H  y  y  y  y  y  H  y  .           culvert (z-1): H─────┬─────H
 *   y0   .  y  y  y  y  y  y  y  y  y  .                          c (up into the pit)
 *        0  1  2  3  4  5  6  7  8  9  10
 *
 *   d   covered dock (gravel), catwalk c on its roof, joining both sheds' upper floors
 *   ^   open stairs, yard up north onto the catwalk; b boxcar parked against the catwalk (walk its roof)
 *   t   east-west rolling stock on the yard line; the south spur (y0) holds more
 *   P   sunken loading pit (z-1); < > open stairs down into it; c culvert mouth in its south wall
 *   H   culvert huts: stairs down to the culvert running under the yard along y1
 *   A   two-storey atriums; L lamp room, O loading office; u/o upper rooms, w stairwell to the west roof
 *   R   crane perch over the pit (railgun), reached only along the girder from the west roof
 */
import { TERRAIN_MATERIALS, boxBounds, buildMapGeometry, newTerrain, paintSlopes, type Side, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('rail_stockyard', 'Rail Stockyard');
m.theme('factory');
m.backdrop('dusk', 'city', 'gravel', 0.55);
const [embers, tide] = m.teamIds() as [string, string];
const P = Math.PI / 2;
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0): [number, number, number] => [x * 8 + dx, z * 4, y * 8 + dy];

function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces }] });
}
const edges = (list: [number, number, number, Side][], style: Parameters<MapBuilder['edge']>[4]) => {
  for (const [x, y, z, s] of list) m.edge(x, y, z, s, style);
};

// ---------------------------------------------------------------- the yard (z0)
const PIT = new Set(['4,3', '5,3', '6,3', '4,4', '5,4', '6,4']);
const STAIRS = new Set(['3,3', '7,4', '3,6', '7,6', '2,1', '8,1']);
const yardCells: [number, number][] = [];
for (let x = 1; x <= 9; x++) for (const y of [0, 1, 2, 7]) yardCells.push([x, y]);
for (let x = 2; x <= 8; x++) for (let y = 3; y <= 6; y++) yardCells.push([x, y]);
for (const [x, y] of yardCells) if (!PIT.has(`${x},${y}`) && !STAIRS.has(`${x},${y}`)) m.tile('yard', x, y);

// Open stairs from the yard up north onto the dock catwalk.
m.tile('stairs_open', 3, 6, 0, 3).tile('stairs_open', 7, 6, 0, 3);

// ---------------------------------------------------------------- sunken loading pit and culvert (z-1)
m.fill('yard', 4, 3, 6, 4, -1);
// Open stairs down into the pit: from the west (top at 2,3) and from the east (top at 8,4).
m.tile('stairs_open', 3, 3, -1, 2).tile('stairs_open', 7, 4, -1, 0);
// The culvert: from the pit's south wall under the yard to a T, then west and east to stair huts.
m.tile('corridor', 5, 2, -1).tile('junction_t', 5, 1, -1, 0);
m.tile('corridor_clear', 4, 1, -1, 1).tile('corridor', 3, 1, -1, 1).tile('corridor_clear', 6, 1, -1, 1).tile('corridor', 7, 1, -1, 1);
m.tile('stairs', 2, 1, -1, 2).tile('stairs', 8, 1, -1, 0);

// ---------------------------------------------------------------- west shed (x0-1)
m.tile('atrium', 0, 3); // two storeys, balcony all round
m.tile('room_large', 0, 5); // lamp room
m.tile('room', 0, 5, 1).tile('room', 1, 5, 1).tile('room', 1, 6, 1); // upper rooms
m.tile('stairwell', 0, 6, 1, 2); // up to the roof, doors east on both floors
// The roof: railed, open on the east where the girder leaves.
for (const [x, y] of [[0, 3], [1, 3], [0, 4], [1, 4], [0, 5], [1, 5], [1, 6]] as const) m.tile('platform_rail', x, y, 2);

// ---------------------------------------------------------------- east shed (x9-10)
m.tile('atrium', 9, 3);
m.tile('room_large', 9, 5); // loading office
m.tile('room_large', 9, 5, 1); // upper office

// ---------------------------------------------------------------- dock catwalk (z1)
for (let x = 1; x <= 9; x++) m.tile('platform_rail', x, 7, 1);

// ---------------------------------------------------------------- walls and openings
// Railings round the pit mouth, with one open drop on the north side.
edges([[4, 2, 0, 'N'], [5, 2, 0, 'N'], [6, 2, 0, 'N'], [4, 5, 0, 'S'], [6, 5, 0, 'S'], [3, 4, 0, 'E'], [7, 3, 0, 'W']], 'railing');
m.edge(5, 5, 0, 'S', 'open');
// Pit stairs: railed along the top, walled below (the yard floor is overhead there).
edges([[3, 3, 0, 'N'], [3, 3, 0, 'S'], [7, 4, 0, 'N'], [7, 4, 0, 'S']], 'railing');
edges([[3, 3, -1, 'N'], [3, 3, -1, 'S'], [3, 3, -1, 'W'], [7, 4, -1, 'N'], [7, 4, -1, 'S'], [7, 4, -1, 'E']], 'wall');
// Catwalk stairs: open to the yard either side.
edges([[3, 6, 0, 'E'], [3, 6, 0, 'W'], [7, 6, 0, 'E'], [7, 6, 0, 'W']], 'open');
// Catwalk: walled at the back, open where the boxcar roof meets it.
for (let x = 1; x <= 9; x++) m.edge(x, 7, 1, 'N', 'wall');
m.edge(1, 7, 1, 'W', 'wall').edge(9, 7, 1, 'E', 'wall');
m.edge(5, 7, 1, 'S', 'open');
// West shed: a wide door and a window onto the pit stairs; doors and windows on the yard; up to the catwalk.
m.edge(1, 3, 0, 'E', 'wide').edge(1, 4, 0, 'E', 'window').edge(1, 5, 0, 'E', 'door').edge(1, 6, 0, 'E', 'window');
m.edge(1, 3, 1, 'E', 'windows').edge(1, 4, 1, 'E', 'window').edge(1, 5, 1, 'E', 'window').edge(1, 6, 1, 'E', 'window');
m.edge(1, 6, 1, 'N', 'door');
// West roof: low parapets on the outer sides, the east edge bare where the girder starts.
m.edge(1, 3, 2, 'E', 'open');
for (const y of [3, 4, 5]) m.edge(0, y, 2, 'W', 'half');
m.edge(0, 3, 2, 'S', 'half').edge(1, 3, 2, 'S', 'half').edge(1, 6, 2, 'N', 'half');
// East shed, mirrored.
m.edge(9, 3, 0, 'W', 'wide').edge(9, 4, 0, 'W', 'door').edge(9, 5, 0, 'W', 'door').edge(9, 6, 0, 'W', 'window');
m.edge(9, 3, 1, 'W', 'windows').edge(9, 4, 1, 'W', 'window').edge(9, 5, 1, 'W', 'window').edge(9, 6, 1, 'W', 'windows');
m.edge(9, 6, 1, 'N', 'door');

// ---------------------------------------------------------------- surfaces
const gravel: TileSurfaces = { floor: { material: 'core.pbr_gravel', tint: null } };
for (const [x, y] of yardCells) if (!PIT.has(`${x},${y}`) && !STAIRS.has(`${x},${y}`)) paint(x, y, 0, gravel);
for (const k of PIT) {
  const [x, y] = k.split(',').map(Number) as [number, number];
  paint(x, y, -1, { floor: { material: 'core.pbr_concrete_dark', tint: null }, walls: { material: 'core.pbr_concrete', tint: '#b0a898' } });
}
for (let x = 1; x <= 9; x++) paint(x, 7, 1, { floor: { material: 'core.grate', tint: null } });
paint(9, 5, 0, { walls: { material: 'core.pbr_corrugated', tint: null } });
paint(9, 5, 1, { walls: { material: 'core.pbr_corrugated', tint: null } });

// ---------------------------------------------------------------- girder and crane perch (z2)
// A bare 2.4 m girder from the west roof out over the yard to the perch above the pit.
m.block([24.75, 7.65, 24], [25.5, 0.35, 2.4], 'solid', { material: 'pbr_rusted_plate' });
m.block([40, 7.6, 24], [5, 0.4, 5], 'solid', { material: 'hazard' });
m.block([40, -4, 24], [1.2, 11.6, 1.2], 'solid', { material: 'pbr_steel' }); // the crane mast
// A pad in the pit throws you back up south into the yard.
m.pad([48, -4, 26], Math.PI, 17, 6);

// ---------------------------------------------------------------- rolling stock and track
const track = (x0: number, x1: number, z: number) => {
  for (let x = x0; x <= x1; x += 1.667) m.prop('rail_track', [x, 0, z], P, 1, false);
};
// The yard line (y5) and the south spur (y0).
track(14, 66, 40);
track(5, 75, -1.5);
// N-S siding under the boxcar parked against the catwalk.
for (let z = 45.5; z <= 51; z += 1.667) m.prop('rail_track', [40, 0, z], 0, 1, false);
m.prop('container_car_red', [40, 0, 48.1], 0);
// Yard line: a gap in the middle for the boxcar siding.
m.prop('locomotive', [21, 0, 40], -P).prop('container_car_red', [29.6, 0, 40], P);
m.prop('tank_car', [50.5, 0, 40], P).prop('container_car_blue', [58.4, 0, 40], P);
// South spur.
m.prop('diesel', [14, 0, -1.5], P).prop('coal_car', [22, 0, -1.5], P).prop('flatbed_car', [28.5, 0, -1.5], P);
m.prop('lumber_car', [51, 0, -1.5], P).prop('tank_car', [59, 0, -1.5], P).prop('container_car_blue', [67.5, 0, -1.5], P);

// ---------------------------------------------------------------- yard cover
// Stacks of cargo to hop over and round (one crate high to jump on, scaled-up crates to hide behind).
m.prop('cargo_crate', [20, 0, 18], 0.2).prop('cargo_crate', [21.5, 0, 14.5], 0.1, 1.6);
m.prop('factory_box', [61, 0, 18.5], -0.2).prop('cargo_crate', [58.5, 0, 14.5], -0.1, 1.6);
m.prop('factory_box_long', [36, 0, 12], 0).prop('crate_large', [46, 0, 10], P);
m.prop('container_tall', [25, 0, 31.5], 0.3).prop('container', [23.4, 0, 33.2]);
m.prop('container_tall', [55, 0, 24.5], -0.3).prop('container', [56.6, 0, 22.8]);
m.prop('skip', [16, 0, 33], P).prop('skip', [64, 0, 46], P);
m.prop('cargo_crate', [33, 0, 46], P, 1.4).prop('cargo_crate', [47, 0, 46], P, 1.4);
m.breakable('gas', [26.5, 0, 22]).breakable('gas', [53.5, 0, 34]).breakable('barrel', [12.8, 0, 4.5]).breakable('barrel', [67.2, 0, 4.5]);
m.prop('warning_sign', [30, 0, 37.2]).prop('warning_sign', [50, 0, 18.8]).prop('cone', [44, 0, 37.5], 0, 1, false).prop('cone', [36, 0, 18.5], 0, 1, false);
m.prop('lightpost', [9, 0, 13]).prop('lightpost', [71, 0, 13]).prop('lightpost', [17, 0, 47]).prop('lightpost', [63, 0, 42]);
// Covered dock: pallets and drums along the back wall.
m.prop('factory_box', [14, 0, 57.5]).prop('crate_large', [22, 0, 58], P).prop('barrel', [27, 0, 58.5]).prop('barrel', [27.9, 0, 58.2]);
m.prop('factory_box', [52, 0, 57.5]).prop('cargo_crate', [60, 0, 57.8], P).prop('barrel', [65, 0, 58.5]);
m.prop('conveyor', [40, 0, 58]).prop('crate_small', [44.5, 0, 58.6]).prop('cardboard_box', [35.5, 0, 58.6]);

// ---------------------------------------------------------------- pit, culvert and sheds
m.prop('machine', [34.5, -4, 23.5]).prop('crate_large', [31, -4, 33.5], P).prop('cargo_crate', [46.5, -4, 33.5], P);
m.prop('pipe_valve', [50.5, -4, 21.5]).prop('factory_box_long', [44.5, -4, 21], 0);
m.prop('big_pipe', [27, -4, 8], 0).prop('pipe_valve', [49, -4, 5.6]);
// West shed: the lamp room's workbenches; upstairs the signal levers.
m.prop('workbench', [-2.5, 0, 50.5]).prop('anvil', [-1, 0, 50.5]).prop('crate_large', [10, 0, 50.5], P);
m.prop('lever', [-2, 4, 41]).prop('screen_panel', [10, 4, 50.5], 0);
m.prop('piston', [-2, 0, 33.5]);
// East shed: desks and cabinets in the offices, a machine in the atrium.
m.prop('desk', [82, 0, 50]).prop('office_chair', [82, 0, 48.6], Math.PI, 1, false).prop('computer_bank', [86.5, 4, 44], -P);
m.prop('desk', [82, 4, 51]).prop('machine_window', [82.5, 0, 26.5], 0);

// ---------------------------------------------------------------- spawns
// Embers: the west shed and the south-west yard. Tide: the east shed and the south-east yard.
for (const [p, yaw] of [[[2, 0, 31], P], [[6, 4, 34.8], P], [[4, 0, 44], P], [[8, 4, 40], P], [[6, 0, 10], P]] as const) m.spawn([...p], yaw, embers);
for (const [p, yaw] of [[[78, 0, 31], -P], [[74, 4, 34.8], -P], [[76, 0, 44], -P], [[76, 4, 46], -P], [[74, 0, 10], -P]] as const) m.spawn([...p], yaw, tide);
// Neutral: the dock, the catwalk and the south yard.
m.spawn([28, 0, 55], Math.PI).spawn([52, 0, 55], Math.PI).spawn([36, 4, 57], Math.PI);
m.spawn([30, 0, 6], 0).spawn([50, 0, 6], 0).spawn([40, 0, 28.5 - 22], 0);

// ---------------------------------------------------------------- pickups
// Power: the railgun on the crane perch; rockets in the culvert mouth under the pit.
m.pickup('weapon_railgun', [40, 8, 24]).pickup('ammo', [8, 8, 44]);
m.pickup('weapon_rockets', [41.5, -4, 16]).pickup('ammo_explosive', [24, -4, 8]).pickup('ammo_explosive', [56, -4, 8]);
// Armour on the boxcar roof (from the catwalk); the big health at the bottom of the pit.
m.pickup('armor_large', [40, 3.8, 47]).pickup('health_large', [40, -4, 31]);
m.pickup('armor_small', [8, 4, 49]).pickup('armor_small', [72, 4, 49]);
m.pickup('health_small', [12, 0, 57]).pickup('health_small', [68, 0, 57]).pickup('health_small', [32, -4, 8]).pickup('health_small', [48, -4, 8]);
// Weapons round the yard and the sheds.
m.pickup('weapon_shotgun', [40, 0, 56]).pickup('weapon_plasma', [40, 0, 2.5]);
m.pickup('weapon_launcher', [33, -4, 28]).pickup('weapon_auto_shotgun', [40, 4, 57]);
m.pickup('weapon_smg', [8, 0, 46]).pickup('weapon_smg', [72, 0, 46]);
m.pickup('weapon_burst_rifle', [-2.5, 4, 34.5]).pickup('weapon_burst_rifle', [82.5, 4, 34.5]);
m.pickup('weapon_marksman', [12, 4, 57]).pickup('ammo_sniper', [68, 4, 57]);
m.pickup('grenades', [16, 0, 16]).pickup('grenades', [64, 0, 16]).pickup('mines', [40, -4, 8]);
m.pickup('ammo', [16, 0, 28]).pickup('ammo', [64, 0, 28]).pickup('ammo_shells', [24, 0, 2.5]).pickup('ammo_cells', [56, 0, 2.5]);

m.bounds('invisible');
m.teams([6, 6]);
// ---------------------------------------------------------------- objectives
// Capture the Flag: each team's flag in the ground-floor atrium of its own shed.
m.flag(embers, [3, 0, 26], P).flag(tide, [77, 0, 26], -P);
// King of the Hill: the loading pit, the south-west yard, the open yard by the dock.
m.hill([40, -4, 28], 5).hill([24, 0, 16], 5).hill([40, 0, 40], 4);

// Furniture in the bare rooms, for what they are in this theme.
m.furnish();
// Enough team spawns for a full match.
await m.fillTeamSpawns(6);
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
/** Seeded noise for scattering. */
let seed = 0x7e11a;
const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;

// The yard sits in a railway cutting: gravel ballast round the walls, a muddy drainage ditch, then
// grassy embankments climbing to rough ground all round.
const ground = sculpt(
  (x, z, d) => -0.1 - 1.2 * smooth(3, 7, d) * (1 - smooth(8, 12, d)) + smooth(9, 30, d) * (7 + 2.5 * Math.sin(x / 13) * Math.cos(z / 17) + 1.5 * Math.sin(z / 7 + x / 23)) + smooth(30, 55, d) * 6 * (0.5 + 0.5 * Math.sin(x / 19 - z / 27)),
  (x, z, d) => {
    if (d < 3.5) return ['gravel', 0];
    if (d < 10) return ['mud', 1];
    const worn = Math.sin(x / 9 + z / 14) * Math.cos(z / 11 - x / 21) > 0.35;
    return worn ? ['dirt', 2] : ['grass', d < 18 ? 4 : 3];
  },
);
m.terrain(ground);
// Scrub that has taken hold in the yard's corners and against the shed walls: somewhere to lie up on the
// flanks and the dock approaches, away from the tracks' line of fire and the hills.
for (const s of [1, -1] as const) {
  const x = (dx: number) => 40 + s * (40 - dx);
  for (const [dx, z] of [[6, 18.5], [14.5, 51], [5.5, 2.5]] as const) {
    m.prop('bush_large', [x(dx), 0, z], rand() * 6.28, 1, false);
    m.prop(z > 40 ? 'nt_bush_berries' : 'nt_bush_leafy', [x(dx + 1.6), 0, z - 1.4], rand() * 6.28, 0.85, false);
  }
}
// Odds and ends: propane by the gas drums, a bin on the dock, fuel cans by the lamp-room bench.
m.prop('sv_propane', [27.7, 0, 23], 0.6).prop('sv_propane', [52.3, 0, 33], 2.4);
m.prop('sv_trashcan_metal', [30.6, 0, 58.8], Math.PI);
m.prop('sv_gas_can', [-3.5, 0, 51.4], 0.3, 1, false).prop('sv_gas_can', [-1.2, 0, 51.5], 1.2, 1, false);
m.meta({
  description:
    'A railway goods yard at dusk. Weave between boxcars and cargo stacks in the open yard, drop into the sunken loading pit, slip through the culvert beneath the tracks, or run the dock catwalk between the two brick sheds and their windows over the yard. The railgun waits on the crane perch above the pit, and the only way out to it is a bare girder from the west shed roof, in plain sight of everyone.',
  modes: ['core.deathmatch', 'core.tdm', 'core.ctf', 'core.koth'],
  players: [6, 12],
});
await m.save();
