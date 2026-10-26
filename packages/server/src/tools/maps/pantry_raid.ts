/**
 * Pantry Raid: two teams of toy soldiers fight across a giant kitchen
 * (docs/MAP_IDEAS.md, Party, #31). You are action figures, about a tenth of
 * life size: the kitchen is 96 × 64 m, the table top is 8 m up, the counter
 * run 12 m up and the fridge 24 m tall.
 *
 * Everything big is built from free blocks (props stop at 4×, far short of
 * toy scale), so the furniture is real geometry you climb, hide in and swim
 * through:
 *
 *   - The counter run along the north wall (12 m): a washing-machine front, a
 *     cupboard whose sliding door creeps back and forth over a ramp and a
 *     ladder up through a hatch, the sink (a 4.6 m deep basin of grey dish
 *     water to swim across), a chopping board leaning on the front as a ramp,
 *     the oven and the corner with the cookie jar (the Counter team's flag).
 *   - The oven: its door is a drawbridge on a horizontal hinge. Turn the knob
 *     (a button by the oven, another inside) and it slams down into a ramp
 *     into the oven, where flame jets are the burners and a lava groove is
 *     the element; it swings shut again after 14 s. The flue ladder at the
 *     back climbs out onto the hob, right by the cookie jar.
 *   - The toaster, knocked onto the floor: walk up the slice of toast and
 *     step into a slot, and it pops you onto the counter.
 *   - The fridge freezer at the west end: a crawlspace under it (with a
 *     dropped box of CRUNCH-O'S), and a sniper perch on top (a pad from the
 *     counter, a ladder back down).
 *   - The kitchen table (8 m) on four legs: chairs with a ruler up to the
 *     seat and a cookbook from the seat to the top, plates, cups, a bowl of
 *     milk to wade, and the sugar bowl (the Table team's flag).
 *   - The floor: oak boards, toy blocks, a dog bowl, a fallen cereal box and
 *     toy microwaves that go off when shot.
 *
 * Modes: TDM, CTF (flags: the cookie jar and the sugar bowl) and DM, 6–12.
 *
 * World x east, z north; the kitchen floor is x 0..96, z 0..64 at y 0.
 */
import { MapBuilder } from '../mapkit.ts';

type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const PI = Math.PI;
const P = PI / 2;
const r2 = (n: number) => +n.toFixed(2);

const m = new MapBuilder('pantry_raid', 'Pantry Raid');
m.theme('suburban');
m.backdrop('clear', 'none', 'none', 0.2);
m.teams([6, 6]);
const [COUNTER, TABLE] = m.teamIds(2) as [string, string];

// ---------------------------------------------------------------- looks
const OAK: Look = { material: 'pbr_floorboards', tint: '#c89a62' };
const WALLPAPER: Look = { material: 'pbr_plaster', tint: '#efe2bd' };
const TILES: Look = { material: 'white_tiles', tint: '#e8f0f0' };
const SKIRT: Look = { material: 'paint_gloss', tint: '#f4f1ea' };
const CABINET: Look = { material: 'paint_gloss', tint: '#86a894' };
const CAB_DARK: Look = { material: 'paint_gloss', tint: '#6d8c7a' };
const WORKTOP: Look = { material: 'pbr_terrazzo', tint: '#d9d4cc' };
const STEEL: Look = { material: 'pbr_steel', tint: '#c8ccd0' };
const DARKSTEEL: Look = { material: 'pbr_steel', tint: '#4a4e54' };
const BLACK: Look = { material: 'paint_gloss', tint: '#1c1d20' };
const WHITE: Look = { material: 'paint_gloss', tint: '#f6f6f2' };
const GLASS: Look = { material: 'paint_gloss', tint: '#2a3a44' };
const WOOD: Look = { material: 'pbr_walnut', tint: '#a8794a' };
const PALEWOOD: Look = { material: 'oak_planks', tint: '#d8b27a' };
const CHOP: Look = { material: 'oak_planks', tint: '#d6ad74' };
const CERAMIC: Look = { material: 'paint_gloss', tint: '#f2efe6' };
const BLUE: Look = { material: 'paint_gloss', tint: '#3d6fb6' };
const RED: Look = { material: 'paint_gloss', tint: '#c8382e' };
const YELLOW: Look = { material: 'paint_gloss', tint: '#f0c232' };
const GREEN: Look = { material: 'paint_gloss', tint: '#4aa04a' };
const TOAST: Look = { material: 'paint_matte', tint: '#c98a42' };
const CRUST: Look = { material: 'paint_matte', tint: '#8a5222' };
const COOKIE: Look = { material: 'paint_matte', tint: '#b9864a' };
const JAR: Look = { material: 'paint_gloss', tint: '#cfe2e6' };

