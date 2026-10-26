/**
 * Norman Shores: a look-alike of the lake houses on Lake Norman, North
 * Carolina, on a summer evening. Our own map and names. A wide lake runs down
 * the middle between two wooded shores and opens to the broad main channel in
 * the south; a narrow arm runs north under a long road bridge to a creek
 * mouth. Big houses step down the slopes on both shores: a walkout basement
 * at the water's level, the main floor with a screened porch and a deck over
 * the lawn, bedrooms and a balcony above, a garage on the road behind. Every
 * house has a dock and a boathouse with a sundeck; jet skis (hover bikes),
 * bass boats (speeders) and a pontoon (hauler) ride the water. On the east
 * shore the marina has a fuel dock, slips, a ship store and the Waterfront
 * restaurant and bar with a rooftop deck. A small wooded island with a cove
 * sits in the south basin; the west shore has a cove of its own.
 *
 * Top-down (x east, z north; metres):
 *
 *   z +128  creek mouth (the arm ends)
 *   z  +80  W3 house          ~~arm~~           E3 house
 *   z  +48  ===== the long road bridge (deck 7 m up, 168 m) =====
 *   z  +16                    ~~lake~~          E2 house
 *   z   -8  W2 house          ~~lake~~
 *   z  -40  west cove        island (KOTH)      marina: fuel dock, slips, Waterfront
 *   z  -80  W1 house (flag)   ~~the basin~~     E1 house (flag)
 *   z -110  ~~~~~~~~~~~~~~~ the main channel, out to the horizon ~~~~~~~~~~~~~~
 *
 * Modes: TDM (west shore against east shore), CTF (W1 against E1, across the
 * basin), KOTH (island, marina fuel dock, bridge), deathmatch. Race is left
 * out: a track's start grid holds at most 16, and this map is for 24.
 */
import { TERRAIN_MATERIALS, paintSlopes, terrainHeightAt, type EdgeStyle, type RoomOptions, type RoomType, type Side, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('norman_shores', 'Norman Shores');
m.theme('garden');
m.backdrop('sunset', 'forest', 'grass', 0.35, 0.12);
m.teams([12, 12]);
const [westTeam, eastTeam] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
const P = Math.PI / 2;
const PI = Math.PI;
const r2 = (n: number) => +n.toFixed(2);
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const SIDE_D: Record<Side, [number, number]> = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };
const OPP: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };
const sm = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [x * 8 + dx, z * 4 + up, y * 8 + dy];

function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
let panes = 0;
/** A wall style on one side; every window gets a pane of glass that shoots out. */
function edge(x: number, y: number, z: number, side: Side, style: EdgeStyle): void {
  m.edge(x, y, z, side, style);
  if (style !== 'window') return;
  const [dx, dy] = SIDE_D[side];
  m.add({ kind: 'destructible', id: `pane_${String(++panes).padStart(3, '0')}`, name: 'Window pane', model: 'glass', position: at(x, y, z, dx * 4, dy * 4), yaw: side === 'N' || side === 'S' ? 0 : P, health: null, explosiveOnly: false });
}
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, surface: { material: string; tint?: string | null }) => {
  const look = { material: surface.material.replace(/^core\./, ''), ...(surface.tint ? { tint: surface.tint } : {}) };
  const w = x1 - x0;
  const d = z1 - z0;
  const nx = Math.ceil(w / 64);
  const nz = Math.ceil(d / 64);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const a0 = x0 + (w * i) / nx;
      const a1 = x0 + (w * (i + 1)) / nx;
      const b0 = z0 + (d * j) / nz;
      const b1 = z0 + (d * (j + 1)) / nz;
      m.block([r2((a0 + a1) / 2), r2(y0), r2((b0 + b1) / 2)], [r2(a1 - a0), r2(y1 - y0), r2(b1 - b0)], 'solid', look);
    }
};

// ---------------------------------------------------------------- the lake

const WATER = -0.8;
const lakeC = (z: number) => 1 + 3 * Math.sin(z / 41);
function lakeW(z: number): number {
  let w = 45 + 5 * Math.sin(z / 23 + 1);
  if (z > 70) w += (19 - w) * sm(70, 105, z);
  if (z > 110) w = z >= 128 ? 0 : 19 * Math.sqrt(1 - ((z - 110) / 18) ** 2);
  if (z < -96) w += (-96 - z) * 2.4;
  return w;
}
const ISLAND = { x: 8, z: -34, r: 17 };
const ISLE_COVE = { x: 8, z: -46, r: 6.5 };
const WEST_COVE = { x: -54, z: -40, r: 13 };
function isWater(x: number, z: number): boolean {
  if (Math.hypot(x - ISLE_COVE.x, z - ISLE_COVE.z) < ISLE_COVE.r) return true;
  if (Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r) return false;
  if (Math.hypot(x - WEST_COVE.x, z - WEST_COVE.z) < WEST_COVE.r) return true;
  return Math.abs(x - lakeC(z)) < lakeW(z);
}
/** Where the west and east shores are at z (the main lake, ignoring the coves). */
const shoreW = (z: number) => lakeC(z) - lakeW(z);
const shoreE = (z: number) => lakeC(z) + lakeW(z);
// One body of water over the whole map: the land rises out of it.
m.water([0, -7, 0], [330, 7 + WATER, 330], 'water', '#3e6a5c'); // Lake Norman's green-brown water

// ---------------------------------------------------------------- terrain pads (filled in as things are built)

interface Pad {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  y: number;
  blend: number;
  ground?: TerrainMaterial;
}
const pads: Pad[] = [];
const pad = (x0: number, z0: number, x1: number, z1: number, y: number, blend: number, ground?: TerrainMaterial) =>
  pads.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y, blend, ...(ground ? { ground } : {}) });

// ---------------------------------------------------------------- the lake houses

