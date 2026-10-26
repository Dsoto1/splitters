/**
 * Mercy Ward: the showcase map for madduck's Modular 3D Hospital Environment
 * (the `hp_*` props; our own map and name), for 2–12 players in Team
 * Deathmatch, Deathmatch, Zombies and Co-op. A two-storey hospital at night:
 * the main concourse with an entrance lobby, waiting room and cafeteria off
 * it, two four-bed wards, a back corridor, and upstairs intensive care, the
 * operating theatre (a glazed isolation room built from the kit's wall,
 * window and doorway pieces) and the landing. A staircase climbs from the
 * concourse to the upstairs landing; two fire-escape stairs climb from the
 * yards straight into the upstairs corridor.
 *
 * - Co-op: raise the code-black alarm at the reception desk. The ground-floor
 *   wards fill with the infected, then intensive care, then the theatre;
 *   clear all three. (The alarm works in every mode.)
 * - Zombies: the waves rise from the wards, the yards and the stairwells.
 *
 * Grid x east, y north (one cell = 8 m); z0 ground, z1 upstairs.
 *
 *   z1  y2   back corridor ─ LANDING ─ back corridor
 *       y1   ICU (2 cells)   [stairs]   THEATRE (2 cells, isolation room)
 *       y0   upstairs corridor (5 cells) ── fire escapes up from the yards, x -3 and x 3
 *   z0  y2   back corridor (5 cells)
 *       y1   WARD A (2)     STAIRS up   WARD B (2)
 *       y0   concourse (5 cells)
 *       y-1  yard  waiting  LOBBY  cafeteria  yard
 *       y-2  yards: the car park and ambulance bay
 *            x -2   -1      0      1          2
 */
import { buildMapGeometry, type EdgeStyle, type LogicAction, type LogicRule, type RoomOptions, type Side, type TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('mercy_ward', 'Mercy Ward');
m.theme('lab');
m.backdrop('night', 'city', 'gravel', 0.45, 0.2);
m.teams([6, 6]);
const [WEST, EAST] = m.teamIds(2) as [string, string];
m.factions([{ id: 'infected', name: 'The Infected', color: '#7d9a6a', relations: {} }]);

type V3 = [number, number, number];
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];
const edge = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => m.edge(x, y, z, side, style);
/** Room ceilings are 3.5 m up (the slab of the floor above, or the roof). */
const CEIL = 3.5;

// ---------------------------------------------------------------- the building

const ROOM: RoomOptions = { layout: 'empty', facade: 'plaster' };
const ROOF: RoomOptions = { ...ROOM, ceiling: 'roof' };
for (const z of [0, 1]) {
  for (let x = -2; x <= 2; x++) {
    m.tile('room', x, 0, z, 0, z ? ROOF : ROOM); // concourse / upstairs corridor
    m.tile('room', x, 2, z, 0, z ? ROOF : ROOM); // back corridors (the landing upstairs at x 0)
    if (x !== 0) m.tile('room', x, 1, z, 0, z ? ROOF : ROOM); // wards, ICU, theatre
  }
  // Corridors run through: nothing between their cells.
  for (let x = -2; x < 2; x++) {
    edge(x, 0, z, 'E', 'open');
    edge(x, 2, z, 'E', 'open');
  }
  // The two-cell rooms either side of the stairs.
  edge(-2, 1, z, 'E', 'open');
  edge(1, 1, z, 'E', 'open');
  // Into them from the front corridor, and out the back.
  // (big interior windows into the outer halves, the way in through the inner halves)
  edge(-2, 1, z, 'S', 'windows').edge(-1, 1, z, 'S', 'wide').edge(1, 1, z, 'S', 'wide').edge(2, 1, z, 'S', 'windows');
  edge(-1, 1, z, 'N', 'door').edge(1, 1, z, 'N', 'door');
  // Windows all round the outside.
  for (let x = -2; x <= 2; x++) edge(x, 2, z, 'N', 'windows');
  for (const y of [1, 2]) edge(-2, y, z, 'W', 'windows').edge(2, y, z, 'E', 'windows');
}
// The main stairs: from the concourse (south, ground) up to the landing (north, upstairs).
m.tile('stairs', 0, 1, 0, 3);
// Ground floor walls between the back corridor and what's under the landing stay walls; upstairs the landing opens on both sides (set above).
edge(0, 2, 0, 'S', 'wall');
// Upstairs, the front corridor has windows over the lobby roof; the ends open onto the fire escapes.
for (const x of [-1, 0, 1]) edge(x, 0, 1, 'S', 'windows');
edge(-2, 0, 1, 'S', 'windows').edge(2, 0, 1, 'S', 'windows');
// Ground floor front: the waiting room, the entrance lobby and the cafeteria, under their own roof.
m.tile('room', -1, -1, 0, 0, ROOF); // waiting room
m.tile('room', 0, -1, 0, 0, ROOF); // entrance lobby
m.tile('room', 1, -1, 0, 0, ROOF); // cafeteria
edge(-1, -1, 0, 'N', 'wide').edge(0, -1, 0, 'N', 'wide').edge(1, -1, 0, 'N', 'wide');
edge(-1, -1, 0, 'E', 'door').edge(0, -1, 0, 'E', 'door');
edge(0, -1, 0, 'S', 'wide').edge(-1, -1, 0, 'S', 'windows').edge(1, -1, 0, 'S', 'windows');
edge(-1, -1, 0, 'W', 'door').edge(1, -1, 0, 'E', 'door');
edge(-2, 0, 0, 'W', 'wall').edge(2, 0, 0, 'E', 'wall').edge(-2, 0, 0, 'S', 'windows').edge(2, 0, 0, 'S', 'windows');
// Fire escapes: from the yard up the outside into each end of the upstairs corridor.
m.tile('stairs', -3, 0, 0, 0); // low end west (the yard at x -4), top end east (the corridor at x -2, upstairs)
m.tile('stairs', 3, 0, 0, 2); // low end east (x 4), top end west (x 2, upstairs)
edge(-2, 0, 1, 'W', 'door').edge(2, 0, 1, 'E', 'door');
// The yards: car park, ambulance bay, the paths round to the fire escapes.
for (let x = -4; x <= 4; x++) m.tile('yard', x, -2, 0);
for (const x of [-4, -3, -2, 2, 3, 4]) m.tile('yard', x, -1, 0);
for (const x of [-4, 4]) m.tile('yard', x, 0, 0);

