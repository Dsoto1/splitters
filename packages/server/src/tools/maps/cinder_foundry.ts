/**
 * Cinder Foundry: a steel-and-brick foundry built over a lava floor, designed
 * round the hazards (crumbling catwalks, trapdoors, exploding drums, lava) and
 * the fire weapons (flamethrower, oil slicker, flare gun, incendiaries).
 * Mirrored east–west for two teams; 6–12 players.
 *
 * - The casting hall (x -36..36, z -20..20): its floor is a lava pool. Steel
 *   decks along the west and east walls, walkways along the north and south
 *   walls, and catwalks across the pool to two furnace islands (oil slickers).
 *   The centre line is a run of crumbling catwalk; the south catwalks to the
 *   islands each hide a trapdoor. A molten sluice runs north–south through the
 *   middle of the hall, out under the north wall and the length of the yard.
 * - The crane gantry (4 m up) spans the hall from gallery to gallery; the
 *   rocket launcher and a hill sit on it right over the sluice. Galleries run
 *   along the west, north and east walls; jump pads throw you up to them from
 *   the islands and the south walkway.
 * - The control room (8 m up) bridges the north wall over the sluice: stairs
 *   from the north gallery, pads from the yard. Freeze ray, second hill.
 * - Crucible houses on the south side (high-walled furnace rooms with a lava
 *   vat each) and a narrow duct behind them: flamethrowers, fuel, gas drums.
 * - The slag yard (north): heaps of dark spoil, scrap, braziers and embers,
 *   the sluice down the middle with one bridge that holds and one that crumbles.
 * - Team bases at the west and east ends (spawns and flags).
 *
 * Grid: cell (x, y) is centred on world (8x, 8y); z = 8y is north.
 *
 *   z 56  ┌──────────────── slag yard (terrain) ────────────────┐
 *         │  heaps   pad→ctrl   ║sluice║   pad→ctrl   heaps     │
 *   z 20  base W ├── north walkway / gallery, [control room 8 m] ──┤ base E
 *         base W │ deck │ isl ══ crumble ═ ║ ═ crumble ══ isl │ deck │ base E
 *   z-20  corr.  ├──[crucible W]──── ║lava fall║ ────[crucible E]───┤ corr.
 *   z-32  └────────────────── narrow duct ──────────────────────────┘
 *        x -52   -36    -16          0           16     36     52
 */
