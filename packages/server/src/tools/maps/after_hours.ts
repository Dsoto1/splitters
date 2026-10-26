/**
 * After Hours: a night at the museum where the exhibits come to life one
 * gallery at a time (docs/MAP_IDEAS.md, Co-op, #20). You are the night
 * guards, with two guard bots (an allied militia) following you round.
 *
 *   - Grand Atrium (2 × 2, two storeys, open to the night sky): a Skyfighter
 *     on a display plinth (a real mount: fly it out of the skylight), the
 *     stairs up to the balcony and the offices.
 *   - Lobby with the security desk (you start here) and the gift shop
 *     (vending machines, drinks fridges, shelving: Suburban Chaos and the
 *     gas-station kit).
 *   - Hall of Antiquities: colossal heads, serpent heads and the golden idol
 *     (Jungle Ruins), Anubis, Bastet, steles, canopic jars and sarcophagi
 *     (Sands of Egypt), an emperor, busts and amphorae (Imperial Arena).
 *     Break a sarcophagus's gilded lid and the imps inside get out; leave
 *     them and the lids burst by themselves 20 s after you walk in.
 *   - The Armour Gallery: walk between the suits of armour and the lamps
 *     flash, the suits shatter, and the puglins that stood inside them
 *     charge you.
 *   - Gothic gallery (Gothic Estate): portraits, a grand piano, candelabras
 *     and weeping angels. The candles gutter as you come in and zombies
 *     step out from behind the angels.
 *   - Space Hall (Orbital Station): a satellite dish, the holo globe on a
 *     low-gravity dais and four cryo pods. Shoot a pod's glass and its
 *     specimen (oculi, cyclopes) gets out; the containment alarm opens the
 *     rest 15 s after you walk in.
 *   - The Military wing (Military Compound): a tank behind a locked door.
 *     Clear every gallery and the curator's office upstairs gives you the
 *     key; drive the tank (or carry explosives) through the reinforced wall
 *     into the atrium for the finale: the Scolitex and its imps.
 *
 * The idea's "dormant statue" NPCs are not in the kit (an encounter cannot
 * stand frozen until woken), so every reveal is a zone or a breakable
 * exhibit firing logic: the exhibit (a breakable prop, a breakable block lid
 * or a pane of pod glass) is destroyed and the encounter starts where it
 * stood.
 *
 * Co-op 1–8 (reinforcements scale per extra player), 20 lives.
 *
 * Grid x east, y north (one cell = 8 m; world z = y × 8). Ground floor z0,
 * the balcony and offices z1.
 *
 *   y3          A  G  G  M  M           A Armour Gallery (1 × 2), G Gothic (2 × 2),
 *   y2          A  G  G  M  M           M Military wing (2 × 2): locked door G|M, breach M|T
 *   y1    H  H  H  T  T  S  S  S        T Grand Atrium, H Antiquities (3 × 3), S Space Hall (3 × 3)
 *   y0    H  H  H  T  T  S  S  S
 *   y-1   H  H  H  L  L  S  S  S        L Lobby (2 × 2; offices above on z1)
 *   y-2      g  g  L  L                 g gift shop (2 × 2)
 *   y-3      g  g
 *        -3 -2 -1  0  1  2  3  4
 */
import type { RoomOptions, ScenarioLogic, Side, TileSurfaces } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

type V3 = [number, number, number];
type Look = { material: string; tint?: string };
const PI = Math.PI;
const P = PI / 2;
const r2 = (n: number) => +n.toFixed(2);

const m = new MapBuilder('after_hours', 'After Hours');
m.theme('temple');
m.backdrop('night', 'city', 'none', 0.35);
m.factions([
  { id: 'exhibits', name: 'The Exhibits', color: '#b07a2a', relations: {} },
  { id: 'guards', name: 'Night Guards', color: '#4a7ad0', relations: { players: 'ally', exhibits: 'enemy' } },
]);

const mat = (material: string, tint: string | null = null) => ({ material: `core.${material}`, tint });
function paint(x: number, y: number, z: number, surfaces: TileSurfaces): void {
  const t = m.doc.classicStructure.tiles.find((p) => p.x === x && p.y === y && p.z === z);
  if (!t) throw new Error(`no tile at ${x},${y},${z}`);
  m.history.execute('Paint', { kind: 'updateTiles', before: [t], after: [{ ...t, surfaces: { ...t.surfaces, ...surfaces } }] });
}
const e = (x: number, y: number, z: number, side: Side, style: Parameters<MapBuilder['edge']>[4]) => m.edge(x, y, z, side, style);
const ROOF: RoomOptions = { ceiling: 'roof' };

