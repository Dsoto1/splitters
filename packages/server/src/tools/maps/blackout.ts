/**
 * Blackout: a co-op night raid on a city block (1–4 players). Fight up the
 * street through the Syndicate checkpoint, clear the substation (the
 * warehouse) and set the charges, hold it while the Syndicate counter-attack
 * from the north and the west, then fight through to evac at the gas station.
 *
 * - The checkpoint: barriers across the crossroads, with a sandbagged bunker
 *   on the west corner. The shop (west) and the house (east) are side routes
 *   up from the start.
 * - The substation: the warehouse, a hall with a mezzanine; the guards hold
 *   the floor, the charges go by the transformers.
 * - Evac: the gas station on the north-west corner, guarded when you get there.
 *
 * Grid x east, y north (one cell = 8 m).
 *
 *   y8  .   .   |   .   .   .      north wave
 *   y7  G   G   |   .   .   .      G gas station (evac)
 *   y6  G   G   |   W   W   W      W warehouse (the substation)
 *   y5  .   .   |   W   W   W      west wave from (0,5)
 *   y4  B   B   |   .   .   .      B bunker
 *   y3  =   =   +   =   =   =      checkpoint at the crossroads
 *   y2  .   .   |   .   .   .
 *   y1  S   S   |   H   H   .      S shop, H house
 *   y0  .   .   |   H   H   .      start
 *       0   1   2   3   4   5
 */
import { TERRAIN_MATERIALS, buildOccupancy, paintSlopes, terrainHeightAt, type TerrainData, type TerrainMaterial, type ScenarioLogic } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('blackout', 'Blackout');
m.theme('city');
m.backdrop('night', 'city', 'gravel', 0.55);
m.factions([{ id: 'syndicate', name: 'Syndicate', color: '#d04a3a', relations: {} }]);
const P = Math.PI / 2;
const at = (x: number, y: number, z = 0, dx = 0, dy = 0): [number, number, number] => [x * 8 + dx, z * 4, y * 8 + dy];

// ---------------------------------------------------------------- the block
m.tile('shop', 0, 1);
m.tile('house', 3, 0);
m.tile('bunker', 0, 4);
m.tile('warehouse', 3, 5);
m.tile('gas_station', 0, 6);
const built = new Set(['0,1', '1,1', '3,0', '4,0', '3,1', '4,1', '0,4', '1,4', '3,5', '4,5', '5,5', '3,6', '4,6', '5,6', '0,6', '1,6', '0,7', '1,7']);
for (let x = 0; x <= 5; x++) for (let y = 0; y <= 8; y++) {
  if (built.has(`${x},${y}`)) continue;
  if (x === 2 && y === 3) m.tile('intersection', x, y);
  else if (x === 2) m.tile('street', x, y, 0, 0);
  else if (y === 3) m.tile('street', x, y, 0, 1);
  else m.tile('yard', x, y);
}

// ---------------------------------------------------------------- the checkpoint: barriers and a burnt-out car
const TYRES = { material: 'pbr_steel', tint: '#2a2a2a' };
function car(cx: number, cz: number, ns: boolean, tint: string): void {
  const [w, l] = ns ? [2, 4.4] : [4.4, 2];
  m.block([cx, 0.25, cz], [w, 0.85, l], 'solid', { material: 'paint_gloss', tint });
  m.block([cx, 1.1, cz], ns ? [1.8, 0.6, 2.2] : [2.2, 0.6, 1.8], 'solid', { material: 'paint_gloss', tint: '#1c2228' });
  m.block([cx, 0, cz], ns ? [1.9, 0.25, 3.6] : [3.6, 0.25, 1.9], 'solid', TYRES);
}
car(14.5, 9, true, '#3a3a3a');
car(17.6, 46, true, '#7a2a24');
car(28, 22.5, false, '#2a4a7a');
car(9, 25.5, false, '#33302c'); // burnt out
m.prop('barrier', [13, 0, 21], 0).prop('barrier', [19, 0, 21], 0).prop('barrier_high', [16, 0, 28.5], 0).prop('barrier', [22, 0, 27], P);
m.prop('warning_sign', [11, 0, 20]).prop('cone', [15, 0, 19.5], 0, 1, false).prop('cone', [17.5, 0, 19.5], 0, 1, false);
m.prop('lightpost', [-2.5, 0, 14], 0).prop('lightpost', [42.5, 0, 30], 0).prop('lightpost', [42.5, 0, 60], 0).prop('lightpost', [12, 0, 68.5], 0);
// Round the substation: crates, a skip, transformers (generators) inside.
m.prop('skip', [26, 0, 34], 0).prop('cargo_crate', [36, 0, 34], 0.3).prop('crate_large', [42, 0, 36]).prop('barrel', [27, 0, 60]).prop('barrel', [28, 0, 61]);
m.breakable('generator', [36, 0, 45.5], 0).breakable('gas', [40, 0, 62]);
m.prop('trashcan', [-1.5, 0, 18]).prop('cardboard_box', [5, 0, 18]).prop('dungeon_barrel', [41, 0, 18]).prop('shopping_cart', [38, 0, 2], 0.5);
m.prop('bush_large', [-2, 0, 66]).prop('tree_round', [42, 0, 10]).prop('tree_round', [-2, 0, 36]);

