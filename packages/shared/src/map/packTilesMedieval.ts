/**
 * Style Pack tiles for 10 Medieval Village (the owner's "Tileset 01" sheet):
 * box-built like the other packs' tiles (packTiles2.ts, packTilesAncient.ts).
 * Half-timbered houses you go into and up through, with tiled roofs you can
 * walk on (35° pitch, the eaves level with the Outside Stair's top landing
 * and with the next house's roof), a market square and hall, the town wall
 * and gate, a bell tower and a timber watchtower (sniper perches), a humped
 * stone bridge over a stream, a cobbled road and a forge. Every surface that
 * should look the part in any theme carries its own library material
 * (`LocalBox.surface`).
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
/** A box `size` centred on (cx, cy, cz), turned and tilted (radians). */
const tilted = (cx: number, cy: number, cz: number, size: readonly [number, number, number], o: { yaw?: number; pitch?: number; roll?: number; kind?: LocalBox['kind'] } = {}): Box => ({
  min: [cx - size[0] / 2, cy - size[1] / 2, cz - size[2] / 2],
  max: [cx + size[0] / 2, cy + size[1] / 2, cz + size[2] / 2],
  ...(o.yaw ? { yaw: o.yaw } : {}),
  ...(o.pitch ? { pitch: o.pitch } : {}),
  ...(o.roll ? { roll: o.roll } : {}),
  ...(o.kind ? { kind: o.kind } : {}),
});
const SIDES_ALL: Side[] = ['N', 'E', 'S', 'W'];
const ALL: TilePort[] = SIDES_ALL.map((side) => ({ side, level: 0 }));
const at = (level: number, ...sides: Side[]): TilePort[] => sides.map((side) => ({ side, level }));

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
function flight(axis: 'x' | 'z', dir: 1 | -1, from: number, a0: number, a1: number, n: number, base = 0, run = 0.5, floor = 0): Box[] {
  return Array.from({ length: n }, (_, i) => {
    const u0 = from + dir * i * run;
    const u1 = from + dir * (i + 1) * run;
    const top = base + (i + 1) * 0.25;
    const [lo, hi] = [Math.min(u0, u1), Math.max(u0, u1)];
    return axis === 'x' ? b(lo, floor, a0, hi, top, a1) : b(a0, floor, lo, a1, top, hi);
  });
}