type Kind = RoomType | 'stairA' | 'stairB' | 'porch' | 'deck' | 'balcony' | 'garage';
interface HouseInfo {
  name: string;
  cells: { x: number; y: number; z: number; type: RoomType }[];
  /** World spots: main-floor living room, walkout, deck, drive. */
  living: V3;
  walkout: V3;
  deck: V3;
  drive: V3;
  upstairs: V3;
  dock: V3;
  boathouse: V3;
  lake: Side;
}
const HOUSES: HouseInfo[] = [];
const ROOF: RoomOptions = { ceiling: 'roof' };
const FLOORS: Partial<Record<RoomType, string>> = { living: 'pbr_floorboards', dining: 'pbr_floorboards', kitchen: 'pbr_terrazzo', bedroom: 'pbr_carpet', bathroom: 'white_tiles', office: 'pbr_floorboards', storage: 'pbr_concrete', bar: 'pbr_walnut', workshop: 'pbr_concrete' };
const OPEN_PAIRS = new Set(['living:dining', 'dining:living', 'dining:kitchen', 'kitchen:dining']);

/**
 * A lake house: local u runs from the lake (0, the lake-front rooms; -1 the
 * deck and porch) to the road (1 the back rooms, 2 the garage on the main
 * floor), v along the shore (0..2). z0 is the walkout basement, z1 the main
 * floor (level with the road behind), z2 the bedrooms.
 */
