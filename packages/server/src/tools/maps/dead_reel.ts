/**
 * Dead Reel: a co-op creature-survival night in an abandoned theatre (1–4
 * players; homage in spirit to Call of Duty's Kino der Toten). Hold the
 * lobby while the first wave pours in from the courtyards, clear the foyer,
 * fight into the auditorium, throw the power on the stage and survive a
 * minute of everything the theatre has, then escape through the projection
 * booth behind the stage.
 *
 * Grid x east, y north (one cell = 8 m).
 *
 *   y7          B                   B projection booth (evac)
 *   y6      w   S   S   S   e       S stage (power switch), w/e wings
 *   y5      w   A   A   A   e       A auditorium (the great hall, dais in the middle)
 *   y4      w   A   A   A   e
 *   y3      w   A   A   A   e
 *   y2      F   F   F   F   F       F foyer
 *   y1  c   c   L   L   L   c   c   L lobby (start), c courtyards
 *   y0  c   c   L   L   L   c   c
 *       0   1   2   3   4   5   6
 */
import { TERRAIN_MATERIALS, buildOccupancy, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial, type ScenarioLogic, type Side, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('dead_reel', 'Dead Reel');
m.theme('manor');
m.backdrop('dusk', 'city', 'gravel', 0.55, 0.55);
m.factions([{ id: 'xeno', name: 'The Things', color: '#8fd14f', relations: {} }]);
const P = Math.PI / 2;
type Style = Parameters<typeof m.edge>[4];

// ---------------------------------------------------------------- the theatre
const BRICK = { facade: 'brick' } as const; // the theatre's outside walls
for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1], [5, 0], [6, 0], [5, 1], [6, 1]] as const) m.tile('yard', x, y);
for (let x = 2; x <= 4; x++) for (const y of [0, 1]) m.tile('room', x, y, 0, 0, BRICK);
for (let x = 1; x <= 5; x++) m.tile('room', x, 2, 0, 0, BRICK);
m.tile('hall', 2, 3);
for (let y = 3; y <= 6; y++) m.tile('room', 1, y, 0, 0, BRICK).tile('room', 5, y, 0, 0, BRICK);
for (let x = 2; x <= 4; x++) m.tile('room', x, 6, 0, 0, BRICK);
m.tile('room', 3, 7, 0, 0, BRICK);

const e = (x: number, y: number, side: Side, style: Style) => m.edge(x, y, 0, side, style);
// Courtyards: walled in, wide open into the lobby.
for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1], [5, 0], [6, 0], [5, 1], [6, 1]] as const) {
  if (x === 0) e(x, y, 'W', 'high');
  if (x === 6) e(x, y, 'E', 'high');
  if (y === 0) e(x, y, 'S', 'high');
  if (y === 1) e(x, y, 'N', 'high');
}
for (const y of [0, 1]) e(1, y, 'E', 'wide');
for (const y of [0, 1]) e(5, y, 'W', 'wide');
// Lobby: one room of six cells; the boarded-up front; a locked door north into the foyer.
for (const y of [0, 1]) for (const x of [2, 3]) e(x, y, 'E', 'open');
for (let x = 2; x <= 4; x++) e(x, 0, 'N', 'open').edge(x, 0, 0, 'S', 'wall');
e(2, 1, 'N', 'wall');
e(3, 1, 'N', 'door');
e(4, 1, 'N', 'wall');
// Foyer: a long room; a locked door north into the auditorium; walled off from the wings.
for (let x = 1; x <= 4; x++) e(x, 2, 'E', 'open');
for (const x of [1, 2, 4, 5]) e(x, 2, 'N', 'wall');
e(3, 2, 'N', 'door');
e(1, 2, 'S', 'wall').edge(5, 2, 0, 'S', 'wall').edge(1, 2, 0, 'W', 'wall').edge(5, 2, 0, 'E', 'wall');
// The wings: corridors either side of the auditorium, open to it through arches.
for (let y = 3; y <= 5; y++) e(1, y, 'E', 'arch').edge(5, y, 0, 'W', 'arch');
for (let y = 3; y <= 5; y++) e(1, y, 'N', 'open').edge(5, y, 0, 'N', 'open');
e(1, 6, 'E', 'door').edge(5, 6, 0, 'W', 'door');
// The stage: open to the auditorium; the booth door behind it.
for (let x = 2; x <= 4; x++) e(x, 5, 'N', 'open');
e(2, 6, 'E', 'open').edge(3, 6, 0, 'E', 'open');
e(2, 6, 'N', 'wall').edge(4, 6, 0, 'N', 'wall');
e(3, 6, 'N', 'door');