// ---------------------------------------------------------------- players and supplies
for (const [x, z] of [[14, -2], [18, -2], [14, 2], [18, 2]] as const) m.spawn([x, 0, z], 0, null);
m.pickup('weapon_smg', at(1, 0)).pickup('ammo', at(5, 0)).pickup('armor_small', at(1, 2)).pickup('grenades', at(4, 2));
m.pickup('weapon_shotgun', at(0, 1, 0, 3.6, 0)).pickup('health_small', at(3, 1, 1, 0, 0)); // in the shop; upstairs in the house
m.pickup('weapon_rifle', at(3, 4)).pickup('health_large', at(5, 4)).pickup('ammo_rifle', at(0, 5)).pickup('armor_large', at(4, 6, 1, 0, 2));
m.pickup('ammo', at(2, 6)).pickup('health_small', at(5, 7)).pickup('weapon_rockets', at(4, 8), 60).pickup('ammo_shells', at(3, 8));

// ---------------------------------------------------------------- the Syndicate
const enc = (id: string, name: string, pos: [number, number, number], roster: { trooper: number; gunner: number; heavy: number }, o: { order: 'hold' | 'attack'; start: boolean; cap?: number; reinforcements?: number; perPlayer?: number }) =>
  m.add({
    kind: 'encounter',
    id,
    name,
    position: pos,
    yaw: Math.PI,
    faction: 'syndicate',
    roster,
    activeCap: o.cap ?? 4,
    reinforcements: o.reinforcements ?? 0,
    perPlayer: o.perPlayer ?? 1,
    respawnSeconds: 5,
    radius: 3,
    order: o.order,
    orderTarget: null,
    startActive: o.start,
    difficulty: 'normal',
  });
enc('enc_checkpoint', 'Checkpoint', [16, 0, 30], { trooper: 3, gunner: 1, heavy: 0 }, { order: 'hold', start: true });
enc('enc_bunker', 'Bunker', [4, 0, 32], { trooper: 2, gunner: 0, heavy: 0 }, { order: 'hold', start: true, perPlayer: 0 });
enc('enc_substation', 'Substation guards', [32, 0, 42], { trooper: 2, gunner: 1, heavy: 1 }, { order: 'hold', start: true });
enc('enc_wave_north', 'North wave', [36, 0, 64], { trooper: 2, gunner: 1, heavy: 0 }, { order: 'attack', start: false, reinforcements: 6, perPlayer: 2 });
enc('enc_wave_west', 'West wave', [0, 0, 40], { trooper: 1, gunner: 0, heavy: 1 }, { order: 'attack', start: false, reinforcements: 4 });
enc('enc_evac', 'Evac guards', [4, 0, 62], { trooper: 2, gunner: 1, heavy: 1 }, { order: 'hold', start: false });

