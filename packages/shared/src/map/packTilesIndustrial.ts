/**
 * Style Pack tiles for 13 Industrial Factory (owner, 2026-11-12): a working
 * factory built from our own boxes. A steel-framed hall with a mezzanine, a
 * pipe rack to walk and drive under, a catwalk crossing, a conveyor line, a
 * loading bay (ramp, dock, canopy), a silo with a stair round it and a control
 * room on legs. Box helpers come from packTilesMedieval.ts, the round ones
 * (tank, disc) from packTilesSnow.ts.
 */
import type { LocalBox, TileDefinition } from './catalog.ts';
import { ALL, at, b, door, flight, footprint, paint, perimeter, rail, shell, switchback, tilted, trim, wall, type Opening } from './packTilesMedieval.ts';
import { disc, tank } from './packTilesSnow.ts';

type Box = LocalBox;

const GRATE = 'steel_grating';
const STEEL = 'pbr_steel';
const CORR = 'pbr_grey_corrugated';
const RUST = 'pbr_rusted_plate';
const CRETE = 'pbr_concrete';
const PANEL = 'pbr_white_panel';
const SHEET = '#c8ccd0';
const steel = (box: Box) => paint(box, STEEL, '#8a9098');
const grate = (box: Box) => paint(box, GRATE);
/** Steel posts 2 × `t` square at each [x, z], from y0 to y1. */
const posts = (pts: readonly (readonly [number, number])[], y0: number, y1: number, t = 0.1): Box[] => pts.map(([x, z]) => steel(b(x - t, y0, z - t, x + t, y1, z + t)));
/** A flight as open grating treads (0.3 m slabs: you walk and shoot under it). */
const treads = (steps: Box[]): Box[] => steps.map((s) => grate({ ...s, min: [s.min[0], s.max[1] - 0.3, s.min[2]] }));
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;

/**
 * Factory hall, 2 × 2 cells: sheet walls 7.5 m high on a steel frame with an
 * open window band 5 m up, a 6 × 4.6 m doorway south for a Roll-up Door, doors
 * on every side, a grating mezzanine 4 m up along the north wall (stair up the
 * east side) with a doorway at each north cell onto a catwalk outside.
 */
function hall(): Box[] {
  const band: Opening = [-2.6, 10.6, 5, 6.4];
  const north = [0, 8].flatMap((c): Opening[] => [door(c), [c - 1.1, c + 1.1, 3.75, 6.4]]);
  return [
    ...shell(-3.8, -3.8, 11.8, 11.8, { S: [[1, 7, 0, 4.6], band], N: north, W: [door(0), band], E: [door(-1.2), band] }, 0, 7.5, CORR, 0.3, SHEET),
    paint(b(-4, 7.5, -4, 12, 7.7, 12), CORR, '#9aa0a8'),
    trim(2, 7.7, -3, 6, 8.4, 11, CORR, SHEET),
    // The frame: columns against the side walls and a beam across under the roof.
    ...[-3.3, 1.6, 6.5].flatMap((z) => [trim(-3.5, 0, z - 0.1, -3.3, 7.1, z + 0.1, STEEL), trim(11.3, 0, z - 0.1, 11.5, 7.1, z + 0.1, STEEL), trim(-3.5, 7.1, z - 0.1, 11.5, 7.5, z + 0.1, STEEL)]),
    grate(b(-3.5, 3.75, 7.8, 11.5, 4, 11.5)),
    ...[0, 8].map((c) => grate(b(c - 1.1, 3.75, 11.5, c + 1.1, 4, 12))),
    ...flight('z', 1, 0.6, 9.1, 11.5, 16, 0, 0.45).map(grate),
    rail(-3.5, 7.8, 9, 7.8, 4, STEEL),
    ...[-3, 1, 5, 9].map((x) => trim(x - 0.12, 0, 7.75, x + 0.12, 3.75, 7.95, STEEL)),
    // Cover on the floor: two machine beds; hazard stripes round the big doorway.
    paint(b(-2.4, 0, 1.2, 0.4, 1.3, 4.6), RUST),
    steel(b(4.2, 0, 3.4, 7, 1, 4.6)),
    ...[0.7, 7].map((x) => trim(x, 0, -3.95, x + 0.3, 4.6, -3.8, 'hazard')),
    trim(0.7, 4.6, -3.95, 7.3, 4.9, -3.8, 'hazard'),
  ];
}