// A roof over the theatre (not the courtyards), and warm colours inside.
const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
const theatre: [number, number][] = [];
for (let x = 2; x <= 4; x++) for (const y of [0, 1, 6]) theatre.push([x, y]);
for (let x = 1; x <= 5; x++) theatre.push([x, 2]);
for (let y = 3; y <= 6; y++) theatre.push([1, y], [5, y]);
theatre.push([3, 7]);
const plaster = mat('pbr_plaster', '#e2cfae');
for (const [x, y] of theatre) {
  m.tile('platform', x, y, 1);
  paint(x, y, 1, { underside: mat('pbr_plaster_white', '#d8c8a8'), solids: plaster, floor: mat('pbr_gravel') });
  const carpet = y === 2 || (y <= 1 && x === 3) || y >= 6;
  paint(x, y, 0, { walls: plaster, floor: carpet ? mat('pbr_carpet', '#c0444c') : mat('pbr_floorboards'), trim: mat('brass') });
}
for (let x = 2; x <= 4; x++) for (let y = 3; y <= 5; y++) m.tile('platform', x, y, 1).history;
for (let x = 2; x <= 4; x++) for (let y = 3; y <= 5; y++) paint(x, y, 1, { underside: mat('pbr_plaster_white', '#d8c8a8'), solids: plaster, floor: mat('pbr_gravel') });
paint(2, 3, 0, { walls: plaster, floor: mat('pbr_carpet', '#c0444c'), solids: mat('pbr_travertine'), trim: mat('brass') });

const DOOR = { kind: 'door' as const, startOpen: false, locked: true, auto: true };
m.add({ ...DOOR, id: 'door_lobby', name: 'Lobby doors', position: [24, 0, 12], yaw: 0 });
m.add({ ...DOOR, id: 'door_hall', name: 'Auditorium doors', position: [24, 0, 20], yaw: 0 });
m.add({ ...DOOR, id: 'door_booth', name: 'Booth door', position: [24, 0, 52], yaw: 0 });
m.add({ kind: 'button', id: 'btn_power', name: 'Power', position: [32, 0, 51.3], yaw: Math.PI, label: 'Throw the power', once: true, cooldownSeconds: 1, startEnabled: false });
m.add({ kind: 'zone', id: 'zone_booth', name: 'Projection booth', position: [24, 0, 56], size: [6, 3, 5], who: 'any', count: 1, startEnabled: true });

