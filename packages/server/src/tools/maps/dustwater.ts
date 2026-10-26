/**
 * Dustwater: the demo map for Style Pack 02 Frontier Dust. A Wild West town
 * on one dusty main street: the saloon with its swinging doors, the bank and
 * its vault, the jail, the general store, a barber and a hotel with false
 * fronts, adobe houses and a cantina, the chapel and its graveyard, the
 * livery and corral, a water tower. North of town the railroad runs past the
 * station, and a train comes through all match (stand on the tracks and it
 * runs you over; jump on the flatbed and ride it). Up the hill behind, a mine
 * tunnel runs through the ridge, a cart trundling in and out on its rails.
 *
 * Dynamite is the town's weapon of choice: sticks to pick up and throw, crates
 * that go up when shot (one of them right by the vault door, which blows the
 * vault open), and plank barricades to blast or shoot through.
 *
 * Grid x east, y north (one cell = 8 m):
 *
 *   y 8..10                 mine tunnel (on the hill, 4 m up)
 *   y 7                     mine yard, cart rails
 *   y 5  ═════════════ railroad (the train) ════╪══ crossing
 *   y 4            station
 *   y 1..3  hotel saloon . bank  ║ barber jail  store assay
 *   y 0     ════════════════ main street ════════════════
 *   y -1..-2 cantina livery tower corral chapel graves adobe ff
 *          x -6  -5..-4  -3  -2..-1  0  1  2  3  4..5  6
 */
import { TERRAIN_MATERIALS, newTerrain, paintSlopes, type ScenarioLogic, type TerrainData } from '@tiletrigger/shared';
import { MapBuilder } from '../mapkit.ts';

const m = new MapBuilder('dustwater', 'Dustwater');
m.theme('frontier');
m.backdrop('clear', 'mesas', 'sand', 0.5);
m.teams([8, 8]);
const [west, east] = m.teamIds(2) as [string, string];
const P = Math.PI / 2;
const C = 8;

// ---------------------------------------------------------------- the land: a flat town, the hill behind

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Ground height above the flat (m): the hill north of the railroad, and the ridge the mine runs through. */
function hill(x: number, z: number): number {
  const plateau = 4 * smooth(42, 51, z) * smooth(-24, -10, x) * (1 - smooth(58, 70, x));
  const d = Math.abs(x - 24);
  const ridge = 6.5 * smooth(4.5, 8, d) * (1 - smooth(12, 22, d)) * smooth(60.5, 66, z) * (1 - smooth(86, 92, z));
  return plateau + ridge;
}
let terrain: TerrainData = { ...newTerrain(192, 2, [0, 8], 'sand'), baseY: -0.15 };
terrain = { ...terrain, heights: terrain.heights.map((_, i) => Math.round(hill(terrain.origin[0] + (i % terrain.cols) * 2, terrain.origin[1] + Math.floor(i / terrain.cols) * 2) * 100)) };
const GRAVEL = TERRAIN_MATERIALS.indexOf('gravel');
terrain = {
  ...terrain,
  materials: terrain.materials.map((v, i) => {
    const x = terrain.origin[0] + ((i % (terrain.cols - 1)) + 0.5) * 2;
    const z = terrain.origin[1] + (Math.floor(i / (terrain.cols - 1)) + 0.5) * 2;
    return hill(x, z) > 4.5 ? GRAVEL : v;
  }),
};
m.terrain(paintSlopes(terrain, 30, 'gravel'));

// ---------------------------------------------------------------- the town

