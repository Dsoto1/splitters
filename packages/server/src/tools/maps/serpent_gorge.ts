/**
 * Serpent Gorge: an expedition camp in the jungle on one side of a deep river
 * canyon, a stepped temple on the other. Three ways over: a rope bridge of
 * planks in the west (two of them rotten: they give way under you), the
 * drawbridge in the middle between two gatehouses (a winch in either one
 * swings both gates shut), and the river itself, reached by rock-cut stairs
 * in the east and the west and waded under the waterfalls.
 *
 * The temple: side doors from the forecourt into antechambers, a vestibule,
 * then the trap corridor (rippling spike floors, fire-spitting serpent heads
 * and a falling stone block) to the idol room. Lift the idol and the room
 * seals itself while the serpent heads fire; the only way out is the rotten
 * floor in the east corner, a drop into the crypt and the caves down to the
 * river. A hidden passage, behind a cracked wall in the west hall, leads to a
 * treasure chamber and a second door into the idol room. Terraces step up the
 * outside of the temple to the shrine on top.
 *
 * Grid x east, y north (one cell = 8 m). Jungle and temple on z0 (y 0), the
 * canyon floor on z-2 (y -8), crypt and landings on z-1, terraces z1–z2.
 *
 *   y12      .  .  X  I  I  i  .  .    I idol room, i its rotten floor (pit to the crypt), X treasure chamber
 *   y11      .  .  X  .  T  .  .  .    T trap corridors
 *   y10      .  .  W  .  T  c  .  .    W west hall (cracked wall north), c crypt stairs up
 *   y9       .  .  s  a  V  a  s  .    V vestibule, a antechambers, s side shrines
 *   y8    ^  .  /  .  /  .  /  .  .    / stairs up the terraces, ^ stairs up from the canyon
 *   y7    .  .  .  .  G  .  .  .  .    north rim, G gatehouse;  caves under it on z-2
 *   y6    ~  ~  ~  ~  ~  ~  ~  ~  ~    the canyon (z-2) and the river; rope bridge at x1,
 *   y5    ~  ~  ~  ~  ~  ~  ~  ~  v    drawbridge at x4; v stairs down from the jungle
 *   y4    .  .  .  .  G  .  .  .  .    south rim, G gatehouse
 *   y3    .  .  .  .  .  .  .  .  v
 *   y2    .  .  .  .  .  .  .  .  .    expedition camp
 *   y1    .  h  .  .  .  .  .  h  .    h huts
 *   y0    .  .  .  .  W  .  .  .  .    W watchtower
 *        x0  1  2  3  4  5  6  7  8
 */