// ---------------------------------------------------------------- tiles
m.tile('atrium', 0, 0, 0);
m.tile('room_large', 0, -2, 0, 0, ROOF); // lobby
m.tile('room_large', -2, -3, 0, 0, ROOF); // gift shop
m.tile('hall', -3, -1, 0, 0, { ceiling: 'skylight' }); // Hall of Antiquities
m.tile('room_long', -2, 2, 0, 0, { layout: 'empty', ceiling: 'roof' }); // Armour Gallery
m.tile('room_large', -1, 2, 0, 0, { ceiling: 'beams' }); // Gothic gallery
m.tile('room_large', 1, 2, 0, 0, ROOF); // Military wing
m.tile('hall', 2, -1, 0, 0, ROOF); // Space Hall
m.tile('room', 0, -1, 1, 0, ROOF); // curator's office
m.tile('room', 1, -1, 1, 0, ROOF); // security office

// Walls and openings: one way from gallery to gallery, the atrium in the middle of it all.
e(-1, 2, 0, 'S', 'wall'); // Gothic | Antiquities
e(-2, 2, 0, 'E', 'wall').edge(-2, 3, 0, 'E', 'door'); // Armour Gallery | Gothic at its far end
e(0, 3, 0, 'E', 'door'); // Gothic | Military: the locked door
e(0, 2, 0, 'E', 'wall');
e(1, 1, 0, 'N', 'open'); // Atrium | Military: the reinforced wall, filled with breakable panels
e(2, 2, 0, 'S', 'wall'); // Military | Space Hall
e(-2, -2, 0, 'N', 'wall'); // gift shop | Antiquities: one door
e(0, -2, 0, 'S', 'windows').edge(1, -2, 0, 'S', 'windows'); // the lobby's front: glass onto the night street
e(0, 0, 0, 'W', 'wide'); // the atrium's grand doorways
e(1, 0, 0, 'E', 'wide');
e(0, 0, 0, 'S', 'wide');

// Paint: marble halls, sandstone for Antiquities, damask for Gothic, white panels in Space, bunker concrete in Military.
const MUSEUM: TileSurfaces = { floor: mat('pbr_terrazzo', '#d8d0c0'), walls: mat('pbr_travertine', '#e8e2d4'), solids: mat('pbr_white_marble'), underside: mat('pbr_plaster_white'), trim: mat('brass') };
const ANTIQ: TileSurfaces = { floor: mat('pbr_sandstone_blocks', '#d8c098'), walls: mat('hieroglyphs_painted'), solids: mat('pbr_rough_sandstone'), underside: mat('lapis'), trim: mat('gold_leaf') };
const GOTHIC: TileSurfaces = { floor: mat('pbr_floorboards', '#6a4a30'), walls: mat('wallpaper_damask', '#5a1e2a'), solids: mat('pbr_walnut'), underside: mat('pbr_walnut', '#3a2a1e'), trim: mat('brass') };
const ARMOUR: TileSurfaces = { floor: mat('pbr_flagstone', '#8a8478'), walls: mat('pbr_castle_stone', '#8e887e'), solids: mat('pbr_castle_stone'), underside: mat('dark_wood'), trim: mat('brass') };
const SPACE: TileSurfaces = { floor: mat('pbr_walkway'), walls: mat('pbr_white_panel'), solids: mat('orbital_panel'), underside: mat('pbr_white_panel', '#c8ccd0'), trim: mat('glow_trim', '#5ad8ff') };
const MILITARY: TileSurfaces = { floor: mat('pbr_concrete_dark'), walls: mat('pbr_bunker_panels'), solids: mat('pbr_olive_corrugated'), underside: mat('pbr_concrete'), trim: mat('pbr_steel') };
const SHOP: TileSurfaces = { floor: mat('checker', '#d0d0c8'), walls: mat('pbr_clapboard', '#e8e0d0'), solids: mat('paint_gloss', '#c8302a'), underside: mat('pbr_plaster_white'), trim: mat('paint_gloss', '#ffffff') };
const OFFICE: TileSurfaces = { floor: mat('pbr_carpet', '#5a2a2a'), walls: mat('pbr_walnut', '#a07850'), solids: mat('pbr_walnut'), underside: mat('pbr_plaster_white'), trim: mat('brass') };
paint(0, 0, 0, MUSEUM);
paint(0, -2, 0, MUSEUM);
paint(-2, -3, 0, SHOP);
paint(-3, -1, 0, ANTIQ);
paint(-2, 2, 0, ARMOUR);
paint(-1, 2, 0, GOTHIC);
paint(1, 2, 0, MILITARY);
paint(2, -1, 0, SPACE);
paint(0, -1, 1, OFFICE);
paint(1, -1, 1, OFFICE);

