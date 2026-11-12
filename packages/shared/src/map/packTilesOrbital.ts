/**
 * Style Pack tiles for 04 Orbital Station's research base (owner, 2026-11-12:
 * "Sci-Fi Research" extends the pack, it is not a new one): a lab module, an
 * airlock tube, a landing pad, a comms array, a greenhouse, a sky tube on
 * legs, a rover bay and a hab dome, box-built in the pack's own materials
 * (white panel, station panels, dark tech, steady light strips and glow trim).
 * The pack's Hangar Bay and Reactor Hall are kit tiles (content/tiles/core.json).
 * Box helpers come from packTilesMedieval.ts, the round ones and the mast from
 * packTilesSnow.ts.
 */
import type { LocalBox, TileDefinition } from './catalog.ts';
import { ALL, at, b, door, footprint, paint, perimeter, shell, tilted, trim, wall, type Opening } from './packTilesMedieval.ts';
import { disc, drum, mast } from './packTilesSnow.ts';

type Box = LocalBox;

const PANEL = 'pbr_white_panel';
const ORB = 'orbital_panel';
const TECH = 'circuit';
const STRIP = 'light_strip';
const GLOW = 'glow_trim';
const STEEL = 'pbr_steel';
const TREAD = 'pbr_tread_plate';
const pan = (box: Box) => paint(box, PANEL);
const orb = (box: Box) => paint(box, ORB);
const tech = (box: Box) => paint(box, TECH);
const move = (boxes: Box[], dx: number, dz: number): Box[] => boxes.map((x) => ({ ...x, min: [x.min[0] + dx, x.min[1], x.min[2] + dz], max: [x.max[0] + dx, x.max[1], x.max[2] + dz] }));

/** A ramp x0..x1 wide whose top runs from `y` at z0 up `rise` to z1 (a slab thick enough to stand on the ground; its top ends exactly at z1: the navmesh note in packTilesSnow.ts). */
function ramp(x0: number, x1: number, z0: number, z1: number, rise: number): Box {
  const s = Math.sign(z1 - z0);
  const ang = Math.atan2(rise, Math.abs(z1 - z0));
  const T = rise + 0.2;
  return paint(tilted((x0 + x1) / 2, rise / 2 - (Math.cos(ang) * T) / 2, (z0 + z1) / 2 + (s * Math.sin(ang) * T) / 2, [x1 - x0, T, Math.hypot(z1 - z0, rise)], { pitch: s * ang }), TREAD);
}

/**
 * An enclosed tube north to south, its floor at `y`: panel walls 3 m apart,
 * the upper corners cut at 45° (an eight-sided section), four steel ribs
 * round it, a light strip down the floor and a glow line along each wall.
 */
function tube(y: number, open: readonly Opening[] = []): Box[] {
  const Q = Math.PI / 4;
  return [
    ...[-1, 1].flatMap((s) => [
      ...wall('z', s * 1.65, -4, 4, open, y, y + 2.4, PANEL),
      pan(tilted(s * 1.2, y + 2.85, 0, [1.6, 0.3, 7.94], { roll: -s * Q, kind: 'wall' })),
      trim(s * 1.485 - 0.015, y + 0.5, -3.9, s * 1.485 + 0.015, y + 0.58, 3.9, GLOW),
      ...[-3, -1, 1, 3].flatMap((z) => [
        trim(s * 1.875 - 0.075, y, z - 0.15, s * 1.875 + 0.075, y + 2.5, z + 0.15, STEEL),
        paint(tilted(s * 1.3, y + 2.95, z, [1.7, 0.3, 0.3], { roll: -s * Q, kind: 'trim' }), STEEL),
      ]),
    ]),
    orb(b(-0.9, y + 3.3, -3.94, 0.9, y + 3.55, 3.94)),
    ...[-3, -1, 1, 3].map((z) => trim(-0.95, y + 3.55, z - 0.15, 0.95, y + 3.68, z + 0.15, STEEL)),
    trim(-0.15, y, -3.8, 0.15, y + 0.02, 3.8, STRIP),
  ];
}

/** Lab module: a panelled room, doors north and south, a workbench band along the west wall, an open window band east. */
function lab(): Box[] {
  return [
    ...shell(-3.8, -3.8, 3.8, 3.8, { S: [door(0)], N: [door(0)], E: [[-2.6, 2.6, 1.1, 2.3]] }, 0, 3.4, PANEL),
    orb(b(-4, 3.4, -4, 4, 3.65, 4)),
    tech(b(-3.5, 0, -2.8, -2.6, 0.95, 2.8)),
    trim(-2.6, 0.78, -2.8, -2.57, 0.86, 2.8, GLOW),
    pan(b(0.9, 0, -1, 2.1, 0.9, 1)),
    trim(-0.2, 3.32, -2.5, 0.2, 3.4, 2.5, STRIP),
  ];
}

