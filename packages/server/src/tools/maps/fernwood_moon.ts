/**
 * Fernwood Moon: a redwood forest on a forest moon at dusk (our own map and
 * name, built only from our kit). The Rebels (attackers) hold a treetop
 * village in the north; the Garrison (defenders) hold a concrete shield
 * bunker, a landing pad and a tall dish antenna in a clearing to the south.
 * Between them: giant trunks 6 m wide and 46 m tall, winding dirt trails for
 * hover-bike chases, swinging logs and rockfalls on the trails, a mid-forest
 * clearing round a fallen giant, and a Garrison scout outpost whose console
 * holds the code to the bunker's blast door.
 *
 * - The village: six giant trees in two rows, plank platforms ringing each
 *   trunk (10 m up in the south row, 14 m in the north), sagging rope bridges
 *   between them, lifts and climbing vines up, and a lookout 24 m up the
 *   north-centre tree (ladder from its platform).
 * - The bunker: blast door on the north face, locked. Upload the stolen code
 *   at the outpost console (Rebels only) to open it; the Garrison can seal it
 *   again from inside. The long way in is the ladder up the east wall and the
 *   maintenance hatch: a ramp down from the roof into the control room. Its
 *   generator hall is bomb site A; the dish antenna west of it is site B.
 * - The trails: hover bikes parked at both ends; two swinging logs on
 *   pendulum movers (fast enough to run you over) and three rockfalls.
 *
 * Top-down (x east, z north; metres):
 *
 *   z +96    [T]==[T]==[T]       north row, platforms 14 m (lookout 24 m on the middle)
 *             ||   ||   ||
 *   z +64    [T]==[T]==[T]       south row, platforms 10 m; Rebel camp below, bikes
 *   z +40       \    |    /
 *   z   0   (clearing)  ~trails~   (outpost: pillbox console, guard tower)
 *   z -40       /    |    \
 *   z -80   (dish)  [BUNKER]  [pad: dropship]   Garrison clearing, bikes
 */
import { TERRAIN_MATERIALS, newTerrain, paintSlopes, terrainHeightAt, type ScenarioLogic, type TerrainData, type TerrainMaterial } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

type V3 = [number, number, number];
type P2 = [number, number];
const m = new MapBuilder('fernwood_moon', 'Fernwood Moon');
m.theme('forest');
m.backdrop('dusk', 'forest', 'grass', 0.6, 0.5);
m.teams([16, 16]);
const [REBELS, GARRISON] = m.teamIds(2) as [string, string];

const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- terrain

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Flat ground (height 0) for the village, the bunker clearing, the outpost and the mid clearing. */
const FLAT: [number, number, number][] = [
  [0, 80, 52],
  [0, -78, 56],
  [70, 2, 20],
  [-60, 0, 16],
];
const flatness = (x: number, z: number) => Math.max(...FLAT.map(([cx, cz, r]) => 1 - smooth(r * 0.7, r, Math.hypot(x - cx, z - cz))));
const rolling = (x: number, z: number) => 1.4 * Math.sin(x / 19 + 0.3) * Math.cos(z / 27) + 0.9 * Math.sin((x - z) / 33) + 0.5 * Math.cos(x / 11 + z / 13);
const height = (x: number, z: number) => Math.max(0, rolling(x, z) + 0.8) * (1 - flatness(x, z));

const TRAILS: P2[][] = [
  [[-20, 46], [-38, 30], [-58, 14], [-62, -8], [-48, -30], [-24, -50]],
  [[20, 46], [44, 30], [62, 16], [76, -10], [58, -32], [26, -50]],
  [[0, 44], [8, 26], [-6, 8], [6, -14], [0, -48]],
  [[-60, 0], [-32, -4], [-6, 8]],
  [[6, -14], [40, -6], [70, 0]],
];
const segDist = (x: number, z: number, [ax, az]: P2, [bx, bz]: P2) => {
  const vx = bx - ax;
  const vz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - ax - vx * t, z - az - vz * t);
};
const trailDist = (x: number, z: number) => Math.min(...TRAILS.map((l) => Math.min(...l.slice(1).map((b, i) => segDist(x, z, l[i]!, b)))));

let terrain: TerrainData = { ...newTerrain(272, 2, [0, 0], 'grass'), baseY: -0.15 };
terrain = {
  ...terrain,
  heights: terrain.heights.map((_, i) => {
    const c = i % terrain.cols;
    const r = Math.floor(i / terrain.cols);
    return Math.round(height(terrain.origin[0] + c * terrain.spacing, terrain.origin[1] + r * terrain.spacing) * 100);
  }),
};
const mat = (n: TerrainMaterial) => TERRAIN_MATERIALS.indexOf(n);
terrain = {
  ...terrain,
  materials: terrain.materials.map((v, i) => {
    const c = i % (terrain.cols - 1);
    const r = Math.floor(i / (terrain.cols - 1));
    const x = terrain.origin[0] + (c + 0.5) * terrain.spacing;
    const z = terrain.origin[1] + (r + 0.5) * terrain.spacing;
    if (trailDist(x, z) < 2.6) return mat('dirt');
    if (Math.abs(x) < 52 && z > -104 && z < -54 && Math.hypot(x, z + 78) < 46) return mat('gravel');
    if (Math.sin(x / 7) * Math.cos(z / 9) > 0.55) return mat('moss');
    return v;
  }),
};
terrain = paintSlopes(terrain, 36, 'stone');
m.terrain(terrain);
const ground = (x: number, z: number) => r2(terrainHeightAt(terrain, x, z) ?? 0);
const G = (x: number, z: number, up = 0): V3 => [r2(x), r2(ground(x, z) + up), r2(z)];

