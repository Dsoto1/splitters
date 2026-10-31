/**
 * Style Pack tiles for 11 Coastal Harbor (the owner's "Tileset 03" sheet), box-built
 * with the Medieval pack's helpers: timber piers and boardwalks on piles over the
 * water (swim under them), granite quay walls with bollards, sea wall steps, a
 * slipway and a shingle beach down into the water, a breakwater, a warehouse, a net
 * shed and the harbourmaster's office to fight through, a lighthouse gallery and a
 * crane platform to snipe from, a fish market and a harbour arch.
 *
 * The harbour's levels: quay and decks at 0, the water's surface at HARBOR_SEA (too
 * high to climb out of without the steps, slipway, beach or a Ladder), its bed at
 * HARBOR_BED. Fill the water cells with a Harbour Water body.
 */
import type { LocalBox, TileDefinition } from './catalog.ts';
import { ALL, MEDIEVAL_EAVES as EAVES, b, door, flight, footprint, gableRoof, paint, perimeter, rail, shell, subtract, switchback, tilted, trim, wall, win, type Opening } from './packTilesMedieval.ts';

type Box = LocalBox;

/** The water's surface and the harbour bed (m, below the quay). */
export const HARBOR_SEA = -1.5;
export const HARBOR_BED = -4;
const BED = HARBOR_BED;

const DECK = 'pier_decking';
const GRANITE = 'quay_granite';
const SETTS = 'harbour_setts';
const STEEL = 'pbr_steel';
const PILE_TINT = '#5a5048';

/** The harbour bed under [x0, z0, x1, z1] (an extra floor). */
const bed = (x0: number, z0: number, x1: number, z1: number): Box => paint(b(x0, BED - 0.5, z0, x1, BED, z1), 'sea_bed');
/** A timber pile from the bed up to `top`. */
const pile = (x: number, z: number, top = -0.25, r = 0.18): Box => paint(b(x - r, BED, z - r, x + r, top, z + r), 'oak_beam', PILE_TINT);
/** Deck boards at the quay's level. */
const deck = (x0: number, z0: number, x1: number, z1: number): Box => paint(b(x0, -0.25, z0, x1, 0, z1), DECK);
/** A cast-iron bollard on the quay (solid, knee high). */
const bollard = (x: number, z: number): Box[] => [paint(b(x - 0.2, 0, z - 0.2, x + 0.2, 0.55, z + 0.2), STEEL, '#2a2c30'), trim(x - 0.28, 0.55, z - 0.28, x + 0.28, 0.66, z + 0.28, STEEL, '#2a2c30')];
/** Granite quay from the bed to the top over [x0, z0, x1, z1], paved on top. */
const quayBlock = (x0: number, z0: number, x1: number, z1: number): Box[] => [paint(b(x0, BED, z0, x1, 0, z1), GRANITE), trim(x0, 0, z0, x1, 0.02, z1, SETTS)];
/** The coping along a quay edge (a low kerb) and the weed line on the face below it; `n` is the side the water is on. */
function edge(axis: 'x' | 'z', at0: number, a0: number, a1: number, n: 1 | -1): Box[] {
  const [c0, c1] = n > 0 ? [at0 - 0.45, at0] : [at0, at0 + 0.45];
  const [w0, w1] = n > 0 ? [at0, at0 + 0.03] : [at0 - 0.03, at0];
  return axis === 'x'
    ? [paint(b(a0, 0, c0, a1, 0.12, c1), GRANITE, '#a8a8a0'), trim(a0, HARBOR_SEA - 0.4, w0, a1, HARBOR_SEA + 0.25, w1, 'sea_bed')]
    : [paint(b(c0, 0, a0, c1, 0.12, a1), GRANITE, '#a8a8a0'), trim(w0, HARBOR_SEA - 0.4, a0, w1, HARBOR_SEA + 0.25, a1, 'sea_bed')];
}
/**
 * A ramp from the quay (z = -4) down to the bed (z = 4): what you walk on is 32 low steps (0.125 m rise, the
 * navmesh keeps them in every rotation), each just under the drawn slope (a visual slab) so the slope is what you see.
 */