/** Landing pad, 2 × 2 cells: a deck 11 m square and 1 m up, a ramp 4 m wide south and north, light strips along its edges, a painted ring. */
function pad(): Box[] {
  const [A, B, H, R] = [-1.5, 9.5, 1, 3.2];
  const len = 2 * R * Math.tan(Math.PI / 8);
  return [
    paint(b(A, 0, A, B, H, B), TREAD),
    ramp(2, 6, -3.9, A, H),
    ramp(2, 6, 11.9, B, H),
    ...[A + 0.1, B - 0.3].flatMap((e) => [trim(A + 0.1, H, e, B - 0.1, H + 0.03, e + 0.2, STRIP), trim(e, H, A + 0.3, e + 0.2, H + 0.03, B - 0.3, STRIP)]),
    // The ring's eight strokes alternate in height so their lapped ends never share a plane.
    ...Array.from({ length: 8 }, (_, k) => {
      const a = (k * Math.PI) / 4;
      const [x, z] = [4 + R * Math.cos(a), 4 + R * Math.sin(a)];
      return { ...trim(x - len / 2, H, z - 0.12, x + len / 2, H + 0.02 + (k % 2) * 0.01, z + 0.12, PANEL), yaw: -(a + Math.PI / 2) };
    }),
    trim(3.5, H, 3.5, 4.5, H + 0.02, 4.5, GLOW),
  ];
}

/** Comms array: an equipment hut (doors south and north) with a lattice mast 9 m high and an upturned dish on its roof; the east strip stays clear. */
function comms(): Box[] {
  return [
    ...shell(-3.8, -3.8, 1.2, 3.8, { S: [door(-1.3)], N: [door(-1.3)] }, 0, 3.2, PANEL),
    orb(b(-4, 3.2, -4, 1.4, 3.45, 4)),
    tech(b(-3.5, 0, -1.5, -2.7, 1, 1.5)),
    trim(-2.7, 0.82, -1.5, -2.67, 0.9, 1.5, GLOW),
    ...mast(-1.3, 3.45, 1.6, 1, 0.25, 9, '#d8dce0'),
    ...move([pan(b(-0.2, 3.45, -0.2, 0.2, 4.4, 0.2)), ...[0.6, 1.1, 1.5].flatMap((r, i) => disc(r, 4.4 + i * 0.15, 4.55 + i * 0.15, PANEL)), trim(-0.04, 4.85, -0.04, 0.04, 5.6, 0.04, STEEL), trim(-0.1, 5.6, -0.1, 0.1, 5.75, 0.1, GLOW)], -1.3, -2),
  ];
}

/** Greenhouse, 2 × 1 cells: a hall of open window bands between steel posts over a 0.9 m sill, roof ribs under a ridge, planter beds as low cover. */
function greenhouse(): Box[] {
  const long: Opening[] = [door(0), door(8), [-3.2, 11.2, 0.9, 3]];
  const end: Opening[] = [door(0), [-3, 3, 0.9, 3]];
  const beds = [[1.8, -3.55, 6.2, -2.3], [1.8, 2.3, 6.2, 3.55], [2.6, -0.7, 5.4, 0.7], [-3.55, 1.6, -2.2, 3.55], [10.2, -3.55, 11.55, -1.6]] as const;
  return [
    ...shell(-3.8, -3.8, 11.8, 3.8, { S: long, N: long, W: end, E: end }, 0, 3.4, PANEL, 0.25),
    paint(b(-4, 3.4, -4, 12, 3.5, 4), 'pbr_glass_facade', '#bfe0e8'),
    ...[-2, 2, 4, 6, 10].flatMap((x) => [...[-3.74, 3.59].map((z) => paint(b(x - 0.08, 0.9, z, x + 0.08, 3, z + 0.15), STEEL)), trim(x - 0.1, 3.5, -3.95, x + 0.1, 3.65, 3.95, STEEL)]),
    trim(-3.95, 3.5, -0.12, 11.95, 3.72, 0.12, STEEL),
    trim(-3.5, 3.3, -0.08, 11.5, 3.4, 0.08, STRIP),
    ...beds.flatMap(([x0, z0, x1, z1]) => [pan(b(x0, 0, z0, x1, 0.7, z1)), trim(x0 + 0.1, 0.7, z0 + 0.1, x1 - 0.1, 0.95, z1 - 0.1, 'pbr_moss')]),
  ];
}

/** Sky tube: the tube 4 m up on four legs, a window band in each wall between the ribs; walk under it. */
function skyTube(): Box[] {
  return [
    ...tube(4, [-2, 0, 2].map((z): Opening => [z - 0.7, z + 0.7, 1, 2])),
    paint(b(-1.8, 3.75, -4, 1.8, 4, 4), TREAD),
    ...[-1, 1].flatMap((sx) => [-3, 3].map((z) => pan(b(sx * 1.5 - 0.15, 0, z - 0.15, sx * 1.5 + 0.15, 3.75, z + 0.15)))),
  ];
}