function house(name: string, ox: number, oy: number, lake: 'E' | 'W', tint: string, roofTint: string): void {
  const sgn = lake === 'E' ? -1 : 1; // +u moves away from the lake
  const cx = (u: number) => ox + sgn * u;
  const back: Side = OPP[lake];
  const plan: Record<string, Kind> = {
    '0,0,0': 'bar', '0,1,0': 'living', '0,2,0': 'bedroom', '1,0,0': 'storage', '1,1,0': 'stairA', '1,2,0': 'bathroom',
    '0,0,1': 'living', '0,1,1': 'dining', '0,2,1': 'kitchen', '1,0,1': 'office', '1,2,1': 'stairB', '2,0,1': 'garage',
    '-1,0,1': 'porch', '-1,1,1': 'deck', '-1,2,1': 'deck',
    '0,0,2': 'bedroom', '0,1,2': 'bedroom', '0,2,2': 'bedroom', '1,0,2': 'bathroom', '1,1,2': 'office', '-1,1,2': 'balcony',
  };
  const kindAt = (u: number, v: number, z: number): Kind | undefined => {
    if (u === 1 && v === 1 && z === 1) return 'stairA';
    if (u === 1 && v === 2 && z === 2) return 'stairB';
    return plan[`${u},${v},${z}`];
  };
  const info: HouseInfo = { name, cells: [], living: at(cx(0), oy, 1), walkout: at(cx(-1), oy + 1, 0), deck: at(cx(-1), oy + 2, 1), drive: at(cx(2), oy + 1, 0, sgn * 2, 0, 4), upstairs: at(cx(0), oy + 1, 2), dock: [0, 0, 0], boathouse: [0, 0, 0], lake };
  const wallsFor = (k: Kind): TileSurfaces => ({
    floor: mat(FLOORS[k as RoomType] ?? 'pbr_floorboards', k === 'bedroom' ? '#8a8a9e' : null),
    walls: mat('pbr_plaster_white', k === 'garage' || k === 'storage' ? '#c8c2b4' : tint),
    underside: mat('pbr_plaster_white', '#f4efe4'),
    trim: mat('pbr_plaster_white', '#fbf8f0'),
    solids: mat('pbr_walnut'),
  });
  // Stairwells first (doors to the lake-front rooms on both floors), then the rooms.
  const stairRot = lake === 'E' ? 2 : 0;
  m.tile('stairwell', cx(1), oy + 1, 0, stairRot);
  m.tile('stairwell', cx(1), oy + 2, 1, stairRot);
  paint(cx(1), oy + 1, 0, wallsFor('living'));
  paint(cx(1), oy + 2, 1, wallsFor('living'));
  for (const [k, kind] of Object.entries(plan)) {
    if (kind === 'stairA' || kind === 'stairB') continue;
    const [u, v, z] = k.split(',').map(Number) as V3;
    const x = cx(u);
    const y = oy + v;
    if (kind === 'deck' || kind === 'balcony') {
      m.tile('platform_rail', x, y, z);
      paint(x, y, z, { floor: mat('oak_planks', '#b88a5a'), trim: mat('pbr_plaster_white', '#fbf8f0') });
      continue;
    }
    const roofed = !kindAt(u, v, z + 1);
    m.tile('room', x, y, z, 0, roofed ? ROOF : {});
    paint(x, y, z, kind === 'porch' ? { ...wallsFor('living'), floor: mat('oak_planks', '#b88a5a') } : wallsFor(kind));
    const type: RoomType = kind === 'porch' ? 'living' : kind === 'garage' ? 'workshop' : kind;
    info.cells.push({ x, y, z, type });
  }
  // Walls: lake side big windows and sliding doors, sides windows, the walkout's back buried in the hill.
  const lakeStyle: Record<string, EdgeStyle> = { '0,0,0': 'window', '0,1,0': 'wide', '0,2,0': 'window', '0,0,1': 'wide', '0,1,1': 'wide', '0,2,1': 'window', '0,0,2': 'window', '0,1,2': 'wide', '0,2,2': 'window' };
  for (const [k, kind] of Object.entries(plan)) {
    if (kind === 'stairA' || kind === 'stairB' || kind === 'deck' || kind === 'balcony') continue;
    const [u, v, z] = k.split(',').map(Number) as V3;
    const x = cx(u);
    const y = oy + v;
    const sides: [Side, number, number][] = [[lake, -1, 0], [back, 1, 0], ['S', 0, -1], ['N', 0, 1]];
    for (const [side, du, dv] of sides) {
      const other = kindAt(u + du, v + dv, z);
      if (other === 'stairA' || other === 'stairB') continue;
      if (kind === 'porch') {
        if (side === back) edge(x, y, z, side, 'wide');
        else if (other === 'deck') edge(x, y, z, side, 'arch');
        else edge(x, y, z, side, 'bars');
        continue;
      }
      if (kind === 'garage') {
        if (side === back) edge(x, y, z, side, 'wide');
        else if (side === lake) edge(x, y, z, side, 'door');
        else edge(x, y, z, side, 'wall');
        continue;
      }
      if (other === 'porch' || other === 'garage') continue; // built from their side
      if (other === 'deck' || other === 'balcony') {
        edge(x, y, z, side, lakeStyle[k] ?? 'window');
        continue;
      }
      if (other) {
        // Shared walls once (from the cell with the lower u, then the lower v).
        if (du < 0 || dv < 0) continue;
        edge(x, y, z, side, OPEN_PAIRS.has(`${kind}:${other}`) ? 'arch' : 'door');
        continue;
      }
      if (side === lake) edge(x, y, z, side, lakeStyle[k] ?? 'window');
      else if (z === 0 && (side === back || u === 1)) edge(x, y, z, side, 'wall');
      else edge(x, y, z, side, 'window');
    }
  }
  // The deck: open to the stairs down to the lawn, and the stairs themselves.
  m.tile('stairs_open', cx(-1), oy + 3, 0, 1);
  m.block([cx(-1) * 8, -0.3, (oy + 3) * 8 + 4.7], [5, 0.4, 1.4], 'solid', { material: 'pbr_concrete', tint: '#b8b4ac' }); // a step up onto the stairs
  m.edge(cx(-1), oy + 2, 1, 'N', 'open');
  // Posts under the porch and deck, a lid of a roof with a deep overhang.
  for (const pz of [oy * 8 - 3.8, oy * 8 + 4, oy * 8 + 12, oy * 8 + 19.8]) {
    m.block([r2(cx(-1) * 8 - sgn * 3.8), -0.6, r2(pz)], [0.3, 4.6, 0.3], 'solid', { material: 'pbr_plaster_white', tint: '#f4efe4' });
  }
  const xA = Math.min(cx(-1), cx(1)) * 8 - 4;
  const xB = Math.max(cx(-1), cx(1)) * 8 + 4;
  const lx0 = lake === 'E' ? xA : xA + 8;
  const lx1 = lake === 'E' ? xB - 8 : xB;
  m.block([r2((lx0 + lx1) / 2), 12, (oy + 1) * 8], [lx1 - lx0 + 1.6, 0.25, 25.6], 'solid', { material: 'pbr_roof', tint: roofTint });
  m.block([r2((lx0 + lx1) / 2), 12.25, (oy + 1) * 8], [lx1 - lx0 - 3, 0.9, 20], 'solid', { material: 'pbr_roof', tint: roofTint });
  // Garage roof and the porch roof.
  m.block([cx(2) * 8, 8, oy * 8], [9, 0.22, 9], 'solid', { material: 'pbr_roof', tint: roofTint });
  m.block([cx(-1) * 8, 8, oy * 8], [9, 0.22, 9], 'solid', { material: 'pbr_roof', tint: roofTint });
  // A stone chimney up the end wall.
  m.block([cx(1) * 8 + sgn * 2.6, 0, (oy - 0.5) * 8 - 0.7], [1.6, 13.4, 1.2], 'solid', { material: 'pbr_castle_stone', tint: '#b8b0a0' });
  // Terrain: the house and its patio level with the walkout, the road side level with the main floor.
  const fx0 = Math.min(cx(-1), cx(1)) * 8 - 4;
  const fx1 = Math.max(cx(-1), cx(1)) * 8 + 4;
  pad(fx0, oy * 8 - 4, fx1, (oy + 3) * 8 + 4, -0.15, 12, 'grass');
  const gx = cx(2) * 8;
  pad(gx - 4, oy * 8 - 4, gx + 4 + sgn * 10, oy * 8 + 4, 3.85, 12, 'gravel');
  pad(gx - 4, oy * 8 + 4, gx + 4, (oy + 2) * 8 + 4, 3.85, 10, 'grass');
  // The dock and boathouse, straight out from the deck.
  const dz = (oy + 1) * 8;
  const shore = lake === 'E' ? shoreW(dz) : shoreE(dz);
  const bx = lake === 'E' ? Math.ceil((shore + 10) / 8) : Math.floor((shore - 10) / 8);
  const dockFrom = shore + sgn * 3; // a few metres up the bank
  const dockTo = bx * 8 + sgn * 4 + sgn * -0; // the boathouse's shore-side wall
  const d0 = Math.min(dockFrom, dockTo);
  const d1 = Math.max(dockFrom, dockTo);
  box(d0, -0.3, dz - 1.5, d1, 0, dz + 1.5, mat('oak_planks', '#a88a64'));
  // A landing the width of the boathouse in front of it.
  const landX = bx * 8 + sgn * 5;
  box(landX - 1, -0.3, dz - 4, landX + 1, 0, dz + 4, mat('oak_planks', '#a88a64'));
  for (let x = d0 + 2; x < d1; x += 4) for (const side of [-1.35, 1.35]) m.block([r2(x), -4.5, r2(dz + side)], [0.25, 4.2, 0.25], 'solid', { material: 'dark_wood' });
  m.tile('room', bx, oy + 1, 0, 0, {});
  m.tile('platform_rail', bx, oy + 1, 1);
  paint(bx, oy + 1, 0, { floor: mat('oak_planks', '#a88a64'), walls: mat('pbr_siding', '#c8b49a'), underside: mat('oak_planks', '#a88a64'), trim: mat('pbr_plaster_white', '#fbf8f0') });
  paint(bx, oy + 1, 1, { floor: mat('oak_planks', '#b88a5a') });
  edge(bx, oy + 1, 0, lake, 'wide');
  edge(bx, oy + 1, 0, back, 'door');
  edge(bx, oy + 1, 0, 'N', 'window');
  edge(bx, oy + 1, 0, 'S', 'windows');
  // Piles under the boathouse's corners and a ladder up to the sundeck.
  for (const [ddx, ddz] of [[-3.9, -3.9], [3.9, -3.9], [-3.9, 3.9], [3.9, 3.9]] as const) m.block([bx * 8 + ddx, -4.5, dz + ddz], [0.35, 4.5, 0.35], 'solid', { material: 'dark_wood' });
  m.add({ kind: 'ladder', position: [r2(bx * 8 + sgn * 4.1), 0, dz + 2.6], yaw: lake === 'E' ? -P : P, height: 4.2, width: 0.9, name: 'Sundeck ladder' });
  info.dock = [r2((dockFrom + dockTo) / 2), 0, dz];
  info.boathouse = at(bx, oy + 1, 0);
  HOUSES.push(info);
}

