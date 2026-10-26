/**
 * Erosion: the floor is the clock. A sunken temple court of mossy stone
 * tiles over a pit of green acid, in the Jungle Ruins style. Every tile
 * crumbles a second after someone steps on it and stays gone, and the rings
 * fall away on their own from the outside in. Our own map and name (MAP_IDEAS
 * no. 15), for 4–12 players in Deathmatch, Elimination and Disc Arena.
 *
 * - Upper deck: 9 × 9 crumbling tiles, 6 m each, 8 m up, its four corner
 *   tiles left out ("the wells"), so 77 tiles.
 * - Lower deck: 8 × 8 crumbling tiles 6 m below, offset half a tile, so a
 *   fall through a hole in the upper deck lands you on it, while it lasts.
 * - Acid: a thin green skin over the void. Fall through it and you are gone
 *   (Disc Arena credits whoever knocked you in).
 * - The sun stone: the middle tile is solid stone, the one tile that never
 *   goes. Every pad in the map lands on it.
 * - The wells: a stone at the bottom of each open corner holds a pad that
 *   throws you from the lower deck back up onto the sun stone.
 * - Twelve spawn altars round the rim, each a pad: you spawn and are thrown
 *   onto the sun stone, so a spawn always reaches what is left of the court
 *   and nobody can wait out the collapse on the rim.
 * - The collapse (one cycle, every round): warning lamps and an alarm, then
 *   the upper outer ring at 0:45, the lower outer ring at 1:00 and so on
 *   inward every 15 s until 2:00, leaving a 3 × 3 island over a 2 × 2 one.
 *   Elimination rounds (120 s at most) start whole every round; in
 *   Deathmatch and Disc Arena the court rebuilds itself at 2:30 and the
 *   cycle starts again.
 *
 * Budget: 140 crumbling tiles of the 150 dynamic blocks; everything else
 * is static stone.
 *
 * Top-down (x east, z north; metres), upper deck:
 *
 *        A     A     A          A  spawn altar (a pad onto the sun stone)
 *    W [][][][][][][] W         W  well (open corner, pad below)
 *     [][][][][][][][][]
 *   A [][][][][][][][][] A
 *     [][][]    [][][]          ## the sun stone (never goes)
 *   A [][][] ## [][][] A
 *     [][][]    [][][]
 *   A [][][][][][][][][] A
 *     [][][][][][][][][]
 *    W [][][][][][][] W
 *        A     A     A
 */
import { type LogicAction, type LogicRule } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('erosion', 'Erosion');
m.theme('jungle_temple');
m.backdrop('cloudy', 'forest', 'moss', 0.35, 0.25);

type V3 = [number, number, number];
const P = Math.PI / 2;
const r2 = (n: number) => Math.round(n * 100) / 100;

const TILE = 6;
const UP = 8; // upper deck walking height
const LOW = 2; // lower deck walking height
const SLAB = 0.6;
const STONE = 'pbr_mossy_cobble';
const DELAY = 1.0;

// ---------------------------------------------------------------- the decks

/** Tile IDs by collapse stage (1–6). */
const stages: string[][] = [[], [], [], [], [], [], []];
const allTiles: string[] = [];
const tile = (id: string, x: number, z: number, top: number, stage: number | null, tint: string) => {
  m.block([x, top - SLAB, z], [TILE - 0.06, SLAB, TILE - 0.06], 'crumble', { material: STONE, tint, delay: DELAY, respawn: null, id });
  allTiles.push(id);
  if (stage) stages[stage]!.push(id);
};
// Upper deck: rings 4 (outer) .. 0 (centre); the outer ring falls at stage 1, ring 3 at 3, ring 2 at 5.
const UPPER_STAGE: Record<number, number | null> = { 4: 1, 3: 3, 2: 5, 1: null, 0: null };
for (let ix = -4; ix <= 4; ix++) {
  for (let iz = -4; iz <= 4; iz++) {
    if (Math.abs(ix) === 4 && Math.abs(iz) === 4) continue; // the wells
    if (ix === 0 && iz === 0) continue; // the sun stone
    const ring = Math.max(Math.abs(ix), Math.abs(iz));
    // Alternate two shades of moss so the grid reads at a glance.
    tile(`up_${ix + 4}${iz + 4}`, ix * TILE, iz * TILE, UP, UPPER_STAGE[ring]!, (ix + iz) % 2 === 0 ? '#e4ecd4' : '#c8d4b4');
  }
}
// Lower deck: half-tile offset; rings 3.5 (outer) at stage 2, 2.5 at 4, 1.5 at 6; the middle 2 × 2 stays.
const LOWER_STAGE: Record<number, number | null> = { 3.5: 2, 2.5: 4, 1.5: 6, 0.5: null };
for (let jx = -4; jx <= 3; jx++) {
  for (let jz = -4; jz <= 3; jz++) {
    const ring = Math.max(Math.abs(jx + 0.5), Math.abs(jz + 0.5));
    tile(`lo_${jx + 4}${jz + 4}`, (jx + 0.5) * TILE, (jz + 0.5) * TILE, LOW, LOWER_STAGE[ring]!, (jx + jz) % 2 === 0 ? '#b8c4a0' : '#a4b090');
  }
}