// ---------------------------------------------------------------- helpers
const prop = (model: string, at: V3, yaw = 0, scale = 1, id?: string) => m.add({ kind: 'prop', model: `prop.${model}`, position: at, yaw, scale, solid: true, tint: null, ...(id ? { id } : {}) });
const plinth = (x: number, z: number, w: number, d: number, h = 0.5, look: Look = { material: 'pbr_white_marble' }) => m.block([x, 0, z], [w, h, d], 'solid', look);
const roster = { trooper: 0, gunner: 0, heavy: 0 };
type Roster = Partial<Record<'trooper' | 'gunner' | 'heavy' | 'imp' | 'puglin' | 'cyclops' | 'oculus' | 'scolitex' | 'zombie', number>>;
function squad(id: string, name: string, at: V3, r: Roster, o: { cap?: number; reinf?: number; per?: number; radius?: number; order?: 'hold' | 'attack' | 'follow'; active?: boolean; faction?: string; size?: number; health?: number; yaw?: number; respawn?: number; difficulty?: 'easy' | 'normal' | 'hard' } = {}): void {
  m.add({
    kind: 'encounter', id, name, position: at, yaw: o.yaw ?? 0, faction: o.faction ?? 'exhibits', roster: { ...roster, ...r },
    activeCap: o.cap ?? 4, reinforcements: o.reinf ?? 0, perPlayer: o.per ?? 1, respawnSeconds: o.respawn ?? 4, radius: o.radius ?? 2,
    order: o.order ?? 'attack', orderTarget: null, startActive: o.active ?? false, difficulty: o.difficulty ?? 'normal',
    ...(o.size ? { size: o.size } : {}), ...(o.health ? { health: o.health } : {}),
  });
}

// ---------------------------------------------------------------- Grand Atrium (world x -4..12, z -4..12)
// The Skyfighter on its plinth (west half of the floor; the tank's lane stays clear on the east).
plinth(1.4, 6.2, 4.6, 6, 0.4, { material: 'pbr_marble_black' });
m.mount('skyfighter', [1.4, 0.4, 6.2], PI);
m.light([1.4, 3.2, 6.2], { fixture: 'none', color: '#cfe0ff', intensity: 1.4, range: 9 });
for (const [x, z] of [[-3, -3], [11, -3], [-3, 11]] as const) prop('potted_plant', [x, 0, z], 0, 1.4);
prop('im_bust', [-3, 4, 3], P);
prop('im_bust', [11, 4, 5], -P);
m.light([4, 7.5, 4], { fixture: 'chandelier', color: '#ffe6b0', intensity: 1.3, range: 16 });

// ---------------------------------------------------------------- Lobby (x -4..12, z -20..-4) and the offices above
// The security desk: you start behind it.
m.block([4, 0, -9], [8, 1.1, 1], 'solid', { material: 'pbr_walnut' });
prop('hh_monitor', [2.5, 1.1, -9], PI).prop('hh_monitor', [5.5, 1.1, -9], PI);
prop('sb_tv_flat', [10.6, 0, -15], -P);
m.light([4, 3.4, -12], { fixture: 'ceiling', color: '#fff1d6', intensity: 1, range: 10 });
m.light([4, 3.4, -18], { fixture: 'ceiling', color: '#fff1d6', intensity: 0.8, range: 9 });
// The curator's office and security office (z1, over the lobby).
m.add({ kind: 'button', id: 'btn_curator', name: "Curator's key cabinet", position: [-3.6, 4, -8], yaw: P, label: 'Take the Military wing key', once: true, cooldownSeconds: 1, startEnabled: false });
m.light([-2.6, 5.6, -8], { id: 'lamp_curator', fixture: 'bulb', color: '#ffcc33', intensity: 1.2, range: 6, off: true });
m.light([0, 7.4, -8], { fixture: 'ceiling', color: '#ffe0b0', intensity: 0.8, range: 8 });
m.light([8, 7.4, -8], { fixture: 'ceiling', color: '#d0e0ff', intensity: 0.8, range: 8 });

// ---------------------------------------------------------------- Gift shop (x -20..-4, z -28..-12)
for (const x of [-18.6, -17.2, -15.8]) prop('mt_vending_machine', [x, 0, -27.2], 0);
for (const x of [-10, -8.6, -7.2]) prop('gs_drinks_fridge', [x, 0, -27.3], 0);
prop('gs_shop_counter', [-9, 0, -24.5], 0);
for (const z of [-22, -18]) prop('gs_shop_shelving', [-13, 0, z], 0);
prop('sb_fridge', [-19.2, 0, -13], P).prop('sb_garden_gnome', [-6, 1.05, -17.4], -P);
m.light([-12, 3.4, -20], { fixture: 'ceiling', color: '#f0f8ff', intensity: 1, range: 11 });
m.light([-8.6, 1.6, -26.6], { fixture: 'none', color: '#a0e0ff', intensity: 0.9, range: 5 }); // fridge glow

