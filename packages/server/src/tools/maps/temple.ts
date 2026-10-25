/**
 * Temple: a compact sandstone temple round a two-storey hall with a sunken
 * pit at its heart (a layout homage to GoldenEye's multiplayer Temple; our
 * own name, tiles and props). Two long colonnades run down the west and east
 * sides with galleries above them, a south vestibule and a north antechamber
 * close the ends, twin stairs climb to the altar at the north end, and the
 * east side opens onto an overgrown courtyard with an open stair up to the
 * east gallery.
 *
 *   ground (z0), x → 0..6                    upper (z1)
 *   y6      c   ←   k   →   c   Y               .   ↑   A   ↑   .   .   .
 *   y5      c   a   a   a   c   Y               .   .   .   n   .   .   .
 *   y4  s   C  [H   H   H]  C   ↓               .   g  [b   b   b]  g   ↓
 *   y3  s   C  [H   V   H]  C   Y           l   g  [w   .   w]  g   p
 *   y2  ↑   C  [↑   H   ↑]  C   Y               g  [↑   .   ↑]  g   .
 *   y1  s   c   v   v   v   c   Y               g   u   u   u   g   .
 *
 *   C        colonnades (columned rooms, open end to end); c corner rooms
 *   H        the hall: two storeys, V the sunken pit (1.5 m, steps up its north side)
 *   ↑ in H   stairs from the vestibule (v) up the hall's south corners onto its walkways (w)
 *   b        the north balcony over the hall, joined to both walkways
 *   a, k     antechamber and the crypt under the altar; A the altar, reached by twin stairs ←→
 *   g, u, n  galleries over the colonnades and vestibule; n links the balcony to the altar
 *   s, l     west side rooms, a stair up to the landing (l) and the west gallery
 *   Y, p     the courtyard (grass, trees, ruins); an open stair climbs to the platform (p)
 */