// ---------------------------------------------------------------- block helpers
/** A solid box from its min to max corner (split if a side is over the block limits). */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, look: Look, o: { id?: string; behaviour?: 'solid' | 'breakable'; health?: number; respawn?: number | null } = {}): void {
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  if (w <= 0.01 || h <= 0.01 || d <= 0.01) return;
  if (w > 64 || d > 64 || h > 32) {
    const nx = Math.ceil(w / 64);
    const nz = Math.ceil(d / 64);
    const ny = Math.ceil(h / 32);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++)
        for (let k = 0; k < ny; k++) box(x0 + (w * i) / nx, y0 + (h * k) / ny, z0 + (d * j) / nz, x0 + (w * (i + 1)) / nx, y0 + (h * (k + 1)) / ny, z0 + (d * (j + 1)) / nz, look);
    return;
  }
  m.block([r2((x0 + x1) / 2), r2(y0), r2((z0 + z1) / 2)], [r2(Math.max(0.2, w)), r2(Math.max(0.1, h)), r2(Math.max(0.2, d))], o.behaviour ?? 'solid', { ...look, ...(o.id ? { id: o.id } : {}), ...(o.health ? { health: o.health } : {}), ...(o.respawn !== undefined ? { respawn: o.respawn } : {}) });
}
/** A turned block centred at (cx, cz): `w` across its yaw, `d` along it. */
function turned(cx: number, cz: number, w: number, d: number, y0: number, y1: number, look: Look, yaw: number): void {
  m.block([r2(cx), r2(y0), r2(cz)], [r2(w), r2(y1 - y0), r2(d)], 'solid', { ...look, yaw: r2(yaw) });
}
/** A round slab (12-sided, from three turned squares). */
function disc(cx: number, cz: number, r: number, y0: number, y1: number, look: Look): void {
  const s = r * 2 * 0.966;
  for (const a of [0, PI / 6, PI / 3]) turned(cx, cz, s, s, y0, y1, look, a);
}
/** A round plate standing upright facing ±z (12-sided: three squares rolled 30° apart), centre (cx, cy, cz). */
function vdisc(cx: number, cy: number, cz: number, r: number, t: number, look: Look): void {
  const s = r * 2 * 0.966;
  for (const roll of [0, PI / 6, -PI / 6]) m.block([r2(cx), r2(cy - s / 2), r2(cz)], [r2(s), r2(s), t], 'solid', { ...look, ...(roll ? { roll: r2(roll) } : {}) });
}
/** A ring wall of `n` turned blocks, radius `r` to the wall's middle, leaving out the pieces `gap` lists. */
function ring(cx: number, cz: number, r: number, y0: number, y1: number, thick: number, n: number, look: Look, gap: number[] = []): void {
  const w = ((2 * PI * (r + thick / 2)) / n) * 1.05;
  for (let i = 0; i < n; i++) {
    if (gap.includes(i)) continue;
    const a = ((i + 0.5) * 2 * PI) / n;
    turned(cx + r * Math.sin(a), cz + r * Math.cos(a), w, thick, y0, y1, look, a);
  }
}
/**
 * A ramp (a pitched block) whose top runs from `a` up to `b` (feet heights),
 * `width` across, `t` thick, overrunning both ends a little so it meets the floors.
 */
function ramp(a: V3, b: V3, width: number, look: Look, t = 0.4): void {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const run = Math.hypot(dx, dz);
  const rise = b[1] - a[1];
  const pitch = Math.atan2(rise, run);
  const len = Math.hypot(run, rise);
  const yaw = Math.atan2(dx, dz);
  // The block turns about its centre: put the centre of its top face on the midpoint of a→b.
  const cy = (a[1] + b[1]) / 2 - (t / 2) * Math.cos(pitch);
  m.block([r2((a[0] + b[0]) / 2), r2(cy - t / 2), r2((a[2] + b[2]) / 2)], [r2(width), t, r2(len)], 'solid', { ...look, pitch: r2(pitch), yaw: r2(yaw) });
}
/** A flat slab with rectangular holes in it (holes as [x0, z0, x1, z1]). */
function slab(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, look: Look, holes: [number, number, number, number][]): void {
  const xs = [...new Set([x0, x1, ...holes.flatMap((h) => [h[0], h[2]]).filter((x) => x > x0 && x < x1)])].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const [a, b] = [xs[i]!, xs[i + 1]!];
    const cuts = holes.filter((h) => h[0] < b - 0.01 && h[2] > a + 0.01).map((h) => [h[1], h[3]] as [number, number]).sort((p, q) => p[0] - q[0]);
    let z = z0;
    for (const [c0, c1] of cuts) {
      box(a, y0, z, b, y1, c0, look);
      z = c1;
    }
    box(a, y0, z, b, y1, z1, look);
  }
}
const ladder = (at: V3, yaw: number, height: number, name: string, width = 1.2) => m.add({ kind: 'ladder', position: at, yaw, height, width, name });

