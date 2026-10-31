/**
 * Style Pack tiles for 12 Snow Outpost (the owner's "Tileset 05" sheet): an
 * arctic military and research outpost, box-built like the other packs'
 * tiles. Prefab huts and barracks with snow-laden roofs you climb onto by an
 * outside steel stair, a vehicle hangar (hang a Roll-up Door in its wide
 * doorway) with a mezzanine, a concrete bunker under a snow berm you can walk
 * up, a steel watchtower, a radar dome, a comms hut under an antenna mast, a
 * fuel depot, steel catwalks and stairs, ice walls, frozen cliffs and the
 * snow drifts that climb them, a frozen lake (plain, ridged, or broken open
 * over black water) and a ploughed snow road. Box helpers come from
 * packTilesMedieval.ts.
 */
import type { LocalBox, TileDefinition } from './catalog.ts';
import { ALL, at, b, door, flight, footprint, paint, perimeter, rail, shell, subtract, switchback, tilted, trim, wall, win } from './packTilesMedieval.ts';

type Box = LocalBox;

// ---------------------------------------------------------------- materials

const SNOW = 'packed_snow';
const DRIFT = 'drift_snow';
const ICE = 'lake_ice';
const GLACIER = 'glacier_ice';
const RED = 'prefab_red';
const WHITE = 'prefab_white';
const CRETE = 'snowy_concrete';
const ROCK = 'frozen_rock';
const GRATE = 'steel_grating';
const STEEL = 'pbr_steel';
const CORR = 'pbr_grey_corrugated';
const steel = (box: Box) => paint(box, STEEL, '#a8b0b8');
const grate = (box: Box) => paint(box, GRATE);
const drift = (box: Box) => paint(box, DRIFT);

/** A flat roof: a steel deck `y0`..`y0 + 0.15` under 0.1 m of snow, so its top is `y0 + 0.25`. */
const flatRoof = (x0: number, z0: number, x1: number, z1: number, y0: number): Box[] => [steel(b(x0, y0, z0, x1, y0 + 0.15, z1)), drift(b(x0, y0 + 0.15, z0, x1, y0 + 0.25, z1))];

/** A round-ish disc of radius `r` (four slabs turned 45° apart), y0..y1: dome tiers, tank ends. */
const disc = (r: number, y0: number, y1: number, material: string, tint?: string): Box[] =>
  [0, 1, 2, 3].map((k) => ({ ...paint(b(-r, y0, -r * 0.42, r, y1, r * 0.42), material, tint), ...(k ? { yaw: (k * Math.PI) / 4 } : {}) }));

/** An eight-sided tank or pipe of diameter `d` along x from x0 to x1, its axis at (y, z): a box and the same box rolled 45°. */
const tank = (x0: number, x1: number, y: number, z: number, d: number, material: string, tint?: string): Box[] =>
  [0, Math.PI / 4].map((pitch) => paint(tilted((x0 + x1) / 2, y, z, [x1 - x0, d * 0.83, d * 0.83], pitch ? { pitch } : {}), material, tint));

/**
 * A gable roof over x0..x1, z0..z1 (ridge along x, or z), its top exactly
 * `eave` high on the outer edges (a deck at that height steps straight onto
 * it), rising at `pitch` under snow, the gable ends filled from `wallTop`.
 */
