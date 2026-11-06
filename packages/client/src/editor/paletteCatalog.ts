/**
 * How MapMaker's palette is organised: the colour-coded categories (one per
 * palette tab), the theme groups props are sorted into, and which picture
 * atlas each piece's preview lives in. Plain data, no Babylon, so the atlas
 * tool (tools/content/palette-items.ts) and the tests read the same rules.
 */
import { CORE_PROPS, MOUNT_DEFS, MOUNT_MODELS, builtInSetPieces, coreCatalog, envModelFile, type PropDefinition, type SetPieceDefinition } from '@tiletrigger/shared';

/** Palette categories: each tab has one, with one colour used on the tab, its headings and a thin accent on its pieces. */
export const PALETTE_CATEGORIES = {
  structure: { label: 'Structure', color: 'var(--cat-structure)' },
  props: { label: 'Props', color: 'var(--cat-props)' },
  nature: { label: 'Nature', color: 'var(--cat-nature)' },
  terrain: { label: 'Terrain', color: 'var(--cat-terrain)' },
  gameplay: { label: 'Gameplay', color: 'var(--cat-gameplay)' },
  npcs: { label: 'NPCs', color: 'var(--cat-npcs)' },
  vehicles: { label: 'Vehicles & Turrets', color: 'var(--cat-vehicles)' },
  objects: { label: 'Objects & Logic', color: 'var(--cat-objects)' },
  lights: { label: 'Lights & FX', color: 'var(--cat-lights)' },
  paint: { label: 'Paint', color: 'var(--cat-paint)' },
} as const;
export type PaletteCategory = keyof typeof PALETTE_CATEGORIES;

/** Palette pane (the `data-pane` of a tab) → its category. */
export const PANE_CATEGORY: Readonly<Record<string, PaletteCategory>> = {
  tiles: 'structure',
  setpieces: 'structure',
  advanced: 'structure',
  props: 'props',
  plants: 'nature',
  terrain: 'terrain',
  entities: 'gameplay',
  npcs: 'npcs',
  vehicles: 'vehicles',
  scenario: 'objects',
  lights: 'lights',
  paint: 'paint',
};

/**
 * Prop theme groups (sub-groups of the Props tab), each a list of the props'
 * own categories. Nature and parked vehicles have their own tabs.
 */
export const PROP_GROUPS = [
  { id: 'industrial', label: 'Industrial & Military', categories: ['Snow Outpost', 'Crates & Barrels', 'Industrial', 'Military', 'Survival', 'Trains & Rail', 'Fences & Walls'] },
  { id: 'everyday', label: 'Home & Town', categories: ['Furniture', 'Home', 'Household', 'Decor', 'Shop', 'Garage & Garden', 'Gas Station', 'Hospital', 'Metro', 'Suburban Chaos'] },
  { id: 'scifi', label: 'Sci-Fi', categories: ['Sci-Fi', 'Sci-Fi Base', 'Sci-Fi Platforms', 'Sci-Fi Walls', 'Sci-Fi Decals', 'Orbital Station', 'Neon Megacity'] },
  { id: 'medieval', label: 'Medieval & Gothic', categories: ['Medieval Village', 'Medieval', 'Castle & Siege', 'Town & Market', 'Pirate & Coast', 'Ruins', 'Gothic', 'Gothic Estate'] },
  { id: 'dungeon', label: 'Dungeons & Caves', categories: ['Dungeon', 'Dark Dungeon', 'Mines & Caves'] },
  { id: 'western', label: 'Wild West', categories: ['Wild West', 'Frontier'] },
  { id: 'ancient', label: 'Desert, Ancient & Jungle', categories: ['Desert City', 'Imperial Arena', 'Sands of Egypt', 'Jungle Ruins'] },
  { id: 'harbor', label: 'Coastal Harbor', categories: ['Coastal Harbor'] },
  { id: 'airport', label: 'Airport & Airliner', categories: ['Airliner Cabin'] },
] as const;
/** Prop categories shown in the Nature tab. */
export const NATURE_PROP_CATEGORIES: readonly string[] = ['Trees', 'Rocks & Wood', 'Plants & Flowers'];
/**
 * Retired from the palette, kept in the game (maps that place them still load and draw them): Kenney's grass, flowers,
 * fern, low plant, small bush and stones and the Meshy eelgrass, which the generated species replace (owner,
 * 2026-11-05: "lose Kenney grass"; then pebbles, eelgrass, and the fern and small bush once ours conceal the same way:
 * shared/test/conceal.test.ts). The plants brush grows the species now, and MapMaker's "Replace all" (the prop
 * inspector) swaps placed pieces. Their palette pictures stay in the atlas.
 */