// ---------------------------------------------------------------- the room
// Oak boards, wallpapered walls 30 m high, white tiles behind the counter, skirting boards.
for (const [x0, x1] of [[-2, 48], [48, 98]] as const) for (const [z0, z1] of [[-2, 32], [32, 66]] as const) box(x0, -0.6, z0, x1, 0, z1, OAK);
box(-2, 0, -2, 98, 30, 0, WALLPAPER); // south
box(-2, 0, 64, 98, 30, 66, WALLPAPER); // north
box(-2, 0, 0, 0, 30, 64, WALLPAPER); // west
box(96, 0, 0, 98, 30, 64, WALLPAPER); // east
box(14, 12, 63.7, 96, 21, 64, TILES); // splashback
box(0, 0, 0, 96, 0.9, 0.4, SKIRT);
box(0, 0, 0.4, 0.4, 0.9, 50, SKIRT);
box(95.6, 0, 0.4, 96, 0.9, 64, SKIRT);
// A window over the sink (sky beyond), a wall clock and a giant door on the east wall.
box(36, 18, 63.6, 54, 28, 63.75, { material: 'paint_matte', tint: '#9fd2f2' });
box(35.4, 17.4, 63.4, 54.6, 18, 63.75, WHITE);
box(35.4, 28, 63.4, 54.6, 28.6, 63.75, WHITE);
box(44.7, 18, 63.4, 45.3, 28, 63.7, WHITE);
vdisc(70, 20, 0.15, 2.6, 0.3, WHITE); // the clock face
box(69.8, 20, 0.3, 70.2, 22.2, 0.5, BLACK);
box(70, 19.8, 0.3, 71.8, 20.2, 0.5, BLACK);
box(95.5, 0, 14, 96, 24, 15, WOOD);
box(95.5, 0, 33, 96, 24, 34, WOOD);
box(95.5, 23, 14, 96, 24, 34, WOOD);
box(95.6, 0, 15, 95.8, 23, 33, PALEWOOD);
box(95.2, 10.5, 30, 95.6, 11.5, 32, STEEL); // door handle

