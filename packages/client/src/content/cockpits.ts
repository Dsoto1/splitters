/**
 * Cockpits built in-house (drawing only): the parts a driver sees up close in the cockpit view, described as data
 * and built as clean geometry by game/cockpitGeometry.ts, so they stay crisp at any distance. Only the local driver's
 * cockpit view draws them (game/cockpitInterior.ts); the body's own triangles inside the `hide` boxes are left out of
 * that one copy of the body meanwhile. Everyone else, and the chase camera, see the body model alone.
 *
 * Everything is in the mount's frame (metres, +X right, +Y up, +Z forward, the ground at y 0), the same frame as
 * MOUNT_DEFS' seats, wheels and cockpitEye. Parts with `mirror` are drawn again mirrored across x = 0.
 */

export type V3 = [number, number, number];

/** Surfaces (one material, so one draw, each): colours come per part from the palette. */
export type CockpitSurface = 'paint' | 'fabric' | 'plastic' | 'metal';

/** A round tube along a path (roll cage bars, grab handles): corners rounded off at `bend` radius. */
export interface CockpitTube {
  path: V3[];
  /** Tube radius (m). */
  r: number;
  /** Corner radius (m). Default 0.1. */
  bend?: number;
  color: string;
  surface?: CockpitSurface;
  mirror?: boolean;
}

/** A box with rounded edges. `rot` turns it about X, then Y, then Z (radians; rot[0] > 0 leans its top forward). */
export interface CockpitBox {
  at: V3;
  size: V3;
  rot?: V3;
  /** Edge radius (m). Default a quarter of the smallest side, at most 0.03. */
  round?: number;
  color: string;
  surface?: CockpitSurface;
  mirror?: boolean;
}

/** A short cylinder whose round face looks along `face` (a knob, a lamp, a hub). */
export interface CockpitDisc {
  at: V3;
  face: V3;
  r: number;
  depth: number;
  color: string;
  surface?: CockpitSurface;
  mirror?: boolean;
}

/** A bucket seat: `at` is the crease between cushion and backrest at the seat's middle; it faces +Z. */
export interface CockpitSeat {
  at: V3;
  /** How far the backrest leans back from upright (radians). */
  recline: number;
  /** Seat width (m). Default 0.46. */
  width?: number;
  /** Cushion length from the crease (m). Default 0.42. */
  depth?: number;
  /** A five-point harness over it. */
  harness?: boolean;
  mirror?: boolean;
}

/** The steering wheel: turns about its column with the front wheels' steering. */
export interface CockpitWheel {
  /** The rim's centre. */
  at: V3;
  /** Along the column, toward the driver (normalised when built). */
  toward: V3;
  /** Rim radius to the grip's middle, and the grip's own radius (m). */
  r: number;
  grip: number;
  /** Spokes, as angles round the rim seen by the driver (radians, 0 at the top, clockwise). */
  spokes: number[];
  /** Column length into the dash (m). */
  column: number;
  /** How far the wheel turns at full steering (radians each way). */
  lock: number;
}

/** A round dial; `needle` is driven by the vehicle (speed in m/s against `max`, or a made-up engine speed). */
export interface CockpitGauge {
  at: V3;
  face: V3;
  r: number;
  needle?: 'speed' | 'revs';
  /** Full scale for `speed` (m/s). */
  max?: number;
  mirror?: boolean;
}

/** A row of toggle switches on a plate facing `face`. */
export interface CockpitSwitches {
  at: V3;
  face: V3;
  count: number;
  /** Gap between switches (m). */
  gap: number;
}

export interface CockpitDef {
  /** Boxes in the mount frame ([min, max]): body triangles wholly inside one are left out of your copy of the body. */
  hide: [V3, V3][];
  /** Named colours (sRGB, 0..1). */
  palette: Record<string, V3>;
  tubes: CockpitTube[];
  boxes: CockpitBox[];
  discs: CockpitDisc[];
  seats: CockpitSeat[];
  wheel?: CockpitWheel;
  gauges: CockpitGauge[];
  switches: CockpitSwitches[];
}

