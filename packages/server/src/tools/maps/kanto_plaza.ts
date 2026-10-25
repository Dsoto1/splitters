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
import type { TileSurfaces } from '@chronosplit/shared';
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

m.bounds('invisible');
m.meta({
  description:
    'A glass office tower at sunset. Tide hold Kanto Plaza; Embers come in off the plaza through the revolving doors or round by the loading dock, and fight up through open-plan floors and two switchback stairwells to the executive floor, where the hostages are, and on to the roof and its helipad.',
  modes: ['core.tdm', 'core.deathmatch'],
  players: [8, 16],
});
await m.save();