import { TERRAIN_MATERIALS, buildMapGeometry, buildOccupancy, newTerrain, paintSlopes, terrainHeightAt, type MapDocument, type ScenarioLogic, type Side, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

type V3 = [number, number, number];
type Style = Parameters<MapBuilder['edge']>[4];
const P = Math.PI / 2;

const m = new MapBuilder('serpent_gorge', 'Serpent Gorge');
m.theme('ruins');
m.backdrop('misty', 'forest', 'grass', 0.6, 0.6);
const [camp, temple] = m.teamIds() as [string, string];

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
const e = (x: number, y: number, z: number, side: Side, style: Style) => m.edge(x, y, z, side, style);
const ROCK = mat('pbr_rock', '#7a7466');
const MOSSY = mat('pbr_castle_stone', '#8e9478');

// ---------------------------------------------------------------- the expedition camp and the jungle (z0, y0–y4)
for (let x = 0; x <= 8; x++) {
  for (let y = 0; y <= 4; y++) {
    if ((x === 1 || x === 7) && y === 1) continue; // huts
    if (x === 4 && (y === 0 || y === 4)) continue; // watchtower, south gatehouse
    if (x === 8 && y === 3) continue; // stairs down to the river
    const ruin = (x === 2 && y === 3) || (x === 6 && y === 3) || (x === 0 && y === 4);
    m.tile(ruin ? 'yard_ruins' : y === 2 && (x === 3 || x === 5) ? 'yard_crates' : 'yard', x, y, 0, ((x * 3 + y) % 4) as 0 | 1 | 2 | 3);
  }
}
m.tile('room', 1, 1, 0, 0, { ceiling: 'roof' }).tile('room', 7, 1, 0, 0, { ceiling: 'roof' });
e(1, 1, 0, 'E', 'door').edge(1, 1, 0, 'N', 'window').edge(7, 1, 0, 'W', 'door').edge(7, 1, 0, 'N', 'window');
m.tile('tower', 4, 0, 0, 2); // lookout over the camp
m.tile('corridor_clear', 4, 4, 0); // south gatehouse
e(4, 4, 0, 'N', 'door').edge(4, 4, 0, 'S', 'door');
// Stairs cut in the rock down to the river (east): jungle (8,2) → landing (8,4,-1) → canyon (8,6,-2).
m.tile('stairs', 8, 3, -1, 1).tile('room', 8, 4, -1, 0).tile('stairs', 8, 5, -2, 1);

// ---------------------------------------------------------------- the canyon (z-2)
for (let x = 0; x <= 8; x++) {
  for (const y of [5, 6]) {
    if ((x === 8 && y === 5) || (x === 0 && y === 6)) continue; // the stairs
    m.tile('yard', x, y, -2, ((x + y) % 4) as 0 | 1 | 2 | 3);
  }
}
for (let x = 0; x <= 8; x++) {
  if (x !== 8) e(x, 5, -2, 'S', 'high');
  if (x !== 0 && x !== 1 && x !== 6) e(x, 6, -2, 'N', 'high');
}
e(0, 5, -2, 'W', 'high').edge(8, 6, -2, 'E', 'high');
// Grotto behind the west falls, and the cave up to the temple crypt (east).
m.tile('room', 1, 7, -2, 0, { ceiling: 'roof', layout: 'rubble', corners: 'rounded' });
m.tile('room', 6, 7, -2, 0, { ceiling: 'roof', corners: 'rounded' });
e(1, 6, -2, 'N', 'broken').edge(6, 6, -2, 'N', 'broken');
m.tile('corridor', 6, 8, -2).tile('stairs', 6, 9, -2, 3);
// Stairs up from the canyon on the west to the temple side: (0,5,-2) → landing (0,7,-1) → (0,9,0).
m.tile('stairs', 0, 6, -2, 3).tile('room', 0, 7, -1, 0).tile('stairs', 0, 8, -1, 3);

// ---------------------------------------------------------------- north rim, forecourt and temple flanks (z0)
for (let x = 0; x <= 8; x++) if (x !== 4) m.tile(x === 2 || x === 7 ? 'yard_ruins' : 'yard', x, 7, 0, ((x * 5) % 4) as 0 | 1 | 2 | 3);
m.tile('corridor_clear', 4, 7, 0); // north gatehouse
e(4, 7, 0, 'S', 'door');
for (const x of [1, 3, 5, 7, 8]) m.tile('yard', x, 8, 0);
for (const x of [2, 4, 6]) m.tile('stairs_open', x, 8, 0, 3);
for (let y = 9; y <= 12; y++) for (const x of [0, 1, 7, 8]) m.tile(y === 11 && (x === 1 || x === 7) ? 'yard_ruins' : 'yard', x, y, 0, ((x + y * 3) % 4) as 0 | 1 | 2 | 3);

// ---------------------------------------------------------------- the temple (z0)
const ROOF = { ceiling: 'roof' } as const;
m.tile('room', 2, 9, 0, 0, ROOF).tile('room', 3, 9, 0, 0, ROOF).tile('room_columns', 4, 9, 0).tile('room', 5, 9, 0, 0, ROOF).tile('room', 6, 9, 0, 0, ROOF);
m.tile('room', 2, 10, 0, 0, ROOF).tile('corridor_clear', 4, 10, 0).tile('corridor_clear', 4, 11, 0);
m.tile('room', 2, 11, 0, 0, ROOF).tile('room', 2, 12, 0, 0, ROOF); // treasure chamber (hidden)
m.tile('room', 3, 12, 0, 0, ROOF).tile('room', 4, 12, 0, 0, ROOF).tile('pit', 5, 12, 0); // idol room
// Doors: side shrines out to the flanks, antechambers off the forecourt, vestibule between them.
e(2, 9, 0, 'W', 'door').edge(6, 9, 0, 'E', 'door');
e(2, 9, 0, 'E', 'door').edge(5, 9, 0, 'E', 'door');
e(3, 9, 0, 'S', 'door').edge(5, 9, 0, 'S', 'door').edge(2, 9, 0, 'S', 'window').edge(6, 9, 0, 'S', 'window');
e(3, 9, 0, 'E', 'arch').edge(4, 9, 0, 'E', 'arch').edge(4, 9, 0, 'S', 'wall').edge(4, 9, 0, 'N', 'door');
e(3, 9, 0, 'N', 'wall');
e(2, 9, 0, 'N', 'door').edge(2, 10, 0, 'N', 'door'); // west hall; the cracked wall north of it
e(2, 11, 0, 'N', 'open').edge(2, 12, 0, 'E', 'door'); // treasure chamber, its door into the idol room
e(3, 12, 0, 'E', 'open').edge(4, 12, 0, 'E', 'open').edge(4, 11, 0, 'N', 'door');
e(2, 10, 0, 'E', 'wall').edge(2, 11, 0, 'E', 'wall');
// The crypt under the idol room (z-1): pit landing, a vault, stairs up into the east antechamber, and the cave stairs.
m.tile('room', 5, 12, -1, 0, ROOF).tile('room', 5, 11, -1, 0, ROOF).tile('stairs', 5, 10, -1, 1);
m.tile('room', 6, 10, -1, 0, ROOF).tile('room', 6, 11, -1, 0, ROOF);
e(5, 11, -1, 'N', 'door').edge(5, 11, -1, 'E', 'door').edge(6, 10, -1, 'N', 'open');

// ---------------------------------------------------------------- terraces: stepping up the temple (z1, z2)
for (let x = 2; x <= 6; x++) for (let y = 9; y <= 12; y++) if (!(x === 4 && y === 10)) m.tile('platform_rail', x, y, 1);
m.tile('stairs_open', 4, 10, 1, 3);
for (const [x, y] of [[3, 11], [5, 11], [3, 12], [5, 12]] as const) m.tile('platform_rail', x, y, 2);
m.tile('room', 4, 12, 2, 0, { ceiling: 'roof', layout: 'dais' }); // the shrine
e(4, 12, 2, 'S', 'wide').edge(4, 12, 2, 'E', 'arch').edge(4, 12, 2, 'W', 'arch');
m.tile('platform_rail', 4, 11, 2);

// Open ground stays open: no walls where the jungle, the rims and the forecourt meet nothing (the canyon, the boundary).
{
  const cells = buildOccupancy(m.doc).cells;
  for (const t of [...m.doc.classicStructure.tiles]) {
    if (t.z !== 0 || !t.tile.startsWith('core.yard')) continue;
    for (const [side, dx, dy] of [['N', 0, 1], ['S', 0, -1], ['E', 1, 0], ['W', -1, 0]] as const) if (!cells.has(`${t.x + dx},${t.y + dy},0`)) e(t.x, t.y, 0, side, 'open');
  }
}
// The temple's outer wall along the east flank (solid masonry behind it), and the treasure chamber sealed from the west flank.
for (const y of [10, 11, 12]) e(7, y, 0, 'W', 'wall');
e(2, 11, 0, 'W', 'wall').edge(2, 12, 0, 'W', 'wall');

// Paint: mossy temple stone, rock in the canyon and caves, dark timber in the camp.
for (const t of [...m.doc.classicStructure.tiles]) {
  if (t.z <= -1 || t.z === -2) paint(t.x, t.y, t.z, { walls: ROCK, floor: t.z === -2 && t.y >= 5 && t.y <= 6 ? mat('pbr_gravel') : mat('pbr_rock', '#6a665c'), solids: ROCK, underside: ROCK });
  else if (t.y >= 9 && t.x >= 2 && t.x <= 6) paint(t.x, t.y, t.z, { walls: MOSSY, floor: mat('pbr_flagstone', '#9a9a84'), solids: mat('sandstone', '#a8a48a'), trim: mat('stone_trim') });
  else if (t.y <= 2 && t.tile === 'core.room') paint(t.x, t.y, t.z, { walls: mat('pbr_planks'), floor: mat('pbr_floorboards') });
  else paint(t.x, t.y, t.z, { floor: mat(t.y >= 7 ? 'pbr_moss' : 'pbr_forest'), walls: MOSSY });
}

// ---------------------------------------------------------------- the bridges
const PLANK = 'pbr_planks';
// Rope bridge (west, x 6.5–9.5): planks, two of them rotten, posts and ropes either side.
for (let i = 0; i < 8; i++) {
  const z = 37 + i * 2;
  const rotten = i === 2 || i === 5;
  m.block([8, -0.3, z], [3.2, 0.3, 1.96], rotten ? 'crumble' : 'solid', { material: PLANK, tint: rotten ? '#6a5236' : '#8a6a44', delay: 1, respawn: 6 });
}
for (const x of [6.3, 9.7]) {
  for (let z = 36.2; z <= 52; z += 3.9) m.block([x, -0.6, z], [0.2, 1.7, 0.2], 'solid', { material: 'dark_wood' });
  m.block([x, 0.95, 44], [0.2, 0.1, 15.8], 'solid', { material: 'canvas', tint: '#b8a070' });
}
// The drawbridge (middle, x 29–35): heavy timbers between the gatehouses, chains to the gate towers.
m.block([32, -0.6, 44], [6, 0.6, 16], 'solid', { material: PLANK, tint: '#7a5a3a' });
for (const x of [29.1, 34.9]) m.block([x, 0, 44], [0.2, 0.9, 16], 'solid', { material: 'dark_wood' });
for (const z of [36.5, 51.5]) for (const x of [29.1, 34.9]) m.block([x, 0, z], [0.4, 3.4, 0.4], 'solid', { material: 'rusty_metal' });
m.add({ kind: 'door', id: 'gate_south', name: 'South drawbridge gate', position: [32, 0, 36], yaw: 0, startOpen: true, locked: false, auto: false });
m.add({ kind: 'door', id: 'gate_north', name: 'North drawbridge gate', position: [32, 0, 52], yaw: 0, startOpen: true, locked: false, auto: false });
m.add({ kind: 'button', id: 'winch_south', name: 'South winch', position: [28.7, 0, 30], yaw: P, label: 'Work the drawbridge gates', once: false, cooldownSeconds: 4, startEnabled: true });
m.add({ kind: 'button', id: 'winch_north', name: 'North winch', position: [35.3, 0, 58], yaw: -P, label: 'Work the drawbridge gates', once: false, cooldownSeconds: 4, startEnabled: true });

// ---------------------------------------------------------------- the river and the falls
m.water([28, -8, 40], [64, 0.9, 7.9]); // south half of the river bed, x -4..60
m.water([36, -8, 48], [64, 0.9, 7.9]); // north half, x 4..68
m.water([-3.75, -8, 44], [0.5, 8, 14]); // west falls
m.water([67.75, -8, 44], [0.5, 8, 14]); // east falls
m.water([9, -8, 57.5], [5, 0.5, 3.5]); // grotto pool

// ---------------------------------------------------------------- the trap corridor and the idol room
const trap = { kind: 'trap', yaw: 0, startEnabled: true, damage: null, offsetSeconds: 0 } as const;
// Spike floors ripple down the first corridor (z 76–84).
for (const [i, z] of [[0, 77.6], [1, 80.5], [2, 83.2]] as const) {
  for (const [j, x] of [[0, 29.5], [1, 32], [2, 34.5]] as const) {
    m.add({ ...trap, id: `spikes_${i}${j}`, name: 'Spike floor', trap: 'spikes', position: [x, 0, z], activation: 'cycle', onSeconds: 1.4, offSeconds: 2.6, offsetSeconds: i * 1.3 });
  }
}
// Serpent heads spit fire across the second corridor (z 84–92); a stone block drops when you step under it.
m.add({ ...trap, id: 'flames_w', name: 'Serpent head (west)', trap: 'flames', position: [28.4, 0, 86], yaw: P, activation: 'cycle', onSeconds: 1.6, offSeconds: 2.4, offsetSeconds: 0 });
m.add({ ...trap, id: 'flames_e', name: 'Serpent head (east)', trap: 'flames', position: [35.6, 0, 90], yaw: -P, activation: 'cycle', onSeconds: 1.6, offSeconds: 2.4, offsetSeconds: 2 });
m.add({ ...trap, id: 'crusher_stone', name: 'Falling stone', trap: 'crusher', position: [32, 0, 88], activation: 'proximity', onSeconds: 1.2, offSeconds: 3 });
// The idol room: serpent heads that only wake when the idol is lifted.
m.add({ ...trap, id: 'flames_idol_w', name: 'Idol guardian (west)', trap: 'flames', position: [20.4, 0, 95], yaw: P, activation: 'logic', onSeconds: 6, offSeconds: 2 });
m.add({ ...trap, id: 'flames_idol_e', name: 'Idol guardian (north)', trap: 'flames', position: [36, 0, 99.6], yaw: Math.PI, activation: 'logic', onSeconds: 6, offSeconds: 2 });
m.add({ kind: 'door', id: 'door_idol', name: 'Idol room door', position: [32, 0, 92], yaw: 0, startOpen: false, locked: false, auto: true });
m.add({ kind: 'door', id: 'door_treasure', name: 'Treasure chamber door', position: [24, 0, 96], yaw: P, startOpen: false, locked: false, auto: true });
m.add({ kind: 'button', id: 'btn_idol', name: 'The golden idol', position: [28, 0, 99.3], yaw: Math.PI, label: 'Lift the golden idol', once: false, cooldownSeconds: 45, startEnabled: true });
m.add({ kind: 'destructible', id: 'cracked_wall', name: 'Cracked wall', model: 'wall', position: [16, 0, 84], yaw: 0, health: 220, explosiveOnly: false });
// The rotten floor over the pit: it gives way under anyone who steps on it.
for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) m.block([40 + dx, -0.3, 96 + dz], [1.98, 0.3, 1.98], 'crumble', { material: 'pbr_flagstone', tint: '#8a8670', delay: 0.7, respawn: 6 });

