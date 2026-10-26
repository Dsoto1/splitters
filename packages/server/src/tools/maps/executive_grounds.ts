/**
 * Executive Grounds: a look-alike of the White House and its grounds, for
 * 12–24 players. Plan after the published floor plans and the West Wing tour
 * descriptions (Oval Office at the south-east of the West Wing on the Rose
 * Garden, the Cabinet Room beside it, the press briefing room over the old
 * pool between the Residence and the West Wing, the Situation Room below),
 * built at about 1:1 on the kit's 8 m grid; no images used.
 *
 *   - The mansion (56 × 32 m, two storeys and a roof): the North Portico
 *     (columns and pediment over the north door), the Entrance Hall and the
 *     Cross Hall; the State Dining Room, Red, Blue and Green Rooms, the
 *     library and the East Room on the State floor; the Residence upstairs
 *     (bedrooms, the Yellow Oval Room, the family dining room) off the
 *     centre hall; the South Portico, a semicircle of columns two storeys
 *     high with the balcony off the Yellow Oval Room; stairs to the roof.
 *   - The West Colonnade along the Rose Garden to the West Wing: the Oval
 *     Office (a 16 m room with rounded corners), the Cabinet Room, the
 *     Roosevelt Room, staff offices, the press briefing room, and the
 *     Situation Room complex in the basement (two stairs down).
 *   - The East Colonnade and East Wing (theatre, visitors' lobby, offices).
 *   - The South Lawn: fountain, two helipads with a dropship and a gunship
 *     parked, big trees, the south drive; the North Lawn with its fountain and
 *     drive; fences with gates and guard booths all round.
 *   - The ornate executive office building across West Executive Avenue:
 *     three storeys of offices round a courtyard under a stepped mansard
 *     roof, stacked columns on every face, a sniper's roof.
 *
 * Teams: Intruders (the first team: they attack in Bomb and rescue in
 * Hostage Rescue) start on Pennsylvania Avenue and the Ellipse; Security
 * starts in the mansion and the wings. Bomb sites: the Oval Office (A) and
 * the Situation Room (B). Hostages: four in the Residence.
 *
 * Grid x east, y north (one cell = 8 m, world z = y × 8); level z0 is the
 * State floor, z-1 the West Wing basement.
 */
import type { EdgeStyle, RoomOptions, RoomType, Rotation, Side, TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('executive_grounds', 'Executive Grounds');
m.theme('manor');
m.factions([
  { id: 'intruders', name: 'Intruders', color: '#d8263a', relations: {} },
  { id: 'security', name: 'Security', color: '#2a5ad8', relations: {} },
]);
m.backdrop('cloudy', 'city', 'grass', 0.35);
m.border('skyline');
m.teams([12, 12]);
const [INTRUDERS, SECURITY] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Mat = { material: string; tint?: string };
const P = Math.PI / 2;
const PI = Math.PI;
const r2 = (n: number) => +n.toFixed(2);
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];

// ---------------------------------------------------------------- looks

const WHITE: Mat = { material: 'paint_matte', tint: '#f6f4ee' };
const MARBLE: Mat = { material: 'marble', tint: '#f4f2ec' };
const GRANITE: Mat = { material: 'pbr_concrete', tint: '#b8b6b0' };
const SLATE: Mat = { material: 'pbr_roof', tint: '#5a6068' };
const BOOTH: Mat = { material: 'paint_gloss', tint: '#eeeeea' };
const DARK_GLASS: Mat = { material: 'paint_gloss', tint: '#1c2228' };
const PAD: Mat = { material: 'pbr_concrete', tint: '#9a9890' };
const PAINT_W: Mat = { material: 'paint_matte', tint: '#f0f0e8' };

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const base: TileSurfaces = { floor: mat('pbr_floorboards'), walls: mat('pbr_plaster_white', '#f6f4ee'), solids: mat('marble', '#ece8de'), underside: mat('pbr_plaster_white', '#f8f6f0'), trim: mat('brass') };
const ROOMS: Record<string, TileSurfaces> = {
  hall: { ...base, floor: mat('pbr_checker', '#ece6da') },
  red: { ...base, floor: mat('pbr_carpet', '#8a2a2a') },
  blue: { ...base, floor: mat('pbr_carpet', '#2a4a8a') },
  green: { ...base, floor: mat('pbr_carpet', '#3a6a4a') },
  gold: { ...base, floor: mat('pbr_carpet', '#b8964a') },
  wood: base,
  oval: { ...base, floor: mat('pbr_carpet', '#2c3a6a'), walls: mat('pbr_plaster_white', '#f2ead2') },
  office: { ...base, floor: mat('pbr_carpet', '#5a4a3a'), walls: mat('pbr_plaster_white', '#ece4d4') },
  press: { ...base, floor: mat('pbr_carpet', '#2a3a5a'), walls: mat('pbr_walnut', '#6a4a30') },
  sit: { floor: mat('pbr_carpet', '#2a2a30'), walls: mat('pbr_walnut', '#4a3424'), solids: mat('pbr_steel'), underside: mat('pbr_white_panel'), trim: mat('pbr_steel') },
  watch: { floor: mat('pbr_tread_plate'), walls: mat('pbr_white_panel', '#c8ccd2'), solids: mat('pbr_steel'), underside: mat('pbr_white_panel'), trim: mat('pbr_steel') },
  stair: { ...base, floor: mat('pbr_terrazzo', '#e0dacc') },
  eeob: { floor: mat('pbr_checker', '#d8d0c0'), walls: mat('pbr_concrete', '#c4c0b6'), solids: mat('marble', '#d8d4ca'), underside: mat('pbr_plaster_white'), trim: mat('brass') },
  colonnade: { ...base, floor: mat('pbr_flagstone', '#c8c0b0') },
};
const YARD: Record<string, TileSurfaces> = {
  grass: { floor: mat('pbr_grass'), walls: mat('pbr_plaster_white', '#f6f4ee') },
  drive: { floor: mat('pbr_asphalt', '#9a9a98'), walls: mat('pbr_plaster_white', '#f6f4ee') },
  street: { floor: mat('pbr_asphalt'), walls: mat('pbr_concrete') },
  paving: { floor: mat('pbr_hex_paving', '#c8bca8'), walls: mat('pbr_concrete') },
  gravel: { floor: mat('pbr_gravel'), walls: mat('pbr_plaster_white') },
};

