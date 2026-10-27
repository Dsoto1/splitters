/**
 * Stonewatch Keep: a fortress walled across the mouth of a mountain gorge on
 * a stormy night. A great curtain wall (the Deep Wall) closes the valley, with
 * a culvert drain through its foot; a causeway ramps up the east side to the
 * gatehouse; behind the wall lie the raised inner bailey, the keep with its
 * great hall and roof tower, and caves running back into the mountain round a
 * glittering pool.
 *
 * Co-op siege (1–8): sound the horn in the great hall, then hold the wall
 * against the Black Warband as they come up the causeway and the siege ladders.
 * Sappers blow the culvert when the charge timer runs out (or you blow it
 * yourself), the ram breaks the gate a minute and a half later, and the last
 * stand is in the keep until dawn. Team modes: attackers camp outside the
 * wall, defenders hold the keep (CTF flags in the camp and the great hall;
 * King of the Hill on the causeway, the wall walk, the bailey and the hall).
 *
 * Grid x east, y north (one cell = 8 m). Field and camp on level z0 (y 0),
 * bailey and keep on z1 (y 4) over a rock foundation, wall walk on z2 (y 8).
 *
 *   y16           c  c  c              c  caves (z1), pool in the middle
 *   y15        c  c  c  c
 *   y14        t     t                 t  tunnels from the keep
 *   y13        w  H  H  H  e  r        H  great hall (3 × 3), w/e keep wings,
 *   y12        w  H  H  H  S              S stairwell to the keep roof (z2), r tower top (z3)
 *   y11        w  H  H  H  e
 *   y10  .  .  .  .  .  .  .  .  .     bailey (z1)
 *   y9   B  .  .  .  ^  .  .  .  A     B barracks, A armoury; ^ culvert stairs up from z0
 *   y8   B  .  .  .  ^  .  .  .  A
 *   y7   T  .  s  .  .  s  .  .  T     T tower stairs, s open stairs (both up to the wall walk)
 *   y6   =  =  =  =  C  =  =  G  =     = the Deep Wall (wall walk on z2), C culvert (z0), G gatehouse (z1)
 *   y5   .  .  .  .  .  .  .  P  .     P causeway head (z1)
 *   y4   .  .  .  .  .  .  .  R  .     R causeway ramp, rising north
 *   y3   .  .  .  .  .  .  .  R  .     field (z0)
 *   y2   .  .  .  .  .  .  .  .  .
 *   y1   k  k  k  k  k  k  k  k  k     k the Warband's camp
 *   y0   k  k  k  k  k  k  k  k  k
 *       x0  1  2  3  4  5  6  7  8
 *
 * NPCs: there are no orcs in the kit, so the Warband fields imps (warriors),
 * puglins (goblin runners), scolitexes (the trolls) and heavies (sappers with
 * grenade launchers).
 */