// ---------------------------------------------------------------- spawns
for (const [x, z, yaw] of [[4, -2, 0], [12, 0, 0.2], [20, -2, 0], [28, 6, 0], [36, 6, 0], [44, -2, 0], [52, 0, -0.2], [60, -2, 0], [20, 14, 0], [44, 14, 0]] as const) m.spawn([x, 0, z], yaw, camp);
for (const [x, y, z] of [[8, 0, 74], [56, 0, 74], [4, 0, 90], [60, 0, 90], [9, 0, 62], [52, 0, 62], [24, 0, 62], [40, 0, 62], [20, 4, 92], [44, 4, 92]] as const) m.spawn([x, y, z], Math.PI, temple);
const shared: V3[] = [[16, -8, 40], [48, -8, 48], [56, 0, 26], [4, 0, 28], [64, 0, 98], [0, 0, 98], [48, -4, 88], [32, 8, 88]];
for (const p of shared) m.spawn(p, p[2] > 44 ? Math.PI : 0);

// ---------------------------------------------------------------- objectives for the team modes
m.flag(camp, [16, 0, 4], 0);
m.flag(temple, [32, 0, 72], Math.PI);
m.hill([32, 0, 44], 4); // the drawbridge
m.hill([32, 8, 89], 5); // the temple top, before the shrine
m.hill([28, 0, 96], 4); // the idol room