// ---------------------------------------------------------------- block helpers

type BlockOpts = Parameters<MapBuilder['block']>[3];
const block = (at: V3, size: V3, o: BlockOpts = {}) => m.block([r2(at[0]), r2(at[1]), r2(at[2])], [r2(size[0]), r2(size[1]), r2(size[2])], 'solid', { respawn: null, ...o });
/** A box from (x0, y0, z0) to (x1, y1, z1). */
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, o: BlockOpts = {}) =>
  block([(x0 + x1) / 2, Math.min(y0, y1), (z0 + z1) / 2], [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)], o);

const BARK = { material: 'pbr_weathered_siding', tint: '#a4583a' };
const CANOPY = { material: 'pbr_moss', tint: '#34502c' };
const PLANK = { material: 'pbr_weathered_planks' };
const CONCRETE = { material: 'pbr_bunker_panels' };
const STEEL = { material: 'pbr_steel', tint: '#8a9098' };

let seed = 0x5eed1;
const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;

/** A giant redwood: two crossed bark boxes (an octagon in plan), four root flares on the diagonals and a canopy high up. */
function giantTree(cx: number, cz: number, w = 6, tall = 46): void {
  const g = ground(cx, cz) - 1.5;
  const turn = r2(rand() * 0.3);
  // Blocks stand at most 32 m tall: each trunk box is stacked in two.
  const lower = 24;
  block([cx, g, cz], [w, lower, w], { ...BARK, yaw: turn });
  block([cx, g + lower, cz], [w * 0.97, tall - lower, w * 0.97], { ...BARK, yaw: turn });
  block([cx, g, cz], [w * 0.92, lower, w * 0.92], { ...BARK, yaw: r2(turn + Math.PI / 4) });
  block([cx, g + lower, cz], [w * 0.88, tall - 2 - lower, w * 0.88], { ...BARK, yaw: r2(turn + Math.PI / 4) });
  for (let k = 0; k < 4; k++) {
    const yaw = Math.PI / 4 + k * P + turn;
    const d = w / 2 + 1.6;
    block([cx + Math.sin(yaw) * d, ground(cx, cz) - 0.6, cz + Math.cos(yaw) * d], [w * 0.36, 2, 5], { ...BARK, yaw: r2(yaw), pitch: -0.42 });
  }
  const top = g + tall;
  block([cx, top - 9, cz], [w * 3, 5, w * 3], { ...CANOPY, yaw: r2(turn + 0.3) });
  block([cx + w * 0.6, top - 4, cz - w * 0.4], [w * 2.4, 5, w * 2.2], { ...CANOPY, yaw: r2(turn + 1.1) });
  block([cx - w * 0.3, top, cz + w * 0.3], [w * 1.8, 4, w * 1.8], { ...CANOPY, yaw: r2(turn + 0.7) });
}

/** Plank platform ringing a trunk at height H (top surface): a square `half` m out, rails on the corners (gaps mid-side for bridges, lifts and vines). */
function platform(cx: number, cz: number, H: number, half: number, hole = 3.15, rails = true): void {
  const y = H - 0.4;
  const wid = half - hole;
  box(cx - half, y, cz + hole, cx + half, H, cz + half, PLANK);
  box(cx - half, y, cz - half, cx + half, H, cz - hole, PLANK);
  box(cx + hole, y, cz - hole, cx + half, H, cz + hole, PLANK);
  box(cx - half, y, cz - hole, cx - hole, H, cz + hole, PLANK);
  // Joists under the deck, for looks.
  for (const s of [-1, 1]) box(cx + s * (hole + wid / 2) - 0.2, y - 0.5, cz - half, cx + s * (hole + wid / 2) + 0.2, y, cz + half, { material: 'pbr_walnut' });
  if (!rails) return;
  const gap = 2.6;
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      // North/south edges, then east/west edges.
      box(cx + t * gap, H, cz + s * half - 0.1, cx + t * half, H + 1.1, cz + s * half + 0.1, PLANK);
      box(cx + s * half - 0.1, H, cz + t * gap, cx + s * half + 0.1, H + 1.1, cz + t * half, PLANK);
    }
  }
}

/** A sagging rope bridge of planks between two deck points (surface heights), with rope rails; `rotten` plank indices crumble. */
function bridge(a: V3, b: V3, width = 3, sag = 0.7, rotten: number[] = []): void {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const L = Math.hypot(dx, dz);
  const n = Math.max(2, Math.round(L / 1.5));
  const yaw = r2(Math.atan2(dx, dz));
  const step = L / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const y = a[1] + (b[1] - a[1]) * t - 4 * sag * t * (1 - t);
    const slope = (b[1] - a[1]) / L - (4 * sag * (1 - 2 * t)) / L;
    const pitch = r2(Math.atan(slope));
    const x = a[0] + dx * t;
    const z = a[2] + dz * t;
    const bad = rotten.includes(i);
    m.block([r2(x), r2(y - 0.2), r2(z)], [width, 0.2, r2(step + 0.05)], bad ? 'crumble' : 'solid', { ...PLANK, ...(bad ? { tint: '#8a7a68' } : {}), yaw, ...(pitch ? { pitch } : {}), delay: 0.6, respawn: bad ? 10 : null });
    // Rope rails at hand height on both sides.
    for (const s of [-1, 1]) {
      const ox = Math.cos(yaw) * s * (width / 2 - 0.1);
      const oz = -Math.sin(yaw) * s * (width / 2 - 0.1);
      block([x + ox, y + 0.95, z + oz], [0.2, 0.1, r2(step + 0.05)], { material: 'pbr_burlap', tint: '#8a7050', yaw, ...(pitch ? { pitch } : {}) });
    }
  }
  m.prop('jg_bridge_post', [r2(a[0] + dx / L * 0.4), r2(a[1]), r2(a[2] + dz / L * 0.4)], yaw, 1, false);
  m.prop('jg_bridge_post', [r2(b[0] - dx / L * 0.4), r2(b[1]), r2(b[2] - dz / L * 0.4)], r2(yaw + S), 1, false);
}

