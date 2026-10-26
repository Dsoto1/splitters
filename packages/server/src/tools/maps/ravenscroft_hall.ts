/**
 * Ravenscroft Hall: the demo map of Style Pack 05 Gothic Estate (our own map
 * and name), for 4–12 players in Deathmatch and Team Deathmatch. A Victorian
 * manor on a stormy night: the galleried library wing, a parlour, foyer,
 * music room, dining room and picture gallery, formal gardens and a hedge
 * maze behind iron railings to the south, a cemetery with its mausoleum to
 * the north, and the crypt under it all.
 *
 * - The secret study: a bookcase fills the doorway from the parlour. Pull the
 *   candle sconce beside it and it grinds aside for 8 s (a lever inside the
 *   study works it too). The study's floorboards are rotten: stand on them a
 *   moment and you drop into the wine cellar, and on into the crypt.
 * - The library: two storeys of bookcases, stairs up the east wall to a
 *   gallery round three sides. Walk in and the chandeliers gutter.
 * - The crypt: niches of coffins under the terrace, out by the stairs into
 *   the cemetery; its candles flare whenever anyone comes down.
 * - The picture gallery: a bookshelf that trundles along the north wall.
 *
 * Grid x east, y north (one cell = 8 m); z0 ground, z-1 cellar and crypt.
 *
 *   y5   cem   cem   cem   MAUS  cem
 *   y4   yard  yard  [stairs up from the crypt]  yard  yard
 *   y2-3 terrace (the crypt runs under x -1, y 2..3)
 *   y1   LIBRARY     study dining gallery
 *   y0   (2 × 2)     parlr foyer  music
 *   y-1  yard  yard  garden maze  maze
 *   y-2  railings    gate   railings
 *        x -3  -2    -1     0     1
 */
import type { EdgeStyle, LogicAction, LogicRule, RoomOptions, Side } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('ravenscroft_hall', 'Ravenscroft Hall');
m.theme('gothic_estate');
m.backdrop('storm', 'forest', 'grass', 0.6, 0.35);
m.teams([6, 6]);
const [SOUTH, NORTH] = m.teamIds(2) as [string, string];

type V3 = [number, number, number];
const P = Math.PI / 2;
const S = Math.PI;
const r2 = (n: number) => Math.round(n * 100) / 100;
/** World position of cell (x, y) on level z, plus an offset in metres. */
const at = (x: number, y: number, z = 0, dx = 0, dy = 0, up = 0): V3 => [r2(x * 8 + dx), r2(z * 4 + up), r2(y * 8 + dy)];
const edge = (x: number, y: number, z: number, side: Side, style: EdgeStyle) => m.edge(x, y, z, side, style);

// ---------------------------------------------------------------- the manor

const ROOM: RoomOptions = { layout: 'empty', ceiling: 'roof', facade: 'manor_brick' };
m.tile('gothic.library', -3, 0, 0);
m.tile('room', -1, 0, 0, 0, ROOM); // parlour
m.tile('room', 0, 0, 0, 0, ROOM); // foyer
m.tile('room', 1, 0, 0, 0, ROOM); // music room
m.tile('pit', -1, 1, 0); // the secret study (its floor is rotten)
m.tile('room', 0, 1, 0, 0, ROOM); // dining room
m.tile('room', 1, 1, 0, 0, { ...ROOM, facade: 'gothic_stone' }); // picture gallery
// Doors and windows.
edge(-1, 0, 0, 'S', 'door').edge(0, 0, 0, 'S', 'wide').edge(1, 0, 0, 'S', 'windows');
edge(-1, 0, 0, 'W', 'wall').edge(-1, 1, 0, 'W', 'wall').edge(-1, 1, 0, 'N', 'wall').edge(-1, 1, 0, 'E', 'wall');
edge(-1, 0, 0, 'E', 'door').edge(0, 0, 0, 'E', 'door').edge(0, 0, 0, 'N', 'door').edge(1, 0, 0, 'N', 'door').edge(0, 1, 0, 'E', 'door');
edge(-1, 0, 0, 'N', 'door'); // the bookcase stands in this one
edge(0, 1, 0, 'N', 'door').edge(1, 1, 0, 'N', 'windows').edge(1, 1, 0, 'E', 'window').edge(1, 0, 0, 'E', 'window');
// The study's ceiling (the pit tile is open above).
m.block(at(-1, 1, 0, 0, 0, 3.75), [8, 0.3, 8], 'solid', { material: 'dark_wood', tint: '#6a4a34' });