/**
 * The buggy (MOUNT_DEFS.buggy, the Meshy Community sci-fi buggy of the vehicle refresh, 2026-11-11): the cage measured
 * on the model (slices of its triangles): a roof frame about 1.65 m up on rails 0.58 m either side of the middle from
 * the hoop behind the cabin (z -0.6, where the rear deck starts) to the front bar with its lamps (z 0.4), a hoop behind
 * the seats (z -0.15), A-pillars falling to the hood at z 1.0; one row of seats (the crease at z 0.06, 0.4 m either
 * side; the four in the back stand on the deck), the wheel on the left at z 0.58. Refitted from the old body's
 * cockpit (the Tactical Off-Road Beast's, git history): wider, taller and 0.2 m further back.
 */
const BUGGY: CockpitDef = {
  hide: [
    // The cabin, inside the tub's walls: seats, floor, wheel and dash.
    [
      [-0.72, 0.4, -0.6],
      [0.72, 1.62, 0.92],
    ],
    // The cowl between the dash and the hood.
    [
      [-0.75, 0.95, 0.75],
      [0.75, 1.32, 1.08],
    ],
    // The cage above the tub's walls.
    [
      [-0.86, 1.1, -0.62],
      [0.86, 1.95, 1.0],
    ],
  ],
  palette: {
    cage: [0.16, 0.19, 0.2],
    sand: [0.55, 0.5, 0.4],
    seat: [0.11, 0.11, 0.115],
    bolster: [0.17, 0.17, 0.17],
    shell: [0.2, 0.2, 0.19],
    strap: [0.1, 0.55, 0.6],
    buckle: [0.72, 0.72, 0.74],
    dash: [0.13, 0.15, 0.155],
    floor: [0.25, 0.27, 0.27],
    rubber: [0.05, 0.05, 0.05],
    steel: [0.55, 0.55, 0.57],
    lamp: [0.85, 0.85, 0.8],
  },
  tubes: [
    // The hoop behind the cabin (the rear deck starts there); the hoop behind the seats.
    { path: [[-0.75, 0.92, -0.6], [-0.59, 1.65, -0.6], [0.59, 1.65, -0.6], [0.75, 0.92, -0.6]], r: 0.03, bend: 0.14, color: 'cage', surface: 'paint' },
    { path: [[-0.75, 0.95, -0.15], [-0.59, 1.65, -0.15], [0.59, 1.65, -0.15], [0.75, 0.95, -0.15]], r: 0.03, bend: 0.14, color: 'cage', surface: 'paint' },
    // Roof rails into the A-pillars, down to the hood.
    { path: [[-0.58, 1.65, -0.65], [-0.58, 1.65, 0.2], [-0.6, 1.59, 0.4], [-0.7, 1.14, 0.85], [-0.74, 1.0, 1.0]], r: 0.03, bend: 0.18, color: 'cage', surface: 'paint', mirror: true },
    // Front bar (lamps on it), the spine and a cross bar.
    { path: [[-0.6, 1.6, 0.4], [0.6, 1.6, 0.4]], r: 0.027, color: 'cage', surface: 'paint' },
    { path: [[0, 1.67, -0.65], [0, 1.67, 0.4]], r: 0.024, color: 'cage', surface: 'paint' },
    // The brace from the front bar down the middle to the hood.
    { path: [[0, 1.62, 0.4], [0, 1.14, 1.0]], r: 0.024, color: 'cage', surface: 'paint' },
    { path: [[-0.58, 1.65, -0.4], [0.58, 1.65, -0.4]], r: 0.024, color: 'cage', surface: 'paint' },
    // Side bars along the tub's walls.
    { path: [[-0.78, 0.88, -0.6], [-0.78, 0.9, -0.15], [-0.75, 0.83, 0.85]], r: 0.024, bend: 0.2, color: 'cage', surface: 'paint', mirror: true },
    // A diagonal in the rear hoop and the front hoop's harness bar.
    { path: [[-0.72, 1.02, -0.6], [0.55, 1.62, -0.6]], r: 0.022, color: 'cage', surface: 'paint' },
    { path: [[-0.71, 1.3, -0.15], [0.71, 1.3, -0.15]], r: 0.022, color: 'cage', surface: 'paint' },
    // The passenger's grab handle on the dash.
    { path: [[0.15, 1.14, 0.8], [0.18, 1.24, 0.74], [0.58, 1.24, 0.74], [0.6, 1.14, 0.8]], r: 0.013, bend: 0.05, color: 'cage', surface: 'paint' },
  ],
  boxes: [
    // Floor pan, centre tunnel, toe boards up under the dash.
    { at: [0, 0.53, 0.1], size: [1.48, 0.04, 1.3], round: 0.015, color: 'floor', surface: 'metal' },
    { at: [0, 0.6, 0.1], size: [0.18, 0.12, 1.3], round: 0.03, color: 'floor', surface: 'metal' },
    { at: [0, 0.71, 0.78], size: [1.42, 0.04, 0.4], rot: [-0.85, 0, 0], round: 0.015, color: 'floor', surface: 'metal' },
    // Dash: a face panel turned up toward the driver, a shelf on top, the gauge pod before the wheel.
    { at: [0, 1.0, 0.77], size: [1.45, 0.24, 0.06], rot: [0.35, 0, 0], round: 0.02, color: 'dash', surface: 'plastic' },
    { at: [0, 1.1, 0.92], size: [1.48, 0.035, 0.36], rot: [0.1, 0, 0], round: 0.015, color: 'sand', surface: 'paint' },
    { at: [-0.4, 1.1, 0.75], size: [0.38, 0.14, 0.07], rot: [0.35, 0, 0], round: 0.025, color: 'dash', surface: 'plastic' },
    { at: [-0.4, 1.175, 0.74], size: [0.4, 0.02, 0.1], rot: [0.12, 0, 0], round: 0.01, color: 'dash', surface: 'plastic' },
    // Switch plate in the middle, pedals.
    { at: [0, 1.03, 0.74], size: [0.22, 0.1, 0.03], rot: [0.35, 0, 0], round: 0.01, color: 'shell', surface: 'plastic' },
    { at: [-0.5, 0.7, 0.68], size: [0.06, 0.1, 0.02], rot: [-0.5, 0, 0], round: 0.008, color: 'steel', surface: 'metal' },
    { at: [-0.31, 0.7, 0.68], size: [0.07, 0.08, 0.02], rot: [-0.5, 0, 0], round: 0.008, color: 'steel', surface: 'metal' },
  ],
  discs: [
    // Lamps on the front bar: round housings, their lenses ahead.
    { at: [-0.5, 1.64, 0.46], face: [0, 0, 1], r: 0.036, depth: 0.06, color: 'cage', surface: 'paint', mirror: true },
    { at: [-0.2, 1.64, 0.46], face: [0, 0, 1], r: 0.036, depth: 0.06, color: 'cage', surface: 'paint', mirror: true },
    { at: [-0.5, 1.64, 0.465], face: [0, 0, 1], r: 0.029, depth: 0.006, color: 'lamp', surface: 'metal', mirror: true },
    { at: [-0.2, 1.64, 0.465], face: [0, 0, 1], r: 0.029, depth: 0.006, color: 'lamp', surface: 'metal', mirror: true },
  ],
  seats: [{ at: [-0.4, 0.82, 0.06], recline: 0.26, harness: true, mirror: true }],
  wheel: { at: [-0.4, 1.1, 0.58], toward: [0, 0.45, -0.9], r: 0.19, grip: 0.019, spokes: [-Math.PI / 2, Math.PI / 2, Math.PI], column: 0.36, lock: 1.6 },
  gauges: [
    { at: [-0.48, 1.1, 0.725], face: [0, 0.34, -0.94], r: 0.048, needle: 'speed', max: 22 },
    { at: [-0.32, 1.1, 0.725], face: [0, 0.34, -0.94], r: 0.048, needle: 'revs' },
    { at: [0.2, 1.04, 0.745], face: [0, 0.34, -0.94], r: 0.032 },
    { at: [0.32, 1.04, 0.745], face: [0, 0.34, -0.94], r: 0.032 },
  ],
  switches: [{ at: [0, 1.03, 0.725], face: [0, 0.34, -0.94], count: 4, gap: 0.045 }],
};