/** A rope lift: a plank cab riding from the ground to `top`, between two posts. */
function lift(id: string, x: number, z: number, top: number, along: 'x' | 'z'): void {
  const g = ground(x, z);
  block([x, g - 0.3, z], [3, 0.3, 3], { ...PLANK, id: `${id}_cab` });
  m.mover(id, [r2(x), r2(g - 0.3), r2(z)], [`${id}_cab`], [[0, 0, 0], [0, r2(top - g), 0]], { speed: 2.6, wait: 3, name: 'Rope lift' });
  // Posts either side of the shaft (square to the platform edge) and a pulley beam over the top.
  for (const s of [-1, 1]) {
    const px = along === 'x' ? x + s * 1.85 : x;
    const pz = along === 'z' ? z + s * 1.85 : z;
    block([px, g - 0.2, pz], [0.35, top - g + 3.6, 0.35], { material: 'pbr_walnut' });
  }
  block([x, top + 3.2, z], along === 'x' ? [4.1, 0.35, 0.35] : [0.35, 0.35, 4.1], { material: 'pbr_walnut' });
}

/** Climbing vines up a hanging plank board to a deck at `top`, facing `yaw` (outward). */
function vines(id: string, x: number, z: number, top: number, yaw: number): void {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const g = ground(x + fx * 0.3, z + fz * 0.3);
  block([x - fx * 0.1, g - 0.1, z - fz * 0.1], [Math.abs(fz) > 0.5 ? 1.5 : 0.2, top - g + 0.1, Math.abs(fz) > 0.5 ? 0.2 : 1.5], PLANK);
  m.add({ kind: 'ladder', id, position: [r2(x + fx * 0.1), r2(g), r2(z + fz * 0.1)], yaw: r2(yaw), height: r2(top - g), width: 1.2, style: 'vines' });
}

// ---------------------------------------------------------------- the treetop village

const ROW_S = 64;
const ROW_N = 96;
const H_S = 10;
const H_N = 14;
const HALF = 8;
const HALF_NC = 9.5;
const XS = [-32, 0, 32];
for (const x of XS) {
  giantTree(x, ROW_S);
  giantTree(x, ROW_N, 6.4, 48);
  platform(x, ROW_S, H_S, HALF);
  // The north-centre platform is wider: the lookout ladder stands on it.
  platform(x, ROW_N, H_N, x === 0 ? HALF_NC : HALF);
}
// The lookout, 24 m up the north-centre tree: a smaller ring and a ladder up from its platform.
const LOOK = 24;
const LH = 6.6;
platform(0, ROW_N, LOOK, LH, 3.45, false);
for (const [x0, z0, x1, z1] of [[-LH, -LH, LH, -LH + 0.2], [-LH, LH - 0.2, LH, LH], [-LH, -LH + 0.2, -LH + 0.2, LH - 0.2]] as const) box(x0, LOOK, ROW_N + z0, x1, LOOK + 1.1, ROW_N + z1, PLANK);
box(LH - 0.2, LOOK, ROW_N - LH + 0.2, LH, LOOK + 1.1, ROW_N + 1.6, PLANK);
box(LH, H_N, ROW_N + 2.4, LH + 0.2, LOOK, ROW_N + 3.6, PLANK);
m.add({ kind: 'ladder', id: 'ladder_lookout', position: [LH + 0.25, H_N, ROW_N + 3], yaw: P, height: LOOK - H_N, width: 1.0, style: 'vines' });

// Bridges: along each row, and between the rows (the north row is 4 m higher).
const E = HALF - 0.5;
for (const z of [ROW_S, ROW_N]) {
  const H = z === ROW_S ? H_S : H_N;
  bridge([-32 + E, H, z], [0 - E, H, z], 3, 0.7, z === ROW_S ? [5, 6] : []);
  bridge([0 + E, H, z], [32 - E, H, z]);
}
for (const x of XS) bridge([x, H_S, ROW_S + E], [x, H_N, ROW_N - E], 3, 0.6);

// Ways up: lifts on the outer sides of the corner trees and the north-centre tree, vines on the others.
lift('mover_lift_sw', -32, ROW_S - HALF - 1.6, H_S, 'x');
lift('mover_lift_se', 32, ROW_S - HALF - 1.6, H_S, 'x');
lift('mover_lift_n', 0, ROW_N + HALF_NC + 1.6, H_N, 'x');
vines('vines_s', 0, ROW_S - HALF - 0.2, H_S, S);
vines('vines_nw', -32, ROW_N + HALF + 0.2, H_N, 0);
vines('vines_ne', 32, ROW_N + HALF + 0.2, H_N, 0);
// Extra vines on the outer flanks of the corner trees (west and east sides).
vines('vines_w', -32 - HALF - 0.2, ROW_S, H_S, -P);
vines('vines_e', 32 + HALF + 0.2, ROW_S, H_S, P);