// ---------------------------------------------------------------- pickups
const items: [string, V3, number?][] = [
  ['weapon_rockets', [16, 0, 98], 60], ['ammo_explosive', [16, 0, 90]], ['powerup_damage', [32, 0, 97.5], 90],
  ['weapon_sniper', [24, 8, 88], 30], ['ammo_sniper', [40, 8, 88]], ['weapon_marksman', [8, 0, 30]], ['ammo_rifle', [8, 0, 58]],
  ['armor_large', [6, -8, 55], 40], ['health_large', [48, -8, 57]], ['weapon_flamethrower', [48, -4, 84], 40], ['ammo_fuel', [40, -4, 96]],
  ['weapon_spear', [56, -8, 44]], ['weapon_auto_shotgun', [24, -8, 44]], ['health_small', [0, -8, 40]], ['grenades', [40, -8, 48]],
  ['weapon_grapple', [64, 0, 30], 30], ['weapon_rifle', [28, 0, 14]], ['weapon_smg', [40, 0, 14]], ['health_small', [8, 0, 10]], ['armor_small', [56, 0, 10]],
  ['weapon_burst_rifle', [24, 0, 54]], ['weapon_shotgun', [40, 0, 54]], ['health_small', [64, 0, 66]], ['health_small', [0, 0, 66]],
  ['armor_small', [16, 0, 74]], ['ammo', [48, 0, 74]], ['incendiaries', [16, 4, 80]], ['health_small', [48, 4, 80]], ['mines', [64, 0, 84]],
  ['ammo_shells', [0, 0, 84]], ['ammo', [32, 0, 30]], ['ammo', [32, 0, 60]],
];
for (const [item, p, r] of items) m.pickup(item, p, r ?? null);

