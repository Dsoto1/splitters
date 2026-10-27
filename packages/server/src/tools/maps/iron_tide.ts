/**
 * Iron Tide: a big amphibious assault ship riding at anchor at night (our own
 * ship, map and name), for 12–24 players in Hostage Rescue, Bomb, Team
 * Deathmatch, Capture the Flag (bow against stern) and Deathmatch.
 *
 * The Boarders (first team) start on the floating dock off the stern with
 * speeders and a hovercraft, and a dropship on the helipad pontoon: they come
 * in up the lowered stern gate into the well deck, ride the cargo lifts (jump
 * pads) onto the stern of the flight deck, climb the side ladders from the
 * boarding floats, or fly in. The Crew hold the ship.
 *
 * - Flight deck (8 m up): the length of the ship, parked aircraft (a dropship,
 *   a gunship, a skyfighter), deck hatches down to the galleries, MG mounts
 *   at the bow. The island on the starboard side: flight control and comms on
 *   the deck, the bridge above (bomb site B), and the radar deck and mast on
 *   top, climbed by outside stairs.
 * - Well deck and vehicle hangar (lower deck, two storeys): the stern gate
 *   opens straight onto the dock; a hovercraft waits in the flooded well,
 *   a tank, gun jeeps and an armoured rover in the hangar. Long passageways
 *   run down both sides under railed galleries.
 * - Engine room (amidships): machinery on the floor (bomb site A), catwalks
 *   and a bridge across at gallery level.
 * - Forward: the main passageway on both decks; magazines and stores, the
 *   armoury and the brig (four cells behind bars: the hostages) below; crew
 *   berthing, the mess, the galley and sickbay above.
 *
 * Grid x east (starboard), y north (bow); cells x -2..2 (x -20..20), y -10..10
 * (z -84..84); levels z0 (y 0) lower deck, z1 (4) galleries and berthing,
 * z2 (8) flight deck, z3 (12) bridge, z4 (16) radar deck. Sea level y -1.5.
 *
 *   y 10        [ bow stores ]           (solid bow beyond)
 *   y 4..9  stores |spine| brig     /   berthing |spine| mess, galley, sickbay
 *   y 0..3  [======= engine room (catwalks at z1) =======]   island over
 *   y -5..-1  pass | vehicle hangar | pass                    y -2..1 (x 2)
 *   y -10..-6 pass |   well deck    | pass
 *   z -84 ---- stern gate ---- floating dock (z -84..-120), helipad pontoon west
 */
import { newTerrain, type EdgeStyle, type MountModel, type RoomOptions, type Rotation, type Side, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('iron_tide', 'Iron Tide');
m.theme('bunker');
m.backdrop('night', 'ocean', 'water', 0.4, 0.2);
m.teams([12, 12]);
const [BOARD, CREW] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];
/** A solid block from corner to corner (split to the block size limits). */
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, look: Look): void {
  const w = x1 - x0;
  const d = z1 - z0;
  const h = y1 - y0;
  if (w > 64 || d > 64 || h > 32) {
    const nx = Math.ceil(w / 64);
    const nz = Math.ceil(d / 64);
    const ny = Math.ceil(h / 32);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) for (let k = 0; k < ny; k++) box(x0 + (w * i) / nx, x0 + (w * (i + 1)) / nx, y0 + (h * k) / ny, y0 + (h * (k + 1)) / ny, z0 + (d * j) / nz, z0 + (d * (j + 1)) / nz, look);
    return;
  }
  m.block([r2((x0 + x1) / 2), r2(y0), r2((z0 + z1) / 2)], [r2(w), r2(h), r2(d)], 'solid', look);
}
/** A block along the line from (xa, za) to (xb, zb), `width` across it. */
function beam(xa: number, za: number, xb: number, zb: number, width: number, y0: number, y1: number, look: Look, extra = 0): void {
  const dx = xb - xa;
  const dz = zb - za;
  m.block([r2((xa + xb) / 2), r2(y0), r2((za + zb) / 2)], [r2(Math.hypot(dx, dz) + extra), r2(y1 - y0), r2(width)], 'solid', { ...look, yaw: +Math.atan2(-dz, dx).toFixed(4) });
}