// ---------------------------------------------------------------- free blocks

let nBlocks = 0;
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mt: Mat, yaw = 0): void {
  if (x1 - x0 < 0.04 || z1 - z0 < 0.04 || y1 - y0 < 0.02) return;
  if (y1 - y0 < 0.101) y0 = y1 - 0.101;
  if (x1 - x0 < 0.201) [x0, x1] = [(x0 + x1) / 2 - 0.101, (x0 + x1) / 2 + 0.101];
  if (z1 - z0 < 0.201) [z0, z1] = [(z0 + z1) / 2 - 0.101, (z0 + z1) / 2 + 0.101];
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  if (w > 64 || d > 64 || h > 32) {
    const nx = Math.ceil(w / 64);
    const nz = Math.ceil(d / 64);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) box(x0 + (w * i) / nx, y0, z0 + (d * j) / nz, x0 + (w * (i + 1)) / nx, y1, z0 + (d * (j + 1)) / nz, mt, yaw);
    return;
  }
  nBlocks++;
  m.block([r2((x0 + x1) / 2), r2(y0), r2((z0 + z1) / 2)], [r2(w), r2(h), r2(d)], 'solid', { ...mt, yaw: r2(yaw) });
}
function turned(cx: number, cz: number, w: number, d: number, y0: number, y1: number, mt: Mat, yaw: number): void {
  nBlocks++;
  m.block([r2(cx), r2(y0), r2(cz)], [r2(w), r2(y1 - y0), r2(d)], 'solid', { ...mt, yaw: r2(yaw) });
}
/** Part of a ring round (cx, cz) from angle a0 to a1 (x = cos, z = sin), `n` turned blocks. */
function arc(cx: number, cz: number, r: number, a0: number, a1: number, y0: number, y1: number, thick: number, n: number, mt: Mat): void {
  const w = (((a1 - a0) * (r + thick / 2)) / n) * 1.06;
  for (let i = 0; i < n; i++) {
    const a = a0 + ((i + 0.5) * (a1 - a0)) / n;
    turned(cx + r * Math.cos(a), cz + r * Math.sin(a), w, thick, y0, y1, mt, Math.atan2(-Math.cos(a), -Math.sin(a)));
  }
}
/** A half disc south of (cx, cz) of radius r, as strips 1 m deep. */
function halfDisc(cx: number, cz: number, r: number, y0: number, y1: number, mt: Mat): void {
  for (let d = 0; d < r - 0.5; d += 1) {
    const w = Math.sqrt(r * r - (d + 0.5) * (d + 0.5));
    box(cx - w, y0, cz - d - 1, cx + w, y1, cz - d, mt);
  }
}
function pediment(a0: number, a1: number, c0: number, c1: number, y: number, h: number, steps: number, mt: Mat): void {
  for (let i = 0; i < steps; i++) {
    const inset = ((a1 - a0) / 2) * (i / steps);
    box(a0 + inset, y + (i * h) / steps, c0, a1 - inset, y + ((i + 1) * h) / steps, c1, mt);
  }
}

// ---------------------------------------------------------------- tiles

interface CellInfo {
  kind: string;
  group: string;
  tile: string;
}
const cells = new Map<string, CellInfo>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
const FOOT: Record<string, [number, number, number]> = { room_large: [2, 2, 1], stairwell: [1, 1, 2] };
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
function place(kind: string, x: number, y: number, z: number, group: string, surf: TileSurfaces, o: { rot?: Rotation; opts?: RoomOptions } = {}): void {
  m.tile(kind, x, y, z, o.rot ?? 0, o.opts);
  const [w, d, h] = FOOT[kind] ?? [1, 1, 1];
  for (let dz = 0; dz < h; dz++)
    for (let dy = 0; dy < d; dy++)
      for (let dx = 0; dx < w; dx++) {
        const k = key(x + dx, y + dy, z + dz);
        if (cells.has(k)) throw new Error(`cell ${k} placed twice`);
        cells.set(k, { kind, group, tile: key(x, y, z) });
      }
  paint(x, y, z, surf);
}
const sideId = (x: number, y: number, z: number, side: Side): string => (side === 'N' ? `${x},${y},${z}:N` : side === 'E' ? `${x},${y},${z}:E` : side === 'S' ? `${x},${y - 1},${z}:N` : `${x - 1},${y},${z}:E`);
const links = new Map<string, [number, number, number, Side, EdgeStyle]>();
const link = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => links.set(sideId(x, y, z, side), [x, y, z, side, style]);
const DIRS: Record<Side, [number, number]> = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
/** Rooms of one group on one level. */
function rooms(x0: number, y0: number, x1: number, y1: number, z: number, group: string, surf: TileSurfaces, opts: RoomOptions): void {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) place('room', x, y, z, group, surf, { opts });
}
const ROOF: RoomOptions = { ceiling: 'roof', layout: 'empty' };
const EMPTY: RoomOptions = { layout: 'empty' };

// ================================================================ THE MANSION (cells x -3..3, y 0..3; z0 State floor, z1 Residence)