import { TERRAIN_MATERIALS, boxBounds, buildMapGeometry, newTerrain, paintSlopes, terrainHeightAt, type Side, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('cinder_foundry', 'Cinder Foundry');
m.theme('factory');
m.backdrop('storm', 'mountains', 'stone', 0.5, 0.25);
type V3 = [number, number, number];
const P = Math.PI / 2;
const MIRROR: Record<Side, Side> = { N: 'N', S: 'S', E: 'W', W: 'E' };

const BRICK = 'pbr_brick_old';
const GRATE = 'pbr_walkway';
const STEEL = 'pbr_steel';
const RUST = 'pbr_rusted_plate';
const TREAD = 'pbr_tread_plate';
const ROCK = 'pbr_rock';

type BlockOpts = Parameters<MapBuilder['block']>[3];
/** A block from its extents. */
const B = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: string, behaviour: 'solid' | 'breakable' | 'crumble' | 'trapdoor' = 'solid', o: BlockOpts = {}): void => {
  // Blocks are at most 64 m on a side: split longer runs in half.
  if (x1 - x0 > 64) return void (B(x0, (x0 + x1) / 2, y0, y1, z0, z1, material, behaviour, o), B((x0 + x1) / 2, x1, y0, y1, z0, z1, material, behaviour, o));
  if (z1 - z0 > 64) return void (B(x0, x1, y0, y1, z0, (z0 + z1) / 2, material, behaviour, o), B(x0, x1, y0, y1, (z0 + z1) / 2, z1, material, behaviour, o));
  m.block([+((x0 + x1) / 2).toFixed(3), y0, +((z0 + z1) / 2).toFixed(3)], [+(x1 - x0).toFixed(3), +(y1 - y0).toFixed(3), +(z1 - z0).toFixed(3)], behaviour, { material, ...o });
};
/** A block and its mirror image across x = 0. */
const B2 = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: string, behaviour: 'solid' | 'breakable' | 'crumble' | 'trapdoor' = 'solid', o: BlockOpts = {}) => {
  B(x0, x1, y0, y1, z0, z1, material, behaviour, o);
  B(-x1, -x0, y0, y1, z0, z1, material, behaviour, o);
};
const flip = (p: V3): V3 => [-p[0], p[1], p[2]];
const flipYaw = (yaw: number) => -yaw;
function tile2(kind: string, x: number, y: number, rot: 0 | 1 | 2 | 3 = 0, rotMirror: 0 | 1 | 2 | 3 = rot, options?: Parameters<MapBuilder['tile']>[5]): void {
  m.tile(kind, x, y, 0, rot, options);
  m.tile(kind, -x, y, 0, rotMirror, options);
}
function edge2(x: number, y: number, side: Side, style: Parameters<MapBuilder['edge']>[4]): void {
  m.edge(x, y, 0, side, style);
  m.edge(-x, y, 0, MIRROR[side], style);
}
function prop2(model: string, p: V3, yaw = 0, scale = 1, solid = true): void {
  m.prop(model, p, yaw, scale, solid).prop(model, flip(p), flipYaw(yaw), scale, solid);
}
function pick2(item: string, p: V3, respawn: number | null = null): void {
  m.pickup(item, p, respawn).pickup(item, flip(p), respawn);
}
function break2(model: 'crate' | 'barrel' | 'gas', p: V3, yaw = 0): void {
  m.breakable(model, p, yaw).breakable(model, flip(p), flipYaw(yaw));
}
function light2(p: V3, o: Parameters<MapBuilder['light']>[1]): void {
  m.light(p, o);
  if (Math.abs(p[0]) > 0.5) m.light(flip(p), { ...o, ...(o?.yaw !== undefined ? { yaw: -o.yaw } : {}) });
}
/** Block stairs: 0.25 m risers on 0.5 m treads from `y0` to `y1`, running along +x or +z from (x, z). */
function stairs(x: number, z: number, along: 'x' | 'z', dir: 1 | -1, width: number, y0: number, y1: number, mirror = true): void {
  const steps = Math.round((y1 - y0) / 0.25);
  for (let i = 1; i <= steps; i++) {
    const a = (i - 1) * 0.5 * dir;
    const b = i * 0.5 * dir;
    const top = y0 + i * 0.25;
    const f = mirror ? B2 : B;
    if (along === 'x') f(x + Math.min(a, b), x + Math.max(a, b), y0, top, z - width / 2, z + width / 2, TREAD);
    else f(x - width / 2, x + width / 2, y0, top, z + Math.min(a, b), z + Math.max(a, b), TREAD);
  }
}

const LAVA_GLOW = '#ff6a1f';
const EMBER = '#ff8a3a';
const LAMP = '#ffc58a';

// ======================================================================== the casting hall

// The pit: rock under the lava, the west and east pools and the sluice between them.
B(-28, 28, -5.5, -5, -16, 16, ROCK);
B(-4, 4, -5.5, -5, -20, -16, ROCK); B(-3, 3, -5.5, -5, 16, 20.6, ROCK);
m.water([-15.5, -5, 0], [25, 2.5, 32], 'lava').water([15.5, -5, 0], [25, 2.5, 32], 'lava');
m.water([0, -5, 0], [6, 2.5, 41.2], 'lava'); // the sluice through the hall, z -20.6 .. 20.6
m.water([0, -5, -18], [8, 2.5, 4], 'lava'); // under the south bridge, widening into the fall

// Decks along the west and east walls (solid down to the pit floor: they are the pit's walls).
B2(-36, -28, -5, 0, -20, 20, TREAD);
// South walkway (solid), and its bridge over the sluice.
B2(-28, -4, -5, 0, -20, -16, TREAD);
B(-4, 4, -0.4, 0, -20, -16, STEEL);
B(-4, 4, 0, 1, -20.2, -20, STEEL); // a rail on the bridge's south side, over the lava fall
// North walkway, with a crumbling bridge over the sluice.
B2(-28, -3, -5, 0, 16, 20, TREAD);
B2(-3, 0, -0.4, 0, 16, 20, RUST, 'crumble', { delay: 0.9, respawn: 7 });

