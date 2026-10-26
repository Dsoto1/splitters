/**
 * Wheel of Peril: a TV game show where the audience votes on which trap fires
 * next (docs/MAP_IDEAS.md, Party, #29). Team preset 4 v 12: four Contestants
 * run a neon studio obstacle course while twelve Audience members in the
 * gallery above slam giant buttons to choose between two dooms.
 *
 *   - The course runs east: the start podiums, five stages (14 m each) and the
 *     finish with the golden buzzer. A force field closes the end of every
 *     stage. When a contestant steps into a stage, its 8 s vote opens: the
 *     billboard over the stage lights up with the choice, and the audience's
 *     two team-only buttons for that stage add one to or take one from the
 *     stage's vote. When the timer runs out, a positive vote fires the left
 *     doom and a negative one the right. Then the gate drops for 6 s, so
 *     everyone still standing goes through, and closes again.
 *       1. SPIKES (spike plates) or FLAMES (side jets with gaps to stand in)
 *       2. FLOOR (logic trapdoors over a gunge tank) or CRUSHERS (two waves)
 *       3. LASERS (three fences of beams) or MINES (armed for 12 s)
 *       4. SWEEPER (a bar that drops and sweeps the stage: jump it) or SQUEEZE
 *          (the side walls slam in, leaving a lane down the middle)
 *       5. INFERNO (a wall of flame rolling back at you) or ROCKFALL (a ripple)
 *   - The Wheel of Peril on the back wall settles ties. There is no random
 *     pick in logic, so the wheel is a deterministic cycle: a hinged mover
 *     flips a red-and-blue cross a quarter turn every 1.6 s, each stop sets
 *     the tie-breaker (red: left, blue: right), and a tied vote goes to
 *     whichever colour is under the pointer when the timer runs out.
 *   - The gallery sits behind safety glass (window panes at 5,000 hit
 *     points: the kit has no bulletproof glass, so this is the stand-in),
 *     under a roof, sealed off from the course by a studio force field that
 *     comes on when the show starts.
 *   - The golden buzzer at the finish ends the round: the contestant who
 *     presses it wins. If the show clock runs out first, the audience's own
 *     buzzer lights up in the gallery and the first audience member to press
 *     it wins for the audience.
 *
 * Modes: Team Deathmatch with custom logic (team sizes 4 and 12; also 2 v 6),
 * 8–16 players.
 *
 * World x along the course (east), z across it (the gallery is north, +z).
 */
import { MapBuilder } from '../mapkit.ts';

type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const PI = Math.PI;
const P = PI / 2;
const r2 = (n: number) => +n.toFixed(2);

const m = new MapBuilder('wheel_of_peril', 'Wheel of Peril');
m.theme('neon_megacity');
m.backdrop('night', 'city', 'none', 0.3);
m.teams([4, 12]);
const [CONTESTANTS, AUDIENCE] = m.teamIds(2) as [string, string];

// ---------------------------------------------------------------- looks
const STAGE_FLOORS = ['#3a2a5a', '#2a3a5a', '#2a4a4a', '#4a2a4a', '#4a3a2a'];
const FLOOR: Look = { material: 'pbr_terrazzo', tint: '#2a2838' };
const SET: Look = { material: 'pbr_concrete_dark', tint: '#1c1a26' };
const PANEL: Look = { material: 'paint_gloss', tint: '#22203a' };
const NEON_PINK: Look = { material: 'neon_tube', tint: '#ff3fb4' };
const NEON_CYAN: Look = { material: 'neon_tube', tint: '#3ff0ff' };
const GOLD: Look = { material: 'brass', tint: '#ffcc33' };
const RED: Look = { material: 'paint_gloss', tint: '#e0302a' };
const BLUE: Look = { material: 'paint_gloss', tint: '#2a62e0' };
const STEEL: Look = { material: 'pbr_steel', tint: '#9aa0aa' };
const SLIME: Look = { material: 'paint_matte', tint: '#2a3a1a' };
const CARPET: Look = { material: 'pbr_carpet', tint: '#4a1a2a' };