function ramp(x0: number, x1: number, material: string): Box[] {
  const steps = Array.from({ length: 31 }, (_, i) => paint(b(x0, BED - 0.5, 4 - (i + 1) * 0.25, x1, BED + (i + 1) * 0.125, 4 - i * 0.25), material));
  steps.push(paint(b(x0, BED - 0.5, -4, x1, 0, -3.75), material));
  return [...steps, slope((x0 + x1) / 2, x1 - x0, 0, BED, material, 0.3, 'trim')];
}
/** A slab of `size` [width, thickness, length] whose top surface runs from y0 at z = -4 down to y1 at z = 4 (ramps, beaches). */
function slope(x: number, w: number, y0: number, y1: number, material: string, t = 0.4, kind?: LocalBox['kind']): Box {
  const a = Math.atan2(y0 - y1, 8);
  const L = Math.hypot(8, y0 - y1) - 0.45;
  return paint(tilted(x, (y0 + y1) / 2 - (Math.cos(a) * t) / 2, -(Math.sin(a) * t) / 2, [w, t, L], { pitch: -a, ...(kind ? { kind } : {}) }), material);
}

const tile = (id: string, displayName: string, category: TileDefinition['category'], blurb: string, solids: Box[], o: Partial<TileDefinition> = {}): TileDefinition => ({
  id: `harbor.${id}`,
  displayName,
  category,
  blurb,
  cells: [[0, 0, 0]],
  floors: [],
  ports: ALL,
  open: true,
  edgeDefault: 'open',
  extraFloors: [bed(-4, -4, 4, 4)],
  solids,
  ...o,
});

// ---------------------------------------------------------------- piers and quays