// Village dressing: lanterns on every platform, the Rebel camp below.
for (const x of XS) {
  for (const [z, H] of [[ROW_S, H_S], [ROW_N, H_N]] as const) {
    m.prop('lantern', [x + 5.6, H, z + 5.6], 0, 1.4, false);
    m.light([x + 5.6, H + 1.4, z + 5.6], { fixture: 'none', color: '#ffb468', intensity: 1.1, range: 11 });
    m.prop('crate_small', [x - 5.8, H, z - 5.8], rand() * 3);
  }
}
m.light([0, LOOK + 2, ROW_N - 5], { fixture: 'none', color: '#ffb468', intensity: 0.9, range: 9 });
m.prop('sv_tent', G(-16, 50), 0.3).prop('sv_tent', G(16, 50), -0.3).prop('sv_tent', G(-46, 86), 1.4).prop('sv_tent', G(46, 86), -1.4);
m.prop('campfire', G(0, 80), 0).prop('sv_radio', G(3, 78), 2.4).prop('sv_backpack', G(-2.4, 78.5), 1).prop('crate_large', G(-16, 80), 0.4).prop('crate_small', G(-14, 82), 1.2);
m.prop('crate_large', G(16, 80), -0.3).prop('dynamite_crate', G(18, 78.6), 0.2).prop('sv_torch_stand', G(-8, 43), 0).prop('sv_torch_stand', G(8, 43), 0);
m.light(G(0, 80, 1.2), { fixture: 'none', color: '#ff9a40', intensity: 1.4, range: 12 });
for (const x of [-8, 8]) m.light(G(x, 43, 2.1), { fixture: 'none', color: '#ff9a40', intensity: 1, range: 9 });

// ---------------------------------------------------------------- the bunker (x -14..14, z -90..-70)

const BW = 6; // wall height
const RT = 6.6; // roof top
// North wall with the blast doorway (3.2 m) in the middle.
box(-14, 0, -70.8, -1.6, BW, -70, CONCRETE);
box(1.6, 0, -70.8, 14, BW, -70, CONCRETE);
box(-1.6, 3.2, -70.8, 1.6, BW, -70, CONCRETE);
// South wall with the rear door (Garrison only).
box(-14, 0, -90, -6.6, BW, -89.2, CONCRETE);
box(-3.4, 0, -90, 14, BW, -89.2, CONCRETE);
box(-6.6, 3.2, -90, -3.4, BW, -89.2, CONCRETE);
// Side walls.
box(-14, 0, -89.2, -13.2, BW, -70.8, CONCRETE);
box(13.2, 0, -89.2, 14, BW, -70.8, CONCRETE);
// Partition between the generator hall (west) and the control room (east), a doorway in the middle.
box(4, 0, -89.2, 4.6, BW, -81.6, CONCRETE);
box(4, 0, -78.4, 4.6, BW, -70.8, CONCRETE);
box(4, 3.2, -81.6, 4.6, BW, -78.4, CONCRETE);
// Roof, with the maintenance hatch (x 10.4..13.2, z -83..-76) over the ramp.
box(-14.4, BW, -90.4, 10.4, RT, -69.6, { material: 'pbr_concrete_dark' });
box(10.4, BW, -90.4, 14.4, RT, -83, { material: 'pbr_concrete_dark' });
box(10.4, BW, -76, 14.4, RT, -69.6, { material: 'pbr_concrete_dark' });
box(13.2, BW, -83, 14.4, RT, -76, { material: 'pbr_concrete_dark' });
// Parapet round the roof (open over the ladder and the hatch end).
box(-14.4, RT, -69.8, 8, RT + 0.9, -69.6, CONCRETE);
box(-14.4, RT, -90.4, 14.4, RT + 0.9, -90.2, CONCRETE);
box(-14.4, RT, -90.2, -14.2, RT + 0.9, -69.8, CONCRETE);
// The ramp down through the hatch: from the floor at z -89 to the roof at z -76.
{
  const run = 13;
  const rise = RT + 0.15;
  const len = Math.hypot(run, rise);
  block([11.8, r2(rise / 2 - 0.3 - 0.15), -82.5], [2.8, 0.3, r2(len)], { material: 'pbr_tread_plate', pitch: r2(Math.atan(rise / run)) });
}
// Floor plates inside.
box(-13.2, -0.15, -89.2, 13.2, -0.02, -70.8, { material: 'pbr_tread_plate', tint: '#9a9a9a' });
// The ladder up the east wall onto the roof.
m.add({ kind: 'ladder', id: 'ladder_bunker', position: [14.1, -0.15, -87], yaw: P, height: RT + 0.15, width: 1.0 });
// Doors: the blast door (locked: the stolen code opens it), the Garrison's rear door.
m.add({ kind: 'door', id: 'door_blast', name: 'Bunker blast door', position: [0, -0.02, -70.4], yaw: 0, startOpen: false, locked: true, auto: false, style: 'blast' });
m.add({ kind: 'door', id: 'door_rear', name: 'Bunker rear door', position: [-5, -0.02, -89.6], yaw: 0, startOpen: false, locked: false, auto: true, team: GARRISON });
m.add({ kind: 'button', id: 'btn_seal', name: 'Seal console', position: [3, -0.02, -71.2], yaw: S, label: 'Seal the blast door', once: false, cooldownSeconds: 3, startEnabled: true, team: GARRISON });
// Alarm lights over the blast door, outside and in.
m.light([-2.4, 4.6, -69.6], { id: 'alarm_out_w', fixture: 'bulb', color: '#ff3020', intensity: 1.6, range: 12, off: true, blink: 2.5 });
m.light([2.4, 4.6, -69.6], { id: 'alarm_out_e', fixture: 'bulb', color: '#ff3020', intensity: 1.6, range: 12, off: true, blink: 2.5 });
m.light([0, 5.2, -72], { id: 'alarm_in', fixture: 'bulb', color: '#ff3020', intensity: 1.4, range: 14, off: true, blink: 2.5 });
// Generator hall (bomb site A): the shield generator, power units and consoles.
m.prop('os_reactor_core', [-5, -0.02, -85.6], 0).prop('os_power_unit', [-10.8, -0.02, -86.8], P).prop('os_power_unit', [0.8, -0.02, -86.8], -P);
m.prop('os_coolant_pipe', [-12.4, -0.02, -80], P).prop('os_console_corner', [-12.2, -0.02, -72], P).prop('computer_bank', [-12.6, -0.02, -76], P);
m.prop('os_canister_rack', [2.6, -0.02, -74.6], -P).prop('metal_crate', [-9, -0.02, -72.2], 0.2);
m.add({ kind: 'bombsite', position: [-4, -0.02, -78.5], label: 'A', radius: 5 });
// Control room: consoles and the holo table.
m.prop('holo_table', [7.4, -0.02, -74], 0).prop('computer_bank', [5.4, -0.02, -86.6], P).prop('os_terminal', [8, -0.02, -88.4], 0).prop('sf_computer', [5.4, -0.02, -72], P);
for (const [x, z] of [[-9, -84], [-9, -75], [-1, -84], [-1, -75], [7.6, -86], [7.6, -76]] as const) m.light([x, BW - 0.5, z], { fixture: 'ceiling', color: '#e8f0ff', intensity: 0.9, range: 9 });
// Outside: sandbag nests with mounted guns covering the approach, barriers, floodlights.
for (const x of [-10, 10]) {
  m.prop('sandbag_nest', [x, ground(x, -63.5), -63.5], 0);
  m.add({ kind: 'mount', model: 'turret_mg', position: [x, ground(x, -64), -64], yaw: 0, faction: GARRISON, respawnSeconds: null });
}
m.add({ kind: 'mount', model: 'turret_rocket', position: [-10, RT, -73], yaw: 0, faction: GARRISON, respawnSeconds: null });
m.prop('jersey_barrier', G(-4, -60), 0).prop('jersey_barrier_striped', G(4, -58), 0.2).prop('hedgehog', G(-18, -56), 0.4).prop('hedgehog', G(20, -54), 1.1);
m.prop('floodlight', G(-16, -68), S).prop('floodlight', G(16, -68), S);
m.light(G(-16, -67, 5.2), { fixture: 'none', color: '#f0f4ff', intensity: 1.2, range: 16 });
m.light(G(16, -67, 5.2), { fixture: 'none', color: '#f0f4ff', intensity: 1.2, range: 16 });
m.prop('ammo_stack', G(-18, -92), 0.3).prop('fuel_drum', G(-16, -94), 0).prop('fuel_drum', G(-15, -95.2), 0).prop('supply_truck', G(-4, -102), P);

