/**
 * Sushi Belt Sumo: Disc Arena on plates riding a conveyor belt over the void
 * (docs/MAP_IDEAS.md, top-10 #2; our own map and name). A neon sushi bar the
 * size of a stadium: eight 6 m plates, each with a giant nigiri on it, ride a
 * 60 × 30 m belt round the chef's island, and the void waits underneath.
 *
 * - The belt: eight plates, each its own loop mover round the rectangle at
 *   3 m/s (under the 4 m/s run-over speed). Every plate's points are the four
 *   corners plus its own "home" spot, where it starts: the homes are spaced
 *   evenly round the belt, so the plates are too, and since every lap is the
 *   same length at the same speed with the same pauses, they stay spaced.
 *   They pause at each corner (and at home) for 1.2 s: that's when you board.
 *   A non-solid monorail track under them reads as the conveyor.
 * - The counters: two long static bar counters inside the long sides, 0.3 m
 *   from the passing plates. Step on and off as a plate slides by; knocked
 *   outward, you go into the void.
 * - The chef's island: the four power discs (fast, triple, split, freeze),
 *   the prep counter and noodle stall to bank discs off. Pads out to both
 *   counters; pads back from them.
 * - Corner docks: a static landing at each corner of the belt, where the
 *   plates stop. Pads from the counter ends out to them, a pad home to the
 *   island and one up to the nearest sake bottle tower.
 * - Two sake bottle towers off the short ends, 6 m up: the high ground, with
 *   a pad home to the island.
 * - Round the edge, out of reach: neon bar walls with a sign for each plate.
 *
 * Top-down (x east, z north; metres):
 *
 *   z 15   [dk]==== plates ride the belt (counter-clockwise) ====[dk]
 *   z 11        [========= north counter =========]
 *   z  0   (T)   ||        [ chef's island ]           ||   (T)
 *   z -11       [========= south counter =========]
 *   z -15  [dk]=================================================[dk]
 *          x -44 -36 -30                0               30  36   44
 */
import type { LogicAction, LogicRule } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const m = new MapBuilder('sushi_belt_sumo', 'Sushi Belt Sumo');
m.theme('neon_megacity');
m.backdrop('night', 'city', 'none', 0.2);

const r2 = (n: number) => Math.round(n * 100) / 100;
const P = Math.PI / 2;

// ---------------------------------------------------------------- looks
const LACQUER: Look = { material: 'paint_gloss', tint: '#1c1418' };
const WOOD: Look = { material: 'pbr_walnut' };
const UNDER = { material: 'pbr_space_metal', tint: '#2a2830' };
const neon = (tint: string) => ({ material: 'neon_tube', tint });

// ---------------------------------------------------------------- the belt
const BX = 30; // corners at x ±30
const BZ = 15; // and z ±15
const SPEED = 3;
const WAIT = 1.2;
/** Corners in belt order (counter-clockwise seen from above: east side north, then the north side west…). */
const CORNERS: [number, number][] = [[BX, -BZ], [BX, BZ], [-BX, BZ], [-BX, -BZ]];
const SIDE = [2 * BZ, 2 * BX, 2 * BZ, 2 * BX];
const PERIMETER = SIDE.reduce((a, b) => a + b, 0);
/** A spot `s` metres round the belt from the first corner, and the index of the corner it is heading for. */
function along(s: number): { x: number; z: number; next: number } {
  let d = ((s % PERIMETER) + PERIMETER) % PERIMETER;
  for (let i = 0; i < 4; i++) {
    const [ax, az] = CORNERS[i]!;
    const [bx, bz] = CORNERS[(i + 1) % 4]!;
    if (d < SIDE[i]!) return { x: ax + ((bx - ax) * d) / SIDE[i]!, z: az + ((bz - az) * d) / SIDE[i]!, next: (i + 1) % 4 };
    d -= SIDE[i]!;
  }
  throw new Error('along');
}