/** A solid box from its min to max corner (split where a side is over the block limits). */
function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, look: Look): void {
  const w = x1 - x0;
  const d = z1 - z0;
  if (w > 64 || d > 64) {
    const nx = Math.ceil(w / 64);
    const nz = Math.ceil(d / 64);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) box(x0 + (w * i) / nx, y0, z0 + (d * j) / nz, x0 + (w * (i + 1)) / nx, y1, z0 + (d * (j + 1)) / nz, look);
    return;
  }
  m.block([r2((x0 + x1) / 2), r2(y0), r2((z0 + z1) / 2)], [r2(Math.max(0.2, w)), r2(Math.max(0.1, y1 - y0)), r2(Math.max(0.2, d))], 'solid', look);
}
function ramp(a: V3, b: V3, width: number, look: Look, t = 0.4): void {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const run = Math.hypot(dx, dz);
  const rise = b[1] - a[1];
  const pitch = Math.atan2(rise, run);
  const cy = (a[1] + b[1]) / 2 - (t / 2) * Math.cos(pitch);
  m.block([r2((a[0] + b[0]) / 2), r2(cy - t / 2), r2((a[2] + b[2]) / 2)], [r2(width), t, r2(Math.hypot(run, rise))], 'solid', { ...look, pitch: r2(pitch), yaw: r2(Math.atan2(dx, dz)) });
}

// ---------------------------------------------------------------- the course
const W = 5; // half width of the course (z -5..5)
const STAGE = 14;
const N = 5;
const END = STAGE * N; // 70: the finish line
// Floor: the start (x -16..0), five stages, the finish (x 70..82). Stage 2 has a gunge tank under trapdoors.
box(-16, -0.4, -W - 0.5, 0, 0, W + 0.5, FLOOR);
for (let k = 0; k < N; k++) {
  const s = k * STAGE;
  const look = { material: 'pbr_terrazzo', tint: STAGE_FLOORS[k] };
  if (k === 1) {
    box(s, -0.4, -W - 0.5, s + 2, 0, W + 0.5, look);
    box(s + 12, -0.4, -W - 0.5, s + 14, 0, W + 0.5, look);
    box(s + 2, -0.4, -W - 0.5, s + 12, 0, -W, look);
    box(s + 2, -0.4, W, s + 12, 0, W + 0.5, look);
  } else box(s, -0.4, -W - 0.5, s + STAGE, 0, W + 0.5, look);
}
box(END, -0.4, -W - 0.5, END + 12, 0, W + 0.5, { material: 'pbr_terrazzo', tint: '#5a4a1a' });
// Walls: the studio set behind (south, 6 m), a 4 m wall under the gallery (north), the ends.
box(-16, 0, -W - 1.5, END + 12, 6, -W - 0.5, SET);
box(-16, 0, W + 0.5, -15, 4, W + 1, SET);
box(-12, 0, W + 0.5, END + 12, 4, W + 1, SET);
box(-16.5, 0, -W - 1.5, -16, 6, W + 1, SET);
box(END + 12, 0, -W - 1.5, END + 12.5, 6, W + 1, SET);
// Neon edging along the wall tops and the stage lines on the floor.
box(-16, 6, -W - 1.5, END + 12, 6.2, -W - 1.3, NEON_PINK);
box(-16, 4, W + 0.8, END + 12, 4.2, W + 1, NEON_CYAN);
for (let k = 0; k <= N; k++) box(k * STAGE - 0.15, 0, -W - 0.5, k * STAGE + 0.15, 0.1, W + 0.5, k === N ? GOLD : NEON_CYAN);
// The backdrop behind the set: a tall dark wall the wheel hangs on.
box(-16, 6, -W - 2.2, END + 12, 22, -W - 1.5, PANEL);

// ---------------------------------------------------------------- the gunge tank under stage 2
const T0 = STAGE + 2;
const T1 = STAGE + 12;
box(T0 - 0.4, -5, -W, T1 + 0.4, -4.5, W, SLIME);
box(T0 - 0.4, -4.5, -W, T0, -0.4, W, SET);
box(T1, -4.5, -W, T1 + 0.4, -0.4, W, SET);
box(T0, -4.5, -W - 0.4, T1, -0.4, -W, SET);
box(T0, -4.5, W, T1, -0.4, W + 0.4, SET);
m.water([(T0 + T1) / 2, -4.5, 0], [10, 1, 10], 'acid', '#7ad02a');
m.add({ kind: 'ladder', position: [T0 + 0.4, -4.5, 0], yaw: P, height: 4.5, width: 1.4, name: 'Out of the gunge' });
const TRAPDOORS: string[] = [];
for (const dx of [0, 1, 2]) for (const dz of [-1, 0, 1]) {
  const id = `floor_${dx}${dz + 1}`;
  TRAPDOORS.push(id);
  m.block([r2(T0 + 10 / 6 + (dx * 10) / 3), -0.3, r2((dz * 10) / 3)], [3.3, 0.3, 3.3], 'trapdoor', { material: 'pbr_terrazzo', tint: STAGE_FLOORS[1], trigger: 'logic', respawn: 4, id });
}