function waterfront(): TileDefinition[] {
  const braces = (x: number): Box[] => [-1, 1].map((s) => paint(tilted(x, -1.6, 0, [0.12, 0.12, 4.4], { pitch: s * 0.5, kind: 'trim' }), 'oak_beam', PILE_TINT));
  const beams = (x0: number, x1: number, zs: readonly number[]): Box[] => zs.map((z) => trim(x0, -0.55, z - 0.15, x1, -0.25, z + 0.15, 'oak_beam', PILE_TINT));
  const tiles: TileDefinition[] = [
    tile('pier', 'Timber Pier', 'Open', 'A plank pier 5 m wide on timber piles, north to south, level with the quay; swim under it between the piles (1.2 m of air over the water)', [
      deck(-2.6, -4, 2.6, 4),
      ...[-2.4, 2.4].flatMap((x) => [pile(x, -2), pile(x, 2), ...braces(x)]),
      ...[-2.4, 2.4].map((x) => paint(b(x - 0.18, 0, 1.82, x + 0.18, 0.8, 2.18), 'oak_beam', PILE_TINT)),
      ...beams(-2.6, 2.6, [-2, 2]),
      ...[-1, 1].map((s) => trim(s > 0 ? 2.6 : -2.7, -0.45, -4, s > 0 ? 2.7 : -2.6, -0.05, 4, 'oak_beam', PILE_TINT)),
    ]),
    tile('pier_head', 'Pier Head', 'Open', 'The end of a pier: a full-cell deck on nine piles, a railing across the north end (a gap in the middle to jump or moor), bollards at the landward corners; join Breakwaters to its east and west sides', [
      deck(-4, -4, 4, 4),
      ...[-3.4, 0, 3.4].flatMap((x) => [-3.4, 0, 3.4].map((z) => pile(x, z))),
      ...beams(-4, 4, [-3.4, 0, 3.4]),
      rail(-3.9, 3.85, -1.2, 3.85, 0, 'oak_beam'),
      rail(1.2, 3.85, 3.9, 3.85, 0, 'oak_beam'),
      ...bollard(-3.2, -3.2),
      ...bollard(3.2, -3.2),
    ]),
    tile('boardwalk', 'Boardwalk', 'Open', 'A narrow plank boardwalk (2.4 m) on piles over the water, north to south, a rope rail along its east side (it only looks like it holds you)', [
      deck(-1.2, -4, 1.2, 4),
      ...[-2.5, 2.5].flatMap((z) => [pile(-1.05, z, -0.25, 0.14), pile(1.05, z, -0.25, 0.14)]),
      ...[-3.5, -1.75, 0, 1.75, 3.5].map((z) => trim(1.0, 0, z - 0.06, 1.12, 1.0, z + 0.06, 'oak_beam', PILE_TINT)),
      trim(1.04, 0.85, -4, 1.08, 0.9, 4, 'pbr_burlap', '#a08a5a'),
    ]),
    tile('boardwalk_turn', 'Boardwalk Corner', 'Open', 'The Boardwalk turning from the south side to the east side', [
      deck(-1.2, -4, 1.2, 1.2),
      deck(1.2, -1.2, 4, 1.2),
      pile(-1.05, -2.5, -0.25, 0.14),
      pile(1.05, -2.5, -0.25, 0.14),
      pile(2.5, -1.05, -0.25, 0.14),
      pile(2.5, 1.05, -0.25, 0.14),
      pile(-1.05, 1.05, -0.25, 0.14),
    ]),
    tile('quay', 'Quay Wall', 'Open', 'Granite quay: paved ground on the south half, a sheer wall 4 m down to the harbour bed on the north (water 1.5 m below the edge), bollards and a granite coping. Hang a Ladder between the two fenders in the middle of the face to climb out of the water', [
      ...quayBlock(-4, -4, 4, 0),
      ...edge('x', 0, -4, 4, 1),
      ...bollard(-2.6, -1.0),
      ...bollard(2.6, -1.0),
      ...[-3.2, -0.7, 0.7, 3.2].map((x) => trim(x - 0.15, BED, 0, x + 0.15, -0.05, 0.25, 'oak_beam', PILE_TINT)),
      ...[-2.6, 2.6].map((x) => trim(x - 0.12, -0.75, 0, x + 0.12, -0.5, 0.06, STEEL, '#3a3634')),
    ], { extraFloors: [bed(-4, 0, 4, 4)] }),
    tile('quay_corner', 'Quay Corner', 'Open', 'An outside corner of the quay: ground in the south-west quarter, water round the north and east (join Quay Walls west and south of it)', [
      ...quayBlock(-4, -4, 0, 0),
      ...edge('x', 0, -4, 0, 1),
      ...edge('z', 0, -4, 0, 1),
      ...bollard(-1.2, -1.2),
    ], { extraFloors: [bed(-4, 0, 4, 4), bed(0, -4, 4, 0)] }),
    tile('quay_inner', 'Quay Inside Corner', 'Open', 'An inside corner of the quay: ground everywhere but the north-east quarter, which is water (join Quay Walls east and north of it)', [
      ...quayBlock(-4, -4, 4, 0),
      ...quayBlock(-4, 0, 0, 4),
      ...edge('x', 0, 0, 4, 1),
      ...edge('z', 0, 0.45, 4, 1),
      ...bollard(-1.0, -1.0),
    ], { extraFloors: [bed(0, 0, 4, 4)] }),
  ];

  // Sea Wall Steps: a 2 × 1 quay with a flight cut into it along the face, from the quay at the west end down to the bed.
  tiles.push(
    tile('quay_steps', 'Sea Wall Steps', 'Vertical', '2 × 1 cells of Quay Wall with granite steps cut into it along the face: down from the quay at the west end to the harbour bed at the east end, so you can walk (or swim) out of the water', [
      ...quayBlock(-4, -4, 12, -2.4),
      ...quayBlock(-4, -2.4, 0, 0),
      ...flight('x', -1, 8, -2.4, 0, 16, BED, 0.5, BED).map((s) => paint(s, GRANITE, '#9a9a94')),
      ...edge('x', 0, -4, 0, 1),
      ...edge('x', -2.4, 8, 12, 1),
      ...bollard(-2.6, -1.2),
      ...bollard(10, -3.2),
    ], { cells: footprint(2, 1), ports: perimeter(2, 1), extraFloors: [bed(-4, 0, 12, 4), bed(8, -2.4, 12, 0)] }),
  );

  // Slipway: a ramp from the quay into the water between two quay ends.
  tiles.push(
    tile('slipway', 'Slipway', 'Open', 'A concrete slipway from the quay (south) down into the water (north), 27°: walk or drive a boat in and out; quay ends either side with bollards and a winch post', [
      ...ramp(-2.6, 2.6, 'pbr_concrete'),
      ...[-1.2, 1.2].map((x) => paint(slopeRail(x), STEEL, '#4a4a48')),
      ...quayBlock(-4, -4, -2.6, 0),
      ...quayBlock(2.6, -4, 4, 0),
      ...edge('x', 0, -4, -2.6, 1),
      ...edge('x', 0, 2.6, 4, 1),
      ...bollard(-3.3, -1.0),
      ...bollard(3.3, -1.0),
    ], { extraFloors: [bed(-4, 0, -2.6, 4), bed(2.6, 0, 4, 4)] }),
    tile('beach', 'Shingle Beach', 'Open', 'A shingle beach sloping from the ground (south) down to the harbour bed (north), 27°: the easy way out of the water', [
      ...ramp(-4, 4, 'shingle'),
      paint(b(-3.2, -2.4, 0.6, -2.2, -1.7, 1.6), 'pbr_rock', '#8a8a80'),
      paint(b(2.0, -3.2, 2.4, 3.2, -2.4, 3.4), 'pbr_rock', '#8a8a80'),
      paint(tilted(1.0, -1.05, -1.2, [2.2, 0.25, 0.35], { yaw: 0.5, kind: 'trim' }), 'pbr_weathered_planks', '#a89880'),
    ], { extraFloors: [bed(-4, 3.6, 4, 4)] }),
    tile('basin', 'Harbour Basin', 'Open', 'Open water: the harbour bed 4 m below the quay, weed and stones on it. Fill a run of these with Harbour Water', [
      trim(-2.5, BED, -1.5, 1.5, BED + 0.03, 2.0, 'shingle'),
      paint(b(1.8, BED, -2.8, 2.8, BED + 0.6, -1.8), 'pbr_rock', '#6a7060'),
    ]),
  );

  // Breakwater: a concrete cap level with the quay on a rubble mound, a wave wall on its west (seaward) side.
  {
    const rock = (x: number, y: number, z: number, size: readonly [number, number, number], roll: number, yaw: number): Box => paint(tilted(x, y, z, size, { roll, yaw }), 'pbr_rock', '#7a7a70');
    const rocks: Box[] = [];
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        rocks.push(rock(s * 2.4, BED + 2.6, -2.5 + k * 2.5, [2.0, 1.8, 2.3], s * 0.5, (k - 1) * 0.15));
        rocks.push(rock(s * 2.75, BED + 0.6, -2.4 + k * 2.4, [1.4, 1.0, 1.6], s * 0.3, 0.4));
      }
    }
    tiles.push(
      tile('breakwater', 'Breakwater', 'Open', 'A breakwater north to south: a concrete walk level with the quay on a mound of rocks (climb them out of the water), a wave wall along its west side for cover', [
        paint(b(-1.6, BED, -4, 1.6, 0, 4), 'pbr_concrete', '#9a9890'),
        paint(b(-1.6, 0, -4, -1.05, 1.15, 4), 'pbr_concrete', '#8a8880'),
        ...rocks,
      ]),
    );
  }
  return tiles;
}