/** The cell column for a house so its deck stands 10 m back from the shore. */
function houseX(oy: number, lake: 'E' | 'W'): number {
  const zs = [oy * 8 - 4, oy * 8 + 4, oy * 8 + 12, oy * 8 + 20, oy * 8 + 28];
  if (lake === 'E') {
    const s = Math.min(...zs.map(shoreW));
    return Math.floor((s - 14 - 8) / 8);
  }
  const s = Math.max(...zs.map(shoreE));
  return Math.ceil((s + 14 + 8) / 8);
}
house('W1', houseX(-11, 'E'), -11, 'E', '#e8dcc4', '#4a4e56');
house('W2', houseX(-2, 'E'), -2, 'E', '#9fb8c8', '#3e4a52');
house('W3', houseX(9, 'E'), 9, 'E', '#c8d4b0', '#5a4c44');
house('E1', houseX(-11, 'W'), -11, 'W', '#f0e6d2', '#3e4a52');
house('E2', houseX(1, 'W'), 1, 'W', '#d8b89a', '#4a4e56');
house('E3', houseX(9, 'W'), 9, 'W', '#b8c8d8', '#5a4c44');

// ---------------------------------------------------------------- the marina (east shore, z -24..+8)

// The Waterfront: restaurant and bar in a big room, the kitchen behind, the ship store beside it,
// a deck on the shore below and a rooftop deck above.
const RX = Math.ceil((shoreE(-12) + 6) / 8) + 1; // the restaurant's west column
const RY = -2;
m.tile('room_large', RX, RY, 0, 0, { ceiling: 'roof', layout: 'empty' });
paint(RX, RY, 0, { floor: mat('pbr_walnut'), walls: mat('pbr_siding', '#d8c8a8'), underside: mat('dark_wood'), trim: mat('pbr_plaster_white', '#fbf8f0'), solids: mat('pbr_walnut') });
edge(RX, RY, 0, 'W', 'window');
edge(RX, RY + 1, 0, 'W', 'wide');
edge(RX, RY, 0, 'S', 'window');
edge(RX + 1, RY, 0, 'S', 'door');
edge(RX + 1, RY, 0, 'E', 'window');
edge(RX + 1, RY + 1, 0, 'E', 'door');
m.tile('room', RX + 2, RY + 1, 0, 0, ROOF); // kitchen
paint(RX + 2, RY + 1, 0, { floor: mat('white_tiles'), walls: mat('pbr_plaster_white', '#e8e4dc'), underside: mat('pbr_white_panel') });
edge(RX + 2, RY + 1, 0, 'E', 'door');
edge(RX + 2, RY + 1, 0, 'N', 'window');
edge(RX + 2, RY + 1, 0, 'S', 'wall');
for (const x of [RX, RX + 1]) {
  m.tile('room', x, RY + 2, 0, 0, ROOF); // ship store
  paint(x, RY + 2, 0, { floor: mat('pbr_terrazzo'), walls: mat('pbr_siding', '#a8c0c8'), underside: mat('pbr_white_panel') });
  edge(x, RY + 1, 0, 'N', x === RX ? 'door' : 'window');
}
edge(RX, RY + 2, 0, 'N', 'door');
edge(RX + 1, RY + 2, 0, 'N', 'window');
edge(RX, RY + 2, 0, 'W', 'window');
edge(RX + 1, RY + 2, 0, 'E', 'window');
edge(RX, RY + 2, 0, 'E', 'arch');
// The shore deck and the rooftop deck, with open stairs up the north side.
for (const y of [RY, RY + 1]) {
  m.tile('platform_rail', RX - 1, y, 0);
  paint(RX - 1, y, 0, { floor: mat('oak_planks', '#a88a64') });
  for (const x of [RX - 1, RX, RX + 1]) {
    m.tile('platform_rail', x, y, 1);
    paint(x, y, 1, { floor: mat('oak_planks', '#b88a5a') });
  }
}
m.tile('stairs_open', RX - 1, RY + 2, 0, 1);
m.block([(RX - 1) * 8, -0.3, (RY + 2) * 8 + 4.7], [5, 0.4, 1.4], 'solid', { material: 'pbr_concrete', tint: '#b8b4ac' });
m.edge(RX - 1, RY + 1, 1, 'N', 'open');
m.edge(RX - 1, RY + 1, 0, 'N', 'open');
pad((RX - 1) * 8 - 4, RY * 8 - 4, (RX + 2) * 8 + 4, (RY + 3) * 8 + 4, -0.15, 12, 'gravel');
const MARINA_X = shoreE(-10);
const PLANK = mat('oak_planks', '#a08060');
// The fuel dock: a pier out to a T head, pumps and cans at the end.
box(30, -0.3, -2, MARINA_X + 3, 0, 2, PLANK);
box(24, -0.3, -8, 30, 0, 8, PLANK);
for (let x = 32; x < MARINA_X; x += 5) for (const z of [-1.6, 1.6]) m.block([x, -4.5, z], [0.3, 4.2, 0.3], 'solid', { material: 'dark_wood' });
for (const z of [-7.5, 7.5]) for (const x of [24.5, 29.5]) m.block([x, -4.5, z], [0.3, 4.2, 0.3], 'solid', { material: 'dark_wood' });
// The slips: a pier along the shore with fingers out into the lake, and a gangway to the restaurant deck.
box(MARINA_X - 8, -0.3, -24, MARINA_X - 4, 0, -4, PLANK);
box(MARINA_X - 4, -0.3, -13.5, (RX - 1) * 8 - 4, 0, -10.5, PLANK);
for (const z of [-15, -8]) box(MARINA_X - 19, -0.3, z - 0.75, MARINA_X - 7, 0, z + 0.75, PLANK);
// The boardwalk out to the island, on piles across the east channel.
box(15, -0.3, -23.5, MARINA_X - 7, 0, -20.5, PLANK);
for (let x = 20; x < MARINA_X - 7; x += 4) for (const z of [-23.3, -20.7]) m.block([x, -4.5, z], [0.25, 4.2, 0.25], 'solid', { material: 'dark_wood' });

// ---------------------------------------------------------------- the long road bridge (z 43..53, deck 7 m up)