// Furnace islands: brick foundations rising out of the lava, steel tops.
B2(-20, -12, -5, -0.4, -4, 4, BRICK);
B2(-20, -12, -0.4, 0, -4, 4, TREAD);
// North catwalks: deck-solid grating from the north walkway down to each island.
B2(-17.5, -14.5, -0.4, 0, 4, 16, GRATE);
// South catwalks: grating with a trapdoor halfway (red rim: jump it).
B2(-17.5, -14.5, -0.4, 0, -16, -11, GRATE);
B2(-17.5, -14.5, -0.3, 0, -11, -9, TREAD, 'trapdoor', { delay: 0.15, respawn: 6 });
B2(-17.5, -14.5, -0.4, 0, -9, -4, GRATE);
// The centre line (z 0): deck to island crumbles, island to sluice holds, the sluice crossing crumbles.
for (let i = 0; i < 3; i++) B2(-28 + i * (8 / 3), -28 + (i + 1) * (8 / 3), -0.4, 0, -1.5, 1.5, RUST, 'crumble', { delay: 0.8, respawn: 8 });
B2(-12, -3, -0.4, 0, -1.5, 1.5, GRATE);
B2(-3, 0, -0.4, 0, -1.5, 1.5, RUST, 'crumble', { delay: 0.7, respawn: 8 });
// Pad spurs off the south walkway (so walkers don't trip the pads).
B2(-11.5, -8.5, -0.4, 0, -16, -13.6, GRATE);

// Galleries 4 m up: west and east over the decks, north over the north walkway.
B2(-36, -32, 3.6, 4, -20, 20, GRATE);
B(-36, 36, 3.6, 4, 13, 20, GRATE);
// Stairs from each deck up to its gallery (north along the deck), and a landing.
stairs(-30.5, -16, 'z', 1, 3, 0, 4);
B2(-32, -29, 3.6, 4, -8, -5, GRATE);
// The crane gantry: a steel bridge across the hall from gallery to gallery, legs in the lava.
B(-32, 32, 3.6, 4, -1.75, 1.75, STEEL);
B2(-22.6, -21.4, -5, 3.6, 1.9, 3.1, STEEL); B2(-22.6, -21.4, -5, 3.6, -3.1, -1.9, STEEL);
B2(-22.6, -21.4, 3.6, 4, 1.75, 3.1, STEEL); B2(-22.6, -21.4, 3.6, 4, -3.1, -1.75, STEEL);
// Crane rails under the roof, the trolley over the sluice, a ladle hanging over the lava fall.
B(-36, 36, 10.4, 10.8, 2.2, 2.6, STEEL); B(-36, 36, 10.4, 10.8, -2.6, -2.2, STEEL);
B(-2.5, 2.5, 9.6, 10.4, -2.8, 2.8, RUST);
B(-0.6, 0.6, 9.2, 9.6, -12.6, -11.4, STEEL); B(-0.12, 0.12, 7.6, 9.2, -12.12, -11.88, STEEL);
B(-1.3, 1.3, 6.4, 7.6, -13.3, -10.7, 'pbr_charred_wood');
B(-1.3, 1.3, 7.6, 7.8, -13.3, -10.7, 'pbr_lava');

// Gallery stairs up to the control room (along the back of the north gallery).
stairs(-16, 18.5, 'x', 1, 3, 4, 8);
// The control room: floor 8 m up across the north wall, over the sluice, open to the yard.
B(-8, 8, 7.6, 8, 14, 28, TREAD);
B(-8, 8, 8, 9, 14, 14.3, STEEL); // half wall over the hall
B2(-8.3, -8, 8, 11, 14, 17, BRICK);
B2(-8.3, -8, 8, 11, 20, 28, BRICK);
B2(-8.3, -8, 10, 11, 17, 20, BRICK); // lintel over the stair door
B2(-8, -5, 8, 9, 27.7, 28, STEEL); // half walls at the yard end, open in the middle for the pads
B(-8.3, 8.3, 11, 11.4, 14, 25, 'pbr_concrete_dark');
B2(-8, -7, -0.2, 7.6, 26.8, 27.8, STEEL); // legs in the yard
B(-1.5, 1.5, 8, 9, 15, 16.2, STEEL); // the control desk (cover)

// Walls. North (z 20 .. 20.6): doorways onto the yard from the walkway, a gap under the control room.
for (const [x0, x1] of [[-36, -26], [-20, -3], [3, 20], [26, 36]] as const) B(x0, x1, 0, 4, 20, 20.6, BRICK);
B(-3, 3, -2.2, 4, 20, 20.6, BRICK);
B2(-26, -20, 3.2, 4, 20, 20.6, BRICK);
B2(-36, -8, 4, 12, 20, 20.6, BRICK);
B(-8, 8, 4, 7.6, 20, 20.6, BRICK); B(-8, 8, 11.4, 12, 20, 20.6, BRICK);
// South (z -20.6 .. -20) above the crucible houses (their own walls stand below 4 m).
B(-36, 36, 4, 12, -20.6, -20, BRICK);
// West and east above the bases.
B2(-36.6, -36, 4, 12, -20.6, 20.6, BRICK);
// The roof, with a long skylight over the sluice.
B2(-36.6, -4, 12, 12.4, -20.6, 20.6, 'pbr_corrugated');