// ---------------------------------------------------------------- looks

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const HULL: Look = { material: 'pbr_steel', tint: '#5d656c' };
const HULL_DARK: Look = { material: 'pbr_steel', tint: '#3a4046' };
const BOOT: Look = { material: 'paint_matte', tint: '#5a2422' }; // antifouling red below the waterline
const DECK_LOOK: Look = { material: 'pbr_asphalt', tint: '#4a4c4e' };
const WHITE: Look = { material: 'paint_matte', tint: '#e8e8e0' };
const YELLOW: Look = { material: 'paint_matte', tint: '#e0b820' };
const DOCK_LOOK: Look = { material: 'pbr_planks', tint: '#7a6a58' };
const FLOAT: Look = { material: 'pbr_rusted_plate' };
const STEEL: Look = { material: 'pbr_steel', tint: '#80868c' };
const GREY = '#7d858c';
const SHIP: TileSurfaces = { floor: mat('pbr_tread_plate'), walls: mat('pbr_steel', GREY), solids: mat('pbr_steel', '#6a7076'), underside: mat('pbr_steel', '#5a6066'), trim: mat('pbr_steel', '#4a5056') };
const PASSAGE: TileSurfaces = { floor: mat('pbr_tread_plate', '#9a9890'), walls: mat('pbr_white_panel', '#c4c8c4'), underside: mat('pbr_steel', '#6a7076'), trim: mat('hazard') };
const WELL: TileSurfaces = { floor: mat('pbr_tread_plate', '#6e6a62'), walls: mat('pbr_steel', GREY), underside: mat('pbr_steel', '#5a6066'), trim: mat('hazard') };
const ENGINE: TileSurfaces = { floor: mat('grate'), walls: mat('pbr_steel', '#6e747a'), underside: mat('pbr_steel', '#4a5056'), trim: mat('hazard') };
const BERTH: TileSurfaces = { floor: mat('pbr_tread_plate', '#8a9aa8'), walls: mat('pbr_white_panel', '#d8dcd4'), underside: mat('pbr_steel', '#6a7076'), trim: mat('pbr_steel', '#4a5056') };
const MESS: TileSurfaces = { floor: mat('checker'), walls: mat('pbr_white_panel', '#e4e4dc'), underside: mat('pbr_steel', '#6a7076'), trim: mat('pbr_steel', '#4a5056') };
const BRIG: TileSurfaces = { floor: mat('pbr_concrete', '#8a8a84'), walls: mat('pbr_steel', '#6a6a64'), underside: mat('pbr_steel', '#5a6066'), trim: mat('pbr_steel') };
const FLIGHT: TileSurfaces = { floor: mat('pbr_asphalt', '#4a4c4e'), walls: mat('pbr_steel', GREY), underside: mat('pbr_steel', '#5a6066'), trim: mat('pbr_steel', '#4a5056') };
const ISLAND: TileSurfaces = { floor: mat('pbr_tread_plate'), walls: mat('pbr_steel', '#8a9298'), underside: mat('pbr_steel', '#5a6066'), trim: mat('pbr_steel', '#4a5056') };

// ---------------------------------------------------------------- tiles

const taken = new Set<string>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
function place(kind: string, x: number, y: number, z: number, surf: TileSurfaces, rot: Rotation = 0, opts?: RoomOptions): void {
  m.tile(kind, x, y, z, rot, opts);
  const tall = kind === 'stairwell' || kind === 'stairs' || kind === 'stairs_open';
  for (const dz of tall ? [0, 1] : [0]) {
    const k = key(x, y, z + dz);
    if (taken.has(k)) throw new Error(`cell ${k} placed twice`);
    taken.add(k);
  }
  paint(x, y, z, surf);
}
const EMPTY: RoomOptions = { layout: 'empty' };
const ROOFED: RoomOptions = { layout: 'empty', ceiling: 'roof' };
const edge = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => m.edge(x, y, z, side, style);
const has = (x: number, y: number, z: number) => taken.has(key(x, y, z));

// Lower deck (z0), aft: the well deck (y -10..-6) and the vehicle hangar (y -5..-1), two storeys
// high, with passageways down both sides (stairs up to the galleries at y -3).
for (let y = -10; y <= -1; y++) {
  for (let x = -1; x <= 1; x++) place('platform', x, y, 0, WELL);
  for (const x of [-2, 2]) {
    if (y === -3) place('stairs', x, y, 0, PASSAGE, 3); // climbs north onto the gallery at y -2
    else place('corridor', x, y, 0, PASSAGE);
  }
}
// The engine room (y 0..3): stairs up to the catwalks, a bridge across at y 3.
for (let y = 0; y <= 3; y++)
  for (let x = -2; x <= 2; x++) {
    if (x === -1 && y === 2) place('stairs', x, y, 0, ENGINE, 2); // climbs west onto the port catwalk
    else if (x === 1 && y === 1) place('stairs', x, y, 0, ENGINE, 0); // climbs east onto the starboard catwalk
    else place('platform', x, y, 0, ENGINE);
  }
// Forward, lower deck: the spine passageway, stores and magazines (port), armoury and brig (starboard).
for (let y = 4; y <= 9; y++) {
  place('corridor', 0, y, 0, PASSAGE);
  for (const x of [-2, -1, 1, 2]) {
    if (x === -1 && y === 6) place('stairwell', x, y, 0, PASSAGE, 2); // doors east onto the spine, both decks
    else if (x === 1 && y === 4) place('stairwell', x, y, 0, PASSAGE, 0); // doors west onto the spine, both decks
    else place('room', x, y, 0, x === 2 && y >= 6 ? BRIG : x === 1 && y >= 6 ? BRIG : SHIP, 0, EMPTY);
  }
}
for (let x = -1; x <= 1; x++) place('room', x, 10, 0, SHIP, 0, EMPTY); // bow stores