// ---------------------------------------------------------------- the landing pad and the dish antenna

m.tile('military.helipad', 3, -11, 0); // x 20..36, z -92..-76
m.add({ kind: 'mount', model: 'dropship', position: [28, 0.15, -81], yaw: S, faction: GARRISON, respawnSeconds: null, skin: 'urban' });
m.add({ kind: 'mount', model: 'gunship', position: [44, ground(44, -64), -64], yaw: S, faction: GARRISON, respawnSeconds: null, skin: 'urban' });
m.prop('fuel_tank', G(40, -92), 0).prop('ammo_crate', G(38, -78), 0.4).prop('shipping_container_green', G(44, -84), P);
m.light([28, 4, -84], { fixture: 'none', color: '#9affb0', intensity: 0.8, range: 14 });

// The dish antenna (site B): a 30 m steel lattice tower west of the bunker, a bowl dish on top.
const AX = -36;
const AZ = -80;
const TH = 30;
const L2 = 2.6;
{
  const g = ground(AX, AZ);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) block([AX + sx * L2, g - 0.3, AZ + sz * L2], [0.6, TH + 0.3, 0.6], STEEL);
  // Ring beams and X-braces on every face, three bays.
  for (const y of [8, 16, 24, TH - 0.4]) {
    for (const s of [-1, 1]) {
      block([AX, y, AZ + s * L2], [2 * L2, 0.35, 0.35], STEEL);
      block([AX + s * L2, y, AZ], [0.35, 0.35, 2 * L2], STEEL);
    }
  }
  const bay = 8;
  const brace = Math.hypot(2 * L2, bay);
  const ang = r2(Math.atan(bay / (2 * L2)) - 0.0);
  for (const y0 of [0, 8, 16]) {
    for (const s of [-1, 1]) {
      for (const d of [-1, 1]) {
        // On the north/south faces (running along x) and the east/west faces (along z): tilted up to 45° and no further.
        const tilt = Math.min(0.78, ang);
        block([AX, y0 + bay / 2 - 0.15, AZ + s * L2], [r2(brace * 0.62), 0.25, 0.25], { ...STEEL, roll: r2(d * tilt) });
        block([AX + s * L2, y0 + bay / 2 - 0.15, AZ], [0.25, 0.25, r2(brace * 0.62)], { ...STEEL, pitch: r2(d * tilt) });
      }
    }
  }
  // Deck and the bowl: a hub plate and eight petals rising outwards, a feed mast in the middle.
  box(AX - 3.4, TH, AZ - 3.4, AX + 3.4, TH + 0.3, AZ + 3.4, { material: 'pbr_tread_plate' });
  block([AX, TH + 1.2, AZ], [1.2, 1.2, 1.2], STEEL);
  block([AX, TH + 2.4, AZ], [4.2, 0.25, 4.2], { material: 'pbr_white_panel' });
  for (let k = 0; k < 8; k++) {
    const yaw = k * (Math.PI / 4);
    const d = 3.6;
    block([AX + Math.sin(yaw) * d, TH + 2.9, AZ + Math.cos(yaw) * d], [3.3, 0.22, 3.6], { material: 'pbr_white_panel', yaw: r2(yaw), pitch: 0.55 });
  }
  block([AX, TH + 2.6, AZ], [0.3, 4.5, 0.3], STEEL);
  block([AX, TH + 7.1, AZ], [0.9, 0.9, 0.9], STEEL);
  m.light([AX, TH + 8.4, AZ], { fixture: 'bulb', color: '#ff2a18', intensity: 1.5, range: 14, blink: 1.2 });
  // Equipment round the foot (the bomb site is between the legs), low concrete walls for cover.
  m.prop('os_transmitter', G(AX - 5.6, AZ + 1), P).prop('os_generator', G(AX + 6.2, AZ - 2), 0).prop('os_satellite_dish', G(AX - 7, AZ - 6), 0.6).prop('os_comms_dish', G(AX + 6, AZ + 6), 2.4);
  for (const [x0, z0, x1, z1] of [[-9, 6.5, -3, 7.2], [3, 6.5, 9, 7.2], [-9, -7.2, -3, -6.5], [3, -7.2, 9, -6.5]] as const) box(AX + x0, g - 0.2, AZ + z0, AX + x1, g + 1.1, AZ + z1, CONCRETE);
  m.add({ kind: 'bombsite', position: [AX, ground(AX, AZ), AZ], label: 'B', radius: 5 });
  m.add({ kind: 'mount', model: 'sentry', position: G(AX + 8.5, AZ + 3), yaw: 0, faction: GARRISON, respawnSeconds: null });
  m.light(G(AX, AZ, 3), { fixture: 'none', color: '#d8e4ff', intensity: 1, range: 12 });
}