// State floor.
rooms(-3, 0, -3, 3, 0, 'dining', ROOMS.wood!, EMPTY);
rooms(3, 0, 3, 3, 0, 'eastroom', ROOMS.wood!, EMPTY);
rooms(-2, 0, -2, 1, 0, 'library', ROOMS.wood!, EMPTY);
rooms(-1, 0, -1, 1, 0, 'red', ROOMS.red!, EMPTY);
rooms(0, 0, 0, 1, 0, 'blue', ROOMS.blue!, EMPTY);
rooms(1, 0, 1, 1, 0, 'green', ROOMS.green!, EMPTY);
rooms(2, 0, 2, 1, 0, 'vermeil', ROOMS.gold!, EMPTY);
rooms(-2, 2, 2, 2, 0, 'cross', ROOMS.hall!, EMPTY);
rooms(-1, 3, 1, 3, 0, 'entry', ROOMS.hall!, EMPTY);
place('stairwell', -2, 3, 0, 'grand', ROOMS.stair!, { rot: 3 });
rooms(2, 3, 2, 3, 0, 'usher', ROOMS.office!, EMPTY);
// The Residence.
rooms(-3, 2, 3, 2, 1, 'hall1', ROOMS.wood!, ROOF);
rooms(-3, 0, -3, 1, 1, 'master', ROOMS.wood!, ROOF);
rooms(-2, 0, -2, 1, 1, 'dress', ROOMS.wood!, ROOF);
rooms(-1, 0, -1, 1, 1, 'famdining', ROOMS.wood!, ROOF);
rooms(0, 0, 0, 1, 1, 'yellow', ROOMS.gold!, ROOF);
rooms(1, 0, 1, 1, 1, 'sitting', ROOMS.green!, ROOF);
rooms(2, 0, 2, 1, 1, 'guest1', ROOMS.wood!, ROOF);
rooms(3, 0, 3, 1, 1, 'guest2', ROOMS.wood!, ROOF);
rooms(-3, 3, -3, 3, 1, 'bed3', ROOMS.wood!, ROOF);
rooms(-1, 3, -1, 3, 1, 'lincoln', ROOMS.red!, ROOF);
rooms(0, 3, 0, 3, 1, 'treaty', ROOMS.green!, ROOF);
rooms(1, 3, 1, 3, 1, 'queens', ROOMS.blue!, ROOF);
rooms(3, 3, 3, 3, 1, 'bed4', ROOMS.wood!, ROOF);
place('stairwell', 2, 3, 1, 'roofstair', ROOMS.stair!, { rot: 3 });

// State floor openings.
link(0, 3, 0, 'N', 'wide');
link(-1, 3, 0, 'N', 'window');
link(1, 3, 0, 'N', 'window');
for (const x of [-1, 0, 1]) link(x, 3, 0, 'S', 'arch');
link(2, 3, 0, 'W', 'door');
link(2, 3, 0, 'N', 'window');
link(2, 3, 0, 'E', 'door');
link(-2, 2, 0, 'W', 'door');
link(2, 2, 0, 'E', 'door');
for (const x of [-2, -1, 0, 1, 2]) link(x, 2, 0, 'S', 'door');
link(-3, 0, 0, 'E', 'door');
link(-2, 1, 0, 'E', 'door');
link(-1, 0, 0, 'E', 'door');
link(0, 0, 0, 'E', 'door');
link(1, 1, 0, 'E', 'door');
link(3, 0, 0, 'W', 'door');
for (let x = -3; x <= 3; x++) link(x, 0, 0, 'S', x === 0 ? 'door' : 'window');
for (let y = 0; y <= 3; y++) {
  link(-3, y, 0, 'W', y === 2 ? 'door' : 'window');
  link(3, y, 0, 'E', y === 1 ? 'door' : 'window');
}
link(-3, 3, 0, 'N', 'window');
link(3, 3, 0, 'N', 'window');
// Residence openings.
for (let x = -3; x <= 3; x++) {
  link(x, 2, 1, 'S', 'door');
  link(x, 0, 1, 'S', x === 0 ? 'door' : 'window');
  if (x !== -2 && x !== 2) link(x, 2, 1, 'N', 'door');
  if (x !== -2 && x !== 2) link(x, 3, 1, 'N', 'window');
}
link(2, 3, 2, 'S', 'door'); // out onto the roof
for (let y = 0; y <= 3; y++) {
  link(-3, y, 1, 'W', 'window');
  link(3, y, 1, 'E', 'window');
}

// ================================================================ THE WEST WING (cells x -10..-6, y -1..3) AND ITS BASEMENT

place('room_large', -7, -1, 0, 'oval', ROOMS.oval!, { opts: { layout: 'empty', ceiling: 'roof', corners: 'rounded' } });
rooms(-6, 1, -6, 2, 0, 'cabinet', ROOMS.office!, ROOF);
rooms(-6, 3, -6, 3, 0, 'roosevelt', ROOMS.office!, ROOF);
rooms(-7, 1, -7, 3, 0, 'wcorr', ROOMS.hall!, ROOF);
for (let y = -1; y <= 2; y++) rooms(-8, y, -8, y, 0, `staff${y}`, ROOMS.office!, ROOF);
place('room_large', -10, -1, 0, 'outer', ROOMS.office!, { opts: ROOF });
rooms(-9, 1, -9, 1, 0, 'press_sec', ROOMS.office!, ROOF);
place('room_large', -10, 2, 0, 'press', ROOMS.press!, { opts: ROOF });
place('stairwell', -10, 1, -1, 'sitstair', ROOMS.stair!, { rot: 2 });
place('stairwell', -8, 3, -1, 'sitstair2', ROOMS.stair!, { rot: 0 });
place('room_large', -9, 0, -1, 'sitroom', ROOMS.sit!, { opts: EMPTY });
rooms(-10, 0, -10, 0, -1, 'servers', ROOMS.watch!, EMPTY);
rooms(-9, 2, -8, 2, -1, 'watch', ROOMS.watch!, EMPTY);
rooms(-10, 2, -10, 3, -1, 'watch', ROOMS.watch!, EMPTY);
rooms(-9, 3, -9, 3, -1, 'watch', ROOMS.watch!, EMPTY);
// The colonnades and the East Wing.
rooms(-5, 2, -4, 2, 0, 'wcol', ROOMS.colonnade!, ROOF);
rooms(4, 1, 4, 1, 0, 'ecol', ROOMS.colonnade!, ROOF);
rooms(5, 0, 7, 0, 0, 'theater', ROOMS.press!, ROOF);
rooms(5, 1, 7, 1, 0, 'ewlobby', ROOMS.hall!, ROOF);
rooms(5, 2, 7, 2, 0, 'ewoffice', ROOMS.office!, ROOF);