// Main street east to west, and a lane north to the station.
for (let x = -7; x <= 7; x++) m.tile('frontier.main_street', x, 0);
for (const y of [1, 2, 3]) m.tile('frontier.main_street', 0, y);
// North side, fronts (and porches) on the street.
m.tile('core.room', -6, 1, 0, 0, { facade: 'false_front', ceiling: 'roof', layout: 'empty' }); // the hotel
m.tile('frontier.saloon', -5, 1, 0, 0);
m.tile('frontier.bank', -2, 1, 0, 0);
m.tile('core.room', 1, 1, 0, 0, { facade: 'false_front', ceiling: 'roof', layout: 'empty' }); // the barber
m.tile('frontier.jail', 2, 1, 0, 0);
m.tile('frontier.store', 4, 1, 0, 0);
m.tile('core.room', 6, 1, 0, 0, { facade: 'adobe', ceiling: 'beams', layout: 'empty' }); // the assay office
m.edge(-6, 1, 0, 'S', 'door').edge(-6, 1, 0, 'W', 'window').edge(-6, 1, 0, 'N', 'door');
m.edge(1, 1, 0, 'S', 'wide').edge(1, 1, 0, 'W', 'window').edge(1, 1, 0, 'N', 'door');
m.edge(6, 1, 0, 'S', 'door').edge(6, 1, 0, 'E', 'window').edge(6, 1, 0, 'N', 'window');
// South side, fronts facing north onto the street.
m.tile('core.room', -6, -1, 0, 0, { facade: 'adobe', ceiling: 'beams', layout: 'low_cover' }); // the cantina
m.tile('frontier.livery', -4, -1, 0, 2); // cells x -5..-4, y -2..-1
m.tile('frontier.water_tower', -3, -2, 0, 0);
m.tile('frontier.corral', -1, -1, 0, 2); // cells x -2..-1, y -2..-1
m.tile('frontier.church', 0, -1, 0, 2); // cells (0,-1), (0,-2)
m.tile('core.room', 2, -1, 0, 0, { facade: 'adobe', ceiling: 'roof', layout: 'empty' });
m.tile('core.room', 3, -1, 0, 0, { facade: 'false_front', ceiling: 'roof', layout: 'empty' }); // the undertaker
m.edge(-6, -1, 0, 'N', 'wide').edge(-6, -1, 0, 'E', 'window').edge(-6, -1, 0, 'S', 'door');
m.edge(2, -1, 0, 'N', 'door').edge(2, -1, 0, 'W', 'window').edge(2, -1, 0, 'S', 'window');
m.edge(3, -1, 0, 'N', 'door').edge(3, -1, 0, 'E', 'window').edge(3, -1, 0, 'S', 'door');

// The station and the railroad (the track runs on beyond the town as Kenney railroad).
m.tile('frontier.station', -1, 4, 0, 0); // cells (-1,4), (0,4); platform along the track
for (let x = -7; x <= 7; x++) m.tile(x === 1 ? 'frontier.rail_crossing' : 'frontier.rail_line', x, 5, 0, 1);
for (const x of [-88, -77.6, -67.2, 67.2, 77.6, 88]) m.prop('railroad', [x, 0, 5 * C], P, 1, false);

// The mine: a yard on the hill and a tunnel through the ridge.
for (const x of [2, 3, 4]) m.tile('core.yard', x, 7, 1);
m.tile('frontier.mine_entrance', 3, 8, 1, 0);
m.tile('frontier.mine_tunnel', 3, 9, 1, 0);
m.tile('frontier.mine_tunnel', 3, 10, 1, 0);
m.edge(2, 7, 1, 'W', 'railing').edge(4, 7, 1, 'E', 'railing');
for (const x of [2, 3, 4]) m.edge(x, 7, 1, 'S', 'open');
m.edge(2, 7, 1, 'N', 'half').edge(4, 7, 1, 'N', 'half');

// ---------------------------------------------------------------- gameplay pieces

// The saloon's swinging doors.
m.add({ kind: 'door', id: 'saloon_doors', name: 'Saloon doors', position: [-5 * C + 4, 0, 1 * C - 1.25], yaw: 0, startOpen: false, locked: false, auto: true, style: 'saloon' });
// The bank vault: a vault door, locked. A dynamite crate stands by it (blow it and the door goes); the combination
// takes ten seconds to work; the lever inside locks it again.
const VAULT_X = -2 * C + 8.3;
m.add({ kind: 'door', id: 'vault_door', name: 'Vault door', position: [VAULT_X, 0, 1 * C + 1.5], yaw: P, startOpen: false, locked: true, auto: false, style: 'vault' });
m.add({ kind: 'prop', id: 'tnt_vault', model: 'prop.dynamite_crate', position: [-2 * C + 7.2, 0, 1 * C + 2.6], yaw: 0.3, scale: 1, solid: true, tint: null });
m.add({ kind: 'button', id: 'btn_combo', name: 'Vault combination', position: [-2 * C + 7.7, 0, 1 * C + 3.3], yaw: Math.PI, label: 'Work the vault combination', once: false, cooldownSeconds: 60, startEnabled: true });
m.add({ kind: 'button', id: 'btn_lock', name: 'Vault lever', position: [-2 * C + 9.7, 0, 1 * C - 0.85], yaw: 0, label: 'Shut and lock the vault', once: false, cooldownSeconds: 5, startEnabled: true });
m.pickup('powerup_damage', [-2 * C + 9.8, 0, 1 * C + 1.2], 60);
m.light([-2 * C + 9.8, 3, 1 * C + 1.2], { id: 'vault_lamp', fixture: 'bulb', color: '#ffd24a', intensity: 1.2, range: 6, off: true });