/**
 * The Troop Truck (MOUNT_DEFS.troop_truck, Ironclad Vanguard, 2026-11-11): no parts of its own, only a cut. Its cab's
 * front is an armoured screen of louvres over the windscreen (measured on the model: z 2.1 to 2.6, 1.6 to 2.45 m up),
 * solid from inside; in your own cockpit view those triangles are left out so you see the road over the hood.
 */
const TROOP_TRUCK: CockpitDef = {
  hide: [
    [
      [-1.2, 1.55, 2.05],
      [1.2, 2.48, 2.7],
    ],
  ],
  palette: {},
  tubes: [],
  boxes: [],
  discs: [],
  seats: [],
  gauges: [],
  switches: [],
};

/**
 * The Armored Rover (MOUNT_DEFS.armored_rover, Dust Runner, 2026-11-11). The model is a closed shell with nothing
 * inside it, so from the driver's seat its walls, pillars and screen frame showed as loose shards of their inside
 * faces. Measured on the model (slices of its triangles): the cab's walls 1.05 m either side, the floor 0.6 m up, the
 * roof's underside 2.2 m, the screen's header at z 0.6 falling to the hood's back edge (z 1.0, 1.6 m up; the hood
 * runs on to z 2.5). In your own cockpit view the shell's front half is left out below the roof and this cab is
 * drawn in it: doors to the belt line (1.5 m), pillars, a header, a headliner, a dash under the screen, two seats and
 * the wheel.
 */