function gable(x0: number, z0: number, x1: number, z1: number, eave: number, wallTop: number, pitch: number, o: { ridge?: 'x' | 'z'; ends?: string; endTint?: string } = {}): Box[] {
  const alongX = (o.ridge ?? 'x') === 'x';
  const tan = Math.tan(pitch);
  const [a0, a1] = alongX ? [z0, z1] : [x0, x1];
  const [l0, l1] = alongX ? [x0, x1] : [z0, z1];
  const mid = (a0 + a1) / 2;
  const d = mid - a0 + 0.08;
  const T = 0.25;
  const L = d / Math.cos(pitch);
  const lc = (l0 + l1) / 2;
  const out: Box[] = [];
  for (const s of [1, -1] as const) {
    const ac = (s > 0 ? a0 : a1) + (s * d) / 2 + s * Math.sin(pitch) * (T / 2);
    const yc = eave + (d / 2) * tan - Math.cos(pitch) * (T / 2);
    out.push(drift(alongX ? tilted(lc, yc, ac, [l1 - l0, T, L], { pitch: s * pitch }) : tilted(ac, yc, lc, [L, T, l1 - l0], { roll: -s * pitch })));
  }
  const ridgeY = eave + (mid - a0) * tan;
  out.push(alongX ? trim(l0, ridgeY - 0.05, mid - 0.2, l1, ridgeY + 0.12, mid + 0.2, DRIFT) : trim(mid - 0.2, ridgeY - 0.05, l0, mid + 0.2, ridgeY + 0.12, l1, DRIFT));
  // Gable ends in courses stepping in under the slabs; steel fascias along the eaves.
  const under = T / Math.cos(pitch);
  for (let y = wallTop; y < ridgeY - 0.25; y += 0.4) {
    const y1 = Math.min(y + 0.4, ridgeY - 0.25);
    const reach = Math.max(0.2, (y1 - eave + under) / tan);
    if (a1 - a0 - 2 * reach < 0.1) break;
    for (const e of [l0 + 0.2, l1 - 0.5]) out.push(paint(alongX ? b(e, y, a0 + reach, e + 0.3, y1, a1 - reach, 'wall') : b(a0 + reach, y, e, a1 - reach, y1, e + 0.3, 'wall'), o.ends ?? RED, o.endTint));
  }
  for (const e of [a0, a1 - 0.08]) out.push(alongX ? trim(l0, eave - 0.32, e, l1, eave - 0.12, e + 0.08, STEEL) : trim(e, eave - 0.32, l0, e + 0.08, eave - 0.12, l1, STEEL));
  return out;
}

/** Bunks along a wall (z0..z1 deep) from x0, `n` of them 2.1 m long: a low solid bunk and a top bunk on posts. */
const bunks = (x0: number, z0: number, z1: number, n: number): Box[] =>
  Array.from({ length: n }, (_, i) => {
    const x = x0 + i * 2.4;
    return [paint(b(x, 0, z0, x + 2.1, 0.55, z1), 'pbr_canvas', '#6a7468'), trim(x, 1.45, z0, x + 2.1, 1.65, z1, 'pbr_canvas', '#5a6458'), trim(x, 0, z0, x + 0.08, 1.7, z0 + 0.08, STEEL), trim(x + 2.02, 0, z0, x + 2.1, 1.7, z0 + 0.08, STEEL)];
  }).flat();

// ---------------------------------------------------------------- huts

/** The east wall of a Prefab Hut: the outside stair runs up the strip east of it. */
const HUT_E = 1.2;

/**
 * A prefab hut on one cell: insulated panels round a room 5 × 7.6 m (doors
 * south and north, windows), a flat roof under snow 3.5 m up, and an outside
 * steel stair up the east strip from the north edge to a landing in the
 * south-east corner that runs onto the roof.
 */
function hut(skin: string, tint?: string): Box[] {
  return [
    ...shell(-3.8, -3.8, HUT_E, 3.8, { S: [door(-1.3)], N: [door(-0.2)], W: [win(-1.6), win(1.6)], E: [win(1.8, 1.0)] }, 0, 3.25, skin, 0.3, tint),
    ...flatRoof(-3.8, -3.8, HUT_E, 3.8, 3.25),
    ...flatRoof(HUT_E, -3.8, 3.8, -1.76, 3.25),
    ...flight('z', -1, 3.7, HUT_E + 0.05, 3.75, 13, 0, 0.42).map(grate),
    rail(3.75, -3.8, 3.75, -1.8, 3.5, STEEL),
    // Inside: bunks, a table, a heater glowing by the door; snow on the door hoods and a lip round the roof.
    ...bunks(-3.5, 2.6, 3.5, 1),
    steel(b(-3.4, 0, -0.6, -2.4, 0.8, 0.8)),
    trim(0.4, 0, -3.5, 0.9, 0.9, -3.2, 'pbr_lava'),
    trim(-3.5, 0, -3.5, HUT_E - 0.3, 0.02, 3.5, 'pbr_tread_plate'),
    trim(-2.6, 2.85, -3.95, 0, 3.0, -3.85, DRIFT),
    trim(-1.5, 2.85, 3.85, 1.1, 3.0, 3.95, DRIFT),
    trim(-3.85, 3.5, -3.85, HUT_E, 3.62, -3.7, DRIFT),
    trim(-3.85, 3.5, 3.7, HUT_E, 3.62, 3.85, DRIFT),
  ];
}

