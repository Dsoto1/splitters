/**
 * Obsidian Orb: a battle-station interior and its surface trench (our own map
 * and name; a layout and atmosphere homage built only from our kit), for
 * 12–24 players in Bomb, Capture the Flag, King of the Hill, Team Deathmatch
 * and Deathmatch. Built on Style Pack 04 Orbital Station, painted gunmetal
 * grey with grated floors.
 *
 * - The reactor shaft (centre): a bottomless shaft inside the ring of grey
 *   corridors, the reactor glowing far below. Four bridges run out to the
 *   reactor-control island in the middle; each retracts into the walls (a
 *   sliding mover) from the console at its landing for 6 s, and the island's
 *   console pulls all of them in for 8 s: strand whoever is chasing you.
 *   Bomb site A is the reactor control.
 * - Hangar bay (south): two skyfighters and a shuttle on the pad, its mouth
 *   open to space behind a force field (the hangar console, or cutting the
 *   tractor beam, drops it).
 * - Trash compactor (south-west): murky water and junk; its walls grind
 *   inward on a timer (or the console outside), the way in seals and the
 *   hatch out to the chute opens; the walls stop 2 m apart and push rather
 *   than crush.
 * - Detention block (west): three cells behind team doors (only the
 *   garrison walks in) along a corridor; the control room's console throws
 *   every cell open for 10 s.
 * - Tractor-beam shaft (north-west): narrow catwalks over a bottomless drop
 *   to a ledge round the beam pylon and its power-coupling panel, which
 *   cuts the hangar field for 15 s.
 * - Throne room (north-east): a dark hall with a raised throne and a wall of
 *   windows onto the stars, a skylight above.
 * - The trench (east, through the airlock): a long metal canyon on the
 *   station's surface in low gravity, turbolaser turrets (rocket and MG
 *   mounts) on ramps along both walls, and the exhaust port at the far end:
 *   bomb site B.
 *
 * Teams: the first team (the raiders) come in by the hangar; the garrison
 * holds the detention block and the throne room. CTF: hangar against
 * detention. KOTH: the shaft island, the throne room, the trench.
 *
 * Grid x east, y north (one cell = 8 m); everything is on level 0.
 *
 *   y 3..5   [acc][ tractor shaft (void) ][ THRONE HALL 3 × 3 ]
 *   y 2      [ctl][ ring ............................... ]
 *   y -1..1  [cells][det] ring [  REACTOR SHAFT  ] ring [air][ TRENCH x 5..18 ... port ]
 *   y -2              [ ring ................................ ]
 *   y -4..-3     [compactor][  HANGAR 3 × 3 (mouth south) ]
 *   y -5         [chute][chute][                         ]
 *          x -5 -4  -3  -2  -1   0   1   2   3   4   5 ...
 */
import { type EdgeStyle, type LogicAction, type LogicCondition, type LogicRule, type RoomOptions, type Side, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('obsidian_orb', 'Obsidian Orb');
m.theme('orbital');
m.backdrop('space', 'none', 'none', 0);
m.teams([12, 12]);
const [RAID, GARRISON] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];
const edge = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => m.edge(x, y, z, side, style);

const ROOM: RoomOptions = { layout: 'empty', ceiling: 'roof' };
const METAL = { material: 'pbr_space_metal', tint: '#8a9098' };
const DARK = { material: 'pbr_tread_plate', tint: '#5a5f66' };
const GRATE = { material: 'grate', tint: '#9aa2aa' };

// ---------------------------------------------------------------- tiles

// The ring of corridors round the reactor shaft (x -3..3, y -2..2).
const RING: [number, number][] = [];
for (let x = -3; x <= 3; x++) RING.push([x, -2], [x, 2]);
for (let y = -1; y <= 1; y++) RING.push([-3, y], [3, y]);
for (const [x, y] of RING) m.tile('room', x, y, 0, 0, ROOM);
// Hangar bay south (x -1..1, y -5..-3), its mouth to the south.
m.tile('orbital.hangar', -1, -5, 0);
// Trash compactor (x -3, y -4..-3) and the chute out of it to the hangar.
m.tile('room_long', -3, -4, 0, 0, { layout: 'empty', ceiling: 'roof' });
for (const x of [-3, -2]) m.tile('room', x, -5, 0, 0, ROOM);
// Detention block: the cell corridor (x -4), the cells (x -5), the control room (-4, 2), and on to the tractor shaft.
for (const y of [-1, 0, 1]) {
  m.tile('room', -4, y, 0, 0, ROOM);
  m.tile('room', -5, y, 0, 0, ROOM);
}
for (const y of [2, 3, 4]) m.tile('room', -4, y, 0, 0, ROOM);
// Throne room (x 0..2, y 3..5): a skylight onto the stars.
m.tile('hall', 0, 3, 0, 0, { layout: 'empty', ceiling: 'skylight', corners: 'columns' });
// Airlock east and the trench beyond it (x 5..18, y -1..1).
m.tile('room', 4, 0, 0, 0, ROOM);
for (let x = 5; x <= 18; x++) for (let y = -1; y <= 1; y++) m.tile('platform', x, y, 0);