type Action = ScenarioLogic['rules'][number]['do'][number];
type Condition = ScenarioLogic['rules'][number]['if'][number];
const act = (type: Action['type'], target: string | null = null, o: { value?: number; text?: string; state?: string } = {}): Action => ({ type, target, value: o.value ?? 0, text: o.text ?? '', state: o.state ?? '' }) as Action;
const cond = (type: Condition['type'], target: string | null, op: Condition['op'], value: number, state = ''): Condition => ({ type, target, op, value, state }) as Condition;
const rule = (id: string, name: string, event: string, target: string | null, does: Action[], ifs: Condition[] = []) => ({ id, name, enabled: true, once: false, when: { event, target }, if: ifs, do: does }) as ScenarioLogic['rules'][number];
m.logic({
  variables: [],
  timers: [],
  objectives: [],
  rules: [
    rule('rule_vault_blown', 'The vault is blown', 'destroyed', 'tnt_vault', [act('door_unlock', 'vault_door'), act('door_open', 'vault_door'), act('light_on', 'vault_lamp'), act('message', null, { value: 4, text: 'BOOM! The vault door is blown open!' })]),
    rule('rule_vault_combo', 'The combination', 'button_pressed', 'btn_combo', [act('message', null, { value: 4, text: 'The tumblers turn... the vault opens in ten seconds.' }), act('wait', null, { value: 10 }), act('door_unlock', 'vault_door'), act('door_open', 'vault_door'), act('light_on', 'vault_lamp')], [cond('door', 'vault_door', '==', 0, 'locked')]),
    rule('rule_vault_lock', 'Lock the vault', 'button_pressed', 'btn_lock', [act('door_close', 'vault_door'), act('door_lock', 'vault_door'), act('light_off', 'vault_lamp'), act('message', null, { value: 3, text: 'The vault is locked.' })]),
  ],
});

// The train: a locomotive, a passenger car and a flatbed on chassis blocks, through town and back.
// Moving east (+x), the locomotive leads (its chimney end is its -Z, so it is turned to face east).
const TZ = 5 * C;
const LX = -48;
const TY = 0.15;
const car = (id: string, model: string, dx: number, yaw: number) => {
  m.add({ kind: 'prop', id, model: `prop.${model}`, position: [LX + dx, TY, TZ], yaw, scale: 1, solid: false, tint: null });
  return id;
};
const hull = (id: string, dx: number, size: [number, number, number], y0: number, material: string, tint?: string) => {
  // Block sizes are across, up, along the track; turned to run along x.
  m.block([LX + dx, TY + y0, TZ], [size[0], size[1], size[2]], 'solid', { material, ...(tint ? { tint } : {}), yaw: P, id });
  return id;
};
const trainProps = [car('train_loco', 'locomotive_red', 0, -P), car('train_coach', 'passenger_car', -7.3, P), car('train_flatbed', 'flatbed_wagon', -14.7, P)];
const trainBlocks = [
  hull('train_boiler', 1.5, [2.0, 2.0, 3.6], 0.6, 'pbr_steel', '#2e2c2a'),
  hull('train_cab', -1.8, [2.9, 3.1, 2.8], 0.6, 'pbr_steel', '#2e2c2a'),
  hull('train_coach_body', -7.3, [2.2, 2.2, 6.4], 0.75, 'pbr_steel', '#3a2a22'),
  hull('train_deck', -14.7, [2.7, 0.35, 6.6], 0.55, 'pbr_weathered_planks'),
];
m.mover('train', [LX, TY, TZ], trainBlocks, [[0, 0, 0], [120, 0, 0]], { mode: 'pingpong', speed: 9, wait: 10, yaw: P, props: trainProps, name: 'The train' });
// The station platform runs out to the track (a train passes 0.3 m from its edge).
m.block([-1 * C + 4, 0, 4 * C + 5], [16, 0.25, 2], 'solid', { material: 'pbr_weathered_planks' });
// Buffer stops at the far ends of the line.
m.prop('rail_buffer', [-93, 0, TZ], -P).prop('rail_buffer', [93, 0, TZ], P);