/**
 * A barracks on 2 × 1 cells: a long panel hut (bunk rows, doors on every
 * side) under a 25° snow roof whose eaves are 3.5 m up on the south edge and
 * along a steel deck on the north side; a stair climbs to the deck from the
 * north-west, and from the deck you step onto the roof.
 */
function barracks(): Box[] {
  const ZN = 1.2;
  return [
    ...shell(-3.8, -3.8, 11.8, ZN, { S: [door(0), win(4), door(8), win(10.6, 1.4)], N: [door(7.2), win(2)], W: [door(-1.3)], E: [door(-1.3)] }, 0, 3.25, RED),
    steel(b(-3.8, 3.25, -3.8, 11.8, 3.5, ZN)),
    ...gable(-4, -4, 12, 1.4, 3.5, 3.5, (25 * Math.PI) / 180),
    ...flight('x', 1, -2.0, ZN + 0.25, 3.8, 14, 0, 0.45).map(grate),
    grate(b(4.3, 3.25, ZN + 0.2, 11.8, 3.5, 3.9)),
    rail(4.3, 3.8, 11.8, 3.8, 3.5, STEEL),
    rail(11.75, ZN + 0.2, 11.75, 3.8, 3.5, STEEL),
    ...[5, 8.5, 11.5].map((x) => trim(x - 0.1, 0, 3.6, x + 0.1, 3.25, 3.8, STEEL)),
    ...bunks(-3.5, 0.1, 0.95, 3),
    ...bunks(3.9, 0.1, 0.95, 1),
    ...bunks(9.2, -3.5, -2.65, 1),
    steel(b(4.5, 0, -2.2, 6.5, 0.8, -1.2)),
    trim(10.9, 0, -0.4, 11.5, 1.0, 0.4, 'pbr_lava'),
    trim(-3.5, 0, -3.5, 11.5, 0.02, 0.9, 'pbr_tread_plate'),
  ];
}

// ---------------------------------------------------------------- big buildings

/**
 * Vehicle hangar, 2 × 2 cells: corrugated walls 7 m high, a 6 × 4.6 m doorway
 * south for a Roll-up Door, doors west, east and north, a grating mezzanine
 * 4 m up along the north wall (stair up the west side), a snow roof.
 */
function hangar(): Box[] {
  return [
    ...shell(-3.8, -3.8, 11.8, 11.8, { S: [[1, 7, 0, 4.6], win(10, 2, 1.2, 2.4)], N: [door(1), door(7), win(4, 3, 5, 6.2)], W: [door(-1.2), win(9.6, 2, 5, 6.2)], E: [door(-1.2), win(9.6, 2, 5, 6.2)] }, 0, 7, CORR, 0.3, '#d0d4d8'),
    grate(b(-3.5, 3.75, 7.8, 11.5, 4.0, 11.5)),
    ...flight('z', 1, 0.6, -3.5, -1.1, 16, 0, 0.45).map(grate),
    rail(-1.0, 7.8, 11.5, 7.8, 4.0, STEEL),
    ...[-1, 3, 7, 11].map((x) => trim(x - 0.12, 0, 7.75, x + 0.12, 3.75, 7.95, STEEL)),
    ...gable(-4, -4, 12, 12, 7.25, 7, (18 * Math.PI) / 180, { ridge: 'z', ends: CORR, endTint: '#d0d4d8' }),
    // Cover on the hangar floor: a workbench, crates, a tool wall; hazard stripes either side of the doorway.
    steel(b(8.2, 0, 1.0, 10.6, 1.0, 1.9)),
    paint(b(8.6, 0, 4.2, 10.4, 1.8, 6.0), 'pbr_olive_corrugated'),
    paint(b(1.5, 0, 9.0, 3.5, 1.2, 10.8), 'crate_wood'),
    trim(-3.5, 0, -3.5, 11.5, 0.02, 11.5, 'pbr_concrete_dark'),
    ...[0.7, 7].map((x) => trim(x, 0, -3.95, x + 0.3, 4.6, -3.8, 'hazard')),
    trim(0.7, 4.6, -3.95, 7.3, 4.9, -3.8, 'hazard'),
  ];
}