/** A winch rail down the slipway (a thin strip on its surface). */
function slopeRail(x: number): Box {
  const a = Math.atan2(-BED, 8);
  return tilted(x, BED / 2 + 0.03, 0, [0.12, 0.06, Math.hypot(8, BED) - 0.4], { pitch: -a, kind: 'trim' });
}

// ---------------------------------------------------------------- buildings

type ShedKind = 'warehouse' | 'net_shed' | 'office';

/**
 * A 2 × 1 harbour building, two storeys, eaves on the north and south cell edges at
 * the Medieval houses' 8.25 m (so an Outside Stair beside it climbs to its roof, and
 * a row of them makes one roofline). Doors on every side, a straight stair along the
 * north wall, upper doors east and west (centred) for walkways and the next building.
 * The warehouse: brick, a wide loading door, a loft door with a hoist beam over the
 * quay (south), crates, a rusty corrugated roof. The office: whitewashed render, its
 * upper storey set back behind a railed balcony (a lookout over the quay), slates.
 * The net shed: tarred boards, the ground storey open to the quay in two wide bays, a
 * net loft with a hoist, red tiles.
 */
function harbourShed(kind: ShedKind): Box[] {
  const T = 0.3;
  const X0 = -3.8;
  const X1 = 11.8;
  const office = kind === 'office';
  const nets = kind === 'net_shed';
  const skin = office ? 'harbour_render' : nets ? 'tarred_boards' : 'pbr_brick_red';
  const front = office ? -1.2 : -3.8;
  const out: Box[] = [];
  const groundS: Opening[] = office ? [door(1.0), win(-2.0), win(5.0, 2.4), win(9.0)] : nets ? [[-3.5, 3.2, 0, 3.2], [4.8, 11.5, 0, 3.2]] : [door(4.0, 4.0, 3.4), win(-2.0), win(10.0)];
  out.push(
    ...shell(X0, -3.8, X1, 3.8, { S: groundS, N: [door(-2.0), win(4.5), win(9.5, 1.2, 1.2, 2.4)], W: [door(-1.6)], E: [door(-1.6)] }, 0, 4, skin, T),
    ...wall('x', front + T / 2, X0, X1, office ? [win(-2.0, 1.6), win(2.5, 1.6), door(6.5, 2.2, 2.6), win(10.0, 1.6)] : [win(-2.0, 1.1, 1.0, 2.4), door(4.0, 2.4, 2.8), win(10.0, 1.1, 1.0, 2.4)], 4, 8, skin),
    ...wall('x', 3.8 - T / 2, X0, X1, [win(-1.6, 1.2, 1.0, 2.4), win(4.5, 1.2, 1.0, 2.4), win(9.0, 1.2, 1.0, 2.4)], 4, 8, skin),
    ...wall('z', X0 + T / 2, front + T, 3.5, [door(0)], 4, 8, skin),
    ...wall('z', X1 - T / 2, front + T, 3.5, [door(0)], 4, 8, skin),
  );
  for (const x of [-4, X1]) out.push(paint(b(x, 3.75, -1.1, x + 0.2, 4.0, 1.1), 'oak_beam'));
  // Upper floor (a hole over the stair), the ceiling, the stair along the north wall: open floor at its foot and its head.
  const run = 0.45;
  const S1 = 16 * run;
  out.push(...subtract([-3.5, front + T, 11.5, 3.5], [[0, 1.3, S1, 3.5]]).map(([x0, z0, x1, z1]) => paint(b(x0, 3.75, z0, x1, 4.0, z1), 'pbr_floorboards')));
  out.push(paint(b(X0, 7.75, front, X1, 8.0, 3.8), 'pbr_planks', '#a08870'));
  out.push(...flight('x', 1, 0, 1.3, 3.5, 16, 0, run).map((s) => paint(s, 'pbr_planks', '#b09070')));
  out.push(rail(0, 1.3, S1 - 1.2, 1.3, 4.0, STEEL));
  out.push(trim(-3.5, 0, -3.5, 11.5, 0.02, 3.5, office ? 'pbr_floorboards' : nets ? 'harbour_setts' : 'pbr_concrete'));
  if (office) {
    // The balcony over the quay, its rail and posts; a counter and a chart table inside; a flagstaff.
    out.push(paint(b(X0, 3.75, -3.8, X1, 4.0, front), DECK), paint(b(5.3, 3.75, front, 7.7, 4.0, front + T), 'oak_beam'), rail(X0, -3.75, X1, -3.75, 4.0, 'harbour_paint'));
    for (const x of [-3.6, 4.0, 11.6]) out.push(trim(x - 0.1, 4.0, -3.8, x + 0.1, 8.0, -3.6, 'harbour_paint'));
    out.push(paint(b(3.0, 0, -1.6, 7.0, 1.0, -1.0), 'pbr_walnut'), paint(b(8.5, 4, 0.5, 10.5, 0.9 + 4, 1.8), 'pbr_walnut'));
    out.push(trim(11.3, 4.0, -3.75, 11.4, 11.5, -3.65, 'paint_matte'), trim(11.4, 10.6, -3.72, 12, 11.4, -3.68, 'paint_matte', '#2a4a8a'));
  } else if (nets) {
    // Nets hung from the beams, lobster pots and a net loft table upstairs, a hoist over the loft door.
    out.push(trim(-3.4, 1.0, 3.3, 3.0, 3.6, 3.36, 'canvas', '#4a5a4a'), trim(5.0, 1.2, 3.3, 11.4, 3.6, 3.36, 'canvas', '#5a4a3a'));
    out.push(paint(b(9.6, 0, -1.2, 11.2, 0.9, 0.4), 'crate_wood', '#6a5a48'), paint(b(8.6, 4.0, -3.3, 11.0, 4.9, -2.4), 'pbr_weathered_planks'));
    out.push(trim(3.9, 7.0, -4, 4.1, 7.2, -3.5, 'oak_beam'), trim(3.97, 5.3, -3.98, 4.03, 7.0, -3.92, 'pbr_burlap', '#a08a5a'));
  } else {
    // Crates on both floors (cover), a hoist beam over the loft door.
    out.push(paint(b(6.6, 0, -3.3, 8.6, 1.2, -2.1), 'crate_wood'), paint(b(9.4, 0, -1.0, 11.0, 1.4, 0.6), 'crate_wood'), paint(b(-3.2, 0, -3.2, -1.8, 1.0, -2.0), 'crate_wood'));
    out.push(paint(b(8.0, 4.0, -3.3, 10.4, 5.2, -2.3), 'crate_wood'), paint(b(-3.2, 4.0, -0.6, -2.0, 5.0, 0.8), 'crate_wood'));
    out.push(trim(3.9, 7.0, -4, 4.1, 7.2, -3.5, STEEL), trim(3.97, 5.3, -3.98, 4.03, 7.0, -3.92, 'pbr_burlap', '#a08a5a'));
  }
  out.push(trim(X0 - 0.05, 0, -3.85, X1 + 0.05, 0.45, -3.8, GRANITE));
  out.push(...gableRoof(-4, -4, 12, 4, EAVES, 8.0, office ? { material: 'pbr_slate_roof', gableMaterial: skin, ridgeMaterial: 'pbr_slate_roof' } : nets ? { gableMaterial: skin } : { material: 'rusty_corrugated', gableMaterial: skin, ridgeMaterial: STEEL }));
  return out;
}