// Oval Office: the Rose Garden door, the corridor, the Cabinet Room, a staff office, three south windows.
link(-6, 0, 0, 'E', 'door');
link(-7, 0, 0, 'N', 'door');
link(-6, 0, 0, 'N', 'door');
link(-7, -1, 0, 'S', 'windows');
link(-6, -1, 0, 'S', 'windows');
link(-7, -1, 0, 'W', 'door');
link(-6, -1, 0, 'E', 'window');
// Cabinet Room, Roosevelt Room, the corridor and its north door.
link(-6, 1, 0, 'E', 'windows');
link(-6, 2, 0, 'E', 'door');
link(-6, 2, 0, 'W', 'door');
link(-6, 3, 0, 'W', 'door');
link(-6, 3, 0, 'N', 'window');
link(-6, 3, 0, 'E', 'window');
link(-7, 3, 0, 'N', 'door');
for (let y = 1; y <= 2; y++) link(-8, y, 0, 'E', 'door');
link(-8, 0, 0, 'N', 'door');
link(-8, 0, 0, 'W', 'door');
link(-8, -1, 0, 'S', 'window');
link(-9, 0, 0, 'N', 'door');
link(-10, -1, 0, 'W', 'window');
link(-10, 0, 0, 'W', 'door');
link(-10, -1, 0, 'S', 'window');
link(-9, -1, 0, 'S', 'window');
link(-9, 1, 0, 'W', 'door'); // down to the Situation Room
link(-9, 1, 0, 'N', 'door');
link(-9, 1, 0, 'E', 'door');
link(-10, 2, 0, 'W', 'door'); // the press entrance off West Executive Avenue
link(-10, 3, 0, 'W', 'window');
link(-10, 3, 0, 'N', 'window');
link(-9, 3, 0, 'N', 'window');
link(-9, 2, 0, 'E', 'door');
link(-9, 3, 0, 'E', 'door'); // the second stair down
// Basement.
link(-9, 1, -1, 'W', 'door');
link(-9, 3, -1, 'E', 'door');
link(-10, 0, -1, 'E', 'door');
link(-9, 1, -1, 'N', 'door');
link(-8, 1, -1, 'N', 'door');
// Colonnades: arches open on the Rose Garden (south) and the north side; the East Wing.
link(-4, 2, 0, 'E', 'door');
for (const x of [-5, -4]) {
  link(x, 2, 0, 'S', 'arch');
  link(x, 2, 0, 'N', 'window');
}
link(4, 1, 0, 'E', 'door');
link(4, 1, 0, 'S', 'arch');
link(4, 1, 0, 'N', 'arch');
for (const x of [5, 7]) link(x, 1, 0, 'N', 'door');
link(6, 1, 0, 'S', 'door');
link(6, 2, 0, 'S', 'door');
link(7, 1, 0, 'E', 'wide');
link(6, 2, 0, 'N', 'door');
for (const x of [5, 7]) link(x, 2, 0, 'N', 'window');
for (const x of [5, 6, 7]) link(x, 0, 0, 'S', 'window');

// ================================================================ THE EXECUTIVE OFFICE BUILDING (ring x -16..-12, y -2..4, three storeys)

const EO = { x0: -16, x1: -12, y0: -2, y1: 4 };
// Stairs stand in the courtyard against the ranges (so each storey's ring of rooms runs unbroken), one under
// a guard post; the last flight up to the roof is in the south-west corner.
const STAIRS_EO: [number, number, number, Rotation][] = [
  [-15, -1, 0, 3], [-13, 3, 0, 1], [-13, -1, 1, 3], [-16, -2, 2, 1],
];
for (const [x, y, z, rot] of STAIRS_EO) place('stairwell', x, y, z, `eost${x}${y}${z}`, ROOMS.stair!, { rot });
place('room', -13, -1, 0, 'guardpost', ROOMS.eeob!, { opts: EMPTY });
const eoGroup = (x: number, y: number) => (y === EO.y0 ? 'S' : y === EO.y1 ? 'N' : x === EO.x0 ? 'W' : 'E');
for (let z = 0; z <= 2; z++)
  for (let x = EO.x0; x <= EO.x1; x++)
    for (let y = EO.y0; y <= EO.y1; y++) {
      if (x !== EO.x0 && x !== EO.x1 && y !== EO.y0 && y !== EO.y1) continue;
      if (cells.has(key(x, y, z))) continue;
      place('room', x, y, z, `eo${eoGroup(x, y)}${z}`, ROOMS.eeob!, { opts: { layout: 'empty', facade: 'plaster', ...(z === 2 ? { ceiling: 'roof' } : {}) } });
    }
for (let z = 0; z <= 2; z++) {
  // Corners: doors between the ranges (stairwells have their own).
  for (const [x, y, side] of [[-16, 3, 'N'], [-16, -1, 'S'], [-12, 3, 'N'], [-12, -1, 'S']] as const) {
    const [dx, dy] = DIRS[side];
    if (cells.get(key(x + dx, y + dy, z))?.kind === 'stairwell') continue;
    link(x, y, z, side, 'door');
  }
  // Outside: windows all round; inside: onto the courtyard.
  for (let x = EO.x0; x <= EO.x1; x++) {
    if (cells.get(key(x, EO.y1, z))?.kind !== 'stairwell') link(x, EO.y1, z, 'N', z === 0 && x === -14 ? 'door' : 'window');
    if (cells.get(key(x, EO.y0, z))?.kind !== 'stairwell') link(x, EO.y0, z, 'S', z === 0 && x === -14 ? 'door' : 'window');
  }
  for (let y = EO.y0; y <= EO.y1; y++) {
    if (cells.get(key(EO.x0, y, z))?.kind !== 'stairwell') link(EO.x0, y, z, 'W', z === 0 && y === 1 ? 'wide' : 'window');
    if (cells.get(key(EO.x1, y, z))?.kind !== 'stairwell') link(EO.x1, y, z, 'E', z === 0 && y === 1 ? 'wide' : 'window');
  }
  for (let x = EO.x0 + 1; x <= EO.x1 - 1; x++) {
    link(x, EO.y1, z, 'S', z === 0 && x === -14 ? 'door' : 'window');
    link(x, EO.y0, z, 'N', z === 0 && x === -14 ? 'door' : 'window');
  }
  for (let y = EO.y0 + 1; y <= EO.y1 - 1; y++) {
    link(EO.x0, y, z, 'E', z === 0 && y === 1 ? 'door' : 'window');
    link(EO.x1, y, z, 'W', z === 0 && y === 1 ? 'door' : 'window');
  }
}
// Stairwell doors (into the range beside them).
for (const z of [0, 1]) {
  link(-15, -2, z, 'N', 'door');
  link(-13, 4, z, 'S', 'door');
}
for (const z of [1, 2]) link(-13, -2, z, 'N', 'door');
link(-13, -1, 0, 'N', 'door');
link(-16, -1, 2, 'S', 'door');
link(-16, -2, 3, 'N', 'door'); // out onto the roof

// ================================================================ THE GROUNDS (yards everywhere else on z0)