// ---------------------------------------------------------------- gates (force fields at the end of every stage, and the start)
const GATES = ['gate_0', ...Array.from({ length: N }, (_, k) => `gate_${k + 1}`)];
// They come up when the show starts (so bots and the validator see the course as one run, as it is between votes).
GATES.forEach((id, k) => m.field([k * STAGE, 0, 0], 2 * W, 4, { yaw: P, id, tint: k === 0 ? '#ffcc33' : '#ff3f6a', hidden: true }));

// ---------------------------------------------------------------- the dooms
const trap = (id: string, kind: 'spikes' | 'flames' | 'crusher' | 'mine' | 'laser', at: V3, yaw: number, o: { on?: number; off?: number; damage?: number; enabled?: boolean; activation?: 'logic' | 'proximity'; style?: 'rockfall' } = {}) =>
  m.add({ kind: 'trap', id, name: id, trap: kind, position: at, yaw, activation: o.activation ?? 'logic', onSeconds: o.on ?? 2, offSeconds: o.off ?? 2, offsetSeconds: 0, startEnabled: o.enabled ?? true, damage: o.damage ?? null, ...(o.style ? { style: o.style } : {}) });
const grid = (s: number) => [3.5, 7, 10.5].flatMap((dx) => [-3.4, 0, 3.4].map((z) => [s + dx, z] as const));
// 1. SPIKES or FLAMES
const S1 = 0;
const SPIKES = grid(S1).map(([x, z], i) => (trap(`spikes_${i}`, 'spikes', [x, 0, z], 0, { on: 1.5 }), `spikes_${i}`));
const FLAMES: string[] = [];
for (const dx of [3, 7, 11]) for (const side of [-1, 1]) {
  const id = `flames_${dx}_${side > 0 ? 'n' : 's'}`;
  FLAMES.push(id);
  trap(id, 'flames', [S1 + dx, 0, side * (W - 0.3)], side > 0 ? PI : 0, { on: 3 });
}
// 2. FLOOR or CRUSHERS (two waves, a chequerboard)
const S2 = STAGE;
const CRUSH_A: string[] = [];
const CRUSH_B: string[] = [];
grid(S2).forEach(([x, z], i) => {
  const id = `crusher_${i}`;
  (i % 2 === 0 ? CRUSH_A : CRUSH_B).push(id);
  trap(id, 'crusher', [x, 0, z], 0, { on: 1.2 });
});
// 3. LASERS or MINES
const S3 = STAGE * 2;
const LASERS: string[] = [];
for (const dx of [3.5, 7, 10.5]) for (const z of [-3.4, 0, 3.4]) {
  const id = `laser_${dx}_${z < 0 ? 's' : z > 0 ? 'n' : 'm'}`.replace('.', '');
  LASERS.push(id);
  trap(id, 'laser', [S3 + dx, 0, z], P, { on: 3, damage: 50 });
}
const MINES: string[] = [];
for (const [dx, z] of [[3, -2.5], [4.5, 2.8], [6.5, 0], [8, -3.6], [9, 3.4], [11, -1], [12, 2]] as const) {
  const id = `mine_${MINES.length}`;
  MINES.push(id);
  trap(id, 'mine', [S3 + dx, 0, z], 0, { activation: 'proximity', enabled: false, on: 0.5, off: 20 });
}
// 4. SWEEPER or SQUEEZE
const S4 = STAGE * 3;
m.block([S4 + 1, 5, 0], [0.8, 0.9, 2 * W - 0.4], 'solid', { ...NEON_PINK, id: 'sweeper_bar' });
m.mover('sweeper', [S4 + 1, 5, 0], ['sweeper_bar'], [[0, 0, 0], [0, -4.95, 0], [12, -4.95, 0], [12, 0, 0]], { mode: 'trigger', speed: 8, wait: 0, name: 'Sweeper' });
for (const side of [-1, 1]) {
  const id = `squeeze_${side > 0 ? 'n' : 's'}`;
  m.block([S4 + 7, 0, side * (W - 0.35)], [12, 3, 0.6], 'solid', { ...STEEL, id: `${id}_wall` });
  m.mover(id, [S4 + 7, 0, side * (W - 0.35)], [`${id}_wall`], [[0, 0, 0], [0, 0, -side * 3.45]], { mode: 'trigger', speed: 6, wait: 0, name: 'Squeeze wall' });
}
// 5. INFERNO or ROCKFALL
const S5 = STAGE * 4;
const INFERNO_FAR: string[] = [];
const INFERNO_NEAR: string[] = [];
for (const z of [-3.75, -1.25, 1.25, 3.75]) {
  INFERNO_FAR.push(`inferno_far_${INFERNO_FAR.length}`);
  trap(INFERNO_FAR.at(-1)!, 'flames', [S5 + 13.4, 0, z], -P, { on: 2.5 });
  INFERNO_NEAR.push(`inferno_near_${INFERNO_NEAR.length}`);
  trap(INFERNO_NEAR.at(-1)!, 'flames', [S5 + 7.6, 0, z], -P, { on: 2.5 });
}
const ROCKS: string[] = [];
for (const [dx, z] of [[3.5, -3.4], [3.5, 3.4], [7, 0], [10.5, -3.4], [10.5, 3.4], [7, -3.6], [7, 3.6]] as const) {
  ROCKS.push(`rocks_${ROCKS.length}`);
  trap(ROCKS.at(-1)!, 'crusher', [S5 + dx, 0, z], 0, { on: 1.2, style: 'rockfall' });
}