/**
 * A concrete bunker on one cell: a firing slit along the south wall and one
 * west, a door north, a 2.8 m room; snow banked up the east side as a drift
 * ramp from the north edge onto the roof, sandbags on top.
 */
function bunker(): Box[] {
  const X1 = 1.4;
  const H = 3.2;
  const rise = H;
  const run = 5.6;
  const ang = Math.atan2(rise, run);
  const T = 0.4;
  const L = Math.hypot(run, rise);
  const zc = 3.8 - run / 2;
  // Where the ramp's top surface ends: the landing starts exactly there (a landing lapping over a sloped
  // slab leaves the navmesh a sliver it can't stand on, and the bots stop short).
  const zTop = zc - ((L - 0.1) / 2) * Math.cos(ang);
  return [
    ...shell(-3.8, -3.8, X1, 2.0, { S: [[-3.0, 1.2, 1.25, 1.75]], W: [[-2.8, 0.6, 1.25, 1.75]], N: [door(-1.0, 2.2, 2.4)] }, 0, 2.8, CRETE, 0.6),
    paint(b(-3.8, 2.8, -3.8, X1, 3.05, 2.0), CRETE),
    drift(b(-3.8, 3.05, -3.8, 3.8, H, zTop)),
    drift(b(-3.8, 3.05, zTop, X1, H, 2.0)),
    // The drift ramp: rising south from the north edge to the roof's height, a snow bank below it.
    drift(tilted((X1 + 3.9) / 2, rise / 2 - (Math.cos(ang) * T) / 2, zc - (Math.sin(ang) * T) / 2, [3.9 - X1, T, L - 0.1], { pitch: -ang })),
    drift(b(X1, 0, -3.8, 3.8, 3.05, zTop - 0.2)),
    paint(b(-3.7, H, -3.0, -3.1, H + 0.6, 1.8), 'pbr_burlap', '#c8c0a8'),
    paint(b(-3.1, H, -3.7, -1.2, H + 0.6, -3.1), 'pbr_burlap', '#c8c0a8'),
    trim(-3.2, 0, -3.2, X1 - 0.6, 0.02, 1.4, 'pbr_concrete_dark'),
    steel(b(-3.1, 0, -0.8, -2.5, 1.0, 1.2)),
    trim(-3.95, 0, -3.95, X1, 0.7, -3.8, DRIFT),
  ];
}

/** Steel watchtower: four legs, a switchback stair inside them to a lookout 7 m up behind steel parapets, a snow roof on top. */
function watchtower(): Box[] {
  const { steps } = switchback(3.4, 2.0, 28, [6]);
  return [
    ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => steel(b(sx! * 3.6 - 0.18, 0, sz! * 3.6 - 0.18, sx! * 3.6 + 0.18, 9.6, sz! * 3.6 + 0.18))),
    ...steps.map(grate),
    grate(b(-3.8, 6.75, -3.8, 3.8, 7.0, -1.4)),
    ...[[-3.8, -3.8, 3.8, -3.6], [-3.8, 3.6, 3.8, 3.8], [-3.8, -3.6, -3.6, 3.6], [3.6, -3.6, 3.8, 3.6]].map(([x0, z0, x1, z1]) => paint(b(x0!, 7.0, z0!, x1!, 8.1, z1!), WHITE)),
    ...flatRoof(-4, -4, 4, 4, 9.6),
    trim(-0.6, 9.2, -3.95, 0.6, 9.6, -3.7, STEEL, '#e8e0b0'),
    ...[-1, 1].map((s) => ({ ...trim(-3.5, 1.0, s * 3.5 - 0.05, 3.5, 6.0, s * 3.5 + 0.05, STEEL), roll: s * 0.7 })),
  ];
}