// ---------------------------------------------------------------- the counter run (north wall, z 52..64, top 12 m)
const TOP = 12;
const FRONT = 52;
// A: washing machine front (x 14..24).
box(14, 0, FRONT, 24, 11, 64, WHITE);
vdisc(19, 5, FRONT - 0.3, 3.2, 0.3, STEEL); // the porthole: a steel rim round dark glass
vdisc(19, 5, FRONT - 0.45, 2.6, 0.3, GLASS);
box(15, 9, FRONT - 0.3, 23, 10.5, FRONT, DARKSTEEL); // control strip
// B: the cupboard (x 24..36): hollow, a ramp up to a landing and a ladder up through a hatch in the worktop.
box(24, 0, FRONT, 25, 11, 64, CABINET);
box(35, 0, FRONT, 36, 11, 64, CABINET);
box(25, 0, 63, 35, 11, 64, CABINET);
// (Ramps stay under 35°: steeper ones fall foul of the navmesh's ledge filter at 0.2 m cells.)
box(25, 4.6, 56, 35, 5, 63, PALEWOOD); // the shelf
box(33, 4.6, 52.6, 35, 5, 56, PALEWOOD); // landing at the top of the ramp
ramp([25.4, 0, 54.3], [33.1, 5, 54.3], 3, PALEWOOD);
ladder([34.6, 5, 60], -P, 7, 'Cupboard ladder');
// The sliding door creeps back and forth across the front (always half open).
m.block([27.5, 0.3, FRONT - 0.6], [5.2, 10.4, 0.4], 'solid', { ...CAB_DARK, id: 'cupboard_door' });
m.mover('mover_cupboard', [27.5, 0.3, FRONT - 0.6], ['cupboard_door'], [[0, 0, 0], [5, 0, 0]], { mode: 'pingpong', speed: 1.2, wait: 3, name: 'Cupboard door' });
// C: the sink (x 36..54): a basin 4.6 m deep, grey dish water, a tap.
box(36, 0, FRONT, 54, 7, 64, CABINET);
box(36, 7, FRONT, 40, 11, 64, CABINET);
box(52, 7, FRONT, 54, 11, 64, CABINET);
box(40, 7, FRONT, 52, 11, 54, CABINET);
box(40, 7, 62, 52, 11, 64, CABINET);
box(40, 6.9, 54, 52, 7, 62, STEEL);
m.water([46, 7, 58], [12, 4.6, 8], 'water', '#8d9aa0');
box(45.4, TOP, 62.4, 46.6, TOP + 6, 63.6, STEEL); // tap
box(45.5, TOP + 5, 58.5, 46.5, TOP + 6, 62.4, STEEL);
box(45.5, TOP + 4.4, 58.5, 46.5, TOP + 5, 59.5, STEEL);
// D: cabinet (x 54..62); a chopping board leans on its front as a ramp to the worktop.
box(54, 0, FRONT, 62, 11, 64, CABINET);
ramp([58, 0, 33.8], [58, TOP, 51.5], 6, CHOP, 0.6);
// E: the oven (x 62..80). Sides, a plinth with the element's groove, the cavity, the hob above.
box(62, 0, FRONT, 63, 11, 64, BLACK);
box(79, 0, FRONT, 80, 11, 64, BLACK);
box(63, 0, FRONT, 79, 1.8, 64, BLACK);
box(63, 1.8, FRONT, 79, 2.4, 57, DARKSTEEL);
box(63, 1.8, 59, 79, 2.4, 63, DARKSTEEL);
box(63, 1.8, 57, 65, 2.4, 59, DARKSTEEL);
box(77, 1.8, 57, 79, 2.4, 59, DARKSTEEL);
m.water([71, 1.8, 58], [12, 0.5, 2], 'lava');
box(63, 2.4, 63, 79, 10, 64, DARKSTEEL); // back
slab(63, FRONT, 79, 64, 10, 11, BLACK, [[76.4, 58.6, 79, 62]]); // roof, with the flue
box(63, 6.2, 58, 79, 6.4, 58.4, STEEL); // oven rack rails (decor, out of the way)
// The door: a drawbridge hinged at its foot, standing closed; lowered it is a ramp onto the oven floor.
m.block([71, 1.9, FRONT - 4.05], [16, 0.5, 8.1], 'solid', { ...GLASS, id: 'oven_door' });
m.mover('oven_hinge', [71, 1.9, FRONT], ['oven_door'], [[0, 0, 0], [0, 0, 0]], { mode: 'trigger', yaw: PI, angles: [P, -0.3], turnSpeed: 150, wait: 0, name: 'Oven door' });
ladder([78.6, 2.4, 60.3], -P, 9.6, 'Oven flue');
// Burners: flame jets either side, rippling.
const BURNERS = ['burner_w1', 'burner_w2', 'burner_e1', 'burner_e2'];
[[63.4, 55, P], [63.4, 61, P], [78.6, 55, -P], [78.6, 61, -P]].forEach(([x, z, yaw], i) =>
  m.add({ kind: 'trap', id: BURNERS[i]!, name: 'Oven burner', trap: 'flames', position: [x!, 2.4, z!], yaw: yaw!, activation: 'cycle', onSeconds: 2, offSeconds: 3, offsetSeconds: i * 1.25, startEnabled: true, damage: null }),
);
// Control panel knobs and the hob rings.
for (const x of [66, 69, 73, 76]) disc(x, FRONT - 0.3, 0.45, 10.2, 10.8, STEEL);
for (const [x, z] of [[66.5, 55.5], [71.5, 55.5], [66.5, 60.5], [71.5, 60.5]] as const) ring(x, z, 1.8, TOP, TOP + 0.12, 0.35, 10, BLACK);
// F: corner cabinets (x 80..96), the cookie jar.
box(80, 0, FRONT, 96, 11, 64, CABINET);
// Cabinet doors and handles along the front (decor strips).
for (const [x0, x1] of [[54, 62], [80, 88], [88, 96], [36, 45], [45, 54]] as const) {
  box(x0 + 0.3, 1.2, FRONT - 0.15, x1 - 0.3, 10.6, FRONT, CAB_DARK);
  box((x0 + x1) / 2 - 1.5, 9.2, FRONT - 0.45, (x0 + x1) / 2 + 1.5, 9.6, FRONT - 0.15, STEEL);
}
// The worktop, with the sink, the cupboard hatch and the oven flue cut out.
slab(14, FRONT - 0.6, 96, 64, 11, TOP, WORKTOP, [[40, 54, 52, 62], [32.2, 58.4, 35, 61.6], [76.4, 58.6, 79, 62]]);