const GX0 = -17;
const GX1 = 8;
const GY0 = -9;
const GY1 = 6;
const inCourt = (x: number, y: number) => x > EO.x0 && x < EO.x1 && y > EO.y0 && y < EO.y1;
const yardKind = (x: number, y: number): string => {
  if (y === GY1 || x === GX1 || x === GX0) return 'paving'; // Pennsylvania Avenue, 15th and 17th Streets
  if (y === GY0) return 'street'; // E Street by the Ellipse
  if (inCourt(x, y)) return 'paving';
  if (x === -11) return 'drive'; // West Executive Avenue
  if (y === 4 && x >= -4 && x <= 4) return 'drive'; // the north drive
  if (y === 5 && (x === -4 || x === 4)) return 'drive';
  if (y === -7 && x >= -6 && x <= 6) return 'drive'; // the south drive
  if ((x === -6 || x === 6) && y >= -7 && y <= -2) return 'drive';
  if (y === -1 && x >= -2 && x <= 2) return 'paving'; // under the South Portico
  return 'grass';
};
for (let x = GX0; x <= GX1; x++)
  for (let y = GY0; y <= GY1; y++) {
    if (cells.has(key(x, y, 0))) continue;
    place('yard', x, y, 0, 'yard', YARD[yardKind(x, y)]!);
  }

// Fences with gates: north along Pennsylvania Avenue, south along E Street, east along 15th Street.
const NORTH_GATES = [-11, -4, 4];
const SOUTH_GATES = [-11, -6, 6];
for (let x = GX0; x <= 7; x++) {
  if (!NORTH_GATES.includes(x)) link(x, 5, 0, 'N', 'fence');
  if (!SOUTH_GATES.includes(x)) link(x, -8, 0, 'S', 'fence');
}
for (let y = -8; y <= 5; y++) if (y !== 1) link(7, y, 0, 'E', 'fence');
// The Rose Garden's hedged edge on the lawn side.
for (const x of [-5, -4]) link(x, -1, 0, 'S', 'half');

// Every other side: open inside a group (and between yards), walls between groups.
for (const [x, y, z, side, style] of links.values()) m.edge(x, y, z, side, style);
{
  const done = new Set<string>(links.keys());
  for (const [k, here] of cells) {
    if (here.kind === 'stairwell' || here.kind === 'yard') continue;
    const [x, y, z] = k.split(',').map(Number) as [number, number, number];
    for (const side of ['N', 'E', 'S', 'W'] as const) {
      const [dx, dy] = DIRS[side];
      const there = cells.get(key(x + dx, y + dy, z));
      const id = sideId(x, y, z, side);
      if (!there || done.has(id) || there.kind === 'stairwell' || there.kind === 'yard') continue;
      done.add(id);
      if (there.tile === here.tile) continue;
      m.edge(x, y, z, side, there.group === here.group ? 'open' : 'wall');
    }
  }
}

// ================================================================ PORTICOES, ROOFS AND SET PIECES

// The North Portico: six columns, entablature and pediment over the north door.
for (let i = 0; i < 6; i++) m.prop('rn_column_round', [r2(-10 + i * 4), 0, 33], 0, 1.5);
box(-11.2, 7.5, 28, 11.2, 8.5, 34.4, MARBLE);
pediment(-11.2, 11.2, 28, 34.4, 8.5, 3, 5, MARBLE);
// The South Portico: a semicircle of columns two storeys high round the Blue Room, the balcony off
// the Yellow Oval Room at the Residence floor, and the entablature over it.
const SP: [number, number] = [0, -4];
for (let i = 0; i < 8; i++) {
  const a = PI + 0.2 + (i * (PI - 0.4)) / 7;
  m.prop('rn_column_round', [r2(SP[0] + 9.2 * Math.cos(a)), 0, r2(SP[1] + 9.2 * Math.sin(a))], 0, 1.5);
}
halfDisc(SP[0], SP[1], 8.4, 3.7, 4, MARBLE);
arc(SP[0], SP[1], 8.2, PI, 2 * PI, 4, 5, 0.25, 16, WHITE);
arc(SP[0], SP[1], 9.2, PI, 2 * PI, 7.5, 8.4, 1.4, 18, MARBLE);
halfDisc(SP[0], SP[1], 9.6, 8.4, 8.7, MARBLE);
// Cornice and balustrade round the mansion's roof.
box(-28.4, 8, -4.4, 28.4, 8.6, -3.6, MARBLE);
box(-28.4, 8, 27.6, 28.4, 8.6, 28.4, MARBLE);
box(-28.4, 8, -3.6, -27.6, 8.6, 27.6, MARBLE);
box(27.6, 8, -3.6, 28.4, 8.6, 27.6, MARBLE);
box(-28.2, 8.6, -4.2, 28.2, 9.4, -3.8, WHITE);
box(-28.2, 8.6, 27.8, 28.2, 9.4, 28.2, WHITE);
box(-28.2, 8.6, -3.8, -27.8, 9.4, 27.8, WHITE);
box(27.8, 8.6, -3.8, 28.2, 9.4, 27.8, WHITE);
// Columns along the colonnades and a pediment over the East Wing's door.
for (const x of [-42, -38, -34, -30]) m.prop('rn_column_round', [x, 0, 11.2], 0, 0.8, false);
for (const x of [-42, -38, -34, -30]) m.prop('rn_column_round', [x, 0, 20.8], 0, 0.8, false);
// The executive office building: stacked columns on every storey, cornices and the stepped mansard roof.
const EOR = { x0: -132, x1: -92, z0: -20, z1: 36 };
for (let s = 0; s < 3; s++) {
  const y = s * 4;
  for (let x = EOR.x0 + 2; x <= EOR.x1 - 2; x += 4)
    for (const z of [EOR.z0 - 0.7, EOR.z1 + 0.7]) {
      if (s === 0 && Math.abs(x + 112) < 3) continue;
      m.prop('rn_column_round', [x, y, z], 0, 0.72, false);
    }
  for (let z = EOR.z0 + 2; z <= EOR.z1 - 2; z += 4)
    for (const x of [EOR.x0 - 0.7, EOR.x1 + 0.7]) {
      if (s === 0 && Math.abs(z - 8) < 3) continue;
      m.prop('rn_column_round', [x, y, z], 0, 0.72, false);
    }
  box(EOR.x0 - 1.2, y + 3.6, EOR.z0 - 1.2, EOR.x1 + 1.2, y + 4, EOR.z0 - 0.3, GRANITE);
  box(EOR.x0 - 1.2, y + 3.6, EOR.z1 + 0.3, EOR.x1 + 1.2, y + 4, EOR.z1 + 1.2, GRANITE);
  box(EOR.x0 - 1.2, y + 3.6, EOR.z0 - 0.3, EOR.x0 - 0.3, y + 4, EOR.z1 + 0.3, GRANITE);
  box(EOR.x1 + 0.3, y + 3.6, EOR.z0 - 0.3, EOR.x1 + 1.2, y + 4, EOR.z1 + 0.3, GRANITE);
}
// Mansard: two stepped courses of slate on the outer edge of the roof, leaving the walk behind them.
for (const [inset, y0, y1] of [[0, 12, 13.2], [0.8, 13.2, 14.4]] as const) {
  const t = 1.6 - inset;
  box(EOR.x0 + inset, y0, EOR.z0 + inset, EOR.x1 - inset, y1, EOR.z0 + inset + t, SLATE);
  box(EOR.x0 + inset, y0, EOR.z1 - inset - t, EOR.x1 - inset, y1, EOR.z1 - inset, SLATE);
  box(EOR.x0 + inset, y0, EOR.z0 + inset + t, EOR.x0 + inset + t, y1, EOR.z1 - inset - t, SLATE);
  box(EOR.x1 - inset - t, y0, EOR.z0 + inset + t, EOR.x1 - inset, y1, EOR.z1 - inset - t, SLATE);
}
// Corner pavilions: taller slate caps on the outer corners, leaving the roof walk round inside them.
for (const x of [EOR.x0 + 2.2, EOR.x1 - 2.2]) for (const z of [EOR.z0 + 2.2, EOR.z1 - 2.2]) {
  if (x === EOR.x0 + 2.2 && z === EOR.z0 + 2.2) continue; // the roof stairs come out here
  box(x - 2.2, 12, z - 2.2, x + 2.2, 15.4, z + 2.2, SLATE);
  box(x - 1.4, 15.4, z - 1.4, x + 1.4, 17, z + 1.4, SLATE);
}