/** Rover bay, 1 × 2 cells: a garage 3.5 m high open to the south over a ramp sill, its floor 0.25 m up, a service pit cover in it, a bench, a door north. */
function rover(): Box[] {
  return [
    ...shell(-3.8, -3.8, 3.8, 11.8, { S: [[-3.2, 3.2, 0, 3.1]], N: [door(0, 2.2, 3.05)] }, 0, 3.5, PANEL),
    orb(b(-4, 3.5, -4, 4, 3.75, 12)),
    ramp(-3.2, 3.2, -3.95, -2.8, 0.25),
    paint(b(-3.5, 0, -2.8, 3.5, 0.25, 11.5), TREAD),
    paint(b(-1.1, 0, 11.5, 1.1, 0.25, 12), TREAD),
    trim(-1.4, 0.25, 2, 1.4, 0.265, 8, 'hazard'),
    trim(-1.2, 0.25, 2.2, 1.2, 0.28, 7.8, STEEL),
    tech(b(-3.5, 0.25, 7, -2.7, 1.2, 11)),
    trim(-0.12, 3.4, -2, 0.12, 3.5, 10.5, STRIP),
    ...[-3.35, 3.2].map((x) => trim(x, 0, -3.95, x + 0.15, 3.1, -3.8, GLOW)),
    trim(-3.35, 3.1, -3.95, 3.35, 3.25, -3.8, GLOW),
  ];
}

/** Hab dome, 2 × 2 cells: an eight-sided drum 14 m across (a door south) under a stepped dome 7.1 m high, a lit column in the middle. */
function dome(): Box[] {
  const R = 7;
  return move([
    ...drum(R, PANEL),
    ...Array.from({ length: 6 }, (_, i) => disc(R * Math.sqrt(1 - (i / 6.3) ** 2) + 0.2, 3.5 + i * 0.6, 4.1 + i * 0.6, i % 2 ? ORB : PANEL)).flat(),
    ...disc(0.8, 0, 3.5, TECH),
    ...disc(0.84, 1.2, 1.3, GLOW).map((x) => ({ ...x, kind: 'trim' as const })),
    ...[-1, 1].map((s) => pan(b(s * 4.2 - 1.2, 0, 1.5, s * 4.2 + 1.2, 0.9, 2.7))),
  ], 4, 4);
}

/** The research-base tiles of Orbital Station (Style Pack 04), in palette order. */
export function orbitalPackTiles(): TileDefinition[] {
  const T = (id: string, category: TileDefinition['category'], displayName: string, blurb: string, cells: TileDefinition['cells'], solids: Box[], ports: TileDefinition['ports'] = ALL): TileDefinition => ({
    id: `orbital.${id}`,
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
    T('lab_module', 'Buildings', 'Lab Module', 'A white-panel lab on one cell: doors north and south, a workbench along the west wall, an open window band east', footprint(1, 1, 1), lab(), at(0, 'N', 'S')),
    T('airlock_tube', 'Buildings', 'Airlock Tube', 'An enclosed, ribbed, eight-sided corridor north to south with a light strip down its floor: join modules, put a door at each end for an airlock', footprint(1, 1, 1), tube(0), at(0, 'N', 'S')),
    T('landing_pad', 'Large', 'Landing Pad', '2 × 2 cells: a pad 1 m up with a ramp south and north, light strips along its edges and a painted ring', footprint(2, 2, 1), pad(), perimeter(2, 2)),
    T('comms_array', 'Vertical', 'Comms Array', 'An equipment hut (doors south and north) with a lattice mast and a dish on its roof, 15 m high: a landmark', footprint(1, 1, 4), comms()),
    T('greenhouse', 'Buildings', 'Greenhouse', '2 × 1 cells: a hall of open window bands between steel posts, doors on every side, planter beds as low cover (glaze it with edge styles)', footprint(2, 1, 1), greenhouse(), perimeter(2, 1)),
    T('sky_tube', 'Open', 'Sky Tube', 'The ribbed tube 4 m up on four legs, a window band each side: link upper floors north to south, walk under it', footprint(1, 1, 2), skyTube(), [...ALL, ...at(1, 'N', 'S')]),
    T('rover_bay', 'Buildings', 'Rover Bay', '1 × 2 cells: a garage open to the south over a ramp sill, a service pit cover in the floor, a bench, a door north', footprint(1, 2, 1), rover(), [{ side: 'S', level: 0, cell: [0, 0] }, { side: 'N', level: 0, cell: [0, 1] }]),
    T('hab_dome', 'Large', 'Hab Dome', '2 × 2 cells: an eight-sided drum 14 m across under a stepped dome 7 m high, one door south', footprint(2, 2, 2), dome(), [{ side: 'S', level: 0, cell: [0, 0] }, { side: 'S', level: 0, cell: [1, 0] }]),
  ];
}