// ---------------------------------------------------------------- logic: the idol and the drawbridge winches
type Action = ScenarioLogic['rules'][number]['do'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const say = (text: string, seconds = 4) => act('message', null, { value: seconds, text });
type Condition = ScenarioLogic['rules'][number]['if'][number];
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: string, target: string | null, does: Action[], ifs: Condition[] = []) => ({ id, name, enabled: true, once: false, when: { event, target }, if: ifs, do: does }) as ScenarioLogic['rules'][number];
m.logic({
  variables: [{ id: 'var_gates', name: 'gates open', initial: 1 }],
  timers: [],
  objectives: [],
  rules: [
    // Either winch: drop both gates and lock them, or unlock and raise them (the flag flips a moment later, so only one of each pair runs).
    ...(['winch_south', 'winch_north'] as const).flatMap((w) => [
      rule(`rule_${w}_shut`, `${w}: gates shut`, 'button_pressed', w, [act('door_close', 'gate_south'), act('door_close', 'gate_north'), act('door_lock', 'gate_south'), act('door_lock', 'gate_north'), act('sound', null, { state: 'buzzer' }), say('Chains rattle: the drawbridge gates slam shut.', 3), act('wait', null, { value: 0.2 }), act('set_var', 'var_gates', { value: 0 })], [cond('variable', 'var_gates', '==', 1)]),
      rule(`rule_${w}_open`, `${w}: gates open`, 'button_pressed', w, [act('door_unlock', 'gate_south'), act('door_unlock', 'gate_north'), act('door_open', 'gate_south'), act('door_open', 'gate_north'), act('sound', null, { state: 'chime' }), say('Chains rattle: the drawbridge gates swing open.', 3), act('wait', null, { value: 0.2 }), act('set_var', 'var_gates', { value: 1 })], [cond('variable', 'var_gates', '==', 0)]),
    ]),
    rule('rule_idol', 'The idol is lifted', 'button_pressed', 'btn_idol', [
      act('door_close', 'door_idol'),
      act('door_close', 'door_treasure'),
      act('door_lock', 'door_idol'),
      act('door_lock', 'door_treasure'),
      act('sound', null, { state: 'alarm' }),
      say('The temple seals itself! Get out through the rotten floor in the corner!', 5),
      act('trap_fire', 'flames_idol_w'),
      act('trap_fire', 'flames_idol_e'),
      act('wait', null, { value: 4 }),
      act('trap_fire', 'flames_idol_w'),
      act('trap_fire', 'flames_idol_e'),
      act('wait', null, { value: 8 }),
      act('door_unlock', 'door_idol'),
      act('door_unlock', 'door_treasure'),
      act('sound', null, { state: 'chime' }),
      say('Stone grinds: the idol room opens again.', 3),
    ]),
  ],
});