// ---------------------------------------------------------------- dressing
const CURTAIN = { material: 'pbr_canvas', tint: '#7a1420' };
// The stage curtain, drawn back from the booth door in the middle.
m.block([17.75, 0, 51.6], [7.5, 4, 0.3], 'solid', CURTAIN).block([30.25, 0, 51.6], [7.5, 4, 0.3], 'solid', CURTAIN);
for (const x of [13.5, 34.5]) for (const z of [30, 34, 38]) m.prop('bench', [x, 0, z], 0).prop('bench', [x + 1.2, 0, z], 0);
m.prop('table_cloth', [24, 0, 4], 0).prop('bookcase', [13, 0, -3.3], 0).prop('bookcase', [35, 0, -3.3], 0).prop('rug', [24, 0, 7], 0, 1, false);
m.prop('sofa', [14, 0, 10.6], Math.PI).prop('armchair', [34, 0, 10.6], Math.PI).prop('floor_lamp', [12.6, 0, 10.7]).prop('floor_lamp', [35.4, 0, 10.7]);
m.prop('coat_rack', [9, 0, 19]).prop('potted_plant', [39, 0, 19]).prop('side_table', [20, 0, 19.4], Math.PI).prop('side_table', [28, 0, 19.4], Math.PI);
m.prop('crate_large', [6, 0, 50], 0.2).prop('cardboard_box', [42, 0, 50]).prop('coat_rack', [10, 0, 26]).prop('bookcase', [42.6, 0, 30], -P);
m.prop('speaker', [12.5, 0, 50.5], Math.PI).prop('speaker', [35.5, 0, 50.5], Math.PI).prop('tv', [24, 0, 59], Math.PI);
m.prop('barrel', [-2, 0, -2]).prop('dungeon_barrel', [50, 0, 10]).prop('skip', [-1.5, 0, 9], P).prop('tree_thin', [51, 0, -2]);
m.breakable('boards', [24, 0, -4.2], 0);

// ---------------------------------------------------------------- players and supplies
for (const [x, z] of [[22, 4], [26, 4], [22, 8], [26, 8]] as const) m.spawn([x, 0, z], 0, null);
m.pickup('weapon_smg', [16, 0, 2]).pickup('weapon_shotgun', [32, 0, 2]).pickup('ammo', [24, 0, 10]).pickup('health_small', [16, 0, 9]);
m.pickup('weapon_rifle', [8, 0, 16]).pickup('ammo_shells', [40, 0, 16]).pickup('armor_small', [24, 0, 16]).pickup('grenades', [32, 0, 16]);
m.pickup('weapon_lmg', [24, 0, 26], 90).pickup('health_large', [8, 0, 40]).pickup('ammo_rifle', [40, 0, 40]).pickup('armor_large', [24, 0, 48]);
m.pickup('weapon_rockets', [40, 0, 26], 90).pickup('ammo_explosive', [8, 0, 28]).pickup('health_small', [40, 0, 48]).pickup('ammo', [8, 0, 48]);

// ---------------------------------------------------------------- the things
const roster = { trooper: 0, gunner: 0, heavy: 0, imp: 0, puglin: 0, cyclops: 0, oculus: 0, scolitex: 0 };
const squad = { kind: 'encounter', yaw: 0, faction: 'xeno', perPlayer: 1, respawnSeconds: 3, radius: 3, order: 'attack', orderTarget: null, difficulty: 'normal' } as const;
m.add({ ...squad, id: 'enc_court_w', name: 'West courtyard', position: [0, 0, 4], roster: { ...roster, imp: 3 }, activeCap: 4, reinforcements: 4, startActive: true });
m.add({ ...squad, id: 'enc_court_e', name: 'East courtyard', position: [48, 0, 4], roster: { ...roster, imp: 2, puglin: 1 }, activeCap: 4, reinforcements: 3, startActive: true });
m.add({ ...squad, id: 'enc_foyer', name: 'Foyer', position: [8, 0, 16], roster: { ...roster, imp: 3, puglin: 2 }, activeCap: 6, reinforcements: 6, startActive: false });
m.add({ ...squad, id: 'enc_hall', name: 'Auditorium', position: [24, 0, 40], roster: { ...roster, imp: 2, cyclops: 1, oculus: 1 }, activeCap: 6, reinforcements: 2, startActive: false });
m.add({ ...squad, id: 'enc_wing_w', name: 'West wing', position: [8, 0, 34], roster: { ...roster, imp: 2, puglin: 2, cyclops: 1 }, activeCap: 6, reinforcements: 10, perPlayer: 2, startActive: false });
m.add({ ...squad, id: 'enc_wing_e', name: 'East wing', position: [40, 0, 34], roster: { ...roster, imp: 2, oculus: 2 }, activeCap: 6, reinforcements: 10, perPlayer: 2, startActive: false });
m.add({ ...squad, id: 'enc_brute', name: 'The brute', position: [24, 0, 30], roster: { ...roster, scolitex: 1 }, activeCap: 1, reinforcements: 0, perPlayer: 0, startActive: false });