/** Pipe rack: two steel bents carrying three pipes east to west 3 m up. */
function pipeRack(): Box[] {
  const pipes = [[-0.95, 0.7, PANEL, '#d8d4c8'], [0, 0.5, STEEL, '#c8a030'], [0.9, 0.8, RUST, '']] as const;
  return [
    ...posts([-2.8, 2.8].flatMap((x) => [[x, -1.6], [x, 1.6]] as const), 0, 4.2, 0.12),
    ...[-2.8, 2.8].map((x) => steel(b(x - 0.1, 2.85, -1.48, x + 0.1, 3.05, 1.48))),
    ...pipes.flatMap(([z, d, m, tint]) => tank(-4, 4, 3.05 + d * 0.415, z, d, m, tint || undefined)),
  ];
}

/** Catwalk crossing: grating decks 4 m up to all four edges, railed, on four legs. */
function crossing(): Box[] {
  return [
    grate(b(-1.2, 3.75, -4, 1.2, 4, 4)),
    ...[-4, 1.2].map((x) => grate(b(x, 3.75, -1.2, x + 2.8, 4, 1.2))),
    ...CORNERS.flatMap(([sx, sz]) => [rail(sx * 1.2, sz * 1.13, sx * 1.2, sz * 4, 4, STEEL), rail(sx * 1.27, sz * 1.2, sx * 4, sz * 1.2, 4, STEEL)]),
    ...posts(CORNERS.map(([sx, sz]) => [sx * 1.1, sz * 1.1] as const), 0, 3.75),
  ];
}

/** Conveyor line: a waist-high belt on a steel bed north to south, a guard rail along its east side. */
function conveyor(): Box[] {
  return [
    steel(b(-0.5, 0, -3, 0.5, 0.85, 3)),
    paint(b(-0.6, 0.85, -3.2, 0.6, 1.05, 3.2), 'pbr_tread_plate', '#4a4c50'),
    rail(0.72, -3.2, 0.72, 3.2, 0, STEEL, 1.5),
    trim(-0.53, 0.45, -3, -0.5, 0.85, 3, 'hazard'),
    ...[-3.1, 3.1].map((z) => trim(-0.7, 0.8, z - 0.12, 0.65, 1.1, z + 0.12, STEEL)),
  ];
}

/**
 * Loading bay, 2 × 1 cells: a concrete dock 1.25 m high along the south of a
 * sheet wall, a ramp up its west end, a canopy on posts; a 6 × 4.6 m doorway in
 * the wall at dock height (hang a Roll-up Door) and steps down behind it to the
 * north. The west 1.5 m stays clear at ground level.
 */
function bay(): Box[] {
  const [X0, X1, Z0, Z1, H] = [-2.5, 1.5, -2.2, 1, 1.25];
  const ang = Math.atan2(H, X1 - X0);
  const T = 0.4;
  const crete = (box: Box) => paint(box, CRETE);
  return [
    // The ramp's top surface ends exactly where the dock starts (the navmesh note in packTilesSnow.ts).
    crete(tilted((X0 + X1) / 2 + (Math.sin(ang) * T) / 2, H / 2 - (Math.cos(ang) * T) / 2, (Z0 + Z1) / 2, [Math.hypot(X1 - X0, H), T, Z1 - Z0 - 0.1], { roll: ang })),
    crete(b(-0.2, 0, Z0 + 0.1, X1, 0.5, Z1 - 0.1)),
    crete(b(X1, 0, Z0, 12, H, Z1)),
    crete(b(3, 0, Z1, 9, H, Z1 + 0.3)),
    ...flight('z', -1, 3.8, 3, 9, 5).map(crete),
    ...wall('x', Z1 + 0.15, X0, 12, [[3, 9, 0, H + 4.6]], 0, 6.2, CORR, 0.3, SHEET),
    paint(b(X0, 6.2, -2.7, 12, 6.4, Z1 + 0.3), CORR, '#9aa0a8'),
    ...posts([[1.7, -2], [6.8, -2], [11.8, -2]], H, 6.2),
    trim(X1, H - 0.45, Z0 - 0.04, 12, H, Z0, 'hazard'),
  ];
}