// ---------------------------------------------------------------- the look: white walls over a dark grey dado, light tiles, dark frames

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
const CLINIC: TileSurfaces = { floor: mat('white_tiles', '#f4f4f2'), walls: mat('paint_matte', '#eceeef'), underside: mat('paint_matte', '#d9dcde'), solids: mat('paint_matte', '#eceeef'), trim: mat('paint_matte', '#3a3e42') };
const rooms = m.doc.classicStructure.tiles.filter((t) => t.tile === 'core.room');
for (const t of rooms) m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...CLINIC } }] });
for (const t of m.doc.classicStructure.tiles.filter((x) => x.tile === 'core.stairs')) m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, floor: mat('pbr_concrete'), walls: mat('paint_matte', '#eceeef'), solids: mat('pbr_concrete') } }] });
/** A room cell at this level (where a dado runs), from a world point. */
const roomAt = (wx: number, wz: number, level: number) => rooms.some((t) => t.z === level && Math.abs(t.x * 8 - wx) < 4 && Math.abs(t.y * 8 - wz) < 4);
// The dado: a dark grey band 1.15 m high on every wall face inside the building, under the windows too (up to the sill).
const DADO = 1.15;
let dado = 0;
for (const b of buildMapGeometry(m.doc)) {
  if (b.kind !== 'wall') continue;
  const level = Math.round(b.min[1] / 4);
  // Full-height walls, and the sills under windows (shorter pieces standing on the floor).
  if (Math.abs(b.min[1] - level * 4) > 0.01 || b.max[1] - b.min[1] < 0.5) continue;
  const high = Math.min(DADO, b.max[1] - b.min[1] + 0.02);
  const [w, d] = [b.max[0] - b.min[0], b.max[2] - b.min[2]];
  if (Math.max(w, d) < 0.3) continue;
  const alongX = w >= d;
  for (const sgn of [-1, 1]) {
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    const face = alongX ? (sgn > 0 ? b.max[2] : b.min[2]) : sgn > 0 ? b.max[0] : b.min[0];
    const probe = alongX ? roomAt(cx, face + sgn * 0.4, level) : roomAt(face + sgn * 0.4, cz, level);
    if (!probe) continue;
    // Blocks are at least 0.2 m thick: sunk into the wall, 2 cm proud of it.
    const pos: V3 = alongX ? [r2(cx), level * 4, r2(face - sgn * 0.08)] : [r2(face - sgn * 0.08), level * 4, r2(cz)];
    const size: V3 = alongX ? [r2(w), r2(high), 0.2] : [0.2, r2(high), r2(d)];
    m.block(pos, size, 'solid', { material: 'paint_matte', tint: '#55595e', id: `dado_${++dado}` });
  }
}