function buildings(): TileDefinition[] {
  const shed = (id: string, displayName: string, blurb: string, kind: ShedKind): TileDefinition =>
    tile(id, displayName, 'Buildings', blurb, harbourShed(kind), {
      cells: footprint(2, 1, 3),
      floors: [0],
      ports: [...perimeter(2, 1), { side: 'W', level: 1, cell: [0, 0] }, { side: 'E', level: 1, cell: [1, 0] }, ...perimeter(2, 1, 2)],
      extraFloors: [],
    });
  const tiles = [
    shed('warehouse', 'Harbour Warehouse', '2 × 1 cells, two storeys of brick: a wide loading door on the quay side (south) and a loft door with a hoist beam above it, crates for cover, a stair inside, upper doors east and west; a rusty corrugated roof you can walk on (eaves 8.25 m on the north and south edges: climb an Outside Stair beside it)', 'warehouse'),
    shed('net_shed', 'Net Shed', "2 × 1 cells of tarred boards: the ground storey open to the quay (south) in two wide bays where the nets and pots are kept, a net loft upstairs with a loft door and hoist over the quay, a stair inside, upper doors east and west; a red tile roof you can walk on (eaves 8.25 m)", 'net_shed'),
    shed('office', "Harbourmaster's Office", '2 × 1 cells of whitewashed render: the upper storey stands back behind a railed balcony over the quay (south, 4 m up), a flagstaff, a stair inside, doors on every side; a slate roof you can walk on (eaves 8.25 m)', 'office'),
  ];

  // Fish Market: an open hall on posts under a low corrugated roof, granite counters with ice in two rows.
  {
    const posts = [-3.6, 0.2, 4.0, 7.8, 11.6].flatMap((x) => [-3.6, 3.6].map((z) => paint(b(x - 0.15, 0, z - 0.15, x + 0.15, 3.6, z + 0.15), 'harbour_paint')));
    const counters = [-1.9, 1.9].flatMap((z) => [[-2.2, 2.6], [5.4, 10.2]].flatMap(([x0, x1]) => [paint(b(x0!, 0, z - 0.45, x1!, 0.95, z + 0.45), 'white_tiles'), trim(x0! + 0.1, 0.95, z - 0.35, x1! - 0.1, 0.99, z + 0.35, 'pbr_ice')]));
    tiles.push(
      tile('fish_market', 'Fish Market', 'Buildings', '2 × 1 cells: an open market hall on blue posts under a low corrugated roof, two rows of tiled counters with ice (waist-high cover) and an aisle down the middle', [
        ...posts,
        ...counters,
        trim(-3.8, 0, -3.8, 11.8, 0.02, 3.8, 'white_tiles', '#c8ccc8'),
        ...gableRoof(-4, -4, 12, 4, 3.6, 3.6, { pitch: (20 * Math.PI) / 180, material: 'blue_corrugated', gableMaterial: DECK, gableInset: 0.3, ridgeMaterial: STEEL }),
      ], { cells: footprint(2, 1, 2), floors: [0], ports: perimeter(2, 1), extraFloors: [] }),
    );
  }
  return tiles;
}