/** Radar dome: an eight-sided panel drum (a door south, consoles inside) under a white dome 7.4 m high. */
function radarDome(): Box[] {
  const R = 3.5;
  const t = 0.3;
  const len = 2 * (R + t / 2) * Math.tan(Math.PI / 8) + 0.04;
  const out: Box[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    if (k === 6) continue;
    const [px, pz] = [R * Math.cos(a), R * Math.sin(a)];
    out.push({ ...paint(b(px - len / 2, 0, pz - t / 2, px + len / 2, 3.5, pz + t / 2, 'wall'), WHITE), yaw: -(a + Math.PI / 2) });
  }
  // The south side (k = 6) with its doorway.
  out.push(...wall('x', -R, -len / 2, len / 2, [door(0, 2.2, 2.6)], 0, 3.5, WHITE, t));
  for (let i = 0; i < 7; i++) {
    const y = 3.5 + i * 0.55;
    out.push(...disc(Math.sqrt(R * R - (i * 0.55 + 0.1) ** 2) + 0.1, y, y + 0.55, WHITE, i % 2 ? '#e8ecf0' : '#f4f6f8'));
  }
  out.push(...disc(1.1, 7.35, 7.5, DRIFT), steel(b(-0.08, 7.5, -0.08, 0.08, 8.4, 0.08)));
  out.push(paint(b(-1.6, 0, 1.6, 1.6, 1.0, 2.3), 'circuit'), trim(-1.4, 1.0, 2.0, 1.4, 1.8, 2.1, 'light_strip', '#7fd0ff'), trim(-2.8, 0, -2.8, 2.8, 0.02, 2.8, 'pbr_tread_plate'));
  return out;
}

/** A lattice mast `h` high on four legs from a square of half-width `w` at (x, y, z) to `top` at the top, with cross braces every 3 m, a red beacon on top. */
function mast(x: number, y: number, z: number, w: number, top: number, h: number): Box[] {
  const out: Box[] = [];
  const lean = Math.atan2(w - top, h);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const c = (w + top) / 2;
    out.push(paint(tilted(x + sx * c, y + h / 2, z + sz * c, [0.14, h / Math.cos(lean), 0.14], { pitch: sz * lean, roll: sx * lean }), STEEL, '#c84a3a'));
  }
  for (let yy = 3; yy < h - 1; yy += 3) {
    const r = w - ((w - top) * yy) / h;
    for (const s of [-1, 1]) out.push(trim(x - r, y + yy, z + s * r - 0.04, x + r, y + yy + 0.08, z + s * r + 0.04, STEEL, '#e8e8e8'), trim(x + s * r - 0.04, y + yy, z - r, x + s * r + 0.04, y + yy + 0.08, z + r, STEEL, '#e8e8e8'));
  }
  out.push(trim(x - 0.05, y + h, z - 0.05, x + 0.05, y + h + 2.5, z + 0.05, STEEL), trim(x - 0.15, y + h + 2.5, z - 0.15, x + 0.15, y + h + 2.8, z + 0.15, 'beacon_red'));
  return out;
}

// ---------------------------------------------------------------- terrain pieces

/** A ramp of snow rising `rise` toward +Z across the cell (between z = -3.7 and 3.7), its top flush with a cap along the north edge. */
function rampUp(rise: number, x0 = -4, x1 = 4): Box[] {
  const run = 7.3;
  const ang = Math.atan2(rise, run);
  const T = 0.4;
  const L = Math.hypot(run, rise);
  // The cap starts exactly where the slope's top surface ends (see bunker()).
  const zTop = -0.05 + (L / 2) * Math.cos(ang);
  return [
    drift(tilted((x0 + x1) / 2, rise / 2 - (Math.cos(ang) * T) / 2, -0.05 + (Math.sin(ang) * T) / 2, [x1 - x0, T, L], { pitch: ang })),
    drift(b(x0, rise - 0.25, zTop, x1, rise, 4)),
  ];
}

