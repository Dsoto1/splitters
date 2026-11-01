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
 * The buggy (MOUNT_DEFS.buggy, the owner's Tactical Off-Road Beast): the cage measured on the model (slices of its
 * triangles): a flat roof frame at 1.47 m on rails 0.46 m either side of the middle from the rear hoop (z -1.0) to
 * z 0.45, a hoop behind the front seats (z 0.05), A-pillars falling to the hood at z 1.15, a front bar with lamps at
 * z 0.6; three rows of seats (the crease at z 0.28, -0.53 and -0.94, 0.32 m either side), the wheel on
 * the left at z 0.78.
 */
const BUGGY: CockpitDef = {
  hide: [
    // The cabin, inside the tub's walls: seats, floor, wheel and dash.
    [
      [-0.58, 0.4, -1.06],
      [0.58, 1.62, 1.12],
    ],
    // The cowl between the dash and the hood.
    [
      [-0.6, 0.85, 1.0],
      [0.6, 1.2, 1.32],
    ],
    // The cage above the tub's walls.
    [
      [-0.72, 0.98, -1.06],
      [0.72, 1.58, 1.2],
    ],
  ],
  palette: {
    cage: [0.3, 0.29, 0.26],
    sand: [0.66, 0.54, 0.41],
    seat: [0.11, 0.11, 0.115],
    bolster: [0.17, 0.17, 0.17],
    shell: [0.2, 0.2, 0.19],
    strap: [0.62, 0.18, 0.1],
    buckle: [0.72, 0.72, 0.74],
    dash: [0.15, 0.15, 0.145],
    floor: [0.3, 0.3, 0.29],
    rubber: [0.05, 0.05, 0.05],
    steel: [0.55, 0.55, 0.57],
    lamp: [0.85, 0.85, 0.8],
  },
  tubes: [
    // Rear hoop, behind the back row; the hoop behind the front seats.
    { path: [[-0.6, 0.86, -1.0], [-0.47, 1.47, -1.0], [0.47, 1.47, -1.0], [0.6, 0.86, -1.0]], r: 0.027, bend: 0.12, color: 'cage', surface: 'paint' },
    { path: [[-0.6, 0.9, 0.05], [-0.47, 1.47, 0.05], [0.47, 1.47, 0.05], [0.6, 0.9, 0.05]], r: 0.027, bend: 0.12, color: 'cage', surface: 'paint' },
    // Roof rails into the A-pillars, down to the hood.
    { path: [[-0.46, 1.47, -1.08], [-0.46, 1.47, 0.4], [-0.48, 1.42, 0.6], [-0.56, 1.05, 1.05], [-0.59, 0.94, 1.2]], r: 0.027, bend: 0.16, color: 'cage', surface: 'paint', mirror: true },
    // Front bar (lamps on it), the spine and the gun mount's cross bar.
    { path: [[-0.48, 1.43, 0.6], [0.48, 1.43, 0.6]], r: 0.024, color: 'cage', surface: 'paint' },
    { path: [[0, 1.49, -1.08], [0, 1.49, 0.6]], r: 0.022, color: 'cage', surface: 'paint' },
    // The brace from the front bar down the middle to the hood.
    { path: [[0, 1.45, 0.6], [0, 1.05, 1.22]], r: 0.022, color: 'cage', surface: 'paint' },
    { path: [[-0.46, 1.47, -0.35], [0.46, 1.47, -0.35]], r: 0.022, color: 'cage', surface: 'paint' },
    // Side bars along the tub's walls.
    { path: [[-0.62, 0.84, -1.06], [-0.62, 0.86, 0.05], [-0.6, 0.8, 1.05]], r: 0.022, bend: 0.2, color: 'cage', surface: 'paint', mirror: true },
    // Diagonals in the rear hoop and the front hoop's harness bar.
    { path: [[-0.58, 0.95, -1.0], [0.44, 1.45, -1.0]], r: 0.02, color: 'cage', surface: 'paint' },
    { path: [[-0.57, 1.18, 0.05], [0.57, 1.18, 0.05]], r: 0.02, color: 'cage', surface: 'paint' },
    // The passenger's grab handle on the dash.
    { path: [[0.12, 1.05, 1.0], [0.14, 1.13, 0.94], [0.46, 1.13, 0.94], [0.48, 1.05, 1.0]], r: 0.012, bend: 0.04, color: 'cage', surface: 'paint' },
  ],
  boxes: [
    // Floor pan, centre tunnel, toe boards up under the dash.
    { at: [0, 0.56, -0.1], size: [1.18, 0.04, 1.94], round: 0.015, color: 'floor', surface: 'metal' },
    { at: [0, 0.62, -0.1], size: [0.16, 0.12, 1.94], round: 0.03, color: 'floor', surface: 'metal' },
    { at: [0, 0.73, 0.98], size: [1.14, 0.04, 0.4], rot: [-0.85, 0, 0], round: 0.015, color: 'floor', surface: 'metal' },
    // Dash: a face panel turned up toward the driver, a sand shelf on top, the gauge pod before the wheel.
    { at: [0, 0.92, 0.97], size: [1.16, 0.2, 0.06], rot: [0.35, 0, 0], round: 0.02, color: 'dash', surface: 'plastic' },
    { at: [0, 1.0, 1.12], size: [1.18, 0.035, 0.36], rot: [0.1, 0, 0], round: 0.015, color: 'sand', surface: 'paint' },
    { at: [-0.32, 1.0, 0.95], size: [0.34, 0.12, 0.07], rot: [0.35, 0, 0], round: 0.025, color: 'dash', surface: 'plastic' },
    { at: [-0.32, 1.065, 0.94], size: [0.36, 0.02, 0.1], rot: [0.12, 0, 0], round: 0.01, color: 'dash', surface: 'plastic' },
    // Switch plate in the middle, pedals.
    { at: [0, 0.94, 0.94], size: [0.2, 0.09, 0.03], rot: [0.35, 0, 0], round: 0.01, color: 'shell', surface: 'plastic' },
    { at: [-0.4, 0.7, 0.88], size: [0.06, 0.1, 0.02], rot: [-0.5, 0, 0], round: 0.008, color: 'steel', surface: 'metal' },
    { at: [-0.25, 0.7, 0.88], size: [0.07, 0.08, 0.02], rot: [-0.5, 0, 0], round: 0.008, color: 'steel', surface: 'metal' },
    // Lamps on the front bar.
    { at: [-0.4, 1.48, 0.63], size: [0.08, 0.06, 0.06], round: 0.02, color: 'rubber', surface: 'plastic', mirror: true },
    { at: [-0.16, 1.48, 0.63], size: [0.08, 0.06, 0.06], round: 0.02, color: 'rubber', surface: 'plastic', mirror: true },
  ],
  discs: [
    { at: [-0.4, 1.48, 0.662], face: [0, 0, 1], r: 0.022, depth: 0.01, color: 'lamp', surface: 'metal', mirror: true },
    { at: [-0.16, 1.48, 0.662], face: [0, 0, 1], r: 0.022, depth: 0.01, color: 'lamp', surface: 'metal', mirror: true },
  ],
  seats: [
    { at: [-0.32, 0.79, 0.28], recline: 0.26, harness: true, mirror: true },
    { at: [-0.32, 0.77, -0.53], recline: 0.26, harness: true, mirror: true },
    { at: [-0.32, 0.66, -0.94], recline: 0.08, depth: 0.3, mirror: true },
  ],
  wheel: { at: [-0.32, 1.0, 0.78], toward: [0, 0.45, -0.9], r: 0.17, grip: 0.018, spokes: [-Math.PI / 2, Math.PI / 2, Math.PI], column: 0.36, lock: 1.6 },
  gauges: [
    { at: [-0.39, 1.0, 0.925], face: [0, 0.34, -0.94], r: 0.045, needle: 'speed', max: 22 },
    { at: [-0.25, 1.0, 0.925], face: [0, 0.34, -0.94], r: 0.045, needle: 'revs' },
    { at: [0.16, 0.95, 0.94], face: [0, 0.34, -0.94], r: 0.03 },
    { at: [0.26, 0.95, 0.94], face: [0, 0.34, -0.94], r: 0.03 },
  ],
  switches: [{ at: [0, 0.94, 0.925], face: [0, 0.34, -0.94], count: 4, gap: 0.04 }],
};

/** In-house cockpits by mount id. */
export const COCKPITS: Readonly<Record<string, CockpitDef>> = { buggy: BUGGY };