// Gunmetal grey everywhere, grated floors.
const GREY: TileSurfaces = {
  walls: { material: 'core.orbital_panel', tint: '#80868e' },
  floor: { material: 'core.grate', tint: '#8a9299' },
  solids: { material: 'core.pbr_space_metal', tint: '#9aa0a8' },
  underside: { material: 'core.orbital_panel', tint: '#5c6168' },
};
for (const t of [...m.doc.classicStructure.tiles]) {
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...GREY } }] });
}

// ---------------------------------------------------------------- walls and openings

// Reactor shaft: a bridge doorway in the middle of each side, windows onto the shaft either side.
edge(-3, 0, 0, 'E', 'door').edge(3, 0, 0, 'W', 'door').edge(0, 2, 0, 'S', 'door').edge(0, -2, 0, 'N', 'door');
for (const y of [-1, 1]) edge(-3, y, 0, 'E', 'window').edge(3, y, 0, 'W', 'window');
for (const x of [-2, -1, 1, 2]) edge(x, 2, 0, 'S', 'windows').edge(x, -2, 0, 'N', 'windows');
// Hangar: a wide door from the ring, windows either side; the mouth open to space on both storeys.
edge(0, -3, 0, 'N', 'wide').edge(-1, -3, 0, 'N', 'window').edge(1, -3, 0, 'N', 'window');
for (const x of [-1, 0, 1]) {
  edge(x, -5, 0, 'S', 'open');
  edge(x, -5, 1, 'S', 'open');
}
// Detention: one way in from the ring (and the control room's own door); bars between the cells.
edge(-4, -1, 0, 'E', 'wall').edge(-4, 1, 0, 'E', 'wall');
edge(-5, -1, 0, 'N', 'bars').edge(-5, 0, 0, 'N', 'bars');
// Tractor shaft: doorways out onto the catwalks from the ring, the throne room and the west access.
edge(-2, 2, 0, 'N', 'door').edge(0, 4, 0, 'W', 'door').edge(-4, 4, 0, 'E', 'door');
// Throne room: one grand doorway from the ring; the wall of windows north and east onto the stars.
edge(0, 2, 0, 'N', 'wall').edge(2, 2, 0, 'N', 'wall').edge(1, 2, 0, 'N', 'wide');
for (const x of [0, 1, 2]) edge(x, 5, 0, 'N', 'windows');
for (const y of [3, 4, 5]) edge(2, y, 0, 'E', 'windows');
// Windows onto space round the outside of the ring.
for (const [x, y, side] of [[-2, -2, 'S'], [2, -2, 'S'], [3, -2, 'E'], [3, 2, 'E'], [3, 2, 'N'], [-3, -2, 'W']] as const) edge(x, y, 0, side, 'windows');
for (const y of [-1, 0, 1]) edge(-5, y, 0, 'W', 'window');

// ---------------------------------------------------------------- the reactor shaft (x -20..20, z -12..12)

// Shaft walls plunging away below the floor, and the reactor glowing at the bottom.
m.block([0, -30, -12.3], [40.6, 30, 0.6], 'solid', METAL);
m.block([0, -30, 12.3], [40.6, 30, 0.6], 'solid', METAL);
m.block([-20.3, -30, 0], [0.6, 30, 24], 'solid', METAL);
m.block([20.3, -30, 0], [0.6, 30, 24], 'solid', METAL);
for (const y of [-6, -16]) {
  m.block([0, y, -11.8], [40, 0.4, 0.4], 'solid', { material: 'glow_trim', tint: '#ff7a3a' });
  m.block([0, y, 11.8], [40, 0.4, 0.4], 'solid', { material: 'glow_trim', tint: '#ff7a3a' });
}
m.block([0, -36, 0], [12, 1, 12], 'solid', DARK);
m.prop('os_reactor_core', [0, -35, 0], 0, 4);
m.light([0, -24, 0], { fixture: 'none', color: '#ff6a2a', intensity: 3, range: 30 });
m.light([0, -8, 0], { fixture: 'none', color: '#ff8a4a', intensity: 1.6, range: 18 });