// ---------------------------------------------------------------- the stage zones (contestants only)
for (let k = 0; k < N; k++) m.add({ kind: 'zone', id: `zone_${k + 1}`, name: `Stage ${k + 1}`, position: [k * STAGE + 7, 0, 0], size: [12.6, 4, 2 * W], who: 'any', count: 1, startEnabled: true, team: CONTESTANTS });

// ---------------------------------------------------------------- the audience gallery (north, floor 6 m up, behind glass)
const GZ0 = W + 3.6; // 8.6: the gallery front
const GZ1 = 18;
const GY = 6;
box(-6, 0, W + 1, END + 6, GY - 0.4, GZ1, SET); // the gallery's footing, filling in behind the course wall
box(-6, GY - 0.4, GZ0, END + 6, GY, GZ1, CARPET);
box(-6, GY, GZ0, END + 6, GY + 1.1, GZ0 + 0.4, PANEL); // parapet
box(-6.5, GY, GZ0, -6, 10.2, 9.7, SET); // west end: a doorway from the ramp
box(-6.5, GY, 13.3, -6, 10.2, GZ1, SET);
box(-6.5, GY + 3.2, 9.7, -6, 10.2, 13.3, SET);
box(END + 6, GY, GZ0, END + 6.5, 10.2, GZ1, SET);
box(-6.5, GY, GZ1, END + 6.5, 10.2, GZ1 + 0.5, SET);
box(-6.5, 9.8, GZ0 - 0.2, END + 6.5, 10.2, GZ1 + 0.5, PANEL); // roof
box(-6.5, 9.6, GZ0 - 0.2, END + 6.5, 9.8, GZ0, NEON_PINK);
// Safety glass: two rows of panes from the parapet to the roof.
for (let x = -6 + 1.3; x < END + 6; x += 2.55) for (const y of [GY + 0.1, GY + 1.4]) m.add({ kind: 'destructible', model: 'glass', position: [r2(x), r2(y), GZ0 + 0.2], yaw: 0, health: 5000, explosiveOnly: false, name: 'Safety glass' });
// A back row on a riser (0.25 m steps up), benches.
box(-6, GY, GZ1 - 3, END + 6, GY + 0.25, GZ1, CARPET);
for (let x = 2; x < END; x += 8) m.prop('bench', [x, GY + 0.25, GZ1 - 1.2], PI);
// The way up from the start (sealed by a studio force field once the show is on).
box(-20, -0.4, W + 1, -6, 0, 14, FLOOR);
box(-15, -0.4, W + 0.5, -12, 0, W + 1, FLOOR); // the doorway's sill
box(-20.5, 0, W + 1, -20, GY + 4, 14.5, SET);
box(-20, 0, 14, -6, GY + 4, 14.5, SET);
box(-20, 0, W + 0.5, -16, GY + 4, W + 1, SET);
ramp([-17.6, 0, 11.5], [-6, GY, 11.5], 3.2, PANEL);
m.field([-13.5, 0, W + 0.75], 3, 4, { id: 'studio_door', tint: '#ffcc33', hidden: true });