// ---------------------------------------------------------------- the fridge freezer (x 0..14, z 50..64, 24 m)
for (const [x, z] of [[0.6, 50.6], [13.4, 50.6], [0.6, 63.4], [13.4, 63.4]] as const) box(x - 0.6, 0, z - 0.6, x + 0.6, 2.4, z + 0.6, DARKSTEEL);
box(0, 2.4, 50, 14, 24, 64, WHITE);
box(0.3, 13.6, 49.8, 13.7, 13.9, 50, { material: 'paint_matte', tint: '#b8bcbc' }); // the seam between freezer and fridge
box(12, 5, 49.2, 12.6, 12.4, 49.8, STEEL);
box(12, 15.4, 49.2, 12.6, 22, 49.8, STEEL);
// Magnets and a child's drawing.
box(3, 16, 49.85, 8, 21, 49.95, { material: 'paint_matte', tint: '#fbfbf5' });
for (const [x, y, c] of [[3.6, 9, RED], [5.4, 7.6, YELLOW], [8.2, 10.4, BLUE], [4.5, 20.4, GREEN]] as const) box(x, y, 49.6, x + 1, y + 1, 49.95, c);
// A dropped box of CRUNCH-O'S in the crawlspace, and one standing by the fridge.
m.block([7, 0, 54], [6, 1.2, 3.6], 'solid', { ...YELLOW, yaw: 0.35 });
box(15, 0, 38, 18.6, 9, 40.4, YELLOW);
box(15.2, 0, 37.9, 18.4, 0.8, 38, RED);
m.light([16.8, 5.8, 37.85], { fixture: 'sign', text: "CRUNCH-O'S", color: '#ff7a1a', size: [3.2, 1.6], yaw: PI, intensity: 1.2, range: 6 });
// The sniper perch on top: a pad from the counter, a ladder back down onto the worktop.
m.padTo([21, TOP, 57], [6, 24, 57], 28);
ladder([14.6, TOP, 60], P, 12, 'Fridge ladder');
m.prop('cardboard_box', [4, 24, 60], 0.3, 4);
m.prop('hh_plant', [11, 24, 53], 0, 4);

// ---------------------------------------------------------------- the toaster (knocked onto the floor)
// A steel box 3.4 m tall, two slots 0.25 m deep with a pad in each; walk up the slice of toast.
const TX0 = 82;
const TX1 = 92;
box(TX0, 0, 37, TX1, 3.15, 43, STEEL);
box(TX0, 3.15, 37, TX1, 3.4, 38, STEEL);
box(TX0, 3.15, 39.8, TX1, 3.4, 40.2, STEEL);
box(TX0, 3.15, 42, TX1, 3.4, 43, STEEL);
box(TX0, 3.15, 38, TX0 + 1.2, 3.4, 42, STEEL);
box(TX1 - 1.2, 3.15, 38, TX1, 3.4, 42, STEEL);
box(TX1, 1.6, 39.4, TX1 + 0.8, 2.2, 40.6, BLACK); // lever
ramp([87, 0, 30.5], [87, 3.4, 37.2], 4.2, TOAST, 0.5);
m.padTo([86, 3.15, 38.9], [83, TOP, 57], 22);
m.padTo([88, 3.15, 41.1], [91, TOP, 55.5], 22);