// The reactor-control island in the middle, and its consoles.
m.block([0, -3, 0], [8, 3, 8], 'solid', METAL);
m.block([0, -0.05, 0], [8.1, 0.1, 8.1], 'solid', GRATE);
m.prop('os_console_corner', [-2.6, 0, 2.6], S + P / 2).prop('os_terminal', [2.6, 0, 2.6], S).prop('computer_bank', [2.8, 0, -2.6], -P).prop('os_power_unit', [-2.8, 0, -2.8], P);
m.add({ kind: 'button', id: 'btn_island', name: 'Reactor control: bridges', position: [-1.6, 1.2, 3.4], yaw: S, label: 'Retract every bridge', once: false, cooldownSeconds: 20, startEnabled: true });
m.light([0, 3.2, 0], { fixture: 'none', color: '#9fd8ff', intensity: 1.4, range: 9 });

/**
 * A retractable bridge: segments of deck (3 m wide) between a landing and the
 * island, each on its own mover: down 0.7 m, then into the wall (or under the
 * island) and back. `dir` is the way a segment retracts.
 */
type Seg = { id: string; c: V3; size: V3; dir: V3 };
const SEGS: Seg[] = [
  { id: 'bw_out', c: [-16, -0.3, 0], size: [8, 0.3, 3], dir: [-8.6, 0, 0] },
  { id: 'bw_in', c: [-8, -0.3, 0], size: [8, 0.3, 3], dir: [8.6, 0, 0] },
  { id: 'be_out', c: [16, -0.3, 0], size: [8, 0.3, 3], dir: [8.6, 0, 0] },
  { id: 'be_in', c: [8, -0.3, 0], size: [8, 0.3, 3], dir: [-8.6, 0, 0] },
  { id: 'bn', c: [0, -0.3, 8], size: [3, 0.3, 8], dir: [0, 0, 8.6] },
  { id: 'bs', c: [0, -0.3, -8], size: [3, 0.3, 8], dir: [0, 0, -8.6] },
];
for (const s of SEGS) {
  m.block(s.c, s.size, 'solid', { ...GRATE, id: `blk_${s.id}` });
  m.mover(`mv_${s.id}`, s.c, [`blk_${s.id}`], [[0, 0, 0], [0, -0.7, 0], [s.dir[0], -0.7, s.dir[2]]], { mode: 'trigger', speed: 3, wait: 0, name: `Bridge ${s.id}` });
}
// The landing consoles.
const LANDINGS: [string, string[], V3, number][] = [
  ['btn_bw', ['bw_out', 'bw_in'], at(-3, 0, 0, 2.2, 3, 1.2), S],
  ['btn_be', ['be_out', 'be_in'], at(3, 0, 0, -2.2, -3, 1.2), 0],
  ['btn_bn', ['bn'], at(0, 2, 0, 3, 2.2, 1.2), -P],
  ['btn_bs', ['bs'], at(0, -2, 0, -3, -2.2, 1.2), P],
];
for (const [id, , pos, yaw] of LANDINGS) m.add({ kind: 'button', id, name: 'Bridge console', position: pos, yaw, label: 'Retract the bridge', once: false, cooldownSeconds: 12, startEnabled: true });

// ---------------------------------------------------------------- the hangar bay (x -12..12, z -44..-20)

m.field([0, 0, -44.1], 24, 8, { id: 'field_hangar', tint: '#5ad8ff' });
m.prop('os_field_emitter', [-12.2, 0, -43.6], 0).prop('os_field_emitter', [12.2, 0, -43.6], 0);
m.add({ kind: 'mount', model: 'skyfighter', position: [-7.5, 0, -36], yaw: S, faction: null, respawnSeconds: 60 });
m.add({ kind: 'mount', model: 'skyfighter', position: [7.5, 0, -36], yaw: S, faction: null, respawnSeconds: 60 });
m.add({ kind: 'mount', model: 'dropship', position: [0, 0.2, -31], yaw: S, faction: null, respawnSeconds: 90 });
m.prop('os_cargo_crate', [-9.5, 0, -27], 0.2).prop('os_cargo_crate', [9.5, 0, -27.5], -0.2).prop('os_generator', [10, 0, -32], -P).prop('os_canister_rack', [10.6, 0, -38], -P);
m.prop('os_truss', [-6.5, 0, -25.6], 0).prop('os_truss', [6.5, 0, -25.6], 0).prop('sf_crate_large', [3, 0, -22.2], 0);
m.add({ kind: 'button', id: 'btn_hangar', name: 'Hangar launch console', position: [11.4, 1.2, -24], yaw: -P, label: 'Launch clearance', once: false, cooldownSeconds: 30, startEnabled: true });
for (const x of [-10, 10]) m.light([x, 6.5, -41], { fixture: 'wall', color: '#ff3020', intensity: 1.2, range: 12, yaw: S, id: x < 0 ? 'lamp_hangar_w' : 'lamp_hangar_e', off: true, blink: 3 });
for (const [x, z] of [[-6, -28], [6, -28], [-6, -38], [6, -38]] as const) m.light([x, 7.6, z], { fixture: 'strip', color: '#d8e4ee', intensity: 1, range: 12 });