// The acid: a thin green skin over the void (fall through it and you are gone).
m.water([0, -0.9, 0], [64, 0.9, 64], 'acid', '#5fd23a');

// ---------------------------------------------------------------- the rim

// The pit walls: temple stone rising out of the acid all round, 8 m over the upper deck.
const WALL_R = 33;
const WALL_TOP = 16;
const WALL_BOTTOM = -16;
for (const s of [-1, 1]) {
  // Each wall in two halves (a block is at most 64 m long).
  for (const h of [-1, 1]) {
    const half = WALL_R + 1.5;
    m.block([h * half / 2, WALL_BOTTOM, s * WALL_R], [half, WALL_TOP - WALL_BOTTOM, 3], 'solid', { material: 'pbr_castle_stone', tint: '#c8ccb0' });
    m.block([s * WALL_R, WALL_BOTTOM, h * (WALL_R - 1.5) / 2], [3, WALL_TOP - WALL_BOTTOM, WALL_R - 1.5], 'solid', { material: 'pbr_castle_stone', tint: '#c8ccb0' });
  }
  // A mossy band along each wall.
  m.block([0, UP + 3.5, s * (WALL_R - 1.6)], [60, 0.4, 0.3], 'solid', { material: 'pbr_jungle_rock' });
  m.block([s * (WALL_R - 1.6), UP + 3.5, 0], [0.3, 0.4, 60], 'solid', { material: 'pbr_jungle_rock' });
}

// The sun stone: the middle of the court is solid, the one tile that never goes. Every pad lands on it.
m.block([0, UP - 1.2, 0], [TILE - 0.06, 1.2, TILE - 0.06], 'solid', { material: 'pbr_travertine', tint: '#f0d890' });
m.block([0, UP - 0.08, 0], [2.2, 0.1, 2.2], 'solid', { material: 'brass' });
/** Where a pad from `from` lands: on the sun stone, 1.6 m in from its edge on the pad's side. */
const onSun = (from: V3): V3 => {
  const d = Math.hypot(from[0], from[2]);
  return [r2((from[0] / d) * 1.4), UP, r2((from[2] / d) * 1.4)];
};

// Spawn altars: twelve pillars rising out of the acid against the deck's edge, a pad on each. You
// spawn on the pad and are thrown onto the sun stone, so a spawn always reaches what is left of the
// court, and nobody can wait out the collapse on the rim (step onto an altar and you are thrown back in).
const ALTAR = 2;
const EDGE = 4.5 * TILE; // 27: the upper deck's edge
const altarAt = EDGE + ALTAR / 2;
const altars: { at: V3; yaw: number }[] = [];
for (const s of [-12, 0, 12]) {
  altars.push({ at: [s, UP, altarAt], yaw: Math.PI });
  altars.push({ at: [-s, UP, -altarAt], yaw: 0 });
  altars.push({ at: [altarAt, UP, -s], yaw: -P });
  altars.push({ at: [-altarAt, UP, s], yaw: P });
}
for (const a of altars) {
  m.block([a.at[0], WALL_BOTTOM, a.at[2]], [ALTAR, UP - 0.3 - WALL_BOTTOM, ALTAR], 'solid', { material: 'pbr_jungle_rock' });
  m.block([a.at[0], UP - 0.3, a.at[2]], [ALTAR + 0.2, 0.3, ALTAR + 0.2], 'solid', { material: 'pbr_travertine', tint: '#d8d0a8' });
  m.padTo(a.at, onSun(a.at), 13);
  m.spawn(a.at, a.yaw);
}

// The wells: the upper deck's corners are open, and a stone at the bottom of each holds a pad that
// throws you from the lower deck back up onto the sun stone.
const WELL = 26;
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    const at: V3 = [sx * WELL, LOW, sz * WELL];
    // The stone reaches back to the lower deck's corner tile, so you can walk onto the pad.
    m.block([sx * 25.5, WALL_BOTTOM, sz * 25.5], [3, LOW - WALL_BOTTOM, 3], 'solid', { material: 'pbr_jungle_rock' });
    m.padTo(at, onSun(at), 26);
  }
}