// Guard booths at the gates and barriers across the drives.
function booth(x: number, z: number): void {
  box(x - 1.1, 0, z - 1.1, x + 1.1, 1.1, z + 1.1, BOOTH);
  box(x - 1.1, 1.1, z - 1.1, x + 1.1, 2.2, z + 1.1, DARK_GLASS);
  box(x - 1.3, 2.2, z - 1.3, x + 1.3, 2.6, z + 1.3, BOOTH);
}
for (const gx of NORTH_GATES) booth(gx * 8 + 3, 41);
for (const gx of SOUTH_GATES) booth(gx * 8 + 3, -65);
booth(59, 4);
for (const gx of [-4, 4]) m.prop('barrier', [gx * 8, 0, 46], 0);
for (const gx of [-6, 6]) m.prop('barrier', [gx * 8, 0, -70], 0);
// Helipads on the South Lawn.
for (const hx of [-16, 16]) {
  box(hx - 7, 0, -55, hx + 7, 0.1, -41, PAD);
  box(hx - 2, 0.1, -50, hx - 1.2, 0.14, -46, PAINT_W);
  box(hx + 1.2, 0.1, -50, hx + 2, 0.14, -46, PAINT_W);
  box(hx - 1.2, 0.1, -48.3, hx + 1.2, 0.14, -47.7, PAINT_W);
}
m.mount('dropship', [-16, 0.1, -48], 0, SECURITY);
m.mount('gunship', [16, 0.1, -48], 0, SECURITY);
// Fountains on the South and North Lawns.
m.prop('fountain', [0, 0, -30], 0, 1);
m.prop('fountain_square', [0, 0, 44.4], 0, 0.7);

// ================================================================ PLANTING

let t = 0;
const BIG = ['oak', 'nt_common_tree', 'tree_detailed', 'oak_dark'];
const tree = (x: number, z: number, kinds = BIG, scale = 1) => m.prop(kinds[t++ % kinds.length]!, [x, 0, z], (t * 1.9) % 6.28, scale + (t % 3) * 0.06);
// South Lawn: big trees down both sides, magnolias by the mansion.
for (const [x, z] of [[-40, -20], [-44, -36], [-38, -54], [-30, -64], [40, -20], [44, -36], [38, -54], [30, -64], [-26, -18], [26, -18], [-34, -8], [34, -8]] as const) tree(x, z);
for (const [x, z] of [[-30, 36], [30, 36], [-50, 30], [50, 30], [-62, 44], [20, 44], [-20, 44]] as const) tree(x, z);
for (const [x, z] of [[-112, -2], [-104, 18]] as const) tree(x, z, ['tree_small', 'nt_common_tree_2'], 0.9); // the EEOB courtyard
// The Rose Garden: hedges round the beds, roses, crabapple trees at the corners.
for (const z of [-8, 0, 8]) for (const x of [-40, -32]) m.prop('hedge', [x, 0, z], P);
for (let i = 0; i < 18; i++) m.prop(['flower_red', 'flower_red', 'flower_yellow'][i % 3]!, [r2(-42 + (i % 6) * 2.4), 0, r2(-6 + Math.floor(i / 6) * 6)], i, 1.2, false);
for (const [x, z] of [[-43, -10], [-29, -10], [-43, 10], [-29, 10]] as const) tree(x, z, ['tree_small'], 0.9);
// The East Garden.
for (const x of [36, 44, 52]) m.prop('hedge', [x, 0, -8], 0);
for (let i = 0; i < 9; i++) m.prop(['flower_purple', 'flower_yellow', 'flower_red'][i % 3]!, [r2(34 + i * 2.4), 0, -12], i, 1.2, false);
// Shrubs along the mansion's south front (cover on the lawn).
for (const x of [-24, -16, 16, 24]) m.prop('nt_bush_leafy', [x, 0, -7], 0, 1.2);
for (const x of [-20, 20]) m.prop('bush_large', [x, 0, -16], 0, 1.2);
// Lamps on the drives and the avenue, benches on Pennsylvania Avenue.
for (let x = -132; x <= 60; x += 16) m.prop('lightpost', [x, 0, 50], PI);
for (let x = -124; x <= 52; x += 24) m.prop('bench', [x + 8, 0, 49.6], PI, 2.4);
for (const z of [-60, -36, -12, 12, 36]) m.prop('lightpost', [-91.5, 0, z], P);