// ---------------------------------------------------------------- trash compactor (x -28..-20, z -36..-20)

// Its walls: one on each long side, sliding 2 m in (they push, they do not crush), leaving a 2.2 m gap.
m.block([-27.5, 0, -28], [0.6, 3.4, 15.2], 'solid', { material: 'pbr_rusted_plate', tint: '#7a7064', id: 'blk_comp_w' });
m.block([-20.5, 0, -28], [0.6, 3.4, 15.2], 'solid', { material: 'pbr_rusted_plate', tint: '#7a7064', id: 'blk_comp_e' });
m.mover('mv_comp_w', [-27.5, 0, -28], ['blk_comp_w'], [[0, 0, 0], [2.1, 0, 0]], { mode: 'trigger', speed: 0.5, wait: 0, name: 'Compactor west wall' });
m.mover('mv_comp_e', [-20.5, 0, -28], ['blk_comp_e'], [[0, 0, 0], [-2.1, 0, 0]], { mode: 'trigger', speed: 0.5, wait: 0, name: 'Compactor east wall' });
m.water([-24, 0, -28], [6.2, 0.5, 15], 'swamp', '#4a5038');
m.prop('debris', [-25.5, 0, -31], 0.6).prop('debris', [-22.6, 0, -24], 2.1).prop('metal_panel', [-24, 0, -34], 0.4).prop('sf_pipe_rack', [-22.8, 0, -32.5], 0.2);
m.add({ kind: 'door', id: 'door_comp_in', name: 'Compactor way in', position: at(-3, -3, 0, 0, 4), yaw: 0, startOpen: false, locked: false, auto: true });
m.add({ kind: 'door', id: 'door_comp_out', name: 'Compactor hatch', position: at(-3, -4, 0, 0, -4), yaw: 0, startOpen: false, locked: true, auto: false, style: 'blast' });
m.add({ kind: 'button', id: 'btn_comp', name: 'Compactor console', position: at(-3, -2, 0, -3.6, 2, 1.2), yaw: P, label: 'Start the compactor', once: false, cooldownSeconds: 30, startEnabled: true });
m.light(at(-3, -4, 0, 0, 4, 3.3), { fixture: 'strip', color: '#c8d890', intensity: 0.8, range: 10 });
m.light(at(-3, -3, 0, 0, 0, 3), { fixture: 'bulb', color: '#ff3020', intensity: 1.3, range: 10, id: 'lamp_comp', off: true, blink: 2.5 });

// ---------------------------------------------------------------- detention block

// Cells (x -5): team doors (only the garrison walks in), a bunk in each; the control room's console opens them all.
const CELLS = ['door_cell_a', 'door_cell_b', 'door_cell_c'];
[-1, 0, 1].forEach((y, i) => {
  m.add({ kind: 'door', id: CELLS[i], name: `Cell ${2187 + i}`, position: at(-5, y, 0, 4, 0), yaw: P, startOpen: false, locked: false, auto: true, team: GARRISON });
  m.prop('space_bed', at(-5, y, 0, -2.6, -1.6), P);
  m.light(at(-5, y, 0, 0, 0, 3.3), { fixture: 'ceiling', color: '#ffd0a0', intensity: 0.7, range: 6 });
});
m.prop('os_console_corner', at(-4, 2, 0, -2.8, 2.8), S + P / 2).prop('computer_bank', at(-4, 2, 0, 2.9, 2.2), -P).prop('os_terminal', at(-4, 2, 0, -3, -2.2), P);
m.add({ kind: 'button', id: 'btn_cells', name: 'Detention control', position: at(-4, 2, 0, -3.6, 0.6, 1.2), yaw: P, label: 'Open every cell', once: false, cooldownSeconds: 20, startEnabled: true });
m.light(at(-4, 2, 0, 0, 0, 3.4), { fixture: 'ceiling', color: '#ffe8c8', intensity: 0.9, range: 8 });
for (const y of [-1, 1]) m.light(at(-4, y, 0, 3.4, 0, 2.4), { fixture: 'wall', color: '#ffb070', intensity: 0.8, range: 8, yaw: -P });

// ---------------------------------------------------------------- the tractor-beam shaft (x -28..-4, z 20..44)