// ---------------------------------------------------------------- Hall of Antiquities (x -28..-4, z -12..12; dais x -19..-13)
prop('jg_gold_idol', [-16, 1, 0], P);
m.light([-16, 3.6, 0], { id: 'lamp_idol', fixture: 'none', color: '#ffd27a', intensity: 1.6, range: 8 });
prop('jg_stone_idol', [-25, 0, -9], 0.5).prop('jg_stone_idol', [-25, 0, 9], PI - 0.5);
prop('jg_serpent_statue', [-7, 0, -9.6], -0.4).prop('jg_serpent_statue', [-7, 0, 9.6], PI + 0.4);
prop('eg_anubis', [-26.6, 0.4, -3.2], P).prop('eg_cat_statue', [-26.8, 0.4, 3.2], P);
plinth(-26.6, -3.2, 1.6, 2.2, 0.4).add({ kind: 'block', position: [-26.8, 0, 3.2], size: [1.2, 0.4, 1.2], yaw: 0, material: 'core.pbr_white_marble', tint: null, behaviour: 'solid', trigger: 'step', delaySeconds: 0.8, respawnSeconds: 8, health: 120 });
prop('eg_stele', [-20, 0, -11.2], 0).prop('eg_stele', [-12, 0, -11.2], 0).prop('jg_stele', [-20, 0, 11.2], PI).prop('jg_carved_pillar', [-12, 0, 11.2], PI);
prop('im_statue_emperor', [-8, 0, 0], -P).prop('im_bust', [-9.2, 0, -3.6], -P).prop('im_bust', [-9.2, 0, 3.6], -P);
for (const [x, z, id] of [[-24, -5.4, 'jars_1'], [-24, 5.4, 'jars_2']] as const) prop('eg_canopic_jars', [x, 0, z], 0, 1, id);
for (const [x, z] of [[-10.6, -9.8], [-10.6, 9.8]] as const) prop('im_amphorae', [x, 0, z], 0.3);
// Three sarcophagi along the west wall, each under a gilded lid you can shoot off.
const LIDS = ['lid_1', 'lid_2', 'lid_3'];
[[-21.4, -2.6], [-21.4, 2.6], [-11, 7.6]].forEach(([x, z], i) => {
  plinth(x!, z!, 1.8, 3.2, 0.3, { material: 'pbr_rough_sandstone' });
  prop(i === 2 ? 'ge_sarcophagus' : 'eg_sarcophagus', [x!, 0.3, z!], i === 2 ? P : 0);
  m.block([x!, 1.42, z!], i === 2 ? [2.4, 0.22, 1.2] : [1.2, 0.22, 2.5], 'breakable', { material: 'gold_leaf', health: 40, respawn: null, id: LIDS[i] });
});
squad('enc_mummies', 'Out of the sarcophagi', [-19, 0, 0], { imp: 3 }, { cap: 4, reinf: 3, per: 1, radius: 3 });
for (const [x, z] of [[-22, -6], [-22, 6], [-10, -6], [-10, 6]] as const) m.light([x, 3.4, z], { fixture: 'none', color: '#ffb46a', intensity: 0.9, range: 9, id: `lamp_antiq_${x < -16 ? 'w' : 'e'}${z < 0 ? 's' : 'n'}` });
m.add({ kind: 'zone', id: 'zone_antiq', name: 'Hall of Antiquities', position: [-16, 0, 0], size: [18, 3, 18], who: 'any', count: 1, startEnabled: true, team: 'players' });

// ---------------------------------------------------------------- Armour Gallery (x -20..-12, z 12..28)
const ARMOURS: [string, V3, number][] = [['armour_1', [-18.7, 0, 15.5], P], ['armour_2', [-13.3, 0, 17.5], -P], ['armour_3', [-18.7, 0, 21.5], P], ['armour_4', [-13.3, 0, 23.5], -P]];
for (const [id, at, yaw] of ARMOURS) {
  prop('ge_suit_of_armour', at, yaw, 1.1, id);
  squad(`enc_${id}`, `The ${id.replace('_', ' ')} wakes`, [at[0] + (yaw > 0 ? 0.8 : -0.8), 0, at[2]], { puglin: 1 }, { cap: 2, reinf: 1, per: 1, radius: 1 });
}
prop('dg_sword_mount', [-19.6, 1.6, 19.5], P).prop('shield', [-12.4, 1.4, 20.5], -P).prop('dg_banner', [-16, 0, 27.4], PI);
m.light([-19.4, 2.8, 18.5], { id: 'lamp_armour_w', fixture: 'wall', color: '#ffc27a', intensity: 1, range: 8, yaw: P });
m.light([-12.6, 2.8, 22.5], { id: 'lamp_armour_e', fixture: 'wall', color: '#ffc27a', intensity: 1, range: 8, yaw: -P });
m.add({ kind: 'zone', id: 'zone_armour', name: 'Armour Gallery', position: [-16, 0, 19.5], size: [5, 3, 5], who: 'any', count: 1, startEnabled: true, team: 'players' });