// ---------------------------------------------------------------- the kit pieces

// The cafeteria's floor and the theatre's are the kit's own tiles, laid flush.
for (const dx of [-1.5, 1.5]) for (const dy of [-1.5, 1.5]) m.prop('hp_floor_tile_blue', at(1, -1, 0, dx, dy, -0.13), 0, 1, false);
for (const x of [6.5, 9.5, 12.5]) for (const z of [6.5, 9.5]) m.prop('hp_floor_tile', [x, 3.87, z], 0, 1, false);
// Square pillars down the concourse and the upstairs corridor.
for (const x of [-12, -4, 4, 12]) for (const z of [0, 1]) m.prop('hp_pillar', [x, z * 4, 0], 0);
// Flush square light panels, two to a cell along the corridors.
const PANEL = 1.9;
for (let x = -18; x <= 18; x += 4) for (const z of [0, 1]) m.prop('hp_ceiling_light', [x, r2(z * 4 + CEIL - 0.11), 0], 0, PANEL, false);
for (const [x, y] of [[-2, 1], [-1, 1], [1, 1], [2, 1], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2]] as const) for (const z of [0, 1]) for (const dx of [-2, 2]) m.prop('hp_ceiling_light', at(x, y, z, dx, 0, CEIL - 0.11), 0, PANEL, false);
for (const x of [-1, 0, 1]) m.prop('hp_ceiling_light', at(x, -1, 0, 0, 0, CEIL - 0.11), 0, PANEL, false);
m.prop('hp_exit_sign', at(0, -1, 0, 0, -3.6, 3.15), 0, 1, false).prop('hp_exit_sign', at(-2, 0, 1, -3.6, 0, 3.15), P, 1, false).prop('hp_exit_sign', at(2, 0, 1, 3.6, 0, 3.15), -P, 1, false);
m.prop('hp_exit_sign', at(-2, 0, 0, -3.6, 0, 3.15), P, 1, false).prop('hp_exit_sign', at(2, 0, 0, 3.6, 0, 3.15), -P, 1, false);
// Closed doors on the back corridor's wall: store rooms nobody gets into.
m.prop('hp_door', at(-2, 2, 0, -1.5, -3.62), 0).prop('hp_door', at(2, 2, 0, 1.5, -3.62), 0);

// ---------------------------------------------------------------- wards (ground floor)

/** Four beds along a ward's back wall with drawers between them and drips beside, chairs and a wheelchair along the front. */
function ward(cx: number, z: number, side: 1 | -1): void {
  // Three beds west of the back door, one past it (the door at 12 m in keeps clear).
  const xs = [2.5, 5, 7.5, 14.6].map((d) => cx + side * d);
  for (const [i, x] of xs.entries()) {
    m.prop('hp_bed', [r2(x), z * 4, 10.5], S);
    const iv = x - side * 0.85;
    m.prop('hp_iv_stand', [r2(iv), z * 4, 11.1], 0).prop('hp_iv_bag', [r2(iv + 0.1), r2(z * 4 + 0.82), 11.1], 0, 1, false);
    if (i < 2) m.prop('hp_cabinet_drawers', [r2(x + side * 1.25), z * 4, 11.35], S);
    if (i % 2 === 0) m.prop('hp_chair', [r2(x + side * 0.9), z * 4, 8.6], 0.3);
  }
  m.prop('hp_wheelchair', [r2(cx + side * 13), z * 4, 5.3], side * P).prop('hp_cabinet_low', [r2(cx + side * 15.3), z * 4, 7.2], -side * P);
}
ward(-20, 0, 1);
ward(20, 0, -1);
// The back corridor: benches, a parked wheelchair, a trolley of drips.
m.prop('hp_bench', at(-2, 2, 0, 0, 3.3), S).prop('hp_bench', at(2, 2, 0, 0, 3.3), S).prop('hp_wheelchair', at(1, 2, 0, 0, 2.8), 0.4).prop('hp_iv_stand', at(-1, 2, 0, 2, 3.2), 0);
m.prop('hp_cabinet_counter', at(0, 2, 0, 0, 2.9), S);

// ---------------------------------------------------------------- front of house