// ---------------------------------------------------------------- the grounds

for (const x of [-3, -2]) m.tile('yard', x, -1, 0);
m.tile('gothic.hedge_garden', -1, -1, 0);
m.tile('gothic.hedge_maze', 0, -1, 0);
m.tile('gothic.hedge_maze', 1, -1, 0);
for (const x of [-3, -2, 0, 1]) m.tile('gothic.iron_fence', x, -2, 0, 2);
m.tile('gothic.iron_gate', -1, -2, 0, 2);
// The terrace behind the house, the cemetery beyond.
for (let x = -3; x <= 1; x++) for (const y of [2, 3]) m.tile('yard', x, y, 0);
for (const x of [-3, -2, 0, 1]) m.tile('yard', x, 4, 0);
for (const x of [-3, -2, -1, 1]) m.tile('gothic.cemetery', x, 5, 0);
m.tile('gothic.mausoleum', 0, 5, 0);

// ---------------------------------------------------------------- under the house: cellar and crypt

m.tile('room', -1, 1, -1, 0, { layout: 'empty' }); // the wine cellar, under the study
m.tile('gothic.crypt', -1, 2, -1);
m.tile('gothic.crypt', -1, 3, -1);
m.tile('stairs', -1, 4, -1, 3); // up from the crypt (south) to the cemetery (north)
edge(-1, 1, -1, 'N', 'door');
m.prop('barrel', at(-1, 1, -1, -3, 2.8), 0).prop('barrel', at(-1, 1, -1, -2, 3.0), 0.5).prop('barrel_open', at(-1, 1, -1, 3, 2.8), 0).prop('crate_bottles', at(-1, 1, -1, 3.0, -2.8), 0.2).prop('crate_bottles', at(-1, 1, -1, -3.0, -2.8), -0.2);
m.prop('ge_sarcophagus', at(-1, 3, -1, 0, 0), 0).prop('coffin_old', at(-1, 2, -1, 1.8, 0.4), P).prop('dg_skull', at(-1, 2, -1, -1.8, 1.4), 0.4).prop('candles', at(-1, 3, -1, 1.8, -2.2), 0);

// ---------------------------------------------------------------- the secret study

// The bookcase in the parlour's north doorway, its shelves facing the parlour; it slides 3.2 m west when sent.
const BC: V3 = at(-1, 0, 0, 0, 4);
m.block(BC, [3, 3, 0.5], 'solid', { material: 'pbr_walnut', tint: '#6a4a34', id: 'bookcase_door' });
m.add({ kind: 'prop', id: 'bookcase_shelves', model: 'prop.ge_bookcase_tall', position: [BC[0], 0, r2(BC[2] - 0.27)], yaw: S, scale: 1, solid: false, tint: null });
m.mover('mover_bookcase', BC, ['bookcase_door'], [[0, 0, 0], [-3.2, 0, 0]], { mode: 'trigger', speed: 1.2, wait: 0, props: ['bookcase_shelves'], name: 'Secret bookcase' });
m.add({ kind: 'button', id: 'btn_sconce', name: 'Candle sconce', position: at(-1, 0, 0, 2.6, 3.5, 1.4), yaw: S, label: 'Pull the candle sconce', once: false, cooldownSeconds: 10, startEnabled: true });
m.add({ kind: 'button', id: 'btn_study', name: 'Study lever', position: at(-1, 1, 0, 3.4, -2, 1.2), yaw: -P, label: 'Pull the lever', once: false, cooldownSeconds: 10, startEnabled: true });
m.light(at(-1, 0, 0, 2.6, 3.4, 1.9), { id: 'candle_sconce', fixture: 'candle', color: '#ffb45a', intensity: 0.8, range: 6, yaw: S });
// The rotten floor over the pit: it gives way half a second after you step on it, back after 15 s.
m.block(at(-1, 1, 0, 0, 0, -0.3), [4, 0.3, 4], 'crumble', { material: 'pbr_floorboards', tint: '#9a8a7a', delay: 0.5, respawn: 15, id: 'rotten_floor' });
m.prop('ge_writing_desk', at(-1, 1, 0, -2.6, 2.6), S).prop('ge_portrait', at(-1, 1, 0, 0, 3.55, 1.4), S, 1, false).prop('ge_candelabra', at(-1, 1, 0, 3.0, 3.0), 0);