/** The eight plates: deck tint, rim neon, nigiri topping (and the sign on the bar wall that names it). */
const PLATES: { name: string; deck: string; rim: string; fish: string; band?: string }[] = [
  { name: 'SALMON', deck: '#2a1c22', rim: '#ff7a3c', fish: '#ff8a50', band: '#fff2e8' },
  { name: 'MAGURO', deck: '#24161c', rim: '#ff3b5c', fish: '#c8243a' },
  { name: 'TAMAGO', deck: '#2a2418', rim: '#ffd34a', fish: '#ffd24a', band: '#1a2a1a' },
  { name: 'TAKO', deck: '#261a2a', rim: '#c45cff', fish: '#b05a78', band: '#f0d0d8' },
  { name: 'EBI', deck: '#2a1e1c', rim: '#ff9a7a', fish: '#ff9e7a', band: '#ffffff' },
  { name: 'WASABI', deck: '#18261c', rim: '#5dff9a', fish: '#7ccf5a' },
  { name: 'UNI', deck: '#2a2014', rim: '#ffb347', fish: '#e8a030' },
  { name: 'SABA', deck: '#182028', rim: '#4fe0ff', fish: '#9aa8b8', band: '#3a4a5a' },
];
const DECK_T = 1.0;
PLATES.forEach((plate, i) => {
  const id = `plate_${plate.name.toLowerCase()}`;
  // Homes spaced evenly, none on a corner (corners sit at 0, 30, 90 and 120 m round).
  const home = along(PERIMETER / 16 + (i * PERIMETER) / 8);
  const [hx, hz] = [r2(home.x), r2(home.z)];
  const blocks: string[] = [];
  const part = (suffix: string, at: V3, size: V3, look: { material: string; tint?: string }) => {
    m.block([r2(at[0]), r2(at[1]), r2(at[2])], size, 'solid', { ...look, id: `${id}_${suffix}` });
    blocks.push(`${id}_${suffix}`);
  };
  part('deck', [hx, -DECK_T, hz], [6, DECK_T, 6], { material: 'paint_gloss', tint: plate.deck });
  part('under', [hx, -DECK_T - 0.4, hz], [5, 0.4, 5], UNDER);
  // A strip of neon round the rim, just under the top face.
  part('rim_e', [hx + 2.9, -0.4, hz], [0.2, 0.3, 6], neon(plate.rim));
  part('rim_w', [hx - 2.9, -0.4, hz], [0.2, 0.3, 6], neon(plate.rim));
  part('rim_n', [hx, -0.4, hz + 2.9], [5.6, 0.3, 0.2], neon(plate.rim));
  part('rim_s', [hx, -0.4, hz - 2.9], [5.6, 0.3, 0.2], neon(plate.rim));
  // The nigiri: rice and its topping, off to one side and turned a little: waist-high cover to bank discs off.
  const yaw = ((i % 3) - 1) * 0.35;
  const ox = i % 2 ? 1.1 : -1.1;
  part('rice', [hx + ox, 0, hz + 0.6], [2.4, 0.6, 1.3], { material: 'plaster', tint: '#f4f0e6' });
  m.block([r2(hx + ox), 0.6, r2(hz + 0.6)], [2.6, 0.22, 1.5], 'solid', { material: 'paint_gloss', tint: plate.fish, yaw, id: `${id}_fish` });
  blocks.push(`${id}_fish`);
  if (plate.band) part('band', [hx + ox, 0.82, hz + 0.6], [0.5, 0.1, 1.52], { material: 'paint_matte', tint: plate.band });
  // Points: home, then the four corners in belt order from the next one, then (looping) home again.
  const points: V3[] = [[0, 0, 0]];
  for (let k = 0; k < 4; k++) {
    const [cx, cz] = CORNERS[(home.next + k) % 4]!;
    points.push([r2(cx - hx), 0, r2(cz - hz)]);
  }
  m.mover(`mover_${id}`, [hx, 0, hz], blocks, points, { mode: 'loop', speed: SPEED, wait: WAIT, name: `${plate.name[0]}${plate.name.slice(1).toLowerCase()} plate` });
});