m.block([-16, -30, 19.7], [24.6, 30, 0.6], 'solid', METAL);
m.block([-16, -30, 44.3], [24.6, 30, 0.6], 'solid', METAL);
m.block([-28.3, -30, 32], [0.6, 30, 24], 'solid', METAL);
m.block([-3.7, -30, 32], [0.6, 30, 24], 'solid', METAL);
// The beam pylon rising out of the dark, a ledge round it, three narrow catwalks out to it.
m.block([-16, -30, 32], [4, 30, 4], 'solid', { material: 'pbr_space_metal', tint: '#6a7078' });
m.block([-16, 0, 32], [4, 12, 4], 'solid', { material: 'pbr_space_metal', tint: '#6a7078' });
m.block([-16, -0.4, 32], [9, 0.4, 9], 'solid', GRATE);
m.block([-16, -0.3, 23.75], [2.4, 0.3, 7.5], 'solid', GRATE);
m.block([-7.75, -0.3, 32], [7.5, 0.3, 2.4], 'solid', GRATE);
m.block([-24.25, -0.3, 32], [7.5, 0.3, 2.4], 'solid', GRATE);
for (const y of [4, 8]) m.block([-16, y, 32], [4.2, 0.3, 4.2], 'solid', { material: 'glow_trim', tint: '#7fd0ff' });
m.prop('os_power_unit', [-17.2, 0, 29.6], S).prop('os_coolant_pipe', [-13.6, 0, 33.6], -P);
m.add({ kind: 'button', id: 'btn_tractor', name: 'Tractor beam power coupling', position: [-15.2, 1.2, 29.9], yaw: S, label: 'Cut the power coupling', once: false, cooldownSeconds: 40, startEnabled: true });
m.light([-16, 11, 32], { fixture: 'none', color: '#7fd0ff', intensity: 2.2, range: 16, id: 'lamp_tractor' });
m.light([-16, -10, 32], { fixture: 'none', color: '#4a8cff', intensity: 1.6, range: 18 });
m.light(at(-4, 3, 0, 0, 0, 3.4), { fixture: 'ceiling', color: '#e0ecf8', intensity: 0.8, range: 8 });
m.light(at(-4, 4, 0, 0, 0, 3.4), { fixture: 'ceiling', color: '#e0ecf8', intensity: 0.8, range: 8 });

// ---------------------------------------------------------------- the throne room (x -4..20, z 20..44)

m.block([8, 0, 40.8], [10, 0.25, 4.2], 'solid', { material: 'pbr_marble_black' });
m.block([8, 0.25, 41.6], [6, 0.25, 2.6], 'solid', { material: 'pbr_marble_black' });
m.prop('space_chair', [8, 0.5, 41.8], S, 1.6);
m.prop('os_console_corner', [5, 0.25, 41], S).prop('os_console_corner', [11, 0.25, 41], S + P);
m.prop('holo_table', [15, 0, 31], 0).prop('os_holo_globe', [1.5, 0, 22.5], 0).prop('os_wall_column', [-2.6, 0, 40], P).prop('os_wall_column', [18.6, 0, 24], -P);
for (const [x, z] of [[2, 26], [14, 26], [2, 38], [14, 38]] as const) m.light([x, 3.4, z], { fixture: 'none', color: '#ff5a4a', intensity: 0.8, range: 9 });
m.light([8, 3.6, 43], { fixture: 'strip', color: '#c8d8ff', intensity: 1, range: 10 });

// ---------------------------------------------------------------- airlock and the trench (x 36..148, z -12..12)

m.add({ kind: 'door', id: 'door_air_in', name: 'Airlock inner door', position: at(3, 0, 0, 4, 0), yaw: P, startOpen: false, locked: false, auto: true });
m.add({ kind: 'door', id: 'door_air_out', name: 'Airlock outer door', position: at(4, 0, 0, 4, 0), yaw: P, startOpen: false, locked: false, auto: true });
m.prop('os_airlock_frame', at(4, 0, 0, -3.1, 0), P).prop('os_airlock_frame', at(4, 0, 0, 3.1, 0), P);
m.light(at(4, 0, 0, 0, 3.4, 3), { fixture: 'wall', color: '#ffb347', intensity: 0.8, range: 6, yaw: S, blink: 0.5 });

const TX0 = 36;
const TX1 = 148;
const WALL = { material: 'pbr_space_metal', tint: '#7e848c' };
// The canyon walls, 14 m high, and the west end beside the airlock.
for (const z of [-13, 13]) for (const x of [64, 120]) m.block([x, 0, z], [56, 14, 2], 'solid', WALL);
for (const z of [-8, 8]) m.block([35, 0, z], [2, 14, 8], 'solid', WALL);
m.block([149, 0, 0], [2, 14, 28], 'solid', WALL);
// Greebles: panels, vents and fins standing out of the walls (cover in the trench).
// (Kept off the turret ramps and decks: south decks at x 64, 104, 136, north at 72, 96, 128.)
const clear = (x: number, decks: number[]) => decks.every((d) => x < d - 15 || x > d + 6);
for (let x = 44; x < TX1 - 6; x += 8) {
  const k = (x / 8) % 3;
  if (clear(x, [64, 104, 136])) m.block([x, 0, -11.5 + (k === 0 ? 0.4 : 0)], [k === 1 ? 4 : 2.4, k === 2 ? 2.2 : 9, k === 0 ? 1.8 : 1], 'solid', WALL);
  if (clear(x + 4, [72, 96, 128])) m.block([x + 4, 0, 11.5 - (k === 2 ? 0.4 : 0)], [k === 0 ? 4 : 2.4, k === 1 ? 2.2 : 9, k === 2 ? 1.8 : 1], 'solid', WALL);
}
for (const x of [48, 80, 112, 144]) for (const z of [-11.7, 11.7]) m.block([x, 10, z], [7.4, 0.3, 0.6], 'solid', { material: 'glow_trim', tint: '#b8d0ff' });

