/**
 * Style Pack tiles for 09 Desert City (the owner's "Tileset 02" sheet; it
 * replaces 09 Sands of Egypt in the palette, whose tiles stay in the catalog):
 * box-built like the other packs' tiles (packTilesMedieval.ts). Sandstone
 * ashlar and plaster houses you go in and up through to flat roof terraces
 * behind parapets (every roof at 8 m, gaps in the parapets on the cell
 * centres, so a row of houses is one rooftop and rope bridges cross the
 * alleys), a courtyard with arcades and a terrace round it, a covered bazaar,
 * a market street under red canopies, a domed hall, a watch tower and a
 * minaret, the city wall and gate, a well court and paved streets. Every
 * surface that should look the part in any theme carries its own library
 * material (`LocalBox.surface`).
 *
 * Every stair follows the navmesh rules the Medieval pack learned: treads
 * 0.45 m, flights 2.2 m wide, ~2 m of floor before the foot and after the
 * head, turns on full-width landings, roof holes kept off the steps.
 *
 * Only types come from catalog.ts (which lists these tiles), so there is no
 * runtime import cycle; the few box helpers are repeated here.
 */
import type { LocalBox, Side, TileDefinition, TilePort } from './catalog.ts';

// ---------------------------------------------------------------- helpers

type Box = LocalBox;
const b = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, kind?: LocalBox['kind']): Box => ({ min: [x0, y0, z0], max: [x1, y1, z1], ...(kind ? { kind } : {}) });
/** A box in a library material (any theme). */
const paint = (box: Box, material: string, tint?: string): Box => ({ ...box, surface: { material: `core.${material}`, ...(tint ? { tint } : {}) } });
/** Visual only (never collides). */
const trim = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, material: string, tint?: string): Box => paint(b(x0, y0, z0, x1, y1, z1, 'trim'), material, tint);
/** A box turned `yaw` about its vertical centre line. */
const turned = (box: Box, yaw: number): Box => (yaw ? { ...box, yaw } : box);
/** A box `size` centred on (cx, cy, cz), tilted (radians). */
const tilted = (cx: number, cy: number, cz: number, size: readonly [number, number, number], o: { pitch?: number; roll?: number; kind?: LocalBox['kind'] } = {}): Box => ({
  min: [cx - size[0] / 2, cy - size[1] / 2, cz - size[2] / 2],
  max: [cx + size[0] / 2, cy + size[1] / 2, cz + size[2] / 2],
  ...(o.pitch ? { pitch: o.pitch } : {}),
  ...(o.roll ? { roll: o.roll } : {}),
  ...(o.kind ? { kind: o.kind } : {}),
});
const SIDES_ALL: Side[] = ['N', 'E', 'S', 'W'];
const ALL: TilePort[] = SIDES_ALL.map((side) => ({ side, level: 0 }));
const at = (level: number, ...sides: Side[]): TilePort[] => sides.map((side) => ({ side, level }));
const cellPort = (side: Side, level: number, x: number, y: number): TilePort => ({ side, level, cell: [x, y] });

function footprint(w: number, d: number, h = 1): [number, number, number][] {
  const cells: [number, number, number][] = [];
  for (let z = 0; z < h; z++) for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) cells.push([x, y, z]);
  return cells;
}

function perimeter(w: number, d: number, level = 0): TilePort[] {
  const ports: TilePort[] = [];
  for (let x = 0; x < w; x++) ports.push({ side: 'S', level, cell: [x, 0] }, { side: 'N', level, cell: [x, d - 1] });
  for (let y = 0; y < d; y++) ports.push({ side: 'W', level, cell: [0, y] }, { side: 'E', level, cell: [w - 1, y] });
  return ports;
}

/** Steps of 0.25 m climbing along +x/-x or +z/-z from `from`, between a0 and a1 across, each a block down to `floor`. */
function flight(axis: 'x' | 'z', dir: 1 | -1, from: number, a0: number, a1: number, n: number, base = 0, run = 0.45, floor = 0): Box[] {
  return Array.from({ length: n }, (_, i) => {
    const u0 = from + dir * i * run;
    const u1 = from + dir * (i + 1) * run;
    const top = base + (i + 1) * 0.25;
    const [lo, hi] = [Math.min(u0, u1), Math.max(u0, u1)];
    return axis === 'x' ? b(lo, floor, a0, hi, top, a1) : b(a0, floor, lo, a1, top, hi);
  });
}

/** A rail (solid: it stops you) along an axis-aligned line at height y. */
function rail(x0: number, z0: number, x1: number, z1: number, y = 0, material = 'cedar', h = 1): Box {
  const t = 0.07;
  const r = x0 === x1 ? b(x0 - t, y, Math.min(z0, z1), x0 + t, y + h, Math.max(z0, z1)) : b(Math.min(x0, x1), y, z0 - t, Math.max(x0, x1), y + h, z0 + t);
  return paint(r, material);
}

/** An opening in a wall run: [from, to] along the wall, [bottom, top] above the wall's foot. */
type Opening = readonly [number, number, number, number];
const door = (c: number, w = 2.2, h = 2.8): Opening => [c - w / 2, c + w / 2, 0, h];
const win = (c: number, w = 1.2, y0 = 1.0, y1 = 2.3): Opening => [c - w / 2, c + w / 2, y0, y1];

/** A wall in `material` along x at z = `at` or along z at x = `at`, from a0 to a1 and y0 to y1, `t` thick, with openings cut out. */
function wall(axis: 'x' | 'z', at: number, a0: number, a1: number, openings: readonly Opening[], y0: number, y1: number, material: string, t = 0.3, tint?: string): Box[] {
  const out: Box[] = [];
  const piece = (u0: number, u1: number, v0: number, v1: number) => {
    if (u1 - u0 < 0.01 || v1 - v0 < 0.01) return;
    const box = axis === 'x' ? b(u0, v0, at - t / 2, u1, v1, at + t / 2, 'wall') : b(at - t / 2, v0, u0, at + t / 2, v1, u1, 'wall');
    out.push(paint(box, material, tint));
  };
  const cuts = [...new Set([a0, a1, ...openings.flatMap((o) => [o[0], o[1]])])].filter((u) => u >= a0 && u <= a1).sort((p, q) => p - q);
  for (let i = 0; i + 1 < cuts.length; i++) {
    const [u0, u1] = [cuts[i]!, cuts[i + 1]!];
    const holes = openings.filter((o) => o[0] <= u0 + 1e-6 && o[1] >= u1 - 1e-6).map((o) => [y0 + o[2], Math.min(y1, y0 + o[3])] as const).sort((p, q) => p[0] - q[0]);
    let v = y0;
    for (const [h0, h1] of holes) {
      piece(u0, u1, v, h0);
      v = Math.max(v, h1);
    }
    piece(u0, u1, v, y1);
  }
  return out;
}

/** Outer walls round x0..x1, z0..z1 with openings per side (coordinates along each wall). */
function shell(x0: number, z0: number, x1: number, z1: number, open: Partial<Record<Side, readonly Opening[]>>, y0: number, y1: number, material: string, t = 0.3, tint?: string): Box[] {
  return [
    ...wall('x', z0 + t / 2, x0, x1, open.S ?? [], y0, y1, material, t, tint),
    ...wall('x', z1 - t / 2, x0, x1, open.N ?? [], y0, y1, material, t, tint),
    ...wall('z', x0 + t / 2, z0 + t, z1 - t, open.W ?? [], y0, y1, material, t, tint),
    ...wall('z', x1 - t / 2, z0 + t, z1 - t, open.E ?? [], y0, y1, material, t, tint),
  ];
}