// ---------------------------------------------------------------- furnishing

// Parlour.
m.prop('hm_fireplace', at(-1, 0, 0, -3.4, 0), P).prop('ge_wingback_chair', at(-1, 0, 0, -1.6, -1.2), 2.2).prop('ge_wingback_chair', at(-1, 0, 0, -1.6, 1.2), 0.9).prop('ge_grandfather_clock', at(-1, 0, 0, 3.4, -2.6), -P);
m.prop('ge_portrait', at(-1, 0, 0, 0, -3.55, 1.4), 0, 1, false).prop('hm_rug', at(-1, 0, 0, -1, 0), 0, 1, false);
// Foyer: the chandelier, armour either side of the stairs to nowhere.
m.prop('ge_suit_of_armour', at(0, 0, 0, -3.3, 2.5), P).prop('ge_suit_of_armour', at(0, 0, 0, 3.3, 2.5), -P).prop('hm_rug', at(0, 0, 0, 0, 0), P, 1, false).prop('ge_chandelier', at(0, 0, 0, 0, 0, 1.9), 0, 1, false);
// Music room.
m.prop('ge_grand_piano', at(1, 0, 0, -0.5, 1.2), 0.3).prop('ge_wingback_chair', at(1, 0, 0, 2.6, -1.8), -2.4).prop('ge_candelabra', at(1, 0, 0, 3.2, 3.2), 0);
// Dining room: the long table under the chandelier.
m.prop('dg_table_long', at(0, 1, 0, 0, 0), P).prop('hm_chair_wood', at(0, 1, 0, -0.9, -1.2), P).prop('hm_chair_wood', at(0, 1, 0, 0.9, 1.2), -P).prop('ge_chandelier', at(0, 1, 0, 0, 0, 1.9), 0, 1, false).prop('hm_dresser', at(0, 1, 0, -3.3, 2.5), P);
// Picture gallery: portraits, the angel, a moving bookshelf along the north wall.
for (const dx of [-2.4, 0, 2.4]) m.prop('ge_portrait', at(1, 1, 0, dx, -3.55, 1.4), 0, 1, false);
m.prop('ge_angel_statue', at(1, 1, 0, 2.5, -1.5), -2.4);
m.block(at(1, 1, 0, -2, 2.6), [2.2, 3, 0.6], 'solid', { material: 'pbr_walnut', tint: '#6a4a34', id: 'shelf_block' });
m.add({ kind: 'prop', id: 'shelf_case', model: 'prop.ge_bookcase_tall', position: at(1, 1, 0, -2, 2.28), yaw: S, scale: 1, solid: false, tint: null });
m.mover('mover_shelf', at(1, 1, 0, -2, 2.6), ['shelf_block'], [[0, 0, 0], [4, 0, 0]], { mode: 'pingpong', speed: 0.8, wait: 3, props: ['shelf_case'], name: 'Moving bookshelf' });
// Library: reading lamps, a globe of sorts, armchairs.
m.prop('ge_wingback_chair', at(-3, 0, 0, 0.5, 2.2), 0.4).prop('ge_writing_desk', at(-2, 1, 0, -1, 0.5), 0).prop('ge_candelabra', at(-3, 0, 0, -2.6, -2.6), 0);

// ---------------------------------------------------------------- grounds dressing

for (const [x, z] of [[-28, -15], [-12, -15], [12, -15]] as const) m.prop('ge_topiary', [x, 0, z], 0);
m.prop('ge_angel_statue', at(-2, -1, 0, 0, -1), 0).prop('ge_gas_lamp', at(-3, -1, 0, 3, 3), 0).prop('ge_gas_lamp', at(-2, -1, 0, -3, 3), 0).prop('ge_gas_lamp', at(-1, 2, 0, 3.2, 0), 0).prop('ge_gas_lamp', at(1, 3, 0, 0, 0), 0);
m.prop('ge_hedge_arch', at(1, -1, 0, 0, -3.6), 0).prop('ge_hedge_wall', at(-3, 3, 0, 0, 3), 0).prop('ge_hedge_wall', at(1, 3, 0, 0, 3), 0);
m.prop('ge_headstone_tall', at(-2, 4, 0, 2, 2), 0.1).prop('ge_headstone_tall', at(0, 4, 0, -2, 2.5), -0.1).prop('gravestone_cross', at(1, 4, 0, 2, 1), 0.2).prop('gravestone_broken', at(-3, 4, 0, -2, 1), 0);
m.prop('ge_angel_statue', at(-2, 5, 0, 0, 3.4), S).prop('rn_dead_tree', at(1, 4, 0, -2.5, -2), 0.6).prop('nt_dead_tree', at(-3, 2, 0, -2, 1), 1.2).prop('pumpkin', at(0, 2, 0, 3, 3), 0.3);
m.prop('coffin', at(-3, 4, 0, 2, -2), 0.4).prop('lantern', at(-1, 4, 0, 0, -4.4, 0), 0, 1, false);