// Entrance lobby: the reception desk under a dropped ceiling, pillars by the door.
m.prop('hp_cabinet_counter', at(0, -1, 0, 1.6, 0.6), 0).prop('hp_chair', at(0, -1, 0, 1.6, 1.8), S);
m.prop('hp_ceiling_tile', at(0, -1, 0, 1.6, 0.8, 3.0), 0, 1, false);
m.prop('hp_pillar', at(0, -1, 0, -2.6, -2.6), 0).prop('hp_pillar', at(0, -1, 0, 2.6, -2.6), 0);
m.prop('hp_wheelchair', at(0, -1, 0, -3, -0.5), P);
// Waiting room: benches in rows, a table of old magazines.
for (const dy of [-2.2, 0, 2.2]) m.prop('hp_bench', at(-1, -1, 0, -1.2, dy), 0);
m.prop('hp_table', at(-1, -1, 0, 2.2, 0), P).prop('hp_magazine', at(-1, -1, 0, 2.0, -0.3, 0.79), 0.3, 1, false).prop('hp_magazine', at(-1, -1, 0, 2.4, 0.4, 0.79), -0.6, 1, false);
m.prop('hp_cabinet_low', at(-1, -1, 0, 3.3, 2.8), -P);
// Cafeteria: tables and chairs.
for (const [dx, dy] of [[-2, 1.4], [2, 1.4], [-2, -2.2]] as const) {
  m.prop('hp_table', at(1, -1, 0, dx, dy), 0).prop('hp_chair', at(1, -1, 0, dx - 0.6, dy - 1.0), 0).prop('hp_chair', at(1, -1, 0, dx + 0.6, dy + 1.0), S);
}
m.prop('hp_magazine', at(1, -1, 0, 1.6, 1.8, 0.79), 0.4, 1, false);

// ---------------------------------------------------------------- upstairs

// Intensive care (west): beds with drips, the nurses' station.
for (const x of [-17.5, -14.5, -11.5, -4.8]) {
  m.prop('hp_bed', [x, 4, 10.4], S).prop('hp_iv_stand', [x - 0.9, 4, 11.1], 0).prop('hp_iv_bag', [x - 0.8, 4.82, 11.1], 0, 1, false);
  if (x < -6) m.prop('hp_cabinet_drawers', [x + 1.25, 4, 11.35], S);
}
m.prop('hp_cabinet_counter', [-12, 4, 6.2], 0).prop('hp_chair', [-12, 4, 5.2], 0).prop('hp_wheelchair', [-18.5, 4, 5.4], P);
// The operating theatre (east): the table under the lights, cabinets, and a glazed isolation room at the far end
// built from the kit's own pieces: window wall, doorway (its swing door open) and a half wall, 7.5 m across.
m.prop('hp_table', [9.5, 4, 8], P).prop('hp_iv_stand', [9.5, 4, 9.8], 0).prop('hp_iv_bag', [9.6, 4.82, 9.8], 0, 1, false).prop('hp_cabinet_counter', [9.5, 4, 11.2], S);
m.prop('hp_cabinet_low', [5, 4, 11.4], S).prop('hp_cabinet_drawers', [6.5, 4, 11.4], S);
m.prop('hp_wall_window', [15, 4, 5.75], P).prop('hp_doorway', [15, 4, 8.75], P).prop('hp_wall_half', [15, 4, 11], P);
m.prop('hp_door_swing', [15.9, 4, 9.55], 0, 1, false);
m.prop('hp_bed', [18, 4, 8], P).prop('hp_iv_stand', [18.4, 4, 9.6], 0).prop('hp_iv_bag', [18.5, 4.82, 9.6], 0, 1, false);
// A corner of kit walls screening the landing's store.
m.prop('hp_wall_corner', at(0, 2, 1, 2.2, 2.2), 0);
m.prop('hp_bench', at(-2, 2, 1, 0, 3.3), S).prop('hp_bench', at(2, 2, 1, 0, 3.3), S).prop('hp_wheelchair', at(-1, 2, 1, 0, 2.8), -0.4);
m.prop('hp_bench', at(-2, 0, 1, 0, 3.3), S).prop('hp_bench', at(2, 0, 1, 0, 3.3), S);

// ---------------------------------------------------------------- outside