const ARMORED_ROVER: CockpitDef = {
  hide: [
    [
      [-1.15, 0.45, -1.0],
      [1.15, 2.1, 1.02],
    ],
  ],
  palette: {
    trim: [0.15, 0.16, 0.14],
    door: [0.3, 0.29, 0.22],
    dash: [0.11, 0.115, 0.11],
    pad: [0.2, 0.2, 0.18],
    floor: [0.2, 0.21, 0.2],
    seat: [0.12, 0.12, 0.11],
    bolster: [0.18, 0.18, 0.16],
    shell: [0.2, 0.2, 0.19],
    strap: [0.5, 0.42, 0.2],
    buckle: [0.72, 0.72, 0.74],
    rubber: [0.05, 0.05, 0.05],
    steel: [0.5, 0.5, 0.52],
  },
  tubes: [
    // A-pillars from the belt line up to the header, the header, B-pillars, the roof's side rails.
    { path: [[-1.02, 1.5, 0.98], [-0.97, 2.12, 0.62]], r: 0.05, color: 'trim', surface: 'paint', mirror: true },
    { path: [[-0.97, 2.12, 0.62], [0.97, 2.12, 0.62]], r: 0.045, color: 'trim', surface: 'paint' },
    { path: [[-1.04, 1.5, -0.55], [-1.0, 2.14, -0.55]], r: 0.05, color: 'trim', surface: 'paint', mirror: true },
    { path: [[-0.97, 2.13, 0.62], [-1.0, 2.15, -1.0]], r: 0.04, color: 'trim', surface: 'paint', mirror: true },
    // Grab handles: on the passenger's side of the dash, and over each door.
    { path: [[0.25, 1.5, 0.72], [0.27, 1.56, 0.66], [0.68, 1.56, 0.66], [0.7, 1.5, 0.72]], r: 0.014, bend: 0.04, color: 'steel', surface: 'metal' },
    { path: [[-0.93, 2.08, 0.25], [-0.9, 2.03, 0.22], [-0.9, 2.03, -0.08], [-0.93, 2.08, -0.11]], r: 0.012, bend: 0.03, color: 'steel', surface: 'metal', mirror: true },
  ],
  boxes: [
    // Floor, and the tunnel between the seats.
    { at: [0, 0.6, 0], size: [2.1, 0.04, 2.0], round: 0.015, color: 'floor', surface: 'metal' },
    { at: [0, 0.74, -0.1], size: [0.3, 0.26, 1.4], round: 0.04, color: 'pad', surface: 'plastic' },
    // The headliner under the roof (the shell's roof has no underside: the rack and the gunners' feet showed through),
    // and the cowl over the seam where the cut meets the hood.
    { at: [0, 2.16, -0.2], size: [2.04, 0.03, 1.7], round: 0.012, color: 'pad', surface: 'fabric' },
    { at: [0, 1.57, 1.04], size: [2.1, 0.07, 0.14], round: 0.03, color: 'trim', surface: 'paint' },
    // Doors up to the belt line, a padded rail on top of each, and a bulkhead behind the bench up to the roof (the
    // shell's back half is not cut: past it, its inside faces would show as shards again).
    { at: [-1.06, 1.05, 0], size: [0.06, 0.9, 2.0], round: 0.02, color: 'door', surface: 'paint', mirror: true },
    { at: [-1.03, 1.5, 0], size: [0.1, 0.06, 2.0], round: 0.025, color: 'pad', surface: 'plastic', mirror: true },
    { at: [0, 1.38, -1.0], size: [2.1, 1.56, 0.05], round: 0.02, color: 'door', surface: 'paint' },
    // The bench behind the front seats, against the back panel: a cushion and a backrest.
    { at: [0, 0.94, -0.72], size: [1.9, 0.14, 0.44], round: 0.04, color: 'seat', surface: 'fabric' },
    { at: [0, 1.28, -0.93], size: [1.9, 0.56, 0.08], rot: [-0.12, 0, 0], round: 0.035, color: 'seat', surface: 'fabric' },
    // Dash: a deep shelf under the screen at the hood's height, its face toward the seats, the gauge hood.
    { at: [0, 1.53, 0.86], size: [2.06, 0.05, 0.34], rot: [0.08, 0, 0], round: 0.02, color: 'dash', surface: 'plastic' },
    { at: [0, 1.36, 0.72], size: [2.06, 0.32, 0.06], rot: [0.3, 0, 0], round: 0.025, color: 'dash', surface: 'plastic' },
    { at: [-0.45, 1.5, 0.68], size: [0.44, 0.13, 0.08], rot: [0.3, 0, 0], round: 0.03, color: 'pad', surface: 'plastic' },
    // The switch plate in the middle, a radio box under it, pedals.
    { at: [0.05, 1.4, 0.69], size: [0.26, 0.1, 0.03], rot: [0.3, 0, 0], round: 0.01, color: 'shell', surface: 'plastic' },
    { at: [0.05, 1.24, 0.72], size: [0.3, 0.12, 0.1], round: 0.015, color: 'shell', surface: 'metal' },
    { at: [-0.56, 0.78, 0.66], size: [0.07, 0.11, 0.02], rot: [-0.5, 0, 0], round: 0.008, color: 'steel', surface: 'metal' },
    { at: [-0.36, 0.78, 0.66], size: [0.08, 0.09, 0.02], rot: [-0.5, 0, 0], round: 0.008, color: 'steel', surface: 'metal' },
  ],
  discs: [],
  seats: [{ at: [-0.45, 1.02, -0.15], recline: 0.2, width: 0.5, harness: true, mirror: true }],
  wheel: { at: [-0.45, 1.42, 0.5], toward: [0, 0.4, -0.92], r: 0.2, grip: 0.02, spokes: [-Math.PI / 2, Math.PI / 2, Math.PI], column: 0.3, lock: 1.6 },
  gauges: [
    { at: [-0.54, 1.5, 0.635], face: [0, 0.3, -0.95], r: 0.05, needle: 'speed', max: 16 },
    { at: [-0.36, 1.5, 0.635], face: [0, 0.3, -0.95], r: 0.05, needle: 'revs' },
  ],
  switches: [{ at: [0.05, 1.4, 0.67], face: [0, 0.3, -0.95], count: 5, gap: 0.045 }],
};

/**
 * The Hauler (MOUNT_DEFS.hauler, Ironbound Voyager, 2026-11-11): no parts of its own, only a cut. The pilot sits in
 * the closed nose (measured on the model: the hull a tube 1.8 m wide and 2.2 m tall, its nose tapering from z 1.9 to
 * 3.4); in your own cockpit view the nose's shell is left out, so you see ahead instead of its inside faces.
 */
const HAULER: CockpitDef = {
  hide: [
    [
      [-1.1, 0.4, 1.3],
      [1.1, 2.7, 3.6],
    ],
  ],
  palette: {},
  tubes: [],
  boxes: [],
  discs: [],
  seats: [],
  gauges: [],
  switches: [],
};

/** In-house cockpits by mount id. */
export const COCKPITS: Readonly<Record<string, CockpitDef>> = { buggy: BUGGY, troop_truck: TROOP_TRUCK, armored_rover: ARMORED_ROVER, hauler: HAULER };
