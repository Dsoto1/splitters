/**
 * MapMaker Style Packs (ROADMAP_V1 Sprint 7, Set 1 "Foundation"): a themed
 * selection of the building kit. Choosing a pack in the palette's picker shows
 * only its tiles, props, gameplay pieces, vehicles and pickups, and offers its
 * theme. Packs only group content that exists anyway: everything in a pack can
 * be mixed with anything else (BUILDING_KIT.md, "Style Packs").
 *
 * Packs are data only. Add a pack by appending to STYLE_PACKS.
 */
import type { Facade } from '../map/catalog.ts';
import type { MountModel } from '../sim/mounts.ts';
import type { ScenarioPaletteKey } from './operations.ts';

export interface StylePack {
  /** Stable ID; the pack's own tiles are `<id>.*`. */
  id: string;
  /** Its number in the set ("01"). */
  number: string;
  displayName: string;
  /** One line: the look. */
  style: string;
  blurb: string;
  /** Themes (first = the pack's own), full IDs. */
  themes: readonly string[];
  /** Tile IDs, the pack's own first, then core tiles that suit it. */
  tiles: readonly string[];
  /** Prop IDs (`prop.*`), the pack's own first. */
  props: readonly string[];
  /** Library materials made for the pack (full IDs). */
  materials: readonly string[];
  /** Room facades in the pack's look (first = the one to dress rooms with). */
  facades: readonly Facade[];
  /** Scenario palette entries: the gameplay pieces. */
  gameplay: readonly ScenarioPaletteKey[];
  /** What a gameplay piece is for in this pack (its MapMaker tooltip while the pack is picked). */
  gameplayNotes?: Partial<Record<ScenarioPaletteKey, string>>;
  mounts: readonly MountModel[];
  /** Pickup item IDs. */
  pickups: readonly string[];
  /** The demo map built with the pack (maps/<id>.json). */
  demo: string;
}

const props = (...ids: string[]) => ids.map((id) => `prop.${id}`);