// ---------------------------------------------------------------- the kitchen table (top 8 m) and chairs
const T = { x0: 34, x1: 58, z0: 14, z1: 30, top: 8 };
box(T.x0, T.top - 0.8, T.z0, T.x1, T.top, T.z1, WOOD);
for (const [x, z] of [[T.x0 + 1, T.z0 + 1], [T.x1 - 1, T.z0 + 1], [T.x0 + 1, T.z1 - 1], [T.x1 - 1, T.z1 - 1]] as const) box(x - 0.9, 0, z - 0.9, x + 0.9, T.top - 0.8, z + 0.9, WOOD);
/** A chair: seat top 4.8 m, legs, back slats on the side away from the table. `side` +1 north of the table, -1 south. */
function chair(cx: number, cz: number, side: 1 | -1): void {
  const s = 2.3;
  box(cx - s, 4.2, cz - s, cx + s, 4.8, cz + s, PALEWOOD);
  for (const [dx, dz] of [[-s + 0.35, -s + 0.35], [s - 0.35, -s + 0.35], [-s + 0.35, s - 0.35], [s - 0.35, s - 0.35]] as const) box(cx + dx - 0.35, 0, cz + dz - 0.35, cx + dx + 0.35, 4.2, cz + dz + 0.35, PALEWOOD);
  const bz = cz + side * (s - 0.3);
  for (const dx of [-s + 0.3, -0.8, 0.8, s - 0.3]) box(cx + dx - 0.3, 4.8, bz - 0.3, cx + dx + 0.3, 9.6, bz + 0.3, PALEWOOD);
  box(cx - s, 9.6, bz - 0.35, cx + s, 10.4, bz + 0.35, PALEWOOD);
}
chair(40, 11.4, -1); // south-west: a ruler up to the seat, a ladder up the table's edge
ramp([30.4, 0, 11.4], [37.8, 4.8, 11.4], 2.4, YELLOW, 0.3);
ladder([40, 4.8, 13.4], PI, 3.2, 'Table edge');
chair(52, 32.6, 1); // north-east: the same from the other side
ramp([42.4, 0, 32.6], [49.8, 4.8, 32.6], 2.4, YELLOW, 0.3);
ladder([52, 4.8, 30.6], 0, 3.2, 'Table edge');
chair(52, 11.4, -1);
// A chair knocked over on its back by the door (low cover), its legs sticking out.
box(70, 0, 8, 74.6, 0.6, 12.6, PALEWOOD);
box(70, 0, 12.6, 74.6, 4.8, 13.2, PALEWOOD);
for (const x of [70.2, 73.7]) for (const z of [8.2, 11.7]) box(x, 0.6, z, x + 0.7, 4.6, z + 0.7, PALEWOOD);
// Table top: plates, cups, the bowl of milk, salt and pepper, a knife, and the sugar bowl.
for (const [x, z] of [[38, 17], [38, 27], [46, 17], [54, 27]] as const) disc(x, z, 2.6, T.top, T.top + 0.25, CERAMIC);
for (const [x, z, c] of [[42.5, 20, BLUE], [49, 26.5, RED], [37, 22, YELLOW]] as const) {
  disc(x, z, 1.3, T.top, T.top + 3.4, c);
  box(x + 1.1, T.top + 1, z - 0.2, x + 1.9, T.top + 2.6, z + 0.2, c);
}
// The bowl of milk: wade through it (1 m deep) for cover behind the rim.
ring(46, 23.5, 2.9, T.top, T.top + 1.4, 0.4, 14, CERAMIC);
m.water([46, T.top, 23.5], [5, 1.1, 5], 'water', '#f4f1e8');
disc(56.5, 17, 0.8, T.top, T.top + 3, WHITE);
disc(56.5, 19.6, 0.8, T.top, T.top + 3, DARKSTEEL);
m.block([44, T.top, 15.3], [9, 0.2, 0.8], 'solid', { ...STEEL, yaw: 0.12 });
// Sugar bowl (the Table team's base): a low ring with a gap, the flag in the middle.
ring(53.5, 21, 3, T.top, T.top + 1.2, 0.35, 14, BLUE, [5, 6, 7, 8]);

// ---------------------------------------------------------------- the floor: toy blocks, a dog bowl, toy microwaves
const TOYS: [number, number, number, Look][] = [
  [24, 22, 0.3, RED], [27, 23, -0.2, YELLOW], [25.4, 25.6, 0.5, BLUE], [66, 36, 0.2, GREEN], [69.5, 37.5, -0.3, RED],
  [20, 6, 0.1, BLUE], [77, 22, 0.6, YELLOW], [30, 41, 0.4, GREEN], [8, 30, -0.4, RED], [88, 10, 0.25, GREEN],
];
for (const [x, z, yaw, c] of TOYS) m.block([x, 0, z], [2.4, 2.4, 2.4], 'solid', { ...c, yaw });
m.block([25.6, 2.4, 23.4], [2.4, 2.4, 2.4], 'solid', { ...BLUE, yaw: 0.1 });
// The dog bowl (water, 0.9 m deep) and the dog's kibble.
ring(10, 12, 3.2, 0, 1.6, 0.5, 16, RED);
m.water([10, 0, 12], [5.4, 0.9, 5.4], 'water', '#7ab4d8');
for (const [x, z] of [[15.5, 8], [16.4, 9.6], [14.6, 6.4]] as const) disc(x, z, 0.5, 0, 0.7, CRUST);
// Toy microwaves (they go off when shot) and a wind-up robot.
m.prop('sb_microwave', [30, 0, 33], 0.4, 4).prop('sb_microwave', [72, 0, 46], -0.3, 4).prop('sb_microwave', [58, TOP, 58], 0, 4);
m.prop('sb_garden_gnome', [62, 0, 18], 0.8, 4).prop('hh_kettle', [86, TOP, 60.5], 0.4, 4).prop('hh_toaster', [24.5, TOP, 57], 0.2, 4);
m.prop('cardboard_open', [90, 0, 22], 0.5, 4).prop('hh_books', [20, TOP, 61], 0.1, 4);