import type { Side, TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('temple', 'Temple');
m.theme('temple');
// An old temple at dusk, the jungle hills dark beyond its walls.
m.backdrop('dusk', 'forest', 'moss', 0.5);
const P = Math.PI / 2;
const PI = Math.PI;
type V3 = [number, number, number];
/** World position of cell (x, y) on level z, plus an offset in metres (dy is north) and a height. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [x * 8 + dx, z * 4 + up, y * 8 + dy];

// ---------------------------------------------------------------- ground floor (z0)

// The hall: eight plain cells round the sunken pit, two stairs in its south corners.
for (const [x, y] of [[3, 2], [2, 3], [4, 3], [2, 4], [3, 4], [4, 4]] as const) m.tile('room', x, y, 0, 0, { layout: 'empty' });
m.tile('room_sunken', 3, 3, 0, 0);
m.tile('stairs', 2, 2, 0, 3).tile('stairs', 4, 2, 0, 3);
// Colonnades west and east, corner rooms at their ends.
for (const x of [1, 5]) {
  m.tile('room', x, 1).fill('room_columns', x, 2, x, 4).tile('room', x, 5).tile('room', x, 6);
}
// South vestibule, north antechamber, the crypt under the altar.
m.fill('room', 2, 1, 4, 1).fill('room', 2, 5, 4, 5).tile('room', 3, 6);
// Twin stairs up to the altar.
m.tile('stairs', 2, 6, 0, 0).tile('stairs', 4, 6, 0, 2);
// West side rooms and the stair to the landing.
m.tile('room', 0, 1).tile('stairs', 0, 2, 0, 3).tile('room', 0, 3).tile('room', 0, 4);
// The courtyard: open ground, ruins at the ends, an open stair climbing south to the platform.
m.tile('yard_ruins', 6, 1).tile('yard', 6, 2).tile('yard', 6, 3).tile('stairs_open', 6, 4, 0, 1).tile('yard', 6, 5).tile('yard_ruins', 6, 6, 0, 2);

// ---------------------------------------------------------------- upper floor (z1)

// Walkways round the pit: bridges up the west and east sides, the balcony across the north.
m.tile('bridge', 2, 3, 1, 0).tile('bridge', 4, 3, 1, 0);
m.fill('platform_rail', 2, 4, 4, 4, 1);
// Galleries over the colonnades and the vestibule (a U round the south of the hall).
for (const x of [1, 5]) m.fill('room', x, 1, x, 4, 1);
m.fill('room', 2, 1, 4, 1, 1);
// From the balcony north to the altar.
m.tile('room', 3, 5, 1).tile('platform_rail', 3, 6, 1);
// West landing; the courtyard platform.
m.tile('room', 0, 3, 1).tile('platform_rail', 6, 3, 1);

// ---------------------------------------------------------------- walls and openings

// Inside the hall: open between its cells and round the pit; rails beside the stairs.
for (const [x, y, s] of [[2, 3, 'E'], [3, 3, 'E'], [2, 3, 'N'], [2, 4, 'E'], [3, 4, 'E'], [4, 3, 'N'], [3, 3, 'N'], [3, 3, 'S']] as const) m.edge(x, y, 0, s, 'open');
// A low wall beside the pit's steps (they run down its west side).
m.edge(3, 3, 0, 'W', 'half');
m.edge(2, 2, 0, 'E', 'railing').edge(4, 2, 0, 'W', 'railing').edge(2, 2, 1, 'E', 'railing').edge(4, 2, 1, 'W', 'railing');
// Hall walls: doors from the colonnades on both floors, arches under the balcony, a wide south door.
for (const [x, s] of [[2, 'W'], [4, 'E']] as const) {
  m.edge(x, 2, 0, s, 'wall').edge(x, 2, 1, s, 'window');
  m.edge(x, 3, 0, s, 'door').edge(x, 3, 1, s, 'door');
  m.edge(x, 4, 0, s, 'arch').edge(x, 4, 1, s, 'windows');
  m.edge(x, 4, 0, 'N', 'wall').edge(x, 4, 1, 'N', 'wall');
}
m.edge(3, 2, 0, 'S', 'wide').edge(3, 1, 1, 'N', 'windows');
m.edge(3, 4, 0, 'N', 'arch');
// Colonnades: open end to end between the columns, arches to the corner rooms.
for (const x of [1, 5]) {
  m.edge(x, 1, 0, 'N', 'arch').edge(x, 2, 0, 'N', 'open').edge(x, 3, 0, 'N', 'open').edge(x, 4, 0, 'N', 'arch');
  m.edge(x, 1, 1, 'N', 'arch').edge(x, 3, 1, 'N', 'arch');
}
// Vestibule and antechamber: arches between their rooms; the crypt opens wide off the antechamber.
m.edge(2, 1, 0, 'E', 'arch').edge(3, 1, 0, 'E', 'arch').edge(2, 5, 0, 'E', 'arch').edge(3, 5, 0, 'E', 'arch');
m.edge(3, 5, 0, 'N', 'wide');
m.edge(3, 1, 1, 'E', 'arch').edge(3, 1, 1, 'W', 'arch');
// The altar's back wall; windows out of the galleries.
m.edge(3, 6, 1, 'N', 'wall');
m.edge(1, 1, 1, 'W', 'window').edge(3, 1, 1, 'S', 'window').edge(1, 4, 1, 'W', 'slit');
// Onto the courtyard: arches and windows from the east colonnade, windows over it from upstairs.
m.edge(5, 1, 0, 'E', 'window').edge(5, 2, 0, 'E', 'arch').edge(5, 3, 0, 'E', 'door').edge(5, 4, 0, 'E', 'window').edge(5, 5, 0, 'E', 'arch').edge(5, 6, 0, 'E', 'door');
m.edge(5, 1, 1, 'E', 'window').edge(5, 2, 1, 'E', 'windows').edge(5, 4, 1, 'E', 'window');
// The courtyard walls stand two storeys.
for (let y = 1; y <= 6; y++) if (y !== 4) m.edge(6, y, 0, 'E', 'high');
m.edge(6, 1, 0, 'S', 'high').edge(6, 6, 0, 'N', 'high');

// ---------------------------------------------------------------- surfaces

function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces }] });
}
// Sandstone walls and worn flagstones throughout, polished stone in the hall, grass in the courtyard.
const sand: TileSurfaces = { floor: { material: 'core.pbr_flagstone', tint: '#d8c49c' }, walls: { material: 'core.sandstone', tint: '#e6d2a8' } };
const hall: TileSurfaces = { floor: { material: 'core.pbr_travertine', tint: null }, walls: { material: 'core.sandstone', tint: '#dcc59a' } };
const grass: TileSurfaces = { floor: { material: 'core.pbr_grass', tint: null }, walls: { material: 'core.pbr_rock', tint: '#b8a888' } };
for (const t of [...m.doc.classicStructure.tiles]) {
  const inHall = t.x >= 2 && t.x <= 4 && t.y >= 2 && t.y <= 4;
  if (t.tile === 'core.bridge' || t.tile === 'core.stairs_open' || (t.tile === 'core.platform_rail' && t.x === 6)) continue;
  paint(t.x, t.y, t.z, t.x === 6 ? grass : inHall ? hall : sand);
}

// ---------------------------------------------------------------- props and torches

const TORCH = '#ffa552';
const inset: Record<Side, [number, number, number]> = { N: [0, 3.3, PI], S: [0, -3.3, 0], E: [3.3, 0, -P], W: [-3.3, 0, P] };
/** A wall torch (and its glow) on side `s` of cell (x, y, z), `along` m along the wall. */
function torch(x: number, y: number, z: number, s: Side, along = 0): void {
  const [ox, oy, yaw] = inset[s];
  const ax = s === 'N' || s === 'S' ? along : 0;
  const ay = s === 'E' || s === 'W' ? along : 0;
  m.prop('dg_wall_torch', at(x, y, z, ox + ax, oy + ay, 2.1), yaw, 1, false);
  m.light(at(x, y, z, ox * 0.85 + ax, oy * 0.85 + ay, 2.5), { fixture: 'none', color: TORCH, intensity: 1.1, range: 10 });
}
/** A banner hung on side `s` of cell (x, y, z). */
function banner(x: number, y: number, z: number, s: Side, along = 0): void {
  const [ox, oy, yaw] = inset[s];
  const k = 3.38 / 3.3;
  m.prop('dg_banner', at(x, y, z, ox * k + (s === 'N' || s === 'S' ? along : 0), oy * k + (s === 'E' || s === 'W' ? along : 0), 0.9), yaw, 1, false);
}

// The hall: torches and banners on its tall walls, broken columns round the pit, statues in the alcoves under the balcony.
torch(2, 3, 0, 'W', 2.6);
torch(4, 3, 0, 'E', -2.6);
torch(3, 2, 0, 'S', 2.6);
torch(3, 2, 0, 'S', -2.6);
banner(2, 4, 0, 'N', 0);
banner(4, 4, 0, 'N', 0);
banner(2, 4, 1, 'N', -2);
banner(4, 4, 1, 'N', 2);
torch(2, 4, 1, 'N', 2);
torch(4, 4, 1, 'N', -2);
for (const [dx, dy, up] of [[3.2, -3.4, -1.5], [3.2, 0.4, -1.5], [3, 3.2, 0]] as const) m.prop('rn_column_broken', at(3, 3, 0, dx, dy, up), 0, 1.2);
m.prop('rn_column_round', at(3, 2, 0, -2.8, -2.8), 0, 0.8).prop('rn_column_round', at(3, 2, 0, 2.8, -2.8), 0, 0.8);
m.prop('rn_statue_stag', at(2, 4, 0, -2.6, 2.6), PI + 0.6).prop('rn_statue_stag', at(4, 4, 0, 2.6, 2.6), PI - 0.6);
m.prop('rn_urn', at(2, 4, 0, -3, -0.2)).prop('rn_urn', at(4, 4, 0, 3, -0.2)).prop('rn_urn_broken', at(3, 4, 0, -2.8, 2.9));
m.prop('dg_vase', at(2, 3, 0, -2.9, -2.9)).prop('dg_vase', at(4, 3, 0, 2.9, -2.9));
m.prop('rn_urn', at(3, 4, 1, -3, 3)).prop('rn_urn', at(3, 4, 1, 3, 3)).prop('rn_candles', at(3, 4, 1, 0, 3.1), 0, 1, false);

// Colonnades: torches between the columns, statues and urns in the corners.
for (const x of [1, 5]) {
  const out: Side = x === 1 ? 'W' : 'E';
  torch(x, 2, 0, x === 1 ? 'E' : 'W', 0);
  torch(x, 4, 0, x === 1 ? 'E' : 'W', -2.6);
  torch(x, 3, 1, out, 0);
  banner(x, 2, 1, x === 1 ? 'E' : 'W', 0);
  m.prop('rn_statue_fox', at(x, 1, 0, x === 1 ? -2.8 : 2.8, -2.8), x === 1 ? P / 2 : -P / 2);
  m.prop('rn_urn', at(x, 5, 0, x === 1 ? -3 : 3, 3)).prop('rn_urn_broken', at(x, 5, 0, x === 1 ? -2.9 : 2.9, 2.1));
  m.prop('dg_vase', at(x, 1, 1, x === 1 ? -2.9 : 2.9, -2.9)).prop('rn_urn', at(x, 4, 1, x === 1 ? -2.9 : 2.9, 2.9));
  m.prop('rn_column_broken', at(x, 6, 0, x === 1 ? -2.6 : 2.6, 2.6), 0.3, 1.1);
  torch(x, 6, 0, 'N', x === 1 ? -2 : 2);
}
// Vestibule and antechamber.
torch(2, 1, 0, 'S', 0);
torch(4, 1, 0, 'S', 0);
m.prop('dg_pedestal', at(3, 1, 0, -2.8, -2.8)).prop('dg_pedestal', at(3, 1, 0, 2.8, -2.8));
m.prop('rn_urn', at(3, 1, 0, -2.8, -2.8, 1.1), 0, 0.9).prop('rn_urn', at(3, 1, 0, 2.8, -2.8, 1.1), 0, 0.9);
torch(2, 5, 0, 'W', 0);
torch(4, 5, 0, 'E', 0);
m.prop('rn_statue_fox', at(2, 5, 0, -2.8, 2.6), PI - 0.4).prop('rn_statue_fox', at(4, 5, 0, 2.8, 2.6), PI + 0.4);
// The crypt under the altar: a chest of offerings, urns and candles.
m.prop('dg_chest', at(3, 6, 0, 0, 2.9), PI).prop('rn_candles', at(3, 6, 0, -1.2, 3), 0, 1, false).prop('rn_candles', at(3, 6, 0, 1.2, 3), 0, 1, false);
m.prop('rn_urn', at(3, 6, 0, -2.9, 2.9)).prop('dg_vase', at(3, 6, 0, 2.9, 2.9));
torch(3, 6, 0, 'W', 0);
// The altar: a pedestal and candles at the back, banners either side.
m.prop('dg_pedestal', at(3, 6, 1, 0, 2.6)).prop('rn_candles', at(3, 6, 1, 0, 2.6, 1.1), 0, 1, false);
m.prop('dg_coin_pile', at(3, 6, 1, -1.4, 2.8), 0, 1, false);
banner(3, 6, 1, 'N', -2.4);
banner(3, 6, 1, 'N', 2.4);
torch(3, 6, 1, 'N', 0);
torch(3, 5, 1, 'W', 0);
// Galleries.
torch(3, 1, 1, 'S', -2.4);
banner(2, 1, 1, 'S', 0);
banner(4, 1, 1, 'S', 0);
m.prop('dg_vase', at(2, 1, 1, -2.9, -2.9)).prop('dg_vase', at(4, 1, 1, 2.9, -2.9));
// West side rooms: a guard room and a storeroom.
torch(0, 1, 0, 'W', 0);
m.prop('dg_table_small', at(0, 1, 0, -2.4, -2.4), 0).prop('dg_barrel', at(0, 1, 0, 2.8, -2.9)).prop('dg_crate', at(0, 1, 0, -2.9, 1));
m.prop('dg_barrel', at(0, 4, 0, -2.9, 2.9)).prop('dg_crate', at(0, 4, 0, -2.8, 1.6)).prop('dg_sword_mount', at(0, 4, 0, 0, 3.35, 1.6), PI, 1, false);
torch(0, 3, 0, 'W', 0);
torch(0, 3, 1, 'W', 0);
m.prop('dg_skull', at(0, 3, 0, -2.6, -2.6), 0, 1, false).prop('rn_urn_broken', at(0, 3, 0, -2.9, 2.8));
m.prop('dg_vase', at(0, 3, 1, -2.9, 2.9));

// The courtyard: trees and bushes to hide in, broken columns and a fallen wall.
m.prop('nt_common_tree', at(6, 2, 0, 2, 1.5), 0.6, 0.9).prop('nt_palm_curved', at(6, 5, 0, 2.2, 2.2), 2.1);
m.prop('nt_common_tree_2', at(6, 6, 0, -2.4, -1.4), 1.4, 0.95);
m.prop('nt_bush_leafy', at(6, 2, 0, 2.6, -2.4), 0.4, 1.2, false).prop('nt_bush_berries', at(6, 3, 0, 2.7, -1.5), 2.2, 1.1, false);
m.prop('nt_bush_leafy', at(6, 5, 0, -2.6, 2.8), 1.1, 1.2, false).prop('nt_fern_wide', at(6, 6, 0, 2.6, 0.8), 0.3, 1, false);
m.prop('nt_fern_wide', at(6, 1, 0, -2.6, 0.6), 1.9, 1, false).prop('nt_bush_berries', at(6, 2, 0, -2.6, 2.6), 0.9, 1.1, false);
m.prop('nt_boulder_moss', at(6, 3, 0, 2.6, 2.6), 0.7).prop('rn_column_broken', at(6, 2, 0, -1.5, -0.5), 0, 1.2);
m.prop('rn_wall_broken', at(6, 5, 0, 1.6, -2.4), 0, 0.8);
m.prop('rn_urn_broken', at(6, 3, 0, -2.6, -2.6), 0.5);
for (const y of [2, 5]) torch(6, y, 0, 'E', y === 2 ? -2 : 1);
m.prop('rn_urn', at(6, 3, 1, 3, -3)).prop('rn_urn', at(6, 3, 1, 3, 3));

// ---------------------------------------------------------------- spawns and pickups

for (const [x, y, z, dx, dy, yaw] of [
  [0, 1, 0, 1, 1, P], [0, 4, 0, 1, -1, P], [0, 3, 1, 1, 1, P],
  [1, 2, 0, 0, 0, 0], [1, 5, 0, 0, 1, -P / 2 + PI], [5, 2, 0, 0, 0, 0], [5, 5, 0, 0, 1, PI],
  [6, 1, 0, -1, 1.5, 0], [6, 5, 0, -1.5, 0, PI],
  [3, 1, 0, 0, -1.5, 0], [3, 5, 0, 0, 1, PI],
  [1, 3, 1, 0, 1, PI], [5, 2, 1, 0, 0, 0], [3, 1, 1, 0, -1, 0], [3, 4, 1, 0, 1.5, PI],
  [1, 6, 0, 0, 1, P], [5, 6, 0, 0, 1, -P],
] as const) m.spawn(at(x, y, z, dx, dy), yaw);

// Body armour in the pit; rockets on the altar; the grenade launcher on the courtyard platform.
m.pickup('armor_large', at(3, 3, 0, 0, -2, -1.5));
m.pickup('weapon_rockets', at(3, 6, 1, 0, 0.5)).pickup('ammo_explosive', at(3, 5, 1, 0, 1));
m.pickup('weapon_launcher', at(6, 3, 1, 0.5, 0)).pickup('grenades', at(6, 6, 0, 0, -2));
// Rifles and SMGs round the colonnades and galleries, a shotgun in the crypt, the sniper on the balcony.
m.pickup('weapon_smg', at(1, 3, 0)).pickup('weapon_smg', at(5, 3, 0));
m.pickup('weapon_rifle', at(3, 1, 1, 0, 1)).pickup('weapon_rifle', at(0, 3, 0));
m.pickup('weapon_shotgun', at(3, 6, 0, 0, 0.5)).pickup('weapon_sniper', at(3, 4, 1, 0, -1));
m.pickup('weapon_auto_shotgun', at(6, 2, 0, -1, 0)).pickup('weapon_burst_rifle', at(1, 6, 0));
// Ammo everywhere.
m.pickup('ammo_light', at(1, 1, 0)).pickup('ammo_light', at(5, 1, 0)).pickup('ammo_light', at(5, 4, 1));
m.pickup('ammo_rifle', at(2, 1, 0)).pickup('ammo_rifle', at(1, 2, 1)).pickup('ammo_rifle', at(0, 1, 0, -1, -1));
m.pickup('ammo_shells', at(4, 5, 0)).pickup('ammo_shells', at(6, 5, 0, -1, -2)).pickup('ammo_sniper', at(2, 3, 1, 0, 1.5)).pickup('ammo_sniper', at(4, 3, 1, 0, 1.5));
m.pickup('ammo', at(2, 5, 0)).pickup('ammo', at(4, 1, 0)).pickup('ammo', at(5, 6, 0));
// Health and light armour.
m.pickup('health_small', at(1, 4, 1)).pickup('health_small', at(5, 3, 1)).pickup('health_small', at(0, 4, 0));
m.pickup('health_large', at(3, 2, 0, 0, -1)).pickup('armor_small', at(1, 5, 0)).pickup('armor_small', at(5, 1, 1));

// King of the Hill: the pit, then the north balcony over it, then the vestibule floor of the hall.
m.hill(at(3, 3, 0, 0, -1.5, -1.5), 5).hill(at(3, 4, 1, 0, 0.5), 4.5).hill(at(3, 2, 0, 0, -0.5), 4.5);
await m.teamBases(5, { hills: 0 });
m.lightRooms({ color: '#ffc480', intensity: 0.85, skip: (x, y) => x >= 2 && x <= 4 && y >= 2 && y <= 4 });
m.meta({
  description:
    'A compact sandstone temple in the spirit of GoldenEye\'s Temple: a two-storey hall with a sunken pit at its heart, walkways and a balcony round it, long colonnades with galleries above, twin stairs to the altar at the north end and an overgrown courtyard on the east side. Body armour waits in the pit; the rockets sit on the altar.',
  modes: ['core.deathmatch', 'core.tdm', 'core.koth'],
  players: [2, 10],
});
await m.save();