// ---------------------------------------------------------------- vote buttons (team-only, two per stage)
const DOOMS: [string, string][] = [['SPIKES', 'FLAMES'], ['FLOOR', 'CRUSHERS'], ['LASERS', 'MINES'], ['SWEEPER', 'SQUEEZE'], ['INFERNO', 'ROCKFALL']];
for (let k = 0; k < N; k++) {
  const s = k * STAGE;
  for (const [side, dx, look] of [['l', 4, RED], ['r', 10, BLUE]] as const) {
    box(s + dx - 1.2, GY, GZ0 + 0.6, s + dx + 1.2, GY + 1, GZ0 + 2.2, look); // the giant button's pedestal
    m.add({ kind: 'button', id: `vote_${side}${k + 1}`, name: `Vote ${DOOMS[k]![side === 'l' ? 0 : 1]}`, position: [s + dx, GY, GZ0 + 2.4], yaw: 0, label: `Vote ${DOOMS[k]![side === 'l' ? 0 : 1]}`, once: false, cooldownSeconds: 0.4, startEnabled: true, team: AUDIENCE });
    m.light([s + dx, GY + 2.2, GZ0 + 1.6], { id: `sign_${side}${k + 1}`, fixture: 'sign', text: DOOMS[k]![side === 'l' ? 0 : 1], color: side === 'l' ? '#ff3a30' : '#3a7aff', size: [2.6, 0.8], yaw: 0, intensity: 1, range: 5 });
  }
  // The billboard over the stage: the choice, lit while the vote is open.
  m.light([s + 7, 9.5, -W - 1.4], { id: `board_${k + 1}`, fixture: 'billboard', text: `${DOOMS[k]![0]} OR ${DOOMS[k]![1]}`, color: '#ff4fd8', size: [11, 2.6], yaw: 0, intensity: 1.2, range: 10, off: true });
  m.light([s + STAGE - 0.6, 4.6, -W - 0.4], { id: `gatelamp_${k + 1}`, fixture: 'bulb', color: '#ff2a2a', intensity: 1.2, range: 6 });
}

// ---------------------------------------------------------------- the Wheel of Peril (back wall, over stage 3)
// A red and a blue bar crossed on a hinge square to the wall: each quarter turn swaps which colour points up.
const WX = STAGE * 2 + 7;
const WY = 15;
const WZ = -W - 1.2;
m.block([WX, WY - 5, WZ], [1.4, 10, 0.4], 'solid', { ...RED, id: 'wheel_red' });
m.block([WX, WY - 0.7, WZ], [10, 1.4, 0.4], 'solid', { ...BLUE, id: 'wheel_blue' });
m.block([WX, WY - 0.9, WZ + 0.1], [1.8, 1.8, 0.5], 'solid', { ...GOLD, id: 'wheel_hub' });
m.mover('wheel', [WX, WY, WZ], ['wheel_red', 'wheel_blue', 'wheel_hub'], [[0, 0, 0], [0, 0, 0]], { mode: 'pingpong', yaw: P, angles: [0, P], turnSpeed: 180, wait: 1.1, name: 'Wheel of Peril' });
// The pointer over the top, the frame round it.
m.block([WX, WY + 5.6, WZ + 0.2], [1.2, 1.2, 0.4], 'solid', { ...GOLD, roll: PI / 4 });
for (const [dx, dy, w, h] of [[-6, 0, 0.4, 12.4], [6, 0, 0.4, 12.4], [0, -6, 12.4, 0.4], [0, 6.2, 12.4, 0.4]] as const) m.block([WX + dx, WY + dy - h / 2, WZ - 0.4], [w, h, 0.3], 'solid', NEON_CYAN);
m.light([WX - 7.5, WY, WZ + 0.6], { id: 'wheel_lamp_l', fixture: 'sign', text: 'TIE: LEFT', color: '#ff3a30', size: [3, 0.9], intensity: 1, range: 6 });
m.light([WX + 7.5, WY, WZ + 0.6], { id: 'wheel_lamp_r', fixture: 'sign', text: 'TIE: RIGHT', color: '#3a7aff', size: [3, 0.9], intensity: 1, range: 6, off: true });
m.light([WX, WY + 8.5, WZ + 0.6], { fixture: 'sign', text: 'WHEEL OF PERIL', color: '#ffcc33', size: [12, 1.8], intensity: 1.4, range: 14 });