const BZ = 48;
const BX0 = -84;
const BX1 = 92;
const DECK = 7;
box(BX0, DECK - 0.6, BZ - 5, BX1, DECK, BZ + 5, mat('pbr_asphalt', '#55555a'));
box(BX0, DECK, BZ - 5, BX1, DECK + 1.05, BZ - 4.6, mat('pbr_concrete', '#c8c4bc'));
box(BX0, DECK, BZ + 4.6, BX1, DECK + 1.05, BZ + 5, mat('pbr_concrete', '#c8c4bc'));
box(BX0, DECK - 0.09, BZ - 0.1, BX1, DECK + 0.02, BZ + 0.1, mat('paint_matte', '#e8c040'));
// Piers in the water, and a girder under the deck between them.
for (let x = -56; x <= 64; x += 24) {
  m.block([x, -6, BZ], [2.4, DECK - 0.6 + 6, 8.4], 'solid', { material: 'pbr_concrete', tint: '#b0aca4' });
  m.block([x, DECK - 1.6, BZ], [3.4, 1, 10], 'solid', { material: 'pbr_concrete', tint: '#b0aca4' });
}
box(BX0, DECK - 1.4, BZ - 3.6, BX1, DECK - 0.6, BZ - 2.6, mat('pbr_steel', '#6a7076'));
box(BX0, DECK - 1.4, BZ + 2.6, BX1, DECK - 0.6, BZ + 3.6, mat('pbr_steel', '#6a7076'));
pad(-112, BZ - 6, BX0 + 4, BZ + 6, DECK - 0.03, 16, 'gravel');
pad(BX1 - 4, BZ - 6, 120, BZ + 6, DECK - 0.03, 16, 'gravel');

// ---------------------------------------------------------------- terrain

const T0 = -160;
const COLS = 161;
const SP = 2;
/** Shore roads (painted gravel), each a polyline. */
const ROADS: [number, number][][] = [
  [[-112, -156], [-116, -100], [-112, -40], [-108, 10], [-112, BZ], [-104, 100], [-92, 156]],
  [[118, -156], [120, -100], [112, -40], [108, 10], [116, BZ], [104, 100], [96, 156]],
];
const segDist = (x: number, z: number, a: [number, number], b: [number, number]) => {
  const vx = b[0] - a[0];
  const vz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t);
};
const roadDist = (x: number, z: number) => Math.min(...ROADS.flatMap((r) => r.slice(1).map((b, i) => segDist(x, z, r[i]!, b))));
// Driveways from each garage out to the road.
for (const h of HOUSES) {
  const roadX = h.lake === 'E' ? -112 : 114;
  pad(Math.min(h.drive[0], roadX), h.drive[2] - 2.5, Math.max(h.drive[0], roadX), h.drive[2] + 2.5, 3.85, 10, 'gravel');
}

const water: boolean[] = [];
for (let r = 0; r < COLS; r++) for (let c = 0; c < COLS; c++) water.push(isWater(T0 + c * SP, T0 + r * SP));
/** Chamfer distance (m) to the nearest vertex of the other kind (land to water and water to land). */
function distanceTo(target: boolean): number[] {
  const d: number[] = water.map((w) => (w === target ? 0 : 1e9));
  const D = SP;
  const DD = SP * Math.SQRT2;
  const idx = (c: number, r: number) => r * COLS + c;
  for (let r = 0; r < COLS; r++)
    for (let c = 0; c < COLS; c++) {
      let v = d[idx(c, r)]!;
      if (c > 0) v = Math.min(v, d[idx(c - 1, r)]! + D);
      if (r > 0) v = Math.min(v, d[idx(c, r - 1)]! + D);
      if (c > 0 && r > 0) v = Math.min(v, d[idx(c - 1, r - 1)]! + DD);
      if (c < COLS - 1 && r > 0) v = Math.min(v, d[idx(c + 1, r - 1)]! + DD);
      d[idx(c, r)] = v;
    }
  for (let r = COLS - 1; r >= 0; r--)
    for (let c = COLS - 1; c >= 0; c--) {
      let v = d[idx(c, r)]!;
      if (c < COLS - 1) v = Math.min(v, d[idx(c + 1, r)]! + D);
      if (r < COLS - 1) v = Math.min(v, d[idx(c, r + 1)]! + D);
      if (c < COLS - 1 && r < COLS - 1) v = Math.min(v, d[idx(c + 1, r + 1)]! + DD);
      if (c > 0 && r < COLS - 1) v = Math.min(v, d[idx(c - 1, r + 1)]! + DD);
      d[idx(c, r)] = v;
    }
  return d;
}
const toWater = distanceTo(true);
const toLand = distanceTo(false);
const noise = (x: number, z: number) => Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 + 0.4) + 0.5 * Math.sin((x + z) * 0.19) + 0.3 * Math.cos((x - 2 * z) * 0.13);
const rectDist = (p: Pad, x: number, z: number) => Math.hypot(Math.max(p.x0 - x, 0, x - p.x1), Math.max(p.z0 - z, 0, z - p.z1));
function padAt(x: number, z: number): { p: Pad; w: number } | null {
  let best: { p: Pad; w: number } | null = null;
  for (const p of pads) {
    const w = 1 - sm(0, p.blend, rectDist(p, x, z));
    if (w > 0 && (!best || w > best.w + 1e-9)) best = { p, w };
  }
  return best;
}
const heights: number[] = [];
for (let r = 0; r < COLS; r++)
  for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    const x = T0 + c * SP;
    const z = T0 + r * SP;
    let h: number;
    if (water[i]) h = WATER - 0.6 - Math.min(4.2, 0.3 * toLand[i]!);
    else {
      const d = toWater[i]!;
      h = WATER + 0.4 + 0.24 * Math.min(d, 30) + 0.07 * Math.max(0, d - 30) + noise(x, z) * sm(4, 18, d) * 1.1;
      const pp = padAt(x, z);
      if (pp) h += (pp.p.y - h) * pp.w;
    }
    heights.push(Math.round(h * 100));
  }