// ---------------------------------------------------------------- Gothic gallery (x -12..4, z 12..28)
// Weeping angels on plinths, 3 m off the north wall: the zombies step out from behind them.
const ANGELS: [number, number][] = [[-8.5, 24.2], [-3, 24.2], [1.5, 22.6]];
ANGELS.forEach(([x, z], i) => {
  plinth(x, z, 1.6, 1.6, 0.4, { material: 'pbr_castle_stone', tint: '#9a968c' });
  prop('ge_angel_statue', [x, 0.4, z], PI);
  squad(`enc_angel_${i + 1}`, `Behind angel ${i + 1}`, [x, 0, z + 2.2], { zombie: 2 }, { cap: 3, reinf: 2, per: 1, radius: 1.2 });
});
for (const [x, z, yaw] of [[-11.5, 16, P], [-11.5, 20, P], [3.6, 15.5, -P], [-4, 12.4, 0]] as const) prop('ge_portrait', [x, 1.4, z], yaw);
prop('ge_grand_piano', [-8, 0, 15.5], 0.6).prop('ge_grandfather_clock', [3.4, 0, 26.6], PI).prop('ge_wingback_chair', [-1, 0, 16], -0.4);
const CANDLES = ['candle_1', 'candle_2', 'candle_3', 'candle_4'];
[[-10.6, 13.4], [-10.6, 26.4], [2.4, 13.4], [-5.5, 26.6]].forEach(([x, z], i) => {
  prop('ge_candelabra', [x!, 0, z!], 0);
  m.light([x!, 1.9, z!], { id: CANDLES[i]!, fixture: 'candle', color: '#ffb347', intensity: 1, range: 7 });
});
m.light([-4, 3.3, 20], { id: 'chandelier_gothic', fixture: 'chandelier', color: '#ffd090', intensity: 1.2, range: 12 });
m.add({ kind: 'zone', id: 'zone_gothic', name: 'Gothic gallery', position: [-4, 0, 18], size: [12, 3, 8], who: 'any', count: 1, startEnabled: true, team: 'players' });

// ---------------------------------------------------------------- Space Hall (x 12..36, z -12..12; dais x 21..27, z -3..3)
prop('os_holo_globe', [24, 1, 0], 0);
m.gravityZone([24, 1, 0], [6, 6, 6], 0.3, 'Zero-G exhibit');
prop('os_satellite_dish', [33, 0, 0], -P).prop('os_comms_dish', [15, 0, 0], P).prop('os_console_corner', [34.6, 0, -10.6], PI);
for (const [x, z] of [[20, -11.6], [28, -11.6], [20, 11.6], [28, 11.6]] as const) prop('os_viewport', [x, 1, z], z < 0 ? 0 : PI);
// Cryo pods against the north and south walls; their glass is a window pane in front.
const PODS: [V3, number, Roster][] = [[[16, 0, -10.6], 0, { oculus: 2 }], [[32, 0, -10.6], 0, { cyclops: 1, oculus: 1 }], [[16, 0, 10.6], PI, { cyclops: 2 }], [[32, 0, 10.6], PI, { oculus: 2 }]];
PODS.forEach(([at, yaw, r], i) => {
  prop('os_cryo_pod', at, yaw);
  const front = at[2] < 0 ? 1 : -1;
  m.add({ kind: 'destructible', id: `pod_glass_${i + 1}`, name: `Cryo pod ${i + 1} glass`, model: 'glass', position: [at[0], 0, r2(at[2] + front * 1.05)], yaw: 0, health: 1, explosiveOnly: false });
  squad(`enc_pod_${i + 1}`, `Specimen ${i + 1}`, [at[0], 0, r2(at[2] + front * 3.2)], r, { cap: 2, reinf: 1, per: 1, radius: 1.5 });
  m.light([at[0], 2.6, r2(at[2] + front * 0.9)], { id: `lamp_pod_${i + 1}`, fixture: 'none', color: '#7ae8ff', intensity: 1, range: 5 });
});
for (const [x, z] of [[24, -8], [24, 8]] as const) m.light([x, 3.6, z], { id: `alarm_space_${z < 0 ? 's' : 'n'}`, fixture: 'bulb', color: '#ff2a2a', intensity: 1.4, range: 12, off: true });
m.light([24, 3.6, 0], { fixture: 'ceiling', color: '#e0f0ff', intensity: 1, range: 12 });
m.add({ kind: 'zone', id: 'zone_space', name: 'Space Hall', position: [24, 0, 0], size: [16, 3, 16], who: 'any', count: 1, startEnabled: true, team: 'players' });