// ---------------------------------------------------------------- dressing

// Colossal heads and carved pillars standing in the acid between the altars and in the wells' corners.
for (const [x, z, yaw] of [[-30.5, -30.5, 0.8], [30.5, 30.5, -2.4], [30.5, -30.5, -0.8], [-30.5, 30.5, 2.4]] as const) m.prop('jg_stone_idol', [x, -0.6, z], yaw, 2.2, false);
// Vines and lianas down the pit walls, ferns on the cornice.
for (let i = -2; i <= 2; i++) {
  const t = i * 12 + 3;
  m.prop('jg_vine_curtain', [t, UP + 1, WALL_R - 1.55], Math.PI, 1.5, false).prop('jg_vine_curtain', [-t, UP + 1, -WALL_R + 1.55], 0, 1.5, false);
  m.prop('jg_liana', [WALL_R - 1.55, UP + 1, -t], -P, 1.4, false).prop('jg_liana', [-WALL_R + 1.55, UP + 1, t], P, 1.4, false);
}
for (const [x, z] of [[-20, 33], [20, 33], [-20, -33], [20, -33], [33, 20], [33, -20], [-33, 20], [-33, -20]] as const) m.prop('jg_giant_fern', [x, WALL_TOP, z], 0, 1.4, false);
for (const [x, z] of [[0, 33], [0, -33], [33, 0], [-33, 0]] as const) m.prop('jg_serpent_statue', [x, WALL_TOP, z], Math.atan2(-x, -z), 1.5, false);

// ---------------------------------------------------------------- light

// Warning lamps round the pit (blink before each ring falls), braziers on the cornice.
const LAMPS: string[] = [];
for (const [x, z, yaw] of [[-16, 31.4, Math.PI], [16, 31.4, Math.PI], [-16, -31.4, 0], [16, -31.4, 0], [31.4, -16, -P], [31.4, 16, -P], [-31.4, -16, P], [-31.4, 16, P]] as const) {
  const id = `lamp_${LAMPS.length + 1}`;
  LAMPS.push(id);
  m.light([x, UP + 4.5, z], { fixture: 'wall', color: '#ffb02e', intensity: 1.4, range: 16, yaw, id });
}
for (const [x, z] of [[-26, 32.6], [26, 32.6], [-26, -32.6], [26, -32.6], [32.6, -26], [32.6, 26], [-32.6, -26], [-32.6, 26]] as const) {
  m.prop('jg_brazier', [x, WALL_TOP, z], 0, 1, false);
  m.light([x, WALL_TOP + 1.2, z], { fixture: 'none', color: '#ff9a3c', intensity: 1.2, range: 14 });
}
// A sickly glow off the acid.
for (const [x, z] of [[-18, -18], [18, -18], [-18, 18], [18, 18]] as const) m.light([x, 0.6, z], { fixture: 'none', color: '#7dff5a', intensity: 1.1, range: 14 });

// ---------------------------------------------------------------- pickups

// On the upper deck only (bots can't plan a drop to the lower one). The prizes sit on the outer rings, which go first.
m.pickup('weapon_rockets', [0, UP, -6], 30);
for (const [x, z] of [[-18, 0], [18, 0]] as const) m.pickup('weapon_shotgun', [x, UP, z]);
for (const [x, z] of [[0, -18], [0, 18]] as const) m.pickup('weapon_launcher', [x, UP, z]);
for (const [x, z] of [[-24, -12], [24, 12]] as const) m.pickup('weapon_smg', [x, UP, z]);
for (const [x, z] of [[-12, 24], [12, -24]] as const) m.pickup('weapon_burst_rifle', [x, UP, z]);
for (const [x, z] of [[-12, -12], [12, 12], [-12, 12], [12, -12]] as const) m.pickup('health_small', [x, UP, z]);
m.pickup('armor_small', [0, UP, 6]);
m.pickup('ammo_explosive', [6, UP, 0]).pickup('ammo_shells', [-6, UP, 0]);
// Power discs (Disc Arena) on the ring round the centre.
for (const [item, x, z] of [['disc_fast', -6, -6], ['disc_triple', 6, 6], ['disc_split', -6, 6], ['disc_freeze', 6, -6]] as const) m.pickup(item, [x, UP, z], 25);