const t0: TerrainData = { origin: [T0, T0], spacing: SP, cols: COLS, rows: COLS, baseY: 0, heights, materials: [], boundary: true, foliage: [] };
const materials: number[] = [];
const foliage: number[] = [];
for (let r = 0; r < COLS - 1; r++)
  for (let c = 0; c < COLS - 1; c++) {
    const x = T0 + c * SP + 1;
    const z = T0 + r * SP + 1;
    const h = terrainHeightAt(t0, x, z) ?? 0;
    let g: TerrainMaterial;
    let f = 0;
    const pp = padAt(x, z);
    if (h < WATER - 0.05) g = 'mud';
    else if (h < WATER + 0.45) g = 'sand';
    else if (roadDist(x, z) < 3.5) g = 'gravel';
    else if (pp && pp.w > 0.85 && pp.p.ground) {
      g = pp.p.ground;
      f = g === 'grass' ? 2 : 0;
    } else {
      g = noise(x * 1.7, z * 1.7) > 1.1 ? 'moss' : noise(x * 2.3 + 40, z * 2.1) > 1.2 ? 'dirt' : 'grass';
      f = g === 'dirt' ? 1 : 3;
    }
    materials.push(TERRAIN_MATERIALS.indexOf(g));
    foliage.push(f);
  }
const ground = paintSlopes({ ...t0, materials, foliage }, 36, 'stone');
m.terrain(ground);
const gy = (x: number, z: number) => r2(terrainHeightAt(ground, x, z) ?? 0);
const on = (x: number, z: number): V3 => [x, gy(x, z), z];

// ---------------------------------------------------------------- the island: a fire ring, a rope-swing oak, a little beach in the cove

m.prop('campfire_stones', on(12, -26), 0).prop('log', on(14.5, -28), 0.6).prop('log', on(8.5, -23.5), 2.1);
m.prop('oak', on(-1, -32), 0.4, 1.3).prop('nt_willow', on(20, -40), 1.1, 1.1).prop('pine_tall', on(4, -21), 0, 1.1).prop('nt_pine_tall', on(19, -27), 0.7, 1);
m.prop('nt_boulder_moss', on(-4, -39), 0.3, 0.9).prop('rock_large', on(22, -31), 1.2, 0.8);

// ---------------------------------------------------------------- vehicles: jet skis, bass boats, a pontoon; cars on the roads

const ON_WATER = WATER + 0.15;
for (const h of HOUSES) {
  const s = h.lake === 'E' ? 1 : -1;
  m.mount('hover_bike', [r2(h.boathouse[0] - s * 8), ON_WATER, h.dock[2] + 4], h.lake === 'E' ? P : -P);
  m.mount('speeder', [r2(h.boathouse[0] + s * 9), ON_WATER, h.boathouse[2] - 6], h.lake === 'E' ? P : -P);
}
for (const z of [-18.5, -11.5]) m.mount('hover_bike', [r2(MARINA_X - 13), ON_WATER, z], -P);
m.mount('hauler', [34, ON_WATER, -27], -P);
m.mount('speeder', [8, ON_WATER, -50], 0); // in the island's cove
m.mount('hover_bike', [-48, ON_WATER, -40], P); // in the west cove
m.mount('gun_jeep', [-112, gy(-112, -60), -60], 0, westTeam);
m.mount('gun_jeep', [112, gy(112, -60), -60], 0, eastTeam);
m.mount('buggy', [-108, gy(-108, 80), 80], PI);
m.mount('buggy', [108, gy(108, 80), 80], PI);

// ---------------------------------------------------------------- spawns

const W = HOUSES.filter((h) => h.lake === 'E');
const E = HOUSES.filter((h) => h.lake === 'W');
const facing = (x: number, z: number, tx: number, tz: number) => r2(Math.atan2(tx - x, tz - z));
// The first spawn (the one reachability is checked from) out on the bridge, in the middle of everything.
m.spawn([14, DECK, BZ], P);
for (const [x, z] of [[-124, -120], [-130, -96], [-124, -70], [-128, -40], [-124, -14], [-130, 12], [-124, 30], [-130, 66], [-120, 90], [-128, 116], [-136, -10], [-136, 60]] as const) m.spawn(on(x, z), facing(x, z, 0, z), westTeam);
for (const [x, z] of [[128, -120], [134, -96], [128, -70], [132, -40], [128, -14], [134, 12], [128, 30], [134, 66], [124, 90], [132, 116], [140, -10], [140, 60]] as const) m.spawn(on(x, z), facing(x, z, 0, z), eastTeam);
// Everyone (deathmatch): the houses, the decks, the marina, the island and the shores.
for (const h of HOUSES) {
  m.spawn([h.living[0], 4, h.living[2] + 2], h.lake === 'E' ? P : -P);
  m.spawn([h.walkout[0], 0, h.walkout[2]], h.lake === 'E' ? P : -P);
  m.spawn([h.upstairs[0], 8, h.upstairs[2] + 2], h.lake === 'E' ? -P : P);
}
for (const [x, z] of [[2, -36], [16, -30], [-140, -128], [142, -128], [-60, 130], [70, 130], [100, -40], [92, -24]] as const) m.spawn(on(x, z), facing(x, z, 0, 0));

// ---------------------------------------------------------------- objectives

const W1 = HOUSES.find((h) => h.name === 'W1')!;
const E1 = HOUSES.find((h) => h.name === 'E1')!;
m.flag(westTeam, [W1.living[0], 4, W1.living[2] - 2], P);
m.flag(eastTeam, [E1.living[0], 4, E1.living[2] - 2], -P);
m.hill(on(10, -30), 7); // the island
m.hill([27, 0, 0], 5); // the fuel dock
m.hill([4, DECK, BZ], 6); // mid-bridge

// ---------------------------------------------------------------- pickups