/** Rectangles [x0, z0, x1, z1] of `r` not covered by any of `holes`. */
function subtract(r: readonly [number, number, number, number], holes: readonly (readonly [number, number, number, number])[]): [number, number, number, number][] {
  let parts: [number, number, number, number][] = [[...r]];
  for (const h of holes) {
    const next: [number, number, number, number][] = [];
    for (const p of parts) {
      const [x0, z0, x1, z1] = p;
      if (h[2] <= x0 || h[0] >= x1 || h[3] <= z0 || h[1] >= z1) {
        next.push(p);
        continue;
      }
      if (h[0] > x0) next.push([x0, z0, h[0], z1]);
      if (h[2] < x1) next.push([h[2], z0, x1, z1]);
      const [mx0, mx1] = [Math.max(x0, h[0]), Math.min(x1, h[2])];
      if (h[1] > z0) next.push([mx0, z0, mx1, h[1]]);
      if (h[3] < z1) next.push([mx0, h[3], mx1, z1]);
    }
    parts = next;
  }
  return parts.filter(([x0, z0, x1, z1]) => x1 - x0 > 0.01 && z1 - z0 > 0.01);
}

/**
 * The stone filling the head of a round arch in an opening of a wall along x
 * at z (or along z at x): slices from the curve up to the opening's top, so a
 * rectangular opening `w` wide whose top is `spring + w / 2` reads as an arch.
 */
function archFill(axis: 'x' | 'z', at: number, c: number, w: number, spring: number, material: string, t = 0.3, tint?: string, slices = 8): Box[] {
  const r = w / 2;
  const top = spring + r;
  const out: Box[] = [];
  for (let i = 0; i < slices; i++) {
    const u0 = c - r + (i * w) / slices;
    const u1 = u0 + w / slices;
    const m = Math.min(Math.abs(u0 - c), Math.abs(u1 - c));
    const y = spring + Math.sqrt(Math.max(0, r * r - m * m));
    if (top - y < 0.02) continue;
    out.push(paint(axis === 'x' ? b(u0, y, at - t / 2, u1, top, at + t / 2) : b(at - t / 2, y, u0, at + t / 2, top, u1), material, tint));
  }
  return out;
}

/** An arched opening (round head): the opening to cut and the stone to fill its head with. */
function arched(axis: 'x' | 'z', at: number, c: number, w: number, spring: number, material: string, t = 0.3, tint?: string): { opening: Opening; fill: Box[] } {
  return { opening: [c - w / 2, c + w / 2, 0, spring + w / 2], fill: archFill(axis, at, c, w, spring, material, t, tint) };
}

/**
 * A dome over (cx, cz) springing at y with radius r: courses of glazed tiles,
 * each an octagon (two squares, one turned 45°) shrinking up the curve, and a
 * brass finial.
 */
function dome(cx: number, y: number, cz: number, r: number, material = 'dome_tiles', courses = 8): Box[] {
  const out: Box[] = [];
  const h = r / courses;
  for (let i = 0; i < courses; i++) {
    const y0 = y + i * h;
    const s = Math.sqrt(Math.max(0, 1 - ((i * h) / r) ** 2)) * r * 0.93;
    for (const yaw of [0, Math.PI / 4]) out.push(turned(paint(b(cx - s, y0, cz - s, cx + s, y0 + h + 0.02, cz + s), material), yaw));
  }
  out.push(paint(b(cx - 0.12, y + r - 0.05, cz - 0.12, cx + 0.12, y + r + 0.9, cz + 0.12), 'brass'));
  out.push(turned(trim(cx - 0.22, y + r + 0.3, cz - 0.22, cx + 0.22, y + r + 0.62, cz + 0.22, 'brass'), Math.PI / 4));
  return out;
}

/**
 * A parapet round x0..x1, z0..z1 standing on y, `h` high, with 2.4 m gaps
 * centred on the given points of each side (the roofs of neighbours and
 * bridges come in there), stepped merlons along its top.
 */
function parapet(x0: number, z0: number, x1: number, z1: number, y: number, gaps: Partial<Record<Side, readonly number[]>>, material: string, h = 1.0, t = 0.3): Box[] {
  const g = (cs: readonly number[] | undefined): Opening[] => (cs ?? []).map((c) => [c - 1.2, c + 1.2, 0, h + 1]);
  const out = shell(x0, z0, x1, z1, { S: g(gaps.S), N: g(gaps.N), W: g(gaps.W), E: g(gaps.E) }, y, y + h, material, t);
  // Merlons: little stepped blocks along the top, clear of the gaps.
  const clear = (side: Side, u: number) => !(gaps[side] ?? []).some((c) => Math.abs(u - c) < 1.6);
  for (let u = x0 + 0.8; u < x1 - 0.5; u += 1.6) {
    if (clear('S', u)) out.push(trim(u - 0.3, y + h, z0, u + 0.3, y + h + 0.35, z0 + t, material));
    if (clear('N', u)) out.push(trim(u - 0.3, y + h, z1 - t, u + 0.3, y + h + 0.35, z1, material));
  }
  for (let u = z0 + 0.8; u < z1 - 0.5; u += 1.6) {
    if (clear('W', u)) out.push(trim(x0, y + h, u - 0.3, x0 + t, y + h + 0.35, u + 0.3, material));
    if (clear('E', u)) out.push(trim(x1 - t, y + h, u - 0.3, x1, y + h + 0.35, u + 0.3, material));
  }
  return out;
}

/**
 * A switchback stair climbing inside a square (half-size `h` to the outside of
 * the flights, flights `w` wide): a flight north up the east side, a landing
 * the full width of the north side, a flight south down the west side, a
 * landing the full width of the south side, and round again. Every step is
 * 0.25 m; landings are a step too; steps are slabs 0.3 m thick.
 */
function switchback(h: number, w: number, n: number, flights: readonly number[], base = 0): Box[] {
  const prints: [number, number, number, number][] = [];
  const inner = h - w;
  let i = 0;
  for (let f = 0; i < n; f++) {
    const count = flights[f % flights.length]!;
    const run = (2 * inner) / count;
    const north = f % 2 === 0;
    for (let j = 0; j < count && i < n; j++, i++) {
      const u0 = -inner + j * run;
      prints.push(north ? [inner, u0, h, u0 + run] : [-h, -u0 - run, -inner, -u0]);
    }
    if (i < n) {
      prints.push(north ? [-h, inner, h, h] : [-h, -h, h, -inner]);
      i++;
    }
  }
  return prints.map((r, k) => {
    const top = base + (k + 1) * 0.25;
    return b(r[0], top - 0.3, r[1], r[2], top, r[3]);
  });
}

// ---------------------------------------------------------------- materials