/**
 * Silo: an eight-sided tank 2.8 m across on a concrete skirt, an open grating
 * stair 2.4 m wide round it (four flights with full-width landings: north 2 m
 * and 6 m up, south 4 m and 8 m up, the south ones carried to the cell's edge
 * by a sill for a catwalk) to a railed deck on top. Navmesh notes: the bots'
 * navmesh keeps 0.8 m off every edge and wall, so a stair under 2.4 m wide
 * leaves it a strip a rotation can lose; and a switchback whose steps run to
 * the cell's very edge (h = 4) drops off it, so the stair stops 0.1 m short.
 */
function silo(): Box[] {
  const R = 1.5;
  const H = 3.9;
  return [
    ...disc(1.45, 0, 0.8, CRETE),
    ...disc(1.4, 0.8, 7.75, PANEL, '#d8d4c8'),
    ...[2.6, 5.2].flatMap((y) => disc(1.46, y, y + 0.15, STEEL)).map((x) => ({ ...x, kind: 'trim' as const })),
    ...switchback(H, H - R, 32, [7]).steps.map(grate),
    ...[4, 8].map((y) => grate(b(-1.2, y - 0.25, -4, 1.2, y, -H))),
    grate(b(-R, 7.75, -R, R, 8, R)),
    ...CORNERS.map(([sx, sz]) => trim(sx * R - (sx + 1) * 0.1, 0, sz * R - (sz + 1) * 0.1, sx * R + (1 - sx) * 0.1, 7.75, sz * R + (1 - sz) * 0.1, STEEL)),
    // Rails round the top: the south edge (a gap in the middle for a catwalk), its ends, and the deck.
    ...[-1, 1].flatMap((s) => [rail(s * 1.2, 0.07 - H, s * H, 0.07 - H, 8, STEEL), rail(s * (H - 0.07), 0.14 - H, s * (H - 0.07), -R, 8, STEEL)]),
    rail(R, -R - 0.07, H - 0.14, -R - 0.07, 8, STEEL),
    rail(-R, R - 0.07, R, R - 0.07, 8, STEEL),
    rail(R - 0.07, -R, R - 0.07, R - 0.14, 8, STEEL),
    rail(0.07 - R, -1.1, 0.07 - R, R - 0.14, 8, STEEL),
  ];
}

/**
 * Control room: a panel cabin on legs, its floor 4 m up, an open window band
 * round three sides and a door north onto a grating balcony that runs to the
 * cell's north edge (a gap in its rail for a catwalk); an open grating stair
 * climbs the east side from the south to the balcony. (The door faces the
 * balcony, not the stair head: a doorway beside a 1 m landing leaves the
 * navmesh, which keeps 0.8 m off walls and edges, nothing to stand on.)
 */