/** A 1 m rail (solid: it stops you) along an axis-aligned line at height y. */
function rail(x0: number, z0: number, x1: number, z1: number, y = 0, material = 'oak_beam', h = 1): Box {
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

/** A floor hole grown by `m` all round: the navmesh's voxels bleed past box edges, so a floor flush with the hole's edge would steal headroom from the steps under it. */
const grow = (r: readonly [number, number, number, number], m = 0.3): [number, number, number, number] => [r[0] - m, r[1] - m, r[2] + m, r[3] + m];

/** The roof's pitch: walkable (players and bots climb to 50°). */
const PITCH = (35 * Math.PI) / 180;
const SLAB = 0.22;

/**
 * A gable roof over x0..x1, z0..z1, the ridge along x (or along z): two tilted
 * slabs whose top surface is exactly `eave` high at the outer edges (so a
 * landing at that height, or the next house's eaves, steps straight onto it),
 * rising at PITCH; a ridge cap; the gable ends filled from `wallTop` in
 * stepped courses of `gableMaterial`.
 */
function gableRoof(x0: number, z0: number, x1: number, z1: number, eave: number, wallTop: number, o: { ridge?: 'x' | 'z'; material?: string; gableMaterial?: string; gableInset?: number } = {}): Box[] {
  const material = o.material ?? 'roof_tiles_red';
  const alongX = (o.ridge ?? 'x') === 'x';
  const tan = Math.tan(PITCH);
  const [a0, a1] = alongX ? [z0, z1] : [x0, x1];
  const [l0, l1] = alongX ? [x0, x1] : [z0, z1];
  const mid = (a0 + a1) / 2;
  const d = mid - a0 + 0.08;
  const len = l1 - l0;
  const L = d / Math.cos(PITCH);
  const out: Box[] = [];
  for (const s of [1, -1] as const) {
    // s = 1: the slab rising from a0; s = -1: from a1.
    const edge = s > 0 ? a0 : a1;
    const c = edge + (s * d) / 2;
    const yTop = eave + (d / 2) * tan;
    const ac = c + s * Math.sin(PITCH) * (SLAB / 2);
    const yc = yTop - Math.cos(PITCH) * (SLAB / 2);
    const lc = (l0 + l1) / 2;
    out.push(paint(alongX ? tilted(lc, yc, ac, [len, SLAB, L], { pitch: s * PITCH }) : tilted(ac, yc, lc, [L, SLAB, len], { roll: -s * PITCH }), material));
  }
  const ridgeY = eave + (mid - a0) * tan;
  out.push(alongX ? trim(l0, ridgeY - 0.05, mid - 0.18, l1, ridgeY + 0.16, mid + 0.18, 'roof_tiles_red', '#8a6a60') : trim(mid - 0.18, ridgeY - 0.05, l0, mid + 0.18, ridgeY + 0.16, l1, 'roof_tiles_red', '#8a6a60'));
  // Gable ends: courses stepping in under the slabs.
  const gm = o.gableMaterial ?? 'timber_frame';
  const inset = o.gableInset ?? 0.2;
  const under = SLAB / Math.cos(PITCH);
  for (let y = wallTop; y < ridgeY - 0.3; y += 0.4) {
    const y1 = Math.min(y + 0.4, ridgeY - 0.3);
    const reach = (y1 - eave + under) / tan;
    const g0 = a0 + Math.max(inset, reach);
    const g1 = a1 - Math.max(inset, reach);
    if (g1 - g0 < 0.1) break;
    for (const e of [l0 + inset, l1 - inset - 0.3]) out.push(paint(alongX ? b(e, y, g0, e + 0.3, y1, g1, 'wall') : b(g0, y, e, g1, y1, e + 0.3, 'wall'), gm));
  }
  // Wall plates closing the gap between the wall tops and the slabs along the eaves.
  const plate = eave + (inset + 0.3) * tan - under + 0.04 - wallTop;
  if (plate > 0.02) for (const e of [a0 + inset, a1 - inset - 0.3]) out.push(paint(alongX ? b(l0 + inset, wallTop, e, l1 - inset, wallTop + plate, e + 0.3) : b(e, wallTop, l0 + inset, e + 0.3, wallTop + plate, l1 - inset), 'oak_beam'));
  return out;
}

/**
 * A switchback stair climbing inside a square (half-size `h` to the inside of
 * the walls, flights `w` wide): a flight north up the east side, a landing
 * the full width of the north side, a flight south down the west side, a
 * landing the full width of the south side, and round again. `flights` gives
 * the steps in each flight in turn (repeating). Every step is 0.25 m; landings
 * are a step too. Full-width landings (not corner steps) keep the turns on the
 * bots' navmesh. Steps are slabs 0.3 m thick (each lap leaves headroom for the
 * one below). Returns the steps and each step's footprint [x0, z0, x1, z1].
 */
function switchback(h: number, w: number, n: number, flights: readonly number[], base = 0): { steps: Box[]; prints: [number, number, number, number][] } {
  const steps: Box[] = [];
  const prints: [number, number, number, number][] = [];
  const inner = h - w;
  let i = 0;
  for (let f = 0; i < n; f++) {
    const count = flights[f % flights.length]!;
    const run = (2 * inner) / count;
    const north = f % 2 === 0;
    for (let j = 0; j < count && i < n; j++, i++) {
      const u0 = -inner + j * run;
      const r: [number, number, number, number] = north ? [inner, u0, h, u0 + run] : [-h, -u0 - run, -inner, -u0];
      prints.push(r);
    }
    if (i < n) {
      prints.push(north ? [-h, inner, h, h] : [-h, -h, h, -inner]);
      i++;
    }
  }
  prints.forEach((r, k) => {
    const top = base + (k + 1) * 0.25;
    steps.push(b(r[0], top - 0.3, r[1], r[2], top, r[3]));
  });
  return { steps, prints };
}

// ---------------------------------------------------------------- materials

const STONE = 'pbr_castle_stone';
const STONE_TINT = '#c8c2b0';
const LIME = 'pbr_limestone';
const OAK = 'oak_beam';
const PLANKS = 'pbr_planks';
const FLOOR = 'pbr_floorboards';
const TIMBER = 'timber_frame';
const WHITE = 'whitewash';
const stone = (box: Box) => paint(box, STONE, STONE_TINT);
const oak = (box: Box) => paint(box, OAK);
const planks = (box: Box) => paint(box, PLANKS);

// ---------------------------------------------------------------- houses

/** The level of the eaves' top surface: the Outside Stair's top landing and every house's roof edge. */
export const MEDIEVAL_EAVES = 8.25;

type HouseKind = 'timber' | 'shop' | 'balcony';

/**
 * A town house on 2 × 1 cells, two storeys under a red tile roof (ridge east
 * to west, eaves on the north and south cell edges at MEDIEVAL_EAVES, so a row
 * of houses makes one walkable roofline). Ground floor: front door (south),
 * back door (north), side doors (east and west, toward the south), a hearth; a
 * straight stair along the north wall with open floor at its foot and its head
 * (bots need both) up to the upper floor, whose doors east and west (centred,
 * 2.2 m) meet Timber Walkways and the next house's upper floor. Stone below,
 * half-timbering above, or whitewash with a balcony.
 */
function townHouse(kind: HouseKind): Box[] {
  const T = 0.3;
  const X0 = -3.8;
  const X1 = 11.8;
  const out: Box[] = [];
  const lower = kind === 'balcony' ? WHITE : STONE;
  const lowerTint = kind === 'balcony' ? undefined : STONE_TINT;
  const upper = kind === 'balcony' ? WHITE : TIMBER;
  // The upper storey's front wall: set back behind a balcony, or flush.
  const front = kind === 'balcony' ? -1.2 : -3.8;
  const groundS: Opening[] = kind === 'shop' ? [door(0.4), [3.4, 10.6, 0.0, 2.6]] : [door(1.0), win(-2.0), win(5.0), win(9.0)];
  out.push(
    ...shell(X0, -3.8, X1, 3.8, { S: groundS, N: [door(-2.0), win(9.5, 1.2, 1.2, 2.4)], W: [door(-1.6)], E: [door(-1.6)] }, 0, 4, lower, T, lowerTint),
    ...wall('x', front + T / 2, X0, X1, kind === 'balcony' ? [win(-2.0), win(2.0), win(5.5), door(9.8, 2.2, 2.6)] : [-2.0, 1.4, 4.6, 8.0, 10.6].map((c) => win(c, 1.1, 1.0, 2.4)), 4, 8, upper),
    ...wall('x', 3.8 - T / 2, X0, X1, [win(-1.6, 1.2, 1.0, 2.4), win(2.0, 1.2, 1.0, 2.4), win(9.0, 1.2, 1.0, 2.4)], 4, 8, upper),
    ...wall('z', X0 + T / 2, front + T, 3.5, [door(0)], 4, 8, upper),
    ...wall('z', X1 - T / 2, front + T, 3.5, [door(0)], 4, 8, upper),
  );
  // Sills under the upper doors, out to the cell edge (walkways and the next house meet them).
  for (const x of [-4, X1]) out.push(oak(b(x, 3.75, -1.1, x + 0.2, 4.0, 1.1)));
  // Upper floor (a hole over the stair) and the ceiling.
  const S0 = 0.0;
  const run = 0.45;
  const S1 = S0 + 16 * run;
  const floorRects = subtract([-3.5, front + T, 11.5, 3.5], [[S0, 1.3, S1, 3.5]]);
  out.push(...floorRects.map(([x0, z0, x1, z1]) => paint(b(x0, 3.75, z0, x1, 4.0, z1), FLOOR)));
  out.push(paint(b(X0, 7.75, front, X1, 8.0, 3.8), PLANKS, '#a08870'));
  // The stair along the north wall, west to east: 3.5 m of floor before its foot, the upper floor on ahead of its head.
  out.push(...flight('x', 1, S0, 1.3, 3.5, 16, 0, run).map((s) => paint(s, PLANKS, '#b09070')));
  out.push(rail(S0, 1.3, S1 - 1.2, 1.3, 4.0));
  // Balcony: plank deck on the ground storey's ceiling, a rail along its edge.
  if (kind === 'balcony') {
    out.push(paint(b(X0, 3.75, -3.8, X1, 4.0, front), PLANKS, '#c0a080'));
    out.push(rail(X0, -3.75, X1, -3.75, 4.0));
    out.push(oak(b(8.7, 3.75, front, 10.9, 4.0, front + T)));
    for (const x of [-3.6, 4.0, 11.6]) out.push(trim(x - 0.12, 4.0, -3.8, x + 0.12, 8.0, -3.6, OAK));
  }
  // Furniture: a hearth and a table downstairs, beds and a chest upstairs.
  out.push(stone(b(10.9, 0, 0.5, 11.5, 1.2, 2.0)), trim(10.88, 0.1, 0.8, 10.9, 0.6, 1.7, 'pbr_lava'));
  out.push(oak(b(3.0, 0, -1.4, 5.0, 0.8, -0.4)));
  out.push(paint(b(-3.2, 4, 1.0, -1.2, 4.55, 3.4), 'pbr_canvas', '#b8a080'), paint(b(10.0, 4, 1.6, 11.4, 4.55, 3.4), 'pbr_canvas', '#a89070'));
  out.push(oak(b(5.0, 4, front + T, 6.2, 4.6, front + T + 0.6)));
  if (kind === 'shop') {
    // A counter behind the shop front, shelves, a red awning over the street.
    out.push(oak(b(4.4, 0, -3.2, 9.6, 1.0, -2.7)), oak(b(10.9, 0, -3.3, 11.5, 2.2, -0.6)));
    out.push(trim(3.2, 2.75, -5.4, 10.8, 2.85, -3.8, 'pbr_canvas', '#a03028'));
    for (const x of [3.4, 10.6]) out.push(trim(x - 0.05, 2.2, -5.4, x + 0.05, 2.8, -5.3, OAK));
  }
  // The jetty beams and posts of the upper storey; a stone plinth.
  out.push(trim(X0 - 0.1, 3.85, front - 0.12, X1 + 0.1, 4.15, front, OAK), trim(X0 - 0.1, 3.85, 3.8, X1 + 0.1, 4.15, 3.92, OAK));
  for (const x of [X0, 3.9, X1 - 0.15]) for (const z of [front, 3.65]) out.push(trim(x - 0.03, 4.0, z - 0.03, x + 0.18, 8.0, z + 0.18, OAK));
  if (kind !== 'balcony') out.push(trim(X0 - 0.05, 0, -3.85, X1 + 0.05, 0.4, -3.8, STONE, '#8a8478'));
  // Floorboards over the ground floor.
  out.push(trim(-3.5, 0, -3.5, 11.5, 0.02, 3.5, FLOOR));
  // The roof, its eaves on the cell edges; a chimney over the hearth.
  out.push(...gableRoof(-4, -4, 12, 4, MEDIEVAL_EAVES, 8.0, { gableMaterial: upper }));
  out.push(paint(b(10.8, 8.0, 0.8, 11.6, 12.0, 1.8), 'pbr_brick_old'), trim(10.7, 12.0, 0.7, 11.7, 12.2, 1.9, STONE, '#8a8478'));
  return out;
}

function houses(): TileDefinition[] {
  const def = (id: string, displayName: string, blurb: string, kind: HouseKind): TileDefinition => {
    const solids = townHouse(kind);
    return {
      id: `medieval.${id}`,
      category: 'Buildings',
      displayName,
      blurb,
      cells: footprint(2, 1, 3),
      floors: [0],
      ports: [...perimeter(2, 1), { side: 'W', level: 1, cell: [0, 0] }, { side: 'E', level: 1, cell: [1, 0] }, ...perimeter(2, 1, 2)],
      open: true,
      edgeDefault: 'open',
      solids,
    };
  };
  return [
    def('house', 'Timber House', '2 × 1 cells, two storeys: stone below, half-timbering above, a red tile roof you can walk on (eaves on the north and south edges at 8.25 m). Doors on every side; a stair inside; upper doors east and west for walkways and the next house in the row', 'timber'),
    def('house_shop', 'Shop House', 'A Timber House with a shop front: a wide opening and counter on the street (south) under a red awning, the family upstairs', 'shop'),
    def('house_balcony', 'Plaster House', 'A whitewashed house whose upper storey stands back behind a railed balcony over the street (south, 4 m up); doors and roof as the Timber House', 'balcony'),
  ];
}

// ---------------------------------------------------------------- the rest

/** The north face of the town wall: its walk is 3.4 m wide behind the merlons (room for bots to pass). */
const WALL_N = 0.2;

function townWall(stair: boolean, x0 = -4, x1 = 4): Box[] {
  // The wall (south: outside the town) with a walk 4 m up behind merlons; a stair up its north face.
  const out: Box[] = [paint(b(x0, 0, -3.8, x1, 4.0, WALL_N), LIME, '#b8b0a0'), paint(b(x0, 0, -3.95, x1, 0.6, -3.8), LIME, '#a09888')];
  for (let x = x0 + 0.3; x < x1 - 0.5; x += 1.6) out.push(paint(b(x, 4.0, -3.8, x + 0.9, 5.3, -3.2), LIME, '#b8b0a0'));
  out.push(paint(b(x0, 4.0, -3.8, x1, 4.6, -3.2), LIME, '#b8b0a0'));
  if (stair) {
    // Up from the west end; the landing runs on the length of the second cell (a long, wide join onto the walk).
    out.push(...flight('x', 1, x0, WALL_N, WALL_N + 2.4, 15, 0, 0.45).map((s) => paint(s, LIME, '#a8a090')));
    out.push(paint(b(x0 + 6.75, 0, WALL_N, x1, 4.0, WALL_N + 2.4), LIME, '#a8a090'));
    out.push(rail(x0 + 6.75, WALL_N + 2.45, x1, WALL_N + 2.45, 4.0, LIME));
  }
  return out;
}

function otherTiles(): TileDefinition[] {
  const tiles: TileDefinition[] = [];

  // Outside Stair: timber switchback flights round an open well, a landing 4 m up along the south side
  // (upper doors, walkways) and a deck at 8.25 m along the south edge, level with a house roof's eaves.
  {
    const { steps } = switchback(3.9, 2.0, 33, [7, 7, 7, 8]);
    tiles.push({
      id: 'medieval.outside_stair',
      category: 'Vertical',
      displayName: 'Outside Stair',
      blurb: "Timber switchback stairs round an open well: a landing 4 m up along the south side (upper doors, walkways), then a deck along the south edge at 8.25 m, level with a house roof's eaves: put it north of a house and step out onto the roof",
      cells: footprint(1, 1, 3),
      floors: [0],
      ports: [...ALL, ...at(1, 'S', 'E', 'W'), ...at(2, 'S')],
      open: true,
      edgeDefault: 'open',
      solids: [
        ...steps.map((st) => planks(st)),
        // The top landing runs out to the cell edge.
        planks(b(-3.9, 8.0, -4, 3.9, 8.25, -3.9)),
        // Rails along the well at the landings, posts at the corners and round the well.
        rail(-1.9, -1.9, 1.9, -1.9, 4.0),
        rail(-1.9, -1.9, 1.9, -1.9, 8.25),
        ...([[-4, -4], [3.8, -4], [-4, 3.8], [3.8, 3.8], [-2.0, -2.0], [1.8, -2.0], [-2.0, 1.8], [1.8, 1.8]] as const).map(([x, z]) => trim(x, 0, z, x + 0.2, 8.0, z + 0.2, OAK)),
      ],
    });
  }

  // Timber Walkway: a plank deck 4 m up on posts, north to south (between upper doors, over an alley).
  tiles.push({
    id: 'medieval.walkway',
    category: 'Open',
    displayName: 'Timber Walkway',
    blurb: 'A railed plank walkway 4 m up, north to south, on posts: join two houses\' upper doors over an alley, or run along a street',
    cells: footprint(1, 1, 2),
    floors: [0],
    ports: [...ALL, ...at(1, 'N', 'S')],
    open: true,
    edgeDefault: 'open',
    solids: [
      planks(b(-1.2, 3.75, -4, 1.2, 4.0, 4)),
      rail(-1.2, -4, -1.2, 4, 4.0),
      rail(1.2, -4, 1.2, 4, 4.0),
      ...[-2.6, 2.6].flatMap((z) => [oak(b(-1.2, 0, z - 0.12, -0.96, 3.75, z + 0.12)), oak(b(0.96, 0, z - 0.12, 1.2, 3.75, z + 0.12))]),
      ...[-2.6, 2.6].map((z) => trim(-1.2, 3.3, z - 0.1, 1.2, 3.75, z + 0.1, OAK)),
    ],
  });

  // Market Square: 2 × 2 cells of market tiles round a stepped fountain plinth, four bollards.
  tiles.push({
    id: 'medieval.market_square',
    category: 'Large',
    displayName: 'Market Square',
    blurb: '2 × 2 cells of diagonal market tiles with a stepped stone plinth in the middle (stand a fountain or the market cross on it) and stone bollards',
    cells: footprint(2, 2),
    floors: [0],
    ports: perimeter(2, 2),
    open: true,
    edgeDefault: 'open',
    solids: [
      trim(-4, 0, -4, 12, 0.03, 12, 'market_tiles'),
      ...[0, Math.PI / 4].flatMap((yaw) => [
        { ...paint(b(1.4, 0, 1.4, 6.6, 0.25, 6.6), LIME, '#b8b0a0'), ...(yaw ? { yaw } : {}) },
        { ...paint(b(2.1, 0, 2.1, 5.9, 0.5, 5.9), LIME, '#c8c0b0'), ...(yaw ? { yaw } : {}) },
      ]),
      ...[[-2.5, -2.5], [10.5, -2.5], [-2.5, 10.5], [10.5, 10.5]].map(([x, z]) => paint(b(x! - 0.25, 0, z! - 0.25, x! + 0.25, 0.9, z! + 0.25), LIME, '#a8a090')),
      ...[-4, 12].map((z) => trim(-4, 0.03, z - 0.15, 12, 0.05, z + 0.15, 'road_setts')),
    ],
  });

  // Market Hall: open arcade of oak posts below, a timber-framed hall above, stair in the east aisle.
  {
    const posts = [-3.4, 3.4].flatMap((x) => [-3.4, 0.4, 4.0, 7.6, 11.4].map((z) => [x, z] as const));
    const hole: [number, number, number, number] = [0.4, -3.5, 3.25, 4.18];
    tiles.push({
      id: 'medieval.market_hall',
      category: 'Buildings',
      displayName: 'Market Hall',
      blurb: '1 × 2 cells: an open arcade of oak posts on stone pads (cover for the market below), a stair in the east aisle up to a timber-framed hall 4 m up with big windows, a red tile roof (ridge north to south)',
      cells: footprint(1, 2, 3),
      floors: [0],
      ports: [...perimeter(1, 2), ...perimeter(1, 2, 2)],
      open: true,
      edgeDefault: 'open',
      solids: [
        ...posts.flatMap(([x, z]) => [stone(b(x - 0.35, 0, z - 0.35, x + 0.35, 0.4, z + 0.35)), oak(b(x - 0.2, 0.4, z - 0.2, x + 0.2, 3.7, z + 0.2))]),
        ...subtract([-3.8, -3.8, 3.8, 11.8], [hole]).map(([x0, z0, x1, z1]) => paint(b(x0, 3.7, z0, x1, 4.0, z1), FLOOR)),
        ...flight('z', 1, -3.5, 0.7, 2.95, 16, 0, 0.48).map((s) => planks(s)),
        rail(0.4, -3.5, 0.4, 2.5, 4.0),
        ...shell(-3.8, -3.8, 3.8, 11.8, { S: [win(-1.6, 2.2, 0.9, 2.6), win(1.6, 2.2, 0.9, 2.6)], N: [win(0, 3.0, 0.9, 2.6)], W: [-1.6, 2.4, 6.4, 10.4].map((c) => win(c, 2.2, 0.9, 2.6)), E: [6.4, 10.4].map((c) => win(c, 2.2, 0.9, 2.6)) }, 4.0, 7.75, TIMBER),
        paint(b(-3.8, 7.75, -3.8, 3.8, 8.0, 11.8), PLANKS, '#a08870'),
        ...gableRoof(-4, -4, 4, 12, MEDIEVAL_EAVES, 8.0, { ridge: 'z' }),
        trim(-3.9, 3.7, -3.9, 3.9, 4.0, 11.9, OAK),
        trim(-3.8, 0, -3.8, 3.8, 0.03, 11.8, 'road_setts'),
      ],
    });
  }

  // Town Wall and Wall Stair.
  tiles.push({
    id: 'medieval.town_wall',
    category: 'Open',
    displayName: 'Town Wall',
    blurb: 'A stone curtain wall along the south edge, a wall-walk 4 m up behind merlons (east to west); join to a Wall Stair and the Town Gate',
    cells: footprint(1, 1, 2),
    floors: [0],
    ports: [...ALL, ...at(1, 'E', 'W')],
    open: true,
    edgeDefault: 'open',
    solids: townWall(false),
  });
  tiles.push({
    id: 'medieval.wall_stair',
    category: 'Vertical',
    displayName: 'Wall Stair',
    blurb: '2 × 1 cells of Town Wall with stone steps up its town (north) face from the west end, and a landing the length of the east cell onto the wall-walk',
    cells: footprint(2, 1, 2),
    floors: [0],
    ports: [...perimeter(2, 1), ...at(1, 'W').map((p) => ({ ...p, cell: [0, 0] as [number, number] })), ...at(1, 'E').map((p) => ({ ...p, cell: [1, 0] as [number, number] }))],
    open: true,
    edgeDefault: 'open',
    solids: townWall(true, -4, 12),
  });

  // Town Gate: a gate tower over a 4 m passage, wall either side with stairs up from the town side.
  tiles.push({
    id: 'medieval.town_gate',
    category: 'Large',
    displayName: 'Town Gate',
    blurb: '3 × 1 cells: a gate tower over a 4 m arched passage (north to south; hang a Portcullis in it), the town wall either side (put Wall Stairs on to climb to the wall-walk), a guard room over the gate opening onto both walks, and a battlemented roof 8 m up through a hatch in the guard room\'s north-east corner (hang a Ladder in it)',
    cells: footprint(3, 1, 3),
    floors: [0],
    ports: [...perimeter(3, 1), ...at(1, 'W').map((p) => ({ ...p, cell: [0, 0] as [number, number] })), ...at(1, 'E').map((p) => ({ ...p, cell: [2, 0] as [number, number] }))],
    open: true,
    edgeDefault: 'open',
    solids: (() => {
      const out: Box[] = [...townWall(false, -4, 4), ...townWall(false, 12, 20)];
      const S = (box: Box) => paint(box, LIME, '#c0b8a8');
      // The tower: piers either side of the passage up to the guard room, an arch over it.
      out.push(S(b(4, 0, -3.8, 6, 4.0, 3.8)), S(b(10, 0, -3.8, 12, 4.0, 3.8)));
      for (let i = 0; i < 10; i++) {
        const u0 = 6 + i * 0.4;
        const m = Math.min(Math.abs(u0 - 8), Math.abs(u0 + 0.4 - 8));
        const y = 2.4 + Math.sqrt(Math.max(0, 4 - m * m));
        out.push(S(b(u0, Math.min(y, 3.7), -3.8, u0 + 0.4, 4.0, 3.8)));
      }
      // Guard room (4–8 m): doors west and east onto the wall-walks, arrow slits, a stair to the roof.
      out.push(
        ...wall('x', -3.5, 4, 12, [win(6.5, 0.3, 1.0, 2.4), win(9.5, 0.3, 1.0, 2.4)], 4, 8, LIME, 0.6, '#c0b8a8'),
        ...wall('x', 3.5, 4, 12, [win(8, 1.2, 1.0, 2.4)], 4, 8, LIME, 0.6, '#c0b8a8'),
        ...wall('z', 4.3, -3.2, 3.2, [door(-1.9, 2.2, 2.6)], 4, 8, LIME, 0.6, '#c0b8a8'),
        ...wall('z', 11.7, -3.2, 3.2, [door(-1.9, 2.2, 2.6)], 4, 8, LIME, 0.6, '#c0b8a8'),
        // The roof: a 1.2 m hatch in the north-east corner of the guard room (hang a Ladder in it).
        ...subtract([4.6, -3.2, 11.4, 3.2], [[9.8, 1.8, 11.0, 3.0]]).map(([x0, z0, x1, z1]) => S(b(x0, 7.6, z0, x1, 8.0, z1))),
        // Battlements round the roof.
        S(b(4, 8.0, -3.8, 12, 8.6, -3.4)), S(b(4, 8.0, 3.4, 12, 8.6, 3.8)), S(b(4, 8.0, -3.4, 4.4, 8.6, 3.4)), S(b(11.6, 8.0, -3.4, 12, 8.6, 3.4)),
        ...[4.3, 6.1, 7.9, 9.7, 11.5].flatMap((x) => [S(b(x - 0.3, 8.6, -3.8, x + 0.4, 9.6, -3.4)), S(b(x - 0.3, 8.6, 3.4, x + 0.4, 9.6, 3.8))]),
        trim(6, 0, -3.8, 10, 0.03, 3.8, 'road_setts'),
        trim(5.9, 4.0, -3.95, 10.1, 4.2, -3.8, LIME, '#a8a090'),
      );
      return out;
    })(),
  });

  // Bell Tower: a stone tower, a switchback stair (2.4 m flights: room beside the walls) up the inside to the belfry 10 m up (arched openings all round), a spire.
  // The climb ends on a full-width landing level with the belfry floor (bots need a landing, not a step, to arrive on).
  {
    const { steps } = switchback(3.4, 2.4, 40, [4]);
    const S = (box: Box) => paint(box, LIME, '#c8c0b0');
    const solids: Box[] = [
      ...wall('x', -3.65, -3.9, 3.9, [door(0, 2.2, 2.2), win(0, 2.0, 11.1, 13.4)], 0, 14.5, LIME, 0.5, '#c8c0b0'),
      ...wall('x', 3.65, -3.9, 3.9, [win(0, 0.25, 5, 7), win(0, 2.0, 11.1, 13.4)], 0, 14.5, LIME, 0.5, '#c8c0b0'),
      ...wall('z', -3.65, -3.4, 3.4, [win(0, 0.25, 7, 9), win(-2.2, 1.6, 11.1, 13.4), win(1.6, 1.4, 11.1, 13.4)], 0, 14.5, LIME, 0.5, '#c8c0b0'),
      ...wall('z', 3.65, -3.4, 3.4, [win(0, 0.25, 3, 5), win(-2.2, 1.6, 11.1, 13.4), win(1.6, 1.4, 11.1, 13.4)], 0, 14.5, LIME, 0.5, '#c8c0b0'),
      ...steps.map((s) => paint(s, LIME, '#a8a090')),
      // The belfry floor: a gallery the width of the south side, level with the top landing, railed along the stairwell.
      S(b(-3.4, 9.7, -3.4, 3.4, 10.0, -1.0)),
      rail(-1.0, -1.0, 1.0, -1.0, 10.0, OAK),
      // The belfry: a bell frame, a ceiling, the spire in stepped courses of tiles.
      trim(-1.6, 10.0, 0.9, 1.6, 13.5, 1.1, OAK), trim(-1.6, 13.3, 0.85, 1.6, 13.6, 1.15, OAK),
      S(b(-3.8, 14.2, -3.8, 3.8, 14.5, 3.8)),
      S(b(-4.0, 13.9, -4.0, 4.0, 14.2, 4.0)),
      ...Array.from({ length: 9 }, (_, i) => {
        const r = 3.9 - i * 0.42;
        return paint(b(-r, 14.5 + i * 0.75, -r, r, 15.25 + i * 0.75, r), 'roof_tiles_red', '#c08070');
      }),
      paint(b(-0.08, 21.25, -0.08, 0.08, 22.5, 0.08), 'pbr_steel'),
      trim(-0.5, 21.8, -0.04, 0.5, 21.9, 0.04, 'pbr_steel'),
      trim(-3.95, 0, -3.95, 3.95, 0.5, -3.9, LIME, '#a8a090'),
    ];
    tiles.push({
      id: 'medieval.bell_tower',
      category: 'Vertical',
      displayName: 'Bell Tower',
      blurb: 'A stone bell tower: a door south, a stair switching back up the inside to a belfry gallery 10 m up behind arched openings south, east and west (a sniper\'s perch over the town; hang the Church Bell prop in its frame), a tiled spire',
      cells: footprint(1, 1, 6),
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids,
    });
  }

  // Watchtower: four oak posts, a switchback stair inside them to a lookout 7 m up (arriving on a full-width landing),
  // a plank parapet and a roof.
  {
    const { steps } = switchback(3.4, 2.0, 28, [6]);
    tiles.push({
      id: 'medieval.watchtower',
      category: 'Vertical',
      displayName: 'Watchtower',
      blurb: 'A timber watchtower: four oak posts with a switchback stair inside them to a lookout 7 m up behind a plank parapet, under a tiled roof',
      cells: footprint(1, 1, 3),
      floors: [0],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      solids: [
        ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => oak(b(sx! * 3.6 - 0.2, 0, sz! * 3.6 - 0.2, sx! * 3.6 + 0.2, 10.0, sz! * 3.6 + 0.2))),
        ...steps.map((s) => planks(s)),
        // The lookout: a gallery along the south side, level with the top landing; the stairwell stays open.
        planks(b(-3.8, 6.75, -3.8, 3.8, 7.0, -1.4)),
        ...[
          [-3.8, -3.8, 3.8, -3.6],
          [-3.8, 3.6, 3.8, 3.8],
          [-3.8, -3.6, -3.6, 3.6],
          [3.6, -3.6, 3.8, 3.6],
        ].map(([x0, z0, x1, z1]) => planks(b(x0!, 7.0, z0!, x1!, 8.1, z1!))),
        ...gableRoof(-4.2, -4.2, 4.2, 4.2, 9.8, 10.0, { gableMaterial: 'pbr_planks', gableInset: 0.6 }),
        ...[-1, 1].flatMap((s) => [trim(-3.5, 1.0, s * 3.5 - 0.06, 3.5, 6.0, s * 3.5 + 0.06, OAK)].map((t) => ({ ...t, ...{ roll: s * 0.7 } }))),
      ],
    });
  }

  // Stream and Bridge: a stream bed 2 m down running east to west; a humped stone bridge over it.
  const BED = -2.0;
  tiles.push({
    id: 'medieval.stream',
    category: 'Open',
    displayName: 'Stream',
    blurb: 'A stream bed 2 m down, running east to west: a stone quay on the south bank, a grassy slope up the north bank (fill it with Water); lower the terrain under it',
    cells: [[0, 0, 0]],
    floors: [],
    ports: ALL,
    open: true,
    edgeDefault: 'open',
    extraFloors: [b(-4, BED - 0.5, -4, 4, BED, 4)],
    solids: [
      paint(b(-4, BED, -4, 4, 0, -2.5), STONE, '#a8a090'),
      trim(-4, -0.05, -2.62, 4, 0.05, -2.5, LIME, '#a09888'),
      // The north bank: a grass slope from the bed up to the ground.
      ...(() => {
        // From the bed at z = 1 up to the ground at the north edge (34°: walkable).
        const run = 3.0;
        const ang = Math.atan2(-BED, run);
        const L = Math.hypot(run, BED);
        const T = 0.4;
        return [paint(tilted(0, BED / 2 - (Math.cos(ang) * T) / 2, 2.5 + (Math.sin(ang) * T) / 2, [8, T, L + 0.1], { pitch: ang }), 'pbr_grass')];
      })(),
      trim(-4, BED, -2.5, 4, BED + 0.03, 1.0, 'pbr_gravel', '#8a8a80'),
    ],
  });
  {
    const W = 2.2;
    const R = 2.5;
    const crown = 1.0;
    /** The deck's walking surface along z. */
    const deckAt = (z: number) => (Math.abs(z) <= 1.2 ? crown : Math.max(0, crown * (1 - (Math.abs(z) - 1.2) / 2.8)));
    const ang = Math.atan2(crown, 2.8);
    const L = Math.hypot(2.8, crown);
    const T = 0.4;
    const S = (box: Box) => paint(box, STONE, '#b8b0a0');
    const solids: Box[] = [
      // Ramps up from both banks and the level crown.
      ...[1, -1].map((s) => S(tilted(0, crown / 2 - (Math.cos(ang) * T) / 2, s * (1.2 + 1.4) - s * (Math.sin(ang) * T) / 2, [W * 2, T, L + 0.05], { pitch: -s * ang }))),
      S(b(-W, crown - T, -1.25, W, crown, 1.25)),
      // Parapets following the deck.
      ...[-1, 1].flatMap((sx) => [
        S(b(sx > 0 ? W - 0.35 : -W, crown, -1.25, sx > 0 ? W : -W + 0.35, crown + 0.9, 1.25)),
        ...[1, -1].map((s) => S(tilted(sx * (W - 0.175), crown / 2 + 0.45, s * 2.6, [0.35, 0.9, L], { pitch: -s * ang }))),
      ]),
      // The arch: slices from the curve up under the deck; abutments on the banks.
      ...Array.from({ length: 12 }, (_, i) => {
        const z0 = -R + (i * 2 * R) / 12;
        const z1 = z0 + (2 * R) / 12;
        const m = Math.min(Math.abs(z0), Math.abs(z1));
        const y = BED + 0.6 + Math.sqrt(Math.max(0, R * R - m * m)) * 0.8;
        const top = Math.min(deckAt(z0), deckAt(z1)) - T * 0.9;
        return top > y ? S(b(-W, y, z0, W, top, z1)) : null;
      }).filter((x): x is Box => x !== null),
      ...[1, -1].map((s) => S(b(-W, BED, s > 0 ? R : -4, W, 0, s > 0 ? 4 : -R))),
      // Banks either side of the bridge as on a Stream tile.
      ...[-1, 1].map((sx) => paint(b(sx > 0 ? W : -4, BED, -4, sx > 0 ? 4 : -W, 0, -2.5), STONE, '#a8a090')),
      ...[-1, 1].map((sx) => paint(b(sx > 0 ? W : -4, BED, 2.5, sx > 0 ? 4 : -W, 0, 4), STONE, '#a8a090')),
      trim(-4, BED, -2.5, 4, BED + 0.03, 2.5, 'pbr_gravel', '#8a8a80'),
    ];
    tiles.push({
      id: 'medieval.bridge',
      category: 'Open',
      displayName: 'Stone Bridge',
      blurb: 'A humped stone bridge (north to south, 1 m up at its crown) over a stream bed 2 m down running east to west: walk over it, or along the stream under its arch. Lay it in a row of Streams',
      cells: [[0, 0, 0]],
      floors: [],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      extraFloors: [b(-4, BED - 0.5, -2.5, 4, BED, 2.5)],
      solids,
    });
  }

  // Cobbled road: granite setts down the middle, cobbled margins, a gutter.
  tiles.push({
    id: 'medieval.road',
    category: 'Open',
    displayName: 'Cobbled Road',
    blurb: 'A street north to south: granite setts down the middle, cobbles either side, a stone gutter',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL,
    open: true,
    edgeDefault: 'open',
    solids: [trim(-4, 0, -4, 4, 0.02, 4, 'cobblestones'), trim(-2.2, 0.02, -4, 2.2, 0.04, 4, 'road_setts'), trim(2.25, 0.02, -4, 2.55, 0.035, 4, 'pbr_flagstone', '#8a8a88')],
  });

  // Forge: an open-sided smithy under a tiled roof, a stone hearth with its chimney, a quench trough.
  tiles.push({
    id: 'medieval.forge',
    category: 'Buildings',
    displayName: 'Blacksmith Forge',
    blurb: 'An open-sided smithy: oak posts and a tiled roof over a stone hearth glowing at the back (north), its chimney, a quench trough and a low wall; put an Anvil in front of the hearth',
    cells: footprint(1, 1, 2),
    floors: [0],
    ports: ALL,
    open: true,
    edgeDefault: 'open',
    solids: [
      ...[[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]].map(([x, z]) => oak(b(x! - 0.18, 0, z! - 0.18, x! + 0.18, 3.6, z! + 0.18))),
      stone(b(-3.6, 0, 3.0, 3.6, 1.2, 3.6)),
      stone(b(-1.6, 0, 1.6, 1.6, 1.0, 3.0)),
      trim(-1.2, 1.0, 1.9, 1.2, 1.06, 2.8, 'pbr_lava'),
      paint(b(-0.8, 1.0, 2.6, 0.8, 7.0, 3.6), 'pbr_brick_old'),
      paint(b(-0.6, 1.0, 1.7, 0.6, 2.4, 2.6), 'pbr_brick_old'),
      oak(b(2.0, 0, 0.8, 3.2, 0.7, 1.6)),
      trim(2.1, 0.62, 0.9, 3.1, 0.66, 1.5, 'pbr_steel', '#405060'),
      stone(b(-3.6, 0, -0.5, -3.0, 1.1, 3.0)),
      ...gableRoof(-4, -4, 4, 4, 3.6, 3.6, { gableMaterial: 'pbr_planks', gableInset: 0.3 }),
      trim(-3.8, 0, -3.8, 3.8, 0.02, 3.8, 'packed_dirt'),
    ],
  });

  return tiles;
}

/** The 10 Medieval Village tiles, in palette order. */
export function medievalPackTiles(): TileDefinition[] {
  return [...houses(), ...otherTiles()];
}