// ---------------------------------------------------------------- logic: the collapse

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const rules: LogicRule[] = [];
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[], cond: LogicRule['if'] = []) => rules.push({ id, name, enabled: true, once: false, when, if: cond, do: does });
const is = (variable: string, value: number, op: '==' | '>' = '=='): LogicRule['if'][number] => ({ type: 'variable', target: variable, op, value, state: '' });
const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

const STAGE_AT = [45, 60, 75, 90, 105, 120];
const CYCLE = 150;
const WARN = 3;
const NAMES = ['The outer ring', 'The lower outer ring', 'The next ring', 'The lower ring', 'The ring round the middle', 'The lower deck'];

// The clock: one sequence per cycle (match start, then each time the cycle timer comes round).
const clock: LogicAction[] = [];
let t = 0;
STAGE_AT.forEach((at, i) => {
  clock.push(act('wait', null, { value: at - WARN - t }), act('set_var', 'var_warn', { value: i + 1 }), act('wait', null, { value: WARN }), act('set_var', 'var_stage', { value: i + 1 }));
  t = at;
});
rule('rule_start', 'Collapse clock (first cycle)', { event: 'match_start', target: null }, [act('timer_start', 'timer_cycle'), say('Erosion: every tile you step on is gone. The rings fall from the outside in.', 4), ...clock]);
rule('rule_cycle', 'Collapse clock (rebuild and go again)', { event: 'timer_done', target: 'timer_cycle' }, [act('set_var', 'var_warn', { value: 0 }), act('set_var', 'var_stage', { value: 0 }), ...clock]);

// Warnings: the lamps blink and the alarm sounds three seconds before a ring goes.
rule('rule_warn', 'Warning lamps', { event: 'variable_changed', target: 'var_warn' }, [act('sound', null, { state: 'alarm' }), ...LAMPS.map((id) => act('light_blink', id, { value: 4, state: 'on' }))], [is('var_warn', 0, '>')]);
NAMES.forEach((name, i) => rule(`rule_warn_${i + 1}`, `Warning ${i + 1}`, { event: 'variable_changed', target: 'var_warn' }, [say(`${name} falls in ${WARN} seconds!`, 2)], [is('var_warn', i + 1)]));
// Each stage: its tiles give way (up to 30 to a rule), the lamps go steady, a boom.
for (let s = 1; s <= 6; s++) {
  rule(`rule_stage_${s}`, `Stage ${s}: lamps`, { event: 'variable_changed', target: 'var_stage' }, [act('sound', null, { state: 'boom' }), ...LAMPS.map((id) => act('light_blink', id, { state: 'off' }))], [is('var_stage', s)]);
  chunks(stages[s]!, 30).forEach((ids, k) => rule(`rule_stage_${s}_${k + 1}`, `Stage ${s}: drop ${k + 1}`, { event: 'variable_changed', target: 'var_stage' }, ids.map((id) => act('block_drop', id)), [is('var_stage', s)]));
}
// The rebuild: every tile comes back (the ones stepped through too).
rule('rule_rebuild', 'Rebuild: message', { event: 'variable_changed', target: 'var_stage' }, [act('sound', null, { state: 'chime' }), say('The temple floor rises again!', 3)], [is('var_stage', 0)]);
chunks(allTiles, 30).forEach((ids, k) => rule(`rule_rebuild_${k + 1}`, `Rebuild ${k + 1}`, { event: 'variable_changed', target: 'var_stage' }, ids.map((id) => act('block_restore', id)), [is('var_stage', 0)]));

m.logic({
  variables: [
    { id: 'var_stage', name: 'Collapse stage', initial: 0 },
    { id: 'var_warn', name: 'Warning', initial: 0 },
  ],
  timers: [{ id: 'timer_cycle', name: 'Collapse cycle', seconds: CYCLE, loop: true, visible: false }],
  objectives: [],
  rules,
});

m.bounds('invisible', 0, { min: [-WALL_R, -WALL_R], max: [WALL_R, WALL_R] }, 24);
m.meta({
  description:
    'A sunken temple court of mossy stone tiles over a pit of green acid. Every tile crumbles a second after you step on it and never comes back, and the rings fall away on their own from the outside in: the upper deck first, then the one below. Fall through a hole and the lower deck may catch you; the pads in the corner wells throw you back up while there is anything to land on. Only the sun stone in the middle never goes: you spawn on altars round the rim that throw you onto it. Deathmatch and Disc Arena rebuild the court every two and a half minutes; in Elimination it rebuilds every round.',
  modes: ['core.deathmatch', 'core.elim', 'core.discs'],
  players: [4, 12],
});
await m.save();