import { TERRAIN_MATERIALS, buildMapGeometry, buildOccupancy, newTerrain, paintSlopes, terrainHeightAt, type MapDocument, type ScenarioLogic, type Side, type TerrainData, type TerrainMaterial, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

type V3 = [number, number, number];
type Style = Parameters<MapBuilder['edge']>[4];
const P = Math.PI / 2;

const m = new MapBuilder('stonewatch_keep', 'Stonewatch Keep');
m.theme('castle');
m.backdrop('storm', 'peaks', 'stone', 0.75, 0.45);
m.factions([{ id: 'warband', name: 'The Black Warband', color: '#8c2a1c', relations: {} }]);
const [attackers, defenders] = m.teamIds() as [string, string];

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
const e = (x: number, y: number, z: number, side: Side, style: Style) => m.edge(x, y, z, side, style);
const STONE = 'pbr_castle_stone';
const ROCK = 'pbr_rock';

// ---------------------------------------------------------------- camp and field (z0)
for (let x = 0; x <= 8; x++) for (const y of [0, 1]) m.tile(x === 2 && y === 1 ? 'yard_crates' : 'yard', x, y);
for (let x = 0; x <= 8; x++) {
  for (let y = 2; y <= 5; y++) {
    if (x === 7 && (y === 3 || y === 4)) continue; // the causeway ramp
    const ruin = (x === 1 && y === 4) || (x === 5 && y === 3) || (x === 3 && y === 2);
    m.tile(ruin ? 'yard_ruins' : 'yard', x, y, 0, ((x + y) % 4) as 0 | 1 | 2 | 3);
  }
}
// The causeway: a long ramp up the east side to the gatehouse, low walls along it.
m.tile('ramp', 7, 3, 0, 3);
m.tile('platform_rail', 7, 5, 1);
for (const y of [3, 4]) for (const z of [0, 1]) e(7, y, z, 'W', 'half').edge(7, y, z, 'E', 'half');
e(7, 3, 0, 'S', 'open');

// ---------------------------------------------------------------- the Deep Wall (row y6)
// Solid stone 8 m thick and 8 m high, with the culvert through its foot and the gate passage a level up.
const wallTop = 7.7;
m.block([12, 0, 48], [32, 3.7, 8], 'solid', { material: STONE }); // x -4..28, foot
m.block([52, 0, 48], [32, 3.7, 8], 'solid', { material: STONE }); // x 36..68, foot
m.block([24, 3.7, 48], [56, wallTop - 3.7, 8], 'solid', { material: STONE }); // x -4..52, upper course (over the culvert)
m.block([64, 3.7, 48], [8, wallTop - 3.7, 8], 'solid', { material: STONE }); // x 60..68
m.tile('corridor_clear', 4, 6, 0); // the culvert
m.tile('corridor_clear', 4, 7, 0);
m.tile('stairs', 4, 8, 0, 3); // up into the bailey
e(4, 6, 0, 'S', 'door');
m.tile('corridor_clear', 7, 6, 1); // gate passage
e(7, 6, 1, 'S', 'door').edge(7, 6, 1, 'N', 'door');
// The wall walk, battlements on the field side.
for (let x = 0; x <= 8; x++) {
  m.tile('platform_rail', x, 6, 2);
  e(x, 6, 2, 'S', 'open');
}
e(0, 6, 2, 'W', 'tower').edge(8, 6, 2, 'E', 'tower');

// The valley stays open to the gorge sides: no walls where the field and the camp meet nothing.
{
  const cells = buildOccupancy(m.doc).cells;
  for (const t of [...m.doc.classicStructure.tiles]) {
    if (t.z !== 0 || !t.tile.startsWith('core.yard')) continue;
    for (const [side, dx, dy] of [['N', 0, 1], ['S', 0, -1], ['E', 1, 0], ['W', -1, 0]] as const) if (!cells.has(`${t.x + dx},${t.y + dy},0`)) e(t.x, t.y, 0, side, 'open');
  }
}

// ---------------------------------------------------------------- the bailey (z1), on the rock
const bailey: [number, number][] = [];
for (let x = 0; x <= 8; x++) for (let y = 7; y <= 10; y++) bailey.push([x, y]);
const special = new Set(['0,7', '8,7', '2,7', '5,7', '4,8', '0,8', '0,9', '8,8', '8,9']);
for (const [x, y] of bailey) if (!special.has(`${x},${y}`)) m.tile(y === 10 && (x === 1 || x === 7) ? 'yard_crates' : 'yard', x, y, 1);
m.tile('stairs', 0, 7, 1, 1).tile('stairs', 8, 7, 1, 1); // tower stairs up to the wall walk
m.tile('stairs_open', 2, 7, 1, 1).tile('stairs_open', 5, 7, 1, 1);
const ROOF = { ceiling: 'roof' } as const;
m.tile('room', 0, 8, 1, 0, ROOF).tile('room', 0, 9, 1, 0, ROOF); // barracks
m.tile('room', 8, 8, 1, 0, ROOF).tile('room', 8, 9, 1, 0, ROOF); // armoury
e(0, 8, 1, 'N', 'open').edge(8, 8, 1, 'N', 'open');
e(0, 8, 1, 'E', 'door').edge(0, 9, 1, 'E', 'windows').edge(8, 8, 1, 'W', 'door').edge(8, 9, 1, 'W', 'windows');
// The gorge sides: sheer walls up the mountain.
for (let y = 7; y <= 10; y++) e(0, y, 1, 'W', 'tower').edge(8, y, 1, 'E', 'tower');
for (const x of [0, 1, 7, 8]) e(x, 10, 1, 'N', 'tower');

// ---------------------------------------------------------------- the keep (z1, z2, z3)
m.tile('hall', 3, 11, 1, 0, { ceiling: 'beams' });
for (const y of [11, 12, 13]) m.tile('room', 2, y, 1, 0, ROOF);
m.tile('room', 6, 11, 1, 0, ROOF).tile('stairwell', 6, 12, 1).tile('room', 6, 13, 1, 0, ROOF);
// Keep front: the great doors in the middle, arrow windows either side.
e(3, 11, 1, 'S', 'slit').edge(4, 11, 1, 'S', 'door').edge(5, 11, 1, 'S', 'slit');
e(2, 11, 1, 'S', 'door').edge(6, 11, 1, 'S', 'door');
e(2, 11, 1, 'E', 'arch').edge(2, 12, 1, 'E', 'wall').edge(2, 13, 1, 'E', 'arch');
e(2, 11, 1, 'N', 'open').edge(2, 12, 1, 'N', 'door');
e(6, 11, 1, 'W', 'arch').edge(6, 13, 1, 'W', 'arch').edge(6, 12, 1, 'N', 'wall').edge(6, 11, 1, 'N', 'wall');
for (const y of [11, 12, 13]) e(2, y, 1, 'W', 'high').edge(6, y, 1, 'E', 'high');
// Keep roof: battlements round the hall roof, the wings' roofs and a lookout tower.
for (let x = 3; x <= 5; x++) for (let y = 11; y <= 13; y++) if (!(x === 4 && y === 12)) m.tile('platform_rail', x, y, 2);
m.tile('stairs_open', 4, 12, 2, 3);
m.tile('platform_rail', 4, 13, 3);
// Back of the hall: a door north into the caves.
e(4, 13, 1, 'N', 'door');

// ---------------------------------------------------------------- the caves (z1)
m.tile('corridor', 4, 14, 1).tile('corridor', 2, 14, 1);
const caves: [number, number][] = [[2, 15], [3, 15], [4, 15], [5, 15], [3, 16], [5, 16]];
for (const [x, y] of caves) m.tile('room', x, y, 1, 0, { ceiling: 'roof', layout: 'rubble', corners: 'rounded' });
m.tile('room_sunken', 4, 16, 1, 2); // the pool, entered from the south
for (const [x, y] of caves) {
  if (caves.some(([a, b]) => a === x + 1 && b === y)) e(x, y, 1, 'E', 'broken');
  if (caves.some(([a, b]) => a === x && b === y + 1)) e(x, y, 1, 'N', 'broken');
}
e(4, 15, 1, 'N', 'broken').edge(3, 16, 1, 'E', 'broken').edge(4, 16, 1, 'E', 'broken');
e(4, 15, 1, 'S', 'door').edge(2, 15, 1, 'S', 'door');
const caveTiles: [number, number][] = [...caves, [4, 14], [2, 14], [4, 16]];
for (const [x, y] of caveTiles) paint(x, y, 1, { walls: mat(ROCK, '#7c8088'), floor: mat(ROCK, '#5d6168'), solids: mat(ROCK, '#6a6e76'), underside: mat(ROCK, '#4a4e56') });

// ---------------------------------------------------------------- foundation rock under the bailey and keep
// Everything on z1 stands on the mountain's rock shelf; the culvert tunnel runs through it.
m.block([12, 0, 84], [32, 3.7, 64], 'solid', { material: ROCK }); // x -4..28, z 52..116
m.block([52, 0, 84], [32, 3.7, 64], 'solid', { material: ROCK }); // x 36..68
m.block([32, 0, 96], [8, 3.7, 40], 'solid', { material: ROCK }); // x 28..36, z 76..116
// The mountain either side of the keep and between the cave tunnels.
m.block([4, 0, 108], [16, 20, 48], 'solid', { material: ROCK, tint: '#77736c' }); // x -4..12, z 84..132
m.block([60, 0, 108], [16, 20, 48], 'solid', { material: ROCK, tint: '#77736c' }); // x 52..68
m.block([24, 3.7, 112], [8, 8.3, 8], 'solid', { material: ROCK, tint: '#77736c' }).block([40, 3.7, 112], [8, 8.3, 8], 'solid', { material: ROCK, tint: '#77736c' });

// Paint: weathered castle stone outside, warm plaster and timber in the keep.
const castleWalls = mat(STONE, '#9a958c');
for (const t of [...m.doc.classicStructure.tiles]) {
  if (caveTiles.some(([x, y]) => x === t.x && y === t.y)) continue;
  const inKeep = t.y >= 11 && t.y <= 13 && t.z === 1;
  paint(t.x, t.y, t.z, inKeep ? { walls: mat('pbr_plaster', '#c9b48e'), floor: mat('pbr_floorboards'), trim: mat('dark_wood') } : { walls: castleWalls, floor: t.z === 0 && t.y <= 5 ? mat('pbr_gravel') : mat('pbr_flagstone') });
}

// ---------------------------------------------------------------- battlements on the Deep Wall
// A parapet with merlons along the field side, broken where the siege ladders reach the top.
const LADDERS = [4, 20, 44, 64];
{
  const z = 44.3;
  let x = -4;
  while (x < 68) {
    const next = Math.min(68, x + 2);
    const mid = (x + next) / 2;
    if (!LADDERS.some((l) => Math.abs(l - mid) < 1.5)) {
      m.block([mid, 8, z], [next - x, 1.1, 0.6], 'solid', { material: STONE });
      m.block([mid - 0.5, 9.1, z], [1, 0.9, 0.6], 'solid', { material: STONE });
    }
    x = next;
  }
}
for (const lx of LADDERS) m.add({ kind: 'ladder', position: [lx, 0, 43.8], yaw: Math.PI, height: 8, width: 1.2, name: 'Siege ladder' });

// ---------------------------------------------------------------- gate, culvert and portcullis
m.add({ kind: 'destructible', id: 'gate_outer', name: 'Great gate', model: 'wall', position: [56, 4, 44], yaw: 0, health: 900, explosiveOnly: false });
m.add({ kind: 'destructible', id: 'culvert_wall', name: 'Culvert grate', model: 'wall', position: [32, 0, 44], yaw: 0, health: 400, explosiveOnly: true });
m.add({ kind: 'door', id: 'portcullis', name: 'Portcullis', position: [56, 4, 52], yaw: 0, startOpen: true, locked: false, auto: false });
m.add({ kind: 'button', id: 'btn_portcullis', name: 'Portcullis winch', position: [50.5, 4, 52.7], yaw: 0, label: 'Raise / drop the portcullis', once: false, cooldownSeconds: 3, startEnabled: true });
m.add({ kind: 'button', id: 'btn_horn', name: 'Horn of Stonewatch', position: [26, 4, 107.3], yaw: Math.PI, label: 'Sound the horn', once: true, cooldownSeconds: 1, startEnabled: true });
// Rubble round the culvert mouth you can shoot apart for cover lines, and the drain water.
for (const [x, w] of [[27.2, 1.6], [36.8, 1.6]] as const) m.block([x, 0, 42.6], [w, 1.4, 1.6], 'breakable', { material: STONE, health: 150, respawn: null });
m.water([32, 0, 52], [3.6, 0.3, 15.6]);
m.water([32, 2.5, 129.5], [7.6, 1.3, 4.8]); // the cave pool (the sunken room's pit)

// ---------------------------------------------------------------- spawns
// Shared (co-op, deathmatch): inside the walls.
const shared: [V3, number][] = [
  [[30, 4, 92], Math.PI], [[34, 4, 92], Math.PI], [[30, 4, 100], Math.PI], [[34, 4, 100], Math.PI],
  [[12, 4, 74], Math.PI], [[52, 4, 74], Math.PI], [[24, 4, 64], Math.PI], [[40, 4, 64], Math.PI],
  [[16, 4, 92], Math.PI], [[48, 4, 92], Math.PI], [[26, 8, 49], Math.PI], [[50, 8, 49], Math.PI],
];
for (const [p, yaw] of shared) m.spawn(p, yaw);
// Attackers in the camp, defenders in the keep and bailey.
for (const [x, z] of [[8, -1], [16, -2], [24, -1], [40, -1], [48, -2], [56, -1], [12, 8], [28, 9], [36, 9], [52, 8]] as const) m.spawn([x, 0, z], 0, attackers);
for (const [x, z] of [[8, 60], [16, 60], [24, 60], [40, 60], [48, 72], [16, 80], [24, 80], [40, 80], [48, 80], [8, 80]] as const) m.spawn([x, 4, z], Math.PI, defenders);

// ---------------------------------------------------------------- objectives for the team modes
m.flag(attackers, [32, 0, -2.5], 0);
m.flag(defenders, [38, 4, 104], Math.PI);
m.hill([56, 4, 40], 5); // causeway head
m.hill([32, 8, 48], 5); // the wall walk over the culvert
m.hill([32, 4, 72], 6); // bailey
m.hill([32, 4, 89], 4); // the great hall, before the dais

// ---------------------------------------------------------------- pickups
const items: [string, V3, number?][] = [
  ['weapon_marksman', [8, 8, 48]], ['weapon_sniper', [60, 8, 48], 30], ['ammo_sniper', [20, 8, 48]],
  ['weapon_launcher', [32, 0, 56], 40], ['ammo_explosive', [32, 0, 26]], ['grenades', [16, 0, 34]], ['grenades', [48, 0, 34]],
  ['weapon_spear', [12, 0, 22]], ['weapon_shotgun', [52, 0, 22]], ['weapon_rifle', [28, 0, 6]], ['weapon_smg', [44, 0, 6]],
  ['health_small', [4, 0, 16]], ['health_small', [60, 0, 16]], ['armor_small', [56, 4, 38]], ['health_large', [32, 0, 12]],
  ['weapon_lmg', [64, 4, 66], 45], ['ammo_rifle', [64, 4, 74]], ['weapon_flamethrower', [0, 4, 66], 45], ['ammo_fuel', [0, 4, 74]],
  ['health_large', [32, 4, 80]], ['armor_large', [32, 4, 120], 45], ['incendiaries', [24, 4, 128]], ['health_small', [40, 4, 120]],
  ['weapon_burst_rifle', [16, 4, 64]], ['weapon_auto_shotgun', [48, 4, 64]], ['ammo', [24, 4, 72]], ['ammo', [40, 4, 72]],
  ['weapon_rockets', [32, 12, 104], 60], ['health_small', [16, 4, 96]], ['ammo_shells', [48, 4, 88]], ['mines', [48, 4, 104]],
];
for (const [item, p, r] of items) m.pickup(item, p, r ?? null);

// ---------------------------------------------------------------- the Warband
const roster = { trooper: 0, gunner: 0, heavy: 0, imp: 0, puglin: 0, scolitex: 0 };
const squad = { kind: 'encounter', yaw: 0, faction: 'warband', perPlayer: 1, respawnSeconds: 4, radius: 5, order: 'attack', orderTarget: null, difficulty: 'normal', startActive: false } as const;
m.add({ ...squad, id: 'enc_vanguard', name: 'Vanguard (causeway)', position: [48, 0, 10], roster: { ...roster, imp: 4, puglin: 2 }, activeCap: 6, reinforcements: 8, perPlayer: 2 });
m.add({ ...squad, id: 'enc_ladders_w', name: 'West ladders', position: [8, 0, 30], roster: { ...roster, imp: 3, puglin: 1 }, activeCap: 4, reinforcements: 8, perPlayer: 2 });
m.add({ ...squad, id: 'enc_ladders_e', name: 'East ladders', position: [44, 0, 30], roster: { ...roster, imp: 3 }, activeCap: 4, reinforcements: 6, perPlayer: 2 });
m.add({ ...squad, id: 'enc_sappers', name: 'Sappers', position: [32, 0, 36], roster: { ...roster, heavy: 2, imp: 2 }, activeCap: 4, reinforcements: 2, order: 'hold', size: 1.1 });
m.add({ ...squad, id: 'enc_breach', name: 'Through the culvert', position: [32, 0, 50], radius: 3, roster: { ...roster, puglin: 4, imp: 2 }, activeCap: 6, reinforcements: 14, perPlayer: 3, respawnSeconds: 3 });
m.add({ ...squad, id: 'enc_trolls', name: 'Trolls at the gate', position: [56, 0, 14], roster: { ...roster, scolitex: 2 }, activeCap: 2, reinforcements: 1, perPlayer: 1, size: 1.15 });
m.add({ ...squad, id: 'enc_horde', name: 'The horde', position: [32, 0, 20], radius: 10, roster: { ...roster, imp: 6, puglin: 4, heavy: 1 }, activeCap: 10, reinforcements: 24, perPlayer: 4, respawnSeconds: 2.5, difficulty: 'hard' });

// ---------------------------------------------------------------- the siege
type Action = ScenarioLogic['rules'][number]['do'][number];
type Condition = ScenarioLogic['rules'][number]['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const say = (text: string, seconds = 4) => act('message', null, { value: seconds, text });
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: string, target: string | null, does: Action[], ifs: Condition[] = [], once = true) =>
  ({ id, name, enabled: true, once, when: { event, target }, if: ifs, do: does }) as ScenarioLogic['rules'][number];
const ALL = ['enc_vanguard', 'enc_ladders_w', 'enc_ladders_e', 'enc_sappers', 'enc_breach', 'enc_trolls', 'enc_horde'];

m.logic({
  variables: [
    { id: 'var_lives', name: 'lives', initial: 20 },
    { id: 'var_portcullis', name: 'portcullis up', initial: 1 },
  ],
  timers: [
    { id: 'timer_culvert', name: 'Charge at the culvert', seconds: 100, loop: false, visible: true },
    { id: 'timer_gate', name: 'Ram at the gate', seconds: 90, loop: false, visible: true },
    { id: 'timer_dawn', name: 'Until dawn', seconds: 150, loop: false, visible: true },
  ],
  objectives: [
    { id: 'obj_horn', text: 'Sound the horn in the great hall to begin the siege', startActive: true, marker: 'btn_horn' },
    { id: 'obj_wall', text: 'Hold the Deep Wall', startActive: false, marker: null },
    { id: 'obj_culvert', text: 'Stop them coming through the culvert', startActive: false, marker: 'enc_breach' },
    { id: 'obj_keep', text: 'Fall back to the keep and hold until dawn', startActive: false, marker: 'btn_horn' },
  ],
  rules: [
    rule('rule_intro', 'Night falls', 'match_start', null, [say('Torches are moving in the valley. Sound the horn in the great hall when the wall is manned.', 6)]),
    rule('rule_horn', 'The horn sounds', 'button_pressed', 'btn_horn', [
      act('objective', 'obj_horn', { state: 'complete' }),
      act('objective', 'obj_wall', { state: 'active' }),
      act('sound', null, { state: 'alarm' }),
      say('The Warband is at the wall! Hold the causeway and throw down the ladders.', 5),
      act('door_close', 'portcullis'),
      act('door_lock', 'portcullis'),
      act('set_var', 'var_portcullis', { value: 0 }),
      act('encounter_start', 'enc_vanguard'),
      act('encounter_start', 'enc_ladders_w'),
      act('encounter_start', 'enc_ladders_e'),
      act('timer_start', 'timer_culvert'),
      act('wait', null, { value: 35 }),
      say('Sappers are creeping to the culvert with a charge!', 4),
      act('encounter_start', 'enc_sappers'),
    ]),
    // The culvert goes up when the sappers' timer runs out, or earlier if someone blows it.
    rule('rule_charge', 'The charge goes off', 'timer_done', 'timer_culvert', [act('destroy', 'culvert_wall')]),
    rule('rule_breach', 'Culvert breached', 'destroyed', 'culvert_wall', [
      act('timer_stop', 'timer_culvert'),
      act('sound', null, { state: 'boom' }),
      say('The culvert is breached! They are coming up under the bailey!', 5),
      act('objective', 'obj_culvert', { state: 'active' }),
      act('encounter_start', 'enc_breach'),
      act('timer_start', 'timer_gate'),
      act('wait', null, { value: 40 }),
      say('Trolls on the causeway! The ram is coming up.', 4),
      act('encounter_start', 'enc_trolls'),
    ]),
    rule('rule_culvert_held', 'Culvert held', 'encounter_cleared', 'enc_breach', [act('objective', 'obj_culvert', { state: 'complete' }), say('The culvert is choked with the dead.', 3)]),
    rule('rule_ram', 'The ram breaks the gate', 'timer_done', 'timer_gate', [act('destroy', 'gate_outer')]),
    rule('rule_gate', 'Gate down: the last stand', 'destroyed', 'gate_outer', [
      act('timer_stop', 'timer_gate'),
      act('sound', null, { state: 'boom' }),
      act('objective', 'obj_wall', { state: 'complete' }),
      act('objective', 'obj_keep', { state: 'active' }),
      say('The gate is broken! Fall back to the keep! Hold until dawn!', 5),
      act('timer_start', 'timer_dawn'),
      act('encounter_start', 'enc_horde'),
      act('wait', null, { value: 25 }),
      act('disable', 'btn_portcullis'),
      act('door_open', 'portcullis'),
      act('door_lock', 'portcullis'),
      say('The portcullis chains snap. They are in the bailey!', 4),
    ]),
    // The winch drops the portcullis and locks it, or unlocks and raises it (the flag flips a moment later, so only one of the pair runs).
    rule('rule_portcullis_drop', 'Winch: drop the portcullis', 'button_pressed', 'btn_portcullis', [act('door_close', 'portcullis'), act('door_lock', 'portcullis'), act('sound', null, { state: 'buzzer' }), act('wait', null, { value: 0.2 }), act('set_var', 'var_portcullis', { value: 0 })], [cond('variable', 'var_portcullis', '==', 1)], false),
    rule('rule_portcullis_raise', 'Winch: raise the portcullis', 'button_pressed', 'btn_portcullis', [act('door_unlock', 'portcullis'), act('door_open', 'portcullis'), act('sound', null, { state: 'chime' }), act('wait', null, { value: 0.2 }), act('set_var', 'var_portcullis', { value: 1 })], [cond('variable', 'var_portcullis', '==', 0)], false),
    rule('rule_dawn', 'Dawn', 'timer_done', 'timer_dawn', [
      ...ALL.map((id) => act('encounter_stop', id)),
      act('objective', 'obj_keep', { state: 'complete' }),
      act('sound', null, { state: 'chime' }),
      say('Dawn breaks over the gorge. Riders on the ridge! The Warband breaks and runs.', 5),
      act('wait', null, { value: 4 }),
      act('end_round', null, { state: 'players win' }),
    ]),
    rule('rule_life_lost', 'Count the fallen', 'player_killed', null, [act('add_var', 'var_lives', { value: -1 })], [cond('objective', 'obj_horn', '==', 0, 'complete')], false),
    rule('rule_low_lives', 'Few defenders left', 'variable_changed', 'var_lives', [say('Only 5 defenders left to fall!', 3), act('sound', null, { state: 'buzzer' })], [cond('variable', 'var_lives', '==', 5)]),
    rule('rule_defeat', 'Stonewatch falls', 'variable_changed', 'var_lives', [say('Stonewatch has fallen.', 5), act('end_round', null, { state: 'players lose' })], [cond('variable', 'var_lives', '<=', 0)]),
  ],
});

// ---------------------------------------------------------------- dressing
// The Warband's camp: tents, fires and siege engines.
const campProps: [string, V3, number, number?][] = [
  ['tent_canvas', [6, 0, 10], 0.3], ['tent', [14, 0, 11], 0], ['tent_canvas', [50, 0, 11], -0.2], ['tent', [58, 0, 9], 0.4],
  ['tent', [20, 0, -3], Math.PI], ['tent_canvas', [44, 0, -3], Math.PI],
  ['trebuchet', [36, 0, 2], 0.1], ['catapult', [10, 0, 2], 0.2], ['siege_tower', [56, 0, 2], 0],
  ['battering_ram', [60, 0, 18], P], ['cart', [24, 0, 10], 1.2], ['banner_red', [32, 0, 12], 0],
  ['campfire_stones', [18, 0, 4], 0], ['campfire_stones', [46, 0, 5], 0], ['log_stack', [4, 0, 2], 0.4], ['woodpile', [40, 0, 11], 0],
  ['palisade', [2, 0, -3.5], 0], ['palisade', [62, 0, -3.5], 0],
];
for (const [model, p, yaw, s] of campProps) m.prop(model, p, yaw, s ?? 1);
// The field: boulders, a broken cart, scattered spikes and dead trees.
const fieldProps: [string, V3, number, number?][] = [
  ['boulder_jagged', [20, 0, 28], 0.6, 0.6], ['rock_large', [44, 0, 20], 1.1], ['rock_medium', [4, 0, 38], 0.2], ['rocks_tall', [62, 0, 38], 0.3, 0.8],
  ['cart', [40, 0, 38], 2.4], ['stump_old', [10, 0, 14], 0], ['nt_dead_tree', [64, 0, 26], 0.4], ['nt_dead_tree', [0, 0, 24], 1.3],
  ['debris', [28, 0, 40], 0.2], ['debris', [12, 0, 41], 1.1], ['wood_support', [36.5, 0, 41], 0], ['wood_support', [27.5, 0, 41], 0],
];
for (const [model, p, yaw, s] of fieldProps) m.prop(model, p, yaw, s ?? 1);
// The bailey: carts, hay, barrels, a well-like fountain, braziers, banners on the keep front.
const baileyProps: [string, V3, number, number?][] = [
  ['cart_high', [14, 4, 82], 0.3], ['hay_bale', [20, 4, 82], 0], ['hay_bale', [21, 4, 83.4], 0.4], ['barrel', [58, 4, 60.5], 0], ['barrel', [59, 4, 61.4], 0],
  ['dungeon_barrel', [27, 4, 59], 0], ['crate_large', [37, 4, 58.5], 0.2],
  ['ballista', [44, 8, 48], Math.PI], ['ballista', [12, 8, 48], Math.PI], ['cannonballs', [46.5, 8, 50], 0], ['cannonballs', [14.5, 8, 50], 0],
  ['banner_long', [24.4, 4, 83.6], 0], ['banner_long', [39.6, 4, 83.6], 0], ['anvil', [62, 4, 82], 0.3], ['shield', [60, 4, 82.8], 0],
];
for (const [model, p, yaw, s] of baileyProps) m.prop(model, p, yaw, s ?? 1);
// The caves: rock spires, boulders and pale pillars round the pool.
const caveProps: [string, V3, number, number?][] = [
  ['rock_spire_tall', [21, 4, 122], 0.4, 0.7], ['nt_boulder_moss', [26, 4, 117], 0.2], ['stone_pillar', [43, 4, 131], 1.1, 0.7], ['rocks_tall', [13, 4, 115], 0.5, 0.7],
  ['boulder_round', [44, 4, 117], 0.3, 0.5], ['mushrooms', [36, 4, 115], 0], ['mushroom_tall', [28, 4, 131], 0.4], ['dg_coin_pile', [21, 4, 126], 0], ['dg_chest', [43, 4, 126], P],
];
for (const [model, p, yaw, s] of caveProps) m.prop(model, p, yaw, s ?? 1);

// ---------------------------------------------------------------- light: torches on the walls, braziers, the glittering caves
const TORCH = '#ffa04a';
for (let x = 0; x <= 64; x += 16) m.light([x + 4, 9.6, 51.6], { fixture: 'none', color: TORCH, intensity: 1.1, range: 10 });
for (const x of [8, 24, 40, 56]) m.light([x, 2.6, 43.6], { fixture: 'wall', color: TORCH, intensity: 1.2, range: 9, yaw: Math.PI });
m.light([56, 6.2, 43.6], { fixture: 'wall', color: TORCH, intensity: 1.4, range: 10, yaw: Math.PI });
for (const [x, z] of [[8, 66], [56, 66], [24, 82], [40, 82], [32, 60]] as const) m.light([x, 6.5, z], { fixture: 'none', color: TORCH, intensity: 1, range: 11 });
for (const [x, z] of [[28, 92], [36, 92], [28, 100], [36, 100]] as const) m.light([x, 7.2, z], { fixture: 'bulb', color: '#ffc27a', intensity: 1.1, range: 11 });
for (const [x, z] of [[16, 88], [16, 104], [48, 88], [48, 104]] as const) m.light([x, 7.3, z], { fixture: 'ceiling', color: '#ffd9a0', intensity: 0.9, range: 9 });
for (const [x, z] of [[18, 6], [46, 6]] as const) m.light([x, 1.2, z], { fixture: 'none', color: '#ff7a2a', intensity: 1.5, range: 12 });
for (const [x, z, c] of [[24, 120, '#7fe8ff'], [32, 128, '#9ff0ff'], [40, 120, '#7fd8ff'], [16, 120, '#a0c8ff'], [24, 128, '#7fe8ff'], [40, 128, '#9ff0ff'], [32, 112, '#c0e0ff']] as const) m.light([x, 6.2, z], { fixture: 'none', color: c, intensity: 1.2, range: 10 });
m.light([32, 1.6, 52], { fixture: 'none', color: '#6a8aa0', intensity: 0.8, range: 8 });
m.light([16, 7.3, 68], { fixture: 'ceiling', color: '#ffd9a0', intensity: 0.8, range: 8 });

// Furnish the keep: a feasting hall, an armoury and a chapel in the wings, barracks over the bailey.
m.dress([4, 12, 1], 'dining', { density: 'normal', max: 30 });
m.dress([2, 11, 1], 'armoury').dress([2, 13, 1], 'chapel').dress([6, 11, 1], 'barracks').dress([6, 13, 1], 'storage');
m.dress({ x0: 0, y0: 8, x1: 0, y1: 9, z: 1 }, 'barracks').dress({ x0: 8, y0: 8, x1: 8, y1: 9, z: 1 }, 'armoury');

// ---------------------------------------------------------------- the gorge: cliffs climbing to the peaks on three sides
m.bounds('invisible', 0, { min: [-4, -4], max: [68, 132] }, 60);
type Rect4 = [number, number, number, number, number];
function surround(doc: MapDocument, size: number, centre: [number, number], hills: (x: number, z: number, d: number) => number, paint2: (x: number, z: number, h: number) => TerrainMaterial): TerrainData {
  const rects: Rect4[] = [];
  for (const b of buildMapGeometry(doc)) {
    if (b.kind !== 'floor' && b.kind !== 'wall') continue;
    rects.push([b.min[0], b.min[2], b.max[0], b.max[2], b.kind === 'floor' ? b.max[1] : b.min[1]]);
  }
  for (const b of doc.entities) if (b.kind === 'block' && b.size[1] > 2) rects.push([b.position[0] - b.size[0] / 2, b.position[2] - b.size[2] / 2, b.position[0] + b.size[0] / 2, b.position[2] + b.size[2] / 2, 0]);
  const rd = (x: number, z: number, r: Rect4) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3]));
  const dist = (x: number, z: number) => rects.reduce((a, r) => Math.min(a, rd(x, z, r)), Infinity);
  const cap = (x: number, z: number) => {
    let deep = Infinity;
    let c = Infinity;
    for (const r of rects) {
      if (x > r[0] + 0.6 && x < r[2] - 0.6 && z > r[1] + 0.6 && z < r[3] - 0.6) deep = Math.min(deep, r[4] - 3.5);
      c = Math.min(c, r[4] - 0.4 + 2.5 * Math.max(0, rd(x, z, r) - 1));
    }
    return Math.min(c, deep);
  };
  let t = newTerrain(size, 2, centre, 'stone');
  const heights: number[] = [];
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      const x = t.origin[0] + c * 2;
      const z = t.origin[1] + r * 2;
      heights.push(Math.round(Math.min(cap(x, z), hills(x, z, dist(x, z))) * 100));
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
      materials.push(TERRAIN_MATERIALS.indexOf(paint2(x, z, h)));
      foliage.push(h < 1 && dist(x, z) > 3 ? 1 : 0);
    }
  }
  return paintSlopes({ ...t, materials, foliage }, 34, 'stone');
}
const noise = (x: number, z: number) => Math.sin(x * 0.13 + 1.1) * Math.cos(z * 0.09 + 0.3) + 0.5 * Math.sin((x + z) * 0.21) + 0.3 * Math.cos((x - 2 * z) * 0.17);
const ground = surround(
  m.doc,
  250,
  [32, 60],
  (x, z, d) => {
    // The valley floor south of the wall opens out; everywhere else the gorge walls climb steeply.
    const out = Math.max(-4 - x, x - 68, 0);
    const back = Math.max(0, z - 132);
    const south = z < -4 ? (-4 - z) * 0.25 : 0;
    return Math.max(0, out * 1.4 + back * 1.2 + south) * (1 + 0.15 * noise(x, z)) + (out > 0 || back > 0 ? 3 * noise(x * 0.5, z * 0.5) + 3 : 0);
  },
  (x, z, h) => (h > 26 ? 'snow' : h > 2 ? 'stone' : (x + z) % 3 > 1 ? 'gravel' : 'dirt'),
);
m.terrain(ground);

m.teams([10, 10]);
m.meta({
  description:
    'A fortress walled across a mountain gorge on a night of storm. Co-op: sound the horn, hold the Deep Wall against the Black Warband on the causeway and the ladders, stop them when the culvert blows, then make the last stand in the keep until dawn. Team modes: the attackers camp in the valley, the defenders hold the keep (flags in the camp and the great hall; hills on the causeway, the wall, the bailey and the hall).',
  modes: ['core.coop', 'core.tdm', 'core.ctf', 'core.koth', 'core.deathmatch'],
  players: [4, 20],
});
// The map's picture: the automatic camera frames a poor view here (tools/content/capture-map-shots.mjs).
m.thumbnailCamera([34, 24, 2], [34, 4, 60]);
await m.save();