// The conveyor under the plates: monorail track, drawn only (fall through it into the void).
for (let i = 0; i < 4; i++) {
  const [ax, az] = CORNERS[i]!;
  const [bx, bz] = CORNERS[(i + 1) % 4]!;
  const n = Math.round(SIDE[i]! / 8);
  const yaw = ax === bx ? 0 : P;
  for (let k = 0; k <= n; k++) m.prop('nc_monorail_track', [r2(ax + ((bx - ax) * k) / n), -2.6, r2(az + ((bz - az) * k) / n)], yaw, 1, false);
}

// ---------------------------------------------------------------- static decks
/** A static deck: lacquer top at `top`, an underside, and a strip of neon round its rim. */
function deck(x: number, z: number, w: number, d: number, top: number, rim: string, look = LACQUER): void {
  m.block([x, top - 1, z], [w, 1, d], 'solid', look);
  m.block([x, top - 1.4, z], [w - 1, 0.4, d - 1], 'solid', UNDER);
  for (const s of [-1, 1]) {
    m.block([r2(x + s * (w / 2 - 0.1)), top - 0.4, z], [0.2, 0.3, d], 'solid', neon(rim));
    m.block([x, top - 0.4, r2(z + s * (d / 2 - 0.1))], [w - 0.4, 0.3, 0.2], 'solid', neon(rim));
  }
}
// The chef's island.
const IX = 9;
const IZ = 5;
deck(0, 0, IX * 2, IZ * 2, 0, '#ff4fd8', { material: 'pbr_terrazzo', tint: '#3a3036' });
// Two counters inside the long sides, 0.3 m from the plates (whose inner edge is at z ±12).
const CZ = 10.7; // counter centre
const CL = 36; // counter length
for (const s of [-1, 1]) deck(0, s * CZ, CL, 2, 0, '#4fe0ff', WOOD);
// Corner docks, just outside the short sides by each corner (0.3 m from a plate stopped there).
const DS = 7; // dock size
const DX = 33.3 + DS / 2;
const docks: [number, number][] = CORNERS.map(([x, z]) => [Math.sign(x) * DX, z]);
for (const [x, z] of docks) deck(x, z, DS, DS, 0, '#ffb347');

// Sake bottle towers off the short ends: a tall white bottle with its shoulders as a deck 6 m up, the neck as cover.
const TX = 46;
const TOP = 6;
for (const s of [-1, 1]) {
  const x = s * TX;
  m.block([x, -16, 0], [6, TOP + 16 - 0.6, 6], 'solid', { material: 'plaster', tint: '#ece6da' });
  m.block([x, TOP - 0.6, 0], [6.4, 0.6, 6.4], 'solid', { material: 'paint_gloss', tint: '#dcd4c4' });
  m.block([x, TOP, 0], [1.6, 2.2, 1.6], 'solid', { material: 'plaster', tint: '#ece6da' });
  m.block([x, TOP + 2.2, 0], [1.9, 0.5, 1.9], 'solid', { material: 'paint_gloss', tint: '#b8202a' });
  // A blue band round the body, and the label.
  m.block([x, TOP - 4, 0], [6.1, 0.6, 6.1], 'solid', neon('#4f8cff'));
  m.light([r2(x - s * 3.15), TOP - 2.4, 0], { fixture: 'sign', text: 'SAKE', color: '#ff4f6a', yaw: -s * P, intensity: 1.3, range: 8, size: [3, 1.1] });
}

// ---------------------------------------------------------------- the chef's island dressing
m.block([0, 0, 0], [5, 1.1, 1.4], 'solid', { material: 'pbr_marble_black' }); // the prep counter
m.block([0, 1.1, 0], [5.2, 0.1, 1.6], 'solid', neon('#ff4fd8'));
m.block([-6.5, 0, 2.6], [0.6, 1.0, 2.6], 'solid', LACQUER);
m.block([6.5, 0, -2.6], [0.6, 1.0, 2.6], 'solid', LACQUER);
m.prop('nc_food_stall', [-7.2, 0, -3.6], 0).prop('nc_holo_kiosk', [7.1, 0, 3.8], Math.PI);
m.prop('nc_neon_barrier', [-3.5, 0, 4.4], 0).prop('nc_neon_barrier', [3.5, 0, -4.4], 0);