// ---------------------------------------------------------------- the scout outpost (the stolen code)

m.tile('military.pillbox', 9, 0, 0); // x 68..76, z -4..4, door south
m.tile('military.guard_tower', 8, 1, 0); // x 60..68, z 4..12
m.edge(9, 0, 0, 'S', 'door');
m.add({ kind: 'button', id: 'btn_code', name: 'Outpost console', position: [72, 0, 3.3], yaw: S, label: 'Upload the stolen code', once: false, cooldownSeconds: 5, startEnabled: true, team: REBELS });
m.prop('computer', [69.6, 0, 3.4], S).prop('os_terminal', [74.6, 0, 3.2], S);
m.light([72, 3.4, 0], { fixture: 'ceiling', color: '#fff1d6', intensity: 0.9, range: 8 });
m.add({ kind: 'mount', model: 'turret_mg', position: [65.4, 3, 10.2], yaw: S, faction: null, respawnSeconds: null });
m.prop('sandbag_wall', G(66, -8), 0).prop('sandbag_corner', G(78, -7), 0.6).prop('camo_net', G(80, 8), 0.3).prop('ammo_crate', G(79, 6), 1);
m.light(G(68, -8, 2), { fixture: 'none', color: '#ffb468', intensity: 0.9, range: 9 });

// ---------------------------------------------------------------- the forest

// The mid clearing: a fallen giant across it, stones and ferns.
block([-71, ground(-71, 4) - 1.4, 4], [4.4, 4.4, 26], { ...BARK, yaw: 0.25, pitch: 0.04 });
m.prop('nt_boulder_moss', G(-52, -8), 0.4, 1.6).prop('nt_rock_moss', G(-54, 10), 1.2, 1.4).prop('jg_giant_root', G(-49, 12), 2.2, 1.6);

// Giant trees through the forest, kept off the trails and the bases.
const KEEP: [number, number, number][] = [
  [0, 80, 46], [0, -80, 40], [70, 2, 18], [-60, 0, 16], [28, -84, 14], [AX, AZ, 12],
];
const GIANTS: P2[] = [
  [-96, 40], [-92, -18], [-100, -64], [-34, 22], [-24, -20], [26, 16], [24, -28], [48, 44], [96, 32], [100, -42], [-74, 60], [74, 66], [-82, -96], [84, -94],
  [-108, 98], [108, 100], [-52, -46], [52, -50], [-14, 34], [36, -6], [-80, 20], [90, -10],
];
const giants: P2[] = [];
for (const [x, z] of GIANTS) {
  if (trailDist(x, z) < 11 || KEEP.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr + 6)) continue;
  giants.push([x, z]);
  giantTree(x, z, 5 + rand() * 2, 42 + rand() * 8);
}

// Smaller trees, ferns, logs and boulders scattered through the woods.
const busy = (x: number, z: number, r: number) =>
  trailDist(x, z) < 3.5 + r ||
  KEEP.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr + r) ||
  giants.some(([gx, gz]) => Math.hypot(x - gx, z - gz) < 9 + r) ||
  Math.abs(x) > 118 || Math.abs(z) > 118;