// Turbolaser emplacements: a 5 m deck against the wall with a ramp up to it, a turret on top.
const TURRETS: [number, 1 | -1, 'turret_rocket' | 'turret_mg'][] = [
  [64, -1, 'turret_rocket'], [96, 1, 'turret_mg'], [104, -1, 'turret_mg'], [128, 1, 'turret_rocket'], [72, 1, 'turret_mg'], [136, -1, 'turret_mg'],
];
const RISE = 5;
const RUN = 9;
const PITCH = Math.atan2(RISE, RUN);
for (const [x, side, model] of TURRETS) {
  const z = side * 10.5;
  m.block([x, 0, z], [6, RISE, 3], 'solid', DARK);
  // The ramp comes up from the west along the wall.
  m.block([r2(x - 3 - RUN / 2), r2(RISE / 2 - 0.2), z], [2.6, 0.4, r2(Math.hypot(RISE, RUN))], 'solid', { ...GRATE, yaw: P, pitch: PITCH });
  m.mount(model, [x + 1, RISE, z], side < 0 ? 0 : S, null);
}
m.gravityZone([64, 0, 0], [56, 16, 24], 0.5, 'Trench low gravity');
m.gravityZone([120, 0, 0], [56, 16, 24], 0.5, 'Trench low gravity');
// The exhaust port: a hooded vent in the floor at the far end, glowing from inside.
m.block([142, 0, 0], [4, 1.1, 4], 'solid', DARK);
m.block([142, 1.1, 0], [2.4, 0.1, 2.4], 'solid', { material: 'pbr_space_metal', tint: '#101012' });
m.block([142, 2.6, 2.3], [4.4, 0.3, 0.4], 'solid', { material: 'glow_trim', tint: '#ffb060' });
m.block([142, 2.6, -2.3], [4.4, 0.3, 0.4], 'solid', { material: 'glow_trim', tint: '#ffb060' });
m.light([142, 1.6, 0], { fixture: 'none', color: '#ff9a3a', intensity: 2, range: 9, blink: 1.2 });
for (const x of [44, 72, 100, 128]) m.light([x, 7, 0], { fixture: 'none', color: '#c8d8ff', intensity: 1.1, range: 18 });

// ---------------------------------------------------------------- logic

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[], cond: LogicCondition[] = []): LogicRule => ({ id, name, enabled: true, once: false, when, if: cond, do: does });
const pressed = (id: string): LogicRule['when'] => ({ event: 'button_pressed', target: id });
const retract = (segs: string[], seconds: number): LogicAction[] => [
  act('sound', null, { state: 'buzzer' }),
  ...segs.flatMap((s) => [act('mover_to', `mv_${s}`, { value: 2 }), act('mover_to', `mv_${s}`, { value: 3 })]),
  act('wait', null, { value: seconds }),
  ...segs.flatMap((s) => [act('mover_to', `mv_${s}`, { value: 2 }), act('mover_to', `mv_${s}`, { value: 1 })]),
];
const comp = (suffix: string, when: LogicRule['when']): LogicRule =>
  rule(`rule_comp${suffix}`, 'Trash compactor', when, [
    act('set_var', 'var_comp', { value: 1 }),
    act('sound', null, { state: 'alarm' }),
    act('light_on', 'lamp_comp'),
    say('Compactor engaging! The hatch is open: get out!', 3),
    act('door_unlock', 'door_comp_out'),
    act('door_open', 'door_comp_out'),
    act('door_close', 'door_comp_in'),
    act('door_lock', 'door_comp_in'),
    act('wait', null, { value: 2 }),
    act('mover_to', 'mv_comp_w', { value: 2 }),
    act('mover_to', 'mv_comp_e', { value: 2 }),
    act('wait', null, { value: 9 }),
    act('mover_to', 'mv_comp_w', { value: 1 }),
    act('mover_to', 'mv_comp_e', { value: 1 }),
    act('wait', null, { value: 5 }),
    act('door_unlock', 'door_comp_in'),
    act('door_close', 'door_comp_out'),
    act('door_lock', 'door_comp_out'),
    act('light_off', 'lamp_comp'),
    act('set_var', 'var_comp', { value: 0 }),
  ], [{ type: 'variable', target: 'var_comp', op: '==', value: 0, state: '' }]);