// ---------------------------------------------------------------- pads
// Island ↔ counters, counter ends → docks, docks → island and towers, towers → island.
for (const s of [-1, 1]) {
  m.padTo([r2(-4 * s), 0, s * 3.4], [-4 * s, 0, s * 10.6], 10); // island → counter
  m.padTo([r2(4 * s), 0, s * 10.5], [4 * s, 0, s * 2.6], 10); // counter → island
}
for (const [x, z] of docks) {
  const sx = Math.sign(x);
  const sz = Math.sign(z);
  // Landings in the middle of each dock, the pads out in its corners (3 m clear of where you land).
  m.padTo([r2(sx * (CL / 2 - 1.4)), 0, r2(sz * CZ)], [x, 0, z], 11); // counter end → dock
  m.padTo([r2(x + sx * 2.2), 0, r2(z - sz * 2.2)], [r2(sx * (TX + 1.4)), TOP, r2(sz * 1.8)], 18); // dock → tower (up 6 m: needs the lift)
  m.padTo([r2(x - sx * 2.2), 0, r2(z + sz * 2.2)], [r2(sx * (IX - 2.5)), 0, r2(sz * 1.2)], 14); // dock → island
}
for (const s of [-1, 1]) m.padTo([r2(s * (TX - 2.2)), TOP, 0], [r2(s * (IX - 1.5)), 0, -1.2], 13); // tower → island

// ---------------------------------------------------------------- spawns and power discs
for (const [x, z] of [[-5, -1.8], [5, 1.8], [-2.5, 2.8], [2.5, -2.8]] as const) m.spawn([x, 0, z], Math.atan2(-x, -z));
for (const s of [-1, 1]) for (const x of [-12, 12]) m.spawn([x, 0, s * CZ], s > 0 ? Math.PI : 0);
for (const [x, z] of docks) m.spawn([r2(x + Math.sign(x) * 2.2), 0, r2(z + Math.sign(z) * 2.2)], Math.atan2(-x, -z));
for (const s of [-1, 1]) m.spawn([r2(s * TX), TOP, 2.3], -s * P);
for (const s of [-1, 1]) m.pickup('health_small', [r2(s * TX), TOP, -2.3]); // for Deathmatch (Disc Arena does no damage)
const powers = ['disc_fast', 'disc_triple', 'disc_split', 'disc_freeze'];
([[-6, 0], [6, 0], [-2, -3], [2, 3]] as const).forEach(([x, z], i) => m.pickup(powers[i]!, [x, 0, z]));

// ---------------------------------------------------------------- the bar walls (backdrop, out of reach)
const WX = 60;
const WZ = 38;
const WALL = { material: 'pbr_concrete_dark', tint: '#2a2430' };
/** A run of wall (split into pieces the block size limits allow: 64 m along, 32 m up). */
function wallRun(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, look: { material: string; tint?: string }, thick = 1): void {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.ceil(len / 60);
  const ys = Math.ceil((y1 - y0) / 30);
  for (let k = 0; k < n; k++) {
    const cx = r2(x0 + ((x1 - x0) * (k + 0.5)) / n);
    const cz = r2(z0 + ((z1 - z0) * (k + 0.5)) / n);
    for (let j = 0; j < ys; j++) {
      const h = (y1 - y0) / ys;
      const size: V3 = x0 === x1 ? [thick, r2(h), r2(len / n)] : [r2(len / n), r2(h), thick];
      m.block([cx, r2(y0 + j * h), cz], size, 'solid', look);
    }
  }
}
for (const s of [-1, 1]) {
  wallRun(s * WX, -WZ, s * WX, WZ, -30, 18, WALL);
  wallRun(-WX, s * WZ, WX, s * WZ, -30, 18, WALL);
  // Neon bands along the walls.
  for (const y of [4, 12]) {
    wallRun(s * (WX - 0.6), -WZ + 1, s * (WX - 0.6), WZ - 1, y, y + 0.25, neon(y === 4 ? '#ff4fd8' : '#4fe0ff'), 0.2);
    wallRun(-WX + 1, s * (WZ - 0.6), WX - 1, s * (WZ - 0.6), y, y + 0.25, neon(y === 4 ? '#ff4fd8' : '#4fe0ff'), 0.2);
  }
}
// The signs: one for each plate along the long walls, the bar's name over each end.
PLATES.forEach((plate, i) => {
  const s = i < 4 ? 1 : -1;
  const x = -36 + (i % 4) * 24;
  m.light([x, 7.5, s * (WZ - 0.6)], { fixture: 'sign', text: plate.name, color: plate.rim, yaw: s > 0 ? Math.PI : 0, intensity: 1.5, range: 14, size: [6, 1.8], id: `sign_${plate.name.toLowerCase()}` });
});
m.light([WX - 0.6, 8, 0], { fixture: 'billboard', text: 'SUSHI-GO-ROUND', color: '#ff4fd8', yaw: -P, intensity: 2, range: 20, size: [16, 5], id: 'board_east' });
m.light([-WX + 0.6, 8, 0], { fixture: 'billboard', text: 'KAITEN ARENA', color: '#4fe0ff', yaw: P, intensity: 2, range: 20, size: [16, 5], id: 'board_west' });