const placed: [number, number, number][] = [];
const free = (x: number, z: number, r: number) => placed.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) > pr + r + 1);
const TREES = ['nt_pine_tall', 'nt_pine_tall', 'nt_common_tree', 'pine_tall', 'nt_pine_small'];
for (let n = 0; n < 1500 && placed.length < 130; n++) {
  const x = (rand() - 0.5) * 236;
  const z = (rand() - 0.5) * 236;
  if (busy(x, z, 2) || !free(x, z, 2)) continue;
  placed.push([x, z, 2]);
  const model = TREES[Math.floor(rand() * TREES.length)]!;
  m.prop(model, G(x, z, -0.1), r2(rand() * 6.28), r2(1.4 + rand() * 0.8));
}
for (let n = 0; n < 1200 && placed.length < 250; n++) {
  const x = (rand() - 0.5) * 236;
  const z = (rand() - 0.5) * 236;
  if (busy(x, z, 0.6) || !free(x, z, 0.6)) continue;
  placed.push([x, z, 0.6]);
  const pick = rand();
  if (pick < 0.45) m.prop(pick < 0.25 ? 'jg_giant_fern' : 'nt_fern_wide', G(x, z), r2(rand() * 6.28), r2(1 + rand() * 0.6), false);
  else if (pick < 0.62) m.prop('nt_log_moss', G(x, z, -0.1), r2(rand() * 6.28), r2(1.2 + rand() * 0.5));
  else if (pick < 0.78) m.prop('nt_boulder_moss', G(x, z, -0.3), r2(rand() * 6.28), r2(1 + rand() * 0.8));
  else if (pick < 0.9) m.prop('nt_stump_moss', G(x, z, -0.05), r2(rand() * 6.28), r2(1.2 + rand() * 0.6));
  else m.prop('nt_bush_leafy', G(x, z), r2(rand() * 6.28), r2(1 + rand() * 0.4), false);
}
// Lanterns on posts along the trails.
/** A point beside trail `i`, segment `k`, `t` of the way along, `side` (±1) metres off its line ×3.8. */
const beside = (i: number, k: number, t: number, side: 1 | -1): P2 => {
  const [ax, az] = TRAILS[i]![k]!;
  const [bx, bz] = TRAILS[i]![k + 1]!;
  const L = Math.hypot(bx - ax, bz - az);
  return [r2(ax + (bx - ax) * t + ((bz - az) / L) * side * 3.8), r2(az + (bz - az) * t - ((bx - ax) / L) * side * 3.8)];
};
for (const [x, z] of [beside(0, 1, 0.6, 1), beside(1, 1, 0.5, -1), beside(0, 3, 0.4, 1), beside(1, 3, 0.3, -1), beside(2, 3, 0.4, 1), beside(2, 1, 0.2, -1)]) {
  m.prop('lantern_post', G(x, z), 0);
  m.light(G(x, z, 2.6), { fixture: 'none', color: '#ffb060', intensity: 0.9, range: 9 });
}

// ---------------------------------------------------------------- trail hazards

/** A swinging log: a log on a pendulum mover sweeping across the trail along `dir` (radians), under a beam between two posts. */
function swingLog(id: string, x: number, z: number, dir: number): void {
  const g = ground(x, z);
  const R = 6;
  const pivotY = g + 7.6;
  const ux = Math.sin(dir);
  const uz = Math.cos(dir);
  const pts: V3[] = [];
  const th0 = -0.95;
  const p0 = [R * Math.sin(th0), -R * Math.cos(th0)] as const;
  for (let k = 0; k <= 10; k++) {
    const th = th0 + (k / 10) * (2 * -th0);
    const s = R * Math.sin(th) - p0[0];
    const h = -R * Math.cos(th) - p0[1];
    pts.push([r2(ux * s), r2(h), r2(uz * s)]);
  }
  const lx = x + ux * p0[0];
  const lz = z + uz * p0[0];
  const ly = pivotY + p0[1] - 0.55;
  block([lx, ly, lz], [1.1, 1.1, 5.2], { ...BARK, yaw: r2(dir), id: `${id}_log` });
  m.mover(id, [r2(lx), r2(ly), r2(lz)], [`${id}_log`], pts, { mode: 'pingpong', speed: 7, wait: 0, name: 'Swinging log' });
  // The beam it hangs from, on posts well clear of its swing.
  for (const s of [-1, 1]) block([x + ux * s * 8.6, g - 0.3, z + uz * s * 8.6], [0.6, 8.6, 0.6], { material: 'pbr_walnut', yaw: r2(dir) });
  block([x, pivotY, z], [0.5, 0.5, 17.8], { material: 'pbr_walnut', yaw: r2(dir) });
}
swingLog('mover_log_w', -44, 25.2, -0.675);
swingLog('mover_log_e', 62.5, -26.5, -0.885);

const trap = (id: string, x: number, z: number, activation: 'proximity' | 'logic') =>
  m.add({ kind: 'trap', id, trap: 'crusher', position: G(x, z), yaw: 0, activation, onSeconds: 1.2, offSeconds: 9, offsetSeconds: 0, startEnabled: true, damage: null, style: 'rockfall' });
trap('rockfall_w', -36, -40, 'logic');
trap('rockfall_c', 1, 17, 'proximity');
trap('rockfall_e', 72.4, -14.4, 'proximity');
m.add({ kind: 'zone', id: 'zone_rockfall', name: 'West trail', position: G(-44, -33), size: [6, 3, 6], who: 'any', count: 1, startEnabled: true });

// ---------------------------------------------------------------- vehicles

const bike = (x: number, z: number, yaw: number) => m.add({ kind: 'mount', model: 'hover_bike', position: G(x, z), yaw, faction: null, respawnSeconds: null, skin: 'forest' });
for (const x of [-13, -9, 9, 13]) bike(x, 40, S);
for (const x of [-22, -18, 18, 22]) bike(x, -54, 0);
bike(58, -2, -P);
bike(-64, -14, 0.4);

// ---------------------------------------------------------------- logic