// ---------------------------------------------------------------- light: candles that gutter on cue

m.light(at(0, 0, 0, 0, 0, 3.6), { id: 'chandelier_foyer', fixture: 'chandelier', color: '#ffc070', intensity: 1.4, range: 12 });
m.light(at(0, 1, 0, 0, 0, 3.6), { id: 'chandelier_dining', fixture: 'chandelier', color: '#ffc070', intensity: 1.4, range: 12 });
m.light(at(-3, 0, 0, 4, 4, 7.6), { id: 'chandelier_lib1', fixture: 'chandelier', color: '#ffc070', intensity: 1.6, range: 14 });
m.light(at(-3, 0, 0, 4, 0, 3.6), { id: 'chandelier_lib2', fixture: 'chandelier', color: '#ffc070', intensity: 1.2, range: 10 });
m.light(at(-1, 0, 0, -2.6, -2.6, 1.0), { id: 'candle_parlour', fixture: 'candle', color: '#ffb45a', intensity: 0.9, range: 8 });
m.light(at(1, 0, 0, 3.2, 3.2, 1.8), { id: 'candle_music', fixture: 'candle', color: '#ffb45a', intensity: 0.9, range: 8 });
m.light(at(1, 1, 0, 0, 0, 3.6), { id: 'chandelier_gallery', fixture: 'chandelier', color: '#ffc070', intensity: 1.2, range: 11 });
m.light(at(-1, 1, -1, 0, 0, 3.4), { id: 'cellar_bulb', fixture: 'bulb', color: '#ffb060', intensity: 0.7, range: 8 });
for (const [y, id] of [[2, 'candle_crypt1'], [3, 'candle_crypt2']] as const) m.light(at(-1, y, -1, 2.4, 0, 1.3), { id, fixture: 'candle', color: '#ffa850', intensity: 0.9, range: 8, yaw: -P });
m.light(at(-1, 4, -1, 0, 0, 3.2), { fixture: 'wall', color: '#ffa850', intensity: 0.6, range: 7 });
for (const p of [at(-3, -1, 0, 3, 3, 3.4), at(-2, -1, 0, -3, 3, 3.4), at(-1, 2, 0, 3.2, 0, 3.4), at(1, 3, 0, 0, 0, 3.4)]) m.light(p, { fixture: 'none', color: '#ffd890', intensity: 1, range: 11 });
m.light(at(0, 5, 0, 0, -2, 3.0), { fixture: 'none', color: '#a0b8ff', intensity: 0.8, range: 12 });
m.light(at(-2, 5, 0, 0, 0, 3.0), { fixture: 'none', color: '#a0b8ff', intensity: 0.7, range: 14 });

// Zones: the library makes its chandeliers gutter; the crypt makes its candles flare.
m.add({ kind: 'zone', id: 'zone_library', name: 'Library', position: at(-3, 0, 0, 4, 4), size: [14, 3, 14], who: 'any', count: 1, startEnabled: true });
m.add({ kind: 'zone', id: 'zone_crypt', name: 'Crypt', position: at(-1, 2, -1, 0, 4), size: [7, 3, 15], who: 'any', count: 1, startEnabled: true });

// ---------------------------------------------------------------- logic