m.mount('gun_jeep', at(3, -2, 0, 0, 0), P);
m.prop('jersey_barrier', at(-3, -2, 0, 0, -3), 0).prop('jersey_barrier', at(-1, -2, 0, 0, -3), 0).prop('jersey_barrier', at(1, -2, 0, 0, -3), 0);
m.prop('dumpster', at(-4, -1, 0, -2, 0), P).prop('dumpster', at(4, -1, 0, 2, 0), -P).prop('cone', at(2, -2, 0, -2, 1), 0).prop('cone', at(2, -2, 0, -1, 1.5), 0);
m.prop('yard_lamp', at(-2, -2, 0, 0, -3.3), 0).prop('yard_lamp', at(2, -2, 0, 0, -3.3), 0);

// ---------------------------------------------------------------- the infected (co-op; the alarm works in any mode)

const roster = { trooper: 0, gunner: 0, heavy: 0, imp: 0, puglin: 0, cyclops: 0, oculus: 0, scolitex: 0 };
const squad = { kind: 'encounter', yaw: S, faction: 'infected', perPlayer: 2, respawnSeconds: 3, radius: 4, order: 'attack', orderTarget: null, difficulty: 'normal', startActive: false } as const;
m.add({ ...squad, id: 'enc_wards', name: 'The wards', position: at(-1, 1, 0, -1, 0), roster: { ...roster, zombie: 6 }, activeCap: 6, reinforcements: 4 });
m.add({ ...squad, id: 'enc_icu', name: 'Intensive care', position: at(-1, 1, 1, -1, 0), roster: { ...roster, zombie: 8 }, activeCap: 6, reinforcements: 4 });
m.add({ ...squad, id: 'enc_theatre', name: 'The theatre', position: at(1, 1, 1, 0, -1), roster: { ...roster, zombie: 10 }, activeCap: 8, reinforcements: 6 });
m.add({ kind: 'button', id: 'btn_alarm', name: 'Code black alarm', position: at(0, -1, 0, 1.0, 0.6, 1.05), yaw: S, label: 'Raise the code-black alarm', once: true, cooldownSeconds: 1, startEnabled: true });
m.light(at(0, 0, 0, 0, 0, 3.3), { id: 'alarm_light', fixture: 'none', color: '#ff2a2a', intensity: 1.4, range: 18, off: true, blink: 1.2 });

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 4) => act('message', null, { value: seconds, text });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[]): LogicRule => ({ id, name, enabled: true, once: true, when, if: [], do: does });
m.logic({
  variables: [],
  timers: [],
  objectives: [
    { id: 'obj_alarm', text: 'Raise the code-black alarm at reception', startActive: true, marker: 'btn_alarm' },
    { id: 'obj_wards', text: 'Clear the ground-floor wards', startActive: false, marker: 'enc_wards' },
    { id: 'obj_icu', text: 'Clear intensive care, upstairs west', startActive: false, marker: 'enc_icu' },
    { id: 'obj_theatre', text: 'Clear the operating theatre, upstairs east', startActive: false, marker: 'enc_theatre' },
  ],
  rules: [
    rule('rule_intro', 'Night shift', { event: 'match_start', target: null }, [say('Mercy Ward, the night shift. Something is wrong on the wards.', 5)]),
    rule('rule_alarm', 'Code black', { event: 'button_pressed', target: 'btn_alarm' }, [act('light_on', 'alarm_light'), act('sound', null, { state: 'alarm' }), act('objective', 'obj_alarm', { state: 'complete' }), act('objective', 'obj_wards', { state: 'active' }), act('encounter_start', 'enc_wards'), say('Code black! The patients are out of their beds.')]),
    rule('rule_wards', 'Wards clear', { event: 'encounter_cleared', target: 'enc_wards' }, [act('objective', 'obj_wards', { state: 'complete' }), act('objective', 'obj_icu', { state: 'active' }), act('encounter_start', 'enc_icu'), say('Movement upstairs in intensive care.')]),
    rule('rule_icu', 'ICU clear', { event: 'encounter_cleared', target: 'enc_icu' }, [act('objective', 'obj_icu', { state: 'complete' }), act('objective', 'obj_theatre', { state: 'active' }), act('encounter_start', 'enc_theatre'), say('The theatre doors just burst open...')]),
    rule('rule_theatre', 'All clear', { event: 'encounter_cleared', target: 'enc_theatre' }, [act('objective', 'obj_theatre', { state: 'complete' }), act('light_off', 'alarm_light'), say('All clear. Mercy Ward is quiet again.', 4), act('end_round', null, { state: 'players win' })]),
  ],
});

// ---------------------------------------------------------------- spawns and pickups