// ======================================================================== bases, corridors, crucibles (tiles)

// Bases: 2 × 4 rooms at each end, roofed.
for (const x of [-6, -5]) for (const y of [-1, 0, 1, 2]) tile2('room', x, y, 0, 0, { ceiling: 'roof', corners: 'posts' });
for (const y of [-1, 0, 1, 2]) edge2(-6, y, 'E', 'open');
for (const y of [-1, 0, 1]) for (const x of [-6, -5]) edge2(x, y, 'N', 'open');
edge2(-5, -1, 'E', 'wide');
edge2(-5, 0, 'E', 'window');
edge2(-5, 1, 'E', 'wide');
edge2(-5, 2, 'E', 'door');
edge2(-6, 2, 'N', 'wide');
edge2(-5, 2, 'N', 'door');
edge2(-5, -1, 'S', 'door');
// The corridor south from each base to its crucible house and the duct.
tile2('corridor', -5, -2, 0, 0);
tile2('junction_t', -5, -3, 1, 3);
tile2('corner', -5, -4, 0, 3);
// The crucible houses: four furnace rooms in a row, high walls, beamed roofs.
for (const x of [-4, -3, -2, -1]) tile2('room', x, -3, 0, 0, { ceiling: 'beams' });
for (const x of [-4, -3, -2]) edge2(x, -3, 'E', 'open');
edge2(-4, -3, 'W', 'door');
edge2(-4, -3, 'N', 'door');
edge2(-3, -3, 'N', 'wide');
edge2(-2, -3, 'N', 'window');
edge2(-1, -3, 'N', 'wide');
edge2(-1, -3, 'E', 'bars'); // looks out over the lava fall
for (const x of [-4, -3, -1]) edge2(x, -3, 'S', 'high');
edge2(-2, -3, 'S', 'door');
// The duct behind them: corridors narrowed to a 3 m run by blocks, under a low roof.
for (const x of [-4, -3, -1]) tile2('corridor_clear', x, -4, 1, 1);
m.tile('corridor_clear', 0, -4, 0, 1);
tile2('junction_t', -2, -4, 0, 0);
m.edge(0, -4, 0, 'N', 'window'); // a window onto the lava fall
// Fill in along the duct's south and north sides (gaps for the doors north into the crucibles).
B2(-43.6, -0.01, 0, 4, -35.9, -33.5, 'pbr_concrete_dark');
B2(-35.9, -17.5, 0, 4, -30.5, -28.1, 'pbr_concrete_dark');
B2(-14.5, -1.9, 0, 4, -30.5, -28.1, 'pbr_concrete_dark');
B(-36, 36, 4, 4.4, -36, -28, 'pbr_concrete_dark');
// The lava fall between the crucible houses: the sluice drops into a pit at the duct wall.
B(-4, 4, -5.5, -5, -28, -20, ROCK);
m.water([0, -5, -24], [8, 2.5, 8], 'lava');
B(-4, 4, 4, 4.4, -28, -27.6, BRICK);

// Lava vats in the crucible houses: a steel rim with molten metal inside (stay out).
for (const s of [-1, 1]) {
  const cx = s * 20;
  const cz = -24.5;
  B(cx - 1.6, cx + 1.6, 0, 1, cz - 1.6, cz - 1.3, RUST); B(cx - 1.6, cx + 1.6, 0, 1, cz + 1.3, cz + 1.6, RUST);
  B(cx - 1.6, cx - 1.3, 0, 1, cz - 1.3, cz + 1.3, RUST); B(cx + 1.3, cx + 1.6, 0, 1, cz - 1.3, cz + 1.3, RUST);
  m.water([cx, 0, cz], [2.6, 0.85, 2.6], 'lava');
}

// ======================================================================== the slag yard (blocks first: the terrain fits round them)