// ---------------------------------------------------------------- dressing
const props: [string, V3, number, number?, boolean?][] = [
  // Camp: tents, crates, a campfire, the radio table.
  ['tent', [6, 0, 18], 0.3], ['tent_canvas', [58, 0, 18], -0.3], ['sv_tent', [26, 0, -2.5], Math.PI], ['sv_tent', [38, 0, -2.5], Math.PI],
  ['sv_campfire', [32, 0, 8], 0], ['log', [30, 0, 10], 0.2], ['log', [34.5, 0, 6], 1.6], ['crate_large', [22, 0, 8], 0.3], ['crate_small', [23, 0, 9.5], 0],
  ['sv_radio', [10.5, 0, 6], 0], ['table', [10, 0, 8.5], 0], ['sv_backpack', [54, 0, 6], 1], ['barrel', [62, 0, 4], 0], ['barrel', [63, 0, 5], 0],
  ['sv_shovel', [46, 0, 2], 0.4], ['rowboat', [-1, 0, 12], 1.2], ['signpost', [28, 0, 26], 0.4],
  // Jungle ruins on the south rim and round the temple.
  ['rn_wall_arch_ivy', [12, 0, 26], 0], ['rn_column_broken', [52, 0, 26], 0.4], ['rn_statue_fox', [20, 0, 34], 0.2], ['rn_urn_broken', [44, 0, 33], 0],
  ['rn_wall_broken', [0, 0, 74], P], ['rn_column_round', [64, 0, 78], 0], ['rn_statue_stag', [64, 0, 92], -P], ['rn_wall_half', [8, 0, 88], 0.2],
  ['rn_column_broken', [12, 0, 58], 1.1], ['rn_urn', [52, 0, 58], 0], ['obelisk', [0, 0, 60], 0], ['rn_arch_round', [64, 0, 58], P],
  // The canyon: boulders in the river, a wrecked raft, logs.
  ['boulder_round', [20, -8, 42], 0.3, 0.6], ['nt_boulder_moss', [44, -8, 46], 0.8], ['rock_large', [60, -8, 48], 0.2], ['sv_raft', [36, -8, 38.5], 0.4], ['log_big', [10, -8, 49], 1.4],
  // The crypt and the idol room: urns, gold, skulls.
  ['dg_pedestal', [26.4, 0, 98.6], 0], ['dg_coin_pile', [25, 0, 98.8], 0], ['dg_coin_pile', [29.6, 0, 97.8], 0.6], ['dg_skull', [34, 0, 94], 0.4], ['rn_urn', [21, 0, 99], 0], ['rn_urn', [21, 0, 93], 0],
  ['dg_chest', [16, 0, 99], 0], ['dg_coin_pile', [13.5, 0, 98.8], 0], ['dg_skull', [42, -4, 98], 1], ['dg_spikes', [42, -4, 93], 0], ['coffin_old', [52, -4, 90], P],
  ['crypt', [52, -4, 82], 0, 0.7],
];
for (const [model, p, yaw, s, solid] of props) m.prop(model, p, yaw, s ?? 1, solid ?? true);
// The golden idol on its pedestal.
m.add({ kind: 'prop', model: 'prop.urn', position: [26.4, 1.1, 98.6], yaw: 0, scale: 0.5, solid: false, tint: '#e0b030' });
// Undergrowth to hide in (walk-through): along the rims, the flanks and the camp edge.
const bushes: [number, number, number][] = [
  [2, 0, 34], [10, 0, 33.5], [26, 0, 34], [38, 0, 34], [50, 0, 34], [62, 0, 34], [2, 0, 54], [14, 0, 54.5], [28, 0, 55], [46, 0, 54.5], [58, 0, 54], [66, 0, 54],
  [-2, 0, 78], [10, 0, 80], [-2, 0, 94], [10, 0, 98], [54, 0, 80], [66, 0, 80], [54, 0, 98], [66, 0, 94], [0, 0, 18], [64, 0, 20], [18, 0, 22], [46, 0, 22],
];
const BUSH = ['nt_bush_leafy', 'bush_large', 'nt_fern_wide', 'nt_bush_berries', 'fern'];
bushes.forEach(([x, y, z], i) => m.prop(BUSH[i % BUSH.length]!, [x, y, z], (i * 1.7) % 6.28, 1.2, false));
// Trees inside the play area: palms on the rims and in the camp.
for (const [x, z, k] of [[-2, 2, 0], [66, 2, 1], [-2, 30, 2], [66, 30, 0], [-2, 58, 1], [66, 60, 2], [-2, 100, 0], [66, 100, 1], [14, 12, 2], [50, 12, 0]] as const) {
  m.prop(['nt_palm_tall', 'nt_palm_curved', 'palm_bent'][k]!, [x, 0, z], (x + z) % 6.28, 1);
}