// ---------------------------------------------------------------- the night
type Action = ScenarioLogic['rules'][number]['do'][number];
type Condition = ScenarioLogic['rules'][number]['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const say = (text: string, seconds = 4) => act('message', null, { value: seconds, text });
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: string, target: string | null, does: Action[], ifs: Condition[] = [], once = true) =>
  ({ id, name, enabled: true, once, when: { event, target }, if: ifs, do: does }) as ScenarioLogic['rules'][number];
const open = (door: string) => [act('door_unlock', door), act('door_open', door)];
const lobbyClear = [
  act('objective', 'obj_lobby', { state: 'complete' }),
  ...open('door_lobby'),
  act('objective', 'obj_foyer', { state: 'active' }),
  act('encounter_start', 'enc_foyer'),
  act('sound', null, { state: 'chime' }),
  say('The lobby doors give way. Something is moving in the foyer.'),
];

m.logic({
  variables: [{ id: 'var_lives', name: 'lives', initial: 12 }],
  timers: [{ id: 'timer_power', name: 'Hold out', seconds: 60, loop: false, visible: true }],
  objectives: [
    { id: 'obj_lobby', text: 'Hold the lobby', startActive: true, marker: null },
    { id: 'obj_foyer', text: 'Clear the foyer', startActive: false, marker: 'enc_foyer' },
    { id: 'obj_hall', text: 'Take the auditorium', startActive: false, marker: 'enc_hall' },
    { id: 'obj_power', text: 'Throw the power on the stage', startActive: false, marker: 'btn_power' },
    { id: 'obj_survive', text: 'Survive until the projector warms up', startActive: false, marker: null },
    { id: 'obj_escape', text: 'Escape through the projection booth', startActive: false, marker: 'zone_booth' },
  ],
  rules: [
    rule('rule_intro', 'Curtain up', 'match_start', null, [say('They are coming over the courtyard walls. Hold the lobby!', 5), act('sound', null, { state: 'alarm' })]),
    // The lobby: both courtyards must be cleared, in either order.
    rule('rule_lobby_w', 'Lobby held (west last)', 'encounter_cleared', 'enc_court_w', lobbyClear, [cond('encounter_alive', 'enc_court_e', '==', 0)]),
    rule('rule_lobby_e', 'Lobby held (east last)', 'encounter_cleared', 'enc_court_e', lobbyClear, [cond('encounter_alive', 'enc_court_w', '==', 0)]),
    rule('rule_foyer', 'Foyer cleared', 'encounter_cleared', 'enc_foyer', [
      act('objective', 'obj_foyer', { state: 'complete' }),
      ...open('door_hall'),
      act('objective', 'obj_hall', { state: 'active' }),
      act('encounter_start', 'enc_hall'),
      say('The auditorium. Get to the stage.'),
    ]),
    rule('rule_hall', 'Auditorium taken', 'encounter_cleared', 'enc_hall', [
      act('objective', 'obj_hall', { state: 'complete' }),
      act('enable', 'btn_power'),
      act('objective', 'obj_power', { state: 'active' }),
      say('The power switch is on the stage, stage right.'),
    ]),
    rule('rule_power', 'Power on: the last stand', 'button_pressed', 'btn_power', [
      act('objective', 'obj_power', { state: 'complete' }),
      act('objective', 'obj_survive', { state: 'active' }),
      act('sound', null, { state: 'alarm' }),
      say('Power is on! The projector needs a minute. Survive!'),
      act('timer_start', 'timer_power'),
      act('encounter_start', 'enc_wing_w'),
      act('wait', null, { value: 6 }),
      act('encounter_start', 'enc_wing_e'),
      act('wait', null, { value: 20 }),
      say('Something big is coming...', 3),
      act('encounter_start', 'enc_brute'),
    ]),
    rule('rule_projector', 'Projector ready', 'timer_done', 'timer_power', [
      act('encounter_stop', 'enc_wing_w'),
      act('encounter_stop', 'enc_wing_e'),
      act('objective', 'obj_survive', { state: 'complete' }),
      ...open('door_booth'),
      act('objective', 'obj_escape', { state: 'active' }),
      act('sound', null, { state: 'chime' }),
      say('The booth is open. Behind the curtain, go!'),
    ]),
    rule('rule_escape', 'Escape', 'zone_enter', 'zone_booth', [act('objective', 'obj_escape', { state: 'complete' }), say('You made it out. The End.'), act('wait', null, { value: 2 }), act('end_round', null, { state: 'players win' })], [cond('objective', 'obj_escape', '==', 0, 'active')]),
    rule('rule_life_lost', 'Count lives', 'player_killed', null, [act('add_var', 'var_lives', { value: -1 })], [], false),
    rule('rule_low_lives', 'Low on lives', 'variable_changed', 'var_lives', [say('Only 3 lives left!', 3), act('sound', null, { state: 'buzzer' })], [cond('variable', 'var_lives', '==', 3)]),
    rule('rule_defeat', 'Out of lives', 'variable_changed', 'var_lives', [say('The things have the theatre. Game over.'), act('end_round', null, { state: 'players lose' })], [cond('variable', 'var_lives', '<=', 0)]),
  ],
});