export const STYLE_PACKS: readonly StylePack[] = [
  {
    id: 'military',
    number: '01',
    displayName: 'Military Compound',
    style: 'Modern industrial',
    blurb: 'Concrete walls, bunkers, barracks, guard towers, modular trenches, sandbags, containers and catwalks; blast doors, mounted guns and destructible barriers.',
    themes: ['core.military', 'core.bunker', 'core.canyon'],
    tiles: [
      'military.barracks', 'military.guard_tower', 'military.pillbox', 'military.vehicle_shed', 'core.bunker', 'core.warehouse',
      'military.wall', 'military.wall_corner', 'military.gate',
      'military.trench', 'military.trench_corner', 'military.trench_t', 'military.trench_cross', 'military.trench_end', 'military.trench_steps', 'military.trench_dugout',
      'military.gantry', 'core.catwalk', 'core.platform_rail', 'military.helipad', 'core.yard',
    ],
    props: props(
      'sandbag_wall', 'sandbag_wall_low', 'sandbag_corner', 'sandbag_nest', 'hesco_wall', 'hedgehog', 'dragon_tooth', 'razor_wire', 'camo_net',
      'jersey_barrier', 'jersey_barrier_striped', 'jersey_barrier_broken', 'road_barrier', 'concrete_block', 'brick_rubble',
      'ammo_crate', 'ammo_stack', 'fuel_drum', 'fuel_tank', 'storage_tank', 'steel_water_tower',
      'shipping_container_red', 'shipping_container_blue', 'shipping_container_green', 'container', 'container_tall', 'metal_crate',
      'floodlight', 'yard_lamp', 'pallet', 'supply_truck', 'flatbed_truck', 'dumpster',
      'sv_tent', 'sv_radio', 'sv_gas_can', 'warning_sign', 'cone', 'bunk_bed',
    ),
    materials: ['core.pbr_bunker_panels', 'core.pbr_olive_corrugated', 'core.pbr_grey_corrugated', 'core.pbr_burlap'],
    facades: ['concrete', 'corrugated'],
    gameplay: ['door:blast', 'light:alarm', 'block:barrier', 'button', 'wall', 'gas', 'barrel', 'trap:laser', 'trap:mine', 'mover:slider', 'mover:lift', 'ladder'],
    mounts: ['turret_mg', 'turret_rocket', 'sentry', 'gun_jeep', 'armored_rover', 'tank'],
    pickups: ['core.grenades', 'core.mines', 'core.sandbags', 'core.airstrike', 'core.weapon_rifle', 'core.weapon_sniper', 'core.weapon_rockets', 'core.weapon_lmg', 'core.armor_large', 'core.health_large', 'core.uav'],
    demo: 'iron_compound',
  },
  {
    id: 'frontier',
    number: '02',
    displayName: 'Frontier Dust',
    style: 'Wild West',
    blurb: 'A saloon, bank, jail, general store, chapel, livery, rail station, water tower, a mine and the railroad; a moving train, mine carts, dynamite and breakable wood.',
    themes: ['core.frontier', 'core.adobe', 'core.saloon', 'core.desert'],
    tiles: [
      'frontier.saloon', 'frontier.bank', 'frontier.jail', 'frontier.store', 'frontier.church', 'frontier.livery', 'frontier.station',
      'frontier.water_tower', 'frontier.mine_entrance', 'frontier.mine_tunnel',
      'frontier.main_street', 'frontier.boardwalk_street', 'frontier.rail_line', 'frontier.rail_crossing', 'frontier.corral', 'core.yard',
    ],
    props: props(
      'mine_cart', 'ore_cart', 'dynamite_crate', 'dynamite_bundle', 'powder_keg', 'mine_frame', 'mine_rails', 'rail_buffer',
      'locomotive', 'locomotive_red', 'passenger_car', 'ore_wagon', 'hopper_wagon', 'timber_wagon', 'flatbed_wagon', 'coal_car', 'lumber_car', 'railroad', 'railroad_broken',
      'hitching_post', 'water_trough', 'wagon_wheel', 'wanted_board', 'outhouse', 'tumbleweed', 'covered_wagon', 'wind_pump',
      'barrel', 'barrel_open', 'crate_small', 'crate_large', 'hay_bale', 'cart', 'woodpile', 'planks_stack', 'signpost', 'bucket',
      'cactus', 'cactus_tall', 'nt_saguaro', 'nt_cactus_round', 'coffin', 'gravestone_cross', 'bar_stool', 'table', 'chair', 'dg_coin_pile', 'dg_coin_bag',
    ),
    materials: ['core.pbr_weathered_planks', 'core.pbr_weathered_siding', 'core.pbr_adobe', 'core.pbr_dusty_road'],
    facades: ['false_front', 'adobe'],
    gameplay: ['door:saloon', 'door:vault', 'mover:train', 'mover:minecart', 'block:planks', 'boards', 'crate', 'barrel', 'button', 'ladder', 'light:bulb', 'light:wall'],
    mounts: ['turret_mg'],
    pickups: ['core.dynamite', 'core.weapon_hand_cannon', 'core.weapon_sawed_off', 'core.weapon_marksman', 'core.weapon_shotgun', 'core.weapon_rifle', 'core.health_small', 'core.health_large', 'core.armor_small'],
    demo: 'dustwater',
  },
  {
    id: 'orbital',
    number: '04',
    displayName: 'Orbital Station',
    style: 'Clean sci-fi',
    blurb: 'White panel corridors, labs, a hangar bay, airlocks and control rooms with glowing trim, grated floors and viewports onto space. Force fields, low-gravity zones and auto doors.',
    themes: ['core.orbital'],
    tiles: [
      'orbital.hangar', 'orbital.reactor_hall',
      'core.corridor_clear', 'core.corridor_windows', 'core.corner', 'core.junction_t', 'core.junction_x', 'core.corridor_curve',
      'core.room', 'core.room_long', 'core.room_large', 'core.atrium', 'core.stairwell', 'core.catwalk', 'core.bridge',
    ],
    props: props(
      'os_airlock_frame', 'os_bulkhead', 'os_bulkhead_window', 'os_laser_gate', 'os_field_emitter', 'os_viewport', 'os_reactor_core', 'os_cryo_pod', 'os_holo_globe',
      'os_cargo_crate', 'os_generator', 'os_power_unit', 'os_transmitter', 'os_satellite_dish', 'os_comms_dish', 'os_truss', 'os_frame_module', 'os_coolant_pipe',
      'os_pipe_junction', 'os_console_corner', 'os_terminal', 'os_canister_rack', 'os_floor_cables', 'os_wall_column', 'os_wall_panel',
      // From the Modular SciFi MegaKit and the Space Station Kit, already in the game.
      'sf_computer', 'sf_wall_astra_window', 'sf_glass_floor', 'sf_round_platform', 'sf_crate_large', 'sf_fan', 'sf_light_wide', 'holo_table', 'computer_bank', 'container_tall', 'space_bed', 'space_chair',
    ),
    materials: ['core.orbital_panel', 'core.glow_trim'],
    facades: ['hull'],
    gameplay: ['block:field', 'zone:lowgrav', 'door', 'door_locked', 'button', 'mover:lift', 'pad', 'light:strip'],
    gameplayNotes: {
      'block:field': 'Force field: stops players and vehicles, lets shots through; logic switches it (seal the hangar, drop the enemy shield)',
      'zone:lowgrav': 'Low gravity inside: higher jumps, slow falls, longer pad flights (the reactor core, an airlock open to space)',
      door: 'Auto door: slides open as anyone (or one team) comes close',
      door_locked: 'Airlock door: logic cycles it (open the inner door, close the outer)',
      button: 'Console: switch fields, cycle airlocks',
      'mover:lift': 'Cargo lift between decks',
      pad: 'Grav lift: a jump pad up a shaft',
      'light:strip': 'Strip lights along corridors and gantries',
    },
    mounts: ['sentry', 'turret_rocket', 'skyfighter', 'dropship'],
    pickups: ['core.weapon_plasma', 'core.weapon_railgun', 'core.weapon_burst_rifle', 'core.weapon_launcher', 'core.weapon_smg', 'core.ammo_cells', 'core.grenades', 'core.armor_small', 'core.armor_large', 'core.health_small', 'core.health_large'],
    demo: 'halcyon_station',
  },
  {
    id: 'neon',
    number: '07',
    displayName: 'Neon Megacity',
    style: 'Futuristic city',
    blurb: 'Wet asphalt streets and alleys between glass towers, neon trim, holographic billboards, signage and an elevated skytrain. Elevators up the towers, rooftop traversal and transit.',
    themes: ['core.neon_megacity'],
    tiles: [
      'neon.tower_a', 'neon.tower_b', 'neon.tower_c', 'neon.tower_e', 'neon.shop_a', 'neon.block_n',
      'city.street', 'city.crossroads', 'core.yard', 'core.room', 'core.room_tall', 'core.stairwell', 'core.platform', 'core.platform_rail', 'core.bridge', 'core.terrace',
    ],
    props: props(
      'nc_streetlight', 'nc_streetlight_double', 'nc_traffic_light', 'nc_traffic_light_hanging', 'nc_highway_sign', 'nc_street_sign', 'nc_dumpster', 'nc_road_barrier',
      'nc_cone', 'nc_neon_barrier', 'nc_elevated_pillar', 'nc_power_pole', 'nc_monorail_track', 'nc_monorail_pylon', 'nc_skytrain_car', 'nc_skytrain_front',
      'nc_skytrain_end', 'nc_vending', 'nc_holo_kiosk', 'nc_food_stall', 'nc_ac_unit', 'nc_water_tank', 'nc_antenna',
      // Already in the game.
      'container', 'barrier_high',
    ),
    materials: ['core.pbr_wet_asphalt', 'core.neon_tube'],
    facades: ['neon', 'glass'],
    gameplay: ['mover:elevator', 'mover:tram', 'mover:lift', 'light:sign', 'light:billboard', 'pad', 'ladder', 'door'],
    gameplayNotes: {
      'mover:elevator': 'Tower elevator: a cab riding three storeys up the side of a tower',
      'mover:tram': 'Sky tram: a car shuttling between rooftops (ride it)',
      'mover:lift': 'Service lift up one storey',
      'light:sign': 'Neon sign: lit words; logic switches, recolours and blinks it',
      'light:billboard': 'Holographic billboard: a glowing screen; logic-controlled like any light',
      pad: 'Rooftop launcher: jump pads between roofs',
      ladder: 'Fire escapes up to the roofs',
      door: 'Auto door: shop and lobby doors',
    },
    mounts: ['hover_bike', 'speeder', 'gunship', 'sentry'],
    pickups: ['core.weapon_smg', 'core.weapon_burst_rifle', 'core.weapon_lmg', 'core.weapon_shotgun', 'core.weapon_plasma', 'core.weapon_railgun', 'core.weapon_rockets', 'core.grenades', 'core.armor_small', 'core.armor_large', 'core.health_small', 'core.health_large'],
    demo: 'neon_spire',
  },
];

export const getStylePack = (id: string): StylePack | undefined => STYLE_PACKS.find((p) => p.id === id);

/** Whether a MapMaker palette tool (`tile:…`, `prop:…`, `scenario:…`, `mount:…`, `pickup:…`) belongs to a pack. */
export function stylePackHas(pack: StylePack, tool: string): boolean {
  const i = tool.indexOf(':');
  const kind = tool.slice(0, i);
  const id = tool.slice(i + 1);
  switch (kind) {
    case 'tile':
      return pack.tiles.includes(id);
    case 'prop':
      return pack.props.includes(id);
    case 'scenario':
      return (pack.gameplay as readonly string[]).includes(id);
    case 'mount':
      return (pack.mounts as readonly string[]).includes(id);
    case 'pickup':
      return pack.pickups.includes(id);
    default:
      // Walls and openings, spawns, NPCs, terrain brushes, plants and the road go with every pack.
      return true;
  }
}