// The mine cart: out of the tunnel to the edge of the yard and back.
const CART_X = 3 * C;
m.block([CART_X, 4.14, 58], [0.96, 0.72, 1.24], 'solid', { material: 'pbr_rock', tint: '#5a5048', id: 'cart_ore' });
m.add({ kind: 'prop', id: 'cart_body', model: 'prop.mine_cart', position: [CART_X, 4, 58], yaw: 0, scale: 1, solid: false, tint: null });
m.mover('mine_cart', [CART_X, 4, 58], ['cart_ore'], [[0, 0, 0], [0, 0, 24]], { mode: 'pingpong', speed: 2.5, wait: 3, props: ['cart_body'], name: 'Mine cart' });
for (const z of [55, 63.6]) m.prop('mine_rails', [CART_X, 4, z], 0, 1.43, false);
m.prop('ore_cart', [CART_X - 4, 4, 57], 0.2).prop('mine_cart', [CART_X + 4.5, 4, 58], -0.3);
m.prop('mine_frame', [CART_X, 4, 88.2], 0, 1, true);
// The yard's corners (loafbrr's Mines and Caves set, CC0): spoil and rock heaps, a tipper cart, a rail stop.
m.prop('mc_mound', [16.2, 4, 54.8], 0).prop('mc_cave_rocks_b', [34, 4, 53.5], 1.1).prop('mc_cave_rocks_d', [13.8, 4, 58.8], 2.2);
m.prop('mc_cart_tipper', [33.5, 4, 57.5], 1.4).prop('mc_rail_end', [CART_X, 4, 53.4], 0);

// Breakable wood: planks boarding up the tunnel's far end and the livery's back door.
m.block([CART_X, 4, 83.7], [3.4, 3.4, 0.25], 'breakable', { material: 'pbr_weathered_planks', health: 80, respawn: 25 });
m.block([-4.5 * C, 0, -2.5 * C + 0.35], [3.2, 3.2, 0.25], 'breakable', { material: 'pbr_weathered_planks', health: 80, respawn: 25 });

// Dynamite: crates that go up when shot, bundles, and sticks to throw.
m.prop('dynamite_crate', [CART_X + 6, 4, 54], 0.5).prop('dynamite_crate', [CART_X - 6.5, 4, 59], -0.4).prop('dynamite_bundle', [CART_X + 6, 4.6, 54], 1);
m.prop('dynamite_crate', [4 * C + 5, 0, 2 * C + 6], 0.2).prop('powder_keg', [-1, 0, 4 * C - 3], 0);
m.pickup('dynamite', [CART_X, 4, 52.5], 30).pickup('dynamite', [-4.5 * C, 0, -1 * C + 2], 30).pickup('dynamite', [5 * C, 0, -2.6 * C], 30);

// ---------------------------------------------------------------- dressing

for (const [x, z, yaw] of [[-5.5, 0.32, 0], [-3.6, 0.32, 0], [-1.6, 0.32, 0], [4.6, 0.32, 0], [-4.5, -0.32, 0], [2.6, -0.32, 0]] as const) m.prop('hitching_post', [x * C, 0, z * C], yaw);
m.prop('water_trough', [-4 * C, 0, 0.42 * C], 0).prop('water_trough', [3.5 * C, 0, -0.42 * C], 0).prop('water_trough', [-10, 0, -8.8], 0);
m.prop('wanted_board', [3 * C - 2, 0, 0.5 * C + 0.4], 0).prop('wanted_board', [-1.6 * C, 0, 4 * C - 2], 0);
m.prop('barrel', [-3.3 * C, 0, 1 * C + 1]).prop('barrel_open', [-3.1 * C, 0, 1 * C + 1.8]).prop('crate_large', [5.6 * C, 0, 0.3 * C], 0.3).prop('crate_small', [5.8 * C, 0, 0.32 * C + 0.4], 0.6);
m.prop('covered_wagon', [6 * C, 0, -2.5 * C], 0.4).prop('wagon_wheel', [-2.6 * C, 0, -1.6 * C], 0.6).prop('outhouse', [-5.4 * C, 0, 3 * C], Math.PI);
m.prop('wind_pump', [-0.6 * C, 0, -3.3 * C], 0.3).prop('hay_bale', [-2.1 * C, 0, -1.4 * C], 0.2).prop('hay_bale', [-1.6 * C, 0, -2.4 * C], 1.1);
for (const [x, z] of [[1.0, -1.2], [1.3, -1.7], [1.0, -2.2], [1.3, -2.6]] as const) m.prop('gravestone_cross', [x * C, 0, z * C], 0);
m.prop('coffin', [3.6 * C, 0, -0.55 * C], 0.2).prop('signpost', [7.5 * C, 0, -0.5 * C], 0.4).prop('signpost', [-7.5 * C, 0, 0.5 * C], 2);
for (const [x, z, s] of [[-9, -3, 1], [-10, 4, 1.2], [9, -3.5, 1], [10, 2.5, 1.1], [-8, 7, 1], [10, 8, 1.3], [-2, -4.6, 1], [6, -4.4, 0.9]] as const) m.prop(x % 2 ? 'nt_saguaro' : 'cactus_tall', [x * C, 0, z * C], x, s);
for (const [x, z] of [[-6.5, 2.6], [2, 3], [6.5, -3.5], [-3, 6.2]] as const) m.prop('tumbleweed', [x * C, 0, z * C], x);
m.prop('woodpile', [4.6 * C, 0, 2.4 * C], 0).prop('planks_stack', [5.4 * C, 0, 2.5 * C], 0.3).prop('barrel', [-1 * C + 3, 0, 4 * C - 3.2]);