// Theatre lighting: warm panels in the foyer and wings, chandelier bulbs over the auditorium, footlights on the stage.
m.lightRooms({ color: '#ffd9a0', intensity: 0.9 });
for (const [x, z] of [[18, 28], [30, 28], [18, 38], [30, 38]] as const) m.light([x, 3.2, z], { fixture: 'bulb', color: '#ffcf8a', intensity: 1.2, range: 11 });
m.light([24, 0.4, 45], { fixture: 'strip', color: '#ffe2b0', intensity: 1.3, range: 8 });
// ---------------------------------------------------------------- ground and planting (after the boundary is set)
const sm = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/**
 * Terrain under and round what is built: sunk 3.6 m under every built cell
 * (below the lowest level built there, so nothing standing or hung over a
 * floor counts as floating), level within `flat` m of
 * the tiles, free blocks and entities, then `shape(x, z, d)` further out (d:
 * metres from the nearest of them). `cover(x, z, d, h)` gives each terrain
 * cell's ground and plant cover (0–4); cells under or against the buildings
 * stay bare so no grass pokes through a floor. Reaches `margin` m past the boundary.
 */
function sculpt(margin: number, flat: number, shape: (x: number, z: number, d: number) => number, cover: (x: number, z: number, d: number, h: number) => [TerrainMaterial, number]): TerrainData {
  const b = m.doc.bounds!;
  const x0 = Math.floor((b.min[0] - margin) / 4) * 4;
  const z0 = Math.floor((b.min[1] - margin) / 4) * 4;
  const cols = Math.min(161, Math.ceil((b.max[0] + margin - x0) / 2) + 1);
  const rows = Math.min(161, Math.ceil((b.max[1] + margin - z0) / 2) + 1);
  const low = new Map<string, number>();
  const rects: [number, number, number, number][] = [];
  for (const key of buildOccupancy(m.doc).cells.keys()) {
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number];
    const col = `${gx},${gy}`;
    if (!low.has(col)) rects.push([gx * 8 - 4, gy * 8 - 4, gx * 8 + 4, gy * 8 + 4]);
    low.set(col, Math.min(low.get(col) ?? Infinity, gz));
  }
  const points: [number, number][] = [];
  for (const e of m.doc.entities) {
    if (e.kind === 'block') {
      const r = Math.hypot(e.size[0], e.size[2]) / 2;
      rects.push([e.position[0] - r, e.position[2] - r, e.position[0] + r, e.position[2] + r]);
    } else points.push([e.position[0], e.position[2]]);
  }
  const dist = (x: number, z: number) => {
    let d = Infinity;
    for (const [ax, az, bx, bz] of rects) d = Math.min(d, Math.hypot(Math.max(ax - x, 0, x - bx), Math.max(az - z, 0, z - bz)));
    for (const [px, pz] of points) d = Math.min(d, Math.hypot(px - x, pz - z));
    return d;
  };
  const heights: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * 2;
      const z = z0 + r * 2;
      // The cells this vertex touches: under any of them the ground drops away under the lowest level.
      // On the outer edge of ground-floor cells it meets the floor's top, so the ground outside stays level.
      let under = Infinity;
      let edge = false;
      for (const gx of new Set([Math.floor((x + 4) / 8), Math.ceil((x - 4) / 8)])) for (const gy of new Set([Math.floor((z + 4) / 8), Math.ceil((z - 4) / 8)])) {
        const lz = low.get(`${gx},${gy}`);
        if (lz !== undefined && lz <= 0) under = Math.min(under, lz * 4 - 3.6);
        else edge = true;
      }
      if (edge && under === -3.6) under = 0;
      const d = dist(x, z);
      const h = under < Infinity ? under : d <= flat ? 0 : shape(x, z, d);
      heights.push(Math.round(h * 100));
    }
  }
  const t: TerrainData = { origin: [x0, z0], spacing: 2, cols, rows, baseY: 0, heights, materials: [], boundary: true, foliage: [] };
  const materials: number[] = [];
  const foliage: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const x = x0 + c * 2 + 1;
      const z = z0 + r * 2 + 1;
      const d = dist(x, z);
      const [g, f] = cover(x, z, d, terrainHeightAt(t, x, z) ?? 0);
      materials.push(TERRAIN_MATERIALS.indexOf(g));
      foliage.push(d < 2 ? 0 : f);
    }
  }
  const out = paintSlopes({ ...t, materials, foliage }, 38, 'stone');
  m.terrain(out);
  return out;
}
/** What stays clear of dressing: spawns, pickups and objectives (with their radius), doors, buttons, squads, vehicles. */
const KEEP_CLEAR = new Set(['spawn', 'pickup', 'flag', 'hill', 'hostage', 'rescue', 'bombsite', 'zone', 'button', 'door', 'encounter', 'ladder', 'pad', 'mount']);
/** Room for a piece of dressing `r` m round (x, y, z): inside the boundary, clear of the above, other props and free blocks. */
function free(x: number, y: number, z: number, r = 1): boolean {
  const b = m.doc.bounds!;
  if (x < b.min[0] + 0.5 || x > b.max[0] - 0.5 || z < b.min[1] + 0.5 || z > b.max[1] - 0.5) return false;
  return m.doc.entities.every((e) => {
    if (Math.abs(e.position[1] - y) > 2.5 && e.kind !== 'zone') return true;
    const d = Math.hypot(e.position[0] - x, e.position[2] - z);
    if (e.kind === 'block') return Math.abs(e.position[0] - x) > e.size[0] / 2 + r || Math.abs(e.position[2] - z) > e.size[2] / 2 + r;
    if (e.kind === 'prop' || e.kind === 'destructible') return d > r + 0.8;
    if (!KEEP_CLEAR.has(e.kind)) return true;
    const reach = e.kind === 'zone' ? Math.max(e.size[0], e.size[2]) / 2 : 'radius' in e && e.kind !== 'encounter' ? e.radius : 1.5;
    return d > reach + r + 1;
  });
}
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let ground: TerrainData | null = null;
const groundY = (x: number, z: number) => (ground ? +(Math.max(0, terrainHeightAt(ground, x, z) ?? 0)).toFixed(2) : 0);
let cells: ReturnType<typeof buildOccupancy>['cells'] | null = null;
/** Out in the open at (x, y, z), and the same a metre round: on no tile, or on a yard, street or plaza (never in a building). */
function outdoors(x: number, y: number, z: number): boolean {
  cells ??= buildOccupancy(m.doc).cells;
  return [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].every(([dx, dz]) => {
    const c = cells!.get(`${Math.round((x + dx!) / 8)},${Math.round((z + dz!) / 8)},${Math.floor((y + 0.01) / 4)}`);
    return !c || /yard$|street|plaza|intersection|crossroads/.test(c.placement.tile);
  });
}
/** Plant one piece on the ground (or on a floor at `y`; `inside` for furniture) if there is room; returns whether it went in. */
function plant(model: string, x: number, z: number, o: { y?: number; yaw?: number; scale?: number; r?: number; inside?: boolean } = {}): boolean {
  const y = o.y ?? groundY(x, z);
  if (!o.inside && !outdoors(x, y, z)) return false;
  if (!free(x, y, z, o.r ?? 1)) return false;
  m.prop(model, [+x.toFixed(2), y, +z.toFixed(2)], +(o.yaw ?? rnd() * 6.28).toFixed(2), +(o.scale ?? 0.85 + rnd() * 0.35).toFixed(2));
  // Keep later checks honest: what is planted now counts as taken.
  (m as unknown as { flush(): void }).flush();
  return true;
}
/** A clump of `n` bushes (players can hide in them) round (x, z), `spread` m across. */
function clump(x: number, z: number, n: number, spread: number, kinds: string[], y?: number): void {
  for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
    const a = rnd() * 6.28;
    const s = Math.sqrt(rnd()) * spread;
    if (plant(kinds[(i + tries) % kinds.length]!, x + Math.cos(a) * s, z + Math.sin(a) * s, { y, r: 0.6 })) i++;
  }
}