// Galleries (z1) over the side passageways, catwalks round the engine room.
for (let y = -9; y <= -1; y++) for (const x of [-2, 2]) {
  if (y === -3) continue; // the stairs from below come up here
  if (y === -9) place('stairs', x, y, 1, PASSAGE, 1); // a deck hatch: climbs south onto the flight deck
  else place('platform_rail', x, y, 1, PASSAGE);
}
for (let y = 0; y <= 3; y++) for (const x of [-2, 2]) place('platform_rail', x, y, 1, ENGINE);
for (const x of [-1, 0, 1]) place('bridge', x, 3, 1, ENGINE, 1);
// Forward, upper (z1): berthing (port), mess, galley and sickbay (starboard), the spine, the bow hatch.
for (let y = 4; y <= 9; y++) {
  if (y <= 8) place('corridor', 0, y, 1, PASSAGE);
  else place('stairs', 0, y, 1, PASSAGE, 3); // climbs north onto the flight deck at the bow
  for (const x of [-2, -1, 1, 2]) {
    if (has(x, y, 1)) continue;
    const surf = x < 0 ? BERTH : y >= 7 && y <= 8 ? MESS : y <= 6 && !(x === 2 && y === 4) ? MESS : BERTH;
    place('room', x, y, 1, surf, 0, EMPTY);
  }
}
for (let x = -1; x <= 1; x++) place('room', x, 10, 1, SHIP, 0, EMPTY);

// The flight deck (z2), and the island on the starboard side (x 2, y -2..1).
const ISLAND_Y = [-2, -1, 0, 1];
for (let y = -10; y <= 10; y++)
  for (let x = -2; x <= 2; x++) {
    if (y === 10 && Math.abs(x) === 2) continue;
    if (has(x, y, 2)) continue;
    if (x === 2 && ISLAND_Y.includes(y)) place('room', x, y, 2, ISLAND, 0, EMPTY);
    else if (x === 1 && y === -3) place('stairs_open', x, y, 2, ISLAND, 3); // up the island's side to the bridge wing
    else place('platform', x, y, 2, FLIGHT);
  }
for (const y of ISLAND_Y) place('room', 2, y, 3, ISLAND, 0, y === -2 ? ROOFED : EMPTY); // the bridge
place('platform_rail', 1, -2, 3, ISLAND); // bridge wing
place('stairs_open', 1, -1, 3, ISLAND, 3); // up to the radar deck
for (const y of [-1, 0, 1]) place('platform_rail', 2, y, 4, ISLAND);
place('platform_rail', 1, 0, 4, ISLAND);

// ---------------------------------------------------------------- walls and openings