m.add({ kind: 'button', id: 'btn_charges', name: 'Charges', position: [30, 0, 45.5], yaw: Math.PI, label: 'Set the charges', once: true, cooldownSeconds: 1, startEnabled: false });
m.add({ kind: 'zone', id: 'zone_substation', name: 'Substation', position: [32, 0, 44], size: [16, 3, 7], who: 'any', count: 1, startEnabled: true });
m.add({ kind: 'zone', id: 'zone_evac', name: 'Evac point', position: [4, 0, 52], size: [8, 3, 8], who: 'any', count: 1, startEnabled: true });

// ---------------------------------------------------------------- the mission
type Action = ScenarioLogic['rules'][number]['do'][number];
type Condition = ScenarioLogic['rules'][number]['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const say = (text: string, seconds = 4) => act('message', null, { value: seconds, text });
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: string, target: string | null, does: Action[], ifs: Condition[] = [], once = true) =>
  ({ id, name, enabled: true, once, when: { event, target }, if: ifs, do: does }) as ScenarioLogic['rules'][number];
const win = [say('Evac! Mission complete.'), act('wait', null, { value: 2 }), act('end_round', null, { state: 'players win' })];

m.logic({
  variables: [{ id: 'var_lives', name: 'lives', initial: 15 }],
  timers: [{ id: 'timer_charges', name: 'Charges', seconds: 50, loop: false, visible: true }],
  objectives: [
    { id: 'obj_checkpoint', text: 'Break through the checkpoint', startActive: true, marker: 'enc_checkpoint' },
    { id: 'obj_substation', text: 'Clear the substation', startActive: false, marker: 'enc_substation' },
    { id: 'obj_charges', text: 'Set the charges', startActive: false, marker: 'btn_charges' },
    { id: 'obj_hold', text: 'Hold the substation until the charges blow', startActive: false, marker: 'zone_substation' },
    { id: 'obj_evac', text: 'Clear the gas station and reach evac', startActive: false, marker: 'zone_evac' },
  ],
  rules: [
    rule('rule_intro', 'Briefing', 'match_start', null, [say('Lights out on the whole district. Get through the checkpoint to the substation.', 5)]),
    rule('rule_checkpoint', 'Checkpoint broken', 'encounter_cleared', 'enc_checkpoint', [
      act('objective', 'obj_checkpoint', { state: 'complete' }),
      act('objective', 'obj_substation', { state: 'active' }),
      say('Checkpoint down. The substation is the warehouse up the street.'),
    ]),
    rule('rule_substation', 'Substation cleared', 'encounter_cleared', 'enc_substation', [
      act('objective', 'obj_substation', { state: 'complete' }),
      act('enable', 'btn_charges'),
      act('objective', 'obj_charges', { state: 'active' }),
      say('Substation clear. Set the charges by the transformers.'),
    ]),
    rule('rule_charges', 'Charges set: the counter-attack', 'button_pressed', 'btn_charges', [
      act('objective', 'obj_charges', { state: 'complete' }),
      act('objective', 'obj_hold', { state: 'active' }),
      act('sound', null, { state: 'alarm' }),
      say('Charges set! Hold the substation until they blow.'),
      act('timer_start', 'timer_charges'),
      act('wait', null, { value: 3 }),
      act('encounter_start', 'enc_wave_north'),
      act('wait', null, { value: 8 }),
      act('encounter_start', 'enc_wave_west'),
    ]),
    rule('rule_hold_empty', 'Substation unguarded', 'zone_exit', 'zone_substation', [say('Get back to the substation!', 2)], [cond('zone_count', 'zone_substation', '==', 0), cond('objective', 'obj_hold', '==', 0, 'active')], false),
    rule('rule_blown', 'Charges blow: go to evac', 'timer_done', 'timer_charges', [
      act('encounter_stop', 'enc_wave_north'),
      act('encounter_stop', 'enc_wave_west'),
      act('objective', 'obj_hold', { state: 'complete' }),
      act('objective', 'obj_evac', { state: 'active' }),
      act('encounter_start', 'enc_evac'),
      act('sound', null, { state: 'chime' }),
      say('The grid is down! Evac at the gas station, and it is guarded.'),
    ]),
    rule('rule_evac_walk', 'Reach evac when clear', 'zone_enter', 'zone_evac', [act('objective', 'obj_evac', { state: 'complete' }), ...win], [cond('encounter_alive', 'enc_evac', '==', 0), cond('objective', 'obj_evac', '==', 0, 'active')]),
    rule('rule_evac_clear', 'Clear while at evac', 'encounter_cleared', 'enc_evac', [act('objective', 'obj_evac', { state: 'complete' }), ...win], [cond('zone_count', 'zone_evac', '>=', 1)]),
    rule('rule_evac_hot', 'Evac still hot', 'zone_enter', 'zone_evac', [say('Clear the gas station first!', 2)], [cond('encounter_alive', 'enc_evac', '>', 0)], false),
    rule('rule_evac_ready', 'Evac clear', 'encounter_cleared', 'enc_evac', [say('Evac is clear. Get under the canopy!', 3)], [cond('zone_count', 'zone_evac', '==', 0)]),
    rule('rule_life_lost', 'Count lives', 'player_killed', null, [act('add_var', 'var_lives', { value: -1 })], [], false),
    rule('rule_low_lives', 'Low on lives', 'variable_changed', 'var_lives', [say('Only 3 lives left!', 3), act('sound', null, { state: 'buzzer' })], [cond('variable', 'var_lives', '==', 3)]),
    rule('rule_defeat', 'Out of lives', 'variable_changed', 'var_lives', [say('Out of lives. Mission failed.'), act('end_round', null, { state: 'players lose' })], [cond('variable', 'var_lives', '<=', 0)]),
  ],
});

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
/** Furniture for a House tile (turned 0) at cell (cx, cy): the kitchen, the living room and the bedroom upstairs, against the walls. */
function homeFurniture(cx: number, cy: number): void {
  const put = (model: string, lx: number, y: number, lz: number, yaw: number, r = 0.5) => plant(model, cx * 8 + lx, cy * 8 + lz, { y, yaw, scale: 1, r, inside: true });
  put('hm_fridge', 11.05, 0, 3.1, -Math.PI / 2);
  put('hm_rug', 0, 0.01, -0.6, 0);
  put('hm_floor_lamp', 3.2, 0, -3.2, 0);
  put('hm_bookshelf', -3.3, 0, 2.2, Math.PI / 2);
  put('hm_houseplant_tall', 3.2, 0, 3.2, 0);
  put('hm_nightstand', -0.55, 4, -3.1, 0);
  put('hm_houseplant', 10.9, 4, 0.6, 0);
}