function controlRoom(): Box[] {
  const [X1, Z1] = [1.5, 1.6];
  const band: Opening = [-3, 0.7, 1, 2.2];
  const side: Opening = [-3.1, 0.9, 1, 2.2];
  return [
    ...posts([[-3.6, -3.6], [X1 - 0.2, -3.6], [X1 - 0.2, 3.7], [-3.6, 3.7]], 0, 3.75, 0.14),
    paint(b(-3.8, 3.75, -3.8, X1, 4, Z1), 'pbr_tread_plate'),
    ...shell(-3.8, -3.8, X1, Z1, { S: [band], N: [door(-1.2, 2.2, 2.6)], W: [side], E: [side] }, 4, 7, PANEL, 0.25, '#d8d4c8'),
    paint(b(-4, 7, -4, X1 + 0.2, 7.2, Z1 + 0.2), CORR, '#9aa0a8'),
    paint(b(-3, 4, -3.4, 0, 4.9, -2.9), 'circuit'),
    grate(b(-3.8, 3.75, Z1, X1, 4, 4)),
    grate(b(X1, 3.75, 2.82, 3.9, 4, 4)),
    ...treads(flight('z', 1, -3.9, X1, 3.9, 16, 0, 0.42)),
    rail(-3.8, 3.93, -1.2, 3.93, 4, STEEL),
    rail(1.2, 3.93, 3.9, 3.93, 4, STEEL),
    rail(-3.73, Z1, -3.73, 3.86, 4, STEEL),
    rail(3.83, 2.82, 3.83, 3.86, 4, STEEL),
  ];
}

/** The Industrial Factory tiles (Style Pack 13), in palette order. */
export function industrialPackTiles(): TileDefinition[] {
  const T = (id: string, category: TileDefinition['category'], displayName: string, blurb: string, cells: TileDefinition['cells'], solids: Box[], ports: TileDefinition['ports'] = ALL): TileDefinition => ({
    id: `industrial.${id}`,
    category,
    displayName,
    blurb,
    cells,
    floors: [0],
    ports,
    open: true,
    edgeDefault: 'open',
    solids,
  });
  return [
    T('factory_hall', 'Large', 'Factory Hall', '2 × 2 cells: a steel-framed sheet hall 7.5 m high with an open window band, a 6 m doorway south (hang a Roll-up Door in it), doors on every side, a grating mezzanine 4 m up along the north wall (stair up the east side) with doorways north onto a catwalk', footprint(2, 2, 3), hall(), [...perimeter(2, 2), ...perimeter(2, 2, 1).filter((p) => p.side === 'N')]),
    T('pipe_rack', 'Open', 'Pipe Rack', 'Three pipes east to west on steel bents 3 m up: walk and drive under them, run them in a row across a yard', footprint(1, 1, 2), pipeRack()),
    T('catwalk_cross', 'Open', 'Catwalk Crossing', 'A railed steel-grating crossing 4 m up on four legs, open to all four sides: where catwalks meet over the factory floor', footprint(1, 1, 2), crossing(), [...ALL, ...at(1, 'N', 'E', 'S', 'W')]),
    T('conveyor_line', 'Open', 'Conveyor Line', 'A waist-high conveyor north to south with a guard rail along its east side: cover to fight along (it does not move)', footprint(1, 1, 1), conveyor()),
    T('loading_bay', 'Buildings', 'Loading Bay', '2 × 1 cells: a concrete dock 1.25 m high under a canopy, a ramp up its west end, a 6 m doorway in the back wall (hang a Roll-up Door in it) with steps down behind to the north', footprint(2, 1, 2), bay(), perimeter(2, 1)),
    T('silo', 'Vertical', 'Silo', 'An eight-sided tank 2.8 m across with an open steel stair round it to a railed deck 8 m up; its south landings (4 m and 8 m) reach the edge for a catwalk', footprint(1, 1, 3), silo(), [...ALL, ...at(1, 'S'), ...at(2, 'S')]),
    T('control_room', 'Buildings', 'Control Room', 'A cabin on legs 4 m up with a window band on three sides and a door north onto a railed balcony at the north edge (for a catwalk); an open stair up the east side from the south; walk under it', footprint(1, 1, 2), controlRoom(), [...ALL, ...at(1, 'N')]),
  ];
}