// ---------------------------------------------------------------- start podiums, finish and the golden buzzer
for (const [x, z] of [[-13.5, -3.3], [-13.5, -1.1], [-5, -3.6], [-5, 3.6]] as const) m.prop('os_console_corner', [x, 0, z], P, 1);
box(END + 7, 0, -1.5, END + 10, 1.1, 1.5, GOLD);
m.add({ kind: 'button', id: 'golden_buzzer', name: 'Golden buzzer', position: [END + 6.8, 0, 0], yaw: -P, label: 'Hit the golden buzzer', once: true, cooldownSeconds: 1, startEnabled: true, team: CONTESTANTS });
m.light([END + 8.5, 3, 0], { id: 'buzzer_lamp', fixture: 'bulb', color: '#ffcc33', intensity: 1.6, range: 10 });
// The audience's buzzer, lit only once the show clock runs out.
box(END + 1, GY, GZ1 - 4.5, END + 3, GY + 1, GZ1 - 3, GOLD);
m.add({ kind: 'button', id: 'audience_buzzer', name: 'Audience buzzer', position: [END + 2, GY, GZ1 - 4.7], yaw: PI, label: 'The audience wins!', once: true, cooldownSeconds: 1, startEnabled: false, team: AUDIENCE });
m.light([END + 2, GY + 2.5, GZ1 - 3.6], { id: 'audience_lamp', fixture: 'bulb', color: '#ffcc33', intensity: 1.4, range: 8, off: true });

// ---------------------------------------------------------------- spawns
for (const [x, z] of [[-11, -3.3], [-11, -1.1], [-11, 1.1], [-11, 3.3], [-8, -2.2], [-8, 2.2]] as const) m.spawn([x, 0, z], P, CONTESTANTS);
for (let i = 0; i < 12; i++) m.spawn([r2(-2 + i * 6.4), GY, i % 2 ? 13.2 : 11.6], PI, AUDIENCE);

// ---------------------------------------------------------------- pickups (the contestants' course)
const ITEMS: [string, V3, number?][] = [
  ['health_large', [-15, 0, 4.5]], ['armor_small', [-8, 0, 0]], ['health_small', [STAGE + 13, 0, 4]], ['health_small', [STAGE * 3 + 1, 0, -4]],
  ['health_small', [STAGE * 4 + 1, 0, 4]], ['armor_small', [STAGE * 2 + 13, 0, -4]], ['powerup_speed', [STAGE * 2 + 1, 0, 0], 60],
];
for (const [item, p, r] of ITEMS) m.pickup(item, p, r ?? null);

// ---------------------------------------------------------------- studio dressing and lights
for (let x = -12; x <= END + 8; x += 14) m.prop('nc_neon_barrier', [x, 0, -W + 0.4], 0, 1, true);
for (const x of [-10, END + 4]) m.prop('nc_holo_kiosk', [x, GY, GZ1 - 1], PI);
for (let x = -9; x <= END + 9; x += 16) m.light([x, 9, 0], { fixture: 'none', color: x % 32 === 7 ? '#ff4fd8' : '#7a9aff', intensity: 1.2, range: 16 });
for (let x = 2; x <= END; x += 20) m.light([x, 9.4, GZ0 + 4.5], { fixture: 'strip', color: '#ffd7f0', intensity: 0.9, range: 10 });
m.light([-11, 4, 0], { fixture: 'none', color: '#ffcc33', intensity: 1, range: 8 });
m.light([-11, 5, 11], { fixture: 'none', color: '#9a7aff', intensity: 0.8, range: 8 });
m.light([STAGE + 7, -2.5, 0], { fixture: 'none', color: '#7ad02a', intensity: 1, range: 8 });