const act = (type: LogicAction['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): LogicAction => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' });
const say = (text: string, seconds = 3) => act('message', null, { value: seconds, text });
const rule = (id: string, name: string, when: LogicRule['when'], does: LogicAction[]): LogicRule => ({ id, name, enabled: true, once: false, when, if: [], do: does });
const gutter = (ids: string[], seconds: number): LogicAction[] => [...ids.map((id) => act('light_blink', id, { value: 3, state: 'on' })), act('wait', null, { value: seconds }), ...ids.map((id) => act('light_blink', id, { value: 0, state: 'off' }))];
const openStudy = [act('sound', null, { state: 'chime' }), say('A bookcase grinds aside...', 2), act('mover_go', 'mover_bookcase'), act('wait', null, { value: 8 }), act('mover_go', 'mover_bookcase')];
m.logic({
  variables: [],
  timers: [],
  objectives: [],
  rules: [
    rule('rule_start', 'Welcome', { event: 'match_start', target: null }, [say('Ravenscroft Hall. Mind the floorboards in the study.', 4)]),
    rule('rule_sconce', 'The candle sconce', { event: 'button_pressed', target: 'btn_sconce' }, openStudy),
    rule('rule_study', 'The study lever', { event: 'button_pressed', target: 'btn_study' }, openStudy),
    rule('rule_library', 'The library candles gutter', { event: 'zone_enter', target: 'zone_library' }, gutter(['chandelier_lib1', 'chandelier_lib2'], 3)),
    rule('rule_crypt', 'The crypt candles flare', { event: 'zone_enter', target: 'zone_crypt' }, gutter(['candle_crypt1', 'candle_crypt2', 'cellar_bulb'], 4)),
  ],
});

// ---------------------------------------------------------------- spawns and pickups

// South: the gardens. North: the cemetery.
for (const [p, yaw] of [
  [at(-3, -1, 0, -1, -1), 0], [at(-2, -1, 0, 1, -1), 0], [at(-1, -1, 0, 0, -2.4), 0], [at(0, -1, 0, -2.4, 0), 0], [at(1, -1, 0, 2.4, 0), 0], [at(-1, -2, 0, 0, -1.5), 0],
] as [V3, number][]) m.spawn(p, yaw, SOUTH);
for (const [p, yaw] of [
  [at(-3, 5, 0, 0, 0), S], [at(-2, 5, 0, 0, -1), S], [at(-1, 5, 0, 0, 0), S], [at(1, 5, 0, 0, 0), S], [at(-3, 4, 0, 0, 0), S], [at(1, 4, 0, 1, 0), S],
] as [V3, number][]) m.spawn(p, yaw, NORTH);
for (const [p, yaw] of [
  [at(0, 0, 0, 1.5, -1.5), 0], [at(1, 0, 0, 2, -2), S], [at(0, 1, 0, 2.5, -2.5), 0], [at(-3, 0, 0, 1, -2), 0], [at(-2, 1, 0, 2, 4), S], [at(-3, 2, 0, 0, 0), 0], [at(1, 2, 0, 0, 0), S], [at(-1, 3, -1, 0, 2), S],
] as [V3, number][]) m.spawn(p, yaw, null);

m.pickup('weapon_hand_cannon', at(-3, 1, 0, -2, 3, 4)).pickup('weapon_sawed_off', at(-1, 2, -1, 0, -2.6)).pickup('weapon_shotgun', at(0, 0, 0, 0, 2));
m.pickup('weapon_marksman', at(0, 5, 0, 0, 0.6, 0.25), 30).pickup('weapon_rifle', at(-1, 3, 0, 0, 0)).pickup('grenades', at(1, 1, 0, 1.5, -1.5)).pickup('grenades', at(-1, -1, 0, 0, -3));
m.pickup('armor_large', at(-1, 1, -1, 0, -1.5), 40).pickup('armor_small', at(1, -1, 0, 0, 0)).pickup('health_large', at(-2, 1, 0, 3, 4, 4)).pickup('health_small', at(0, 3, 0, 2, 0)).pickup('health_small', at(1, 0, 0, -2, -2));
m.pickup('ammo', at(-2, 0, 0, 0, -1)).pickup('ammo', at(-2, 4, 0, 0, 0));

m.bounds('invisible', 4);
m.meta({
  description:
    'A Victorian manor on a stormy night, built from the Gothic Estate style pack: a galleried library whose chandeliers gutter as you come in, a parlour with a secret bookcase (pull the candle sconce), a study with rotten floorboards that drop you into the wine cellar and the crypt, a picture gallery with a bookshelf that will not stay put, formal gardens and a hedge maze behind iron railings, and a cemetery with its mausoleum where the crypt stairs come out.',
  modes: ['core.deathmatch', 'core.tdm'],
  players: [4, 12],
});
await m.save();