export const RETIRED_PROPS: ReadonlySet<string> = new Set([
  'prop.grass_patch',
  'prop.grass_leafy',
  'prop.grass_tall',
  'prop.grass_tuft',
  'prop.flower_red',
  'prop.flower_yellow',
  'prop.flower_purple',
  'prop.plant_low',
  'prop.fern',
  'prop.bush_small',
  'prop.stones',
  'prop.mn_eelgrass',
]);
/** The generated species offered in Nature's prop categories in their place (pictured from their first variant, in the `environment` atlas), by category. */
export const GROUND_COVER_SPECIES: Readonly<Record<string, readonly string[]>> = {
  'Plants & Flowers': ['env.grass.clump', 'env.flower.meadow', 'env.fern.bracken', 'env.shrub.broadleaf', 'env.water.eelgrass'],
  'Rocks & Wood': ['env.rock.pebbles'],
};
/**
 * What "Replace all" (the prop inspector) offers first for a retired piece: the species (and variant) that took its
 * place in the plants brush. Any other prop or species can still be chosen.
 */
export const REPLACEMENTS: Readonly<Record<string, string>> = {
  'prop.grass_patch': 'env.grass.clump',
  'prop.grass_leafy': 'env.grass.clump',
  'prop.grass_tall': 'env.grass.clump',
  'prop.grass_tuft': 'env.grass.clump',
  'prop.flower_red': 'env.flower.meadow',
  'prop.flower_yellow': 'env.flower.meadow#1',
  'prop.flower_purple': 'env.flower.meadow#2',
  'prop.plant_low': 'env.fern.bracken',
  'prop.fern': 'env.fern.bracken',
  'prop.bush_small': 'env.shrub.broadleaf',
  'prop.stones': 'env.rock.pebbles',
  'prop.mn_eelgrass': 'env.water.eelgrass',
};
/** Every species GROUND_COVER_SPECIES offers. */
export const GROUND_COVER_IDS: readonly string[] = Object.values(GROUND_COVER_SPECIES).flat();
/** Prop categories shown in the Vehicles tab (parked, not drivable). */
export const VEHICLE_PROP_CATEGORIES: readonly string[] = ['Vehicles'];

/** The theme group a prop belongs to: a PROP_GROUPS id, 'nature' or 'vehicles' ('other' for a category no group lists yet). */
export function propGroup(def: Pick<PropDefinition, 'category'>): string {
  if (NATURE_PROP_CATEGORIES.includes(def.category)) return 'nature';
  if (VEHICLE_PROP_CATEGORIES.includes(def.category)) return 'vehicles';
  return PROP_GROUPS.find((g) => (g.categories as readonly string[]).includes(def.category))?.id ?? 'other';
}

/**
 * The atlas a piece's picture is in, by palette key (`tile:<id>`, `prop:<id>`,
 * `mount:<id>`): one per content source, so two branches adding different packs
 * write different atlas files. Tiles go by their Style Pack (`tiles-<prefix>`:
 * `tiles-core`, `tiles-desert`), props by the content pack they come from
 * (`props-<pack>`, content/props/<pack>.json: the tools pass it, the client
 * reads the atlas from thumbs/palette.json), vehicles and turrets share one,
 * and so do the generated species (`environment`).
 */
export function atlasGroup(key: string, propPack?: string): string {
  if (key.startsWith('tile:')) return `tiles-${key.slice(5).split('.')[0]}`;
  if (key.startsWith('prop:env.')) return 'environment';
  if (key.startsWith('mount:')) return 'vehicles';
  if (key.startsWith('setpiece:')) return 'setpieces';
  return propPack ? `props-${propPack}` : 'other';
}