// ================================================================ VEHICLES

m.mount('armored_rover', [-88, 0, -40], 0, SECURITY);
m.mount('gun_jeep', [-24, 0, 32], P, SECURITY);
m.mount('buggy', [-90, 0, 48], P, INTRUDERS);
m.mount('hover_bike', [40, 0, -72], -P, INTRUDERS);
m.mount('hover_bike', [-40, 0, -72], P, INTRUDERS);

// ================================================================ SPAWNS, OBJECTIVES, PICKUPS

// Intruders: Pennsylvania Avenue and the Ellipse.
for (const [x, z, yaw] of [[-56, 48, PI], [-40, 48, PI], [-8, 49, PI], [8, 49, PI], [40, 48, PI], [56, 48, PI], [-56, -72, 0], [-28, -72, 0], [-12, -73, 0], [12, -73, 0], [28, -72, 0], [56, -72, 0]] as const) m.spawn([x, 0, z], yaw, INTRUDERS);
// Security: the mansion, the West Wing corridor, the East Wing lobby.
for (const [x, y, z, yaw] of [[-4, 0, 16, PI], [4, 0, 16, PI], [-12, 0, 16, PI], [12, 0, 16, PI], [-24, 0, 4, P], [24, 0, 4, -P], [-56, 0, 14, 0], [-56, 0, 22, PI], [48, 0, 8, P], [56, 0, 8, -P], [-12, 4, 16, PI], [12, 4, 16, PI]] as const) m.spawn([x, y, z], yaw, SECURITY);
// Free-for-all extras.
for (const [x, y, z, yaw] of [[-112, 0, 30, PI], [-128, 0, 8, P], [-96, 0, 8, -P], [-112, 4, -16, 0], [-112, 8, 32, PI], [-36, 0, 0, P], [0, 0, -46, 0], [-30, 0, -40, P], [30, 0, -40, -P], [60, 0, -40, -P], [-64, 0, -30, 0], [0, 4, 24, PI]] as const) m.spawn([x, y, z], yaw);

m.flag(SECURITY, at(0, 2, 0), PI);
m.flag(INTRUDERS, [-24, 0, -74], 0);
// Bomb: the Oval Office (A) and the Situation Room (B).
m.add({ kind: 'bombsite', position: [-52, 0, -4], label: 'A', radius: 4 });
m.add({ kind: 'bombsite', position: [-68, -4, 4], label: 'B', radius: 4 });
// Hostage Rescue: four in the Residence; out by the north or south gates.
m.hostage(at(-3, 1, 1, 0, -2), 0).hostage(at(-1, 3, 1, 0, 0), PI).hostage(at(1, 3, 1, 0, 0), PI).hostage(at(3, 1, 1, 0, 0), -P);
m.rescue([0, 0, 49], 6).rescue([0, 0, -73], 6);
// King of the Hill: the South Lawn, the Rose Garden, the executive building's courtyard, the North Portico.
m.hill([0, 0, -40], 8);
m.hill([-36, 0, -2], 6);
m.hill([-112, 0, 8], 7);
m.hill([0, 0, 38], 6);

m.pickup('weapon_sniper', [-112, 12, 30]).pickup('ammo_sniper', [-112, 12, -14]);
m.pickup('weapon_railgun', [-16, 8, 16]).pickup('ammo_cells', [16, 8, 4]);
m.pickup('weapon_rockets', [-112, 0, 22]).pickup('ammo_explosive', [-120, 4, -16]);
m.pickup('powerup_damage', [0, 4, -9], 90);
m.pickup('armor_large', at(-9, 0, -1, -2, 0)).pickup('armor_large', at(-1, 2, 1));
m.pickup('weapon_shotgun', at(-7, 2, 0)).pickup('weapon_auto_shotgun', at(3, 2, 0)).pickup('weapon_smg', at(-3, 2, 1));
m.pickup('weapon_rifle', [-88, 0, 0]).pickup('weapon_rifle', [44, 0, -24]).pickup('weapon_burst_rifle', at(6, 1, 0));
m.pickup('weapon_marksman', [-112, 8, -16]).pickup('weapon_lmg', at(-10, 3, 0, 4, 0)).pickup('weapon_launcher', [-44, 0, -60]);
m.pickup('weapon_machine_pistol', at(-14, 4, 0)).pickup('weapon_smg', [48, 0, 44]);
m.pickup('health_large', at(3, 1, 0)).pickup('health_large', at(-9, 2, -1)).pickup('health_large', at(-16, 1, 1));
m.pickup('health_small', [-60, 0, -60]).pickup('health_small', [60, 0, -60]).pickup('health_small', [-64, 0, 44]).pickup('health_small', [64, 0, 28]);
m.pickup('health_small', at(-6, 3, 0)).pickup('health_small', at(-2, 0, 1)).pickup('health_small', at(-12, 0, 2));
m.pickup('ammo_rifle', [-24, 0, -60]).pickup('ammo_rifle', [24, 0, 44]).pickup('ammo_rifle', at(-12, 2, 0)).pickup('ammo_shells', at(1, 0, 1));
m.pickup('ammo', [-88, 0, 24]).pickup('ammo', [52, 0, -20]).pickup('grenades', [-8, 0, -60]).pickup('grenades', [-8, 0, 40]).pickup('armor_small', [-36, 0, 6]);

// ================================================================ INTERIORS (after spawns, objectives and pickups)