for (const [p, yaw] of [
  [at(-4, 0, 0, 0, -1), P], [at(-4, -1, 0, 0, 0), P], [at(-3, -1, 0, 0, 1), P], [at(-2, 1, 0, -2, -2), P], [at(-2, 0, 0, -2, -2), P], [at(-2, 2, 1, -1, -1), P],
] as [V3, number][]) m.spawn(p, yaw, WEST);
for (const [p, yaw] of [
  [at(4, 0, 0, 0, -1), -P], [at(4, -1, 0, 0, 0), -P], [at(3, -1, 0, 0, 1), -P], [at(2, 1, 0, 2, -2), -P], [at(2, 0, 0, 2, -2), -P], [at(2, 2, 1, 1, -1), -P],
] as [V3, number][]) m.spawn(p, yaw, EAST);
for (const [p, yaw] of [
  [at(0, -2, 0, -2, 0), 0], [at(0, -2, 0, 2, 0), 0], [at(-1, -2, 0, 0, 1), 0], [at(1, -2, 0, 0, 1), 0], [at(0, -1, 0, -2, -1.5), 0], [at(0, -1, 0, 2, -1.5), 0],
  [at(-1, 2, 0, 0, -1), S], [at(1, 2, 0, 0, -1), S], [at(-1, 0, 1, 0, -1), 0], [at(1, 0, 1, 0, -1), 0], [at(0, 2, 1, -2, 0), S],
] as [V3, number][]) m.spawn(p, yaw, null);

m.pickup('weapon_shotgun', at(-1, 1, 0, 0, -1)).pickup('weapon_shotgun', at(1, 1, 0, 0, -1)).pickup('weapon_smg', at(0, 0, 0, -2, -2)).pickup('weapon_rifle', at(0, 2, 0, -2, -1));
m.pickup('weapon_launcher', at(1, 1, 1, 1, -2), 40).pickup('weapon_burst_rifle', at(-1, 1, 1, 1, -2)).pickup('weapon_sniper', at(0, 2, 1, 0, -1.5), 30);
m.pickup('health_large', at(0, -1, 0, 0, 3)).pickup('health_large', at(0, 0, 1, 0, 2)).pickup('health_small', at(-2, 2, 0, 1, 0)).pickup('health_small', at(2, 2, 0, -1, 0));
m.pickup('health_small', at(-2, 1, 1, 1, -1)).pickup('health_small', at(2, 1, 1, -1, -1)).pickup('armor_large', at(0, 2, 1, 2, -2), 40).pickup('armor_small', at(-1, -1, 0, 2.2, 2.6));
m.pickup('armor_small', at(1, -1, 0, 2, -2.2)).pickup('grenades', at(-2, 0, 1, 1, 2)).pickup('grenades', at(2, 0, 1, -1, 2)).pickup('ammo', at(-2, -2, 0, 0, 1)).pickup('ammo', at(2, -2, 0, 0, 1)).pickup('ammo', at(0, 2, 0, 2, -1));

await m.fillTeamSpawns(6);
m.lightRooms({ color: '#eef4ff', intensity: 0.9, range: 10 });
// lightRooms lights only rooms with a floor over them: the upstairs and the roofed front rooms get theirs here.
for (const t of rooms) if (!rooms.some((u) => u.x === t.x && u.y === t.y && u.z === t.z + 1)) m.light([t.x * 8, r2(t.z * 4 + CEIL - 0.55), t.y * 8], { color: '#eef4ff', intensity: 0.9, range: 10 });
m.light(at(0, -2, 0, 0, -1, 4.5), { fixture: 'none', color: '#ffd9a8', intensity: 0.9, range: 14 });
m.light(at(3, -2, 0, 0, 0, 4.5), { fixture: 'none', color: '#ffd9a8', intensity: 0.8, range: 12 });
m.light(at(-3, -2, 0, 0, 0, 4.5), { fixture: 'none', color: '#ffd9a8', intensity: 0.8, range: 12 });
m.bounds('invisible', 4);
m.border('skyline');
m.meta({
  description:
    "A two-storey hospital at night, built from madduck's Modular 3D Hospital Environment: a concourse with the entrance lobby, waiting room and cafeteria off it, two four-bed wards and a back corridor downstairs; intensive care, the operating theatre with its glazed isolation room, and the landing upstairs. The main stairs climb from the concourse; fire escapes climb from the yards into the upstairs corridor. Co-op: raise the code-black alarm at reception, then clear the wards, intensive care and the theatre of the infected. Zombies: hold out on the wards.",
  modes: ['core.tdm', 'core.deathmatch', 'core.zombies', 'core.coop'],
  players: [2, 12],
});
await m.save();