const dropField = (id: string, name: string, when: LogicRule['when'], seconds: number, text: string): LogicRule =>
  rule(id, name, when, [
    act('sound', null, { state: 'alarm' }),
    act('light_on', 'lamp_hangar_w'),
    act('light_on', 'lamp_hangar_e'),
    say(text, 3),
    act('block_drop', 'field_hangar'),
    act('wait', null, { value: seconds }),
    act('block_restore', 'field_hangar'),
    act('light_off', 'lamp_hangar_w'),
    act('light_off', 'lamp_hangar_e'),
    act('sound', null, { state: 'chime' }),
  ]);
m.logic({
  variables: [{ id: 'var_comp', name: 'Compactor running', initial: 0 }],
  timers: [{ id: 'timer_comp', name: 'Compactor cycle', seconds: 90, loop: true, visible: false }],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome', { event: 'match_start', target: null }, [say('Obsidian Orb. Mind the shafts: they have no bottom.', 4), act('timer_start', 'timer_comp')]),
    ...LANDINGS.map(([id, segs]) => rule(`rule_${id}`, 'Retract a bridge', pressed(id), [...retract(segs, 6)])),
    rule('rule_island', 'Retract every bridge', pressed('btn_island'), [say('Bridges retracting!', 2), ...retract(SEGS.map((s) => s.id), 8)]),
    comp('', pressed('btn_comp')),
    comp('_timer', { event: 'timer_done', target: 'timer_comp' }),
    rule('rule_cells', 'Open the cells', pressed('btn_cells'), [
      act('sound', null, { state: 'buzzer' }),
      say('Cell doors open for 10 seconds.', 2),
      ...CELLS.map((id) => act('door_open', id)),
      act('wait', null, { value: 10 }),
      ...CELLS.map((id) => act('door_close', id)),
    ]),
    dropField('rule_tractor', 'Cut the tractor beam', pressed('btn_tractor'), 15, 'Tractor beam down: the hangar field is open for 15 seconds!'),
    rule('rule_tractor_lamp', 'Tractor beam flickers', pressed('btn_tractor'), [act('light_off', 'lamp_tractor'), act('wait', null, { value: 15 }), act('light_on', 'lamp_tractor')]),
    dropField('rule_hangar', 'Launch clearance', pressed('btn_hangar'), 8, 'Launch clearance: hangar field down for 8 seconds.'),
  ],
});

// ---------------------------------------------------------------- objectives

// Bomb: the reactor control (A) and the exhaust port (B).
m.add({ kind: 'bombsite', position: [0, 0, 0], label: 'A', radius: 3.5 });
m.add({ kind: 'bombsite', position: [137, 0, 0], label: 'B', radius: 4 });
// CTF: the hangar against the detention block.
m.flag(RAID, [-6, 0, -22.5], S);
m.flag(GARRISON, at(-4, 2, 0, 1, 1), S);
// KOTH: the shaft island, the throne room, the trench.
m.hill([0, 0, 0], 4);
m.hill([8, 0, 32], 6);
m.hill([92, 0, 0], 7);

// ---------------------------------------------------------------- spawns

// The raiders: the hangar, its gantry and the chute.
for (const [p, yaw] of [
  [[-9.5, 0, -23], 0], [[9.5, 0, -23], 0], [[0, 0, -24.5], 0], [[-10, 0, -40], 0], [[10, 0, -40], 0], [[-3, 0, -40.5], 0],
  [[-10.2, 4, -22], P], [[4, 4, -21.8], 0], [at(-3, -5, 0, 1, 0), P], [at(-2, -5, 0, 1, 1), P], [at(0, -2, 0, 2, 1), 0], [[3.5, 0, -40.5], 0],
] as [V3, number][]) m.spawn(p, yaw, RAID);
// The garrison: the detention block, the tractor access, the throne room.
for (const [p, yaw] of [
  [at(-4, -1, 0, 1, -1), 0], [at(-4, 0, 0, 1, 0), P], [at(-4, 1, 0, 1, 1), S], [at(-4, 2, 0, 2, -2), 0], [at(-4, 3, 0, 1, 1), S], [at(-4, 4, 0, -1, 1), P],
  [[2, 0, 24], 0], [[14, 0, 24], 0], [[2, 0, 36], P], [[14, 0, 36], -P], [at(1, 2, 0, -2, 0), S], [at(-1, 2, 0, 0, 1), S],
] as [V3, number][]) m.spawn(p, yaw, GARRISON);
// Everyone else: round the ring, the airlock and the trench.
for (const [p, yaw] of [
  [at(-3, -2, 0, -1, -1), P], [at(3, -2, 0, 1, -1), -P], [at(3, 2, 0, 1, 1), S], [at(-3, 1, 0, -1, 0), 0], [at(3, -1, 0, 1, 0), 0],
  [at(2, -2, 0), S], [at(-2, 2, 0, 0, 2), 0], [at(4, 0, 0), P], [[48, 0, 4], P], [[84, 0, -6], -P], [[120, 0, 6], -P], [[60, 0, 8], P],
] as [V3, number][]) m.spawn(p, yaw, null);