const ASHLAR = 'ashlar';
const PLASTER = 'stucco';
const CEDAR = 'cedar';
const PAVING = 'worn_paving';
const TILES = 'sandstone_tiles';
const ZELLIGE = 'zellige';
const RUG = 'rug_red';
const LATTICE = 'mashrabiya';
const CANOPY = 'canopy_red';
const FLOOR = 'pbr_floorboards';
const ashlar = (box: Box, tint?: string) => paint(box, ASHLAR, tint);
const cedar = (box: Box) => paint(box, CEDAR);

/** A lattice screen (mashrabiya) in a window: along x at z (or along z at x), flush with the face. */
function screen(axis: 'x' | 'z', at: number, u0: number, u1: number, y0: number, y1: number): Box[] {
  return [axis === 'x' ? trim(u0, y0, at - 0.04, u1, y1, at + 0.04, LATTICE) : trim(at - 0.04, y0, u0, at + 0.04, y1, u1, LATTICE)];
}

// ---------------------------------------------------------------- houses

/** The top of every flat roof in the pack (houses, the outside stair's deck, rope bridges). */
export const DESERT_ROOF = 8.0;

type HouseKind = 'plaster' | 'ashlar' | 'shop';

/**
 * A town house on 2 × 1 cells, two storeys and a flat roof terrace at 8 m
 * behind a parapet (gaps on the cell centres of every side: the next roof, a
 * rope bridge, an Outside Stair's deck). Ground floor: front door (south), back
 * door (north), side doors; a stair along the north wall up to the upper
 * floor, whose doors east and west (centred, 2.2 m) meet galleries and the
 * next house; a second stair along the south wall up to the roof.
 */
function desertHouse(kind: HouseKind): Box[] {
  const T = 0.3;
  const X0 = -3.8;
  const X1 = 11.8;
  const out: Box[] = [];
  const lower = kind === 'plaster' ? PLASTER : ASHLAR;
  const upper = kind === 'ashlar' ? ASHLAR : PLASTER;
  // The shop's ground storey stands back 2 m behind a porch under the upper floor.
  const front = kind === 'shop' ? -1.8 : -3.8;
  const side = kind === 'shop' ? 0.6 : -1.6;
  const frontDoor = arched('x', front + T / 2, kind === 'shop' ? 0.4 : 1.0, 2.2, 2.0, lower);
  const groundS: Opening[] = kind === 'shop' ? [frontDoor.opening, [2.6, 10.8, 0.9, 2.8]] : [frontDoor.opening, win(-2.2), win(5.0), win(8.8)];
  out.push(...shell(X0, front, X1, 3.8, { S: groundS, N: [door(-2.0, 2.2, 2.6), win(9.5, 1.2, 1.2, 2.4)], W: [door(side, 2.2, 2.6)], E: [door(side, 2.2, 2.6)] }, 0, 4, lower, T), ...frontDoor.fill);
  // Upper storey: windows south and north, doors east and west (centred) for galleries and the next house.
  const upS = [-2.0, 10.6];
  const upN = [2.0, 5.6, 9.4];
  out.push(...shell(X0, -3.8, X1, 3.8, { S: upS.map((c) => win(c, 1.1, 0.9, 2.4)), N: upN.map((c) => win(c, 1.1, 0.9, 2.4)), W: [door(0)], E: [door(0)] }, 4, 7.75, upper, T));
  for (const c of upS) out.push(...screen('x', -3.65, c - 0.55, c + 0.55, 4.9, 6.4));
  for (const c of upN) out.push(...screen('x', 3.65, c - 0.55, c + 0.55, 4.9, 6.4));
  // Sills under the upper doors, out to the cell edge.
  for (const x of [-4, X1]) out.push(cedar(b(x, 3.75, -1.1, x + 0.2, 4.0, 1.1)));
  // Upper floor (a hole over the ground stair; over the porch on a shop).
  const floorRects = subtract([-3.5, -3.5, 11.5, 3.5], [[0, 1.3, 7.2, 3.5]]);
  out.push(...floorRects.map(([x0, z0, x1, z1]) => paint(b(x0, 3.75, z0, x1, 4.0, z1), FLOOR)));
  if (kind === 'shop') out.push(paint(b(X0, 3.75, -3.8, X1, 4.0, -3.5), FLOOR));
  // The ground stair along the north wall, west to east (3.5 m of floor before its foot, the upper floor ahead of its head).
  out.push(...flight('x', 1, 0, 1.3, 3.5, 16, 0, 0.45).map((s) => paint(s, TILES, '#c8b088')));
  out.push(rail(0, 1.3, 6.0, 1.3, 4.0));
  // The roof stair along the south wall, east to west from 4 m to the roof (2.1 m of floor before its foot).
  out.push(...flight('x', -1, 9.4, -3.5, -1.3, 16, 4, 0.45, 4).map((s) => paint(s, TILES, '#c8b088')));
  // The roof: a slab over the walls out to the cell edges, a hole over the roof stair kept off the steps, a rail round it.
  const roofY = DESERT_ROOF;
  out.push(...subtract([-4, -4, 12, 4], [[2.2, -3.5, 9.7, -1.0]]).map(([x0, z0, x1, z1]) => paint(b(x0, roofY - 0.25, z0, x1, roofY, z1), TILES, '#d8c8a8')));
  out.push(rail(3.4, -1.0, 9.7, -1.0, roofY), rail(9.7, -3.5, 9.7, -1.0, roofY));
  out.push(...parapet(-4, -4, 12, 4, roofY, { S: [0, 8], N: [0, 8], W: [0], E: [0] }, upper));
  // Ceilings: cedar beams under the upper floor and the roof.
  for (let x = -2.5; x < 11; x += 2.5) out.push(trim(x - 0.12, 3.55, -3.5, x + 0.12, 3.75, 3.5, CEDAR), trim(x - 0.12, 7.55, -3.5, x + 0.12, 7.75, 3.5, CEDAR));
  // Furniture: a rug, a low table and cushions downstairs, a bed and a chest upstairs (clear of the stair runs).
  out.push(trim(-3.0, 0, -1.4, 0.0, 0.025, 1.0, RUG), cedar(b(-2.0, 0, -0.7, -1.0, 0.45, 0.3)));
  out.push(paint(b(-3.4, 4, 1.4, -1.4, 4.5, 3.4), 'canopy_red', '#d8c8b0'), cedar(b(-3.4, 4, -0.8, -2.6, 4.6, 0.6)));
  // Rooftop: a rug under a cloth shade on four posts (walk under it), a water jar.
  out.push(trim(7.6, roofY, 0.6, 11.0, roofY + 0.02, 3.2, RUG), trim(7.4, roofY + 2.3, 0.4, 11.4, roofY + 2.38, 3.6, CANOPY, kind === 'shop' ? '#e0d0b0' : undefined));
  for (const [x, z] of [[7.5, 0.5], [11.3, 0.5], [7.5, 3.5], [11.3, 3.5]] as const) out.push(cedar(b(x - 0.06, roofY, z - 0.06, x + 0.06, roofY + 2.3, z + 0.06)));
  out.push(paint(b(-3.4, roofY, 2.6, -2.6, roofY + 0.9, 3.4), 'pbr_brick_old', '#c08860'));
  if (kind === 'plaster') {
    // Cedar beam ends (vigas) under the roof, a blue door frame.
    for (let x = -3.0; x < 11.6; x += 1.6) for (const z of [-4.0, 3.8]) out.push(trim(x - 0.09, 7.3, z, x + 0.09, 7.5, z + 0.2, CEDAR));
    out.push(trim(-0.25, 0, -3.92, 2.25, 0.18, -3.8, ASHLAR), trim(-0.25, 0.18, -3.9, -0.1, 3.2, -3.8, 'paint_matte', '#2a5a9a'), trim(2.1, 0.18, -3.9, 2.25, 3.2, -3.8, 'paint_matte', '#2a5a9a'));
  } else if (kind === 'ashlar') {
    // A zellige band between the storeys and a carved arch ring round the door.
    out.push(trim(X0, 3.35, -3.88, X1, 3.7, -3.8, ZELLIGE), trim(X0, 3.35, 3.8, X1, 3.7, 3.88, ZELLIGE));
    out.push(trim(-0.4, 0, -3.92, 2.4, 0.4, -3.8, ASHLAR, '#b89868'));
    for (const s of [-1, 1]) out.push(trim(1.0 + s * 1.25 - 0.15, 0.4, -3.92, 1.0 + s * 1.25 + 0.15, 2.0, -3.8, ASHLAR, '#c8a878'));
  } else {
    // The shop: posts along the porch, a red canopy sloping over the street front, a counter and shelves, crates.
    for (const x of [-3.6, 4.0, 11.6]) out.push(cedar(b(x - 0.14, 0, -3.8, x + 0.14, 3.75, -3.52)));
    out.push({ ...trim(-3.8, 2.75, -3.95, 11.8, 2.83, -2.9, CANOPY), pitch: 0.25 });
    out.push(cedar(b(8.6, 0, -1.4, 9.6, 1.0, -0.6)), trim(2.7, 0.9, front - 0.12, 10.7, 0.98, front + 0.3, CEDAR));
    out.push(trim(-3.6, 0, -3.8, 11.6, 0.02, front, PAVING, '#e0d0b0'));
  }
  // A sandstone plinth.
  if (kind !== 'shop') out.push(trim(X0 - 0.05, 0, -3.85, X1 + 0.05, 0.4, -3.8, ASHLAR, '#b09068'));
  out.push(trim(-3.5, 0, front + T, 11.5, 0.02, 3.5, TILES));
  return out;
}