// ---------------------------------------------------------------- Military wing (x 4..20, z 12..28)
// The tank faces the reinforced wall into the atrium; a roped-off display; a locked door from Gothic.
m.mount('tank', [8, 0, 20.5], PI);
for (const [x, z, yaw] of [[4.8, 25, 0], [11.2, 25, 0], [12, 20.5, P]] as const) prop('road_barrier', [x, 0, z], yaw);
prop('sandbag_wall', [17.5, 0, 26], 0).prop('ammo_stack', [18.6, 0, 14], 0.3).prop('flag', [18.8, 0, 22], 0).prop('supply_truck', [16.5, 0, 19], 0);
m.add({ kind: 'door', id: 'door_military', name: 'Military wing door', position: [4, 0, 24], yaw: P, style: 'blast', startOpen: false, locked: true, auto: false });
// The reinforced wall: three panels that only explosives break (a tank shell does), a lintel over them.
m.block([8, 3, 12], [8, 1, 0.5], 'solid', { material: 'pbr_travertine', tint: '#e8e2d4' });
const BREACH = ['breach_w', 'breach_m', 'breach_e'];
[5.5, 8, 10.5].forEach((x, i) => m.add({ kind: 'destructible', id: BREACH[i]!, name: 'Reinforced wall', model: 'wall', position: [x, 0, 12], yaw: 0, health: 300, explosiveOnly: true }));
const MIL_LAMPS = ['alarm_mil_1', 'alarm_mil_2'];
[[6, 27], [18, 13]].forEach(([x, z], i) => m.light([x!, 3.4, z!], { id: MIL_LAMPS[i]!, fixture: 'bulb', color: '#ff3a20', intensity: 1.2, range: 10, off: true }));
m.light([12, 3.6, 20], { fixture: 'ceiling', color: '#d8e0c8', intensity: 0.9, range: 12 });
m.add({ kind: 'zone', id: 'zone_military', name: 'Military wing', position: [12, 0, 20], size: [14, 3, 14], who: 'any', count: 1, startEnabled: true, team: 'players' });

// ---------------------------------------------------------------- the finale (the atrium)
squad('enc_scolitex', 'The Scolitex', [6, 0, 4], { scolitex: 1 }, { cap: 1, reinf: 0, per: 0, radius: 2, size: 1.3, health: 4, difficulty: 'hard' });
squad('enc_finale_imps', 'Imps on the balcony', [4, 4, 10.8], { imp: 3 }, { cap: 5, reinf: 6, per: 2, radius: 3 });
squad('enc_guards', 'Night guards', [6, 0, -14], { trooper: 2 }, { faction: 'guards', order: 'follow', active: true, cap: 2, per: 0, radius: 2 });

// ---------------------------------------------------------------- spawns and pickups
for (const [x, z] of [[0, -12], [2.5, -14], [5.5, -14], [8, -12], [0, -16], [8, -16], [2.5, -18], [5.5, -18]] as const) m.spawn([x, 0, z], 0);
const ITEMS: [string, V3, number?][] = [
  ['health_large', [10.5, 0, -6]], ['ammo', [-2.5, 0, -6]], ['armor_small', [4, 0, -19]],
  ['weapon_shotgun', [-10, 0, -14], 30], ['weapon_smg', [-17, 0, -15]], ['armor_large', [-6, 0, -26], 45], ['grenades', [-12, 0, -26]],
  ['weapon_rifle', [-16, 0, -8], 30], ['health_small', [-20, 0, -8.6]], ['ammo_rifle', [-6, 0, -6]],
  ['health_small', [-16, 0, 26]], ['weapon_auto_shotgun', [-4, 0, 26.4], 40], ['ammo_shells', [1, 0, 26.6]],
  ['weapon_plasma', [24, 0, 6], 30], ['ammo_cells', [24, 0, -6]], ['weapon_laser_rifle', [34, 0, 6], 45], ['health_small', [14, 0, -6]],
  ['weapon_launcher', [16, 0, 26], 40], ['ammo_explosive', [18.5, 0, 24]], ['health_large', [14, 0, 14]],
  ['health_large', [0, 4, -10]], ['armor_large', [8, 4, -10], 45], ['ammo', [9, 4, 2]], ['grenades', [-2, 0, 8]],
];
for (const [item, p, r] of ITEMS) m.pickup(item, p, r ?? null);