// ---------------------------------------------------------------- pickups

m.pickup('weapon_railgun', [-16, 0, 35.6]).pickup('ammo_cells', at(-4, 4, 0, -2, -2));
m.pickup('weapon_rockets', [140, 0, -8]).pickup('ammo_explosive', [100, 0, 8]);
m.pickup('weapon_sniper', [16, 0, 42]).pickup('ammo_sniper', at(3, 2, 0, 2, 2));
m.pickup('weapon_plasma', at(-5, 0, 0, -1, 1.5)).pickup('armor_large', at(-5, 1, 0, -1, 1.5)).pickup('health_large', at(-5, -1, 0, -1, 1.5));
m.pickup('weapon_smg', at(-3, 0, 0, -2, 0)).pickup('weapon_smg', at(3, 0, 0, 2, 0)).pickup('weapon_shotgun', at(0, 2, 0, -2, 0)).pickup('weapon_shotgun', at(0, -2, 0, 2, 0));
m.pickup('weapon_burst_rifle', [-4, 0, -30]).pickup('weapon_rifle', at(-2, -2, 0)).pickup('weapon_launcher', [0, 4, -21.8]).pickup('weapon_lmg', [8, 0, 26]);
m.pickup('weapon_rifle', [56, 0, 0]).pickup('weapon_burst_rifle', [116, 0, 0]);
m.pickup('ammo', at(-1, -2, 0)).pickup('ammo', at(1, 2, 0)).pickup('ammo_rifle', [8, 0, -40]).pickup('ammo_shells', at(-4, 0, 0, -1, -2)).pickup('ammo_light', at(2, 2, 0)).pickup('ammo', [76, 0, 0]);
m.pickup('grenades', [0, 0, 1.6]).pickup('grenades', at(-3, -4, 0, 0, 1)).pickup('grenades', [128, 0, 0]);
m.pickup('armor_small', at(3, 1, 0, 2, 2)).pickup('armor_small', [-10.2, 4, -26]).pickup('armor_small', [88, 0, 8]);
m.pickup('health_large', [8, 0, 38.5]).pickup('health_large', [0, 0, -40]).pickup('health_large', [64, 0, 0]);
for (const p of [at(-3, -1, 0, -2, 0), at(3, 1, 0, 2, 0), at(-1, 2, 0, 0, 2), at(1, -2, 0, 0, -2), at(-3, -5, 0), at(4, 0, 0, 0, 2), [100, 0, -6] as V3, [44, 0, -6] as V3, [-16, 0, 28.3] as V3]) m.pickup('health_small', p);

// ---------------------------------------------------------------- dressing and light

m.dress([-4, 1, 0], 'server', { density: 'sparse' });
m.dress([-4, 3, 0], 'storage', { density: 'sparse' });
m.dress([3, -2, 0], 'storage', { density: 'sparse' });
m.dress([-3, 2, 0], 'armoury', { density: 'sparse' });
// Wall lights down every ring corridor.
for (const [x, y] of RING) {
  const outer: Side = y === -2 ? 'S' : y === 2 ? 'N' : x < 0 ? 'W' : 'E';
  const off: Record<Side, [number, number, number]> = { N: [0, 3.5, S], S: [0, -3.5, 0], E: [3.5, 0, -P], W: [-3.5, 0, P] };
  const [dx, dy, yaw] = off[outer];
  m.light(at(x, y, 0, dx, dy, 2.6), { fixture: 'wall', color: '#dbe6f0', intensity: 0.8, range: 8, yaw });
}

m.bounds('invisible', 4);
m.meta({
  description:
    'A battle station built from the Orbital Station style pack and painted gunmetal grey. Grey grated corridors ring a bottomless reactor shaft whose four bridges retract from their consoles (strand whoever is chasing you), out to the reactor control in the middle. A hangar of skyfighters and a shuttle behind a force field; a trash compactor whose walls grind in on a timer; a detention block of team-locked cells; a tractor-beam pylon reached by narrow catwalks over the drop, where cutting the power coupling drops the hangar field; a dark throne room with a wall of windows onto the stars. Through the airlock, a long metal trench on the surface in low gravity, turret emplacements along its walls and the exhaust port at the end.',
  modes: ['core.bomb', 'core.ctf', 'core.koth', 'core.tdm', 'core.deathmatch'],
  players: [12, 24],
});
await m.save();