m.bounds('invisible');
// Round the block: a level verge, then waste ground, spoil heaps and banks at the edge of the blacked-out district.
ground = sculpt(56, 9, (x, z, d) => sm(9, 34, d) * (5 + 2.5 * Math.sin(x / 10 + 2) * Math.cos(z / 13) + 1.5 * Math.cos((x - z) / 7)) + sm(28, 50, d) * 7, (x, z, d, h) => {
  if (h > 11) return ['grass', 3];
  if (d < 12) return ['gravel', 0];
  return [Math.sin(x / 8) * Math.cos(z / 10) > 0.2 ? 'dirt' : 'grass', 2];
});
for (const [x, z] of [[-6, 4], [-6, 30], [-6, 64], [46, 8], [46, 40], [46, 68], [8, 71], [30, 71], [24, -6]] as const) plant(Math.abs(x + z) % 2 ? 'nt_dead_tree' : 'nt_common_tree_2', x, z, { r: 0.8 });
// Overgrown lots: cover to slip past the Syndicate on the flanks (the shop and house side routes, the lots beside the substation and the evac).
const HEDGE = ['bush_large', 'nt_bush_leafy', 'bush'];
for (const [x, z] of [[2, 12], [40, 14], [30, 8], [-1, 22], [40, 28], [12, 48], [4, 66], [26, 62], [42, 56]] as const) clump(x, z, 3, 2.5, HEDGE);
homeFurniture(3, 0);
m.lightRooms();
m.meta({
  description:
    'A co-op night raid on a blacked-out city block. Fight up the street through the Syndicate checkpoint (or round it through the shop and the house), clear the substation and set the charges, hold it against the counter-attack from the north and the west until they blow, then take the gas station for evac.',
  modes: ['core.coop'],
  players: [1, 4],
});
await m.save();