// Perimeter walls.
B2(-52.6, -52, -0.1, 5, 20, 56.6, BRICK);
B2(-52.6, -3, -0.1, 5, 56, 56.6, BRICK);
B(-3, 3, -2.2, 5, 56, 56.6, BRICK);
// The sluice down the yard: a brick channel, a bridge that holds and one that crumbles.
B(-3, 3, -5.5, -5, 20.6, 56, ROCK);
B2(-3.5, -3, -5, 0.1, 20.6, 56, BRICK);
m.water([0, -5, 38.3], [6, 2.5, 35.4], 'lava');
B(-5, 5, 0, 0.1, 34, 38, STEEL);
B(-5, 5, 0.1, 1, 33.8, 34, STEEL); B(-5, 5, 0.1, 1, 38, 38.2, STEEL);
for (let i = 0; i < 3; i++) B(-6.6 + i * 4.4, -2.2 + i * 4.4, -0.3, 0.1, 47, 50, RUST, 'crumble', { delay: 0.8, respawn: 8 });
// Pad plinths (pads up to the control room).
B2(-11.2, -8.8, 0, 0.1, 38.8, 41.2, STEEL);

// ======================================================================== terrain: the yard and the spoil all round

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const HEAPS: [number, number, number, number][] = [
  [-40, 45, 4, 7], [-27, 51, 3, 6], [-21, 31, 2.4, 4.5], [24, 51, 3.6, 6], [41, 43, 4, 7], [27, 30, 2.2, 4.5], [-44, 28, 1.6, 4],
];
const BOUNDS = { min: [-57, -41] as [number, number], max: [57, 61] as [number, number] };
m.bounds('invisible', 4, BOUNDS, 10);
function sculpt(): TerrainData {
  const [x0, z0] = BOUNDS.min;
  const [x1, z1] = BOUNDS.max;
  const size = Math.min(320, Math.max(x1 - x0, z1 - z0) + 120);
  const t = newTerrain(size, 2, [Math.round((x0 + x1) / 4) * 2, Math.round((z0 + z1) / 4) * 2]);
  const outside = (x: number, z: number) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
  const inYard = (x: number, z: number) => x > -52 && x < 52 && z > 20.6 && z < 56;
  const shape = (x: number, z: number) => {
    const d = outside(x, z);
    let y = -0.1;
    if (inYard(x, z)) for (const [hx, hz, h, r] of HEAPS) y += h * Math.exp(-(((x - hx) ** 2 + (z - hz) ** 2) / (r * r)));
    // Outside the walls: spoil banks climbing to black slag ridges.
    y += smooth(2, 30, d) * (9 + 4 * Math.sin(x / 15 + 1) * Math.cos(z / 12) + 2 * Math.sin(z / 6 - x / 9)) + smooth(30, 55, d) * 8 * (0.6 + 0.4 * Math.cos(x / 19 + z / 23));
    return y;
  };
  const solids = buildMapGeometry(m.doc).filter((q) => q.kind !== 'barrier').map(boxBounds);
  const { cols, rows } = t;
  const h: number[] = [];
  const covered: boolean[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = t.origin[0] + c * 2;
      const z = t.origin[1] + r * 2;
      let y = shape(x, z);
      let under = false;
      for (const s of solids) {
        if (x > s.min[0] - 0.3 && x < s.max[0] + 0.3 && z > s.min[2] - 0.3 && z < s.max[2] + 0.3 && s.min[1] - 0.1 < y + 0.5) {
          y = Math.min(y, s.min[1] - 0.1);
          under = true;
        }
      }
      h.push(y);
      covered.push(under);
    }
  }
  const materials: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const corners = [r * cols + c, r * cols + c + 1, (r + 1) * cols + c, (r + 1) * cols + c + 1];
      const x = t.origin[0] + c * 2 + 1;
      const z = t.origin[1] + r * 2 + 1;
      const y = corners.reduce((s, i) => s + h[i]!, 0) / 4;
      const streak = Math.sin(x / 7 + z / 9) * Math.cos(z / 5 - x / 11);
      let g: TerrainMaterial = streak > 0.25 ? 'gravel' : 'dirt';
      if (y > 1.2 || y < -1) g = 'stone';
      else if (streak < -0.45) g = 'mud';
      materials.push(TERRAIN_MATERIALS.indexOf(g));
    }
  }
  return paintSlopes({ ...t, heights: h.map((y) => Math.round(y * 100)), materials, foliage: new Array((cols - 1) * (rows - 1)).fill(0) }, 32, 'stone');
}
const ground = sculpt();
m.terrain(ground);
/** A point on the yard ground. */
const yard = (x: number, z: number, lift = 0): V3 => [x, +((terrainHeightAt(ground, x, z) ?? -0.1) + lift).toFixed(2), z];

// ======================================================================== jump pads