// Lower deck aft: the stern gate open, passageway doors into the well deck and hangar, portholes outboard.
for (let x = -1; x <= 1; x++) edge(x, -10, 0, 'S', 'open');
for (let y = -10; y <= -1; y++) {
  if (y === -3) continue;
  const inner = y === -9 || y === -6 || y === -2 ? 'door' : 'wall';
  edge(-2, y, 0, 'E', inner).edge(2, y, 0, 'W', inner);
  const outer = y === -8 || y === -5 || y === -1 ? 'slit' : 'wall';
  edge(-2, y, 0, 'W', outer).edge(2, y, 0, 'E', outer);
}
// Galleries: hull walls outboard, rails inboard.
for (let y = -8; y <= 3; y++) for (const x of [-2, 2]) {
  if (!has(x, y, 1) || (y === -3)) continue;
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === 1);
  if (t?.tile !== 'core.platform_rail') continue;
  edge(x, y, 1, x < 0 ? 'W' : 'E', y % 3 === 0 ? 'slit' : 'wall');
}
// The passageways stop at the foot of the gallery stairs.
edge(-2, -2, 0, 'S', 'wall').edge(2, -2, 0, 'S', 'wall');
// Stairwells forward open onto the spine on both decks.
for (const z of [0, 1]) edge(-1, 6, z, 'E', 'door').edge(1, 4, z, 'W', 'door');
// Bulkhead between the hangar and the engine room: a wide door in the middle, doors either side.
edge(-1, -1, 0, 'N', 'door').edge(1, -1, 0, 'N', 'door').edge(0, -1, 0, 'N', 'wide');
// The engine room's hull walls and its forward bulkhead.
for (let y = 0; y <= 3; y++) edge(-2, y, 0, 'W', 'wall').edge(2, y, 0, 'E', 'wall');
for (const x of [-2, 1]) edge(x, 3, 0, 'N', 'wall');
edge(-1, 3, 0, 'N', 'door').edge(2, 3, 0, 'N', 'door');
for (const x of [-1, 0, 1]) edge(x, 3, 1, 'N', 'wall');
edge(-2, 3, 1, 'N', 'door').edge(2, 3, 1, 'N', 'door');
// Forward lower deck.
edge(-1, 4, 0, 'E', 'door').edge(-1, 4, 0, 'W', 'open').edge(-1, 5, 0, 'W', 'open').edge(-1, 4, 0, 'N', 'open');
edge(-2, 4, 0, 'N', 'open');
edge(-2, 6, 0, 'S', 'door').edge(-2, 6, 0, 'N', 'door');
for (const y of [7, 8, 9]) edge(-1, y, 0, 'W', 'open');
edge(-1, 7, 0, 'N', 'open').edge(-2, 7, 0, 'N', 'open').edge(-1, 8, 0, 'N', 'open').edge(-2, 8, 0, 'N', 'open');
edge(-1, 8, 0, 'E', 'door');
edge(1, 5, 0, 'W', 'door').edge(1, 5, 0, 'E', 'door').edge(1, 5, 0, 'N', 'door'); // guard room
edge(2, 4, 0, 'N', 'door');
for (const y of [6, 7, 8]) edge(1, y, 0, 'N', 'open'); // brig hall
edge(1, 8, 0, 'W', 'door');
for (const y of [6, 7, 8, 9]) edge(2, y, 0, 'W', 'door'); // cell doorways
for (const y of [6, 7, 8]) edge(2, y, 0, 'N', 'bars'); // bars between the cells
edge(0, 9, 0, 'N', 'door').edge(-1, 10, 0, 'E', 'open').edge(0, 10, 0, 'E', 'open');
// Forward upper deck.
for (const y of [4, 5, 7, 8, 9]) edge(-2, y, 1, 'E', 'open');
edge(-2, 4, 1, 'N', 'open').edge(-1, 4, 1, 'N', 'open');
edge(-2, 5, 1, 'N', 'door').edge(-2, 6, 1, 'N', 'door');
for (const y of [7, 8]) edge(-2, y, 1, 'N', 'open').edge(-1, y, 1, 'N', 'open');
edge(-1, 4, 1, 'E', 'door').edge(-1, 8, 1, 'E', 'door');
edge(1, 5, 1, 'E', 'open').edge(1, 6, 1, 'E', 'open').edge(1, 5, 1, 'N', 'open').edge(2, 5, 1, 'N', 'open'); // the mess
edge(1, 5, 1, 'W', 'door').edge(2, 4, 1, 'N', 'door');
edge(1, 6, 1, 'N', 'door').edge(2, 6, 1, 'N', 'window'); // the servery into the galley
edge(1, 7, 1, 'E', 'open').edge(1, 8, 1, 'E', 'open').edge(1, 7, 1, 'N', 'open').edge(2, 7, 1, 'N', 'open'); // the galley
edge(1, 7, 1, 'W', 'door');
edge(1, 9, 1, 'E', 'open').edge(1, 9, 1, 'W', 'door'); // sickbay
edge(-1, 9, 1, 'N', 'door').edge(-1, 10, 1, 'E', 'open').edge(0, 10, 1, 'E', 'open').edge(1, 9, 1, 'N', 'door');
// Portholes along the hull, both decks forward.
for (let y = 4; y <= 9; y++) {
  if (y % 2 === 0) edge(-2, y, 1, 'W', 'slit').edge(2, y, 1, 'E', 'slit');
}
// The island: doors and windows onto the deck, the bridge glazed all round, a door onto the wing.
for (const y of ISLAND_Y) {
  edge(2, y, 2, 'W', y === -2 || y === 1 ? 'door' : 'windows');
  edge(2, y, 3, 'W', y === -2 ? 'door' : 'windows');
  edge(2, y, 3, 'E', 'windows');
  if (y < 1) edge(2, y, 2, 'N', 'open').edge(2, y, 3, 'N', 'open');
}
edge(2, -2, 2, 'S', 'door').edge(2, 1, 2, 'N', 'door');
edge(2, -2, 3, 'S', 'windows').edge(2, 1, 3, 'N', 'windows');
// Flight deck edge: railings, open where the ladders come up.
const LADDER_TOPS: [number, number, Side][] = [[-2, -10, 'S'], [2, -10, 'S'], [-2, -2, 'W'], [-2, 5, 'W']]; // stern lifts land over the S edges
for (let y = -10; y <= 10; y++)
  for (let x = -2; x <= 2; x++) {
    if (!has(x, y, 2)) continue;
    const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === 2);
    if (t?.tile !== 'core.platform') continue;
    for (const [side, dx, dy] of [['W', -1, 0], ['E', 1, 0], ['S', 0, -1], ['N', 0, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const outside = Math.abs(nx) > 2 || ny < -10 || ny > 10 || (ny === 10 && Math.abs(nx) === 2);
      if (!outside) continue;
      if (ny > 10 || (ny === 10 && Math.abs(nx) === 2)) continue; // the bow deck carries on as blocks
      edge(x, y, 2, side, LADDER_TOPS.some(([lx, ly, ls]) => lx === x && ly === y && ls === side) ? 'open' : 'railing');
    }
  }

// ---------------------------------------------------------------- the hull, the bow and the sea

// Under the decks: the hull down to the keel, the boot-topping at the waterline.
box(-20.25, 20.25, -6, -0.5, -84.25, 84, HULL_DARK);
box(-20.35, 20.35, -2.2, -0.5, -84.35, 84, BOOT);
// The bow: a solid wedge out to the stem, flight deck on top, a bulwark round it.
const STEM = 110;
const halfAt = (z: number) => (20 * (STEM - z)) / (STEM - 76);
for (let z = 76; z < STEM - 2; z += 2) {
  const w = halfAt(z + 1);
  if (z < 84) {
    if (w > 12.6) {
      box(-w, -12.25, -6, 8, z, z + 2, HULL);
      box(12.25, w, -6, 8, z, z + 2, HULL);
    }
  } else box(-w, w, -6, 8, z, z + 2, HULL);
}
for (const s of [-1, 1]) {
  beam(s * 20, 76, 0, STEM, 0.6, -6, 8, HULL, 0.6); // the bow plating
  beam(s * 20, 76, 0, STEM, 0.3, 8, 9.1, STEEL, 0.3); // the bulwark
}
// Deck markings: the centreline, the landing spots, the foul line.
for (let z = -80; z <= 100; z += 8) if (z + 4 <= 68 || z >= 76) box(-0.3, 0.3, 8, 8.1, z, z + 4, WHITE);
for (const z of [-60, -12, 60]) {
  box(-11, -5, 8, 8.1, z - 0.3, z + 0.3, YELLOW);
  box(-8.3, -7.7, 8, 8.1, z - 3, z + 3, YELLOW);
}
for (let z = -84; z <= 68; z += 16) box(-11, -10.6, 8, 8.1, z, z + 8, YELLOW);
// The stern transom above the gate, and a hull rubbing strake along the sides.
box(-12, 12, 7.2, 7.5, -84.3, -84, HULL);
// Stern plating over the side passageways (the stern ladders climb it).
for (const s of [-1, 1]) box(s > 0 ? 12 : -20.25, s > 0 ? 20.25 : -12, 4, 7.5, -84.25, -84, HULL);

// The sea and the sea bed.
const terrain = { ...newTerrain(320, 4, [0, -10], 'sand'), baseY: -9, boundary: false };
m.terrain(terrain);
m.water([0, -9, -10], [320, 7.5, 320], 'water');

// The floating dock off the stern (top level with the well deck) and the helipad pontoon.
box(-32, 32, -1.2, 0, -120, -84, DOCK_LOOK);
box(-32, 32, -2.6, -1.2, -120, -84, FLOAT);
box(-12, 12, 0, 0.15, -92, -84, STEEL); // the lowered stern gate
box(-70, -42, -1.2, 0, -114, -86, DOCK_LOOK);
box(-70, -42, -2.6, -1.2, -114, -86, FLOAT);
box(-42, -32, -1.2, 0, -103, -97, DOCK_LOOK); // gangway to the helipad
box(-62, -50, 0, 0.1, -106, -94, YELLOW); // the pad's square
box(-61.4, -50.6, 0, 0.12, -105.4, -94.6, DOCK_LOOK);
// Bollards and fenders along the dock.
for (const x of [-30, -18, 18, 30]) box(x - 0.4, x + 0.4, 0, 0.8, -119.4, -118.6, HULL_DARK);
for (const z of [-116, -104, -92]) {
  box(-32.4, -32, -1.5, 0.3, z - 1, z + 1, HULL_DARK);
  box(32, 32.4, -1.5, 0.3, z - 1, z + 1, HULL_DARK);
}
// Boarding floats off the port side.
for (const z of [-20, 36]) {
  box(-27, -20.4, -1.2, 0, z - 4, z + 4, DOCK_LOOK);
  box(-27, -20.4, -2.6, -1.2, z - 4, z + 4, FLOAT);
}

// Ladders: up the port side from the floats, and out of the sea.
const ladder = (pos: V3, yaw: number, height: number) => m.add({ kind: 'ladder', position: pos, yaw, height, width: 0.9 });
ladder([-20.55, 0, -16], -P, 8.2);
ladder([-20.55, 0, 40], -P, 8.2);
for (const [x, z, yaw] of [[-32.3, -110, -P], [32.3, -110, P], [0, -120.3, S], [-27.3, -20, -P], [-27.3, 36, -P], [-56, -114.3, S]] as const) ladder([x, -2.6, z], yaw, 2.6);

// Cargo lifts (jump pads) from the dock up onto the stern of the flight deck.
m.padTo([-16, 0.15, -90], [-16, 8, -78], 22);
m.padTo([16, 0.15, -90], [16, 8, -78], 22);
box(-18, -14, 0, 0.15, -92, -88, YELLOW);
box(14, 18, 0, 0.15, -92, -88, YELLOW);

// ---------------------------------------------------------------- the island's mast and radar

box(15.6, 16.4, 16, 28, -0.4, 0.4, STEEL);
box(13, 19, 22, 22.3, -0.3, 0.3, STEEL);
box(14, 18, 25, 25.3, -0.3, 0.3, STEEL);
m.prop('scanner', [16, 16, 8], 0, 1.6);
m.prop('scanner', [16, 16, -8], S, 1.2);
m.prop('sf_vent_wide', [12.5, 16, 0], P);

// ---------------------------------------------------------------- engine room machinery and the hangar

// Engine room: two main engines along the middle with walkways round, pumps and switchboards.
for (const [x, z] of [[-8, 8], [8, 16]] as const) {
  box(x - 1.6, x + 1.6, 0, 2.4, z - 3.6, z + 3.6, HULL_DARK);
  m.prop('piston', [x, 2.4, z], 0, 1);
}
m.prop('big_pipe', [-14, 0, 12], 0).prop('big_pipe', [14, 0, 12], 0).prop('machine', [-15, 0, 26], 0).prop('machine_window', [15, 0, 26], 0);
m.prop('pipe_valve', [3, 0, 26], 0).prop('pipe_glass', [-15, 0, 14], 0).prop('computer_bank', [-3, 0, 26.6], S).prop('hopper', [-15, 0, 1], 0);
m.breakable('generator', [15, 0, 1], -P);
// Hangar: crates, shelving and tool chests along the sides.
m.prop('shelf_boxes', [-10.5, 0, -42], P).prop('shelf_boxes', [10.5, 0, -42], -P).prop('workbench', [10.5, 0, -8], -P).prop('crate_large', [-10, 0, -8], 0);
m.prop('metal_crate', [-10.5, 0, -24.5], 0).prop('metal_crate', [10.5, 0, -30], 0).prop('cargo_crate', [10, 0, -12], 0.1).prop('sf_crate_large', [-10, 0, -34], 0);
m.prop('barrel', [-10.6, 0, -54]).prop('barrel', [-9.8, 0, -55]).prop('cone', [4, 0, -56], 0, 1, false).prop('cone', [-4, 0, -56], 0, 1, false);
m.breakable('gas', [11, 0, -54]).breakable('barrel', [-11, 0, -20]);
// The flooded well: a hand's depth of sea water over the deck.
m.water([0, 0, -67], [23.5, 0.25, 34], 'water');
// Flight deck: tow tractors (carts), crates of munitions, fuel.
m.prop('cart', [-13.5, 8, -50], 0).prop('metal_crate', [-14, 8, -20], 0).prop('metal_crate', [-14.5, 8, 22], 0.2).prop('barrier', [-6, 8, 70], 0);
m.prop('crate_large', [14, 8, 30], 0).prop('cargo_crate', [-14, 8, 52], 0).prop('crate_small', [13.5, 8, -40], 0).prop('cart', [14, 8, 50], P);
m.breakable('gas', [-15, 8, -28]).breakable('gas', [15, 8, 18]);
// The dock: cargo waiting to be loaded.
m.prop('cargo_crate', [-24, 0, -114], 0).prop('container', [24, 0, -114], P).prop('crate_large', [-26, 0, -92], 0.2).prop('barrel', [26, 0, -94]).prop('barrel', [27, 0, -93]);
m.prop('lightpost', [-31, 0, -86], P).prop('lightpost', [31, 0, -86], -P).prop('lightpost', [-41.5, 0, -88], P);

// ---------------------------------------------------------------- vehicles

const mount = (model: MountModel, p: V3, yaw: number) => m.add({ kind: 'mount', model, position: p, yaw, faction: null, respawnSeconds: 45 });
// Hangar and well deck.
mount('tank', [-5.5, 0, -30], S);
mount('gun_jeep', [5.5, 0, -36], S);
mount('gun_jeep', [5.5, 0, -22], S);
mount('armored_rover', [-5.5, 0, -14], S);
mount('hauler', [0, 0.25, -66], P);
// Flight deck aircraft.
mount('dropship', [-8, 8, 40], P);
mount('gunship', [-8, 8, 6], P);
mount('skyfighter', [-8, 8, -40], P);
// The bow mounts.
m.add({ kind: 'mount', model: 'turret_mg', position: [-5, 8, 90], yaw: 0, faction: null, respawnSeconds: 30 });
m.add({ kind: 'mount', model: 'turret_mg', position: [5, 8, 90], yaw: 0, faction: null, respawnSeconds: 30 });
// The boarders' boats on the dock and the helipad.
mount('speeder', [-20, 0, -104], 0);
mount('speeder', [20, 0, -104], 0);
mount('hauler', [0, 0, -100], 0);
mount('dropship', [-56, 0, -100], P);

// ---------------------------------------------------------------- objectives

// Hostage Rescue: four sailors held in the brig cells; bring them out to the dock or the helipad.
for (const y of [6, 7, 8, 9]) m.hostage(at(2, y, 0, 1.5, 0), -P);
m.rescue([0, 0, -106], 10);
m.rescue([-56, 0, -100], 7);
// Bomb: the engine room (A) and the bridge (B).
m.add({ kind: 'bombsite', position: [0, 0, 12], label: 'A', radius: 5 });
m.add({ kind: 'bombsite', position: at(2, 0, 3, 0, -4), label: 'B', radius: 4 });
// Capture the Flag: the stern dock against the bow.
m.flag(BOARD, [0, 0, -116], 0);
m.flag(CREW, [0, 8, 96], S);

// ---------------------------------------------------------------- spawns

// Boarders: the dock and the helipad.
for (const [x, z] of [[-26, -100], [-20, -116], [-12, -100], [-6, -116], [6, -116], [12, -100], [20, -116], [26, -100], [-8, -94], [8, -94], [-64, -110], [-48, -110]] as const) m.spawn([x, 0, z], 0, BOARD);
// Crew: berthing, the mess, the galleries and the forward passageways.
for (const p of [at(-2, 4, 1), at(-1, 5, 1), at(-2, 7, 1), at(-1, 9, 1), at(-2, 9, 1), at(2, 5, 1), at(1, 6, 1), at(2, 8, 1), at(0, 5, 0), at(0, 8, 0), at(-2, 0, 1), at(2, 2, 1)]) m.spawn(p, S, CREW);
// Deathmatch: all over the ship.
for (const [p, yaw] of [
  [at(-2, -8, 0), 0], [at(2, -6, 0), 0], [at(-2, -1, 0), 0], [at(0, -6, 0), 0], [at(0, -3, 0, 0, 2), S], [at(-2, 2, 0, 0, 0), P],
  [at(2, 2, 0), -P], [at(-2, 5, 0), 0], [at(-2, 9, 0), 0], [at(1, 10, 0), S], [at(2, 4, 1), S], [at(1, 9, 1), S],
  [at(-2, -6, 1), 0], [at(2, -5, 1), 0], [at(-1, -8, 2, 0, 0), 0], [at(1, 8, 2), S], [at(-1, 2, 2), 0], [at(2, 0, 2), -P],
  [at(2, 1, 3), S], [[-14, 0, -110], 0], [[14, 0, -110], 0], [at(1, -6, 2), 0],
] as [V3, number][]) m.spawn(p, yaw, null);

// ---------------------------------------------------------------- pickups

m.pickup('weapon_sniper', at(2, 0, 4)).pickup('ammo_sniper', at(1, 0, 4));
m.pickup('weapon_rockets', [0, 0, 16]).pickup('ammo_explosive', at(0, -2, 0, 0, 0));
m.pickup('weapon_railgun', [0, 8, 100]).pickup('ammo_cells', at(-1, 10, 1));
m.pickup('weapon_smg', at(-2, -6, 0)).pickup('weapon_smg', at(2, -2, 0)).pickup('weapon_smg', at(0, 6, 1));
m.pickup('weapon_shotgun', at(0, 7, 0)).pickup('weapon_shotgun', at(-2, 3, 1)).pickup('weapon_auto_shotgun', at(1, 7, 0));
m.pickup('weapon_rifle', at(0, -9, 0)).pickup('weapon_rifle', [-14, 0, -104]).pickup('weapon_burst_rifle', at(-1, 0, 2)).pickup('weapon_burst_rifle', at(2, 9, 1));
m.pickup('weapon_lmg', at(-2, -4, 1)).pickup('weapon_marksman', at(2, -1, 3)).pickup('weapon_launcher', at(2, 4, 0)).pickup('weapon_hand_cannon', at(-1, 4, 0));
m.pickup('ammo', at(-1, 8, 0)).pickup('ammo', at(2, -7, 1)).pickup('ammo', [-56, 0, -108]).pickup('ammo_rifle', at(0, -5, 0)).pickup('ammo_rifle', at(-2, 8, 1));
m.pickup('ammo_shells', at(1, 5, 0)).pickup('ammo_shells', at(-2, 1, 0)).pickup('ammo_light', at(2, -9, 0));
m.pickup('grenades', at(-2, 6, 0)).pickup('grenades', [0, 0, -88]).pickup('grenades', at(0, 4, 2));
m.pickup('armor_large', at(-2, 4, 0)).pickup('armor_small', at(2, -4, 1)).pickup('armor_small', at(-1, -9, 2)).pickup('armor_small', [26, 0, -110]);
m.pickup('health_large', at(2, 9, 1, 0, -2)).pickup('health_large', at(0, 1, 0, 0, 0)).pickup('health_large', at(1, 0, 2));
for (const p of [at(-2, -9, 0), at(2, -9, 0, 0, 2), at(-2, 2, 1), at(2, 3, 1), at(0, 9, 0), at(-2, 8, 0), at(-1, -2, 2), at(1, 5, 2), at(0, -9, 2), [-24, 0, -104] as V3, at(1, 10, 1), at(2, -2, 2)]) m.pickup('health_small', p);

// ---------------------------------------------------------------- dressing

m.dress({ x0: -2, y0: 4, x1: -1, y1: 5, z: 1 }, 'barracks', { density: 'full' });
m.dress({ x0: -2, y0: 7, x1: -1, y1: 9, z: 1 }, 'barracks', { density: 'full' });
m.dress([-2, 6, 1], 'bathroom');
m.dress({ x0: 1, y0: 5, x1: 2, y1: 6, z: 1 }, 'dining', { density: 'full' });
m.dress({ x0: 1, y0: 7, x1: 2, y1: 8, z: 1 }, 'kitchen', { density: 'full' });
m.dress({ x0: 1, y0: 9, x1: 2, y1: 9, z: 1 }, 'bedroom');
m.dress([2, 4, 1], 'office');
m.dress({ x0: -2, y0: 4, x1: -1, y1: 5, z: 0 }, 'armoury');
m.dress({ x0: -2, y0: 7, x1: -1, y1: 9, z: 0 }, 'storage', { density: 'full' });
m.dress([-2, 6, 0], 'storage');
m.dress([2, 4, 0], 'armoury');
m.dress([1, 5, 0], 'office', { density: 'sparse' });
m.dress({ x0: -1, y0: 10, x1: 1, y1: 10, z: 0 }, 'warehouse');
m.dress({ x0: -1, y0: 10, x1: 1, y1: 10, z: 1 }, 'storage');
m.dress({ x0: 2, y0: -2, x1: 2, y1: 1, z: 2 }, 'server', { density: 'sparse' });
m.dress({ x0: 2, y0: -2, x1: 2, y1: 1, z: 3 }, 'conference', { density: 'sparse' });
for (const y of [6, 7, 8, 9]) m.dress([2, y, 0], 'cell', { density: 'sparse' });

// ---------------------------------------------------------------- lights

m.lightRooms({ color: '#f0f4ff', intensity: 0.95, range: 9 });
// Red night lighting in the passageways under the galleries, sodium in the well and hangar, the engine room.
for (let y = -9; y <= -1; y += 2) {
  m.light(at(0, y, 0, -6, 0, 7.4), { fixture: 'bulb', color: '#ffd28a', intensity: 1.2, range: 14 });
  m.light(at(0, y, 0, 6, 0, 7.4), { fixture: 'bulb', color: '#ffd28a', intensity: 1.2, range: 14 });
}
for (let y = 0; y <= 3; y++) m.light(at(0, y, 0, 0, 0, 7.3), { fixture: 'bulb', color: '#ffe0a8', intensity: 1.3, range: 14 });
for (const y of [-2, -1, 0, 1]) m.light(at(2, y, 3, 0, 0, 3.45), { color: '#ff6a5a', intensity: 0.7, range: 8 });
for (const y of [-2, -1, 0, 1]) m.light(at(2, y, 2, 0, 0, 3.45), { color: '#d8e8ff', intensity: 0.9, range: 8 });
for (let y = 4; y <= 9; y++) for (const x of [-2, -1, 0, 1, 2]) if (has(x, y, 1) && !has(x, y, 2) && m.doc.classicStructure.tiles.some((t) => t.x === x && t.y === y && t.z === 1 && t.tile === 'core.room')) m.light(at(x, y, 1, 0, 0, 3.45), { color: '#f0f4ff', range: 9 });
// Flight deck: edge lights, floodlights on the island, the landing spots.
for (let z = -82; z <= 76; z += 12) {
  m.light([-19.6, 8.3, z], { fixture: 'none', color: '#5aa0ff', intensity: 0.7, range: 6 });
  m.light([19.6, 8.3, z], { fixture: 'none', color: '#5aa0ff', intensity: 0.7, range: 6 });
}
for (const z of [-60, -36, -12, 36, 60]) m.light([-8, 8.4, z], { fixture: 'none', color: '#ffd060', intensity: 0.9, range: 9 });
for (const z of [-18, 10]) m.light([11.6, 14.5, z], { fixture: 'wall', color: '#fff4dc', intensity: 2, range: 28, yaw: -P });
m.light([11.6, 15, -4], { fixture: 'wall', color: '#fff4dc', intensity: 2, range: 28, yaw: -P });
m.light([16, 27.6, 0], { fixture: 'none', color: '#ff2020', intensity: 1.2, range: 6 });
// The dock and the helipad.
for (const [x, z] of [[-30, -86], [30, -86], [-41, -88], [0, -118]] as const) m.light([x, 4.5, z], { fixture: 'none', color: '#ffd8a0', intensity: 1.6, range: 18 });
for (const [x, z] of [[-62, -106], [-50, -106], [-62, -94], [-50, -94]] as const) m.light([x, 0.3, z], { fixture: 'none', color: '#40ff60', intensity: 0.8, range: 6 });
m.light([0, 7, -86], { fixture: 'wall', color: '#ffb040', intensity: 1.4, range: 14, yaw: S });

m.bounds('invisible', 0, { min: [-120, -150], max: [120, 130] }, 40);
m.meta({
  description:
    'An amphibious assault ship riding at anchor on a black sea at night. The Boarders start on the floating dock off the stern with speeders, a hovercraft and a dropship: up the stern gate into the flooded well deck and the vehicle hangar, up the cargo lifts or the side ladders onto the flight deck, or fly in. The Crew hold the ship: long passageways under the hangar galleries, the engine room and its catwalks, berthing, the mess and galley, the brig, and the island with its bridge and radar deck. Hostages wait in the brig; bomb sites in the engine room and on the bridge; flags at the bow and the stern dock.',
  modes: ['core.hostage', 'core.bomb', 'core.tdm', 'core.ctf', 'core.deathmatch'],
  players: [12, 24],
});
// The map's picture: the automatic camera frames a poor view here (tools/content/capture-map-shots.mjs).
m.thumbnailCamera([30, 28, -140], [0, 6, -60]);
await m.save();