// ---------------------------------------------------------------- the cookie jar (Counter team's base) on the corner worktop
ring(90, 58.5, 2.8, TOP, TOP + 3.6, 0.35, 14, JAR, [6, 7]);
m.block([93.8, TOP, 54.2], [3.4, 0.4, 3.4], 'solid', { ...JAR, yaw: 0.4, roll: 0.35 }); // the lid, tipped off
for (const [x, z] of [[85, 54.5], [86.5, 62], [94.2, 61.5]] as const) disc(x, z, 1.2, TOP, TOP + 0.25, COOKIE);

// ---------------------------------------------------------------- mouse holes (a portal pair through the skirting)
// A hole gnawed in the west skirting comes out of another under the clock on the south wall.
for (const [x, z, w, d] of [[-0.6, 26.2, 1.2, 0.4], [-0.6, 29.4, 1.2, 0.4]] as const) box(x, 0, z, x + w, 2.8, z + d, CRUST);
box(-0.6, 2.6, 26.2, 0.6, 3, 29.8, CRUST);
for (const [x, z, w, d] of [[68.2, -0.6, 0.4, 1.2], [71.4, -0.6, 0.4, 1.2]] as const) box(x, 0, z, x + w, 2.8, z + d, CRUST);
box(68.2, 2.6, -0.6, 71.8, 3, 0.6, CRUST);
m.add({ kind: 'portal', id: 'mousehole_w', name: 'Mouse hole (west)', position: [0.15, 0, 28], yaw: P, size: [2.6, 2.4], pair: 'mousehole', startEnabled: true, color: '#3a2a1a' });
m.add({ kind: 'portal', id: 'mousehole_s', name: 'Mouse hole (south)', position: [70, 0, 0.15], yaw: 0, size: [2.6, 2.4], pair: 'mousehole', startEnabled: true, color: '#3a2a1a' });

// ---------------------------------------------------------------- the oven knob
m.add({ kind: 'button', id: 'btn_knob', name: 'Oven knob', position: [61, 0, FRONT - 0.1], yaw: PI, label: 'Turn the oven knob', once: false, cooldownSeconds: 3, startEnabled: true });
m.add({ kind: 'button', id: 'btn_knob_in', name: 'Oven light switch', position: [63.1, 2.4, 57.5], yaw: P, label: 'Open the oven door', once: false, cooldownSeconds: 3, startEnabled: true });

// ---------------------------------------------------------------- spawns
// Counter team on the worktop, Table team on the table top; shared spawns round the floor for deathmatch.
for (const [x, z] of [[66, 54.4], [72, 54.4], [83, 61.5], [88, 54.2], [94, 54.4], [70, 61.5]] as const) m.spawn([x, TOP, z], PI, COUNTER);
for (const [x, z] of [[36.5, 15.5], [36.5, 28.5], [42, 28.5], [50, 15.5], [57, 28.5], [56.5, 23.5]] as const) m.spawn([x, T.top, z], 0, TABLE);
const SHARED: [V3, number][] = [
  [[6, 0, 6], 0.8], [[30, 0, 6], 0], [[64, 0, 4], 0], [[90, 0, 4], -0.8], [[6, 0, 40], P], [[46, 0, 38], PI],
  [[80, 0, 30], -P], [[22, 0, 46], P], [[46, 0, 6], 0], [[92, 0, 48], PI], [[20, TOP, 56], P], [[46, T.top, 28.5], PI],
];
for (const [p, yaw] of SHARED) m.spawn(p, yaw);

// ---------------------------------------------------------------- flags
m.flag(COUNTER, [90, TOP, 58.5], PI);
m.flag(TABLE, [53.5, T.top, 21], 0);

// ---------------------------------------------------------------- pickups
const ITEMS: [string, V3, number?][] = [
  ['weapon_sniper', [7, 24, 57], 30], ['ammo_sniper', [4, 24, 54]],
  ['weapon_rockets', [71, 2.4, 60.5], 60], ['ammo_explosive', [66, 2.4, 61.5]],
  ['armor_large', [7, 0, 59], 45], ['jetpack', [46, 0, 44]], ['powerup_damage', [37.6, TOP, 58], 90],
  ['weapon_shotgun', [22, 0, 30]], ['weapon_smg', [74, 0, 28]], ['weapon_rifle', [40, T.top, 22]], ['weapon_rifle', [78, TOP, 55]],
  ['weapon_launcher', [27, 6, 60], 40], ['grenades', [12, 0, 44]], ['grenades', [84, 0, 46]],
  ['health_large', [46, 0, 22]], ['health_small', [8, 0, 22]], ['health_small', [88, 0, 16]], ['health_small', [50, T.top, 28.5]], ['health_small', [64, TOP, 61]],
  ['armor_small', [34, 0, 50]], ['armor_small', [62, 0, 40]], ['ammo', [56, T.top, 15.5]], ['ammo', [82, TOP, 58.5]], ['ammo_rifle', [30, 0, 14]], ['ammo_shells', [70, 0, 18]],
];
for (const [item, p, r] of ITEMS) m.pickup(item, p, r ?? null);

