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
      // loafbrr's Mines and Caves set (CC0).
      'mc_cart', 'mc_cart_empty', 'mc_cart_tipper', 'mc_rail', 'mc_rail_curve', 'mc_rail_end', 'mc_ladder', 'mc_support_frame', 'mc_support_post', 'mc_beam',
      'mc_mine_wall', 'mc_mine_entrance', 'mc_mine_tunnel', 'mc_cave_wall', 'mc_cave_entrance', 'mc_cave_rock_wall', 'mc_cave_rocks_a', 'mc_cave_rocks_b',
      'mc_cave_rocks_c', 'mc_cave_rocks_d', 'mc_cave_pillar', 'mc_cave_pillar_wide', 'mc_cave_ledge', 'mc_mound', 'mc_plank_wall', 'mc_plank_entrance',
    ),
    materials: ['core.pbr_weathered_planks', 'core.pbr_weathered_siding', 'core.pbr_adobe', 'core.pbr_dusty_road'],
    facades: ['false_front', 'adobe'],
    gameplay: ['door:saloon', 'door:vault', 'mover:train', 'mover:minecart', 'block:planks', 'boards', 'crate', 'barrel', 'button', 'ladder', 'light:bulb', 'light:wall'],
    mounts: ['turret_mg'],
    pickups: ['core.dynamite', 'core.weapon_hand_cannon', 'core.weapon_sawed_off', 'core.weapon_marksman', 'core.weapon_shotgun', 'core.weapon_rifle', 'core.health_small', 'core.health_large', 'core.armor_small'],
    demo: 'dustwater',
  },
  {
    id: 'imperial',
    number: '03',
    displayName: 'Imperial Arena',
    style: 'Roman',
    blurb: 'Arena walls and tiered seating, the emperor\'s box, outer arcades, columns, arches, a forum, a temple and an aqueduct; the hypogeum under the sand. Portcullis gates, lift cages rising through the arena floor, spike traps and portals.',
    themes: ['core.imperial', 'core.temple', 'core.desert'],
    tiles: [
      'imperial.seating', 'imperial.seating_corner', 'imperial.gate', 'imperial.emperor_box', 'imperial.arena_hatch',
      'imperial.arcade', 'imperial.arcade_stair', 'imperial.colonnade', 'imperial.triumphal_arch', 'imperial.aqueduct', 'imperial.forum', 'imperial.temple',
      'imperial.tunnel', 'imperial.hypogeum', 'imperial.hypogeum_lift',
      'core.yard', 'core.corridor_clear', 'core.corner', 'core.junction_t', 'core.stairwell', 'core.plaza',
    ],
    props: props(
      'im_column_ionic', 'im_brazier', 'im_statue_emperor', 'im_amphorae', 'im_weapon_rack', 'im_training_post', 'im_aquila', 'im_vexillum', 'im_chariot',
      'im_lift_cage', 'im_stakes', 'im_altar', 'im_bench', 'im_fountain', 'im_velarium', 'im_bust', 'im_throne',
      // Quaternius Ultimate Modular Ruins, already in the game.
      'rn_column_round', 'rn_column_square', 'rn_column_broken', 'rn_arch_round', 'rn_wall', 'rn_wall_broken', 'rn_wall_half', 'rn_stairs', 'rn_urn', 'rn_urn_broken', 'rn_cart', 'rn_buttress',
    ),
    materials: ['core.pbr_limestone', 'core.pbr_white_marble', 'core.pbr_opus_incertum', 'core.mosaic', 'core.gold_leaf'],
    facades: ['roman'],
    gameplay: ['door:portcullis', 'mover:portcullis', 'mover:cage', 'trap:spikes', 'block:trapdoor', 'portal', 'button', 'light:brazier', 'trap:flames', 'mover:lift', 'ladder'],
    gameplayNotes: {
      'door:portcullis': 'Portcullis: an iron grille in a 3 m gateway that winds up (E at the gate, or a button and a rule)',
      'mover:portcullis': 'Portcullis gate: a grille block that a rule raises (Send mover) for the gladiators to come out',
      'mover:cage': 'Lift cage: rises from the hypogeum through an Arena Hatch, its sand-covered roof closing the hole while it is down; bots ride it',
      'trap:spikes': 'Spike traps in the sand: cycling, or sprung from logic',
      'block:trapdoor': 'A trapdoor in the arena floor that drops into the hypogeum when logic says (a beast cage coming up)',
      portal: 'Portal pair: a shortcut from the hypogeum to the outer arcades (logic can shut it)',
      button: 'Gate winch: raise the portcullis, send the cage up, open the trapdoors',
      'light:brazier': 'Braziers round the sand and in the tunnels',
      'trap:flames': 'Fire jets along the arena wall',
      'mover:lift': 'A plain lift platform',
      ladder: 'Ladders up the arena wall',
    },
    mounts: [],
    pickups: ['core.weapon_spear', 'core.weapon_arena_disc', 'core.weapon_shotgun', 'core.weapon_flamethrower', 'core.weapon_marksman', 'core.weapon_hand_cannon', 'core.weapon_gilded_pistol', 'core.grenades', 'core.armor_small', 'core.armor_large', 'core.health_small', 'core.health_large'],
    demo: 'sandfall_colosseum',
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
    id: 'gothic',
    number: '05',
    displayName: 'Gothic Estate',
    style: 'Victorian horror',
    blurb: 'A manor of dark panelling and damask, a galleried library, a crypt, a cemetery with its mausoleum, hedge mazes and iron railings. Secret bookcases, moving shelves, rotten floors and candles that gutter on cue.',
    themes: ['core.gothic_estate', 'core.manor', 'core.castle'],
    tiles: [
      'gothic.library', 'gothic.crypt', 'gothic.mausoleum', 'gothic.cemetery', 'gothic.hedge_maze', 'gothic.hedge_garden', 'gothic.iron_fence', 'gothic.iron_gate',
      'core.room', 'core.room_long', 'core.room_large', 'core.hall', 'core.room_tall', 'core.stairwell', 'core.corridor_clear', 'core.corridor_windows', 'core.balcony', 'core.yard', 'core.terrace',
    ],
    props: props(
      'ge_bookcase_tall', 'ge_chandelier', 'ge_candelabra', 'ge_grandfather_clock', 'ge_wingback_chair', 'ge_grand_piano', 'ge_portrait', 'ge_suit_of_armour', 'ge_four_poster_bed', 'ge_writing_desk',
      'ge_sarcophagus', 'ge_angel_statue', 'ge_headstone_tall', 'ge_iron_fence', 'ge_iron_gate', 'ge_hedge_wall', 'ge_hedge_arch', 'ge_topiary', 'ge_gas_lamp',
      // Already in the game: graveyard, house interior, ruins and dungeon pieces.
      'gravestone_cross', 'gravestone_round', 'gravestone_broken', 'grave', 'coffin', 'coffin_old', 'crypt', 'iron_fence', 'iron_fence_damaged', 'lightpost', 'lantern', 'candles', 'urn', 'pumpkin',
      'rn_candles', 'rn_arch_gothic', 'rn_door_gothic', 'rn_dead_tree', 'nt_dead_tree', 'hm_fireplace', 'hm_chandelier', 'hm_bed_king', 'hm_dresser', 'hm_armchair', 'hedge', 'hedge_large', 'hedge_gate', 'fountain', 'dg_skull',
    ),
    materials: ['core.wallpaper_damask', 'core.pbr_slate_roof', 'core.pbr_mossy_cobble'],
    facades: ['gothic_stone', 'manor_brick'],
    gameplay: ['mover:bookcase', 'mover:shelf', 'block:rotten', 'light:candle', 'light:chandelier', 'block:trapdoor', 'door_locked', 'button', 'zone', 'trap:crusher', 'trap:spikes', 'wall', 'glass', 'ladder'],
    gameplayNotes: {
      'mover:bookcase': 'Secret door: a bookcase filling a doorway that slides aside when logic sends it (a hidden lever, a candle to pull); send it again to close it',
      'mover:shelf': 'Moving bookshelf: a bookcase trundling back and forth along a wall (cover that moves)',
      'block:rotten': 'Rotten floorboards: give way under you a moment after you step on them (into the cellar below), back after 15 s',
      'light:candle': 'Candelabra: candles that flicker; logic "Blink light" makes them gutter and flare, "Light off" snuffs them',
      'light:chandelier': 'Chandelier: a ring of candles hanging from the ceiling, flickering; logic gutters or snuffs it',
      'block:trapdoor': 'Trapdoor: drops away under you (or only when logic says) into the crypt',
      door_locked: 'Iron door or crypt gate: logic unlocks it',
      button: 'Hidden lever: pull it to open the secret bookcase',
      zone: 'Trigger zone: step into the library and the candles gutter',
      'trap:crusher': 'Falling chandelier or ceiling press, from logic',
      'trap:spikes': 'Spike floor in the crypt',
      wall: 'Breakable wall: a cracked panel hiding a passage',
      glass: 'Window pane: every pane in the manor breaks',
      ladder: 'Ladder up to the attic or down to the cellar',
    },
    mounts: [],
    pickups: ['core.weapon_shotgun', 'core.weapon_sawed_off', 'core.weapon_hand_cannon', 'core.weapon_marksman', 'core.weapon_rifle', 'core.grenades', 'core.health_small', 'core.health_large', 'core.armor_small', 'core.armor_large'],
    demo: 'ravenscroft_hall',
  },
  {
    id: 'jungle',
    number: '06',
    displayName: 'Jungle Ruins',
    style: 'Lost civilisation',
    blurb: 'A stepped temple with its shrine, temple gates and walls, cliffs, caves, a waterfall over a hidden recess, rivers and giant trees. Rope bridges with rotten planks, climbing vines and falling rocks.',
    themes: ['core.jungle_temple', 'core.ruins', 'core.forest'],
    tiles: [
      'jungle.ziggurat', 'jungle.temple_gate', 'jungle.temple_wall', 'jungle.cliff', 'jungle.cliff_corner', 'jungle.cliff_ramp', 'jungle.cave', 'jungle.cave_mouth', 'jungle.waterfall_basin', 'jungle.river', 'jungle.giant_tree', 'jungle.ruined_court',
      'core.yard', 'core.yard_ruins', 'core.room_columns', 'core.room_dais', 'core.bridge', 'core.platform', 'core.platform_rail', 'core.ramp',
    ],
    props: props(
      'jg_stone_idol', 'jg_serpent_statue', 'jg_carved_pillar', 'jg_altar_stone', 'jg_stele', 'jg_vine_curtain', 'jg_liana', 'jg_bridge_post', 'jg_waterfall', 'jg_giant_root', 'jg_banana_plant',
      'jg_giant_fern', 'jg_monstera', 'jg_bamboo', 'jg_brazier', 'jg_rubble_blocks', 'jg_gold_idol',
      // Already in the game: ruins, rocks, jungle plants and an expedition camp.
      'rn_column_round', 'rn_column_broken', 'rn_wall_arch_ivy', 'rn_wall_broken', 'rn_stairs', 'rn_urn', 'rn_urn_broken', 'hanging_moss', 'fern', 'bush_leafy', 'lily', 'mushrooms',
      'palm', 'palm_bent', 'nt_palm_curved', 'nt_palm_tall', 'nt_boulder_moss', 'nt_rock_moss', 'nt_log_moss', 'nt_stump_moss', 'cliff', 'cliff_corner', 'cliff_steps',
      'sv_tent', 'sv_backpack', 'sv_radio', 'campfire', 'dg_skull', 'dg_coin_pile',
    ),
    materials: ['core.pbr_jungle_rock', 'core.pbr_mossy_cobble'],
    facades: ['temple', 'overgrown'],
    gameplay: ['block:rope_bridge', 'block:old_planks', 'ladder:vines', 'trap:rockfall', 'trap:spikes', 'trap:flames', 'water:water', 'water:swamp', 'zone', 'button', 'mover:drawbridge', 'mover:lift', 'pad'],
    gameplayNotes: {
      'block:rope_bridge': 'Rope bridge: eight sagging planks over 12 m between two anchors; the middle two give way under you',
      'block:old_planks': 'Crumbling planks: a rotten plank that gives way a moment after you step on it (patch bridges and ledges with it)',
      'ladder:vines': 'Climbing vines: a ladder up a cliff or temple wall, drawn as hanging vines',
      'trap:rockfall': 'Falling rocks: boulders lodged overhead drop on whoever steps under them (or when a trigger zone tells them to)',
      'trap:spikes': 'Spike pit in a temple corridor',
      'trap:flames': 'Fire-spitting serpent head',
      'water:water': 'River and waterfall pools: swim them',
      'water:swamp': 'Swamp: wade slowly through the mud',
      zone: 'Trigger zone: set off falling rocks, open a gate',
      button: 'Carved lever: raise a bridge, open a temple door',
      'mover:drawbridge': 'Stone or timber drawbridge over a chasm',
      'mover:lift': 'Rope lift up a cliff',
      pad: 'Jump pad: a vine swing across a gap',
    },
    mounts: ['buggy', 'gun_jeep'],
    pickups: ['core.weapon_rifle', 'core.weapon_marksman', 'core.weapon_smg', 'core.weapon_shotgun', 'core.weapon_launcher', 'core.dynamite', 'core.grenades', 'core.health_small', 'core.health_large', 'core.armor_small', 'core.armor_large'],
    demo: 'verdant_ziggurat',
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
  {
    id: 'suburban',
    number: '08',
    displayName: 'Suburban Chaos',
    style: 'Everyday modern',
    blurb: 'Clapboard houses under slate gables, garages, a corner store and a gas station, a swimming pool, a playground, streets and back yards. Up-and-over garage doors, breakable fences and appliances that go off with a bang.',
    themes: ['core.suburban', 'core.garden', 'core.city'],
    tiles: [
      'suburban.house', 'suburban.garage', 'suburban.pool', 'suburban.playground', 'suburban.store', 'suburban.gas_station', 'suburban.street', 'suburban.backyard',
      'core.house', 'core.shop', 'core.gas_station', 'core.street', 'core.intersection', 'core.room', 'core.room_long', 'core.stairwell', 'core.yard',
    ],
    props: props(
      'sb_microwave', 'sb_fridge', 'sb_bbq_grill', 'sb_propane_tank', 'sb_washing_machine', 'sb_tv_flat', 'sb_mailbox', 'sb_wheelie_bin', 'sb_lawnmower', 'sb_garden_gnome',
      'sb_picket_fence', 'sb_swing_set', 'sb_slide', 'sb_trampoline', 'sb_basketball_hoop', 'sb_gas_pump', 'sb_sedan', 'sb_patio_set', 'sb_sun_lounger', 'sb_fire_hydrant',
      // Already in the game: furniture, shop fittings, garden and street pieces.
      'hm_couch', 'hm_armchair', 'hm_kitchen_counter', 'hm_oven', 'hm_bed_king', 'hm_bathtub', 'hm_toilet', 'hm_houseplant_tall', 'tv', 'washer', 'sv_propane',
      'shelf_boxes', 'checkout', 'freezer', 'shopping_cart', 'cardboard_box', 'trashcan', 'dumpster', 'cone', 'parasol', 'bush', 'hedge', 'tree_round', 'potted_plant',
    ),
    materials: ['core.pbr_clapboard', 'core.pbr_slate_roof', 'core.pbr_pool_tiles'],
    facades: ['clapboard', 'suburban_brick'],
    gameplay: ['mover:garage_door', 'block:fence', 'block:roof', 'water:pool', 'glass', 'gas', 'barrel', 'crate', 'door', 'button', 'pad', 'light:ceiling', 'light:wall'],
    gameplayNotes: {
      'mover:garage_door': 'Garage door: an up-and-over door that swings up level under the ceiling when logic sends it (a button in the house, a remote by the drive)',
      'block:fence': 'Breakable fence: a white picket fence that splinters when shot or blown up, back after 25 s',
      'block:roof': 'Pitched roof: two slate slabs making a gable over a cell (houses, garages, sheds); stand on it if you can get up there',
      'water:pool': 'Pool water: fills a Swimming Pool tile (5 × 12 m, 1.75 m deep)',
      glass: 'Window pane: patio doors and windows that shatter',
      gas: 'Gas cylinder: the barbecue bottle',
      barrel: 'Explosive barrel: fuel drums at the gas station',
      crate: 'Crate: moving boxes',
      door: 'Front door that opens as you come close',
      button: 'Garage door button',
      pad: 'Trampoline: a jump pad onto the roofs',
      'light:ceiling': 'Ceiling light: rooms, the store, the gas station canopy',
      'light:wall': 'Porch lamp',
    },
    mounts: ['ice_cream_truck', 'kart', 'buggy'],
    pickups: ['core.weapon_smg', 'core.weapon_shotgun', 'core.weapon_rifle', 'core.weapon_burst_rifle', 'core.weapon_launcher', 'core.grenades', 'core.health_small', 'core.health_large', 'core.armor_small', 'core.armor_large'],
    demo: 'cedar_lane',
  },
  {
    id: 'egypt',
    number: '09',
    displayName: 'Sands of Egypt',
    style: 'Ancient Egypt',
    blurb: 'Sandstone pylons, hypostyle halls of painted columns, sanctuaries, a step pyramid, tombs with painted corridors and burial chambers, sphinx avenues, a Nile quay and village; obelisks, sphinxes and colossi. Tomb traps, crumbling floors, portals and boats on the river.',
    themes: ['core.egypt', 'core.tomb', 'core.imperial'],
    tiles: [
      'egypt.pylon', 'egypt.hypostyle', 'egypt.sanctuary', 'egypt.pyramid', 'egypt.tomb_entrance', 'egypt.tomb_corridor', 'egypt.tomb_chamber',
      'egypt.quay', 'egypt.river', 'egypt.avenue', 'egypt.house',
      'imperial.colonnade', 'imperial.tunnel', 'core.yard', 'core.corridor_clear', 'core.corner', 'core.junction_t', 'core.stairwell',
    ],
    props: props(
      'eg_obelisk', 'eg_sphinx', 'eg_statue_pharaoh', 'eg_anubis', 'eg_sarcophagus', 'eg_canopic_jars', 'eg_column_papyrus', 'eg_felucca', 'eg_reed_boat',
      'eg_palm', 'eg_papyrus', 'eg_torch', 'eg_chest', 'eg_stele', 'eg_cat_statue',
      // Shared with 03 Imperial Arena and the game's ruins.
      'im_amphorae', 'im_brazier', 'im_altar', 'rn_column_broken', 'rn_urn', 'rn_urn_broken', 'cactus', 'nt_cactus_round', 'dg_coin_pile', 'dg_coin_bag',
    ),
    materials: ['core.pbr_sandstone_blocks', 'core.pbr_rough_sandstone', 'core.hieroglyphs', 'core.hieroglyphs_painted', 'core.lapis', 'core.gold_leaf'],
    facades: ['egyptian'],
    gameplay: ['portal', 'trap:spikes', 'trap:crusher', 'trap:flames', 'block:crumble', 'block:trapdoor', 'mover:slider', 'water:water', 'button', 'light:brazier', 'zone', 'ladder'],
    gameplayNotes: {
      portal: 'Portal pair: a shortcut out of the tomb, or across the river (logic can shut it)',
      'trap:spikes': 'Spike pits along the tomb corridors',
      'trap:crusher': 'Falling ceiling blocks in the tomb',
      'trap:flames': 'Fire jets from the painted walls',
      'block:crumble': 'A floor that gives way under you into the pit below',
      'block:trapdoor': 'A floor slab that drops when logic springs the trap (a zone at the sarcophagus)',
      'mover:slider': 'A sliding stone door that seals the tomb (Send mover)',
      'water:water': 'The Nile: swim it, or ride a boat across',
      button: 'A hidden lever: open the sealed door, spring the traps',
      'light:brazier': 'Fire stands and braziers in the temple and tomb',
      zone: 'Trigger zones: step on the wrong slab and the traps go off',
      ladder: 'Ladders onto the temple roofs',
    },
    mounts: [],
    pickups: ['core.weapon_gilded_pistol', 'core.weapon_sniper', 'core.weapon_burst_rifle', 'core.weapon_flamethrower', 'core.weapon_spear', 'core.weapon_singularity', 'core.weapon_launcher', 'core.grenades', 'core.armor_small', 'core.armor_large', 'core.health_small', 'core.health_large'],
    demo: 'pharaohs_reach',
  },
  {
    id: 'medieval',
    number: '10',
    displayName: 'Medieval Village',
    style: 'Medieval town',
    blurb: 'Half-timbered houses and shops under red tile roofs you can run along, a cobbled market square and hall, the town wall and gate, a bell tower and a watchtower, a stone bridge over the stream, timber walkways and outside stairs. Oak doors, portcullis gates, breakable wattle and planks, a drawbridge.',
    themes: ['core.medieval', 'core.castle', 'core.garden'],
    tiles: [
      'medieval.house', 'medieval.house_shop', 'medieval.house_balcony', 'medieval.outside_stair', 'medieval.walkway',
      'medieval.market_square', 'medieval.market_hall', 'medieval.town_wall', 'medieval.wall_stair', 'medieval.town_gate',
      'medieval.bell_tower', 'medieval.watchtower', 'medieval.stream', 'medieval.bridge', 'medieval.road', 'medieval.forge',
      'core.yard', 'core.plaza', 'core.room', 'core.room_long', 'core.stairwell',
    ],
    props: props(
      'mv_well', 'mv_awning', 'mv_pavilion', 'mv_shop_sign', 'mv_hay_cart', 'mv_forge', 'mv_workbench', 'mv_planter', 'mv_tarp_crates', 'mv_tarp_tent',
      'mv_chimney', 'mv_wattle_fence', 'mv_spiked_fence', 'mv_bell', 'mv_market_cross', 'mv_stocks', 'mv_timber_post', 'mv_sacks', 'mv_bay_window', 'mv_shutters',
      // Already in the game: castle and siege pieces, the market, carts and barrels, banners, lanterns, fences and trees.
      'castle_gate', 'castle_tower', 'castle_tower_round', 'castle_wall', 'castle_wall_door', 'castle_wall_corner', 'castle_stairs', 'siege_tower', 'portcullis',
      'stall', 'stall_green', 'stall_bench', 'cart', 'cart_high', 'hay_bale', 'anvil', 'barrel', 'barrel_open', 'crate_small', 'crate_large', 'woodpile', 'log_stack', 'bucket',
      'fountain', 'fountain_square', 'lantern', 'lantern_post', 'banner', 'banner_red', 'banner_green', 'banner_long', 'pennant', 'signpost', 'awning', 'water_wheel',
      'lf_wooden_fence_closed', 'lf_wooden_fence_open', 'lf_drystone_wall', 'nt_common_tree', 'nt_common_tree_2', 'bench', 'sv_tent', 'dg_woodfire',
    ),
    materials: ['core.cobblestones', 'core.road_setts', 'core.market_tiles', 'core.roof_tiles_red', 'core.timber_frame', 'core.wattle', 'core.packed_dirt', 'core.whitewash', 'core.oak_beam'],
    facades: ['timber_frame', 'village_plaster'],
    gameplay: ['door:oak', 'door:portcullis', 'mover:portcullis', 'mover:drawbridge', 'block:wattle', 'block:planks', 'block:old_planks', 'boards', 'crate', 'barrel', 'button', 'ladder', 'light:brazier', 'light:wall', 'light:candle', 'water:water', 'zone', 'glass'],
    gameplayNotes: {
      'door:oak': 'Oak door: an iron-bound plank door that swings open as anyone comes close (lock it for logic)',
      'door:portcullis': 'Portcullis: the iron grille in the Town Gate passage (E at the gate, or a button and a rule)',
      'mover:portcullis': 'Portcullis gate: a grille block that a rule raises (Send mover)',
      'mover:drawbridge': 'Drawbridge over the stream or a moat',
      'block:wattle': 'Wattle hurdle: a woven fence that breaks when shot or blown up, back after 25 s',
      'block:planks': 'Breakable planks: board up a window or a shop front',
      'block:old_planks': 'Crumbling planks: a rotten walkway board that gives way under you',
      boards: 'Board barricade across a doorway',
      ladder: 'Ladder: up through the Town Gate roof hatch, onto a roof or a wall-walk',
      'light:brazier': 'Brazier: fire on the wall-walk and in the forge',
      'light:wall': 'Lantern by a door',
      'light:candle': 'Candles in the houses and the market hall',
      'water:water': 'The stream (fill the Stream and Stone Bridge tiles, 0.8 m deep: wade it)',
      zone: 'Trigger zone: ring the bell, raise the gate',
      glass: 'Window pane: leaded glass that shatters',
    },
    mounts: [],
    pickups: ['core.weapon_battle_axe', 'core.weapon_spear', 'core.weapon_marksman', 'core.weapon_sniper', 'core.weapon_shotgun', 'core.weapon_sawed_off', 'core.weapon_hand_cannon', 'core.weapon_rifle', 'core.weapon_smg', 'core.incendiaries', 'core.grenades', 'core.sheep', 'core.armor_small', 'core.armor_large', 'core.health_small', 'core.health_large'],
    demo: 'market_town',
  },
  {
    id: 'harbor',
    number: '11',
    displayName: 'Coastal Harbor',
    style: 'Working fishing harbour',
    blurb: "Timber piers and boardwalks on piles (swim under them), granite quays with bollards, sea wall steps, a slipway and a shingle beach out of the water, a breakwater; a warehouse, a net shed, the harbourmaster's office and a fish market to fight through; a lighthouse gallery and a dockside crane to snipe from. Harbour water to swim, boats to cross it, ladders up the quay.",
    themes: ['core.coastal', 'core.harbour', 'core.city'],
    tiles: [
      'harbor.pier', 'harbor.pier_head', 'harbor.boardwalk', 'harbor.boardwalk_turn', 'harbor.quay', 'harbor.quay_corner', 'harbor.quay_inner', 'harbor.quay_steps',
      'harbor.slipway', 'harbor.beach', 'harbor.basin', 'harbor.breakwater', 'harbor.warehouse', 'harbor.office', 'harbor.net_shed', 'harbor.fish_market',
      'harbor.lighthouse', 'harbor.crane', 'harbor.arch', 'harbor.quayside',
      'medieval.outside_stair', 'medieval.walkway', 'core.yard', 'core.plaza', 'core.room', 'core.room_long', 'core.stairwell',
    ],
    props: props(
      'hb_bollard', 'hb_capstan', 'hb_lobster_pots', 'hb_buoy', 'hb_marker_buoy', 'hb_net_rack', 'hb_fish_stall', 'hb_fish_crates', 'hb_fishing_boat',
      'hb_anchor', 'hb_rope_coil', 'hb_lamp_post', 'hb_life_ring', 'hb_net_pile', 'hb_gull', 'hb_tide_board', 'hb_dolphin', 'hb_fenders',
      // Already in the game: boats and masts, cargo and crates, barrels, the gantry crane, lamps and rocks.
      'rowboat', 'eg_felucca', 'mast', 'flag', 'cargo_gantry_crane', 'cargo_container_rusty_blue', 'cargo_container_rusty_red', 'cargo_container_old_rusty', 'cargo_ibc_tank',
      'cargo_wooden_crate', 'cargo_crate_stack', 'cargo_crate', 'crate_small', 'crate_large', 'pallet', 'barrel', 'barrel_open', 'street_barrel', 'street_rusty_barrel', 'fuel_drum',
      'mv_sacks', 'mv_tarp_crates', 'planks_stack', 'woodpile', 'lantern', 'lantern_post', 'lightpost', 'yard_lamp', 'bench',
      'rock_large', 'rock_medium', 'rock_pile', 'boulder_jagged', 'boulder_flat', 'cliff', 'cliff_steps',
    ),
    materials: ['core.pier_decking', 'core.quay_granite', 'core.harbour_setts', 'core.shingle', 'core.sea_bed', 'core.rusty_corrugated', 'core.blue_corrugated', 'core.tarred_boards', 'core.harbour_render', 'core.lighthouse_bands', 'core.harbour_paint', 'core.lamp_glow'],
    facades: ['harbour_render', 'tarred_timber'],
    gameplay: ['water:harbour', 'water:water', 'ladder', 'mover:drawbridge', 'mover:lift', 'mover:slider', 'door', 'door:saloon', 'crate', 'barrel', 'block:planks', 'block:old_planks', 'block:rotten', 'boards', 'button', 'light:wall', 'light:bulb', 'zone', 'glass'],
    gameplayNotes: {
      'water:harbour': 'Harbour water: put it on the harbour bed (4 m down) and its surface sits 1.5 m under the quay, deep enough to swim; boats float on it',
      ladder: 'Ladder: out of the water up a Quay Wall (between its fenders), up the Harbour Crane through its hatch, onto a roof',
      'mover:drawbridge': 'A lifting bridge over the harbour mouth or a channel',
      'mover:lift': 'A goods hoist up the warehouse face',
      'block:old_planks': 'Rotten pier boards that give way under you (into the water)',
      'block:rotten': 'A rotten boardwalk plank',
      'light:wall': 'A lamp on the warehouse wall or the quay',
      zone: 'Trigger zone: sound the foghorn, raise the bridge',
    },
    mounts: ['hover_bike', 'speeder'],
    pickups: ['core.weapon_rifle', 'core.weapon_smg', 'core.weapon_shotgun', 'core.weapon_marksman', 'core.weapon_sniper', 'core.weapon_lmg', 'core.weapon_flare_gun', 'core.weapon_hand_cannon', 'core.weapon_rockets', 'core.grenades', 'core.armor_small', 'core.armor_large', 'core.health_small', 'core.health_large'],
    demo: 'saltmarsh_harbor',
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