// ---------------------------------------------------------------- logic
type Rule = ScenarioLogic['rules'][number];
type Action = Rule['do'][number];
type Condition = Rule['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: Rule['when']['event'], target: string | null, does: Action[], ifs: Condition[] = [], once = false): Rule => ({ id, name, enabled: true, once, when: { event, target }, if: ifs, do: does });
const say = (text: string, s = 4) => act('message', null, { value: s, text });
const wait = (s: number) => act('wait', null, { value: s });

const GALLERY_SQUADS = ['enc_mummies', ...ARMOURS.map(([id]) => `enc_${id}`), ...ANGELS.map((_, i) => `enc_angel_${i + 1}`), ...PODS.map((_, i) => `enc_pod_${i + 1}`)];
const ALL_SQUADS = [...GALLERY_SQUADS, 'enc_scolitex', 'enc_finale_imps'];
const rules: Rule[] = [
  rule('rule_intro', 'Night shift', 'match_start', null, [say('Night shift at the museum. Do your rounds: the Antiquities, the Armour Gallery, Gothic and the Space Hall.', 6)]),
  // Antiquities: a shot lid (or the timer) lets the imps out, once.
  rule('rule_antiq_in', 'Something moves in the Antiquities', 'zone_enter', 'zone_antiq', [say('Did that sarcophagus just move?', 3), act('light_blink', 'lamp_idol', { value: 3, state: 'on' }), act('timer_start', 'timer_lids')], [], true),
  ...LIDS.map((lid, i) => rule(`rule_${lid}`, `Lid ${i + 1} breaks`, 'destroyed', lid, [act('set_var', 'var_antiq', { value: 1 }), act('sound', null, { state: 'boom' }), act('light_blink', 'lamp_idol', { value: 0, state: 'off' }), say('The sarcophagi are open! Imps!', 3), act('encounter_start', 'enc_mummies')], [cond('variable', 'var_antiq', '==', 0)])),
  rule('rule_lids_burst', 'The lids burst', 'timer_done', 'timer_lids', LIDS.map((l) => act('destroy', l))),
  // Armour Gallery: lamps flash, the suits shatter, puglins where they stood.
  rule('rule_armour', 'The suits of armour wake', 'zone_enter', 'zone_armour', [
    act('light_flash', 'lamp_armour_w', { value: 0.8 }), act('light_flash', 'lamp_armour_e', { value: 0.8 }), act('sound', null, { state: 'alarm' }), wait(0.7),
    ...ARMOURS.flatMap(([id]) => [act('destroy', id), act('encounter_start', `enc_${id}`)]),
    say('The armour was hollow... and full of puglins!', 3),
  ], [], true),
  // Gothic: the candles gutter, the chandelier dies, zombies from behind the angels.
  rule('rule_gothic', 'The candles gutter', 'zone_enter', 'zone_gothic', [
    ...CANDLES.map((c) => act('light_blink', c, { value: 4, state: 'on' })), act('light_off', 'chandelier_gothic'), say("The candles gutter... Don't blink.", 3), wait(1.8),
    ...ANGELS.map((_, i) => act('encounter_start', `enc_angel_${i + 1}`)),
  ], [], true),
  rule('rule_gothic_calm', 'The candles steady', 'variable_changed', 'var_cleared', [...CANDLES.map((c) => act('light_blink', c, { value: 0, state: 'off' })), act('light_on', 'chandelier_gothic')], [cond('encounter_alive', 'enc_angel_1', '==', 0), cond('encounter_alive', 'enc_angel_2', '==', 0), cond('encounter_alive', 'enc_angel_3', '==', 0), cond('objective', 'obj_rounds', '==', 0, 'active')]),
  // Space Hall: a containment alarm, then the pods open; any pod you shoot opens at once.
  rule('rule_space', 'Containment warning', 'zone_enter', 'zone_space', [act('light_on', 'alarm_space_s'), act('light_on', 'alarm_space_n'), act('light_blink', 'alarm_space_s', { value: 2, state: 'on' }), act('light_blink', 'alarm_space_n', { value: 2, state: 'on' }), act('sound', null, { state: 'alarm' }), say('CONTAINMENT FAILURE IN 15 SECONDS', 4), act('timer_start', 'timer_pods')], [], true),
  ...PODS.map((_, i) => rule(`rule_pod_${i + 1}`, `Pod ${i + 1} opens`, 'destroyed', `pod_glass_${i + 1}`, [act('light_color', `lamp_pod_${i + 1}`, { text: '#ff3a3a' }), act('encounter_start', `enc_pod_${i + 1}`)], [], true)),
  rule('rule_pods_open', 'Containment fails', 'timer_done', 'timer_pods', [...PODS.map((_, i) => act('destroy', `pod_glass_${i + 1}`)), say('The specimens are loose!', 3)]),
  // Every gallery squad cleared counts; all of them and the curator's key unlocks.
  ...GALLERY_SQUADS.map((s) => rule(`rule_cleared_${s}`, `Cleared: ${s}`, 'encounter_cleared', s, [act('add_var', 'var_cleared', { value: 1 })], [], true)),
  rule('rule_rounds_done', 'Rounds done', 'variable_changed', 'var_cleared', [
    act('objective', 'obj_rounds', { state: 'complete' }), act('objective', 'obj_key', { state: 'active' }), act('enable', 'btn_curator'), act('light_on', 'lamp_curator'), act('sound', null, { state: 'chime' }),
    say("The front doors won't open. The tank in the Military wing is the only way out: the curator keeps the key upstairs.", 6),
  ], [cond('variable', 'var_cleared', '>=', GALLERY_SQUADS.length)], true),
  rule('rule_key', 'The key', 'button_pressed', 'btn_curator', [
    act('objective', 'obj_key', { state: 'complete' }), act('objective', 'obj_tank', { state: 'active' }), act('light_off', 'lamp_curator'),
    act('door_unlock', 'door_military'), act('door_open', 'door_military'), ...MIL_LAMPS.flatMap((l) => [act('light_on', l), act('light_blink', l, { value: 1.5, state: 'on' })]),
    act('sound', null, { state: 'chime' }), say('Military wing open. Start the tank and blast through the wall into the atrium!', 5),
  ]),
  rule('rule_tank_room', 'In the Military wing', 'zone_enter', 'zone_military', [say('Shell the reinforced wall (explosives only) to break into the atrium.', 4)], [], true),
  // The breach: any panel down starts the finale (once).
  ...BREACH.map((b) => rule(`rule_${b}`, 'The wall comes down', 'destroyed', b, [
    act('set_var', 'var_breach', { value: 1 }), act('objective', 'obj_rounds', { state: 'complete' }), act('objective', 'obj_key', { state: 'complete' }), act('objective', 'obj_tank', { state: 'complete' }), act('objective', 'obj_finale', { state: 'active' }),
    act('sound', null, { state: 'boom' }), act('destroy', 'breach_w'), act('destroy', 'breach_m'), act('destroy', 'breach_e'),
    say('Something huge is moving in the atrium... THE SCOLITEX!', 4), act('encounter_start', 'enc_scolitex'), wait(4), act('encounter_start', 'enc_finale_imps'),
  ], [cond('variable', 'var_breach', '==', 0)])),
  rule('rule_win', 'The Scolitex falls', 'encounter_cleared', 'enc_scolitex', [...ALL_SQUADS.map((s) => act('encounter_stop', s)), act('objective', 'obj_finale', { state: 'complete' }), act('sound', null, { state: 'chime' }), say('The sun is coming up. The exhibits are still. Shift over.', 5), wait(4), act('end_round', null, { state: 'players win' })]),
  rule('rule_life', 'A guard falls', 'player_killed', null, [act('add_var', 'var_lives', { value: -1 })]),
  rule('rule_few', 'Few lives left', 'variable_changed', 'var_lives', [say('Only 5 lives left!', 3), act('sound', null, { state: 'buzzer' })], [cond('variable', 'var_lives', '==', 5)]),
  rule('rule_lose', 'The museum wins', 'variable_changed', 'var_lives', [say('The night shift is over for good.', 4), act('end_round', null, { state: 'players lose' })], [cond('variable', 'var_lives', '<=', 0)]),
];
m.logic({
  variables: [
    { id: 'var_cleared', name: 'gallery squads cleared', initial: 0 },
    { id: 'var_antiq', name: 'sarcophagi open', initial: 0 },
    { id: 'var_breach', name: 'wall breached', initial: 0 },
    { id: 'var_lives', name: 'lives', initial: 20 },
  ],
  timers: [
    { id: 'timer_lids', name: 'The lids are rattling', seconds: 20, loop: false, visible: true },
    { id: 'timer_pods', name: 'Containment failure', seconds: 15, loop: false, visible: true },
  ],
  objectives: [
    { id: 'obj_rounds', text: 'Do your rounds: clear all four galleries', startActive: true, marker: null },
    { id: 'obj_key', text: "Take the Military wing key from the curator's office", startActive: false, marker: 'btn_curator' },
    { id: 'obj_tank', text: 'Break through into the atrium with the tank', startActive: false, marker: 'breach_m' },
    { id: 'obj_finale', text: 'Bring down the Scolitex', startActive: false, marker: 'enc_scolitex' },
  ],
  rules,
});

// ---------------------------------------------------------------- dressing
m.dress({ x0: 0, y0: -1, x1: 0, y1: -1, z: 1 }, 'office', { density: 'sparse' });
m.dress({ x0: 1, y0: -1, x1: 1, y1: -1, z: 1 }, 'server', { density: 'sparse' });

// ---------------------------------------------------------------- bounds and metadata
m.bounds('invisible', 4);
m.meta({
  description:
    "Co-op night at the museum. You and two guard bots do the rounds while the exhibits wake one gallery at a time: imps out of the Egyptian sarcophagi in the Hall of Antiquities, puglins bursting out of the suits of armour, zombies from behind the weeping angels as the Gothic gallery's candles gutter, and oculi and cyclopes loose from the Space Hall's cryo pods. Then take the curator's key, start the tank in the Military wing and blast through the wall into the Grand Atrium for the Scolitex. A Skyfighter on a plinth in the atrium flies out through the skylight.",
  modes: ['core.coop'],
  players: [1, 8],
});
await m.save();