/** Jagged ice blocks along the south edge of a cell (an ice wall 4–6 m high). */
function iceWall(): Box[] {
  const hs = [5.2, 4.1, 6.0, 4.6, 5.6, 4.3];
  return [
    ...hs.map((h, i) => paint(b(-4 + (i * 8) / 6, 0, -4, -4 + ((i + 1) * 8) / 6, h, -2.4 + (i % 2) * 0.4, 'wall'), GLACIER, i % 3 ? undefined : '#c8e8f8')),
    ...[[-2.6, 0.25], [0.2, -0.2], [2.8, 0.3]].map(([x, yaw]) => ({ ...paint(b(x! - 0.7, 0, -2.6, x! + 0.7, 2.2, -1.6), GLACIER, '#d8f0ff'), yaw: yaw! })),
    ...[-3, -0.5, 2.2].map((x) => trim(x, 3.4, -2.42, x + 0.18, 4.0, -2.3, 'glacier_ice', '#ffffff')),
    trim(-4, 0, -2.4, 4, 0.5, -1.4, DRIFT),
  ];
}

/** A frozen cliff filling the cell up to 4 m: rock, a snow top, crags and icicles on the south face (drawn only: the top runs to every edge). */
function cliff(): Box[] {
  return [
    paint(b(-4, 0, -4, 4, 3.85, 4), ROCK),
    drift(b(-4, 3.85, -4, 4, 4.0, 4)),
    ...[[-4, 2.6], [-2.5, 3.7], [-1.0, 3.2], [0.7, 3.75], [2.3, 2.9]].map(([x, h]) => trim(x!, 0, -4, x! + 1.7, h!, -3.88, ROCK, '#7a8088')),
    ...[-3.4, -1.8, -0.2, 1.4, 3.0].map((x, i) => trim(x, 2.9 - (i % 2) * 0.5, -4, x + 0.12, 3.85, -3.85, GLACIER, '#e8f8ff')),
  ];
}

/** The frozen lake's ice sheet over `rect`s (its cracks and bubbles are in the Lake Ice paint). */
const iceSheet = (rects: readonly (readonly [number, number, number, number])[]): Box[] => rects.map(([x0, z0, x1, z1]) => paint(b(x0, -0.2, z0, x1, 0.02, z1), ICE));

// ---------------------------------------------------------------- the tiles

