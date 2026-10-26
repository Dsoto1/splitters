/**
 * MapMaker Style Packs (docs/ROADMAP_V1.md Sprint 7, Set 1 "Foundation"):
 * mix-and-match groups of tiles, room options, props and gameplay pieces in
 * one look, each with its own theme. MapMaker shows each pack as a group in
 * the palette's Style Packs tab; everything in a pack is ordinary kit (tiles
 * from the catalog, props from the prop catalog, scenario palette entries),
 * so pieces mix freely across packs.
 *
 * Packs are data only. Add a pack by appending to STYLE_PACKS.
 */
import type { ScenarioPaletteKey } from '../editor/operations.ts';
import type { Ceiling, Facade, RoomLayout } from './catalog.ts';

export interface StylePackGameplay {
  /** A scenario palette entry (door, force field, low-gravity zone, lift, sign…). */
  key: ScenarioPaletteKey;
  /** What it is for in this pack (MapMaker tooltip). */
  note: string;
}

export interface StylePack {
  /** Stable ID (`orbital`, `neon`). */
  id: string;
  /** Roadmap number ("04"). */
  number: string;
  name: string;
  /** The look in a few words. */
  style: string;
  blurb: string;
  /** The theme the pack's look comes from (map/materials.ts). */
  theme: string;
  /** Room options that dress rooms in the pack's look. */
  room: { facade: Facade; ceiling?: Ceiling; layout?: RoomLayout };
  /** Tile IDs, pack tiles first, then core tiles that suit it. */
  tiles: readonly string[];
  /** Prop IDs (without the `prop.` prefix), pack props first. */
  props: readonly string[];
  gameplay: readonly StylePackGameplay[];
  /** The demo map built with the pack (maps/<id>.json). */
  demo: string;
}

export const STYLE_PACKS: readonly StylePack[] = [
  {
    id: 'orbital',
    number: '04',
    name: 'Orbital Station',
    style: 'Clean sci-fi',
    blurb: 'White panel corridors, labs, a hangar bay, airlocks and control rooms with glowing trim, grated floors and viewports onto space. Force fields, low-gravity zones and auto doors.',
    theme: 'core.orbital',
    room: { facade: 'hull', ceiling: 'roof' },
    tiles: [
      'orbital.hangar',
      'orbital.reactor_hall',
      'core.corridor_clear',
      'core.corridor_windows',
      'core.corner',
      'core.junction_t',
      'core.junction_x',
      'core.corridor_curve',
      'core.room',
      'core.room_long',
      'core.room_large',
      'core.atrium',
      'core.stairwell',
      'core.catwalk',
      'core.bridge',
    ],
    props: [
      'os_airlock_frame',
      'os_bulkhead',
      'os_bulkhead_window',
      'os_laser_gate',
      'os_field_emitter',
      'os_viewport',
      'os_reactor_core',
      'os_cryo_pod',
      'os_holo_globe',
      'os_cargo_crate',
      'os_generator',
      'os_power_unit',
      'os_transmitter',
      'os_satellite_dish',
      'os_comms_dish',
      'os_truss',
      'os_frame_module',
      'os_coolant_pipe',
      'os_pipe_junction',
      'os_console_corner',
      'os_terminal',
      'os_canister_rack',
      'os_floor_cables',
      'os_wall_column',
      'os_wall_panel',
      // From the Modular SciFi MegaKit and the Space Station Kit, already in the game.
      'sf_computer',
      'sf_wall_astra_window',
      'sf_glass_floor',
      'sf_round_platform',
      'sf_crate_large',
      'sf_fan',
      'sf_light_wide',
      'holo_table',
      'computer_bank',
      'container_tall',
      'space_bed',
      'space_chair',
    ],
    gameplay: [
      { key: 'block:field', note: 'Force field: stops players and vehicles, lets shots through; logic switches it (seal the hangar, drop the enemy shield)' },
      { key: 'zone:lowgrav', note: 'Low gravity inside: higher jumps, slow falls, longer pad flights (the reactor core, an airlock open to space)' },
      { key: 'door', note: 'Auto door: slides open as anyone (or one team) comes close' },
      { key: 'door_locked', note: 'Airlock door: logic cycles it (open the inner door, close the outer)' },
      { key: 'button', note: 'Console: switch fields, cycle airlocks' },
      { key: 'mover:lift', note: 'Cargo lift between decks' },
      { key: 'pad', note: 'Grav lift: a jump pad up a shaft' },
      { key: 'light:strip', note: 'Strip lights along corridors and gantries' },
    ],
    demo: 'halcyon_station',
  },
  {
    id: 'neon',
    number: '07',
    name: 'Neon Megacity',
    style: 'Futuristic city',
    blurb: 'Wet asphalt streets and alleys between glass towers, neon trim, holographic billboards, signage and an elevated skytrain. Elevators up the towers, rooftop traversal and transit.',
    theme: 'core.neon_megacity',
    room: { facade: 'neon', ceiling: 'roof' },
    tiles: [
      'neon.tower_a',
      'neon.tower_b',
      'neon.tower_c',
      'neon.tower_e',
      'neon.shop_a',
      'neon.block_n',
      'city.street',
      'city.crossroads',
      'core.yard',
      'core.room',
      'core.room_tall',
      'core.stairwell',
      'core.platform',
      'core.platform_rail',
      'core.bridge',
      'core.terrace',
    ],
    props: [
      'nc_streetlight',
      'nc_streetlight_double',
      'nc_traffic_light',
      'nc_traffic_light_hanging',
      'nc_highway_sign',
      'nc_street_sign',
      'nc_dumpster',
      'nc_road_barrier',
      'nc_cone',
      'nc_neon_barrier',
      'nc_elevated_pillar',
      'nc_power_pole',
      'nc_monorail_track',
      'nc_monorail_pylon',
      'nc_skytrain_car',
      'nc_skytrain_front',
      'nc_skytrain_end',
      'nc_vending',
      'nc_holo_kiosk',
      'nc_food_stall',
      'nc_ac_unit',
      'nc_water_tank',
      'nc_antenna',
      // Already in the game.
      'container',
      'barrier_high',
    ],
    gameplay: [
      { key: 'mover:elevator', note: 'Tower elevator: a cab riding three storeys up the side of a tower' },
      { key: 'mover:tram', note: 'Sky tram: a car shuttling between rooftops (ride it)' },
      { key: 'mover:lift', note: 'Service lift up one storey' },
      { key: 'light:sign', note: 'Neon sign: lit words; logic switches, recolours and blinks it' },
      { key: 'light:billboard', note: 'Holographic billboard: a glowing screen; logic-controlled like any light' },
      { key: 'pad', note: 'Rooftop launcher: jump pads between roofs' },
      { key: 'ladder', note: 'Fire escapes up to the roofs' },
      { key: 'door', note: 'Auto door: shop and lobby doors' },
    ],
    demo: 'neon_spire',
  },
];

export const getStylePack = (id: string): StylePack | undefined => STYLE_PACKS.find((p) => p.id === id);