// ---------------------------------------------------------------- lights
const TORCH = '#ffb060';
for (const [x, z] of [[24, 72], [40, 72], [16, 72], [48, 72]] as const) m.light([x, 3.4, z], { fixture: 'none', color: TORCH, intensity: 1, range: 9 });
for (const z of [78, 86, 90]) m.light([32, 3.3, z], { fixture: 'bulb', color: '#ff9a50', intensity: 0.9, range: 8 });
m.light([32, 3.2, 96], { fixture: 'none', color: '#ffd060', intensity: 1.6, range: 12 });
m.light([16, 3.2, 92], { fixture: 'none', color: '#ffc050', intensity: 1, range: 10 });
m.light([16, 3.2, 80], { fixture: 'none', color: TORCH, intensity: 0.8, range: 8 });
for (const [x, y, z] of [[40, -1, 96], [40, -1, 88], [48, -1, 84], [48, -1, 92], [48, -6, 58], [8, -6, 58], [64, -2, 34], [0, -2, 54]] as const) m.light([x, y, z], { fixture: 'none', color: '#8ad0a0', intensity: 0.8, range: 9 });
for (const [x, z] of [[32, 4], [8, 6], [56, 6]] as const) m.light([x, 1.4, z], { fixture: 'none', color: '#ff8a3a', intensity: 1.3, range: 12 });
m.light([32, 11, 98], { fixture: 'none', color: '#ffd080', intensity: 1, range: 10 });
for (const z of [36.5, 51.5]) m.light([32, 3.6, z], { fixture: 'none', color: TORCH, intensity: 1, range: 8 });