function houses(): TileDefinition[] {
  const def = (id: string, displayName: string, blurb: string, kind: HouseKind): TileDefinition => ({
    id: `desert.${id}`,
    category: 'Buildings',
    displayName,
    blurb,
    cells: footprint(2, 1, 3),
    floors: [0],
    ports: [...perimeter(2, 1), cellPort('W', 1, 0, 0), cellPort('E', 1, 1, 0), ...perimeter(2, 1, 2)],
    open: true,
    edgeDefault: 'open',
    solids: desertHouse(kind),
  });
  return [
    def('house', 'Plaster House', '2 × 1 cells, two storeys of sun-faded plaster with cedar beam ends and lattice windows, a flat roof terrace 8 m up behind a parapet (gaps on every cell centre: the next roof, a rope bridge or an Outside Stair\'s deck). Doors on every side; a stair to the upper floor, whose doors east and west meet galleries and the next house; a stair on to the roof', 'plaster'),
    def('house_ashlar', 'Ashlar House', 'A Plaster House in sandstone ashlar: a zellige band between the storeys, an arched door, lattice screens; stairs inside up to the roof terrace', 'ashlar'),
    def('house_shop', 'Shop House', 'A house whose ground storey stands back behind a porch: a wide serving counter under a red canopy on the street (south), the family upstairs, the roof terrace above', 'shop'),
  ];
}

// ---------------------------------------------------------------- the rest

/** The north face of the city wall: its walk is 3.4 m wide behind the merlons. */
const WALL_N = 0.2;

function cityWall(stair: 'none' | 'east' | 'west', x0 = -4, x1 = 4): Box[] {
  // The wall (south: outside the city) with a walk 4 m up behind pointed merlons; a stair up its north face.
  const out: Box[] = [ashlar(b(x0, 0, -3.8, x1, 4.0, WALL_N)), ashlar(b(x0, 0, -3.95, x1, 0.6, -3.8), '#b09068')];
  for (let x = x0 + 0.3; x < x1 - 0.5; x += 1.6) out.push(ashlar(b(x, 4.0, -3.8, x + 0.9, 5.3, -3.3)), trim(x + 0.2, 5.3, -3.75, x + 0.7, 5.6, -3.35, ASHLAR));
  out.push(ashlar(b(x0, 4.0, -3.8, x1, 4.6, -3.3)));
  if (stair === 'east') {
    // Up from the west end, climbing east; the landing runs on to the east end.
    out.push(...flight('x', 1, x0, WALL_N, WALL_N + 2.4, 15, 0, 0.45).map((s) => ashlar(s, '#c8b090')));
    out.push(ashlar(b(x0 + 6.75, 0, WALL_N, x1, 4.0, WALL_N + 2.4), '#c8b090'));
    out.push(rail(x0 + 6.75, WALL_N + 2.45, x1, WALL_N + 2.45, 4.0, ASHLAR));
  } else if (stair === 'west') {
    out.push(...flight('x', -1, x1, WALL_N, WALL_N + 2.4, 15, 0, 0.45).map((s) => ashlar(s, '#c8b090')));
    out.push(ashlar(b(x0, 0, WALL_N, x1 - 6.75, 4.0, WALL_N + 2.4), '#c8b090'));
    out.push(rail(x0, WALL_N + 2.45, x1 - 6.75, WALL_N + 2.45, 4.0, ASHLAR));
  }
  return out;
}

