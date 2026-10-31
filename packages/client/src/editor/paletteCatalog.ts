/**
 * How MapMaker's palette is organised: the colour-coded categories (one per
 * palette tab), the theme groups props are sorted into, and which picture
 * atlas each piece's preview lives in. Plain data, no Babylon, so the atlas
 * tool (tools/content/palette-items.ts) and the tests read the same rules.
 */
import { CORE_PROPS, MOUNT_DEFS, MOUNT_MODELS, coreCatalog, type PropDefinition } from '@tiletrigger/shared';

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
  { id: 'industrial', label: 'Industrial & Military', categories: ['Crates & Barrels', 'Industrial', 'Military', 'Survival', 'Trains & Rail', 'Fences & Walls'] },
  { id: 'everyday', label: 'Home & Town', categories: ['Furniture', 'Home', 'Household', 'Decor', 'Shop', 'Garage & Garden', 'Gas Station', 'Hospital', 'Metro', 'Suburban Chaos'] },
  { id: 'scifi', label: 'Sci-Fi', categories: ['Sci-Fi', 'Sci-Fi Base', 'Sci-Fi Platforms', 'Sci-Fi Walls', 'Sci-Fi Decals', 'Orbital Station', 'Neon Megacity'] },
  { id: 'medieval', label: 'Medieval & Gothic', categories: ['Medieval Village', 'Medieval', 'Castle & Siege', 'Town & Market', 'Pirate & Coast', 'Ruins', 'Gothic', 'Gothic Estate'] },
  { id: 'dungeon', label: 'Dungeons & Caves', categories: ['Dungeon', 'Dark Dungeon', 'Mines & Caves'] },
  { id: 'western', label: 'Wild West', categories: ['Wild West', 'Frontier'] },
  { id: 'ancient', label: 'Desert, Ancient & Jungle', categories: ['Desert City', 'Imperial Arena', 'Sands of Egypt', 'Jungle Ruins'] },
] as const;
/** Prop categories shown in the Nature tab. */
export const NATURE_PROP_CATEGORIES: readonly string[] = ['Trees', 'Rocks & Wood', 'Plants & Flowers'];
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
 * `mount:<id>`): one per tab or prop theme group, so opening a group loads one
 * image.
 */
export function atlasGroup(key: string): string {
  if (key.startsWith('tile:')) return 'tiles';
  if (key.startsWith('mount:')) return 'vehicles';
  const def = CORE_PROPS.find((p) => `prop:${p.id}` === key);
  return def ? propGroup(def) : 'other';
}

/** Every shipped piece that has a model picture: tiles, props and vehicles/turrets, by palette key. */
export function pictureKeys(): { key: string; tile?: string; file?: string }[] {
  return [
    ...coreCatalog.all().map((d) => ({ key: `tile:${d.id}`, tile: d.id })),
    ...CORE_PROPS.map((p) => ({ key: `prop:${p.id}`, file: p.file })),
    ...MOUNT_MODELS.map((m) => ({ key: `mount:${m}`, file: MOUNT_DEFS[m].model })),
  ];
}

/** Scenario palette entries (Objects & Logic tab) by sub-group; game-mode objects, lights and NPC spawners have their own tabs. */
export function scenarioGroup(key: string): { pane: 'entities' | 'scenario' | 'lights' | 'npcs'; group: string } {
  if (['flag', 'hill', 'bombsite', 'hostage', 'rescue', 'airplane'].includes(key)) return { pane: 'entities', group: 'Game Modes & Objectives' };
  if (key.startsWith('light:')) return { pane: 'lights', group: 'Lights' };
  if (key.startsWith('encounter')) return { pane: 'npcs', group: 'Spawners' };
  if (key.startsWith('door') || key === 'mover:portcullis' || key === 'mover:garage_door' || key === 'mover:bookcase') return { pane: 'scenario', group: 'Doors & Gates' };
  if (key.startsWith('mover:')) return { pane: 'scenario', group: 'Lifts & Movers' };
  if (key === 'button' || key.startsWith('zone') || key === 'portal' || key === 'block:field') return { pane: 'scenario', group: 'Logic & Triggers' };
  if (key.startsWith('trap:')) return { pane: 'scenario', group: 'Traps & Hazards' };
  if (key.startsWith('water:')) return { pane: 'lights', group: 'Liquids' };
  if (key === 'pad' || key.startsWith('ladder') || key === 'block:solid' || key === 'block:crumble' || key === 'block:trapdoor' || key === 'block:rope_bridge' || key === 'block:roof') return { pane: 'scenario', group: 'Platforms & Climbing' };
  return { pane: 'scenario', group: 'Destructibles' };
}