// Furnish: chapels in the side shrines, the west hall as a library of crumbling scrolls, store tents in the huts.
m.dress([2, 9, 0], 'chapel').dress([6, 9, 0], 'chapel').dress([2, 10, 0], 'library', { density: 'sparse' });
m.dress([1, 1, 0], 'storage').dress([7, 1, 0], 'office', { density: 'sparse' });

// ---------------------------------------------------------------- the jungle beyond: hills, and the canyon running on
m.bounds('invisible', 0, { min: [-4, -4], max: [68, 104] }, 60);
type Rect4 = [number, number, number, number, number];
function surround(doc: MapDocument, size: number, centre: [number, number], hills: (x: number, z: number) => number, paint2: (x: number, z: number, h: number) => TerrainMaterial): { t: TerrainData; dist: (x: number, z: number) => number } {
  const rects: Rect4[] = [];
  for (const b of buildMapGeometry(doc)) {
    if (b.kind !== 'floor' && b.kind !== 'wall') continue;
    rects.push([b.min[0], b.min[2], b.max[0], b.max[2], b.kind === 'floor' ? b.max[1] : b.min[1]]);
  }
  const rd = (x: number, z: number, r: Rect4) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3]));
  const dist = (x: number, z: number) => rects.reduce((a, r) => Math.min(a, rd(x, z, r)), Infinity);
  const cap = (x: number, z: number) => {
    let deep = Infinity;
    let c = Infinity;
    for (const r of rects) {
      if (x > r[0] + 0.6 && x < r[2] - 0.6 && z > r[1] + 0.6 && z < r[3] - 0.6) deep = Math.min(deep, r[4] - 3.5);
      c = Math.min(c, r[4] - 0.4 + 0.9 * Math.max(0, rd(x, z, r) - 2));
    }
    return Math.min(c, deep);
  };
  let t = newTerrain(size, 2, centre, 'grass');
  const heights: number[] = [];
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      const x = t.origin[0] + c * 2;
      const z = t.origin[1] + r * 2;
      heights.push(Math.round(Math.min(cap(x, z), hills(x, z)) * 100));
    }
  }
  t = { ...t, heights };
  const materials: number[] = [];
  const foliage: number[] = [];
  for (let r = 0; r < t.rows - 1; r++) {
    for (let c = 0; c < t.cols - 1; c++) {
      const x = t.origin[0] + c * 2 + 1;
      const z = t.origin[1] + r * 2 + 1;
      const h = terrainHeightAt(t, x, z) ?? 0;
      const g = paint2(x, z, h);
      materials.push(TERRAIN_MATERIALS.indexOf(g));
      foliage.push(dist(x, z) < 2 ? 0 : g === 'grass' ? 4 : g === 'moss' ? 3 : 1);
    }
  }
  return { t: paintSlopes({ ...t, materials, foliage }, 40, 'stone'), dist };
}
const roll = (x: number, z: number) => Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.05 + 0.4) + 0.6 * Math.sin((x + z) * 0.037 + 2.1) + 0.35 * Math.cos((x - z) * 0.11);
const jungle = surround(
  m.doc,
  240,
  [32, 50],
  (x, z) => {
    const out = Math.max(-4 - x, x - 68, -4 - z, z - 104, 0);
    let h = out * 0.45 + 2.5 * roll(x, z) * Math.min(1, out / 16);
    // The canyon runs on east and west out of the play area, the river at the bottom.
    if (x < -4 || x > 68) h = Math.min(h, -8.5 + Math.max(0, Math.abs(z - 44) - 8) * 1.2);
    return h;
  },
  (x, z, h) => (h < -6 ? 'mud' : h < -1 ? 'stone' : roll(x, z) > 0.9 ? 'moss' : 'grass'),
);
m.terrain(jungle.t);
m.teams([10, 10]);
m.meta({
  description:
    'A jungle river canyon between an expedition camp and a stepped temple. Cross by the rope bridge (mind the rotten planks), the drawbridge (either winch swings both gates shut) or the river under the falls. Inside the temple: spike floors, serpent heads and a falling stone guard the idol; lift it and the room seals, leaving only the rotten floor down into the crypt. A cracked wall hides the treasure chamber.',
  modes: ['core.ctf', 'core.tdm', 'core.koth', 'core.deathmatch'],
  players: [8, 20],
});
await m.save();