// ---------------------------------------------------------------- light
for (const [x, z, c] of [[0, 0, '#ffd9e8'], [-7, 0, '#ff4fd8'], [7, 0, '#4fe0ff']] as const) m.light([x, 5, z], { fixture: 'none', color: c, intensity: 1.2, range: 12 });
for (const s of [-1, 1]) for (const x of [-12, 12]) m.light([x, 4, s * CZ], { fixture: 'none', color: '#ffe0b0', intensity: 1, range: 10 });
for (const [x, z] of docks) m.light([x, 4, z], { fixture: 'none', color: '#ffb347', intensity: 1, range: 9 });
for (const s of [-1, 1]) m.light([s * TX, TOP + 4, 0], { fixture: 'none', color: '#ffe8f0', intensity: 1, range: 10 });

// ---------------------------------------------------------------- logic: the chef calls the specials
const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[]): LogicRule => ({ id, name, enabled: true, once: false, when, if: [], do: does });
m.logic({
  variables: [],
  timers: [{ id: 'timer_special', name: 'Chef special', seconds: 30, loop: true, visible: false }],
  objectives: [],
  rules: [
    rule('rule_welcome', 'Irasshaimase', { event: 'match_start', target: null }, [act('message', null, { value: 4, text: 'Irasshaimase! Ride the plates, knock them into the void.' }), act('timer_start', 'timer_special')]),
    // Every 30 s the chef calls a special: its sign flashes and blinks for a few seconds.
    rule('rule_special', 'Chef special', { event: 'timer_done', target: 'timer_special' }, [
      act('sound', null, { state: 'chime' }),
      ...PLATES.slice(0, 4).map((p) => act('light_blink', `sign_${p.name.toLowerCase()}`, { value: 3, state: 'on' })),
      act('wait', null, { value: 4 }),
      ...PLATES.slice(0, 4).map((p) => act('light_blink', `sign_${p.name.toLowerCase()}`, { value: 0, state: 'off' })),
      ...PLATES.slice(4).map((p) => act('light_blink', `sign_${p.name.toLowerCase()}`, { value: 3, state: 'on' })),
      act('wait', null, { value: 4 }),
      ...PLATES.slice(4).map((p) => act('light_blink', `sign_${p.name.toLowerCase()}`, { value: 0, state: 'off' })),
    ]),
  ],
});

m.bounds('invisible', 0, { min: [-WX - 1, -WZ - 1], max: [WX + 1, WZ + 1] }, 20);
m.meta({
  description:
    "Disc Arena in a neon sushi bar the size of a stadium. Eight plates, each carrying a giant nigiri, ride a 60 m conveyor belt round the chef's island over the void: board them at the corners or off the bar counters, bank discs off the sushi, grab a power disc from the chef, take the sake bottle towers, and knock everyone else off the belt.",
  modes: ['core.discs', 'core.deathmatch'],
  players: [4, 8],
});
await m.save();