/** Every shipped piece that has a model picture: tiles, props, the Nature tab's generated species, vehicles/turrets and set pieces, by palette key. */
export function pictureKeys(): { key: string; tile?: string; file?: string; setPiece?: string }[] {
  return [
    ...coreCatalog.all().map((d) => ({ key: `tile:${d.id}`, tile: d.id })),
    ...CORE_PROPS.map((p) => ({ key: `prop:${p.id}`, file: p.file })),
    ...GROUND_COVER_IDS.map((id) => ({ key: `prop:${id}`, file: envModelFile(id)! })),
    ...MOUNT_MODELS.map((m) => ({ key: `mount:${m}`, file: MOUNT_DEFS[m].model })),
    ...[...builtInSetPieces().pieces.keys()].map((id) => ({ key: `setpiece:${id}`, setPiece: id })),
  ];
}

/**
 * The Set pieces tab's groups: one per family (content/setpieces/<family>.json), in this order, then any family not
 * named here (title-cased), then the player's own pieces (`custom`: saved from a selection, in their library or the map).
 */
export const SET_PIECE_FAMILIES: readonly (readonly [family: string, label: string])[] = [
  ['carriageway', 'Carriageways'],
  ['skybridge', 'Skybridges'],
  ['casemate', 'Casemates'],
  ['trench', 'Trench runs'],
  ['cliffstair', 'Cliff stairs'],
  ['stairtower', 'Stair towers'],
  ['arena', 'Arena stands'],
  ['hypogeum', 'Hypogeum'],
  ['insula', 'Insulae'],
  ['landing', 'Landing craft'],
];

/** A family's label in the Set pieces tab. */
export function setPieceFamilyLabel(family: string): string {
  if (family === 'custom') return 'My set pieces';
  return SET_PIECE_FAMILIES.find(([f]) => f === family)?.[1] ?? family.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** The order of families in the Set pieces tab (named ones first, then the rest by name, the player's own last). */
export function setPieceFamilyOrder(family: string): number {
  const i = SET_PIECE_FAMILIES.findIndex(([f]) => f === family);
  return family === 'custom' ? 1e6 : i >= 0 ? i : 1e3;
}

/**
 * Whether a set piece goes with a Style Pack (the palette's pack picker): one of the role packs it suits is that Style
 * Pack's look (roles.json `stylePack`, or the same id). A piece that names no pack (the player's own) goes with every one.
 */
export function setPieceSuitsStylePack(def: Pick<SetPieceDefinition, 'packs'>, stylePack: string, packs: ReadonlyMap<string, { stylePack?: string }>): boolean {
  if (!def.packs.length) return true;
  return def.packs.some((id) => id === stylePack || packs.get(id)?.stylePack === stylePack);
}

/** The role pack that gives a Style Pack's look to set pieces (the palette's pack picker re-themes them with it), if any. */
export function stylePackRoles(stylePack: string, packs: ReadonlyMap<string, { id: string; stylePack?: string }>): string | null {
  for (const p of packs.values()) if (p.stylePack === stylePack) return p.id;
  return packs.has(stylePack) ? stylePack : null;
}

/** Scenario palette entries (Objects & Logic tab) by sub-group; game-mode objects, lights and NPC spawners have their own tabs. */
export function scenarioGroup(key: string): { pane: 'entities' | 'scenario' | 'lights' | 'npcs'; group: string } {
  if (['flag', 'hill', 'bombsite', 'hostage', 'rescue', 'airplane', 'airplane:dropship'].includes(key)) return { pane: 'entities', group: 'Game Modes & Objectives' };
  if (key.startsWith('light:')) return { pane: 'lights', group: 'Lights' };
  if (key.startsWith('encounter')) return { pane: 'npcs', group: 'Spawners' };
  if (key.startsWith('door') || key === 'mover:portcullis' || key === 'mover:garage_door' || key === 'mover:bookcase') return { pane: 'scenario', group: 'Doors & Gates' };
  if (key.startsWith('mover:')) return { pane: 'scenario', group: 'Lifts & Movers' };
  if (key === 'button' || key.startsWith('zone') || key === 'portal' || key === 'block:field') return { pane: 'scenario', group: 'Logic & Triggers' };
  if (key.startsWith('trap:')) return { pane: 'scenario', group: 'Traps & Hazards' };
  if (key.startsWith('water:')) return { pane: 'lights', group: 'Liquids' };
  if (key === 'pad' || key.startsWith('ladder') || key === 'zipline' || key === 'block:solid' || key === 'block:crumble' || key === 'block:trapdoor' || key === 'block:rope_bridge' || key === 'block:roof') return { pane: 'scenario', group: 'Platforms & Climbing' };
  return { pane: 'scenario', group: 'Destructibles' };
}