// ---------------------------------------------------------------- logic: the oven knob
type Rule = Parameters<MapBuilder['logic']>[0]['rules'][number];
type Action = Rule['do'][number];
type Condition = Rule['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: Rule['when']['event'], target: string | null, does: Action[], ifs: Condition[] = []): Rule => ({ id, name, enabled: true, once: false, when: { event, target }, if: ifs, do: does });
m.logic({
  variables: [],
  timers: [{ id: 'timer_oven', name: 'Oven door', seconds: 14, loop: false, visible: false }],
  objectives: [],
  rules: [
    // Only from shut: the knob drops the door, glowing orange; the timer swings it shut again.
    rule('rule_knob', 'Knob: drop the oven door', 'button_pressed', 'btn_knob', [act('mover_to', 'oven_hinge', { value: 2 }), act('sound', null, { state: 'boom' }), act('light_color', 'oven_glow', { text: '#ff5a10' }), act('timer_start', 'timer_oven'), act('message', null, { value: 3, text: 'The oven door slams down!' })], [cond('mover_at', 'oven_hinge', '==', 1)]),
    rule('rule_knob_in', 'Inside: drop the oven door', 'button_pressed', 'btn_knob_in', [act('mover_to', 'oven_hinge', { value: 2 }), act('sound', null, { state: 'boom' }), act('light_color', 'oven_glow', { text: '#ff5a10' }), act('timer_start', 'timer_oven')], [cond('mover_at', 'oven_hinge', '==', 1)]),
    rule('rule_shut', 'The oven door swings shut', 'timer_done', 'timer_oven', [act('light_flash', 'oven_glow', { value: 1 }), act('sound', null, { state: 'buzzer' }), act('wait', null, { value: 1 }), act('mover_to', 'oven_hinge', { value: 1 }), act('light_color', 'oven_glow', { text: '' })]),
  ],
});

// ---------------------------------------------------------------- lights
m.light([71, 9.4, 58], { id: 'oven_glow', fixture: 'none', color: '#ff8a2a', intensity: 1.6, range: 12 });
m.light([71, 2.6, 58], { fixture: 'none', color: '#ff4a10', intensity: 1.2, range: 6 }); // the element
m.light([7, 1.8, 56], { fixture: 'none', color: '#a8c8ff', intensity: 0.8, range: 9 }); // crawlspace gloom
m.light([46, 13.5, 58], { fixture: 'none', color: '#bfe4ff', intensity: 0.7, range: 10 }); // sink
for (const x of [24, 46, 70, 88]) m.light([x, 20.5, 62.5], { fixture: 'strip', color: '#fff4dc', intensity: 1, range: 12 }); // under the wall cupboards
m.light([46, 26, 22], { fixture: 'none', color: '#fff0d0', intensity: 1.2, range: 22 }); // over the table
m.light([87, 6, 36.6], { fixture: 'none', color: '#ffb46a', intensity: 0.8, range: 6 }); // toaster glow
m.light([30, 0.4, 0.6], { fixture: 'none', color: '#ffe8b0', intensity: 0.6, range: 5 }); // night light
m.light([60.5, 1.4, FRONT - 0.3], { fixture: 'none', color: '#ffb040', intensity: 0.8, range: 4 }); // knob tell
m.light([90, 16.6, 58.5], { fixture: 'none', color: '#ffe0a0', intensity: 0.8, range: 8 }); // cookie jar
m.light([53.5, 10.5, 21], { fixture: 'none', color: '#a0c4ff', intensity: 0.8, range: 8 }); // sugar bowl

// ---------------------------------------------------------------- bounds and metadata
m.bounds('invisible', 0, { min: [-2, -2], max: [98, 66] }, 60);
m.meta({
  description:
    "Toy soldiers at war in a giant kitchen. The counter run is 12 m up: a sliding cupboard door over a ramp and a hatch, a sink of dish water to swim, a chopping board ramp, and an oven whose door slams down into a ramp when you turn the knob (flame-jet burners and a glowing element inside, a flue ladder out by the cookie jar). A knocked-over toaster pops you onto the counter, the fridge has a crawlspace with a box of CRUNCH-O'S under it and a sniper perch on top, and the kitchen table stands 8 m tall with chairs, plates, cups and a bowl of milk. CTF flags: the cookie jar and the sugar bowl.",
  modes: ['core.tdm', 'core.ctf', 'core.deathmatch'],
  players: [6, 12],
});
await m.save();