// Islands up to the west/east gallery and to the north gallery; spurs up onto the gantry.
m.padTo([-13.2, 0, -3.2], [-34, 4, -3.2], 15).padTo([13.2, 0, -3.2], [34, 4, -3.2], 15);
m.padTo([-13.2, 0, 3.2], [-13.2, 4, 16], 15).padTo([13.2, 0, 3.2], [13.2, 4, 16], 15);
m.padTo([-10, 0, -14.8], [-10, 4, 0], 15).padTo([10, 0, -14.8], [10, 4, 0], 15);
// Yard up into the control room.
m.padTo([-10, 0.1, 40], [-2.5, 8, 23.5], 19).padTo([10, 0.1, 40], [2.5, 8, 23.5], 19);

// ======================================================================== props and destructibles

// Hall decks: machinery and drums, explosive barrels and gas at the catwalk heads (choke points).
prop2('machine', [-33.5, 0, 14], P);
prop2('big_pipe', [-33.8, 0, -18], 0);
prop2('pipe_valve', [-29.5, 0, 9.5], 0); // explodes
prop2('metal_crate', [-34.5, 0, 7], 0.2);
prop2('crate_large', [-34.6, 0, -2.6], 0);
break2('barrel', [-29.6, 0, 3.4]);
break2('barrel', [-29.6, 0, -3.4]);
prop2('sv_propane', [-35.2, 0, 10.2], 0.4);
prop2('powder_keg', [-30, 0, -19], 0.3); // explodes, by the south walkway
// South walkway: gas cylinders by the crucible doors.
break2('gas', [-21, 0, -19.2]);
prop2('sv_gas_can', [-20.2, 0, -19.4], 0.3);
break2('gas', [-6, 0, -19.2]);
prop2('sv_propane', [-6.9, 0, -19.3], 1.2);
// North walkway: drums by the yard doorways.
break2('barrel', [-27.2, 0, 19.2]);
prop2('dg_barrel', [-18.8, 0, 19.2], 0.6);
// Islands: breakable crates for cover round the oil slicker.
break2('crate', [-18.8, 0, -2.8], -0.2);
prop2('fire_basket', [-18.9, 0, 2.9], 0, 0.5); // a brazier: explodes when shot
// Galleries: crates to duck behind, and the control room's terminals.
prop2('metal_crate', [-34.8, 4, 12], 0.1);
prop2('factory_box_long', [-34.9, 4, -12], P);
prop2('crate_small', [-24, 4, 19.4], 0.4);
prop2('cardboard_box', [-30, 4, 19.5], 0.3);
m.prop('computer_bank', [0, 8, 26.6], Math.PI);
prop2('screen_panel', [-6.7, 8, 15.2], 0);
prop2('computer_wide', [-6.8, 8, 22.5], P);
prop2('lever', [-4.5, 8, 15.3], 0, 1, false);
prop2('office_chair', [-2.5, 8, 17.2], 0.6, 1, false);
// Crucible houses: furnaces (hoppers) along the back wall, machines, anvils and braziers.
prop2('hopper_tall', [-31.5, 0, -25.9], 0);
prop2('hopper', [-8.5, 0, -25.4], 0);
prop2('machine', [-26, 0, -26.2], 0);
prop2('anvil', [-23, 0, -21.5], 0.4);
prop2('workbench', [-14.5, 0, -27], 0);
prop2('conveyor', [-26, 0, -21.6], 0, 0.7);
prop2('fire_basket', [-34, 0, -21.8], 0, 0.5);
break2('barrel', [-11.2, 0, -21.2]);
prop2('sv_propane', [-10.3, 0, -21], 0.7);
// The duct: gas cylinders and drums in the narrow run (oil, then fire).
break2('gas', [-26, 0, -33]);
break2('gas', [-6.5, 0, -33]);
prop2('dg_barrel', [-30, 0, -31], 0.2);
prop2('sf_pipe_rack', [-22, 0, -33], 0, 1, false);
// Bases: kit and crates.
prop2('shelf_boxes', [-50.8, 0, -10.5], P);
prop2('crate_large', [-50.8, 0, 18], 0);
prop2('metal_crate', [-45, 0, 10], 0.3);
prop2('factory_box', [-41, 0, -6], 0);
prop2('barrier_high', [-44, 0, 16], 0);
prop2('workbench', [-50.8, 0, 9], P);
prop2('sv_trashcan_metal', [-38, 0, -18], 0);

// ======================================================================== lights