// ---------------------------------------------------------------- spawns, pickups, objectives

for (const [x, z] of [[-7.4, -0.4], [-7.4, 0.5], [-6.6, 2.6], [-5.8, -2.8], [-3.4, 2.6], [-6.8, -2.4], [-3.4, -0.6], [-7.6, 3.6]] as const) m.spawn([x * C, 0, z * C], P, west);
for (const [x, z] of [[7.4, -0.4], [7.4, 0.5], [6.6, 2.6], [5.4, -2.6], [3.4, 2.7], [6.8, -1.6], [4.6, -0.6], [7.6, 3.6]] as const) m.spawn([x * C, 0, z * C], -P, east);
for (const [x, z] of [[0, 0], [-2, 3], [2.4, 3.2], [-1.5, -0.42], [1.5, 4.2], [-5, 4.2], [5, 4.2], [0.6, -3.2]] as const) m.spawn([x * C, 0, z * C], 0, null);
m.pickup('weapon_hand_cannon', [-5 * C + 6.5, 0, 1 * C + 6.5]).pickup('weapon_sawed_off', [2 * C - 1.5, 0, 1 * C + 0.3]).pickup('weapon_marksman', [-5 * C + 4, 4, 1 * C + 3.5], 30);
m.pickup('weapon_shotgun', [4 * C + 3.5, 0, 1 * C + 2.2]).pickup('weapon_rifle', [-0.6 * C, 0.25, 4 * C + 3]).pickup('weapon_sniper', [CART_X + 3, 4, 7 * C - 2], 35);
m.pickup('health_large', [0, 0, -1 * C - 8.5]).pickup('health_small', [-4.5 * C, 0, -1.5 * C]).pickup('health_small', [6 * C, 0, 1 * C]);
m.pickup('armor_small', [3 * C, 0, -1 * C]).pickup('armor_large', [CART_X + 1.3, 4, 9.5 * C], 40).pickup('ammo', [-3 * C, 0, 0.6 * C]).pickup('ammo', [3 * C, 0, 0.6 * C]);
m.hill([0, 0, 0], 6);
m.flag(west, [-7 * C, 0, -2 * C], P).flag(east, [7 * C, 0, -2 * C], -P);
m.lightRooms({ color: '#ffd8a0', intensity: 0.9 });
m.bounds('invisible', 4, { min: [-94, -48], max: [94, 92] });
m.border('cliffs');
m.meta({
  description:
    'A Wild West town on one dusty main street (Style Pack 02: Frontier Dust): the saloon with swinging doors, the bank and its vault (blow the dynamite by the door, or work the combination), the jail, the store, the chapel and livery. The train comes through past the station all match (it runs you over; ride the flatbed), and up the hill a mine cart trundles out of the tunnel. Dynamite to throw, crates that go up, plank barricades to blast through.',
  modes: ['core.tdm', 'core.deathmatch', 'core.koth', 'core.ctf'],
  players: [6, 16],
});
await m.save();