const dress: [{ x0: number; y0: number; x1: number; y1: number; z: number }, RoomType][] = [
  // State floor.
  [{ x0: -3, y0: 0, x1: -3, y1: 3, z: 0 }, 'dining'],
  [{ x0: 3, y0: 0, x1: 3, y1: 3, z: 0 }, 'lobby'],
  [{ x0: -2, y0: 0, x1: -2, y1: 1, z: 0 }, 'library'],
  [{ x0: -1, y0: 0, x1: -1, y1: 1, z: 0 }, 'living'],
  [{ x0: 0, y0: 0, x1: 0, y1: 1, z: 0 }, 'living'],
  [{ x0: 1, y0: 0, x1: 1, y1: 1, z: 0 }, 'living'],
  [{ x0: 2, y0: 0, x1: 2, y1: 1, z: 0 }, 'living'],
  [{ x0: 2, y0: 3, x1: 2, y1: 3, z: 0 }, 'office'],
  // The Residence.
  [{ x0: -3, y0: 0, x1: -3, y1: 1, z: 1 }, 'bedroom'],
  [{ x0: -2, y0: 0, x1: -2, y1: 1, z: 1 }, 'bathroom'],
  [{ x0: -1, y0: 0, x1: -1, y1: 1, z: 1 }, 'dining'],
  [{ x0: 0, y0: 0, x1: 0, y1: 1, z: 1 }, 'living'],
  [{ x0: 1, y0: 0, x1: 1, y1: 1, z: 1 }, 'living'],
  [{ x0: 2, y0: 0, x1: 2, y1: 1, z: 1 }, 'bedroom'],
  [{ x0: 3, y0: 0, x1: 3, y1: 1, z: 1 }, 'bedroom'],
  [{ x0: -3, y0: 3, x1: -3, y1: 3, z: 1 }, 'bedroom'],
  [{ x0: -1, y0: 3, x1: -1, y1: 3, z: 1 }, 'bedroom'],
  [{ x0: 0, y0: 3, x1: 0, y1: 3, z: 1 }, 'office'],
  [{ x0: 1, y0: 3, x1: 1, y1: 3, z: 1 }, 'bedroom'],
  [{ x0: 3, y0: 3, x1: 3, y1: 3, z: 1 }, 'bedroom'],
  // The West Wing.
  [{ x0: -7, y0: -1, x1: -6, y1: 0, z: 0 }, 'office'],
  [{ x0: -6, y0: 1, x1: -6, y1: 2, z: 0 }, 'conference'],
  [{ x0: -6, y0: 3, x1: -6, y1: 3, z: 0 }, 'conference'],
  [{ x0: -8, y0: -1, x1: -8, y1: -1, z: 0 }, 'office'],
  [{ x0: -8, y0: 0, x1: -8, y1: 0, z: 0 }, 'office'],
  [{ x0: -8, y0: 1, x1: -8, y1: 1, z: 0 }, 'office'],
  [{ x0: -8, y0: 2, x1: -8, y1: 2, z: 0 }, 'office'],
  [{ x0: -10, y0: -1, x1: -9, y1: 0, z: 0 }, 'office'],
  [{ x0: -9, y0: 1, x1: -9, y1: 1, z: 0 }, 'office'],
  [{ x0: -10, y0: 2, x1: -9, y1: 3, z: 0 }, 'classroom'],
  // The Situation Room complex.
  [{ x0: -9, y0: 0, x1: -8, y1: 1, z: -1 }, 'conference'],
  [{ x0: -10, y0: 0, x1: -10, y1: 0, z: -1 }, 'server'],
  [{ x0: -9, y0: 2, x1: -8, y1: 2, z: -1 }, 'server'],
  [{ x0: -10, y0: 2, x1: -10, y1: 3, z: -1 }, 'office'],
  // The East Wing.
  [{ x0: 5, y0: 0, x1: 7, y1: 0, z: 0 }, 'classroom'],
  [{ x0: 5, y0: 1, x1: 7, y1: 1, z: 0 }, 'lobby'],
  [{ x0: 5, y0: 2, x1: 7, y1: 2, z: 0 }, 'office'],
  // The executive office building.
  [{ x0: -15, y0: 4, x1: -13, y1: 4, z: 0 }, 'library'],
  [{ x0: -15, y0: -2, x1: -13, y1: -2, z: 0 }, 'lobby'],
  [{ x0: -16, y0: -1, x1: -16, y1: 3, z: 0 }, 'office'],
  [{ x0: -12, y0: -1, x1: -12, y1: 3, z: 0 }, 'office'],
  [{ x0: -15, y0: 4, x1: -13, y1: 4, z: 1 }, 'conference'],
  [{ x0: -15, y0: -2, x1: -13, y1: -2, z: 1 }, 'office'],
  [{ x0: -16, y0: -1, x1: -16, y1: 3, z: 1 }, 'office'],
  [{ x0: -12, y0: 0, x1: -12, y1: 3, z: 1 }, 'office'],
  [{ x0: -15, y0: 4, x1: -12, y1: 4, z: 2 }, 'office'],
  [{ x0: -15, y0: -2, x1: -13, y1: -2, z: 2 }, 'library'],
  [{ x0: -16, y0: 0, x1: -16, y1: 3, z: 2 }, 'office'],
  [{ x0: -12, y0: 0, x1: -12, y1: 3, z: 2 }, 'office'],
];
for (const [room, type] of dress) m.dress(room, type, { density: 'normal' });

// Lights in every room cell, warm.
for (const [k, c] of cells) {
  if (c.kind === 'yard' || c.kind === 'stairwell') continue;
  const [x, y, z] = k.split(',').map(Number) as [number, number, number];
  if ((x + y) % 2 !== 0 && c.kind === 'room') continue;
  m.light(at(x, y, z, 0, 0, 3.4), { color: z < 0 ? '#e8f0ff' : '#ffe6c0', intensity: 0.9, range: 11 });
}

m.bounds('invisible', 0, { min: [GX0 * 8 - 4, GY0 * 8 - 4], max: [GX1 * 8 + 4, GY1 * 8 + 4] });
m.meta({
  description:
    "A look-alike of the White House and its grounds: the mansion with its North Portico and the curved South Portico and balcony, the State rooms and the Residence upstairs, the West Wing with its oval office, cabinet room and press briefing room over the situation room in the basement, the East Wing, the Rose Garden, the South Lawn with its fountain and two helipads (a dropship and a gunship parked), fences, gates and guard booths, and the ornate executive office building across West Executive Avenue with a sniper's roof. Intruders come in from Pennsylvania Avenue and the Ellipse; Security holds the house. Bomb sites in the oval office and the situation room; four hostages upstairs in the Residence.",
  modes: ['core.bomb', 'core.hostage', 'core.tdm', 'core.ctf', 'core.koth', 'core.deathmatch', 'core.elim'],
  players: [12, 24],
});
console.log(`executive_grounds: ${nBlocks} blocks`);
await m.save();