type Action = ScenarioLogic['rules'][number]['do'][number];
type Condition = ScenarioLogic['rules'][number]['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: string, target: string | null, does: Action[], ifs: Condition[] = []) => ({ id, name, enabled: true, once: false, when: { event, target }, if: ifs, do: does }) as ScenarioLogic['rules'][number];
const ALARMS = ['alarm_out_w', 'alarm_out_e', 'alarm_in'];
m.logic({
  variables: [],
  timers: [],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome', 'match_start', null, [act('message', null, { value: 5, text: 'Fernwood Moon. The bunker door answers only to the outpost code.' })]),
    rule('rule_code', 'The stolen code opens the blast door', 'button_pressed', 'btn_code', [
      act('door_unlock', 'door_blast'),
      act('door_open', 'door_blast'),
      ...ALARMS.map((id) => act('light_on', id)),
      act('sound', null, { state: 'alarm' }),
      act('message', null, { value: 4, text: 'Code accepted: the bunker blast door is open!' }),
    ], [cond('door', 'door_blast', '==', 0, 'closed')]),
    rule('rule_seal', 'The Garrison seals the blast door', 'button_pressed', 'btn_seal', [
      act('door_close', 'door_blast'),
      act('door_lock', 'door_blast'),
      ...ALARMS.map((id) => act('light_off', id)),
      act('sound', null, { state: 'buzzer' }),
      act('message', null, { value: 3, text: 'Blast door sealed.' }),
    ], [cond('door', 'door_blast', '==', 0, 'open')]),
    rule('rule_rockfall', 'Rocks come down on the west trail', 'zone_enter', 'zone_rockfall', [act('wait', null, { value: 1 }), act('trap_fire', 'rockfall_w'), act('sound', null, { state: 'boom' })]),
  ],
});

// ---------------------------------------------------------------- spawns, pickups, objectives

// Rebels: the camp under the south row and up on its platforms.
for (const x of [-44, -20, -6, 6, 20, 44]) m.spawn(G(x, 46), 0, REBELS);
for (const x of [-46, -16, 16, 46]) m.spawn(G(x, 80), S, REBELS);
for (const x of XS) m.spawn([x - 5, H_S, ROW_S + 5.6], S, REBELS);
m.spawn([-5, H_N, ROW_N - 5.6], S, REBELS);
// Garrison: round the bunker, the pad and inside.
for (const [x, z] of [[-24, -96], [-10, -98], [6, -98], [20, -100], [-24, -64], [-20, -72], [40, -72], [42, -98], [-10, -84], [-10, -74], [7.6, -81], [-48, -92]] as const) m.spawn(G(x, z), 0, GARRISON);
// Free-for-all: through the forest.
for (const [x, z, yaw] of [[-60, -10, 0], [82, -14, 0], [0, 0, P], [-30, -36, 0], [34, 30, S], [-34, 36, S], [90, 60, S], [-90, -40, 0]] as const) m.spawn(G(x, z), yaw, null);

// Pickups: power weapons up high and in the middle, the basics at home.
m.pickup('weapon_sniper', [0, LOOK, ROW_N - 5], 30).pickup('weapon_rockets', G(-60, -6), 40).pickup('weapon_railgun', G(-66, -12), 45);
m.pickup('weapon_rifle', [-32, H_S, ROW_S - 5.6]).pickup('weapon_smg', [32, H_S, ROW_S - 5.6]).pickup('weapon_shotgun', [32, H_N, ROW_N + 5.6]).pickup('weapon_marksman', [-32, H_N, ROW_N + 5.6], 30);
m.pickup('weapon_lmg', [6.5, -0.02, -77.5], 30).pickup('weapon_shotgun', [-8, -0.02, -80]).pickup('weapon_rifle', G(-22, -84)).pickup('weapon_smg', G(14, -60));
m.pickup('weapon_launcher', [72, 0, -1.5], 40).pickup('weapon_plasma', G(0, -8), 30).pickup('dynamite', G(18, 80), 30).pickup('dynamite', G(-60, 8), 30);
m.pickup('grenades', G(-24, 46)).pickup('grenades', G(24, -62)).pickup('mines', G(-6, -94)).pickup('armor_large', [0, H_N, ROW_N + 5.6], 40).pickup('armor_small', G(-48, 14)).pickup('armor_small', G(56, -32));
m.pickup('health_large', G(0, 88)).pickup('health_large', [8, -0.02, -84]).pickup('health_small', G(-30, 0)).pickup('health_small', G(40, 10)).pickup('health_small', G(-20, -40)).pickup('health_small', G(-4, 30));
m.pickup('ammo', G(-8, 48)).pickup('ammo', G(10, -60)).pickup('ammo', G(70, -6)).pickup('ammo_sniper', [-4.5, LOOK, ROW_N - 5]).pickup('glider', [4.5, LOOK, ROW_N - 5], 30);

// King of the Hill: the mid clearing, the village's south-centre platform, the bunker roof.
m.hill(G(-62, -6), 6);
m.hill([0, H_S, ROW_S - 5.4], 4);
m.hill([-5, RT, -80], 5);
// Capture the Flag: under the village bridges, on the landing pad.
m.flag(REBELS, G(-16, 74), S);
m.flag(GARRISON, [31, 0.15, -89], 0);

await m.fillTeamSpawns(16);
m.bounds('invisible', 4, { min: [-124, -124], max: [124, 124] });
m.border('forest');
m.meta({
  description:
    'A redwood forest on a forest moon at dusk. The Rebels hold a treetop village: plank platforms ringing six giant trunks, sagging rope bridges, rope lifts, climbing vines and a lookout 24 m up. The Garrison hold a shield bunker in a clearing, with a landing pad and a 30 m dish antenna. Upload the stolen code at the forest outpost to open the bunker blast door, or take the long way over the roof and down the maintenance hatch. Hover bikes race the winding trails between the trunks, past swinging logs and rockfalls. Bomb: blow the generator hall (A) or the antenna (B).',
  modes: ['core.bomb', 'core.tdm', 'core.ctf', 'core.koth', 'core.deathmatch'],
  players: [12, 32],
});
await m.save();