function otherTiles(): TileDefinition[] {
  const tiles: TileDefinition[] = [];

  // Outside Stair: stone switchback flights round an open well, a landing 4 m up along the south side
  // (upper doors, galleries, terraces) and a deck along the south edge at 8 m, level with the roofs.
  tiles.push({
    id: 'desert.outside_stair',
    category: 'Vertical',
    displayName: 'Outside Stair',
    blurb: 'Stone switchback stairs round an open well: a landing 4 m up along the south side (galleries, terraces), then a deck along the south edge at 8 m, level with the roof terraces: put it north of a house and step through the parapet gap onto the roof',
    cells: footprint(1, 1, 3),
    floors: [0],
    ports: [...ALL, ...at(1, 'S', 'E', 'W'), ...at(2, 'S')],
    open: true,
    edgeDefault: 'open',
    solids: [
      ...switchback(3.9, 2.0, 32, [7, 7, 7, 7]).map((s) => ashlar(s, '#d0b890')),
      ashlar(b(-3.9, 7.75, -4, 3.9, 8.0, -3.9), '#d0b890'),
      rail(-1.9, -1.9, 1.9, -1.9, 4.0, ASHLAR),
      rail(-1.9, -1.9, 1.9, -1.9, 8.0, ASHLAR),
      ...([[-4, -4], [3.75, -4], [-4, 3.75], [3.75, 3.75]] as const).map(([x, z]) => ashlar(b(x, 0, z, x + 0.25, 8.0, z + 0.25), '#b89870')),
      trim(-1.85, 0, -1.85, 1.85, 0.02, 1.85, PAVING),
    ],
  });

  // Rope Bridge: a plank bridge at roof level (8 m) east to west between two roofs' parapet gaps; Cedar Gallery: the same at 4 m between upper doors.
  for (const [id, displayName, y, blurb] of [
    ['rope_bridge', 'Rope Bridge', DESERT_ROOF, 'A plank bridge with rope rails 8 m up, east to west, across an alley from one roof terrace\'s parapet gap to the next (2.2 m wide: bots cross it too)'],
    ['gallery', 'Cedar Gallery', 4.0, 'A covered cedar gallery 4 m up, east to west, between two houses\' upper doors over an alley: lattice screens along both sides, a plank roof'],
  ] as const) {
    const roped = id === 'rope_bridge';
    const solids: Box[] = [paint(b(-4, y - 0.2, -1.1, 4, y, 1.1), 'pbr_planks', roped ? '#b09070' : undefined)];
    for (const z of [-1.1, 1.1]) {
      if (roped) {
        solids.push(rail(-4, z, 4, z, y, 'pbr_canvas', 1.0));
        for (const x of [-3.9, 0, 3.9]) solids.push(cedar(b(x - 0.08, y - 0.2, z - 0.08, x + 0.08, y + 1.2, z + 0.08)));
      } else {
        solids.push(paint(b(-4, y, z - 0.06, 4, y + 1.1, z + 0.06), LATTICE));
        for (const x of [-3.9, -1.3, 1.3, 3.9]) solids.push(cedar(b(x - 0.1, y - 0.2, z - 0.1, x + 0.1, y + 2.8, z + 0.1)));
        solids.push(trim(-4, y + 1.1, z - 0.04, 4, y + 2.4, z + 0.04, LATTICE));
      }
    }
    if (roped) for (let x = -3.6; x < 4; x += 0.8) solids.push(trim(x - 0.03, y - 0.45, -1.15, x + 0.03, y - 0.2, 1.15, CEDAR));
    else solids.push(cedar(b(-4, y + 2.8, -1.4, 4, y + 3.0, 1.4)), ...[-2.6, 2.6].flatMap((x) => [cedar(b(x - 0.12, 0, -1.1, x + 0.12, y - 0.2, -0.86)), cedar(b(x - 0.12, 0, 0.86, x + 0.12, y - 0.2, 1.1))]));
    tiles.push({
      id: `desert.${id}`,
      category: 'Open',
      displayName,
      blurb,
      cells: footprint(1, 1, roped ? 3 : 2),
      floors: [0],
      ports: [...ALL, ...at(roped ? 2 : 1, 'E', 'W')],
      open: true,
      edgeDefault: 'open',
      solids,
    });
  }

  // Courtyard: 2 × 2 cells, arcades round a fountain court, a terrace on the arcades' roofs, a stair up in the west walk.
  {
    const out: Box[] = [];
    const IN0 = -1;
    const IN1 = 9;
    // Outer walls with gateways on every cell centre.
    const gates = [0, 8].map((c) => door(c, 3.0, 3.0));
    out.push(...shell(-4, -4, 12, 12, { S: gates, N: gates, W: gates, E: gates }, 0, 3.75, ASHLAR, 0.4));
    for (const c of [0, 8]) for (const [axis, at] of [['x', -3.8], ['x', 11.8], ['z', -3.8], ['z', 11.8]] as const) out.push(...archFill(axis, at, c, 3.0, 2.0, ASHLAR, 0.4, undefined, 6).filter((x) => x.min[1] < 3.0));
    // The arcades: columns on the inner line, round arches between, the terrace slab over the walks.
    const cols = [-1, 1.5, 4, 6.5, 9];
    for (const u of cols) for (const v of [IN0, IN1]) {
      out.push(ashlar(b(u - 0.25, 0, v - 0.25, u + 0.25, 3.75, v + 0.25), '#e0c8a0'));
      out.push(ashlar(b(v - 0.25, 0, u - 0.25, v + 0.25, 3.75, u + 0.25), '#e0c8a0'));
    }
    for (let k = 0; k + 1 < cols.length; k++) {
      const c = (cols[k]! + cols[k + 1]!) / 2;
      for (const v of [IN0, IN1]) {
        out.push(...archFill('x', v, c, 2.0, 2.4, ASHLAR, 0.4, '#e0c8a0', 6), ashlar(b(c - 1.0, 3.4, v - 0.2, c + 1.0, 3.75, v + 0.2), '#e0c8a0'));
        out.push(...archFill('z', v, c, 2.0, 2.4, ASHLAR, 0.4, '#e0c8a0', 6), ashlar(b(v - 0.2, 3.4, c - 1.0, v + 0.2, 3.75, c + 1.0), '#e0c8a0'));
      }
    }
    // Terrace slabs over the four walks.
    out.push(paint(b(-4, 3.75, -4, 12, 4.0, IN0 + 0.25), TILES), paint(b(-4, 3.75, IN1 - 0.25, 12, 4.0, 12), TILES), paint(b(-4, 3.75, IN0 + 0.25, IN0 + 0.25, 4.0, IN1 - 0.25), TILES), paint(b(IN1 - 0.25, 3.75, IN0 + 0.25, 12, 4.0, IN1 - 0.25), TILES));
    // The stair: up the court beside the west walk, north, onto a landing joining the north terrace.
    const SX0 = -0.7;
    const SX1 = 1.5;
    out.push(...flight('z', 1, 1.0, SX0, SX1, 16, 0, 0.45).map((s) => ashlar(s, '#d8c098')));
    out.push(ashlar(b(SX0, 3.75, 8.2, SX1, 4.0, IN1 + 0.25), '#d8c098'));
    // Parapet on the outer edge (gaps on the cell centres), balustrade along the inner edge (a gap where the stair arrives).
    out.push(...parapet(-4, -4, 12, 12, 4.0, { S: [0, 8], N: [0, 8], W: [0, 8], E: [0, 8] }, ASHLAR));
    const bal = (x0: number, z0: number, x1: number, z1: number) => paint(x0 === x1 ? b(x0 - 0.1, 4.0, z0, x0 + 0.1, 4.9, z1) : b(x0, 4.0, z0 - 0.1, x1, 4.9, z0 + 0.1), ASHLAR, '#e8d4b0');
    out.push(bal(IN0 + 0.25, IN0 + 0.25, IN1 - 0.25, IN0 + 0.25), bal(SX1, IN1 - 0.25, IN1 - 0.25, IN1 - 0.25), bal(IN0 + 0.25, IN0 + 0.25, IN0 + 0.25, IN1 - 0.25), bal(IN1 - 0.25, IN0 + 0.25, IN1 - 0.25, IN1 - 0.25));
    // The court: zellige round an octagonal fountain basin, paving under the walks.
    out.push(trim(IN0, 0, IN0, IN1, 0.02, IN1, ZELLIGE), trim(-3.6, 0, -3.6, 11.6, 0.015, 11.6, PAVING));
    for (const yaw of [0, Math.PI / 4]) out.push(turned(ashlar(b(2.6, 0, 2.6, 5.4, 0.55, 5.4), '#e8d8c0'), yaw), turned(trim(2.85, 0.4, 2.85, 5.15, 0.5, 5.15, 'pbr_pool_tiles', '#5ab8c8'), yaw));
    out.push(ashlar(b(3.75, 0.55, 3.75, 4.25, 1.4, 4.25), '#e8d8c0'), trim(3.5, 1.4, 3.5, 4.5, 1.5, 4.5, ASHLAR));
    tiles.push({
      id: 'desert.courtyard',
      category: 'Large',
      displayName: 'Courtyard',
      blurb: '2 × 2 cells: arcades of round arches round a zellige court with a fountain (cover), gateways in the outer walls on every cell centre, and a terrace 4 m up on the arcades\' roofs reached by a stair in the court\'s west side; the terrace\'s parapet opens on the cell centres to galleries and upper doors',
      cells: footprint(2, 2, 2),
      floors: [0],
      ports: [...perimeter(2, 2), ...perimeter(2, 2, 1)],
      open: true,
      edgeDefault: 'open',
      solids: out,
    });
  }

  // Covered Bazaar: 1 × 2 cells, a lane north to south between shop alcoves under a vaulted roof with little domes, a terrace on top.
  {
    const out: Box[] = [];
    // Back walls east and west with doors on the cell centres (the upper doors line), partitions, counters.
    for (const x of [-3.8, 3.8]) out.push(...wall('z', x + (x < 0 ? 0.15 : -0.15), -4, 12, [door(0, 2.2, 2.6), door(8, 2.2, 2.6)], 0, 3.75, ASHLAR));
    for (const z of [-4, 4, 12]) for (const s of [-1, 1]) out.push(ashlar(b(s > 0 ? 1.6 : -3.8, 0, Math.max(-4, z - 0.25), s > 0 ? 3.8 : -1.6, 3.75, Math.min(12, z + 0.25))));
    // Counters along the lane either side of each alcove's door (the way from the door to the lane stays open).
    for (const c of [0, 8]) for (const z0 of [c - 3.5, c + 1.5]) for (const s of [-1, 1]) out.push(cedar(b(s > 0 ? 1.8 : -2.2, 0, z0, s > 0 ? 2.2 : -1.8, 0.95, z0 + 2.0)));
    // Stone lintels over the alcoves' mouths, with an arch ring painted on.
    for (const c of [0, 8]) for (const s of [-1, 1]) out.push(ashlar(b(s * 1.6 - 0.15, 3.0, c - 3.75, s * 1.6 + 0.15, 3.75, c + 3.75), '#d8c098'), trim(s * 1.6 - 0.17, 2.85, c - 3.6, s * 1.6 + 0.17, 3.0, c + 3.6, ZELLIGE));
    // Roof slab (the terrace), skylights' domes, the parapet with gaps east and west on the cell centres.
    out.push(paint(b(-4, 3.75, -4, 4, 4.0, 12), TILES, '#d8c8a8'));
    for (const z of [0, 8]) out.push(...dome(0, 4.0, z, 1.3, 'dome_tiles', 5));
    out.push(...parapet(-4, -4, 4, 12, 4.0, { W: [0, 8], E: [0, 8], S: [0], N: [0] }, ASHLAR));
    // Under the vault: hanging cloths, the lane's paving.
    for (let z = -3; z < 12; z += 2.5) out.push({ ...trim(-1.5, 3.1, z - 0.6, 1.5, 3.16, z + 0.6, CANOPY, z % 5 ? '#e0c060' : undefined), roll: 0.08 });
    out.push(trim(-3.8, 0, -4, 3.8, 0.02, 12, PAVING));
    for (const z of [-2, 6]) for (const s of [-1, 1]) out.push(trim(s > 0 ? 2.4 : -3.6, 0.02, z, s > 0 ? 3.6 : -2.4, 0.04, z + 2.0, RUG));
    tiles.push({
      id: 'desert.bazaar',
      category: 'Buildings',
      displayName: 'Covered Bazaar',
      blurb: '1 × 2 cells: a covered lane north to south between shop alcoves with counters, cloths hung under the roof; doors east and west on the cell centres; a terrace on the roof 4 m up (parapet gaps on the cell centres for galleries and upper doors) round two little blue domes',
      cells: footprint(1, 2, 2),
      floors: [0],
      ports: [...perimeter(1, 2), ...perimeter(1, 2, 1)],
      open: true,
      edgeDefault: 'open',
      solids: out,
    });
  }

  // Market Street: a paved street north to south between stalls under red canopies.
  {
    const out: Box[] = [trim(-4, 0, -4, 4, 0.02, 4, PAVING), trim(-0.15, 0.02, -4, 0.15, 0.035, 4, TILES, '#9a8060')];
    for (const s of [-1, 1]) {
      const x0 = s > 0 ? 2.6 : -3.8;
      const x1 = s > 0 ? 3.8 : -2.6;
      // Two stalls a side: a counter (cover), a canopy sloping toward the street on cedar poles.
      for (const z0 of [-3.6, 0.6]) {
        out.push(cedar(b(x0, 0, z0, x1, 0.95, z0 + 2.8)), trim(x0 + 0.1, 0.95, z0 + 0.2, x1 - 0.1, 1.15, z0 + 2.6, 'canopy_red', '#e0b060'));
        out.push({ ...trim(s > 0 ? 2.2 : -4.0, 2.6, z0 - 0.2, s > 0 ? 4.0 : -2.2, 2.68, z0 + 3.2, CANOPY, z0 > 0 ? '#f0e0c8' : undefined), roll: s * 0.22 });
        for (const z of [z0, z0 + 2.8]) out.push(cedar(b(s > 0 ? 2.4 : -2.5, 0, z - 0.06, s > 0 ? 2.5 : -2.4, 2.6, z + 0.06)));
      }
    }
    tiles.push({
      id: 'desert.market_street',
      category: 'Open',
      displayName: 'Market Street',
      blurb: 'A paved street north to south between market stalls: counters (cover) under red canopies on cedar poles both sides, a 4.8 m lane down the middle',
      cells: [[0, 0, 0]],
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: out,
    });
  }

  // Domed Hall: a square hall of ashlar with an arch on every side, a fountain inside, a blue dome on an octagonal drum.
  {
    const out: Box[] = [];
    for (const [axis, at] of [['x', -3.4], ['x', 3.4], ['z', -3.4], ['z', 3.4]] as const) {
      const a = arched(axis, at, 0, 2.6, 2.2, ASHLAR, 0.6);
      out.push(...wall(axis, at, axis === 'x' ? -3.7 : -3.1, axis === 'x' ? 3.7 : 3.1, [a.opening, win(-2.2, 0.3, 1.2, 2.6), win(2.2, 0.3, 1.2, 2.6)], 0, 5.6, ASHLAR, 0.6), ...a.fill);
    }
    out.push(ashlar(b(-3.8, 5.6, -3.8, 3.8, 6.0, 3.8), '#d8c098'));
    out.push(...parapet(-3.8, -3.8, 3.8, 3.8, 6.0, {}, ASHLAR, 0.6, 0.3));
    for (const yaw of [0, Math.PI / 4]) out.push(turned(ashlar(b(-2.7, 6.0, -2.7, 2.7, 7.3, 2.7), '#e0c8a0'), yaw), turned(trim(-2.85, 7.15, -2.85, 2.85, 7.35, 2.85, ZELLIGE), yaw));
    out.push(...dome(0, 7.3, 0, 2.6, 'dome_tiles', 9));
    // Inside: zellige floor, a fountain basin, lattice in the slit windows.
    out.push(trim(-3.1, 0, -3.1, 3.1, 0.02, 3.1, ZELLIGE));
    for (const yaw of [0, Math.PI / 4]) out.push(turned(ashlar(b(-0.9, 0, -0.9, 0.9, 0.5, 0.9), '#e8d8c0'), yaw));
    out.push(trim(-0.6, 0.5, -0.6, 0.6, 0.52, 0.6, 'pbr_pool_tiles', '#5ab8c8'));
    for (const c of [-2.2, 2.2]) for (const at of [-3.4, 3.4]) out.push(...screen('x', at, c - 0.15, c + 0.15, 1.2, 2.6), ...screen('z', at, c - 0.15, c + 0.15, 1.2, 2.6));
    tiles.push({
      id: 'desert.dome',
      category: 'Buildings',
      displayName: 'Domed Hall',
      blurb: 'A square ashlar hall with a round arch on every side and a fountain under a blue tiled dome on an octagonal drum (the dome tops out near 11 m): a landmark and a room to fight through',
      cells: footprint(1, 1, 3),
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: out,
    });
  }

  // Watch Tower and Minaret.
  {
    // The tower: arched openings at every level, a switchback stair inside to a lookout 8 m up on the south side behind merlons, a blue cap on posts.
    const towerBase = (): Box[] => {
      const out: Box[] = [];
      for (const [axis, at] of [['x', -3.85], ['x', 3.85], ['z', -3.85], ['z', 3.85]] as const) {
        const openings: Opening[] = [win(0, 2.4, 1.2, 2.8), win(0, 1.0, 4.8, 6.6)];
        if (axis === 'x' && at < 0) openings[0] = door(0, 2.4, 2.8);
        out.push(...wall(axis, at, axis === 'x' ? -4 : -3.7, axis === 'x' ? 4 : 3.7, openings, 0, 8.0, ASHLAR, 0.3));
      }
      out.push(...switchback(3.7, 2.0, 32, [7]).map((s) => ashlar(s, '#d0b890')));
      // The lookout: a gallery the width of the south side, level with the top landing; the well stays open.
      out.push(rail(-1.7, -1.7, 1.7, -1.7, 8.0, ASHLAR));
      out.push(...parapet(-4, -4, 4, 4, 8.0, {}, ASHLAR, 1.1));
      out.push(trim(-4.0, 0, -4.0, 4.0, 0.5, -3.95, ASHLAR, '#b09068'));
      return out;
    };
    tiles.push({
      id: 'desert.tower',
      category: 'Vertical',
      displayName: 'Watch Tower',
      blurb: 'A square ashlar tower: a door south, arched openings all round, a stone switchback stair inside up to a lookout 8 m up along the south side behind merlons (a sniper\'s perch over the roofs), under a blue tiled cap on cedar posts',
      cells: footprint(1, 1, 4),
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        ...towerBase(),
        ...[[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]].map(([x, z]) => cedar(b(x! - 0.15, 9.1, z! - 0.15, x! + 0.15, 11.2, z! + 0.15))),
        ...Array.from({ length: 6 }, (_, i) => {
          const r = 4.0 - i * 0.62;
          return paint(b(-r, 11.2 + i * 0.4, -r, r, 11.6 + i * 0.4, r), 'dome_tiles');
        }),
        paint(b(-0.1, 13.6, -0.1, 0.1, 14.6, 0.1), 'brass'),
      ],
    });
    // The minaret: a landmark (not climbed): a square base with a blind arch, an octagonal shaft, a balcony on corbels, a lantern stage, a blue spire.
    const out: Box[] = [];
    out.push(ashlar(b(-2.4, 0, -2.4, 2.4, 6.0, 2.4)), trim(-1.0, 0, -2.45, 1.0, 2.6, -2.4, CEDAR), ...archFill('x', -2.43, 0, 2.0, 2.6, ASHLAR, 0.06, '#c8a878', 6).map((x) => ({ ...x, kind: 'trim' as const })));
    out.push(trim(-2.5, 5.6, -2.5, 2.5, 6.0, 2.5, ZELLIGE));
    for (const yaw of [0, Math.PI / 4]) {
      out.push(turned(ashlar(b(-1.6, 6.0, -1.6, 1.6, 16.0, 1.6), '#e0c8a0'), yaw));
      out.push(turned(trim(-1.65, 9.0, -1.65, 1.65, 9.6, 1.65, ZELLIGE), yaw), turned(trim(-1.65, 13.0, -1.65, 1.65, 13.4, 1.65, ZELLIGE), yaw));
      out.push(turned(ashlar(b(-2.2, 15.6, -2.2, 2.2, 16.1, 2.2), '#d0b088'), yaw), turned(ashlar(b(-2.2, 16.1, -2.2, 2.2, 16.8, 2.2), '#e8d4b0'), yaw));
      out.push(turned(ashlar(b(-1.1, 16.1, -1.1, 1.1, 19.0, 1.1), '#e0c8a0'), yaw), turned(trim(-1.15, 18.6, -1.15, 1.15, 19.1, 1.15, ZELLIGE), yaw));
    }
    for (let i = 0; i < 5; i++) {
      const r = 1.3 - i * 0.26;
      for (const yaw of [0, Math.PI / 4]) out.push(turned(paint(b(-r, 19.1 + i * 0.45, -r, r, 19.55 + i * 0.45, r), 'dome_tiles'), yaw));
    }
    out.push(paint(b(-0.08, 21.3, -0.08, 0.08, 22.6, 0.08), 'brass'), trim(-0.3, 22.2, -0.05, 0.3, 22.3, 0.05, 'brass'));
    out.push(trim(-4, 0, -4, 4, 0.02, 4, PAVING), ...[[-3, -3], [3, -3], [-3, 3], [3, 3]].map(([x, z]) => ashlar(b(x! - 0.35, 0, z! - 0.35, x! + 0.35, 0.8, z! + 0.35), '#c8b090')));
    tiles.push({
      id: 'desert.minaret',
      category: 'Vertical',
      displayName: 'Minaret',
      blurb: 'A slender landmark tower over 22 m (seen across the city): a square base with a carved door, an octagonal shaft banded in zellige, a balcony on a corbelled ring, a lantern stage and a blue spire; paving and stone bollards round it. Not climbed: use the Watch Tower for a perch',
      cells: footprint(1, 1, 6),
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: out,
    });
  }

  // City Wall, Wall Stair and City Gate.
  tiles.push({
    id: 'desert.city_wall',
    category: 'Open',
    displayName: 'City Wall',
    blurb: 'A sandstone city wall along the south edge, a wall-walk 4 m up behind pointed merlons (east to west); join to a Wall Stair and the City Gate',
    cells: footprint(1, 1, 2),
    floors: [0],
    ports: [...ALL, ...at(1, 'E', 'W')],
    open: true,
    edgeDefault: 'open',
    solids: cityWall('none'),
  });
  tiles.push({
    id: 'desert.wall_stair',
    category: 'Vertical',
    displayName: 'Wall Stair',
    blurb: '2 × 1 cells of City Wall with stone steps up its city (north) face from the west end, and a landing the length of the east cell onto the wall-walk',
    cells: footprint(2, 1, 2),
    floors: [0],
    ports: [...perimeter(2, 1), cellPort('W', 1, 0, 0), cellPort('E', 1, 1, 0)],
    open: true,
    edgeDefault: 'open',
    solids: cityWall('east', -4, 12),
  });
  {
    const out: Box[] = [...cityWall('east', -4, 4), ...cityWall('west', 12, 20)];
    // The gatehouse: piers either side of a 4 m passage north to south under a round arch, the walk across its top.
    out.push(ashlar(b(4, 0, -3.8, 6, 4.0, 3.8)), ashlar(b(10, 0, -3.8, 12, 4.0, 3.8)));
    out.push(...archFill('x', 0, 8, 4.0, 1.6, ASHLAR, 7.6, undefined, 10), ashlar(b(6, 3.6, -3.8, 10, 4.0, 3.8)));
    // The arch rings and a zellige panel over the passage, both faces.
    for (const z of [-3.85, 3.85]) out.push(trim(5.7, 3.6, z - 0.05, 10.3, 4.0, z + 0.05, ZELLIGE));
    // Two towers on the gatehouse's south corners up to 8 m with domed caps; the walk passes north of them.
    for (const x0 of [4, 10.4]) {
      out.push(ashlar(b(x0, 4.0, -3.8, x0 + 1.6, 8.0, -2.2), '#e0c8a0'), ...parapet(x0, -3.8, x0 + 1.6, -2.2, 8.0, {}, ASHLAR, 0.5, 0.2));
      out.push(...dome(x0 + 0.8, 8.0, -3.0, 0.6, 'dome_tiles', 4));
    }
    out.push(ashlar(b(5.6, 4.0, -3.8, 10.4, 5.3, -3.3)), ...Array.from({ length: 3 }, (_, i) => trim(6.0 + i * 1.5, 5.3, -3.75, 6.6 + i * 1.5, 5.6, -3.35, ASHLAR)));
    out.push(ashlar(b(4, 4.0, 3.5, 12, 4.9, 3.8)));
    out.push(trim(6, 0, -3.8, 10, 0.03, 3.8, PAVING));
    tiles.push({
      id: 'desert.city_gate',
      category: 'Large',
      displayName: 'City Gate',
      blurb: '3 × 1 cells: a gatehouse over a 4 m arched passage (north to south; hang a Portcullis or an Oak Door in it) with two domed corner towers, the city wall either side with stairs up its city face, and the wall-walk crossing over the gate',
      cells: footprint(3, 1, 2),
      floors: [0],
      ports: [...perimeter(3, 1), cellPort('W', 1, 0, 0), cellPort('E', 1, 2, 0)],
      open: true,
      edgeDefault: 'open',
      solids: out,
    });
  }

  // Arcaded Terrace: a terrace 4 m up on piers and columns (shade below), a balustrade with gaps on every side.
  tiles.push({
    id: 'desert.terrace',
    category: 'Open',
    displayName: 'Arcaded Terrace',
    blurb: 'A rooftop terrace 4 m up on corner piers and four columns (shade and cover below), a stone balustrade with gaps on every side: join it to an Outside Stair\'s landing, a Courtyard\'s terrace or houses\' upper doors',
    cells: footprint(1, 1, 2),
    floors: [0],
    ports: [...ALL, ...at(1, 'N', 'E', 'S', 'W')],
    open: true,
    edgeDefault: 'open',
    solids: [
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ashlar(b(sx! * 3.4 - 0.5, 0, sz! * 3.4 - 0.5, sx! * 3.4 + 0.5, 3.75, sz! * 3.4 + 0.5), '#e0c8a0')),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ashlar(b(sx! * 1.4 - 0.2, 0, sz! * 1.4 - 0.2, sx! * 1.4 + 0.2, 3.75, sz! * 1.4 + 0.2), '#e8d4b0')),
      ...[-3.6, 3.6].flatMap((v) => [cedar(b(-2.9, 3.3, v - 0.2, 2.9, 3.75, v + 0.2)), cedar(b(v - 0.2, 3.3, -2.9, v + 0.2, 3.75, 2.9))]),
      paint(b(-4, 3.75, -4, 4, 4.0, 4), TILES),
      ...[-1.4, 1.4].flatMap((v) => [trim(-1.5, 3.55, v - 0.1, 1.5, 3.75, v + 0.1, CEDAR)]),
      ...parapet(-4, -4, 4, 4, 4.0, { S: [0], N: [0], W: [0], E: [0] }, ASHLAR, 0.9, 0.25),
      trim(-1.5, 4.0, -1.5, 1.5, 4.02, 1.5, RUG),
      trim(-3.9, 0, -3.9, 3.9, 0.02, 3.9, PAVING),
    ],
  });

  // Well Court: a paved court round a covered well.
  tiles.push({
    id: 'desert.well_court',
    category: 'Open',
    displayName: 'Well Court',
    blurb: 'A paved court round a stone well under a little blue dome on four cedar posts (cover in the middle), with a windlass and a stone bench on two sides',
    cells: footprint(1, 1, 2),
    floors: [0],
    ports: ALL,
    open: true,
    edgeDefault: 'open',
    solids: [
      trim(-4, 0, -4, 4, 0.02, 4, PAVING),
      trim(-2.4, 0.02, -2.4, 2.4, 0.04, 2.4, ZELLIGE),
      ...[0, Math.PI / 4].map((yaw) => turned(ashlar(b(-1.1, 0, -1.1, 1.1, 0.9, 1.1), '#e0c8a0'), yaw)),
      trim(-0.85, 0.5, -0.85, 0.85, 0.52, 0.85, 'pbr_pool_tiles', '#2a5a6a'),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => cedar(b(sx! * 1.2 - 0.1, 0, sz! * 1.2 - 0.1, sx! * 1.2 + 0.1, 2.8, sz! * 1.2 + 0.1))),
      cedar(b(-1.4, 2.8, -1.4, 1.4, 3.0, 1.4)),
      ...dome(0, 3.0, 0, 1.4, 'dome_tiles', 5),
      trim(-1.0, 1.9, -0.06, 1.0, 2.02, 0.06, CEDAR),
      ...[-3.4, 3.4].map((x) => ashlar(b(x - 0.3, 0, -1.5, x + 0.3, 0.5, 1.5), '#d0b890')),
    ],
  });

  // Paved Street.
  tiles.push({
    id: 'desert.street',
    category: 'Open',
    displayName: 'Paved Street',
    blurb: 'A street north to south in worn sandstone paving, a stone gutter down the middle, kerbs along both sides',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL,
    open: true,
    edgeDefault: 'open',
    solids: [trim(-4, 0, -4, 4, 0.02, 4, PAVING), trim(-0.2, 0.02, -4, 0.2, 0.035, 4, TILES, '#9a8060'), ...[-3.6, 3.4].map((x) => trim(x, 0.02, -4, x + 0.2, 0.08, 4, ASHLAR, '#b09068'))],
  });

  return tiles;
}

/** The 09 Desert City tiles, in palette order. */
export function desertPackTiles(): TileDefinition[] {
  return [...houses(), ...otherTiles()];
}