for (const h of HOUSES) {
  m.pickup('health_small', [h.walkout[0], 0, h.walkout[2] + 8]);
  m.pickup('ammo', [h.deck[0], 4, h.deck[2]]);
}
m.pickup('weapon_sniper', [W[1]!.upstairs[0], 8, W[1]!.upstairs[2] - 4], 30).pickup('weapon_sniper', [E[1]!.upstairs[0], 8, E[1]!.upstairs[2] - 4], 30);
m.pickup('ammo_sniper', [W[2]!.upstairs[0], 8, W[2]!.upstairs[2] - 4]).pickup('ammo_sniper', [E[2]!.upstairs[0], 8, E[2]!.upstairs[2] - 4]);
m.pickup('weapon_rockets', on(4, -31), 60); // the island, by the cove
m.pickup('powerup_damage', [4, DECK, BZ - 2.5], 90);
m.pickup('weapon_railgun', [27, 0, 6], 45); // the fuel dock
m.pickup('armor_large', [(RX + 0.5) * 8, 4, (RY + 0.5) * 8]); // the rooftop deck
m.pickup('weapon_lmg', [(RX + 0.5) * 8, 0, RY * 8 - 1]);
m.pickup('weapon_auto_shotgun', [(RX + 0.5) * 8, 0, (RY + 2) * 8]);
m.pickup('health_large', [(RX + 2) * 8, 0, (RY + 1) * 8]);
m.pickup('weapon_rifle', [W1.living[0], 4, W1.living[2] + 2]).pickup('weapon_rifle', [E1.living[0], 4, E1.living[2] + 2]);
m.pickup('weapon_shotgun', [W[1]!.walkout[0] + 8, 0, W[1]!.walkout[2] - 8]).pickup('weapon_shotgun', [E[1]!.walkout[0] - 8, 0, E[1]!.walkout[2] - 8]);
m.pickup('weapon_marksman', [W[2]!.living[0], 4, W[2]!.living[2]]).pickup('weapon_burst_rifle', [E[2]!.living[0], 4, E[2]!.living[2]]);
m.pickup('weapon_smg', on(-120, -90)).pickup('weapon_smg', on(124, -90)).pickup('weapon_machine_pistol', on(-118, 40)).pickup('weapon_machine_pistol', on(122, 40));
m.pickup('grenades', [BX0 + 20, DECK, BZ + 2]).pickup('grenades', [BX1 - 20, DECK, BZ - 2]).pickup('ammo_rifle', on(-104, 0)).pickup('ammo_rifle', on(106, 0));
m.pickup('armor_small', [W[0]!.boathouse[0], 4, W[0]!.boathouse[2]]).pickup('armor_small', [E[0]!.boathouse[0], 4, E[0]!.boathouse[2]]);
m.pickup('armor_small', [W[2]!.boathouse[0], 4, W[2]!.boathouse[2]]).pickup('armor_small', [E[2]!.boathouse[0], 4, E[2]!.boathouse[2]]);
m.pickup('health_large', on(-56, -56)).pickup('health_small', on(4, -26)).pickup('ammo_shells', on(-138, -118)).pickup('ammo_shells', on(140, -118));
m.pickup('weapon_launcher', [W[1]!.drive[0], 4, W[1]!.drive[2]], 30).pickup('ammo_explosive', [E[1]!.drive[0], 4, E[1]!.drive[2]]);

// ---------------------------------------------------------------- props: marina dressing, boathouses, the bridge's lamps

for (const z of [-5.5, 5.5]) m.prop('sv_propane', [25, 0, z], 0).prop('sv_gas_can', [26.2, 0, z + 0.6], 0.4);
m.breakable('gas', [28.8, 0, -6.5]);
m.breakable('gas', [28.8, 0, 6.8]);
m.prop('warning_sign', [29.4, 0, -3], P).prop('barrel', [24.8, 0, 7.4], 0).prop('barrel', [24.8, 0, -7.4], 0.4);
m.prop('lantern_post', [r2(MARINA_X - 4.5), 0, -23], 0).prop('lantern_post', [r2(MARINA_X - 4.5), 0, -5], 0);
m.prop('bucket', [r2(MARINA_X - 4.6), 0, -16.5], 0, 1, false);
// Waterfront: tables and parasols on the shore deck and the rooftop.
for (const [x, z, y] of [[(RX - 1) * 8 - 1, RY * 8 - 1, 0], [(RX - 1) * 8 - 1, RY * 8 + 8, 0], [RX * 8, RY * 8 - 1, 4], [(RX + 1) * 8 + 1, RY * 8 + 9, 4], [(RX - 1) * 8, RY * 8 + 9, 4]] as const) {
  m.prop('table_round', [x, y, z], 0).prop('parasol', [x, y, z], 0.3, 1, false);
  m.prop('chair', [x + 1.1, y, z], -P).prop('chair', [x - 1.1, y, z], P);
}
for (let x = BX0 + 12; x < BX1; x += 24) {
  m.prop('lightpost', [x, DECK, BZ - 4.2], 0, 1);
  m.prop('lightpost', [x + 12, DECK, BZ + 4.2], PI, 1);
}
for (const h of HOUSES) {
  const s = h.lake === 'E' ? 1 : -1;
  m.prop('rowboat', [h.boathouse[0] - s * 1.5, 0, h.boathouse[2] + 1.8], P, 1, false);
  m.prop('hm_chair_wood', [h.boathouse[0], 4, h.boathouse[2] - 2], 0.4).prop('hm_chair_wood', [h.boathouse[0] + 1.2, 4, h.boathouse[2] - 2.4], -0.3);
  m.prop('lantern_post', [r2(h.boathouse[0] - s * 5), 0, h.boathouse[2] - 3.4], 0);
  m.prop('hm_bin_large', [h.drive[0], 4, h.drive[2] + 3.2], 0);
}

