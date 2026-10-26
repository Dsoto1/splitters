/**
 * MapMaker Style Packs (ROADMAP_V1 Sprint 7, Set 1 "Foundation"): a themed
 * selection of the building kit. Choosing a pack in the palette shows only its
 * tiles, props, gameplay pieces, vehicles and pickups, and offers its themes.
 * Packs only group content that exists anyway: everything in a pack can be
 * mixed with anything else (BUILDING_KIT.md, "Style Packs").
 */
import type { Facade } from '../map/catalog.ts';
import type { MountModel } from '../sim/mounts.ts';
import type { ScenarioPaletteKey } from './operations.ts';

export interface StylePack {
  id: string;
  /** Its number in the set ("01"). */
  number: string;
  displayName: string;
  /** One line: the look. */
  style: string;
  blurb: string;
  /** Themes (first = the pack's own), full IDs. */
  themes: readonly string[];
  /** Tile IDs. */
  tiles: readonly string[];
  /** Prop IDs (`prop.*`). */
  props: readonly string[];
  /** Library materials made for the pack (full IDs). */
  materials: readonly string[];
  facades: readonly Facade[];
  /** Scenario palette entries: the gameplay pieces. */
  gameplay: readonly ScenarioPaletteKey[];
  mounts: readonly MountModel[];
  /** Pickup item IDs. */
  pickups: readonly string[];
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