// ---------------------------------------------------------------- logic
type Rule = Parameters<MapBuilder['logic']>[0]['rules'][number];
type Action = Rule['do'][number];
type Condition = Rule['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: Rule['when']['event'], target: string | null, does: Action[], ifs: Condition[] = [], once = false): Rule => ({ id, name, enabled: true, once, when: { event, target }, if: ifs, do: does });
const fire = (ids: string[]) => ids.map((t) => act('trap_fire', t));
const wait = (s: number) => act('wait', null, { value: s });
const say = (text: string, s = 3) => act('message', null, { value: s, text });

/** Each stage's two dooms, as action lists. */
const DOOM: [Action[], Action[]][] = [
  [[...fire(SPIKES), wait(1.8), ...fire(SPIKES)], [...fire(FLAMES)]],
  [[...TRAPDOORS.map((t) => act('block_drop', t))], [...fire(CRUSH_A), wait(1.6), ...fire(CRUSH_B)]],
  [[...fire(LASERS)], [...MINES.map((t) => act('enable', t)), wait(12), ...MINES.map((t) => act('disable', t))]],
  [[act('mover_to', 'sweeper', { value: 2 }), wait(0.9), act('mover_to', 'sweeper', { value: 3 }), wait(2), act('mover_to', 'sweeper', { value: 4 }), wait(0.8), act('mover_to', 'sweeper', { value: 1 })], [act('mover_to', 'squeeze_n', { value: 2 }), act('mover_to', 'squeeze_s', { value: 2 }), wait(2.2), act('mover_to', 'squeeze_n', { value: 1 }), act('mover_to', 'squeeze_s', { value: 1 })]],
  [[...fire(INFERNO_FAR), wait(1.4), ...fire(INFERNO_NEAR)], [...ROCKS.flatMap((t) => [act('trap_fire', t), wait(0.35)])]],
];

const variables = [{ id: 'var_tie', name: 'tie-breaker (1 left, 2 right)', initial: 1 }];
const timers = [
  { id: 'timer_curtain', name: 'Curtain up', seconds: 8, loop: false, visible: true },
  { id: 'timer_show', name: 'Show clock', seconds: 300, loop: false, visible: true },
  { id: 'timer_encore', name: 'Audience buzzer', seconds: 20, loop: false, visible: true },
];
const rules: Rule[] = [
  rule('rule_curtain', 'Curtain up', 'match_start', null, [act('block_restore', 'studio_door'), ...GATES.map((g) => act('block_restore', g)), say('Welcome to WHEEL OF PERIL! Contestants, to your podiums. Audience, the buttons are yours!', 6), act('timer_start', 'timer_curtain')]),
  rule('rule_go', 'The show starts', 'timer_done', 'timer_curtain', [act('block_drop', 'gate_0'), act('sound', null, { state: 'chime' }), say('GO! Reach the golden buzzer!', 3), act('timer_start', 'timer_show')]),
  rule('rule_buzzer', 'Golden buzzer', 'button_pressed', 'golden_buzzer', [act('sound', null, { state: 'chime' }), act('light_blink', 'buzzer_lamp', { value: 4, state: 'on' }), say('GOLDEN BUZZER! We have a winner!', 4), act('end_round', null, { state: 'instigator wins' })]),
  rule('rule_clock', 'Show clock runs out', 'timer_done', 'timer_show', [act('sound', null, { state: 'buzzer' }), act('enable', 'audience_buzzer'), act('light_on', 'audience_lamp'), act('light_blink', 'audience_lamp', { value: 3, state: 'on' }), say("Time's up! Audience, hit your buzzer!", 4), act('timer_start', 'timer_encore')]),
  rule('rule_audience', 'The audience wins', 'button_pressed', 'audience_buzzer', [act('timer_stop', 'timer_encore'), say('The audience takes the prize!', 4), act('end_round', null, { state: 'instigator wins' })]),
  rule('rule_encore', 'Nobody pressed it', 'timer_done', 'timer_encore', [say('Nobody wins tonight. Goodnight!', 4), act('end_round', null, { state: 'nobody wins' })]),
  // The wheel: every stop sets the tie-breaker and its lamps.
  rule('rule_wheel_red', 'Wheel: red up', 'mover_arrived', 'wheel', [act('set_var', 'var_tie', { value: 1 }), act('light_on', 'wheel_lamp_l'), act('light_off', 'wheel_lamp_r')], [cond('mover_at', 'wheel', '==', 1)]),
  rule('rule_wheel_blue', 'Wheel: blue up', 'mover_arrived', 'wheel', [act('set_var', 'var_tie', { value: 2 }), act('light_on', 'wheel_lamp_r'), act('light_off', 'wheel_lamp_l')], [cond('mover_at', 'wheel', '==', 2)]),
];
for (let k = 1; k <= N; k++) {
  const [left, right] = DOOMS[k - 1]!;
  const [doomL, doomR] = DOOM[k - 1]!;
  variables.push({ id: `var_vote_${k}`, name: `stage ${k} vote`, initial: 0 }, { id: `var_busy_${k}`, name: `stage ${k} running`, initial: 0 });
  timers.push({ id: `timer_vote_${k}`, name: `Stage ${k}: ${left} or ${right}?`, seconds: 8, loop: false, visible: true }, { id: `timer_again_${k}`, name: `Stage ${k} reset`, seconds: 1.5, loop: false, visible: false });
  const open: Action[] = [act('set_var', `var_busy_${k}`, { value: 1 }), act('set_var', `var_vote_${k}`, { value: 0 }), act('light_on', `board_${k}`), act('light_blink', `board_${k}`, { value: 2, state: 'on' }), act('timer_start', `timer_vote_${k}`), act('sound', null, { state: 'chime' }), say(`Stage ${k}: ${left} or ${right}? Audience, vote!`, 3)];
  const idle = cond('variable', `var_busy_${k}`, '==', 0);
  const pick = (word: string, side: 'l' | 'r', doom: Action[]): Action[] => [act('light_blink', `board_${k}`, { value: 0, state: 'off' }), act('light_color', `board_${k}`, { text: side === 'l' ? '#ff3a30' : '#3a7aff' }), act('light_flash', `sign_${side}${k}`, { value: 2 }), act('sound', null, { state: 'alarm' }), say(`${word}!`, 2), ...doom];
  rules.push(
    rule(`rule_enter_${k}`, `Stage ${k}: a contestant steps in`, 'zone_enter', `zone_${k}`, open, [idle]),
    rule(`rule_again_${k}`, `Stage ${k}: still someone waiting`, 'timer_done', `timer_again_${k}`, open, [idle, cond('zone_count', `zone_${k}`, '>=', 1)]),
    rule(`rule_vote_l${k}`, `Stage ${k}: vote ${left}`, 'button_pressed', `vote_l${k}`, [act('add_var', `var_vote_${k}`, { value: 1 }), act('light_flash', `sign_l${k}`, { value: 0.3 })], [cond('variable', `var_busy_${k}`, '==', 1)]),
    rule(`rule_vote_r${k}`, `Stage ${k}: vote ${right}`, 'button_pressed', `vote_r${k}`, [act('add_var', `var_vote_${k}`, { value: -1 }), act('light_flash', `sign_r${k}`, { value: 0.3 })], [cond('variable', `var_busy_${k}`, '==', 1)]),
    rule(`rule_doom_l${k}`, `Stage ${k}: ${left} wins the vote`, 'timer_done', `timer_vote_${k}`, pick(left, 'l', doomL), [cond('variable', `var_vote_${k}`, '>', 0)]),
    rule(`rule_doom_r${k}`, `Stage ${k}: ${right} wins the vote`, 'timer_done', `timer_vote_${k}`, pick(right, 'r', doomR), [cond('variable', `var_vote_${k}`, '<', 0)]),
    rule(`rule_tie_l${k}`, `Stage ${k}: a tie, the wheel says ${left}`, 'timer_done', `timer_vote_${k}`, [say('A tie! The Wheel of Peril decides...', 2), ...pick(left, 'l', doomL)], [cond('variable', `var_vote_${k}`, '==', 0), cond('variable', 'var_tie', '==', 1)]),
    rule(`rule_tie_r${k}`, `Stage ${k}: a tie, the wheel says ${right}`, 'timer_done', `timer_vote_${k}`, [say('A tie! The Wheel of Peril decides...', 2), ...pick(right, 'r', doomR)], [cond('variable', `var_vote_${k}`, '==', 0), cond('variable', 'var_tie', '==', 2)]),
    rule(`rule_gate_${k}`, `Stage ${k}: the gate opens`, 'timer_done', `timer_vote_${k}`, [
      wait(4.5),
      act('block_drop', `gate_${k}`),
      act('light_color', `gatelamp_${k}`, { text: '#2aff6a' }),
      act('light_off', `board_${k}`),
      act('light_color', `board_${k}`, { text: '' }),
      wait(6),
      act('block_restore', `gate_${k}`),
      act('light_color', `gatelamp_${k}`, { text: '' }),
      act('set_var', `var_busy_${k}`, { value: 0 }),
      act('timer_start', `timer_again_${k}`),
    ]),
  );
}
m.logic({ variables, timers, objectives: [], rules });

// ---------------------------------------------------------------- bounds and metadata
m.bounds('invisible', 0, { min: [-22, -10], max: [END + 14, GZ1 + 2] }, 60);
m.meta({
  description:
    "A TV game show. Four contestants run a neon studio course of five stages while twelve audience members in the gallery above, behind safety glass, slam giant team-only buttons to pick each stage's doom: SPIKES or FLAMES, FLOOR or CRUSHERS, LASERS or MINES, SWEEPER or SQUEEZE, INFERNO or ROCKFALL. Each vote runs 8 s once a contestant steps in; then the gate at the end of the stage drops for 6 s. Ties go to the Wheel of Peril, a red-and-blue cross flipping a quarter turn on the back wall. The golden buzzer wins it for the contestant who reaches it; when the show clock runs out, the audience gets a buzzer of its own.",
  modes: ['core.tdm'],
  players: [8, 16],
});
await m.save();