m.bounds('invisible');
// Round the theatre: a level verge, then overgrown waste ground climbing to wild hills under the dusk sky.
ground = sculpt(56, 6, (x, z, d) => sm(6, 30, d) * (5 + 2.5 * Math.sin(x / 10 + 2) * Math.cos(z / 12) + 1.5 * Math.sin((x - z) / 8)) + sm(26, 52, d) * 8, (x, z, d, h) => {
  if (d < 8) return ['dirt', 2];
  if (h > 12) return ['moss', 3];
  return [Math.sin(x / 6 + z / 7) > 0.5 ? 'mud' : 'grass', 4];
});
for (const [x, z] of [[-6, 20], [-6, 44], [54, 24], [54, 50], [12, 62], [36, 62], [24, -6.2], [-6, -6], [54, -6]] as const) plant(['nt_dead_tree', 'nt_willow_dead', 'rn_dead_tree'][Math.abs(Math.round(x + z)) % 3]!, x, z, { r: 0.8 });
// The courtyards have gone to seed: thickets along their walls to duck into between waves (clear of where the things come over).
for (const [x, z] of [[-1, -1], [9, 9], [9, -1], [39, -1], [47, 9], [39, 9]] as const) clump(x, z, 2, 1.8, ['nt_bush_berries', 'nt_bush_leafy', 'nt_fern_wide']);
m.meta({
  description:
    'A co-op creature-survival night in an abandoned theatre. Hold the lobby as the things come over the courtyard walls, clear the foyer, take the auditorium, throw the power on the stage and survive a minute of everything the theatre has — then escape through the projection booth behind the curtain.',
  modes: ['core.coop'],
  players: [1, 4],
});
await m.save();