// Lava glow over the pools, the sluice and the fall.
for (const x of [-22, -9]) for (const z of [-10, 0, 10]) light2([x, -1.4, z], { fixture: 'none', color: LAVA_GLOW, intensity: 1.7, range: 13 });
for (const z of [-14, 6, 18]) m.light([0, -1.4, z], { fixture: 'none', color: LAVA_GLOW, intensity: 1.8, range: 12 });
m.light([0, -1.4, -24], { fixture: 'none', color: LAVA_GLOW, intensity: 2, range: 12 });
m.light([0, 6, -12], { fixture: 'none', color: '#ffa040', intensity: 1.4, range: 8 }); // the ladle
for (const z of [28, 40, 52]) m.light([0, -1.2, z], { fixture: 'none', color: LAVA_GLOW, intensity: 1.6, range: 12 });
light2([-20, 1.2, -24.5], { fixture: 'none', color: LAVA_GLOW, intensity: 1.4, range: 8 }); // vats
// Lamps under the hall roof: dim and warm.
for (const x of [-30, -16, 16, 30]) for (const z of [-12, 4]) m.light([x, 11.2, z], { fixture: 'bulb', color: LAMP, intensity: 0.9, range: 15 });
light2([-34, 7.4, 8], { fixture: 'wall', color: LAMP, intensity: 0.9, range: 9, yaw: P });
light2([-34, 7.4, -10], { fixture: 'wall', color: LAMP, intensity: 0.9, range: 9, yaw: P });
light2([-20, 7.4, 19.6], { fixture: 'wall', color: LAMP, intensity: 0.8, range: 9, yaw: Math.PI });
// Control room: cool screens light.
m.light([0, 10.8, 18], { fixture: 'ceiling', color: '#cfe0ff', intensity: 1.1, range: 10 }).light([0, 10.8, 23], { fixture: 'ceiling', color: '#cfe0ff', intensity: 0.9, range: 9 });
// Bases, corridors, crucibles and the duct.
for (const x of [-48, -40]) for (const z of [-8, 0, 8, 16]) light2([x, 3.4, z], { fixture: 'ceiling', color: LAMP, intensity: 1, range: 9 });
for (const z of [-16, -24, -32]) light2([-40, 3.4, z], { fixture: 'bulb', color: LAMP, intensity: 0.9, range: 9 });
for (const x of [-30, -14]) light2([x, 6.5, -24], { fixture: 'bulb', color: EMBER, intensity: 1.2, range: 12 });
for (const x of [-30, -16, -4]) light2([x, 3.6, -32], { fixture: 'strip', color: '#ffb070', intensity: 0.8, range: 8 });

// ======================================================================== spawns

m.teams([6, 6]);
const [embers, tide] = m.teamIds() as [string, string];
// Free-for-all: sixteen spawns, clear of the lava and off anything that crumbles.
const ffa: [V3, number][] = [
  [[-47, 0, 2], P], // base
  [[-40, 0, -24], 0], // corridor junction
  [[-29.5, 0, -22], 0], // crucible house
  [[-15, 0, -22], 0],
  [[-34, 4, 4], P], // west gallery
  [[-26, 4, 18], Math.PI], // north gallery
  [[-34, 0, -8], P], // west deck, under the gallery
];
for (const [p, yaw] of ffa) m.spawn(p, yaw).spawn(flip(p), flipYaw(yaw));
// Yard spawns (on the ground) and the control room.
for (const [x, z, yaw] of [[-34, 28, Math.PI], [-12, 52, Math.PI]] as const) m.spawn(yard(x, z), yaw).spawn(yard(-x, z), -yaw);
m.spawn([-5, 8, 25], Math.PI).spawn([5, 8, 25], Math.PI);
// Teams: six in each base.
for (const [x, z] of [[-49, -8], [-49, 0], [-49, 8], [-43, -8], [-43, 4], [-49, 15]] as const) {
  m.spawn([x, 0, z], P, embers).spawn([-x, 0, z], -P, tide);
}
m.flag(embers, [-50, 0, -3], P).flag(tide, [50, 0, -3], -P);
// King of the Hill: the gantry over the sluice, then the control room.
m.hill([0, 4, 0], 4).hill([0, 8, 21], 5);

// ======================================================================== pickups

