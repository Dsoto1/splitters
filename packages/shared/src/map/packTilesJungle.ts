/**
 * Style Pack tiles for the 06 Jungle Ruins refresh (the owner's "Tileset 04
 * Jungle Ruins" sheet, with "Tileset 07 Ancient Temple" folded in): box-built
 * like the other packs' tiles (packTiles2.ts holds the pack's first twelve,
 * which stay as they are so the maps built with them load unchanged).
 *
 * Temple terraces that stack into ziggurats (a terrace block and a terrace
 * stair, each one level high: put more on top of them), a carved temple with
 * a gate and a roof you can walk, a summit shrine, carved, relief, window,
 * arched, columned and low walls, a beamed colonnade and an arched vault
 * (their tops are the next level's ground), a timber watch tower, a chasm
 * with gorge steps, rope and stone bridges, a waterfall wall with a passage
 * behind the falls, and overgrown ruins. Every surface that should look the
 * part in any theme carries its own library material (`LocalBox.surface`).
 *
 * Every stair follows the bots' navmesh rules learned on the Medieval pack:
 * treads 0.42 m or longer, flights 2 m wide or wider, about 2 m of floor
 * before a stair's foot and after its head, turns on full-width landings,
 * floor holes grown 0.3 m past the steps.
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

/** A rail (solid: it stops you) along an axis-aligned line at height y, `h` high. */
function rail(x0: number, z0: number, x1: number, z1: number, y: number, material: string, h = 1, tint?: string): Box {
  const t = 0.07;
  const r = x0 === x1 ? b(x0 - t, y, Math.min(z0, z1), x0 + t, y + h, Math.max(z0, z1)) : b(Math.min(x0, x1), y, z0 - t, Math.max(x0, x1), y + h, z0 + t);
  return paint(r, material, tint);
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
 * A switchback stair climbing inside a square (half-size `h`, flights `w`
 * wide): north up the east side, a full-width landing along the north side,
 * south down the west side, a full-width landing along the south, and round
 * again; `flights` gives the steps in each flight (repeating). Steps of
 * 0.25 m as slabs 0.3 m thick (each lap leaves headroom for the one below).
 * The Medieval Watchtower's stair, which bots climb in every rotation.
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

/** An arch of slices over an opening from u0 to u1 along x (or z), springing at `spring`, its crown `rise` above, filled up to `top`, `t` thick about `at`. */
function arch(axis: 'x' | 'z', at: number, u0: number, u1: number, spring: number, rise: number, top: number, t: number, material: string, tint?: string, slices = 12): Box[] {
  const out: Box[] = [];
  const c = (u0 + u1) / 2;
  const r = (u1 - u0) / 2;
  for (let i = 0; i < slices; i++) {
    const s0 = u0 + (i * (u1 - u0)) / slices;
    const s1 = s0 + (u1 - u0) / slices;
    const m = Math.min(Math.abs(s0 - c), Math.abs(s1 - c));
    const y = spring + (Math.sqrt(Math.max(0, r * r - m * m)) / r) * rise;
    if (top - y < 0.02) continue;
    out.push(paint(axis === 'x' ? b(s0, y, at - t / 2, s1, top, at + t / 2, 'wall') : b(at - t / 2, y, s0, at + t / 2, top, s1, 'wall'), material, tint));
  }
  return out;
}

// ---------------------------------------------------------------- materials

const STONE = 'pbr_castle_stone';
const STONE_TINT = '#d0d0b0';
const CARVED = 'carved_stone';
const RELIEF = 'relief_stone';
const SLAB = 'mossy_stone';
const INLAY = 'temple_inlay';
const ROOTS = 'root_cover';
const PLANK = 'mossy_planks';
const SAND = 'temple_sandstone';
const THATCH = 'palm_thatch';
const ROCK = 'pbr_jungle_rock';
const MOSS = 'pbr_moss';
const GOLD = 'gold_leaf';
const stone = (box: Box, tint = STONE_TINT) => paint(box, STONE, tint);
const carved = (box: Box) => paint(box, CARVED);
const slab = (box: Box) => paint(box, SLAB);
const rock = (box: Box, tint?: string) => paint(box, ROCK, tint);
const plank = (box: Box) => paint(box, PLANK);
const bark = (box: Box) => paint(box, 'pbr_walnut', '#8a7458');
/** Rope (visual): lashings, rails. */
const ropeT = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => trim(x0, y0, z0, x1, y1, z1, 'canvas', '#a8905c');
/** Rope netting along a bridge's side (woven, see-through in spirit; it stops you). */
const NET = 'wattle';
const NET_TINT = '#c0a878';

/** Vines hanging down a face: thin dark-green strands (visual), deterministic from `seed`. */
function vines(axis: 'x' | 'z', face: number, u0: number, u1: number, top: number, seed: number, count = 5, out = 0.04): Box[] {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const boxes: Box[] = [];
  for (let i = 0; i < count; i++) {
    const u = u0 + ((i + 0.3 + rnd() * 0.4) / count) * (u1 - u0);
    const len = 1.0 + rnd() * 2.2;
    const w = 0.1 + rnd() * 0.1;
    const f0 = Math.min(face, face + out);
    const f1 = Math.max(face, face + out);
    boxes.push(axis === 'x' ? trim(u - w / 2, top - len, f0, u + w / 2, top, f1, MOSS, '#b8e890') : trim(f0, top - len, u - w / 2, f1, top, u + w / 2, MOSS, '#b8e890'));
  }
  return boxes;
}

// ---------------------------------------------------------------- terraces and the temple

/**
 * A terrace block: stone filling the cell one level up, a plinth and a
 * cornice of mossy slabs, a carved band under the cornice, vines down the
 * south face. Its top is the next level's ground: stand more pack pieces on it.
 */
function terraceBlock(): Box[] {
  return [
    slab(b(-4, 0, -4, 4, 0.5, 4)),
    carved(b(-3.9, 0.5, -3.9, 3.9, 3.5, 3.9)),
    slab(b(-4, 3.5, -4, 4, 4, 4)),
    trim(-4, 4.0, -4, 4, 4.03, -3.4, MOSS),
    trim(-4, 4.0, 3.4, 4, 4.03, 4, MOSS),
    ...vines('x', -3.95, -3.6, 3.6, 3.5, 11, 4, 0.03),
  ];
}

/** Where the terrace stair's foot is: its flight ends at the cells' boundary, so the whole north cell is landing (a stair stacked on it starts there). */
const TS_F0 = 4 - 16 * 0.45;
/** Where the stair's cheeks begin (the ground before them is open on both sides). */
const TS_CHEEK = TS_F0 + 1.8;

/**
 * The terrace stair: a 3.2 m flight of 16 steps (0.45 m treads) up the middle
 * of two cells, north, from 0.8 m in from the south edge to the north cell,
 * all of it a landing 4 m up; stepped stone cheeks either side, the last
 * level with the landing. Nothing stands beside the foot, so a stair stacked
 * on a landing is reached from the terraces either side as well as head-on.
 */
function terraceStair(): Box[] {
  const out: Box[] = [];
  const W = 1.6;
  const F0 = TS_F0;
  const F1 = F0 + 16 * 0.45;
  out.push(...flight('z', 1, F0, -W, W, 16, 0, 0.45).map((s) => slab(s)));
  // The landing: the north cell (and the last of the south one) up to 4 m.
  out.push(slab(b(-4, 3.5, F1, 4, 4, 12)), carved(b(-3.9, 0, F1, 3.9, 3.5, 11.9)), slab(b(-4, 0, 11.9, 4, 3.5, 12)));
  // Cheeks: three tiers either side, 1.8 m apart, the last level with the landing (a stair stacked on top is reached across it from the terraces either side); none beside the first 1.8 m of the flight.
  for (const s of [-1, 1] as const) {
    const [x0, x1] = s < 0 ? [-4, -W] : [W, 4];
    for (let k = 1; k <= 3; k++) {
      const z0 = TS_CHEEK + (k - 1) * 1.8;
      const h = (k * 4) / 3;
      out.push(carved(b(x0, 0, z0, x1, h, F1)));
      out.push(trim(x0, h, z0, x1, h + 0.03, z0 + 0.5, MOSS));
    }
    // A bronze-capped kerb along the foot of each cheek (visual: the way round onto the steps from either side stays open; stand a Fire Bowl here).
    out.push(trim(x0, 0, TS_CHEEK - 0.25, x1, 0.25, TS_CHEEK, GOLD, '#a88a40'));
  }
  out.push(...vines('x', TS_CHEEK, -3.8, -W - 0.5, 1.0, 21, 2, -0.04), ...vines('x', TS_CHEEK, W + 0.5, 3.8, 1.0, 23, 2, -0.04));
  out.push(trim(-4, 0, -4, 4, 0.02, TS_CHEEK, SLAB));
  return out;
}

/** The temple's stair along the inside of its north wall (the Medieval house's, proven on the navmesh): foot at x 0, head at x 7.2, 4 m up. */
const T_S0 = 0;
const T_RUN = 0.45;
const T_S1 = T_S0 + 16 * T_RUN;

/**
 * The carved temple (2 × 1 cells): carved stone walls, relief panels on the
 * north wall, a 3.4 m gate in the south front under a carved lintel (hang the
 * Portcullis in it), a side door west and a back door north, barred windows
 * east, columns inside, a beamed ceiling, an altar at the east end, a stair
 * up the north wall to a flat roof 4 m up behind a parapet.
 */
function templeHall(): Box[] {
  const out: Box[] = [];
  const X0 = -4;
  const X1 = 12;
  const T = 0.6;
  /** The north wall is thinner, leaving the stair inside it 2.4 m wide; the south front stands 0.1 m in from the edge (vines hang in front of it). */
  const TN = 0.3;
  const Z0 = -3.9;
  // The gate is centred on the west cell's south edge, where MapMaker hangs a door (the Portcullis fits it).
  const GATE: Opening = [-1.6, 1.6, 0, 3.2];
  out.push(
    ...wall('x', Z0 + T / 2, X0, X1, [GATE], 0, 4, CARVED, T),
    ...wall('x', 4 - TN / 2, X0, X1, [door(10, 2.2, 2.8)], 0, 4, RELIEF, TN),
    ...wall('z', X0 + T / 2, Z0 + T, 4 - TN, [door(-1.6, 2.2, 2.8)], 0, 4, CARVED, T),
    ...wall('z', X1 - T / 2, Z0 + T, 4 - TN, [win(-1.6, 1.2, 1.2, 2.6), win(1.6, 1.2, 1.2, 2.6)], 0, 4, CARVED, T),
  );
  // Bars in the east windows (they stop you; you can shoot between them).
  for (const c of [-1.6, 1.6]) for (const dz of [-0.4, 0, 0.4]) out.push(paint(b(X1 - T / 2 - 0.04, 1.2, c + dz - 0.04, X1 - T / 2 + 0.04, 2.6, c + dz + 0.04), 'pbr_steel', '#5a5048'));
  // The gate: a carved lintel, jambs of bigger blocks, a gold inlay band, a stepped crest over it on the parapet.
  out.push(trim(GATE[0] - 0.5, GATE[3], -3.97, GATE[1] + 0.5, 4.0, Z0, RELIEF), trim(GATE[0] - 0.5, GATE[3] - 0.05, -3.98, GATE[1] + 0.5, GATE[3] + 0.05, Z0, GOLD, '#c8a040'));
  for (const x of [GATE[0] - 0.5, GATE[1]]) out.push(stone(b(x, 0, -3.97, x + 0.5, GATE[3], Z0 + T + 0.1), '#c0c0a0'));
  // The roof (a hole over the stair) and the parapet round it.
  out.push(...subtract([X0, Z0, X1, 4], [[T_S0, 1.3, T_S1, 4 - TN]]).map(([x0, z0, x1, z1]) => slab(b(x0, 3.75, z0, x1, 4.0, z1))));
  out.push(slab(b(X0, 4.0, Z0, X1, 4.9, -3.5)), slab(b(X0, 4.0, 3.6, X1, 4.9, 4)), ...[-3.6, 1.2].flatMap((z) => [slab(b(X0, 4.0, z, X0 + 0.4, 4.9, z + 2.4)), slab(b(X1 - 0.4, 4.0, z, X1, 4.9, z + 2.4))]));
  // Crest over the gate (stepped, on the parapet); the parapet's gaps east and west meet walkways and the next roof.
  out.push(carved(b(-1.8, 4.9, Z0, 1.8, 5.6, -3.5)), carved(b(-1.0, 5.6, Z0, 1.0, 6.3, -3.5)), trim(-0.4, 6.3, Z0, 0.4, 6.8, -3.5, GOLD, '#c8a040'));
  // The stair along the north wall, west to east; a rail along its open side at the top.
  out.push(...flight('x', 1, T_S0, 1.3, 4 - TN, 16, 0, T_RUN).map((s) => slab(s)));
  out.push(rail(T_S0, 1.3, T_S1 - 1.2, 1.3, 4.0, STONE, 1, '#a8a890'));
  // Columns flanking the gate's way in, carved, on plinths with gold capitals.
  for (const x of [3.0, 7.0]) {
    out.push(stone(b(x - 0.45, 0, -1.65, x + 0.45, 0.4, -0.75), '#b0b098'), carved(b(x - 0.32, 0.4, -1.52, x + 0.32, 3.75, -0.88)), trim(x - 0.42, 3.3, -1.62, x + 0.42, 3.5, -0.78, GOLD, '#b89038'));
  }
  // The beamed ceiling (beams across, clear of the stair).
  for (let x = -2.6; x < X1 - 0.6; x += 2.0) out.push(trim(x - 0.15, 3.4, Z0 + T, x + 0.15, 3.75, 0.9, 'oak_beam', '#5a4a38'));
  // The altar at the east end, a gold bowl on it; inlay before it.
  out.push(stone(b(9.6, 0, -1.6, 11.2, 1.0, 0.6), '#c8c0a0'), trim(9.55, 0.95, -1.65, 11.25, 1.05, 0.65, GOLD, '#c8a040'), trim(10.0, 1.05, -0.9, 10.8, 1.25, -0.1, GOLD, '#d8b048'));
  out.push(trim(6.0, 0, -3.4, 9.4, 0.02, 0.6, INLAY));
  // A carved band round the outside a metre under the parapet, vines down the front.
  out.push(trim(X0, 3.0, -3.97, X1, 3.25, Z0, GOLD, '#a88a40'));
  out.push(...vines('x', Z0, X0 + 0.2, GATE[0] - 0.6, 4.9, 31, 3, -0.05), ...vines('x', Z0, GATE[1] + 0.6, X1 - 0.2, 4.9, 37, 3, -0.05));
  out.push(trim(X0 + T, 0, Z0 + T, X1 - T, 0.02, 4 - TN, SLAB));
  return out;
}

/** The summit shrine: a small carved sanctuary on an inlaid apron, a stepped roof and a gilded finial (a ziggurat's crown). */
function shrine(): Box[] {
  const out: Box[] = [];
  out.push(trim(-4, 0, -4, 4, 0.02, 4, INLAY));
  out.push(
    ...wall('x', -2.75, -3, 3, [door(0, 2.4, 2.8)], 0, 3.6, CARVED, 0.5),
    ...wall('x', 2.75, -3, 3, [], 0, 3.6, RELIEF, 0.5),
    ...wall('z', -2.75, -2.5, 2.5, [win(0, 0.6, 1.2, 2.4)], 0, 3.6, CARVED, 0.5),
    ...wall('z', 2.75, -2.5, 2.5, [win(0, 0.6, 1.2, 2.4)], 0, 3.6, CARVED, 0.5),
  );
  out.push(trim(-1.2, 2.6, -3.05, 1.2, 3.1, -3.0, GOLD, '#c8a040'));
  // The roof in stepped courses, the finial.
  out.push(slab(b(-3.3, 3.6, -3.3, 3.3, 4.0, 3.3)));
  for (let i = 0; i < 4; i++) {
    const r = 2.8 - i * 0.6;
    out.push(carved(b(-r, 4.0 + i * 0.6, -r, r, 4.6 + i * 0.6, r)));
  }
  out.push(trim(-0.25, 6.4, -0.25, 0.25, 7.6, 0.25, GOLD, '#d8b048'), trim(-0.4, 6.4, -0.4, 0.4, 6.6, 0.4, GOLD, '#b89038'));
  // Inside: an altar with a gold bowl.
  out.push(stone(b(-1.0, 0, 1.0, 1.0, 1.0, 2.4), '#c8c0a0'), trim(-0.4, 1.0, 1.4, 0.4, 1.2, 2.0, GOLD, '#d8b048'));
  out.push(...vines('x', -3.0, -2.9, -1.0, 3.6, 41, 2, -0.04), ...vines('z', 3.0, -2.4, 2.4, 3.6, 43, 3));
  return out;
}

// ---------------------------------------------------------------- walls

type WallKind = 'carved' | 'relief' | 'window' | 'arch' | 'column' | 'low';

/**
 * A wall along the north edge of an open cell (1 m thick, z 3..4), 4 m high
 * unless low: carved courses, relief panels between pilasters, carved
 * windows (one open, one barred), an arched opening, a row of columns over a
 * low wall under a lintel, or a waist-high wall. A plinth and a mossy cap.
 */
function templeWall(kind: WallKind): Box[] {
  const out: Box[] = [];
  const Z0 = 3.0;
  const Z1 = 4.0;
  const H = kind === 'low' ? 1.1 : 4.0;
  const mat = kind === 'relief' ? RELIEF : CARVED;
  const zc = (Z0 + Z1) / 2;
  switch (kind) {
    case 'carved':
    case 'relief':
    case 'low':
      out.push(paint(b(-4, 0, Z0, 4, H, Z1, 'wall'), mat));
      break;
    case 'window':
      out.push(...wall('x', zc, -4, 4, [win(-2, 1.4, 1.1, 2.6), win(2, 1.4, 1.1, 2.6)], 0, H, CARVED, Z1 - Z0));
      // Bars in the east window; the west one stands open. A carved frame round both.
      for (const dx of [-0.45, -0.15, 0.15, 0.45]) out.push(paint(b(2 + dx - 0.04, 1.1, zc - 0.04, 2 + dx + 0.04, 2.6, zc + 0.04), 'pbr_steel', '#5a5048'));
      for (const c of [-2, 2]) out.push(trim(c - 0.95, 2.6, Z0 - 0.04, c + 0.95, 2.95, Z0, RELIEF), trim(c - 0.95, 0.85, Z0 - 0.06, c + 0.95, 1.1, Z0, SLAB));
      break;
    case 'arch':
      out.push(paint(b(-4, 0, Z0, -1.6, H, Z1, 'wall'), CARVED), paint(b(1.6, 0, Z0, 4, H, Z1, 'wall'), CARVED));
      out.push(...arch('x', zc, -1.6, 1.6, 2.2, 1.2, H, Z1 - Z0, CARVED));
      out.push(trim(-1.9, 3.35, Z0 - 0.04, 1.9, 3.55, Z0, GOLD, '#b89038'));
      break;
    case 'column':
      // A knee wall between columns, a lintel over them: see and shoot through, vault the knee wall.
      out.push(paint(b(-4, 0, Z0 + 0.2, 4, 0.9, Z1 - 0.2, 'wall'), CARVED));
      for (const x of [-3.5, -1.2, 1.2, 3.5]) out.push(stone(b(x - 0.45, 0, Z0, x + 0.45, 0.5, Z1), '#b0b098'), carved(b(x - 0.35, 0.5, Z0 + 0.1, x + 0.35, 3.3, Z1 - 0.1)), trim(x - 0.45, 3.1, Z0 + 0.02, x + 0.45, 3.3, Z1 - 0.02, GOLD, '#b89038'));
      out.push(slab(b(-4, 3.3, Z0, 4, H, Z1)));
      break;
  }
  if (kind !== 'column') {
    out.push(trim(-4, 0, Z0 - 0.08, 4, 0.4, Z0, SLAB));
    out.push(slab(b(-4, H, Z0 - 0.05, 4, H + 0.25, Z1)));
  }
  if (kind === 'relief') for (const x of [-4, -0.2, 3.6]) out.push(stone(b(x, 0.4, Z0 - 0.2, x + 0.4, H, Z0), '#b8b8a0'));
  out.push(trim(-4, H + (kind === 'column' ? 0 : 0.25), Z0, 4, H + (kind === 'column' ? 0.04 : 0.29), Z0 + 0.5, MOSS));
  out.push(...vines('x', Z0 - 0.02, -3.6, 3.6, H, kind.length * 7 + 3, kind === 'low' ? 0 : 3, -0.04).filter((v) => !(kind === 'arch' && v.min[0] > -1.8 && v.max[0] < 1.8)).filter((v) => !(kind === 'window' && v.min[1] < 2.6 && (Math.abs(v.min[0] + 2) < 1 || Math.abs(v.min[0] - 2) < 1))));
  return out;
}

// ---------------------------------------------------------------- the rest

function otherTiles(): TileDefinition[] {
  const tiles: TileDefinition[] = [];

  tiles.push({
    id: 'jungle.terrace',
    category: 'Large',
    displayName: 'Temple Terrace',
    blurb: 'A block of carved temple stone one level (4 m) high under a cornice of mossy slabs; its top is the next level\'s ground. Stack terraces and Terrace Stairs into a ziggurat, join them with bridges',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL,
    open: true,
    edgeDefault: 'open',
    solids: terraceBlock(),
  });

  tiles.push({
    id: 'jungle.terrace_stair',
    category: 'Vertical',
    displayName: 'Terrace Stair',
    blurb: '1 × 2 cells: a broad stone stair north up the middle of the south cell (16 steps, 3.2 m wide) to the north cell, all of it a landing 4 m up, between stepped cheeks (stand Fire Bowls at their feet). Stack another on the landing (a level up) for the next terrace: it is reached head-on and from the terraces either side of its foot',
    cells: footprint(1, 2),
    floors: [],
    // Ground only before the foot: the rest is steps, cheeks and landing, so a stair stacked a level up on the landing has no slab over the steps below.
    extraFloors: [slab(b(-4, -0.5, -4, 4, 0, TS_CHEEK, 'floor'))],
    ports: perimeter(1, 2),
    open: true,
    edgeDefault: 'open',
    solids: terraceStair(),
  });

  tiles.push({
    id: 'jungle.temple',
    category: 'Buildings',
    displayName: 'Carved Temple',
    blurb: '2 × 1 cells: carved walls and relief panels, a 3.2 m gate in the south front of the west cell (hang the Portcullis in it), doors west and north, barred windows east, columns, a beamed ceiling, an altar; a stair inside the north wall up to a flat roof 4 m up behind a parapet, open east and west to walkways and the next roof',
    cells: footprint(2, 1, 2),
    floors: [0],
    ports: [...perimeter(2, 1), ...perimeter(2, 1, 1)],
    open: true,
    edgeDefault: 'open',
    solids: templeHall(),
  });

  tiles.push({
    id: 'jungle.shrine',
    category: 'Buildings',
    displayName: 'Summit Shrine',
    blurb: 'A small carved sanctuary on an inlaid apron, door south, slit windows east and west, an altar inside, a stepped roof with a gilded finial: the crown of a ziggurat of Temple Terraces',
    cells: footprint(1, 1, 2),
    floors: [0],
    ports: ALL,
    open: true,
    edgeDefault: 'open',
    solids: shrine(),
  });

  const walls: [WallKind, string, string, string][] = [
    ['carved', 'wall_carved', 'Carved Wall', 'A 4 m temple wall along the north edge, cut with step-fret friezes, a mossy cap'],
    ['relief', 'wall_relief', 'Relief Wall', 'A 4 m temple wall along the north edge with carved relief panels (faces, suns, serpents) between pilasters'],
    ['window', 'wall_window', 'Window Wall', 'A 4 m temple wall along the north edge with two carved windows: one open, one barred (shoot through the bars)'],
    ['arch', 'wall_arch', 'Arch Wall', 'A 4 m temple wall along the north edge with a 3.2 m arched opening in the middle'],
    ['column', 'wall_column', 'Temple Column Wall', 'Four carved columns along the north edge over a knee wall, a lintel on top: see, shoot and vault through'],
    ['low', 'wall_low', 'Low Temple Wall', 'A waist-high temple wall along the north edge (cover; vault it)'],
  ];
  for (const [kind, id, displayName, blurb] of walls) {
    tiles.push({ id: `jungle.${id}`, category: 'Open', displayName, blurb, cells: [[0, 0, 0]], floors: [0], ports: ALL, open: true, edgeDefault: 'open', solids: templeWall(kind) });
  }

  // Beamed colonnade: four columns carrying a beamed timber ceiling whose top is the next level's ground.
  tiles.push({
    id: 'jungle.beamed_hall',
    category: 'Open',
    displayName: 'Beamed Colonnade',
    blurb: 'Four carved columns carrying a beamed timber ceiling 4 m up, vines hanging from the beams; open on every side, and its roof is the next level\'s ground',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL,
    open: true,
    edgeDefault: 'open',
    solids: [
      ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([sx, sz]) => {
        const [x, z] = [sx! * 3.4, sz! * 3.4];
        return [stone(b(x - 0.55, 0, z - 0.55, x + 0.55, 0.45, z + 0.55), '#b0b098'), carved(b(x - 0.4, 0.45, z - 0.4, x + 0.4, 3.4, z + 0.4))];
      }),
      // Two great beams north to south on the columns, joists across them, planks on top.
      ...[-3.4, 3.4].map((x) => paint(b(x - 0.35, 3.0, -4, x + 0.35, 3.6, 4), 'oak_beam', '#5a4a38')),
      ...Array.from({ length: 6 }, (_, i) => trim(-3.05, 3.35, -3.5 + i * 1.4 - 0.12, 3.05, 3.6, -3.5 + i * 1.4 + 0.12, 'oak_beam', '#6a5642')),
      plank(b(-4, 3.6, -4, 4, 4.0, 4)),
      ...vines('x', -1.2, -2.8, 2.8, 3.35, 51, 4, 0.06).filter((v) => v.min[1] > 1.2),
      trim(-4, 0, -4, 4, 0.02, 4, SLAB),
    ],
  });

  // Arched vault: a passage north to south under a stone vault; the top is the next level's ground.
  tiles.push({
    id: 'jungle.arch_hall',
    category: 'Corridors',
    displayName: 'Arched Vault',
    blurb: 'A 5.2 m passage north to south under a carved stone vault (3.5 m at its crown) with ribs and roots breaking through; its top is the next level\'s ground',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: [
      { side: 'N', level: 0 },
      { side: 'S', level: 0 },
    ],
    open: true,
    edgeDefault: 'open',
    solids: [
      carved(b(-4, 0, -4, -2.6, 4, 4)),
      carved(b(2.6, 0, -4, 4, 4, 4)),
      ...arch('x', 0, -2.6, 2.6, 2.2, 1.3, 4, 8, CARVED, undefined, 13).map((x) => ({ ...x, kind: 'solid' as const })),
      trim(-4, 4.0, -4, 4, 4.03, 4, SLAB),
      // Ribs (visual) at the ends and the middle: a band under the vault's curve.
      ...[-3.8, -0.1, 3.6].flatMap((z) => arch('x', z + 0.15, -2.6, 2.6, 2.0, 1.3, 4, 0.3, SLAB, undefined, 13).map((x) => ({ ...x, max: [x.max[0], Math.min(x.max[1], x.min[1] + 0.25), x.max[2]] as const, kind: 'trim' as const }))),
      // Roots hanging through a crack, moss along the walls' feet.
      bark(tilted(0.9, 3.2, 1.5, [0.25, 1.0, 0.25], { roll: 0.4, kind: 'trim' })),
      bark(tilted(1.3, 2.9, 1.9, [0.18, 1.2, 0.18], { roll: -0.3, kind: 'trim' })),
      trim(-2.6, 0, -4, -2.3, 0.15, 4, MOSS),
      trim(2.3, 0, -4, 2.6, 0.15, 4, MOSS),
      trim(-2.6, 0, -4, 2.6, 0.02, 4, SLAB),
    ],
  });

  // Watch tower: the Medieval Watchtower's frame (bots climb it in every rotation), in jungle timber under a palm thatch.
  tiles.push({
    id: 'jungle.watch_tower',
    category: 'Vertical',
    displayName: 'Jungle Watch Tower',
    blurb: 'A lashed timber watch tower: four posts, a switchback stair inside them to a lookout 7 m up behind a plank parapet, under a palm thatch; a crossbar at the top for a Zipline Post\'s cable',
    cells: footprint(1, 1, 3),
    floors: [0],
    ports: ALL,
    open: true,
    edgeDefault: 'open',
    solids: [
      ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => bark(b(sx! * 3.6 - 0.22, 0, sz! * 3.6 - 0.22, sx! * 3.6 + 0.22, 10.0, sz! * 3.6 + 0.22))),
      ...switchback(3.4, 2.0, 28, [6]).map((s) => plank(s)),
      plank(b(-3.8, 6.75, -3.8, 3.8, 7.0, -1.4)),
      ...[
        [-3.8, -3.8, 3.8, -3.6],
        [-3.8, 3.6, 3.8, 3.8],
        [-3.8, -3.6, -3.6, 3.6],
        [3.6, -3.6, 3.8, 3.6],
      ].map(([x0, z0, x1, z1]) => plank(b(x0!, 7.0, z0!, x1!, 8.1, z1!))),
      // Rope lashings at the joints, cross braces (visual).
      ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([sx, sz]) => [3.4, 6.8].map((y) => ropeT(sx! * 3.6 - 0.26, y, sz! * 3.6 - 0.26, sx! * 3.6 + 0.26, y + 0.25, sz! * 3.6 + 0.26))),
      ...[-1, 1].map((s) => ({ ...trim(-3.5, 1.0, s * 3.62 - 0.06, 3.5, 6.0, s * 3.62 + 0.06, 'pbr_walnut', '#8a7458'), roll: s * 0.7 })),
      // The thatch: courses stepping in to a peak.
      ...Array.from({ length: 6 }, (_, i) => {
        const r = 3.95 - i * 0.62;
        return paint(b(-r, 9.8 + i * 0.42, -r, r, 10.25 + i * 0.42, r), THATCH);
      }),
      bark(b(-0.1, 12.3, -0.1, 0.1, 12.9, 0.1)),
      trim(-4, 0, -4, 4, 0.02, 4, ROOTS),
    ],
  });

  // Chasm, gorge steps, the bridges over it.
  const BED = -4.0;
  const CH = 2.5;
  const banks = (): Box[] => [
    rock(b(-4, BED, -4, 4, 0, -CH)),
    rock(b(-4, BED, CH, 4, 0, 4)),
    trim(-4, 0, -4, 4, 0.02, -CH, ROOTS),
    trim(-4, 0, CH, 4, 0.02, 4, ROOTS),
    rock(b(-4, BED, -CH, 4, BED + 0.6, -CH + 0.5), '#7a7a6a'),
    ...vines('x', -CH, -3.6, 3.6, -0.1, 61, 4, 0.05),
    ...vines('x', CH, -3.6, 3.6, -0.1, 67, 4, -0.05),
    trim(-4, BED, -CH, 4, BED + 0.03, CH, 'pbr_gravel', '#7a7a6a'),
  ];
  const bed = [paint(b(-4, BED - 0.5, -CH, 4, BED, CH, 'floor'), ROCK, '#8a8a78')];
  tiles.push({
    id: 'jungle.chasm',
    category: 'Open',
    displayName: 'Chasm',
    blurb: 'A 5 m gorge 4 m deep running east to west between rock banks hung with vines (lay a row; add Water to make it a river). Cross it with a Chasm Rope Bridge, climb out by Gorge Steps',
    cells: [[0, 0, 0]],
    floors: [],
    ports: ALL,
    open: true,
    edgeDefault: 'open',
    extraFloors: bed,
    solids: banks(),
  });
  tiles.push({
    id: 'jungle.chasm_steps',
    category: 'Vertical',
    displayName: 'Gorge Steps',
    blurb: 'The west end of a Chasm: rough stone steps the width of the gorge climb from its bed (east) to the ground (west), the banks either side',
    cells: [[0, 0, 0]],
    floors: [],
    ports: ALL,
    open: true,
    edgeDefault: 'open',
    extraFloors: bed,
    solids: [...banks(), ...flight('x', -1, 3.2, -CH, CH, 16, BED, 0.45, BED).map((s) => rock(s, '#a09a88'))],
  });
  /** A rope bridge's deck from z0 to z1 at y 0, 3 m wide, with netting sides, rope rails and lashed posts at the ends. */
  const ropeDeck = (z0: number, z1: number, posts: readonly number[]): { deck: Box[]; sides: Box[] } => {
    const W = 1.5;
    const deck = [plank(b(-W, -0.2, z0, W, 0, z1, 'floor'))];
    const sides: Box[] = [];
    for (const s of [-1, 1]) {
      // Inner and outer faces of this side (the netting stands on the deck's edge).
      const [i0, i1] = s < 0 ? [-W, -W + 0.1] : [W - 0.1, W];
      sides.push(paint(b(i0, 0, z0, i1, 1.0, z1), NET, NET_TINT));
      sides.push(ropeT(i0 - 0.02, 1.0, z0, i1 + 0.02, 1.08, z1));
      for (const z of posts) sides.push(bark(b(i0 - 0.12, 0, Math.max(z0, z - 0.15), i1 + 0.12, 1.5, Math.min(z1, z + 0.15))));
    }
    // Slats across the deck (visual).
    for (let z = z0 + 0.2; z < z1 - 0.1; z += 0.55) sides.push(trim(-W + 0.05, 0, z, W - 0.05, 0.03, z + 0.4, PLANK));
    return { deck, sides };
  };
  {
    const { deck, sides } = ropeDeck(-CH - 0.6, CH + 0.6, [-CH - 0.4, CH + 0.4]);
    tiles.push({
      id: 'jungle.chasm_bridge',
      category: 'Open',
      displayName: 'Chasm Rope Bridge',
      blurb: 'A Chasm with a 3 m rope bridge across it, north to south, at ground level: plank deck, netting sides, lashed posts on the banks',
      cells: [[0, 0, 0]],
      floors: [],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      extraFloors: [...bed, ...deck],
      solids: [...banks(), ...sides],
    });
  }
  {
    const { deck, sides } = ropeDeck(-4, 4, [-3.8, 3.8]);
    tiles.push({
      id: 'jungle.rope_bridge',
      category: 'Corridors',
      displayName: 'Rope Bridge Span',
      blurb: 'A 3 m rope bridge deck north to south with netting sides and nothing underneath: lay a row of them a level up between Temple Terraces, roofs or towers, over a Chasm or a courtyard',
      cells: [[0, 0, 0]],
      floors: [],
      ports: [
        { side: 'N', level: 0 },
        { side: 'S', level: 0 },
      ],
      open: true,
      edgeDefault: 'open',
      extraFloors: deck,
      solids: [...sides, ...[-1, 1].map((s) => ropeT(s * 1.45 - 0.05, -0.55, -4, s * 1.45 + 0.05, -0.2, 4))],
    });
  }
  tiles.push({
    id: 'jungle.stone_bridge',
    category: 'Corridors',
    displayName: 'Stone Bridge Span',
    blurb: 'A 3.4 m carved stone bridge deck north to south with balustrades and an arched soffit, nothing underneath: a level up between terraces, the temple roof or towers',
    cells: [[0, 0, 0]],
    floors: [],
    ports: [
      { side: 'N', level: 0 },
      { side: 'S', level: 0 },
    ],
    open: true,
    edgeDefault: 'open',
    extraFloors: [slab(b(-1.7, -0.4, -4, 1.7, 0, 4, 'floor'))],
    solids: [
      ...[-1, 1].flatMap((s) => [
        carved(b(s > 0 ? 1.7 - 0.3 : -1.7, 0, -4, s > 0 ? 1.7 : -1.7 + 0.3, 0.9, 4)),
        slab(b(s > 0 ? 1.7 - 0.35 : -1.7, 0.9, -4, s > 0 ? 1.7 : -1.7 + 0.35, 1.05, 4)),
      ]),
      ...arch('z', 0, -4, 4, -1.4, 1.0, -0.4, 3.4, SAND, undefined, 12).map((x) => ({ ...x, kind: 'trim' as const })),
      trim(-1.75, -0.4, -4, 1.75, -0.3, 4, GOLD, '#a88a40'),
    ],
  });

  // Waterfall wall: an 8 m carved wall on the north with a spout, a pool before it, a passage through behind the falls.
  {
    const POOL: [number, number, number, number] = [-2.4, -3.2, 2.4, -1.0];
    const PD = -1.0;
    tiles.push({
      id: 'jungle.waterfall_wall',
      category: 'Open',
      displayName: 'Waterfall Wall',
      blurb: 'An 8 m carved temple wall along the north edge with a serpent spout at the top (stand the Waterfall prop under it), a pool sunk 1 m before it (add Water; steps in on the west), a ledge, and a passage through the wall behind the falls. Its top is a walk two levels up',
      cells: footprint(1, 1, 2),
      floors: [],
      ports: ALL,
      open: true,
      edgeDefault: 'open',
      extraFloors: [
        ...subtract([-4, -4, 4, 1.5], [POOL]).map(([x0, z0, x1, z1]) => slab(b(x0, -0.5, z0, x1, 0, z1, 'floor'))),
        slab(b(-1.2, -0.5, 1.5, 1.2, 0, 4, 'floor')),
        paint(b(POOL[0], PD - 0.5, POOL[1], POOL[2], PD, POOL[3], 'floor'), ROCK, '#6a6a5a'),
      ],
      solids: [
        // The pool's sides, steps down its west end.
        rock(b(POOL[0] - 0.1, PD, POOL[1] - 0.1, POOL[2] + 0.1, 0, POOL[1])),
        rock(b(POOL[0] - 0.1, PD, POOL[3], POOL[2] + 0.1, 0, POOL[3] + 0.1)),
        rock(b(POOL[0] - 0.1, PD, POOL[1], POOL[0], 0, POOL[3])),
        rock(b(POOL[2], PD, POOL[1], POOL[2] + 0.1, 0, POOL[3])),
        ...[0, 1, 2].map((i) => slab(b(POOL[0] + i * 0.5, PD, POOL[1], POOL[0] + (i + 1) * 0.5, -0.25 * (i + 1), POOL[3]))),
        // The wall: carved, 2.5 m thick, a 2.4 m passage through it behind the falls, the spout's notch at the top.
        ...wall('x', 2.75, -4, 4, [[-1.2, 1.2, 0, 2.8], [-0.7, 0.7, 7.4, 8]], 0, 8, CARVED, 2.5),
        slab(b(-4, 8, 1.5, -0.7, 8.2, 4)),
        slab(b(0.7, 8, 1.5, 4, 8.2, 4)),
        // The serpent spout and relief panels either side of the falls.
        stone(b(-0.8, 6.8, 0.7, 0.8, 7.5, 1.5), '#b8b8a0'),
        trim(-0.5, 7.0, 0.5, 0.5, 7.4, 0.7, GOLD, '#b89038'),
        trim(-3.6, 1.2, 1.46, -1.8, 5.6, 1.5, RELIEF),
        trim(1.8, 1.2, 1.46, 3.6, 5.6, 1.5, RELIEF),
        trim(-1.6, 2.8, 1.46, 1.6, 3.2, 1.5, GOLD, '#a88a40'),
        ...vines('x', 1.48, -3.8, -1.6, 8, 71, 3, -0.05),
        ...vines('x', 1.48, 1.6, 3.8, 8, 73, 3, -0.05),
        trim(-4, 8.2, 1.5, 4, 8.24, 2.4, MOSS),
      ],
    });
  }

  // Overgrown ruins: broken carved walls on the north and west, a broken column, a fallen drum, an overgrown beam, roots.
  tiles.push({
    id: 'jungle.overgrown_ruin',
    category: 'Open',
    displayName: 'Overgrown Ruins',
    blurb: 'Broken carved walls along the north and west (head-high to waist-high), a broken column, a fallen drum, an overgrown beam overhead, roots over root-covered ground: scattered cover',
    cells: [[0, 0, 0]],
    floors: [0],
    ports: ALL,
    open: true,
    edgeDefault: 'open',
    solids: [
      trim(-4, 0, -4, 4, 0.02, 4, ROOTS),
      carved(b(-4, 0, 3.0, -1.0, 3.6, 4)),
      carved(b(-1.0, 0, 3.0, 1.2, 1.0, 4)),
      carved(b(1.2, 0, 3.0, 4, 2.4, 4)),
      carved(b(-4, 0, -1.0, -3.0, 3.6, 3.0)),
      carved(b(-4, 0, -4, -3.0, 1.1, -1.0)),
      paint(b(-0.6, 1.0, 3.1, 0.4, 1.4, 3.9), STONE, '#a8a890'),
      // The broken column and its fallen drum.
      stone(b(2.2, 0, -2.8, 3.2, 0.4, -1.8), '#b0b098'),
      carved(b(2.35, 0.4, -2.65, 3.05, 2.6, -1.95)),
      stone(tilted(0.6, 0.4, -1.8, [1.6, 0.8, 0.8], { yaw: 0.5 }), '#b8b8a0'),
      // An overgrown beam from the west wall to the north wall's high end, vines and roots.
      paint(tilted(-2.3, 3.3, 1.2, [3.6, 0.35, 0.35], { yaw: -0.7, kind: 'trim' }), 'oak_beam', '#5a5a40'),
      ...vines('x', 1.25, -3.0, -1.6, 3.2, 81, 3, 0.08),
      bark(tilted(-2.6, 0.3, 2.4, [2.4, 0.4, 0.5], { yaw: 0.8, roll: 0.15, kind: 'trim' })),
      bark(tilted(-3.2, 0.3, -2.4, [0.4, 0.35, 2.2], { yaw: 0.3, kind: 'trim' })),
      trim(-4, 3.6, -1.0, -3.0, 3.66, 4, MOSS),
      trim(-4, 3.6, 3.0, -1.0, 3.66, 4, MOSS),
      trim(1.2, 2.4, 3.0, 4, 2.46, 4, MOSS),
    ],
  });

  return tiles;
}

/** The Jungle Ruins refresh's tiles, in palette order (the pack's first twelve live in packTiles2.ts). */
export function junglePackTiles(): TileDefinition[] {
  return otherTiles();
}