/** The Snow Outpost tiles (Style Pack 12), in palette order. */
export function snowPackTiles(): TileDefinition[] {
  const T = (id: string, category: TileDefinition['category'], displayName: string, blurb: string, cells: TileDefinition['cells'], solids: Box[], ports: TileDefinition['ports'] = ALL, rest: Partial<TileDefinition> = {}): TileDefinition => ({
    id: `snow.${id}`,
    category,
    displayName,
    blurb,
    cells,
    floors: [0],
    ports,
    open: true,
    edgeDefault: 'open',
    solids,
    ...rest,
  });
  const BED = -2.0;
  const hole: [number, number, number, number] = [-1.8, -1.8, 1.8, 1.8];
  return [
    T('hut', 'Buildings', 'Prefab Hut', 'A red insulated-panel hut on one cell: doors south and north, a bunk, a heater; a flat snow roof 3.5 m up, reached by an outside steel stair from the north edge up the east side', footprint(1, 1, 2), hut(RED)),
    T('barracks', 'Buildings', 'Barracks', '2 × 1 cells: a long prefab barracks with bunk rows and doors on every side under a 25° snow roof you can walk on; a stair from the north-west to a steel deck along the north side at the eaves (3.5 m), then onto the roof', footprint(2, 1, 2), barracks(), perimeter(2, 1)),
    T('comms_hut', 'Vertical', 'Comms Tower', 'A white prefab radio hut (roof by the outside stair, as the Prefab Hut) under a red-and-white lattice antenna mast 24 m high with a beacon on top: the outpost\'s landmark', footprint(1, 1, 7), [...hut(WHITE), ...mast(-1.6, 3.5, 1.4, 1.0, 0.25, 21)]),
    T('hangar', 'Large', 'Vehicle Hangar', '2 × 2 cells: a corrugated hangar 7 m high with a 6 m doorway south (hang a Roll-up Door in it), doors west, east and north, a grating mezzanine 4 m up along the north wall (stair up the west side), a snow roof', footprint(2, 2, 3), hangar(), [...perimeter(2, 2), { side: 'N', level: 1, cell: [0, 1] }, { side: 'N', level: 1, cell: [1, 1] }]),
    T('bunker', 'Buildings', 'Snow Bunker', 'A concrete bunker: firing slits south and west, a door north; snow banked up the east side makes a ramp from the north edge onto the roof (sandbags up there)', footprint(1, 1, 2), bunker()),
    T('watchtower', 'Vertical', 'Steel Watchtower', 'Four steel legs, a grating switchback stair inside them to a lookout 7 m up behind white parapets, a snow roof and a floodlight', footprint(1, 1, 3), watchtower()),
    T('radar_dome', 'Buildings', 'Radar Dome', 'An eight-sided white drum (a door south, consoles inside) under a radome 7.5 m high: cover and a landmark', footprint(1, 1, 2), radarDome()),
    T('fuel_depot', 'Open', 'Fuel Depot', 'Two fuel tanks on concrete cradles east to west, pipes and a valve rack, a low bund wall with gaps at the corners: cover between the tanks', footprint(1, 1, 1), [
      ...[-1.9, 1.9].flatMap((z) => [...tank(-3.2, 2.6, 1.75, z, 2.4, 'pbr_white_panel', '#e8e4d8'), ...[-2.2, 1.6].map((x) => paint(b(x, 0, z - 0.9, x + 0.5, 0.75, z + 0.9), CRETE)), trim(-3.3, 1.2, z - 0.9, -3.2, 2.3, z + 0.9, 'hazard')]),
      ...tank(-3.5, 3.9, 0.35, -0.2, 0.3, STEEL, '#8a6a3a').map((x) => ({ ...x, kind: 'trim' as const })),
      steel(b(3.0, 0, -1.0, 3.4, 1.6, 0.6)),
      ...[[-4, -4, -1, -3.7], [1, -4, 4, -3.7], [-4, 3.7, -1, 4], [1, 3.7, 4, 4]].map(([x0, z0, x1, z1]) => paint(b(x0!, 0, z0!, x1!, 0.7, z1!), CRETE)),
    ]),
    T('catwalk', 'Open', 'Steel Catwalk', 'A railed steel-grating catwalk 4 m up, north to south, on posts: over pipes, between buildings, onto a Metal Stair', footprint(1, 1, 2), [
      grate(b(-1.2, 3.75, -4, 1.2, 4.0, 4)),
      rail(-1.2, -4, -1.2, 4, 4.0, STEEL),
      rail(1.2, -4, 1.2, 4, 4.0, STEEL),
      ...[-2.6, 2.6].flatMap((z) => [steel(b(-1.2, 0, z - 0.1, -1.0, 3.75, z + 0.1)), steel(b(1.0, 0, z - 0.1, 1.2, 3.75, z + 0.1)), trim(-1.2, 3.4, z - 0.08, 1.2, 3.75, z + 0.08, STEEL)]),
    ], [...ALL, ...at(1, 'N', 'S')]),
    T('metal_stair', 'Vertical', 'Metal Stair', 'A steel stair from the ground in the south to a Steel Catwalk 4 m up at the north edge, railed both sides', footprint(1, 1, 2), [
      ...flight('z', 1, -2.72, -1.2, 1.2, 16, 0, 0.42).map(grate),
      ...[-1.25, 1.25].map((x) => ({ ...paint(tilted(x, 3.0, 0.65, [0.08, 0.08, 7.0], { pitch: Math.atan2(4, 6.72) }), STEEL), kind: 'trim' as const })),
      ...[-1.25, 1.25].map((x) => trim(x - 0.05, 0, 3.5, x + 0.05, 5.0, 3.6, STEEL)),
    ], [...ALL, ...at(1, 'N')]),
    T('ice_wall', 'Open', 'Ice Wall', 'Jagged blue ice blocks 4–6 m high along the south edge, a few chunks fallen in front (cover): a boundary or a wall to fight along', footprint(1, 1, 2), iceWall()),
    T('ice_cliff', 'Open', 'Frozen Cliff', 'Frozen rock filling the cell up to a snow top 4 m high, a craggy south face hung with icicles: ridges and plateaus (climb them by a Snow Drift)', footprint(1, 1, 2), cliff(), [...ALL, ...at(1, 'N', 'E', 'S', 'W')]),
    T('drift_ramp', 'Open', 'Snow Drift', 'A drift of snow rising from the ground on the south edge to 4 m on the north (27°, walkable, vehicles too): up onto a Frozen Cliff or a roof', footprint(1, 1, 2), [...rampUp(4), trim(-4, 0, -3.8, -3.6, 1.0, 3.6, DRIFT), trim(3.6, 0, -3.8, 4, 1.0, 3.6, DRIFT)], [...ALL, ...at(1, 'N')]),
    T('frozen_lake', 'Open', 'Frozen Lake', 'Thick lake ice, cracked and clouded: lay a sheet of them for a wide open crossing (no cover)', [[0, 0, 0]], iceSheet([[-4, -4, 4, 4]])),
    T('ice_ridge', 'Open', 'Pressure Ridge', 'Frozen lake with a pressure ridge across it: ice slabs heaved up 1–1.6 m (cover on the open ice)', [[0, 0, 0]], [
      ...iceSheet([[-4, -4, 4, 4]]),
      ...[[-2.7, 0.35, 1.2], [-0.9, -0.3, 1.6], [0.9, 0.4, 1.0], [2.7, -0.25, 1.4]].map(([x, roll, h]) => ({ ...paint(b(x! - 0.9, 0, -0.3, x! + 0.9, h!, 0.3), GLACIER), roll: roll!, yaw: roll! * 0.6 })),
    ]),
    T('ice_hole', 'Open', 'Ice Hole', 'Frozen lake broken open: a 3.6 m hole over black water 2 m down (fill it with Water, lay Thin Ice over it if you like), steps cut down its north side to climb out', [[0, 0, 0]], [
      ...iceSheet(subtract([-4, -4, 4, 4], [hole])),
      ...[[-1.8, -2.2, 1.8, -1.8], [-1.8, 1.8, 1.8, 2.2], [-2.2, -1.8, -1.8, 1.8], [1.8, -1.8, 2.2, 1.8]].map(([x0, z0, x1, z1]) => paint(b(x0!, BED, z0!, x1!, -0.2, z1!), GLACIER, '#6a9ab0')),
      ...Array.from({ length: 8 }, (_, i) => paint(b(-1.8, BED, 1.8 - (i + 1) * 0.42, 1.8, BED + (8 - i) * 0.25, 1.8 - i * 0.42), GLACIER, '#8ab8cc')),
    ], ALL, { floors: [], extraFloors: [b(-1.8, BED - 0.5, -1.8, 1.8, BED, 1.8)] }),
    T('road', 'Open', 'Snow Road', 'A ploughed road north to south: packed snow with dark tyre tracks, low banks of ploughed snow along both sides (vehicles, snowmobiles)', [[0, 0, 0]], [
      trim(-4, 0, -4, 4, 0.02, 4, SNOW),
      ...[-1.6, -0.9, 0.9, 1.6].map((x) => trim(x - 0.25, 0.02, -4, x + 0.25, 0.03, 4, SNOW, '#8a9098')),
      ...[-1, 1].map((s) => trim(s > 0 ? 3.2 : -4, 0, -4, s > 0 ? 4 : -3.2, 0.6, 4, DRIFT)),
    ]),
  ];
}