// ---------------------------------------------------------------- the woods: loblolly pines and hardwoods, bushes for cover

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const KEEP = new Set(['spawn', 'pickup', 'flag', 'hill', 'mount', 'ladder']);
const BOUND = 154;
function clear(x: number, z: number, r: number): boolean {
  if (Math.abs(x) > BOUND - 2 || Math.abs(z) > BOUND - 2) return false;
  for (const e of m.doc.entities) {
    if (e.kind === 'water' || e.kind === 'light') continue;
    if (e.kind === 'block') {
      if (Math.abs(e.position[0] - x) < e.size[0] / 2 + r && Math.abs(e.position[2] - z) < e.size[2] / 2 + r) return false;
      continue;
    }
    const d = Math.hypot(e.position[0] - x, e.position[2] - z);
    if (e.kind === 'prop' || e.kind === 'destructible') {
      if (d < r + 1) return false;
    } else if (KEEP.has(e.kind) && d < r + ('radius' in e ? (e.radius as number) : 2) + 1.5) return false;
  }
  for (const t of m.doc.classicStructure.tiles) if (Math.abs(t.x * 8 - x) < 4 + r && Math.abs(t.y * 8 - z) < 4 + r) return false;
  return true;
}
function plant(model: string, x: number, z: number, r: number, scale: number, solid = true): boolean {
  const h = terrainHeightAt(ground, x, z);
  if (h === null || h < WATER + 0.3) return false;
  if (roadDist(x, z) < 5) return false;
  const pp = padAt(x, z);
  if (pp && pp.w > 0.3) return false;
  if (!clear(x, z, r)) return false;
  m.prop(model, [r2(x), r2(h), r2(z)], r2(rnd() * 6.28), r2(scale), solid);
  (m as unknown as { flush(): void }).flush();
  return true;
}
(m as unknown as { flush(): void }).flush();
// A fire pit and Adirondack chairs on each lawn by the shore.
for (const h of HOUSES) {
  const s = h.lake === 'E' ? 1 : -1;
  const fx = h.walkout[0] + s * 13;
  const fz = h.walkout[2] - 6;
  if (!clear(fx, fz, 3)) continue;
  m.prop('campfire_stones', on(fx, fz), 0);
  for (const a of [0.6, 2.2, 3.9]) m.prop('hm_chair_wood', on(r2(fx + Math.cos(a) * 2.1), r2(fz + Math.sin(a) * 2.1)), r2(-a - P));
}
(m as unknown as { flush(): void }).flush();
const PINES = ['pine_tall', 'nt_pine_tall', 'pine', 'pine_round'];
const HARDWOOD = ['oak', 'nt_common_tree', 'oak_dark', 'nt_birch', 'tree_round'];
let trees = 0;
for (let z = -150; z <= 150; z += 10)
  for (let x = -150; x <= 150; x += 10) {
    const jx = x + (rnd() - 0.5) * 6;
    const jz = z + (rnd() - 0.5) * 6;
    const n = noise(jx * 0.6, jz * 0.6);
    if (n < -0.9) continue; // clearings
    const kinds = n > 0.2 ? PINES : HARDWOOD;
    if (plant(kinds[Math.floor(rnd() * kinds.length)]!, jx, jz, 1.8, 0.9 + rnd() * 0.5)) trees++;
  }
let bushes = 0;
const SHRUBS = ['nt_bush_leafy', 'bush_large', 'nt_bush_berries'];
for (let i = 0; i < 900 && bushes < 120; i++) {
  const x = (rnd() - 0.5) * 300;
  const z = (rnd() - 0.5) * 300;
  const h = terrainHeightAt(ground, x, z);
  if (h === null || h > 9) continue;
  if (plant(SHRUBS[i % SHRUBS.length]!, x, z, 0.8, 1 + rnd() * 0.4, false)) bushes++;
}
console.log(`norman_shores: ${trees} trees, ${bushes} bushes`);

// ---------------------------------------------------------------- interiors (after spawns and pickups, which they keep clear of)

for (const h of HOUSES) for (const c of h.cells) m.dress([c.x, c.y, c.z], c.type, { density: 'sparse', max: 10 });
m.dress([RX, RY, 0], 'bar', { density: 'full', max: 40 });
m.dress([RX + 2, RY + 1, 0], 'kitchen', { density: 'normal' });
m.dress({ x0: RX, y0: RY + 2, x1: RX + 1, y1: RY + 2 }, 'shop', { density: 'normal', max: 24 });

// ---------------------------------------------------------------- lights: warm rooms, dock lanterns, bridge lamps

for (const h of HOUSES) for (const c of h.cells) m.light(at(c.x, c.y, c.z, 0, 0, 3.45), { color: '#ffe2b8', intensity: 0.9, range: 9 });
for (const [dx, dy] of [[0, 0], [8, 0], [0, 8], [8, 8]] as const) m.light(at(RX, RY, 0, dx, dy, 3.45), { color: '#ffd090', intensity: 1, range: 9 });
m.light(at(RX + 2, RY + 1, 0, 0, 0, 3.45), { color: '#f4f8ff', intensity: 1, range: 9 });
for (const x of [RX, RX + 1]) m.light(at(x, RY + 2, 0, 0, 0, 3.45), { color: '#f4f8ff', intensity: 1, range: 9 });
for (const h of HOUSES) {
  const s = h.lake === 'E' ? 1 : -1;
  m.light([r2(h.boathouse[0] - s * 5), 2.6, h.boathouse[2] - 3.4], { fixture: 'none', color: '#ffc27a', intensity: 1, range: 10 });
}
for (let x = BX0 + 12; x < BX1; x += 24) {
  m.light([x, DECK + 5.2, BZ - 3.6], { fixture: 'none', color: '#ffcf8a', intensity: 1, range: 14 });
  m.light([x + 12, DECK + 5.2, BZ + 3.6], { fixture: 'none', color: '#ffcf8a', intensity: 1, range: 14 });
}
m.light([r2(MARINA_X - 4.5), 3, -23], { fixture: 'none', color: '#ffc27a', intensity: 1.1, range: 12 });
m.light([r2(MARINA_X - 4.5), 3, -5], { fixture: 'none', color: '#ffc27a', intensity: 1.1, range: 12 });
m.light([27, 2.5, 0], { fixture: 'none', color: '#ffe8b0', intensity: 1.2, range: 12 });
m.light(on(12, -26).map((v, i) => (i === 1 ? v + 1 : v)) as V3, { fixture: 'none', color: '#ff8a3a', intensity: 1.4, range: 10 });

// ---------------------------------------------------------------- the edges: woods on three sides, the open lake to the south

m.bounds('invisible', 0, { min: [-BOUND, -BOUND], max: [BOUND, BOUND] }, 40);
m.border('forest', { south: 'water' });
m.meta({
  description:
    'A look-alike of the lake houses on Lake Norman, North Carolina, on a summer evening. Six big houses step down the wooded slopes of both shores: walkout basements at the water, main floors with screened porches and decks, bedrooms and balconies above, garages on the shore roads, and big windows whose glass shoots out. Every house has a dock and a boathouse with a sundeck; jet skis, bass boats and a pontoon ride the lake. The east shore has the marina: a fuel dock, slips, a ship store and the Waterfront restaurant and bar with its rooftop deck. A long road bridge crosses the lake to the north; a wooded island with a cove sits in the south basin. Team Deathmatch pits shore against shore; flags in the two southern houses across the basin; hills on the island, the fuel dock and the bridge.',
  modes: ['core.tdm', 'core.ctf', 'core.koth', 'core.deathmatch'],
  players: [12, 24],
});
await m.save();