// Power: the rocket launcher on the gantry, right over the sluice.
m.pickup('weapon_rockets', [0, 4, 0]);
pick2('ammo_explosive', [-34, 4, 0]);
// Fire and oil: oil slickers on the islands, flamethrowers in the duct, flare guns on the south walkway.
pick2('weapon_oil_slicker', [-16, 0, 0]);
pick2('weapon_flamethrower', [-16, 0, -32]);
pick2('ammo_fuel', [-8, 0, -32]);
m.pickup('ammo_fuel', [0, 0, -32]);
pick2('weapon_flare_gun', [-14, 0, -18]);
pick2('incendiaries', [-24, 0, -24]);
pick2('ammo_fuel', [-34, 0, 18]);
// Guns round the rest.
pick2('weapon_sawed_off', [-8, 0, -23]);
pick2('weapon_shotgun', [-22, 0, 18]);
pick2('weapon_rifle', [-44, 0, -2]);
pick2('weapon_smg', [-40, 0, -14]);
pick2('weapon_burst_rifle', [-34, 4, -14]);
m.pickup('weapon_freeze_ray', [0, 8, 18.5]);
// Armour and health: plenty, against the burns.
m.pickup('armor_large', [0, 4, 16]);
pick2('armor_small', [-34, 4, -18]);
pick2('armor_small', [-34, 0, 0]);
pick2('armor_small', [-28, 0, -25]);
m.pickup('armor_small', [0, 0, -18]);
pick2('health_large', [-36, 0, -24]);
pick2('health_small', [-16, 0, 2.8]);
pick2('health_small', [-32, 0, -12]);
pick2('health_small', [-12, 4, 15]);
pick2('health_small', [-42, 0, -29.5]);
pick2('health_small', [-46, 0, 12]);
m.pickup('health_large', [0, 8, 24.5]);
pick2('ammo', [-48, 0, -4]);
pick2('ammo_shells', [-26, 0, -18]);
pick2('grenades', [-40, 0, -30]);
pick2('ammo', [-30, 4, 16]);
// The yard.
pick2('weapon_goo_gun', yard(-30, 38));
m.pickup('ammo_chem', yard(-36, 26)).pickup('ammo_chem', yard(36, 26));
pick2('weapon_launcher', yard(-46, 52));
pick2('health_large', yard(-18, 44));
pick2('armor_small', yard(-14, 28));
pick2('incendiaries', yard(-40, 34));
m.pickup('armor_large', [0, 0.1, 36]); // on the yard bridge, over the sluice
pick2('grenades', yard(-8, 50));

// ======================================================================== the yard: scrap, slag and embers

prop2('skip', yard(-46, 23), P, 1.2);
prop2('cargo_crate', yard(-32, 47), 0.3, 1.4);
prop2('container_tall', yard(-48, 38), 0, 1.3);
prop2('hopper', yard(-36, 54), 0, 1);
prop2('debris', yard(-24, 25), 0.7, 2);
prop2('debris', yard(-17, 38), 2.1, 1.6);
prop2('rocks_tall', yard(-30, 31), 0.5, 1);
prop2('boulder_jagged', yard(-44, 47), 1.2, 0.8);
prop2('rock_large', yard(-20, 54), 0.4, 1.2);
prop2('cog', yard(-26, 40), 0.3, 0.5, true);
prop2('coal_car', yard(-14, 34), 0.15, 1);
prop2('fire_basket', yard(-10, 29), 0, 0.6); // braziers by the control room legs
prop2('campfire_stones', yard(-38, 40), 0, 1, false);
prop2('sv_campfire', yard(-23, 47), 0.3, 1);
prop2('sv_torch_stand', yard(-12, 22), 0);
break2('barrel', yard(-6.5, 33));
break2('gas', yard(-6.5, 39));
prop2('sv_propane', yard(-50, 30), 0.2);
prop2('woodpile', yard(-50.5, 45), P);
for (const [x, z] of [[-38, 40], [-23, 47], [-10, 29]] as const) light2([x, (terrainHeightAt(ground, x, z) ?? 0) + 1.2, z], { fixture: 'none', color: EMBER, intensity: 1.3, range: 9 });
for (const [x, z] of [[-40, 45], [-24, 51], [-27, 30]] as const) light2([x, (terrainHeightAt(ground, x, z) ?? 0) + 0.6, z], { fixture: 'none', color: '#ff5a1a', intensity: 0.9, range: 7 }); // embers on the heaps
light2([-30, 4.6, 24], { fixture: 'bulb', color: LAMP, intensity: 0.8, range: 12 });

m.meta({
  description:
    'A steel-and-brick foundry over a lava floor. Catwalks cross the casting hall to two furnace islands (oil slickers), the centre line crumbles under you, trapdoors wait on the south runs, and a molten sluice splits the map. The crane gantry carries the rocket launcher over the hottest spot; the control room bridges the north wall above the sluice. Flamethrowers in the narrow duct behind the crucible houses, a slag yard to the north, a team base at each end.',
  modes: ['core.deathmatch', 'core.tdm', 'core.koth', 'core.ctf'],
  players: [6, 12],
});
await m.save();