// ---------------------------------------------------------------- landmarks

function landmarks(): TileDefinition[] {
  const tiles: TileDefinition[] = [];

  // Lighthouse: a skeleton tower of four banded legs (open sides keep the stacked stair on the bots' navmesh), a switchback
  // stair inside (flights of six: headroom on every lap) to a gallery 10.5 m up behind a parapet, the lantern house on top.
  {
    const { steps } = switchback(3.4, 2.0, 42, [6]);
    const W = 'lighthouse_bands';
    const brace = (x: number, z: number, y: number, along: 'x' | 'z', s: 1 | -1): Box => paint(tilted(x, y, z, along === 'x' ? [7.2, 0.12, 0.12] : [0.12, 0.12, 7.2], along === 'x' ? { roll: s * 0.42, kind: 'trim' } : { pitch: s * 0.42, kind: 'trim' }), STEEL, '#e8e6e0');
    tiles.push(
      tile('lighthouse', 'Lighthouse', 'Vertical', "A red and white skeleton lighthouse: four banded legs, a stair switching back up inside them to a gallery 10.5 m up behind a parapet (the harbour's sniper perch), the lantern house on top. Put it at the end of a pier or the breakwater", [
        ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => paint(b(sx! * 3.6 - 0.2, 0, sz! * 3.6 - 0.2, sx! * 3.6 + 0.2, 12.8, sz! * 3.6 + 0.2), W)),
        ...[2.4, 6.4].flatMap((y) => ([-1, 1] as const).flatMap((s) => [brace(0, s * 3.75, y + 1.4, 'x', s), brace(s * 3.75, 0, y + 1.4, 'z', s)])),
        ...steps.map((s) => paint(s, 'pbr_concrete', '#b8b4ac')),
        paint(b(-3.4, 10.2, -3.4, 3.4, 10.5, -1.4), 'pbr_tread_plate'),
        paint(b(-3.4, 10.5, -3.4, 3.4, 11.5, -3.25), 'harbour_paint', '#b8262a'),
        paint(b(-3.9, 12.8, -3.9, 3.9, 13.1, 3.9), 'paint_matte', '#e8e6e0'),
        trim(-2.2, 13.1, -2.2, 2.2, 13.6, 2.2, W),
        trim(-0.8, 13.1, -0.8, 0.8, 14.6, 0.8, 'lamp_glow'),
        ...[[-1.5, -1.5], [1.3, -1.5], [-1.5, 1.3], [1.3, 1.3]].map(([x, z]) => trim(x!, 13.1, z!, x! + 0.2, 15.0, z! + 0.2, 'harbour_paint', '#20262a')),
        trim(-1.8, 15.0, -1.8, 1.8, 15.4, 1.8, 'harbour_paint', '#b8262a'),
        trim(-1.0, 15.4, -1.0, 1.0, 16.0, 1.0, 'harbour_paint', '#b8262a'),
        trim(-0.08, 16.0, -0.08, 0.08, 16.8, 0.08, STEEL),
        ...[-1, 1].flatMap((s) => [trim(-3.9, 13.1, s * 3.85 - 0.05, 3.9, 14.1, s * 3.85 + 0.05, STEEL, '#20262a'), trim(s * 3.85 - 0.05, 13.1, -3.9, s * 3.85 + 0.05, 14.1, 3.9, STEEL, '#20262a')]),
        // A granite plinth down to the harbour bed (it stands in the water as well as on land).
        paint(b(-4, BED, -4, 4, -0.5, 4), GRANITE),
        trim(-3.95, 0, -3.95, 3.95, 0.02, 3.95, SETTS),
      ], { cells: footprint(1, 1, 5), floors: [0], extraFloors: [] }),
    );
  }

  // Harbour Crane: a steel portal over the quay, a platform 6 m up (a hatch for a Ladder), the cab and a raised jib.
  {
    const Y = '#d8a020';
    const boom = (x: number): Box => paint(tilted(x, 7.0 + 4.7, 0.4 + 1.71, [0.16, 0.16, 10], { pitch: 1.22, kind: 'trim' }), 'harbour_paint', Y);
    tiles.push(
      tile('crane', 'Harbour Crane', 'Vertical', 'A dockside crane: four steel legs over the quay (walk under it), a railed platform 6 m up with a hatch on its north side, east of the middle (hang a Ladder in it, against the hatch\'s south edge), the cab and a raised lattice jib with its hook', [
        ...[-3, 3].flatMap((x) => [-3, 3].map((z) => paint(b(x - 0.25, 0, z - 0.25, x + 0.25, 5.75, z + 0.25), 'harbour_paint', Y))),
        ...subtract([-3.6, -3.6, 3.6, 3.6], [[1.0, 2.2, 2.2, 3.4]]).map(([x0, z0, x1, z1]) => paint(b(x0, 5.75, z0, x1, 6.0, z1), 'pbr_tread_plate')),
        rail(-3.6, -3.6, 3.6, -3.6, 6.0, STEEL),
        rail(-3.6, -3.6, -3.6, 3.6, 6.0, STEEL),
        rail(-3.6, 3.6, 3.6, 3.6, 6.0, STEEL),
        rail(3.6, -3.6, 3.6, 3.6, 6.0, STEEL),
        paint(b(-3.0, 6.0, -1.4, 0.4, 8.4, 1.4), 'harbour_paint', Y),
        trim(-3.2, 8.4, -1.6, 0.6, 8.6, 1.6, STEEL),
        trim(-3.02, 7.0, -1.42, 0.42, 7.9, 1.42, 'pbr_glass_facade'),
        paint(b(-3.0, 6.0, -3.4, 0.4, 7.4, -2.2), 'pbr_concrete_dark'),
        boom(-1.05),
        boom(-0.35),
        trim(-0.73, 3.0, 3.72, -0.67, 16.3, 3.78, STEEL, '#2a2c30'),
        trim(-0.95, 2.6, 3.6, -0.45, 3.0, 3.9, 'harbour_paint', '#b8262a'),
        ...[-3, 3].flatMap((x) => [trim(x - 0.15, 0, -4, x + 0.15, 0.03, 4, STEEL)]),
      ], { cells: footprint(1, 1, 5), floors: [0], extraFloors: [] }),
    );
  }

  // Harbour Arch: a granite arch over a 4.4 m passage (north to south), an attic with the harbour's name panel.
  {
    const S = (box: Box) => paint(box, GRANITE, '#b0b0a8');
    const arch: Box[] = [];
    for (let i = 0; i < 11; i++) {
      const u0 = -2.2 + i * 0.4;
      const m = Math.min(Math.abs(u0), Math.abs(u0 + 0.4));
      arch.push(S(b(u0, 2.6 + Math.sqrt(Math.max(0, 4.84 - m * m)) * 0.9, -1.2, u0 + 0.4, 6.0, 1.2)));
    }
    tiles.push(
      tile('arch', 'Harbour Arch', 'Large', 'A granite arch over a 4.4 m passage (north to south) between two piers, an attic with a painted name panel and lamps either side: the gate from the town to the quay', [
        S(b(-4, 0, -1.2, -2.2, 6.0, 1.2)),
        S(b(2.2, 0, -1.2, 4, 6.0, 1.2)),
        ...arch,
        S(b(-4, 6.0, -1.4, 4, 7.2, 1.4)),
        trim(-4, 7.2, -1.55, 4, 7.45, 1.55, GRANITE, '#c8c8c0'),
        ...[-1, 1].map((s) => trim(-2.4, 6.15, s * 1.4 - 0.03, 2.4, 7.05, s * 1.4 + 0.03, 'harbour_paint')),
        ...[-1, 1].flatMap((s) => [-1, 1].map((n) => trim(s * 3.1 - 0.15, 3.2, n * 1.2 - (n > 0 ? 0 : 0.3), s * 3.1 + 0.15, 3.8, n * 1.2 + (n > 0 ? 0.3 : 0), 'lamp_glow'))),
        trim(-2.2, 0, -1.2, 2.2, 0.02, 1.2, SETTS),
      ], { floors: [0], extraFloors: [], cells: footprint(1, 1, 2) }),
    );
  }

  // Quayside: harbour setts with a pair of crane rails let into them.
  tiles.push(
    tile('quayside', 'Quayside', 'Open', 'Paved quayside: harbour setts with a pair of crane rails north to south (put the Harbour Crane on them)', [trim(-4, 0, -4, 4, 0.02, 4, SETTS), ...[-3, 3].map((x) => trim(x - 0.08, 0.02, -4, x + 0.08, 0.04, 4, STEEL))], { floors: [0], extraFloors: [] }),
  );
  return tiles;
}

/** The 11 Coastal Harbor tiles, in palette order. */
export function harborPackTiles(): TileDefinition[] {
  return [...waterfront(), ...buildings(), ...landmarks()];
}
